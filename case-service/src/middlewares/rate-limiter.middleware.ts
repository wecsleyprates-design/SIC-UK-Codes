import { redis, logger } from "#helpers/index";
import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/index";

class RateLimitMiddlewareError extends Error {
	status: number;
	errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "RateLimitMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

/**
 * Rate Limit Middleware (Fixed-Window) using Redis
 *
 * This middleware limits how frequently a client (identified by IP + URL + method)
 * can call a specific endpoint within a fixed time window. It uses a timestamp-based
 * fixed-window strategy:
 *
 * - On the first request, a timestamp is stored in Redis with a TTL.
 * - Any subsequent request within the interval returns a 429 error.
 * - After the TTL expires, the client can request again.
 *
 * ⚠ FAIL-CLOSED STRATEGY
 * -----------------------
 * If Redis is unavailable or an unexpected error occurs inside the middleware:
 * - The request is NOT allowed to continue.
 * - A RateLimitMiddlewareError is thrown.
 * - Your global error handler should handle the error and return a structured 500 response.
 *
 * This is the correct strategy when rate-limiting is security-sensitive or when
 * you do not want bypassing the rate limiter due to infrastructure failures.
 *
 * @param {number} interval - Time window in milliseconds for rate limiting (default: 5 minutes)
 * @returns {Function} Express middleware function
 *
 * Usage Example:
 *   app.use(rateLimitMiddleware(2 * 60 * 1000)); // 2-minute interval
 *
 * Client Behavior:
 *   If a user hits the same route again before the window resets,
 *   they will receive a 429 Too Many Requests response.
 */
const rateLimitMiddleware = (interval = 5 * 60 * 1000) => {
	// Redis expects TTL in seconds
	const ttl = Math.ceil(interval / 1000);

	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			const now = Date.now();

			/**
			 * Sanitize URL:
			 * Remove query parameters to ensure rate limiting applies
			 * to the route path itself and not unique query combinations.
			 */
			const path = req.originalUrl.split("?")[0];

			/**
			 * Construct a unique Redis key for this request source:
			 *   delay:<IP>::<routePath>:<METHOD>
			 *
			 * Ensures rate limits are correctly separated for:
			 * - each user (via IP)
			 * - each endpoint path
			 * - each HTTP method
			 */
			const prefix = `${req.ip}::${path}:${req.method}`;
			const delayKey = `delay:${prefix}`;

			/**
			 * Retrieve the timestamp of the last request from Redis.
			 * If the key is missing, `redis.get()` returns null.
			 */
			const last = await redis.get(delayKey);

			if (last !== null) {
				const lastTime = Number(last);

				/**
				 * Validate the stored timestamp and check if the
				 * current request falls within the restricted interval.
				 */
				if (!isNaN(lastTime) && now - lastTime < interval) {
					const remainingSec = Math.ceil((interval - (now - lastTime)) / 1000);

					const minutes = Math.floor(remainingSec / 60);
					const seconds = remainingSec % 60;

					// User-friendly wait-time message
					const message =
						minutes >= 1
							? `You must wait ${minutes} minute(s) between requests.`
							: `You must wait ${seconds} second(s) between requests.`;

					return res.status(429).json({
						status: 429,
						message
					});
				}
			}

			/**
			 * Store the current timestamp in Redis with a TTL.
			 * Redis will automatically remove it after expiration.
			 */
			await redis.setEx(delayKey, ttl, String(now));
		} catch (err) {
			/**
			 * FAIL-CLOSED BEHAVIOR:
			 * Any Redis or internal error results in throwing a structured error.
			 * This prevents bypassing the rate limiter if infrastructure fails.
			 *
			 * Allow your global error handler to transform this into a 500 response.
			 */
			logger.error(err, "Error in RateLimitMiddleware");

			throw new RateLimitMiddlewareError(
				"Something went wrong",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}

		return next();
	};
};

export { rateLimitMiddleware };
