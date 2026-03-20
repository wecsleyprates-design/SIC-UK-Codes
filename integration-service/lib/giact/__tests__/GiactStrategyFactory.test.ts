/**
 * Unit tests for GiactStrategyFactory
 * Tests strategy creation based on integration mode
 */

import { GiactStrategyFactory } from "../strategies/GiactStrategyFactory";
import { GiactMockStrategy } from "../strategies/GiactMockStrategy";
import { GiactProductionStrategy } from "../strategies/GiactProductionStrategy";
import { GiactSandboxStrategy } from "../strategies/GiactSandboxStrategy";
import { UUID } from "crypto";
import type { CustomerIntegrationSettingsData } from "#api/v1/modules/customer-integration-settings/types";

// Mock envConfig module
jest.mock("#configs/index", () => ({
	envConfig: {
		GIACT_API_ENDPOINT: process.env.GIACT_API_ENDPOINT || "",
		GIACT_API_USERNAME: process.env.GIACT_API_USERNAME || "",
		GIACT_API_PASSWORD: process.env.GIACT_API_PASSWORD || "",
		GIACT_SANDBOX_API_ENDPOINT: process.env.GIACT_SANDBOX_API_ENDPOINT || "",
		GIACT_SANDBOX_API_USERNAME: process.env.GIACT_SANDBOX_API_USERNAME || "",
		GIACT_SANDBOX_API_PASSWORD: process.env.GIACT_SANDBOX_API_PASSWORD || ""
	}
}));

describe("GiactStrategyFactory", () => {
	describe("createStrategy", () => {
		it("should create mock strategy for MOCK mode", () => {
			const strategy = GiactStrategyFactory.createStrategy("MOCK");

			expect(strategy).toBeInstanceOf(GiactMockStrategy);
			expect(strategy.getMode()).toBe("MOCK");
		});

		it("should create production strategy for PRODUCTION mode when available", () => {
			// Mock production strategy to be available
			jest.spyOn(GiactProductionStrategy.prototype, "isAvailable").mockReturnValue(true);

			const strategy = GiactStrategyFactory.createStrategy("PRODUCTION");

			expect(strategy).toBeInstanceOf(GiactProductionStrategy);
			expect(strategy.getMode()).toBe("PRODUCTION");
		});

		it("should fallback to mock when production strategy is not available", () => {
			// Mock production strategy to be unavailable
			jest.spyOn(GiactProductionStrategy.prototype, "isAvailable").mockReturnValue(false);

			const strategy = GiactStrategyFactory.createStrategy("PRODUCTION");

			expect(strategy).toBeInstanceOf(GiactMockStrategy);
			expect(strategy.getMode()).toBe("MOCK");
		});

		it("should create sandbox strategy for SANDBOX mode when available", () => {
			// Mock sandbox strategy to be available
			jest.spyOn(GiactSandboxStrategy.prototype, "isAvailable").mockReturnValue(true);

			const strategy = GiactStrategyFactory.createStrategy("SANDBOX");

			expect(strategy).toBeInstanceOf(GiactSandboxStrategy);
			expect(strategy.getMode()).toBe("SANDBOX");
		});

		it("should fallback to mock when sandbox strategy is not available", () => {
			// Mock sandbox strategy to be unavailable
			jest.spyOn(GiactSandboxStrategy.prototype, "isAvailable").mockReturnValue(false);

			const strategy = GiactStrategyFactory.createStrategy("SANDBOX");

			expect(strategy).toBeInstanceOf(GiactMockStrategy);
			expect(strategy.getMode()).toBe("MOCK");
		});

		it("should fallback to default strategy when no mode provided", () => {
			const strategy = GiactStrategyFactory.createStrategy();

			// Should return production if available, otherwise mock
			expect(strategy).toBeDefined();
			expect(["PRODUCTION", "MOCK"]).toContain(strategy.getMode());
		});

		it("should handle invalid mode gracefully", () => {
			const strategy = GiactStrategyFactory.createStrategy("INVALID_MODE" as any);

			// Should fallback to default strategy
			expect(strategy).toBeDefined();
			expect(["PRODUCTION", "MOCK"]).toContain(strategy.getMode());
		});
	});

	describe("createDefaultStrategy", () => {
		it("should return production strategy when available", () => {
			// Mock production strategy to be available
			jest.spyOn(GiactProductionStrategy.prototype, "isAvailable").mockReturnValue(true);

			const strategy = GiactStrategyFactory.createDefaultStrategy();

			expect(strategy).toBeInstanceOf(GiactProductionStrategy);
			expect(strategy.getMode()).toBe("PRODUCTION");
		});

		it("should return mock strategy when production is not available", () => {
			// Mock production strategy to be unavailable
			jest.spyOn(GiactProductionStrategy.prototype, "isAvailable").mockReturnValue(false);

			const strategy = GiactStrategyFactory.createDefaultStrategy();

			expect(strategy).toBeInstanceOf(GiactMockStrategy);
			expect(strategy.getMode()).toBe("MOCK");
		});
	});

	describe("getAvailableStrategies", () => {
		it("should return available strategies for customer", () => {
			// Mock customer settings
			const customerSettings: CustomerIntegrationSettingsData = {
				customer_id: "123e4567-e89b-12d3-a456-426614174000" as UUID,
				settings: {
					gverify: {
						status: "ACTIVE",
						mode: "SANDBOX",
						code: "GVERIFY",
						label: "GIACT gVerify",
						description: "Test",
						options: ["SANDBOX"]
					}
				}
			};

			// Mock strategy availability
			jest.spyOn(GiactProductionStrategy.prototype, "isAvailable").mockReturnValue(true);
			jest.spyOn(GiactSandboxStrategy.prototype, "isAvailable").mockReturnValue(false);

			const availableStrategies = GiactStrategyFactory.getAvailableStrategies(customerSettings, "gverify");

			expect(availableStrategies).toEqual({
				production: true,
				sandbox: false,
				mock: true,
				current: "SANDBOX"
			});
		});

		it("should return default values when customer settings are null", () => {
			// Mock strategy availability
			jest.spyOn(GiactProductionStrategy.prototype, "isAvailable").mockReturnValue(true);
			jest.spyOn(GiactSandboxStrategy.prototype, "isAvailable").mockReturnValue(false);

			const availableStrategies = GiactStrategyFactory.getAvailableStrategies(null, "gverify");

			expect(availableStrategies).toEqual({
				production: true,
				sandbox: false,
				mock: true,
				current: "PRODUCTION" // Default when no customer settings
			});
		});
	});
});
