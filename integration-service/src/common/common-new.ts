import { TASK_STATUS, kafkaEvents, kafkaTopics, FEATURE_FLAGS, SCORE_TRIGGER, IntegrationPlatformId, INTEGRATION_ID, DIRECTORIES } from "#constants";
import { sqlQuery, producer, logger, getBusinessCustomers, sqlTransaction, getFlagValue, redis, getCustomerData, getBusinessApplicants, db } from "#helpers";
import { ICreateRiskAlert, IKafkaMessage, SqlQueryResult, SqlTransactionResult } from "#types";
import { riskAlerts } from "#api/v1/modules/risk-alerts/risk-alerts";
import { noneFoundToZero, updateBusinessDetailS3, shimIntegrationData } from "./common";
import { UUID } from "crypto";
import { Plaid } from "#lib";
import { parseFloatNum } from "#utils";
import { FactEngine } from "#lib/facts/factEngine";
import { factWithHighestConfidence } from "#lib/facts/rules";
import type { Fact, FactName } from "#lib/facts/types";
import type * as Types from "@joinworth/types";
// For Temporary fix added dual zod version because if we directly upgrade then it is impacting other package also like openai
import type { z } from "zod-v4";
import dayjs from "dayjs";

type ScoringData = z.infer<typeof Types.Integration.ScoreFact.ScoringDataSchema>;

interface SendWebhookMessagePayload {
	event_code: string;
	customer_id: string;
	data: object;
}

interface SendSectionCompletedMessagePayload {
	business_id: UUID;
	section_name: string;
	user_id?: UUID | null;
	customer_id?: UUID | null;
}

interface sendEventToGatherWebhookDataPayload {
	events: string[];
	options: {
		business_id?: string;
		case_id?: string;
		customer_id?: string;
	};
}

interface IntegrationTask {
	id: string;
	connection_id: string;
	business_score_trigger_id?: string | null;
	integration_platform_id: number;
	created_at: string;
	// Add other fields if necessary
}

export const sendWebhookEvent = async (customerID: string, event: string, data: object) => {
	const sendWebhookEventFlag = await getFlagValue(FEATURE_FLAGS.WIN_1223_SEND_WEBHOOK_EVENTS);

	if (sendWebhookEventFlag) {
		const message: SendWebhookMessagePayload = {
			event_code: event,
			customer_id: customerID,
			data
		};

	await producer.send({
		topic: kafkaTopics.WEBHOOKS,
		messages: [{ 
			key: customerID, 
			value: { 
				event: kafkaEvents.SEND_WEBHOOK,
				...message 
			}
		}]
	});
	}
};

export const sendEventToGatherWebhookData = async (events: string[], options: { business_id?: string; case_id?: string; customer_id?: string }) => {
	const sendWebhookEventFlag = await getFlagValue(FEATURE_FLAGS.WIN_1223_SEND_WEBHOOK_EVENTS);

	if (sendWebhookEventFlag) {
		const message: sendEventToGatherWebhookDataPayload = {
			events,
			options
		};

	await producer.send({
		topic: kafkaTopics.BUSINESS,
		messages: [{ 
			key: options.business_id ?? "", 
			value: { 
				event: kafkaEvents.SEND_WEBHOOK,
				...message 
			}
		}]
	});
	}
};

export const checkAndTriggerRiskAlert = async (source: "public_records" | "equifax" | "integrations", businessID: string, causeID: string, customerID?: string) => {
	const customerIDs: string[] = [];

	const getScoreTriggerTypeQuery = `SELECT bst.trigger_type FROM integrations.business_score_triggers bst
		INNER JOIN integrations.data_business_integrations_tasks dbit ON dbit.business_score_trigger_id = bst.id
	 	WHERE dbit.id = $1`;

	const scoreTriggerTypeResult: SqlQueryResult = await sqlQuery({ sql: getScoreTriggerTypeQuery, values: [causeID] });

	if (!scoreTriggerTypeResult.rows.length) {
		logger.info(`RISK ALERT: No score trigger found for business ${businessID} & task ${causeID}`);
		return;
	}

	// Do not trigger risk alert for ONBOARDING_INVITE
	if (scoreTriggerTypeResult.rows[0].trigger_type === SCORE_TRIGGER.ONBOARDING_INVITE) {
		logger.info(`RISK ALERT: Score trigger type is ONBOARDING_INVITE for business ${businessID} & task ${causeID}`);
		return;
	}

	// Get all customers associated with this business and have monitoring enabled
	const { customer_ids } = await getBusinessCustomers(businessID, { is_monitoring_enabled: true });

	if (customerID) {
		if (!customer_ids.includes(customerID)) {
			logger.info(`RISK ALERT: Customer ${customerID} is not associated with business ${businessID} or don't have monitoring enabled`);
			return;
		}
		customerIDs.push(customerID);
	} else {
		customerIDs.push(...customer_ids);
	}

	// check if this business have customer associated and risk monitoring is enabled for them
	if (!customerIDs?.length) {
		logger.info(`No customers with monitoring enabled found for business ${businessID}`);
		return;
	}

	switch (source) {
		case "public_records":
			try {
				logger.info(`RISK ALERT: Checking and triggering risk alert for public records for business ${businessID}`);
				// This function will check if the business has any new liens, bankruptcies or judgements
				await checkAndTriggerAlertNewLienJudgementBankruptcy(businessID, causeID, customerIDs);
			} catch (error) {
				logger.error(`RISK ALERT: Error checking and triggering risk alert for public records for business ${businessID}`);
				logger.error(error);
			}
			break;

		case "equifax":
			try {
				logger.info(`RISK ALERT: Checking and triggering risk alert for equifax for business ${businessID}`);
				// This function will check if the business owners credit score dropped by significant amount
				await checkAndTriggerAlertForEquifax(businessID, causeID, customerIDs);
			} catch (error) {
				logger.error(`RISK ALERT: Error checking and triggering risk alert for equifax for business ${businessID}`);
				logger.error(error);
			}
			break;

		// case "integrations":
		// 	try {
		// 		logger.info(`RISK ALERT: Checking and triggering risk alert for integration failures for business ${businessID}`);
		// 		await checkAndTriggerRiskAlertForIntegrationFailure(businessID, causeID, customerIDs);
		// 	} catch (error) {
		// 		logger.error(`Error in triggering risk alert for integration failures for business ${businessID}`);
		// 		logger.error(JSON.stringify(error));
		// 	}
		default:
			break;
	}
};

/**
 * @description Generate kafka message for new lien, judgement or bankruptcy
 * @param riskSubType : new_lien | new_judgement | new_bankruptcy
 * @param riskAlertConfigId : Risk alert config id
 * @param measurementConfig : measurement config
 * @param basicPayload : Basic payload for risk alert
 * @returns
 */
const generateKafkaMessageForBJL = (
	riskSubType: "new_lien" | "new_judgement" | "new_bankruptcy",
	riskAlertConfigId: string,
	measurementConfig: Record<string, any>,
	basicPayload: ICreateRiskAlert
): IKafkaMessage => {
	const payload: ICreateRiskAlert = {
		...basicPayload,
		risk_alert_subtype: riskSubType,
		risk_alert_config_id: riskAlertConfigId,
		measurement_config: JSON.stringify(measurementConfig),
		risk_level: "HIGH"
	};

const message: IKafkaMessage = { 
	key: basicPayload.business_id, 
	value: { 
		event: kafkaEvents.CREATE_RISK_ALERT,
		...payload 
	}
};

return message;
};

/**
 * @description Check and trigger risk alert for new lien, judgement or bankruptcy
 * @param businessID : Business ID
 * @param businessTaskID : Business integration task ID of fetch_public_records task
 * @param customerIds : List of customer IDs
 * @returns
 */
const checkAndTriggerAlertNewLienJudgementBankruptcy = async (businessID: string, businessTaskID: string, customerIds: string[]) => {
	try {
		logger.debug(`RISK ALERT: payload for checkAndTriggerAlertNewLienJudgementBankruptcy: ${businessID}, ${businessTaskID}, ${customerIds}`);
		// NOTE: We will generate risk alert for all customers with monitoring enabled
		const getPublicRecordsQuery = `SELECT pr.number_of_business_liens, pr.number_of_bankruptcies, pr.number_of_judgement_fillings, dbit.business_score_trigger_id FROM integration_data.public_records pr
		LEFT JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = pr.business_integration_task_id 
		WHERE pr.business_integration_task_id = $1`;

		const newPublicRecords: SqlQueryResult = await sqlQuery({ sql: getPublicRecordsQuery, values: [businessTaskID] });

		if (!newPublicRecords.rows.length) {
			throw new Error(`RISK ALERT: No public records found for business ${businessID} & task ${businessTaskID}`);
		}

		const newBusinessData = newPublicRecords.rows[0];

		const lienCount = parseInt(noneFoundToZero(newBusinessData.number_of_business_liens));
		const bankruptciesCount = parseInt(noneFoundToZero(newBusinessData.number_of_bankruptcies));
		const judgementCount = parseInt(noneFoundToZero(newBusinessData.number_of_judgement_fillings));

		logger.debug(`RISK ALERT: Lien count: ${lienCount}, Bankruptcy count: ${bankruptciesCount}, Judgement count: ${judgementCount}`);

		// Trigger risk alert if there is any new lien, bankruptcy or judgement. No need to check if it is reduced from last reported
		const isLien = lienCount > 0;
		const isBankruptcy = bankruptciesCount > 0;
		const isJudgement = judgementCount > 0;

		// Return if there is no lien, bankruptcy or judgement
		if (!(isLien || isBankruptcy || isJudgement)) {
			logger.info(`RISK ALERT: No new lien, bankruptcy or judgement found for business ${businessID} & task ${businessTaskID}`);
			return;
		}

		// create kafka messages for each customer if there is any new lien, bankruptcy or judgement
		const messages: IKafkaMessage[][] = await Promise.all(
			customerIds.map(async (customerID: string) => {
				// Get the risk alert config for the customer & admin
				// If the config not present in customer then use the admin config
				const riskConfig = await riskAlerts.getRiskAlertConfig(customerID);

				const newLienConfig = riskConfig.customer.new_lien ? riskConfig.customer.new_lien.HIGH : riskConfig.admin.new_lien.HIGH;
				const newBankruptcyConfig = riskConfig.customer.new_bankruptcy ? riskConfig.customer.new_bankruptcy.HIGH : riskConfig.admin.new_bankruptcy.HIGH;
				const newJudgementConfig = riskConfig.customer.new_judgement ? riskConfig.customer.new_judgement.HIGH : riskConfig.admin.new_judgement.HIGH;

				const customerMessages: IKafkaMessage[] = [];
				const payload: ICreateRiskAlert = {
					business_id: businessID,
					customer_id: customerID,
					integration_task_id: businessTaskID,
					risk_alert_subtype: "new_lien",
					risk_alert_config_id: newLienConfig.id,
					measurement_config: JSON.stringify(newLienConfig.measurement_config),
					risk_level: "HIGH",
					score_trigger_id: newBusinessData.business_score_trigger_id
				};

				const riskAlertStatuses = riskConfig.customer.risk_alert_statuses || riskConfig.admin.risk_alert_statuses;
				if (riskAlertStatuses.risk_alerts_status && riskAlertStatuses.new_bankruptcy_lien_judgement_status) {
					// Validate if the business has any new liens, bankruptcies or judgments
					if (isLien) {
						const message = generateKafkaMessageForBJL("new_lien", newLienConfig.id, newLienConfig.measurement_config, payload);
						customerMessages.push(message);
					}

					if (isBankruptcy) {
						const message = generateKafkaMessageForBJL("new_bankruptcy", newBankruptcyConfig.id, newBankruptcyConfig.measurement_config, payload);
						customerMessages.push(message);
					}

					if (isJudgement) {
						const message = generateKafkaMessageForBJL("new_judgement", newJudgementConfig.id, newJudgementConfig.measurement_config, payload);
						customerMessages.push(message);
					}
				}

				return customerMessages;
			})
		);

		const kafkaMessage = messages.filter(message => message.length).flat() as IKafkaMessage[];
		if (kafkaMessage?.length) {
			await producer.send({
				topic: kafkaTopics.CASES,
				messages: kafkaMessage
			});
		}
	} catch (error) {
		throw error;
	}
};

const checkAndTriggerAlertForEquifax = async (businessID: string, businessTaskID: string, customerIds: string[]) => {
	try {
		logger.info(`RISK ALERT: Checking and triggering risk alert for equifax for business ${businessID} & task ${businessTaskID}`);
		const priorTaskIDQuery = `SELECT business_integration_task_id, prior_id
			FROM (
					SELECT business_integration_task_id,
								 LAG(business_integration_task_id, -1) OVER (PARTITION BY meta->'owner'->>'id' ORDER BY bureau_credit_score.created_at DESC) AS prior_id
					FROM integration_data.bureau_credit_score
					where business_id = $1
			) subquery
			WHERE business_integration_task_id = $2`;

		const priorTaskID: SqlQueryResult = await sqlQuery({ sql: priorTaskIDQuery, values: [businessID, businessTaskID] });

		if (!priorTaskID.rows.length || !priorTaskID.rows[0].prior_id) {
			logger.info(`RISK ALERT: No prior credit score task found for business ${businessID} & task ${businessTaskID}`);
			return;
		}

		logger.info(`RISK ALERT: Prior credit score task: ${priorTaskID.rows[0].prior_id} & new task: ${businessTaskID} for business ${businessID}`);

		const ScoreQuery = `SELECT score, meta->'owner'->>'id' AS owner_id, meta->'owner'->>'email' AS email, dbit.business_score_trigger_id FROM integration_data.bureau_credit_score bcs
		LEFT JOIN integrations.data_business_integrations_tasks dbit ON dbit.id = bcs.business_integration_task_id WHERE bcs.business_integration_task_id = $1`;

		const [priorCreditScore, currentCreditScore]: SqlTransactionResult = await sqlTransaction([ScoreQuery, ScoreQuery], [[priorTaskID.rows[0].prior_id], [businessTaskID]]);

		const maxScoreDrop = (priorCreditScore.rows[0].score || 0) - (currentCreditScore.rows[0].score || 0);

		const maxScoreDropPercentage = (maxScoreDrop / 850) * 100;

		const messages: (IKafkaMessage | null)[] = await Promise.all(
			customerIds.map(async (customerID: string) => {
				// TODO: Get the risk alert config for the all customers & admin using single query for efficiency
				const riskConfig = await riskAlerts.getRiskAlertConfig(customerID);
				const riskAlertStatuses = riskConfig.customer.risk_alert_statuses || riskConfig.admin.risk_alert_statuses;
				if (riskAlertStatuses.risk_alerts_status && riskAlertStatuses.credit_score_config_status) {
					const creditScoreConfig = riskConfig.customer.equifax_credit_score ? riskConfig.customer.equifax_credit_score.MODERATE : riskConfig.admin.equifax_credit_score.MODERATE;

					if (maxScoreDropPercentage >= creditScoreConfig.measurement_config.threshold) {
						const payload: ICreateRiskAlert = {
							business_id: businessID,
							customer_id: customerID,
							integration_task_id: businessTaskID,
							risk_alert_subtype: "equifax_credit_score",
							risk_alert_config_id: creditScoreConfig.id,
							measurement_config: JSON.stringify(creditScoreConfig.measurement_config),
							risk_level: "MODERATE",
							score_trigger_id: currentCreditScore.rows[0].business_score_trigger_id
						};

					return { 
						key: businessID, 
						value: { 
							event: kafkaEvents.CREATE_RISK_ALERT,
							...payload 
						}
					} as IKafkaMessage;
				}
			}

			return null;
		})
	);

		const kafkaMessage = messages.filter(message => message !== null) as IKafkaMessage[];
		if (kafkaMessage.length) {
			await producer.send({
				topic: kafkaTopics.CASES,
				messages: kafkaMessage
			});
		}
	} catch (error) {
		throw error;
	}
};

const checkAndTriggerRiskAlertForIntegrationFailure = async (businessID: string, scoreTriggerID: string, customerIDs: string[]) => {
	try {
		// check risk alert status and return not have any risk alert platform available
		const riskAlertPlatformsQuery = `SELECT distinct(integrations.core_integrations_platforms.label) as platforms_label
				FROM integrations.core_integrations_platforms
				INNER JOIN integrations.rel_tasks_integrations ON integrations.rel_tasks_integrations.platform_id = core_integrations_platforms.id
				INNER JOIN integrations.data_business_integrations_tasks dbit ON dbit.integration_task_id = integrations.rel_tasks_integrations.id
				INNER JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
				INNER JOIN integrations.rel_platforms_status on integrations.rel_platforms_status.platform_id = integrations.core_integrations_platforms.id
				WHERE dbit.business_score_trigger_id =$1 AND (task_status = 'FAILED' OR connection_status IN ('REVOKED', 'FAILED', 'NEEDS_ACTION')) AND integrations.rel_platforms_status.risk_alert_status = TRUE`;
		const failedIntegrationPlatformsResult = await sqlQuery({ sql: riskAlertPlatformsQuery, values: [scoreTriggerID] });
		if (!failedIntegrationPlatformsResult.rows.length) return;

		const messages: IKafkaMessage[] = await Promise.all(
			customerIDs.map(async (customerID: string) => {
				// Get the risk alert config for the customer & admin
				// If the config not present in customer then use the admin config
				const riskConfig = await riskAlerts.getRiskAlertConfig(customerID);
				const integrationFailureConfig = riskConfig.customer.integration_failure ? riskConfig.customer.integration_failure.HIGH : riskConfig.admin.integration_failure.HIGH;

				const payload: ICreateRiskAlert = {
					business_id: businessID,
					customer_id: customerID,
					risk_alert_subtype: "integration_failure",
					risk_alert_config_id: integrationFailureConfig.id,
					measurement_config: JSON.stringify(integrationFailureConfig.measurement_config),
					risk_level: "HIGH",
					score_trigger_id: scoreTriggerID
				};

			return { 
				key: businessID, 
				value: { 
					event: kafkaEvents.CREATE_RISK_ALERT,
					...payload 
				}
			} as IKafkaMessage;
		})
	);

	if (messages?.length) {
		await producer.send({
			topic: kafkaTopics.CASES,
				messages: messages
			});
		}
	} catch (error) {
		throw error;
	}
};

export const sendKafkaEventForSection = async (businessId: UUID, sectionName: string, userId?: UUID | null, customerId?: UUID | null): Promise<void> => {
	const sendSectionCompletedEventFlag = await getFlagValue(FEATURE_FLAGS.PAT_69_SECTION_COMPLETED_EMAIL);

	if (sendSectionCompletedEventFlag) {
		const message: SendSectionCompletedMessagePayload = {
			business_id: businessId,
			section_name: sectionName,
			user_id: userId,
			customer_id: customerId
		};

	const payload = { 
		topic: kafkaTopics.CASES, 
		messages: [{ 
			key: businessId, 
			value: { 
				event: kafkaEvents.SECTION_COMPLETED,
				...message 
			}
		}] 
	};

	await producer.send(payload);
		logger.info(`Kafka event sent for business: ${businessId}, section: ${sectionName}`);
	}
};

export const fetchIntegrationTasks = async ({
	businessId,
	integrationPlatformId,
	caseId,
	integrationTaskId = null
}: {
	businessId?: UUID;
	integrationPlatformId: IntegrationPlatformId;
	caseId?: UUID;
	integrationTaskId?: number | null;
}): Promise<IntegrationTask[]> => {
	try {
		// If businessId is not provided but caseId is, fetch businessId from data_cases
		let scoreTriggerId: string | null = null;
		if (caseId) {
			const caseData = await db("public.data_cases").select("business_id", "score_trigger_id").where({ id: caseId }).first();

			if (!caseData) {
				throw new Error("No matching case found for the given case ID.");
			}

			businessId = caseData.business_id;
			scoreTriggerId = caseData.score_trigger_id;
		}

		// Fetch connection ID if businessId is available
		let connectionId: string | null = null;
		if (businessId) {
			const connectionData = await db("integrations.data_connections").select("id as connection_id").where({ business_id: businessId, platform_id: integrationPlatformId }).first();

			if (!connectionData) {
				throw new Error("No connection found for the given business ID and platform.");
			}

			connectionId = connectionData.connection_id;
		}

		let latestTask;
		if (scoreTriggerId) {
			// if caseId fetch latest task id related to caseId
			latestTask = await db("integrations.data_business_integrations_tasks")
				.select("id as current_task_id", "created_at")
				.modify(query => {
					if (connectionId) query.where({ connection_id: connectionId });
					if (scoreTriggerId) query.where({ business_score_trigger_id: scoreTriggerId });
				})
				.orderBy("created_at", "desc")
				.first();
		} else {
			// fetch latest task id
			latestTask = await db("integrations.data_business_integrations_tasks")
				.select("id as current_task_id", "created_at")
				.modify(query => {
					if (connectionId) query.where({ connection_id: connectionId });
					if (integrationTaskId) query.where({ integration_task_id: integrationTaskId });
				})
				.orderBy("created_at", "desc")
				.first();
		}

		// If no task exists, return an empty array early
		if (!latestTask || !latestTask.created_at) {
			return [];
		}

		const { created_at } = latestTask;

		// Fetch all tasks created before or equal to the latest task's creation date
		const tasks = await db("integrations.data_business_integrations_tasks")
			.select("*")
			.where("created_at", "<=", created_at)
			.modify(query => {
				if (connectionId) query.where({ connection_id: connectionId });
				if (integrationTaskId) query.where({ integration_task_id: integrationTaskId });
			})
			.orderBy("created_at", "asc");

		return tasks;
	} catch (error) {
		throw error;
	}
};

export const triggerSectionCompletedKafkaEventWithRedis = async ({
	businessId,
	section,
	userId,
	customerId = null
}: {
	businessId: UUID;
	section: string;
	userId: UUID;
	customerId?: UUID | null;
}): Promise<void> => {
	const businessKey = `{business}:${businessId}:{first_integration}`;
	const redisKey = `{business}:${businessId}:${section.toLowerCase()}:${userId}`;

	try {
		const alreadyTriggered = await redis.sismember(businessKey, redisKey);
		logger.info(`SECTION COMPLETED EVENT REDIS KEY ALREADY EXISTS: ${section} : ${JSON.stringify(alreadyTriggered)} : ${redisKey}`);

		if (!alreadyTriggered) {
			await sendKafkaEventForSection(businessId, section, userId, customerId);
			await redis.sadd(businessKey, redisKey);
		}
	} catch (err: any) {
		logger.error(`Error sending Kafka event for section '${section}': ${err.message}`);
	}
};

/**
 *  Function to prepare integration data for score calculation
 *  @param {string} integrationTaskID - The ID of the integration task
 *  @param {string} triggerType - The type of trigger (default: "ONBOARDING_INVITE")
 *  @param {string} requestID - The ID of the request (default: null)
 *  @returns {Promise<void>}
 * */
export const prepareIntegrationDataForScore = async (integrationTaskID: UUID, triggerType: string = "ONBOARDING_INVITE", requestID: UUID | null = null, scoreTriggerID?: UUID | null) => {
	try {
		// Get the task details and case ID for the integration task
		const baseQuery = `SELECT
				dbit.id as task_id,
				dbit.business_score_trigger_id,
				dbit.connection_id,
				dbit.task_status,
				dc.business_id,
				dc.platform_id,
				ct.code as task_code,
				ct.label as task_label,
				cc.code as platform_category_code,
				cip.code as platform_code,
				bst.trigger_type,
				bst.version as trigger_version,
				bst.customer_id,
				bst.applicant_id
				FROM integrations.data_business_integrations_tasks dbit
				JOIN integrations.data_connections dc ON dc.id = dbit.connection_id
				JOIN integrations.rel_tasks_integrations rti ON rti.id = dbit.integration_task_id
				JOIN integrations.core_tasks ct ON ct.id = rti.task_category_id
				JOIN integrations.core_integrations_platforms cip ON cip.id = rti.platform_id
				JOIN integrations.core_categories cc ON cc.id = cip.category_id
				LEFT JOIN integrations.business_score_triggers bst ON bst.id = dbit.business_score_trigger_id
				WHERE dbit.id = $1 AND dbit.task_status IN ('SUCCESS','FAILED')`;

		let getCaseQuery = `SELECT data_cases.id AS case_id FROM data_cases
				LEFT JOIN integrations.data_business_integrations_tasks dbit ON dbit.business_score_trigger_id = data_cases.score_trigger_id
				WHERE dbit.id = $1 ORDER BY data_cases.created_at ASC LIMIT 1`;
		if (triggerType === SCORE_TRIGGER.APPLICATION_EDIT) {
			getCaseQuery = `SELECT data_cases.id AS case_id FROM data_cases
				LEFT JOIN integrations.business_score_triggers ON integrations.business_score_triggers.id = data_cases.score_trigger_id
				LEFT JOIN integrations.data_business_integrations_tasks dbit ON dbit.business_score_trigger_id = data_cases.score_trigger_id
				WHERE dbit.id = $1 AND integrations.business_score_triggers.trigger_type = 'APPLICATION_EDIT' ORDER BY data_cases.created_at ASC`;
		}
		const queries = [baseQuery, getCaseQuery];
		const values = [[integrationTaskID], [integrationTaskID]];
		const [businessIntegrationTasksResult, getCaseResult] = await sqlTransaction(queries, values);
		const result = businessIntegrationTasksResult?.rows[0];

		// Check if the task is present in the result
		if (!result) {
			logger.error(`No SUCCESS AND FAILED integration task found for taskId=${integrationTaskID}`);
			return;
		}

		// Check if score trigger ID is present to generate score
		if (!result.business_score_trigger_id) {
			logger.error(`No business score trigger found for taskId=${integrationTaskID}`);
			return;
		}

		// getting the metadata for the task using scoring service
		const scoringData = await getScoringData(result.business_id);
		logger.info(`Scoring data for business ${result.business_id}: ${JSON.stringify(scoringData)}`);

		// kafka message payload
		const message = {
			score_trigger_id: scoreTriggerID ? scoreTriggerID : result.business_score_trigger_id,
			task_status: result.task_status,
			business_id: result.business_id,
			metadata: scoringData,
			task_code: result.task_code,
			platform_category_code: result.platform_category_code,
			platform_code: result.platform_code,
			trigger_type: triggerType ? triggerType : result.trigger_type,
			trigger_version: result.trigger_version,
			customer_id: result.customer_id,
			case_id: getCaseResult.rows[0]?.case_id,
			cases_to_link: null
		};
		// If there are more than 1 cases linked to same score trigger ID then we would need to send those ahead as well
		if (getCaseResult?.rows?.length > 1) {
			(message as any).cases_to_link = getCaseResult.rows.slice(1);
		}
		// updating the business details in s3 bucket
		try {
			await updateBusinessDetailS3(message.business_id);
		} catch (error: any) {
			logger.error(`Unable to updateBusiness details s3, businessId: ${message.business_id}, errorMessage: ${error.message}`);
		}

		// calculating average revenue for the business and storing into s3 bucket
		try {
			await shimIntegrationData(message.business_id);
		} catch (err: any) {
			logger.error(`Exception shimming integration data for business_id ${message.business_id}, errorMessage: ${err.message}`);
		}

	// sending the event to kafka topic of integration data for score
	const payload = {
		topic: kafkaTopics.SCORES,
		messages: [{ 
			key: message.business_id, 
			value: { 
				event: kafkaEvents.INTEGRATION_DATA_FOR_SCORE,
				...message 
			},
			headers: { event: kafkaEvents.INTEGRATION_DATA_FOR_SCORE }
		}]
	};

	await producer.send(payload);
	} catch (error) {
		logger.error(`Error in prepareIntegrationDataForScore: ${error as any}`);
		throw error;
	}
};
/**
 * Select only the facts needed for scoring from allFacts
 * This follows the same pattern used in AI enrichment modules
 * @param factNames - Array of fact names to select
 * @param allFacts - Array of all available facts
 * @returns Filtered array of facts
 */
function selectFacts(factNames: FactName[], allFacts: Fact[]): Fact[] {
	// Return the facts that have factName
	return allFacts.reduce((acc, fact) => {
		if (factNames.includes(fact.name)) {
			acc.push(fact);
		}
		return acc;
	}, [] as Fact[]);
}

/**
 * Get complete scoring data for a business by combining existing facts with scoring-specific facts
 * @param businessId - The business ID to get scoring data for
 * @returns Promise<ScoringData> - Complete scoring data structure
 */
async function getScoringData(businessId: string): Promise<ScoringData> {
	try {
		// Dynamic import to break circular dependency
		const { allFacts } = await import("#lib/facts");
		
		// Define which facts we need for scoring (both existing and new)
		const requiredFactNames: FactName[] = [
			// Existing facts from other modules
			"state",
			"city",
			"naics_code",
			"num_employees",
			"formation_date",
			"corporation",
			"review_count",
			"review_rating",
			"num_bankruptcies",
			"num_judgements",
			"num_liens",
			"bankruptcies",
			"judgements",
			"liens",

			// New scoring facts
			"is_total_revenue",
			"is_net_income",
			"primsic",
			"bus_struct",
			"indicator_government",
			"indicator_federal_government",
			"indicator_education",
			"is_cost_of_goods_sold",
			"is_operating_expense",
			"is_gross_profit",
			"bs_accounts_receivable",
			"bs_accounts_payable",
			"bs_total_assets",
			"bs_total_debt",
			"bs_total_equity",
			"bs_total_liabilities_and_equity",
			"bs_total_liabilities",
			"cf_capex",
			"cf_cash_at_end_of_period",
			"cf_operating_cash_flow",
			"flag_equity_negative",
			"flag_total_liabilities_over_assets",
			"flag_net_income_negative",
			"ratio_accounts_payable_cash",
			"ratio_total_liabilities_cash",
			"ratio_total_liabilities_assets",
			"ratio_return_on_equity",
			"ratio_return_on_assets",
			"ratio_net_income_ratio",
			"ratio_income_quality_ratio",
			"ratio_gross_margin",
			"ratio_equity_multiplier",
			"ratio_debt_to_equity",
			"ratio_operating_margin",
			"ratio_cash_ratio",
			"ratio_accounts_receivable_cash"
		];

		// Filter only the facts we need for scoring
		const scoringFacts = selectFacts(requiredFactNames, allFacts);

		// Create FactEngine with only the facts we need
		const engine = new FactEngine(scoringFacts, { business: businessId });

		// Apply resolution rules to get the best data from all sources
		await engine.applyRules(factWithHighestConfidence);

		// Get all resolved facts
		const results = await engine.getResults();
		const naicsValue = results.naics_code?.value;
		// Return the complete scoring data object that combines existing and new facts
		return {
			// Geographic and Business Structure - from existing facts
			state: results.state?.value,
			city: results.city?.value,
			bus_struct: results.bus_struct?.value,
			formation_date: results.formation_date?.value,

			// Industry and Employee Data - from existing facts
			naics_code: naicsValue ? naicsValue.toString() : naicsValue,
			primsic: results.primsic?.value,
			count_employees: results.num_employees?.value,

			// Financial Data - from existing facts
			revenue: results.is_total_revenue?.value,
			is_net_income: results.is_net_income?.value,

			// Public/Entity Indicators - from existing facts
			indicator_public: results.corporation?.value === "Public" ? 1 : 0,

			// Review Data - from existing facts
			count_reviews: results.review_count?.value,
			score_reviews: results.review_rating?.value,

			// BJL Ages and Counts
			age_bankruptcy: results.bankruptcies?.value?.most_recent? dayjs().diff(dayjs(results.bankruptcies.value.most_recent), "month") : undefined,
			age_judgment: results.judgements?.value?.most_recent? dayjs().diff(dayjs(results.judgements.value.most_recent), "month") : undefined,
			age_lien: results.liens?.value?.most_recent? dayjs().diff(dayjs(results.liens.value.most_recent), "month") : undefined,
			age_business: results.formation_date?.value ? dayjs().diff(dayjs(results.formation_date.value), "year") : undefined,
			count_bankruptcy: results.num_bankruptcies?.value,
			count_judgment: results.num_judgements?.value,
			count_lien: results.num_liens?.value,

			// Entity Indicators - from scoring facts
			indicator_government: results.indicator_government?.value,
			indicator_federal_government: results.indicator_federal_government?.value,
			indicator_education: results.indicator_education?.value,

			// Financial Data (unique to scoring)
			is_cost_of_goods_sold: results.is_cost_of_goods_sold?.value,
			is_operating_expense: results.is_operating_expense?.value,
			is_gross_profit: results.is_gross_profit?.value,

			// Balance Sheet (unique to scoring)
			bs_accounts_receivable: results.bs_accounts_receivable?.value,
			bs_accounts_payable: results.bs_accounts_payable?.value,
			bs_total_assets: results.bs_total_assets?.value,
			bs_total_debt: results.bs_total_debt?.value,
			bs_total_equity: results.bs_total_equity?.value,
			bs_total_liabilities_and_equity: results.bs_total_liabilities_and_equity?.value,
			bs_total_liabilities: results.bs_total_liabilities?.value,

			// Cash Flow (unique to scoring)
			cf_capex: results.cf_capex?.value,
			cf_cash_at_end_of_period: results.cf_cash_at_end_of_period?.value,
			cf_operating_cash_flow: results.cf_operating_cash_flow?.value,

			// Financial Flags (calculated)
			flag_equity_negative: results.flag_equity_negative?.value,
			flag_total_liabilities_over_assets: results.flag_total_liabilities_over_assets?.value,
			flag_net_income_negative: results.flag_net_income_negative?.value,

			// Financial Ratios (calculated)
			ratio_accounts_payable_cash: results.ratio_accounts_payable_cash?.value,
			ratio_total_liabilities_cash: results.ratio_total_liabilities_cash?.value,
			ratio_total_liabilities_assets: results.ratio_total_liabilities_assets?.value,
			ratio_return_on_equity: results.ratio_return_on_equity?.value,
			ratio_return_on_assets: results.ratio_return_on_assets?.value,
			ratio_net_income_ratio: results.ratio_net_income_ratio?.value,
			ratio_income_quality_ratio: results.ratio_income_quality_ratio?.value,
			ratio_gross_margin: results.ratio_gross_margin?.value,
			ratio_equity_multiplier: results.ratio_equity_multiplier?.value,
			ratio_debt_to_equity: results.ratio_debt_to_equity?.value,
			ratio_operating_margin: results.ratio_operating_margin?.value,
			ratio_cash_ratio: results.ratio_cash_ratio?.value,
			ratio_accounts_receivable_cash: results.ratio_accounts_receivable_cash?.value
		};
	} catch (error) {
		console.error("Error getting scoring data:", error);
		throw error;
	}
}
