import { getPlatform } from "../getPlatform";
import { platformFactory } from "#helpers/platformHelper";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import type { IDBConnection } from "#types/db";
import { UUID } from "crypto";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";

jest.mock("#helpers/platformHelper");
jest.mock("#helpers/strategyPlatformFactory");
jest.mock("#lib/plaid/plaidIdv");

const mockPlatformFactory = platformFactory as jest.MockedFunction<typeof platformFactory>;
const mockStrategyPlatformFactory = strategyPlatformFactory as jest.MockedFunction<typeof strategyPlatformFactory>;
const MockPlaidIdv = PlaidIdv as jest.MockedClass<typeof PlaidIdv>;

describe("getPlatform", () => {
	const businessId = "123e4567-e89b-12d3-a456-426614174000" as UUID;
	const customerId = "223e4567-e89b-12d3-a456-426614174000" as UUID;
	const connectionId = "323e4567-e89b-12d3-a456-426614174000" as UUID;

	/** Factory function for creating mock DB connection */
	const createMockConnection = (overrides: Partial<IDBConnection> = {}): IDBConnection => ({
		id: connectionId,
		business_id: businessId,
		platform_id: INTEGRATION_ID.PLAID_IDV,
		configuration: { customer_id: customerId },
		created_at: "2024-01-01T00:00:00.000Z",
		updated_at: "2024-01-01T00:00:00.000Z",
		connection_status: CONNECTION_STATUS.SUCCESS,
		...overrides
	});

	/** Factory function for creating mock PlaidIdv instance */
	const createMockPlaidIdv = () => {
		const mockInstance = new MockPlaidIdv() as jest.Mocked<PlaidIdv>;
		mockInstance.initializePlaidIdvConnectionConfiguration = jest.fn().mockResolvedValue(mockInstance);
		mockInstance.updateConnectionStatus = jest.fn().mockResolvedValue(undefined);
		return mockInstance;
	};

	/** Factory function for creating generic mock platform */
	const createMockPlatform = () =>
		({
			getOrCreateTaskForCode: jest.fn(),
			processTask: jest.fn(),
			updateConnectionStatus: jest.fn()
		}) as unknown as TaskManager;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("PLAID_IDV platform", () => {
		it("should initialize PlaidIdv with strategy factory and return configured instance", async () => {
			/** Arrange */
			const dbConnection = createMockConnection();
			const mockPlaidIdv = createMockPlaidIdv();
			mockStrategyPlatformFactory.mockResolvedValue(mockPlaidIdv);

			/** Act */
			const result = await getPlatform<PlaidIdv>(dbConnection);

			/** Assert */
			expect(mockStrategyPlatformFactory).toHaveBeenCalledWith({
				businessID: businessId,
				platformID: INTEGRATION_ID.PLAID_IDV,
				customerID: customerId
			});
			expect(mockPlaidIdv.initializePlaidIdvConnectionConfiguration).toHaveBeenCalledWith(customerId);
			expect(mockPlaidIdv.updateConnectionStatus).toHaveBeenCalledWith(
				CONNECTION_STATUS.SUCCESS,
				JSON.stringify({ task: "fetch_identity_verification" })
			);
			expect(result).toBe(mockPlaidIdv);
		});

		it("should handle PlaidIdv without customer_id in configuration", async () => {
			/** Arrange */
			const dbConnection = createMockConnection({ configuration: {} });
			const mockPlaidIdv = createMockPlaidIdv();
			mockStrategyPlatformFactory.mockResolvedValue(mockPlaidIdv);

			/** Act */
			const result = await getPlatform<PlaidIdv>(dbConnection);

			/** Assert */
			expect(mockStrategyPlatformFactory).toHaveBeenCalledWith({
				businessID: businessId,
				platformID: INTEGRATION_ID.PLAID_IDV,
				customerID: undefined
			});
			expect(mockPlaidIdv.initializePlaidIdvConnectionConfiguration).toHaveBeenCalledWith(undefined);
			expect(result).toBe(mockPlaidIdv);
		});

		it("should handle PlaidIdv with null configuration", async () => {
			/** Arrange */
			const dbConnection = createMockConnection({ configuration: null });
			const mockPlaidIdv = createMockPlaidIdv();
			mockStrategyPlatformFactory.mockResolvedValue(mockPlaidIdv);

			/** Act */
			const result = await getPlatform<PlaidIdv>(dbConnection);

			/** Assert */
			expect(mockStrategyPlatformFactory).toHaveBeenCalledWith({
				businessID: businessId,
				platformID: INTEGRATION_ID.PLAID_IDV,
				customerID: undefined
			});
			expect(mockPlaidIdv.initializePlaidIdvConnectionConfiguration).toHaveBeenCalledWith(undefined);
			expect(result).toBe(mockPlaidIdv);
		});

		it("should throw error when strategyPlatformFactory returns null", async () => {
			/** Arrange */
			const dbConnection = createMockConnection();
			mockStrategyPlatformFactory.mockResolvedValue(null);

			/** Act & Assert */
			await expect(getPlatform<PlaidIdv>(dbConnection)).rejects.toThrow("Failed to initialize PlaidIDV platform");
			expect(mockStrategyPlatformFactory).toHaveBeenCalledWith({
				businessID: businessId,
				platformID: INTEGRATION_ID.PLAID_IDV,
				customerID: customerId
			});
		});

		it("should throw error when strategyPlatformFactory returns undefined", async () => {
			/** Arrange */
			const dbConnection = createMockConnection();
			mockStrategyPlatformFactory.mockResolvedValue(undefined);

			/** Act & Assert */
			await expect(getPlatform<PlaidIdv>(dbConnection)).rejects.toThrow("Failed to initialize PlaidIDV platform");
		});

		it("should throw error when initializePlaidIdvConnectionConfiguration returns null", async () => {
			/** Arrange */
			const dbConnection = createMockConnection();
			const mockPlaidIdv = createMockPlaidIdv();
			mockPlaidIdv.initializePlaidIdvConnectionConfiguration.mockResolvedValue(null as unknown as PlaidIdv);
			mockStrategyPlatformFactory.mockResolvedValue(mockPlaidIdv);

			/** Act & Assert */
			await expect(getPlatform<PlaidIdv>(dbConnection)).rejects.toThrow("Failed to initialize PlaidIDV platform");
			expect(mockPlaidIdv.initializePlaidIdvConnectionConfiguration).toHaveBeenCalledWith(customerId);
		});

		it("should throw error when initializePlaidIdvConnectionConfiguration returns undefined", async () => {
			/** Arrange */
			const dbConnection = createMockConnection();
			const mockPlaidIdv = createMockPlaidIdv();
			mockPlaidIdv.initializePlaidIdvConnectionConfiguration.mockResolvedValue(undefined as unknown as PlaidIdv);
			mockStrategyPlatformFactory.mockResolvedValue(mockPlaidIdv);

			/** Act & Assert */
			await expect(getPlatform<PlaidIdv>(dbConnection)).rejects.toThrow("Failed to initialize PlaidIDV platform");
		});

		it("should propagate error from strategyPlatformFactory", async () => {
			/** Arrange */
			const dbConnection = createMockConnection();
			const error = new Error("Strategy factory failed");
			mockStrategyPlatformFactory.mockRejectedValue(error);

			/** Act & Assert */
			await expect(getPlatform<PlaidIdv>(dbConnection)).rejects.toThrow("Strategy factory failed");
		});

		it("should propagate error from initializePlaidIdvConnectionConfiguration", async () => {
			/** Arrange */
			const dbConnection = createMockConnection();
			const mockPlaidIdv = createMockPlaidIdv();
			const error = new Error("Initialization failed");
			mockPlaidIdv.initializePlaidIdvConnectionConfiguration.mockRejectedValue(error);
			mockStrategyPlatformFactory.mockResolvedValue(mockPlaidIdv);

			/** Act & Assert */
			await expect(getPlatform<PlaidIdv>(dbConnection)).rejects.toThrow("Initialization failed");
		});

		it("should propagate error from updateConnectionStatus", async () => {
			/** Arrange */
			const dbConnection = createMockConnection();
			const mockPlaidIdv = createMockPlaidIdv();
			const error = new Error("Update status failed");
			mockPlaidIdv.updateConnectionStatus.mockRejectedValue(error);
			mockStrategyPlatformFactory.mockResolvedValue(mockPlaidIdv);

			/** Act & Assert */
			await expect(getPlatform<PlaidIdv>(dbConnection)).rejects.toThrow("Update status failed");
		});
	});

	describe("EQUIFAX platform", () => {
		it("should throw error for Equifax platform (not yet supported)", async () => {
			/** Arrange */
			const dbConnection = createMockConnection({ platform_id: INTEGRATION_ID.EQUIFAX });

			/** Act & Assert */
			await expect(getPlatform(dbConnection)).rejects.toThrow("Equifax is not yet supported by this function.");
			expect(mockStrategyPlatformFactory).not.toHaveBeenCalled();
			expect(mockPlatformFactory).not.toHaveBeenCalled();
		});
	});

	describe("default platform factory", () => {
		it("should use platformFactory for non-special platforms", async () => {
			/** Arrange */
			const dbConnection = createMockConnection({ platform_id: INTEGRATION_ID.TRULIOO });
			const mockPlatform = createMockPlatform();
			mockPlatformFactory.mockReturnValue(mockPlatform);

			/** Act */
			const result = await getPlatform(dbConnection);

			/** Assert */
			expect(mockPlatformFactory).toHaveBeenCalledWith({ dbConnection });
			expect(result).toBe(mockPlatform);
			expect(mockStrategyPlatformFactory).not.toHaveBeenCalled();
		});

		it("should use platformFactory for MIDDESK platform", async () => {
			/** Arrange */
			const dbConnection = createMockConnection({ platform_id: INTEGRATION_ID.MIDDESK });
			const mockPlatform = createMockPlatform();
			mockPlatformFactory.mockReturnValue(mockPlatform);

			/** Act */
			const result = await getPlatform(dbConnection);

			/** Assert */
			expect(mockPlatformFactory).toHaveBeenCalledWith({ dbConnection });
			expect(result).toBe(mockPlatform);
		});

		it("should use platformFactory for OPENCORPORATES platform", async () => {
			/** Arrange */
			const dbConnection = createMockConnection({ platform_id: INTEGRATION_ID.OPENCORPORATES });
			const mockPlatform = createMockPlatform();
			mockPlatformFactory.mockReturnValue(mockPlatform);

			/** Act */
			const result = await getPlatform(dbConnection);

			/** Assert */
			expect(mockPlatformFactory).toHaveBeenCalledWith({ dbConnection });
			expect(result).toBe(mockPlatform);
		});

		it("should propagate error from platformFactory", async () => {
			/** Arrange */
			const dbConnection = createMockConnection({ platform_id: INTEGRATION_ID.TRULIOO });
			const error = new Error("Platform factory failed");
			mockPlatformFactory.mockImplementation(() => {
				throw error;
			});

			/** Act & Assert */
			await expect(getPlatform(dbConnection)).rejects.toThrow("Platform factory failed");
		});
	});
});
