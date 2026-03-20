import {
	ADMIN_UUID,
	CASE_STATUS,
	CASE_TYPE,
	ERROR_CODES,
	FEATURE_FLAGS,
	kafkaEvents,
	WEBHOOK_EVENTS,
	REDIS_KEYS,
	QUEUE_EVENTS,
	kafkaTopics,
	BUCKETS,
	CUSTOM_ONBOARDING_SETUP_ID,
	CUSTOM_ONBOARDING_SETUP
} from "#constants/index";
import {
	db,
	getFlagValue,
	logger,
	sqlQuery,
	sqlSequencedTransaction,
	sqlTransaction,
	getVerificationUploadsForBusiness,
	getBusinessApplicantsForWebhooks,
	fetchDepositAccountInfo,
	getEntityVerificationDetails,
	redis,
	getBusinessKybDetails,
	getBusinessProcessingHistory,
	producer
} from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { StatusCodes } from "http-status-codes";
import { caseEventsHandler } from "./cases";
import { KafkaHandlerError } from "./error";
import { schema } from "./schema";
import { DataCase, IBusinessIntegrationTaskEnriched } from "./types";
import { getCachedSignedUrl, getStripeInstance, maskString } from "#utils/index";
import { v4 as uuidv4 } from "uuid";
import { businesses } from "../../../../api/v1/modules/businesses/businesses";
import type { Business } from "#types/business";
import { industryMapBySectorCode, industryMapBySectorName, populateIndustryMaps } from "#helpers/industryHelper";
import { UUID } from "crypto";
import { assertTINValid, BusinessValidationError } from "../../../../api/v1/modules/businesses/validateBusiness";
import { sendWebhookEvent, addIndustryAndNaicsPlatform } from "#common/index";
import { taskQueue } from "#workers";
import { kafkaToQueue } from "#messaging";
import { caseManagementService } from "../../../../api/v1/modules/case-management/case-management";
import type { RedisCaseCache } from "../../../../api/v1/modules/businesses/types";
import { customerLimits } from "../../../../api/v1/modules/onboarding/customer-limits";
import { esignRepository } from "../../../../api/v1/modules/esign/repository";
import { onboarding } from "../../../../api/v1/modules/onboarding/onboarding";
import { onboardingServiceRepository } from "../../../../api/v1/modules/onboarding/repository";
import { IDataDocuments } from "src/api/v1/modules/esign/types";
import { TIN_BEHAVIOR } from "#constants";

interface GatherDataAndSendWebhookData {
	events: string[];
	options: { business_id?: string; case_id?: string; customer_id?: string };
}

class BusinessEventsHandler {
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value?.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.LINK_INVITEES:
					validateMessage(schema.linkApplicantsToInvite, payload);
					await this.linkApplicantsToInvite(payload);
					break;

				case kafkaEvents.BUSINESS_INVITED:
					validateMessage(schema.businessInvited, payload);
					await this.businessInvited(payload);
					break;

				case kafkaEvents.INTEGRATION_DATA_READY:
					validateMessage(schema.integrationDataReady, payload);
					await kafkaToQueue(taskQueue, QUEUE_EVENTS.INTEGRATION_DATA_READY, payload);
					break;

				case kafkaEvents.UPDATE_NAICS_CODE:
					validateMessage(schema.naicsData, payload);
					await this.handleNaicsData(payload);
					break;

				case kafkaEvents.UPDATE_CASE_STATUS_ON_RESPONSE:
					validateMessage(schema.updateCaseStatusOnResponse, payload);
					await this.updateCaseStatusOnResponse(payload);
					break;

				case kafkaEvents.CREATE_STRIPE_CUSTOMER:
					validateMessage(schema.createStripeCustomer, payload);
					await kafkaToQueue(taskQueue, QUEUE_EVENTS.CREATE_STRIPE_CUSTOMER, payload);
					break;

				case kafkaEvents.ADD_WEBSITE_FALLBACK:
					validateMessage(schema.addOfficialWebsite, payload);
					await this.addOfficialWebsite(payload);
					break;

				case kafkaEvents.PURGE_BUSINESS:
					validateMessage(schema.purgeBusiness, payload);
					await this.purgeBusiness(payload);
					break;

				case kafkaEvents.UPDATE_CUSTOMER_BUSINESS_RISK_MONITORING:
					validateMessage(schema.updateCustomerBusinessRiskMonitoring, payload);
					await this.updateCustomerBusinessRiskMonitoring(payload);
					break;

				case kafkaEvents.SEND_WEBHOOK:
					validateMessage(schema.gatherDataAndSendWebhookData, payload);
					await this.gatherDataAndSendWebhookData(payload);
					break;

				case kafkaEvents.ADD_CUSTOMER_MODULE_PERMISSION_SETTINGS:
					validateMessage(schema.addModulePermissionSettingsData, payload);
					await this.setCustomerSetup(payload);
					break;
				case kafkaEvents.ONBOARDING_ESIGN_COMPLETED:
					validateMessage(schema.onboardingEsignEvent, payload);
					await this.onboardingEsignEvent(payload);
					break;
				case kafkaEvents.UPDATE_CUSTOMER_INTEGRATION_SETTINGS:
					validateMessage(schema.updateCustomerIntegrationSettings, payload);
					await this.updateCustomerIntegrationSettings(payload, payload.user_id);
					break;
				default:
					break;
			}
		} catch (error) {
			logger.error({ error }, "Error in BusinessEventsHandler");
			throw error;
		}
	}

	/**
	 * Updates the status of a case based on the response payload.
	 * @param {object} payload - The response payload containing the case ID.
	 * @returns {Promise<void>} - A promise that resolves when the case status is updated.
	 * @throws {Error} - If an error occurs while updating the case status.
	 */
	async updateCaseStatusOnResponse(payload) {
		try {
			const getCaseQuery = `SELECT data_cases.* FROM data_cases LEFT JOIN data_businesses db ON db.id = data_cases.business_id WHERE data_cases.id = $1 AND db.is_deleted = false`;
			const caseDetails = await sqlQuery({ sql: getCaseQuery, values: [payload.case_id] });

			const updateCaseStatusQuery = `UPDATE data_cases SET status = $1 WHERE id = $2`;
			const updateCaseStatusQueryValues = [CASE_STATUS.PENDING_DECISION, payload.case_id];

			const insertCaseHistoryQuery = `INSERT INTO data_case_status_history (case_id, status, created_by) VALUES ($1,$2,$3)`;
			const insertCaseHistoryValues = [payload.case_id, CASE_STATUS.PENDING_DECISION, ADMIN_UUID];

			const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
				key: "customer",
				kind: "customer",
				customer_id: caseDetails.rows[0].customer_id
			});

			if (
				![
					CASE_STATUS.AUTO_APPROVED,
					CASE_STATUS.SCORE_CALCULATED,
					CASE_STATUS.AUTO_REJECTED,
					CASE_STATUS.UNDER_MANUAL_REVIEW
				].includes(caseDetails.rows[0].status) &&
				!shouldPauseTransition
			) {
				await sqlTransaction(
					[updateCaseStatusQuery, insertCaseHistoryQuery],
					[updateCaseStatusQueryValues, insertCaseHistoryValues]
				);
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function is used to map applicants with invites
	 * @param {object} body
	 */
	async linkApplicantsToInvite(body) {
		try {
			const getDataQuery = `SELECT data_invites.id FROM data_invites
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE data_invites.id = $1 AND db.is_deleted = false`;
			const getDataQueryResult = await sqlQuery({ sql: getDataQuery, values: [body.invitation_id] });

			if (!getDataQueryResult.rowCount) {
				throw new KafkaHandlerError("Invitation ID not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const queries: string[] = [];
			const values: any[] = [];

			body.applicants.forEach(applicant => {
				queries.push(`INSERT INTO rel_invite_applicants (invitation_id, applicant_id) VALUES ($1, $2)
				ON CONFLICT (invitation_id, applicant_id) DO NOTHING`);
				values.push([body.invitation_id, applicant]);
			});

			await sqlTransaction(queries, values);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Creates a business
	 * @param {object} body
	 * @returns {object}
	 */
	async businessInvited(body) {
		try {
			const insertBusinessQuery =
				"INSERT INTO data_businesses (id, status, created_by, updated_by) VALUES ($1, $2, $3, $4)";
			await sqlQuery({
				sql: insertBusinessQuery,
				values: [body.business_id, "UNVERIFIED", body.user_id, body.user_id]
			});
		} catch (error) {
			throw error;
		}
	}

	async processTaskCompletion(payload: IBusinessIntegrationTaskEnriched) {
		const { task_code } = payload;

		// delegate to any task-specific logic
		if (typeof this[task_code] === "function") {
			await this[task_code](payload);
		} else {
			logger.debug(`No handler for task_code=${task_code}`);
		}
	}

	/**
	 * Post-process handler for 'fetch_public_records' task
	 */
	fetch_public_records = async (payload: IBusinessIntegrationTaskEnriched): Promise<void> => {
		/* A public records task may give us industry information that we can write back to the business' profile */
		if (
			payload.platform_code == "equifax" &&
			payload.task_status == "SUCCESS" &&
			payload.metadata?.result?.matches?.data
		) {
			const businessID = payload.business_id;
			const {
				efx_primnaicsdesc: primarySector,
				efx_secnaicsdesc1: secondarySector,
				efx_primnaicscode: primarySectorCode
			}: {
				efx_primnaicsdesc: string | undefined;
				efx_secnaicsdesc1: string | undefined;
				efx_primnaicscode: string | undefined;
			} = payload.metadata.result.matches.data;
			if (!primarySector && !secondarySector && !primarySectorCode) {
				logger.debug(`businessId=${businessID} No industry info found in equifax match data`);
				// Match has no industry info
				return;
			}
			let update: Pick<Business.Record, "industry" | "naics_id" | "mcc_id"> = {};

			const business = await businesses.getBusinessByID({ businessID });

			if (industryMapBySectorName.size === 0) {
				await populateIndustryMaps();
			}
			const primary = industryMapBySectorName.get(primarySector as string);
			const secondary = industryMapBySectorName.get(secondarySector as string);

			let sectorCode: number | undefined = 0;
			if (primarySectorCode && primarySectorCode.toString().length >= 2) {
				const twoDigitCode = parseInt(primarySectorCode.toString().substring(0, 2));
				sectorCode = industryMapBySectorCode.get(twoDigitCode);
			}
			let naicsId;
			if (primarySectorCode && primarySector) {
				const sectorCodeAsNumber = parseInt(primarySectorCode);
				const naicsCode = !isNaN(sectorCodeAsNumber) ? sectorCodeAsNumber : undefined;
				if (naicsCode) {
					const response = await businesses.getMccIdAndNaicsIdByNaicsCode(naicsCode);
					if (!business.naics_id || !business.mcc_id) {
						update.naics_id = response?.naics_id;
						update.mcc_id = response?.mcc_id ? response.mcc_id : undefined;
					}
					naicsId = response?.naics_id;
				}
			}

			const newIndustry = primary || secondary || sectorCode || 0;
			if (newIndustry && newIndustry > 0 && !business.industry) {
				update.industry = newIndustry;
			}
			if (primarySectorCode) {
				await addIndustryAndNaicsPlatform(businessID, "equifax", { naics: naicsId, industry: newIndustry });
			}
			if (business.industry && business.naics_id && business.mcc_id) {
				//industry already set
				logger.debug(`businessId=${businessID} Industry already set for business industry=${business.industry}`);
				return;
			}
			if (Object.keys(update).length > 0) {
				logger.info(`Setting industry info for business ${businessID} to ${JSON.stringify(update)}`);
				// TODO: This should interact with the Business class directly but there isn't a method to do an update
				await db("data_businesses")
					.update({ ...update, updated_by: ADMIN_UUID })
					.where({ id: businessID })
					.andWhere({ is_deleted: false });
			} else {
				logger.debug(
					`No industry can be matched for businessId=${businessID} primary=${primarySector} secondary=${secondarySector} sectorCode=${primarySectorCode}`
				);
			}
		}
	};

	fetch_business_entity_website_details = async (payload: IBusinessIntegrationTaskEnriched): Promise<void> => {
		if (payload.platform_code == "serp_scrape" && payload.task_status == "SUCCESS" && payload.metadata?.website) {
			await this.addOfficialWebsite({
				business_id: payload.business_id as UUID,
				official_website: payload.metadata.website
			});
		}
	};

	fetch_identity_verification = async (payload: IBusinessIntegrationTaskEnriched): Promise<void> => {
		const ownerID = payload.reference_id;
		const businessID = payload.business_id;
		logger.info(`-------------------------------------------------------------`);
		logger.info(`fetch_identity_verification businessID ${businessID}`);
		logger.info(`fetch_identity_verification payload ${JSON.stringify(payload)}`);

		//If Plaid IDV & plaid's response was "Failed" set status to "under review"
		if (
			payload.task_status === "SUCCESS" &&
			ownerID &&
			businessID &&
			payload.metadata?.plaidResponse?.status === "failed"
		) {
			//Get all pending onboarding cases for business
			const onboardingCasesForBusiness = await db<DataCase>("data_cases")
				.leftJoin("data_businesses as db", "db.id", "data_cases.business_id")
				.select(["data_cases.id", "data_cases.status", "business_id", "data_cases.customer_id"])
				.where({ "data_cases.business_id": payload.business_id })
				.andWhere({ "db.is_deleted": false })
				.whereIn("data_cases.case_type", [CASE_TYPE.ONBOARDING])
				.whereIn("data_cases.status", [CASE_STATUS.SUBMITTED, CASE_STATUS.ONBOARDING]);
			//Set them all to manual review
			logger.info(
				`fetch_identity_verification onboardingCasesForBusiness ${JSON.stringify(onboardingCasesForBusiness)}`
			);
			await Promise.all(
				onboardingCasesForBusiness.map(async caseRecord => {
					try {
						const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
							key: "customer",
							kind: "customer",
							customer_id: caseRecord.customer_id
						});
						if (shouldPauseTransition) {
							// Pause the transition for this case
							return;
						}
						return await caseEventsHandler.updateCaseStatus({
							status: CASE_STATUS.UNDER_MANUAL_REVIEW,
							user_id: ownerID,
							case_id: caseRecord.id
						});
					} catch (error) {
						logger.error({ error }, `Failed to update case status for case ${caseRecord.id}`);
						// Continue processing other cases even if one fails
					}
				})
			);
		}
	};

	fetch_business_entity_verification = async (payload: IBusinessIntegrationTaskEnriched): Promise<void> => {
		try {
			// if task is successful, mark the business as verified
			if (payload.task_status === "SUCCESS") {
				// Middesk
				if (payload.platform_id === 16) {
					const { business_id: businessID } = payload;
					try {
						// When running asynchronously in a task handler, we've most likely already ingested the TIN response from middesk so we can try fewer times before timing out
						await assertTINValid(businessID as UUID, 5);
					} catch (ex) {
						if (ex instanceof BusinessValidationError) {
							logger.error({ error: ex }, `businessId=${businessID} Business Entity Verification failed`);
						} else {
							logger.error({ error: ex }, `businessId=${businessID} Business Entity Verification failed`);
						}
						return;
					}

					// Check if the business already has a case
					const caseCreationBody: RedisCaseCache = (await redis.get<RedisCaseCache>(
						`${REDIS_KEYS.business_verification}:${businessID}`
					)) as any;
					if (caseCreationBody?.body) {
						const { userID, customerID, inviteID } = caseCreationBody.body;
						const { userInfo } = caseCreationBody;
						await caseManagementService.ensureCasesExist(businessID as UUID, {
							applicantID: userID,
							customerID,
							inviteID,
							userInfo
						});
					}
				}
				// OpenCorporate
				if (payload.platform_id === 23) {
					// TODO: Handle OpenCorporate verfication & record population based upon task payload
				}
			}
		} catch (error) {
			logger.error({ error }, "Error in fetch_business_entity_verification");
			throw error;
		}
	};

	/**
	 * Handles the NAICS data by updating the naics_code and naics_title fields in the data_businesses table.
	 * @param {Object} body - The body of the message containing the NAICS data.
	 * @returns {Promise<void>} - A promise that resolves when the update is completed.
	 * @throws {Error} - If an error occurs during the update process.
	 */
	async handleNaicsData(body) {
		try {
			let industryId;
			if (body.industry_code) {
				const getIdQuery = `SELECT id from core_business_industries WHERE code = $1`;
				const { rows } = await sqlQuery({ sql: getIdQuery, values: [body.industry_code] });
				industryId = rows[0]?.id;
			}
			const response = await businesses.getMccIdAndNaicsIdByNaicsCode(body.naics_code);
			const naicsId = response?.naics_id;
			const mccId = response?.mcc_id ? response.mcc_id : undefined;
			const updateCodeQuery = `UPDATE data_businesses
					SET naics_id = $1,
						mcc_id = $2,
						industry = $3
					WHERE id = $4`;
			await sqlQuery({ sql: updateCodeQuery, values: [naicsId, mccId, industryId, body.business_id] });
			if (body.platform) {
				await addIndustryAndNaicsPlatform(body.business_id, body.platform, { naics: naicsId, industry: industryId });
			}
		} catch (error) {
			throw error;
		}
	}

	async createStripeCustomer(body: {
		business_id: UUID;
		applicant_id: UUID;
		name: string;
		email: string;
	}): Promise<void> {
		const customerID = uuidv4();

		const customerQuery = `SELECT subscriptions.data_customers.* FROM subscriptions.data_customers
				LEFT JOIN data_businesses db ON db.id = subscriptions.data_customers.business_id
				WHERE subscriptions.data_customers.business_id = $1 AND subscriptions.data_customers.applicant_id = $2 AND db.is_deleted = false`;

		const businessQuery = `SELECT subscriptions.data_businesses_subscriptions.* FROM subscriptions.data_businesses_subscriptions
				LEFT JOIN data_businesses db ON db.id = subscriptions.data_businesses_subscriptions.business_id
				WHERE subscriptions.data_businesses_subscriptions.business_id = $1 AND db.is_deleted = false`;

		const [customerResult, businessResult] = await sqlTransaction(
			[customerQuery, businessQuery],
			[[body.business_id, body.applicant_id], [body.business_id]]
		);

		if (customerResult.rows.length) {
			logger.warn(`Stripe customer already exists: ${JSON.stringify(body)}`);
			return;
		}

		if (businessResult.rows.length) {
			logger.warn(`Stripe business subscription already exists: ${JSON.stringify(body)}`);
			return;
		}

		// customerID => idempotency key
		const response = await getStripeInstance().createNewStripeCustomer(`${body.name}`, body.email, customerID, body);

		const insertCustomersQuery =
			"INSERT INTO subscriptions.data_customers (id, stripe_customer_id, applicant_id, business_id) VALUES ($1, $2, $3, $4)";
		await sqlQuery({
			sql: insertCustomersQuery,
			values: [customerID, response.id, body.applicant_id, body.business_id]
		});
	}

	async addOfficialWebsite(body: { business_id: UUID; official_website: string }) {
		try {
			const businessWebsiteRows = await db("data_businesses")
				.select("official_website")
				.where("id", body.business_id)
				.andWhere("data_businesses.is_deleted", false);
			if (!businessWebsiteRows.length || (businessWebsiteRows.length && !businessWebsiteRows[0].official_website)) {
				await db("data_businesses")
					.update({ official_website: body.official_website })
					.where("id", body.business_id)
					.andWhere("data_businesses.is_deleted", false);
			}
		} catch (error) {
			throw error;
		}
	}

	async purgeBusiness(payload: { business_id: UUID | string }): Promise<void> {
		logger.info(`CASE: Purging business with id ${payload.business_id}`);

		// get customer-id for given business-id
		const customerDetails = await db("rel_business_customer_monitoring").where("business_id", payload.business_id);

		const deleteBusinessQuery = `DELETE FROM data_businesses WHERE id = $1`;
		const deleteOrphanedBusinessOwnersQuery = `DELETE FROM data_owners WHERE id NOT IN (SELECT owner_id FROM rel_business_owners)`;
		await sqlSequencedTransaction(
			[deleteBusinessQuery, deleteOrphanedBusinessOwnersQuery],
			[[payload.business_id], []]
		);

		if (customerDetails && customerDetails.length) {
			// check and update purge business count and decrease onboarding buiness count
			for (const customer of customerDetails) {
				await customerLimits.checkAndIncreasePurgeCount(customer.customer_id, payload.business_id as UUID);
			}
		}

		logger.info(`CASE: Business with id ${payload.business_id} has been purged`);
	}

	async updateCustomerBusinessRiskMonitoring(payload: {
		customer_id: UUID;
		risk_monitoring_status: boolean;
		user_id?: UUID;
		parent_customer_data?: {
			parent_id: UUID;
			parent_name: string;
			parent_customer_type: string;
		};
	}) {
		try {
			const updateMonitoringStatusOfAllBusinessFlag = await getFlagValue(
				FEATURE_FLAGS.WIN_1241_CUSTOMER_RISK_MONITORING
			);
			if (!updateMonitoringStatusOfAllBusinessFlag) {
				logger.warn(
					`Feature flag ${FEATURE_FLAGS.WIN_1241_CUSTOMER_RISK_MONITORING} is disabled. Skipping update of risk monitoring status for all businesses related to customer ${payload.customer_id}`
				);
				return;
			}
			if (payload.parent_customer_data?.parent_id) {
				// Copy settings from parent customer to child customer
				// First, get all businesses monitored by the parent customer
				const getParentBusinessesQuery = `
					SELECT rbcm.is_monitoring_enabled 
					FROM rel_business_customer_monitoring rbcm
					WHERE rbcm.customer_id = $1
				`;
				const parentBusinessesResult = await sqlQuery({
					sql: getParentBusinessesQuery,
					values: [payload.parent_customer_data.parent_id]
				});

				if (parentBusinessesResult.rows.length > 0) {
					// Copy all parent's business monitoring relationships to child
					const updateMonitoringQuery = `
						UPDATE rel_business_customer_monitoring 
						SET is_monitoring_enabled = $1 
						WHERE customer_id = $2
					`;
					await sqlQuery({
						sql: updateMonitoringQuery,
						values: [parentBusinessesResult.rows[0].is_monitoring_enabled || false, payload.customer_id]
					});

					logger.info(
						{
							parentId: payload.parent_customer_data.parent_id,
							childId: payload.customer_id,
							businessCount: parentBusinessesResult.rows.length
						},
						"Copied risk monitoring settings for businesses from parent to child customer"
					);
				} else {
					logger.info(
						{
							parentId: payload.parent_customer_data.parent_id,
							childId: payload.customer_id
						},
						"Parent customer has no business monitoring relationships to copy"
					);
				}
			} else {
				// Original logic - update monitoring status for all businesses associated with this customer
				const updateMonitoringQuery = `
					UPDATE rel_business_customer_monitoring 
					SET is_monitoring_enabled = $1 
					WHERE customer_id = $2
				`;
				const result = await sqlQuery({
					sql: updateMonitoringQuery,
					values: [payload.risk_monitoring_status || false, payload.customer_id]
				});

				logger.info(
					{
						customerId: payload.customer_id,
						monitoringEnabled: payload.risk_monitoring_status || false,
						affectedRows: result.rowCount
					},
					"Updated risk monitoring status for all businesses of customer"
				);
			}
		} catch (error) {
			throw error;
		}
	}

	async gatherDataAndSendWebhookData(body: GatherDataAndSendWebhookData) {
		try {
			let failedEvents: string[] = [];
			for (const event of body.events) {
				try {
					switch (event) {
						case WEBHOOK_EVENTS.BUSINESS_UPDATED: {
							if (!body.options?.business_id) {
								throw new Error("BusinessID not found");
							}

							const customersData = await businesses.getCustomersByBusinessId(body.options.business_id);
							const businessDetails = await businesses.getBusinessByID(
								{ businessID: body.options.business_id, tinBehavior: TIN_BEHAVIOR.PLAIN },
								{ fetch_owner_details: true }
							);
							
							// Retrieve business-specific data which is consistent across all customers
							const transformedOwners = businessDetails["owners"]?.map(owner => ({
								...owner,
								title: owner.title?.title
							}));
							const customFields = await businesses.getCustomFieldsByBusinessId(body.options.business_id);
							logger.info(customFields, `gatherDataAndSendWebhookData: Custom Fields for ${body.options.business_id}`);
							const businessVerificationUploads = await getVerificationUploadsForBusiness(body.options.business_id);
							logger.info(
								businessVerificationUploads,
								`gatherDataAndSendWebhookData: businessVerificationUploads for ${body.options.business_id}`
							);

							const depositAccountResult = await fetchDepositAccountInfo(body.options.business_id);
							const depositAccounts = depositAccountResult?.numbers?.ach?.map(account => ({
								account_number: account.account,
								routing_number: account.routing
							}));
							logger.debug(
								depositAccountResult,
								`gatherDataAndSendWebhookData: depositAccountResult for ${body.options.business_id}`
							);

							const businessApplicants = await getBusinessApplicantsForWebhooks(body.options.business_id);

							const businessEntityDetails = await getEntityVerificationDetails(body.options.business_id);
							businessDetails["formation_date"] = businessEntityDetails?.businessEntityVerification?.formation_date;

							const entityTypeList = businessEntityDetails?.registrations
								?.map(registration => {
									if (registration.entity_type) {
										return registration.entity_type;
									}
									return null;
								})
								.filter(entity => entity !== null);

							businessDetails["entity_type"] = [...new Set(entityTypeList)];

							try {
								const kybDetails = await getBusinessKybDetails(body.options.business_id);
								businessDetails["corporation_type"] = kybDetails?.corporation?.value;
							} catch (error: any) {
								logger.error(
									error,
									`gatherDataAndSendWebhookData: Something went wrong while fetching KYB details for ${body.options.business_id} ${error.message}`
								);
							}

							try {
								const processingStatementData = await getBusinessProcessingHistory(body.options.business_id as UUID);
								const filteredProcessingStatements = processingStatementData.map(record => {
									const result = {
										american_express_data: record.american_express_data,
										card_data: record.card_data,
										point_of_sale_data: record.point_of_sale_data,
										...(record.file && {
											file: {
												file_name: record.file.fileName,
												url: record.file.signedRequest
											}
										})
									};
									return result;
								});
								businessDetails["processing_statements"] = filteredProcessingStatements;
							} catch (e: any) {
								logger.error(
									e,
									`gatherDataAndSendWebhookData: Something went wrong while fetching processing statements data for ${body.options.business_id}: ${e.message}`
								);
							}

							for (const customer of customersData) {
								// the original businessDetails query does not filter by customer_id, and so the possibility exists that we could grab the wrong customer's data
								// if the business is associated with multiple customers, we need to fetch the customer-specific external_id and is_monitoring_enabled values
								// if the business is associated with only one customer, we can use the original businessDetails data to avoid making an additional query
								const hasMultipleCustomers = customersData.length > 1;

								const { external_id: externalId, is_monitoring_enabled: isMonitoringEnabled } =
									hasMultipleCustomers
										? await businesses.getCustomerBusinessById(
												body.options.business_id,
												customer.customer_id,
												TIN_BEHAVIOR.PLAIN
											)
										: businessDetails;

								const mergedBusinessDetails = {
									...businessDetails,
									...(customFields && customFields.length ? { additional_data: customFields } : {}),
									...(transformedOwners && transformedOwners.length ? { owners: transformedOwners } : {}),
									...(businessVerificationUploads && businessVerificationUploads.length
										? { business_verification_uploads: businessVerificationUploads }
										: {}),
									...{ business_applicants: businessApplicants },
									...(depositAccounts && depositAccounts.length ? { deposit_accounts: depositAccounts } : {}),
									external_id: externalId,
									is_monitoring_enabled: isMonitoringEnabled
								};

								const maskedBusinessDetails = this.maskSensitiveFields(mergedBusinessDetails);

								logger.info(
									maskedBusinessDetails,
									`gatherDataAndSendWebhookData: Webhook payload for business ${body.options.business_id}, customer ${customer.customer_id}`
								);

								await sendWebhookEvent(customer.customer_id, WEBHOOK_EVENTS.BUSINESS_UPDATED, mergedBusinessDetails);
							}

							break;
						}

						default: {
							logger.error(`gatherDataAndSendWebhookData: Invalid event type ${event}`);
							break;
						}
					}
				} catch (ex: any) {
					failedEvents.push(event);
					logger.error(
						ex,
						`gatherDataAndSendWebhookData: webhook data fetching something went wrong for ${event} ${ex.message}`
					);
				}
			}

			if (failedEvents.length) {
				body.events = failedEvents;
				throw new Error(`Webhook data fetching something went wrong`);
			}
		} catch (error) {
			throw error;
		}
	}

	maskSensitiveFields(businessEventPayload) {
		const { tin, owners = [], deposit_accounts = [] } = businessEventPayload;
		return {
			...businessEventPayload,
			tin: tin ? maskString(tin) : null,
			owners: owners.map(owner => ({
				...owner,
				ssn: owner.ssn ? maskString(owner.ssn) : null
			})),
			deposit_accounts: deposit_accounts.map(deposit => ({
				...deposit,
				account_number: maskString(
					deposit.account_number,
					deposit.account_number ? deposit.account_number.length - 4 : 0
				)
			}))
		};
	}

	async setCustomerSetup(customSettingsPayload: {
		customer_id: UUID;
		module_permissions: Record<string, boolean>;
		user_id: UUID;
		parent_customer_data?: {
			parent_id: UUID;
			parent_name: string;
			parent_customer_type: string;
		};
	}) {
		// Check if parent_customer_data is present
		if (customSettingsPayload.parent_customer_data?.parent_id) {
			// Copy settings from parent customer to child customer
			await onboarding.copyCustomerSetups(
				customSettingsPayload.parent_customer_data.parent_id,
				customSettingsPayload.customer_id,
				customSettingsPayload.user_id
			);

			// Copy custom files configuration from parent to child
			await onboarding.copyCustomFilesConfiguration(
				customSettingsPayload.parent_customer_data.parent_id,
				customSettingsPayload.customer_id,
				customSettingsPayload.user_id
			);

			// Copy onboarding limits from parent to child
			await onboardingServiceRepository.copyOnboardingLimitsFromParent(
				customSettingsPayload.parent_customer_data.parent_id,
				customSettingsPayload.customer_id,
				customSettingsPayload.user_id
			);

			// Copy customer templates from parent to child
			await esignRepository.copyCustomerTemplatesFromParent(
				customSettingsPayload.parent_customer_data.parent_id,
				customSettingsPayload.customer_id
			);
			logger.info(
				{
					parentId: customSettingsPayload.parent_customer_data.parent_id,
					childId: customSettingsPayload.customer_id,
					parentName: customSettingsPayload.parent_customer_data.parent_name,
					parentType: customSettingsPayload.parent_customer_data.parent_customer_type
				},
				"Copied onboarding settings and customer templates from parent to child customer"
			);
		} else {
			// Create new settings using module_permissions
			await onboarding.createCustomerOnboardingSetups(
				customSettingsPayload.customer_id,
				{
					module_permissions: customSettingsPayload.module_permissions
				},
				customSettingsPayload.user_id
			);
		}
	}

	async onboardingEsignEvent(payload: {
		document_id: UUID;
		template_id: UUID;
		customer_id: UUID;
		business_id: UUID;
		case_id: UUID;
		user_id: UUID;
	}) {
		const { document_id, template_id, customer_id, business_id, case_id, user_id } = payload;

		await esignRepository.insertSignedDocument({
			document_id,
			template_id,
			customer_id,
			business_id,
			case_id,
			signed_by: user_id,
			mapping_data: {},
			created_by: customer_id,
			updated_by: customer_id
		});

		await redis.delete(`{business}:${business_id}:{mapping_fields}`);

		const query = db<Array<IDataDocuments & { name: string }>>("esign.data_documents")
			.select("esign.data_documents.*", "esign.data_document_templates.name")
			.leftJoin(
				"esign.data_document_templates",
				"esign.data_documents.template_id",
				"esign.data_document_templates.template_id"
			)
			.where("document_id", document_id)
			.first();
		const document = await query;
		const documentUrl = await getCachedSignedUrl(document.document_id, `signed_documents`, BUCKETS.ELECTRONIC_CONSENT);

		// Send audit log event to notification service
		const auditMessagePayload = {
			document_id: document_id,
			document_name: document?.name || "",
			document_url: documentUrl?.signedRequest || "",
			template_id: template_id,
			customer_id: customer_id,
			business_id: business_id,
			case_id: case_id,
			user_id: user_id
		};

		await producer.send({
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [
				{
					key: business_id,
					value: {
						event: kafkaEvents.ONBOARDING_ESIGN_COMPLETED_AUDIT,
						...auditMessagePayload
					}
				}
			]
		});
	}

	async updateCustomerIntegrationSettings(
		payload: {
			customer_id: UUID;
			module_permissions: {
				equifax_credit_score: boolean;
				identity_verification: boolean;
			};
		},
		user_id: UUID
	): Promise<void> {
		try {
			logger.info(`Updating customer integration settings for customer ${payload.customer_id}`);

			// Fetch existing customer setups
			const customerSetups = await onboarding.getCustomerOnboardingSetups({ customerID: payload.customer_id });

			const equifaxSetup = customerSetups.find(
				s => s.setup_id === CUSTOM_ONBOARDING_SETUP_ID.EQUIFAX_CREDIT_SCORE_SETUP
			);

			const modifyPagesFieldsSetup = customerSetups.find(
				s => s.setup_id === CUSTOM_ONBOARDING_SETUP_ID.MODIFY_PAGES_FIELDS_SETUP
			);

			// Update Equifax setup
			if (equifaxSetup) {
				const updateEquifaxQuery = `
				UPDATE onboarding_schema.rel_customer_setup_status
				SET is_enabled = $1
				WHERE customer_id = $2 AND setup_id = $3
			`;

				await sqlQuery({
					sql: updateEquifaxQuery,
					values: [
						payload.module_permissions.equifax_credit_score,
						payload.customer_id,
						CUSTOM_ONBOARDING_SETUP_ID.EQUIFAX_CREDIT_SCORE_SETUP
					]
				});
			}

			// Update IDV via Ownership stage
			if (modifyPagesFieldsSetup) {
				const customerStages = await onboarding.getCustomerOnboardingStages(
					{ customerID: payload.customer_id },
					{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP }
				);

				if (!customerStages?.length) {
					throw new Error(`No onboarding stages found for customer ${payload.customer_id}`);
				}

				const ownershipStage = customerStages.find(stage => stage.stage_code.toLowerCase() === "ownership");
				if (!ownershipStage) {
					throw new Error(`Ownership stage not found for customer ${payload.customer_id}`);
				}

				// Update the Disable Identity Verification field
				const updatePayload = {
					stage_id: ownershipStage.stage_id,
					stage: ownershipStage.stage,
					is_enabled: ownershipStage.is_enabled,
					is_skippable: ownershipStage.is_skippable,
					config: {
						additional_settings: [],
						fields: [
							{
								name: "Disable Identity Verification",
								status: payload.module_permissions.identity_verification ? false : true,
								section_name: "Identity Verification"
							},
							{
								name: "Enable Identity Verification",
								status: payload.module_permissions.identity_verification ? true : false,
								section_name: "Identity Verification"
							}
						],
						sub_fields: [],
						integrations: []
					}
				};
				await onboarding.updateCustomerOnboardingStages(
					{ customerID: payload.customer_id },
					{
						setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP,
						stages: [updatePayload]
					},
					{ user_id }
				);
			}
			logger.info(`Successfully updated integration settings for customer ${payload.customer_id}`);
		} catch (error) {
			logger.error({ error }, `Error updating integration settings for customer ${payload.customer_id}`);
			throw new KafkaHandlerError(
				"Failed to update customer integration settings",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}

export const businessEventsHandler = new BusinessEventsHandler();
