import { Job } from "#api/v1/modules/jobs/models";
import { kafkaEvents } from "#constants";
import { logger } from "#helpers/logger";
import { processEventByBucket } from "#lib/fileHandler";
import { validateMessage } from "#middlewares/validation.middleware";
import type { UUID } from "crypto";
import type { KafkaMessage } from "kafkajs";
import type { IEventsHandler } from ".";
import { schema } from "./schema";
import { State } from "#api/v1/modules/jobs/types";

export class IntegrationEventsHandler implements IEventsHandler {
	async handleEvent(message: KafkaMessage) {
		try {
			if (!message.value) {
				logger.error(`Invalid message received: ${JSON.stringify(message)}`);
				return;
			}
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();

			switch (event) {
				case kafkaEvents.S3_FILE:
					validateMessage(schema.s3File, payload);
					await processEventByBucket(payload);
					break;

				case kafkaEvents.JOB_COMPLETE:
					await updateJob(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			logger.error({ error }, "Unhandled exception processing integration event");
			throw error;
		}
	}
}

const updateJob = async (payload: { jobId: UUID; status: string; error?: string }) => {
	try {
		const job = await Job.getById(payload.jobId);
		const state = payload.status === "success" ? State.SUCCESS : State.ERROR;
		await job.setState(state, true, { updateEvent: { ...payload } });
	} catch (ex) {
		logger.error(`Could not find job with id ${payload.jobId}`);
	}
};

export const integrationEventsHandler = new IntegrationEventsHandler();
