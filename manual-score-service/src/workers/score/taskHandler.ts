import { FEATURE_FLAGS, kafkaEvents, kafkaTopics, QUEUE_EVENTS, QUEUES } from "#constants";
import { BullQueue, getFlagValue, logger, producer } from "#helpers";
import type { Job } from "bull";
import type { IntegrationData } from "./types";
import { integrationDataHandlerForScore } from "./integrationDataHandler";

export const taskQueue = new BullQueue(QUEUES.INTEGRATION_DATA);

export const initTaskWorker = () => {
	taskQueue.queue
		.process(QUEUE_EVENTS.UPDATE_INTEGRATION_DATA_FOR_SCORE, async (job: Job) => {
			try {
				await integrationDataHandlerForScore.saveIntegrationData(job.data as IntegrationData);
				const isScoreReadyToGenerate = await integrationDataHandlerForScore.checkScoreDataStatus(job.data.score_trigger_id, job.data.business_id, job.data.trigger_type, job.data?.case_id, job.data?.customer_id);
				if (isScoreReadyToGenerate.status) {
					const scorePayload = {
						business_id: job.data.business_id,
						score_trigger_id: job.data.score_trigger_id,
						score_input: isScoreReadyToGenerate.scoreInput
					};
					await producer.send({
						topic: kafkaTopics.AI_SCORES,
						messages: [
							{
								key: job.data.business_id,
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
									key: job.data.business_id,
									value: {
										event: kafkaEvents.GENERATE_AI_SCORE,
										...scorePayload
									}
								}
							]
						});
					}
				}
			} catch (error) {
				logger.error({ error }, `🚀 ~ .process ~ error`);
				throw error;
			}
		})
		.catch(error => {
			throw error;
		});
};
