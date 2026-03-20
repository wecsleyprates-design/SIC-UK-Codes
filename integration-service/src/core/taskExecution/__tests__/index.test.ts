import { CONNECTION_STATUS, INTEGRATION_ID, TASK_STATUS } from "#constants";
import { getConnectionById } from "#helpers";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import type { UUID } from "crypto";
import { executeIntegrationTask, TASK_CODE_TO_EXECUTION_FUNCTION } from "..";

jest.mock("#helpers", () => {
	const actual = jest.requireActual("#helpers");
	return {
		...actual,
		getConnectionById: jest.fn(),
		sqlTransaction: jest.fn().mockResolvedValue(undefined)
	};
});

jest.mock("#common", () => ({
	prepareIntegrationDataForScore: jest.fn().mockResolvedValue(undefined)
}));

// Avoid loading real AdverseMedia (requires OpenAI) when index pulls in fetchAdverseMedia
jest.mock("#api/v1/modules/adverse-media/adverse-media", () => ({
	adverseMedia: {
		customerSettingsForIntegration: jest.fn(),
		processAdverseMediaAndHandleTasks: jest.fn()
	}
}));

const mockGetConnectionById = getConnectionById as jest.Mock;
const mockSqlTransaction = (jest.requireMock("#helpers") as { sqlTransaction: jest.Mock }).sqlTransaction;
const mockPrepareIntegrationDataForScore = jest.requireMock("#common").prepareIntegrationDataForScore as jest.Mock;

const createMockTask = (overrides: Partial<IBusinessIntegrationTaskEnriched> = {}): IBusinessIntegrationTaskEnriched =>
	({
		id: "00000000-0000-0000-0000-000000000001" as UUID,
		connection_id: "00000000-0000-0000-0000-000000000002" as UUID,
		business_id: "00000000-0000-0000-0000-000000000003" as UUID,
		platform_id: INTEGRATION_ID.PLAID,
		platform_category_code: "BANKING",
		platform_code: "plaid",
		task_code: "fetch_public_records",
		task_status: TASK_STATUS.CREATED,
		business_score_trigger_id: "00000000-0000-0000-0000-000000000004" as UUID,
		trigger_type: "ONBOARDING_INVITE",
		created_at: "2025-01-01T00:00:00.000Z",
		updated_at: "2025-01-01T00:00:00.000Z",
		...overrides
	}) as IBusinessIntegrationTaskEnriched;

const createMockConnection = (overrides: Partial<IDBConnection> = {}): IDBConnection =>
	({
		id: "00000000-0000-0000-0000-000000000002" as UUID,
		business_id: "00000000-0000-0000-0000-000000000003" as UUID,
		platform_id: INTEGRATION_ID.PLAID,
		connection_status: CONNECTION_STATUS.SUCCESS,
		created_at: "2025-01-01T00:00:00.000Z",
		updated_at: "2025-01-01T00:00:00.000Z",
		...overrides
	}) as IDBConnection;

describe("core/taskExecution/index", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("TASK_CODE_TO_EXECUTION_FUNCTION", () => {
		it("should have a function for fetch_public_records", () => {
			expect(typeof TASK_CODE_TO_EXECUTION_FUNCTION.fetch_public_records).toBe("function");
		});

		it("should have a function for fetch_adverse_media", () => {
			expect(typeof TASK_CODE_TO_EXECUTION_FUNCTION.fetch_adverse_media).toBe("function");
		});

		it("should have a function for fetch_assets_data", () => {
			expect(typeof TASK_CODE_TO_EXECUTION_FUNCTION.fetch_assets_data).toBe("function");
		});

		it("should have noOperation for manual task code", () => {
			expect(typeof TASK_CODE_TO_EXECUTION_FUNCTION.manual).toBe("function");
		});

		it("should have noOperation for fetch_google_profile", () => {
			expect(typeof TASK_CODE_TO_EXECUTION_FUNCTION.fetch_google_profile).toBe("function");
		});

		it("should have noOperation for electronic_signature", () => {
			expect(typeof TASK_CODE_TO_EXECUTION_FUNCTION.electronic_signature).toBe("function");
		});
	});

	describe("executeIntegrationTask", () => {
		it("should return early when task_status is IN_PROGRESS", async () => {
			const task = createMockTask({ task_status: TASK_STATUS.IN_PROGRESS });
			await executeIntegrationTask(task);
			expect(mockGetConnectionById).not.toHaveBeenCalled();
		});

		it("should return early when task_status is STARTED", async () => {
			const task = createMockTask({ task_status: TASK_STATUS.STARTED });
			await executeIntegrationTask(task);
			expect(mockGetConnectionById).not.toHaveBeenCalled();
		});

		it("should return early when task_status is SUCCESS", async () => {
			const task = createMockTask({ task_status: TASK_STATUS.SUCCESS });
			await executeIntegrationTask(task);
			expect(mockGetConnectionById).not.toHaveBeenCalled();
		});

		it("should update task to FAILED and throw when connection is not found", async () => {
			mockGetConnectionById.mockResolvedValue(null);
			const task = createMockTask();

			await expect(executeIntegrationTask(task)).rejects.toThrow("No connection found for task");

			expect(mockSqlTransaction).toHaveBeenCalledWith(
				expect.any(Array),
				expect.arrayContaining([
					[TASK_STATUS.FAILED, expect.any(String), task.id],
					expect.arrayContaining([expect.any(String), task.id, TASK_STATUS.FAILED, expect.stringContaining("No connection found for task")])
				])
			);
		});

		it("should skip execution and return when connection status is not SUCCESS (and no override)", async () => {
			mockGetConnectionById.mockResolvedValue(createMockConnection({ connection_status: CONNECTION_STATUS.CREATED }));
			const task = createMockTask({ task_code: "fetch_public_records" });

			await executeIntegrationTask(task);

			expect(mockGetConnectionById).toHaveBeenCalledWith(task.connection_id);
			// Execution skipped because connection status is not SUCCESS (isConnectionValid returns false)
			expect(mockGetConnectionById).toHaveBeenCalledWith(task.connection_id);
		});

		it("should call getConnectionById with task.connection_id", async () => {
			mockGetConnectionById.mockResolvedValue(createMockConnection());
			const task = createMockTask({ task_code: "fetch_public_records" });

			await executeIntegrationTask(task);

			expect(mockGetConnectionById).toHaveBeenCalledWith(task.connection_id);
		});
	});

	describe("noOperation (via TASK_CODE_TO_EXECUTION_FUNCTION.manual)", () => {
		it("should update task to FAILED and call prepareIntegrationDataForScore", async () => {
			const task = createMockTask({ task_code: "manual" });
			const connection = createMockConnection();

			await TASK_CODE_TO_EXECUTION_FUNCTION.manual(connection, task);

			expect(mockSqlTransaction).toHaveBeenCalledWith(
				expect.any(Array),
				expect.arrayContaining([
					[TASK_STATUS.FAILED, expect.any(String), task.id],
					expect.arrayContaining([
						expect.any(String),
						task.id,
						TASK_STATUS.FAILED,
						expect.stringMatching(/Task not found for task manual/)
					])
				])
			);
			expect(mockPrepareIntegrationDataForScore).toHaveBeenCalledWith(task.id, task.trigger_type);
		});
	});
});
