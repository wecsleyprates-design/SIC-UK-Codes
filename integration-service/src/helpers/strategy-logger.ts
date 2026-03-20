/**
 * Generic strategy logger factory for integration strategies
 * Provides consistent logging patterns across all strategy implementations
 */

import { logger } from "./index";
import { type IntegrationCode, type IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";
import { Strategy } from "#constants/integrations.constant";

export interface StrategyLogger {
	debug: (message: string, context?: Record<string, any>) => void;
	info: (message: string, context?: Record<string, any>) => void;
	warn: (message: string, context?: Record<string, any>) => void;
	error: (message: string, context?: Record<string, any>) => void;
}

/**
 * Creates a strategy logger instance with shared context
 * @param integrationName - The name of the integration (e.g., "GIACT", "PLAID")
 * @param mode - The strategy mode (PRODUCTION, SANDBOX, MOCK)
 * @param baseContext - Additional base context to include in all logs
 * @returns StrategyLogger instance
 */
export const createStrategyLogger = (
	integrationName: IntegrationCode | string,
	mode: IntegrationMode | Strategy,
	baseContext: Record<string, any> = {}
): StrategyLogger => {
	const sharedContext = {
		integration: integrationName,
		mode,
		...baseContext
	};

	return {
		debug: (message: string, data: Record<string, any> = {}) => {
			logger.debug({ ...sharedContext, ...data }, message);
		},
		info: (message: string, data: Record<string, any> = {}) => {
			logger.info({ ...sharedContext, ...data }, message);
		},
		warn: (message: string, data: Record<string, any> = {}) => {
			logger.warn({ ...sharedContext, ...data }, message);
		},
		error: (message: string, data: Record<string, any> = {}) => {
			logger.error({ ...sharedContext, ...data }, message);
		}
	};
};
