import { INTEGRATION_ID, TASK_STATUS, type IntegrationPlatformId } from "#constants";
import { db, logger } from "#helpers";
import type { IBusinessIntegrationTaskEventEgg, TDateISO } from "#types";
import crypto, { type UUID } from "crypto";

type RequestProxyOpts = {
	extractFn?: (args: unknown[]) => unknown;
	thisArg?: unknown;
	taskID?: UUID;
};

interface IPayloadCache<REQ = Record<string, any>, RES = Record<string, any>> {
	id: number;
	request_payload: REQ;
	request_fingerprint: string;
	response_payload: RES;
	response_fingerprint: string;
	platform_id: IntegrationPlatformId;
	created_at: TDateISO | Date;
	updated_at: TDateISO | Date;
}

export abstract class RequestProxy {
	// Map PlatformId: expirationInMs
	protected static readonly DEFAULT_EXPIRATION: number = 1000 * 60 * 60 * 24 * 30; // 30 days
	protected static readonly EXPIRATION: Partial<Record<IntegrationPlatformId, number>> = {
		[INTEGRATION_ID.AI_NAICS_ENRICHMENT]: 1000 * 60 * 60 * 24 * 30 // 30 days
	};

	/**
	 * Returns a proxy function that caches by its positional arguments.
	 * Usage:
	 *   const cached = RequestProxy.wrap(fetcher, INTEGRATION_ID.X, { fingerprintKey: (args) => [args[0], args[1]?.toLowerCase()] });
	 *   const res = await cached(id, status);
	 */
	public static wrap<T extends (...args: any[]) => Promise<any>>(
		getter: T,
		platformID: IntegrationPlatformId,
		opts?: RequestProxyOpts
	) {
		return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
			return this.proxyRequest<Awaited<ReturnType<T>>, Parameters<T>>(getter as any, platformID, args, opts);
		};
	}

	public static async saveTaskEvent<T = any>(
		cachedResponse: any,
		opts: Partial<IBusinessIntegrationTaskEventEgg<T>> &
			Pick<IBusinessIntegrationTaskEventEgg, "business_integration_task_id">
	) {
		return db<IBusinessIntegrationTaskEventEgg>("integrations.business_integration_tasks_events").insert({
			task_status: TASK_STATUS.IN_PROGRESS,
			log: { message: "Cached Response Found", cachedResponse },
			...opts
		});
	}

	protected static getExpiration(platformID: IntegrationPlatformId): number {
		return this.EXPIRATION[platformID] ?? this.DEFAULT_EXPIRATION;
	}
	protected static isExpired(cachedResponse: Pick<IPayloadCache, "created_at" | "platform_id">): boolean {
		return Date.now() - new Date(cachedResponse.created_at).getTime() > this.getExpiration(cachedResponse.platform_id);
	}

	/**
	 * Compute a stable, case-insensitive SHA-256 fingerprint for any value.
	 * Objects are key-sorted; arrays preserve order.
	 */
	private static stableStringify(value: unknown, seen = new WeakSet<object>()): string {
		if (value === null || typeof value !== "object") {
			return JSON.stringify(value);
		}
		if (seen.has(value as object)) {
			return '"[Circular]"';
		}
		seen.add(value as object);
		if (Array.isArray(value)) {
			return `[${value.map(v => this.stableStringify(v, seen)).join(",")}]`;
		}
		const obj = value as Record<string, unknown>;
		const keys = Object.keys(obj).sort();
		return `{${keys.map(k => `${JSON.stringify(k)}:${this.stableStringify(obj[k], seen)}`).join(",")}}`;
	}

	private static fingerprint(value: unknown): string {
		const serialized = this.stableStringify(value).toLowerCase();
		return crypto.createHash("sha256").update(serialized).digest("hex");
	}

	private static async getPayloadCacheRecord<
		Args extends unknown[] = unknown[],
		RES extends Record<string, any> = Record<string, any>
	>(requestFingerprint: string, platformID: IntegrationPlatformId): Promise<IPayloadCache<Args, RES> | undefined> {
		return db<IPayloadCache<Args, RES>>("integration_data.payload_cache")
			.where("request_fingerprint", requestFingerprint)
			.andWhere("platform_id", platformID)
			.orderBy("created_at", "desc")
			.first();
	}

	private static async savePayloadCacheRecord<
		Args extends unknown[] = unknown[],
		RES extends Record<string, any> = Record<string, any>
	>(requestPayload: Args, platformID: IntegrationPlatformId, responsePayload: RES): Promise<IPayloadCache<Args, RES>> {
		const responseFingerprint = this.fingerprint(responsePayload);
		const requestFingerprint = this.fingerprint(requestPayload);

		// Normally don't want to stringify the payload, but we need to here as the Knex serializer isn't liking the request json
		const requestString = JSON.stringify(requestPayload);
		const responseString = JSON.stringify(responsePayload);

		const inserted = await db<IPayloadCache<Args, RES>>("integration_data.payload_cache")
			.insert({
				request_fingerprint: requestFingerprint,
				response_fingerprint: responseFingerprint,
				platform_id: platformID,
				request_payload: requestString as any,
				response_payload: responseString as any
			})
			.onConflict(["request_fingerprint", "platform_id"])
			.merge()
			.returning("*");
		return inserted[0];
	}

	/**
	 * The workhorse of this class.
	 * Proxy a request and cache by positional arguments.
	 * - getter: the function to execute on cache miss
	 * - platformID: used to determine expiration policy and uniqueness of the cache
	 * - args: positional arguments to pass to the getter
	 * - opts.extractFingerprint: optional function to calculate a request fingerprint from the arguments
	 */
	protected static async proxyRequest<
		RES extends Record<string, any> = Record<string, any>,
		Args extends unknown[] = unknown[]
	>(
		getter: (...args: Args) => Promise<RES>,
		platformID: IntegrationPlatformId,
		args: Args,
		opts?: RequestProxyOpts
	): Promise<RES> {
		const keySource = opts?.extractFn ? opts.extractFn(args) : args;
		const requestFingerprint = this.fingerprint(keySource);

		const cachedResponse = await this.getPayloadCacheRecord<Args, RES>(requestFingerprint, platformID);
		if (cachedResponse && !this.isExpired(cachedResponse)) {
			logger.debug({ cachedResponse, opts }, "Cached response found for RequestProxy(args)");
			if (opts?.taskID) {
				await this.saveTaskEvent(cachedResponse, { business_integration_task_id: opts?.taskID });
			}
			return cachedResponse.response_payload as RES;
		}
		if (cachedResponse) {
			logger.debug({ cachedResponse }, "Cached response expired for RequestProxy(args)");
		}

		try {
			const response = await getter.apply(opts?.thisArg as any, args as any);
			const inserted = await this.savePayloadCacheRecord(args, platformID, response);
			return inserted.response_payload as RES;
		} catch (error) {
			logger.error(error, "Error proxying request through RequestProxy(args)");
			throw error;
		}
	}
}
