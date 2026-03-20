/* Middleware to check if the request is cached in redis and send the cached response */
import { envConfig } from "#configs";
import { logger } from "#helpers/logger";
import { redis } from "#helpers/redis";
import { type Response } from "#types/index";
import { type Request, type NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

export type ResponseCache<T = any> = {
	created_at: number; // unix timestamp
	expires_at: number; // unix timestamp
	key: string;
	data: T;
};

const CACHE_PREFIX = `integration-express-cache`;

const getCacheKey = (req: Request, res: Response): string => {
	let user = "anonymous";
	if (res.locals.user?.user_id) {
		user = res.locals.user.user_id;
	}
	// Sort all the query params by key so we have a consistent cache key regardless of the order of the query params
	const searchParamsObject: Record<string, string> = {};
	Object.entries(req.query)
		.sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
		.forEach(([key, value]) => {
			// Don't compute "noCache" as part of the key nor include undefined values
			if (value === undefined) return;
			if (key === "noCache") return;
			searchParamsObject[key] = Array.isArray(value) ? value.join(",") : String(value);
		});
	const searchParams = new URLSearchParams(searchParamsObject).toString();
	return `${CACHE_PREFIX}::${user}::${req.baseUrl}${req.path}?${searchParams}`;
};

const saveCache = async <T = any>(key: string, data: T, ttlSeconds: number) => {
	logger.debug(`saving cached response for key ${key} for ${ttlSeconds} seconds`);
	const now = Date.now();
	const cacheEntry: ResponseCache<T> = {
		created_at: now,
		expires_at: ttlSeconds * 1000 + now,
		key,
		data
	};
	await redis.setex(key, JSON.stringify(cacheEntry), ttlSeconds);
};

/**
 * Middleware to check if the request is cached in redis and send the cached response
 * @param passThrough - If false (default), the middleware will return a 200 with the cached response - if true we save the cached value to res.locals.cachedResponse and continue to the next middleware
 * @returns The cached response or the next middleware
 */
export const getCache = <T = any>(passThrough: boolean = false) => {
	return async (req: Request, res, next: NextFunction) => {
		const key = getCacheKey(req, res);
		if (req.query?.noCache) {
			logger.debug(`Bypassing cache for ${key}`);
			return next();
		}
		const cached = await redis.get<ResponseCache<T>>(key);
		if (cached) {
			// Convert unix timestamps to UTC strings
			const createdAt = new Date(cached.created_at).toUTCString();
			const expiresAt = new Date(cached.expires_at).toUTCString();
			// Calculate max-age from expires_at
			const maxAge = Math.floor((cached.expires_at - Date.now()) / 1000) - 1;
			// Double check that something funky didn't happen with the cache entry dates
			if (!createdAt || !expiresAt || createdAt === "Invalid Date" || expiresAt === "Invalid Date" || maxAge <= 0) {
				logger.warn(`Invalid cache entry for ${key}: skipping cache`);
				return next();
			}
			if (!passThrough) {
				return res
					.header("X-Cache", "HIT")
					.header("Last-Modified", createdAt)
					.header("Expires", expiresAt)
					.header("Cache-Control", `private, max-age=${maxAge}`)
					.status(StatusCodes.OK)
					.json(cached);
			}
			res.locals = res.locals ?? {};
			res.locals.cachedResponse = cached;
		}
		return next();
	};
};

/**
 * Middleware to save the value of passed body or res.locals.cacheOutput to the cache and send the response
 * @param ttlSeconds - The time to live in seconds (default 15 minutes)
 * @param body - The body to save to the cache (defaults to value of res.locals.cacheOutput.data)
 * @returns The cached response or the next middleware
 */
export const saveCacheAndSend = <T = any>(params: { ttlSeconds?: number; body?: T } = {}) => {
	return async (req: Request, res, next: NextFunction): Promise<void> => {
		try {
			const defaultParams = { ttlSeconds: envConfig.EXPRESS_CACHE_SECONDS, body: res.locals?.cacheOutput?.data };
			const { ttlSeconds, body } = { ...defaultParams, ...params };
			const { message, statusCode } = res.locals?.cacheOutput ?? {};
			const data: T = body ?? res.locals?.cacheOutput?.data;
			if (data) {
				const key = getCacheKey(req, res);
				await saveCache<T>(key, data, ttlSeconds);
				res.jsend.success(data, message, statusCode);
				return;
			}
			res.status(StatusCodes.NO_CONTENT).json({ message: "No data found" });
			return;
		} catch (error) {
			next(error);
		}
	};
};

export const invalidateCache = async (req, res, next) => {
	const key = getCacheKey(req, res);
	await redis.delete(key);
	next();
};

// Redis's delete multiple library method expects a key count which is essentially the batch size for scanning and deleting keys
export const invalidateBusinessCache = async (businessID: string, keyCount: number = 1000): Promise<void> => {
	const patterns = [
		`${CACHE_PREFIX}::*::/api/v1/facts/business/${businessID}*`,
		`${CACHE_PREFIX}::*::/api/v1/facts/business/${businessID}/*`
	];

	logger.info(`Invalidating cache for business ${businessID} with patterns: ${patterns.join(", ")}`);
	try {
		await Promise.all(patterns.map(pattern => redis.deleteMultiple(pattern, keyCount)));
		logger.info(`Successfully invalidated cache for business ${businessID}`);
	} catch (error) {
		logger.error(error, `Failed to invalidate cache for business: ${businessID}`);
		throw error;
	}
};

/** Invalidate Redis cache for GET .../business/:businessId/case/:caseId/values so next request gets fresh data (e.g. after acknowledge/re-verify). */
export const invalidateCaseTabValuesCache = async (
	businessId: string,
	caseId: string,
	keyCount: number = 1000
): Promise<void> => {
	const pattern = `${CACHE_PREFIX}::*::*business/${businessId}/case/${caseId}/values*`;
	logger.info(`Invalidating case tab values cache for business ${businessId} case ${caseId}`);
	try {
		await redis.deleteMultiple(pattern, keyCount);
		logger.info(`Successfully invalidated case tab values cache`);
	} catch (error) {
		logger.error(error, `Failed to invalidate case tab values cache for case: ${caseId}`);
		throw error;
	}
};
