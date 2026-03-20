import "reflect-metadata";
import LRUCache from "lru-cache";
import md5 from "md5";
import { logger } from "#helpers/logger";
import { getJSONFromS3 } from "#common/index";
/** Decorator to indicate that a method response should be hydrated from our Datawarehouse if the result is null or empty
 *
 * Annotate a  “get” function that returns a value that may need to be hydrated with this Decorator
 * Pass in a “set” function that does the writes the now-hydrated data back to the data store as hydrateFn
 * Optionally, pass in file to hydrate from a file in S3 all the time (only use for situations where performance won't be problematic waiting for S3)
 */

/** Initialize a small LRU Cache to store recent hydration attempts on same pod to avoid possible infinite loop situations if hydration attempts cannot be properly resolved
 */
const lruCache: LRUCache<string, Date> = new LRUCache<string, Date>({
	max: 500,
	maxAge: 1000 * 60 * 5 // 5 minutes
});
type HydrateOptions = {
	/**
	 * Optional boolean function to determine if the result is empty or otherwise eligible to be hydrated, if not set uses isEmptyResponse()
	 * This is the first check to determine if the method should be hydrated
	 * @param originalMethodResponse: The response from the decorated function
	 *  */
	isEmptyFn?: (...originalMethodResponse: any[]) => boolean;
	/**
	 * Optional (but usually a good idea) function to determine if hydration is in scope after the isEmpty check -- use if hydration is not always going to resolve the `isEmpty` check - this returns a promise
	 * This also only runs if the LRU cache check passes, so it can be skipped if the hydration is not needed
	 * @param argsPassedToDecoratedFunction: Arguments passed to the decorated function
	 */
	checkFn?: (...argsPassedToDecoratedFunction: any[]) => Promise<boolean>;
	/**
	 * Optional function to generate a cache key for the LRU cache, defaults to `${methodName}:${md5(JSON.stringify(args))}`
	 * @param argsPassedToDecoratedFunction
	 * @returns
	 */
	cacheKeyFn?: (...argsPassedToDecoratedFunction: any[]) => string;
} & (
	| {
			/**
			 * hydrateFn is the function that will be called if: decorated function result is empty, LRU cache check passes, and checkFn returns true
			 * @param this
			 * @param hydrateOptions
			 * @param argsPassedToDecoratedFunction
			 * @returns
			 */
			hydrateFn: (this: any, hydrateOptions: HydrateOptions, ...argsPassedToDecoratedFunction: any[]) => Promise<void>;
			file?: never;
	  }
	| {
			/**
			 * file:
			 *  is the path to the file in S3 that should be used to hydrate the response - when using this param it doesn't persist the result of the hydration and has no LRU check -- should be used sparingly
			 * as this will hit s3 every time
			 * Can pass in an async function to calculate the path but always expects a path to be returned (if not just providing a path, use hydrateFn instead)
			 */
			file: string | ((...argsPassedToDecoratedFunction: any[]) => Promise<string>);
			hydrateFn?: never;
	  }
);
/**
 * Annotate a function with this decorator to hydrate the response from the function if it is empty
 * @param options
 * @returns
 */
export function HydrateFromWarehouse(options: HydrateOptions) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;

		descriptor.value = async function (...args: any[]) {
			const result = await originalMethod.apply(this, args);

			const isEmptyFn = options.isEmptyFn ?? isEmptyResponse;
			const checkFn = options.checkFn ?? (() => Promise.resolve(true));

			/* 
				Progressively more expensive checks: 
				1) In memory comparison of result set from original method to determine if "empty"
				2) Cache check to determine if this method has been called recently with the same arguments
				3) Execute checkFn to determine if the method should be called -- this is meant to be the most expensive check since its async and could be a network/database call
					this defaults to Promise.resolve(true) if not provided
			*/
			if (!isEmptyFn(result)) {
				logger.debug("Skipping hydration request: result is not empty");
				return result;
			}

			if (options.file) {
				// If performance-be-damned we just want to always check in s3 and not save/update the result
				if (typeof options.file === "function") {
					return getJSONFromS3(await options.file(...args));
				}
				return getJSONFromS3(options.file);
			}

			if (options.hydrateFn) {
				let cacheKey = "";
				if (options.cacheKeyFn) {
					cacheKey = options.cacheKeyFn(...args);
				} else if (Array.isArray(args) && args.length > 0) {
					// Look for an id column in the arguments to use as a cache key
					const keyComponent = args.find(arg => arg && arg.id);
					if (keyComponent && keyComponent.id) {
						cacheKey = keyComponent.id;
					}
				}
				if (cacheKey === "") {
					// Fallback key: stringify args & md5
					cacheKey = md5(JSON.stringify(args));
				}
				cacheKey = `${propertyKey}:${cacheKey}`;
				const cachedAt = lruCache.get(cacheKey);
				if (cachedAt) {
					logger.debug(`Skipping hydration logic for ${propertyKey}: entry already in LRU Cache for recent hydration attempt: ${cachedAt}`);
					return result;
				}
				// Note that `this` is inherited from the original decorated function's scope
				if ((await checkFn.apply(this, args)) === true) {
					lruCache.set(cacheKey, new Date());
					logger.debug(`Running hydration logic for ${propertyKey}`);
					// Execute hydration function
					await options.hydrateFn.call(this, options, ...args);
					// Re-run orignial function to get the updated result
					return originalMethod.apply(this, args);
				}
				logger.debug("Hydration attempt checkFn returned false, skipping hydration");
			}
			return result;
		};

		return descriptor;
	};
}
// Define the default of what constitutes an empty response, can be overriden by the isEmptyFn option
function isEmptyResponse(response: any): boolean {
	return (
		response === null ||
		response === undefined ||
		(Array.isArray(response) && response.length === 0) ||
		(typeof response === "object" && Object.keys(response).length === 0) ||
		(typeof response === "object" && Object.hasOwn(response, "rows") && response.rows.length === 0)
	);
}
