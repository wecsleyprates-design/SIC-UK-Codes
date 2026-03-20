/**
 * Base strategy interface for all integrations
 * Provides common contract for Production, Sandbox, and Mock implementations
 */

export interface IIntegrationStrategy {
	/**
	 * Get the current mode of this strategy
	 * @returns The mode this strategy represents
	 */
	getMode(): "PRODUCTION" | "SANDBOX" | "MOCK";

	/**
	 * Check if this strategy is available for use
	 * @returns True if the strategy can be used, false otherwise
	 */
	isAvailable(): boolean;
}
