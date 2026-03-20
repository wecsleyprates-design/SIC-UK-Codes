import { type ClusterNode } from "ioredis";
import { envConfig } from "#configs";
import Queue, { type CronRepeatOptions, type EveryRepeatOptions, type Job, type JobId, type JobOptions, type Queue as IQueue } from "bull";
import { logger } from "./logger";
import { createClusterClient, redisConfig } from "./redis";

const clusterNode: ClusterNode & { TLS: boolean; password: string } = {
	// url: envConfig.REDIS_URL,
	host: envConfig.REDIS_HOST,
	port: !isNaN(Number(envConfig.REDIS_PORT)) ? Number(envConfig.REDIS_PORT) : 6379,
	// username: envConfig.REDIS_USERNAME,
	password: envConfig.REDIS_PASSWORD ?? "",
	TLS: !envConfig.REDIS_DISABLE_TLS
	// rejectUnauthorized: envConfig.REDIS_DISABLE_TLS_REJECT_UNAUTHORIZED
};

const clusterOptions = {
	enableReadyCheck: false
};

/* When Redis is running locally, pass in ioredis options, otherwise the createClient function is used to create a new cluster client for each job  */
const generateQueueOptions = (): Partial<Queue.QueueOptions> => {
	const config: Partial<Queue.QueueOptions> = {
		prefix: "{bull}"
	};

	if (["localhost", "127.0.0.1"].includes(envConfig.REDIS_HOST ?? "")) {
		config.redis = redisConfig as any;
	} else if (["redis"].includes(envConfig.REDIS_HOST ?? "")) {
		config.redis = {
			host: envConfig.REDIS_HOST,
			port: parseInt(envConfig.REDIS_PORT ?? "6379")
		};
	} else {
		config.createClient = () => {
			const client = createClusterClient(clusterNode, clusterOptions);
			return client;
		};
	}
	return config;
};

export class BullQueue {
	queue: IQueue;

	constructor(queueName: string) {
		this.queue = new Queue(queueName, generateQueueOptions());
	}

	async getJobByID(jobID: JobId): Promise<Job | null> {
		const job = await this.queue.getJob(jobID);

		return job;
	}

	async removeJobByID(jobID: JobId) {
		const job = await this.getJobByID(jobID);

		if (job) {
			await job.remove();
		}
	}

	async addJob(event: string, data: Record<string, any> | string | number, opts?: JobOptions) {
		try {
			const job = await this.queue.add(event, data, { removeOnComplete: true, removeOnFail: true, ...opts });
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
}
