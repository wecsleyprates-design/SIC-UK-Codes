import { controller } from "../controller";
import { TaskManager } from "../taskManager";
import { INTEGRATION_ID, TASK_STATUS, CONNECTION_STATUS } from "#constants";
import { platformFactory, getOrCreateConnection } from "#helpers/platformHelper";
import type { UUID } from "crypto";
import type { Request } from "express";
import type { Response } from "#types/index";

jest.mock("#helpers/platformHelper");
jest.mock("../taskManager");
// Mock catchAsync to directly execute the function instead of wrapping it
jest.mock("#utils/catchAsync", () => ({
	catchAsync: fn => fn
}));

describe("Tasks Controller", () => {
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;
	let mockNext: jest.Mock;

	beforeEach(() => {
		mockRequest = {
			params: {},
			body: {},
			query: {},
			headers: {
				authorization: "Bearer test-token"
			}
		};
		mockResponse = {
			jsend: {
				success: jest.fn(),
				error: jest.fn()
			}
		} as any;
		mockNext = jest.fn();

		jest.clearAllMocks();
	});

	describe("generateAndExecuteTaskForBusiness", () => {
		const businessId = "00000000-0000-0000-0000-000000000001" as UUID;
		const platformCode = "MIDDESK";
		const taskCode = "fetch_business_entity_verification";
		const taskId = "00000000-0000-0000-0000-000000000002" as UUID;
		const referenceId = "00000000-0000-0000-0000-000000000003" as UUID;
		const scoreTriggerId = "00000000-0000-0000-0000-000000000004" as UUID;

		const mockDbConnection = {
			id: "00000000-0000-0000-0000-000000000005" as UUID,
			business_id: businessId,
			platform_id: INTEGRATION_ID.MIDDESK,
			connection_status: CONNECTION_STATUS.SUCCESS,
			created_at: "2024-01-01T00:00:00.000Z",
			updated_at: "2024-01-01T00:00:00.000Z",
			configuration: {}
		};

		const mockTask = {
			id: taskId,
			business_id: businessId,
			connection_id: mockDbConnection.id,
			platform_id: INTEGRATION_ID.MIDDESK,
			task_status: TASK_STATUS.CREATED,
			task_code: taskCode,
			created_at: "2024-01-01T00:00:00.000Z",
			updated_at: "2024-01-01T00:00:00.000Z",
			platform_code: "middesk",
			platform_category_code: "VERIFICATION",
			task_label: "fetch",
			integration_task_id: 1
		};

		const mockPlatform = {
			getOrCreateTaskForCode: jest.fn().mockResolvedValue(taskId),
			processTask: jest.fn().mockResolvedValue(true)
		};

		beforeEach(() => {
			mockRequest.params = {
				business_id: businessId,
				platformCode,
				taskCode
			};
			mockRequest.body = {
				reference_id: referenceId,
				metadata: { test: "data" },
				score_trigger_id: scoreTriggerId
			};

			(getOrCreateConnection as jest.Mock).mockResolvedValue(mockDbConnection);
			(platformFactory as jest.Mock).mockReturnValue(mockPlatform);
			let getEnrichedTaskCallCount = 0;
			(TaskManager.getEnrichedTask as jest.Mock).mockImplementation(async id => {
				getEnrichedTaskCallCount++;
				if (id === taskId) {
					return {
						...mockTask,
						task_status: getEnrichedTaskCallCount > 1 ? TASK_STATUS.SUCCESS : TASK_STATUS.CREATED
					};
				}
				return null;
			});
		});

		it("should successfully generate and execute a task", async () => {
			await controller.generateAndExecuteTaskForBusiness(mockRequest as Request, mockResponse as Response, mockNext);

			expect(getOrCreateConnection).toHaveBeenCalledWith(businessId, INTEGRATION_ID.MIDDESK);
			expect(platformFactory).toHaveBeenCalledWith({
				dbConnection: mockDbConnection,
				authorization: "Bearer test-token"
			});
			expect(mockPlatform.getOrCreateTaskForCode).toHaveBeenCalledWith({
				taskCode,
				reference_id: referenceId,
				metadata: { test: "data" },
				scoreTriggerId: scoreTriggerId
			});
			expect(TaskManager.getEnrichedTask).toHaveBeenCalledTimes(2);
			expect(mockPlatform.processTask).toHaveBeenCalledWith({ taskId, task: mockTask });
			expect(mockResponse.jsend?.success).toHaveBeenCalledWith({
				dbConnection: mockDbConnection,
				originalTask: mockTask,
				updatedTask: { ...mockTask, task_status: TASK_STATUS.SUCCESS }
			});
		});
	});
});
