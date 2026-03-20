import Queue, {
	type CronRepeatOptions,
	type EveryRepeatOptions,
	type Job,
	type JobId,
	type JobOptions,
	type Queue as IQueue
} from "bull";
import { logger } from "./logger";
import { createRedisConnection } from "./redis/redis";

const generateQueueOptions = (): Partial<Queue.QueueOptions> => {
	return createRedisConnection({ prefix: "{bull}" });
};

export class BullQueue {
	queue: IQueue;

	constructor(queueName: string) {
		this.queue = new Queue(queueName, generateQueueOptions());
		this.queue.on("error", (error: Error) => {
			logger.error({ err: error, queue: queueName, event: "error" }, "🐂⚠️ Bull queue error");
		});
	}

	async getJobByID(jobID: JobId): Promise<Job | null> {
		const job = await this.queue.getJob(jobID);

		return job;
	}

	async removeJobByID(jobID: JobId) {
		const job = await this.getJobByID(jobID);

		if (job) {
			await job.remove();
			logger.info(`Removed job with ID: ${jobID}`);
		}
	}

	async addJob<T = Record<string, any> | string | number>(event: string, data: T, opts?: JobOptions) {
		try {
			const job = await this.queue.add(event, data, { removeOnComplete: true, removeOnFail: true, ...opts });
			logger.info(`Added job with ID: ${job.id} for ${event}`);
			return job;
		} catch (error) {
			logger.error(error);
			throw error;
		}
	}

	async addMultipleJobs(jobs: Job[]) {
		const result = await this.queue.addBulk(jobs);
		return result;
	}

	async reprocessFailedJobs(job: Job) {
		await this.queue.add(job.name, job.data, { delay: job.opts.delay });
	}

	async removeRepeatable(
		name: string,
		repeat: (CronRepeatOptions | EveryRepeatOptions) & {
			jobId?: JobId | undefined;
		}
	) {
		await this.queue.removeRepeatable(name, repeat);
	}

	async removeRepeatableByKey(key: string) {
		await this.queue.removeRepeatableByKey(key);
		logger.info(`Removed repeatable job with key: ${key}`);
	}

	async pause() {
		await this.queue.pause();
		logger.info(`🐂⚠️ Bull queue paused: ${this.queue.name}`);
	}

	async resume() {
		await this.queue.resume(true);
		logger.info(`🐂⚠️ Bull queue resumed: ${this.queue.name}`);
	}
}
