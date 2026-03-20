import { db } from "#helpers";
import { notificationEventsHandler } from "../notification";
import { IntegrationCategoryCompleted } from "../types";

// Mock the helpers
jest.mock("#helpers/index", () => {
	const originalHelpers = jest.requireActual("#helpers/index");
	return {
		...originalHelpers,
		db: jest.fn(() => ({
			insert: jest.fn().mockReturnThis(),
			onConflict: jest.fn().mockReturnThis(),
			merge: jest.fn().mockResolvedValue(undefined)
		})) as jest.Mock,
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn()
		}
	};
});

describe("CaseEventsHandler", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("handleIntegrationCategoryComplete", () => {
		const mockPayload: IntegrationCategoryCompleted = {
			business_id: "123e4567-e89b-12d3-a456-426614174000",
			case_id: "123e4567-e89b-12d3-a456-426614174000",
			customer_id: "123e4567-e89b-12d3-a456-426614174000",
			completion_state: {
				tasks_completed: 5,
				tasks_required: 10,
				required_tasks: ["task1", "task2"],
				completed_tasks: ["task1"],
				is_all_complete: false,
				business_id: "123e4567-e89b-12d3-a456-426614174000",
				case_id: "123e4567-e89b-12d3-a456-426614174000"
			},
			category_name: "all",
			category_id: "all"
		};
		it("should upsert and allow is_complete when category_name is 'all'", async () => {
			const mergeMock = jest.fn().mockResolvedValue(undefined);
			const onConflictMock = jest.fn().mockReturnValue({ merge: mergeMock });
			const insertMock = jest.fn().mockReturnValue({ onConflict: onConflictMock });
			(db as unknown as jest.Mock).mockReturnValue({ insert: insertMock });

			await notificationEventsHandler.handleIntegrationCategoryComplete(mockPayload);

			expect(db).toHaveBeenCalledWith("data_integration_tasks_progress");
			expect(insertMock).toHaveBeenCalledWith({
				case_id: mockPayload.case_id,
				business_id: mockPayload.business_id,
				customer_id: mockPayload.customer_id,
				is_complete: mockPayload.completion_state.is_all_complete,
				total_tasks: mockPayload.completion_state.tasks_required,
				completed_tasks: mockPayload.completion_state.tasks_completed,
				required_tasks_array: JSON.stringify(mockPayload.completion_state.required_tasks),
				completed_tasks_array: JSON.stringify(mockPayload.completion_state.completed_tasks)
			});
			expect(onConflictMock).toHaveBeenCalledWith("case_id");
			expect(mergeMock).toHaveBeenCalled();
		});

		it("should upsert without overwriting is_complete when category_name is not 'all'", async () => {
			const mergeMock = jest.fn().mockResolvedValue(undefined);
			const onConflictMock = jest.fn().mockReturnValue({ merge: mergeMock });
			const insertMock = jest.fn().mockReturnValue({ onConflict: onConflictMock });
			(db as unknown as jest.Mock).mockReturnValue({ insert: insertMock });

			const payload = { ...mockPayload, category_name: "banking" } as IntegrationCategoryCompleted;
			await notificationEventsHandler.handleIntegrationCategoryComplete(payload);

			expect(db).toHaveBeenCalledWith("data_integration_tasks_progress");
			expect(insertMock).toHaveBeenCalled();
			expect(onConflictMock).toHaveBeenCalledWith("case_id");
			// merge called with specific columns excluding is_complete
			expect(mergeMock).toHaveBeenCalledWith([
				"business_id",
				"customer_id",
				"total_tasks",
				"completed_tasks",
				"required_tasks_array",
				"completed_tasks_array"
			]);
		});
	});
});
