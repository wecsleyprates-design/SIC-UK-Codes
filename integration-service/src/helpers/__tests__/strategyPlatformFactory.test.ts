import { strategyPlatformFactory } from "../strategyPlatformFactory";
import { INTEGRATION_ID } from "#constants/integrations.constant";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { getOrCreateConnection, updateConnectionByConnectionId } from "#helpers";
import { UUID } from "crypto";
import EquifaxProductionStrategy from "#lib/equifax/strategies/EquifaxProductionStrategy";
import EquifaxSandboxStrategy from "#lib/equifax/strategies/EquifaxSandboxStrategy";

// Mock dependencies
jest.mock("#api/v1/modules/customer-integration-settings/customer-integration-settings");
jest.mock("#helpers", () => ({
	getOrCreateConnection: jest.fn(),
	updateConnectionByConnectionId: jest.fn(),
	createStrategyLogger: jest.fn(() => ({
		info: jest.fn()
	}))
}));

describe("strategyPlatformFactory", () => {
	const mockCustomerID = "123e4567-e89b-12d3-a456-426614174000" as UUID;
	const mockBusinessID = "123e4567-e89b-12d3-a456-426614174001" as UUID;
	const mockConnectionID = "123e4567-e89b-12d3-a456-426614174002" as UUID;

	const mockConnection = {
		id: mockConnectionID,
		platform_id: INTEGRATION_ID.EQUIFAX,
		connection_status: "ACTIVE",
		configuration: {},
		strategy: undefined,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		business_id: mockBusinessID
	} as any;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should use strategy from connection when available", async () => {
		const connectionWithStrategy = { ...mockConnection, strategy: "PRODUCTION" };

		const result = await strategyPlatformFactory({
			dbConnection: connectionWithStrategy
		});

		expect(result).toBeInstanceOf(EquifaxProductionStrategy);
		expect(customerIntegrationSettings.findById).not.toHaveBeenCalled();
	});

	it("should fetch strategy from customer settings when connection has no strategy", async () => {
		(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
			settings: { equifax: { mode: "SANDBOX" } }
		});

		const result = await strategyPlatformFactory({
			dbConnection: mockConnection,
			customerID: mockCustomerID
		});

		expect(updateConnectionByConnectionId).toHaveBeenCalledWith(mockConnectionID, "ACTIVE", undefined, "SANDBOX");
		expect(result).toBeInstanceOf(EquifaxSandboxStrategy);
	});

	it("should default to PRODUCTION when no strategy found", async () => {
		(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({ settings: {} });

		const result = await strategyPlatformFactory({
			dbConnection: mockConnection,
			customerID: mockCustomerID
		});

		expect(updateConnectionByConnectionId).toHaveBeenCalledWith(mockConnectionID, "ACTIVE", undefined, "PRODUCTION");
		expect(result).toBeInstanceOf(EquifaxProductionStrategy);
	});

	it("should fetch connection when businessID and platformID provided", async () => {
		(getOrCreateConnection as jest.Mock).mockResolvedValue(mockConnection);
		(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue({
			settings: { equifax: { mode: "SANDBOX" } }
		});

		const result = await strategyPlatformFactory({
			businessID: mockBusinessID,
			platformID: INTEGRATION_ID.EQUIFAX,
			customerID: mockCustomerID
		});

		expect(getOrCreateConnection).toHaveBeenCalledWith(mockBusinessID, INTEGRATION_ID.EQUIFAX);
		expect(result).toBeInstanceOf(EquifaxSandboxStrategy);
	});

	it("should throw error when no connection provided or created", async () => {
		await expect(strategyPlatformFactory({ customerID: mockCustomerID })).rejects.toThrow(
			"No connection provided or created"
		);
	});

	it("should throw error for unsupported platform", async () => {
		const unsupportedConnection = { ...mockConnection, platform_id: 99 as any };

		await expect(
			strategyPlatformFactory({
				dbConnection: unsupportedConnection,
				platformID: 99 as any
			})
		).rejects.toThrow("No platform strategies found for platform 99");
	});

	it("should throw error when getOrCreateConnection returns null", async () => {
		(getOrCreateConnection as jest.Mock).mockResolvedValue(null);

		await expect(
			strategyPlatformFactory({
				businessID: mockBusinessID,
				platformID: INTEGRATION_ID.EQUIFAX
			})
		).rejects.toThrow("No connection provided or created");
	});

	it("should handle null customer settings", async () => {
		(customerIntegrationSettings.findById as jest.Mock).mockResolvedValue(null);

		const result = await strategyPlatformFactory({
			dbConnection: mockConnection,
			customerID: mockCustomerID
		});

		expect(result).toBeInstanceOf(EquifaxProductionStrategy);
	});

	it("should use platformID from connection when not explicitly provided", async () => {
		const connectionWithStrategy = { ...mockConnection, strategy: "SANDBOX" };

		const result = await strategyPlatformFactory({
			dbConnection: connectionWithStrategy
		});

		expect(result).toBeInstanceOf(EquifaxSandboxStrategy);
	});
});
