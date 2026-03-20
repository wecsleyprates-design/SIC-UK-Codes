import { rerunIntegrations } from "../rerunIntegrations";
import { getConnectionsAndTasks, processTasksForConnection, getPlatformCodesByChangedFacts } from "../lib";
import { RerunTrackingManager } from "#core/rerunTracking";
import type { FactName } from "#lib/facts/types";
import { INTEGRATION_ID, type TaskCode } from "#constants";
import type { UUID } from "crypto";

jest.mock("../lib");
jest.mock("#core/rerunTracking");
jest.mock("#helpers/logger", () => ({
	logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const mockGetConnectionsAndTasks = getConnectionsAndTasks as jest.MockedFunction<typeof getConnectionsAndTasks>;
const mockProcessTasksForConnection = processTasksForConnection as jest.MockedFunction<
	typeof processTasksForConnection
>;
const mockGetPlatformCodesByChangedFacts = getPlatformCodesByChangedFacts as jest.MockedFunction<
	typeof getPlatformCodesByChangedFacts
>;
const MockRerunTrackingManager = RerunTrackingManager as jest.MockedClass<typeof RerunTrackingManager>;

const MOCK_SCORE_TRIGGER_ID = "00000000-0000-0000-0000-000000000001" as UUID;

const mockInitialize = jest.fn();

describe("rerunIntegrations", () => {
	const businessID = "test-business-id";

	const createMockConnection = (overrides = {}) => ({
		connection_id: "conn-1",
		platform_id: INTEGRATION_ID.SERP_GOOGLE_PROFILE,
		platform_code: "serp_google_profile",
		task_codes: ["task1", "task2"],
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
		mockInitialize.mockResolvedValue({
			scoreTriggerId: MOCK_SCORE_TRIGGER_ID,
			caseId: null
		});
		MockRerunTrackingManager.mockImplementation(() => ({ initialize: mockInitialize }) as any);
	});

	describe("when no connections are found", () => {
		it("should return early with no matching connections message", async () => {
			mockGetConnectionsAndTasks.mockResolvedValue([]);

			const result = await rerunIntegrations({ businessID }, {});

			expect(result).toEqual({ message: "No matching connections found", run_count: 0, tasks_created: [] });
			expect(mockGetConnectionsAndTasks).not.toHaveBeenCalled();
		});
	});

	describe("when processing succeeds", () => {
		it("should process tasks and return created tasks", async () => {
			const metadata = { foo: "bar" };
			const body = { platform_codes: ["MOCK_PLATFORM_CODE"], metadata };
			const conn = createMockConnection();
			const tasksCreated = [
				{
					connection_id: conn.connection_id,
					platform_code: conn.platform_code,
					task_code: "task1",
					task_id: "task-id-1"
				}
			];

			mockGetConnectionsAndTasks.mockResolvedValue([conn]);
			mockProcessTasksForConnection.mockResolvedValue({ tasksCreated, errors: [] });

			const result = await rerunIntegrations({ businessID }, body);

			expect(result.run_count).toBe(1);
			expect(result.tasks_created).toEqual(tasksCreated);
			expect(result.errors).toBeUndefined();
			expect(mockProcessTasksForConnection).toHaveBeenCalledWith(businessID, conn, [], metadata, MOCK_SCORE_TRIGGER_ID);
		});

		it("should handle multiple connections", async () => {
			const metadata = { foo: "bar" };
			const body = { platform_codes: ["MOCK_PLATFORM_CODE"], metadata };
			const conn1 = createMockConnection({ connection_id: "conn-1", platform_code: "platform1" });
			const conn2 = createMockConnection({ connection_id: "conn-2", platform_code: "platform2" });

			const task1 = { connection_id: "conn-1", platform_code: "platform1", task_code: "task1", task_id: "id-1" };
			const task2 = { connection_id: "conn-2", platform_code: "platform2", task_code: "task2", task_id: "id-2" };

			mockGetConnectionsAndTasks.mockResolvedValue([conn1, conn2]);

			mockProcessTasksForConnection
				.mockResolvedValueOnce({ tasksCreated: [task1], errors: [] })
				.mockResolvedValueOnce({ tasksCreated: [task2], errors: [] });

			const result = await rerunIntegrations({ businessID }, body);

			expect(result.run_count).toBe(2);
			expect(result.tasks_created).toHaveLength(2);
			expect(mockProcessTasksForConnection).toHaveBeenCalledTimes(2);
		});

		it("should pass task_codes filter to processTasksForConnection", async () => {
			const metadata = { foo: "bar" };
			const taskCodes: TaskCode[] = ["fetch_business_entity_verification", "fetch_public_records"];
			const body = { metadata, task_codes: taskCodes };
			const conn = createMockConnection();

			mockGetConnectionsAndTasks.mockResolvedValue([conn]);

			mockProcessTasksForConnection.mockResolvedValue({ tasksCreated: [], errors: [] });

			await rerunIntegrations({ businessID }, body);

			expect(mockProcessTasksForConnection).toHaveBeenCalledWith(businessID, conn, taskCodes, metadata, MOCK_SCORE_TRIGGER_ID);
		});
	});

	describe("when processing returns errors", () => {
		it("should include errors from processTasksForConnection", async () => {
			const conn = createMockConnection();
			const metadata = { foo: "bar" };
			const body = { platform_codes: ["MOCK_PLATFORM_CODE"], metadata };

			const processingError = {
				connection_id: conn.connection_id,
				platform_code: conn.platform_code,
				error: "Processing failed"
			};

			mockGetConnectionsAndTasks.mockResolvedValue([conn]);

			mockProcessTasksForConnection.mockResolvedValue({ tasksCreated: [], errors: [processingError] });

			const result = await rerunIntegrations({ businessID }, body);

			expect(result.errors).toHaveLength(1);
			expect(result.errors?.[0]).toEqual(processingError);
		});
	});

	describe("completion tracking", () => {
		it("should create score trigger and pass scoreTriggerId to processTasksForConnection", async () => {
			const conn = createMockConnection();
			mockGetConnectionsAndTasks.mockResolvedValue([conn]);
			mockProcessTasksForConnection.mockResolvedValue({ tasksCreated: [], errors: [] });

			const result = await rerunIntegrations({ businessID }, { platform_codes: ["MOCK"] });

			expect(mockInitialize).toHaveBeenCalledWith({
				businessID,
				connectionsWithTasks: [conn]
			});
			expect(result.score_trigger_id).toBe(MOCK_SCORE_TRIGGER_ID);
		});

		it("should continue without tracking when manager.initialize fails", async () => {
			const conn = createMockConnection();
			mockGetConnectionsAndTasks.mockResolvedValue([conn]);
			mockProcessTasksForConnection.mockResolvedValue({ tasksCreated: [], errors: [] });
			mockInitialize.mockRejectedValue(new Error("DB error"));

			const result = await rerunIntegrations({ businessID }, { platform_codes: ["MOCK"] });

			expect(result.score_trigger_id).toBeUndefined();
			expect(mockProcessTasksForConnection).toHaveBeenCalledWith(businessID, conn, [], undefined, undefined);
		});
	});

	describe("filter parameters", () => {
		it("should pass platform_codes filter to getConnectionsAndTasks", async () => {
			mockGetConnectionsAndTasks.mockResolvedValue([]);

			await rerunIntegrations({ businessID }, { platform_codes: ["SERP_GOOGLE_PROFILE"] });

			expect(mockGetConnectionsAndTasks).toHaveBeenCalledWith(businessID, ["SERP_GOOGLE_PROFILE"], [], []);
		});

		it("should pass category_codes filter to getConnectionsAndTasks", async () => {
			mockGetConnectionsAndTasks.mockResolvedValue([]);

			await rerunIntegrations({ businessID }, { category_codes: ["CATEGORY1"] });

			expect(mockGetConnectionsAndTasks).toHaveBeenCalledWith(businessID, [], ["CATEGORY1"], []);
		});

		it("should pass all filters to getConnectionsAndTasks", async () => {
			mockGetConnectionsAndTasks.mockResolvedValue([]);

			await rerunIntegrations(
				{ businessID },
				{
					platform_codes: ["PLATFORM1"],
					category_codes: ["CATEGORY1"],
					task_codes: ["fetch_public_records"]
				}
			);

			expect(mockGetConnectionsAndTasks).toHaveBeenCalledWith(
				businessID,
				["PLATFORM1"],
				["CATEGORY1"],
				["fetch_public_records"]
			);
		});

		it("should determine affected platforms from fact_names", async () => {
			const factNames: FactName[] = ["business_name", "business_addresses_submitted"];
			const affectedPlatforms = ["SERP_GOOGLE_PROFILE", "PLAID"];

			mockGetPlatformCodesByChangedFacts.mockReturnValue(affectedPlatforms);
			mockGetConnectionsAndTasks.mockResolvedValue([]);

			await rerunIntegrations({ businessID }, { fact_names: factNames });

			expect(mockGetPlatformCodesByChangedFacts).toHaveBeenCalledWith(factNames);
			expect(mockGetConnectionsAndTasks).toHaveBeenCalledWith(businessID, affectedPlatforms, [], []);
		});

		it("should merge fact_names platforms with platform_codes filter", async () => {
			const factNames: FactName[] = ["business_name"];
			const affectedPlatforms = ["SERP_GOOGLE_PROFILE"];
			const explicitPlatforms = ["PLAID"];

			mockGetPlatformCodesByChangedFacts.mockReturnValue(affectedPlatforms);
			mockGetConnectionsAndTasks.mockResolvedValue([]);

			await rerunIntegrations(
				{ businessID },
				{
					platform_codes: explicitPlatforms,
					fact_names: factNames
				}
			);

			expect(mockGetPlatformCodesByChangedFacts).toHaveBeenCalledWith(factNames);
			expect(mockGetConnectionsAndTasks).toHaveBeenCalledWith(
				businessID,
				expect.arrayContaining(["SERP_GOOGLE_PROFILE", "PLAID"]),
				[],
				[]
			);
		});
	});
});
