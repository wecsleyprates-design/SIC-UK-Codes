import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { TASK_STATUS, INTEGRATION_ID } from "#constants";
import { UUID } from "crypto";
import type { IBusinessIntegrationTaskEnriched } from "#types/db";
import { executeIntegrationTask } from "#core/taskExecution";
import { BusinessEventsHandler } from "../business";

jest.mock("#workers/taskHandler", () => ({
	taskQueue: {
		add: jest.fn(),
		process: jest.fn(),
		on: jest.fn()
	}
}));
// Mock kafkaToQueue function
jest.mock("#messaging/index", () => ({
	kafkaToQueue: jest.fn()
}));
// Mock state update queue to avoid Bull/Redis initialization
jest.mock("#workers/stateUpdateQueue", () => ({
	stateQueue: {}
}));
jest.mock("openai");
jest.mock("#core/taskExecution", () => ({
	executeIntegrationTask: jest.fn().mockResolvedValue(undefined)
}));

describe("BusinessEventsHandler", () => {
	const mockCaseId = "case-123" as UUID;
	const mockBusinessId = "business-456" as UUID;

	beforeEach(() => {
		jest.mocked(executeIntegrationTask).mockClear();
	});

	// Helper function to create mock tasks
	const createMockTask = (overrides: Partial<IBusinessIntegrationTaskEnriched>): IBusinessIntegrationTaskEnriched =>
		({
			id: "default-task-id" as UUID,
			task_code: "default_task",
			platform_code: "DEFAULT",
			platform_id: 1,
			platform_category_code: "DEFAULT_CATEGORY",
			task_label: "Default Task",
			reference_id: undefined,
			task_status: TASK_STATUS.CREATED,
			created_at: "2023-01-01T00:00:00.000Z" as const,
			updated_at: "2023-01-01T00:00:00.000Z" as const,
			case_id: mockCaseId,
			business_id: mockBusinessId,
			connection_id: "connection-id" as UUID,
			integration_task_id: "integration-task-id" as UUID,
			...overrides
		}) as IBusinessIntegrationTaskEnriched;

	describe(`BEST-113: Deduplicating Tasks`, () => {
		it("should only execute one task for a given taskCode and platformId", async () => {
			const mockTasks: IBusinessIntegrationTaskEnriched[] = [
				// expect these three efx credit score tasks to coalesce to just one task
				createMockTask({
					id: "task-1" as UUID,
					task_code: "fetch_bureau_score_owners",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "owner-1" as UUID
				}),
				// Expect to go
				createMockTask({
					id: "task-2" as UUID,
					task_code: "fetch_bureau_score_owners",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "owner-2" as UUID
				}),
				// Expect to go
				createMockTask({
					id: "task-3" as UUID,
					task_code: "fetch_bureau_score_owners",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: undefined
				}),
				// Expect this one to stay (default rule to use reference_id)
				createMockTask({
					id: "task-4" as UUID,
					task_code: "fetch_public_records",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "abcd"
				}),
				// Expect this one to stay
				createMockTask({
					id: "task-5" as UUID,
					task_code: "fetch_public_records",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "efgh"
				}),
				// Expect this one to go
				createMockTask({
					id: "task-6" as UUID,
					task_code: "fetch_public_records",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "efgh"
				})
			];

			const spy = jest.spyOn(TaskManager, "findEnrichedTasks").mockResolvedValue(mockTasks);
			const handler = new BusinessEventsHandler();
			await handler.executeTasksOnCaseSubmit({ case_id: mockCaseId, business_id: mockBusinessId });

			expect(spy).toHaveBeenCalledWith([{ column: "case_id", value: mockCaseId, operator: "=" }]);
			expect(executeIntegrationTask).toHaveBeenCalledWith(mockTasks[0]);
			expect(executeIntegrationTask).toHaveBeenCalledWith(mockTasks[3]);
			expect(executeIntegrationTask).toHaveBeenCalledWith(mockTasks[4]);

			expect(executeIntegrationTask).toHaveBeenCalledTimes(3);
		});

		it("follows logic for picking the `best` task (most recent)", async () => {
			const mockTasks: IBusinessIntegrationTaskEnriched[] = [
				createMockTask({
					id: "task-1" as UUID,
					task_code: "fetch_bureau_score_owners",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "owner-1" as UUID,
					updated_at: "2023-01-01T00:00:00.000Z" as const
				}),
				createMockTask({
					id: "task-2" as UUID,
					task_code: "fetch_bureau_score_owners",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "owner-1" as UUID,
					updated_at: "2024-01-01T00:00:00.000Z" as const
				}),
				createMockTask({
					id: "task-3" as UUID,
					task_code: "fetch_bureau_score_owners",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "owner-1" as UUID,
					updated_at: "2025-01-01T00:00:00.000Z" as const
				})
			];
			const spy = jest.spyOn(TaskManager, "findEnrichedTasks").mockResolvedValue(mockTasks);
			const handler = new BusinessEventsHandler();
			await handler.executeTasksOnCaseSubmit({ case_id: mockCaseId, business_id: mockBusinessId });

			expect(spy).toHaveBeenCalledWith([{ column: "case_id", value: mockCaseId, operator: "=" }]);
			expect(executeIntegrationTask).toHaveBeenCalledTimes(1);
			expect(executeIntegrationTask).toHaveBeenCalledWith(mockTasks[2]);
		});
		it("follows logic for picking the `best` task (prefer a pending state)", async () => {
			const mockTasks: IBusinessIntegrationTaskEnriched[] = [
				createMockTask({
					id: "task-1" as UUID,
					task_code: "fetch_bureau_score_owners",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "owner-1" as UUID,
					updated_at: "2023-01-01T00:00:00.000Z" as const,
					task_status: TASK_STATUS.CREATED
				}),
				createMockTask({
					id: "task-2" as UUID,
					task_code: "fetch_bureau_score_owners",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "owner-1" as UUID,
					updated_at: "2024-01-01T00:00:00.000Z" as const,
					task_status: TASK_STATUS.SUCCESS
				}),
				createMockTask({
					id: "task-3" as UUID,
					task_code: "fetch_bureau_score_owners",
					platform_code: "EQUIFAX",
					platform_id: INTEGRATION_ID.EQUIFAX,
					reference_id: "owner-1" as UUID,
					updated_at: "2025-01-01T00:00:00.000Z" as const,
					task_status: TASK_STATUS.SUCCESS
				})
			];
			const spy = jest.spyOn(TaskManager, "findEnrichedTasks").mockResolvedValue(mockTasks);
			const handler = new BusinessEventsHandler();
			await handler.executeTasksOnCaseSubmit({ case_id: mockCaseId, business_id: mockBusinessId });

			expect(spy).toHaveBeenCalledWith([{ column: "case_id", value: mockCaseId, operator: "=" }]);
			expect(executeIntegrationTask).toHaveBeenCalledTimes(1);
			expect(executeIntegrationTask).toHaveBeenCalledWith(mockTasks[0]);
		});
	});
});
