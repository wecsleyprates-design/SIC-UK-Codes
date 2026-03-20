import { kafkaEvents, kafkaTopics, FEATURE_FLAGS } from "#constants/index";
import { logger, sqlQuery, producer, redis, getFlagValue } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { integrationDataHandlerForScore } from "#workers/score/integrationDataHandler";
import { schema } from "./schema";
class BusinessEventsHandler {
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.PURGE_BUSINESS:
					validateMessage(schema.purgeBusiness, payload);
					await this.purgeBusiness(payload);
					break;

				case kafkaEvents.CASE_STATUS_UPDATED:
					validateMessage(schema.caseStatusUpdated, payload);
					await this.caseStatusUpdated(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	async purgeBusiness(payload) {
		logger.info(`MANUAL-SCORE: Purging business with id ${payload.business_id}`);

		const deleteBusinessScoreTriggerQuery = `DELETE FROM business_score_triggers WHERE business_id = $1`;
		await sqlQuery({ sql: deleteBusinessScoreTriggerQuery, values: [payload.business_id] });

		logger.info(`MANUAL-SCORE: Purging of business with id ${payload.business_id} successful`);
	}

	async caseStatusUpdated(payload) {
		logger.info(`caseStatusUpdated payload ${JSON.stringify(payload)}`);
		const scoreGenerateRedisKey = `{business}:${payload.business_id}:{case}:${payload.case_id}:score_generate`;
		const existing = await redis.jsonget(scoreGenerateRedisKey);
		if (!existing) {
			await redis.jsonset(scoreGenerateRedisKey, ".", {
				case_status: { status: payload.case_status }
			});
		} else {
			await redis.jsonset(scoreGenerateRedisKey, ".case_status", { status: payload.case_status });
		}

		// recheck for score generation
		const getCaseQuery = `SELECT score_trigger_id FROM data_cases WHERE id = $1`;
		const getCaseResult = await sqlQuery({ sql: getCaseQuery, values: [payload.case_id] });
		if (!getCaseResult.length) {
			return;
		}
		const getBusinessScoreQuery = `SELECT * FROM business_score_triggers WHERE business_score_triggers.id = $1`;
		const getBusinessScoreResult = await sqlQuery({ sql: getBusinessScoreQuery, values: [getCaseResult?.[0]?.score_trigger_id] });
		if (!getBusinessScoreResult.length) {
			return;
		}
		const isScoreReadyToGenerate = await integrationDataHandlerForScore.checkScoreDataStatus(getBusinessScoreResult[0].id, getBusinessScoreResult[0].business_id, getBusinessScoreResult[0].trigger_type, payload.case_id, getBusinessScoreResult[0]?.customer_id);
		if (isScoreReadyToGenerate.status) {
			const scorePayload = {
				business_id: getBusinessScoreResult[0].business_id,
				score_trigger_id: getBusinessScoreResult[0].id,
				score_input: isScoreReadyToGenerate.scoreInput
			};
			await producer.send({
				topic: kafkaTopics.AI_SCORES,
				messages: [
					{
						key: getBusinessScoreResult?.[0]?.business_id,
						value: {
							event: kafkaEvents.GENERATE_AI_SCORE,
							...scorePayload
						}
					}
				]
			});
			const isPlaygroundEnabled = await getFlagValue(FEATURE_FLAGS.BEST_56_PLAYGROUND_ENABLED);
			if (isPlaygroundEnabled) {
				await producer.send({
					topic: kafkaTopics.PLAYGROUND_AI_SCORES,
					messages: [
						{
							key: getBusinessScoreResult?.[0]?.business_id,
							value: {
								event: kafkaEvents.GENERATE_AI_SCORE,
								...scorePayload
							}
						}
					]
				});
			}
		}
	}
}

export const businessEventsHandler = new BusinessEventsHandler();
