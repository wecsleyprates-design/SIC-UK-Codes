// TODO: Remove the @ts-nocheck and fix whatever problems it is masking
// @ts-nocheck
import { tokenConfig } from "#configs/index";
import {
	BUCKETS,
	BUSINESS_STATUS,
	CASE_STATUS,
	CASE_STATUS_ENUM,
	CONNECTION_STATUS,
	DIRECTORIES,
	ERROR_CODES,
	INTEGRATION_ID,
	INVITE_STATUS,
	INVITE_STATUS_ENUM,
	QUEUES,
	QUEUE_EVENTS,
	ROLE_ID,
	SCORE_TRIGGER,
	SUBSCRIPTIONS,
	kafkaEvents,
	kafkaTopics,
	FEATURE_FLAGS,
	WEBHOOK_EVENTS,
	CUSTOM_ONBOARDING_SETUP,
	CUSTOM_ONBOARDING_TYPES,
	CASE_TYPE,
	SECTION_VISIBILITY,
	FIELD_ACCESS,
	ROLE_ID_TO_ROLE,
	CASE_INFO_REQUESTS,
	SupportedCountryCode,
	TIN_BEHAVIOR,
	CORE_PERMISSIONS
} from "#constants/index";
import {
	BullQueue,
	db,
	emailExists,
	fetchDepositAccountInfo,
	getApplicantByID,
	getApplicants,
	getBusinessApplicants,
	getBusinessEntityVerificationDetails,
	getBusinessIntegrationConnections,
	getCustomerWithPermissions,
	getCustomers,
	getCustomerData,
	getCustomersInternal,
	logger,
	redis,
	producer,
	sqlQuery,
	sqlTransaction,
	updateBusinessEntityForReview,
	inviteApplicant,
	getBusinessesRevenueAndAge,
	getBusinessApplicantsForWebhooks,
	getBusinessApplicantByApplicantId,
	getBusinessProcessingHistory,
	fetchNPIDetails,
	getBulkUserInfo,
	getCustomerAndBusinessUsers,
	fetchAdditionalAccountDetails,
	getBusinessAccountingStatements,
	getBusinessBankStatements,
	resolveCountryCode,
	hasDataPermission,
	insertPurgedBusinesses,
	restorePurgedBusinesses,
	updateBusinessFactsOverride,
	invalidateBusinessFactsCache,
	getIntegrationStatusForCustomer,
	getMerchantProfileData,
	resolveApplicantIdForAudit
} from "#helpers/index";
import { Business } from "#types/business";
import {
	buildInsertQuery,
	convertToObject,
	decodeInvitationToken,
	decryptEin,
	encryptEin,
	escapeRegExp,
	formatNumberWithoutPlus,
	maskString,
	paginate,
	pick,
	uploadFile,
	getCachedSignedUrl,
	jwtSign,
	encryptData,
	decryptAndTransformTin,
	toMDY,
	toISO,
	AddressUtil,
	AddressError,
	getStripeInstance
} from "#utils/index";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { v4 as uuid } from "uuid";
import { calculateBusinessFactsEvent, triggerSectionCompletedKafkaEventWithRedis } from "#common";
import { riskAlert } from "../risk-alerts/risk-alerts";
import BusinessUtils from "./businessUtils";
import { ApiError } from "@joinworth/worth-core-utils";
import { BusinessApiError } from "./error";
import {
	CaseDetails,
	CustomerDetailsByBusinessID,
	InvitationResponse,
	CustomFields,
	UpdateBusinessEntityData,
	GetCustomerBusinessesRequestParams,
	GetCustomerBusinessesRequestQuery
} from "./types";
import { getFlagValueByToken, getFlagValue } from "#helpers/LaunchDarkly";
import {
	sendEventToGatherWebhookData,
	sendWebhookEvent,
	addIndustryAndNaicsPlatform,
	createLinkForReadyToSubmitEvent,
	sendEventToFetchAdverseMedia
} from "#common/index";
import { envConfig } from "#configs";
import { evaluateCondition, parse } from "#helpers/expressions";
import { caseManagementService } from "../case-management/case-management";
import { caseManager } from "#core";
import { UserInfo } from "#types";
import { BusinessInvites } from "./businessInvites";
import { onboarding } from "../onboarding/onboarding";
import { CustomFieldHelper } from "../onboarding/customFieldHelper";
import type { CustomFieldResponse } from "../onboarding/types";
import { CustomField } from "../onboarding/customField";
import { esign } from "../esign/esign";
import { getCustomerBusinesses } from "./handlers";
import { applicationEdit } from "../application-edits/application-edit";
import { isUSBusiness } from "#helpers/countryHelper";
import {
	OWNERSHIP_FIELD_NAMES,
	progressionFields,
	progressionStages,
	type ProgressionFields
} from "#constants/progression.constants";
import { hasValuesForKeys } from "#utils/asserters";
import { updateIsDeleted } from "#helpers/updateIsDeletedHelper";
import type { Address } from "./validateBusiness";
import { Owners } from "./owners";
import { sendCustomFieldUpdateEvents } from "#messaging/kafka/producers/custom-fields";
import { buildApplicationEditInviteRedisKey } from "#helpers/redis";

const invitationStatusQueue = new BullQueue(QUEUES.INVITATION_STATUS);

/**
 * This is an internal function which validates the invitation token and if expired updates the db status and if not return respone
 * @param {object} invitationToken
 * @returns {object} business_id, applicant_id, invitation_id
 */
const _validateInvitationToken = async invitationToken => {
	try {
		const tokenData = await decodeInvitationToken(invitationToken);
		const customerConfig = await onboarding.getCustomerOnboardingStages(
			{ customerID: tokenData?.customer_id },
			{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
			false
		);
		const loginWithEmailPasswordField = customerConfig
			?.find(row => row.stage.toLowerCase() == "login")
			?.config?.fields?.find(field => field.name.toLowerCase() == "Login with Email & Password".toLowerCase());

		const isLightningVerification =
			(await getFlagValue(FEATURE_FLAGS.DOS_84_LIGHTNING_VERIFICATION, {
				key: "customer",
				kind: "customer",
				customer_id: tokenData?.customer_id
			})) && tokenData?.is_lightning_verification;
		if (tokenData.case !== "onboard_applicant_by_customer") {
			throw new BusinessApiError(
				"This invite link is invalid. Contact Support",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		// If the application is already submitted
		if (tokenData.is_co_applicant && tokenData.case_id) {
			const caseDetails = await caseManagementService.internalGetCaseByID({ caseID: tokenData.case_id });
			if (Object.keys(caseDetails).length === 0) {
				throw new BusinessApiError("Application not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const isSubmitted = caseDetails?.status_history?.filter(data => data?.status === CASE_STATUS_ENUM.SUBMITTED);
			if (isSubmitted?.length) {
				throw new BusinessApiError("Application already submitted", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
		}

		const getDataInvitesQuery = `SELECT core_invite_statuses.code as invitation_status, data_invites.customer_id, data_invites.case_id FROM data_invites
			LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE data_invites.id = $1 AND db.is_deleted = false`;

		const inviteStatus = await sqlQuery({ sql: getDataInvitesQuery, values: [tokenData.invitation_id] });
		if (!inviteStatus.rows.length) {
			logger.error(`Unable to fetch invite status for invitation id: ${tokenData.invitation_id}`);
			throw new BusinessApiError("Invalid token", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		if (inviteStatus.rows[0].invitation_status === "revoked") {
			throw new BusinessApiError("Application invitation revoked", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID, {
				invitation_status: "revoked"
			});
		}

		if (inviteStatus.rows[0].invitation_status === "rejected") {
			throw new BusinessApiError(
				"Invalid invitation: Already rejected by applicant",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		// if token is expired or status in db is expired then throwing error
		if (
			!["accepted", "completed"].includes(inviteStatus.rows[0].invitation_status) &&
			(tokenData.exp < Date.now() || inviteStatus.rows[0].invitation_status === "expired")
		) {
			const job = await invitationStatusQueue.getJobByID(tokenData.invitation_id);
			// updating db only if previous status is not expired
			if (!job && inviteStatus.rows[0].invitation_status !== "expired") {
				const updateInviteQuery = `UPDATE data_invites
						SET status = (SELECT id FROM core_invite_statuses WHERE code = $1)
						WHERE data_invites.id = $2`;

				const updateInviteValues = ["expired", tokenData.invitation_id];

				const insertHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status)
					VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2))`;

				const insertHistoryValues = [tokenData.invitation_id, "expired"];

				await sqlTransaction([updateInviteQuery, insertHistoryQuery], [updateInviteValues, insertHistoryValues]);
			}
			throw new BusinessApiError("Token Expired", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID, {
				invitation_status: "expired"
			});
		}

		const allowedStatuses = ["invited", "accepted", "completed"];

		// throwing error when not invited
		if (!allowedStatuses.includes(inviteStatus.rows[0].invitation_status)) {
			logger.error("Invite not in allowed statuses");
			throw new BusinessApiError("Invalid token", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		let data = {
			business_id: tokenData.business_id,
			applicant_id: tokenData.applicant_id,
			invitation_id: tokenData.invitation_id,
			email: tokenData.email,
			status: inviteStatus.rows[0].invitation_status,
			customer_id: inviteStatus.rows[0].customer_id,
			case_id: inviteStatus.rows[0].case_id
		};

		if (loginWithEmailPasswordField && !loginWithEmailPasswordField?.status && tokenData?.is_no_login) {
			data = {
				...data,
				is_no_login: tokenData?.is_no_login
			};
		}

		if (isLightningVerification) {
			data = {
				...data,
				is_lightning_verification: tokenData?.is_lightning_verification
			};
		}

		if (data.customer_id && data.case_id) {
			const redisKey = buildApplicationEditInviteRedisKey(data.customer_id, data.case_id);
			const cachedData = await redis.get(redisKey);
			if (tokenData?.is_guest_owner && !cachedData) {
				throw new BusinessApiError(
					"Invite link is no longer valid or session expired",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
		}
		if (tokenData?.is_guest_owner) {
			data = {
				...data,
				is_guest_owner: tokenData?.is_guest_owner,
				is_no_login: tokenData?.is_no_login
			};
		}
		return data;
	} catch (error) {
		throw error;
	}
};
class Businesses {
	/**
	 * @param {Object} query this contains payload sent from frontend
	 * @param {uuid} query.filter[data_cases.customer_id] to filter businesses by customer
	 * @param {*} headers.authorization to fetch customerIDs search by customer name from auth-service
	 * @returns This api returns businesses
	 * This api is used by admin for fetching all businesses and businesses associated with customers
	 * TODO: Role check for admin only
	 */
	async getBusinesses(query: object, headers: any, userInfo: UserInfo) {
		try {
			const hasPermission: boolean = await hasDataPermission(userInfo, CORE_PERMISSIONS.READ_PII_DATA);

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

			const queries = await this._createBusinessQueries(query, headers);
			const { countQuery } = queries;
			let { getQuery } = queries;

			const countQueryResult = await sqlQuery({ sql: countQuery });

			const totalcount = parseInt(countQueryResult.rows[0].totalcount);

			if (!pagination) {
				itemsPerPage = totalcount;
			}

			const paginationDetails = paginate(totalcount, itemsPerPage);

			if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
				throw new BusinessApiError("Page Requested is Out of Max Page Range", StatusCodes.BAD_REQUEST);
			}

			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				getQuery += paginationQuery;
			}
			const response = await sqlQuery({ sql: getQuery, values: [] });

			let records = response.rows.reduce((acc, item) => {
				if (item.tin !== null) {
					try {
						if (hasPermission) {
							item.tin = maskString(decryptEin(item.tin));
						} else {
							item.tin = null;
						}
					} catch (err) {
						logger.error({ error: err }, "something went wrong while decrypting or masking");
					}
				}

				const { subscription_json, ...business } = item;
				const subscription = subscription_json?.data_subscriptions
					? pick(subscription_json?.data_subscriptions, ["status", "created_at", "updated_at"])
					: null;
				acc.push({
					...business,
					subscription: {
						...subscription,
						...(subscription && {
							created_at: subscription.created_at?.toString() + "Z",
							updated_at: subscription.updated_at?.toString() + "Z"
						})
					}
				});

				return acc;
			}, []);

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
	 * @param {Object} query this contains payload sent from frontend
	 * @param headers headers.authorization to fetch customerIDs search by customer name from auth-service
	 * @returns {Array} Businesses with subscription details
	 * @description This API is used to fetch businesses from manual-score-service for score-refresh considerin subscription status
	 */
	async getBusinessesInternal(query: Record<string, any>, headers: any) {
		try {
			let pagination = true;
			if (Object.hasOwn(query, "pagination")) {
				pagination = JSON.parse(query.pagination);
			}

			let itemsPerPage: number, page: number;
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

			const queries = await this._createBusinessQueries(query, headers);
			const { countQuery } = queries;
			let { getQuery } = queries;

			const countQueryResult = await sqlQuery({ sql: countQuery });

			const totalcount = parseInt(countQueryResult.rows[0].totalcount);

			if (!pagination) {
				itemsPerPage = totalcount;
			}

			const paginationDetails = paginate(totalcount, itemsPerPage);

			if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
				throw new BusinessApiError("Page Requested is Out of Max Page Range", StatusCodes.BAD_REQUEST);
			}

			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				getQuery += paginationQuery;
			}
			const response = await sqlQuery({ sql: getQuery, values: [] });

			const result = Promise.all(
				response.rows.map(async item => {
					const { subscription_json, ...business } = item;
					const subscriptionID = subscription_json?.data_subscriptions?.stripe_subscription_id;
					let subscription: any = {};
					if (subscriptionID) {
						subscription = await getStripeInstance().getSubscriptionByID(subscriptionID, {
							expand: ["latest_invoice"]
						});
					}
					const invoice = pick(subscription.latest_invoice, [
						"status",
						"status_transitions",
						"billing_reason",
						"effective_at",
						"period_start",
						"period_end",
						"next_payment_attempt",
						"paid"
					]);

					return {
						...business,
						subscription: {
							...subscription_json?.data_subscriptions,
							...(subscription_json && {
								created_at: subscription_json.data_subscriptions.created_at?.toString() + "Z",
								updated_at: subscription_json.data_subscriptions.updated_at.toString() + "Z"
							})
						},
						invoice
					};
				})
			);

			const records = await result;

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
	 * @param {Object} query this contains payload sent from frontend
	 * @param {uuid} query.filter[data_cases.customer_id] to filter businesses by customer
	 * @param {*} headers.authorization to fetch customerIDs search by customer name from auth-service
	 * @returns {string, string} getQuery: businesses listing query, countQuery: total businesses count query
	 * @description This internal function is used to build queries to fetch businesses and business count
	 */
	async _createBusinessQueries(query: object, headers: { authorization: any }) {
		try {
			if (Object.hasOwn(query, "search") && Object.hasOwn(query.search, "data_customers.name")) {
				const userBody = {
					pagination: false,
					search: { "data_customers.name": query.search["data_customers.name"] }
				};

				const customersData = await getCustomers(userBody, headers.authorization);

				const { records } = customersData;

				let customerIDs: Set<string> = new Set();

				if (records) {
					records.forEach(item => {
						customerIDs.add(item.customer_details.id);
					});
					if (customerIDs.size > 0) {
						query = {
							...query,
							search_filter: {
								"rel_business_customer_monitoring.customer_id": customerIDs
							}
						};
					}
				}
			}

			let queryParams = "";

			const allowedSortParams = ["data_businesses.name", "data_businesses.created_at"];
			let sortParam = "data_businesses.created_at";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
			}

			const allowedFilterParams = [
				"data_businesses.status",
				"rel_business_customer_monitoring.customer_id",
				"data_businesses.id",
				"data_businesses.is_deleted"
			];
			type Filter = {
				column: string;
				value: any;
			};
			const businessArchivedStatus = query?.filter?.["data_businesses.is_deleted"];
			let existingFilterParamsValues: Filter[] = [];
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
						if (value !== "") {
							const filter = {
								column: field,
								value
							};
							acc.push(filter);
						}
						return acc;
					}
					return acc;
				}, [] as Filter[]);
			}

			if (!businessArchivedStatus) {
				existingFilterParamsValues.push({ column: "data_businesses.is_deleted", value: "false" });
			}

			let useStrictSearchParams = false;
			const strictSearchParams = [];
			const supplementaryStrictSearchParams = [];

			// Make sure all search params columns are mentioned here
			const columnSearchBehavior = {
				"data_businesses.name": "contains",
				"data_businesses.id::text": "contains"
			};

			const searchableUUIDs = ["data_businesses.id"];
			if (query.search) {
				Object.keys(query.search).forEach(field => {
					if (searchableUUIDs.includes(field)) {
						query.search = { ...query.search, [`${field}::text`]: query.search[field] };
					}
				});
			}

			// TODO : Modify builder to separate out business ID form search to filter without affecting the search query
			const allowedSearchParams = ["data_businesses.name", "data_businesses.id::text"];
			let existingSearchParams: string[] = [];
			const existingSearchParamsValue: Set<string> = new Set();
			if (query.search) {
				existingSearchParams = Object.keys(query.search).filter(field => allowedSearchParams.includes(field));
				if (existingSearchParams.length) {
					existingSearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();

						if (query.search[field].includes(" ") && strictSearchParams.length) {
							useStrictSearchParams = true;
						}
						/*
						 * Split the string on spaces and for each element of the split we trim the value and add those values into the set
						 * Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						 * >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}
						 */

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
			const allowedSupplementarySearchParams = [];

			let existingSupplementarySearchParams = [];
			const existingSupplementarySearchParamsValue = new Set();
			if (query.search) {
				existingSupplementarySearchParams = Object.keys(query.search).filter(field =>
					allowedSupplementarySearchParams.includes(field)
				);
				if (existingSupplementarySearchParams.length) {
					existingSupplementarySearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();
						/*
						 * Split the string on spaces and for each element of the split we trim the value and add those values into the set
						 * Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						 * >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}
						 */

						query.search[field].split(" ").forEach(val => {
							val = escapeRegExp(val.trim());
							if (val !== "" && val !== " ") {
								existingSupplementarySearchParamsValue.add(val);
							}
						});
					});
				}
			}

			const allowedSearchFilterParams = ["data_businesses.id", "rel_business_customer_monitoring.customer_id"];
			let existingSearchFilterParamsValues: Filter[] = [];
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
				}, existingSearchFilterParamsValues);
			}

			const allowedFilterDateParams = ["data_businesses.created_at"];
			let existingFilterDateParamsValues: Filter[] = [];
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
				}, existingFilterDateParamsValues);
			}

			// Helper function to generate search conditions based on search behavior
			function generateSearchCondition(column, value, searchBehavior) {
				switch (searchBehavior) {
					case "startsWith":
						return `${column} ILIKE '${value}%'`;
					case "contains":
						return `${column} ILIKE '%${value}%'`;
					default:
						return ""; // Handle unsupported search behaviors
				}
			}

			let counter = 1;
			if (existingFilterParamsValues.length) {
				let filter = " AND ";
				counter++;
				filter += existingFilterParamsValues
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [] as string[])
					.join(" AND ");
				queryParams += filter;
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
					}, [] as string[])
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
					}, [] as string[])
					.join(" AND ");
				queryParams += filterDate;
			}

			/**
			 * This is the logic to add filter on subscription status
			 * To create sql query for subscription status filter like a subquery
			 * such that the OR applied is specific to this subquery only
			 * So the end quey will look like getQuery + AND ( subscription_status_subquery )
			 */
			if (Object.hasOwn(query?.filter ?? {}, "data_subscriptions.status")) {
				let subscriptionStatuses = [];
				if (Array.isArray(query?.filter?.["data_subscriptions.status"])) {
					query?.filter?.["data_subscriptions.status"].forEach(status => {
						if (status !== SUBSCRIPTIONS.NOT_SUBSCRIBED) {
							subscriptionStatuses.push(`'${status}'`);
						}
					});
				} else if (
					typeof query?.filter?.["data_subscriptions.status"] === "string" &&
					query?.filter?.["data_subscriptions.status"] !== SUBSCRIPTIONS.NOT_SUBSCRIBED
				) {
					subscriptionStatuses.push(`'${query?.filter?.["data_subscriptions.status"]}'`);
				}

				if (subscriptionStatuses.length > 0) {
					subscriptionStatuses = subscriptionStatuses.join(",");
					queryParams += counter ? " AND " : " WHERE ";
					queryParams += ` ( data_subscriptions.status IN (${subscriptionStatuses}) `;
				}

				if (
					query?.filter?.["data_subscriptions.status"] === SUBSCRIPTIONS.NOT_SUBSCRIBED ||
					query?.filter?.["data_subscriptions.status"]?.includes(SUBSCRIPTIONS.NOT_SUBSCRIBED)
				) {
					if (typeof query?.filter?.["data_subscriptions.status"] === "string") {
						queryParams += counter ? " AND (" : " WHERE (";
					}
					if (Array.isArray(query.filter["data_subscriptions.status"])) {
						if (query.filter["data_subscriptions.status"].length === 1) {
							queryParams += counter ? " AND (" : " WHERE (";
						} else {
							queryParams += counter ? " OR " : " WHERE (";
						}
					}

					queryParams += ` data_businesses.id NOT IN (SELECT business_id FROM subscriptions.data_businesses_subscriptions
						LEFT JOIN data_businesses ON data_businesses.id = subscriptions.data_businesses_subscriptions.business_id
						WHERE subscriptions.data_businesses_subscriptions.status NOT IN ('NOT_SUBSCRIBED')) `;

					/**
					 * To filter businesses by customers in conjunction with filter data_subscriptions.status = NOT_SUBSCRIBED
					 * So we need to fetch the business which have customer_ids = query.filter.["rel_business_customer_monitoring.customer_id"]
					 */
					if (query?.filter?.["rel_business_customer_monitoring.customer_id"]) {
						let customerIDs = "";
						if (Array.isArray(query?.filter?.["rel_business_customer_monitoring.customer_id"])) {
							query?.filter?.["rel_business_customer_monitoring.customer_id"].forEach(id => {
								customerIDs += `'${id.toString()}',`;
							});
							customerIDs = customerIDs.slice(0, -1);
						} else {
							customerIDs = `'${query?.filter?.["rel_business_customer_monitoring.customer_id"]}'`;
						}
						queryParams += `AND data_businesses.id IN (SELECT rel_business_customer_monitoring.business_id
						FROM rel_business_customer_monitoring
						LEFT JOIN data_businesses ON rel_business_customer_monitoring.business_id = data_businesses.id
						WHERE rel_business_customer_monitoring.customer_id IN (${customerIDs}))`;
					}
				}

				// close the subscription status filter query logic
				queryParams += ` ) `;
			}

			/**
			 * To filter businesses by customer invited and standalone business.
			 * As this logic is condition based we can not have this in generic logic
			 */
			if (query?.filter?.business_type) {
				const allowedBusinessTypeValues = ["customer_invited", "standalone"];
				if (Array.isArray(query.filter.business_type)) {
					if (
						!(
							query.filter.business_type.includes(allowedBusinessTypeValues[0]) &&
							query.filter.business_type.includes(allowedBusinessTypeValues[1])
						)
					) {
						query.filter.business_type.forEach(type => {
							switch (type) {
								case allowedBusinessTypeValues[0]: {
									queryParams += counter ? " AND " : " WHERE ";
									queryParams += " rel_business_customer_monitoring.customer_id IS NOT NULL";
									counter++;
									break;
								}
								case allowedBusinessTypeValues[1]: {
									queryParams += counter ? " AND " : " WHERE ";
									queryParams += " rel_business_customer_monitoring.customer_id IS NULL";
									counter++;
									break;
								}
								default:
									break;
							}
						});
					}
				} else if (typeof query.filter.business_type === "string") {
					switch (query.filter.business_type) {
						case allowedBusinessTypeValues[0]: {
							queryParams += counter ? " AND " : " WHERE ";
							queryParams += " rel_business_customer_monitoring.customer_id IS NOT NULL";
							counter++;
							break;
						}
						case allowedBusinessTypeValues[1]: {
							queryParams += counter ? " AND " : " WHERE ";
							queryParams += " rel_business_customer_monitoring.customer_id IS NULL";
							counter++;
							break;
						}
						default:
							break;
					}
				}
			}

			const sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
			queryParams += sort;

			const getQuery = `SELECT subquery.* FROM (SELECT data_businesses.*,cnc.code as naics_code, cnc.label as naics_title, cmc.code as mcc_code, cmc.label as mcc_title, rel_business_customer_monitoring.customer_id as customer_id,
				json_build_object('data_subscriptions', data_subscriptions) as subscription_json
				FROM data_businesses
				LEFT JOIN subscriptions.data_businesses_subscriptions AS data_subscriptions ON data_businesses.id = data_subscriptions.business_id
				LEFT JOIN rel_business_customer_monitoring ON rel_business_customer_monitoring.business_id = data_businesses.id
				LEFT JOIN core_mcc_code cmc ON cmc.id = data_businesses.mcc_id
				LEFT JOIN core_naics_code cnc ON cnc.id = data_businesses.naics_id
				WHERE data_businesses.id IS NOT NULL ${queryParams}) subquery`;

			const countQuery = `SELECT COUNT(*) AS totalcount FROM (SELECT data_businesses.*, rel_business_customer_monitoring.customer_id as customer_id,
				json_build_object('data_subscriptions', data_subscriptions) as subscription_json
				FROM data_businesses
				LEFT JOIN subscriptions.data_businesses_subscriptions AS data_subscriptions ON data_businesses.id = data_subscriptions.business_id
				LEFT JOIN rel_business_customer_monitoring ON rel_business_customer_monitoring.business_id = data_businesses.id
				WHERE data_businesses.id IS NOT NULL ${queryParams}) subquery`;

			return { getQuery, countQuery };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {uuid} param.businessID to fetch the details wrt business id
	 * @param {`${TIN_BEHAVIOR}` | TIN_BEHAVIOR} params.tinBehavior to mask or unmask the TIN -- default to MASK. NOTE: If this function is used directly as a route handler, this will be a string.
	 * @returns This api returns business details
	 * TODO : Need to check role first, if customer role has invoked the get business by ID request
	 */
	async getBusinessByID(
		params: { businessID: string; tinBehavior?: `${TIN_BEHAVIOR}` | TIN_BEHAVIOR },
		query?: { fetch_owner_details: boolean; tinBehavior?: `${TIN_BEHAVIOR}` | TIN_BEHAVIOR },
		userInfo?: UserInfo
	): Promise<
		Partial<Pick<Business.Record, "tin">> &
			Business.WithSubscription &
			Business.WithBusinessNames &
			Business.WithBusinessAddresses &
			Business.WithOwners &
			Partial<Pick<Business.WithCustomer, "external_id" | "is_monitoring_enabled" | "customer_id">>
	> {
		const hasPermission: boolean = await hasDataPermission(userInfo, CORE_PERMISSIONS.READ_PII_DATA);
		let getBusinessResult, ownerDetails;
		const getBusinessQuery = `SELECT data_businesses.*, cnc.code as naics_code, cnc.label as naics_title, cmc.code as mcc_code, cmc.label as mcc_title, rel_business_customer_monitoring.external_id as external_id, json_build_object('industry_data', core_business_industries) as industry_json,
				data_subscriptions.status AS subscription_status, data_subscriptions.created_at AS subscription_created_at,
				data_subscriptions.updated_at AS subscription_updated_at, customer_id, is_monitoring_enabled
				FROM data_businesses LEFT JOIN subscriptions.data_businesses_subscriptions AS data_subscriptions ON data_subscriptions.business_id = data_businesses.id
				LEFT JOIN core_business_industries ON data_businesses.industry = core_business_industries.id
				LEFT JOIN rel_business_customer_monitoring ON rel_business_customer_monitoring.business_id = data_businesses.id
				LEFT JOIN core_mcc_code cmc ON cmc.id = data_businesses.mcc_id
				LEFT JOIN core_naics_code cnc ON cnc.id = data_businesses.naics_id
				WHERE data_businesses.id = $1`;

		if (query && query.fetch_owner_details) {
			const getOwnerQuery = `SELECT     json_build_object('data_owners', data_owners) as owners_json,
			json_build_object('rel_business_owners', rel_business_owners) as owners_percentage_json
            FROM rel_business_owners
            LEFT JOIN data_owners ON data_owners.id = rel_business_owners.owner_id
			WHERE rel_business_owners.business_id = $1`;

			const [getBusinessData, getOwnerQueryResult] = await sqlTransaction(
				[getBusinessQuery, getOwnerQuery],
				[[params.businessID], [params.businessID]]
			);
			const titles = await Owners.getOwnerTitles();
			// get application edit for ownership stage
			let ownershipEditData = await applicationEdit.getApplicationEdit(
				{ businessID: params.businessID },
				{
					stage_name: "ownership"
				}
			);

			ownerDetails = getOwnerQueryResult.rows.reduce((acc, item) => {
				if (!acc.owner) {
					acc.owner = [];
				}

				if (item.owners_json.data_owners) {
					if (item.owners_json.data_owners.ssn !== null) {
						const decryptedEin = decryptEin(item.owners_json.data_owners.ssn);
						item.owners_json.data_owners.ssn = decryptedEin;
					}
					item.owners_json.data_owners.ownership_percentage =
						item.owners_percentage_json?.rel_business_owners?.ownership_percentage;
					item.owners_json.data_owners.owner_type = item.owners_percentage_json?.rel_business_owners?.owner_type;
					item.owners_json.data_owners.external_id = item.owners_percentage_json?.rel_business_owners?.external_id;
					item.owners_json.data_owners.title = titles?.[item.owners_json.data_owners.title];
					// check for customer edit
					if (ownershipEditData.length) {
						const editResult = ownershipEditData.filter(
							record => record.metadata.owner_id === item.owners_json.data_owners.id
						);
						if (editResult.length) {
							item.owners_json.data_owners["guest_owner_edits"] = editResult.map(record => record.field_name);
						}
					}
					acc.owner.push(item.owners_json.data_owners);
				}
				return acc;
			}, {});
			getBusinessResult = getBusinessData;
		} else {
			getBusinessResult = await sqlQuery({ sql: getBusinessQuery, values: [params.businessID] });
		}

		if (!getBusinessResult.rowCount) {
			throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const {
			subscription_status: subscriptionStatus,
			subscription_created_at: subscriptionCreatedAt,
			subscription_updated_at: subscriptionUpdatedAt,
			industry_json,
			...business
		} = getBusinessResult.rows[0] as any;

		const response = {
			...business,
			deleted_by: null,
			deleted_at: null,
			industry: industry_json.industry_data,
			subscription: {
				status: subscriptionStatus,
				created_at: subscriptionCreatedAt,
				updated_at: subscriptionUpdatedAt
			},
			...(ownerDetails && { owners: ownerDetails.owner })
		};

		if (!hasPermission) {
			response.tin = null;
		} else {
			response.tin = decryptAndTransformTin(response.tin, params.tinBehavior || query?.tinBehavior);
		}

		// get applicant details if business is archived
		if (business?.is_deleted === true) {
			const purgedBusiness = await db("purge_business.data_purged_businesses")
				.where({ business_id: params.businessID })
				.first();
			const applicant = await getApplicantByID(purgedBusiness.deleted_by);
			response.deleted_by = `${applicant.first_name} ${applicant.last_name}`;
			response.deleted_at = purgedBusiness.deleted_at;
		}

		const getAllBusinessNamesQuery = `SELECT data_business_names.name, data_business_names.is_primary, data_business_names.is_corporate_entity FROM data_business_names
			LEFT JOIN data_businesses db ON db.id = data_business_names.business_id
			WHERE business_id = $1 AND db.is_deleted = false`;
		const getAllBusinessAddresses = `SELECT data_business_addresses.line_1, data_business_addresses.apartment, data_business_addresses.city, data_business_addresses.state, data_business_addresses.country, data_business_addresses.postal_code, data_business_addresses.mobile, data_business_addresses.is_primary
			FROM data_business_addresses
			LEFT JOIN data_businesses db ON db.id = data_business_addresses.business_id
			WHERE business_id = $1 AND db.is_deleted = false`;

		const [getAllBusinessNamesResult, getAllBusinessAddressesResult] = await sqlTransaction(
			[getAllBusinessNamesQuery, getAllBusinessAddresses],
			[[params.businessID], [params.businessID]]
		);
		response.business_names = getAllBusinessNamesResult.rows.map(r => {
			// always include name & is_primary
			const entry: { name: string; is_primary: boolean; is_corporate_entity?: boolean } = {
				name: r.name,
				is_primary: r.is_primary
			};

			// only include is_corporate_entity when it's not null
			if (r.is_corporate_entity !== null) {
				entry.is_corporate_entity = r.is_corporate_entity;
			}

			return entry;
		});
		response.business_addresses = getAllBusinessAddressesResult.rows;

		// get application edit for company stage
		const companyEditData = await applicationEdit.getApplicationEdit(
			{ businessID: params.businessID },
			{
				stage_name: "company"
			}
		);
		const companyEdit =
			Array.isArray(companyEditData) && companyEditData.length
				? [...new Set(companyEditData.map(record => record.field_name))]
				: undefined;
		response.guest_owner_edits = companyEdit;

		return response;
	}

	/**
	 * @params {object, object, object}
	 * @returns {}
	 * This function updates business's details
	 */
	async updateBusinessDetails(body, params, userInfo) {
		try {
			const getBusinessQuery = "SELECT * FROM data_businesses WHERE id = $1";
			const getBusinessQueryResult = await sqlQuery({ sql: getBusinessQuery, values: [params.businessID] });

			if (!getBusinessQueryResult.rowCount) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const business = getBusinessQueryResult.rows[0];

			body.address_country = resolveCountryCode(body.address_country) ?? SupportedCountryCode.US;

			if (Object.hasOwn(body, "industry")) {
				body.industry = body.industry.id;
			}

			let caseID;
			if (Object.hasOwn(body, "case_id")) {
				caseID = body.case_id;
				delete body.case_id;
			}

			const unwantedKeys = ["naics_code", "naics_id", "naics_title", "mcc_code", "mcc_id", "mcc_title"];

			unwantedKeys.forEach(key => {
				if (Object.hasOwn(body, key)) {
					delete body[key];
				}
			});

			const bodyKeys = Object.keys(body);

			if (bodyKeys.length > 0) {
				const propertiesToCheck = ["official_website", "public_website", "social_account", "industry"];

				for (const property of propertiesToCheck) {
					if (body[property] === "") {
						body[property] = null;
					}
				}

				// mobile number consistency
				if (body.mobile) {
					if (!body.mobile.startsWith("+")) {
						body.mobile = `+1${body.mobile}`;
					}
					body.mobile = `+${formatNumberWithoutPlus(body.mobile)}`;
				}

				let values: any[] = [];

				let updateBusinessQuery = `UPDATE data_businesses SET
				${bodyKeys.map((key, index) => `${key} = $${index + 1}`).join(", ")},
				updated_by = $${bodyKeys.length + 1}`;

				updateBusinessQuery += ` WHERE id = $${bodyKeys.length + 2}`;

				values = bodyKeys.map(key => body[key]);
				values.push(userInfo.user_id, params.businessID);

				await sqlQuery({ sql: updateBusinessQuery, values });

				if (Object.hasOwn(body, "official_website") && body.official_website && caseID) {
					// trigger kafka event to integration svc to store business website related data
					await producer.send({
						topic: kafkaTopics.BUSINESS,
						messages: [
							{
								key: params.businessID,
								value: {
									event: kafkaEvents.FETCH_BUSINESS_WEBSITE_DETAILS,
									business_id: params.businessID,
									website: body.official_website,
									case_id: caseID
								}
							}
						]
					});
				}

				if (
					hasValuesForKeys<Pick<Business.Record, "name" | "address_line_1" | "address_city" | "address_state">>(
						{ ...business, ...body },
						"name",
						"address_line_1",
						"address_city",
						"address_state"
					)
				) {
					/**
					 * If the business has or will (using the request body) have enough information to fetch the google profile, trigger the associated kafka event
					 */
					await producer.send({
						topic: kafkaTopics.BUSINESS,
						messages: [
							{
								key: params.businessID,
								value: {
									event: kafkaEvents.FETCH_GOOGLE_PROFILE,
									business_id: params.businessID
								}
							}
						]
					});
				}

				await addIndustryAndNaicsPlatform(params.businessID, "frontend", { industry: body.industry });
				await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: params.businessID });

				// we can send kakfa event from here
				let customerIDs: string[] = [];
				try {
					const customerDetails = await this.getCustomersByBusinessId(params.businessID);
					customerIDs = customerDetails.map(customer => customer.customer_id);
				} catch (err: any) {
					logger.error({ error: err }, `Error fetching customer IDs for business ${params.businessID}`);
				}
				if (userInfo?.hasOwnProperty("is_guest_owner") && !userInfo?.is_guest_owner) {
					await triggerSectionCompletedKafkaEventWithRedis(
						params.businessID,
						"Company Details",
						userInfo.user_id,
						customerIDs.length > 0 ? customerIDs[0] : null,
						redis
					);
				}
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {uuid} params.businessID param.businessID to fetch the details wrt business id
	 * @param {*} query
	 * @param {*} headers.authorization to call getCustomers from auth-service
	 * @returns This api is designed to return customers associated with business
	 * This is api will be binded on admin side only
	 * TODO: Role check for admin only
	 */
	async getBusinessCustomers(params, query, headers) {
		try {
			const getCustomerIDsQuery = "SELECT customer_id FROM rel_business_customer_monitoring WHERE business_id = $1";
			const resultCustomerIDs = await sqlQuery({ sql: getCustomerIDsQuery, values: [params.businessID] });

			if (!resultCustomerIDs.rows.length) {
				return {
					records: [],
					totalItems: 0,
					totalPages: 0
				};
			}

			let pagination = false;

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

			const customerIDs = resultCustomerIDs.rows.map(item => item.customer_id);
			const customerBody = {
				pagination,
				page,
				items_per_page: itemsPerPage,
				...(query?.sort && { sort: query?.sort }),
				filter: { ...(query?.filter?.status && { status: query.filter.status }), "data_customers.id": customerIDs },
				...(query?.search?.customer_name && { search: { "data_customers.name": query.search.customer_name } })
			};

			const response = await getCustomers(customerBody, headers.authorization);
			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @description This function is used in inter-service to get the customers ids related to a business
	 * @param params.businessID {string}: ID of a business
	 * @returns {Array} : array of customer ids
	 */
	async internalBusinessCustomers(params: { businessID: string }, body: { is_monitoring_enabled: boolean }) {
		try {
			let getCustomerIDsQuery = "SELECT customer_id FROM rel_business_customer_monitoring WHERE business_id = $1";
			if (body && Object.hasOwn(body, "is_monitoring_enabled") && body.is_monitoring_enabled === "true") {
				getCustomerIDsQuery += " AND is_monitoring_enabled = true";
			}

			const resultCustomerIDs = await sqlQuery({ sql: getCustomerIDsQuery, values: [params.businessID] });

			let customerIDs = resultCustomerIDs.rows.map(item => item.customer_id);

			if (body && Object.hasOwn(body, "is_monitoring_enabled") && body.is_monitoring_enabled === "true") {
				const result = await getCustomerWithPermissions({
					customer_ids: [customerIDs],
					permissions: ["risk_monitoring_module:write"]
				});
				customerIDs = result["risk_monitoring_module:write"];
			}

			return { customer_ids: customerIDs };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {uuid} params.customerID to fetch businesses wrt customer id
	 * @param {*} query
	 * @returns This api returns businesses invited by customer
	 * This api is binded on Customer side to let customer view all the business invited by them
	 * TODO: Role check for customer only
	 */
	async getCustomerBusinesses(
		params: GetCustomerBusinessesRequestParams,
		query: GetCustomerBusinessesRequestQuery,
		userInfo: UserInfo
	) {
		if (await getFlagValue(FEATURE_FLAGS.DOS_546_REFACTOR_GET_CUSTOMER_BUSINESSES_QUERIES)) {
			return getCustomerBusinesses(params, query, userInfo);
		}

		const hasPermission: boolean = await hasDataPermission(userInfo, CORE_PERMISSIONS.READ_PII_DATA);

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

			let queryParams = "";

			const allowedSortParams = ["data_businesses.name", "data_businesses.created_at"];
			let sortParam = "data_businesses.created_at";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
			}

			const allowedFilterParams = [
				"data_businesses.status",
				"rel_business_customer_monitoring.is_monitoring_enabled",
				"data_businesses.is_deleted"
			];
			let existingFilterParamsValues = [{ column: "data_businesses.is_deleted", value: "false" }]; // Default filter to exclude deleted businesses
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
							// TODO: Escape values e.g. value = esc(query.filter[field])
							value = `'${query.filter[field]}'`;
						} else {
							value = query.filter[field].toString();
						}
						if (value !== "") {
							const filter = {
								column: field,
								value
							};
							acc.push(filter);
						}
						return acc;
					}
					return acc;
				}, []);
			}

			let useStrictSearchParams = false;
			const strictSearchParams = [];
			const supplementaryStrictSearchParams = [];

			// Make sure all search params columns are mentioned here
			const columnSearchBehavior = {
				"data_businesses.name": "contains",
				"data_businesses.id::text": "contains"
			};

			const searchableUUIDs = ["data_businesses.id"];
			if (query.search) {
				Object.keys(query.search).forEach(field => {
					if (searchableUUIDs.includes(field)) {
						query.search = { ...query.search, [`${field}::text`]: query.search[field] };
					}
				});
			}

			// TODO : Modify builder to separate out business ID form search to filter without affecting the search query
			const allowedSearchParams = ["data_businesses.name", "data_businesses.id::text"];
			let existingSearchParams = [];
			const existingSearchParamsValue = new Set();
			if (query.search) {
				existingSearchParams = Object.keys(query.search).filter(field => allowedSearchParams.includes(field));
				if (existingSearchParams.length) {
					existingSearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();

						if (query.search[field].includes(" ") && strictSearchParams.length) {
							useStrictSearchParams = true;
						}
						/*
						 * Split the string on spaces and for each element of the split we trim the value and add those values into the set
						 * Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						 * >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}
						 */

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
			const allowedSupplementarySearchParams = [];

			let existingSupplementarySearchParams = [];
			const existingSupplementarySearchParamsValue = new Set();
			if (query.search) {
				existingSupplementarySearchParams = Object.keys(query.search).filter(field =>
					allowedSupplementarySearchParams.includes(field)
				);
				if (existingSupplementarySearchParams.length) {
					existingSupplementarySearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();
						/*
						 * Split the string on spaces and for each element of the split we trim the value and add those values into the set
						 * Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						 * >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}
						 */

						query.search[field].split(" ").forEach(val => {
							val = escapeRegExp(val.trim());
							if (val !== "" && val !== " ") {
								existingSupplementarySearchParamsValue.add(val);
							}
						});
					});
				}
			}

			/**
			 * The "external_id" field is, unlike the other filters, intentionally *not* using the underlying table name (rel_business_customer_monitoring)
			 * in the name of the filter in order to avoid exposing our internal database structures to the outside world. This is a security measure to
			 * prevent potential attackers from gaining insight into our database schema.
			 */
			const allowedSearchFilterParams = ["data_businesses.id", "external_id"];
			let existingSearchFilterParamsValues = [];
			if (query.search_filter) {
				const searchFilterToColumnMap = {
					"data_businesses.id": "data_businesses.id",
					external_id: "rel_business_customer_monitoring.external_id"
				};

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
							column: searchFilterToColumnMap[field],
							value
						};
						acc.push(searchFilter);
						return acc;
					}
					return acc;
				}, []);
			}

			const allowedFilterDateParams = ["data_businesses.created_at"];
			let existingFilterDateParamsValues = [];
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
				}, []);
			}

			// Helper function to generate search conditions based on search behavior
			function generateSearchCondition(column, value, searchBehavior) {
				switch (searchBehavior) {
					case "startsWith":
						return `${column} ILIKE '${value}%'`;
					case "contains":
						return `${column} ILIKE '%${value}%'`;
					default:
						return ""; // Handle unsupported search behaviors
				}
			}

			let counter = 1;
			if (existingFilterParamsValues.length) {
				let filter = " AND ";
				counter++;
				filter += existingFilterParamsValues
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [])
					.join(" AND ");
				queryParams += filter;
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

			const sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
			queryParams += sort;

			let getQuery = `SELECT subquery.* FROM (SELECT data_businesses.*, cnc.code as naics_code, cnc.label as naics_title, cmc.code as mcc_code, cmc.label as mcc_title, rel_business_customer_monitoring.customer_id AS customer_id, rel_business_customer_monitoring.external_id AS external_id,
				rel_business_customer_monitoring.is_monitoring_enabled FROM data_businesses
				LEFT JOIN rel_business_customer_monitoring ON rel_business_customer_monitoring.business_id = data_businesses.id
				LEFT JOIN core_mcc_code cmc ON cmc.id = data_businesses.mcc_id
				LEFT JOIN core_naics_code cnc ON cnc.id = data_businesses.naics_id
				WHERE rel_business_customer_monitoring.customer_id = $1 ${queryParams}) subquery`;

			const countQuery = `SELECT COUNT(subquery.id) AS totalcount FROM (SELECT data_businesses.*,
				rel_business_customer_monitoring.customer_id AS customer_id, rel_business_customer_monitoring.is_monitoring_enabled
				FROM data_businesses
				LEFT JOIN rel_business_customer_monitoring ON rel_business_customer_monitoring.business_id = data_businesses.id
				WHERE rel_business_customer_monitoring.customer_id = $1 ${queryParams}) subquery`;

			const countQueryResult = await sqlQuery({ sql: countQuery, values: [params.customerID] });

			const totalcount = parseInt(countQueryResult.rows[0].totalcount);

			if (!pagination) {
				itemsPerPage = totalcount;
			}

			const paginationDetails = paginate(totalcount, itemsPerPage);
			if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
				throw new BusinessApiError("Page Requested is Out of Max Page Range", StatusCodes.BAD_REQUEST);
			}

			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				getQuery += paginationQuery;
			}

			const response = await sqlQuery({ sql: getQuery, values: [params.customerID] });

			response.rows.forEach(row => {
				if (row.tin !== null) {
					if (hasPermission) {
						row.tin = maskString(decryptEin(row.tin));
					} else {
						row.tin = null;
					}
				}
			});

			return {
				records: response.rows,
				total_pages: paginationDetails.totalPages,
				total_items: paginationDetails.totalItems
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @param {*} params.businessID to fetch cases wrt to business id
	 * @param {*} query payload send from frontend like pagination, items_per_page, page, filter, search etc.
	 * @param {string} query.search.first_name search for applicant first name
	 * @param {string} query.search.first_name search for applicant last name
	 * @param {*} headers.authorization to fetch applicant details from auth-service
	 * @returns This API returns cases related to business and this API is used by admin and customer
	 */
	async getCasesByBusinessID(params, query, headers) {
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
						userIDs = [...userIDs];
						if (userIDs.length) {
							query = {
								...query,
								search_filter: {
									applicant_id: userIDs
								}
							};
						}
					}
				}
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
				"data_cases.case_type"
			];
			let existingFilterParamsValues = [];
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
				}, []);
			}

			let useStrictSearchParams = false;
			const strictSearchParams = [];
			const supplementaryStrictSearchParams = [];

			// Make sure all search params columns are mentioned here
			const columnSearchBehavior = {
				"data_businesses.name": "contains",
				"data_cases.id::text": "contains"
			};

			const searchableUUIDs = ["data_cases.id"];
			if (query.search) {
				Object.keys(query.search).forEach(field => {
					if (searchableUUIDs.includes(field)) {
						query.search = { ...query.search, [`${field}::text`]: query.search[field] };
					}
				});
			}

			const allowedSearchParams = ["data_businesses.name", "data_cases.id::text"];
			let existingSearchParams = [];
			const existingSearchParamsValue = new Set();
			if (query.search) {
				existingSearchParams = Object.keys(query.search).filter(field => allowedSearchParams.includes(field));
				if (existingSearchParams.length) {
					existingSearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();

						if (query.search[field].includes(" ") && strictSearchParams.length) {
							useStrictSearchParams = true;
						}
						/*
						 * Split the string on spaces and for each element of the split we trim the value and add those values into the set
						 * Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						 * >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}
						 */

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
			const allowedSupplementarySearchParams = [];

			let existingSupplementarySearchParams = [];
			const existingSupplementarySearchParamsValue = new Set();
			if (query.search) {
				existingSupplementarySearchParams = Object.keys(query.search).filter(field =>
					allowedSupplementarySearchParams.includes(field)
				);
				if (existingSupplementarySearchParams.length) {
					existingSupplementarySearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();
						/*
						 * Split the string on spaces and for each element of the split we trim the value and add those values into the set
						 * Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						 * >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}
						 */

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
			let existingSearchFilterParamsValues = [];
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
				}, []);
			}

			const allowedFilterDateParams = ["data_cases.created_at"];
			let existingFilterDateParamsValues = [];
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
				}, []);
			}

			// Helper function to generate search conditions based on search behavior
			function generateSearchCondition(column, value, searchBehavior) {
				switch (searchBehavior) {
					case "startsWith":
						return `${column} ILIKE '${value}%'`;
					case "contains":
						return `${column} ILIKE '%${value}%'`;
					default:
						return ""; // Handle unsupported search behaviors
				}
			}

			let counter = 1;
			if (existingFilterParamsValues.length) {
				let filter = " AND ";
				counter++;
				filter += existingFilterParamsValues
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [])
					.join(" AND ");
				queryParams += filter;
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

			// This will fetch cases for a particular customer only
			let customerQuery = "";
			if (params.customerID) {
				customerQuery += ` AND data_cases.customer_id = '${params.customerID}' `;
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

			let casesQuery = `SELECT subquery.* FROM
                (SELECT data_cases.id, data_cases.customer_id, data_cases.applicant_id, data_cases.created_at, data_cases.case_type,
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
                    LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status
					LEFT JOIN core_case_types ON core_case_types.id = data_cases.case_type
                    LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id
					LEFT JOIN core_mcc_code cmc ON cmc.id = data_businesses.mcc_id
					LEFT JOIN core_naics_code cnc ON cnc.id = data_businesses.naics_id
					LEFT JOIN data_integration_tasks_progress as ditp ON ditp.case_id = data_cases.id
                    WHERE data_cases.business_id=$1 ${customerQuery} ${queryParams}) subquery`;

			const countQuery = `SELECT COUNT(subquery.id) as totalcount FROM
				(SELECT data_cases.id, data_cases.applicant_id, data_cases.created_at, data_cases.case_type,
                    data_businesses.name as business_name,
                    core_case_statuses.id as status_id, core_case_statuses.code as status_code, core_case_statuses.label as status_label
                    FROM data_cases
                    LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status
					LEFT JOIN core_case_types ON core_case_types.id = data_cases.case_type
                    LEFT JOIN data_businesses ON data_businesses.id = data_cases.business_id
                    WHERE data_cases.business_id=$1 ${customerQuery} ${queryParams}) subquery`;

			if (
				Object.hasOwn(query, "filter") &&
				Object.hasOwn(query.filter, "is_standalone") &&
				query.filter.is_standalone === "true"
			) {
				queryParams += ` AND data_cases.customer_id IS NULL`;
				queryParams += ` AND data_cases.customer_id IS NULL`;
			}

			const countQueryResult = await sqlQuery({ sql: countQuery, values: [params.businessID] });

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
				throw new BusinessApiError("Page Requested is Out of Max Page Range", StatusCodes.BAD_REQUEST);
			}
			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				casesQuery += paginationQuery;
			}

			let result = await sqlQuery({ sql: casesQuery, values: [params.businessID] });

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

			let users = await getApplicants(userBody, headers.authorization);
			users = convertToObject(users, "id", ["first_name", "last_name"]);

			result = result.rows.map(row => {
				row = {
					...row,
					assignee: row.assignee
						? {
								id: row.assignee,
								first_name: users[row.assignee]?.first_name,
								last_name: users[row.assignee]?.last_name
							}
						: {},
					applicant: { first_name: users[row.applicant_id]?.first_name, last_name: users[row.applicant_id]?.last_name },
					status: { id: row.status_id, code: row.status_code, label: row.status_label }
				};
				delete row.status_id;
				delete row.status_code;

				return row;
			});

			/* TODO: See if we can Promise.allSettled these */
			let records = await riskAlert._enrichRiskCases(result);
			records = await caseManagementService._enrichReportStatus(records);
			records = await this._enrichRevenueAndAge(records);
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
	 * Fetches applicants of a business that are previously onbaorded by the particular customer
	 * @param {any} params params.businessID, params.customerID
	 * @param {any} headers headers.authorizations
	 * @returns {[]} Array of applicants
	 */
	async getBusinessApplicantsForCustomer(params, headers) {
		try {
			const getCustomerQuery = `SELECT customer_id FROM rel_business_customer_monitoring WHERE business_id = $1 AND customer_id =$2`;
			const customer = await sqlQuery({ sql: getCustomerQuery, values: [params.businessID, params.customerID] });

			if (!customer.rowCount) {
				throw new BusinessApiError(
					"Current customer has not onboarded this business.",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.INVALID
				);
			}

			const records = await getBusinessApplicants(params.businessID, headers.authorization);

			return records;
		} catch (error) {
			throw error;
		}
	}

	async auroraInviteBusiness(body) {
		try {
			const invitationID = uuid();
			const queries = [];
			const values = [];
			const customerID = "7f5134db-ea81-4f93-9d9b-446405320e00";
			const userInfo = { user_id: "4e3806d8-e659-4842-8a24-2e4dbb7df1a0" };

			// allowing email of applicant only
			for (const applicant of body.applicants) {
				const response = await emailExists({ email: applicant.email });
				if (response.email_exists && response.role_id !== ROLE_ID.APPLICANT) {
					throw new BusinessApiError(
						`Cannot onboard ${applicant.email} to the platform. Contact support.`,
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}

			const isMonitoringAllowed = false;
			const businessID = uuid();

			// mobile number consistency
			if (body.new_business.mobile) {
				if (!body.new_business.mobile.startsWith("+")) {
					body.new_business.mobile = `+1${body.new_business.mobile}`;
				}
				body.new_business.mobile = `+${formatNumberWithoutPlus(body.new_business.mobile)}`;
			}

			const insertBusinessQuery = `INSERT INTO data_businesses (id, name, mobile, status, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6)`;
			const insertRelQuery = `INSERT INTO rel_business_customer_monitoring (business_id, customer_id, is_monitoring_enabled, created_by) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, customer_id) DO NOTHING`;
			const insertInviteQuery = `INSERT INTO data_invites (id, business_id, customer_id, status, created_by, updated_by) VALUES ($1, $2, $3, (SELECT id FROM core_invite_statuses WHERE code = $4), $5, $6)`;
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
				[invitationID, businessID, customerID, "invited", userInfo.user_id, userInfo.user_id],
				[invitationID, "invited", userInfo.user_id]
			);

			await sqlTransaction(queries, values);
			const isFlagActive = await getFlagValue(FEATURE_FLAGS.WIN_1098_VALIDATE_DATA_PERMISSION);
			if (isFlagActive) {
				await redis.sadd(`{customer}:${customerID}:businesses`, businessID);
			}

			const message = {
				business_name: body.new_business.name,
				business_id: businessID,
				invitation_id: invitationID,
				customer_id: customerID,
				customer_user_id: userInfo.user_id,
				create_business: true,
				applicants: body.applicants
			};

			const response = await inviteApplicant(message);

			const auditMessage: any = {
				business_name: message.business_name,
				invitation_id: invitationID,
				applicant_email: body.applicants[0].email,
				customer_user_id: userInfo.user_id,
				business_id: message.business_id
			};

			// Create an audit log
			producer.send({
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

			const businessApplicants = await getBusinessApplicantsForWebhooks(message.business_id);

			// TODO: add business.created event
			// send webhook msg
			await sendWebhookEvent(customerID, WEBHOOK_EVENTS.ONBOARDING_INVITED, {
				...message,
				status: "INVITED",
				business_applicants: businessApplicants
			});

			logger.info(`Adding job for business invitation ${invitationID} to bull queue.`);
			const jobBody = { invitation_id: invitationID, customer_id: customerID, business_id: message.business_id };
			invitationStatusQueue.addJob(QUEUE_EVENTS.INVITATION_STATUS_UPDATE, jobBody, {
				jobId: invitationID,
				delay: tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS * 1000
			});

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Validates an invitationToken
	 * @param {object} params
	 * @returns {object} response (business_id, applicant_id, invitation_id)
	 */
	async verifyInvitationToken(params) {
		const {
			business_id,
			applicant_id,
			invitation_id,
			email,
			is_no_login,
			customer_id,
			is_lightning_verification,
			is_guest_owner
		} = await _validateInvitationToken(params.invitationToken);
		return {
			business_id,
			applicant_id,
			invitation_id,
			email,
			is_no_login,
			customer_id,
			is_lightning_verification,
			is_guest_owner
		};
	}

	/**
	 * Accepts an invitation and updates the db
	 * @param {object} body
	 * @returns {object} response (business_id, applicant_id, invitation_id)
	 */
	async updateInvitationStatus(body, userInfo) {
		let invitationID = "";
		let inviteStatus = "";
		let businessID = "";
		let customerID = "";
		let caseID = "";
		if (Object.hasOwn(body, "invitation_token")) {
			const response = await _validateInvitationToken(body.invitation_token);
			if (userInfo.email !== response.email) {
				throw new BusinessApiError(
					"You are not authorized to accept this invitation. Login from the recipient email of this invite",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			// { business_id, applicant_id, invitation_id, status }

			// call auth with email and compare user_ids
			invitationID = response.invitation_id;
			inviteStatus = response.status;
			businessID = response.business_id;
			customerID = response.customer_id;
			caseID = response.case_id;
		} else if (Object.hasOwn(body, "invitation_id")) {
			const getDataInvitesQuery = `SELECT core_invite_statuses.code as invitation_status, data_invites.business_id, data_invites.customer_id, data_invites.case_id FROM data_invites
			LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE data_invites.id = $1 AND db.is_deleted = false`;

			const invite = await sqlQuery({ sql: getDataInvitesQuery, values: [body.invitation_id] });

			if (!invite.rowCount) {
				throw new BusinessApiError("Invitation doesn't exist.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			invitationID = body.invitation_id;
			inviteStatus = invite.rows[0].invitation_status;
			businessID = invite.rows[0].business_id;
			customerID = invite.rows[0].customer_id;
			caseID = invite.rows[0].case_id;
		}

		if (body.action === "ACCEPT") {
			if (["accepted", "completed"].includes(inviteStatus)) {
				return { message: "This invite has already been accepted" };
			} else if (inviteStatus === "rejected") {
				throw new BusinessApiError(
					"This invite was already rejected, can't take this action",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
		} else if (body.action === "COMPLETE") {
			if (inviteStatus === "completed") {
				return { message: "This invite has already been completed" };
			} else if (inviteStatus !== "accepted") {
				throw new BusinessApiError(
					"Only an accepted invite can be completed.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
		}

		const actionToStatusMapping = {
			ACCEPT: "accepted",
			REJECT: "rejected",
			COMPLETE: "completed"
		};

		const updateInviteQuery = `UPDATE data_invites
			SET status = (SELECT id FROM core_invite_statuses WHERE code = $1),
			action_taken_by = $2
			WHERE id = $3`;
		const updateInviteValues = [actionToStatusMapping[body.action], userInfo.user_id, invitationID];

		const insertHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status, created_by)
			VALUES ( $1, (SELECT id FROM core_invite_statuses WHERE code = $2), $3 )`;
		const insertHistoryValues = [invitationID, actionToStatusMapping[body.action], userInfo.user_id];

		await sqlTransaction([updateInviteQuery, insertHistoryQuery], [updateInviteValues, insertHistoryValues]);

		const payload = {
			applicant_id: userInfo.user_id,
			case_id: caseID,
			business_id: businessID,
			status: body.action
		};

		if (body.action === "ACCEPT") {
			/*
			 * update mobile if required
			 */

			// send webhook msg
			await sendWebhookEvent(customerID, WEBHOOK_EVENTS.ONBOARDING_INVITE_ACCEPTED, {
				...payload,
				status: "ACCEPTED"
			});
			if (caseID) {
				void onboarding.createBusinessCustomFieldValuesForInvite(invitationID).catch(_err => {
					/* swallow */
				});
			}
			return { message: "Invitation Accepted" };
		} else if (body.action === "COMPLETE") {
			/*
			 * kafka message or something to mark as in progress and case as submitted
			 */

			const businessApplicants = await getBusinessApplicantsForWebhooks(payload.business_id);

			// send webhook msg
			await sendWebhookEvent(customerID, WEBHOOK_EVENTS.ONBOARDING_INVITE_COMPLETED, {
				...payload,
				status: "COMPLETED",
				business_applicants: businessApplicants
			});
			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: payload.business_id });

			return { message: "Invitation completed" };
		}
		return { message: "Success" };
	}

	/*
	 * This function is used to retrieve the business and owner information that will be used for tax-status consent
	 * @param {object} params
	 * @returns {object} response
	 */
	async getBusinessDetails(params: Object, userInfo: UserInfo) {
		try {
			const hasPermission: boolean = await hasDataPermission(userInfo, CORE_PERMISSIONS.READ_PII_DATA);

			const getBusinessQuery = `SELECT name as business_name, tin, data_businesses.address_line_1, data_businesses.address_city,
				data_businesses.address_state, data_businesses.address_postal_code, data_businesses.mobile, data_businesses.address_country as business_country,
				data_owners.first_name, data_owners.last_name, data_owners.email, data_owners.ssn, data_owners.mobile as owner_mobile, data_owners.address_country as owner_country, core_owner_titles.title,
				json_build_object('rel_business_customer_monitoring', rel_business_customer_monitoring) as rel_business_customer_monitoring_json
				FROM data_businesses
				LEFT JOIN rel_business_owners ON rel_business_owners.business_id = data_businesses.id
				LEFT JOIN data_owners ON data_owners.id = rel_business_owners.owner_id
				LEFT JOIN core_owner_titles ON data_owners.title = core_owner_titles.id
				LEFT JOIN rel_business_customer_monitoring ON rel_business_customer_monitoring.business_id = data_businesses.id
				WHERE data_businesses.id = $1`;

			const getBusinessResult = await sqlQuery({ sql: getBusinessQuery, values: [params.businessID] });

			if (!getBusinessResult.rowCount) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			if (Object.hasOwn(getBusinessResult.rows[0], "tin") && getBusinessResult.rows[0].tin) {
				if (hasPermission) {
					getBusinessResult.rows[0].tin = decryptEin(getBusinessResult.rows[0].tin);
				} else {
					getBusinessResult.rows[0].tin = null;
				}
			}
			if (Object.hasOwn(getBusinessResult.rows[0], "ssn") && getBusinessResult.rows[0].ssn) {
				if (hasPermission) {
					getBusinessResult.rows[0].ssn = decryptEin(getBusinessResult.rows[0].ssn);
				} else {
					getBusinessResult.rows[0].ssn = null;
				}
			}

			getBusinessResult.rows[0].rel_business_customer_monitoring =
				getBusinessResult.rows[0].rel_business_customer_monitoring_json.rel_business_customer_monitoring;
			delete getBusinessResult.rows[0].rel_business_customer_monitoring_json;

			return getBusinessResult.rows[0];
		} catch (error) {
			throw error;
		}
	}

	/**
	 * sets monitoring status of a business for a customer
	 * @param {string} body.business_id
	 * @param {string} body.customer_id
	 * @param {Boolean} body.enable_monitoring
	 */
	async setBusinessMonitoring(body: Object) {
		const setBusinessMonitoring = `UPDATE rel_business_customer_monitoring SET is_monitoring_enabled = $3 WHERE business_id = $1 AND customer_id = $2`;

		await sqlQuery({
			sql: setBusinessMonitoring,
			values: [body.business_id, body.customer_id, body.enable_monitoring]
		});
	}

	/**
	 * This function checks and returns case id for given business-id
	 * @param body{object}
	 * @param params{object}
	 * @param userInfo{object}
	 * @returns caseID
	 * @deprecated
	 */
	async startApplication(body: { invitation_id: string }, { businessID }: any, userInfo: any) {
		try {
			// checking business status
			const getBusinessDetailsQuery = `SELECT * FROM data_businesses WHERE id = $1`;
			const getBusinessDetailsResult = await sqlQuery({ sql: getBusinessDetailsQuery, values: [businessID] });

			if (!getBusinessDetailsResult.rowCount) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			if (getBusinessDetailsResult.rows[0].status !== BUSINESS_STATUS.VERIFIED) {
				throw new BusinessApiError(
					"Your business is not verified. Please verify to continue.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			let caseDetails: Object;

			if (Object.hasOwn(body, "invitation_id")) {
				const getInviteByIDQuery = `SELECT data_invites.* FROM data_invites
				LEFT JOIN data_businesses db ON db.id = data_invites.business_id
				WHERE data_invites.id = $1 AND db.is_deleted = false`;
				const inviteDetails = await sqlQuery({ sql: getInviteByIDQuery, values: [body.invitation_id] });

				if (!inviteDetails.rowCount) {
					throw new BusinessApiError("Invite not found", StatusCodes.NOT_FOUND, ERROR_CODES.INVALID);
				}

				// TODO : Do something about this check at the bottom
				// if (inviteDetails.rows[0].business_id !== businessID){
				// 	throw new BusinessApiError("This invite does not belong to the current business", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
				// }

				if (Object.hasOwn(inviteDetails.rows[0], "case_id") && inviteDetails.rows[0].case_id !== null) {
					const getCaseQuery = `SELECT code as case_status FROM data_cases
						LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status
						LEFT JOIN data_businesses db ON db.id = data_cases.business_id
						WHERE data_cases.id = $1 AND db.is_deleted = false`;
					const getCaseQueryResult = await sqlQuery({ sql: getCaseQuery, values: [inviteDetails.rows[0].case_id] });
					return {
						case_id: inviteDetails.rows[0].case_id,
						case_status: getCaseQueryResult.rows[0].case_status
					};
				} else {
					caseDetails = inviteDetails.rows[0];
				}

				businessID = inviteDetails.rows[0].business_id;
				// TODO: add check for : If userInfo.user_id beongs in rel_invite_applicants
			} else {
				const getCaseIDQuery = `SELECT data_cases.id AS case_id, data_cases.business_id, code as case_status FROM data_cases
					LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status
					LEFT JOIN data_businesses db ON db.id = data_cases.business_id
					WHERE business_id = $1 AND customer_id IS null AND db.is_deleted = false`;
				const caseResult = await sqlQuery({ sql: getCaseIDQuery, values: [businessID] });

				if (caseResult.rowCount) {
					return {
						business_id: businessID,
						case_id: caseResult.rows[0].case_id,
						case_status: caseResult.rows[0].case_status
					};
				} else {
					caseDetails = caseResult.rows[0];
				}
			}

			// get case type id of ONBOANRDING
			const caseTypes = await sqlQuery({ sql: `SELECT id FROM core_case_types WHERE code = 'onboarding'` });
			const onboardingCaseTypeID = caseTypes.rows[0].id;

			// Updating or inserting a new case-id and returning it
			const caseID = uuid();

			// Fetch cached application edit invite for guest owner applicant ID resolution
			const cachedApplicationEditInvite = await caseManager.getCachedApplicationEditInvite(
				caseID,
				caseDetails?.customer_id
			);

			if (Object.hasOwn(body, "invitation_id")) {
				const insertCaseQuery = `INSERT INTO data_cases(id, applicant_id, customer_id, business_id, status, created_by, updated_by, case_type)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
				const insertCaseHistoryQuery = `INSERT INTO data_case_status_history (case_id, status,created_by)
					VALUES ($1, $2, $3)`;
				const updateInviteQuery = `UPDATE data_invites SET case_id = $1 WHERE id = $2`;

				await sqlTransaction(
					[insertCaseQuery, insertCaseHistoryQuery, updateInviteQuery],
					[
						[
							caseID,
							userInfo.user_id,
							caseDetails.customer_id,
							caseDetails.business_id,
							CASE_STATUS.ONBOARDING,
							userInfo.user_id,
							userInfo.user_id,
							onboardingCaseTypeID
						],
						[caseID, CASE_STATUS.ONBOARDING, userInfo.user_id],
						[caseID, body.invitation_id]
					]
				);

				await this.updateInvitationStatus({ invitation_id: body.invitation_id, action: "ACCEPT" }, userInfo);

				const message = {
					case_id: caseID,
					business_id: caseDetails.business_id,
					customer_id: caseDetails.customer_id,
					applicant_id: userInfo.user_id
				};

				const auditMessage = {
					case_id: caseID,
					business_name: getBusinessDetailsResult.rows[0].name,
					applicant_id: resolveApplicantIdForAudit({
						userInfo,
						cachedApplicationEditInvite
					}),
					business_id: businessID
				};

				/**
				 * This event is emitted after user accepts the invitation.
				 * This event would be consumed by integration service to fill up connections and integrations entries for this business
				 */
				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.BUSINESS_INVITE_ACCEPTED,
								...message
							}
						}
					]
				});
				// Create an audit log
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
			} else {
				const insertCaseQuery = `INSERT INTO data_cases(id, applicant_id, business_id, status, created_by, updated_by, case_type)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`;
				const insertCaseHistoryQuery = `INSERT INTO data_case_status_history (case_id, status, created_by)
				VALUES ($1, $2, $3)`;
				const insertCaseValues = [
					caseID,
					userInfo.user_id,
					businessID,
					CASE_STATUS.ONBOARDING,
					userInfo.user_id,
					userInfo.user_id,
					onboardingCaseTypeID
				];
				await sqlTransaction(
					[insertCaseQuery, insertCaseHistoryQuery],
					[insertCaseValues, [caseID, CASE_STATUS.ONBOARDING, userInfo.user_id]]
				);

				const message = {
					case_id: caseID,
					business_id: businessID,
					applicant_id: userInfo.user_id
				};

				const auditMessage = {
					case_id: caseID,
					business_name: getBusinessDetailsResult.rows[0].name,
					applicant_id: resolveApplicantIdForAudit({
						userInfo,
						cachedApplicationEditInvite
					}),
					business_id: businessID
				};

				/**
				 * This event is emitted after user accepts the invitation.
				 * This event would be consumed by integration service to fill up connections and integrations entries for this business
				 */
				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.BUSINESS_INVITE_ACCEPTED,
								...message
							}
						}
					]
				});

				// Create an audit log
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

			return {
				case_id: caseID,
				business_id: businessID,
				case_status: CASE_STATUS_ENUM.ONBOARDING
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Submits a case given a case ID. If the given case ID is not the standalone case and the standalone case is either not created or not submitted, then this api would auto create and auto submit the standalone case as well
	 * This is done so that the applicant doesn't have to resubmit the standalone case once they have submitted any other type of case (for instance an invite case).
	 * @param {uuid} params.businessID
	 * @param {uuid} params.caseID
	 * @param userInfo
	 */
	async submitCase(
		params: { businessID: string; caseID: string },
		userInfo: { user_id: any; is_guest_owner?: any },
		headers: { authorization: any }
	) {
		try {
			const { businessID, caseID } = params;
			const result = await getBusinessApplicantByApplicantId(businessID, userInfo.user_id);
			if ((!Array.isArray(result) || !result.some(obj => obj?.code === "owner")) && !userInfo?.is_guest_owner) {
				throw new BusinessApiError(
					"User does not have permission to submit the application.",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.INVALID
				);
			}

			const getCaseQuery = `SELECT * FROM data_cases WHERE id = $1`;
			let standaloneCaseQuery = `SELECT * FROM data_cases WHERE business_id = $1 AND customer_id IS NULL`;
			let standaloneCaseValues = [businessID];
			if (!userInfo?.is_guest_owner) {
				standaloneCaseQuery += ` AND applicant_id = $2`;
				standaloneCaseValues.push(userInfo.user_id);
			}
			const invitedCaseQuery = `SELECT data_invites.* FROM data_invites
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE case_id = $1 AND db.is_deleted = false`;
			const getBusinessDetailsQuery = `SELECT * FROM data_businesses WHERE id = $1 AND is_deleted = false`;
			const [standaloneCase, invitedCase, currentCase, getBusinessDetailsResult] = await sqlTransaction(
				[standaloneCaseQuery, invitedCaseQuery, getCaseQuery, getBusinessDetailsQuery],
				[standaloneCaseValues, [caseID], [caseID], [businessID]]
			);

			const progressionConfig = await this.getProgressionConfig(currentCase.rows?.[0]?.customer_id);
			let isTINRequired = await this.getTinRequirementStatus(progressionConfig, headers?.authorization);

			// Fetch cached application edit invite for guest owner applicant ID resolution
			const cachedApplicationEditInvite = await caseManager.getCachedApplicationEditInvite(
				caseID,
				currentCase.rows?.[0]?.customer_id
			);

			if (!isUSBusiness(getBusinessDetailsResult.rows?.[0].address_country)) {
				isTINRequired = false;
			}
			// If easyFlow is false, then check to see if the TIN is required for the onboarding configuration for the customer
			if (isTINRequired) {
				logger.debug(
					`isTINRequired=${isTINRequired} for customer=${currentCase.rows?.[0]?.customer_id} based upon onboarding configuration`
				);
			}

			if (!getBusinessDetailsResult.rowCount) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			// TODO: currently we are submitting case partial for guest owner IN Future we can add a is_partial_submission_allowed in progression config
			if (
				!userInfo.is_guest_owner &&
				isTINRequired &&
				getBusinessDetailsResult.rows[0].status !== BUSINESS_STATUS.VERIFIED
			) {
				throw new BusinessApiError(
					"Your business is not verified. Please verify to continue.",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if (!currentCase.rowCount) {
				throw new BusinessApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			if (businessID !== currentCase.rows[0].business_id) {
				throw new BusinessApiError(
					"This case doesn't belong to the current business",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			switch (currentCase.rows[0].status) {
				case CASE_STATUS.SUBMITTED:
					return { message: "This case has already been submitted." };

				// TODO: remove unnecessary conditions
				case CASE_STATUS.AUTO_APPROVED:
					break;

				case CASE_STATUS.SCORE_CALCULATED:
					break;

				case CASE_STATUS.AUTO_REJECTED:
					break;

				case CASE_STATUS.ONBOARDING:
					break;

				case CASE_STATUS.UNDER_MANUAL_REVIEW:
					break;

				default:
					if (!userInfo?.is_guest_owner) {
						throw new BusinessApiError(
							"Cannot take this action on the current case.",
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					}
			}

			if (invitedCase.rowCount) {
				switch (invitedCase.rows[0].status) {
					case INVITE_STATUS.COMPLETED:
						return { message: "This case has already been submitted." };

					case INVITE_STATUS.ACCEPTED:
						break;

					default:
						if (!userInfo?.is_guest_owner) {
							throw new BusinessApiError(
								"Cannot take this action on the current invite.",
								StatusCodes.BAD_REQUEST,
								ERROR_CODES.INVALID
							);
						}
				}
			}

			let queries = [];
			let values = [];
			let crateCase = false;
			let triggerStandaloneCaseEvent = false;

			const updateCaseStatusQuery = `UPDATE data_cases SET status = $1, updated_by = $2 WHERE id = $3`;
			const insertCaseHistoryQuery = `INSERT INTO data_case_status_history (case_id, status, created_by) VALUES ($1,$2,$3)`;
			const updateInviteStatusQuery = `UPDATE data_invites SET status = $1, updated_by = $2 WHERE id = $3`;
			const insertInviteStatusHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status, created_by) VALUES ($1,$2,$3)`;

			let standaloneCaseID: string;
			if (standaloneCase.rowCount && standaloneCase.rows[0].id === caseID) {
				// current case is the standalone case, update the current case to SUBMITTED
				// update standalone case status to SUBMITTED

				if (
					![CASE_STATUS.AUTO_APPROVED, CASE_STATUS.AUTO_REJECTED, CASE_STATUS.SCORE_CALCULATED].includes(
						currentCase.rows[0].status
					)
				) {
					queries.push(updateCaseStatusQuery);
					values.push([CASE_STATUS.SUBMITTED, userInfo.user_id, caseID]);
				}

				// INSERT standalone case status as SUBMITTED data_case_status_history
				queries.push(insertCaseHistoryQuery);
				values.push([caseID, CASE_STATUS.SUBMITTED, userInfo.user_id]);

				// if current case status is UMR, update its status again to UMR and also make an entry in the case history
				if (currentCase.rows[0].status === CASE_STATUS.UNDER_MANUAL_REVIEW) {
					queries.push(updateCaseStatusQuery, insertCaseHistoryQuery);
					values.push(
						[CASE_STATUS.UNDER_MANUAL_REVIEW, userInfo.user_id, caseID],
						[caseID, CASE_STATUS.UNDER_MANUAL_REVIEW, userInfo.user_id]
					);
				}
			} else if (!standaloneCase.rowCount && !invitedCase.rowCount) {
				throw new BusinessApiError("Case not found", StatusCodes.NOT_FOUND, ERROR_CODES.INVALID);
			} else if (invitedCase.rowCount) {
				// if the current case is an invited case
				if (!standaloneCase.rowCount) {
					// case exists as an invited case, hence create a new standalone case before marking the invited case as submmitted
					// TODO : chek if userInfo.user_id belongs to rel_Applicants_invites

					crateCase = true;

					// create standalone case with status as ONBOARDING
					try {
						const ensure = await caseManagementService.ensureCasesExist(invitedCase.rows[0].business_id, {
							applicantID: userInfo.user_id,
							customerID: invitedCase.rows[0].customer_id,
							inviteID: invitedCase.rows[0].id,
							userInfo
						});
						standaloneCaseID = ensure.standaloneCaseID;
						// update standalone case status to SUBMITTED
						if (
							![
								CASE_STATUS.AUTO_APPROVED,
								CASE_STATUS.SCORE_CALCULATED,
								CASE_STATUS.AUTO_REJECTED,
								CASE_STATUS.UNDER_MANUAL_REVIEW
							].includes(currentCase.rows[0].status)
						) {
							void caseManagementService
								.updateCaseStatus({ caseID: ensure.standaloneCaseID }, { status: CASE_STATUS_ENUM.SUBMITTED }, userInfo)
								.catch(ex => {
									logger.error(
										{ businessID: invitedCase.rows[0].business_id, error: ex },
										"Error updating standalone case status to SUBMITTED for businessID"
									);
								});
						}
					} catch (ex) {
						logger.error(
							{ error: ex },
							`Error creating standalone case for businessID=${invitedCase.rows[0].business_id}`
						);
					}
				} else if (
					standaloneCase.rowCount &&
					(standaloneCase.rows[0].status === CASE_STATUS.ONBOARDING ||
						standaloneCase.rows[0].status === CASE_STATUS.UNDER_MANUAL_REVIEW)
				) {
					// TODO: UMR check should be removed from above once on submit score calculation is enabled
					// both standalone case and invited case exist, but standalone case is not submitted. Then submit both the cases

					// update standalone case status to SUBMITTED
					if (
						![CASE_STATUS.AUTO_APPROVED, CASE_STATUS.SCORE_CALCULATED, CASE_STATUS.AUTO_REJECTED].includes(
							standaloneCase.rows[0].status
						)
					) {
						queries.push(updateCaseStatusQuery);
						values.push([CASE_STATUS.SUBMITTED, userInfo.user_id, standaloneCase.rows[0].id]);
					}

					// INSERT standalone case status as SUBMITTED data_case_status_history
					queries.push(insertCaseHistoryQuery);
					values.push([standaloneCase.rows[0].id, CASE_STATUS.SUBMITTED, userInfo.user_id]);

					// if current case status is UMR, update its status again to UMR and also make an entry in the case history
					if (standaloneCase.rows[0].status === CASE_STATUS.UNDER_MANUAL_REVIEW) {
						queries.push(updateCaseStatusQuery, insertCaseHistoryQuery);
						values.push(
							[CASE_STATUS.UNDER_MANUAL_REVIEW, userInfo.user_id, standaloneCase.rows[0].id],
							[standaloneCase.rows[0].id, CASE_STATUS.UNDER_MANUAL_REVIEW, userInfo.user_id]
						);
					}

					standaloneCaseID = standaloneCase.rows[0].id;
					triggerStandaloneCaseEvent = true;
				} else if (standaloneCase.rowCount && standaloneCase.rows[0].status === "SUBMITTED") {
					// both standalone case and invited case exist, but standalone case is already submitted; then submit the invite case only
				}

				// update invited case status to SUBMITTED
				if (
					![CASE_STATUS.AUTO_APPROVED, CASE_STATUS.SCORE_CALCULATED, CASE_STATUS.AUTO_REJECTED].includes(
						currentCase.rows[0].status
					)
				) {
					queries.push(updateCaseStatusQuery);
					values.push([CASE_STATUS.SUBMITTED, userInfo.user_id, invitedCase.rows[0].case_id]);
				}

				// INSERT invited case status as SUBMITTED data_case_status_history
				queries.push(insertCaseHistoryQuery);
				values.push([invitedCase.rows[0].case_id, CASE_STATUS.SUBMITTED, userInfo.user_id]);

				// if current case status is UMR, update its status again to UMR and also make an entry in the case history
				if (currentCase.rows[0].status === CASE_STATUS.UNDER_MANUAL_REVIEW) {
					queries.push(updateCaseStatusQuery, insertCaseHistoryQuery);
					values.push(
						[CASE_STATUS.UNDER_MANUAL_REVIEW, userInfo.user_id, invitedCase.rows[0].case_id],
						[invitedCase.rows[0].case_id, CASE_STATUS.UNDER_MANUAL_REVIEW, userInfo.user_id]
					);
				}

				// Update invite status to complete
				queries.push(updateInviteStatusQuery);
				values.push([INVITE_STATUS.COMPLETED, userInfo.user_id, invitedCase.rows[0].id]);

				// INSERT invite status as completed in data_invites_history
				queries.push(insertInviteStatusHistoryQuery);
				values.push([invitedCase.rows[0].id, INVITE_STATUS.COMPLETED, userInfo.user_id]);
			}

			await sqlTransaction(queries, values);

			const customerID = currentCase.rows?.[0]?.customer_id;
			if (customerID) {
				// Send webhook event for case status update
				const webhookPayload = await caseManagementService.getCaseStatusUpdatedWebhookPayload(caseID);
				await sendWebhookEvent(customerID, WEBHOOK_EVENTS.CASE_STATUS_UPDATED, {
					...webhookPayload,
					status: CASE_STATUS_ENUM.SUBMITTED
				});
			}

			const message = {
				case_id: caseID
			};

			// event to check if all integrations are successful or not
			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.UPDATE_CASE_STATUS_ONSUBMIT,
							...message
						}
					}
				]
			});

			const caseSubmittedMessage = {
				case_id: caseID,
				business_id: businessID
			};

			// event to let integration svc know that case is submitted
			// then it will check integrations data and trigger event to manual-score svc

			// second event does not costs as it just fetches the connections and already created
			// integration-task-ids and do data fetching for it
			// This kafka event is for pull the integration data for all integration tasks
			// If the status of task is not success.
			// This is mostly usefull for existing onboarded business whose score is already generated, but new applicant
			// is doing the onboarding process and progression will always land user to review. So its not possible to pull data in that flow

			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.CASE_SUBMITTED_EXECUTE_TASKS,
							...caseSubmittedMessage
						}
					}
				]
			});

			// CASE_SUBMITTED event is changed to CASE_STATUS_UPDATED
			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.CASE_STATUS_UPDATED,
							...caseSubmittedMessage,
							case_status: CASE_STATUS_ENUM.SUBMITTED
						}
					}
				]
			});

			if (crateCase) {
				/**
				 * This event is emitted when a standalone case is auto created or we have to make an entry in score service too.
				 * This event would be consumed by integration service to fill up connections and integrations entries for this business and specific case
				 */

				// create new entry and integration tasks in integration service
				const message = {
					case_id: standaloneCaseID,
					business_id: invitedCase.rows[0].business_id,
					applicant_id: userInfo.user_id
				};

				const auditMessage = {
					case_id: caseID,
					business_name: getBusinessDetailsResult.rows[0].name,
					applicant_id: resolveApplicantIdForAudit({
						userInfo,
						cachedApplicationEditInvite
					}),
					business_id: params.businessID
				};

				// Create an audit log
				await producer.send({
					topic: kafkaTopics.NOTIFICATIONS,
					messages: [
						{
							key: params.businessID,
							value: {
								event: kafkaEvents.CASE_CREATED_AUDIT,
								...auditMessage
							},
							headers: { idempotencyID: caseID }
						}
					]
				});

				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: invitedCase?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.BUSINESS_INVITE_ACCEPTED,
								...message
							}
						}
					]
				});

				// starts data fetching for given case with given business-id
				const caseSubmitExecuteTasksMessage = {
					case_id: standaloneCaseID,
					business_id: invitedCase?.rows?.[0]?.business_id
				};

				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: invitedCase?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_SUBMITTED_EXECUTE_TASKS,
								...caseSubmitExecuteTasksMessage
							}
						}
					]
				});
				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: invitedCase?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_STATUS_UPDATED,
								...caseSubmitExecuteTasksMessage,
								case_status: CASE_STATUS_ENUM.SUBMITTED
							}
						}
					]
				});
			} else if (triggerStandaloneCaseEvent) {
				/* This case(else block) is when, the standalone case exists and is in ONBOARDING status and currently applicant is submitting
			the invited case, at that moment we are triggering this event to pull the data for standlone caes. */
				// This kafka event is for pull the integration data for all integration tasks
				// If the status of task is not success.
				// This is mostly usefull whenever are inviting cases as the existing case is already submitted
				// and progression will always land user to review. So its not possible to pull data in that flow

				const caseSubmitExecuteTasksMessage = {
					case_id: standaloneCaseID,
					business_id: invitedCase?.rows?.[0]?.business_id
				};

				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: invitedCase?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_SUBMITTED_EXECUTE_TASKS,
								...caseSubmitExecuteTasksMessage
							}
						}
					]
				});
				await producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: invitedCase?.rows?.[0]?.business_id,
							value: {
								event: kafkaEvents.CASE_STATUS_UPDATED,
								...caseSubmitExecuteTasksMessage,
								case_status: CASE_STATUS_ENUM.SUBMITTED
							}
						}
					]
				});
			}

			let auditMessage = {
				case_id: caseID,
				business_name: getBusinessDetailsResult?.rows?.[0]?.name,
				applicant_id: resolveApplicantIdForAudit({
					userInfo,
					cachedApplicationEditInvite
				}),
				business_id: params.businessID
			};
			// Create an audit log
			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: params.businessID,
						value: {
							event: kafkaEvents.CASE_SUBMITTED_AUDIT,
							...auditMessage
						}
					}
				]
			});

			if (invitedCase.rowCount && invitedCase.rows[0].status === INVITE_STATUS.ACCEPTED) {
				auditMessage = {
					invitation_id: invitedCase.rows[0].id,
					business_name: getBusinessDetailsResult?.rows?.[0]?.name,
					case_id: caseID,
					applicant_id: resolveApplicantIdForAudit({
						userInfo,
						cachedApplicationEditInvite
					}),
					business_id: params.businessID
				};
				// Create an audit log
				await producer.send({
					topic: kafkaTopics.NOTIFICATIONS,
					messages: [
						{
							key: params.businessID,
							value: {
								...auditMessage,
								event: kafkaEvents.INVITATION_COMPLETED_AUDIT,
								applicant_id: auditMessage.applicant_id
							}
						}
					]
				});
			}

			// send webhook msg
			if (invitedCase.rows.length) {
				const customerID = invitedCase.rows[0].customer_id;

				const businessApplicants = await getBusinessApplicantsForWebhooks(params.businessID);

				await sendWebhookEvent(customerID, WEBHOOK_EVENTS.ONBOARDING_INVITE_COMPLETED, {
					...auditMessage,
					status: "COMPLETED",
					customer_id: customerID,
					business_applicants: businessApplicants
				});

				await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: params.businessID });

				await sendEventToFetchAdverseMedia(params.businessID, customerID, invitedCase.rows[0].case_id);
			}
			await calculateBusinessFactsEvent(params.businessID);

			await this.purgeFirstIntegrationKeys(businessID);
			return { message: "Case submitted successfully." };
		} catch (error) {
			throw error;
		}
	}

	async purgeFirstIntegrationKeys(businessID: UUID): Promise<void> {
		const businessKey = `business:${businessID}:first_integration`;

		// Retrieve all first integration keys
		const keys = await redis.smembers(businessKey);
		await redis.deleteMultipleKeys(keys);

		// Delete the business-level tracking key
		await redis.delete(businessKey);
	}

	/**
	 * This function creates an entry in data_businesses table with status as UNVERIFIED
	 * @param {object} body
	 * @param {object} userInfo
	 * @returns {object} applicant_id, business_id
	 */
	async createApplicantBusiness(userInfo) {
		try {
			let businessID = uuid();
			// can we use redis
			const insertBusinessQuery = `INSERT INTO data_businesses (id, status, created_by, updated_by)
				VALUES ($1, $2, $3, $4)`;
			const insertBusinessValues = [businessID, "UNVERIFIED", userInfo.user_id, userInfo.user_id];

			await sqlQuery({ sql: insertBusinessQuery, values: insertBusinessValues });

			return { business_id: businessID };
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function gives business statuses
	 * @returns {array} array of objects representing business statuses
	 */
	async getBusinessStatus() {
		try {
			const getBusinessStatusQuery = `SELECT * FROM core_business_status`;
			const getBusinessStatusResult = await sqlQuery({ sql: getBusinessStatusQuery });

			return getBusinessStatusResult.rows;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function returns all customer business invites
	 * @param {object} body
	 * @param {object} query
	 * @param {object} headers
	 * @returns {object} object representing business invites details along with total invitations and page number
	 */
	async getBusinessInvites(params: any, query: any, headers: object) {
		try {
			// TODO : Need to check for customer_id when customer_id eis embedded in the cognito token
			let pagination = true;

			if (Object.hasOwn(query, "pagination")) {
				pagination = JSON.parse(query.pagination);
			}

			let itemsPerPage: number, page: number;
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

			const allowedSortParams = ["created_at"];
			let sortParam = "created_at";
			let sortParamValue = "DESC";
			if (query.sort) {
				const param = Object.keys(query.sort)[0];
				if (allowedSortParams.includes(param)) {
					sortParam = param;
					sortParamValue = query.sort[sortParam];
				}
			}

			const allowedFilterParams = ["id", "status"];
			let existingFilterParamsValues = [];
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
								item = INVITE_STATUS[item];
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
				}, []);
			}

			let useStrictSearchParams = false;
			const strictSearchParams = ["first_name"];
			const supplementaryStrictSearchParams = ["last_name"];

			// Make sure all search params columns are mentioned here
			const columnSearchBehavior = {
				first_name: "startsWith", // Starts with 'value%'
				last_name: "startsWith"
			};

			const allowedSearchParams = ["first_name", "last_name"];
			let existingSearchParams = [];
			const existingSearchParamsValue = new Set();
			if (query.search) {
				existingSearchParams = Object.keys(query.search).filter(field => allowedSearchParams.includes(field));
				if (existingSearchParams.length) {
					existingSearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();

						if (query.search[field].includes(" ")) {
							useStrictSearchParams = true;
						}
						/*
						 * Split the string on spaces and for each element of the split we trim the value and add those values into the set
						 * Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						 * >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}
						 */

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
			const allowedSupplementarySearchParams = ["last_name"];

			let existingSupplementarySearchParams = [];
			const existingSupplementarySearchParamsValue = new Set();
			if (query.search) {
				existingSupplementarySearchParams = Object.keys(query.search).filter(field =>
					allowedSupplementarySearchParams.includes(field)
				);
				if (existingSupplementarySearchParams.length) {
					existingSupplementarySearchParams.forEach(field => {
						query.search[field] = query.search[field].trim();
						/*
						 * Split the string on spaces and for each element of the split we trim the value and add those values into the set
						 * Example: "John Doe  " -(after splitting on spaces)-> ["John","Doe", " "]
						 * >  ["John","Doe", " "] -(after trimming )-> {"John","Doe"}
						 */

						query.search[field].split(" ").forEach(val => {
							val = escapeRegExp(val.trim());
							if (val !== "" && val !== " ") {
								existingSupplementarySearchParamsValue.add(val);
							}
						});
					});
				}
			}

			const allowedFilterDateParams = ["created_at"];
			let existingFilterDateParamsValues = [];
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
				}, []);
			}

			// Helper function to generate search conditions based on search behavior
			function generateSearchCondition(column, value, searchBehavior) {
				switch (searchBehavior) {
					case "startsWith":
						return `${column} ILIKE '${value}%'`;
					case "contains":
						return `${column} ILIKE '%${value}%'`;
					default:
						return ""; // Handle unsupported search behaviors
				}
			}

			let counter = 1;
			if (existingFilterParamsValues.length) {
				let filter = " AND ";
				counter++;
				filter += existingFilterParamsValues
					.reduce((acc, field) => {
						acc.push(`${field.column} IN (${field.value})`);
						return acc;
					}, [])
					.join(" AND ");
				queryParams += filter;
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

			if (
				(existingSearchParams.length && [...existingSearchParamsValue].length) ||
				(existingSupplementarySearchParams.length && [...existingSupplementarySearchParamsValue].length)
			) {
				let search = "";
				if (counter === 0) {
					search += " WHERE (";
					counter++;
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
				queryParams += search;
			}
			const sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
			queryParams += sort;

			let usersQuery = `SELECT subquery.* FROM
					(SELECT data_invites.*, core_invite_statuses.label AS status FROM data_invites
					LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
					LEFT JOIN data_businesses ON data_businesses.id = data_invites.business_id
					WHERE data_businesses.is_deleted = false AND business_id = $1 AND customer_id = $2 ${queryParams}) subquery`;

			const countQuery = `SELECT COUNT(subquery.id) as totalcount FROM
					(SELECT data_invites.*, core_invite_statuses.label AS status FROM data_invites
					LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
					LEFT JOIN data_businesses ON data_businesses.id = data_invites.business_id
					WHERE data_businesses.is_deleted = false AND business_id = $1 AND customer_id = $2 ${queryParams}) subquery`;

			const count = await sqlQuery({ sql: countQuery, values: [params.businessID, params.customerID] });

			if (!count.rowCount) {
				throw new BusinessApiError("Records not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const totalUsers = count.rows[0].totalcount;
			if (!pagination) {
				itemsPerPage = totalUsers;
			}

			const paginationDetails = paginate(totalUsers, itemsPerPage);

			if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
				throw new BusinessApiError("Page Requested is Out of Max Page Range", StatusCodes.BAD_REQUEST);
			}
			if (pagination) {
				const skip = (page - 1) * itemsPerPage;
				const paginationQuery = ` LIMIT ${itemsPerPage} OFFSET ${skip} `;
				usersQuery += paginationQuery;
			}

			const result = await sqlQuery({ sql: usersQuery, values: [params.businessID, params.customerID] });

			let customerAndBusinessUsersData = await getCustomerAndBusinessUsers(params, headers.authorization);

			let obj = customerAndBusinessUsersData.reduce((acc: any, record: any) => {
				acc[record.id] = {
					id: record.id,
					first_name: record.first_name,
					last_name: record.last_name
				};
				return acc;
			}, {});

			result.rows.forEach((row: any) => {
				if (Object.hasOwn(obj, `${row.created_by}`)) {
					row.invited = {
						id: row.id,
						first_name: obj[row.created_by].first_name,
						last_name: obj[row.created_by].last_name
					};
				}
			});

			return {
				records: result.rows,
				total_pages: Number(paginationDetails.totalPages),
				total_items: Number(paginationDetails.totalItems)
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function returns the invite details
	 * @param {object} inviteID
	 * @returns {object} invite details
	 */
	async getInvitationByID({ invitationID }) {
		try {
			// TODO: need to handle query with rel-tables also
			//dba name information
			const getInviteByIDQuery = `SELECT * FROM data_invites LEFT JOIN data_businesses ON data_businesses.id = data_invites.business_id WHERE data_invites.id = $1 AND data_businesses.is_deleted = false`;
			const getInviteByIDResult = await sqlQuery({ sql: getInviteByIDQuery, values: [invitationID] });

			return getInviteByIDResult.rows[0];
		} catch (error) {
			throw error;
		}
	}

	async getInvitationDetails(query: object, { authorization }) {
		try {
			// TODO : Need to check for customer_id when customer_id is embedded in the cognito token

			let result = {};
			let invitees = [];
			let history = [];

			const getInvitationDetailsQuery = `SELECT data_invites.id, data_invites.created_at, data_invites.created_by,
				core_invite_statuses.label as status
				FROM data_invites
				LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
				LEFT JOIN data_businesses db ON db.id = data_invites.business_id
				WHERE data_invites.id = $1 AND customer_id = $2 AND business_id = $3 AND db.is_deleted = false`;

			const getInvitationApplicantsQuery = `SELECT applicant_id FROM rel_invite_applicants WHERE invitation_id = $1`;

			const getInvitationHistoryQuery = `SELECT data_invites_history.*, core_invite_statuses.label as status
				FROM data_invites_history
				LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites_history.status
				WHERE invitation_id = $1 ORDER BY created_at DESC`;

			const [getInvitationDetails, getInvitationApplicants, getInvitationHistory] = await sqlTransaction(
				[getInvitationDetailsQuery, getInvitationApplicantsQuery, getInvitationHistoryQuery],
				[[query.invitation_id, query.customer_id, query.business_id], [query.invitation_id], [query.invitation_id]]
			);

			if (!getInvitationDetails.rowCount) {
				throw new BusinessApiError("Invitation Not Found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			result = {
				...result,
				invite_details: getInvitationDetails.rows[0]
			};

			const applicantRecords = await getBusinessApplicants(query.business_id, authorization);

			const applicantsObj = getInvitationApplicants.rows.reduce((acc: any, record: any) => {
				acc[record.applicant_id] = {
					applicant_id: record.applicant_id
				};
				return acc;
			}, {});

			if (Array.isArray(getInvitationHistory.rows)) {
				getInvitationHistory.rows.forEach((record: any) => {
					history.push({
						created_at: record.created_at,
						status: record.status
					});
				});
			}

			if (Array.isArray(applicantRecords)) {
				applicantRecords.forEach(record => {
					if (applicantsObj && Object.hasOwn(applicantsObj, `${record.id}`)) {
						if (!invitees.find(item => item.id === record.id)) {
							invitees.push({
								id: record.id,
								first_name: record.first_name,
								last_name: record.last_name,
								email: record.email
							});
						}
					}

					if (record.id === result.invite_details.created_by) {
						result.invite_details = {
							...result.invite_details,
							first_name: record.first_name,
							last_name: record.last_name
						};
					}
				});
			}

			result = {
				...result,
				history,
				invitees
			};

			return result;
		} catch (error) {
			throw error;
		}
	}

	async resendCustomerBusinessInvite(params: any, body: any, userInfo: any) {
		try {
			const lightningVerificationFlag = await getFlagValue(FEATURE_FLAGS.DOS_84_LIGHTNING_VERIFICATION, {
				key: "customer",
				kind: "customer",
				customer_id: params.customerID
			});

			if (body?.is_lightning_verification && !lightningVerificationFlag) {
				throw new BusinessApiError(
					"Lightning verification is not enabled for this customer",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			const isLightningVerification = (lightningVerificationFlag && body?.is_lightning_verification) ?? false;

			const getInviteDetailsQuery = `SELECT data_invites.*, data_businesses.name AS business_name FROM data_invites
				LEFT JOIN data_businesses ON data_businesses.id = data_invites.business_id
				WHERE data_invites.id = $1 AND customer_id = $2 AND business_id = $3 AND data_businesses.is_deleted = false`;

			const getInviteDetails = await sqlQuery({
				sql: getInviteDetailsQuery,
				values: [params.invitationID, params.customerID, params.businessID]
			});

			if (!getInviteDetails.rowCount) {
				throw new BusinessApiError("Invitation not found.", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const inviteStatus = getInviteDetails.rows[0].status;
			if ([INVITE_STATUS.ACCEPTED, INVITE_STATUS.REJECTED, INVITE_STATUS.COMPLETED].includes(inviteStatus)) {
				throw new BusinessApiError("Invite is already accepted");
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
			const insertInviteStatusHistoryQuery = `
				INSERT INTO data_invites_history (invitation_id, status, created_by)
				VALUES ($1, $2, $3)`;

			await sqlTransaction(
				[updateInviteStatusQuery, insertInviteStatusHistoryQuery],
				[
					[INVITE_STATUS.INVITED, userInfo.user_id, params.invitationID],
					[params.invitationID, INVITE_STATUS.INVITED, userInfo.user_id]
				]
			);
			const applicantsData = getInviteApplicants.rows.map(row => row.applicant_id);
			const customerConfig = await onboarding.getCustomerOnboardingStages(
				{ customerID: params.customerID },
				{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
				false
			);
			const loginWithEmailPasswordField = customerConfig
				?.find(row => row.stage.toLowerCase() == "login")
				?.config?.fields?.find(field => field.name.toLowerCase() == "Login with Email & Password".toLowerCase());

			let message = {
				invitation_id: params.invitationID,
				customer_id: params.customerID,
				business_id: params.businessID,
				applicants: applicantsData,
				business_name: getInviteDetails.rows[0].business_name
			};

			// check if this invite is related to a request additional info flow
			const relInviteInfoRequest = await db("public.rel_invites_info_requests")
				.select("data_info_request_id")
				.where("data_invite_id", params.invitationID)
				.first();

			if (relInviteInfoRequest?.data_info_request_id) {
				const customInvite = await db("public.data_invites")
					.leftJoin("data_businesses as db", "db.id", "data_invites.business_id")
					.select("data_invites.metadata", "data_invites.case_id", "data_invites.business_id")
					.where("data_invites.id", params.invitationID)
					.andWhere("db.is_deleted", false)
					.first();

				const customSubject = customInvite?.metadata?.subject;
				const customBody = customInvite?.metadata?.body;
				const caseID = customInvite?.case_id;
				const businessID = customInvite?.business_id;

				if (customSubject && customBody && caseID && businessID) {
					// Fetch applicants details for generating invite links
					const businessApplicants = (await getBusinessApplicants(businessID)) || [];
					const applicants = businessApplicants.filter(applicant => applicant.id !== envConfig.ENTERPRISE_APPLICANT_ID);

					// Get stage names from data_cases_info_requests
					const infoRequestDetails = await db("public.data_cases_info_requests")
						.select("stages")
						.where("id", relInviteInfoRequest.data_info_request_id)
						.first();
					const stageNames = infoRequestDetails?.stages?.join(", ");

					const customerData = await getCustomerData(params.customerID);

					const messagesForAdditionalInfo = applicants.map(applicant => {
						const inviteToken = {
							user_id: applicant.id,
							subrole_id: applicant.subrole_id,
							applicant_id: applicant.id,
							applicant_name: `${applicant.first_name} ${applicant.last_name}`,
							email: applicant.email,
							first_name: applicant.first_name,
							last_name: applicant.last_name,
							invitation_id: params.invitationID,
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
							caseID
						)}&customer_name=${encodeURIComponent(
							customerData?.company_details?.name
						)}&business_name=${encodeURIComponent(getInviteDetails.rows[0].business_name)}`;

						return {
							key: businessID,
							value: {
								event: kafkaEvents.ADDITIONAL_INFORMATION_REQUEST_NOTIFICATION,
								customer_id: params.customerID,
								applicant_id: applicant.id,
								stage_name: stageNames,
								email: applicant.email,
								case_id: caseID,
								business_id: businessID,
								subject: customSubject,
								body: customBody,
								invite_link: inviteLink
							}
						};
					});

					const customPayload = {
						topic: kafkaTopics.NOTIFICATIONS,
						messages: messagesForAdditionalInfo
					};

					await producer.send(customPayload);
					return {}; // Return early as the specific additional info flow is handled
				}
			}

			if (loginWithEmailPasswordField && !loginWithEmailPasswordField?.status) {
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
						key: params.customerID,
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
			const invitationExpiryTime =
				loginWithEmailPasswordField && !loginWithEmailPasswordField?.status
					? tokenConfig.NO_LOGIN_VERIFY_EMAIL_INVITE_TOKEN_LIFE_SECONDS
					: tokenConfig.VERIFY_EMAIL_TOKEN_LIFE_SECONDS;
			const jobBody = {
				invitation_id: params.invitationID,
				customer_id: params.customerID,
				business_id: params.businessID
			};
			await invitationStatusQueue.addJob(QUEUE_EVENTS.INVITATION_STATUS_UPDATE, jobBody, {
				jobId: params.invitationID,
				delay: invitationExpiryTime * 1000
			});
			return {};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function is lists the invitation received by an applicant
	 * @param params{applicantID}
	 * @returns array of object
	 */
	async getApplicantBusinessInvites(params: object, query: object, userInfo: any) {
		try {
			if (userInfo.user_id !== params.applicantID) {
				throw new BusinessApiError("Invalid user", StatusCodes.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
			}

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

			const getApplicantBusinessInvitesQuery = `SELECT data_invites.id, data_invites.created_at, core_invite_statuses.label as status, data_invites.customer_id
				FROM rel_invite_applicants
				LEFT JOIN data_invites ON data_invites.id = rel_invite_applicants.invitation_id
				LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
				LEFT JOIN data_businesses ON data_businesses.id = data_invites.business_id
				WHERE data_businesses.is_deleted = false AND rel_invite_applicants.applicant_id = $1 AND data_invites.customer_id IS NOT NULL ${queryParams}`;

			const getApplicantBusinessInvitesResult = await sqlQuery({
				sql: getApplicantBusinessInvitesQuery,
				values: [params.applicantID]
			});

			if (!getApplicantBusinessInvitesResult.rowCount) {
				return {
					records: [],
					total_items: 0
				};
			}

			let obj = getApplicantBusinessInvitesResult.rows.reduce((acc: any, record: any) => {
				acc[record.customer_id] = {
					invitation_id: record.id,
					created_at: record.created_at,
					status: record.status
				};
				return acc;
			}, {});

			const userBody = {
				filter: {
					"data_customers.id": Object.keys(obj)
				}
			};

			let userData = await getCustomersInternal(userBody);

			userData.records.forEach((record: any) => {
				if (Object.hasOwn(obj, `${record.customer_details.id}`)) {
					obj[record.customer_details.id] = {
						...obj[record.customer_details.id],
						customer_name: record.customer_details.name
					};
				}
			});

			const records = Object.values(obj);
			return {
				records,
				total_items: records.length
			};
		} catch (error) {
			throw error;
		}
	}

	/**
	 * @params {object, object}
	 * @returns {}
	 * This function gets progress of an applicant
	 */
	async getProgression(params, query, userInfo: UserInfo, { authorization }) {
		try {
			let customerID;
			let checkValidInvitation;
			let eSignTemplatesAssigned: string[] = [];
			const isGuestOwner = userInfo?.is_guest_owner;
			if (isGuestOwner && !query?.invitation_id) {
				throw new BusinessApiError(
					"You are not allowed to access this business without invitation id",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.NOT_ALLOWED
				);
			}

			if (Object.hasOwn(query, "invitation_id")) {
				const checkValidInvitationQuery = `SELECT data_invites.* FROM data_invites
				LEFT JOIN data_businesses db ON db.id = data_invites.business_id
				WHERE business_id = $1 AND data_invites.id = $2 AND db.is_deleted = false`;
				checkValidInvitation = await sqlQuery({
					sql: checkValidInvitationQuery,
					values: [params.businessID, query.invitation_id]
				});

				if (!checkValidInvitation.rowCount) {
					throw new BusinessApiError(
						"Invitation is not linked with this business",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
				customerID = checkValidInvitation.rows[0].customer_id;
				eSignTemplatesAssigned = checkValidInvitation.rows[0]?.metadata?.esign_templates || [];
			}
			const records = await getBusinessApplicants(params.businessID, authorization);
			const applicants = records.map(applicant => applicant.id);

			if (!applicants.includes(userInfo.user_id)) {
				throw new BusinessApiError(
					"You are not allowed to access details of this business",
					StatusCodes.UNAUTHORIZED,
					ERROR_CODES.UNAUTHENTICATED
				);
			}

			const isEasyFlow = await getFlagValueByToken(FEATURE_FLAGS.WIN_1152_EASY_ONBOARDING_FLOW, { authorization });

			const isAdditionalFieldsValidationEnabled = customerID
				? await getFlagValue(FEATURE_FLAGS.DOS_945_EDIT_REQUIRED_UNPREFILLED_FIELDS, {
						key: "customer",
						kind: "customer",
						customer_id: customerID
					})
				: false;

			const depositAccountDetails = await fetchDepositAccountInfo(params.businessID);

			const getBusinessAndOwnershipQuery = `SELECT json_build_object('data_businesses', data_businesses,
						'naics_code', cnc.code,
						'naics_title', cnc.label,
        				'mcc_code', cmc.code,
                        'mcc_title', cmc.label) as business_json,
			json_build_object('industry_data', core_business_industries) as industry_json,
			json_build_object('data_owners', data_owners) as owners_json,
			json_build_object('rel_business_owners', rel_business_owners) as owners_percentage_json
			FROM data_businesses
			LEFT JOIN rel_business_owners ON rel_business_owners.business_id = data_businesses.id
			LEFT JOIN data_owners ON rel_business_owners.owner_id = data_owners.id
			LEFT JOIN core_business_industries ON data_businesses.industry = core_business_industries.id
			LEFT JOIN core_mcc_code cmc ON cmc.id = data_businesses.mcc_id
			LEFT JOIN core_naics_code cnc ON cnc.id = data_businesses.naics_id
			WHERE data_businesses.id = $1`;

			let getCaseQuery = `SELECT data_cases.id, core_case_statuses.code as status_code FROM data_cases LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status WHERE business_id = $1 AND customer_id IS NULL ORDER BY created_at DESC LIMIT 1`;
			let getCaseValue = [params.businessID];
			if (Object.hasOwn(query, "invitation_id")) {
				getCaseQuery = `SELECT data_cases.id, core_case_statuses.code as status_code, data_invites.customer_id FROM data_invites
												LEFT JOIN data_cases ON data_invites.case_id = data_cases.id
												LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status
												LEFT JOIN data_businesses db ON db.id = data_invites.business_id
												WHERE data_invites.business_id = $1 AND data_invites.id = $2 AND db.is_deleted = false`;
				getCaseValue = [params.businessID, query.invitation_id];
			}

			const getAllBusinessNamesQuery = `SELECT data_business_names.id, data_business_names.name, data_business_names.is_primary
				FROM data_business_names
				LEFT JOIN data_businesses db ON db.id = data_business_names.business_id
				WHERE business_id = $1 AND db.is_deleted = false`;
			const getAllBusinessAddresses = `SELECT id, line_1, apartment, city, state, country, postal_code, mobile, is_primary
				FROM data_business_addresses WHERE business_id = $1`;

			const setupCodes = [
				CUSTOM_ONBOARDING_SETUP.POST_SUBMISSION_EDITING_SETUP,
				CUSTOM_ONBOARDING_SETUP.INTERNATIONAL_BUSINESS_SETUP
			];

			// (i + 2) starts from $2 instead of $1 because $1 is already used for customerID
			const placeholders = setupCodes.map((_, i) => `$${i + 2}`).join(", ");

			const getCustomerOnboardingSetupsQuery = `SELECT rcss.is_enabled, cost.code FROM onboarding_schema.rel_customer_setup_status rcss
			LEFT JOIN onboarding_schema.core_onboarding_setup_types cost ON cost.id = rcss.setup_id
			WHERE rcss.customer_id = $1
			AND cost.code IN (${placeholders})`;

			const getCustomerOnboardingSetupsValues = [customerID, ...setupCodes];

			let [
				businessAndOwnerDetails,
				caseDetails,
				getAllBusinessNamesResult,
				getAllBusinessAddressesResult,
				getCustomerOnboardingSetupsResult
			] = await sqlTransaction(
				[
					getBusinessAndOwnershipQuery,
					getCaseQuery,
					getAllBusinessNamesQuery,
					getAllBusinessAddresses,
					getCustomerOnboardingSetupsQuery
				],
				[[params.businessID], getCaseValue, [params.businessID], [params.businessID], getCustomerOnboardingSetupsValues]
			);
			let progressionConfig = await this.getProgressionConfig(customerID);

			// Temporarily extract RFI stage so it doesn't interfere with fragile custom fields logic
			// which assumes Review is the absolute last stage in the array.
			const rfiStageIndex = progressionConfig.findIndex(s => s.stage === "rfi");
			let rfiStage = null;
			if (rfiStageIndex !== -1) {
				rfiStage = progressionConfig.splice(rfiStageIndex, 1)[0];
			}

			let progressionType = "regular";
			if (Object.hasOwn(query, "invitation_id") && query.invitation_id) {
				const infoRequestResult = await db("public.rel_invites_info_requests")
					.select("data_info_request_id")
					.where({ data_invite_id: query.invitation_id })
					.first();
				if (infoRequestResult?.data_info_request_id) {
					const getNewProgressionResult = await db("public.data_cases_info_requests")
						.select("*")
						.where({ id: infoRequestResult.data_info_request_id });
					if (!getNewProgressionResult || !getNewProgressionResult.length) {
						throw new BusinessApiError(
							"No Additional Information Request Found",
							StatusCodes.NOT_FOUND,
							ERROR_CODES.NOT_FOUND
						);
					}
					if (getNewProgressionResult[0].status === CASE_INFO_REQUESTS.REQUESTED) {
						progressionConfig = getNewProgressionResult[0].progression_config;
						progressionType = "additional_info_requested";
					} else {
						progressionType = "additional_info_updated";
					}
				}
			}

			// check if TIN is required based on the progression config
			let isTinRequired: boolean = true;
			let requireTinResponse: boolean = true;
			let continueWithUnverifiedTin: boolean = false;
			let submitWithUnverifiedTin: boolean = false;
			// Fetch customer onboarding details to see the tin status (required/optional) -- defaults to false
			const tinField = progressionConfig
				?.find(row => row.stage.toLowerCase() == "company")
				?.config?.fields?.find(
					field => field.name.toLowerCase() == "Tax ID Number/Employer Identification Number".toLowerCase()
				);
			isTinRequired = tinField?.status == "Required" ? true : false;
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
				`businessId: ${params.businessID} isTinRequired: ${isTinRequired} requireTinResponse: ${requireTinResponse} continueWithUnverifiedTin ${continueWithUnverifiedTin} submitWithUnverifiedTin ${submitWithUnverifiedTin}`
			);

			// Fetch customer onboarding details to see if upload documents option enabled
			let isUploadDocumentEnabled = false;
			let minNumberOfStatementsRequired = "2";
			const uploadDocumentField = progressionConfig
				?.find(row => row.stage.toLowerCase() == "accounting")
				?.config?.fields?.find(field => field.name.toLowerCase() == "Upload Documents".toLowerCase());
			isUploadDocumentEnabled = uploadDocumentField?.status;
			minNumberOfStatementsRequired =
				uploadDocumentField?.sub_fields?.find(
					subField => subField.name.toLowerCase() == "# of Statements Required".toLowerCase()
				)?.status || "2";

			// Fetch customer onboarding details to see if upload bank statements option enabled
			let isUploadStatementEnabled = false;
			let minNumberOfBankStatementsRequired = "2";
			const uploadStatementField = progressionConfig
				?.find(row => row.stage.toLowerCase() == "banking")
				?.config?.fields?.find(field => field.name.toLowerCase() == "Upload Statements".toLowerCase());
			isUploadStatementEnabled = uploadStatementField?.status;
			minNumberOfBankStatementsRequired =
				uploadStatementField?.sub_fields?.find(
					subField => subField.name.toLowerCase() == "# of Statements Required".toLowerCase()
				)?.status || "2";

			let customerOnboardingSetups = [];
			let caseID = "";
			let caseStatus = "";
			let isSubmitted = false;

			if (getCustomerOnboardingSetupsResult && getCustomerOnboardingSetupsResult.rowCount) {
				customerOnboardingSetups = getCustomerOnboardingSetupsResult.rows;
			} else {
				customerOnboardingSetups = setupCodes.map(code => ({
					code,
					is_enabled: false
				}));
			}

			if (caseDetails.rowCount) {
				caseID = caseDetails.rows[0].id;
				caseStatus = caseDetails.rows[0].status_code;
				if (!customerID) {
					customerID = caseDetails.rows[0].customer_id;
				}
				const getCaseHistoryQuery = `SELECT EXISTS (
														SELECT 1
														FROM data_case_status_history dcsh
														LEFT JOIN core_case_statuses ccs ON ccs.id = dcsh.status
														WHERE dcsh.case_id = $1
														AND ccs.code = $2
														LIMIT 1) AS status_submitted_exists`;
				const caseHistory = await sqlQuery({ sql: getCaseHistoryQuery, values: [caseID, CASE_STATUS_ENUM.SUBMITTED] });
				isSubmitted = caseHistory.rows[0].status_submitted_exists;
			}

			let templateExsits = true;
			if (Object.hasOwn(query, "invitation_id")) {
				const getTemplateQuery = `SELECT onboarding_schema.data_custom_templates.id FROM onboarding_schema.data_custom_templates
											WHERE customer_id = $1 AND is_enabled = TRUE`;
				const getTemplatesResult = await sqlQuery({ sql: getTemplateQuery, values: [caseDetails.rows[0].customer_id] });

				if (!getTemplatesResult.rowCount) {
					templateExsits = false;
				}
			}

			if (!Object.hasOwn(query, "invitation_id") || !templateExsits) {
				const customFieldsStageIndex = progressionConfig.findIndex(stage => stage.stage === "custom_fields");
				if (customFieldsStageIndex !== -1) {
					const prevStage = progressionConfig[customFieldsStageIndex - 1];
					const nextStage = progressionConfig[customFieldsStageIndex + 1];

					if (prevStage && nextStage) {
						nextStage.prev_stage = prevStage.id;
						nextStage.priority_order = progressionConfig[customFieldsStageIndex].priority_order;
						nextStage.id = progressionConfig[customFieldsStageIndex].id;
						prevStage.next_stage = nextStage.id;
					} else if (prevStage) {
						prevStage.next_stage = null;
					} else if (nextStage) {
						nextStage.prev_stage = null;
						nextStage.priority_order = progressionConfig[customFieldsStageIndex].priority_order;
						nextStage.id = progressionConfig[customFieldsStageIndex].id;
					}

					progressionConfig.splice(customFieldsStageIndex, 1);
				}
			}

			if (!businessAndOwnerDetails.rows.length) {
				throw new BusinessApiError("Business not found", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			// Extract business address_country from the first row for US business check
			const businessAddressCountry = businessAndOwnerDetails.rows[0]?.business_json?.data_businesses?.address_country;

			const titles = await Owners.getOwnerTitles();

			const requiredBusinessDetails = [
				"name",
				"address_line_1",
				"address_city",
				"address_state",
				"address_postal_code"
			];

			// Find the fields required for the "ownership" stage, then map those field names to their corresponding database column names, and finally build a list of all the required data fields
			const requiredOwnerDetails = [];
			const ownershipStageFields = progressionConfig?.find(row => row.stage.toLowerCase() == "ownership")?.config
				?.fields;
			const ownershipFieldsColumnMapping = {
				"Full Name": ["first_name", "last_name"],
				Title: ["title"],
				"Phone Number": ["mobile"],
				"Email Address": ["email"],
				"Home Address": ["address_line_1", "address_city", "address_state", "address_postal_code"],
				"Social Security Number": ["ssn"],
				"Date of Birth": ["date_of_birth"]
			};

			if (ownershipStageFields) {
				for (const field of ownershipStageFields) {
					if (
						!["Enable Identity Verification", "Disable Identity Verification", "Ownership Percentage"].includes(
							field.name
						) &&
						Object.hasOwn(ownershipFieldsColumnMapping, field.name)
					) {
						if (field.status === "Required" || field.status === "Always Required") {
							if (field.name === "Social Security Number" && customerID) {
								const customerBusinessConfig = await onboarding.getCustomerBusinessConfigs({
									customerID: customerID,
									businessID: params.businessID
								});
								if (customerBusinessConfig?.[0]?.config?.bypass_ssn || !isUSBusiness(businessAddressCountry) || isGuestOwner) {
									continue;
								}
							}
							requiredOwnerDetails.push(...ownershipFieldsColumnMapping[field.name]);
						}
					}
				}
			}

			// from progressionConfig if TIN is required and unverified TIN submission is not allowed then insert TIN inside required business details array
			if (isTinRequired && requireTinResponse) {
				requiredBusinessDetails.push("tin");
			}

			const business = businessAndOwnerDetails.rows.reduce((acc, item) => {
				if (!Object.hasOwn(acc, "id")) {
					acc.business_details = {};
					if (!acc.owners) {
						acc.owners = [];
					}
					if (item.business_json?.data_businesses) {
						if (item.business_json.data_businesses.tin !== null) {
							item.business_json.data_businesses.tin = decryptEin(item.business_json.data_businesses.tin);

							if (!isGuestOwner && !isAdditionalFieldsValidationEnabled) {
								item.business_json.data_businesses.tin = maskString(item.business_json.data_businesses.tin);
							}
						}
						acc.business_details = item.business_json.data_businesses;
						// add naics code and mcc code
						acc.business_details.naics_code = item.business_json.naics_code;
						acc.business_details.naics_title = item.business_json.naics_title;
						acc.business_details.mcc_code = item.business_json.mcc_code;
						acc.business_details.mcc_title = item.business_json.mcc_title;
						acc.business_details.business_names = getAllBusinessNamesResult.rows;
						acc.business_details.business_addresses = getAllBusinessAddressesResult.rows;

						acc.business_details.industry = item?.industry_json?.industry_data;
						// Compare whether the keys in data_businesses are not null for the values in requiredBusinessDetails
						acc.business_details_exists = requiredBusinessDetails.every(key =>
							Boolean(item.business_json.data_businesses[key])
						);
					}
				}
				if (item.owners_json?.data_owners) {
					item.owners_json.data_owners.external_id = item.owners_percentage_json?.rel_business_owners?.external_id;
					item.owners_json.data_owners.ownership_percentage =
						item.owners_percentage_json?.rel_business_owners?.ownership_percentage;
					item.owners_json.data_owners.owner_type = item.owners_percentage_json?.rel_business_owners?.owner_type;
					item.owners_json.data_owners.title = titles?.[item.owners_json.data_owners.title];
					if (item.owners_json.data_owners.ssn) {
						item.owners_json.data_owners.ssn = decryptEin(item.owners_json.data_owners.ssn);
					}
					acc.owners.push(item.owners_json.data_owners);
					// checks there is at least one owner and all required owner details are present for all owners
					acc.owner_details_exists =
						acc.owners.length > 0 && acc.owners.every(owner => requiredOwnerDetails.every(key => Boolean(owner[key])));
				} else {
					acc.owner_details_exists = false;
				}

				return acc;
			}, {});

			let customFieldsDetails: any[] = [];

			let doFieldsExistInDB = false;

			if (Object.hasOwn(query, "invitation_id") && templateExsits) {
				try {
					const getCustomFieldsDataQuery = `WITH latest_template AS (
					SELECT onboarding_schema.data_custom_templates.id,
						onboarding_schema.data_custom_templates.customer_id,
						version,
						title
					FROM onboarding_schema.data_custom_templates
					LEFT JOIN public.data_invites
						ON public.data_invites.customer_id = onboarding_schema.data_custom_templates.customer_id
					WHERE public.data_invites.id = $1
					ORDER BY version DESC
					LIMIT 1
				),
				aggregated_values AS (
					SELECT
						field_id,
						case_id,
						jsonb_agg(
							jsonb_build_object('value', field_value, 'value_id', id)
						) AS value_pairs,
						created_by,
						MAX(created_at) AS created_at
					FROM onboarding_schema.data_business_custom_fields
					WHERE case_id = $2
					GROUP BY field_id, case_id, created_by
				)
				SELECT json_build_object(
					'templateId', latest_template.id,
					'version', latest_template.version,
					'name', latest_template.title,
					'fields', json_agg(
						json_build_object(
							'id', onboarding_schema.data_custom_fields.id,
							'label', onboarding_schema.data_custom_fields.label,
							'internalName', onboarding_schema.data_custom_fields.code,
							'property', onboarding_schema.core_field_properties.code,
							'value', aggregated_values.value_pairs,
							'is_sensitive_info', onboarding_schema.data_custom_fields.is_sensitive,
							'applicantAccess', onboarding_schema.data_custom_fields.applicant_access,
							'customerAccess', onboarding_schema.data_custom_fields.customer_access,
							'rules', onboarding_schema.data_custom_fields.rules,
							'step_name', onboarding_schema.data_custom_fields.step_name,
							'section_name', onboarding_schema.data_custom_fields.section_name,
							'field_options', field_options.options,
							'conditionalLogic', onboarding_schema.data_custom_fields.conditional_logic,
							'sequence_number', onboarding_schema.data_custom_fields.sequence_number,
							'created_by', aggregated_values.created_by,
							'created_at', aggregated_values.created_at
						)
					)
				)
				FROM latest_template
				LEFT JOIN onboarding_schema.data_custom_fields
					ON onboarding_schema.data_custom_fields.template_id = latest_template.id
				LEFT JOIN onboarding_schema.core_field_properties
					ON onboarding_schema.core_field_properties.id = onboarding_schema.data_custom_fields.property
				LEFT JOIN LATERAL (
					SELECT json_agg(
							json_build_object(
								'label', onboarding_schema.data_field_options.label,
								'value', onboarding_schema.data_field_options.value,
								'checkbox_type', onboarding_schema.data_field_options.checkbox_type,
								'input_type', onboarding_schema.data_field_options.input_type,
								'icon', onboarding_schema.data_field_options.icon,
								'icon_position', onboarding_schema.data_field_options.icon_position
							)
					) AS options
					FROM onboarding_schema.data_field_options
					WHERE onboarding_schema.data_field_options.field_id = onboarding_schema.data_custom_fields.id
				) AS field_options ON true
				LEFT JOIN aggregated_values
					ON aggregated_values.field_id = onboarding_schema.data_custom_fields.id
				GROUP BY latest_template.id, latest_template.version, latest_template.title, onboarding_schema.data_custom_fields.sequence_number
				ORDER BY onboarding_schema.data_custom_fields.sequence_number ASC`;

					let result = await sqlQuery({ sql: getCustomFieldsDataQuery, values: [query.invitation_id, caseID] });
					if (result && result.rows.length) {
						result = result.rows.map(row => row.json_build_object);
						customFieldsDetails = JSON.stringify(result, null, 2);
						customFieldsDetails = JSON.parse(customFieldsDetails);

						if (customFieldsDetails && customFieldsDetails.length) {
							const userIDs = new Set<UUID>();
							customFieldsDetails.forEach(row => {
								row.fields.forEach(field => {
									if (field.property !== "upload" && field.value && field.value.length) {
										field.value_id = field.value[0].value_id;
										field.value = field.value[0].value;

										if (field.property === "date" && field.value) {
											field.value = toMDY(field.value) ?? "";
										}
									} else if (field.property === "upload" && field.value && field.value !== "null") {
										const valueList = [];
										const valueIdList = [];
										field.value.forEach(record => {
											let fileName = record.value;
											if (fileName && fileName.includes("-{") && fileName.includes("}")) {
												fileName = `${fileName.split("-{")[0]}${fileName.split("}")[1]}`;
											}
											if (fileName !== "null") {
												valueList.push(fileName);
												valueIdList.push(record.value_id);
											}
										});
										field.value = valueList;
										field.value_id = valueIdList;
									}
									if (field.created_by) {
										userIDs.add(field.created_by);
									}
								});
							});
							// Hydrate with user details when available
							if (userIDs.size) {
								try {
									const users = await getBulkUserInfo(userIDs);
									if (Object.keys(users).length) {
										customFieldsDetails.forEach(row => {
											row.fields.forEach(field => {
												if (field.created_by && users[field.created_by]?.id) {
													field.user = pick(users[field.created_by], ["id", "first_name", "last_name", "email"]);
													field.user.role = ROLE_ID_TO_ROLE[users[field.created_by].role_id] ?? undefined;
												}
											});
										});
									}
								} catch (error) {
									logger.error({ error }, "Error hydrating createdBy field with user details");
								}
							}
						}
					}
				} catch (error) {
					logger.error({ error }, "Error fetching custom fields");
				}
			}

			if (customFieldsDetails.length > 0) {
				progressionConfig = await this.getProgressionConfigWithCustomFields(
					progressionConfig,
					customerID,
					[SECTION_VISIBILITY.DEFAULT],
					!!isGuestOwner
				);
			}

			// Re-add RFI stage to the end of the flow if it exists
			if (rfiStage) {
				progressionConfig.push(rfiStage);
			}

			const progressionConfigObject = convertToObject(progressionConfig, "id");

			const customFieldTemplateId: UUID | undefined =
				checkValidInvitation?.rows?.[0]?.prefill?.custom_field_template_id ??
				(await onboarding
					.getCurrentOnboardingTemplate(customerID)
					.then(template => template.id)
					.catch(_ex => undefined));

			const integrationStatus = await getIntegrationStatusForCustomer(customerID);
			const prefillEnabled =
				(integrationStatus || []).find(integration => integration.integration_code === "kyx")?.status === "ENABLED";
			const processorOrchestrationEnabled =
				(integrationStatus || []).find(integration => integration.integration_code === "processor_orchestration")
					?.status === "ENABLED";

			let progression = {
				case_id: caseID,
				case_status: caseStatus,
				is_partial_submission_allowed: !!isGuestOwner,
				customer_id: customerID,
				invitation_id: query?.invitation_id,
				custom_field_template_id: customFieldTemplateId,
				business_country: resolveCountryCode(business.business_details.address_country) ?? SupportedCountryCode.US,
				is_submitted: isSubmitted,
				current_stage: {},
				customer_onboarding_setups: customerOnboardingSetups,
				completed_stages: [],
				are_all_required_stages_completed: false,
				progression_type: progressionType,
				integration_configs: {
					pii_prefill_enabled: prefillEnabled ?? false,
					processor_orchestration_enabled: processorOrchestrationEnabled ?? false
				},
				stages: progressionConfig
					.map(item => {
						if (item.stage !== "custom_fields") {
							return {
								id: item.id,
								stage: item.stage,
								label: item.label,
								priority_order: item.priority_order
							};
						}
					})
					.filter(Boolean)
			};
			let progressionPercentage = 0;

			const connections = await getBusinessIntegrationConnections(params.businessID);

			const processingHistory = await getBusinessProcessingHistory(params.businessID, caseID);

			const accountingStatements = await getBusinessAccountingStatements(params.businessID, caseID ?? undefined);

			const bankStatements = await getBusinessBankStatements(params.businessID, caseID ?? undefined);

			const npiSetting = progressionConfig
				.find(item => item.stage === "company")
				?.config?.fields?.find(f => f.name.includes("NPI Number"));
			let npiRecord = null;
			if (npiSetting?.status === "Required" || npiSetting?.status === "Optional") {
				try {
					// only make this call if we know we have a caseId.
					// otherwise, we'd receive repeated errors too early in the flow
					if (caseID) {
						npiRecord = await fetchNPIDetails(params.businessID, caseID, { authorization });
						logger.debug({ message: `Found NPI Record: ${JSON.stringify(npiRecord)}` });
						if (npiRecord && npiRecord.submitted_npi) {
							business.business_details.npi = npiRecord.submitted_npi;
						}
					}
				} catch (error) {
					logger.warn(`Error fetching NPI details: ${error.message}`);
				}
			}

			const customerConfig = await onboarding.getCustomerOnboardingStages(
				{ customerID: customerID },
				{ setupType: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP },
				false
			);
			const isEsignEnabled = await this.getEsignStatus(customerConfig);
			let isEsignComplete = false;

			for (const item of progressionConfig) {
				item.next_stage = {
					id: item.next_stage,
					stage: progressionConfigObject[item.next_stage]?.stage || null,
					label: progressionConfigObject[item.next_stage]?.label || null
				};
				item.prev_stage = {
					id: item.prev_stage,
					stage: progressionConfigObject[item.prev_stage]?.stage || null,
					label: progressionConfigObject[item.prev_stage]?.label || null
				};

				let isStageCompleted = false;

				switch (item.stage.split(":")[0]) {
					case "get_started": {
						// Mark as complete ONLY if company name exists
						// There is a chance that address is not present when creating a business (e.g. /businesses/send-invitation flow)
						// for first time entry (no address on case creation) the address is only saved after company stage is completed
						const hasCompanyName = !!business.business_details?.name;

						isStageCompleted = hasCompanyName;
						break;
					}

					case "company": {
						if (customerID) {
							const redisKey = `{customer}:${customerID}:{business}:${business?.business_details?.id}:retries`;
							let busienssRetries: number = 0;
							busienssRetries = Number(await redis.get(redisKey)) ?? 0;
							item.max_retries_reached = busienssRetries >= 3;
							item.retries = busienssRetries;
						}

						// Extract DBA name, compute has_dba & same_mailing_address
						// Flatten into a simpler object for prefill data in get started
						const dbaName =
							business.business_details?.business_names?.find(
								(name: { is_primary: boolean }) => name.is_primary === false
							)?.name ?? null;

						// Determine if mailing address is same as physical address
						const primaryAddress = business.business_details?.business_addresses?.find(
							(addr: { is_primary: boolean }) => addr.is_primary === true
						);
						const mailingAddress = business.business_details?.business_addresses?.find(
							(addr: { is_primary: boolean }) => addr.is_primary === false
						);

						// Only set to true if a mailing address exists AND matches the physical address
						let sameMailingAddress = false;
						if (mailingAddress && primaryAddress) {
							const normalizeAddr = (addr: {
								line_1?: string;
								city?: string;
								state?: string;
								postal_code?: string;
							}) => {
								return [
									addr.line_1?.toLowerCase().trim(),
									addr.city?.toLowerCase().trim(),
									addr.state?.toLowerCase().trim(),
									addr.postal_code?.toLowerCase().trim()
								]
									.filter(Boolean)
									.join(" ");
							};
							const primaryNormalized = normalizeAddr(primaryAddress);
							const mailingNormalized = normalizeAddr(mailingAddress);
							sameMailingAddress = primaryNormalized === mailingNormalized;
						}

						// Build pre-filled data including get started fields
						const businessDetailsForPrefill = {
							...business.business_details,
							dba: dbaName,
							has_dba: !!dbaName,
							same_mailing_address: sameMailingAddress
						};

						item.pre_filled_data = {
							business_details: checkValidInvitation?.rowCount
								? {
										...checkValidInvitation.rows[0].prefill,
										...Object.fromEntries(
											Object.entries(businessDetailsForPrefill).filter(
												([_, value]) => value !== null && value !== undefined
											)
										)
									}
								: businessDetailsForPrefill
						};

						if (business.business_details_exists) {
							const isNpiVisible = ["Required"].includes(npiSetting?.status);
							const hasNpi = item.pre_filled_data.business_details.npi ? true : false;
							const isNpiSettingHidden =
								npiSetting?.status === "Hidden" ||
								npiSetting?.status === "Optional" ||
								!isUSBusiness(businessAddressCountry);

							let allOtherRequiredFieldsPresent = true;

							if (isAdditionalFieldsValidationEnabled) {
								const websiteSetting = progressionConfig
									.find(stage => stage.stage === "company")
									?.config?.fields?.find(f => f.name === "Website");
								if (websiteSetting) {
									const isWebsiteRequired = ["Required", "Always Required"].includes(websiteSetting.status);
									const hasWebsite = item.pre_filled_data.business_details.official_website ? true : false;

									if (isWebsiteRequired && !hasWebsite) {
										allOtherRequiredFieldsPresent = false;
									}
								}

								const mobileSetting = progressionConfig
									.find(stage => stage.stage === "company")
									?.config?.fields?.find(f => f.name === "Company Phone Number");
								if (mobileSetting) {
									const isMobileRequired = ["Required", "Always Required"].includes(mobileSetting.status);
									const hasMobile = item.pre_filled_data.business_details.mobile ? true : false;

									if (isMobileRequired && !hasMobile) {
										allOtherRequiredFieldsPresent = false;
									}
								}

								const industrySetting = progressionConfig
									.find(stage => stage.stage === "company")
									?.config?.fields?.find(f => f.name === "Industry");
								if (industrySetting) {
									const isIndustryRequired = ["Required", "Always Required"].includes(industrySetting.status);
									const hasIndustry = item.pre_filled_data.business_details.industry ? true : false;

									if (isIndustryRequired && !hasIndustry) {
										allOtherRequiredFieldsPresent = false;
									}
								}

								const linkedInSetting = progressionConfig
									.find(stage => stage.stage === "company")
									?.config?.fields?.find(f => f.name === "LinkedIn");
								if (linkedInSetting) {
									const isLinkedInRequired = ["Required", "Always Required"].includes(linkedInSetting.status);
									const hasLinkedIn = item.pre_filled_data.business_details.social_account ? true : false;

									if (isLinkedInRequired && !hasLinkedIn) {
										allOtherRequiredFieldsPresent = false;
									}
								}

								const mailingAddressSetting = progressionConfig
									.find(stage => stage.stage === "company")
									?.config?.fields?.find(f => f.name === "Mailing Address");
								if (mailingAddressSetting) {
									const isMailingAddressRequired = ["Required", "Always Required"].includes(
										mailingAddressSetting.status
									);
									const mailingAddress = item.pre_filled_data.business_details.business_addresses?.find(
										addr => addr.is_primary === false
									);
									const hasMailingAddress =
										mailingAddress && mailingAddress.line_1 && mailingAddress.city && mailingAddress.postal_code;

									if (isMailingAddressRequired && !hasMailingAddress) {
										allOtherRequiredFieldsPresent = false;
									}
								}
							}

							if (((isNpiVisible && hasNpi) || isNpiSettingHidden) && allOtherRequiredFieldsPresent) {
								isStageCompleted = true;
							}
						}

						break;
					}

					case "ownership": {
						const idvEnabled = item.config?.fields?.find(
							f => f.name === "Enable Identity Verification" && f.section_name === "Identity Verification"
						).status;

						const submitWithUnverifiedIdentityEnabled = item.config?.fields
							?.find(f => f.name === "Enable Identity Verification" && f.section_name === "Identity Verification")
							?.sub_fields?.find(subfield => subfield.name === "Submit with Unverified Identity")?.status;

						const isExtendedOwnershipEnabled =
							item.config?.fields?.find(f => f.name === OWNERSHIP_FIELD_NAMES.EXTENDED_OWNERSHIP)?.status ?? false;

						const verificationData = {
							is_connected: false,
							owners: []
						};

						// Create a map of owner_id -> verification data for attaching to each business owner
						const ownerVerificationByOwnerId: Record<string, object> = {};
						if (connections["owner_verification"]?.is_connected) {
							verificationData.is_connected = true;
							connections["owner_verification"].owners.forEach((owner: object) => {
								verificationData.owners.push(owner);
								ownerVerificationByOwnerId[owner.owner_id] = owner;
							});
						}

						let allOwnersVerified: boolean = business.owners.length > 0 ? true : false;
						// If there exists an owner that is not verified or have not been returned from plaidIDV then mark that owner as unverified in the response and mark the stage as incomplete as well
						// So that FE can reinitiate plaid request
						business.owners.forEach((owner: object) => {
							const ownerVerification = ownerVerificationByOwnerId[owner.id];
							if (ownerVerification?.status === "SUCCESS") {
								owner.is_owner_verified = true;
							} else {
								allOwnersVerified = false;
								owner.is_owner_verified = false;
							}
							owner.verification_status = ownerVerification?.status ?? null;
						});
						const connectedAccounts = [];

						if (business.owner_details_exists && connections["owner_verification"]?.is_connected) {
							connections["owner_verification"].connections.forEach((connection: object) => {
								if (connection.connection_status === CONNECTION_STATUS.SUCCESS) {
									connectedAccounts.push({
										connection_id: connection.id,
										platform_id: connection.platform_id,
										platform: connection.platform
									});
								}
							});

							// if idv is enabled, then stage is complete if all owners are verified OR submit with unverified identity is enabled
							// otherwise, stage is complete if the owner details are present
							isStageCompleted = idvEnabled ? allOwnersVerified || submitWithUnverifiedIdentityEnabled : true;
						}

						// this is check that idv is not enabled and we can skip this and complete stage without idv verification
						if (!idvEnabled && business.owner_details_exists) {
							isStageCompleted = true;
						}
						// check control owner should be present
						if (!isExtendedOwnershipEnabled && !business.owners.some(owner => owner.owner_type === "CONTROL")) {
							isStageCompleted = false;
						}

						item.pre_filled_data = {
							owners: business.owners,
							connected_accounts: connectedAccounts,
							verification_data: verificationData
						};

						break;
					}

					case "banking": {
						isStageCompleted = connections["banking"]?.is_connected;

						const manualAccountVisibility = this.getFieldFromProgressionConfig(
							progressionConfig,
							progressionStages.BANKING,
							progressionFields.MANUAL_ACCOUNT_VERIFICATION
						)?.status;
						const isManualAccountEnabled: boolean = Boolean(manualAccountVisibility);

						const depositAccountVisibility = this.getFieldFromProgressionConfig(
							progressionConfig,
							progressionStages.BANKING,
							progressionFields.DEPOSIT_ACCOUNT
						)?.status;
						const isDepositAccountRequired: boolean =
							(typeof depositAccountVisibility === "string" && depositAccountVisibility.toLowerCase() === "required") ||
							(typeof depositAccountVisibility === "boolean" && depositAccountVisibility);

						let additionalAccountDetails = null;
						if (caseID) {
							try {
								additionalAccountDetails = await fetchAdditionalAccountDetails(params.businessID, caseID);
							} catch (error) {
								logger.error(
									{ error: error, businessID: params.businessID, caseID },
									"getProgression: fetchAdditionalAccountDetails failed"
								);
							}
						}
						const additionalAccounts = additionalAccountDetails?.accounts ?? [];

						const connectedAccounts = [];
						if (isStageCompleted) {
							connections["banking"].connections.forEach(connection => {
								if (
									connection.connection_status === CONNECTION_STATUS.SUCCESS &&
									![INTEGRATION_ID.GIACT].includes(connection.platform_id)
								) {
									connectedAccounts.push({
										connection_id: connection.id,
										platform_id: connection.platform_id,
										platform: connection.platform,
										institutions: connection.institutions,
										task: connection.task
									});
								}
							});

							// Flip isStageComplete to false if Plaid connection is successful
							// but there are no connected institutions
							if (!connectedAccounts.some(account => account.institutions?.length > 0)) {
								isStageCompleted = false;
								connectedAccounts.length = 0;
							}
						}

						item.pre_filled_data = {
							is_connecting: connections["banking"]?.is_connecting ?? false,
							is_connected: connectedAccounts.length ? true : false,
							connected_accounts: connectedAccounts,
							deposit_account: depositAccountDetails,
							additional_account_details: additionalAccounts,
							is_deposit_account_required: isDepositAccountRequired,
							deposit_account_visibility: depositAccountVisibility,
							is_manual_account_enabled: isManualAccountEnabled
						};

						/* If manual account verification is enabled and we have additional account details, then the stage is complete */
						if (isManualAccountEnabled) {
							const isManualAccountCompleted = additionalAccounts.length > 0;
							item.pre_filled_data.is_manual_account_completed = isManualAccountCompleted;
							if (isManualAccountCompleted) {
								isStageCompleted = true;
							}
						}

						/* Flip isStageComplete back to false if deposit account is required and unfulfilled */
						if (isDepositAccountRequired) {
							const isDepositAccountCompleted = depositAccountDetails?.numbers?.ach?.length > 0;
							item.pre_filled_data.is_deposit_account_completed = isDepositAccountCompleted;
							if (isStageCompleted && !isDepositAccountCompleted) {
								isStageCompleted = false;
							}
						}

						let manualUpload = false;
						// TODO: Remove this logic after OCR implementation
						if (isUploadStatementEnabled && bankStatements.length) {
							manualUpload = true;
							if (bankStatements.length >= Number(minNumberOfBankStatementsRequired)) {
								isStageCompleted = true;
							}
						}

						if (manualUpload) {
							item.pre_filled_data.manual_banking = {
								upload_details: {
									ocr_document: bankStatements.map(doc => {
										return {
											validation_document_id: doc.id,
											file_name: doc.file_name,
											file_path: doc.file_path,
											ocr_extraction_document_id: null
										};
									})
								}
							};
						}

						// If the easy flow is enabled, then mark the stage as skippable
						if (isEasyFlow) {
							item.is_skippable = true;
						}

						break;
					}

					case "accounting": {
						isStageCompleted = connections["accounting"]?.is_connected || false;

						const connectedAccounts = [];
						if (isStageCompleted) {
							connections["accounting"].connections.forEach(connection => {
								if (connection.connection_status === CONNECTION_STATUS.SUCCESS) {
									connectedAccounts.push({
										connection_id: connection.id,
										platform_id: connection.platform_id,
										platform: connection.platform
									});
								}
							});
						}

						let manualUpload = false;
						// TODO: Remove this logic after OCR implementation
						if (isUploadDocumentEnabled && accountingStatements.length) {
							manualUpload = true;
							if (accountingStatements.length >= Number(minNumberOfStatementsRequired)) {
								isStageCompleted = true;
							}
						}

						item.pre_filled_data = {
							is_connected: connectedAccounts.length ? true : false,
							connected_accounts: connectedAccounts,
							...(manualUpload
								? {
										manual_accounting: {
											upload_details: {
												ocr_document: accountingStatements.map(doc => {
													return {
														validation_document_id: doc.id,
														file_name: doc.file_name,
														file_path: doc.file_path,
														ocr_extraction_document_id: null
													};
												})
											}
										}
									}
								: {})
						};

						break;
					}

					case "tax_consent": {
						isStageCompleted = connections["taxation"]?.is_connected || false;

						let irsStatus = "Not Connected";
						const connectedAccounts = [];
						connections["taxation"]?.connections.forEach(connection => {
							if (connection.connection_status === CONNECTION_STATUS.SUCCESS) {
								irsStatus = "Consent Given";
								isStageCompleted = true;
								connectedAccounts.push({
									connection_id: connection.id,
									platform_id: connection.platform_id,
									platform: connection.platform,
									...(connection.platform === "electronic_signature" &&
									connections["taxation"] &&
									connections["taxation"]?.electronic_signature
										? { electronic_signature: connections["taxation"]?.electronic_signature }
										: {})
								});
							}
						});

						item.pre_filled_data = {
							irs_status: irsStatus,
							is_connected: connectedAccounts.length ? true : false,
							connected_accounts: connectedAccounts,
							manual_tax_filing: connections["taxation"]?.manual_tax_filing,
							electronic_signature: connections["taxation"]?.electronic_signature
						};

						break;
					}
					case "rfi": {
						// RFI is only the current stage AFTER submission.
						// We mark it "completed" while isSubmitted is false so the progression
						// loop skips it and stops at "Review".
						if (!isSubmitted) {
							isStageCompleted = true;
						} else {
							// After submission, check if further information is required from the payment processor
							const merchantProfile = await getMerchantProfileData(customerID, params.businessID);
							const infoRequired = merchantProfile?.accounts?.some(
								(acc: any) => acc.processor_status === "INFO_REQUIRED"
							);
							isStageCompleted = !infoRequired;
						}
						item.pre_filled_data = {};
						break;
					}
					case "processing_history": {
						let hasMeaningfulData = false;

						if (Array.isArray(processingHistory)) {
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

						if (hasMeaningfulData) {
							isStageCompleted = true;
						}
						item.pre_filled_data = {
							processing_history: processingHistory
						};
						break;
					}
					case "custom_fields": {
						const customFieldsProcessedDetails = {
							templateId: null,
							version: null,
							name: null,
							fields: []
						};

						if (customFieldsDetails && customFieldsDetails.length) {
							customFieldsDetails.forEach(row => {
								const matchingFields = row.fields.filter(field => field.section_name === item.label);

								if (matchingFields.length > 0) {
									if (!customFieldsProcessedDetails.templateId) {
										customFieldsProcessedDetails.templateId = row.templateId;
										customFieldsProcessedDetails.version = row.version;
										customFieldsProcessedDetails.name = row.name;
									}

									//all the rules for a particular field need to be processed into a single array
									matchingFields.forEach((field: CustomFieldResponse) => {
										field.rules = CustomField.staticConsolidateRules(field);
									});

									customFieldsProcessedDetails.fields = customFieldsProcessedDetails.fields.concat(matchingFields);
								}
							});
						}

						const fieldVisibilityMap = customFieldsProcessedDetails.fields?.reduce((acc, f) => {
							const rules = f?.rules.filter(r => r.rule === "field_visibility");
							if (rules?.length > 0 || f.applicantAccess === FIELD_ACCESS.HIDDEN) {
								acc[f.internalName] = rules;
								if (f.applicantAccess === FIELD_ACCESS.HIDDEN && !isGuestOwner) {
									acc[f.internalName].invisible = true;
								}
							}
							return acc;
						}, {});

						for (let internalName in fieldVisibilityMap) {
							const fieldVisibilityList = fieldVisibilityMap[internalName];
							if (fieldVisibilityList.invisible === true) {
								continue;
							}
							for (const fieldVisibility of fieldVisibilityList) {
								const keys = fieldVisibility?.condition?.fields ?? [];
								const types = customFieldsProcessedDetails?.fields
									?.filter(val => {
										return keys?.find((key: string) => key === val.internalName);
									})
									.map(item => ({
										key: item.internalName,
										property: item.property,
										value: parse(item.value)
									}));
								const res = types?.reduce((acc: any, item) => {
									if (item.property === "dropdown") {
										acc[item.key] = item.value?.label?.trim() ?? "";
									} else if (item.property === "boolean") {
										acc[item.key] = item.value ? "TRUE" : "FALSE";
									} else if (item.property === "date" && item.value) {
										// Normalize dates for conditional logic evaluation
										acc[item.key] = toISO(item.value) ?? "";
									} else {
										acc[item.key] = item.value;
									}
									return acc;
								}, {});

								if (
									!(
										fieldVisibility?.condition?.dependency &&
										evaluateCondition(fieldVisibility?.condition?.dependency, res)
									)
								) {
									fieldVisibilityMap[internalName].invisible = true;
								}
							}
						}

						//isStageCompleted will be marked as true only if all the required fields have non-null and non-empty values
						if (!customFieldsProcessedDetails.fields.length) {
							// No fields in stage -> incomplete
							isStageCompleted = false;
						} else {
							const hasRequiredFields = customFieldsProcessedDetails.fields.some(field =>
								field.rules.some(rule => rule.rule === "required")
							);
							if (hasRequiredFields) {
								// Check only required fields
								isStageCompleted = customFieldsProcessedDetails.fields.every(field => {
									const isRequired = field.rules.some(rule => rule.rule === "required");
									const isVisible = isGuestOwner || !fieldVisibilityMap[field.internalName]?.invisible;

									if (isRequired && isVisible) {
										return field.value !== null && field.value !== "";
									}
									return true;
								});
							}
							// if there are no required fields in a stage and it is skipped, then mark it as complete
							else {
								if (Object.hasOwn(query, "stages_to_skip") && query.stages_to_skip.length) {
									if (query.stages_to_skip.includes(String(item.id))) {
										isStageCompleted = true;
									}
								}
								// No required fields -> check all visible fields

								const visibleFields = customFieldsProcessedDetails.fields.filter(
									field => !fieldVisibilityMap[field.internalName]?.invisible
								);
								const fieldIds = visibleFields.map(field => field.id);

								let doFieldsExist = [];

								if (fieldIds && fieldIds.length) {
									doFieldsExist = await db("onboarding_schema.data_business_custom_fields")
										.select("field_id")
										.whereIn("field_id", fieldIds)
										.andWhere("business_id", params.businessID);
								}

								doFieldsExistInDB = doFieldsExist.length > 0;

								const fieldsToCheck = isGuestOwner ? customFieldsProcessedDetails.fields : visibleFields;

								const areAllFieldsEmpty = fieldsToCheck.every(field => field.value === null || field.value === "");

								// If all visible fields are empty, the stage is incomplete
								isStageCompleted = isStageCompleted || doFieldsExistInDB || !areAllFieldsEmpty;
								logger.info(
									`doFieldsExistInDB: ${doFieldsExistInDB}: ${item.stage}: isStageCompleted: ${isStageCompleted}`
								);
							}
						}
						// Filter out fields where field_access is HIDDEN
						if (!isGuestOwner) {
							customFieldsProcessedDetails.fields = customFieldsProcessedDetails.fields.filter(
								field => field.applicantAccess !== FIELD_ACCESS.HIDDEN
							);
						}
						item.label = item.stage.split(":")[1];
						let progressionInfo = this.getCustomStageProgression(progression, item.label);
						item.prev_stage = progressionInfo.prev_stage;
						item.next_stage = progressionInfo.next_stage;
						item.pre_filled_data = customFieldsProcessedDetails;
						break;
					}

					case "review": {
						/**
						 * @see https://worthcrew.slack.com/archives/C0A9S1V7221
						 * hotfix 0.59.0-hotfix-v2
						 */
						isStageCompleted = false;
						if (isEsignEnabled) {
							const templates = await esign.getTemplates({ customerID });
							const selectedTemplates = templates.filter(t => eSignTemplatesAssigned.includes(t.template_id));

							const signedDocs = await esign.getSignedDocuments(
								{ businessID: params.businessID },
								caseID ? { case_id: caseID } : {}
							);

							const completedStageMap = new Map(
								progression.completed_stages
									.filter(stage => stage.is_stage_truly_completed)
									.map(stage => [stage.stage, true])
							);

							// Default required stages for all templates
							const defaultRequiredStages = progressionConfig
								.filter(stage => !stage.is_skippable && stage.stage !== "review") // optionally exclude review itself
								.map(stage => stage.stage);

							const preFilledArray = selectedTemplates.map(template => {
								const requiredStages = defaultRequiredStages; // in future can customize per template
								const isEsignReady = requiredStages.every(stage => completedStageMap.get(stage));
								const signed = signedDocs.find(doc => doc.template_id === template.template_id);

								const templateFirstWord = template.name?.split(" ")[0];

								return {
									eSignTemplateId: `${templateFirstWord.toLowerCase()}_mpa_v${template.version}`,
									...(template || {}),
									...(signed || {}),
									is_esign_ready: isEsignReady,
									is_signed: Boolean(signed?.signed_by)
								};
							});

							isEsignComplete = preFilledArray.every(t => Boolean(t.signed_by));
							item.pre_filled_data = {
								template_data: preFilledArray
							};
						}
						break;
					}

					default: {
						// what to do ? What would be the default case here ?
					}
				}

				item.is_stage_truly_completed = isStageCompleted;

				// to display all the requested stages even if they have data filled
				if (caseStatus === CASE_STATUS_ENUM.INFORMATION_REQUESTED) {
					if (!item.next_stage) {
						item.next_stage = { id: null, stage: null, label: null };
					}
					if (
						!Object.hasOwn(query, "updated_stages") ||
						!query.updated_stages.length ||
						!query.updated_stages.includes(String(item.id))
					) {
						isStageCompleted = false;
					}
					if (item.stage === "banking") {
						// remove giact account from prefilled data
						const connectedAccounts = item.pre_filled_data?.connected_accounts || [];
						item.pre_filled_data.connected_accounts = connectedAccounts.filter(
							record => ![INTEGRATION_ID.GIACT].includes(record.platform_id)
						);
						if (!item.pre_filled_data?.connected_accounts.length) {
							item.pre_filled_data.is_connected = false;
							item.is_stage_truly_completed = false;
						}
					}
				}

				if (Object.hasOwn(query, "stages_to_skip") && query.stages_to_skip.length) {
					if (query.stages_to_skip.includes(String(item.id))) {
						isStageCompleted = true;
					}
				}

				if (isStageCompleted) {
					if (Object.hasOwn(query, "stages_to_skip") && query.stages_to_skip.length) {
						if (!query.stages_to_skip.includes(String(item.id))) {
							progressionPercentage += item.completion_weightage;
						}
					} else {
						progressionPercentage += item.completion_weightage;
					}

					progression.completed_stages.push(item);

					progression.current_stage.current_progression_percentage = progressionPercentage;
				} else {
					if (Object.hasOwn(progression.current_stage, "id")) {
						progression.current_stage =
							progression.current_stage.priority_order < item.priority_order ? progression.current_stage : item;
					} else {
						progression.current_stage = item;
					}
				}

				logger.info(
					`Stage: ${item.stage}, isStageCompleted: ${isStageCompleted}, progressionPercentage: ${progressionPercentage}`
				);
				progression.current_stage.current_progression_percentage = progressionPercentage;
			}

			const requiredStages = progressionConfig.filter(
				stage => !stage.is_skippable && !["review", "rfi"].includes(stage.stage)
			);
			// check if every required stage is complete
			const result = requiredStages.every(reqStage =>
				progression.completed_stages.some(
					completedStage => completedStage.stage === reqStage.stage && completedStage.is_stage_truly_completed === true
				)
			);
			progression.are_all_required_stages_completed = isEsignEnabled ? result && isEsignComplete : result;
			if (applicants.length > 1) {
				try {
					const redisResult = await redis.get(`{case}:${caseID}:ready_to_submit`);
					if (redisResult == false && result == true) {
						logger.info(`redis result: ${redisResult}: ${result}`);
						let businessName = business?.business_details?.business_names?.find(
							businessName => businessName.is_primary === true
						)?.[0];

						if (!businessName) {
							logger.info("Business name not found in the names list, fetching from DB");
							const getBusinessNameQuery = "select name from data_businesses where id = $1";
							businessName = (await sqlQuery({ sql: getBusinessNameQuery, values: [params.businessID] })).rows[0].name;
							logger.info(`Business name found: ${businessName}`);
						}

						logger.info(`records for ${params.businessID} : ${JSON.stringify(records)}`);
						let ownerDetails = records.find(applicant => applicant.code === "owner");
						if (!ownerDetails) {
							logger.info("Business owner not found, sending email to first applicant in the list");
							ownerDetails = appliantDetailsResult[0];
						}
						logger.info(`ownerDetails for ${params.businessID} : ${JSON.stringify(ownerDetails)}`);
						const loginWithEmailPasswordField = customerConfig
							?.find(row => row.stage.toLowerCase() == "login")
							?.config?.fields?.find(field => field.name.toLowerCase() == "Login with Email & Password".toLowerCase());

						// making an explicit call here since getFlagValue technically has a return type of any
						if (loginWithEmailPasswordField && !loginWithEmailPasswordField?.status) {
							await createLinkForReadyToSubmitEvent(params.businessID, ownerDetails, businessName, customerID, true);
						} else {
							await createLinkForReadyToSubmitEvent(params.businessID, ownerDetails, businessName, customerID);
						}
					}
					await redis.set(`{case}:${caseID}:ready_to_submit`, result);
				} catch (err) {
					logger.error({ err }, "Ready to submit trigger error");
				}
			}
			return progression;
		} catch (error) {
			throw error;
		}
	}
	async getEsignStatus(customerConfig) {
		if (!Array.isArray(customerConfig)) return false;
		const reviewStage = customerConfig.find(stage => stage.stage_code === "review");

		if (!reviewStage || !reviewStage.config || !Array.isArray(reviewStage.config.fields)) {
			return false;
		}

		const mpaField = reviewStage.config.fields.find(field => field.section_name === "eSign");

		return mpaField ? mpaField.status : false;
	}
	async getProgressionConfigWithCustomFields(
		progressionConfig,
		customerID,
		sectionVisibility,
		includeHiddenForGuest = false
	) {
		const reviewStage = progressionConfig[progressionConfig.length - 1];
		const customFieldStage = progressionConfig[progressionConfig.length - 2];
		let currentOrder = customFieldStage.priority_order;
		let prevStage = customFieldStage.prev_stage;
		progressionConfig.splice(progressionConfig.length - 2);
		let setSectionName = new Set();
		let currentCustomFieldStage = "";

		let getCustomFieldStageQuery = `WITH LatestTemplates AS (
			SELECT id AS template_id, customer_id
			FROM onboarding_schema.data_custom_templates
			WHERE customer_id = $1
			ORDER BY version DESC
			LIMIT 1 )
		SELECT DISTINCT dcf.section_name, dcf.sequence_number, dcf.section_visibility
		FROM onboarding_schema.data_custom_fields dcf
		JOIN LatestTemplates lt
		ON dcf.template_id = lt.template_id `;

		const applicantAccessList = [FIELD_ACCESS.DEFAULT.toUpperCase()];
		if (includeHiddenForGuest) {
			applicantAccessList.push(FIELD_ACCESS.HIDDEN.toUpperCase());
			sectionVisibility.push(SECTION_VISIBILITY.HIDDEN);
		}
		const valuesForQuery: (string | string[])[] = [customerID, applicantAccessList];

		if (sectionVisibility && sectionVisibility.length) {
			getCustomFieldStageQuery += `
				WHERE dcf.section_visibility = ANY($3::public.section_visibility[])
          		AND dcf.applicant_access = ANY($2::onboarding_schema.column_access[])
    		`;
			valuesForQuery.push(sectionVisibility);
		} else {
			getCustomFieldStageQuery += `
        		WHERE dcf.applicant_access = ANY($2::onboarding_schema.column_access[])
    		`;
		}

		getCustomFieldStageQuery += `ORDER BY dcf.sequence_number ASC;`;

		const getCustomFieldStageDetails = (await sqlQuery({ sql: getCustomFieldStageQuery, values: valuesForQuery })).rows;
		if (getCustomFieldStageDetails.length > 0) {
			let lastStageID = prevStage; // Start with the previous stage ID

			getCustomFieldStageDetails.forEach(stage => {
				const sectionName = stage.section_name;

				// Check if the section_name has already been processed
				if (!setSectionName.has(sectionName)) {
					// Create a unique ID for the stage
					const stageID = `custom_fields:${sectionName}:${currentOrder}`;

					// Add the new stage to progressionConfig
					progressionConfig.push({
						id: stageID,
						label: sectionName,
						stage: `custom_fields:${sectionName}`,
						priority_order: currentOrder,
						prev_stage: lastStageID, // Link to the previous stage
						next_stage: null, // To be updated later
						is_enabled: true,
						is_skippable: false,
						allow_back_nav: true,
						completion_weightage: 0,
						config: null,
						visibility: stage.section_visibility
					});

					// Update the lastStageID
					lastStageID = stageID;

					// Increment the order
					currentOrder++;

					// Mark this section as processed
					setSectionName.add(sectionName);

					// Determine the first custom field stage
					if (!currentCustomFieldStage) {
						currentCustomFieldStage = sectionName;
					}
				}
			});
		}
		reviewStage.priority_order = currentOrder;
		progressionConfig.push(reviewStage);
		for (let i = 1; i < progressionConfig.length - 1; i++) {
			progressionConfig[i].prev_stage = progressionConfig[i - 1].id;
			progressionConfig[i].next_stage = progressionConfig[i + 1].id;
		}
		progressionConfig[progressionConfig.length - 1].prev_stage = progressionConfig[progressionConfig.length - 2].id;

		return progressionConfig;
	}
	getCustomStageProgression(progression, label) {
		let currentStageIndex = 0;
		let prevStage;
		let nextStage;
		progression.stages.map(row => {
			if (row.label === label) {
				prevStage = progression.stages[currentStageIndex - 1];
				currentStageIndex++;
				nextStage = progression.stages[currentStageIndex];
			} else {
				currentStageIndex++;
			}
		});
		return { prev_stage: prevStage, next_stage: nextStage };
	}

	async addOrUpdateCustomFields(params, body, files, userInfo) {
		const { caseID: caseId } = params;
		const { businessId, templateId, fields } = body;

		if (!fields || !fields.length)
			throw new BusinessApiError(
				`Fill out the required field(s) to continue.`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);

		/** Validate field values. */
		const validateResult = CustomFieldHelper.validateCustomFieldValues(fields);
		if (validateResult.error)
			throw new BusinessApiError(validateResult.message, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);

		/** Track edited fields for use with custom field kafka events. */
		const editedFields: {
			field_id: string;
			field_code: string;
			field_label: string;
			old_value: string | null;
			new_value: string;
		}[] = [];

		const fileFieldMap = {};
		files?.forEach(file => {
			const fieldName = file.fieldname;
			fileFieldMap[fieldName] = file;
		});

		/** Pre-fetch existing field values and field metadata */
		const existingFieldsMap = new Map<string, string | null>();
		const fieldMetadataMap = new Map<string, { code: string; label: string }>();
		const fieldIds = fields.map(f => f.customer_field_id);
		const [existingFields, fieldMetadata] = await Promise.all([
			/** Fetch all existing field values */
			sqlQuery({
				sql: `SELECT field_id, field_value
				FROM onboarding_schema.data_business_custom_fields
				LEFT JOIN data_businesses db ON db.id = onboarding_schema.data_business_custom_fields.business_id
				WHERE case_id = $1 AND template_id = $2 AND field_id = ANY($3) AND db.is_deleted = false`,
				values: [caseId, templateId, fieldIds]
			}),
			/** Fetch all field ids, codes, and labels */
			sqlQuery({
				sql: `SELECT id, code, label FROM onboarding_schema.data_custom_fields WHERE id = ANY($1)`,
				values: [fieldIds]
			})
		]);

		existingFields.rows.forEach(row => existingFieldsMap.set(row.field_id, row.field_value));
		fieldMetadata.rows.forEach(row => fieldMetadataMap.set(row.id, { code: row.code, label: row.label }));

		const queries: string[] = [];
		const values: any[] = [];
		for (const field of fields) {
			const { customer_field_id, value, type, value_id } = field;
			let fieldValue = value;

			// Convert MM/DD/YYYY → ISO for database storage
			if (type === "date") {
				// Some payloads arrive as stringified JSON and others as plain strings/objects;
				// normalize them so we always work with the raw date string before calling toISO.
				let date = fieldValue;

				if (typeof date === "string") {
					// Detect JSON-encoded date objects (e.g. `{ "value": "02/14/2024" }`).
					const trimmed = date.trim();
					if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
						try {
							const parsed = JSON.parse(trimmed);
							date = parsed;
						} catch (_error) {
							// ignore parse error and fall back to raw string
						}
					}
				}

				if (date && typeof date === "object" && "value" in (date as Record<string, unknown>)) {
					// Extract the actual date string from object payloads.
					date = (date as Record<string, unknown>).value;
				}

				fieldValue = toISO(typeof date === "string" ? date : "") ?? null;
			}
			let oldValue = null;

			if (type === "upload" && value === "null") {
				if (value_id) {
					// Case: File existed before but was deleted
					const deleteQuery = `UPDATE onboarding_schema.data_business_custom_fields SET field_value = NULL WHERE id = $1`;
					queries.push(deleteQuery);
					values.push([value_id]);
				} else {
					const insertQuery = `
						INSERT INTO onboarding_schema.data_business_custom_fields
						(business_id, case_id, template_id, field_id, field_value, created_by)
						VALUES ($1, $2, $3, $4, $5, $6)
						ON CONFLICT (business_id, case_id, template_id, field_id)
						DO UPDATE SET field_value = EXCLUDED.field_value
						RETURNING id;
					`;
					queries.push(insertQuery);
					values.push([businessId, caseId, templateId, customer_field_id, null, userInfo.user_id]);
				}
			}

			if (type === "upload") {
				const fileFieldName = `fields[${fields.indexOf(field)}][value]`;
				const file = fileFieldMap[fileFieldName];
				if (file?.buffer) {
					const { buffer, originalname } = file;
					let contentType = originalname.split(".").pop();
					const fileName = originalname.split(".")[0];
					if (!value_id) {
						// To ensure that file name is unique for multiple files of same custom field
						const timeStamp = Date.now().toString();
						fieldValue = `${fileName}-{${timeStamp}}.${contentType}`;
					} else {
						fieldValue = `${fileName}-{${value_id}}.${contentType}`;
					}
					if (contentType === "pdf") {
						contentType = "application/pdf";
					}
					await uploadFile(
						buffer,
						fieldValue,
						contentType,
						`${DIRECTORIES.CUSTOM_FIELD_FILES}/businesses/${businessId}/cases/${caseId}`,
						BUCKETS.BACKEND
					);
				}
			}

			const getFieldQuery = `SELECT 1 FROM onboarding_schema.data_business_custom_fields
			LEFT JOIN data_businesses db ON db.id = onboarding_schema.data_business_custom_fields.business_id
			WHERE case_id = $1 AND template_id = $2 AND field_id = $3 AND db.is_deleted = false`;
			const updateFieldQuery = `UPDATE onboarding_schema.data_business_custom_fields SET field_value = $1, created_by = $2 WHERE case_id = $3 AND template_id = $4 AND field_id = $5`;
			const insertFieldQuery = `INSERT INTO onboarding_schema.data_business_custom_fields (business_id, case_id, template_id, field_id, field_value, created_by) VALUES ($1, $2, $3, $4, $5, $6)`;

			const result = await sqlQuery({
				sql: getFieldQuery,
				values: [caseId, templateId, customer_field_id]
			});

			if (result.rowCount && type !== "upload") {
				queries.push(updateFieldQuery);
				values.push([fieldValue, userInfo.user_id, caseId, templateId, customer_field_id]);
			} else if (result.rowCount && type === "upload" && value_id) {
				const updateQueryForUpload = `UPDATE onboarding_schema.data_business_custom_fields SET field_value = $1, created_by = $2 WHERE case_id = $3 AND template_id = $4 AND id = $5`;
				queries.push(updateQueryForUpload);
				values.push([fieldValue, userInfo.user_id, caseId, templateId, value_id]);
			} else {
				queries.push(insertFieldQuery);
				values.push([businessId, caseId, templateId, customer_field_id, fieldValue, userInfo.user_id]);
			}

			oldValue = existingFieldsMap.get(customer_field_id) ?? null;

			/** If value actually changed, add to edited fields. */
			if (`${oldValue}` !== `${fieldValue}`) {
				const metadata = fieldMetadataMap.get(customer_field_id);
				editedFields.push({
					field_id: customer_field_id,
					field_code: metadata?.code,
					field_label: metadata?.label,
					old_value: oldValue,
					new_value: fieldValue
				});
			}
		}

		/** Update or insert custom fields */
		await sqlTransaction(queries, values);

		/** Send custom field update events */
		const customerId = userInfo?.issued_for?.customer_id as UUID;
		const cachedApplicationEditInvite = await caseManager.getCachedApplicationEditInvite(caseId, customerId);
		await sendCustomFieldUpdateEvents({
			businessId,
			/**
			 * If the current user is a guest owner, they may not have any information in `issued_for`.
			 * In this case, we can use the customer ID from the cached application edit invite.
			 */
			customerId: customerId ?? cachedApplicationEditInvite?.customerID,
			caseId,
			userInfo,
			editedFields,
			cachedApplicationEditInvite
		});
	}

	async createBusinessFromEgg(businessEgg: Business.Egg): Promise<Business.Record> {
		// Accessing the naics_code directly from the businessEgg parameter
		// check naicsCode and get corresponding mcc id
		businessEgg = await this.populateNaicsAndMccIdFromNaicsAndMccCodes(businessEgg);
		const insert = await db("data_businesses").insert(businessEgg).returning("*");
		return insert[0];
	}
	async updateBusiness(
		business: Partial<
			Pick<
				Business.Record,
				"address_line_1",
				"address_line_2",
				"address_city",
				"address_state",
				"address_postal",
				| "industry"
				| "naics_code"
				| "naics_title"
				| "naics_id"
				| "mcc_id"
				| "name"
				| "updated_by"
				| "updated_at"
				| "dba_names"
				| "user_id"
				| "tin"
			>
		> & { id: string }
	): Promise<Business.Record> {
		const businessID = business.id;
		const dbaNames = business.dba_names;
		const userId = business.user_id;
		let isDbaUpdated = false;
		if (!businessID) {
			throw new BusinessApiError("Business ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		const currentBusiness = await this.getBusinessByID({ businessID, tinBehavior: TIN_BEHAVIOR.PLAIN });
		// Accessing the naics_code directly from the business parameter
		business = await this.populateNaicsAndMccIdFromNaicsAndMccCodes(business);

		//remove entries that are not updatable with this method
		const allowedWhenUnverified = [
			"name",
			"address_line_1",
			"address_line_2",
			"address_city",
			"address_state",
			"address_postal_code"
		];
		const allowed = [
			"industry",
			"naics_id",
			"mcc_id",
			"updated_by",
			"updated_at",
			"official_website",
			"mobile",
			"public_website",
			"social_account",
			"tin",
			"address_country",
			...allowedWhenUnverified
		];
		Object.keys(business).forEach(key => {
			if (!allowed.includes(key)) {
				delete business[key];
			}
		});

		try {
			if (businessID && dbaNames && (Object.keys(dbaNames).length > 0 || business.name)) {
				isDbaUpdated = await this.updateDBAName(business, dbaNames, { user_id: userId, business_id: businessID });
			}

			const blockedKeys = Object.keys(business).filter(
				item => allowedWhenUnverified.includes(item) && business[item] != currentBusiness[item]
			);
			if (currentBusiness.status === Business.Status.VERIFIED && blockedKeys.length > 0) {
				throw new ApiError(
					`Cannot update ${blockedKeys.join(", ")} for a verified business`,
					"BlockedKeysError",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			if (Object.keys(business).length > 0) {
				business.updated_by = business.updated_by ? business.updated_by : userId;
				const update = await db("data_businesses")
					.where("id", businessID)
					.andWhere("data_businesses.is_deleted", false)
					.update(business)
					.returning("*");
				return update[0];
			}
		} catch (error) {
			logger.debug(error);
			const errorMessage =
				error instanceof ApiError && error.name === "BlockedKeysError" ? error.message : "Invalid business details";
			throw new BusinessApiError(errorMessage, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: businessID });

		// throw error if no data available to update (dba name and business details both not available to update)
		if (!isDbaUpdated) {
			throw new BusinessApiError(
				`businessId=${businessID}; No fields to update`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		return;
	}

	async sendBusinessInvited(
		{
			businessID,
			customerID,
			applicantID,
			userID,
			caseID
		}: { businessID: string; applicantID?: string; customerID?: string; caseID?: string; userID: string },
		messageType: typeof kafkaEvents.BUSINESS_INVITED | typeof kafkaEvents.BUSINESS_INVITE_ACCEPTED,
		externalID?: string
	): Promise<void> {
		const businessInvitedMessage = {
			case_id: caseID,
			customer_id: customerID,
			applicant_id: applicantID,
			business_id: businessID,
			created_by: userID,
			external_id: externalID
		};
		await producer.send({
			topic: kafkaTopics.BUSINESS,
			messages: [
				{
					key: businessID,
					value: {
						event: messageType,
						...businessInvitedMessage
					}
				}
			]
		});

		const businessApplicants = await getBusinessApplicantsForWebhooks(businessID);

		// send webhook msg
		await sendWebhookEvent(customerID, WEBHOOK_EVENTS.ONBOARDING_INVITED, {
			...businessInvitedMessage,
			status: "INVITED",
			business_applicants: businessApplicants
		});
	}

	/**
	 * @params {object, object}
	 * @returns {}
	 * This function validates the business details and then creates a business & case entry
	 * @deprecated See validateBusiness.ts#validateBusiness
	 */
	async validateBusiness(
		params: { businessID: any },
		body: any,
		userInfo: { user_id: string; given_name?: string; email?: string; family_name?: string },
		{ authorization = "", shouldRunSerpSearch = false, isAsync = false } = {}
	) {
		try {
			body.business_id = params.businessID;

			// This code is to check if the user is onboarding a business with easy flow
			// Then generate random invalid TIN and use it to reduce the conflicts with real TINs
			// NOTE: invalidTIN is 9 digit number and it is not a valid TIN as per Social Security Administration (SSA)
			const isEasyFlow =
				authorization && (await getFlagValueByToken(FEATURE_FLAGS.WIN_1152_EASY_ONBOARDING_FLOW, { authorization }));
			if (isEasyFlow) {
				let invalidTIN = null;
				do {
					const randomTIN = await generateRandomInvalidTIN();
					const getBusinessWithTinQuery = "SELECT * FROM data_businesses WHERE tin = $1";
					const getBusinessWithTinResult = await sqlQuery({
						sql: getBusinessWithTinQuery,
						values: [encryptEin(randomTIN)]
					});
					if (!getBusinessWithTinResult.rowCount) {
						invalidTIN = randomTIN;
					}
				} while (!invalidTIN);
				body.tin = invalidTIN;
			}
			let response: any = await this.checkTinExists(body, userInfo.user_id);
			logger.debug(`businessId=${body.business_id} TIN check response: ${JSON.stringify(response)}`);
			const standaloneCaseQuery = `SELECT * FROM data_cases WHERE business_id = $1 AND customer_id IS NULL AND applicant_id = $2`;
			const [standaloneCase] = await sqlTransaction([standaloneCaseQuery], [[params.businessID, userInfo.user_id]]);

			if (
				response &&
				response.existing_business_found &&
				response.is_business_applicant &&
				response.is_business_verified
			) {
				// This scenario occurs whenever there is an invite to new business
				// but they use existing business TIN and got approval from existing business owner
				if (body.invite_id) {
					// create a new case, update data_invites and accept the invite
					// send newly created case_id in response
					const caseID = uuid();
					let queries: string[] = [];
					let values: any[] = [];

					// This will return 1 row with invite id
					const getInviteByIDQuery = `SELECT data_invites.* FROM data_invites
					LEFT JOIN data_businesses db ON db.id = data_invites.business_id
					WHERE data_invites.id = $1 AND db.is_deleted = false`;
					const invite = await sqlQuery({ sql: getInviteByIDQuery, values: [body.invite_id] });

					if (!invite.rowCount) {
						throw new BusinessApiError("Invitation not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
					}

					const customerID = invite.rows[0].customer_id;

					// Fetch cached application edit invite for guest owner applicant ID resolution
					const cachedApplicationEditInvite = await caseManager.getCachedApplicationEditInvite(caseID, customerID);

					const insertCaseQuery = `INSERT INTO data_cases(id, applicant_id, customer_id, business_id, status, created_by, updated_by, case_type)
								VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT id FROM core_case_types WHERE code = $8))`;
					const insertCaseHistoryQuery = `INSERT INTO data_case_status_history (case_id, status,created_by)
						VALUES ($1, $2, $3)`;

					queries.push(insertCaseQuery);
					queries.push(insertCaseHistoryQuery);
					values.push([
						caseID,
						userInfo.user_id,
						customerID,
						response.business_id,
						CASE_STATUS.ONBOARDING,
						userInfo.user_id,
						userInfo.user_id,
						"onboarding"
					]);
					values.push([caseID, CASE_STATUS.ONBOARDING, userInfo.user_id]);
					const updateInviteQuery = `UPDATE data_invites SET case_id = $1 WHERE id = $2`;
					queries.push(updateInviteQuery);
					values.push([caseID, body.invite_id]);

					// Initialize data integration tasks progress with is_complete: false
					const insertIntegrationProgressQuery = `INSERT INTO data_integration_tasks_progress
						(case_id, business_id, customer_id, is_complete, total_tasks, completed_tasks)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
						ON CONFLICT (case_id) DO NOTHING`;
					queries.push(insertIntegrationProgressQuery);
					values.push([caseID, response.business_id, customerID, false, 0, 0, JSON.stringify([]), JSON.stringify([])]);

					await sqlTransaction(queries, values);
					await this.updateInvitationStatus({ invitation_id: body.invite_id, action: "ACCEPT" }, userInfo);

					let businessAcceptMessage = {
						case_id: caseID,
						business_id: response.business_id,
						customer_id: customerID,
						applicant_id: userInfo.user_id
					};

					const auditMessage = {
						case_id: caseID,
						business_name: body.name,
						applicant_id: resolveApplicantIdForAudit({
							userInfo,
							cachedApplicationEditInvite
						}),
						business_id: params.businessID
					};

					/**
					 * This event is emitted after user validates the existing TIN and user have approval from business owner.
					 * This event would be consumed by integration service to fill up connections and integrations entries for this case_id
					 */
					await producer.send({
						topic: kafkaTopics.BUSINESS,
						messages: [
							{
								key: response.business_id,
								value: {
									event: kafkaEvents.BUSINESS_INVITE_ACCEPTED,
									...businessAcceptMessage
								}
							}
						]
					});

					// Create an audit log
					await producer.send({
						topic: kafkaTopics.NOTIFICATIONS,
						messages: [
							{
								key: response.business_id,
								value: {
									event: kafkaEvents.CASE_CREATED_AUDIT,
									...auditMessage
								},
								headers: { idempotencyID: caseID }
							}
						]
					});

					response.case_id = caseID;
				} else {
					// This scenario occurs when any standalone applicant uses existing TIN
					// and got approval from existing business owner
					// Then send existing standalone case or create new standalone case send it to the applicant
					// And we should not create new standlone case if it already exists.
					// Refresh cycle for standlaone case can be done through subscription only
					const getExistingStandaloneCaseQuery = `SELECT * FROM data_cases WHERE business_id = $1 AND customer_id IS NULL AND applicant_id = $2`;
					const existingBusinessStandaloneCase = await sqlQuery({
						sql: getExistingStandaloneCaseQuery,
						values: [response.business_id, userInfo.user_id]
					});
					if (!existingBusinessStandaloneCase.rowCount) {
						const caseID = uuid();
						const insertStandaloneCaseQuery = `INSERT INTO data_cases(id, business_id, applicant_id, status, created_by, updated_by, case_type)
							VALUES ($1, $2, $3, $4, $5, $6, (SELECT id FROM core_case_types WHERE code = $7))`;
						const insertCaseHistoryQuery = `INSERT INTO data_case_status_history (case_id, status,created_by)
							VALUES ($1, $2, $3)`;
						await sqlTransaction(
							[insertStandaloneCaseQuery, insertCaseHistoryQuery],
							[
								[
									caseID,
									response.business_id,
									userInfo.user_id,
									CASE_STATUS.ONBOARDING,
									userInfo.user_id,
									userInfo.user_id,
									"onboarding"
								],
								[caseID, CASE_STATUS.ONBOARDING, userInfo.user_id]
							]
						);

						response.case_id = caseID;

						// Fetch cached application edit invite for guest owner applicant ID resolution
						// Note: This is a standalone case (no customer_id), so cachedInvite will be null
						const cachedApplicationEditInvite = null;

						let businessAcceptMessage = {
							case_id: caseID,
							business_id: response.business_id,
							applicant_id: userInfo.user_id
						};
						await producer.send({
							topic: kafkaTopics.BUSINESS,
							messages: [
								{
									key: response.business_id,
									value: {
										event: kafkaEvents.BUSINESS_INVITE_ACCEPTED,
										...businessAcceptMessage
									}
								}
							]
						});

						const auditMessage = {
							case_id: caseID,
							business_name: body.name,
							applicant_id: resolveApplicantIdForAudit({
								userInfo,
								cachedApplicationEditInvite
							}),
							business_id: params.businessID
						};

						// Create an audit log
						await producer.send({
							topic: kafkaTopics.NOTIFICATIONS,
							messages: [
								{
									key: response.business_id,
									value: {
										event: kafkaEvents.CASE_CREATED_AUDIT,
										...auditMessage
									},
									headers: { idempotencyID: caseID }
								}
							]
						});
					} else {
						response.case_id = existingBusinessStandaloneCase.rows[0].id;
					}
				}

				await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: params.businessID });
				// The tin number provided matches an existing business and the applicant who invoked this api is a part of that business hence no need to reverify with mid desk
				return {
					data: response,
					message: "Your business was linked with an existing business with the matching TIN number"
				};
			} else if (response && response.existing_business_found && !response.is_business_applicant) {
				// The tin number provided matches an existing business but the applicant who invoked this api is not a part of that business
				// for null tin we checking and saving data
				if (body?.tin === "000000000" || !body?.tin) {
					const businessID = body.business_id;
					await this.businessCreationSideEffects({ businessID, standaloneCase }, body, userInfo);
				}

				await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: params.businessID });
				return { data: response, message: "Authentication required" };
			} else if (
				response &&
				!response.existing_business_found &&
				!response.is_business_applicant &&
				!response.is_business_verified
			) {
				// If there is no business found with the provided TIN, then continue with the validation
				const businessID = body.business_id;

				const midDeskBody = {
					name: body.name,
					address_line_1: body.address_line_1,
					address_postal_code: body.address_postal_code,
					address_city: body.address_city,
					address_state: body.address_state,
					tin: body.tin,
					official_website: body.official_website
				};

				// Submit details for google places search
				if (shouldRunSerpSearch) {
					try {
						const serpSearchPromise = submitBusinessEntityForSerpSearch(businessID, {
							businessName: body.name,
							businessAddress: `${body.address_line_1}, ${body.address_city}, ${body.address_state}, ${body.address_postal_code}`,
							is_bulk: true
						});
						if (isAsync) {
							void serpSearchPromise.catch(err => {
								logger.error({ err }, "submitBusinessEntityForSerpSearch: Serp submit error");
							});
						} else {
							await serpSearchPromise;
						}

						// todo: store the top 3 local results in the database
						// if (!serpSearchResponse.businessMatch && serpSearchResponse.local_results.length > 0) {
						// the response will include local relevant business matches if there were any
						// store the top 3 local results in the database
						// }
					} catch (err) {
						logger.error({ err }, "submitBusinessEntityForSerpSearch: Serp submit error");
					}
				}

				try {
					// Submit details to middesk for business verification
					await submitBusinessEntityForReview(businessID, midDeskBody, authorization);
				} catch (submitError) {
					logger.warn(`Middesk submission failed: attempting update: ${submitError.message}`);
					try {
						let updateBody = {
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
							}
						};
						if (body.official_website) {
							updateBody.website = {
								url: body.official_website
							};
						}
						await updateBusinessEntityForReview(businessID, updateBody, authorization);
					} catch (updateError) {
						logger.warn(`Middesk update failed: ${updateError.message}`);
						throw updateError;
					}
				}

				response = await this.businessCreationSideEffects({ businessID, standaloneCase }, body, userInfo);

				await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: params.businessID });

				// Retry the verification for a maximum of 3 times with 8-second interval
				const verifyBusinessPromise: Promise<void> = new Promise((resolve, reject) => {
					let retryCount = 0;
					const interval = setInterval(async () => {
						const businessVerificationDetails: BusinessEntityVerificationDetails =
							await getBusinessEntityVerificationDetails(businessID, authorization);
						// middesk status can be any of following
						// open, pending, in_audit, in_review, approved, rejected
						// if status is "in_review" or "approved" then we can proceed further
						// if status is "rejected" then we need to stop the process and return the error message
						// for other status we are retrying for 3 times over the interval of X seconds to continuously poll for latest status as there can be delay in Mid Desks verification
						// for this polling period, applicant stays on the loader UI
						const middeskVerificationStatus = businessVerificationDetails?.businessEntityVerification?.status;

						// For future: tin is in businessEntityVerification.businessEntityVerification.tin
						const [isBusinessVerificationValid, verificationMessage] =
							BusinessUtils.isBusinessVerificationValid(businessVerificationDetails);
						if (!isBusinessVerificationValid) {
							clearInterval(interval);
							reject(
								new BusinessApiError(
									`TIN Verification failed: ${verificationMessage}`,
									StatusCodes.BAD_REQUEST,
									ERROR_CODES.INVALID
								)
							);
							return;
						}
						logger.info(`Business Verification Status: ${isBusinessVerificationValid} : ${verificationMessage}`);
						// TODO: check the correct status for processing further
						if (middeskVerificationStatus === "in_review" || middeskVerificationStatus === "approved") {
							clearInterval(interval);
							logger.info("Business verification is in review");
							resolve();
						} else if (middeskVerificationStatus === "rejected") {
							clearInterval(interval);
							reject(
								new BusinessApiError(
									"Business verification failed. Please verify your details.",
									StatusCodes.BAD_REQUEST,
									ERROR_CODES.INVALID
								)
							);
						} else {
							logger.debug(
								`businessId=${businessID} verification status: ${middeskVerificationStatus}, retry ${retryCount}`
							);
						}

						// Increment retry count
						retryCount++;

						// Check if maximum retry count reached
						if (retryCount >= 4 * 3) {
							clearInterval(interval); // Stop retrying
							reject(
								new BusinessApiError(
									"Your business has been queued for verification.",
									StatusCodes.BAD_REQUEST,
									ERROR_CODES.AWAITING_THIRD_PARTY_RESPONSE
								)
							);
						}
					}, 2000);
				});
				// Wait for the verification process to complete
				await verifyBusinessPromise;

				// Return response before verification completes
				return { data: response, message: "Business Validated Sucessfully" };
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Business creation side effects we always want to run when creating a business
	 * @param params
	 * @param body
	 * @param userInfo
	 * @returns
	 */
	public async businessCreationSideEffects(
		params: { businessID: any; standaloneCase: any; applicantID?: UUID; customerInitiated?: boolean },
		body: any,
		userInfo: { user_id: string; given_name?: string; family_name?: string; email?: string }
	): Promise<{ case_id: string; business_id: string }> {
		const queries: string[] = [];
		const values: any[] = [];
		const mobileNumbers = [];
		let customerID;
		const { businessID, customerInitiated } = params;
		const applicantID = params.applicantID ?? userInfo.user_id;
		if (body.invite_id) {
			const getInviteByIDQuery = `SELECT data_invites.* FROM data_invites
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE data_invites.id = $1 AND db.is_deleted = false`;
			const invite = await sqlQuery({ sql: getInviteByIDQuery, values: [body.invite_id] });
			if (!invite.rowCount) {
				throw new BusinessApiError("Invite not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			customerID = invite.rows[0].customer_id;
		} else if (body.customer_id) {
			customerID = body.customer_id;
		}

		if (Object.keys(body).length) {
			body.tin = body.tin ? encryptEin(body.tin) : null;

			// mobile number consistency
			if (body.mobile) {
				if (!body.mobile.startsWith("+")) {
					body.mobile = `+${body.mobile}`;
				}
				body.mobile = `+${formatNumberWithoutPlus(body.mobile)}`;
				mobileNumbers.push(body.mobile);
			}

			const businessBodyKeys: (keyof Business.Record)[] = [
				"name",
				"tin",
				"mobile",
				"address_line_1",
				"address_line_2",
				"address_city",
				"address_state",
				"address_postal_code",
				"address_country"
			];

			const businessDetails = Object.keys(body).reduce((acc, key) => {
				if (businessBodyKeys.includes(key)) {
					acc[key] = body[key];
				}
				return acc;
			}, {});

			const keys = Object.keys(businessDetails);

			let updateBusinessQuery = `UPDATE data_businesses SET
			${keys.map((key, index) => `${key} = $${index + 1}`).join(", ")},
			updated_by = $${keys.length + 1},`;

			updateBusinessQuery += ` status = $${keys.length + 2} `;

			updateBusinessQuery += ` WHERE id = $${keys.length + 3}`;

			const businessBodyValues = keys.map(key => businessDetails[key]);

			queries.push(updateBusinessQuery);
			values.push([...businessBodyValues, userInfo?.user_id, BUSINESS_STATUS.VERIFIED, params.businessID]);
		}

		const { onboardingCaseID: caseID } = await caseManagementService.ensureCasesExist(params.businessID, {
			applicantID,
			customerID,
			inviteID: body.invite_id,
			userInfo,
			customerInitiated: !!customerInitiated
		});

		// Fetch cached application edit invite for guest owner applicant ID resolution
		const cachedApplicationEditInvite = await caseManager.getCachedApplicationEditInvite(caseID, customerID);

		if (body.invite_id) void BusinessInvites.updateInvite(body.invite_id, { status: INVITE_STATUS.ACCEPTED });

		// insert into `business_names`
		const businessNamesSet: Set<string> = new Set([body.name]);
		if (Object.hasOwn(body, "dba_names") && body.dba_names?.length) {
			body.dba_names.forEach(dbaName => {
				businessNamesSet.add(dbaName.name);
			});
		}
		const businessNames = Array.from(businessNamesSet).map(n => {
			return { name: n };
		});
		await this.updateDBAName(body, businessNames, { user_id: userInfo.user_id, business_id: params.businessID });

		await this.updateMailingAddresses(businessID, body, userInfo.user_id);

		await sqlTransaction(queries, values);

		const message = {
			user_id: applicantID,
			business_id: businessID
		};

		await producer.send({
			topic: kafkaTopics.USERS_NEW,
			messages: [
				{
					key: businessID,
					value: {
						event: kafkaEvents.UPDATE_SUBROLE,
						...message
					}
				}
			]
		});

		const auditMessage = {
			case_id: caseID,
			business_name: body.name,
			applicant_id: resolveApplicantIdForAudit({
				userInfo,
				cachedApplicationEditInvite
			}),
			business_id: params.businessID
		};

		// Create an audit log
		await producer.send({
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [
				{
					key: params.businessID,
					value: {
						event: kafkaEvents.CASE_CREATED_AUDIT,
						...auditMessage
					},
					headers: { idempotencyID: caseID }
				}
			]
		});

		// create stripe customer kafka event
		if (userInfo && userInfo.given_name && userInfo.family_name && userInfo.email) {
			const stripeCustomerMessage = {
				case_id: caseID,
				business_id: businessID,
				business_name: body.name,
				...(customerID && { customer_id: customerID }),
				applicant_id: userInfo.user_id,
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
		}

		if (hasValuesForKeys<Partial<Business.Record>>(body, "name", "address_line_1", "address_city", "address_state")) {
			/**
			 * If the business has enough information to fetch the google profile, trigger the associated kafka event
			 */
			await producer.send({
				topic: kafkaTopics.BUSINESS,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.FETCH_GOOGLE_PROFILE,
							business_id: businessID
						}
					}
				]
			});
		}

		return {
			case_id: caseID,
			business_id: businessID
		};
	}

	public async businessUpdateSideEffects(
		params: { businessID: UUID; applicantID?: UUID },
		body: any,
		userInfo: { user_id: UUID; given_name?: string; family_name?: string; email?: string }
	): Promise<void> {
		const queries: string[] = [];
		const values: any[] = [];

		const { businessID } = params;
		const applicantID = params.applicantID ?? userInfo?.user_id;

		// throw error if invite not found
		if (body.invite_id) {
			const getInviteByIDQuery = `SELECT data_invites.* FROM data_invites
			LEFT JOIN data_businesses db ON db.id = data_invites.business_id
			WHERE data_invites.id = $1 AND db.is_deleted = false`;
			const invite = await sqlQuery({ sql: getInviteByIDQuery, values: [body.invite_id] });
			if (!invite.rowCount) {
				throw new BusinessApiError("Invite not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// accept the invitation
			await this.updateInvitationStatus({ invitation_id: body.invite_id, action: "ACCEPT" }, userInfo);
		}

		// update the business details
		const updateBody = {
			name: body.name,
			tin: body.tin ? encryptEin(body.tin) : null,
			mobile: body.mobile,
			address_line_1: body.address_line_1,
			address_line_2: body.address_line_2,
			address_city: body.address_city,
			address_state: body.address_state,
			address_postal_code: body.address_postal_code,
			address_country: resolveCountryCode(body?.address_country) ?? SupportedCountryCode.US
		};
		await this.updateBusinessDetails({ ...updateBody, ...body.additional_details }, { businessID }, userInfo);

		// insert into `business_names`
		const businessNamesSet: Set<string> = new Set([body.name]);
		if (Object.hasOwn(body, "dba_names") && body.dba_names?.length) {
			body.dba_names.forEach(dbaName => {
				businessNamesSet.add(dbaName.name);
			});
		}
		const businessNames = Array.from(businessNamesSet).map(n => {
			return {
				name: n
			};
		});
		await this.updateDBAName(body, businessNames, { user_id: userInfo.user_id, business_id: params.businessID });

		// insert into `business_addresses`
		await this.updateMailingAddresses(businessID, body, userInfo.user_id);

		await sqlTransaction(queries, values);

		const message = {
			user_id: applicantID,
			business_id: businessID
		};

		const payload = {
			topic: kafkaTopics.USERS_NEW,
			messages: [
				{
					key: businessID,
					value: {
						event: kafkaEvents.UPDATE_SUBROLE,
						...message
					}
				}
			]
		};

		await producer.send(payload);
	}

	/**
	 * @params {object, object, object}
	 * @returns {}
	 * This function marks the business as VERIFIED if the TIN is unique, else if the TIN is not unique and matches the TIN from an existing business, all the entries with current business_id
	 * is replaced by the original TIN id business.
	 */
	async updateOrLinkBusiness(body, params, userInfo, { authorization }) {
		try {
			const getBusinessWithTinQuery = "SELECT * FROM data_businesses WHERE tin = $1";
			const getCurrentBusinessQuery = "SELECT * FROM data_businesses WHERE id = $1";
			const [existingBusiness, currentBusiness] = await sqlTransaction(
				[getBusinessWithTinQuery, getCurrentBusinessQuery],
				[[body.tin], [params.businessID]]
			);

			if (!currentBusiness.rowCount) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			let businessID = currentBusiness.rows[0].id;
			// If there exists a business with the given TIN, then we need to re link the businesses
			if (existingBusiness.rowCount) {
				// This needs to be done only if the existing business is different from current business
				if (currentBusiness.rows[0].id !== existingBusiness.rows[0].id) {
					if (currentBusiness.rows[0].status === "VERIFIED") {
						/*
						 * TODO : This error needs to be removed in future. Adding this error because VERIFIED businesses might have entries in other services such as INTEGRATION and SCORING Service
						 * handling changes for all services would increase the scope of the current task by a good margin
						 */
						throw new BusinessApiError(
							"Verified businesses are not allowed to update their TIN and Name. Contact Support",
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					}

					// Check whether this applicant is allowed to update the current business to an existing business
					const applicant = await getApplicantByID(userInfo.user_id, authorization);

					let isBusinessApplicant = false;

					applicant.subroles.forEach(subrole => {
						if (subrole.business_id === existingBusiness.rows[0].id) {
							if (["owner", "user"].includes(subrole.code) && subrole.status === "ACTIVE") {
								isBusinessApplicant = true;
							}
						}
					});

					const getBusinessCustomerRelationship =
						"SELECT customer_id FROM rel_business_customer_monitoring WHERE business_id = $1";
					// It would always return 1 entry only as it is an UNVERIFIED business
					const relation = await sqlQuery({
						sql: getBusinessCustomerRelationship,
						values: [currentBusiness.rows[0].id]
					});

					if (isBusinessApplicant) {
						const updateDataInvites = "UPDATE data_invites SET business_id = $1 WHERE business_id = $2";
						const updateRelBusinessOwners = "UPDATE rel_business_owners SET business_id = $1 WHERE business_id = $2";
						const updateDataCases = "UPDATE data_cases SET business_id = $1 WHERE business_id = $2";
						const updateRelCustomerBusinesses = `UPDATE rel_business_customer_monitoring  SET business_id = $1  WHERE business_id = $2
							AND NOT EXISTS (
								SELECT 1
								FROM rel_business_customer_monitoring
								WHERE customer_id = $3
								AND business_id = $1
							);
							`;
						const deleteRelCustomerBusinesses = `DELETE FROM rel_business_customer_monitoring WHERE business_id = $1`;
						const deleteBusiness = "DELETE FROM data_businesses WHERE id = $1";

						let queries = [];
						let values = [];

						if (relation.rowCount) {
							queries.push(updateRelCustomerBusinesses);
							values.push([existingBusiness.rows[0].id, currentBusiness.rows[0].id, relation.rows[0].customer_id]);
						}

						queries = [
							updateDataInvites,
							updateRelBusinessOwners,
							updateDataCases,
							deleteRelCustomerBusinesses,
							deleteBusiness
						];
						values = [
							[existingBusiness.rows[0].id, currentBusiness.rows[0].id],
							[existingBusiness.rows[0].id, currentBusiness.rows[0].id],
							[existingBusiness.rows[0].id, currentBusiness.rows[0].id],
							[currentBusiness.rows[0].id],
							[currentBusiness.rows[0].id]
						];

						await sqlTransaction(queries, values);

						// TODO : Update subrole in auth service to remove entries for old business. Not a breaking change but it is required to clean the db

						businessID = existingBusiness.rows[0].id;

						return {
							data: { business_id: businessID, is_business_applicant: isBusinessApplicant },
							message: "Your business was linked with an existing business with the matching TIN number"
						};
					} else {
						// If the applicant doesn't belong to the business then return owner email to FE to prompt the user to send email to requestee applicant for business access
						const applicants = await getBusinessApplicants(existingBusiness.rows[0].id, authorization);
						let ownerEmail = "";
						let ownerID = "";
						applicants.forEach(applicant => {
							if (applicant.code === "owner") {
								ownerEmail = applicant.email;
								ownerID = applicant.id;
							}
						});
						let data = {
							is_business_applicant: isBusinessApplicant,
							owner_email: ownerEmail,
							owner_id: ownerID,
							requestee_id: userInfo.user_id,
							business_id: existingBusiness.rows[0].id
						};
						if (relation.rowCount) {
							data = {
								...data,
								customer_id: relation.rows[0].customer_id
							};
						}
						return {
							data,
							message: "Authentication reuired"
						};
					}
				} else {
					const message = {
						user_id: userInfo.user_id,
						business_id: existingBusiness.rows[0].id
					};

					const payload = {
						topic: kafkaTopics.USERS_NEW,
						messages: [
							{
								key: businessID,
								value: {
									event: kafkaEvents.UPDATE_SUBROLE,
									...message
								}
							}
						]
					};

					await producer.send(payload);

					return { data: { business_id: currentBusiness.rows[0].id }, message: "Your business is already verified." };
				}
			} else if (currentBusiness.rows[0].status === "VERIFIED") {
				/*
				 * TODO : This error needs to be removed in future. Adding this error because VERIFIED businesses might have entries in other services such as INTEGRATION and SCORING Service
				 * handling changes for all services would increase the scope of the current task by a good margin
				 */

				throw new BusinessApiError(
					"Verified businesses are not allowed to update their TIN and Name. Contact Support",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);

				/*
				 * If there exists no business with the given tin, and the business who invoked the api is already a VERIFIED business, then update the tin only
				 * const updateDataBusinesses = "UPDATE data_businesses SET tin = $1 WHERE business_id = $2";
				 * await sqlQuery({ sql: updateDataBusinesses, values: [body.tin, currentBusiness.rows[0].id] });
				 */
			} else {
				// If there exists no business with the given tin, and the business who invoked the api is not VERIFIED, then update the status to VERIFIED
				const updateDataBusinesses = "UPDATE data_businesses SET status = $1, name = $2, tin = $3 WHERE id = $4";
				await sqlQuery({
					sql: updateDataBusinesses,
					values: ["VERIFIED", body.name, body.tin, currentBusiness.rows[0].id]
				});

				const message = {
					user_id: userInfo.user_id,
					business_id: currentBusiness.rows[0].id
				};

				const payload = {
					topic: kafkaTopics.USERS_NEW,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.UPDATE_SUBROLE,
								...message
							}
						}
					]
				};

				await producer.send(payload);

				return { data: { business_id: currentBusiness.rows[0].id }, message: "Your business is now verified." };
			}
		} catch (error) {
			throw error;
		}
	}
	async acceptInvitation(params: { invitationID: string }, userInfo: object): Promise<InvitationResponse> {
		try {
			const getBusinessQuery = `SELECT data_businesses.*, data_invites.customer_id, data_invites.case_id, core_invite_statuses.label as invitation_status, data_invites.created_by as owner_applicant_id
			FROM data_invites
			LEFT JOIN data_businesses ON data_businesses.id = data_invites.business_id
			LEFT JOIN core_invite_statuses ON core_invite_statuses.id = data_invites.status
			WHERE data_invites.id = $1 AND data_businesses.is_deleted = false`;
			const getBusinessResult = await sqlQuery({ sql: getBusinessQuery, values: [params.invitationID] });

			if (!getBusinessResult.rowCount) {
				throw new BusinessApiError("Invalid invitation", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			if (getBusinessResult.rows[0].invitation_status === INVITE_STATUS_ENUM.EXPIRED) {
				throw new BusinessApiError(
					"Business invitation has been expired",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}

			if (
				[INVITE_STATUS_ENUM.ACCEPTED, INVITE_STATUS_ENUM.COMPLETED].includes(
					getBusinessResult.rows[0].invitation_status
				)
			) {
				return {
					message: "Invitation is already accepted"
				};
			}

			const customerID = getBusinessResult.rows[0].customer_id; // declaring it because, it is being used multiple times

			let progressionConfig = await this.getProgressionConfig(customerID);

			const tinField = progressionConfig
				?.find(row => row.stage.toLowerCase() == "company")
				?.config?.fields?.find(
					field => field.name.toLowerCase() == "Tax ID Number/Employer Identification Number".toLowerCase()
				);

			const submitWithUnverifiedTin =
				tinField?.sub_fields?.find(
					subField => subField.name.toLowerCase() == "Submit with Unverified TIN".toLowerCase()
				)?.status || false; // Force a falsy value to false

			let message = "Success";
			if (
				(getBusinessResult.rows[0].status === BUSINESS_STATUS.VERIFIED &&
					getBusinessResult.rows[0].invitation_status === INVITE_STATUS_ENUM.INVITED) ||
				(getBusinessResult.rows[0].status === BUSINESS_STATUS.UNVERIFIED &&
					(submitWithUnverifiedTin || !isUSBusiness(getBusinessResult.rows[0].address_country)))
			) {
				// create case if not exists
				let caseID;
				const shouldPauseTransition = await getFlagValue(FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING, {
					key: "customer",
					kind: "customer",
					customer_id: customerID
				});
				if (shouldPauseTransition) {
					const selectCaseQuery = `SELECT id, status FROM data_cases WHERE business_id = $1 AND customer_id = $2 AND customer_initiated = true ORDER BY created_at DESC LIMIT 1`;
					const caseResult = await sqlQuery({
						sql: selectCaseQuery,
						values: [getBusinessResult.rows[0].id, customerID]
					});
					const existingCase = caseResult.rows?.[0];
					if (existingCase && existingCase.status === CASE_STATUS.INVITED) {
						await caseManagementService.updateCaseStatus(
							{ caseID: existingCase.id, customerID: customerID ?? "" },
							{ status: CASE_STATUS_ENUM.ONBOARDING, comment: "", assignee: "" },
							{ user_id: userInfo.user_id },
							{},
							false
						);
					}
					caseID = existingCase?.id;
				} else if (getBusinessResult.rows[0].case_id === null) {
					const { id: caseId } = await caseManagementService.createCaseFromEgg({
						business_id: getBusinessResult.rows[0].id,
						case_type: CASE_TYPE.ONBOARDING,
						customer_id: customerID as string,
						status: CASE_STATUS.ONBOARDING,
						applicant_id: userInfo.user_id,
						updated_by: customerID,
						created_by: customerID
					});
					caseID = caseId;
				}
				caseID = caseID ?? getBusinessResult.rows[0].case_id;

				try {
					await BusinessInvites.updateInvite(params.invitationID, {
						status: INVITE_STATUS.ACCEPTED,
						case_id: caseID,
						action_taken_by: userInfo.user_id
					});
				} catch (ex) {
					logger.error({ error: ex }, `Error updating invite ${params.invitationID}`);
				}
				try {
					await onboarding.createBusinessCustomFieldValuesForInvite(params.invitationID).catch(_err => {
						/* swallow */
					});
				} catch (ex) {
					logger.error({ error: ex }, `Error creating custom field values for invite ${params.invitationID}`);
				}

				message = "Invite accepted successfully";

				let auditMessage = {
					invitation_id: params.invitationID,
					case_id: caseID,
					business_id: getBusinessResult?.rows?.[0]?.id,
					business_name: getBusinessResult?.rows?.[0]?.name,
					applicant_id: userInfo.user_id
				};
				// Create an audit log
				void producer.send({
					topic: kafkaTopics.NOTIFICATIONS,
					messages: [
						{
							key: getBusinessResult?.rows?.[0]?.id,
							value: {
								event: kafkaEvents.INVITATION_ACCEPTED_AUDIT,
								...auditMessage
							}
						}
					]
				});

				// trigger kafka event to integration svc
				const kafkaPayload = {
					case_id: caseID,
					business_id: getBusinessResult?.rows?.[0]?.id,
					customer_id: customerID,
					applicant_id: userInfo.user_id
				};
				void producer.send({
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: getBusinessResult?.rows?.[0]?.id,
							value: {
								event: kafkaEvents.BUSINESS_INVITE_ACCEPTED,
								...kafkaPayload
							}
						}
					]
				});

				// send webhook msg
				if (customerID) {
					await sendWebhookEvent(customerID, WEBHOOK_EVENTS.ONBOARDING_INVITE_ACCEPTED, {
						...kafkaPayload,
						status: "ACCEPTED"
					});
				}
			} else if (getBusinessResult.rows[0].status === BUSINESS_STATUS.UNVERIFIED) {
				message = "Validate your business to accept the invitation";
			}

			return {
				message
			};
		} catch (error) {
			throw error;
		}
	}
	// temp api
	async singleBusinessEncryption(params, body) {
		try {
			const { column_name: columnName, table_name: tableName } = body;

			const query = `SELECT id, ${columnName} AS data
				FROM ${tableName}
				WHERE id = $1`;
			const result = await sqlQuery({ sql: query, values: [params.businessID] });

			if (!result.rowCount) {
				throw new BusinessApiError("No data found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			const data = encryptEin(result.rows[0].data);

			const updateQuery = `UPDATE ${tableName}
				SET ${columnName} = $1
				WHERE id = $2`;
			await sqlQuery({ sql: updateQuery, values: [data, params.businessID] });
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Get customer IDs related to a business
	 * @param business_id
	 * @returns
	 */
	async getCustomersWithBusiness(
		business_id: string
	): Promise<{ customer_id: UUID; external_id: any; is_monitoring_enabled: boolean; created_at: Date }[]> {
		return db({ b: "data_businesses" })
			.join("rel_business_customer_monitoring", "b.id", "=", "rel_business_customer_monitoring.business_id")
			.select(
				"rel_business_customer_monitoring.customer_id",
				"rel_business_customer_monitoring.external_id",
				"rel_business_customer_monitoring.is_monitoring_enabled",
				"rel_business_customer_monitoring.created_at"
			)
			.where({ "b.id": business_id })
			.andWhere({ "b.is_deleted": false });
	}

	/** Find a business by the plaintext TIN
	 * @param {string} tin - The TIN of the business in plain text
	 * @returns {Promise<Business.Record>} - The business record
	 */
	// check naics code
	async getBusinessByTin(tin: string): Promise<Business.Record> {
		const encryptedTin = encryptEin(tin);
		const business = await db<Business.Record>("data_businesses")
			.select("*")
			.where("tin", encryptedTin)
			.andWhere("is_deleted", false)
			.first();
		return business;
	}

	/**
	 * Retrieves a list of business records that match the provided Tax Identification Number (TIN).
	 *
	 * The TIN is first encrypted before querying the database to ensure data security.
	 *
	 * @param tin - The plain text Tax Identification Number to search for.
	 * @returns A promise that resolves to an array of business records matching the encrypted TIN.
	 */
	async getBusinessesByTin(tin: string): Promise<Business.Record[]> {
		const encryptedTin = encryptEin(tin);
		const businesses = await db<Business.Record[]>("data_businesses")
			.select("*")
			.where("tin", encryptedTin)
			.andWhere("is_deleted", false);
		return businesses;
	}
	/**
	 * Find an existing business by combination of external id and optional customer id
	 * @param external_id
	 * @param customer_id
	 * @returns
	 */
	async getBusinessByExternalId(external_id: string, customer_id?: string): Promise<Business.WithCustomer[]> {
		const businessQuery = db<Business.WithCustomer>("data_businesses")
			.join(
				"rel_business_customer_monitoring",
				"data_businesses.id",
				"=",
				"rel_business_customer_monitoring.business_id"
			)
			.select(
				"data_businesses.*",
				"rel_business_customer_monitoring.customer_id",
				"rel_business_customer_monitoring.external_id",
				"rel_business_customer_monitoring.metadata",
				"rel_business_customer_monitoring.is_monitoring_enabled"
			)
			.where("rel_business_customer_monitoring.external_id", external_id)
			.andWhere("data_businesses.is_deleted", false);
		if (customer_id) {
			return businessQuery.andWhere("rel_business_customer_monitoring.customer_id", customer_id);
		}

		return businessQuery;
	}
	/**
	 * Get business record for customer
	 * @param business_id
	 * @param customer_id
	 * @param tinBehavior -- how to treat the tin
	 * @returns
	 */
	async getCustomerBusinessById(
		business_id: string,
		customer_id: string,
		tinBehavior?: TIN_BEHAVIOR = TIN_BEHAVIOR.ENCRYPT
	): Promise<Business.WithCustomer> {
		const business = db<Business.WithCustomer>("data_businesses")
			.join(
				"rel_business_customer_monitoring",
				"data_businesses.id",
				"=",
				"rel_business_customer_monitoring.business_id"
			)
			.select(
				"data_businesses.*",
				"rel_business_customer_monitoring.customer_id",
				"rel_business_customer_monitoring.external_id",
				"rel_business_customer_monitoring.metadata",
				"rel_business_customer_monitoring.is_monitoring_enabled"
			)
			.where({ business_id, customer_id })
			.first();

		business.tin = decryptAndTransformTin(business.tin, tinBehavior);

		return business;
	}

	/**
	 * Asynchronously triggers an event to refresh the score for a given business and customer.
	 *
	 * @async
	 * @param {string} businessID - The ID of the business.
	 * @param {string} customerID - The ID of the customer.
	 * @throws {BusinessApiError} If the business is not found for the given customer.
	 * @returns {Promise<void>} - A promise that resolves when the event has been triggered.
	 *
	 * @example
	 * const businessID = 'business123';
	 * const customerID = 'customer456';
	 *
	 * triggerEventToRefreshScore(businessID, customerID)
	 *   .then(() => {
	 *     console.log('Score refresh event triggered successfully');
	 *   })
	 *   .catch(error => {
	 *     console.error('Error triggering score refresh event:', error);
	 *   });
	 */
	async triggerEventToRefreshScore(businessID, customerID) {
		try {
			let query = [];
			let values = [];
			// timer check and set on business level
			let redisKey = `{business}:${businessID}:score-refresh`;
			const redisResult = await redis.get(redisKey);
			if (redisResult) {
				throw new BusinessApiError(`Score refresh in progress.`, StatusCodes.BAD_REQUEST, ERROR_CODES.NOT_ALLOWED);
			}
			let businessQuery = `select id from data_businesses where id = $1`;
			const businessValues = [businessID];
			if (customerID) {
				businessQuery = `select d.id from rel_business_customer_monitoring r
					inner join data_businesses d on d.id = r.business_id
					where r.business_id = $1 and r.customer_id = $2 AND d.is_deleted = false`;
				businessValues.push(customerID);
			}
			query.push(businessQuery);
			values.push(businessValues);
			const scoreRefreshQuery = `SELECT refresh_type, config->>'delay_between_subsequent_refresh' AS refresh_time,config->> 'unit' AS unit FROM public.core_score_refresh_config where refresh_type = $1`;
			query.push(scoreRefreshQuery);
			values.push(["MANUAL_REFRESH"]);
			const [businessResult, scoreRefreshResult] = await sqlTransaction(query, values);
			if (!businessResult.rowCount) {
				throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			const event = {
				business_id: businessID,
				customer_id: customerID,
				trigger_type: SCORE_TRIGGER.MANUAL_REFRESH
			};

			const payload = {
				topic: kafkaTopics.SCORES,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.REFRESH_BUSINESS_SCORE,
							...event
						}
					}
				]
			};

			await producer.send(payload);
			if (scoreRefreshResult.rowCount) {
				await this.storeScoreRefreshTime(businessID, customerID, scoreRefreshResult.rows[0], redisKey);
			}
		} catch (error) {
			throw error;
		}
	}

	async updateBusinessEntity(businessID: string, data: UpdateBusinessEntityData, authorization?: string) {
		try {
			const { tin, name } = data;

			if (!name) {
				throw new BusinessApiError("Invalid data", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			data.addresses &&
				data.addresses.forEach(address => {
					if (
						!address.address_line_1 ||
						!address.address_city ||
						!address.address_state ||
						!address.address_postal_code
					) {
						throw new BusinessApiError("Invalid address", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}
				});

			let updateBusinessEntityBody = {
				name: name,
				addresses: data.addresses,
				...(tin && { tin: { tin: tin } }),
				...(data.official_website && { website: { url: data.official_website } }),
				...(data?.dba_names && data.dba_names.length && { dba_names: data.dba_names })
			};

			try {
				await updateBusinessEntityForReview(businessID, updateBusinessEntityBody, authorization);
			} catch (err) {
				throw err;
			}
		} catch (error) {
			throw error;
		}
	}

	async _checkAndVerifyBusiness(businessID, authorization, updateBusinessStatus = false) {
		try {
			const verifyBusinessPromise = new Promise((resolve, reject) => {
				let retryCount = 0;
				const interval = setInterval(async () => {
					const businessVerificationDetails: BusinessEntityVerificationDetails =
						await getBusinessEntityVerificationDetails(businessID);

					// middesk status can be any of following
					// open, pending, in_audit, in_review, approved, rejected
					// if status is "in_review" or "approved" then we can proceed further
					// if status is "rejected" then we need to stop the process and return the error message
					// for other status we are retrying for 3 times over the interval of X seconds to continuously poll for latest status as there can be delay in Mid Desks verification
					// for this polling period, applicant stays on the loader UI
					const middeskVerificationStatus = businessVerificationDetails.businessEntityVerification?.status;

					const [isBusinessVerificationValid, verificationMessage] =
						BusinessUtils.isBusinessVerificationValid(businessVerificationDetails);
					if (!isBusinessVerificationValid) {
						clearInterval(interval);
						reject(
							new BusinessApiError(
								`TIN Verification failed: ${verificationMessage}`,
								StatusCodes.BAD_REQUEST,
								ERROR_CODES.INVALID
							)
						);
						return;
					}

					if (middeskVerificationStatus === "in_review" || middeskVerificationStatus === "approved") {
						clearInterval(interval);

						// Update business status to VERIFIED
						if (updateBusinessStatus) {
							const updateBusinessStatusQuery = `UPDATE data_businesses SET status = $1 WHERE id = $2 returning *`;
							const updatedBusiness = await sqlQuery({
								sql: updateBusinessStatusQuery,
								values: [BUSINESS_STATUS.VERIFIED, businessID]
							});
							if (updatedBusiness?.rows?.length && updatedBusiness.rows?.[0]?.id) {
								// Messy code, refactor this later to knex because it makes it easier to make dynamic queries...
								const business = updatedBusiness.rows[0];
								if (!business.tin && businessVerificationDetails.businessEntityVerification?.tin) {
									try {
										const tin = encryptEin(businessVerificationDetails.businessEntityVerification.tin);
										const updateBusinessTinQuery = `UPDATE data_businesses SET tin = $1 WHERE id = $2`;
										await sqlQuery({ sql: updateBusinessTinQuery, values: [tin, businessID] });
									} catch (ex) {
										logger.error({ error: ex }, "Error updating business tin");
									}
								}
							}
						}

						resolve();
					} else if (middeskVerificationStatus === "rejected") {
						reject(
							BusinessApiError(
								"Business verification failed. Please verify your details.",
								StatusCodes.BAD_REQUEST,
								ERROR_CODES.INVALID
							)
						);
					} else {
						logger.debug(
							`businessId=${businessID} verification status: ${middeskVerificationStatus}, retry ${retryCount}`
						);
					}

					// Increment retry count
					retryCount++;

					// Check if maximum retry count reached
					if (retryCount >= 4 * 2) {
						clearInterval(interval); // Stop retrying
						reject(
							new BusinessApiError(
								`Your business: ${businessID} has been queued for verification. Please try onboarding again later.`,
								StatusCodes.BAD_REQUEST,
								ERROR_CODES.AWAITING_THIRD_PARTY_RESPONSE
							)
						);
					}
				}, 4000);
			});

			// Wait for the verification process to complete
			await verifyBusinessPromise;
		} catch (error) {
			throw error;
		}
	}

	async purgeBusiness(body: { business_ids: string[]; deleted_by: string }, userInfo: UserInfo) {
		try {
			let purgeFlagEnabled: boolean = false;
			let customerBusinesses: any[] = [];
			if (userInfo.role.id === ROLE_ID.CUSTOMER) {
				purgeFlagEnabled =
					(userInfo?.customer_id &&
						userInfo?.email &&
						(await getFlagValue(FEATURE_FLAGS.WIN_740_PURGE_BUSINESS, {
							kind: "multi",
							user: { key: userInfo.email, kind: "user", email: userInfo.email },
							customer: { key: userInfo.customer_id, kind: "customer", customer_id: userInfo.customer_id }
						}))) ??
					false;
			} else {
				const context = {
					key: userInfo.user_id,
					name: `${userInfo.given_name} ${userInfo.family_name}`,
					email: userInfo.email,
					role: userInfo.role.code
				};
				purgeFlagEnabled = (await getFlagValue(FEATURE_FLAGS.WIN_740_PURGE_BUSINESS, context)) ?? false;
			}

			if (!purgeFlagEnabled) {
				throw new BusinessApiError(
					"Feature is not enabled for this user.",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.NOT_ALLOWED
				);
			}

			const businessIDs = [];
			if (!body.business_ids?.length) {
				throw new BusinessApiError("Invalid data", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			if (Object.hasOwn(body, "business_ids") && body.business_ids.length) {
				if (userInfo.role.id === ROLE_ID.CUSTOMER) {
					customerBusinesses = await db("rel_business_customer_monitoring").where(
						"business_id",
						"in",
						body.business_ids
					);
					customerBusinesses.forEach(business => {
						if (business.customer_id !== userInfo.customer_id) {
							throw new BusinessApiError(
								`Cannot purge business: ${business.business_id}`,
								StatusCodes.FORBIDDEN,
								ERROR_CODES.NOT_ALLOWED
							);
						}
					});
					if (
						!customerBusinesses ||
						!customerBusinesses.length ||
						customerBusinesses.length !== body.business_ids.length
					) {
						throw new BusinessApiError("Invalid business IDs provided.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}
				} else {
					// check if all businesses exists
					await this._checkAllBusinessExists({ column: "id", values: body.business_ids });
				}
				businessIDs.push(...body.business_ids);
			}

			// Send kafka event to purge business for each business. It will get consumed by all the services
			const messages = businessIDs.reduce((acc, id) => {
				acc.push({
					key: id,
					value: {
						event: kafkaEvents.PURGE_BUSINESS,
						business_id: id
					}
				});
				return acc;
			}, []);

			if (messages.length) {
				await producer.send({ topic: kafkaTopics.BUSINESS, messages });
			}

			// Create audit logs
			const messagesArray = businessIDs.map(businessID => ({
				key: businessID,
				value: {
					event: kafkaEvents.PURGED_BUSINESS_AUDIT,
					business_id: businessID,
					deleted_by: `${userInfo.given_name} ${userInfo.family_name}`
				}
			}));

			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: messagesArray
			});
		} catch (error) {
			throw error;
		}
	}

	async archiveBusiness(body: { business_ids: string[] }, userInfo: UserInfo) {
		try {
			let customerBusinesses: any[] = [];

			const businessIDs = [];
			if (!body.business_ids?.length) {
				throw new BusinessApiError("Invalid data", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const filteredArray = await Promise.all(
				body.business_ids.map(async item => {
					const redisKey = `{purged_business}:${item.businessID}`;
					const isBusinessPurged = await redis.exists(redisKey);
					return isBusinessPurged ? null : item;
				})
			);

			body.business_ids = filteredArray.filter(Boolean);

			if (Object.hasOwn(body, "business_ids") && body.business_ids.length) {
				if (userInfo.role.id === ROLE_ID.CUSTOMER) {
					customerBusinesses = await db("rel_business_customer_monitoring").where(
						"business_id",
						"in",
						body.business_ids
					);
					customerBusinesses.forEach(business => {
						if (business.customer_id !== userInfo.customer_id) {
							throw new BusinessApiError(
								`Cannot purge business: ${business.business_id}`,
								StatusCodes.FORBIDDEN,
								ERROR_CODES.NOT_ALLOWED
							);
						}
					});
					if (
						!customerBusinesses ||
						!customerBusinesses.length ||
						customerBusinesses.length !== body.business_ids.length
					) {
						throw new BusinessApiError("Invalid business IDs provided.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}
				} else {
					// check if all businesses exists
					await this._checkAllBusinessExists({ column: "id", values: body.business_ids });
				}
				businessIDs.push(...body.business_ids);
			}

			let caseData: { business_id: string; case_id: string }[] = [];
			if (businessIDs.length > 0) {
				// fetch cases associated with business
				const query = `SELECT id as case_id, business_id FROM data_cases WHERE business_id = ANY($1)`;
				const result = await sqlQuery({ sql: query, values: [businessIDs] });

				caseData = result.rows.map(row => ({ business_id: row.business_id, case_id: row.case_id }));
			}

			await insertPurgedBusinesses(businessIDs, userInfo.user_id);

			await updateIsDeleted("public", "data_businesses", "id", businessIDs, true);

			const purgedBusinessArray = businessIDs.flatMap(businessID => [
				`{purged_business}:${businessID}`,
				JSON.stringify({
					business_id: businessID,
					deleted_at: new Date().toISOString()
				})
			]);

			await redis.mset(purgedBusinessArray);

			// insert cases data for purged businesses
			if (caseData.length > 0) {
				for (const data of caseData) {
					await redis.set(`{purged_business}:{cases}:${data.case_id}`, data.business_id);
				}
			}

			// Create audit logs
			const messagesArray = businessIDs.map(businessID => ({
				key: businessID,
				value: {
					event: kafkaEvents.ARCHIVED_BUSINESS_AUDIT,
					business_id: businessID,
					archived_by: `${userInfo.given_name} ${userInfo.family_name}`
				}
			}));

			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: messagesArray
			});
		} catch (error) {
			throw error;
		}
	}

	async _checkAllBusinessExists(payload: { column: string; values: string[] }) {
		const query = `SELECT id FROM data_businesses WHERE ${payload.column} = ANY($1) AND is_deleted = false`;
		const result = await sqlQuery({ sql: query, values: [payload.values] });

		if (result.rows.length !== payload.values.length) {
			throw new BusinessApiError("Business not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		return result.rows.map(row => row.id);
	}

	async getBusinessAllNames(params: { businessID: string }) {
		try {
			type Name = { name: string; is_primary: boolean };
			const uniqueBusinessNames: Array<Name> = [];
			const addUniqueBusinessName = (name: Name): boolean => {
				const exists = uniqueBusinessNames.some(n => n.name.toLowerCase() === name.name.toLowerCase());
				if (!exists) {
					uniqueBusinessNames.push(name);
				}
			};
			const getAllBusinessNamesQuery = `SELECT data_business_names.name, data_business_names.is_primary FROM data_business_names
				LEFT JOIN data_businesses db ON db.id = data_business_names.business_id
				WHERE business_id = $1 AND db.is_deleted = false`;
			const getAllBusinessNamesResult = await sqlQuery({ sql: getAllBusinessNamesQuery, values: [params.businessID] });
			const getBusinessNameQuery = `SELECT name, true as is_primary from data_businesses where id = $1`;
			const getBusinessNameResult = await sqlQuery({ sql: getBusinessNameQuery, values: [params.businessID] });
			// Make sure we don't have duplicates, ignoring case
			getAllBusinessNamesResult.rows.forEach(addUniqueBusinessName);
			getBusinessNameResult.rows.forEach(addUniqueBusinessName);
			return uniqueBusinessNames;
		} catch (error) {
			throw error;
		}
	}

	async getBusinessAllAddresses(params: { businessID: string }): Promise<Business.BusinessAddress[]> {
		try {
			const uniqueBusinessAddresses: Map<string, Business.BusinessAddress> = new Map();
			const addUniqueBusinessAddress = (address: Business.BusinessAddress): boolean => {
				const fingerprint = AddressUtil.toFingerprint(address, address.is_primary);
				if (!uniqueBusinessAddresses.get(fingerprint)) {
					uniqueBusinessAddresses.set(fingerprint, address);
				}
			};
			const getAllBusinessAddresses = `SELECT data_business_addresses.line_1, data_business_addresses.apartment, data_business_addresses.city, data_business_addresses.state, data_business_addresses.country, data_business_addresses.postal_code, data_business_addresses.mobile, data_business_addresses.is_primary
				FROM data_business_addresses
				LEFT JOIN data_businesses db ON db.id = data_business_addresses.business_id
				WHERE business_id = $1 AND db.is_deleted = false`;
			const getAllBusinessAddressesResult = await sqlQuery({
				sql: getAllBusinessAddresses,
				values: [params.businessID]
			});
			const getBusinessAddressQuery = `SELECT address_line_1 as line_1, address_line_2 as apartment, address_city as city, address_state as state, address_country as country, address_postal_code as postal_code, mobile, true as is_primary from data_businesses where id = $1`;
			const getBusinessAddressResult = await sqlQuery({ sql: getBusinessAddressQuery, values: [params.businessID] });
			getAllBusinessAddressesResult.rows.forEach(addUniqueBusinessAddress);
			getBusinessAddressResult.rows.forEach(addUniqueBusinessAddress);
			return Array.from(uniqueBusinessAddresses.values());
		} catch (error) {
			logger.error({ error, businessID: params.businessID }, "Error getting business all addresses");
			throw error;
		}
	}

	/**
	 * Mutates business object to translate naics code, mcc code, or naics title to naics_id and mcc_id
	 * Note that the return isn't necessary, just makes it clearer that we're mutating existing object
	 * @param business
	 * @returns business with naics_id and mcc_id filled if found
	 */
	populateNaicsAndMccIdFromNaicsAndMccCodes = async (
		business: Partial<Business.Egg | Business.Record> | { naics_code?: number; mcc_code?: number; naics_title?: string }
	): Promise<Partial<Business.Egg | Business.Record>> => {
		// Order of preference for how to populate naics_id anc mcc_id when multiple fields are present

		const keyToMethod: Record<
			string,
			(input: string | number) => Promise<{ naics_id?: number; mcc_id?: number | null }>
		> = {
			naics_code: this.getMccIdAndNaicsIdByNaicsCode,
			mcc_code: this.getNaicsByMccCode,
			naics_title: this.getMccIdAndNaicsIdByNaicsLabel
		};

		for (const [key, method] of Object.entries(keyToMethod)) {
			if (business[key]) {
				const response = await method(business[key]);
				if (response?.naics_id) {
					business.naics_id = response.naics_id;
					business.mcc_id = response.mcc_id;
					break; // Exit after the first valid match
				}
			}
		}
		// Clean up, delete the keys that may be present so the object conforms to the standard type
		for (const key of Object.keys(keyToMethod)) {
			if (Object.hasOwn(business, key)) {
				delete business[key];
			}
		}
		return business;
	};
	/**
	 *  To get mcc id and naics id from naics code
	 * @async
	 * @param {any} naics_code
	 * @returns mcc_id, naics_id
	 *
	 */
	async getMccIdAndNaicsIdByNaicsCode(
		naics_code: string | number
	): Promise<{ naics_id?: number; mcc_id?: number | null }> {
		const getMccCodeQuery = `SELECT cnc.id as naics_id, rnc.mcc_id FROM  core_naics_code cnc LEFT JOIN rel_naics_mcc rnc ON rnc.naics_id = cnc.id WHERE cnc.code = $1`;
		const { rows } = await sqlQuery({ sql: getMccCodeQuery, values: [naics_code] });
		if (!rows.length) return {};
		return {
			naics_id: rows[0].naics_id,
			mcc_id: rows[0].mcc_id
		};
	}
	async getMccIdAndNaicsIdByNaicsLabel(label: string): Promise<{ naics_id?: number; mcc_id?: number | null }> {
		const getByNaicsLabelQuery = `SELECT cnc.id as naics_id, rnc.mcc_id FROM  core_naics_code cnc LEFT JOIN rel_naics_mcc rnc ON rnc.naics_id = cnc.id WHERE cnc.label = $1`;
		const { rows } = await sqlQuery({ sql: getByNaicsLabelQuery, values: [label] });
		if (!rows.length) return {};
		return {
			naics_id: rows[0].naics_id,
			mcc_id: rows[0].mcc_id
		};
	}
	async getNaicsByMccCode(mcc: string): Promise<{ naics_id?: number; mcc_id?: number | null }> {
		const getNaicsFromMccQuery = `SELECT rnc.naics_id as naics_id, rnc.mcc_id FROM  core_mcc_code mcc LEFT JOIN rel_naics_mcc rnc ON rnc.mcc_id = mcc.id WHERE mcc.code = $1 limit 1`;
		const { rows } = await sqlQuery({ sql: getNaicsFromMccQuery, values: [mcc] });
		if (!rows.length) return {};
		return {
			naics_id: rows[0].naics_id,
			mcc_id: rows[0].mcc_id
		};
	}
	async updateDBAName(
		businessData: { name: string },
		dba_names: { name: string }[] | undefined,
		userInfo: { business_id: string; user_id: string }
	) {
		const selectDBANames = `SELECT data_business_names.* FROM data_business_names
			LEFT JOIN data_businesses db ON db.id = data_business_names.business_id
			WHERE business_id = $1 AND db.is_deleted = false`;
		const dbaNames: { id: string; name: string; is_primary: boolean }[] = await sqlQuery({
			sql: selectDBANames,
			values: [userInfo.business_id]
		});
		const businessNamesValues = []; // For dba names with is_primary = false
		// Ensure dba_names is unique
		if (dba_names?.length) {
			dba_names = Array.from(new Set(dba_names.map(JSON.stringify))).map(JSON.parse);
			dba_names.forEach(dbaName => {
				// Only add if the name doesn't already exist
				if (
					(dbaNames?.rows.length === 0 || !dbaNames.rows.some(dba => dba.name === dbaName.name)) &&
					businessData.name !== dbaName.name
				) {
					businessNamesValues.push([userInfo.business_id, dbaName.name, false, userInfo.user_id, userInfo.user_id]);
				}
			});
		}

		const dbaNameQueries = [];
		const dbaNameValues = [];
		let primaryExists = false;

		if (dbaNames.rowCount > 0) {
			dbaNames.rows.forEach(dbaName => {
				if (dbaName.is_primary) {
					primaryExists = true;
					if (businessData.name) {
						const query = `UPDATE data_business_names SET name = $1, updated_by = $2 WHERE id = $3`;
						dbaNameQueries.push(query);
						dbaNameValues.push([businessData.name, userInfo.user_id, dbaName.id]);
					}
				} else {
					// If there's a non-primary name, we can consider replacing it
					// First, if the existing name is still present in the input, leave it alone
					const matchingInputIndex = dba_names?.findIndex(record => record.name === dbaName.name) ?? -1;
					if (matchingInputIndex >= 0) {
						// mark this input as processed so it is not re-used for inserts
						dba_names?.splice(matchingInputIndex, 1);
						return;
					}

					if (businessNamesValues.length > 0) {
						const values = businessNamesValues.pop();
						if (values[1] !== dbaName.name) {
							const query = `UPDATE data_business_names SET name = $1, updated_by = $2 WHERE id = $3`;
							dbaNameQueries.push(query);
							dbaNameValues.push([values[1], userInfo.user_id, dbaName.id]);
						}
					} else {
						// delete dba name if not found in the input
						const query = `DELETE FROM data_business_names WHERE id = $1`;
						dbaNameQueries.push(query);
						dbaNameValues.push([dbaName.id]);
					}
				}
			});
		}

		// If there are new DBA names to insert (is_primary = false)
		if (businessNamesValues.length > 0) {
			const businessNamesColumns = ["business_id", "name", "is_primary", "created_by", "updated_by"];
			const insertQuery = await buildInsertQuery("data_business_names", businessNamesColumns, businessNamesValues);
			dbaNameQueries.push(insertQuery);
			dbaNameValues.push(businessNamesValues.flat());
		}

		// If no primary exists and the new name is provided, insert it as primary
		if (!primaryExists && businessData.name) {
			const businessNamesColumns = ["business_id", "name", "is_primary", "created_by", "updated_by"];
			const primaryBusinessNamesValues = [
				[userInfo.business_id, businessData.name, true, userInfo.user_id, userInfo.user_id]
			];
			const insertQuery = await buildInsertQuery(
				"data_business_names",
				businessNamesColumns,
				primaryBusinessNamesValues
			);
			dbaNameQueries.push(insertQuery);
			dbaNameValues.push(primaryBusinessNamesValues.flat());
		}

		if (dbaNameQueries.length > 0) {
			await sqlTransaction(dbaNameQueries, dbaNameValues);

			await sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: userInfo.business_id });
			return true;
		} else {
			return false;
		}
	}

	/**
	 * This function will replace all existing addresses with the new addresses provided in the body.
	 * If you don't want existing addresses to be deleted, you must pass in all the existing addresses in the mailing_addresses array
	 * @param businessID
	 * @param body
	 * @param userID
	 * @returns
	 */
	async updateMailingAddresses(
		businessID: UUID,
		body: Partial<Address> & {
			mailing_addresses?: Address[] | Business.BusinessAddress[];
		},
		userID: UUID
	) {
		if (!businessID) {
			logger.error("[updateMailingAddresses] Business ID is required");
			return;
		}
		const existingAddresses: Business.BusinessAddress[] = await db<Business.BusinessAddress>("data_business_addresses")
			.select("*")
			.where({ business_id: businessID });
		const existingPrimaryAddress: Business.BusinessAddress | null = existingAddresses.find(addr => addr.is_primary);
		if (AddressUtil.isCompleteAddress(body)) {
			const primaryAddress = {
				...AddressUtil.convertToBusinessAddress(body, true),
				business_id: businessID,
				is_primary: true,
				updated_by: userID
			};
			if (existingPrimaryAddress) {
				await db("data_business_addresses")
					.where({ is_primary: true, business_id: businessID })
					.update({ ...primaryAddress, updated_at: db.fn.now() });
			} else {
				await db("data_business_addresses").insert({ ...primaryAddress, created_by: userID });
			}
		}

		const existingMailingAddresses: Business.BusinessAddress[] = existingAddresses.filter(addr => !addr.is_primary);
		const existingMailingAddressMap: Map<string, UUID> = new Map(
			existingMailingAddresses.map(addr => [AddressUtil.toFingerprint(addr, addr.is_primary), addr.id])
		);
		// If no addresses are provided then delete the existing non-primary addresses
		if (!body?.mailing_addresses?.length) {
			if (existingMailingAddresses.length > 0) {
				await db("data_business_addresses").where({ business_id: businessID, is_primary: false }).delete();
			}
			return;
		}
		const addressesToKeep: Set<UUID> = new Set();
		for (const address of body.mailing_addresses) {
			try {
				const mailingAddress = AddressUtil.convertToBusinessAddress(address, false);
				if (AddressUtil.isCompleteAddress(mailingAddress)) {
					const fingerprint = AddressUtil.toFingerprint(mailingAddress, false);
					const formattedAddress = {
						...mailingAddress,
						business_id: businessID,
						is_primary: false,
						updated_by: userID
					};

					const existingId = existingMailingAddressMap.get(fingerprint);
					if (existingId) {
						addressesToKeep.add(existingId);
						await db("data_business_addresses")
							.where({ id: existingId, business_id: businessID })
							.update({ ...formattedAddress, updated_at: db.fn.now() });
					} else {
						await db("data_business_addresses").insert({
							...formattedAddress,
							created_by: userID
						});
					}
				}
			} catch (error: unknown) {
				if (error instanceof AddressError) {
					logger.error({ error, address, body }, `Ignoring invalid address: ${error.getInput()}`);
					//skip/ignore addresses that can't be coerced to address object
					continue;
				}
				logger.error({ error, address, body }, `Error resolving mailing address`);
				throw error;
			}
		}

		const addressIdsToDelete: string[] =
			[...existingMailingAddressMap.values()].filter(id => !addressesToKeep.has(id)) ?? [];
		if (addressIdsToDelete.length > 0) {
			// Delete any existing addresses that were not found in the new addresses body
			await db("data_business_addresses")
				.where({ business_id: businessID, is_primary: false })
				.whereIn("id", Array.from(addressIdsToDelete))
				.delete();
		}
	}

	/**
	 * Update NAICS and MCC code information for a business
	 * @param businessID - The ID of the business
	 * @param additionalDetails - Object containing naics_code and/or mcc_code and/or naics_title and/or mcc_title
	 * @param userID - The ID of the user making the update
	 */
	async updateNaicsMccCodeInfo(
		businessID: UUID,
		additionalDetails: {
			naics_id?: number | string;
			naics_code?: number | string;
			naics_title?: string;
			mcc_id?: number | string;
			mcc_code?: number | string;
			mcc_title?: string;
		},
		userID: UUID
	) {
		const factsOverrideBody = {};
		const hasNaics = Object.hasOwn(additionalDetails, "naics_code");
		const hasMcc = Object.hasOwn(additionalDetails, "mcc_code");
		const clearNaics = hasNaics && !additionalDetails.naics_code;
		const clearMcc = hasMcc && !additionalDetails.mcc_code;
		if (clearNaics && clearMcc) {
			// Batch clear both naics_id and mcc_id in a single update
			await db("data_businesses").where({ id: businessID }).update({
				naics_id: null,
				mcc_id: null,
				updated_by: userID
			});
			return;
		}

		if (clearNaics) {
			await db("data_businesses").where({ id: businessID }).update({ naics_id: null, updated_by: userID });
			factsOverrideBody.naics_code = { value: null, reason: "NAICS code cleared by customer" };
		}

		if (clearMcc) {
			await db("data_businesses").where({ id: businessID }).update({ mcc_id: null, updated_by: userID });
			factsOverrideBody.mcc_code = { value: null, reason: "MCC code cleared by customer" };
		}

		if (hasNaics && additionalDetails.naics_id) {
			await db("data_businesses")
				.where({ id: businessID })
				.update({ naics_id: additionalDetails.naics_id, updated_by: userID });
			factsOverrideBody.naics_code = {
				value: String(additionalDetails.naics_code),
				reason: "NAICS code updated by customer"
			};
		}

		if (hasMcc && additionalDetails.mcc_id) {
			await db("data_businesses")
				.where({ id: businessID })
				.update({ mcc_id: additionalDetails.mcc_id, updated_by: userID });
			factsOverrideBody.mcc_code = {
				value: String(additionalDetails.mcc_code),
				reason: "MCC code updated by customer"
			};
		}

		if (Object.keys(factsOverrideBody).length > 0) {
			await updateBusinessFactsOverride(businessID, factsOverrideBody, userID);
			await invalidateBusinessFactsCache(businessID);
		}
	}

	/**
	 * Updates the industry information for a business.
	 * @param businessID - The unique identifier of the business to update
	 * @param industryDetails - The industry information. Can be:
	 *   - A number representing the industry ID
	 *   - An object with an `id` property containing the industry ID
	 *   - null to clear/remove the industry association
	 * @param userID - The unique identifier of the user performing the update
	 **/
	async updateBusinessIndustryDetails(
		businessID: UUID,
		industryDetails: { id?: number | null } | number | null,
		userID: UUID
	): Promise<void> {
		// Extract industry ID from various input formats
		let industryId: number | null = null;

		if (typeof industryDetails === "number") {
			// Direct industry ID provided
			industryId = industryDetails;
		} else if (industryDetails !== null && typeof industryDetails === "object" && industryDetails.id !== undefined) {
			// Industry object with id property
			industryId = industryDetails.id;
		}
		// If industryDetails is null or doesn't match above cases, industryId remains null

		// Prepare update payload
		const updatePayload = {
			updated_by: userID,
			industry: industryId
		};

		// Update the business record
		await db("data_businesses").where({ id: businessID }).update(updatePayload);
	}

	/**
	 * Get processing time that required a business to again refresh score
	 *
	 * @async
	 * @param {string} businessID - The ID of the business.
	 * @returns {JSON} - processing time
	 */
	async refreshProcessingTime(params, query) {
		try {
			let querySelect = `SELECT refresh_type, config->>'delay_between_subsequent_refresh' AS refresh_time,config->> 'unit' AS unit FROM public.core_score_refresh_config where refresh_type = $1`;
			const result = await sqlQuery({ sql: querySelect, values: ["MANUAL_REFRESH"] });
			let redisKey = `{business}:${params.businessID}:score-refresh`;
			if (query.customerID) {
				redisKey = `{customer}:${query.customerID}:{business}:${params.businessID}:score-refresh`;
			}
			const redisResult = await redis.get(redisKey);
			const response = {
				processing_time: result.rows[0].refresh_time,
				waiting_time: 0,
				is_refresh_score_enable: true,
				processing_time_unit: result.rows[0].unit
			};
			if (redisResult) {
				let lastRefreshTime = Math.floor((Date.now() - redisResult.created_time) / (1000 * 60));
				switch (result.rows[0].unit.toLowerCase()) {
					case "minutes":
						lastRefreshTime = lastRefreshTime; // Already in minutes
						break;
					case "hours":
						lastRefreshTime = lastRefreshTime / 60; // 60 minutes per hour
						break;
					case "days":
						lastRefreshTime = lastRefreshTime / (24 * 60); // 24 hours * 60 minutes
						break;
					case "months":
						lastRefreshTime = lastRefreshTime / (30 * 24 * 60); // Approximate 30 days per month
						break;
					case "years":
						lastRefreshTime = lastRefreshTime / (365 * 24 * 60); // 365 days per year
						break;
					default:
						break;
				}
				response.waiting_time = result.rows[0].refresh_time - lastRefreshTime;
				response.is_refresh_score_enable = false;
			}
			return response;
		} catch (error) {
			throw error;
		}
	}
	/**
	 * Store manual score refresh create time into redis for temperary time
	 *
	 * @async
	 * @param {string} businessID, scoreRefreshConfig - The ID of the business, Config for time interval
	 * @returns {JSON} - processing time
	 */
	async storeScoreRefreshTime(businessID, customerID, scoreRefreshConfig, redisKey) {
		try {
			let expireTime = scoreRefreshConfig.refresh_time;
			switch (scoreRefreshConfig.unit.toLowerCase()) {
				case "minutes":
					expireTime = expireTime * 60; // Minutes to second
					break;
				case "hours":
					expireTime = expireTime * 60 * 60; // 60 minutes * 60 seconds
					break;
				case "days":
					expireTime = expireTime * 24 * 60 * 60; // 24 hours * 60 minutes * 60 seconds
					break;
				case "months":
					expireTime = expireTime * 30 * 24 * 60 * 60; // Approximate 30 days per month
					break;
				case "years":
					expireTime = expireTime * 365 * 24 * 60 * 60; // 365 days per year
					break;
				default:
					break;
			}
			await redis.set(redisKey, { created_time: Date.now() });
			await redis.expire(redisKey, expireTime);
		} catch (error) {
			throw error;
		}
	}

	async bulkUpdateNaicsCode(body: { naics_list: Array<{ naics_code: string; business_id: UUID }> }) {
		const updatefailedFor = [];
		for (const obj of body.naics_list) {
			if (!obj.naics_code) continue;
			const naicsCode = parseInt(obj.naics_code);
			const response = await this.getMccIdAndNaicsIdByNaicsCode(naicsCode);
			if (!Object.keys(response).length) {
				updatefailedFor.push(obj.business_id);
				continue;
			}
			const updateQuery = `UPDATE data_businesses set naics_id = $2, mcc_id = $3 WHERE id = $1`;
			const result = await sqlQuery({
				sql: updateQuery,
				values: [obj.business_id, response.naics_id, response.mcc_id]
			});
			if (!result.rowCount) {
				updatefailedFor.push(obj.business_id);
			}
		}
		return { updatefailedFor };
	}

	async bulkUpdateCoreNaicsMccCode(body: Business.NaicsAndMccCode) {
		try {
			const queries = [];
			const values = [];
			const naicsQuery = `INSERT INTO core_naics_code (code , "label")
			VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label`;
			queries.push(naicsQuery);
			values.push([body.naics_code, body.naics_description]);
			const mccQuery = `INSERT INTO core_mcc_code (code , "label")
			VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label`;
			queries.push(mccQuery);
			values.push([body.mcc_code, body.mcc_description]);
			const naicsMccQuery = `INSERT INTO rel_naics_mcc (naics_id , mcc_id) VALUES
    		((SELECT id FROM core_naics_code WHERE code = $1),
			(SELECT id FROM core_mcc_code WHERE code = $2)) ON CONFLICT (naics_id , mcc_id) DO NOTHING`;
			queries.push(naicsMccQuery);
			values.push([body.naics_code, body.mcc_code]);
			await sqlTransaction(queries, values);
		} catch (error) {
			logger.info(error);
			throw error;
		}
	}

	async getCustomersByBusinessId(businessID: string, customerID?: string): Promise<CustomerDetailsByBusinessID[]> {
		const customerDetails = await db<CustomerDetailsByBusinessID>("rel_business_customer_monitoring").where({
			business_id: businessID,
			...(customerID && { customer_id: customerID })
		});
		return customerDetails;
	}

	async getCustomerByCaseId(caseID: string): Promise<string | null> {
		const caseDetails = await this.getCaseDetailsById(caseID);
		return caseDetails?.customer_id ?? null;
	}

	async getCaseDetailsById(caseID: string): Promise<CaseDetails> {
		const businessDetails = await db("data_cases")
			.select("data_cases.*")
			.leftJoin("data_businesses", "data_businesses.id", "data_cases.business_id")
			.where({ "data_cases.id": caseID })
			.andWhere({ "data_businesses.is_deleted": false });
		return businessDetails[0];
	}

	// Gives only field name and value
	async getCustomFieldsByBusinessId(businessID: string): Promise<CustomFields[]> {
		const getCustomFieldsQuery = `SELECT json_build_object(
			'id', dbcf.id,
			'fieldValue', dbcf.field_value,
			'case_id', dbcf.case_id,
			'fieldDetails', json_agg(
				json_build_object(
				'label', dcf.label,
				'code', dcf.code,
				'isSensitive', dcf.is_sensitive,
				'property', dcf.property,
				'applicantAccess', dcf.applicant_access,
				'customerAccess', dcf.customer_access
				)
			)
		)
		FROM onboarding_schema.data_business_custom_fields dbcf
		LEFT JOIN onboarding_schema.data_custom_fields dcf
				ON dbcf.field_id = dcf.id
		LEFT JOIN data_businesses db ON db.id = dbcf.business_id
		WHERE dbcf.business_id = $1 AND db.is_deleted = false
		GROUP BY dbcf.id`;

		let getCustomFieldsResult = await sqlQuery({ sql: getCustomFieldsQuery, values: [businessID] });

		if (!getCustomFieldsResult.rows.length) return [];

		const getCorePropertiesQuery = `SELECT id, code, label FROM onboarding_schema.core_field_properties`;
		const getCorePropertiesResult = await sqlQuery({ sql: getCorePropertiesQuery });

		// format custom fields result
		let customFieldsDetails: Array<{ label: string; field: string; value: any }> = await Promise.all(
			getCustomFieldsResult.rows.map(async row => {
				const property = getCorePropertiesResult.rows.find(coreProp => {
					return coreProp.id == row.json_build_object.fieldDetails[0]?.property;
				});
				const value = row.json_build_object.fieldValue;

				const newRow: any = {
					label: row.json_build_object.fieldDetails[0]?.label,
					field: row.json_build_object.fieldDetails[0]?.code
				};
				switch (property?.code) {
					case "dropdown": {
						const isJsonObject = typeof value === "string" && value.trimStart().startsWith("{");
						newRow.value = isJsonObject ? (JSON.parse(value)?.label ?? value) : value;
						break;
					}
					case "boolean":
						newRow.value = value ? (value.toLowerCase() === "true" ? "Yes" : "No") : value;
						break;
					case "upload":
						const caseId = row.json_build_object.case_id;
						try {
							const s3File = await getCachedSignedUrl(
								value,
								`${DIRECTORIES.CUSTOM_FIELD_FILES}/businesses/${businessID}/cases/${caseId}`,
								BUCKETS.BACKEND
							);
							newRow.value = s3File.signedRequest;
						} catch (ex) {
							logger.error({ error: ex }, "Error getting signed url for custom field file");
							newRow.value = null;
						}
						break;
					case "checkbox":
						const list = JSON.parse(value);
						const values = list
							.filter(option => option.checked)
							.map(option => ({
								label: option.label,
								value: option.value
							}));
						newRow.value = values;
						break;
					default:
						newRow.value = value;
				}
				return newRow;
			})
		);
		return customFieldsDetails;
	}

	async _enrichRevenueAndAge(records) {
		const businessIDS = records.map(item => item.business_id);

		const result = await getBusinessesRevenueAndAge({ business_ids: [...new Set(businessIDS)] });

		logger.info(`getBusinessesRevenueAndAge result: ${JSON.stringify(result)}`);

		const enrichedRecords = records.reduce((acc, record) => {
			const enrichedRecord = {
				...record,
				metadata: {
					formation_date: result?.[record.business_id]?.formation_date,
					age: result?.[record.business_id]?.age,
					revenue: result?.[record.business_id]?.revenue,
					naics_code: record.naics_code,
					naics_title: record.naics_title,
					mcc_code: record.mcc_code,
					mcc_title: record.mcc_title
				}
			};

			acc.push(enrichedRecord);
			return acc;
		}, []);

		return enrichedRecords;
	}

	/**
	 * Creates a new invite for co-applicant(s) and sends a kafka message to auth service to send invitation mail
	 * @param {any} params params.businessID
	 * @param {any} body
	 * @returns
	 */
	async inviteCoApplicants(
		params: { businessID: string },
		body: { case_id: string; co_applicants: { first_name: string; last_name: string; email: string }[] },
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

			const invitationID = uuid();
			const queries = [];
			const values = [];

			// allowing email of applicant only
			for (const applicant of body.co_applicants) {
				const response = await emailExists({ email: applicant.email });
				if (response.email_exists && response.role_id !== ROLE_ID.APPLICANT) {
					throw new BusinessApiError(
						`Cannot onboard ${applicant.email} to the platform. Contact support.`,
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}

			const insertInviteQuery = `INSERT INTO data_invites (id, business_id, customer_id, status, case_id, created_by, updated_by) VALUES ($1, $2, $3, (SELECT id FROM core_invite_statuses WHERE code = $4), $5, $6, $7)`;
			const insertInviteHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status, created_by) VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2), $3)`;
			queries.push(insertInviteQuery, insertInviteHistoryQuery);
			values.push(
				[
					invitationID,
					params.businessID,
					getBusinessResult.rows[0].customer_id,
					"invited",
					body.case_id,
					userInfo.user_id,
					userInfo.user_id
				],
				[invitationID, "invited", userInfo.user_id]
			);
			await sqlTransaction(queries, values);

			const message = {
				customer_id: getBusinessResult.rows[0].customer_id,
				business_name: getBusinessResult.rows[0].name,
				business_id: params.businessID,
				invitation_id: invitationID,
				new_applicants: body.co_applicants,
				is_no_login: true,
				create_business: false,
				customer_user_id: userInfo.user_id,
				is_co_applicant: true,
				applicant_name: `${result[0].first_name} ${result[0].last_name}`,
				case_id: body.case_id
			};

			const payload = {
				topic: kafkaTopics.USERS_NEW,
				messages: [
					{
						key: params.businessID,
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

	public async getProgressionConfig(
		customerID: string,
		onboardingType = CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING
	): Promise<Array<any>> {
		let getProgressionConfigQuery = "";
		let getProgressionConfigQueryValues = [];
		if (customerID) {
			getProgressionConfigQuery = `SELECT dcos.id::text , dcos.stage AS label, stage_code  as stage, dcos.priority_order , dcos.prev_stage::text , dcos.next_stage::text ,dcos.is_enabled , dcos.is_skippable, dcos.allow_back_nav, dcos.completion_weightage, dcsfc.config
							FROM onboarding_schema.data_customer_onboarding_stages dcos
							LEFT JOIN onboarding_schema.core_onboarding_stages cos ON cos.code = dcos.stage_code
							LEFT JOIN onboarding_schema.rel_onboarding_stage_type rost ON rost.stage_id = cos.id
							LEFT JOIN onboarding_schema.core_onboarding_types cot2 ON cot2.id = rost.onboarding_type_id
							LEFT JOIN onboarding_schema.data_customer_stage_fields_config dcsfc ON dcsfc.customer_stage_id = dcos.id
							WHERE cot2.code = $1
							AND dcos.customer_id = $2
							AND dcos.is_enabled = $3
							AND (
								(SELECT rcss.is_enabled
								FROM onboarding_schema.rel_customer_setup_status rcss
								INNER JOIN onboarding_schema.core_onboarding_setup_types cost2
								ON cost2.id = rcss.setup_id
								WHERE cost2.code = $4
								AND rcss.customer_id = $2) = $5
							)

							UNION ALL

							SELECT cos.id::text,stage AS label, cos.code AS stage, priority_order , prev_stage::text , next_stage::text ,is_enabled , is_skippable, allow_back_nav, completion_weightage, csfc.config
							FROM onboarding_schema.core_onboarding_stages cos
							LEFT JOIN onboarding_schema.rel_onboarding_stage_type rost ON rost.stage_id = cos.id
							LEFT JOIN onboarding_schema.core_onboarding_types cot2 ON cot2.id = rost.onboarding_type_id
							LEFT JOIN onboarding_schema.core_stage_fields_config csfc ON csfc.stage_id = cos.id
							WHERE cot2.code = $1 AND cos.is_enabled = $3
							AND NOT EXISTS (
								SELECT rcss.is_enabled
								FROM onboarding_schema.rel_customer_setup_status rcss
								INNER JOIN onboarding_schema.core_onboarding_setup_types cost2
								ON cost2.id = rcss.setup_id
								WHERE cost2.code = $4
								AND rcss.customer_id = $2
								AND rcss.is_enabled = $5
							) ORDER BY priority_order ASC`;
			getProgressionConfigQueryValues = [
				onboardingType,
				customerID,
				true,
				CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP,
				true
			];
		} else {
			getProgressionConfigQuery = `SELECT cos.id, stage AS label, cos.code AS stage, priority_order , prev_stage::text , next_stage::text ,is_enabled , is_skippable, allow_back_nav, completion_weightage, csfc.config FROM onboarding_schema.core_onboarding_stages cos
											LEFT JOIN onboarding_schema.rel_onboarding_stage_type rost ON rost.stage_id = cos.id
											LEFT JOIN onboarding_schema.core_onboarding_types cot2 ON cot2.id = rost.onboarding_type_id
											LEFT JOIN onboarding_schema.core_stage_fields_config csfc ON csfc.stage_id = cos.id
											WHERE cot2.code = $1
											AND cos.is_enabled = $2
											ORDER BY priority_order ASC`;
			getProgressionConfigQueryValues = [onboardingType, true];
		}
		const [progressionConfig] = await sqlTransaction([getProgressionConfigQuery], [getProgressionConfigQueryValues]);
		return progressionConfig?.rows ?? [];
	}

	public getFieldFromProgressionConfig<T = any>(
		progressionConfig: object[],
		stageName: string | ProgressionStages,
		fieldName: string | ProgressionFields
	) {
		return progressionConfig
			?.find(config => config.stage.toLowerCase() == stageName.toLowerCase())
			?.config?.fields?.find(field => field.name.toLowerCase() == fieldName.toLowerCase()) as T;
	}

	async deleteRelNaicsMccCodes() {
		try {
			const deleteQuery = `DELETE FROM rel_naics_mcc`;
			await sqlQuery({ sql: deleteQuery });
		} catch (error) {
			throw error;
		}
	}

	public async getTinRequirementStatus(
		progressionConfig: any,
		authorization?: string,
		includeSecondaryChecks = true
	): Promise<boolean> {
		// Check feature flag first: If enabled, return false early
		if (authorization) {
			const isEasyFlow = false;
			if (isEasyFlow) return false;
		}

		// Extract TIN field information
		const tinField = this.getFieldFromProgressionConfig(
			progressionConfig,
			"company",
			"Tax ID Number/Employer Identification Number"
		);
		// Determine if TIN is required based on field status
		const isTinRequired = tinField?.status
			? ["required", "always required"].includes(tinField.status.toLowerCase())
			: false;
		if (!isTinRequired) {
			return false;
		}

		// Override if "Allow unverified TIN submissions" is enabled
		if (includeSecondaryChecks) {
			const requireTinResponse = tinField?.sub_fields?.find(subField => subField.name === "Require a TIN Response");
			const continueWithUnverifiedTin = tinField?.sub_fields?.find(
				subField => subField.name === "Continue with Unverified TIN"
			);
			const submitWithUnverifiedTin = tinField?.sub_fields?.find(
				subField => subField.name === "Submit with Unverified TIN"
			);
			if (requireTinResponse?.status === true) {
				return true;
			}
			if (continueWithUnverifiedTin?.status === true) {
				return true;
			}
			if (submitWithUnverifiedTin?.status === true) {
				return false;
			}
		}
		return true;
	}

	async validateBusinessHasApplicant(params: { businessID: UUID }) {
		try {
			const response = {
				business_has_owner_applicant: false
			};
			const applicants = await getBusinessApplicants(params.businessID);
			applicants.forEach(applicant => {
				if (applicant.id !== envConfig.ENTERPRISE_APPLICANT_ID && applicant.code === "owner") {
					response.business_has_owner_applicant = true;
				}
			});
			return response;
		} catch (error) {
			throw error;
		}
	}

	async unarchiveBusinesses(body: { business_ids: string[] }, userInfo: UserInfo) {
		try {
			let customerBusinesses: any[] = [];

			const businessIDs = [];
			if (!body.business_ids?.length) {
				throw new BusinessApiError("Invalid data", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const filteredArray = await Promise.all(
				body.business_ids.map(async item => {
					const redisKey = `{purged_business}:${item.businessID}`;
					const isBusinessPurged = await redis.exists(redisKey);
					return isBusinessPurged ? null : item;
				})
			);

			body.business_ids = filteredArray.filter(Boolean);

			if (Object.hasOwn(body, "business_ids") && body.business_ids.length) {
				if (userInfo.role.id === ROLE_ID.CUSTOMER) {
					customerBusinesses = await db("rel_business_customer_monitoring").where(
						"business_id",
						"in",
						body.business_ids
					);
					customerBusinesses.forEach(business => {
						if (business.customer_id !== userInfo.customer_id) {
							throw new BusinessApiError(
								`Cannot restore business: ${business.business_id}`,
								StatusCodes.FORBIDDEN,
								ERROR_CODES.NOT_ALLOWED
							);
						}
					});
					if (
						!customerBusinesses ||
						!customerBusinesses.length ||
						customerBusinesses.length !== body.business_ids.length
					) {
						throw new BusinessApiError("Invalid business IDs provided.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
					}
				}
				businessIDs.push(...body.business_ids);
			}

			let caseIds: string[] = [];
			if (businessIDs.length > 0) {
				// fetch cases associated with business
				const query = `SELECT id FROM data_cases WHERE business_id = ANY($1)`;
				const result = await sqlQuery({ sql: query, values: [businessIDs] });

				caseIds = result.rows.map(row => row.id);
			}

			await restorePurgedBusinesses(businessIDs);

			await updateIsDeleted("public", "data_businesses", "id", businessIDs, false);

			const restoreBusinessArray = businessIDs.flatMap(businessID => [`{purged_business}:${businessID}`]);
			const restoreCasesArray = caseIds.flatMap(caseID => [`{purged_business}:{cases}:${caseID}`]);

			await Promise.all([redis.deleteMultipleKeys(restoreBusinessArray), redis.deleteMultipleKeys(restoreCasesArray)]);

			// Create audit logs
			const messagesArray = businessIDs.map(businessID => ({
				key: businessID,
				value: {
					event: kafkaEvents.UNARCHIVED_BUSINESS_AUDIT,
					business_id: businessID,
					unarchived_by: `${userInfo.given_name} ${userInfo.family_name}`
				}
			}));

			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: messagesArray
			});
		} catch (error) {
			throw error;
		}
	}
}

export const businesses = new Businesses();
