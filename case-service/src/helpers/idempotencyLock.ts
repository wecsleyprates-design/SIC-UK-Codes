/**
 * A simple helper to create/maintain an idempotency lock.  Returns
 */

import { redis } from "./redis";
import { logger } from "./logger";

const DEFAULT_IDEMPOTENCY_LOCK_SECONDS = 300;

/**
 * Returns an algebraic type that represents the state of the idempotency lock.
 * @param key
 * @param context
 * @param ttl
 * @returns [boolean, IdempotencyLock<T> | null]
 * - The first element is a boolean indicating if the lock was acquired.
 * - The second element is the idempotency lock context that was set or returned.
 */
export async function getOrCreateLock<T extends string | Buffer | number | object = Record<string, any>>(
	key: string,
	context: T,
	ttl: number = DEFAULT_IDEMPOTENCY_LOCK_SECONDS
): Promise<[boolean, T | null]> {
	try {
		if (typeof key !== "string" || !key || key.length === 0) {
			return [false, null];
		}
		// Stringify the context if it's an object
		let safeContext: string | Buffer | number =
			typeof context === "object" && context != null ? JSON.stringify(context) : context;
		const acquired = await redis.setNx(key, safeContext, ttl);
		if (!acquired) {
			const existing = await redis.get<T>(key);
			return [false, existing];
		}
		return [true, context];
	} catch (error) {
		logger.error({ error, key, ttl, context }, `Error creating idempotency lock for key: ${key}`);
	}
	return [false, null];
}

/**
 * Release an idompotency key
 * @param key
 * @returns
 */
export async function releaseLock(key: string | null | undefined): Promise<boolean> {
	try {
		if (!key) {
			return false;
		}
		return await redis.delete(key);
	} catch (error) {
		logger.error({ error, key }, `Error releasing idempotency lock for key: ${key}`);
	}
	return false;
}

export async function updateLock<T extends string | Record<string, any> = Record<string, any>>(
	key: string,
	context: T
): Promise<boolean> {
	try {
		return await redis.set<T>(key, context);
	} catch (error) {
		logger.error({ error, key, context }, `Error updating idempotency lock for key: ${key}`);
	}
	return false;
}
export class IdempotencyLockError extends Error {
	public key: string;
	constructor(message: string, key: string) {
		super(message);
		this.name = "IdempotencyLockError";
		this.key = key;
	}
}

export const isIdempotencyLockError = (error: unknown): error is IdempotencyLockError => {
	return Error.isError(error) && error.name === "IdempotencyLockError";
};
