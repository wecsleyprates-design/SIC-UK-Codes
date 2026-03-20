import {
	CASE_STATUS,
	CASE_STATUS_ENUM,
	CASE_TYPE,
	ERROR_CODES,
	kafkaEvents,
	kafkaTopics,
	ROLES,
	BUCKETS,
	DIRECTORIES,
	INVITE_STATUS,
	CASE_INFO_REQUESTS,
	ROLE_ID_TO_ROLE,
	CUSTOM_ONBOARDING_SETUP,
	FIELD_PROPERTY,
	SCORE_TRIGGER,
	FEATURE_FLAGS,
	WEBHOOK_EVENTS,
	CONNECTION_STATUS,
	progressionStages,
	progressionFields,
	CORE_PERMISSIONS,
	COMPANY_FIELD_NAMES,
	TAX_FIELD_NAMES,
	PROCESSING_HISTORY_FIELD_NAMES,
	OWNERSHIP_FIELD_NAMES
} from "#constants/index";
import {
	checkMobileExists,
	emailExists,
	getApplicants,
	getBulkUserInfo,
	getBusinessApplicants,
	getCustomerData,
	getReportStatusForCase,
	getCustomerUsers,
	getCaseDetailsExport,
	getBusinessIntegrationConnections,
	getBusinessProcessingHistory,
	fetchAdditionalAccountDetails,
	fetchDepositAccountInfo,
	getBusinessBankStatements,
	getBusinessAccountingStatements,
	getMerchantProfileData,
	fetchNPIDetails
} from "#helpers/api";

import {
	getFlagValue,
	hasDataPermission,
	logger,
	producer,
	sqlQuery,
	sqlTransaction,
	verifyCaseAccessByID,
	resolveApplicantIdForAudit
} from "#helpers/index";
import { db } from "#helpers/knex";

import { Business } from "#types/business";
import type { Case } from "#types/case";
import type { KafkaMessage } from "#types/kafkaMessage";
import {
	buildInsertQuery,
	convertToObject,
	decryptEin,
	encryptData,
	encryptEin,
	escapeRegExp,
	getStringValue,
	jwtSign,
	maskString,
	paginate,
	pick
} from "#utils/index";
import { StatusCodes } from "http-status-codes";
import { v4 as uuid } from "uuid";
import { businesses } from "../businesses/businesses";
import { CaseManagementApiError } from "./error";
import { riskAlert } from "../risk-alerts/risk-alerts";
import { getCachedSignedUrl, uploadFile } from "#utils/s3";
import { businessLookupHelper } from "#helpers/businessLookupHelper";
import { UUID } from "crypto";
import { envConfig, tokenConfig } from "#configs";
import { onboarding } from "./../onboarding/onboarding";
import { caseManager } from "#core";
import { BusinessInvites } from "../businesses/businessInvites";
import { BusinessInvite } from "#types/businessInvite";
import { esign } from "../esign/esign";
import { applicationEdit } from "../application-edits/application-edit";
import XLSX from "xlsx";
import { CaseDetailsExportEntry } from "./types";
import { toMDY } from "#utils/dateUtil";
import { UserInfo } from "#types";
import { sendWebhookEvent } from "#common";
import { Owners } from "../businesses/owners";
type FieldValueResolver = (fieldName: string) => boolean;

// Constants for database field selections
const BUSINESS_REQUIRED_FIELDS = [
	"name",
	"address_line_1",
	"address_city",
	"address_state",
	"address_postal_code",
	"tin",
	"industry",
	"official_website",
	"mobile",
	"social_account"
] as const;

const BUSINESS_ADDRESS_FIELDS = [
	"id",
	"line_1",
	"apartment",
	"city",
	"state",
	"country",
	"postal_code",
	"mobile",
	"is_primary"
] as const;

class CaseManagementService {
	/**
	 * Helper method to count truthy values as 1, falsy as 0.
	 * Useful for calculating completion counts.
	 * @param conditions Array of conditions to check
	 * @returns Sum of truthy conditions (1 for each truthy, 0 for falsy)
	 */
	private countTruthyValues(...conditions: boolean[]): number {
		return conditions.reduce((count, condition) => count + (condition ? 1 : 0), 0);
	}

	/**
	 * Identifies missing required fields for a given stage.
	 * @param stageKey Stage identifier (e.g. "business_info")
	 * @param fields Field configuration list
	 * @param isFieldFilled Resolver to determine if a field is filled
	 * @param ignoredFields Field names to exclude from validation
	 * @returns List of missing field keys in "<stage_key>.<snake_case_field>" format
	 */
	getMissingFieldsFromConfig(
		stageKey: string,
		fields: { name: string; section_name?: string; status?: string | boolean; key?: string }[] = [],
		isFieldFilled: FieldValueResolver,
		ignoredFields: string[] = []
	): string[] {
		const missing: string[] = [];
		for (const field of fields) {
			if (!ignoredFields.includes(field.name)) {
				const isRequired = field.status === "Required" || field.status === "Always Required";

				if (!isRequired) continue;

				const fieldKey = field.key || field.name; // prefer key if exists
				const filled = isFieldFilled(fieldKey);

				if (!filled) {
					missing.push(`${stageKey}.${fieldKey.toLowerCase().replace(/\s+/g, "_")}`);
				}
			}
		}
		return missing;
	}

	/**
	 * Calculate application progress for a case based on required field completion
	 * @param caseID - The case ID
	 * @param businessID - The business ID
	 * @param customerID - The customer ID
	 * @param caseStatus - Current case status code
	 * @returns Object with percent_complete, is_submitted, and missing_details
	 */
	async calculateApplicationProgress(
		caseID: string,
		businessID: string,
		customerID: string,
		caseStatus: number,
		authorization: string
	): Promise<{ percent_complete: number; is_submitted: boolean; missing_details: string[] } | null> {
		// TODO: Create a parent function that fetches case details and then calls this function
		// This is currently only used by getCaseByID but will be extended later
		// Ideally the parent function will be shared with getCaseByID to keep things DRY
		try {
			const isSubmitted = caseStatus !== CASE_STATUS.ONBOARDING;

			// early return if the case is submitted - no need to recalculate
			if (isSubmitted) {
				return {
					percent_complete: 100,
					is_submitted: true,
					missing_details: []
				};
			}

			logger.info(
				`[ApplicationProgress] Starting calculation for caseID=${caseID}, businessID=${businessID}, customerID=${customerID}`
			);

			// Get progression config with field configurations for each stage using the helper
			const progressionConfig = await businesses.getProgressionConfig(customerID);

			// Get business integration connections to check stage completion
			const connections = await getBusinessIntegrationConnections(businessID, {}, caseID);

			// Get processing history to check if processing_history stage is complete
			const processingHistory = await getBusinessProcessingHistory(businessID as UUID, caseID as UUID);

			// Get business details to check if company stage is complete
			const business = await db("public.data_businesses")
				.select(BUSINESS_REQUIRED_FIELDS)
				.where({ id: businessID, is_deleted: false })
				.first();
			if (!business) {
				logger.error(`[ApplicationProgress] Business not found for businessID=${businessID}`);
				return null;
			}

			const businessAddresses = await db("data_business_addresses")
				.select(BUSINESS_ADDRESS_FIELDS)
				.where({ business_id: businessID });
			let npiRecord: { submitted_npi: string } | null = null;
			try {
				if (caseID) {
					npiRecord = await fetchNPIDetails(businessID, caseID, { authorization });
				}
			} catch (_error) {
				logger.warn(`Error fetching NPI details: ${businessID}, ${caseID}`);
			}
			// Get all owners with their details to check field completion per owner
			const owners = await db("data_owners")
				.select(
					"data_owners.id",
					"data_owners.first_name",
					"data_owners.last_name",
					"data_owners.title",
					"data_owners.mobile",
					"data_owners.email",
					"data_owners.address_line_1",
					"data_owners.address_city",
					"data_owners.address_state",
					"data_owners.address_postal_code",
					"data_owners.date_of_birth",
					"data_owners.ssn",
					"rbo.ownership_percentage"
				)
				.innerJoin("rel_business_owners as rbo", "rbo.owner_id", "data_owners.id")
				.where("rbo.business_id", businessID);
			const hasOwners = owners.length > 0;

			// Count total required fields and completed required fields
			let totalRequiredFields = 0;
			let completedRequiredFields = 0;
			const missingDetails: string[] = [];

			for (const stage of progressionConfig) {
				const isSkippable = stage.is_skippable === true;
				let isStageCompleted = false;
				let stageRequiredFieldCount = 0;

				logger.info(
					`[ApplicationProgress] Stage "${stage.stage}": is_skippable=${isSkippable}, is_enabled=${stage.is_enabled}`
				);

				// Skip optional/skippable stages - application can be submitted without them
				if (isSkippable) {
					continue;
				}

				// Count required fields in this stage's config
				if (stage.config && stage.config.fields) {
					for (const field of stage.config.fields) {
						if (field.status === "Required" || field.status === "Always Required" || field.status === true) {
							stageRequiredFieldCount++;
						}
					}
				}

				// Determine if stage is completed
				switch (stage.stage) {
					case "company": {
						this.logRequiredFieldsFromStageConfig(stage);

						const companyNameComplete = Boolean(business?.name);
						const companyAddressComplete = Boolean(
							business?.address_line_1 &&
								business?.address_city &&
								business?.address_state &&
								business?.address_postal_code
						);

						isStageCompleted = companyNameComplete && companyAddressComplete;

						// Track missing company details
						if (!companyNameComplete) {
							missingDetails.push("business.legal_name");
						}
						if (!companyAddressComplete) {
							missingDetails.push("business.address");
						}

						// Base fields from config: Company Name (1) + Company Address (1)
						// These are always complete since case creation requires them
						const baseFieldsComplete = this.countTruthyValues(companyNameComplete, companyAddressComplete);

						// Count remaining required fields from config (beyond name + address)
						let remainingRequiredFields = stageRequiredFieldCount > 2 ? stageRequiredFieldCount - 2 : 0;

						// Add to totals
						totalRequiredFields += stageRequiredFieldCount;
						completedRequiredFields += baseFieldsComplete;
						if (remainingRequiredFields > 0) {
							isStageCompleted = false;
							const companyFieldResolvers: Record<string, () => boolean> = {
								[COMPANY_FIELD_NAMES.TAX_ID]: () => Boolean(business?.tin),
								[COMPANY_FIELD_NAMES.WEBSITE]: () => Boolean(business?.official_website),
								[COMPANY_FIELD_NAMES.COMPANY_PHONE]: () => Boolean(business?.mobile),
								[COMPANY_FIELD_NAMES.LINKEDIN]: () => Boolean(business?.social_account),
								[COMPANY_FIELD_NAMES.INDUSTRY]: () => Boolean(business?.industry),
								[COMPANY_FIELD_NAMES.MAILING_ADDRESS]: () => {
									const mailingAddress = businessAddresses?.find(
										(addr: { is_primary: boolean }) => addr.is_primary === false
									);
									return Boolean(mailingAddress);
								},
								[COMPANY_FIELD_NAMES.NPI_NUMBER]: () => {
									return Boolean(npiRecord && npiRecord?.submitted_npi);
								}
							};
							// Add missing required fields to missing_details
							const companyMissingFields = this.getMissingFieldsFromConfig(
								"business",
								stage.config?.fields,
								fieldName => companyFieldResolvers[fieldName]?.() ?? true,
								[COMPANY_FIELD_NAMES.COMPANY_NAME, COMPANY_FIELD_NAMES.COMPANY_ADDRESS]
							);
							missingDetails.push(...companyMissingFields);
							logger.info(
								`[ApplicationProgress] company: ${baseFieldsComplete + remainingRequiredFields}/${stageRequiredFieldCount} fields`
							);
						}

						// If stage is complete, add remaining required fields to completed count
						if (isStageCompleted) {
							completedRequiredFields += remainingRequiredFields;
							logger.info(
								`[ApplicationProgress] company: ${stageRequiredFieldCount}/${stageRequiredFieldCount} fields`
							);
						}

						continue;
					}

					case "ownership": {
						this.logRequiredFieldsFromStageConfig(stage);
						// Ownership Stage Flow:
						// Start → Check if verification required?
						//   ↓ NO  → Simple mode: Do owners exist? → Break (use generic logic)
						//   ↓ YES → Granular mode: Count fields per owner + verification status

						// Check if IDV is enabled and if verification is required
						const idvEnabled = stage.config?.fields?.find(
							f => f.name === "Enable Identity Verification" && f.section_name === "Identity Verification"
						)?.status;

						const submitWithUnverifiedIdentityEnabled = stage.config?.fields
							?.find(f => f.name === "Enable Identity Verification" && f.section_name === "Identity Verification")
							?.sub_fields?.find(subfield => subfield.name === "Submit with Unverified Identity")?.status;

						const verificationRequired = idvEnabled && !submitWithUnverifiedIdentityEnabled;

						logger.info(
							`[ApplicationProgress] Stage "ownership": idvEnabled=${idvEnabled}, submitWithUnverifiedIdentity=${submitWithUnverifiedIdentityEnabled}, verificationRequired=${verificationRequired}, totalOwners=${owners.length}`
						);

						// If verification is NOT required, just check if owners exist
						if (!verificationRequired) {
							isStageCompleted = hasOwners;
							if (!hasOwners) {
								missingDetails.push("ownership.beneficial_owners");
								break;
							}
						}

						// Verification IS required: count fields per owner for granular tracking
						// This allows for more accurate progress (e.g., 1 of 2 owners verified)

						// Build field mapping for ownership required fields
						const ownershipFieldMapping = {
							[OWNERSHIP_FIELD_NAMES.FULL_NAME]: ["first_name", "last_name"],
							[OWNERSHIP_FIELD_NAMES.TITLE]: ["title"],
							[OWNERSHIP_FIELD_NAMES.PHONE_NUMBER]: ["mobile"],
							[OWNERSHIP_FIELD_NAMES.EMAIL_ADDRESS]: ["email"],
							[OWNERSHIP_FIELD_NAMES.HOME_ADDRESS]: [
								"address_line_1",
								"address_city",
								"address_state",
								"address_postal_code"
							],
							[OWNERSHIP_FIELD_NAMES.DATE_OF_BIRTH]: ["date_of_birth"],
							[OWNERSHIP_FIELD_NAMES.SOCIAL_SECURITY_NUMBER]: ["ssn"],
							[OWNERSHIP_FIELD_NAMES.OWNERSHIP_PERCENTAGE]: ["ownership_percentage"]
						};

						// Determine which fields are required from config
						const requiredOwnerFields: string[] = [];
						const missingFields: string[] = [];

						if (stage.config?.fields) {
							for (const field of stage.config.fields) {
								if (field.status === "Required" || field.status === "Always Required") {
									if (ownershipFieldMapping[field.name]) {
										requiredOwnerFields.push(...ownershipFieldMapping[field.name]);
									} else {
										missingFields.push(field.name);
									}
								}
							}

							// Log all missing fields in one message
							if (missingFields.length > 0) {
								logger.warn(`[ApplicationProgress] Ownership field mapping missing for: ${missingFields.join(", ")}`);
							}
						}

						// Count fields per owner (including verification)
						let ownerRequiredFieldsCount = requiredOwnerFields.length + this.countTruthyValues(verificationRequired); // +1 for verification field
						let ownerCompletedFieldsCount = 0;

						// Get verification status for each owner
						const ownerVerificationMap = new Map();
						if (connections["owner_verification"]?.owners && Array.isArray(connections["owner_verification"].owners)) {
							for (const verifiedOwner of connections["owner_verification"].owners) {
								ownerVerificationMap.set(verifiedOwner.owner_id, verifiedOwner.status === "SUCCESS");
							}
						}

						// If no owners exist, count ownership as 0 complete out of the required fields for at least 1 owner
						// This ensures the progress accurately reflects that owners are needed
						if (owners.length === 0) {
							totalRequiredFields += ownerRequiredFieldsCount;
							// no owners = 0 complete
							missingDetails.push("ownership.beneficial_owners");
							logger.info(
								`[ApplicationProgress] ownership: 0/${ownerRequiredFieldsCount} fields (0 owners, ${ownerRequiredFieldsCount} fields required per owner incl. verification)`
							);
						} else {
							// Check completion for each owner
							for (const owner of owners) {
								let ownerFieldsCompleted = 0;

								// Check each required field for this owner
								for (const fieldName of requiredOwnerFields) {
									const value = owner[fieldName];
									if (value !== null && value !== undefined && value !== "") {
										ownerFieldsCompleted++;
									} else {
										// Track missing owner field details
										missingDetails.push(`ownership.owner_${owner.id}.${fieldName}`);
									}
								}
								// Check verification status
								if (verificationRequired) {
									const isVerified = ownerVerificationMap.get(owner.id) || false;
									if (isVerified) {
										ownerFieldsCompleted++; // Count verification field as complete
									} else {
										missingDetails.push(`ownership.owner_${owner.id}.verification`);
									}
								}

								ownerCompletedFieldsCount += ownerFieldsCompleted;
							}

							// Calculate total fields across all owners
							const totalOwnershipFields = ownerRequiredFieldsCount * owners.length;

							// Add to totals
							totalRequiredFields += totalOwnershipFields;
							completedRequiredFields += ownerCompletedFieldsCount;

							logger.info(
								`[ApplicationProgress] ownership: ${ownerCompletedFieldsCount}/${totalOwnershipFields} fields (${owners.length} owners, ${ownerRequiredFieldsCount} fields/owner incl. verification)`
							);
						}

						// Continue to next stage (skip the normal stage completion logic)
						continue;
					}

					case "banking": {
						this.logRequiredFieldsFromStageConfig(stage);

						// Initial check if banking connection exists
						const isBankingConnected = connections["banking"]?.is_connected || false;
						isStageCompleted = isBankingConnected;

						// Check if manual account verification is enabled
						const manualAccountVisibility = businesses.getFieldFromProgressionConfig(
							progressionConfig,
							progressionStages.BANKING,
							progressionFields.MANUAL_ACCOUNT_VERIFICATION
						)?.status;
						const isManualAccountEnabled: boolean = Boolean(manualAccountVisibility);

						// Check if deposit account is required
						const depositAccountVisibility = businesses.getFieldFromProgressionConfig(
							progressionConfig,
							progressionStages.BANKING,
							progressionFields.DEPOSIT_ACCOUNT
						)?.status;
						const isDepositAccountRequired: boolean =
							(typeof depositAccountVisibility === "string" && depositAccountVisibility.toLowerCase() === "required") ||
							(typeof depositAccountVisibility === "boolean" && depositAccountVisibility);

						// If manual account verification is enabled and we have additional account details, then the stage is complete
						let isManualAccountCompleted = false;
						let additionalAccountsCount = 0;
						if (isManualAccountEnabled) {
							const additionalAccountDetails = await fetchAdditionalAccountDetails(businessID, caseID);
							const additionalAccounts = additionalAccountDetails?.accounts ?? [];
							additionalAccountsCount = additionalAccounts.length;
							isManualAccountCompleted = additionalAccounts.length > 0;
							if (isManualAccountCompleted) {
								logger.info(
									`[ApplicationProgress] banking: Setting stage to complete based on manual account verification`
								);
								isStageCompleted = true;
							}
						}

						// Check for manual bank statement uploads if enabled
						let minStatementsRequired = "2";
						const uploadStatementField = progressionConfig
							?.find(row => row.stage.toLowerCase() === "banking")
							?.config?.fields?.find(field => field.name.toLowerCase() === "upload statements");
						const isUploadStatementEnabled = uploadStatementField?.status;
						const minNumberOfBankStatementsRequired =
							uploadStatementField?.sub_fields?.find(
								subField => subField.name.toLowerCase() === "# of statements required"
							)?.status || minStatementsRequired;

						let bankStatementsCount = 0;
						let isBankStatementsCompleted = false;
						if (isUploadStatementEnabled) {
							const bankStatements = await getBusinessBankStatements(businessID as UUID, caseID as UUID);
							bankStatementsCount = bankStatements.length;
							isBankStatementsCompleted = bankStatements.length >= Number(minNumberOfBankStatementsRequired);

							if (isBankStatementsCompleted) {
								logger.info(
									`[ApplicationProgress] banking: Setting stage to complete based on uploaded bank statements`
								);
								isStageCompleted = true;
							}
						}

						// Track missing banking connection if not completed through any method
						if (!isStageCompleted) {
							if (!isBankingConnected && !isManualAccountCompleted && !isBankStatementsCompleted) {
								missingDetails.push("banking.account_number");
								missingDetails.push("banking.routing_number");
							}
						}

						// Check deposit account requirement - applies to ALL completion paths
						// If deposit account is Required, it must be provided regardless of which path completed banking
						let isDepositAccountCompleted = false;
						if (isDepositAccountRequired) {
							const depositAccountDetails = await fetchDepositAccountInfo(businessID);
							isDepositAccountCompleted = depositAccountDetails?.numbers?.ach?.length > 0;

							if (isStageCompleted && !isDepositAccountCompleted) {
								logger.info(
									`[ApplicationProgress] banking: Flipping stage to incomplete - deposit account is Required but not provided`
								);
								isStageCompleted = false;
							}
							if (!isDepositAccountCompleted) {
								missingDetails.push("banking.deposit_account");
							}
						}

						// If banking has 0 config fields but is required, count it as 1 virtual field
						if (stageRequiredFieldCount === 0) {
							stageRequiredFieldCount++;
							logger.info(`[ApplicationProgress] banking: No config fields found, counting as 1 virtual field`);
						}

						// Summary log
						logger.info(
							`[ApplicationProgress] banking: COMPLETION SUMMARY - ` +
								`Real-time connection: ${isBankingConnected}, ` +
								`Manual accounts (${isManualAccountEnabled ? "enabled" : "disabled"}): ${isManualAccountCompleted} (count: ${additionalAccountsCount}), ` +
								`Deposit account (${isDepositAccountRequired ? "required" : "not required"}): ${isDepositAccountCompleted}, ` +
								`Bank statements (${isUploadStatementEnabled ? "enabled" : "disabled"}): ${isBankStatementsCompleted} (count: ${bankStatementsCount}), ` +
								`=> FINAL STAGE COMPLETED: ${isStageCompleted}`
						);
						break;
					}

					case "accounting": {
						this.logRequiredFieldsFromStageConfig(stage);

						// Set initial completion based on accounting connection
						isStageCompleted = connections["accounting"]?.is_connected || false;

						// Check if upload documents is enabled
						const uploadDocumentField = progressionConfig
							?.find(row => row.stage.toLowerCase() === "accounting")
							?.config?.fields?.find(field => field.name.toLowerCase() === "upload documents");
						const isUploadDocumentEnabled = uploadDocumentField?.status;
						const minNumberOfStatementsRequired =
							uploadDocumentField?.sub_fields?.find(
								subField => subField.name.toLowerCase() === "# of statements required"
							)?.status || "2";

						// Check for manual document uploads if enabled
						if (isUploadDocumentEnabled) {
							const accountingStatements = await getBusinessAccountingStatements(businessID as UUID, caseID as UUID);
							if (accountingStatements.length >= Number(minNumberOfStatementsRequired)) {
								isStageCompleted = true;
							}
						}

						// If accounting has 0 config fields but is required, count it as 1 virtual field
						if (stageRequiredFieldCount === 0) {
							stageRequiredFieldCount++;
						}

						// Track missing accounting connection
						if (!isStageCompleted) {
							missingDetails.push("accounting.connection");
						}

						break;
					}

					case "tax_consent": {
						this.logRequiredFieldsFromStageConfig(stage);
						// Check if any tax connection is successful
						isStageCompleted = connections["taxation"]?.is_connected || false;
						// Check individual connections for SUCCESS status (matches progression API logic)
						if (connections["taxation"]?.connections && Array.isArray(connections["taxation"].connections)) {
							for (const connection of connections["taxation"].connections) {
								if (connection.connection_status === CONNECTION_STATUS.SUCCESS) {
									isStageCompleted = true;
									break;
								}
							}
						}

						const filledData = connections["taxation"]?.manual_tax_filing?.data?.tax_filings;
						const formType = filledData?.form;
						const taxFieldResolvers: Record<string, () => boolean> = {
							[TAX_FIELD_NAMES.FILED_DATE]: () => Boolean(filledData?.filed_date),
							[TAX_FIELD_NAMES.TOTAL_SALES]: () => Boolean(filledData?.total_sales),
							[TAX_FIELD_NAMES.TOTAL_COMPENSATION]: () => Boolean(filledData?.total_compensation),
							[TAX_FIELD_NAMES.TOTAL_WAGES]: () => Boolean(filledData?.total_wages),
							[TAX_FIELD_NAMES.COST_OF_GOODS_SOLD]: () => Boolean(filledData?.cost_of_goods_sold),
							[TAX_FIELD_NAMES.IRS_BALANCE]: () => Boolean(filledData?.irs_balance),
							[TAX_FIELD_NAMES.IRS_LIENS]: () => Boolean(filledData?.lien_balance),
							[TAX_FIELD_NAMES.TAX_PERIOD_ENDING]: () => Boolean(filledData?.tax_period_ending_date),
							[TAX_FIELD_NAMES.AMOUNT_FILED]: () => Boolean(filledData?.amount_filed),
							[TAX_FIELD_NAMES.ACCOUNT_BALANCE]: () => Boolean(filledData?.balance),
							[TAX_FIELD_NAMES.ACCRUED_INTEREST]: () => Boolean(filledData?.interest),
							[TAX_FIELD_NAMES.ACCRUED_PENALTY]: () => Boolean(filledData?.penalty)
						};
						const form1120Fields = stage.config?.fields?.filter(
							val => val.section_name === "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM ANNUAL TAX DOCUMENTS?"
						);
						const form941Fields = stage.config?.fields?.filter(
							val => val.section_name === "WHICH INFORMATION WOULD YOU LIKE TO COLLECT FROM QUARTERLY TAX DOCUMENTS?"
						);
						// Add missing required fields to missing_details
						const taxMissingFields = this.getMissingFieldsFromConfig(
							"tax_consent",
							formType ? (formType === "941" ? form941Fields : form1120Fields) : [],
							fieldName => taxFieldResolvers[fieldName]?.() ?? true
						);
						missingDetails.push(...taxMissingFields);

						// If tax_consent has 0 config fields but is required, count it as 1 virtual field
						if (stageRequiredFieldCount === 0) {
							stageRequiredFieldCount++;
						}

						// Track missing tax consent
						if (!isStageCompleted && !filledData) {
							missingDetails.push("tax_consent.connection");
						}

						break;
					}

					case "processing_history": {
						this.logRequiredFieldsFromStageConfig(stage);
						// Check if processing history has meaningful data (files or data sections)
						// Matches progression API logic
						let hasMeaningfulData = false;

						if (processingHistory && Array.isArray(processingHistory) && processingHistory.length > 0) {
							for (const record of processingHistory) {
								const {
									american_express_data,
									card_data,
									point_of_sale_data,
									general_data,
									seasonal_data,
									file_name,
									file_path
								} = record;

								const processingHistoryFieldResolvers: Record<string, () => boolean> = {
									[PROCESSING_HISTORY_FIELD_NAMES.MONTHLY_VOLUME]: () => Boolean(general_data?.monthly_volume),
									[PROCESSING_HISTORY_FIELD_NAMES.ANNUAL_VOLUME]: () => Boolean(general_data?.annual_volume),
									[PROCESSING_HISTORY_FIELD_NAMES.AVERAGE_TICKET_SIZE]: () =>
										Boolean(general_data?.average_ticket_size),
									[PROCESSING_HISTORY_FIELD_NAMES.HIGH_TICKET_SIZE]: () => Boolean(general_data?.high_ticket_size),
									[PROCESSING_HISTORY_FIELD_NAMES.MONTHLY_OCCURRENCE_HIGH_TICKET]: () =>
										Boolean(general_data?.monthly_occurrence_of_high_ticket),
									[PROCESSING_HISTORY_FIELD_NAMES.EXPLANATION_HIGH_TICKET]: () =>
										Boolean(general_data?.explanation_of_high_ticket),
									[PROCESSING_HISTORY_FIELD_NAMES.DESIRED_LIMIT]: () => Boolean(general_data?.desired_limit),
									[PROCESSING_HISTORY_FIELD_NAMES.DEFINE_SEASONAL_BUSINESS]: () =>
										Boolean(seasonal_data?.is_seasonal_business),
									[PROCESSING_HISTORY_FIELD_NAMES.HIGH_VOLUME_MONTHS]: () => Boolean(seasonal_data?.high_volume_months),
									[PROCESSING_HISTORY_FIELD_NAMES.EXPLANATION_HIGH_VOLUME_MONTHS]: () =>
										Boolean(seasonal_data?.explanation_of_high_volume_months),
									[PROCESSING_HISTORY_FIELD_NAMES.CARD_SWIPED]: () => Boolean(point_of_sale_data?.swiped_cards),
									[PROCESSING_HISTORY_FIELD_NAMES.CARD_KEYED]: () => Boolean(point_of_sale_data?.typed_cards),
									[PROCESSING_HISTORY_FIELD_NAMES.MAIL_TELEPHONE]: () => Boolean(point_of_sale_data?.mail_telephone),
									[PROCESSING_HISTORY_FIELD_NAMES.E_COMMERCE]: () => Boolean(point_of_sale_data?.e_commerce),
									[PROCESSING_HISTORY_FIELD_NAMES.VISA_MONTHLY_VOLUME]: () => Boolean(card_data?.monthly_volume),
									[PROCESSING_HISTORY_FIELD_NAMES.VISA_ANNUAL_VOLUME]: () => Boolean(card_data?.annual_volume),
									[PROCESSING_HISTORY_FIELD_NAMES.VISA_AVERAGE_TICKET_SIZE]: () =>
										Boolean(card_data?.average_ticket_size),
									[PROCESSING_HISTORY_FIELD_NAMES.VISA_HIGH_TICKET_SIZE]: () => Boolean(card_data?.high_ticket_size),
									[PROCESSING_HISTORY_FIELD_NAMES.VISA_DESIRED_LIMIT]: () => Boolean(card_data?.desired_limit),
									[PROCESSING_HISTORY_FIELD_NAMES.AMERICAN_MONTHLY_VOLUME]: () =>
										Boolean(american_express_data?.monthly_volume),
									[PROCESSING_HISTORY_FIELD_NAMES.AMERICAN_ANNUAL_VOLUME]: () =>
										Boolean(american_express_data?.annual_volume),
									[PROCESSING_HISTORY_FIELD_NAMES.AMERICAN_AVERAGE_TICKET_SIZE]: () =>
										Boolean(american_express_data?.average_ticket_size),
									[PROCESSING_HISTORY_FIELD_NAMES.AMERICAN_HIGH_TICKET_SIZE]: () =>
										Boolean(american_express_data?.high_ticket_size),
									[PROCESSING_HISTORY_FIELD_NAMES.AMERICAN_DESIRED_LIMIT]: () =>
										Boolean(american_express_data?.desired_limit)
								};
								const generalFields = stage?.config.fields.filter(
									val => val.section_name === "What general processing history data would you like to collect?"
								);
								const seasonalFields = stage?.config.fields.filter(
									val => val.section_name === "What seasonal information would you like to collect?"
								);
								const visaFields = stage?.config.fields.filter(
									val => val.section_name === "What Visa, Mastercard, and Discover data would you like to collect?"
								);
								const americanExpressFields = stage?.config.fields.filter(
									val => val.section_name === "What American Express data would you like to collect?"
								);
								const posFields = stage?.config.fields.filter(
									val => val.section_name === "What Point of Sale data would you like to collect?"
								);
								// Add missing required fields to missing_details
								const generalMissingFields = this.getMissingFieldsFromConfig(
									"processing_history.general_data",
									generalFields,
									fieldName => processingHistoryFieldResolvers[fieldName]?.() ?? true
								);
								const seasonalMissingFields = this.getMissingFieldsFromConfig(
									"processing_history.seasonal_data",
									seasonalFields,
									fieldName => processingHistoryFieldResolvers[fieldName]?.() ?? true
								);
								const posMissingFields = this.getMissingFieldsFromConfig(
									"processing_history.point_of_sale_data",
									posFields,
									fieldName => processingHistoryFieldResolvers[fieldName]?.() ?? true
								);
								const visaMissingFields = this.getMissingFieldsFromConfig(
									"processing_history.card_data",
									visaFields,
									fieldName => processingHistoryFieldResolvers[`Visa ${fieldName}`]?.() ?? true
								);
								const americanExpressMissingFields = this.getMissingFieldsFromConfig(
									"processing_history.american_express_data",
									americanExpressFields,
									fieldName => processingHistoryFieldResolvers[`American ${fieldName}`]?.() ?? true
								);
								missingDetails.push(...generalMissingFields);
								missingDetails.push(...seasonalMissingFields);
								missingDetails.push(...posMissingFields);
								missingDetails.push(...visaMissingFields);
								missingDetails.push(...americanExpressMissingFields);

								// Check if any file is attached
								if (file_name || file_path) {
									hasMeaningfulData = true;
									break;
								}

								// Check if any section has data beyond guest_owner_edits
								const dataSections = [
									american_express_data,
									card_data,
									point_of_sale_data,
									general_data,
									seasonal_data
								];
								for (const section of dataSections) {
									if (section && Object.keys(section).some(key => key !== "guest_owner_edits")) {
										hasMeaningfulData = true;
										break;
									}
								}

								if (hasMeaningfulData) break;
							}
						}

						isStageCompleted = hasMeaningfulData;

						// If processing_history has 0 config fields but is required, count it as 1 virtual field
						if (stageRequiredFieldCount === 0) {
							stageRequiredFieldCount++;
						}

						// Track missing processing history
						if (!isStageCompleted) {
							missingDetails.push("processing_history.data");
						}

						break;
					}

					case "custom_fields": {
						// Get the latest enabled template for this customer
						const enabledTemplate = await db("onboarding_schema.data_custom_templates")
							.where("customer_id", customerID)
							.where("is_enabled", true)
							.orderBy("version", "desc")
							.first();

						if (!enabledTemplate) {
							logger.info(`[ApplicationProgress] custom_fields: No enabled template found for customer ${customerID}`);
							break;
						}

						const customFieldsResult = await db
							.with("latest", qb => {
								qb.distinctOn("dbcf.case_id", "dbcf.field_id")
									.select("dbcf.*")
									.from("onboarding_schema.data_business_custom_fields as dbcf")
									.where("dbcf.case_id", caseID)
									.andWhere("dbcf.business_id", businessID)
									.andWhere("dbcf.template_id", enabledTemplate.id)
									.orderBy([
										{ column: "dbcf.case_id" },
										{ column: "dbcf.field_id" },
										{ column: "dbcf.created_at", order: "desc" },
										{ column: "dbcf.id", order: "desc" }
									]);
							})
							.select(
								"dcf.id",
								"dcf.label",
								"dcf.step_name as section_name",
								"dcf.rules",
								"latest.field_value as value"
							)
							.from("onboarding_schema.data_custom_fields as dcf")
							.leftJoin("latest", "latest.field_id", "dcf.id")
							.where("dcf.template_id", enabledTemplate.id);

						// Count required fields and check if they're filled
						let requiredFieldsCount = 0;
						let filledRequiredFieldsCount = 0;

						for (const field of customFieldsResult) {
							// Check if field has a required rule
							const isRequired = field.rules?.required && Object.keys(field.rules.required).length > 0;

							if (isRequired) {
								requiredFieldsCount++;
								// Check if field has a non-null, non-empty value
								if (field.value !== null && field.value !== "") {
									filledRequiredFieldsCount++;
								} else {
									// Track missing custom field
									missingDetails.push(`custom_fields.${field.label.toLowerCase().replace(/\s+/g, "_")}`);
								}
							}
						}

						// Skip if no required fields found
						if (requiredFieldsCount === 0) {
							continue;
						}

						// For custom fields, we count each completed field individually
						// rather than treating it as all-or-nothing stage completion
						stageRequiredFieldCount = requiredFieldsCount;
						totalRequiredFields += stageRequiredFieldCount;
						completedRequiredFields += filledRequiredFieldsCount;

						logger.info(
							`[ApplicationProgress] custom_fields: ${filledRequiredFieldsCount}/${requiredFieldsCount} fields`
						);

						// Continue to next stage
						continue;
					}

					case "review":
						// Review stage is not counted towards completion
						continue;

					default:
						// Unknown stage - skip
						continue;
				}

				// Add to totals
				totalRequiredFields += stageRequiredFieldCount;
				if (isStageCompleted) {
					completedRequiredFields += stageRequiredFieldCount;
					logger.info(
						`[ApplicationProgress] ${stage.stage}: ${stageRequiredFieldCount}/${stageRequiredFieldCount} fields`
					);
				} else if (stageRequiredFieldCount > 0) {
					logger.info(`[ApplicationProgress] ${stage.stage}: 0/${stageRequiredFieldCount} fields`);
				}
			}

			// Calculate percentage: (completed / total) * 100
			const percentComplete =
				totalRequiredFields > 0 ? Math.round((completedRequiredFields / totalRequiredFields) * 100) : 0;

			logger.info(
				`[ApplicationProgress] Completed: ${completedRequiredFields}/${totalRequiredFields} fields (${percentComplete}%), submitted=${isSubmitted}, missing=${missingDetails.length} details`
			);

			return {
				percent_complete: percentComplete,
				is_submitted: isSubmitted,
				missing_details: missingDetails.reduce((acc: string[], curr: string) => {
					if (!acc.includes(curr)) {
						acc.push(curr);
					}
					return acc;
				}, [])
			};
		} catch (error: any) {
			logger.error(
				`[ApplicationProgress] Error calculating application progress for caseID=${caseID}: ${error.message}`,
				error
			);
			// Return null on error to indicate calculation failed
			return null;
		}
	}

	/**
	 * Helper function to extract and log required fields from a stage config
	 * @param stage - The stage object containing config with fields
	 * @returns Array of required field names
	 */
	private logRequiredFieldsFromStageConfig(stage: any): string[] {
		const requiredFields: string[] = [];
		const stageLabel = stage.stage || "unknown";

		if (stage.config?.fields) {
			for (const field of stage.config.fields) {
				if (field.status === "Required" || field.status === "Always Required" || field.status === true) {
					requiredFields.push(field.name);
				}
			}
		}

		logger.info(
			`[ApplicationProgress] ${stageLabel}: Required fields from config: ${
				requiredFields.length > 0 ? requiredFields.join(", ") : "none"
			}`
		);

		return requiredFields;
	}

	async createCaseFromEgg(caseEgg: Case.Egg, businessName?: string, userInfo?: UserInfo): Promise<Case.Record> {
		const insertCase = await db<Case.Record>("data_cases").insert(caseEgg).returning("*");
		const caseID = insertCase[0]?.id;

		// Fetch cached application edit invite for guest owner applicant ID resolution
		const cachedApplicationEditInvite = caseID
			? await caseManager.getCachedApplicationEditInvite(caseID, insertCase[0]?.customer_id)
			: null;

		if (insertCase && insertCase[0] && caseID) {
			await db<Case.HistoryEgg>("data_case_status_history").insert({
				case_id: caseID,
				status: insertCase[0].status,
				created_by: insertCase[0].created_by
			});

			// Initialize data integration tasks progress
			await db("data_integration_tasks_progress")
				.insert({
					case_id: caseID,
					business_id: insertCase[0].business_id,
					customer_id: insertCase[0].customer_id || null,
					is_complete: false,
					total_tasks: 0,
					completed_tasks: 0,
					required_tasks_array: JSON.stringify([]),
					completed_tasks_array: JSON.stringify([])
				})
				.onConflict("case_id")
				.ignore();
			if (!businessName) {
				const business = await businessLookupHelper({ businessID: caseEgg.business_id }).catch(ex =>
					logger.error({ error: ex }, `Couldn't lookup businessID=${caseEgg.business_id}`)
				);
				businessName = business?.[0]?.name;
			}
			if (businessName) {
				const auditMessage = {
					case_id: caseID,
					business_name: businessName,
					applicant_id: userInfo
						? resolveApplicantIdForAudit({
								userInfo,
								cachedApplicationEditInvite
							})
						: insertCase[0].applicant_id,
					business_id: insertCase[0].business_id
				};

				await producer.send({
					topic: kafkaTopics.NOTIFICATIONS,
					messages: [
						{
							key: insertCase?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_CREATED_AUDIT,
								...auditMessage
							},
							headers: { idempotencyID: caseID }
						}
					]
				});
			}
			if (insertCase[0]?.customer_id) {
				await this.sendWebhookEventForCaseCreated(caseID, insertCase[0].customer_id as UUID);
			}
		}
		return insertCase[0];
	}

	/**
	 * @params {object,object,object}
	 * @returns {object}
	 * This function creates a case and business in case service and a user in auth service
	 */
	async createCase(body: any, params: any, userInfo: any, headers: any) {
		try {
			// TODO : creates a new business everytime , we need to revisit this
			const checkEmailExistsResponse = await emailExists(body.email, headers.authorization);
			if (checkEmailExistsResponse.email_exists && checkEmailExistsResponse.subrole !== "applicant") {
				throw new CaseManagementApiError(
					"Email already registered with another user.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			if (Object.hasOwn(body, "mobile")) {
				const checkMobileExistsResponse = await checkMobileExists(body.mobile, headers.authorization);

				if (checkMobileExistsResponse.mobile_exists) {
					throw new CaseManagementApiError(
						"Applicant mobile already registered with another user.",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}
			if (body.business_mobile) {
				const getBusinessMobileResult = await sqlQuery({
					sql: `SELECT id FROM data_businesses where mobile = $1 AND is_deleted = false`,
					values: [body.business_mobile]
				});
				if (getBusinessMobileResult.rowCount) {
					throw new CaseManagementApiError(
						"Business mobile already registered with another business.",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}

			const applicantBody = {
				pagination: false,
				filter: { email: body.email }
			};
			const applicantResponse = await getApplicants(applicantBody, headers.authorization);

			let doesEmailExist = false;
			let isCustomersApplicant = false;
			let applicantID: string | undefined;

			if (applicantResponse.length) {
				doesEmailExist = true;
				applicantID = applicantResponse[0].id;
				applicantResponse.forEach(item => {
					if (item.customer.id === params.customerID) {
						isCustomersApplicant = true;
					}
				});
			}

			const caseID = uuid() as UUID;
			const businessID = uuid();
			const { business_name: businessName, business_mobile: businessMobile, ...updatedBody } = body;
			let message: undefined | KafkaMessage.CreateApplicant;
			// Applicant exists but not with the current customer : Dont create a user but link the existing user_id to cusotmer's applicant subrole id
			if (doesEmailExist && !isCustomersApplicant) {
				message = {
					...updatedBody,
					user_id: userInfo.user_id,
					customer_id: params.customerID,
					applicant_id: applicantID,
					case_id: caseID,
					business_name: businessName,
					business_id: businessID,
					case: "link_applicant_to_customer"
				};
			} else if (doesEmailExist && isCustomersApplicant) {
				// Customer already has a case created with this user : Just link the case and send email
				message = {
					...updatedBody,
					user_id: userInfo.user_id,
					customer_id: params.customerID,
					applicant_id: applicantID,
					case_id: caseID,
					business_name: businessName,
					business_id: businessID,
					case: "send_invite"
				};
			} else {
				// User does not exist on the platform : Create a user and send email
				applicantID = uuid();

				message = {
					user_id: userInfo.user_id,
					customer_id: params.customerID,
					applicant_id: applicantID,
					case_id: caseID,
					case: "create_applicant",
					business_name: businessName,
					business_id: businessID,
					...updatedBody
				};
			}

			const businessEgg: Business.Egg = {
				id: businessID,
				status: Business.Status.UNVERIFIED,
				mobile: businessMobile,
				name: businessName,
				created_by: userInfo.user_id,
				updated_by: userInfo.user_id
			};
			const caseEgg: Case.Egg = {
				id: caseID as UUID,
				applicant_id: applicantID,
				business_id: businessID,
				status: CASE_STATUS.INVITED,
				created_by: userInfo.user_id,
				updated_by: userInfo.user_id,
				case_type: CASE_TYPE.ONBOARDING
			};

			const newBusiness = await businesses.createBusinessFromEgg(businessEgg);
			const newCase = await this.createCaseFromEgg(caseEgg);

			if (message) {
				message.case_id = newCase.id;
				message.business_id = newBusiness.id;
				const payload = {
					topic: kafkaTopics.USERS,
					messages: [
						{
							key: newBusiness.id,
							value: {
								event: kafkaEvents.CREATE_APPLICANT,
								...message
							}
						}
					]
				};
				await producer.send(payload);
			}
			if (newBusiness.id) {
				await businesses.sendBusinessInvited(
					{ businessID, applicantID, customerID: params.customerID, userID: userInfo.user_id },
					kafkaEvents.BUSINESS_INVITED
				);
			}
			return { case_id: caseID, business_id: businessID };
		} catch (error) {
			throw error;
		}
	}

	/**
		Ensure that:
		1) One onboarding case exists for the invite or applicant+business+customer
		2) One standalone case exists for the business.
		Returns the case IDs if an onboarding case exists or gets created by this flow, otherwise returns undefined.

	
	*/
	async ensureCasesExist(
		businessID: UUID,
		params: {
			applicantID: UUID;
			customerID: UUID | null;
			inviteID?: UUID;
			name?: string;
			userInfo?: any;
			customerInitiated?: boolean;
		}
	): Promise<{ onboardingCaseID: UUID | undefined; standaloneCaseID: UUID | undefined }> {
		let onboardingCaseID: UUID | undefined;
		let standaloneCaseID: UUID | undefined;
		const { applicantID, customerID, inviteID, name, userInfo, customerInitiated } = params;
		// If the acting user is a guest owner, ignore applicant filter so we don't create a new case
		const effectiveApplicantID = userInfo.is_guest_owner ? null : applicantID;

		logger.debug(
			`guestOwner=${userInfo.is_guest_owner} applicantID=${applicantID} effectiveApplicantID=${effectiveApplicantID}`
		);

		const [customerCasesResult, standaloneCasesResult] = await Promise.allSettled([
			caseManagementService.getCasesByBusinessId(businessID, {
				...(effectiveApplicantID ? { applicantId: effectiveApplicantID } : {}),
				caseType: CASE_TYPE.ONBOARDING,
				customerId: customerID
			}),
			caseManagementService.getCasesByBusinessId(businessID, {
				...(effectiveApplicantID ? { applicantId: effectiveApplicantID } : {}),
				caseType: CASE_TYPE.ONBOARDING,
				customerId: null
			})
		]);
		const customerCases = customerCasesResult.status === "fulfilled" ? customerCasesResult.value : [];
		const standaloneCases = standaloneCasesResult.status === "fulfilled" ? standaloneCasesResult.value : [];

		if (customerCases?.[0]?.id) {
			logger.debug(
				`Customer case already exists for businessID=${businessID} caseID=${customerCases[0].id} - skipping new case creation`
			);
			onboardingCaseID = customerCases[0].id as UUID;
		} else {
			// create a new case and send kafka events as side effects like business invite accept, case audit etc.

			// Validate one case for the invite
			let businessInvite: BusinessInvite.Record | undefined;
			if (inviteID) {
				try {
					businessInvite = await BusinessInvites.fromId(inviteID);
					if (businessInvite.business_id !== businessID) {
						throw new CaseManagementApiError(
							`Business invite ${inviteID} not valid for business ${businessID}`,
							StatusCodes.NOT_ACCEPTABLE,
							ERROR_CODES.INVALID
						);
					}
					if (businessInvite.case_id) {
						onboardingCaseID = businessInvite.case_id as UUID;
					}
					// As a side effect, create custom field values from the invite at the time of invite acceptance
					void onboarding.createBusinessCustomFieldValuesForInvite(inviteID).catch(_error => {
						/* swallow */
					});
				} catch (error) {
					logger.error({ error }, `Error getting business invite for inviteID=${inviteID}`);
					throw new CaseManagementApiError(
						`Business invite ${inviteID} not found`,
						StatusCodes.NOT_FOUND,
						ERROR_CODES.NOT_FOUND
					);
				}
			}
			if (!onboardingCaseID) {
				const { case_id } = await caseManagementService.createOnboardingOrCreatedCase(
					{ businessID, applicantID, inviteID, customerID, name, customerInitiated },
					userInfo
				);
				onboardingCaseID = case_id as UUID;
			}
		}

		// TODO: BEST-60 follow up: Remove this whole code block once standalone cases can go for good
		const shouldCreateStandaloneCase =
			customerID &&
			(await this.isStandaloneCaseEnabled(customerID)) &&
			effectiveApplicantID &&
			!standaloneCases?.[0]?.id;

		if (shouldCreateStandaloneCase) {
			// Create a standalone case only when we have a valid applicant (i.e. not a guest-owner flow)
			standaloneCaseID = await caseManagementService.createStandaloneCase(
				businessID,
				effectiveApplicantID,
				true,
				userInfo?.user_id
			);
		}
		return { onboardingCaseID, standaloneCaseID };
	}

	/**
	 * @deprecated
	 * Introduced in BEST-60 to help kill off standalone SMB Cases
	 * Should be removed once we no longer support SMB cases at all
	 * @param customerID
	 * @returns boolean: true if standalone case is enabled, false otherwise - should return false by default
	 */
	private async isStandaloneCaseEnabled(customerID?: UUID): Promise<boolean> {
		const defaultValue = false;
		try {
			return (
				(await getFlagValue(
					FEATURE_FLAGS.BEST_60_STANDALONE_CASE,
					customerID && {
						key: "customer",
						kind: "customer",
						customer_id: customerID
					}
				)) ?? defaultValue
			);
		} catch (error) {
			logger.warn(
				error,
				`Could not get standalone case enabled flag for customerID=${customerID}; defaulting to standalone case disabled (false)`
			);
		}
		return defaultValue;
	}

	/**
	 * @deprecated - BEST-60 kills off SMB Standalone case. Remove once no longer behind a feature flag
	 * Creates a standalone case for a business
	 * Private because it is only used by this class, entry point for this code is ensureCasesExist
	 * @param businessID - UUID of the business
	 * @param applicantID - UUID of the applicant
	 * @param doNotCreateDuplicate - (Default false) boolean to check if the standalone case already exists, if true then it will not create a new case and returns the existing case ID
	 * @param userID - UUID of the user that is creating the case (optional, if not provided then the applicantID will be used)
	 * @returns UUID of the standalone case created or found
	 */
	private async createStandaloneCase(
		businessID: UUID,
		applicantID: UUID,
		doNotCreateDuplicate?: boolean,
		userID?: UUID
	): Promise<UUID | undefined> {
		try {
			if (doNotCreateDuplicate === true) {
				const standaloneCase = await caseManagementService.getCasesByBusinessId(businessID, {
					applicantId: applicantID,
					caseType: CASE_TYPE.ONBOARDING,
					customerId: null,
					limit: 1
				});
				if (standaloneCase?.[0]?.id) {
					return standaloneCase[0].id as UUID;
				}
			}
			const newStandaloneCase = await caseManagementService.createCaseFromEgg({
				applicant_id: applicantID,
				business_id: businessID,
				status: CASE_STATUS.ONBOARDING,
				updated_by: userID ?? applicantID,
				created_by: userID ?? applicantID,
				case_type: CASE_TYPE.ONBOARDING
			});
			const businessAcceptMessage = {
				case_id: newStandaloneCase.id,
				business_id: businessID,
				applicant_id: applicantID
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
			return newStandaloneCase.id as UUID;
		} catch (error) {
			logger.error({ error }, `Error creating standalone case for businessID=${businessID}`);
		}
	}

	/**
	 * This function creates an onboarding case for a business
	 * Private because it is only used by this class, entry point for this code is ensureCasesExist
	 * @param body {businessID, customerID, userID, inviteID, placeID, name}
	 * @param userInfo {user_id, given_name, family_name, email}
	 * @returns {case_id, business_id}
	 */
	private async createOnboardingOrCreatedCase(
		body: {
			businessID: UUID;
			customerID: UUID | null;
			applicantID: UUID;
			inviteID?: UUID;
			name?: string;
			customerInitiated?: boolean;
		},
		userInfo?: { user_id: UUID; given_name?: string; family_name?: string; email?: string }
	): Promise<{ case_id: string; business_id: string }> {
		const { businessID, customerID, applicantID, inviteID, customerInitiated } = body;

		const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
			key: "customer",
			kind: "customer",
			customer_id: customerID
		});
		const userID = userInfo?.user_id ?? applicantID;
		// create case and send audit log of case created
		const { id: caseId } = await caseManagementService.createCaseFromEgg({
			applicant_id: applicantID,
			customer_id: customerID as string,
			business_id: businessID,
			status: shouldPauseTransition && customerInitiated ? CASE_STATUS.CREATED : CASE_STATUS.ONBOARDING,
			updated_by: userID,
			created_by: userID,
			case_type: CASE_TYPE.ONBOARDING,
			customer_initiated: !!customerInitiated
		});

		if (inviteID) {
			try {
				await BusinessInvites.updateInvite(inviteID, {
					case_id: caseId as UUID,
					updated_by: userID,
					status: BusinessInvite.status.ACCEPTED
				});
			} catch (ex) {
				logger.error({ error: ex }, `Error updating invite for inviteID=${inviteID} caseID=${caseId}`);
			}
		}

		// event to integration service for creating connection, tasks and score trigger for a business & case
		let businessAcceptMessage = {
			case_id: caseId,
			business_id: businessID,
			...(customerID && { customer_id: customerID }),
			applicant_id: applicantID
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
		// create stripe customer kafka event
		if (userInfo && userInfo.given_name && userInfo.family_name && userInfo.email) {
			const stripeCustomerMessage = {
				case_id: caseId,
				business_id: businessID,
				business_name: body.name,
				...(customerID && { customer_id: customerID }),
				applicant_id: applicantID,
				name: `${userInfo.given_name} ${userInfo.family_name}`,
				email: userInfo.email
			};

			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.CREATE_STRIPE_CUSTOMER,
							...stripeCustomerMessage
						}
					}
				]
			});
		} else {
			logger.warn(
				`Stripe customer message not sent because incomplete userinfo is present userInfo=${JSON.stringify(
					userInfo ?? {}
				)} businessId=${businessID}`
			);
		}
		return {
			case_id: caseId,
			business_id: businessID
		};
	}

	/**
	 * @params {object} params
	 * @returns {object}
	 * This function returns a case by its ID
	 */
	async getCaseByID(params, headers, userInfo) {
		try {
			const hasPIIPermission: boolean = await hasDataPermission(userInfo, CORE_PERMISSIONS.READ_PII_DATA);
			const hasSSNPermission: boolean = await hasDataPermission(userInfo, CORE_PERMISSIONS.READ_SSN_DATA, false);

			// Applicant ownership check - verify the applicant is associated with the case's business
			if (userInfo?.role?.code === ROLES.APPLICANT) {
				const getCaseByIDResult = await sqlQuery({
					sql: `SELECT data_cases.* FROM data_cases LEFT JOIN data_businesses db ON db.id = data_cases.business_id WHERE data_cases.id = $1 AND db.is_deleted = false`,
					values: [params.caseID]
				});

				const records = await getBusinessApplicants(getCaseByIDResult.rows[0].business_id);
				const applicants = records.map(applicant => applicant.id);

				if (!applicants.includes(userInfo.user_id)) {
					throw new CaseManagementApiError(
						"You are not allowed to access details of this case",
						StatusCodes.UNAUTHORIZED,
						ERROR_CODES.UNAUTHORIZED
					);
				}
			}

			let isStandaloneCase = false;

			if (!Object.hasOwn(params, "customerID")) {
				isStandaloneCase = true;
			}
			const getCaseByIDQuery = `SELECT json_build_object('data_cases', data_cases) as case_json ,  
			json_build_object('data_businesses', data_businesses,
						'naics_code', cnc.code,
						'naics_title', cnc.label,
						'mcc_code', cmc.code,
						'mcc_title', cmc.label) as business_json,
						json_build_object('industry_data', core_business_industries) as industry_json,
			json_build_object('data_owners', data_owners) as owners_json,
			json_build_object('rel_business_owners', rel_business_owners) as owners_percentage_json,
			core_case_statuses.code as status, core_case_statuses.label as label, ditp.is_complete as is_integration_complete
			FROM data_cases
			LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id
			LEFT JOIN core_mcc_code cmc ON cmc.id = data_businesses.mcc_id
			LEFT JOIN core_naics_code cnc ON cnc.id = data_businesses.naics_id
			LEFT JOIN rel_business_owners ON rel_business_owners.business_id = data_businesses.id
			LEFT JOIN data_owners ON data_owners.id = rel_business_owners.owner_id
			LEFT JOIN core_case_statuses on core_case_statuses.id = data_cases.status
			LEFT JOIN core_business_industries ON data_businesses.industry = core_business_industries.id
			LEFT JOIN data_integration_tasks_progress as ditp ON ditp.case_id = data_cases.id
			WHERE data_cases.id = $1 AND data_businesses.is_deleted = false`;

			const getCaseStatusQuery = `SELECT core_case_statuses.id, core_case_statuses.code as status, created_at, created_by 
			FROM data_case_status_history 
			LEFT JOIN core_case_statuses on core_case_statuses.id = data_case_status_history.status 	
			WHERE data_case_status_history.case_id = $1 ORDER BY created_at ASC`;

			const [getCaseByIDQueryResult, getCaseStatusQueryResult] = await sqlTransaction(
				[getCaseByIDQuery, getCaseStatusQuery],
				[[params.caseID], [params.caseID]]
			);
			if (!getCaseByIDQueryResult || !getCaseByIDQueryResult.rows || !getCaseByIDQueryResult.rows.length) {
				throw new CaseManagementApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const caseCustomerId = getCaseByIDQueryResult.rows[0].case_json.data_cases.customer_id;

			verifyCaseAccessByID(caseCustomerId, isStandaloneCase, params.customerID, userInfo, params.caseID);

			const titles = await Owners.getOwnerTitles();
			const userBody = {
				pagination: false,
				customer_needed: true,
				filter: {
					"data_users.id": getCaseByIDQueryResult.rows
						.map(item => {
							if (item.case_json.data_cases.assignee) {
								return [item.case_json.data_cases.applicant_id, item.case_json.data_cases.assignee];
							}
							return [item.case_json.data_cases.applicant_id];
						})
						.flat()
				}
			};

			let users = await getApplicants(userBody, headers.authorization);
			users = convertToObject(users, "id", ["first_name", "last_name", "created_at"]);

			// get application edit for ownership stage
			const businessId = getCaseByIDQueryResult.rows[0].business_json.data_businesses.id;
			let ownershipEditData: { metadata: any; field_name: string }[] = [];
			if (businessId) {
				ownershipEditData = await applicationEdit.getApplicationEdit(
					{ businessID: businessId },
					{
						stage_name: "ownership"
					}
				);
			}
			const checkSSNFlag = await getFlagValue(
				FEATURE_FLAGS.BEST_87_SSN_ENCRYPTION,
				params.customerID && {
					key: "customer",
					kind: "customer",
					customer_id: params.customerID
				}
			);
			const caseDetails = getCaseByIDQueryResult.rows.reduce((acc, item) => {
				if (!Object.hasOwn(acc, "id")) {
					acc = item.case_json.data_cases;
					acc.business = item?.business_json?.data_businesses ? item.business_json.data_businesses : {};
					if (item?.business_json?.data_businesses) {
						acc.business.naics_code = item.business_json.naics_code;
						acc.business.naics_title = item.business_json.naics_title;
						acc.business.mcc_code = item.business_json.mcc_code;
						acc.business.mcc_title = item.business_json.mcc_title;
					}
					acc.business.industry =
						Object.keys(acc.business).length && item?.industry_json?.industry_data
							? item.industry_json.industry_data
							: {};
					acc.applicant = {
						first_name: users[item.case_json.data_cases.applicant_id]?.first_name,
						last_name: users[item.case_json.data_cases.applicant_id]?.last_name,
						created_at: users[item.case_json.data_cases.applicant_id]?.created_at
					};
					acc.assignee = item.case_json.data_cases.assignee
						? {
								id: item.case_json.data_cases.assignee,
								first_name: users[item.case_json.data_cases.assignee]?.first_name,
								last_name: users[item.case_json.data_cases.assignee]?.last_name
							}
						: {};
					acc.owners = [];
					acc.status_history = getCaseStatusQueryResult.rows;
					acc.is_integration_complete = item.is_integration_complete;
					acc.status = { id: item.status, code: acc.status, label: item.label };

					if (Object.keys(acc.business).length && acc.business.tin !== null) {
						if (hasPIIPermission) {
							acc.business.tin = decryptEin(acc.business.tin);
							// masking of TIN is not for applicant as per product requirement
							if (userInfo?.role?.code !== ROLES.APPLICANT) {
								acc.business.tin = maskString(acc.business.tin);
							}
						} else {
							acc.business.tin = null;
						}
					}
				}
				if (item.owners_json.data_owners) {
					item.owners_json.data_owners.is_ssn_decryptable = false;
					if (item.owners_json.data_owners.ssn) {
						if (hasPIIPermission) {
							item.owners_json.data_owners.ssn = decryptEin(item.owners_json.data_owners.ssn);
							// masking of SSN for applicant only as per product requirement
							if (userInfo?.role?.code === ROLES.APPLICANT) {
								item.owners_json.data_owners.ssn = maskString(item.owners_json.data_owners.ssn);
							} else if (checkSSNFlag && hasSSNPermission) {
								// flag ON then mask first 5 digits
								item.owners_json.data_owners.ssn = maskString(item.owners_json.data_owners.ssn);
							} else {
								// flag OFF then mask full ssn
								item.owners_json.data_owners.ssn = maskString(item.owners_json.data_owners.ssn, 9);
							}
							item.owners_json.data_owners.is_ssn_decryptable = (checkSSNFlag && hasSSNPermission) ?? false;
						} else {
							item.owners_json.data_owners.ssn = null;
						}
					}
					item.owners_json.data_owners.external_id =
						item.owners_percentage_json?.rel_business_owners?.external_id ?? null;
					item.owners_json.data_owners.ownership_percentage =
						item.owners_percentage_json?.rel_business_owners?.ownership_percentage ?? null;
					item.owners_json.data_owners.owner_type =
						item.owners_percentage_json?.rel_business_owners?.owner_type ?? null;
					item.owners_json.data_owners.title = titles?.[item.owners_json.data_owners.title] ?? null;

					// check for customer edit
					if (ownershipEditData.length) {
						const editResult = ownershipEditData.filter(
							record => record.metadata.owner_id === item.owners_json.data_owners.id
						);
						if (editResult.length) {
							item.owners_json.data_owners["guest_owner_edits"] = editResult.map(record => record.field_name);
						}
					}
					acc.owners.push(item.owners_json.data_owners);
				}

				return acc;
			}, {});

			//fetch custom fields
			const getCustomFieldsQuery = `
			WITH latest AS (
				SELECT DISTINCT ON (dbcf.case_id, dbcf.field_id) dbcf.*
				FROM onboarding_schema.data_business_custom_fields dbcf
				LEFT JOIN data_businesses db ON db.id = dbcf.business_id
				WHERE dbcf.case_id = $1 AND db.is_deleted = false
				ORDER BY dbcf.case_id, dbcf.field_id, dbcf.created_at DESC, dbcf.id DESC
			)
			SELECT json_build_object(
				'id', dbcf.id,
				'field_id', dbcf.field_id,
				'fieldValue', dbcf.field_value,
				'businessId', dbcf.business_id,
				'fieldDetails', json_build_array(
					json_build_object(
						'label', dcf.label,
						'code', dcf.code,
						'isSensitive', dcf.is_sensitive,
						'applicantAccess', dcf.applicant_access,
						'customerAccess', dcf.customer_access,
						'property', dcf.property,
						'step_name', dcf.step_name,
						'sequence_number', dcf.sequence_number,
						'rules', dcf.rules,
						'conditionalLogic', dcf.conditional_logic,
						'field_options', field_options.options
					)
				),
				'createdBy', dbcf.created_by
			)
			FROM latest dbcf
			INNER JOIN onboarding_schema.data_custom_fields dcf
				ON dbcf.field_id = dcf.id
			LEFT JOIN LATERAL (
				SELECT json_agg(
					json_build_object(
						'label', dfo.label,
						'value', dfo.value,
						'checkbox_type', dfo.checkbox_type,
						'input_type', dfo.input_type,
						'icon', dfo.icon,
						'icon_position', dfo.icon_position
					)
				) AS options
				FROM onboarding_schema.data_field_options dfo
				WHERE dfo.field_id = dcf.id
			) AS field_options ON true`;

			let getCustomFieldsResult = await sqlQuery({ sql: getCustomFieldsQuery, values: [params.caseID] });

			const getCorePropertiesQuery = `SELECT id, code, label FROM onboarding_schema.core_field_properties`;
			const getCorePropertiesResult = await sqlQuery({ sql: getCorePropertiesQuery });

			if (getCustomFieldsResult.rows.length) {
				//get sorted custom fields based on order
				getCustomFieldsResult = await this.getCustomFieldsInOrder(caseDetails.customer_id, getCustomFieldsResult);
				let files: Array<{ fileName: string; businessId: string; label: string }> = [];
				//rules add conduction
				const processRules = rules => {
					const mergedRules: any = [];

					if (rules.required) {
						rules.required.forEach(() => {
							mergedRules.push({ rule: "required" });
						});
					}

					if (rules.properties) {
						Object.entries(rules.properties).forEach(([properties1]) => {
							let properties: any = properties1;
							if (properties.minimum) {
								mergedRules.push({ rule: "minimum", value: parseInt(properties.minimum) });
							}
							if (properties.maximum) {
								mergedRules.push({ rule: "maximum", value: parseInt(properties.maximum) });
							}
							if (properties.minLength) {
								mergedRules.push({ rule: "minLength", value: parseInt(properties.minLength) });
							}
							if (properties.maxLength) {
								mergedRules.push({ rule: "maxLength", value: parseInt(properties.maxLength) });
							}
							if (properties.default) {
								mergedRules.push({ rule: "default", value: properties.default });
							}
							if (properties.fileType) {
								mergedRules.push({ rule: "fileType", value: properties.fileType });
							}
							if (properties.maxFileSize) {
								mergedRules.push({ rule: "maxFileSize", value: properties.maxFileSize });
							}
							if (properties.decimalPlaces) {
								mergedRules.push({ rule: "decimalPlaces", value: properties.decimalPlaces });
							}
							if (properties.sum) {
								mergedRules.push({ rule: "sum", value: properties.sum });
							}
							if (properties.equal) {
								mergedRules.push({ rule: "equal", value: properties.equal });
							}
						});
					}

					return mergedRules.reduce((acc, rule) => {
						if (rule !== null) {
							acc.push(rule);
						}
						return acc;
					}, []);
				};
				// format custom fields result
				const userIds = new Set<UUID>();
				let customFieldsDetails: any = getCustomFieldsResult.rows.reduce((acc, row) => {
					const property = getCorePropertiesResult.rows.filter(coreProp => {
						return coreProp.id == row.json_build_object.fieldDetails[0]?.property;
					});
					const label = row.json_build_object.fieldDetails[0]?.label;
					const value = row.json_build_object.fieldValue;
					const createdBy = row.json_build_object.createdBy;
					if (createdBy) {
						userIds.add(createdBy);
					}
					if (property[0]?.code === "upload") {
						const fileName = row.json_build_object.fieldValue;
						files.push({
							fileName,
							businessId: row.json_build_object.businessId,
							label: row.json_build_object.fieldDetails[0]?.label
						});
						const existingLabelGroup = acc.find(group => group.label === label);
						if (!existingLabelGroup) {
							acc.push({
								id: row.json_build_object.id,
								type: "file",
								label: label,
								value: [],
								fileName: [],
								step_name: row.json_build_object.fieldDetails[0]?.step_name,
								sequence_number: row.sr_number,
								property: "upload",
								createdBy: createdBy
							});
						}
						return acc;
					}
					//get ruls in format
					const filteredConditionalLogicRuleList = (
						row.json_build_object.fieldDetails[0]?.conditionalLogic?.ruleList || []
					).filter(rule => rule !== null);
					let rulesData = processRules(row.json_build_object.fieldDetails[0]?.rules);
					rulesData = rulesData.concat(filteredConditionalLogicRuleList);
					const newRow: any = {
						id: row.json_build_object.field_id, // Use field_id (definition ID) as the primary identifier
						value_id: row.json_build_object.id, // Keep the value record ID separately
						label: label,
						is_sensitive: row.json_build_object.fieldDetails[0]?.isSensitive,
						internalName: row.json_build_object.fieldDetails[0]?.code,
						applicantAccess: row.json_build_object.fieldDetails[0]?.applicantAccess,
						customerAccess: row.json_build_object.fieldDetails[0]?.customerAccess,
						property: property[0]?.code,
						step_name: row.json_build_object.fieldDetails[0]?.step_name,
						sequence_number: row.sr_number,
						rules: rulesData,
						field_options: row.json_build_object.fieldDetails[0]?.field_options ?? null,
						createdBy
					};
					if (property[0]?.code === "dropdown") {
						// Dropdown values are normally stored as JSON objects (e.g. {"label":"...","value":"..."})
						// but overrides may store plain strings directly
						const isJsonObject = typeof value === "string" && value.trimStart().startsWith("{");
						newRow.value = isJsonObject ? (JSON.parse(value)?.label ?? value) : value;
					} else if (property[0]?.code === "boolean") {
						newRow.value = value ? (value.toLowerCase() === "true" ? "Yes" : "No") : value;
					} else if (property[0]?.code === "date") {
						newRow.value = toMDY(value) ?? value;
					} else {
						newRow.value = value;
					}
					acc.push(newRow);
					return acc;
				}, []);
				for (const file of files) {
					const s3File = await getCachedSignedUrl(
						file.fileName,
						`${DIRECTORIES.CUSTOM_FIELD_FILES}/businesses/${file.businessId}/cases/${params.caseID}`,
						BUCKETS.BACKEND
					);
					customFieldsDetails = customFieldsDetails.map(row => {
						if (row.type === "file" && row.label === file.label) {
							row.value.push(s3File.signedRequest);
							row.fileName.push(file.fileName);
						}
						return row;
					});
				}
				// Hydrate the createdBy field with user details
				if (userIds.size > 0) {
					try {
						const users = await getBulkUserInfo(userIds);
						customFieldsDetails = customFieldsDetails.map(row => {
							if (row.createdBy && users[row.createdBy]?.id) {
								row.user = pick(users[row.createdBy], ["id", "first_name", "last_name", "email"]);
								row.user.role = ROLE_ID_TO_ROLE[users[row.createdBy].role_id] ?? undefined;
							}
							return row;
						});
					} catch (_error) {
						logger.error({ error: _error }, "Error hydrating createdBy field with user details");
					}
				}
				caseDetails.custom_fields = customFieldsDetails;
			}

			const getAllBusinessNamesQuery = `SELECT data_business_names.name, data_business_names.is_primary FROM data_business_names
				LEFT JOIN data_businesses db ON db.id = data_business_names.business_id
				WHERE data_business_names.business_id = $1 AND db.is_deleted = false`;
			const getAllBusinessAddresses = `SELECT dba.line_1, dba.apartment, dba.city, dba.state, dba.country, dba.postal_code, dba.mobile, dba.is_primary
				FROM data_business_addresses dba
				LEFT JOIN data_businesses db ON db.id = dba.business_id
				WHERE dba.business_id = $1 AND db.is_deleted = false`;
			// Applicant aging query - to get the aging information based on applicant reminder config
			// This query fetches the first invite date, calculates days since invite, and matches against the resolved config to find the appropriate aging info
			// It considers business-level, customer-level, and default configs in that order
			// It also checks if the current case status is allowed for the reminder
			const getApplicantAging = `WITH case_info AS (
											SELECT
												dc.id AS case_id,
												dc.applicant_id,
												dc.business_id,
												dc.customer_id,
												dc.status,
												db.name AS business_name,
												(
													SELECT di.created_at
													FROM data_invites di
													WHERE di.case_id = dc.id
													ORDER BY di.created_at
													LIMIT 1
												) AS first_invite_created_at
											FROM data_cases dc
											LEFT JOIN data_businesses db ON db.id = dc.business_id
											WHERE dc.id = $1 AND dc.case_type = $2
										),

										resolved_config AS (
											SELECT
												ci.case_id,
												ci.applicant_id,
												ci.customer_id,
												ci.business_id,
												ci.status,
												ci.first_invite_created_at,

												CASE 
													WHEN EXISTS (
														SELECT 1
														FROM data_business_applicant_configs bac
														WHERE bac.business_id = ci.business_id
														AND bac.core_config_id = 1
														AND bac.is_enabled = true
													)
													THEN 'business'
													WHEN EXISTS (
														SELECT 1
														FROM data_customer_applicant_configs cac
														WHERE cac.customer_id = ci.customer_id
														AND cac.core_config_id = 1
														AND cac.is_enabled = true
													)
													THEN 'customer'
													ELSE NULL
												END AS config_source,

												COALESCE(
													(
														SELECT bac.config
														FROM data_business_applicant_configs bac
														WHERE bac.business_id = ci.business_id
														AND bac.core_config_id = 1
														AND bac.is_enabled = true
														LIMIT 1
													),
													(
														SELECT cac.config
														FROM data_customer_applicant_configs cac
														WHERE cac.customer_id = ci.customer_id
														AND cac.core_config_id = 1
														AND cac.is_enabled = true
														LIMIT 1
													)
												) AS config_json
											FROM case_info ci
										),

										expanded_config AS (
											SELECT 
												rc.*,
												elem AS config_elem
											FROM resolved_config rc
											CROSS JOIN LATERAL jsonb_array_elements(rc.config_json) elem
											WHERE rc.config_json IS NOT NULL
										),

										final_result AS (
											SELECT 
												jsonb_build_object(
													'urgency', dat.urgency,
													'days_since_invited',
														DATE_PART('day', NOW() - ec.first_invite_created_at)::int,
													'urgency_threshold_days', dat.threshold_days,
													'custom_message', ec.config_elem ->> 'message',
													'due_date',
														(ec.first_invite_created_at + (dat.threshold_days || ' days')::interval)::date,
													'config_source', ec.config_source,
													'tracker_updated_at', dat.updated_at
												) AS result
											FROM expanded_config ec
											JOIN data_applicants_threshold_reminder_tracker dat
												ON dat.case_id = ec.case_id
											AND dat.applicant_id = ec.applicant_id
											AND dat.customer_id = ec.customer_id
											AND dat.urgency = ec.config_elem->>'urgency'
											AND dat.threshold_days = (ec.config_elem ->> 'threshold')::int

											WHERE EXISTS (
												SELECT 1
												FROM jsonb_array_elements_text(ec.config_elem -> 'allowed_case_status') AS s(status_text)
												WHERE s.status_text::int = ec.status
											)

											ORDER BY dat.updated_at DESC
											LIMIT 1
										)

										SELECT result FROM final_result;
										`;
			const [getAllBusinessNamesResult, getAllBusinessAddressesResult, getApplicantAgingResult] = await sqlTransaction(
				[getAllBusinessNamesQuery, getAllBusinessAddresses, getApplicantAging],
				[[caseDetails.business_id], [caseDetails.business_id], [caseDetails.id, CASE_TYPE.ONBOARDING]]
			);
			caseDetails.business_names = getAllBusinessNamesResult.rows;
			caseDetails.business_addresses = getAllBusinessAddressesResult.rows;
			caseDetails.aging = getApplicantAgingResult?.rows[0]?.result ?? null;

			// get application edit for company stage
			const companyEditData = await applicationEdit.getApplicationEdit(
				{ businessID: caseDetails.business_id },
				{
					stage_name: "company"
				}
			);
			const companyEdit =
				Array.isArray(companyEditData) && companyEditData.length
					? [...new Set(companyEditData.map(record => record.field_name))]
					: undefined;

			// Calculate application progress if feature flag is enabled
			const isApplicationCompletionTrackingEnabled = await getFlagValue(
				FEATURE_FLAGS.DOS_948_TRACK_APPLICATION_COMPLETION,
				{
					key: "customer",
					kind: "customer",
					customer_id: caseDetails.customer_id
				}
			);

			let applicationProgress: { percent_complete: number; is_submitted: boolean; missing_details: string[] } | null =
				null;
			if (isApplicationCompletionTrackingEnabled) {
				if (caseDetails.customer_id && caseDetails.business_id && caseDetails.status?.code) {
					try {
						applicationProgress = await this.calculateApplicationProgress(
							caseDetails.id,
							caseDetails.business_id,
							caseDetails.customer_id,
							caseDetails.status.code,
							headers.authorization
						);
					} catch (error: any) {
						logger.warn(`Failed to calculate application progress for case ${caseDetails.id}: ${error.message}`);
					}
				}
			}

			// If businessId is present, we want to grab the merchantProfile if it exists
			// This is temporary until integration service can provide this data
			// If we don't have a businessId, we skip this step and its fine to return undefined
			// for the merchant profile per the AC of https://worth-ai.atlassian.net/browse/BEST-261
			let merchantProfile: any = undefined;
			if (caseDetails.business_id) {
				try {
					merchantProfile = await getMerchantProfileData(caseDetails.customer_id, caseDetails.business_id);
					logger.info(`Fetched merchant profile for business ${merchantProfile}`);
				} catch (error: any) {
					logger.error({ error }, `Failed to get merchant profile for business ${caseDetails.business_id}`);
				}
			}

			// Enrich the response with risk alerts if the case is generated from risk alert
			if (caseDetails?.status?.label == "DISMISSED") {
				return {
					...caseDetails,
					guest_owner_edits: companyEdit,
					...(applicationProgress
						? {
								application_progress: {
									percent_complete: applicationProgress.percent_complete,
									is_submitted: applicationProgress.is_submitted
								},
								missing_details: applicationProgress.missing_details
							}
						: {}),
					merchant_profile: merchantProfile
				};
			} else {
				const response = await riskAlert._enrichRiskCases([caseDetails]);
				return {
					...response[0],
					guest_owner_edits: companyEdit,
					...(applicationProgress
						? {
								application_progress: {
									percent_complete: applicationProgress.percent_complete,
									is_submitted: applicationProgress.is_submitted
								},
								missing_details: applicationProgress.missing_details
							}
						: {}),
					merchant_profile: merchantProfile
				};
			}
		} catch (error) {
			throw error;
		}
	}
	async getCustomFieldsInOrder(customerID, getCustomFieldsResult) {
		//function for add actual position of custom fields
		//SR is serial number
		if (getCustomFieldsResult.rows[0]?.json_build_object.fieldDetails[0]?.sequence_number > 0) {
			getCustomFieldsResult.rows = getCustomFieldsResult.rows.map(row => {
				row["sr_number"] = row.json_build_object.fieldDetails[0]?.sequence_number;
				return row;
			});
		} else {
			if (customerID) {
				let groupCustomFields = `SELECT dcf."label",dcf.step_name,ROW_NUMBER() OVER (ORDER BY dcf.template_id) AS sr_number
									FROM onboarding_schema.data_custom_templates dct
									join onboarding_schema.data_custom_fields dcf on dct.id =  dcf.template_id
									where dct.customer_id  = '${customerID}'`;
				const getGroupCustomFieldsResult = await sqlQuery({ sql: groupCustomFields });
				let customFieldsWithSR = {};
				getGroupCustomFieldsResult.rows.forEach(row => {
					customFieldsWithSR[row.label] = row.sr_number;
				});
				getCustomFieldsResult.rows = getCustomFieldsResult.rows.map(row => {
					row["sr_number"] = customFieldsWithSR[row.json_build_object.fieldDetails[0]?.label];
					return row;
				});
			}
		}
		getCustomFieldsResult.rows.sort((a, b) => a.sr_number - b.sr_number);
		return getCustomFieldsResult;
	}
	/**
	 * @params {object} params
	 * @returns {object}
	 * This function returns a case by its ID and it is used internally by integration service
	 */
	async internalGetCaseByID(
		params: { caseID: UUID },
		query: { include_custom_fields?: boolean } = {}
	): Promise<
		Case.Record & {
			business: Business.Record & { industry: Record<string, string> };
			owners: Business.Owner[];
			status: { id: string; code: string; label: string };
			status_history: Array<Record<string, string>>;
			active_decisioning_type: string;
			custom_fields?: Record<string, unknown>;
		}
	> {
		try {
			const getCaseByIDQuery = `SELECT json_build_object('data_cases', data_cases) as case_json ,  
			json_build_object('data_businesses', data_businesses,
							'naics_code', cnc.code,
							'naics_title', cnc.label,
							'mcc_code', cmc.code,
							'mcc_title', cmc.label) as business_json,
			json_build_object('industry_data', core_business_industries) as industry_json,
			json_build_object('data_owners', data_owners) as owners_json,
			json_build_object('rel_business_owners', rel_business_owners) as owners_percentage_json,
			core_case_statuses.code as status, core_case_statuses.label as label,
			COALESCE(dwc.active_decisioning_type, 'worth_score') as active_decisioning_type
			FROM data_cases
			LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id
			LEFT JOIN core_mcc_code cmc ON cmc.id = data_businesses.mcc_id
			LEFT JOIN core_naics_code cnc ON cnc.id = data_businesses.naics_id
			LEFT JOIN rel_business_owners ON rel_business_owners.business_id = data_businesses.id
			LEFT JOIN data_owners ON data_owners.id = rel_business_owners.owner_id
			LEFT JOIN core_case_statuses on core_case_statuses.id = data_cases.status
			LEFT JOIN core_business_industries ON data_businesses.industry = core_business_industries.id
			LEFT JOIN public.data_cases_decisioning_config dwc ON dwc.customer_id = data_cases.customer_id
			WHERE data_cases.id = $1 AND data_businesses.is_deleted = false`;

			const getCaseStatusQuery = `SELECT core_case_statuses.id, core_case_statuses.code as status, created_at, created_by 
			FROM data_case_status_history 
			LEFT JOIN core_case_statuses on core_case_statuses.id = data_case_status_history.status 	
			WHERE data_case_status_history.case_id = $1 ORDER BY created_at ASC`;

			const [getCaseByIDQueryResult, getCaseStatusQueryResult] = await sqlTransaction(
				[getCaseByIDQuery, getCaseStatusQuery],
				[[params.caseID], [params.caseID]]
			);
			if (!getCaseByIDQueryResult || !getCaseByIDQueryResult.rows) {
				throw new CaseManagementApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			const titles = await Owners.getOwnerTitles();

			const caseDetails = getCaseByIDQueryResult.rows.reduce((acc, item) => {
				if (!Object.hasOwn(acc, "id")) {
					acc = item.case_json.data_cases;
					acc.business = item?.business_json?.data_businesses ? item.business_json.data_businesses : {};
					if (item?.business_json?.data_businesses) {
						acc.business.naics_code = item.business_json.naics_code;
						acc.business.naics_title = item.business_json.naics_title;
						acc.business.mcc_code = item.business_json.mcc_code;
						acc.business.mcc_title = item.business_json.mcc_title;
					}
					acc.business.industry =
						Object.keys(acc.business).length && item?.industry_json?.industry_data
							? item.industry_json.industry_data
							: {};
					acc.owners = [];
					acc.status_history = getCaseStatusQueryResult.rows;
					acc.active_decisioning_type = item.active_decisioning_type || "worth_score";

					acc.status = { id: item.status, code: acc.status, label: item.label };
				}

				if (item.owners_json.data_owners) {
					item.owners_json.data_owners.external_id =
						item.owners_percentage_json?.rel_business_owners?.external_id ?? null;
					item.owners_json.data_owners.ownership_percentage =
						item.owners_percentage_json?.rel_business_owners?.ownership_percentage ?? null;
					item.owners_json.data_owners.owner_type =
						item.owners_percentage_json?.rel_business_owners?.owner_type ?? null;
					item.owners_json.data_owners.title = titles?.[item.owners_json.data_owners.title] ?? null;
					acc.owners.push(item.owners_json.data_owners);
				}

				return acc;
			}, {});

			if (query.include_custom_fields) {
				const enabledTemplate = await db("onboarding_schema.data_custom_templates")
					.where("customer_id", caseDetails.customer_id)
					.where("is_enabled", true)
					.orderBy("version", "desc")
					.first();

				if (!enabledTemplate) {
					logger.debug(
						`[internalGetCaseByID] No enabled template found for customer ${caseDetails.customer_id}, skipping custom fields`
					);
					caseDetails.custom_fields = {};
				} else {
					const getCustomFieldsQuery = `
					WITH latest AS (
						SELECT DISTINCT ON (dbcf.case_id, dbcf.field_id) dbcf.*
						FROM onboarding_schema.data_business_custom_fields dbcf
						LEFT JOIN data_businesses db ON db.id = dbcf.business_id
						WHERE dbcf.case_id = $1 
							AND db.is_deleted = false
							AND dbcf.template_id = $2
						ORDER BY dbcf.case_id, dbcf.field_id, dbcf.created_at DESC, dbcf.id DESC
					)
					SELECT 
						dcf.code as field,
						dbcf.field_value as value
					FROM latest dbcf
					LEFT JOIN onboarding_schema.data_custom_fields dcf ON dbcf.field_id = dcf.id
					WHERE dcf.template_id = $2`;

					const customFieldsResult = await sqlQuery({
						sql: getCustomFieldsQuery,
						values: [params.caseID, enabledTemplate.id]
					});

					const parseValue = (value: string): unknown => {
						if (value === null || value === undefined) return value;
						try {
							return JSON.parse(value);
						} catch {
							return value;
						}
					};

					caseDetails.custom_fields = customFieldsResult.rows.reduce(
						(acc, row) => {
							acc[row.field] = parseValue(row.value);
							return acc;
						},
						{} as Record<string, unknown>
					);
				}
			}

			return caseDetails;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @params {object} params
	 * @returns {object}
	 * This function returns a case by its IS
	 */
	async getStatuses() {
		try {
			const getStatusQuery = `SELECT * FROM core_case_statuses WHERE code NOT IN ('INVITED', 'INVITE_EXPIRED')`;

			const getStatusQueryResult = await sqlQuery({ sql: getStatusQuery });

			return getStatusQueryResult.rows;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @params {object} params
	 * @returns {object}
	 * This function returns all titles
	 */
	async getTitles(params?: { sort?: string | boolean }) {
		try {
			let getTitlesQuery;
			if (params && Object.hasOwn(params, "sort") && (params.sort === "true" || params.sort === true)) {
				getTitlesQuery = `SELECT * FROM core_owner_titles ORDER BY CASE WHEN title LIKE '[0-9]%' THEN 1 ELSE 0 END, title ASC;`;
			} else {
				getTitlesQuery = `SELECT * FROM core_owner_titles`;
			}

			const getTitlesQueryResult = await sqlQuery({ sql: getTitlesQuery });

			return getTitlesQueryResult.rows;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @params {object} params
	 * @returns {object}
	 * This function creates a case and a user in auth service
	 */
	async getCases(params, query, headers) {
		try {
			if (Object.hasOwn(query, "search")) {
				if (Object.hasOwn(query.search, "first_name") || Object.hasOwn(query.search, "last_name")) {
					const userBody = {
						pagination: false,
						search: { first_name: query.search.first_name, last_name: query.search.last_name }
					};
					const records = await getApplicants(userBody, headers.authorization);
					let userIDs = new Set();

					if (records) {
						records.forEach(item => {
							userIDs.add(item.id);
						});
						if (userIDs.size > 0) {
							query = {
								...query,
								search_filter: {
									applicant_id: [...userIDs]
								}
							};
						}
					}
				}

				const encryptedSearchableColumnsList = ["data_businesses.tin"];
				encryptedSearchableColumnsList.forEach(column => {
					if (Object.hasOwn(query.search, column)) {
						const normalizedSearchTerm = String(query.search[column]).trim().replace(/\s+/g, "");
						if (normalizedSearchTerm.length > 0 && normalizedSearchTerm.length <= 11)
							// max length of EIN
							query.search[column] = encryptEin(normalizedSearchTerm);
					}
				});
			}

			let pagination = true;

			if (Object.hasOwn(query, "pagination")) {
				pagination = JSON.parse(query.pagination);
			}

			let itemsPerPage, page;
			if (pagination) {
				itemsPerPage = 20;
				if (query.items_per_page) {
					itemsPerPage = query.items_per_page;
				}

				page = 1;
				if (query.page) {
					page = query.page;
				}
			}

			let queryParams = "";
			let subqueryParams = "";

			const allowedSortParams = ["data_businesses.name", "data_cases.created_at"];
			let sortParam = "data_cases.created_at";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
			}

			const allowedFilterParams = [
				"data_cases.id",
				"data_cases.status",
				"data_cases.applicant_id",
				"data_cases.business_id",
				"data_cases.case_type",
				"aging_threshold"
			];
			let existingFilterParamsValues: { column: string; value: any }[] = [];
			if (query.filter) {
				existingFilterParamsValues = Object.keys(query.filter).reduce((acc, field) => {
					if (allowedFilterParams.includes(field)) {
						let value;
						// parse string to boolean
						if (query.filter[field] === "true" || query.filter[field] === "false") {
							value = JSON.parse(query.filter[field]);
						}

						// reduce an array into a comma separated string
						if (Array.isArray(query.filter[field])) {
							value = query.filter[field].reduce((str, item) => {
								if (typeof item === "string") {
									str = str.concat(`'${item}'`, ",");
								} else {
									str = str.concat(`${item}`, ",");
								}
								return str;
							}, "");
							value = value.slice(0, -1); // remove the last comma
						} else if (typeof query.filter[field] === "string") {
							value = `'${query.filter[field]}'`;
						} else {
							value = query.filter[field].toString();
						}

						const filter = {
							column: field,
							value
						};
						acc.push(filter);
						return acc;
					}
					return acc;
				}, [] as any[]);
			}

			let useStrictSearchParams = false;
			const strictSearchParams = [];
			const supplementaryStrictSearchParams = [];

			// Make sure all search params columns are mentioned here
			const columnSearchBehavior = {
				"data_businesses.name": "contains",
				"data_cases.id::text": "contains",
				"data_business_names.name": "contains",
				"data_businesses.tin": "contains"
			};

			const searchableUUIDs = ["data_cases.id"];
			if (query.search) {
				Object.keys(query.search).forEach(field => {
					if (searchableUUIDs.includes(field)) {
						query.search = { ...query.search, [`${field}::text`]: query.search[field] };
					}
				});
			}

			const allowedSearchParams = [
				"data_businesses.name",
				"data_cases.id::text",
				"data_business_names.name",
				"data_businesses.tin"
			];
			let existingSearchParams: string[] = [];
			const existingSearchParamsValue = new Set();
			if (query.search) {
				existingSearchParams = Object.keys(query.search).filter(field => allowedSearchParams.includes(field));
				if (existingSearchParams.length) {
					existingSearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();

						if (query.search[field].includes(" ") && strictSearchParams.length) {
							useStrictSearchParams = true;
						}
						// Split the string on spaces and for each element of the split we trim the value and add those values into the set
						// Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						// >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}

						query.search[field].split(" ").forEach(val => {
							val = escapeRegExp(val.trim());
							if (val !== "" && val !== " ") {
								existingSearchParamsValue.add(val);
							}
						});
					});
				}
			}

			// SupplementarySearchParams works in conjunction with allowedSearchParams
			const allowedSupplementarySearchParams: any[] = [];

			let existingSupplementarySearchParams: string[] = [];
			const existingSupplementarySearchParamsValue = new Set();
			if (query.search) {
				existingSupplementarySearchParams = Object.keys(query.search).filter(field =>
					allowedSupplementarySearchParams.includes(field)
				);
				if (existingSupplementarySearchParams.length) {
					existingSupplementarySearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();
						// Split the string on spaces and for each element of the split we trim the value and add those values into the set
						// Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						// >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}

						query.search[field].split(" ").forEach(val => {
							val = escapeRegExp(val.trim());
							if (val !== "" && val !== " ") {
								existingSupplementarySearchParamsValue.add(val);
							}
						});
					});
				}
			}

			const allowedSearchFilterParams = ["applicant_id"];
			let existingSearchFilterParamsValues: any[] = [];
			if (query.search_filter) {
				existingSearchFilterParamsValues = Object.keys(query.search_filter).reduce((acc, field) => {
					if (allowedSearchFilterParams.includes(field)) {
						let value;

						// parse string to boolean
						if (query.search_filter[field] === "true" || query.search_filter[field] === "false") {
							value = JSON.parse(query.search_filter[field]);
						} else if (Array.isArray(query.search_filter[field])) {
							value = query.search_filter[field].reduce((str, item) => {
								if (typeof item === "string") {
									str = str.concat(`'${item}'`, ",");
								} else {
									str = str.concat(`${item}`, ",");
								}
								return str;
							}, "");
							value = value.slice(0, -1); // remove the last comma
						} else if (typeof query.search_filter[field] === "string") {
							value = `'${query.search_filter[field]}'`;
						} else {
							value = query.search_filter[field].toString();
						}

						const searchFilter = {
							column: field,
							value
						};
						acc.push(searchFilter);
						return acc;
					}
					return acc;
				}, [] as any[]);
			}

			const allowedFilterDateParams = ["data_cases.created_at"];
			let existingFilterDateParamsValues: any[] = [];
			if (query.filter_date) {
				existingFilterDateParamsValues = Object.keys(query.filter_date).reduce((acc, field) => {
					if (allowedFilterDateParams.includes(field)) {
						const filterDate = {
							column: field,
							value: query.filter_date[field].toString()
						};
						acc.push(filterDate);
						return acc;
					}
					return acc;
				}, [] as any[]);
			}

			// Configuration for columns that require EXISTS subqueries
			const subquerySearchConfig = {
				"data_business_names.name": {
					table: "data_business_names",
					alias: "dbn",
					joinCondition: "dbn.business_id = data_businesses.id",
					additionalConditions: "dbn.is_primary = false",
					searchColumn: "dbn.name"
				}
			};

			// Helper function to generate search conditions based on search behavior
			function generateSearchCondition(column, value, searchBehavior) {
				if (!value) return "";
				const escapedValue = value.replace(/'/g, "''"); // Escape single quotes for SQL safety
				const pattern = searchBehavior === "startsWith" ? `${escapedValue}%` : `%${escapedValue}%`;

				// Check if this column requires an EXISTS subquery
				const subqueryConfig = subquerySearchConfig[column];
				if (subqueryConfig) {
					const { table, alias, joinCondition, additionalConditions, searchColumn } = subqueryConfig;
					const conditions = [joinCondition, additionalConditions, `${searchColumn} ILIKE '${pattern}'`]
						.filter(Boolean)
						.join(" AND ");

					return `EXISTS (
						SELECT 1 FROM ${table} ${alias}
						WHERE ${conditions}
					)`;
				}
				return `${column} ILIKE '${pattern}'`;
			}

			let counter = 1;
			if (existingFilterParamsValues.length) {
				let filter = existingFilterParamsValues.filter(field => field.column != "aging_threshold").length
					? " AND "
					: "";
				counter++;
				filter += existingFilterParamsValues
					.filter(field => field.column != "aging_threshold")
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [] as any[])
					.join(" AND ");
				queryParams += filter;

				let subqueryFilterParams: any[];
				subqueryFilterParams = existingFilterParamsValues
					.filter(field => field.column === "aging_threshold")
					.reduce((acc, field) => {
						if (field.column === "aging_threshold") {
							acc.push(`${field.column} IN (${field.value})`);
						}
						return acc;
					}, [] as any[]);

				if (subqueryFilterParams.length) {
					subqueryParams = ` WHERE ${subqueryFilterParams.join(" AND ")}`;
				}
			}
			if (existingSearchFilterParamsValues.length) {
				let filter = "";
				if (counter === 0) {
					filter += " WHERE (";
					counter++;
				} else {
					filter += " AND (";
				}
				counter++;
				filter += existingSearchFilterParamsValues
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [])
					.join(" OR ");
				if (
					(existingSearchParams.length && [...existingSearchParamsValue].length) ||
					(existingSupplementarySearchParams.length && [...existingSupplementarySearchParamsValue].length)
				) {
					filter += " ";
				} else {
					filter += " )";
				}

				queryParams += filter;
			}
			if (
				(existingSearchParams.length && [...existingSearchParamsValue].length) ||
				(existingSupplementarySearchParams.length && [...existingSupplementarySearchParamsValue].length)
			) {
				let search = "";
				if (counter === 0) {
					search += " WHERE (";
					counter++;
				} else if (existingSearchFilterParamsValues.length) {
					search += " OR (";
				} else {
					search += " AND (";
				}

				search += existingSearchParams.length ? " ( " : "";
				if (useStrictSearchParams) {
					search += strictSearchParams
						.flatMap(field =>
							[...existingSearchParamsValue].map(value => {
								const searchBehavior = columnSearchBehavior[field];
								return generateSearchCondition(field, value, searchBehavior);
							})
						)
						.join(" OR ");
				} else {
					search += existingSearchParams
						.flatMap(field =>
							[...existingSearchParamsValue].map(value => {
								const searchBehavior = columnSearchBehavior[field];
								return generateSearchCondition(field, value, searchBehavior);
							})
						)
						.join(" OR ");
				}

				if (existingSupplementarySearchParams.length && [...existingSupplementarySearchParamsValue].length > 1) {
					search += existingSearchParams.length ? ") AND ( " : "";
					if (useStrictSearchParams) {
						search += supplementaryStrictSearchParams
							.flatMap(field =>
								[...existingSupplementarySearchParamsValue].map(value => {
									const searchBehavior = columnSearchBehavior[field];
									return generateSearchCondition(field, value, searchBehavior);
								})
							)
							.join(" OR ");
					} else {
						search += existingSupplementarySearchParams
							.flatMap(field =>
								[...existingSupplementarySearchParamsValue].map(value => {
									const searchBehavior = columnSearchBehavior[field];
									return generateSearchCondition(field, value, searchBehavior);
								})
							)
							.join(" OR ");
					}
				}
				search += existingSearchParams.length ? " ) " : "";

				search += " )";

				if (existingSearchFilterParamsValues.length) {
					search += " )";
				}

				queryParams += search;
			}

			if (existingFilterDateParamsValues.length && existingFilterDateParamsValues?.[0]?.value?.length !== 0) {
				let filterDate = " AND ";
				counter++;
				filterDate += existingFilterDateParamsValues
					.reduce((acc, field) => {
						const values = field.value.split(",");
						acc.push(`${field.column} >= '${values[0]}' AND ${field.column} <= '${values[1]}'`);
						return acc;
					}, [])
					.join(" AND ");
				queryParams += filterDate;
			}

			if (Object.hasOwn(query, "filter") && Object.hasOwn(query.filter, "data_cases.assignee")) {
				let assigneeQueryParam = "";
				let queryJoiner = "AND";
				if (query.filter["data_cases.assignee"].includes("unassigned")) {
					const index = query.filter["data_cases.assignee"].indexOf("unassigned");
					if (index !== -1) {
						query.filter["data_cases.assignee"].splice(index, 1);
					}
					assigneeQueryParam += " AND ( assignee IS NULL";
					queryJoiner = "OR";
				}
				if (query.filter["data_cases.assignee"].length) {
					assigneeQueryParam += ` ${queryJoiner} assignee IN (${query.filter["data_cases.assignee"]
						.map(assignee => `'${assignee}'`)
						.join(", ")})`;
				}

				assigneeQueryParam += queryJoiner === "OR" ? " )" : "";
				queryParams += assigneeQueryParam;
			}

			const sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
			queryParams += sort;

			let isStandalone, conditionalOperatorParams;
			if (Object.hasOwn(params, "customerID")) {
				isStandalone = false;
				conditionalOperatorParams = `= $1`;
			} else {
				isStandalone = true;
				conditionalOperatorParams = `IS NULL`;
			}

			let casesQuery = `SELECT subquery.* FROM
				(SELECT data_cases.id, data_cases.applicant_id, data_cases.created_at, data_cases.case_type,
					data_businesses.id as business_id,
					data_businesses.name as business_name,
					(SELECT dbn.name
						FROM data_business_names dbn
						WHERE dbn.business_id = data_businesses.id
						AND dbn.is_primary = false
						ORDER BY dbn.created_at ASC
						LIMIT 1) AS dba_name,
					(
						WITH config_with_source AS (
							SELECT config, config_source, priority
							FROM (
								SELECT bac.config, 'business' AS config_source, 1 AS priority
								FROM data_business_applicant_configs bac
								WHERE bac.business_id = data_cases.business_id
								AND bac.core_config_id = 1
								AND bac.is_enabled = true
								LIMIT 1
							) AS business_cfg
							UNION ALL
							SELECT config, config_source, priority
							FROM (
								SELECT cac.config, 'customer' AS config_source, 2 AS priority
								FROM data_customer_applicant_configs cac
								WHERE cac.customer_id = data_cases.customer_id
								AND cac.core_config_id = 1
								AND cac.is_enabled = true
								LIMIT 1
							) AS customer_cfg
							ORDER BY priority
							LIMIT 1
						),
						cfg AS (
							SELECT 
								jsonb_array_elements(cws.config) AS elem,
								cws.config_source
							FROM config_with_source cws
						)
						SELECT dat.urgency
						FROM data_applicants_threshold_reminder_tracker dat
						CROSS JOIN cfg
						WHERE dat.case_id = data_cases.id
						AND dat.applicant_id = data_cases.applicant_id
						AND dat.customer_id = data_cases.customer_id
						AND EXISTS (
							SELECT 1
							FROM jsonb_array_elements_text(cfg.elem -> 'allowed_case_status') AS s(status_text)
							WHERE s.status_text::int = data_cases.status
						)
						ORDER BY dat.updated_at DESC
						LIMIT 1
					) AS aging_threshold,
					(
						WITH config_with_source AS (
							SELECT config, config_source, priority
							FROM (
								SELECT bac.config, 'business' AS config_source, 1 AS priority
								FROM data_business_applicant_configs bac
								WHERE bac.business_id = data_cases.business_id
								AND bac.core_config_id = 1
								AND bac.is_enabled = true
								LIMIT 1
							) AS business_cfg
							UNION ALL
							SELECT config, config_source, priority
							FROM (
								SELECT cac.config, 'customer' AS config_source, 2 AS priority
								FROM data_customer_applicant_configs cac
								WHERE cac.customer_id = data_cases.customer_id
								AND cac.core_config_id = 1
								AND cac.is_enabled = true
								LIMIT 1
							) AS customer_cfg
							ORDER BY priority
							LIMIT 1
						),
						cfg AS (
							SELECT 
								jsonb_array_elements(cws.config) AS elem,
								cws.config_source
							FROM config_with_source cws
						)
						SELECT jsonb_build_object(
							'urgency', dat.urgency,
							'config_source', cfg.config_source
						)::jsonb
						FROM data_applicants_threshold_reminder_tracker dat
						CROSS JOIN cfg
						WHERE dat.case_id = data_cases.id
						AND dat.applicant_id = data_cases.applicant_id
						AND dat.customer_id = data_cases.customer_id
						AND dat.urgency = cfg.elem->>'urgency'
						AND dat.threshold_days = (cfg.elem ->> 'threshold')::int
						AND EXISTS (
							SELECT 1
							FROM jsonb_array_elements_text(cfg.elem -> 'allowed_case_status') AS s(status_text)
							WHERE s.status_text::int = data_cases.status
						)
						ORDER BY dat.updated_at DESC
						LIMIT 1
					) AS aging_threshold_config,
					core_case_statuses.id as status_id, core_case_statuses.code as status_code, core_case_statuses.label as status_label, data_cases.assignee,
										cnc.code as naics_code, cnc.label as naics_title, cmc.code as mcc_code, cmc.label as mcc_title, ditp.is_complete as is_integration_complete
					FROM data_cases
					LEFT JOIN core_case_statuses on core_case_statuses.id = data_cases.status
										LEFT JOIN core_case_types on core_case_types.id = data_cases.case_type
					LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id
										LEFT JOIN core_mcc_code cmc ON cmc.id = data_businesses.mcc_id
										LEFT JOIN core_naics_code cnc ON cnc.id = data_businesses.naics_id
					LEFT JOIN data_integration_tasks_progress as ditp ON ditp.case_id = data_cases.id
					WHERE data_businesses.is_deleted = false AND data_cases.customer_id ${conditionalOperatorParams} ${queryParams}) subquery ${subqueryParams}`;

			const countQuery = `SELECT COUNT(subquery.id) as totalcount FROM
				(SELECT data_cases.id, data_cases.applicant_id, data_cases.created_at, data_cases.case_type,
					data_businesses.name as business_name,
					(
						WITH cfg AS (
							SELECT 
								jsonb_array_elements(
									COALESCE (
										(
											SELECT bac.config
											FROM data_business_applicant_configs bac
											WHERE bac.business_id = data_cases.business_id
											AND bac.core_config_id = 1
											AND bac.is_enabled = true
											LIMIT 1
										),
										(
											SELECT cac.config
											FROM data_customer_applicant_configs cac
											WHERE cac.customer_id = data_cases.customer_id
											AND cac.core_config_id = 1
											AND cac.is_enabled = true
											AND NOT EXISTS (
													SELECT 1 
													FROM data_business_applicant_configs bac2
													WHERE bac2.business_id = data_cases.business_id
													AND bac2.core_config_id = 1
													AND bac2.is_enabled = true
											)
											LIMIT 1
										)
									)
								) AS elem
						)
						SELECT dat.urgency
						FROM data_applicants_threshold_reminder_tracker dat
						WHERE dat.case_id = data_cases.id
						AND dat.applicant_id = data_cases.applicant_id
						AND dat.customer_id = data_cases.customer_id
						AND EXISTS (
							SELECT 1
							FROM cfg,
								jsonb_array_elements_text(cfg.elem -> 'allowed_case_status') AS s(status_text)
							WHERE s.status_text::int = data_cases.status
						)
						ORDER BY dat.updated_at DESC
						LIMIT 1
					) AS aging_threshold,
					core_case_statuses.id as status_id, core_case_statuses.code as status_code, core_case_statuses.label as status_label
					FROM data_cases
					LEFT JOIN core_case_statuses on core_case_statuses.id = data_cases.status
										LEFT JOIN core_case_types on core_case_types.id = data_cases.case_type 
					LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id
					WHERE data_businesses.is_deleted = false AND data_cases.customer_id  ${conditionalOperatorParams} ${queryParams}) subquery ${subqueryParams}`;

			const countQueryResult = await sqlQuery({ sql: countQuery, values: isStandalone ? [] : [params.customerID] });

			const totalcount = parseInt(countQueryResult.rows[0].totalcount);
			if (!totalcount) {
				return {
					records: [],
					total_pages: 0,
					total_items: 0
				};
			}

			const totalUsers = totalcount;
			if (!pagination) {
				itemsPerPage = totalUsers;
			}

			const paginationDetails = paginate(totalUsers, itemsPerPage);

			if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
				throw new CaseManagementApiError("Page Requested is Out of Max Page Range", StatusCodes.BAD_REQUEST);
			}
			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				casesQuery += paginationQuery;
			}

			let result = await sqlQuery({ sql: casesQuery, values: isStandalone ? [] : [params.customerID] });

			const userBody = {
				pagination: false,
				customer_needed: true,
				filter: {
					"data_users.id": result.rows
						.map(item => {
							if (item.assignee) {
								return [item.applicant_id, item.assignee];
							}
							return [item.applicant_id];
						})
						.flat()
				}
			};

			let users = await getApplicants(userBody);
			users = convertToObject(users, "id", ["first_name", "last_name"]);

			let records = result.rows.map(row => {
				const dba = row.dba_name && row.dba_name.trim() !== "" ? row.dba_name.trim() : null;

				row = {
					...row,
					dba_name: dba,
					assignee: row.assignee
						? {
								id: row.assignee,
								first_name: users[row.assignee]?.first_name,
								last_name: users[row.assignee]?.last_name
							}
						: {},
					applicant:
						row.applicant_id && users[row.applicant_id]
							? { first_name: users[row.applicant_id]?.first_name, last_name: users[row.applicant_id]?.last_name }
							: {},
					status: { id: row.status_id, code: row.status_code, label: row.status_label }
				};
				delete row.status_id;
				delete row.status_code;

				return row;
			});

			records = await riskAlert._enrichRiskCases(records);
			records = await this._enrichReportStatus(records);

			if (Object.hasOwn(params, "customerID")) {
				records = await businesses._enrichRevenueAndAge(records);
			}

			return {
				records,
				total_pages: paginationDetails.totalPages,
				total_items: paginationDetails.totalItems
			};
		} catch (error) {
			throw error;
		}
	}
	/**
	 *
	 * @param body
	 * @returns report status of the case
	 */
	async _enrichReportStatus(body: any[]): Promise<any[]> {
		try {
			const caseIds: { id: UUID; status: string }[] = body.reduce((acc: any, row: any) => {
				acc.push({ id: row.id, status: row.status.code });
				return acc;
			}, []);

			const reportStatus = await getReportStatusForCase(caseIds);

			// extract all report Status ids
			const mappedReportStatusCases = reportStatus.reduce((acc: any, row: any) => {
				acc[row.id] = { status: row.status, report_id: row.report_id, created_at: row.created_at };
				return acc;
			}, {});

			// map the report Status with the body
			const enrichedCases = body.map(caseItem => {
				caseItem.report_status = mappedReportStatusCases[caseItem.id].status || null;
				caseItem.report_id = mappedReportStatusCases[caseItem.id].report_id || null;
				caseItem.report_created_at = mappedReportStatusCases[caseItem.id].created_at || null;
				return caseItem;
			});

			return enrichedCases;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @returns {Array} all core case types as an array of objects
	 */
	async getCaseTypes(query) {
		try {
			let pagination = true;

			if (Object.hasOwn(query, "pagination")) {
				pagination = JSON.parse(query.pagination);
			}

			let itemsPerPage, page;
			if (pagination) {
				itemsPerPage = 20;
				if (query.items_per_page) {
					itemsPerPage = query.items_per_page;
				}

				page = 1;
				if (query.page) {
					page = query.page;
				}
			}

			let getCaseTypesQuery = `SELECT * FROM core_case_types`;

			const countCaseTypes = `SELECT * FROM core_case_types`;

			const countCaseTypesResult = await sqlQuery({ sql: countCaseTypes });

			const totalCount = countCaseTypesResult.rowCount;
			if (!pagination) {
				itemsPerPage = totalCount;
			}

			const paginationDetails = paginate(totalCount, itemsPerPage);

			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				getCaseTypesQuery += paginationQuery;
			}

			const getCaseTypesQueryResult = await sqlQuery({ sql: getCaseTypesQuery });

			return {
				records: getCaseTypesQueryResult.rows,
				total_pages: paginationDetails.totalPages,
				total_items: paginationDetails.totalItems
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function updates the status of a case
	 * @param params.caseID {uuid}: ID of a case
	 * @param params.customerID {uuid}: ID of the customer
	 * @param body.status {string}: status enum to update the case to
	 * @param userInfo.user_id {uuid}: ID of the user making the request
	 * @param sendCaseAssignmentEmail {boolean}: flag to explicitly set whether to send case assignment email or not defaults to true
	 * @returns
	 */
	async updateCaseStatus(
		params: { caseID: string; customerID: string },
		body: { status: string; comment: string; assignee: string },
		userInfo: { user_id: string },
		headers: any,
		sendCaseAssignmentEmail = true
	) {
		try {
			const statuses = Object.values(CASE_STATUS_ENUM) as string[];
			if (!statuses.includes(body.status)) {
				throw new CaseManagementApiError("Invalid status", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const getCaseQuery = `SELECT data_cases.status, label, db.name as business_name, data_cases.business_id FROM data_cases 
			LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status 
			LEFT JOIN data_businesses db ON db.id = data_cases.business_id 
			WHERE data_cases.id = $1 AND customer_id = $2 AND db.is_deleted = false`;
			const getCaseQueryResult = await sqlQuery({ sql: getCaseQuery, values: [params.caseID, params.customerID] });

			if (!getCaseQueryResult.rowCount) {
				throw new CaseManagementApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const currentStatusId: number = getCaseQueryResult.rows[0].status;

			const currentStatus = Object.keys(CASE_STATUS).find(
				key => CASE_STATUS[key] === currentStatusId
			) as CASE_STATUS_ENUM;

			const targetStatus: string = body.status;

			const UPDATABLE_ONBOARDING_STATUSES = [
				CASE_STATUS_ENUM.AUTO_APPROVED,
				CASE_STATUS_ENUM.AUTO_REJECTED,
				CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
				CASE_STATUS_ENUM.ARCHIVED,
				CASE_STATUS_ENUM.SUBMITTED,
				CASE_STATUS_ENUM.MANUALLY_APPROVED,
				CASE_STATUS_ENUM.MANUALLY_REJECTED,
				CASE_STATUS_ENUM.SCORE_CALCULATED,
				CASE_STATUS_ENUM.PENDING_DECISION,
				CASE_STATUS_ENUM.INFORMATION_REQUESTED,
				CASE_STATUS_ENUM.INFORMATION_UPDATED
			];

			const UPDATABLE_RISK_STATUSES = [
				CASE_STATUS_ENUM.RISK_ALERT,
				CASE_STATUS_ENUM.INVESTIGATING,
				CASE_STATUS_ENUM.ESCALATED,
				CASE_STATUS_ENUM.PAUSED
			];

			const ONBOARDING_STATUS_TRANSITIONS = [
				CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
				CASE_STATUS_ENUM.INFORMATION_REQUESTED,
				CASE_STATUS_ENUM.MANUALLY_APPROVED,
				CASE_STATUS_ENUM.MANUALLY_REJECTED,
				CASE_STATUS_ENUM.ARCHIVED
			];

			const RISK_STATUS_TRANSITIONS = [
				CASE_STATUS_ENUM.RISK_ALERT,
				CASE_STATUS_ENUM.INVESTIGATING,
				CASE_STATUS_ENUM.ESCALATED,
				CASE_STATUS_ENUM.PAUSED,
				CASE_STATUS_ENUM.DISMISSED
			];

			const UPDATED_DECISIONING_STATUSES = [
				CASE_STATUS_ENUM.CREATED,
				CASE_STATUS_ENUM.INVITED,
				CASE_STATUS_ENUM.ONBOARDING
			];

			const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
				key: "customer",
				kind: "customer",
				customer_id: params.customerID
			});

			const allowedStatusesToBeTransformedFrom: string[] = [
				...UPDATABLE_ONBOARDING_STATUSES,
				...UPDATABLE_RISK_STATUSES,
				...(shouldPauseTransition ? UPDATED_DECISIONING_STATUSES : [])
			];
			if (!allowedStatusesToBeTransformedFrom.includes(currentStatus)) {
				throw new CaseManagementApiError(
					"Current case status cannot be updated manually.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			const isCurrentStatusOnboarding = UPDATABLE_ONBOARDING_STATUSES.includes(currentStatus);
			const isCurrentStatusRisk = UPDATABLE_RISK_STATUSES.includes(currentStatus);

			// allow status to be updated to itself, so that users can still update the assignee without changing the status
			// we can clean this up once we implement an endpoint to update the assignee independently of the status update
			const isStatusTransitionAllowed =
				(isCurrentStatusOnboarding &&
					(ONBOARDING_STATUS_TRANSITIONS.includes(targetStatus as CASE_STATUS_ENUM) ||
						currentStatus === targetStatus)) ||
				(isCurrentStatusRisk &&
					(RISK_STATUS_TRANSITIONS.includes(targetStatus as CASE_STATUS_ENUM) || currentStatus === targetStatus)) ||
				(shouldPauseTransition && UPDATED_DECISIONING_STATUSES.includes(targetStatus as CASE_STATUS_ENUM));

			if (!isStatusTransitionAllowed) {
				throw new CaseManagementApiError(
					`Case status cannot be updated to ${body.status}`,
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			let updateAssigneeQuery: string = "";
			if (Object.hasOwn(body, "assignee") && body.assignee) {
				updateAssigneeQuery = ` , assignee = '${body.assignee}', assigner = '${userInfo.user_id}'`;
			}

			// Update applicant_id when transitioning from CREATED status with feature flag enabled
			let updateApplicantQuery: string = "";
			if (
				shouldPauseTransition &&
				currentStatus === CASE_STATUS_ENUM.CREATED &&
				(targetStatus === CASE_STATUS_ENUM.INVITED || targetStatus === CASE_STATUS_ENUM.ONBOARDING)
			) {
				updateApplicantQuery = ` , applicant_id = '${userInfo.user_id}'`;
			}

			const updateCaseQuery = `UPDATE data_cases SET status = (SELECT id from core_case_statuses WHERE code = $1), updated_by = $2 ${updateAssigneeQuery}${updateApplicantQuery} WHERE id = $3`;
			const insertCaseHistoryQuery = `INSERT INTO data_case_status_history (case_id, status, created_by) VALUES ($1, (SELECT id from core_case_statuses WHERE code = $2), $3)`;

			await sqlTransaction(
				[updateCaseQuery, insertCaseHistoryQuery],
				[
					[body.status, userInfo.user_id, params.caseID],
					[params.caseID, body.status, userInfo.user_id]
				]
			);

			let auditMessage: any = {
				case_id: params.caseID,
				customer_user_id: userInfo.user_id,
				existing_case_status: getCaseQueryResult.rows[0].label,
				new_case_status: body.status
					.toLowerCase()
					.replace(/_/g, " ")
					.replace(/\b\w/g, char => char.toUpperCase()),
				business_id: getCaseQueryResult.rows[0].business_id
			};

			if (body.comment) {
				auditMessage["comment"] = body.comment;
			}

			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: getCaseQueryResult?.rows?.[0]?.business_id,
						value: {
							event: kafkaEvents.CASE_STATUS_UPDATED_BY_CUSTOMER_AUDIT,
							...auditMessage
						}
					}
				]
			});

			if (params.customerID) {
				// Send webhook event for case status update
				const webhookPayload = await caseManagementService.getCaseStatusUpdatedWebhookPayload(params.caseID as UUID);

				await sendWebhookEvent(params.customerID, WEBHOOK_EVENTS.CASE_STATUS_UPDATED, {
					...webhookPayload,
					status: body.status
				});
			}

			if (Object.hasOwn(body, "assignee") && body.assignee) {
				auditMessage = {
					case_id: params.caseID,
					assigneeUserID: body.assignee,
					assignerUserID: userInfo.user_id,
					business_id: getCaseQueryResult.rows[0].business_id
				};

				await producer.send({
					topic: kafkaTopics.NOTIFICATIONS,
					messages: [
						{
							key: getCaseQueryResult?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_ASSIGNED_AUDIT,
								...auditMessage
							}
						}
					]
				});
			}

			if (
				body.status == CASE_STATUS_ENUM.DISMISSED ||
				body.status == CASE_STATUS_ENUM.ARCHIVED ||
				!sendCaseAssignmentEmail
			) {
				return;
			}
			const getCaseByIDQuery = `SELECT data_cases.id, data_cases.business_id, data_cases.assigner, data_cases.assignee, data_businesses.id, data_businesses.name
				FROM data_cases
				LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id
				WHERE data_cases.id = $1 AND data_businesses.is_deleted = false`;

			const getCaseByIDQueryResult = await sqlQuery({ sql: getCaseByIDQuery, values: [params.caseID] });
			const item = getCaseByIDQueryResult.rows[0];
			const userBody = {
				pagination: false,
				customer_needed: true,
				filter: {
					"data_users.id": [userInfo.user_id, body.assignee]
				}
			};

			let users = await getApplicants(userBody, headers.authorization);
			users = convertToObject(users, "id", ["first_name", "last_name", "email"]);

			// Determine the email recipient
			const recipientEmail =
				users[item.assignee]?.email || users[item.assigner]?.email || users[userInfo.user_id]?.email;

			// Determine the email recipient
			const assigneeName =
				users[item.assignee]?.first_name || users[item.assigner]?.first_name || users[userInfo.user_id]?.first_name;

			// trigger kafka event to send email when case is assigned to assignee by assigner
			const message = {
				assigner_name: users[item.assigner]?.first_name,
				assignee_name: assigneeName,
				business_name: item?.name ? item.name : "",
				case_id: params.caseID,
				email: recipientEmail,
				user_id: item.assignee || item.assigner || userInfo.user_id
			};

			const payload = {
				topic: kafkaTopics.CASES,
				messages: [
					{
						key: item?.business_id,
						value: {
							event: kafkaEvents.CASE_ASSIGNMENT_UPDATED,
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

	async informationUpdate(params: { caseID: string }, userInfo: { user_id: UUID }) {
		try {
			// TODO: to check if info is really updated based on new progression config and if required documents are uploaded
			const getCaseQuery = `SELECT data_cases.status, label, data_cases.business_id, data_cases.customer_id FROM data_cases 
			LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status 
			LEFT JOIN data_businesses db ON db.id = data_cases.business_id
			WHERE data_cases.id = $1 AND db.is_deleted = false`;
			const getCaseQueryResult = await sqlQuery({ sql: getCaseQuery, values: [params.caseID] });

			if (!getCaseQueryResult.rowCount) {
				return new CaseManagementApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const allowedStatusesToBeTransformedFrom: number[] = [CASE_STATUS.INFORMATION_REQUESTED];
			if (!allowedStatusesToBeTransformedFrom.includes(getCaseQueryResult.rows[0].status)) {
				throw new CaseManagementApiError(
					"Case Status is not in the correct state to be updated manually.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const updateCaseQuery = `UPDATE data_cases SET status = (SELECT id from core_case_statuses WHERE code = $1), updated_by = $2 WHERE id = $3`;
			const insertCaseHistoryQuery = `INSERT INTO data_case_status_history (case_id, status, created_by) VALUES ($1, (SELECT id from core_case_statuses WHERE code = $2), $3)`;

			await sqlTransaction(
				[updateCaseQuery, insertCaseHistoryQuery],
				[
					[CASE_STATUS_ENUM.INFORMATION_UPDATED, userInfo.user_id, params.caseID],
					[params.caseID, CASE_STATUS_ENUM.INFORMATION_UPDATED, userInfo.user_id]
				]
			);
			const businessId = getCaseQueryResult.rows[0].business_id;

			// update case status for manual score service for scoring decisions
			const statusUpdatedMessage = {
				business_id: businessId,
				case_id: params.caseID,
				case_status: CASE_STATUS_ENUM.INFORMATION_UPDATED
			};
			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: businessId,
						value: {
							event: kafkaEvents.CASE_STATUS_UPDATED,
							...statusUpdatedMessage
						}
					}
				]
			});

			// Create an audit log
			const auditMessage = {
				case_id: params.caseID,
				applicant_user_id: userInfo.user_id,
				existing_case_status: getCaseQueryResult.rows[0].label,
				new_case_status: CASE_STATUS_ENUM.INFORMATION_UPDATED.toLowerCase()
					.replace(/_/g, " ")
					.replace(/\b\w/g, char => char.toUpperCase()),
				business_id: businessId
			};

			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: businessId,
						value: {
							event: kafkaEvents.CASE_STATUS_UPDATED_BY_APPLICANT,
							...auditMessage
						}
					}
				]
			});

			// send email notification to customer
			const customerId = getCaseQueryResult.rows[0].customer_id;
			const inviteLink = `${envConfig.CUSTOMER_ADMIN_FRONTEND_BASE_URL}/businesses/${businessId}/cases/${params.caseID}`;

			const getBusinessResult = await db("public.data_businesses")
				.select("*")
				.where({ id: businessId, is_deleted: false })
				.first();
			const message = {
				customer_id: customerId,
				business_name: getBusinessResult?.name,
				invite_link: inviteLink
			};

			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: businessId,
						value: {
							event: kafkaEvents.INFORMATION_UPDATED,
							...message
						}
					}
				]
			});

			const caseInfoRequestResult = await db("public.data_cases_info_requests")
				.select("*")
				.where({ case_id: params.caseID, status: CASE_INFO_REQUESTS.REQUESTED })
				.orderBy("created_at", "desc")
				.limit(1);
			if (caseInfoRequestResult.length) {
				const currentInfoRequest = caseInfoRequestResult[0];

				await db("public.data_cases_info_requests")
					.update({ status: CASE_INFO_REQUESTS.COMPLETED, updated_by: userInfo.user_id })
					.where({ id: currentInfoRequest.id });

				// Check if this info request was for banking or ownership stages and trigger GIACT verification
				await this._triggerGIACTVerification(params.caseID, businessId, currentInfoRequest.stages || []);
			}

			// trigger re-scoring as information has been updated
			await producer.send({
				topic: kafkaTopics.SCORES,
				messages: [
					{
						key: businessId,
						value: {
							event: kafkaEvents.RESCORE_CASE_EVENT,
							case_id: params.caseID,
							trigger_type: SCORE_TRIGGER.ONBOARDING_INVITE
						}
					}
				]
			});

			if (customerId) {
				// Send webhook event for case status update
				const webhookPayload = await caseManagementService.getCaseStatusUpdatedWebhookPayload(params.caseID as UUID);
				await sendWebhookEvent(customerId, WEBHOOK_EVENTS.CASE_STATUS_UPDATED, {
					...webhookPayload,
					status: CASE_STATUS_ENUM.INFORMATION_UPDATED
				});
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get the most recent cases for a business, optionally filtered by customerID and caseType and limited by limit
	 * @param businessId: businessID to get cases for
	 * @param filters :
	 * @param filters.customerId : id of a customer
	 * @param filters.caseType : type of a case
	 * @param filters.applicantId : id of an applicant
	 * @param filters.limit : limit of records to be fetched - defaults to 10
	 * @returns
	 */
	async getCasesByBusinessId(
		businessId: string | UUID,
		filters?: { customerId?: UUID | string | null; caseType?: CASE_TYPE; limit?: number; applicantId?: UUID | null }
	): Promise<Case.Record[]> {
		const DEFAULT_LIMIT = 10;
		// Default to only the last 10 records
		const limit =
			filters?.limit && isFinite(filters.limit) && Number.isInteger(filters.limit) ? filters.limit : DEFAULT_LIMIT;
		const query = db("data_cases")
			.join("data_businesses as db", "db.id", "data_cases.business_id")
			.select("data_cases.*")
			.where({ "data_cases.business_id": businessId, "db.is_deleted": false })
			.orderBy("data_cases.created_at", "desc")
			.limit(limit);
		if (filters) {
			// Use 'in' to check if the prop is provided -- we want to make sure we pass in null if provided
			if ("customerId" in filters && filters.customerId !== undefined) {
				query.andWhere("customer_id", filters.customerId);
			}
			if ("applicantId" in filters) {
				query.andWhere("applicant_id", filters.applicantId);
			}
			if (filters?.caseType) {
				query.andWhere("case_type", filters.caseType);
			}
		}
		return await query;
	}

	/**
	 * @description This function creates a standalone case after there is edit in application
	 * And silently creates customer cases with help of internal function
	 * @param {uuid} params.businessID: id of a business
	 * @param userInfo
	 * @returns Standalone case id
	 */
	async createCaseOnApplicationEdit(
		params: { businessID: string },
		body: {
			case_type: string;
			standalone_case_id: string;
			action: string;
			integration_category: string;
			integration_platform: string;
		},
		userInfo: { user_id: string }
	) {
		try {
			const businessID = params.businessID;
			const getBusinessQuery = `SELECT id, name FROM data_businesses WHERE id = $1`;
			const getBusinessResult = await sqlQuery({ sql: getBusinessQuery, values: [businessID] });

			if (!getBusinessResult.rowCount) {
				throw new CaseManagementApiError("Business Not Found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			if (Object.hasOwn(body, "case_type") && body.case_type === "customer_cases") {
				// internal helper function to create customer cases
				this.__createCustomerCasesOnApplicationEdit(
					params.businessID,
					{ ...body, business_name: getBusinessResult.rows[0].name },
					userInfo
				);

				return;
			}
			// Create standalone case
			const { id: caseID } = await caseManagementService.createCaseFromEgg({
				applicant_id: userInfo.user_id,
				business_id: businessID,
				status: CASE_STATUS.PENDING_DECISION,
				case_type: CASE_TYPE.APPLICATION_EDIT,
				created_by: userInfo.user_id,
				updated_by: userInfo.user_id
			});

			const auditMessage = {
				standalone_case_id: caseID,
				business_id: businessID,
				business_name: getBusinessResult.rows[0].name,
				integration_category: body.integration_category,
				integration_platform: body.integration_platform,
				action: body.action,
				applicant_id: userInfo.user_id
			};

			// Create an audit log
			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.APPLICATION_EDIT_AUDIT,
							...auditMessage
						}
					}
				]
			});

			return { standalone_case_id: caseID };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This internal function creates cases for all customers associated with business
	 * and after creating sends an kafka event to integration service to generate score triggers for this cases
	 * @param businessID : id of a business
	 * @param standaloneCaseID : id of a standalone case
	 * @param userInfo.user_id : id of an applicant
	 */
	async __createCustomerCasesOnApplicationEdit(
		businessID: string,
		body: {
			case_type: string;
			standalone_case_id: string;
			action: string;
			integration_category: string;
			integration_platform: string;
			business_name: string;
		},
		userInfo: { user_id: string }
	) {
		try {
			const getCustomersQuery = `SELECT customer_id FROM rel_business_customer_monitoring WHERE business_id = $1`;
			const getCustomersResult = await sqlQuery({ sql: getCustomersQuery, values: [businessID] });

			// no need to create cases if there are no customers
			if (!getCustomersResult.rowCount) {
				return;
			}

			const customerCaseIDs: string[] = [];

			const columns = [
				"id",
				"applicant_id",
				"business_id",
				"customer_id",
				"status",
				"case_type",
				"created_by",
				"updated_by"
			];
			const customerToCaseMapping = {};
			const rows = getCustomersResult.rows.reduce((acc, item) => {
				const caseID = uuid();
				customerCaseIDs.push(caseID);
				acc.push([
					caseID,
					userInfo.user_id,
					businessID,
					item.customer_id,
					CASE_STATUS.PENDING_DECISION,
					CASE_TYPE.APPLICATION_EDIT,
					userInfo.user_id,
					userInfo.user_id
				]);
				customerToCaseMapping[item.customer_id] = caseID;
				return acc;
			}, []);

			const insertCustomerCasesQuery = buildInsertQuery("data_cases", columns, rows);

			const caseHistoryRows = customerCaseIDs.map(customerCaseID => {
				return [customerCaseID, CASE_STATUS.PENDING_DECISION, userInfo.user_id];
			});

			const caseHistoryColumns = ["case_id", "status", "created_by"];

			const insertStatusHistoryQuery = buildInsertQuery(
				"data_case_status_history",
				caseHistoryColumns,
				caseHistoryRows
			);

			await sqlTransaction([insertCustomerCasesQuery, insertStatusHistoryQuery], [rows.flat(), caseHistoryRows.flat()]);

			// Trigger kafka event to create score triggers for the cases in INTEGRATION-SVC
			const message = {
				customer_case_ids: customerCaseIDs,
				standalone_case_id: body.standalone_case_id,
				business_id: businessID
			};

			const auditMessage = {
				customer_to_case_mapping: customerToCaseMapping,
				business_id: businessID,
				business_name: body.business_name,
				integration_category: body.integration_category,
				integration_platform: body.integration_platform,
				action: body.action,
				applicant_id: userInfo.user_id
			};

			let payload = {
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.LINK_SCORE_TRIGGERS,
							...message
						}
					}
				]
			};
			await producer.send(payload);

			// Create an audit log
			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.APPLICATION_EDIT_AUDIT,
							...auditMessage
						}
					}
				]
			});
			await producer.send(payload);
		} catch (error) {
			logger.error(JSON.stringify(error));
		}
	}

	/**
	 * @description This internal function returns the status for cases to generate report
	 * @param businessID : id of a business
	 * @param caseID : id of a case
	 * @param customerID : id of customer
	 */
	async getCaseStatusReportGeneration(body: { caseID?: string; businessID?: string; customerID?: string }) {
		try {
			let getCaseQuery = `SELECT data_cases.id AS case_id, core_case_statuses.code AS case_status, data_cases.business_id, data_businesses.status AS business_status 
				FROM data_cases 
				LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status 
				LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id AND data_businesses.is_deleted = false`;
			let values: string[] = [];

			if (body.caseID && !body.businessID) {
				getCaseQuery += ` WHERE data_cases.id = $1`;
				values.push(body.caseID);
				if (body.customerID) {
					getCaseQuery += ` AND data_cases.customer_id = $2`;
					values.push(body.customerID);
				}
			}

			if (body.businessID && !body.caseID) {
				getCaseQuery += ` WHERE data_cases.business_id = $1 ORDER BY data_cases.created_at DESC LIMIT 1`;
				values.push(body.businessID);
				if (body.customerID) {
					getCaseQuery = getCaseQuery.replace("ORDER BY", `AND data_cases.customer_id = $2 ORDER BY`);
					values.push(body.customerID);
				}
			}

			if (body.caseID && body.businessID) {
				getCaseQuery += ` WHERE data_cases.id = $1 AND data_cases.business_id = $2`;
				values.push(body.caseID, body.businessID);
				if (body.customerID) {
					getCaseQuery += ` AND data_cases.customer_id = $3`;
					values.push(body.customerID);
				}
			}

			const getCaseQueryResult = await sqlQuery({ sql: getCaseQuery, values });

			if (!getCaseQueryResult.rowCount) {
				return new CaseManagementApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			return getCaseQueryResult.rows;
		} catch (error) {
			logger.error(JSON.stringify(error));
		}
	}

	async requestAdditionalInfo(
		params: { caseID: UUID; customerID: UUID },
		body: {
			stages: Array<{ id: string; stage: string; label: string; priority_order: number }>;
			documents_required: boolean;
			subject: string;
			body: string;
			applicant: { first_name: string; last_name: string; email: string; mobile: string };
		},
		userInfo: { user_id: UUID }
	) {
		try {
			const existingCaseStatusResult = await db("public.data_cases").select("*").where({ id: params.caseID }).first();

			if (!existingCaseStatusResult) {
				throw new CaseManagementApiError("No such case found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const caseSubmitted = await db("data_case_status_history")
				.where("case_id", params.caseID)
				.andWhere("status", CASE_STATUS.SUBMITTED)
				.select("*")
				.first();
			if (!caseSubmitted) {
				throw new CaseManagementApiError(
					"The case has not been submitted yet",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if (
				![
					CASE_STATUS.UNDER_MANUAL_REVIEW,
					CASE_STATUS.INFORMATION_REQUESTED,
					CASE_STATUS.AUTO_APPROVED,
					CASE_STATUS.AUTO_REJECTED,
					CASE_STATUS.INFORMATION_UPDATED,
					CASE_STATUS.MANUALLY_APPROVED,
					CASE_STATUS.MANUALLY_REJECTED,
					CASE_STATUS.PENDING_DECISION,
					CASE_STATUS.SCORE_CALCULATED,
					CASE_STATUS.SUBMITTED
				].includes(existingCaseStatusResult.status)
			) {
				throw new CaseManagementApiError(
					"The case is not in correct status",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const businessID = existingCaseStatusResult.business_id;
			const getBusinessData = await db("public.data_businesses")
				.select("name")
				.where({ id: businessID, is_deleted: false })
				.first();

			if (body?.applicant) {
				const inviteBusinessPayload = {
					case_id: params.caseID,
					existing_business: {
						business_id: businessID,
						name: getBusinessData?.name,
						is_quick_add: true
					},
					new_applicants: [
						{
							first_name: body.applicant.first_name,
							last_name: body.applicant.last_name,
							email: body.applicant.email,
							mobile: body.applicant.mobile
						}
					]
				};

				await BusinessInvites.inviteBusiness(params.customerID, inviteBusinessPayload, userInfo, [], true, false);
			}

			// Get all applicants for the business
			const businessApplicants = (await getBusinessApplicants(businessID)) || [];
			const applicants = businessApplicants.filter(applicant => applicant.id !== envConfig.ENTERPRISE_APPLICANT_ID);
			if (!applicants.length) {
				throw new CaseManagementApiError("Could not find any applicants", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// insert the details of request in DB
			const insertInfoRequestValues = {
				case_id: params.caseID,
				customer_id: params.customerID,
				stages: [],
				progression_config: [],
				documents_required: body.documents_required,
				created_by: userInfo.user_id,
				updated_by: userInfo.user_id,
				status: "REQUESTED"
			};
			if (body.stages && body.stages.length) {
				// Fetch all valid stages
				const allStages = await onboarding.getAllStages(
					{ customerID: params.customerID as UUID },
					{ include_config: true }
				);

				const processedStages = this._processedProgressionConfigs(body.stages, allStages);

				insertInfoRequestValues.stages = processedStages.map(s => s.stage);
				insertInfoRequestValues.progression_config = processedStages;
			}
			const infoRequestResult = await db("public.data_cases_info_requests")
				.insert(insertInfoRequestValues)
				.returning("id");
			const infoRequest = Array.isArray(infoRequestResult) ? infoRequestResult[0] : infoRequestResult;

			// check for no login
			const customerConfig = await onboarding.getCustomerOnboardingStages(
				{ customerID: params.customerID },
				{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
				false
			);
			const loginWithEmailPasswordField = customerConfig
				?.find(row => row.stage.toLowerCase() == "login")
				?.config?.fields?.find(field => field.name.toLowerCase() == "Login with Email & Password".toLowerCase());

			const customerData = await getCustomerData(params.customerID);

			// add in data_invites
			const metadata = {
				subject: body.subject,
				body: body.body
			};
			const inviteResult = await db("public.data_invites")
				.insert({
					case_id: params.caseID,
					business_id: businessID,
					customer_id: params.customerID,
					status: INVITE_STATUS.INVITED,
					created_by: userInfo.user_id,
					updated_by: userInfo.user_id,
					action_taken_by: userInfo.user_id,
					metadata: metadata
				})
				.returning("id");
			const invite = Array.isArray(inviteResult) ? inviteResult[0] : inviteResult;

			// add in the invite id and info request id rel table
			await db("public.rel_invites_info_requests").insert({
				data_invite_id: invite?.id,
				data_info_request_id: infoRequest?.id
			});

			let linkApplicants: string[] = [];
			// create message for each applicant
			const messages = applicants.map(applicant => {
				const inviteToken = {
					user_id: applicant.id,
					subrole_id: applicant.subrole_id,
					applicant_id: applicant.id,
					applicant_name: `${applicant.first_name} ${applicant.last_name}`,
					email: applicant.email,
					first_name: applicant.first_name,
					last_name: applicant.last_name,
					invitation_id: invite?.id,
					business_id: businessID,
					case: "onboard_applicant_by_customer",
					iat: Date.now(),
					exp: Date.now() + tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS * 1000,
					customer_id: params.customerID,
					is_no_login: loginWithEmailPasswordField ? !loginWithEmailPasswordField?.status : false
				};

				const inviteLink = `verify/invite?token=${encodeURIComponent(
					jwtSign(encryptData(inviteToken))
				)}&first_name=${encodeURIComponent(applicant.first_name)}&last_name=${encodeURIComponent(
					applicant.last_name
				)}&business_id=${encodeURIComponent(businessID)}&case_id=${encodeURIComponent(
					params.caseID
				)}&customer_name=${encodeURIComponent(customerData?.company_details?.name)}&business_name=${encodeURIComponent(
					getBusinessData?.name
				)}`;

				linkApplicants.push(applicant.id);

				return {
					key: businessID,
					value: {
						event: kafkaEvents.ADDITIONAL_INFORMATION_REQUEST_NOTIFICATION,
						customer_id: params.customerID,
						applicant_id: applicant.id,
						stage_name: body.stages.map(stage => stage.stage).join(", "),
						email: applicant.email,
						case_id: params.caseID,
						business_id: businessID,
						subject: body.subject,
						body: body.body,
						invite_link: inviteLink
					}
				};
			});

			const payload = {
				topic: kafkaTopics.NOTIFICATIONS,
				messages
			};
			// send email to applicants
			await producer.send(payload);

			// information requested audit trail
			const auditTrailPayload = {
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.INFORMATION_REQUESTED_AUDIT,
							case_id: params.caseID,
							customer_id: params.customerID,
							business_id: businessID,
							applicant_names: applicants.map(applicant => `${applicant.first_name} ${applicant.last_name}`).join(", ")
						}
					}
				]
			};
			await producer.send(auditTrailPayload);

			const linkInvitePayload = {
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.LINK_INVITEES,
							applicants: linkApplicants,
							invitation_id: invite?.id
						}
					}
				]
			};
			await producer.send(linkInvitePayload);

			await this.updateCaseStatus(
				{ caseID: params.caseID, customerID: params.customerID },
				{ status: CASE_STATUS_ENUM.INFORMATION_REQUESTED, comment: "", assignee: "" },
				userInfo,
				{},
				false
			);

			// update case status for manual score service for scoring decisions
			const statusUpdatedMessage = {
				business_id: businessID,
				case_id: params.caseID,
				case_status: CASE_STATUS_ENUM.INFORMATION_REQUESTED
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

			// Send webhook event for case status update
			const webhookPayload = await caseManagementService.getCaseStatusUpdatedWebhookPayload(params.caseID as UUID);
			await sendWebhookEvent(params.customerID, WEBHOOK_EVENTS.CASE_STATUS_UPDATED, {
				...webhookPayload,
				status: CASE_STATUS_ENUM.INFORMATION_REQUESTED
			});
		} catch (error) {
			logger.error({ error }, `Error processing info request for caseID: ${params.caseID}`);
			throw error;
		}
	}

	_processedProgressionConfigs(stages, allStages) {
		// This function processes the given stages and transforms them into a format that can be used as progressionConfig

		// Validate and filter valid stages
		const validStages = stages.map(stage => allStages.find(s => s.stage === stage.stage)).filter(Boolean);

		if (!validStages.length) {
			throw new CaseManagementApiError("Invalid stages provided", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		validStages.sort((a, b) => a.priority_order - b.priority_order);

		// Assign prev_stage, next_stage, and update required fields
		for (let i = 0; i < validStages.length; i++) {
			validStages[i].prev_stage = i > 0 ? validStages[i - 1].id : null;
			validStages[i].next_stage = i < validStages.length - 1 ? validStages[i + 1].id : null;

			validStages[i].is_skippable = false;
			validStages[i].is_enabled = true;
			validStages[i].isComplete = false;

			const stage = allStages.find(s => s.id === validStages[i].id);
			validStages[i].priority_order = stage.priority_order;
			validStages[i].config = stage.config;

			validStages[i].allow_back_nav = i === 0 ? false : true;
		}

		return validStages;
	}

	async getInformationRequest(params: { caseID: UUID }) {
		const [additionalInfoRequest, additionalInfoInvite] = await Promise.all([
			db("public.data_cases_info_requests")
				.select("data_cases_info_requests.*")
				.where({ case_id: params.caseID })
				.orderBy("created_at", "desc")
				.limit(1),
			db("public.data_invites")
				.leftJoin("data_businesses as db", "db.id", "data_invites.business_id")
				.select("data_invites.*")
				.where({ "data_invites.case_id": params.caseID })
				.andWhere({ "db.is_deleted": false })
				.whereNotNull("data_invites.metadata")
				.orderBy("public.data_invites.created_at", "desc")
				.limit(1)
		]);

		if (!additionalInfoRequest.length) {
			throw new CaseManagementApiError("No data found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		const result = Object.assign({}, additionalInfoRequest[0], { invite: additionalInfoInvite?.[0] });
		return result;
	}

	/**
	 * Handles the upload of additional documents for a specific case.
	 *
	 * @param params - An object containing the following properties:
	 *   @param params.customerID - The unique identifier of the customer.
	 *   @param params.caseID - The unique identifier of the case.
	 * @param files - The files object representing the additional document to be uploaded.
	 * @param userInfo - Information about the user performing the upload operation.
	 */
	async uploadAdditionalDocuments(
		params: { customerID: UUID; caseID: UUID },
		files: Express.Multer.File[],
		userInfo: { user_id: UUID }
	) {
		try {
			const caseResult = await db("public.data_cases").select("*").where({ id: params.caseID }).first();
			if (!caseResult) {
				throw new CaseManagementApiError("No such case found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			if (
				![
					CASE_STATUS.UNDER_MANUAL_REVIEW,
					CASE_STATUS.MANUALLY_APPROVED,
					CASE_STATUS.AUTO_APPROVED,
					CASE_STATUS.SCORE_CALCULATED,
					CASE_STATUS.ARCHIVED,
					CASE_STATUS.PENDING_DECISION,
					CASE_STATUS.SUBMITTED,
					CASE_STATUS.AUTO_REJECTED,
					CASE_STATUS.INFORMATION_REQUESTED,
					CASE_STATUS.INFORMATION_UPDATED
				].includes(caseResult.status)
			) {
				throw new CaseManagementApiError(
					"The case is not in correct status",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if ([CASE_STATUS.INFORMATION_REQUESTED, CASE_STATUS.INFORMATION_UPDATED].includes(caseResult.status)) {
				const caseInfoRequestResult = await db("public.data_cases_info_requests")
					.select("*")
					.where({ case_id: params.caseID })
					.first();
				if (!caseInfoRequestResult) {
					throw new CaseManagementApiError(
						"No additional document requested for this case",
						StatusCodes.NOT_FOUND,
						ERROR_CODES.NOT_FOUND
					);
				}

				await this._uploadAdditionalDocuments(params, files, caseInfoRequestResult.id);

				if (caseResult.status === CASE_STATUS.INFORMATION_REQUESTED) {
					await this.informationUpdate({ caseID: params.caseID }, userInfo);
				} else if (caseResult.status === CASE_STATUS.INFORMATION_UPDATED) {
					// Check if this info request was for banking or ownership stages and trigger GIACT verification
					await this._triggerGIACTVerification(
						params.caseID,
						caseResult.business_id,
						caseInfoRequestResult.stages || []
					);
				}

				await db("public.data_cases_info_requests")
					.update({ status: CASE_INFO_REQUESTS.COMPLETED, updated_by: userInfo.user_id })
					.where({ id: caseInfoRequestResult.id });
			} else {
				await this._uploadAdditionalDocuments(params, files, null);
			}
		} catch (error: any) {
			throw error;
		}
	}

	// Helper method to trigger GIACT verification when banking or ownership info request is completed
	private async _triggerGIACTVerification(
		caseID: string,
		businessId: string,
		requestedStages: string[]
	): Promise<void> {
		const isBankingRequested = requestedStages.includes("banking");
		const isOwnershipRequested = requestedStages.includes("ownership");

		// Only trigger GIACT verification if banking or ownership was requested
		if (isBankingRequested || isOwnershipRequested) {
			try {
				const completedStages: string[] = [];
				if (isBankingRequested) completedStages.push("banking");
				if (isOwnershipRequested) completedStages.push("ownership");

				logger.info(
					`Information request for stage(s) ${completedStages.join(" and ")} marked complete. Triggering GIACT verification for case ${caseID}.`
				);

				// Trigger GIACT verification by sending CASE_SUBMITTED_EXECUTE_TASKS event
				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: businessId,
							value: {
								event: kafkaEvents.CASE_SUBMITTED_EXECUTE_TASKS,
								case_id: caseID,
								business_id: businessId
							}
						}
					]
				});
			} catch (error) {
				// Log error but don't fail the entire operation
				logger.error({ error }, `Error triggering GIACT verification for case ${caseID}`);
			}
		}
	}

	async _uploadAdditionalDocuments(
		params: { customerID: UUID; caseID: UUID },
		files: Express.Multer.File[],
		caseInfoRequestID: UUID | null
	) {
		try {
			for (const file of files) {
				const { buffer, originalname, mimetype } = file;
				const contentType = mimetype || "application/octet-stream";
				const timeStamp = Date.now().toString();
				const fileExtension = originalname.includes(".") ? originalname.split(".").pop() : "";
				const fileName = `${originalname.split(".")[0]}-${timeStamp}.${fileExtension}`;

				await uploadFile(
					buffer,
					fileName,
					contentType,
					`${DIRECTORIES.ADDITIONAL_DOCUMENTS}/customers/${params.customerID}/cases/${params.caseID}`,
					BUCKETS.BACKEND
				);

				await db("public.additional_document_uploads").insert({
					id: uuid(),
					case_id: params.caseID,
					case_info_request_id: caseInfoRequestID,
					document: fileName
				});
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Retrieves documents associated with a business and optionally filters by case ID.
	 *
	 * @param params - An object containing the following properties:
	 *   @param params.businessID - The unique identifier of the business.
	 * @param query - An optional object containing the following properties:
	 *   @param query.caseID - The unique identifier of the case to filter documents by.
	 * @returns An object containing arrays of custom fields, e-sign, and additional documents.
	 */
	async getDocuments(params: { businessID: UUID }, query: { caseID?: UUID }) {
		try {
			// Check if the business exists
			const businessExists = await db("public.data_businesses")
				.where({ id: params.businessID, is_deleted: false })
				.first();
			if (!businessExists) {
				throw new CaseManagementApiError("No such business found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// Initialize the documents object to store different types of documents
			const documents = {
				custom_fields: [] as Array<{ file_name: string; file_path: string; file: string }>,
				esign: [] as Array<{ file_name: string; file_path: string; file: string }>,
				other_documents: [] as Array<{ file_name: string; file_path: string; file: string }>
			};

			// Fetch custom fields documents
			const customFieldsDocumentsResult = await db("onboarding_schema.data_business_custom_fields as dbcf")
				.leftJoin("onboarding_schema.data_custom_fields as dcf", "dbcf.field_id", "dcf.id")
				.leftJoin("public.data_businesses as db", "db.id", "dbcf.business_id")
				.select("dbcf.business_id", "dbcf.case_id", "dbcf.field_value")
				.where("dbcf.business_id", params.businessID)
				.andWhere("dcf.property", FIELD_PROPERTY.UPLOAD)
				.andWhere("db.is_deleted", false)
				.modify(queryBuilder => {
					if (query?.caseID) {
						queryBuilder.andWhere("dbcf.case_id", query.caseID);
					}
				});

			// Map custom fields documents to include signed URLs
			documents.custom_fields = await Promise.all(
				customFieldsDocumentsResult.map(async document => {
					const s3File = await getCachedSignedUrl(
						document.field_value,
						`${DIRECTORIES.CUSTOM_FIELD_FILES}/businesses/${document.business_id}/cases/${document.case_id}`,
						BUCKETS.BACKEND
					);
					return {
						file_name: document.field_value,
						file_path: `${DIRECTORIES.CUSTOM_FIELD_FILES}/businesses/${document.business_id}/cases/${document.case_id}`,
						file: s3File
					};
				})
			);

			// Fetch e-sign documents
			const eSignDocumentsResult = await esign.getSignedDocuments(
				{ businessID: params.businessID },
				query?.caseID ? { case_id: query.caseID } : {}
			);

			// Map e-sign documents to include signed URLs
			documents.esign = await Promise.all(
				eSignDocumentsResult.map(async document => {
					const s3File = await getCachedSignedUrl(document.document_id, `signed_documents`, BUCKETS.ELECTRONIC_CONSENT);
					return {
						file_name: document.name,
						file_path: "",
						file: s3File as any
					};
				})
			);

			// Fetch additional documents
			const additionalDocumentsResult = await db("data_cases as dc")
				.join("additional_document_uploads as adu", "adu.case_id", "dc.id")
				.leftJoin("data_cases_info_requests as dcir", "dcir.case_id", "dc.id")
				.leftJoin("data_businesses as db", "db.id", "dc.business_id")
				.distinct("adu.document", "adu.case_id", "dc.customer_id")
				.where("dc.business_id", params.businessID)
				.modify(queryBuilder => {
					if (query?.caseID) {
						queryBuilder.andWhere("dc.id", query.caseID);
					}
				});

			// Map additional documents to include signed URLs
			documents.other_documents = await Promise.all(
				additionalDocumentsResult.map(async document => {
					const s3File = await getCachedSignedUrl(
						document.document,
						`${DIRECTORIES.ADDITIONAL_DOCUMENTS}/customers/${document.customer_id}/cases/${document.case_id}`,
						BUCKETS.BACKEND
					);
					return {
						file_name: document.document,
						file_path: `${DIRECTORIES.ADDITIONAL_DOCUMENTS}/customers/${document.customer_id}/cases/${document.case_id}`,
						file: s3File
					};
				})
			);

			// Return the aggregated documents
			return documents;
		} catch (error) {
			throw error;
		}
	}

	async reassignCase(
		params: { caseID: UUID; customerID: UUID },
		body: { assignee: UUID },
		userInfo: { user_id: UUID; customer_id: UUID },
		headers: any
	) {
		try {
			const getCaseQuery = `
			SELECT data_cases.status, data_cases.business_id, data_cases.assignee, data_businesses.name
			FROM data_cases 
			LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id
			WHERE data_cases.id = $1 
			AND data_cases.customer_id = $2 AND data_businesses.is_deleted = false`;
			const getCaseQueryResult = await sqlQuery({ sql: getCaseQuery, values: [params.caseID, params.customerID] });

			if (!getCaseQueryResult.rowCount) {
				throw new CaseManagementApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const currentStatusId: number = getCaseQueryResult.rows[0].status;

			const currentStatus = Object.keys(CASE_STATUS).find(
				key => CASE_STATUS[key] === currentStatusId
			) as CASE_STATUS_ENUM;

			const UPDATABLE_ONBOARDING_STATUSES = [
				CASE_STATUS_ENUM.ONBOARDING,
				CASE_STATUS_ENUM.AUTO_APPROVED,
				CASE_STATUS_ENUM.AUTO_REJECTED,
				CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
				CASE_STATUS_ENUM.ARCHIVED,
				CASE_STATUS_ENUM.SUBMITTED,
				CASE_STATUS_ENUM.MANUALLY_APPROVED,
				CASE_STATUS_ENUM.MANUALLY_REJECTED,
				CASE_STATUS_ENUM.SCORE_CALCULATED,
				CASE_STATUS_ENUM.PENDING_DECISION,
				CASE_STATUS_ENUM.INFORMATION_REQUESTED,
				CASE_STATUS_ENUM.INFORMATION_UPDATED
			];

			const UPDATABLE_RISK_STATUSES = [
				CASE_STATUS_ENUM.RISK_ALERT,
				CASE_STATUS_ENUM.INVESTIGATING,
				CASE_STATUS_ENUM.ESCALATED,
				CASE_STATUS_ENUM.PAUSED
			];

			const UPDATABLE_DECISIONING_STATUSES = [
				CASE_STATUS_ENUM.CREATED,
				CASE_STATUS_ENUM.INVITED,
				CASE_STATUS_ENUM.ONBOARDING
			];

			const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
				key: "customer",
				kind: "customer",
				customer_id: params.customerID
			});
			const allowedStatusesToBeTransformedFrom: string[] = [
				...UPDATABLE_ONBOARDING_STATUSES,
				...UPDATABLE_RISK_STATUSES,
				...(shouldPauseTransition ? UPDATABLE_DECISIONING_STATUSES : [])
			];

			if (!allowedStatusesToBeTransformedFrom.includes(currentStatus)) {
				throw new CaseManagementApiError(
					"Case cannot be reassigned from its current status. Please ensure the case is in a valid state before reassignment.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			let responseMessage = "";
			if (body.assignee && getCaseQueryResult.rows[0].assignee === body.assignee) {
				return {
					message: `Case is already assigned to this user.`
				};
			}

			const customerUsersData = await getCustomerUsers(
				{
					pagination: false,
					owner_required: true
				},
				{ customerID: params.customerID },
				headers.authorization
			);

			if (!customerUsersData.records.length) {
				throw new CaseManagementApiError(
					"No users found for this customer.",
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			}

			let customerUsers = customerUsersData.records;
			if (body.assignee) {
				const isValidAssignee = customerUsers.some(user => user.id === body.assignee);
				if (!isValidAssignee) {
					throw new CaseManagementApiError(
						"The selected assignee is not a valid user for this customer.",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}

			if (!body.assignee && !getCaseQueryResult.rows[0].assignee) {
				throw new CaseManagementApiError(
					"Assignee must be provided to proceed with case assignment.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const updateCaseQuery = `
				UPDATE data_cases 
				SET 
					assignee = $1,  
					assigner = $2,
					updated_by = $3 
				WHERE id = $4`;
			const insertCaseAssigneeHistoryQuery = `INSERT INTO data_case_assignee_history (case_id, existing_assignee, new_assignee, assigner) VALUES ($1, $2, $3, $4)`;

			await sqlTransaction(
				[updateCaseQuery, insertCaseAssigneeHistoryQuery],
				[
					[body.assignee, userInfo.user_id, userInfo.user_id, params.caseID],
					[params.caseID, getCaseQueryResult.rows[0].assignee, body.assignee, userInfo.user_id]
				]
			);

			customerUsers = convertToObject(customerUsers, "id", ["first_name", "last_name", "email"]);
			let auditMessage = {};
			let message = {};
			const assigner = customerUsers[userInfo.user_id];
			const existingAssignee = customerUsers[getCaseQueryResult.rows[0].assignee];
			const newAssignee = customerUsers[body.assignee];

			if (!body.assignee && getCaseQueryResult.rows[0].assignee) {
				auditMessage = {
					case_id: params.caseID,
					existing_assignee_id: getCaseQueryResult.rows[0].assignee,
					assigner_id: userInfo.user_id,
					business_id: getCaseQueryResult.rows[0].business_id
				};

				await producer.send({
					topic: kafkaTopics.NOTIFICATIONS,
					messages: [
						{
							key: getCaseQueryResult?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_UNASSIGNED_AUDIT,
								...auditMessage
							}
						}
					]
				});

				message = {
					case_id: params.caseID,
					customer_id: userInfo.customer_id,
					assigner_name: `${assigner?.first_name} ${assigner?.last_name}`,
					assignee_name: `${existingAssignee?.first_name} ${existingAssignee?.last_name}`,
					email: existingAssignee?.email
				};

				await producer.send({
					topic: kafkaTopics.CASES,
					messages: [
						{
							key: getCaseQueryResult?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_UNASSIGNED,
								...message
							}
						}
					]
				});

				responseMessage = `Case has been unassigned from ${existingAssignee?.first_name} ${existingAssignee?.last_name}.`;
			} else if (!getCaseQueryResult.rows[0].assignee) {
				auditMessage = {
					case_id: params.caseID,
					assigneeUserID: body.assignee,
					assignerUserID: userInfo.user_id,
					business_id: getCaseQueryResult.rows[0].business_id
				};

				await producer.send({
					topic: kafkaTopics.NOTIFICATIONS,
					messages: [
						{
							key: getCaseQueryResult?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_ASSIGNED_AUDIT,
								...auditMessage
							}
						}
					]
				});

				message = {
					case_id: params.caseID,
					user_id: userInfo.user_id,
					business_name: getCaseQueryResult.rows[0].name,
					assigner_name: `${assigner?.first_name} ${assigner?.last_name}`,
					assignee_name: `${newAssignee?.first_name} ${newAssignee?.last_name}`,
					email: newAssignee?.email
				};

				await producer.send({
					topic: kafkaTopics.CASES,
					messages: [
						{
							key: getCaseQueryResult?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_ASSIGNMENT_UPDATED,
								...message
							}
						}
					]
				});

				responseMessage = `Case has been assigned to ${newAssignee?.first_name} ${newAssignee?.last_name}.`;
			} else {
				auditMessage = {
					case_id: params.caseID,
					existing_assignee_id: getCaseQueryResult.rows[0].assignee,
					new_assignee_id: body.assignee,
					assigner_id: userInfo.user_id,
					business_id: getCaseQueryResult.rows[0].business_id
				};

				await producer.send({
					topic: kafkaTopics.NOTIFICATIONS,
					messages: [
						{
							key: getCaseQueryResult?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_REASSIGNED_AUDIT,
								...auditMessage
							}
						}
					]
				});

				message = {
					case_id: params.caseID,
					customer_id: userInfo.customer_id,
					assigner_name: `${assigner?.first_name} ${assigner?.last_name}`,
					existing_assignee: {
						name: `${existingAssignee?.first_name} ${existingAssignee?.last_name}`,
						email: existingAssignee?.email
					},
					new_assignee: {
						name: `${newAssignee?.first_name} ${newAssignee?.last_name}`,
						email: newAssignee?.email
					}
				};

				await producer.send({
					topic: kafkaTopics.CASES,
					messages: [
						{
							key: getCaseQueryResult?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_REASSIGNED,
								...message
							}
						}
					]
				});

				responseMessage = `Case has been reassigned from ${existingAssignee?.first_name} ${existingAssignee?.last_name} to ${newAssignee?.first_name} ${newAssignee?.last_name}.`;
			}

			return {
				message: responseMessage
			};
		} catch (error) {
			throw error;
		}
	}

	async getCaseDetailsExport(params: { customerID: UUID }) {
		const caseDetails = await getCaseDetailsExport(params.customerID);

		if (!caseDetails || !caseDetails.length) {
			throw new CaseManagementApiError("No cases data found for export", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const workbook = XLSX.utils.book_new();
		const entries: CaseDetailsExportEntry[] = [];
		caseDetails.forEach(item => {
			const entry: CaseDetailsExportEntry = {
				"Business ID": item.business_id,
				"Case ID": item.case_id,
				"Submission Date (UTC)": item.submission_date,
				"Invitation Date (UTC)": item.invitation_date,
				"Invited By": item.invited_by,
				"Business Legal Name": item.business_legal_name,
				"DBA Name": item.dba_name,
				MCC: item.mcc ?? "",
				MID: item.mid ?? "",
				"Risk Level": item.risk_level ?? "",
				"Transaction Size": item.transaction_size ?? "",
				"Monthly Volume": getStringValue(item.monthly_volume, "monthly_volume"),
				"Annual Volume": getStringValue(item.annual_volume, "annual_volume"),
				"Application Status": item.application_status,
				"Application Reason Code": item.application_reason_code ?? "",
				"Analyst Name": item.analyst_name ?? "",
				"Worth Score": item.worth_score ?? "",
				"Last Decision Date (UTC)": item.last_decision_date,
				"Onboarding Date/Time (UTC)": item.onboarding_date_time,
				"Auto Approval": item.auto_approval ? "Yes" : "No"
			};

			entries.push(entry);
		});

		const workSheet = XLSX.utils.json_to_sheet(entries);

		XLSX.utils.book_append_sheet(workbook, workSheet, "Sheet 1");
		const csvOutput = XLSX.write(workbook, { bookType: "csv", type: "string" });
		const fileType = "text/csv;charset=UTF-8";

		const buffer = Buffer.from(csvOutput, "utf-8");

		const fileName = `cases_customer_${params.customerID}_${new Date().toISOString()}.csv`;

		await uploadFile(
			buffer,
			fileName,
			fileType,
			`${DIRECTORIES.CASE_EXPORTS}/customers/${params.customerID}`,
			BUCKETS.BACKEND
		);

		const excelFile = await getCachedSignedUrl(
			fileName,
			`${DIRECTORIES.CASE_EXPORTS}/customers/${params.customerID}`,
			BUCKETS.BACKEND
		);

		const file = excelFile.signedRequest;

		return { file_path: file };
	}

	async decryptSSN(
		params: { caseID: UUID; customerID: UUID },
		query: { businessID: UUID; ownerID: UUID },
		userInfo: UserInfo
	) {
		if (userInfo?.role.code === ROLES.CUSTOMER) {
			const isFeatureFlagEnabled = await getFlagValue(FEATURE_FLAGS.BEST_87_SSN_ENCRYPTION, {
				key: "customer",
				kind: "customer",
				customer_id: params.customerID
			});
			const hasSSNPermission = await hasDataPermission(userInfo, CORE_PERMISSIONS.READ_SSN_DATA, false);
			if (!isFeatureFlagEnabled || !hasSSNPermission) {
				throw new CaseManagementApiError(
					"Decryption of SSN is not allowed",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.NOT_ALLOWED
				);
			}
		}
		const getSsnQuery = `SELECT data_owners.ssn as ssn
			FROM data_cases
			LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id
			LEFT JOIN rel_business_owners ON rel_business_owners.business_id = data_businesses.id
			LEFT JOIN data_owners ON data_owners.id = rel_business_owners.owner_id
			WHERE data_cases.id = $1 and data_cases.customer_id = $2
			AND data_businesses.id = $3
			AND data_owners.id = $4`;
		const getSsnQueryResult = await sqlQuery({
			sql: getSsnQuery,
			values: [params.caseID, params.customerID, query.businessID, query.ownerID]
		});

		if (!getSsnQueryResult.rowCount) {
			throw new CaseManagementApiError("SSN not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		const ssn = decryptEin(getSsnQueryResult.rows[0].ssn);
		await producer.send({
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [
				{
					key: query.businessID,
					value: {
						event: kafkaEvents.DECRYPT_FIELD_AUDIT,
						case_id: params.caseID,
						business_id: query.businessID,
						owner_id: query.ownerID,
						field_name: "SSN",
						user_id: userInfo.user_id,
						user_name: `${userInfo.given_name ?? ""} ${userInfo.family_name ?? ""}`.trim(),
						customer_id: params.customerID
					}
				}
			]
		});
		return { ssn };
	}

	async getBusinessNames(params: { businessID: UUID }) {
		const { businessID } = params;
		const businessNames = await db
			.select("name", "is_primary")
			.from("data_business_names")
			.where("business_id", businessID);
		return businessNames;
	}

	async getBusinessAddresses(params: { businessID: UUID }) {
		const { businessID } = params;
		const businessAddresses = await db
			.select("line_1", "apartment", "city", "state", "country", "postal_code", "mobile", "is_primary")
			.from("data_business_addresses")
			.where("business_id", businessID);

		return businessAddresses;
	}

	async getCustomFields(params: { businessID: UUID; caseID: UUID; customerID: UUID }): Promise<
		{
			value_id: string;
			customer_field_id: string;
			value: unknown;
			template_id: string;
			rules: unknown;
			field_code: string;
			type: string;
		}[]
	> {
		const { businessID, caseID, customerID } = params;
		const customFields = await db
			.with("latest", qb => {
				qb.distinctOn("dbcf.case_id", "dbcf.field_id")
					.select("dbcf.*")
					.from("onboarding_schema.data_business_custom_fields as dbcf")
					.leftJoin("data_businesses as db", "db.id", "dbcf.business_id")
					.where("dbcf.business_id", businessID)
					.where("dbcf.case_id", caseID)
					.where("db.is_deleted", false)
					.orderBy([
						{ column: "dbcf.case_id" },
						{ column: "dbcf.field_id" },
						{ column: "dbcf.created_at", order: "desc" },
						{ column: "dbcf.id", order: "desc" }
					]);
			})
			.select([
				"dbcf.id as value_id",
				"dbcf.field_id as customer_field_id",
				"dbcf.field_value as value",
				"dbcf.template_id",
				"dcf.rules",
				"dcf.code as field_code",
				"cfp.code as type"
			])
			.from("latest as dbcf")
			.leftJoin("onboarding_schema.data_custom_fields as dcf", "dbcf.field_id", "dcf.id")
			.leftJoin("onboarding_schema.core_field_properties as cfp", "dcf.property", "cfp.id")
			.leftJoin("onboarding_schema.data_custom_templates as dct", "dcf.template_id", "dct.id")
			.where("dct.customer_id", customerID)
			.where("dct.is_enabled", true);

		return customFields;
	}

	async getCaseStatusUpdatedWebhookPayload(caseID: UUID) {
		const caseData = await db("public.data_cases")
			.select(
				"data_cases.id as case_id",
				"core_case_statuses.code as status",
				"data_businesses.id as business_id",
				"data_businesses.name as business_name",
				"data_cases.assignee",
				"data_cases.assigner",
				"data_cases.updated_at",
				"data_cases.updated_by"
			)
			.join("public.data_businesses", "data_businesses.id", "data_cases.business_id")
			.join("public.core_case_statuses", "core_case_statuses.id", "data_cases.status")
			.where({ "data_cases.id": caseID })
			.first();

		if (!caseData) {
			throw new CaseManagementApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		return caseData;
	}

	async sendWebhookEventForCaseCreated(caseID: UUID, customerID: UUID) {
		if (customerID) {
			try {
				const caseData = await this.getCaseByID({ caseID: caseID }, {}, {});
				caseData.case_id = caseData.id;
				delete caseData.id;
				await sendWebhookEvent(customerID, WEBHOOK_EVENTS.CASE_CREATED, caseData);
			} catch (ex) {
				logger.error(ex, `Error sending CASE_CREATED webhook for caseID=${caseID} and customerID=${customerID}`);
			}
		}
	}
}

export const caseManagementService = new CaseManagementService();
