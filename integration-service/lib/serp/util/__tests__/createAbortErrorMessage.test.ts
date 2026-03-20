import type { IBusinessIntegrationTaskEnriched } from "#types/db";
import type { UUID } from "crypto";
import { createAbortErrorMessage } from "../createAbortErrorMessage";
import { TaskCode } from "#constants";

describe("createAbortErrorMessage", () => {
	const createMockTask = (mockTaskID: UUID, mockTaskCode: string): IBusinessIntegrationTaskEnriched<unknown> => {
		return {
			id: mockTaskID,
			task_code: mockTaskCode
		} as IBusinessIntegrationTaskEnriched<unknown>;
	};

	const mockBusinessID: UUID = "business-456" as UUID;

	it("should create a properly formatted abort error message", () => {
		/** Arrange */
		const mockTaskID = "task-123" as UUID;
		const mockTaskCode: TaskCode = "fetch_google_profile";
		const mockTask = createMockTask(mockTaskID, mockTaskCode);
		const reasonForAborting = "missing required data";

		/** Act */
		const result = createAbortErrorMessage(mockTask, mockBusinessID, reasonForAborting);

		/** Assert */
		expect(result).toBe(
			"Aborting task task-123 with code fetch_google_profile for business business-456 because missing required data"
		);
	});

	it("should handle different reasons for aborting", () => {
		/** Arrange */
		const mockTaskID = "task-123" as UUID;
		const mockTaskCode: TaskCode = "fetch_google_profile";
		const mockTask = createMockTask(mockTaskID, mockTaskCode);
		const reasonForAborting = "API rate limit exceeded";

		/** Act */
		const result = createAbortErrorMessage(mockTask, mockBusinessID, reasonForAborting);

		/** Assert */
		expect(result).toBe(
			"Aborting task task-123 with code fetch_google_profile for business business-456 because API rate limit exceeded"
		);
	});

	it("should work with different task codes", () => {
		/** Arrange */
		const mockTaskID = "task-123" as UUID;
		const mockTaskCode: TaskCode = "different_task_code" as TaskCode;
		const differentTask = createMockTask(mockTaskID, mockTaskCode);
		const reasonForAborting = "test reason";

		/** Act */
		const result = createAbortErrorMessage(differentTask, mockBusinessID, reasonForAborting);

		/** Assert */
		expect(result).toBe(
			"Aborting task task-123 with code different_task_code for business business-456 because test reason"
		);
	});
});
