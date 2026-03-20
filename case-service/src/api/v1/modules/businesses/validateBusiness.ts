import {
	BUSINESS_STATUS,
	CASE_STATUS,
	CASE_TYPE,
	ERROR_CODES,
	FEATURE_FLAGS,
	INVITE_STATUS,
	kafkaEvents,
	kafkaTopics,
	WEBHOOK_EVENTS,
	REDIS_KEYS,
	QUEUE_EVENTS,
	SupportedCountryCode,
	CASE_STATUS_ENUM
} from "#constants";
import { getFlagValue } from "#helpers/LaunchDarkly";
import { encryptEin } from "#utils/encryption";
import { BusinessApiError, InternationalBusinessError } from "./error";
import { StatusCodes } from "http-status-codes";
import { businesses } from "./businesses";
import { TIN_BEHAVIOR } from "#constants";
import {
	db,
	getApplicantByID,
	getBusinessEntityVerificationDetails,
	getIntegrationStatusForCustomer,
	isCountryAllowedWithSetupCheck,
	resolveCountryCode,
	isUSBusiness,
	redis,
	submitBusinessEntityForReview,
	submitBusinessEntityForSerpSearch,
	updateBusinessEntityForReview,
	resolveApplicantIdForAudit,
	type BusinessEntityVerificationDetails
} from "#helpers/index";
import { producer } from "#helpers/kafka";
import { logger } from "#helpers/logger";
import { caseManagementService } from "../case-management/case-management";
import { caseManager } from "#core";
import { BusinessInvites } from "./businessInvites";
import { envConfig } from "#configs";
import { sendEventToGatherWebhookData } from "#common/index";
import { UserInfo } from "#types";
import { applicationEdit } from "../application-edits/application-edit";
import { JsonObject } from "aws-jwt-verify/safe-json-parse";

import type { AssertTINJob } from "#workers";
import type { UUID } from "crypto";
import type { Business } from "#types/business";
import { AddressError, AddressUtil, type Address } from "#utils/addressUtil";

// Delay import to avoid circular dependency
let taskQueue: typeof import("#workers").taskQueue;
export class BusinessValidationError extends Error {
	public status: StatusCodes;
	public errorCode: ERROR_CODES;
	constructor(message) {
		super(message);
		this.name = "BusinessValidationError";
		this.status = StatusCodes.NOT_FOUND;
		this.errorCode = ERROR_CODES.NOT_FOUND;
	}
}

// @deprecated remove once BEST-84 / State machine changes are fully implemented
export const isInformFlagActive = async () => {
	const isActive = (await getFlagValue(FEATURE_FLAGS.BEST_84_INFORM_KYB_CHANGES, null, true)) ?? true;
	logger.debug(`isInformFlagActive=${isActive}`);
	return isActive;
};

/**
 * Assert that the business verification (TIN Match) is valid.
 * Assumes that Middesk reponse may not be immediate and will retry until it is successful in getting reviewTasks back from Middesk
 * Returns void if successful, throws BusinessValidationError if validation checks fail OR if we exceed the maximum attempts
 *
 * As a side effect, updates data_businesses with the TIN and status if successful or unsets TIN & marks status to UNVERIFIED if failed
 *
 * @param businessID the business ID to check
 * @param maxAttempts maximum number of times to try
 * @param timeout how long to wait between attempts
 * * */
const assertTinTimeoutError = `Timeout while awaiting Verification Response - Request has been queued TIN will update later if verified.`;
export const assertTINValid = async (
	businessID: UUID,
	maxAttempts = envConfig.TIN_VERIFICATION_ATTEMPTS,
	timeout = 500
): Promise<void> => {
	let attempts = 0;
	// Loop until we get a review task back (or we timeout)
	try {
		while (attempts < maxAttempts) {
			logger.debug(`assertTINValid=${businessID} verification status - attempt ${attempts}`);
			const { reviewTasks, businessEntityVerification } = (await getBusinessEntityVerificationDetails(businessID).catch(
				_ex => {
					logger.info("Unable to retrieve verification for business");
					return {};
				}
			)) as BusinessEntityVerificationDetails;
			if (businessEntityVerification?.tin && reviewTasks?.length > 0) {
				const tinVerificationTask = reviewTasks.find(task => task.category == "tin" && task.category == "tin");
				if (tinVerificationTask) {
					logger.debug(`TIN Verification Task Found = ${JSON.stringify(tinVerificationTask)}`);
					if (tinVerificationTask.status === "success") {
						const encryptedTIN = encryptEin(businessEntityVerification.tin);
						await db("data_businesses")
							.where({ id: businessID })
							.andWhere({ is_deleted: false })
							.update({ status: "VERIFIED", tin: encryptedTIN });
						return;
					} else if (tinVerificationTask.status === "failure") {
						throw new BusinessValidationError(
							tinVerificationTask.message ?? "Failure reason not provided by verification service"
						);
					}
				}
			}
			await new Promise(resolve => setTimeout(resolve, timeout));
			attempts++;
		}
		throw new BusinessValidationError(assertTinTimeoutError);
	} catch (ex) {
		logger.error(
			`businessVerification=${businessID} TIN Verification failed: ${
				ex instanceof BusinessValidationError ? ex.message : JSON.stringify(ex)
			}`
		);
		await db("data_businesses").where({ id: businessID }).andWhere({ is_deleted: false }).update({
			status: "UNVERIFIED"
		});
		throw ex;
	}
};

/**
 * @params {UUID} newBusinessID: The UUID of the new business we just created
 * @params {string} newBusinessTIN: The TIN of the new business we want to use
 * @returns {}
 * This function is used to check if the TIN exists in the database and if it does, then it checks if the existing business is same as the new business
 */
type ValidateTINResponse = {
	id?: string;
	business_id?: string | UUID;
	existing_business_found: boolean;
	is_business_applicant: boolean;
	is_business_verified: boolean;
	business: any;
	business_merge?: string;
	owner_email?: string;
	owner_id?: string | UUID;
	requestee_id?: string | UUID;
	customer_id?: string | UUID;
	case_id?: string | UUID;
	standalone_case_id?: string | UUID;
};

type ValidateBusinessRequest = {
	id?: UUID | string;
	business_id?: UUID | string;
	invite_id?: null | UUID;
	name: string;
	tin: string;
	customer_id?: null | UUID | string;
	address_line_1?: string;
	address_line_2?: string;
	address_city?: string;
	address_state?: string;
	address_postal_code?: string;
	address_country?: string;
	mobile?: string;
	official_website?: string;
	dba_names?: Array<{ name: string }>;
	mailing_addresses?: Business.BusinessAddress[] | Address[];
	case_type?: CASE_TYPE | string;
	quick_add?: boolean;
	place_id?: string;
	is_lightning_verification?: boolean;
	additional_details?: any;
	[keyof: string]: any;
};
export const validateBusiness = async (
	businessID: UUID,
	body: ValidateBusinessRequest,
	userID: UUID,
	{
		authorization,
		shouldRunSerpSearch = false,
		isBulk = false,
		userInfo,
		isAsync = false,
		isUpdate = false
	}: {
		authorization?: string;
		shouldRunSerpSearch?: boolean;
		isBulk?: boolean;
		userInfo: UserInfo | any;
		isAsync?: boolean;
		isUpdate?: boolean;
	}
) => {
	try {
		body.business_id = businessID;

		// Our schema for FE is different from the schema for the Bulk Import
		// This is to ensure that the FE schema is compatible with the Bulk Import schema
		if (body?.additional_details?.official_website) {
			body.official_website = body?.additional_details?.official_website;
		}

		if (!body.invite_id && userInfo?.is_guest_owner) {
			throw new BusinessApiError(
				"You are not allowed to update owner details without invitation",
				StatusCodes.UNAUTHORIZED,
				ERROR_CODES.NOT_ALLOWED
			);
		}

		// If the invite_id is present but the customer_id is not, then we need to fetch the customer_id from the invite
		if (body.invite_id) {
			const businessInvite = await BusinessInvites.fromId(body.invite_id);
			if (businessInvite.status === INVITE_STATUS.COMPLETED && !userInfo?.is_guest_owner) {
				throw new BusinessApiError("Invitation already completed", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			if (businessInvite.customer_id) {
				body.customer_id = businessInvite.customer_id as UUID;
			}
		}

		// If the client didn’t supply address_country or name, fall back to what’s in data_businesses.
		// If that’s null/undefined, assume US for validation.
		/* NOTE: If this pattern is ever needed a third time, extract it into a helper per the Rule of Three */
		if (!body.address_country || !body.name) {
			// Fetch both fields in one go
			const row = await db("data_businesses")
				.select("address_country", "name")
				.where({ id: businessID })
				.andWhere({ is_deleted: false })
				.first();

			const dbCountry = row?.address_country;
			const dbName = row?.name;

			// address_country fallback
			if (!body.address_country) {
				if (dbCountry) {
					body.address_country = dbCountry;
					logger.debug(`address_country not provided; using DB value: ${dbCountry}`);
				} else {
					body.address_country = SupportedCountryCode.US;
					logger.debug(`address_country not provided and no DB value found; defaulting to US`);
				}
			}

			// name fallback
			if (!body.name) {
				body.name = dbName ?? null;
				logger.debug(
					dbName
						? `name not provided; using DB value: ${dbName}`
						: `name not provided and no DB value found; defaulting to null`
				);
			}
		}

		if (!body.address_country) {
			const row = await db("data_businesses")
				.select("address_country")
				.where({ id: businessID })
				.andWhere({ is_deleted: false })
				.first();

			if (row?.address_country) {
				// DB has a value
				body.address_country = row.address_country;
				logger.debug(`address_country not provided; using DB value: ${body.address_country}`);
			} else {
				// DB had no value, fall back to US
				body.address_country = SupportedCountryCode.US;
				logger.debug(`address_country not provided and no DB value found; defaulting to US`);
			}
		}

		// If the client didn’t supply name, fall back to what’s in data_businesses.
		// If that’s null/undefined, default to an empty string (or choose whatever makes sense).
		if (!body.name) {
			const row = await db("data_businesses").select("name").where({ id: businessID }).first();

			body.name = row.name;
			logger.debug(
				row.name
					? `name not provided; using DB value: ${row.name}`
					: `name not provided and no DB value found; defaulting to null`
			);
		}

		const isCountryAllowed = await isCountryAllowedWithSetupCheck(body?.address_country, body?.customer_id);
		body.address_country = resolveCountryCode(body?.address_country) ?? body.address_country;
		logger.info(`country code after normalization: ${body?.address_country}`);

		if (!isCountryAllowed && body.address_country !== SupportedCountryCode.US) {
			throw new InternationalBusinessError(
				"International business setup is not enabled for this customer",
				StatusCodes.UNAUTHORIZED,
				ERROR_CODES.NOT_ALLOWED
			);
		}

		// "Allow Unverified TIN Submissions" flag is used to check if the customer needs to wait for TIN verification
		let tinRequired: boolean = true;
		let tinOptional: boolean = false;
		let requireTinResponse: boolean = true;
		let continueWithUnverifiedTin: boolean = false;
		let submitWithUnverifiedTin: boolean = false;
		// Customer Settings Checks

		let verificationIntegrationStatus = true;
		if (body.customer_id) {
			// Fetch customer onboarding details to see if they have Allow Unverified TIN Submissions tin verification enabled -- defaults to false
			const progressionConfig = await businesses.getProgressionConfig(body.customer_id);
			const tinField = progressionConfig
				?.find(row => row.stage.toLowerCase() == "company")
				?.config?.fields?.find(
					field => field.name.toLowerCase() == "Tax ID Number/Employer Identification Number".toLowerCase()
				);
			tinRequired = tinField?.status ? ["required", "always required"].includes(tinField?.status.toLowerCase()) : true;
			tinOptional = tinField?.status ? ["optional"].includes(tinField?.status.toLowerCase()) : false;
			requireTinResponse =
				tinField?.sub_fields?.find(subField => subField.name.toLowerCase() == "Require a TIN Response".toLowerCase())
					?.status || false; // Force a falsy value to false
			continueWithUnverifiedTin =
				tinField?.sub_fields?.find(
					subField => subField.name.toLowerCase() == "Continue with Unverified TIN".toLowerCase()
				)?.status || false; // Force a falsy value to false
			submitWithUnverifiedTin =
				tinField?.sub_fields?.find(
					subField => subField.name.toLowerCase() == "Submit with Unverified TIN".toLowerCase()
				)?.status || false; // Force a falsy value to false
			logger.debug(
				`requireTinResponse: ${requireTinResponse} continueWithUnverifiedTin ${continueWithUnverifiedTin} submitWithUnverifiedTin ${submitWithUnverifiedTin}`
			);

			// get integration status for customer
			const integrationStatus = await getIntegrationStatusForCustomer(body.customer_id);
			const middeskIntegrationStatus = integrationStatus?.find(status => status?.integration_code === "middesk");
			verificationIntegrationStatus = ["ENABLED", "REQUIRED"].includes(middeskIntegrationStatus?.status) ? true : false;
		}
		const lightningVerificationFlag = await getFlagValue(FEATURE_FLAGS.DOS_84_LIGHTNING_VERIFICATION, {
			key: "customer",
			kind: "customer",
			customer_id: body?.customer_id
		});

		logger.info(`lightningVerificationFlag=${lightningVerificationFlag} for customer: ${body?.customer_id}`);

		if (body.is_lightning_verification && !lightningVerificationFlag) {
			throw new BusinessApiError(
				"Lightning verification is not enabled for this customer",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		const changedFields: Array<{
			field_name: string;
			old_value: any;
			new_value: any;
			metadata: JsonObject;
		}> = [];
		if (userInfo?.is_guest_owner) {
			const existingBusiness = await businesses.getBusinessByID({ businessID, tinBehavior: TIN_BEHAVIOR.PLAIN });
			Object.keys(body).map(key => {
				let oldValue: string | null = null;
				let newValue: string | null = null;
				if (Object.hasOwn(existingBusiness, key)) {
					oldValue = existingBusiness[key] ?? null;
					newValue = body[key] ?? null;
				} else if (key === "dba_names" && Array.isArray(body[key])) {
					oldValue =
						existingBusiness.business_names && existingBusiness.business_names.length
							? (existingBusiness.business_names.find(name => name.is_primary === false)?.name ?? null)
							: null;

					newValue = body[key][0]?.name ?? null;
				} else if (key === "mailing_addresses" && body[key]?.length) {
					const oldMailingAddress = existingBusiness.business_addresses?.length
						? (existingBusiness.business_addresses.find(address => address.is_primary === false) ?? null)
						: null;
					const newMailingAddress = body[key][0];

					const addressNewToOldMapping = {
						line_1: "address_line_1",
						apartment: "address_line_2",
						city: "address_city",
						state: "address_state",
						postal_code: "address_postal_code",
						country: "address_country"
					};

					oldMailingAddress &&
						Object.keys(oldMailingAddress).map(addrKey => {
							if (Object.hasOwn(newMailingAddress, addressNewToOldMapping[addrKey])) {
								oldValue = oldMailingAddress[addrKey] ?? null;
								newValue = newMailingAddress[addressNewToOldMapping[addrKey]] ?? null;
								if (oldValue !== newValue) {
									changedFields.push({
										field_name: `mailing_address.${addrKey}`,
										old_value: oldValue,
										new_value: newValue,
										metadata:
											oldValue === null
												? { is_inserted: true }
												: newValue === null
													? { is_deleted: true }
													: { is_updated: true }
									});
								}
							}
						});
					return; // Skip the rest of the logic for mailing_addresses
				} else if (key === "additional_details") {
					const { social_account, industry, naics_code, mcc_code } = body.additional_details;

					if (Object.hasOwn(body.additional_details, "social_account")) {
						oldValue = existingBusiness.social_account ?? null;
						newValue = social_account ?? null;

						if (oldValue !== newValue) {
							changedFields.push({
								field_name: "social_account",
								old_value: oldValue,
								new_value: newValue,
								metadata:
									oldValue === null
										? { is_inserted: true }
										: newValue === null
											? { is_deleted: true }
											: { is_updated: true }
							});
						}
					}

					if (Object.hasOwn(body.additional_details, "industry")) {
						oldValue = (existingBusiness.industry as any)?.name ?? null;
						newValue = industry?.name ?? null;
						if (oldValue !== newValue) {
							changedFields.push({
								field_name: "industry",
								old_value: oldValue,
								new_value: newValue,
								metadata:
									oldValue === null
										? { is_inserted: true }
										: newValue === null
											? { is_deleted: true }
											: { is_updated: true }
							});
						}
					}

					if (Object.hasOwn(body.additional_details, "naics_code")) {
						const oldNaicsCode = (existingBusiness as any).naics_code
							? String((existingBusiness as any).naics_code)
							: null;
						const newNaicsCode = naics_code ? String(naics_code) : null;
						oldValue = oldNaicsCode;
						newValue = newNaicsCode;

						if (oldValue !== newValue) {
							changedFields.push({
								field_name: "naics_code",
								old_value: oldValue,
								new_value: newValue,
								metadata:
									oldValue === null
										? { is_inserted: true }
										: newValue === null
											? { is_deleted: true }
											: { is_updated: true }
							});
						}
					}

					if (Object.hasOwn(body.additional_details, "mcc_code")) {
						const oldMccCode = (existingBusiness as any).mcc_code ? String((existingBusiness as any).mcc_code) : null;
						const newMccCode = mcc_code ? String(mcc_code) : null;
						oldValue = oldMccCode;
						newValue = newMccCode;

						if (oldValue !== newValue) {
							changedFields.push({
								field_name: "mcc_code",
								old_value: oldValue,
								new_value: newValue,
								metadata:
									oldValue === null
										? { is_inserted: true }
										: newValue === null
											? { is_deleted: true }
											: { is_updated: true }
							});
						}
					}

					return;
				} else {
					return; // Skip keys that are not in the existing business
				}

				if (oldValue !== newValue) {
					changedFields.push({
						field_name: key,
						old_value: oldValue,
						new_value: newValue,
						metadata:
							oldValue === null
								? { is_inserted: true }
								: newValue === null
									? { is_deleted: true }
									: { is_updated: true }
					});
				}
			});
			// check if dba name was deleted
			const existingDBA =
				existingBusiness.business_names && existingBusiness.business_names.length
					? (existingBusiness.business_names.find(name => name.is_primary === false)?.name ?? null)
					: null;
			if (existingDBA && !Object.keys(body).includes("dba_names")) {
				changedFields.push({
					field_name: "dba_names",
					old_value: existingDBA,
					new_value: null,
					metadata: {}
				});
			}
		}

		const isLightningVerification = lightningVerificationFlag && body?.is_lightning_verification;

		// Check if the TIN already exists
		let response: ValidateTINResponse = {
			business_id: businessID,
			existing_business_found: false,
			is_business_applicant: false,
			is_business_verified: false,
			business: false
		};

		//skipping TIN validation as part of PAT-726
		// if (body.tin && isBulkCreate) {
		// 	response = await validateTIN(
		// 		businessID,
		// 		body,
		// 		body.customer_id,
		// 		body.invite_id,
		// 		userInfo?.is_guest_owner ?? false
		// 	);
		// }

		logger.info(`default TIN validation response (validation skipped): ${JSON.stringify(response)}`);
		// Update the business ID if it was returned from the TIN validation
		businessID = (response.business_id as UUID) ?? businessID;

		if (response?.existing_business_found && !response.is_business_applicant) {
			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: businessID });
			return { data: response, message: "Authentication required" };
		}

		if (
			response?.existing_business_found &&
			response.is_business_applicant &&
			response.is_business_verified &&
			!isLightningVerification &&
			!userInfo?.is_guest_owner
		) {
			if (body.invite_id) {
				response.case_id = await handleInviteCase(body, response, userID);
			} else {
				response.case_id = await handleStandaloneCase(businessID, response.business?.name ?? body.name, userID);
			}
			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: businessID });
			return {
				data: response,
				message:
					"Your business was linked to an existing business that had an exact match in business name, TIN number, and address"
			};
		}

		if (shouldRunSerpSearch) {
			const serpSearchPromise = submitBusinessEntityForSerpSearch(businessID, {
				businessName: body.name,
				businessAddress: `${body.address_line_1}, ${body.address_city}, ${body.address_state}, ${body.address_postal_code}`,
				is_bulk: true
			});
			if (isAsync) {
				logger.debug(`Running SERP search asynchronously for businessID=${businessID}`);
				// When async we lose official_website making it over to Middesk
				void serpSearchPromise.catch(ex => {
					logger.error({ error: ex }, "Error submitting business entity for SERP search");
				});
			} else {
				try {
					const serpResponse = await serpSearchPromise;
					logger.debug(`SERP search response: ${JSON.stringify(serpResponse)}`);

					// Give preference to the official website from user input
					if (!body.official_website && serpResponse?.businessWebsite) {
						body.official_website = serpResponse.businessWebsite;
					}
				} catch (ex) {
					logger.error({ error: ex }, "Error submitting business entity for SERP search");
				}
			}
		}

		// Gives preference to the existing website if it exists and user didn't sended it
		if (!body.official_website) {
			const existingWebsiteResult = await db
				.from("data_businesses")
				.select("official_website")
				.where({ id: businessID });
			logger.debug(`existingWebsiteResult: ${JSON.stringify(existingWebsiteResult)}`);
			body.official_website = body.official_website
				? body.official_website
				: existingWebsiteResult?.[0]?.official_website;
		}

		if (isLightningVerification) {
			// accept the invitation in case of lightning verification
			await businesses.updateInvitationStatus({ invitation_id: body.invite_id, action: "ACCEPT" }, { user_id: userID });

			if (verificationIntegrationStatus) {
				logger.info(`Business submitting to middesk for lightning verification: ${businessID}`);
				// update Middesk data and create Middesk order for tin verification
				const updateBusinessEntityBody = {
					name: body.name,
					addresses: [
						{
							address_line_1: body.address_line_1,
							address_city: body.address_city,
							address_state: body.address_state,
							address_postal_code: body.address_postal_code
						}
					],
					tin: {
						tin: body.tin
					},
					...(body.official_website && { website: { url: body.official_website } }),
					...(isLightningVerification && { is_lightning_verification: true })
				};

				// This function will check if the business is already submitted to Middesk or not
				// If submitted then it will update Middesk business
				// Else submit to Middesk
				const middeskResponse = await updateBusinessEntityForReview(
					businessID,
					updateBusinessEntityBody,
					authorization
				).catch(ex => {
					logger.error({ error: ex }, "Error sending business verification");
					throw ex;
				});

				logger.info(
					`Middesk submitted for businessID=${businessID} middeskResponse=${JSON.stringify(middeskResponse)}`
				);
			}
		} else {
			logger.info(`Normal business verification for businessID=${businessID}`);
			//skip business verification if the country is provided and is not US
			if ((!body.address_country || isUSBusiness(body.address_country)) && verificationIntegrationStatus) {
				// @todo: remove this flag check & code once middesk fully responds to async event vs synchronous POST to begin verification
				const informFlagActive = await isInformFlagActive();
				if (!isUpdate || informFlagActive === false) {
					try {
						await sendBusinessVerification(businessID, body, authorization);
					} catch (ex) {
						logger.error({ error: ex }, "Error sending business verification");
						throw ex;
					}
				}
			} else {
				logger.warn(
					`Business verification not supported for address_country=${body.address_country} or not enabled -- Skipping this step`
				);
			}
			if (isBulk) {
				logger.debug(`businessID=${businessID} Running business creation side effects`);
				const standaloneCase = await db("data_cases")
					.select("data_cases.*")
					.leftJoin("data_businesses as db", "db.id", "data_cases.business_id")
					.where({ business_id: businessID, applicant_id: userID, case_type: CASE_TYPE.ONBOARDING })
					.first();
				const { case_id } = await businesses.businessCreationSideEffects(
					{ businessID, standaloneCase, applicantID: userID, customerInitiated: true },
					body,
					userInfo
				);
				response.case_id = case_id;
			} else {
				// NOTE: This just update the business related data, it doesn't create a case
				// Also doesn't update the status of the business
				// NOTE: case creation side effects are handled in the next block after business is verified
				logger.debug(`businessID=${businessID} Running business update side effects`);
				await businesses.businessUpdateSideEffects({ businessID }, body, userInfo);
			}
		}

		try {
			// Determine if we should perform immediate TIN validation
			if (body.tin) {
				const shouldAwaitTINVerification =
					!isAsync && isUSBusiness(body.address_country) && ((tinRequired && requireTinResponse) || tinOptional);

				if (shouldAwaitTINVerification) {
					// By default, we check every 500ms for a response from the TIN verification service
					// For lightning verification, we want to time out after 20 seconds
					// Otherwise, use the default number of attempts set in the env config
					const LIGHTNING_VERIFICATION_MAX_TIN_VALIDATION_ATTEMPTS = 40;
					const maxAttempts = isLightningVerification
						? LIGHTNING_VERIFICATION_MAX_TIN_VALIDATION_ATTEMPTS
						: envConfig.TIN_VERIFICATION_ATTEMPTS;
					await assertTINValid(businessID, maxAttempts);
				} else {
					await enqueueAssertTIN(businessID, body.address_country);
				}
			}
		} catch (ex: any) {
			// If timeout then set the payload for case creation in redis and handle it in kafka consumer
			// event name: INTEGRATION_DATA_READY
			if (ex.message === assertTinTimeoutError) {
				await redis.set(
					`${REDIS_KEYS.business_verification}:${businessID}`,
					JSON.stringify({
						body: {
							businessID,
							userID,
							inviteID: body.invite_id as string,
							customerID: body.customer_id as string,
							placeID: body.place_id
						},
						userInfo
					})
				);
			}
			if (isBulk) {
				return { data: response, message: ex.message };
			}
			throw ex;
		}

		// get latest business data
		const business = await db("data_businesses").select("*").where({ id: businessID }).first();

		if (isLightningVerification && business.status === BUSINESS_STATUS.VERIFIED) {
			// create new case
			// Get existing case
			const newCase = await caseManagementService.createCaseFromEgg({
				customer_id: body.customer_id as UUID,
				applicant_id: userID,
				business_id: businessID,
				status: CASE_STATUS.ONBOARDING,
				created_by: userID,
				updated_by: userID,
				case_type: CASE_TYPE.ONBOARDING
			});

			logger.info(`New case created for businessID=${businessID} caseID=${newCase.id}`);
			if (newCase) {
				// send business_invite_accepted_event to create connections
				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.BUSINESS_INVITE_ACCEPTED,
								case_id: newCase.id,
								business_id: businessID,
								customer_id: body.customer_id,
								applicant_id: userID
							}
						}
					]
				});

				await producer.send({
					topic: kafkaTopics.USERS_NEW,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.UPDATE_SUBROLE,
								user_id: userID,
								business_id: businessID
							}
						}
					]
				});
			}

			try {
				// attach case to invite
				// update invite status
				await db("data_invites").update({ case_id: newCase.id }).where({ id: body.invite_id });
				logger.debug(`Invite updated for: ${body.invite_id}`);
				// update business fun (insert/update DBA + insert/update website details)
				await businesses.updateDBAName({ name: body.name }, body.dba_names, {
					business_id: businessID,
					user_id: userID
				});
				logger.info(`DBA name updated for: ${businessID} with payload: ${JSON.stringify(body.dba_names)}`);
				// update business details
				const updateBusinessPayload = {
					name: body.name,
					address_line_1: body.address_line_1,
					address_line_2: body.address_line_2,
					address_postal_code: body.address_postal_code,
					address_city: body.address_city,
					address_state: body.address_state,
					address_country: resolveCountryCode(body?.address_country) ?? SupportedCountryCode.US,
					mobile: body.mobile
				};
				await businesses.updateBusinessDetails(
					{ ...updateBusinessPayload, ...(body.additional_details && { ...body.additional_details }) },
					{ businessID },
					{ user_id: userID }
				);

				logger.info(
					`Business details updated for: ${businessID} with payload: ${JSON.stringify(
						updateBusinessPayload
					)} and additional_details: ${JSON.stringify(body?.additional_details || {})}`
				);

				// delete first then insert mailing address
				// await db("data_business_addresses").delete().where({ business_id: businessID });
				await businesses.updateMailingAddresses(businessID, body, userID).catch(ex => {
					logger.error({ error: ex }, "Error updating mailing address");
				});
				logger.info(`Mailing address updated for: ${businessID} with payload: ${JSON.stringify(body)}`);
			} catch (error) {
				logger.error(error);
			}

			// if verified then submit case
			await db("data_cases").where({ id: newCase.id }).update({ status: CASE_STATUS.SUBMITTED });

			logger.info(`Case is submitted for: ${newCase.id}`);

			await db("data_case_status_history").insert({
				case_id: newCase.id,
				status: CASE_STATUS.SUBMITTED,
				created_by: userID // Assuming user_id is available
			});

			logger.info(`Case status history is updated for: ${newCase.id}`);

			// update case status for manual score service for scoring decisions
			const statusUpdatedMessage = {
				business_id: businessID,
				case_id: newCase.id,
				case_status: CASE_STATUS_ENUM.SUBMITTED
			};
			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.CASE_STATUS_UPDATED,
							...statusUpdatedMessage
						}
					}
				]
			});

			// complete the invitation
			await businesses.updateInvitationStatus(
				{ invitation_id: body.invite_id, action: "COMPLETE" },
				{ user_id: userID }
			);
			response.case_id = newCase.id;
		} else if (!isBulk) {
			// If we get to this point, then /validate is going to give a successful response, we need to create a case for the combination of the user, business, & customer -- -but only if one doesn't already exist!
			const { onboardingCaseID, standaloneCaseID } = await caseManagementService.ensureCasesExist(businessID, {
				applicantID: userID,
				customerID: body.customer_id as UUID,
				inviteID: body.invite_id as UUID,
				userInfo,
				name: body.name
			});

			if (changedFields.length) {
				await applicationEdit.editApplication(
					{ businessID },
					{
						case_id: onboardingCaseID as UUID,
						customer_id: body.customer_id as UUID,
						stage_name: "company",
						created_by: userInfo?.issued_for?.user_id,
						user_name: `${userInfo?.issued_for?.first_name} ${userInfo?.issued_for?.last_name}`,
						data: changedFields
					}
				);
			}

			logger.info(
				`updating business details for ${businessID} with payload: ${JSON.stringify(body.additional_details)}`
			);

			// Update industry information
			await businesses.updateBusinessIndustryDetails(
				businessID,
				body.additional_details?.industry?.id ?? body.additional_details?.industry ?? null,
				userID
			);

			const keys = ["naics_code", "mcc_code", "naics_title", "mcc_title", "mcc_id", "naics_id"];

			const naicsMccData = Object.fromEntries(
				Object.entries(body.additional_details ?? {}).filter(([k]) => keys.includes(k))
			);

			if (Object.keys(naicsMccData).length > 0) {
				await businesses.updateNaicsMccCodeInfo(businessID, naicsMccData, userInfo.user_id);
			}

			response.case_id = onboardingCaseID;
			response.standalone_case_id = standaloneCaseID;
		}

		await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: businessID });

		response.is_business_verified = business.status === BUSINESS_STATUS.VERIFIED;
		response.business = business;

		return { data: response, message: "Business Validated Successfully" };
	} catch (error) {
		logger.error(error, `Error validating business`);
		throw error;
	}
};

/**
 * Handles the case when a business is invited to an existing business
 * @param body
 * @param response
 * @param userID
 * @returns the case ID
 */
async function handleInviteCase(body: any, response: ValidateTINResponse, userID: UUID | string): Promise<string> {
	const isAnonymous = !userID || userID === envConfig.ENTERPRISE_APPLICANT_ID;
	let invite;
	if (!isAnonymous) {
		invite = await db("data_invites").where({ id: body.invite_id }).first();
		if (!invite) {
			throw new BusinessApiError("Invitation not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
	}
	const customerID = invite?.customer_id ?? body?.customer_id ?? response?.customer_id;
	const businessID = (response.business_id as UUID) ?? body.business_id;
	const newCase = await caseManagementService.createCaseFromEgg({
		applicant_id: userID,
		customer_id: customerID,
		business_id: businessID,
		status: CASE_STATUS.ONBOARDING,
		created_by: userID,
		updated_by: userID,
		case_type: CASE_TYPE.ONBOARDING
	});
	await db("data_invites").where({ id: body.invite_id }).update({ case_id: newCase.id }).returning("*");

	const userInfo = await getApplicantByID(userID);
	await businesses.updateInvitationStatus({ invitation_id: body.invite_id, action: "ACCEPT" }, userInfo);
	await sendKafkaMessages(newCase.id, response.business_id ?? "", customerID, userInfo, body.name);
	response.case_id = newCase.id;
	return newCase.id;
}

/* 
Returns the case ID of the created or existing case
*/
async function handleStandaloneCase(businessID, businessName, user_id): Promise<string> {
	// When anonymous there is no new user
	const standaloneCase = await db("data_cases")
		.select("data_cases.*")
		.leftJoin("data_businesses as db", "db.id", "data_cases.business_id")
		.where({
			"data_cases.business_id": businessID,
			"data_cases.applicant_id": user_id,
			"data_cases.case_type": CASE_TYPE.ONBOARDING
		})
		.andWhere({ "db.is_deleted": false })
		.first();
	if (!standaloneCase) {
		const newCase = await caseManagementService.createCaseFromEgg({
			applicant_id: user_id,
			business_id: businessID,
			status: CASE_STATUS.ONBOARDING,
			created_by: user_id,
			updated_by: user_id,
			case_type: CASE_TYPE.ONBOARDING
		});
		const userInfo = await getApplicantByID(user_id);
		await sendKafkaMessages(newCase.id, businessID, null, userInfo, businessName);
		return newCase.id;
	}
	return standaloneCase.id;
}

async function sendBusinessVerification(
	businessID: string,
	body: ValidateBusinessRequest,
	authorization?: string
): Promise<void> {
	const midDeskBody = {
		name: body.name,
		addresses: [
			{
				address_line_1: body.address_line_1,
				address_line_2: body.address_line_2,
				address_postal_code: body.address_postal_code,
				address_city: body.address_city,
				address_state: body.address_state
			}
		],
		official_website: body.official_website,
		...(body.tin && { tin: body.tin }),
		...(body?.dba_names && body.dba_names.length && { dba_names: body.dba_names.map(dba => dba.name) })
	};

	if (body?.mailing_addresses && body.mailing_addresses.length) {
		body.mailing_addresses.forEach((addr: Address | Business.BusinessAddress) => {
			try {
				const normalizedAddr = AddressUtil.convertToAddress(addr);
				if (!AddressUtil.isCompleteAddress(normalizedAddr)) {
					// Ignore invalid addresses
					return;
				}
				midDeskBody.addresses.push({
					address_line_1: normalizedAddr.address_line_1,
					address_line_2: normalizedAddr.address_line_2,
					address_city: normalizedAddr.address_city,
					address_state: normalizedAddr.address_state,
					address_postal_code: normalizedAddr.address_postal_code
				});
			} catch (error: unknown) {
				if (error instanceof AddressError) {
					logger.error({ error, addr, body }, `Ignoring invalid address: ${error.getInput()}`);
					return;
				}
				logger.error({ error, body, addr }, `Error converting address to address object`);
				throw error;
			}
		});
	}

	let middeskOrdersFlag: boolean = false;
	if (Object.hasOwn(body, "customer_id") && body.customer_id) {
		// check if FF is enabled or not
		middeskOrdersFlag = await getFlagValue(
			FEATURE_FLAGS.DOS_387_MIDDESK_FAILED_TIN_ORDERS,
			{ key: "customer", kind: "customer", customer_id: body.customer_id },
			false
		);
		if (!middeskOrdersFlag) {
			logger.info(`Middesk order feature flag is not enabled for customer: ${body.customer_id}`);
		}
	}

	if (middeskOrdersFlag) {
		await enforceRetryLimits({
			businessId: businessID as UUID,
			customerId: body.customer_id as UUID | null,
			callbackFn: () => submitBusinessEntityForReview(businessID, midDeskBody, authorization)
		});
	} else {
		try {
			logger.debug("Running business entity verification");
			await submitBusinessEntityForReview(businessID, midDeskBody, authorization);
		} catch (error: any) {
			logger.debug(error, `Middesk submission failed: attempting update: ${error.message}`);
			try {
				await businesses.updateBusinessEntity(businessID, midDeskBody, authorization);
			} catch (updateError: any) {
				logger.debug(updateError, `Middesk updation failed: ${updateError.message}`);
				throw updateError;
			}
		}
	}
}

async function enforceRetryLimits<T = void>(args: {
	businessId: UUID;
	callbackFn: () => Promise<any>;
	customerId: UUID | null;
}): Promise<T> {
	const MAX_RETRIES = 3;

	const { businessId, callbackFn, customerId } = args;
	const businessRetries = await getBusinessRetries(customerId, businessId);
	if (businessRetries >= MAX_RETRIES) {
		throw new BusinessApiError(
			"Maximum retries exceeded for business verification",
			StatusCodes.TOO_MANY_REQUESTS,
			ERROR_CODES.NOT_ALLOWED
		);
	}
	await setBusinessRetries(customerId, businessId);
	return callbackFn();
}

async function sendKafkaMessages(
	caseID: string | UUID,
	businessID: string | UUID,
	customerID: string | UUID | null,
	userInfo: UserInfo,
	businessName: string
) {
	// Fetch cached application edit invite for guest owner applicant ID resolution
	const cachedApplicationEditInvite = await caseManager.getCachedApplicationEditInvite(caseID, customerID);

	const businessAcceptMessage = {
		case_id: caseID,
		business_id: businessID,
		customer_id: customerID,
		applicant_id: userInfo.user_id
	};
	const auditMessage = {
		case_id: caseID,
		business_name: businessName,
		applicant_id: resolveApplicantIdForAudit({
			userInfo,
			cachedApplicationEditInvite
		}),
		business_id: businessID
	};

	await producer.send({
		topic: kafkaTopics.BUSINESS,
		messages: [
			{
				key: businessID,
				value: {
					event: kafkaEvents.BUSINESS_INVITE_ACCEPTED,
					...businessAcceptMessage
				}
			}
		]
	});

	await producer.send({
		topic: kafkaTopics.NOTIFICATIONS,
		messages: [
			{
				key: businessID,
				value: {
					event: kafkaEvents.CASE_CREATED_AUDIT,
					...auditMessage
				},
				headers: { idempotencyID: caseID }
			}
		]
	});
}

export const checkMaximumRetries = async (args: {
	customerId: string | UUID;
	businessId?: string | UUID | null;
	externalId?: string;
}): Promise<void> => {
	const MAX_RETRIES = 3;
	const { customerId, externalId } = args;
	let businessId: string | UUID | null = args.businessId ?? null;
	let middeskOrdersFlag: boolean = false;
	if (customerId) {
		// check if FF is enabled or not
		middeskOrdersFlag = await getFlagValue(
			FEATURE_FLAGS.DOS_387_MIDDESK_FAILED_TIN_ORDERS,
			{ key: "customer", kind: "customer", customer_id: customerId },
			false
		);
	}
	if (!middeskOrdersFlag) {
		logger.info(`Middesk order feature flag is not enabled for customer: ${customerId}`);
		return;
	}
	if (!businessId && !externalId) {
		throw new BusinessApiError(
			"Business ID or external ID are required for checking maximum retries",
			StatusCodes.BAD_REQUEST,
			ERROR_CODES.INVALID
		);
	}

	if (!businessId) {
		const businessResult = await db("rel_business_customer_monitoring")
			.select("business_id")
			.where({ external_id: externalId })
			.first();
		if (!businessResult) {
			throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		businessId = businessResult.business_id;
	}
	if (!businessId) {
		throw new BusinessApiError(
			"Business ID is required for checking maximum retries",
			StatusCodes.BAD_REQUEST,
			ERROR_CODES.INVALID
		);
	}
	const businessRetries = await getBusinessRetries(customerId, businessId);
	if (businessRetries >= MAX_RETRIES) {
		throw new BusinessApiError(
			"Maximum retries exceeded for business verification",
			StatusCodes.TOO_MANY_REQUESTS,
			ERROR_CODES.NOT_ALLOWED
		);
	}
};

export const getBusinessRetries = async (
	customerId: string | UUID | null,
	businessID: string | UUID
): Promise<number> => {
	const redisKey = `{customer}:${customerId ?? "no-customer"}:{business}:${businessID}:retries`;
	return Number(await redis.get(redisKey)) ?? 0;
};

export const setBusinessRetries = async (customerId: string | UUID | null, businessID: string | UUID) => {
	const TTL = 60 * 60 * 24 * 7; // 7 days
	const redisKey = `{customer}:${customerId ?? "no-customer"}:{business}:${businessID}:retries`;
	const businessRetries: number = await getBusinessRetries(customerId, businessID);
	await redis.setEx(redisKey, TTL, (businessRetries + 1).toString());
};

async function enqueueAssertTIN(
	businessID: UUID,
	countryCode: string | SupportedCountryCode = SupportedCountryCode.US,
	delay: number = 1000 * 60 * 10
) {
	try {
		if (!isUSBusiness(countryCode)) {
			logger.debug(`Skipping TIN assertion for businessID=${businessID} as it is based in country ${countryCode}`);
			return;
		}
		if (Number.isNaN(delay) || delay < 0) {
			throw new Error("Invalid delay value " + delay);
		}
		if (!taskQueue) {
			const { taskQueue: taskQueueModule } = await import("#workers");
			taskQueue = taskQueueModule;
		}
		// mark the business as unverified until the job completes
		await db("data_businesses").where({ id: businessID }).update({ status: "UNVERIFIED" });
		// Delay the assertion of TIN by 10 minutes - this will null out the TIN if it remains unverified
		logger.debug(`Delaying TIN assertion for businessID=${businessID} by ${delay / 1000 / 60} minutes`);
		// Use dynamic import to avoid circular dependency
		await taskQueue.addJob<AssertTINJob>(QUEUE_EVENTS.ASSERT_TIN, { businessID }, { delay });
	} catch (ex) {
		logger.error({ error: ex }, "Error adding TIN assertion job to queue");
	}
}
