/**
 * KYX Strategy Factory
 * Creates and manages KYX strategy instances based on integration mode
 */

import { KyxProductionStrategy } from "./KyxProductionStrategy";
import { KyxSandboxStrategy } from "./KyxSandboxStrategy";
import { createStrategyLogger } from "#helpers";
import type { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";
import { IKyxStrategy } from "../types";
import { KyxError } from "../kyxError";
import { StatusCodes } from "http-status-codes";

export class KyxStrategyFactory {
	/**
	 * Creates KYX strategy instance based on integration mode
	 * @param integrationMode - The integration mode (PRODUCTION, SANDBOX, MOCK)
	 * @returns Configured KYX strategy instance
	 */
	static createStrategy(integrationMode?: IntegrationMode): IKyxStrategy {
		if (!integrationMode) {
			return this.createDefaultStrategy();
		}

		// Create strategy based on mode
		switch (integrationMode) {
			case "SANDBOX":
				return this.createSandboxStrategy();

			case "PRODUCTION":
				return this.createProductionStrategy();

			default:
				return this.createDefaultStrategy();
		}
	}

	/**
	 * Creates default strategy for standalone cases
	 * @returns Production strategy if available, otherwise mock strategy
	 */
	static createDefaultStrategy(): IKyxStrategy {
		const productionStrategy = new KyxProductionStrategy();
		const defaultStrategy = productionStrategy.isAvailable() ? productionStrategy : new KyxSandboxStrategy();
		const strategyLogger = createStrategyLogger("KYX", defaultStrategy.getMode());

		strategyLogger.debug(
			`Using default strategy ${JSON.stringify({ strategyMode: defaultStrategy.getMode(), strategyAvailable: defaultStrategy.isAvailable() })}`
		);
		return defaultStrategy;
	}

	/**
	 * Creates production strategy with availability validation
	 * @returns Production strategy
	 * @throws {KyxError} When production strategy is not available
	 */
	private static createProductionStrategy(): IKyxStrategy {
		const productionStrategy = new KyxProductionStrategy();

		if (!productionStrategy.isAvailable()) {
			const strategyLogger = createStrategyLogger("KYX", "PRODUCTION");
			strategyLogger.error(`Production strategy not available - missing required configuration`);
			throw new KyxError(
				"Production strategy not available. Please ensure KYX production credentials are properly configured.",
				{ strategyMode: "PRODUCTION" },
				StatusCodes.SERVICE_UNAVAILABLE
			);
		}

		return productionStrategy;
	}

	/**
	 * Creates sandbox strategy with availability validation
	 * @returns Sandbox strategy
	 * @throws {KyxError} When sandbox strategy is not available
	 */
	private static createSandboxStrategy(): IKyxStrategy {
		const sandboxStrategy = new KyxSandboxStrategy();

		if (!sandboxStrategy.isAvailable()) {
			const strategyLogger = createStrategyLogger("KYX", "SANDBOX");
			strategyLogger.error(`Sandbox strategy not available - missing required configuration`);
			throw new KyxError(
				"Sandbox strategy not available. Please ensure KYX sandbox credentials are properly configured.",
				{ strategyMode: "SANDBOX" },
				StatusCodes.SERVICE_UNAVAILABLE
			);
		}

		return sandboxStrategy;
	}
}
