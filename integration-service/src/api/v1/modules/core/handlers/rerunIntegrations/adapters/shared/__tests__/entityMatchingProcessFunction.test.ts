import { entityMatchingProcessFunction } from "../entityMatchingProcessFunction";
import { defaultAdapterProcessFunction } from "../defaultAdapterProcessFunction";
import { logger } from "#helpers/logger";
import { db, getOrCreateConnection, platformFactory } from "#helpers";
import { EntityMatching } from "#lib/entityMatching/entityMatching";
import { INTEGRATION_ID } from "#constants";
import type { TaskManager } from "#api/v1/modules/tasks/taskManager";
import type { IntegrationProcessFunctionParams, IntegrationFactEntityMatchingMetadata } from "../../types";

jest.mock("../defaultAdapterProcessFunction");
jest.mock("#helpers/logger", () => ({
	logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));
jest.mock("#helpers", () => ({
	db: { raw: jest.fn() },
	getOrCreateConnection: jest.fn(),
	platformFactory: jest.fn()
}));
jest.mock("#lib/entityMatching/entityMatching");

/** Mock constants */
const mockDefaultAdapterProcessFunction = defaultAdapterProcessFunction as jest.MockedFunction<
	typeof defaultAdapterProcessFunction
>;
const mockLoggerInfo = logger.info as jest.MockedFunction<typeof logger.info>;
const mockLoggerWarn = logger.warn as jest.MockedFunction<typeof logger.warn>;
const mockLoggerDebug = logger.debug as jest.MockedFunction<typeof logger.debug>;
const mockDbRaw = db.raw as jest.MockedFunction<typeof db.raw>;
const mockGetOrCreateConnection = getOrCreateConnection as jest.MockedFunction<typeof getOrCreateConnection>;
const mockPlatformFactory = platformFactory as jest.MockedFunction<typeof platformFactory>;
const mockEntityMatchingIsEnabled = EntityMatching.isEnabled as jest.MockedFunction<typeof EntityMatching.isEnabled>;

describe("entityMatchingProcessFunction", () => {
	/** Factory function for creating mock platform */
	const createMockPlatform = (overrides: Partial<TaskManager> = {}): TaskManager =>
		({
			getOrCreateTaskForCode: jest.fn(),
			processTask: jest.fn(),
			getTasksForCode: jest.fn(),
			...overrides
		}) as unknown as TaskManager;

	/** Factory function for creating mock EntityMatching platform */
	const createMockEntityMatchingPlatform = (overrides: Partial<EntityMatching> = {}): EntityMatching =>
		({
			getOrCreateTaskForCode: jest.fn(),
			processTask: jest.fn(),
			...overrides
		}) as unknown as EntityMatching;

	/** Factory function for creating function params */
	const createParams = (
		overrides: Partial<IntegrationProcessFunctionParams<IntegrationFactEntityMatchingMetadata>> = {}
	): IntegrationProcessFunctionParams<IntegrationFactEntityMatchingMetadata> => ({
		platform: createMockPlatform(),
		platform_id: INTEGRATION_ID.OPENCORPORATES,
		platform_code: "opencorporates",
		connection_id: "conn-123",
		business_id: "business-456",
		task_code: "fetch_business_entity_verification",
		metadata: {
			names: ["Test Business Inc"],
			originalAddresses: [
				{ line_1: "123 Main St", city: "New York", state: "NY", postal_code: "10001", apartment: null, country: "US" }
			]
		},
		...overrides
	});

	/** Factory function for creating mock connection */
	const createMockConnection = (overrides = {}) => ({
		id: "em-conn-123",
		business_id: "business-456",
		platform_id: INTEGRATION_ID.ENTITY_MATCHING,
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockDbRaw.mockReturnValue("mock-db-raw" as any);
	});

	describe("when EntityMatching is disabled", () => {
		beforeEach(() => {
			mockEntityMatchingIsEnabled.mockResolvedValue(false);
		});

		it("should fall back to defaultAdapterProcessFunction", async () => {
			/** Arrange */
			const params = createParams();
			const expectedTaskId = "fallback-task-123";
			mockDefaultAdapterProcessFunction.mockResolvedValue([expectedTaskId]);

			/** Act */
			const result = await entityMatchingProcessFunction(params);

			/** Assert */
			expect(result).toEqual([expectedTaskId]);
			expect(mockDefaultAdapterProcessFunction).toHaveBeenCalledWith(params);
		});

		it("should log warning message about fallback", async () => {
			/** Arrange */
			const params = createParams({
				platform_code: "test_platform",
				platform_id: INTEGRATION_ID.OPENCORPORATES,
				business_id: "test-business"
			});
			mockDefaultAdapterProcessFunction.mockResolvedValue(["task-123"]);

			/** Act */
			await entityMatchingProcessFunction(params);

			/** Assert */
			expect(mockLoggerWarn).toHaveBeenCalledWith(
				{ business_id: "test-business", platform_code: "test_platform", platform_id: INTEGRATION_ID.OPENCORPORATES },
				"EntityMatching is disabled for test_platform - falling back to heuristic matching"
			);
		});

		it("should not create EntityMatching task when disabled", async () => {
			/** Arrange */
			const params = createParams();
			mockDefaultAdapterProcessFunction.mockResolvedValue(["task-123"]);

			/** Act */
			await entityMatchingProcessFunction(params);

			/** Assert */
			expect(mockGetOrCreateConnection).not.toHaveBeenCalled();
			expect(mockPlatformFactory).not.toHaveBeenCalled();
		});
	});

	describe("when EntityMatching is enabled", () => {
		beforeEach(() => {
			mockEntityMatchingIsEnabled.mockResolvedValue(true);
		});

		it("should create and process EntityMatching task successfully", async () => {
			/** Arrange */
			const entityMatchingTaskId = "em-task-789";
			const integrationTaskId = "int-task-456";
			const mockConnection = createMockConnection();
			const mockEMPlatform = createMockEntityMatchingPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue(entityMatchingTaskId),
				processTask: jest.fn().mockResolvedValue(undefined)
			});
			const mockIntegrationPlatform = createMockPlatform({
				getTasksForCode: jest.fn().mockResolvedValue([integrationTaskId])
			});
			const params = createParams({ platform: mockIntegrationPlatform });

			mockGetOrCreateConnection.mockResolvedValue(mockConnection as any);
			mockPlatformFactory.mockReturnValue(mockEMPlatform as any);

			/** Act */
			const result = await entityMatchingProcessFunction(params);

			/** Assert */
			expect(result).toEqual([entityMatchingTaskId]);
			expect(mockGetOrCreateConnection).toHaveBeenCalledWith(params.business_id, INTEGRATION_ID.ENTITY_MATCHING);
			expect(mockPlatformFactory).toHaveBeenCalledWith({ dbConnection: mockConnection });
			expect(mockEMPlatform.getOrCreateTaskForCode).toHaveBeenCalled();
			expect(mockEMPlatform.processTask).toHaveBeenCalledWith({ taskId: entityMatchingTaskId });
		});

		it("should pass correct metadata and conditions to EntityMatching task", async () => {
			/** Arrange */
			const metadata: IntegrationFactEntityMatchingMetadata = {
				names: ["Business Name", "DBA Name"],
				originalAddresses: [
					{ line_1: "456 Oak Ave", city: "Boston", state: "MA", postal_code: "02101", apartment: null, country: "US" }
				]
			};
			const mockConnection = createMockConnection();
			const mockEMPlatform = createMockEntityMatchingPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue("em-task-123"),
				processTask: jest.fn().mockResolvedValue(undefined)
			});
			const mockIntegrationPlatform = createMockPlatform({
				getTasksForCode: jest.fn().mockResolvedValue(["int-task-123"])
			});
			const params = createParams({ platform: mockIntegrationPlatform, metadata });

			mockGetOrCreateConnection.mockResolvedValue(mockConnection as any);
			mockPlatformFactory.mockReturnValue(mockEMPlatform as any);

			/** Act */
			await entityMatchingProcessFunction(params);

			/** Assert */
			expect(mockEMPlatform.getOrCreateTaskForCode).toHaveBeenCalledWith({
				taskCode: "fetch_business_entity_verification",
				metadata,
				conditions: ["mock-db-raw"]
			});
			expect(mockDbRaw).toHaveBeenCalledWith("metadata::text = ?", [JSON.stringify(metadata)]);
		});
	});

	describe("metadata validation", () => {
		it.each([
			{ metadata: undefined, description: "undefined" },
			{ metadata: null, description: "null" },
			{ metadata: {}, description: "empty object" }
		])("should throw error when metadata is $description", async ({ metadata }) => {
			/** Arrange */
			const params = createParams({ metadata: metadata as any });
			mockEntityMatchingIsEnabled.mockResolvedValue(true);

			/** Act & Assert */
			await expect(entityMatchingProcessFunction(params)).rejects.toThrow(
				`No metadata provided for ${params.platform_code} - ${params.task_code}`
			);
		});
	});

	describe("EntityMatching task creation failures", () => {
		beforeEach(() => {
			mockEntityMatchingIsEnabled.mockResolvedValue(true);
		});

		it("should throw error and log warning when task creation fails", async () => {
			/** Arrange */
			const mockConnection = createMockConnection();
			const mockEMPlatform = createMockEntityMatchingPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue(null)
			});
			const params = createParams({ platform_code: "test_platform" });

			mockGetOrCreateConnection.mockResolvedValue(mockConnection as any);
			mockPlatformFactory.mockReturnValue(mockEMPlatform as any);

			/** Act & Assert */
			await expect(entityMatchingProcessFunction(params)).rejects.toThrow(
				`Could not create EntityMatching task for test_platform`
			);
			expect(mockLoggerWarn).toHaveBeenCalledWith("Could not create EntityMatching task for test_platform");
		});

		it("should not call processTask when task creation fails", async () => {
			/** Arrange */
			const mockConnection = createMockConnection();
			const mockEMPlatform = createMockEntityMatchingPlatform({
				getOrCreateTaskForCode: jest.fn().mockResolvedValue(null),
				processTask: jest.fn()
			});
			const params = createParams();

			mockGetOrCreateConnection.mockResolvedValue(mockConnection as any);
			mockPlatformFactory.mockReturnValue(mockEMPlatform as any);

			/** Act & Assert */
			await expect(entityMatchingProcessFunction(params)).rejects.toThrow();
			expect(mockEMPlatform.processTask).not.toHaveBeenCalled();
		});
	});
});
