import { createClusterClient, redis } from "#helpers/redis";
import { SerializableMap } from "#utils/serialization";
import { isNumberObject } from "util/types";
import type { UUID } from "@joinworth/types/dist/utils/utilityTypes";
import type Bull from "bull";
import { Job, type Queue } from "bull";
import { type Cluster } from "ioredis";
import { clusterNode, clusterOptions, logger, type BullQueueStalledStats } from "#helpers";

type QueueOutput = {
	clientName: string;
	counts: Bull.JobCounts;
	completed: null | number;
	failed: number | null;
	stalled: number | null;
	lockExtensionFailed: number | null;
	metrics: Record<string, Record<string, any>>;
	workers: Record<string, string>[];
	connectionStatus: Record<string, string>;
};

type GetByJobIdResponse = {
	job: Bull.Job | null;
	log?: any;
};

/**
 * Class to manage entries in queues and get relevant statistics.
 * These methods should only ever be visible to Admins
 *
 * Exported as a singleton as it is meant to track global state of queues
 */
class QueueManager {
	// Bull will also request a blocking client ("bclient"); we intentionally do NOT
	// share the blocking client because it performs blocking operations per queue.
	private connections: Partial<Record<string /* Queue Name*/, Record<"client" | "subscriber", Cluster>>> = {};
	private queues: SerializableMap<string, Queue>;

	public constructor() {
		this.queues = new SerializableMap<string, Queue>();
	}

	public getClient = (queueName: string, type: "client" | "subscriber" | "bclient") => {
		if (type !== "bclient") {
			if (!this.connections[queueName]?.[type]) {
				this.connections[queueName] = this.connections[queueName] || ({} as Record<"client" | "subscriber", Cluster>);
				logger.debug({ clusterNode, clusterOptions }, `🐂 Creating ${type} client for queue=${queueName}`);
				this.connections[queueName][type] = createClusterClient(clusterNode, clusterOptions);
			}
			return this.connections[queueName][type];
		}
		return createClusterClient(clusterNode, clusterOptions);
	};

	public deleteQueue = (queueName: string) => {
		this.queues.delete(queueName);
		delete this.connections[queueName];
	};

	public getRequestStatusKey = (requestId: UUID) => `{bullqueue-stats}:request-status:${requestId}`;
	public getJobStatusKey = (jobId: UUID) => `{bullqueue-stats}:job-status:${jobId}`;

	public registerQueue(queue: Queue) {
		this.queues.set(queue.name, queue);
	}
	public async getJobsByRequest(requestId): Promise<Array<string | number>> {
		return redis.get(this.getRequestStatusKey(requestId)) as unknown as Promise<Array<string | number>>;
	}
	public async getJobByID(jobID: string | number, queue?: Queue): Promise<GetByJobIdResponse | null> {
		let foundJob: Bull.Job | null = null;
		if (!queue) {
			for (const queue of this.queues.values()) {
				const job = await queue.getJob(jobID).catch(() => null);
				if (job) {
					foundJob = job;
					break;
				}
			}
		}
		if (queue && !foundJob) {
			foundJob = await queue.getJob(jobID);
		}
		if (foundJob) {
			if (foundJob.id && !isNumberObject(foundJob.id)) {
				const log = await redis.get(foundJob.id as string).catch(() => null);
				return { job: foundJob, log };
			}
			return { job: foundJob };
		}
		// Not able to get the Job from the Queue, so try to get it from the shadow Job Status in Redis
		const jobStatus = await redis.get<Job>(this.getJobStatusKey(jobID as UUID));
		if (jobStatus) {
			return { job: jobStatus };
		}
		// Finally, see if the provided jobID just exists as a redis key
		const jobByID = await redis.get<Job>(jobID as string);
		if (jobByID) {
			return { job: jobByID };
		}

		return null;
	}
	public async getAllQueues(): Promise<Record<string, QueueOutput>> {
		const out: Record<string, QueueOutput> = {};
		const promises = Array.from(this.queues.values()).map(async queue => {
			const [completed, failed, lockExtensionFailed, stalled, counts, completedMetrics, failedMetrics, workers] =
				await Promise.all([
					redis.get<number>(`{bullqueue-stats}:${queue.name}:completed`),
					redis.get<number>(`{bullqueue-stats}:${queue.name}:failed`),
					redis.get<number>(`{bullqueue-stats}:${queue.name}:lock-extension-failed`),
					redis.get<number>(`{bullqueue-stats}:${queue.name}:stalled`),
					queue.getJobCounts(),
					queue.getMetrics("completed"),
					queue.getMetrics("failed"),
					queue.getWorkers()
				]);

			out[queue.name] = {
				clientName: queue.clientName(),
				counts,
				completed,
				failed,
				lockExtensionFailed,
				stalled,
				metrics: { completed: completedMetrics, failed: failedMetrics },
				workers,
				connectionStatus: {
					client: this.connections[queue.name]?.client?.status ?? "unknown",
					subscriber: this.connections[queue.name]?.subscriber?.status ?? "unknown"
				}
			};
		});
		await Promise.all(promises);
		// Order the queues by name
		const orderedOut = Object.keys(out)
			.sort()
			.reduce(
				(obj: Record<string, QueueOutput>, key) => {
					obj[key] = out[key];
					return obj;
				},
				{} as Record<string, QueueOutput>
			);
		return orderedOut;
	}
	private async getStalledForQueue(queueName: string): Promise<number> {
		const redisKey = `{bullqueue-stats}:${queueName}:stalled:*`;
		return redis.countKeysByPattern(redisKey);
	}
	public async getStalledCounts(queueName?: string): Promise<Record<string, number>> {
		if (queueName) {
			const count = await this.getStalledForQueue(queueName);
			return { [queueName]: count };
		}
		const out: Record<string, number> = {};
		const results: [string, number][] = await Promise.all(
			Array.from(this.queues.values()).map(async queue => {
				const count = await this.getStalledForQueue(queue.name);
				return [queue.name, count];
			})
		);
		for (const [name, count] of results) {
			out[name] = count;
		}

		return out;
	}
	public async getJobStalledStats(
		queueName: string,
		jobId: any
	): Promise<({ jobId: any } & BullQueueStalledStats) | null> {
		const redisKey = `{bullqueue-stats}:${queueName}:stalled:${jobId}`;
		return { jobId, ...(await redis.get<BullQueueStalledStats>(redisKey)) } as
			| ({ jobId: any } & BullQueueStalledStats)
			| null;
	}

	public async resetStats(queueName: string) {
		await redis.delete(`{bullqueue-stats}:${queueName}:completed`);
		await redis.delete(`{bullqueue-stats}:${queueName}:failed`);
		await redis.delete(`{bullqueue-stats}:${queueName}:lock-extension-failed`);
		await redis.delete(`{bullqueue-stats}:${queueName}:stalled`);
	}
}

const queueManager = new QueueManager();
export default queueManager;
