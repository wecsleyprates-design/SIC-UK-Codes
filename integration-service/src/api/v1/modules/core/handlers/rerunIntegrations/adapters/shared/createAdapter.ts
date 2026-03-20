import type { IntegrationFactAdapter } from "../types";
import { defaultAdapterProcessFunction } from "./defaultAdapterProcessFunction";

/**
 * Creates an integration adapter with the default process function.
 *
 * This factory function ensures that adapters are properly configured without circular dependencies.
 * Adapters just need to provide their metadata generation logic and fact dependencies.
 *
 * @example
 * ```typescript
 * export const myAdapter = createAdapter({
 *   getMetadata: async (businessID) => ({ ... }),
 *   factNames: ['business_name', 'address']
 * });
 * ```
 *
 * @example Custom process function
 * ```typescript
 * export const myAdapter = createAdapter({
 *   getMetadata: async (businessID) => ({ ... }),
 *   factNames: ['business_name'],
 *   process: myCustomProcessFunction  // Override default
 * });
 * ```
 */
export const createAdapter = <M = any>(config: {
	/** *Must* be provided */
	getMetadata: IntegrationFactAdapter<M>["getMetadata"];
	/** Optional isValidMetadata function override */
	isValidMetadata?: IntegrationFactAdapter<M>["isValidMetadata"];
	/** *Must* be provided */
	factNames: IntegrationFactAdapter<M>["factNames"];
	/** Optional process function override */
	process?: IntegrationFactAdapter<M>["process"];
	/** Optional checkRunnable function override */
	checkRunnable?: IntegrationFactAdapter<M>["checkRunnable"];
}): IntegrationFactAdapter<M> => ({
	getMetadata: config.getMetadata,
	factNames: config.factNames,
	checkRunnable: config.checkRunnable ?? (async () => true),
	process: config.process ?? defaultAdapterProcessFunction,
	isValidMetadata: config.isValidMetadata
});
