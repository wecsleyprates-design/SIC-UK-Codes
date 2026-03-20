/**
 * GIACT Strategy Factory
 * Creates and manages GIACT strategy instances based on integration mode
 */

import { GiactProductionStrategy } from "./GiactProductionStrategy";
import { GiactSandboxStrategy } from "./GiactSandboxStrategy";
import { GiactMockStrategy } from "./GiactMockStrategy";
import { createStrategyLogger } from "#helpers";
import type {
	CustomerIntegrationSettingsData,
	IntegrationMode
} from "#api/v1/modules/customer-integration-settings/types";
import { IGiactStrategy } from "../types";

export class GiactStrategyFactory {
	/**
	 * Creates GIACT strategy instance based on integration mode
	 * @param integrationMode - The integration mode (PRODUCTION, SANDBOX, MOCK)
	 * @returns Configured GIACT strategy instance
	 */
	static createStrategy(integrationMode?: IntegrationMode): IGiactStrategy {
		if (!integrationMode) {
			return this.createDefaultStrategy();
		}

		// Create strategy based on mode
		switch (integrationMode) {
			case "SANDBOX":
				return this.createSandboxStrategy();

			case "MOCK":
				return this.createMockStrategy();

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
	static createDefaultStrategy(): IGiactStrategy {
		const productionStrategy = new GiactProductionStrategy();
		const defaultStrategy = productionStrategy.isAvailable() ? productionStrategy : new GiactMockStrategy();
		const strategyLogger = createStrategyLogger("GIACT", defaultStrategy.getMode());

		strategyLogger.debug(
			`Using default strategy ${JSON.stringify({ strategyMode: defaultStrategy.getMode(), strategyAvailable: defaultStrategy.isAvailable() })}`
		);
		return defaultStrategy;
	}

	/**
	 * Creates production strategy with availability validation
	 * @returns Production strategy or mock fallback
	 */
	private static createProductionStrategy(): IGiactStrategy {
		const productionStrategy = new GiactProductionStrategy();

		if (!productionStrategy.isAvailable()) {
			const strategyLogger = createStrategyLogger("GIACT", "PRODUCTION");
			strategyLogger.warn(
				`Production strategy not available, falling back to MOCK ${JSON.stringify({ strategyMode: "PRODUCTION", fallbackMode: "MOCK" })}`
			);
			return new GiactMockStrategy();
		}

		return productionStrategy;
	}

	/**
	 * Creates sandbox strategy with availability validation
	 * @returns Sandbox strategy or mock fallback
	 */
	private static createSandboxStrategy(): IGiactStrategy {
		const sandboxStrategy = new GiactSandboxStrategy();

		if (!sandboxStrategy.isAvailable()) {
			const strategyLogger = createStrategyLogger("GIACT", "SANDBOX");
			strategyLogger.warn(
				`Sandbox strategy not available, falling back to MOCK ${JSON.stringify({ strategyMode: "SANDBOX", fallbackMode: "MOCK" })}`
			);
			return new GiactMockStrategy();
		}

		return sandboxStrategy;
	}

	/**
	 * Creates mock strategy for testing and development
	 * @returns Mock strategy instance
	 */
	private static createMockStrategy(): IGiactStrategy {
		const strategyLogger = createStrategyLogger("GIACT", "MOCK");
		strategyLogger.debug(`Creating GIACT MOCK strategy ${JSON.stringify({ strategyMode: "MOCK" })}`);
		return new GiactMockStrategy();
	}

	/**
	 * Determines available strategies for customer integration
	 * @param customerIntegrationSettings - Customer integration configuration
	 * @param integrationType - Type of integration (gverify or gauthenticate)
	 * @returns Object containing strategy availability status
	 */
	static getAvailableStrategies(
		customerIntegrationSettings: CustomerIntegrationSettingsData | null,
		integrationType: "gverify" | "gauthenticate"
	): {
		production: boolean;
		sandbox: boolean;
		mock: boolean;
		current: string;
	} {
		const currentMode = customerIntegrationSettings?.settings?.[integrationType]?.mode || "PRODUCTION";

		const productionStrategy = new GiactProductionStrategy();
		const sandboxStrategy = new GiactSandboxStrategy();

		return {
			production: productionStrategy.isAvailable(),
			sandbox: sandboxStrategy.isAvailable(),
			mock: true,
			current: currentMode
		};
	}
}
