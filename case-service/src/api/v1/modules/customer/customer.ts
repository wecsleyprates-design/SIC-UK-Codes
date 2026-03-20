import {
	createAndLinkGuestUserAndSubrole,
	db,
	logger,
	redis,
	sqlQuery,
	sqlSequencedTransaction,
	producer
} from "#helpers/index";
import { getFlagValue } from "#helpers/LaunchDarkly";
import { ERROR_CODES, FEATURE_FLAGS, kafkaEvents, kafkaTopics } from "#constants/index";
import { CustomerApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { envConfig, tokenConfig } from "#configs";
import { randomUUID, UUID } from "crypto";
import { encryptData, jwtSign } from "#utils";
import { UserInfo } from "#types";
import { buildApplicationEditInviteRedisKey } from "#helpers/redis";

class Customer {
	async _validateDataPermission(
		queryParam: { businessID?: string; customerID?: string },
		userInfo: { customer_id?: string | null; email?: string }
	): Promise<boolean> {
		try {
			/**
			 * First, check if this function is enabled via the associated feature flag.
			 */
			const isFlagActive = await getFlagValue(FEATURE_FLAGS.WIN_1098_VALIDATE_DATA_PERMISSION);
			/**
			 * If the feature flag associated with this function is not active, short-circuit and return true.
			 */
			if (!isFlagActive) return true;

			/**
			 * If there's no customer_id in the token, we cannot check that this user has access to
			 * this customer's data. Return false.
			 */
			if (!userInfo.customer_id) {
				/**
				 * The _validateDataPermission function is only called when the user role is CUSTOMER.
				 * If a user with a CUSTOMER role does not have a customer_id, something funky is going on.
				 * Log it for further investigation.
				 */
				logger.info(`Customer ID not present in token: ${userInfo.email}`);
				return false;
			}

			/**
			 * If businessID is present, we need to check that the business belongs to the customer.
			 * We store the list of business IDs for each customer in a Redis set.
			 * The key is in the format `customer:{customerID}:businesses`.
			 */
			if (queryParam.businessID) {
				/**
				 * Check if the businessID is in the Redis set for this customer.
				 */
				const redisKey = `{customer}:${userInfo.customer_id}:businesses`;
				const access = await redis.sismember(redisKey, queryParam.businessID);

				/**
				 * If access is true, just return true -- no need to update the cache.
				 */
				if (access) return true;

				/**
				 * If access is false, it could that the Redis cache is stale.
				 * So, we need to update the cache and check again.
				 */
				await this.updateCustomerAuthorizationCache(userInfo.customer_id);

				/**
				 * Once more, check if the businessID is in the Redis set for this customer.
				 * If it's still not there, then the user does not have access and we return false.
				 */
				return await redis.sismember(redisKey, queryParam.businessID);
			}

			/**
			 * If there's no businessID, in the query params, that just means we're in the context of
			 * a route which is not specific to a singular business, such as `/customers/:customerID/businesses`.
			 *
			 * In that case, all we need to check is that the customerID in the token
			 * matches the customerID in the request params.
			 */
			return !!queryParam.customerID && userInfo.customer_id === queryParam.customerID;
		} catch (error) {
			throw error;
		}
	}

	async prepareCustomerAuthorizationCache() {
		try {
			const isFlagActive = await getFlagValue(FEATURE_FLAGS.WIN_1098_VALIDATE_DATA_PERMISSION);
			if (isFlagActive) {
				logger.debug(`Starting to fetch data from rel_business_customer_monitoring`);

				const query = `SELECT rel_business_customer_monitoring.customer_id, rel_business_customer_monitoring.business_id FROM public.rel_business_customer_monitoring 
				LEFT JOIN data_businesses db on rel_business_customer_monitoring.business_id = db.id WHERE db.is_deleted = false`;
				const result = await sqlQuery({ sql: query });

				if (!result || !result.rows) {
					throw new Error("SQL query returned undefined or no rows");
				}

				logger.debug(`SQL query executed successfully, processing rows...`);

				const groupedData: Record<string, Set<string>> = result.rows.reduce((acc, row) => {
					const customerID = row.customer_id;
					const businessID = row.business_id;

					if (!customerID) {
						return acc;
					}

					if (!acc[customerID]) {
						acc[customerID] = new Set();
					}

					acc[customerID].add(businessID);
					return acc;
				}, {});

				logger.debug(`Data grouped by customer ID, storing in Redis...`);

				for (const [customerID, businessIDs] of Object.entries(groupedData)) {
					const redisKey = `{customer}:${customerID}:businesses`;
					await redis.sadd(redisKey, [...businessIDs]);
				}
			}
			return;
		} catch (error) {
			throw error;
		}
	}

	async updateCustomerAuthorizationCache(customerID: string) {
		try {
			const isFlagActive = await getFlagValue(FEATURE_FLAGS.WIN_1098_VALIDATE_DATA_PERMISSION);
			if (isFlagActive) {
				logger.debug(`Starting to fetch data from rel_business_customer_monitoring`);

				const query = `SELECT rel_business_customer_monitoring.customer_id, rel_business_customer_monitoring.business_id FROM public.rel_business_customer_monitoring
				LEFT JOIN data_businesses db on rel_business_customer_monitoring.business_id = db.id 
				where rel_business_customer_monitoring.customer_id = $1 AND db.is_deleted = false`;
				const values = [customerID];
				const result = await sqlQuery({ sql: query, values });

				if (!result || !result.rows || !result.rows.length) {
					throw new Error("Customer ID not found or SQL query returned undefined or no rows");
				}

				logger.debug(`SQL query executed successfully, processing rows...`);

				const groupedData: Record<string, Set<string>> = result.rows.reduce((acc, row) => {
					const customerID = row.customer_id;
					const businessID = row.business_id;

					if (!customerID) {
						return acc;
					}

					if (!acc[customerID]) {
						acc[customerID] = new Set();
					}

					acc[customerID].add(businessID);
					return acc;
				}, {});

				logger.debug(`Data grouped by customer ID, storing in Redis...`);

				for (const [customerID, businessIDs] of Object.entries(groupedData)) {
					const redisKey = `{customer}:${customerID}:businesses`;
					await redis.sadd(redisKey, [...businessIDs]);
				}
			}
			return true;
		} catch (error) {
			throw error;
		}
	}

	async getCustomerInviteForApplicationEdit(
		params: { customerID: UUID; caseID: UUID },
		query: { noCache: boolean },
		userInfo: UserInfo
	) {
		try {
			// check flag status
			const applicationEditFlagStatus = await getFlagValue(FEATURE_FLAGS.PAT_466_TRIGGERING_APPLICATION_EDIT, {
				key: "customer",
				kind: "customer",
				customer_id: params.customerID
			});

			if (!applicationEditFlagStatus) {
				throw new CustomerApiError(
					"Application edit feature is not enabled for this customer",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.NOT_ALLOWED
				);
			}

			const caseRecord = await db("data_cases")
				.leftJoin("data_businesses as db", "db.id", "data_cases.business_id")
				.select("data_cases.business_id")
				.where({ "data_cases.id": params.caseID, "data_cases.customer_id": params.customerID })
				.andWhere({ "db.is_deleted": false })
				.first();

			if (!caseRecord) {
				throw new CustomerApiError("Case not found!", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}

			// check if data is present in redis cache
			const redisKey = buildApplicationEditInviteRedisKey(params.customerID, params.caseID);
			const cachedData = await redis.get<{ link: string; inviteToken: any; customerID: UUID; applicantID: UUID }>(
				redisKey
			);
			if (cachedData) {
				if (cachedData.applicantID !== userInfo.user_id) {
					throw new CustomerApiError(
						"The application is currently being edited by another member of your team.",
						StatusCodes.FORBIDDEN,
						ERROR_CODES.NOT_ALLOWED
					);
				}

				if (!query?.noCache) {
					return cachedData?.link;
				}
			}

			const [business, invitation] = await Promise.all([
				db("data_businesses").where({ id: caseRecord.business_id }).first(),
				db("data_invites")
					.where({ "data_invites.customer_id": params.customerID, "data_invites.case_id": params.caseID })
					.first()
			]);

			let invitationId: UUID | null = invitation && invitation.id ? invitation.id : null;
			if (!invitation?.id) {
				// if no invitation exists, create one
				invitationId = randomUUID();
				const queries: string[] = [];
				const values: any[] = [];
				const insertInviteQuery = `INSERT INTO data_invites (id, business_id, customer_id, status, case_id, created_by, updated_by) VALUES ($1, $2, $3, (SELECT id FROM core_invite_statuses WHERE code = $4), $5, $6, $7)`;
				const insertInviteHistoryQuery = `INSERT INTO data_invites_history (invitation_id, status, created_by) VALUES ($1, (SELECT id FROM core_invite_statuses WHERE code = $2), $3)`;
				queries.push(insertInviteQuery, insertInviteHistoryQuery);
				values.push(
					[invitationId, business.id, params.customerID, "invited", params.caseID, userInfo.user_id, userInfo.user_id],
					[invitationId, "invited", userInfo.user_id]
				);

				await sqlSequencedTransaction(queries, values);
			}

			// make internal api call to auth svc to create guest user and guest subrole
			const result = await createAndLinkGuestUserAndSubrole({
				business_id: business.id,
				customer_id: params.customerID
			});

			const inviteToken = {
				first_name: result.first_name,
				last_name: result.last_name,
				applicant_id: result.applicant_id,
				applicant_name: `${result.first_name} ${result.last_name}`,
				email: result.email,
				invitation_id: invitationId,
				business_id: caseRecord.business_id,
				case: "onboard_applicant_by_customer",
				iat: Date.now(),
				exp: Date.now() + tokenConfig.NO_LOGIN_VERIFY_EMAIL_INVITE_TOKEN_LIFE_SECONDS * 1000,
				customer_id: params.customerID,
				user_id: userInfo.user_id,
				is_no_login: true,
				is_guest_owner: true
			};

			const link = `${envConfig.APPLICANT_FRONTEND_BASE_URL}/verify/invite?token=${encodeURIComponent(
				jwtSign(encryptData(inviteToken))
			)}&first_name=${encodeURIComponent(`Guest`)}&last_name=${encodeURIComponent(
				`Owner`
			)}&business_name=${encodeURIComponent(business.name)}&is_guest_owner=true`;

			// save data into redis cache
			await redis.setex(
				redisKey,
				{ link, inviteToken, customerID: params.customerID, applicantID: userInfo.user_id },
				tokenConfig.APPLICATION_EDIT_LOCK_LIFE_SECONDS // this should be in seconds rather than milliseconds
			);

			// Create an audit log
			let auditMessage = {
				case_id: params.caseID,
				business_id: caseRecord.business_id,
				customer_user_id: userInfo.user_id,
				business_name: business.name
			};

			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [{
					key: caseRecord.business_id,
					value: {
						event: kafkaEvents.APPLICATION_EDIT_BEGAN_AUDIT,
						...auditMessage
					}
				}]
			});

			return link;
		} catch (err) {
			throw err;
		}
	}

	async getApplicationEditSessions(params: { customerID: UUID; caseID: UUID }) {
		try {
			const redisKey = buildApplicationEditInviteRedisKey(params.customerID, params.caseID);
			const cachedData = await redis.get<{ link: string; inviteToken: any; customerID: UUID; applicantID: UUID }>(
				redisKey
			);

			let activeSession: boolean = false;
			if (cachedData) {
				activeSession = true;
			}

			return {
				is_session_active: activeSession,
				applicant_id: cachedData?.applicantID ?? null
			};
		} catch (err) {
			throw err;
		}
	}
}

export const customer = new Customer();
