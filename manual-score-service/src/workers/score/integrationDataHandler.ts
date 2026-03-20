import { logger, redis, sqlQuery, sqlTransaction } from "#helpers/index";
import type { IntegrationDataStructure, IntegrationData, CaseDataStructure } from "./types";
import { SCORE_STATUS } from "#constants";
import { v4 as uuid } from "uuid";
import { type UUID } from "crypto";
import { ConfigValidator } from "./score_config_validator";

class IntegrationDataHandlerForScore {
	/**
	 * Save integration data into redis and database for score generation
	 * @param {IntegrationData} body - The integration data to be saved
	 * @returns {Promise<void>} - A promise that resolves when the data is saved
	 */
	async saveIntegrationData(body: IntegrationData) {
		try {
			const scoreGenerateRedisKey = `{business}:${body.business_id}:{score_generate}:${body.score_trigger_id}`;
			// Get existing data from Redis
			const existingDataString = (await redis.jsonget(scoreGenerateRedisKey)) as string;
			const existingData: IntegrationDataStructure = JSON.parse(existingDataString || "{}");

			// Check if the existing data is empty or not
			if (!existingData?.category) {
				// Check if the score trigger already exists in the database
				const getBusinessScoreQuery = `SELECT business_score_triggers.id FROM business_score_triggers WHERE business_score_triggers.id = $1`;
				const getBusinessScoreResult = await sqlQuery({ sql: getBusinessScoreQuery, values: [body.score_trigger_id] });

				// If it doesn't exist, insert a new score trigger into the database else consider score is generated and return
				if (!getBusinessScoreResult.length) {
					const insertScoreTrigger = `INSERT INTO business_score_triggers (id, business_id, customer_id, applicant_id, trigger_type) VALUES ($1, $2, $3, $4, $5)`;
					await sqlQuery({ sql: insertScoreTrigger, values: [body.score_trigger_id, body.business_id, body.customer_id ?? null, body.applicant_id ?? null, body.trigger_type] });
				} else if (body.trigger_type !== "APPLICATION_EDIT") {
					logger.info(`Score trigger already exists for ID: ${body.score_trigger_id}`);
					return;
				}

				// Check if the case ID is provided and insert it into the database
				if (body.case_id && body.trigger_type !== "APPLICATION_EDIT") {
					const getCaseQuery = `SELECT * FROM data_cases WHERE id = $1 AND score_trigger_id = $2`;
					const getCaseResult = await sqlQuery({ sql: getCaseQuery, values: [body.case_id, body.score_trigger_id] });

					if (getCaseResult.length) {
						return;
					}

					const casesToInsert = [{ case_id: body.case_id, score_trigger_id: body.score_trigger_id }];
					if (Object.hasOwn(body, "cases_to_link") && body.cases_to_link?.length) {
						casesToInsert.push(...body.cases_to_link.map(item => ({ case_id: item.case_id, score_trigger_id: body.score_trigger_id })));
					}

					const placeholders = casesToInsert.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(", ");
					const values = casesToInsert.flatMap(item => [item.case_id, item.score_trigger_id]);

					const insertCases = `INSERT INTO data_cases (id, score_trigger_id) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
					await sqlQuery({ sql: insertCases, values });
				}

				const scoreID = uuid();
				const customerCondition = body.customer_id ? "customer_id = $1" : "customer_id IS NULL";
				const values = body.customer_id ? [body.customer_id] : [];
				const getLatestScoreConfigHistory = `SELECT id FROM score_config_history ORDER BY created_at DESC LIMIT 1`;
				const getLatestCustomerDecision = `SELECT id FROM score_decision_history WHERE ${customerCondition} ORDER BY created_at DESC LIMIT 1`;

				let [latestScoreConfigHistory, latestCustomerDecision] = await sqlTransaction([getLatestScoreConfigHistory, getLatestCustomerDecision], [[], values]);

				latestScoreConfigHistory = latestScoreConfigHistory.rows[0]?.id;
				latestCustomerDecision = latestCustomerDecision.rows[0]?.id;
				const score = {
					id: scoreID,
					score_trigger_id: body.score_trigger_id,
					status: SCORE_STATUS.PROCESSING,
					weighted_score_100: null,
					weighted_score_850: null,
					score_decision: null,
					risk_level: null,
					score_decision_config: latestCustomerDecision,
					score_weightage_config: latestScoreConfigHistory,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				};

				const insertScore = `INSERT INTO business_scores (id, score_trigger_id, status, score_decision_config, score_weightage_config) VALUES ($1, $2, $3, $4, $5)`;
				const insertScoreHistory = `INSERT INTO business_score_history (score_id, status) VALUES ($1, $2)`;

				// Currently showing same score to everyone.
				// TODO : Update the condition to insert score separately for customer and applicant
				const insertCurrentScore = `INSERT INTO data_current_scores (score_id, business_id, customer_id) VALUES ($1, $2, $3)`;
				if (body.trigger_type !== "APPLICATION_EDIT") {
					await sqlTransaction(
						[insertScore, insertScoreHistory, insertCurrentScore],
						[
							[scoreID, body.score_trigger_id, score.status, score.score_decision_config, score.score_weightage_config],
							[scoreID, score.status],
							[scoreID, body.business_id, body?.customer_id ?? null]
						]
					);
				}

				// Save the integration data to Redis
				await redis.jsonset(
					scoreGenerateRedisKey,
					".",
					JSON.stringify({
						category: {
							[`${body.platform_category_code}`]: {
								[`${body.platform_code}`]: [
									{
										task_code: body.task_code,
										status: body.task_status
									}
								]
							}
						},
						meta: body.metadata
					})
				);
			} else if (!existingData?.category[body.platform_category_code]) {
				await redis.jsonset(
					scoreGenerateRedisKey,
					`.category.${body.platform_category_code}`,
					JSON.stringify({
						[`${body.platform_code}`]: [
							{
								task_code: body.task_code,
								status: body.task_status
							}
						]
					})
				);
			} else if (!existingData?.category[body.platform_category_code][body.platform_code]) {
				await redis.jsonset(scoreGenerateRedisKey, `.category.${body.platform_category_code}.${body.platform_code}`, [
					{
						task_code: body.task_code,
						status: body.task_status
					}
				]);
			} else if (existingData?.category[body.platform_category_code][body.platform_code] && !existingData.category[body.platform_category_code][body.platform_code].some((task: { task_code: string }) => task.task_code === body.task_code)) {
				const oldIntegrationData = existingData.category[body.platform_category_code][body.platform_code];
				await redis.jsonset(scoreGenerateRedisKey, `.category.${body.platform_category_code}.${body.platform_code}`, [
					...oldIntegrationData,
					{
						task_code: body.task_code,
						status: body.task_status
					}
				]);
			} else {
				const redisPath = `.category.${body.platform_category_code}.${body.platform_code}`;
				const oldIntegrationData = existingData?.category[body.platform_category_code][body.platform_code];
				const newData = new Map();
				oldIntegrationData?.forEach(item => {
					newData.set(item.task_code, item);
				});
				newData.set(body.task_code, {
					task_code: body.task_code,
					status: body.task_status
				});
				const newDataArray = Array.from(newData.values());
				await redis.jsonset(scoreGenerateRedisKey, redisPath, newDataArray);
			}
			if (Object.keys(body.metadata ?? {}).length !== 0) {
				const oldMetaData = existingData?.meta ?? {};
				const newMetaData = { ...oldMetaData, ...body.metadata };
				await redis.jsonset(scoreGenerateRedisKey, ".meta", newMetaData);
			}
		} catch (error) {
			logger.error({ error }, "Error in integrationDataForScore");
			throw error;
		}
	}

	/**
	 * Check if the Integration data is ready for processing score
	 * @param {UUID} scoreTriggerID - The ID of the score trigger
	 * @param {UUID} businessID - The ID of the business
	 * @param {string} triggerType - The type of trigger
	 * @param {UUID} [caseID] - The ID of the case (optional)
	 * @param {UUID} [customerID] - The ID of the customer (optional)
	 * @returns {Promise<boolean>} - A promise that resolves to true if the score data is ready, false otherwise
	 */
	async checkScoreDataStatus(scoreTriggerID: UUID, businessID: UUID, triggerType: string, caseID?: UUID, customerID?: UUID) {
		try {
			const scoreGenerateRedisKey = `{business}:${businessID}:{score_generate}:${scoreTriggerID}`;
			const existingDataString = (await redis.jsonget(scoreGenerateRedisKey)) as string;
			const existingData: IntegrationDataStructure = JSON.parse(existingDataString);
			if (!existingData) {
				return {
					status: false,
					scoreInput: {}
				};
			}

			// checking case is submitted or not in case of onboarding invite also not checking for bulk upload
			if (caseID && triggerType === "ONBOARDING_INVITE") {
				try {
					const existingCaseDataString = (await redis.jsonget(`{business}:${businessID}:{case}:${caseID}:score_generate`)) as string;
					const existingCaseData: CaseDataStructure = JSON.parse(existingCaseDataString);
					if (!["SUBMITTED", "INFORMATION_UPDATED"].includes(existingCaseData?.case_status?.status ?? "")) {
						logger.warn(`Case with ID ${caseID} is not submitted or has Information requested status. Skipping score calculation.`);
						return {
							status: false,
							scoreInput: {}
						};
					}
				} catch (error) {
					logger.error({ error }, `Error in case status check for case ID ${caseID}`);
				}
			}

			// temporarily added required category codes in future we implement by config validation check
			let configQuery = `SELECT data_customer_configs.config FROM data_customer_configs INNER JOIN core_configs ON  data_customer_configs.config_id = core_configs.id WHERE core_configs.code = $1 AND data_customer_configs.customer_id = $2`;
			let validationConfig = await sqlQuery({ sql: configQuery, values: ["score_config", customerID] });
			if (!validationConfig.length) {
				configQuery = `SELECT config FROM core_configs WHERE code = $1`;
				validationConfig = await sqlQuery({ sql: configQuery, values: ["score_config"] });
			}
			// checking if required category codes are available in redis data or not
			const validator = new ConfigValidator(customerID ?? scoreTriggerID, (validationConfig[0] as any)?.config);
			const isRequiredCategoryAvailable = validator.validate(existingData);
			logger.info(`isRequiredCategoryAvailable: ${businessID} : ${JSON.stringify(isRequiredCategoryAvailable)}`);
			if (isRequiredCategoryAvailable.success) {
				// Re-fetch meta before deleting to handle race condition using native JSON path
				const metaString = (await redis.jsonget(scoreGenerateRedisKey, ".meta")) as string;

				// If data is already deleted by another process, skip to avoid duplicate event
				if (!metaString) {
					logger.info(`Score data already processed for business: ${businessID}, trigger: ${scoreTriggerID}. Skipping duplicate.`);
					return {
						status: false,
						scoreInput: {}
					};
				}

				const meta = JSON.parse(metaString);

				await redis.delete(scoreGenerateRedisKey);
				if (caseID) {
					await redis.delete(`{business}:${businessID}:{case}:${caseID}:score_generate`);
				}
				return {
					status: true,
					scoreInput: meta
				}
			}
			return {
				status: false,
				scoreInput: {}
			};
		} catch (error) {
			logger.error({ error }, "Error in integrationDataForScore");
			throw error;
		}
	}
}

export const integrationDataHandlerForScore = new IntegrationDataHandlerForScore();
