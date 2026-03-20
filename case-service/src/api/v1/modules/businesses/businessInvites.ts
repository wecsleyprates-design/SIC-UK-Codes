import { tokenConfig, envConfig } from "#configs/index";
import { BusinessInvite } from "#types/businessInvite";
import { BusinessApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { getFlagValue } from "#helpers/LaunchDarkly";
import {
	ERROR_CODES,
	INVITE_STATUS,
	QUEUES,
	QUEUE_EVENTS,
	kafkaEvents,
	kafkaTopics,
	FEATURE_FLAGS,
	CASE_STATUS_ENUM,
	SUBROLES,
	INVITE_STATUSES,
	ROLE_ID,
	BUSINESS_STATUS,
	CUSTOM_ONBOARDING_SETUP,
	CASE_STATUS
} from "#constants/index";
import {
	db,
	sqlQuery,
	sqlTransaction,
	logger,
	producer,
	BullQueue,
	getBusinessCoApplicants,
	getBusinessApplicantByApplicantId,
	getApplicantByID,
	isOnboardingLimitExhausted,
	getCustomerWithPermissions,
	emailExists,
	redis,
	inviteBusinessApplicants,
	getBusinessApplicants
} from "#helpers/index";
import { encryptData, decodeInvitationToken, jwtSign, formatNumberWithoutPlus } from "#utils/index";
import { v4 as uuid } from "uuid";
import { caseManagementService, caseManagementService as caseMgmt } from "../case-management/case-management";
import type { UUID } from "crypto";
import type { CustomField } from "../onboarding/customField";
import { onboarding } from "../onboarding/onboarding";
import { CustomFieldHelper } from "../onboarding/customFieldHelper";
import { customerLimits } from "../onboarding/customer-limits";
import type { NormalizedCustomFieldValues } from "../onboarding/types";
import { businesses } from "./businesses";

const invitationStatusQueue = new BullQueue(QUEUES.INVITATION_STATUS);

export class BusinessInvites {
	static async create({
		business_id,
		customer_id,
		created_by
	}: Pick<BusinessInvite.Egg, "business_id" | "customer_id" | "created_by">): Promise<BusinessInvite.Record> {
		const egg: BusinessInvite.Egg = {
			business_id,
			customer_id,
			created_by,
			status: BusinessInvite.status.INVITED,
			updated_by: created_by
		};
		return BusinessInvites.fromEgg(egg);
	}
	static async fromEgg(egg: BusinessInvite.Egg): Promise<BusinessInvite.Record> {
		const invite = await db<BusinessInvite.Record>("data_invites").insert(egg).returning("*");
		void BusinessInvites.createHistoryFromEgg({
			invitation_id: invite[0].id,
			status: egg.status,
			created_by: egg.created_by
		}).catch(err => {
			logger.error({ err }, `Error creating history for invite ${egg.id}`);
		});
		return invite[0];
	}
	static async fromId(id: string): Promise<BusinessInvite.Record> {
		const record = await db<BusinessInvite.Record>("data_invites")
			.select("data_invites.*")
			.leftJoin("data_businesses as db", "db.id", "data_invites.business_id")
			.where("data_invites.id", id)
			.andWhere("db.is_deleted", false)
			.first();

		if (record) {
			return record;
		}
		throw new BusinessApiError("INVITE_NOT_FOUND");
	}

	static async updateInvite(id: string | UUID, update: Partial<BusinessInvite.Record>): Promise<BusinessInvite.Record> {
		const record = await db<BusinessInvite.Record>("data_invites").where("id", id).update(update).returning("*");

		if (record && Array.isArray(record) && record.length > 0) {
			if (update.status === INVITE_STATUS.ACCEPTED && record[0].case_id) {
				void onboarding.createBusinessCustomFieldValuesForInvite(id as UUID).catch(_error => {
					/* swallow */
				});
			}
			void BusinessInvites.createHistoryFromEgg({
				invitation_id: record[0].id,
				status: update.status ?? record[0].status,
				created_by: update.updated_by ?? update.created_by ?? record[0].created_by
			}).catch(err => {
				logger.error({ err }, `Error creating history for invite ${record[0].id}`);
			});
			return record[0];
		}

		throw new BusinessApiError("INVITE_NOT_FOUND");
	}

	static async createHistoryFromEgg(egg: BusinessInvite.HistoryEgg): Promise<BusinessInvite.HistoryRecord> {
		const record = await db<BusinessInvite.HistoryRecord>("data_invites_history").insert(egg).returning("*");
		if (record && Array.isArray(record) && record.length > 0) {
			return record[0];
		}
		throw new BusinessApiError("HISTORY_NOT_FOUND");
	}

	/**
	 * Resolves whether the customer's invite flow should use no-login (magic link / Begin Application)
	 * based on onboarding config ("Login with Email & Password" disabled) and WIN_1380 feature flag.
	 * Used by Add Business send_invitation path so it respects the same admin settings as Send Business Invite.
	 */
	static async resolveIsNoLoginForCustomer(customerID: string | null): Promise<boolean> {
		if (!customerID) return false;
		const customerConfig = await onboarding.getCustomerOnboardingStages(
			{ customerID },
			{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
			false
		);
		const loginWithEmailPasswordField = customerConfig
			?.find(row => row.stage.toLowerCase() == "login")
			?.config?.fields?.find(field => field.name.toLowerCase() == "Login with Email & Password".toLowerCase());
		const isSyncBusinessInvitation = await getFlagValue(FEATURE_FLAGS.WIN_1380_BUSINESS_INVITATION_LINKS, {
			key: "customer",
			kind: "customer",
			customer_id: customerID
		});
		return (loginWithEmailPasswordField ? !loginWithEmailPasswordField?.status : false) || isSyncBusinessInvitation;
	}

	/**
	 * Creates a new invite for a business and sends a kafka message to auth service to send invitation mail
	 * @param {UUID | null} customerID UUID or null when SMB
	 * @param {any} body
	 * @param {any} userInfo
	 * @param {File[]} files uploaded as part of the invite
	 * @returns {object} applicant invitation url
	 */
	static async inviteBusiness(
		customerID: UUID | null,
		body: Record<string, any>,
		userInfo: Record<string, any>,
		files: Express.Multer.File[] = [],
		syncBusinessInvitation: boolean = false,
		sendOnboardApplicantEmail: boolean = true
	): Promise<Record<string, any> & { invitation_url?: string }> {
		try {
			const customerConfig = await onboarding.getCustomerOnboardingStages(
				{ customerID: customerID ?? "" },
				{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
				false
			);
			const loginWithEmailPasswordField = customerConfig
				?.find(row => row.stage.toLowerCase() == "login")
				?.config?.fields?.find(field => field.name.toLowerCase() == "Login with Email & Password".toLowerCase());
			const lightningVerificationFlag = await getFlagValue(FEATURE_FLAGS.DOS_84_LIGHTNING_VERIFICATION, {
				key: "customer",
				kind: "customer",
				customer_id: customerID
			});

			if (body.is_lightning_verification && !lightningVerificationFlag) {
				throw new BusinessApiError(
					"Lightning verification is not enabled for this customer",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const isLightningVerification = lightningVerificationFlag && body?.is_lightning_verification;

			if (body && Object.hasOwn(body, "business")) {
				body.new_business = body.business;
			}

			if (body && Object.hasOwn(body, "applicants")) {
				body.new_applicants = body.applicants;
			}

			const user = {
				key: userInfo.user_id,
				name: `${body.new_applicants[0].first_name} ${body.new_applicants[0].last_name}`,
				email: body.new_applicants[0].email
			};
			const isEasyFlow = (user && (await getFlagValue(FEATURE_FLAGS.WIN_1152_EASY_ONBOARDING_FLOW, user))) ?? false;

			if (customerID && !isEasyFlow) {
				await isOnboardingLimitExhausted(customerID);
			}

			const result = await getCustomerWithPermissions({
				customer_ids: [customerID],
				permissions: ["onboarding_module:write", "risk_monitoring_module:write"]
			});
			if (!Object.hasOwn(result, "onboarding_module:write")) {
				throw new BusinessApiError(
					"Customer does not have permission to onboard businesses.",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.INVALID
				);
			}
			let message: Record<string, any> = {};
			const invitationID = uuid() as UUID;
			const queries: string[] = [];
			const values: any[] = [];
			let createNewBusiness = false;
			const skipCreditCheck = Object.hasOwn(body, "skip_credit_check") && body.skip_credit_check;
			const bypassSSN = Object.hasOwn(body, "bypass_ssn") && body.bypass_ssn;

			// allowing email of applicant only
			for (const applicant of body.new_applicants) {
				const response = await emailExists({ email: applicant.email }, "");
				if (response.email_exists && response.role_id !== ROLE_ID.APPLICANT) {
					throw new BusinessApiError(
						`Cannot onboard ${applicant.email} to the platform. Contact support.`,
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}

			const monitoringAllowedCustomers = Object.hasOwn(result, "risk_monitoring_module:write")
				? result["risk_monitoring_module:write"]
				: [];
			const isMonitoringAllowed = monitoringAllowedCustomers?.includes(customerID);
			logger.info(`Monitoring allowed for customer ${customerID}: ${isMonitoringAllowed}`);

			const prefill: Record<string, any> = {
				esign_template_id: body.esign_template_id
			};

			if (customerID && body.custom_fields && Object.entries(body.custom_fields).length > 0) {
				const result = await this.processCustomFields(
					customerID,
					invitationID,
					body.custom_field_template_id,
					body,
					files
				);
				prefill.custom_fields = result?.normalizedCustomFieldValues || [];
				prefill.custom_field_template_id = result?.customFieldTemplateID || "";
			}

			if (Object.hasOwn(body, "existing_business") || Object.hasOwn(body, "existing_business_id")) {
				const existingBusinessID = body.existing_business_id || body.existing_business?.business_id;
				const getBusinessQuery = `SELECT db.id, db.name, db.status FROM data_businesses db
					INNER JOIN rel_business_customer_monitoring rcm ON db.id = rcm.business_id
					WHERE db.id = $1 AND rcm.customer_id = $2 AND db.is_deleted = false`;

				const business = await sqlQuery({ sql: getBusinessQuery, values: [existingBusinessID, customerID] });
				if (!business.rowCount) {
					throw new BusinessApiError("This business was not onboarded by the current customer.");
				}

				if (isLightningVerification && business.rows[0]?.status === BUSINESS_STATUS.VERIFIED) {
					return { message: "Business is already in verified state.", invitation_url: "" };
				}

				if (
					Object.hasOwn(body, "existing_business") &&
					Object.hasOwn(body.existing_business, "is_quick_add") &&
					body.existing_business?.is_quick_add === true
				) {
					createNewBusiness = true;
				}

				if (Object.hasOwn(body, "skip_credit_check")) {
					await onboarding.addOrUpdateCustomerBusinessConfigs(
						{ customerID: customerID ?? "", businessID: existingBusinessID },
						{ skip_credit_check: skipCreditCheck },
						{ user_id: userInfo.user_id }
					);
				}
				if (Object.hasOwn(body, "bypass_ssn")) {
					await onboarding.addOrUpdateCustomerBusinessConfigs(
						{ customerID: customerID ?? "", businessID: existingBusinessID },
						{ bypass_ssn: bypassSSN },
						{ user_id: userInfo.user_id }
					);
				}

				const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
					key: "customer",
					kind: "customer",
					customer_id: customerID
				});

				let caseIdToUse: UUID | null = body?.case_id ?? null;
				if (shouldPauseTransition) {
					const selectCaseQuery = `SELECT id, status FROM data_cases WHERE business_id = $1 AND customer_id = $2 AND customer_initiated = true ORDER BY created_at DESC LIMIT 1`;
					const caseResult = await sqlQuery({ sql: selectCaseQuery, values: [existingBusinessID, customerID] });
					const existingCase = caseResult.rows?.[0];
					if (existingCase && existingCase.status === CASE_STATUS.CREATED) {
						logger.info(
							`Updating case status to INVITED for case ${existingCase.id} as business invite is being sent.`
						);
						await caseManagementService.updateCaseStatus(
							{ caseID: existingCase.id, customerID: customerID ?? "" },
							{ status: CASE_STATUS_ENUM.INVITED, comment: "", assignee: "" },
							{ user_id: userInfo.user_id },
							{},
							false
						);
						caseIdToUse = existingCase.id;
					}
				}
				const insertRelQuery = `INSERT INTO rel_business_customer_monitoring (business_id, customer_id, is_monitoring_enabled, created_by) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, customer_id) DO NOTHING`;
				const insertInviteQuery = `INSERT INTO data_invites (id, business_id, customer_id, status, case_id, prefill, created_by, updated_by, metadata) VALUES ($1, $2, $3, (SELECT id FROM core_invite_statuses WHERE code = $4), $5, $6, $7, $8, $9)`;
				const insertInviteHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status, created_by) VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2), $3)`;
				queries.push(insertRelQuery, insertInviteQuery, insertInviteHistoryQuery);
				values.push(
					[existingBusinessID, customerID, isMonitoringAllowed, userInfo.user_id],
					[
						invitationID,
						existingBusinessID,
						customerID,
						"invited",
						caseIdToUse,
						{ ...prefill, ...body.existing_business },
						userInfo.user_id,
						userInfo.user_id,
						{ esign_templates: body.esign_templates || [] }
					],
					[invitationID, "invited", userInfo.user_id]
				);

				await sqlTransaction(queries, values);
				const isFlagActive = await getFlagValue(FEATURE_FLAGS.WIN_1098_VALIDATE_DATA_PERMISSION);
				if (isFlagActive) {
					await redis.sadd(`{customer}:${customerID}:businesses`, existingBusinessID);
				}

				const customerBusiness = await businesses.getCustomerBusinessById(existingBusinessID, customerID ?? "");

				message = {
					business_name: business.rows[0]?.name || body.existing_business.name,
					business_id: existingBusinessID,
					external_id: customerBusiness?.external_id,
					...(caseIdToUse && { case_id: caseIdToUse })
				};
			} else {
				const businessID = uuid();
				createNewBusiness = true;

				// mobile number consistency
				if (body.new_business.mobile) {
					if (!body.new_business.mobile.startsWith("+")) {
						body.new_business.mobile = `+1${body.new_business.mobile}`;
					}
					body.new_business.mobile = `+${formatNumberWithoutPlus(body.new_business.mobile)}`;
				}

				const insertBusinessQuery = `INSERT INTO data_businesses (id, name, mobile, status, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6)`;
				const insertRelQuery = `INSERT INTO rel_business_customer_monitoring (business_id, customer_id, is_monitoring_enabled, created_by) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, customer_id) DO NOTHING`;
				const insertInviteQuery = `INSERT INTO data_invites (id, business_id, customer_id, status, case_id, prefill, created_by, updated_by, metadata) VALUES ($1, $2, $3, (SELECT id FROM core_invite_statuses WHERE code = $4), $5, $6, $7, $8, $9)`;
				const insertInviteHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status, created_by) VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2), $3)`;

				queries.push(insertBusinessQuery, insertRelQuery, insertInviteQuery, insertInviteHistoryQuery);
				values.push(
					[
						businessID,
						body.new_business.name,
						body.new_business.mobile,
						"UNVERIFIED",
						userInfo.user_id,
						userInfo.user_id
					],
					[businessID, customerID, isMonitoringAllowed, userInfo.user_id],
					[
						invitationID,
						businessID,
						customerID,
						"invited",
						body?.case_id ?? null,
						{ ...prefill, ...body.new_business },
						userInfo.user_id,
						userInfo.user_id,
						{ esign_templates: body.esign_templates || [] }
					],
					[invitationID, "invited", userInfo.user_id]
				);

				await sqlTransaction(queries, values);
				const isFlagActive = await getFlagValue(FEATURE_FLAGS.WIN_1098_VALIDATE_DATA_PERMISSION);
				if (isFlagActive) {
					await redis.sadd(`{customer}:${customerID}:businesses`, businessID);
				}

				if (Object.hasOwn(body, "skip_credit_check") && body.skip_credit_check) {
					await onboarding.addOrUpdateCustomerBusinessConfigs(
						{ customerID: customerID ?? "", businessID: businessID },
						{ skip_credit_check: true },
						{ user_id: userInfo.user_id }
					);
				}

				if (Object.hasOwn(body, "bypass_ssn") && body.bypass_ssn) {
					await onboarding.addOrUpdateCustomerBusinessConfigs(
						{ customerID: customerID ?? "", businessID: businessID },
						{ bypass_ssn: true },
						{ user_id: userInfo.user_id }
					);
				}

				message = {
					business_name: body.new_business.name,
					business_id: businessID
				};
			}

			message = {
				...message,
				invitation_id: invitationID,
				customer_id: customerID,
				customer_user_id: userInfo.user_id,
				create_business: createNewBusiness,
				existing_applicants: body.existing_applicants,
				new_applicants: body.new_applicants,
				send_onboard_applicant_email: sendOnboardApplicantEmail
			};

			const isSyncBusinessInvitation =
				syncBusinessInvitation ||
				(await getFlagValue(FEATURE_FLAGS.WIN_1380_BUSINESS_INVITATION_LINKS, {
					key: "customer",
					kind: "customer",
					customer_id: customerID
				}));

			if ((loginWithEmailPasswordField ? !loginWithEmailPasswordField?.status : false) || isSyncBusinessInvitation) {
				message = {
					...message,
					is_no_login: true
				};
			}

			if (isLightningVerification) {
				message = {
					...message,
					is_lightning_verification: true,
					create_business: true
				};
			}

			const applicants = await getBusinessApplicants(message.business_id);
			// If there are no actual applicants then invite should be sent as main applicant
			// This applies to sync business invitations and lightning verifications
			if (
				!applicants?.length ||
				(applicants?.length === 1 && applicants[0].first_name === "Worth" && applicants[0].last_name === "Applicant")
			) {
				message.create_business = true;
			}

			let response: Record<string, any> = {
				business_id: message.business_id,
				applicant_email: body?.new_applicants?.[0]?.email,
				invitation_id: invitationID,
				customer_id: customerID
			};
			if (isSyncBusinessInvitation || isLightningVerification) {
				const invitationResponse: { invitation_links: Record<string, string> } =
					await inviteBusinessApplicants(message);
				response.invitation_url = invitationResponse.invitation_links?.[body.new_applicants[0].email];
			} else {
				const payload = {
					topic: kafkaTopics.USERS_NEW,
					messages: [
						{
							key: message.business_id,
							value: {
								event: kafkaEvents.INVITE_APPLICANT,
								...message
							}
						}
					]
				};

				await producer.send(payload);
			}

			const auditMessage: any = {
				business_name: message.business_name,
				invitation_id: invitationID,
				applicant_email: body.new_applicants[0].email,
				customer_user_id: userInfo.user_id,
				business_id: message.business_id
			};

			// Create an audit log
			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: message.business_id,
						value: {
							event: kafkaEvents.INVITATION_SENT_AUDIT,
							...auditMessage
						}
					}
				]
			});

			const invitationExpiryTime =
				(loginWithEmailPasswordField && !loginWithEmailPasswordField?.status) || isSyncBusinessInvitation
					? tokenConfig.NO_LOGIN_VERIFY_EMAIL_INVITE_TOKEN_LIFE_SECONDS
					: tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS;
			logger.info(`Adding job for business invitation ${invitationID} to bull queue.`);
			const jobBody = { invitation_id: invitationID, customer_id: customerID, business_id: message.business_id };
			invitationStatusQueue.addJob(QUEUE_EVENTS.INVITATION_STATUS_UPDATE, jobBody, {
				jobId: invitationID,
				delay: invitationExpiryTime * 1000
			});

			// update onboarding count
			if (customerID) {
				await customerLimits.addBusinessCount(customerID, message.business_id, {
					key: userInfo.user_id,
					name: `${body.new_applicants[0].first_name} ${body.new_applicants[0].last_name}`,
					email: body.new_applicants[0].email
				});
			}

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function lists the invitation sent by an applicant to the co-applicant(s)
	 * @param params{businessID}
	 * @returns array of object
	 */
	async getCoApplicantInvites(params: { businessID: UUID }, query: { sort: string }) {
		try {
			const getBusinessQuery = `SELECT data_businesses.name, rel_business_customer_monitoring.customer_id
			FROM data_businesses 
			LEFT JOIN rel_business_customer_monitoring ON rel_business_customer_monitoring.business_id = data_businesses.id
			WHERE data_businesses.id = $1`;
			const getBusinessResult = await sqlQuery({ sql: getBusinessQuery, values: [params.businessID] });
			if (!getBusinessResult.rowCount) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const customerID = getBusinessResult.rows[0].customer_id;

			const coApplicants = await getBusinessCoApplicants(params.businessID);
			if (!coApplicants.length) {
				return {
					records: [],
					total_items: 0
				};
			}

			const coApplicantsIDs = coApplicants.map(item => `'${item.id}'`).join(",");

			let queryParams = "";

			const allowedSortParams = ["data_invites.created_at"];
			let sortParam = "created_at";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
			}

			const sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
			queryParams += sort;

			const customerQuery = customerID
				? ` AND data_invites.customer_id = '${customerID}' `
				: ` AND data_invites.customer_id IS ${customerID} `;

			const getApplicantBusinessInvitesQuery = `
			WITH DataInvites AS (
				SELECT data_invites.id, data_invites.created_at, core_invite_statuses.label as status, data_invites.customer_id, rel_invite_applicants.applicant_id,
				ROW_NUMBER() OVER (
					PARTITION BY rel_invite_applicants.applicant_id 
					ORDER BY data_invites.created_at DESC
				)
				FROM data_invites
				LEFT JOIN rel_invite_applicants ON rel_invite_applicants.invitation_id = data_invites.id
				LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
				LEFT JOIN data_businesses db ON db.id = data_invites.business_id
				WHERE data_invites.business_id = $1 AND db.is_deleted = false
				${customerQuery}
				AND rel_invite_applicants.applicant_id IN (${coApplicantsIDs}) ${queryParams}
			)
			SELECT * FROM DataInvites WHERE row_number = 1 ORDER BY created_at DESC;`;

			const getApplicantBusinessInvitesResult = await sqlQuery({
				sql: getApplicantBusinessInvitesQuery,
				values: [params.businessID]
			});

			if (!getApplicantBusinessInvitesResult.rowCount) {
				return {
					records: [],
					total_items: 0
				};
			}

			const records = getApplicantBusinessInvitesResult.rows.map(invite => {
				const coApplicantData = coApplicants.find(coApplicant => coApplicant.id === invite.applicant_id);
				return { ...coApplicantData, invitation_id: invite.id, invitation_status: invite.status };
			});

			return {
				records,
				total_items: records.length
			};
		} catch (error) {
			throw error;
		}
	}

	async resendCoApplicantInvite(
		params: { businessID: UUID; invitationID: UUID },
		body: { is_lightning_verification?: boolean },
		userInfo: { user_id: string }
	) {
		try {
			const getBusinessQuery = `SELECT data_businesses.name, rel_business_customer_monitoring.customer_id
			FROM data_businesses 
			LEFT JOIN rel_business_customer_monitoring ON rel_business_customer_monitoring.business_id = data_businesses.id
			WHERE data_businesses.id = $1`;
			const getBusinessResult = await sqlQuery({ sql: getBusinessQuery, values: [params.businessID] });
			if (!getBusinessResult.rowCount) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const result = await getBusinessApplicantByApplicantId(params.businessID, userInfo.user_id);
			if (!result.some(obj => obj?.code === "owner")) {
				throw new BusinessApiError(
					"User does not have permission to onboard applicants.",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.INVALID
				);
			}

			const customerID = getBusinessResult.rows[0].customer_id;

			const lightningVerificationFlag = await getFlagValue(FEATURE_FLAGS.DOS_84_LIGHTNING_VERIFICATION, {
				key: "customer",
				kind: "customer",
				customer_id: customerID
			});

			if (body?.is_lightning_verification && !lightningVerificationFlag) {
				throw new BusinessApiError(
					"Lightning verification is not enabled for this customer",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const isLightningVerification = (lightningVerificationFlag && body?.is_lightning_verification) ?? false;

			const customerQuery = customerID
				? ` AND data_invites.customer_id = '${customerID}' `
				: ` AND data_invites.customer_id IS ${customerID} `;

			const getInviteQuery = `SELECT data_invites.*, data_businesses.name AS business_name FROM data_invites
				LEFT JOIN data_businesses ON data_businesses.id = data_invites.business_id
				WHERE data_invites.id = $1 AND business_id = $2 AND data_businesses.is_deleted = false ${customerQuery}`;

			const getInviteQueryResult = await sqlQuery({
				sql: getInviteQuery,
				values: [params.invitationID, params.businessID]
			});

			if (!getInviteQueryResult.rowCount) {
				throw new BusinessApiError("Invitation not found.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const inviteStatus = getInviteQueryResult.rows[0].status;
			if ([INVITE_STATUS.ACCEPTED, INVITE_STATUS.COMPLETED].includes(inviteStatus)) {
				throw new BusinessApiError(`Invite has already been ${inviteStatus.toLowerCase()}`);
			}

			// get all invite applicants
			const getInviteApplicantsQuery = ` SELECT applicant_id FROM rel_invite_applicants WHERE invitation_id = $1`;
			const getInviteApplicants = await sqlQuery({ sql: getInviteApplicantsQuery, values: [params.invitationID] });

			if (!getInviteApplicants.rowCount) {
				throw new BusinessApiError(
					"No applicants related to this business found",
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			}

			// Update invite status and insert into history
			const updateInviteStatusQuery = `
				UPDATE data_invites
				SET status = $1, updated_by = $2
				WHERE id = $3`;
			const insertDataInviteHistoryQuery = `
				INSERT INTO data_invites_history (invitation_id, status, created_by)
				VALUES ($1, $2, $3)`;

			await sqlTransaction(
				[updateInviteStatusQuery, insertDataInviteHistoryQuery],
				[
					[INVITE_STATUS.INVITED, userInfo.user_id, params.invitationID],
					[params.invitationID, INVITE_STATUS.INVITED, userInfo.user_id]
				]
			);
			const applicantsData = getInviteApplicants.rows.map(row => row.applicant_id);
			const customerConfig = await onboarding.getCustomerOnboardingStages(
				{ customerID: customerID },
				{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
				false
			);
			const loginWithEmailPasswordField = customerConfig
				?.find(row => row.stage.toLowerCase() == "login")
				?.config?.fields?.find(field => field.name.toLowerCase() == "Login with Email & Password".toLowerCase());

			let message = {
				invitation_id: params.invitationID,
				customer_id: customerID,
				business_id: params.businessID,
				applicants: applicantsData,
				business_name: getInviteQueryResult.rows[0].business_name,
				is_no_login: false,
				is_lightning_verification: false,
				is_co_applicant: true,
				applicant_name: `${result[0].first_name} ${result[0].last_name}`,
				case_id: getInviteQueryResult.rows[0].case_id
			};

			const isSyncBusinessInvitation = await getFlagValue(FEATURE_FLAGS.WIN_1380_BUSINESS_INVITATION_LINKS, {
				key: "customer",
				kind: "customer",
				customer_id: customerID
			});

			if ((loginWithEmailPasswordField ? !loginWithEmailPasswordField?.status : false) || isSyncBusinessInvitation) {
				message = {
					...message,
					is_no_login: true
				};
			}

			if (isLightningVerification) {
				message = {
					...message,
					is_lightning_verification: true
				};
			}

			const payload = {
				topic: kafkaTopics.USERS_NEW,
				messages: [
					{
						key: message.business_id,
						value: {
							event: kafkaEvents.RESEND_INVITATION,
							...message
						}
					}
				]
			};

			await producer.send(payload);

			const job = await invitationStatusQueue.getJobByID(params.invitationID);
			logger.info(`Job found: ${job}`);
			if (job) {
				await invitationStatusQueue.removeJobByID(params.invitationID);
			}
			logger.info(
				`Adding the new job with delay of ${tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS} seconds by removing old job`
			);

			const jobBody = { invitation_id: params.invitationID, customer_id: customerID, business_id: params.businessID };

			await invitationStatusQueue.addJob(QUEUE_EVENTS.INVITATION_STATUS_UPDATE, jobBody, {
				jobId: params.invitationID,
				delay: tokenConfig.CO_APPLICANT_INVITE_EMAIL_TOKEN_LIFE_SECONDS * 1000
			});

			return {};
		} catch (error) {
			throw error;
		}
	}

	/**
	 *This function marks the invitaion status as denied by main applicant
	 * @param params {businessID}
	 * @param params {invitationID}
	 * @returns
	 */
	async revokeCoApplicantInvite(params: { businessID: UUID; invitationID: UUID }) {
		try {
			const getBusinessQuery = `SELECT data_businesses.name, rel_business_customer_monitoring.customer_id
			FROM data_businesses 
			LEFT JOIN rel_business_customer_monitoring ON rel_business_customer_monitoring.business_id = data_businesses.id
			WHERE data_businesses.id = $1`;
			const getBusinessResult = await sqlQuery({ sql: getBusinessQuery, values: [params.businessID] });
			if (!getBusinessResult.rowCount) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const getInviteQuery = `SELECT core_invite_statuses.code as invitation_status, data_invites.customer_id, data_invites.case_id FROM data_invites
			LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE data_invites.id = $1 AND db.is_deleted = false`;

			const getInviteQueryResult = await sqlQuery({ sql: getInviteQuery, values: [params.invitationID] });

			if (!getInviteQueryResult.rowCount) {
				throw new BusinessApiError("Invitation not found.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const inviteStatus = getInviteQueryResult.rows[0].invitation_status;
			if ([INVITE_STATUSES.ACCEPTED, INVITE_STATUSES.REJECTED, INVITE_STATUSES.COMPLETED].includes(inviteStatus)) {
				throw new BusinessApiError(`Invite has already been ${inviteStatus.toLowerCase()}`);
			}

			// updating db status as revoked
			const updateDataInviteQuery = `UPDATE data_invites
					SET status = (SELECT id FROM core_invite_statuses WHERE code = $1)
					WHERE data_invites.id = $2`;

			const updateDataInviteQueryValues = [INVITE_STATUSES.REVOKED, params.invitationID];

			const insertDataInviteHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status)
				VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2))`;

			const insertDataInviteHistoryValues = [params.invitationID, INVITE_STATUSES.REVOKED];

			await sqlTransaction(
				[updateDataInviteQuery, insertDataInviteHistoryQuery],
				[updateDataInviteQueryValues, insertDataInviteHistoryValues]
			);

			return {};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function lists the invitation sent by an applicant to the co-applicant(s)
	 * @param params {businessID}
	 * @param body {object}
	 * @param userInfo {object}
	 * @returns
	 */
	async requestInviteLink(body: { invite_token: string }) {
		try {
			const inviteTokenData = await decodeInvitationToken(body.invite_token);
			const { business_id: businessID, customer_id: customerID, user_id: userID, email } = inviteTokenData;

			const result = await getBusinessApplicantByApplicantId(businessID, userID);
			const coApplicantData = result.find(obj => obj?.code === SUBROLES.USER);
			if (!coApplicantData) {
				throw new BusinessApiError(
					"User does not have permission to the application.",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.INVALID
				);
			}

			const getInviteQuery = `SELECT core_invite_statuses.code as invitation_status, data_invites.customer_id, data_invites.case_id,
				data_invites.created_by as applicant_id
				FROM data_invites
				LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
				LEFT JOIN data_businesses db ON db.id = data_invites.business_id
				WHERE data_invites.id = $1 AND db.is_deleted = false`;
			const getInviteResult = await sqlQuery({ sql: getInviteQuery, values: [inviteTokenData.invitation_id] });

			if (!getInviteResult.rows.length) {
				throw new BusinessApiError("Invitation not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			if (getInviteResult.rows[0].invitation_status === INVITE_STATUSES.REVOKED) {
				throw new BusinessApiError("Application invitation revoked", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const record = await getBusinessApplicantByApplicantId(businessID, getInviteResult.rows[0].applicant_id);
			const applicantData = record.find(obj => obj?.code === SUBROLES.OWNER);
			if (!applicantData) {
				throw new BusinessApiError("Applicant not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			if (!inviteTokenData.case_id) {
				throw new BusinessApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const caseDetails = await caseMgmt.internalGetCaseByID({ caseID: inviteTokenData.case_id });
			if (Object.keys(caseDetails).length === 0) {
				throw new BusinessApiError("Application not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const isSubmitted = caseDetails?.status_history?.filter(data => data?.status === CASE_STATUS_ENUM.SUBMITTED);
			if (isSubmitted?.length) {
				throw new BusinessApiError("Application already submitted", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const getBusinessQuery = `SELECT data_businesses.name FROM data_businesses WHERE data_businesses.id = $1 AND data_businesses.is_deleted = false`;
			const getBusinessResult = await sqlQuery({ sql: getBusinessQuery, values: [businessID] });

			if (!getBusinessResult.rows.length) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const invitationID: string = uuid();
			const queries: string[] = [];
			const values: any[][] = [];

			const insertInviteQuery = `INSERT INTO data_invites (id, business_id, customer_id, status, case_id, created_by, updated_by) VALUES ($1, $2, $3, (SELECT id FROM core_invite_statuses WHERE code = $4), $5, $6, $7)`;
			const insertDataInviteHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status, created_by) VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2), $3)`;
			queries.push(insertInviteQuery, insertDataInviteHistoryQuery);
			values.push(
				[
					invitationID,
					businessID,
					customerID,
					INVITE_STATUSES.INVITED,
					caseDetails.id,
					applicantData.id,
					applicantData.id
				],
				[invitationID, INVITE_STATUSES.INVITED, applicantData.id]
			);

			await sqlTransaction(queries, values);

			let requestToken = {
				applicant_id: applicantData.id,
				applicant_name: `${applicantData.first_name} ${applicantData.last_name}`,
				co_applicant_id: userID,
				business_id: businessID,
				business_name: getBusinessResult.rows[0].name,
				invitation_id: invitationID,
				customer_id: customerID,
				case_id: caseDetails.id,
				case: "request_invite_link",
				iat: Date.now(),
				exp: Date.now() + tokenConfig.CO_APPLICANT_INVITE_EMAIL_TOKEN_LIFE_SECONDS * 1000
			};

			const acceptRequestLink = `${
				envConfig.APPLICANT_FRONTEND_BASE_URL
			}/verify/invite/accept?request-invite-link=${encodeURIComponent(jwtSign(encryptData(requestToken)))}`;

			const denyRequestLink = `${
				envConfig.APPLICANT_FRONTEND_BASE_URL
			}/verify/invite/deny?request-invite-link=${encodeURIComponent(jwtSign(encryptData(requestToken)))}`;

			const message = {
				applicant_id: applicantData.id,
				applicant_email: applicantData.email,
				applicant_name: `${applicantData.first_name} ${applicantData.last_name}`,
				co_applicant_email: email,
				co_applicant_name: `${coApplicantData.first_name} ${coApplicantData.last_name}`,
				customer_id: customerID,
				accept_request_link: acceptRequestLink,
				deny_request_link: denyRequestLink
			};

			// Send email to applicant
			const payload = {
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.CO_APPLICANT_REQUEST_INVITE_LINK,
							...message
						}
					}
				]
			};

			await producer.send(payload);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function sends new invitation link to the co-applicant
	 * @param params
	 * @returns {}
	 */
	async acceptInviteLinkRequest(params) {
		try {
			const tokenData = await decodeInvitationToken(params.requestToken);
			if (tokenData.case !== "request_invite_link") {
				throw new BusinessApiError(
					"This request is invalid. Contact Support",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const getDataInvitesQuery = `SELECT core_invite_statuses.code as invitation_status, data_invites.customer_id, data_invites.case_id FROM data_invites
			LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE data_invites.id = $1 AND db.is_deleted = false`;

			const getDataInvitesQueryResult = await sqlQuery({ sql: getDataInvitesQuery, values: [tokenData.invitation_id] });

			if (!getDataInvitesQueryResult.rowCount) {
				throw new BusinessApiError("Invalid token", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			if (getDataInvitesQueryResult.rows[0].invitation_status === INVITE_STATUSES.REJECTED) {
				throw new BusinessApiError(
					"Invalid invitation: Already rejected by applicant",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if (
				![INVITE_STATUSES.ACCEPTED, INVITE_STATUSES.COMPLETED].includes(
					getDataInvitesQueryResult.rows[0].invitation_status
				) &&
				(tokenData.exp < Date.now() || getDataInvitesQueryResult.rows[0].invitation_status === INVITE_STATUSES.EXPIRED)
			) {
				// updating db only if previous status is not expired
				if (getDataInvitesQueryResult.rows[0].invitation_status !== INVITE_STATUSES.EXPIRED) {
					const updateInviteQuery = `UPDATE data_invites
							SET status = (SELECT id FROM core_invite_statuses WHERE code = $1)
							WHERE data_invites.id = $2`;

					const updateInviteValues = [INVITE_STATUSES.EXPIRED, tokenData.invitation_id];

					const insertDataInviteHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status)
						VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2))`;

					const insertDataInviteHistoryValues = [tokenData.invitation_id, INVITE_STATUSES.EXPIRED];

					await sqlTransaction(
						[updateInviteQuery, insertDataInviteHistoryQuery],
						[updateInviteValues, insertDataInviteHistoryValues]
					);
				}
				throw new BusinessApiError("Token Expired", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			// send new link to co-applicant via kafka event
			const coApplicantData = await getApplicantByID(tokenData.co_applicant_id);
			const message = {
				customer_id: tokenData.customer_id,
				business_name: tokenData.business_name,
				business_id: tokenData.business_id,
				invitation_id: tokenData.invitation_id,
				new_applicants: [
					{
						first_name: coApplicantData.first_name,
						last_name: coApplicantData.last_name,
						email: coApplicantData.email
					}
				],
				is_no_login: true,
				create_business: false,
				customer_user_id: tokenData.applicant_id,
				is_co_applicant: true,
				applicant_name: tokenData.applicant_name,
				case_id: getDataInvitesQueryResult.rows[0].case_id
			};

			const payload = {
				topic: kafkaTopics.USERS_NEW,
				messages: [
					{
						key: message.business_id,
						value: {
							event: kafkaEvents.INVITE_APPLICANT,
							...message
						}
					}
				]
			};
			await producer.send(payload);
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function marks the invitation status as "rejected" by main applicant
	 * TODO send an email to the co-applicant to notify that new request link has been "rejected" by the main applicant
	 * @param params
	 * @returns {}
	 */
	async denyInviteLinkRequest(params) {
		try {
			const tokenData = await decodeInvitationToken(params.requestToken);
			if (tokenData.case !== "request_invite_link") {
				throw new BusinessApiError(
					"This request is invalid. Contact Support",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const getDataInvitesQuery = `SELECT core_invite_statuses.code as invitation_status, data_invites.customer_id, data_invites.case_id FROM data_invites
			LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE data_invites.id = $1 AND db.is_deleted = false`;

			const getDataInvitesQueryResult = await sqlQuery({ sql: getDataInvitesQuery, values: [tokenData.invitation_id] });

			if (!getDataInvitesQueryResult.rowCount) {
				throw new BusinessApiError("Invalid token", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			if (getDataInvitesQueryResult.rows[0].invitation_status === INVITE_STATUSES.REJECTED) {
				throw new BusinessApiError(
					"Invalid invitation: Already rejected by applicant",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if (
				![INVITE_STATUSES.ACCEPTED, INVITE_STATUSES.COMPLETED].includes(
					getDataInvitesQueryResult.rows[0].invitation_status
				) &&
				(tokenData.exp < Date.now() || getDataInvitesQueryResult.rows[0].invitation_status === INVITE_STATUSES.EXPIRED)
			) {
				// updating db only if previous status is not expired
				if (getDataInvitesQueryResult.rows[0].invitation_status !== INVITE_STATUSES.EXPIRED) {
					const updateInviteQuery = `UPDATE data_invites
							SET status = (SELECT id FROM core_invite_statuses WHERE code = $1)
							WHERE data_invites.id = $2`;
					const updateInviteQueryValues = [INVITE_STATUSES.EXPIRED, tokenData.invitation_id];
					const insertDataInviteHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status)
						VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2))`;
					const insertDataInviteHistoryValues = [tokenData.invitation_id, INVITE_STATUSES.EXPIRED];
					await sqlTransaction(
						[updateInviteQuery, insertDataInviteHistoryQuery],
						[updateInviteQueryValues, insertDataInviteHistoryValues]
					);
				}
				throw new BusinessApiError("Token Expired", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			// updating db status as rejected
			const updateDataInviteQuery = `UPDATE data_invites
					SET status = (SELECT id FROM core_invite_statuses WHERE code = $1)
					WHERE data_invites.id = $2`;

			const updateDataInviteQueryValues = [INVITE_STATUSES.REJECTED, tokenData.invitation_id];

			const insertDataInviteHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status)
				VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2))`;

			const insertDataInviteHistoryValues = [tokenData.invitation_id, INVITE_STATUSES.REJECTED];

			const insertRelInviteApplicantQuery = `INSERT INTO rel_invite_applicants (invitation_id, applicant_id) VALUES ($1, $2)
			ON CONFLICT (invitation_id, applicant_id) DO NOTHING`;

			const insertRelInviteApplicantValues = [tokenData.invitation_id, tokenData.co_applicant_id];

			await sqlTransaction(
				[updateDataInviteQuery, insertDataInviteHistoryQuery, insertRelInviteApplicantQuery],
				[updateDataInviteQueryValues, insertDataInviteHistoryValues, insertRelInviteApplicantValues]
			);
		} catch (error) {
			throw error;
		}
	}

	private static async processCustomFields(
		customerID: UUID,
		invitationID: UUID,
		customFieldTemplateID: UUID | null,
		body: Record<string, any>,
		files: Express.Multer.File[]
	): Promise<{ customFieldTemplateID: UUID; normalizedCustomFieldValues: NormalizedCustomFieldValues } | undefined> {
		const onboardingTemplate = customFieldTemplateID
			? await onboarding.getOnboardingTemplate(customFieldTemplateID)
			: await onboarding.getCurrentOnboardingTemplate(customerID);
		if (!onboardingTemplate) return;
		customFieldTemplateID = onboardingTemplate.id;
		const templateCustomFields: CustomField[] = await onboarding.getCustomFields({ templateId: customFieldTemplateID });
		const normalizedCustomFieldValues = CustomFieldHelper.normalizeCustomFields(
			templateCustomFields,
			body.custom_fields as Record<string, any>
		);
		// Intercept file uploads
		if (files.length) {
			const uploadPath = CustomFieldHelper.getDirectoryForInvites(customerID, invitationID);
			const missingFiles = await BusinessInvites.processInviteFiles(
				templateCustomFields,
				normalizedCustomFieldValues,
				files,
				uploadPath
			);
			missingFiles.forEach(key => {
				delete normalizedCustomFieldValues[key];
			});
		}
		CustomFieldHelper.validateCustomerCustomFields(templateCustomFields, normalizedCustomFieldValues);
		return {
			customFieldTemplateID,
			normalizedCustomFieldValues
		};
	}

	/**
	 * Processes the files uploaded  part of the invite
	 * 	1) Matches uploaded files to custom fields by comparing file name with custom field values
	 *  2) Uploads files to s3 associated to the customerID + inviteID
	 *
	 * @param templateCustomFields custom fields from the template
	 * @param normalizedCustomFieldValues normalized custom field values - Mutated
	 * @param files uploaded files
	 * @param destinationDirectory directory to upload files to
	 * @returns string[] --- provided field names that could not be matched with an uploaded file
	 */
	private static async processInviteFiles(
		templateCustomFields: CustomField[],
		normalizedCustomFieldValues: Record<string, any>,
		files: Express.Multer.File[],
		destinationDirectory: string
	): Promise<string[]> {
		// Determine file upload fields
		const uploadFieldNames = templateCustomFields.reduce((acc, field: CustomField) => {
			if (field.isFile()) {
				acc.push(field.getCode());
			}
			return acc;
		}, [] as string[]);

		const allProvidedKeys = Object.keys(normalizedCustomFieldValues);
		// Get keys that are files
		const fileKeys = allProvidedKeys.filter(key => uploadFieldNames.includes(key));

		const fileToField: Record<string, string> = {};

		const matchedFiles: string[] = [];
		for (const file of files) {
			// Match uploaded files with the custom field values
			await Promise.all(
				Object.entries(normalizedCustomFieldValues).map(async ([key, fieldValue]) => {
					if (!Array.isArray(fieldValue)) {
						return;
					}
					for (const providedFileName of fieldValue) {
						if (file.originalname && file.originalname === providedFileName && uploadFieldNames.includes(key)) {
							const { fileName } = await CustomFieldHelper.uploadFile(destinationDirectory, file);
							matchedFiles.push(key);
							fileToField[fileName] = key;
						}
					}
				})
			);
		}

		// Rewrite normalizedCustomFieldValues to only have the files that were matched (using fileToField)
		const newNormalizedCustomFieldValues: Record<string, string[]> = {};
		for (const [fileName, fieldCode] of Object.entries(fileToField)) {
			if (!newNormalizedCustomFieldValues[fieldCode]) {
				newNormalizedCustomFieldValues[fieldCode] = [];
			}
			newNormalizedCustomFieldValues[fieldCode].push(fileName);
			normalizedCustomFieldValues[fieldCode] = newNormalizedCustomFieldValues[fieldCode];
		}

		// Check to see if any of the normalizedCustonFieldValues are files and were not matched with the uploaded files
		return fileKeys.filter(key => !matchedFiles.includes(key));
	}
}

export const businessInvites = new BusinessInvites();
