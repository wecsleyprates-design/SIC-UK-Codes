import { kafkaEvents, kafkaTopics, QUEUES, QUEUE_EVENTS } from "#constants/index";
import { logger, producer, sqlQuery, sqlTransaction, BullQueue } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { schema } from "./schema";
import { calculateScore, updateToLatestScoreConfig } from "../../../../workers/score/index";
import { randomUUID } from "crypto";
import { reduceScoreObject } from "#common/common";

class ScoreEventsHandler {
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				// case kafkaEvents.RESCORE_CASE_EVENT:
				// 	validateMessage(schema.rescoreCase, payload);
				// 	await this.rescoreCase(payload);
				// 	break;
				case kafkaEvents.INTEGRATION_DATA_FOR_SCORE:
					validateMessage(schema.integrationDataForScore, payload);
					await this.updateIntegrationDataForScore(payload);
					break;

				case kafkaEvents.LINK_TRIGGERS_AND_EMIT_SCORE:
					validateMessage(schema.linkScoreTriggersAndEmitScore, payload);
					await this.linkScoreTriggersAndEmitScore(payload);
					break;
				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	/**
	 * This function is used to create queue to update the integration data for score generation
	 * @param {Object} payload - The payload object containing the integration data
	 */
	async updateIntegrationDataForScore(payload) {
		try {
			logger.info(`Update integration data for score trigger id: ${payload?.score_trigger_id}`);
			const queue = new BullQueue(QUEUES.INTEGRATION_DATA);
			const jobId = `${payload?.score_trigger_id}::${randomUUID()}`;
			await queue.addJob(QUEUE_EVENTS.UPDATE_INTEGRATION_DATA_FOR_SCORE, payload, { jobId, removeOnComplete: true, removeOnFail: false });
		} catch (error) {
			throw error;
		}
	}

	// Keeping it here for reference :)
	async oldIntegrationDataReady(body) {
		try {
			const scoreTrigger = {
				id: body.score_trigger_id,
				business_id: body.business_id,
				customer_id: body.customer_id || null,
				applicant_id: body.applicant_id
			};

			if (!body.existing_score_trigger_id) {
				const insertScoreTrigger = `INSERT INTO business_score_triggers SELECT * FROM json_populate_record(null::business_score_triggers, $1)`;
				await sqlQuery({ sql: insertScoreTrigger, values: [JSON.stringify(scoreTrigger)] });
			}

			if (body.case_id) {
				const insertCase = `INSERT INTO data_cases (id, score_trigger_id) VALUES ($1, $2)`;
				await sqlQuery({ sql: insertCase, values: [body.case_id, body.score_trigger_id] });
			}

			const score = await calculateScore(body.score_trigger_id, scoreTrigger.customer_id, scoreTrigger.business_id);

			const message = {
				business_id: body.business_id,
				customer_id: body.customer_id,
				score_trigger_id: score.score_trigger_id,
				score_850: score.weighted_score_850,
				score_100: score.weighted_score_100,
				risk_level: score.risk_level,
				decision: score.score_decision,
				created_at: new Date().toISOString()
			};

			const payload = {
				topic: kafkaTopics.SCORES,
				messages: [
					{
						key: body.business_id,
						value: {
							event: kafkaEvents.SCORE_CALCULATED,
							...message
						}
					}
				]
			};

			producer.send(payload);

			return score;
		} catch (error) {
			throw error;
		}
	}

	/* Refresh an existing business score for a given business and customer */
	async refreshBusinessScore(body) {
		const { business_id: businessID, customer_id: customerID, trigger_type: refreshTriggerType, score_trigger_type: scoreTriggerType = "ONBOARDING_INVITE" } = body;
		// Default to looking up the most recent ONBOARDING_INVITE
		const selectTriggerValues = [businessID, scoreTriggerType];

		logger.info(`Refresh business score for business_id: ${businessID} and customer_id: ${customerID} and trigger ${refreshTriggerType} for ${scoreTriggerType}`);
		if (refreshTriggerType !== "MANUAL_REFRESH") {
			logger.warn(`Logic has only been implemented for 'MANUAL_REFRESH', exiting...`);
			return;
		}
		let selectTriggerQuery = `SELECT bs.id, bs.score_trigger_id
			FROM business_score_triggers bst
			JOIN business_scores bs ON bs.score_trigger_id = bst.id
			WHERE
				bst.business_id = $1
				AND bst.trigger_type = $2
				AND `;
		// When a customer is defined we want to get null customer_id OR the specified customer but we prefer the specified customer
		if (customerID) {
			selectTriggerQuery += " (customer_id is null or customer_id = $3) ";
			selectTriggerValues.push(customerID);
		} else {
			// when no customer defined only get a trigger that is not associated to a customer
			selectTriggerQuery += "customer_id is null ";
		}
		selectTriggerQuery += ` ORDER BY bst.customer_id ASC, bs.created_at DESC LIMIT 1`;

		logger.info(`Refreshing business score for business_id: ${businessID} and customer_id: ${customerID}`);
		// Get most recent score trigger record --- select null customer id if customer id is not provided
		const scoreIdResult = await sqlQuery({
			sql: selectTriggerQuery,
			values: selectTriggerValues
		});
		if (Array.isArray(scoreIdResult) && scoreIdResult[0]?.id) {
			const { id: scoreId, score_trigger_id: scoreTriggerId } = scoreIdResult[0];
			// Update score to most recent config
			await updateToLatestScoreConfig(scoreId, customerID);
			const message = {
				business_id: businessID,
				score_trigger_id: scoreTriggerId
			};
			// Send message to AI score to regenerate score
			const payload = {
				topic: kafkaTopics.AI_SCORES,
				messages: [
					{
						key: businessID,
						value: {
							event: kafkaEvents.GENERATE_AI_SCORE,
							...message
						}
					}
				]
			};
			logger.debug(`Sending message to topic ${payload.topic} with key ${payload.messages[0].key} & message ${message}`);
			await producer.send(payload);
		} else {
			logger.warn(`No score trigger found for business_id: ${businessID} and customer_id: ${customerID} and trigger ${refreshTriggerType}`);
		}
	}

	async linkScoreTriggersAndEmitScore(body) {
		const valuesString = body.customer_case_ids.map(caseID => `('${caseID}', '${body.score_trigger_id}')`).join(", ");
		const insertCases = `INSERT INTO data_cases (id, score_trigger_id) VALUES ${valuesString} ON CONFLICT DO NOTHING`;

		const getScoreTriggerQuery = `SELECT * FROM business_score_triggers WHERE id = $1`;
		const [scoreTriggerResult, _] = await sqlTransaction([getScoreTriggerQuery, insertCases], [[body.score_trigger_id], []]);

		const getScoreQuery = `WITH score AS (SELECT business_scores.id, business_scores.created_at, data_cases.id as case_id, business_scores.status, business_scores.weighted_score_100, business_scores.weighted_score_850, score_config, risk_level, score_decision, base_score FROM business_scores
		LEFT JOIN score_config_history ON business_scores.score_weightage_config = score_config_history.id
		INNER JOIN data_cases on data_cases.score_trigger_id = business_scores .score_trigger_id
		LEFT JOIN business_score_factors ON business_score_factors.score_id = business_scores.id
		WHERE data_cases.id = $1 AND business_scores.status = 'SUCCESS' ORDER BY business_scores.created_at DESC LIMIT 1),
		factors AS (SELECT json_agg(business_score_factors) factors FROM score
		LEFT JOIN business_score_factors ON business_score_factors.score_id = score.id
		GROUP BY score.id)
		SELECT score.*, factors FROM score, factors`;

		const scoreResult = await sqlQuery({ sql: getScoreQuery, values: [body.standalone_case_id] });
		const score = reduceScoreObject(scoreResult);

		const payload = {
			topic: kafkaTopics.SCORES,
			messages: []
		};

		if (scoreResult.length) {
			body.customer_case_ids.forEach(caseID => {
				payload.messages.push({
					key: body.business_id,
					value: {
						event: kafkaEvents.SCORE_CALCULATED,
						score_trigger_id: body.score_trigger_id,
						business_id: body.business_id,
						customer_id: scoreTriggerResult.rows[0].customer_id,
						trigger_type: scoreTriggerResult.rows[0].trigger_type,
						score_850: score.weighted_score_850,
						score_100: score.weighted_score_100,
						risk_level: score.risk_level,
						decision: score.score_decision,
						created_at: score.created_at,
						case_id: caseID
					}
				});
			});
		}
	}
}

export const scoreEventsHandler = new ScoreEventsHandler();
