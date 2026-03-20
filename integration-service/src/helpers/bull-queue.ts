import queueManager from "#api/v1/modules/queue/queueManager";
import { envConfig } from "#configs/index";
import { redis } from "#helpers/redis";
import type { Response, TDateISO } from "#types";
import { convertCsvToJson } from "#utils/csv";
import { SerializableMap } from "#utils/serialization";
import type Bull from "bull";
import Queue, {
	type CronRepeatOptions,
	type EveryRepeatOptions,
	type Queue as IQueue,
	type Job,
	type JobId,
	type JobOptions
} from "bull";
import { randomUUID, type UUID } from "crypto";
import type { Request } from "express";
import { StatusCodes } from "http-status-codes";
import { type ClusterNode } from "ioredis";
import { logger } from "./logger";
import { redisConfig } from "./redis";
import { isUUID } from "#utils";

type BullQueueJobStatus<T = any> = {
	provided: Job["data"];
	message: T;
};
export type BullQueueRequest = {
	jobIds: Array<JobId>;
	processed: number;
	ok: Record<JobId, BullQueueJobStatus> | {};
	error: Record<JobId, BullQueueJobStatus> | {};
};

export type BullQueueStalledStats = {
	queueName: string;
	count: number;
	lastStalledAt: TDateISO;
	lastStalledJobId: JobId;
};

/***
	Represents a job that is being managed by a Sandboxed Processor in Bullqueue
	This has a few different properties than a normal job as its managed via cross process communication and thus behaves a bit differently
*/
export type SandboxedJob<T> = { delay: number } & Pick<
	Job<T>,
	| "data"
	| "id"
	| "name"
	| "opts"
	| "progress"
	| "timestamp"
	| "attemptsMade"
	| "failedReason"
	| "stacktrace"
	| "returnvalue"
	| "finishedOn"
	| "update"
	| "log"
	| "discard"
	| "processedOn"
>;

export const clusterNode: ClusterNode & { TLS: boolean; password: string } = {
	host: envConfig.REDIS_HOST,
	port: Number(envConfig.REDIS_PORT) || 6379,
	password: envConfig.REDIS_PASSWORD ?? "",
	TLS: !Boolean(envConfig.REDIS_DISABLE_TLS)
};

export const clusterOptions = {
	enableReadyCheck: false,
	slotsRefreshTimeout: 2000
};

/**
 *
 * Generates queue options by merging user-provided options with default configurations.
 * - If Redis is running locally, it uses the `redisConfig` object.
 * - If the Redis host is explicitly set to "redis", it uses basic host and port settings.
 * - Otherwise, it creates a new Redis cluster client using the `createClusterClient` function.
 */
const generateQueueOptions = (
	options: Partial<Queue.QueueOptions> = {},
	queueName?: string
): Partial<Queue.QueueOptions> => {
	const config = {
		prefix: `{bull}`,
		settings: { maxStalledCount: 10, stalledInterval: 120_000, lockDuration: 240_000 },
		...options
	} as Partial<Queue.QueueOptions>;

	if (["localhost", "127.0.0.1"].includes(envConfig.REDIS_HOST ?? "")) {
		config.redis = redisConfig as any;
	} else if (["redis"].includes(envConfig.REDIS_HOST ?? "")) {
		config.redis = {
			host: envConfig.REDIS_HOST,
			port: parseInt(envConfig.REDIS_PORT ?? "6379")
		};
	} else {
		logger.info(`🐂 Generating queue options for queue=${queueName}`);
		config.createClient = type => queueManager.getClient(queueName ?? "bq", type);
	}
	return config;
};

class BullQueue {
	queue: IQueue;

	constructor(queueName: string, options: Partial<Queue.QueueOptions> = {}) {
		this.queue = new Queue(queueName, generateQueueOptions(options, queueName));
		this.queue.setMaxListeners(20);

		this.queue.on("error", error => {
			logger.error({ error, queueName }, `🐂⚠️ queue=${queueName} | Queue error ${error.message}`);
		});

		this.queue.on("stalled", async job => {
			// A job stalled. This typically happens when a worker somehow messes up the node event loop or something
			// If this happens more than once it is bad and we need to figure out why it is happening
			const maxStalls: number = this.queue["settings"]?.maxStalledCount ?? 1;
			const redisKey = `{bullqueue-stats}:${queueName}:stalled:${job.id}`;
			const stalled: BullQueueStalledStats | null = await redis.get<BullQueueStalledStats>(redisKey);

			const newStalledStats: BullQueueStalledStats = {
				queueName,
				count: (stalled?.count ?? 0) + 1,
				lastStalledAt: new Date().toISOString() as TDateISO,
				lastStalledJobId: job.id
			};

			await redis.setex<BullQueueStalledStats>(redisKey, newStalledStats, 60 * 60 * 24 * 7);

			const { logLevel, emoji } =
				newStalledStats.count >= maxStalls - 1 ? { logLevel: "error", emoji: "❌" } : { logLevel: "warn", emoji: "⚠️" };

			logger[logLevel](
				{ job, queueName },
				`🐂${emoji} queue=${queueName} | Job stalled: ${job.id} | Stalled ${newStalledStats.count} / ${maxStalls}`
			);
			await redis.incr(`{bullqueue-stats}:${queueName}:stalled`);
		});
		this.queue.on("lock-extension-failed", async (job, error) => {
			// A job failed to extend lock. This will be useful to debug redis
			// connection issues and jobs getting restarted because workers
			// are not able to extend locks.
			// Likely related to the "stalled" event
			logger.error(
				{
					error,
					job,
					queueName
				},
				`🐂⚠️ queue=${queueName} | Lock extension failed: ${job.id}`
			);
			await redis.incr(`{bullqueue-stats}:${queueName}:lock-extension-failed`);
		});
		this.queue.on("completed", async (job, result) => {
			logger.info({ job, result }, `🐂✅ queue=${queueName} | Job completed: ${job.id}`);
			await redis.incr(`{bullqueue-stats}:${queueName}:completed`);
		});
		this.queue.on("failed", async (job, error) => {
			if (error?.name === "DeferredTask") {
				// Not a *real* failure so don't bother logging it
				return;
			}
			logger.error({ error, job }, `🐂⚠️ queue=${queueName} | Job failed: ${job.id}`);
			await redis.incr(`{bullqueue-stats}:${queueName}:failed`);
		});
		this.queue.on("closed", () => {
			logger.error(`🐂⚠️ queue=${this.queue.name} | Queue closed`);
			queueManager.deleteQueue(this.queue.name);
		});

		queueManager.registerQueue(this.queue);
	}

	async getJobByID(jobID: string): Promise<Job | null> {
		return this.queue.getJob(jobID);
	}

	async removeJobByID(jobID: string) {
		const job = await this.getJobByID(jobID);

		if (job) {
			await job.remove();
		}
	}

	async addJob<T = Record<string, any> | string | number>(
		event: string,
		data: T,
		opts: JobOptions = {
			removeOnComplete: { count: 200, age: 60 * 60 * 24 },
			removeOnFail: { count: 100, age: 60 * 60 * 24 }
		}
	) {
		try {
			const job = await this.queue.add(event, data, opts);
			return job as Bull.Job<T>;
		} catch (error) {
			logger.error(`queue=${this.queue?.name} | bullqueue error: ` + error);
			throw error;
		}
	}

	addMultipleJobs(jobs: Job[]) {
		return this.queue.addBulk(jobs);
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
		logger.info(`Paused queue: ${this.queue.name}`);
	}

	async resume() {
		await this.queue.resume(true);
		logger.info(`BULL QUEUE: Resumed queue: ${this.queue.name}`);
	}

	/**
	 * @description Pauses the queue for a specified amount of time and then resumes it
	 * @param delay in seconds
	 */
	async pauseQueue(delay: number) {
		logger.info(`BULL QUEUE: ********PAUSING QUEUE********`);
		await this.queue.pause(false, false);
		logger.info(`BULL QUEUE: ********QUEUE PAUSED********`);

		// Wait for the specified amount of time
		setTimeout(async () => {
			logger.info(`BULL QUEUE:Resuming the queue...`);
			await this.queue.resume(); // Resume the queue
			logger.info("BULL QUEUE: Queue resumed");
		}, delay * 1000);
	}

	/**
	 * Infer the delay of a job based on the backoff type and attempts made
	 * @param job
	 * @returns delay in ms
	 */
	getDelay(job: Job | SandboxedJob<any>): number {
		const defaultDelay = 5000;
		const backoff = job.opts.backoff;
		const attemptsMade = job.attemptsMade;
		const delay = job.opts.delay;
		if (!backoff) {
			return delay ?? defaultDelay;
		}
		if (typeof backoff === "number") {
			return backoff; // fixed backoff
		}
		if (backoff.type === "fixed") {
			return backoff.delay ?? 0;
		}
		if (backoff.type === "exponential") {
			if (attemptsMade < 1) {
				return delay ?? defaultDelay;
			}
			return (backoff?.delay ?? defaultDelay) * Math.pow(attemptsMade - 1, 2);
		}
		throw new Error("Unsupported backoff type");
	}

	isSandboxedJob<T = any>(job: Job<T> | SandboxedJob<T>): job is SandboxedJob<T> {
		return typeof (job as Job).moveToCompleted === "undefined";
	}

	/**
	 * Closes this Bull queue and releases its Redis connections.
	 * This ensures the dedicated blocking client (bclient) is cleaned up.
	 *
	 * @returns Promise that resolves when the queue is fully closed
	 */
	async close(): Promise<void> {
		await this.queue.close();
		queueManager.deleteQueue(this.queue.name);
		logger.info(`Closed queue: ${this.queue.name}`);
	}
}

/**
 * Generic method to enqueue a business request looking it up by TIN, business_id, or combination of customer_id + external_id
 * @param impl: the implementation to call to enqueue the request
 * @param req: Express Request
 * @param res: Express Response
 * @returns
 */
export async function genericBusinessEnqueue<T = any>(
	impl: (requestId: UUID, request: Record<string, Request>) => Promise<Bull.Job<T>>,
	req: Request,
	res: Response
) {
	const requestId = randomUUID();
	const contentType = req.get("content-type");
	const ttl: number = 60 * 60 * 24 * 3; // 3 days
	let { body } = req;
	// When the body is a string, attempt to parse it as JSON
	if (body && contentType?.startsWith("text")) {
		body = await convertCsvToJson(body);
	}

	// Force body to be an array
	if (!Array.isArray(body)) {
		body = [body];
	}
	const ok = new SerializableMap<number, string | number>();
	const errors = new SerializableMap();

	for (let iteration = 0; iteration < body.length; iteration++) {
		const request = { ...body[iteration], requestId };

		try {
			const { tin, customer_id: customerID, external_id: externalID, business_id: businessID } = request;
			const parsedCustomerID = customerID || req.params?.customerID;
			if (parsedCustomerID) {
				request.customer_id = parsedCustomerID;
			}
			if (tin) {
				request.providedKey = tin;
			} else if (businessID) {
				if (!isUUID(businessID)) {
					errors.set(iteration, { provided: request, message: `Invalid UUID for Business: ${businessID}` });
					continue;
				}
				request.providedKey = businessID;
			} else if (request.customer_id && externalID) {
				request.providedKey = `${parsedCustomerID}-${externalID}`;
			} else {
				errors.set(iteration, {
					provided: request,
					message: "Either TIN, business_id, or customer_id and external_id are required in the request"
				});
				continue;
			}
			const job = await impl(requestId, request);
			if (job) {
				ok.set(iteration, job.id);
			}
		} catch (ex) {
			errors.set(iteration, {
				provided: request,
				message: "An exception occured when processing record",
				exception: (ex as Error).message
			});
		}
	}

	// Populate redis with the requestId
	const jobIds = Array.from(ok.values()) as Array<JobId>;
	const requestStats = { jobIds, ok: {}, error: {}, processed: 0 } as BullQueueRequest;
	await redis.setex(requestId, requestStats, ttl);

	if (errors.size > 0 && ok.size === 0) {
		return res.jsend.fail({ requestId, errors }, "Errors occurred while enqueing requests", StatusCodes.BAD_REQUEST);
	} else if (ok.size > 0 && errors.size > 0) {
		return res.jsend.fail(
			{ requestId, errors, success: ok },
			"Partial success occurred while enqueing requests",
			StatusCodes.BAD_REQUEST
		);
	} else if (ok.size > 0) {
		return res.jsend.success({ requestId, ok }, "Successfully enqueued all requests");
	}
	return res.jsend.fail({ requestId, errors }, "Errors occurred while processing requests");
}

export async function runJob(job: Job, done: Bull.DoneCallback, impl: (job: Job) => Promise<void>) {
	try {
		logger.info(`BullQueue queue=${job.queue.name} :: ${impl.name} :: processing jobId=${job.id}`);
		await impl(job);
		await saveJobStatus(job);
	} catch (ex) {
		await saveJobStatus(job, (ex as Error).message);
	} finally {
		done();
	}
	job.queue.getJobCounts().then(counts => {
		logger.debug({ counts }, `BullQueue queue=${job.queue.name}: Job counts: ${JSON.stringify(counts)}`);
	});
}

async function saveJobStatus(job: Bull.Job, error?: any) {
	const ttl: number = 60 * 60 * 24 * 14; // 2 weeks
	const { id: jobID } = job;
	const { requestId, request } = job.data;
	if (!requestId) {
		return;
	}

	logger.debug({ error, job }, `saveJobStatus: ${requestId} | ${jobID} | ${error ? "error" : "ok"}`);
	await redis
		.get(requestId)
		.then(async requestStats => {
			const stats = requestStats as unknown as BullQueueRequest;
			stats.processed = (stats.processed ?? 0) + 1;
			if (error) {
				logger.error({ error }, `jobId=${job.id} Error processing job`);
				(stats.error ?? {})[jobID] = { provided: request, message: error };
			} else {
				(stats.ok ?? {})[jobID] = { provided: request, message: "ok" };
			}

			await redis.setex(queueManager.getRequestStatusKey(requestId), JSON.stringify(stats), ttl);
			if (typeof jobID === "string") {
				const jobStatus = {
					error,
					job,
					status: error ? "failed" : "completed"
				};
				await redis.setex(queueManager.getJobStatusKey(jobID as UUID), JSON.stringify(jobStatus), ttl);
			}
		})
		.catch(error => {
			logger.error({ error, job }, `could not saveJobStatus for: ${requestId} | ${jobID}`);
		});
}

export default BullQueue;
