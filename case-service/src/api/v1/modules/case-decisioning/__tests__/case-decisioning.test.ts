// @ts-nocheck

import { randomUUID } from "crypto";
import { WorkflowDecisioningApiError } from "../error";
import { ERROR_CODES } from "#constants";
import { StatusCodes } from "http-status-codes";
import { sqlQuery } from "#helpers/index";
import { workflowDecisioning } from "../case-decisioning";

jest.mock("#helpers/index", () => ({
	sqlQuery: jest.fn(),
	logger: {
		error: jest.fn()
	}
}));

describe("WorkflowDecisioning", () => {
	const customerId = randomUUID();

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getWorkflowDecisioningConfiguration", () => {
		it("should return active_decisioning_type when configuration exists", async () => {
			(sqlQuery as jest.Mock).mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						active_decisioning_type: "custom_workflow"
					}
				]
			});

			const result = await workflowDecisioning.getWorkflowDecisioningConfiguration(customerId);

			expect(result.active_decisioning_type).toBe("custom_workflow");
			expect(sqlQuery).toHaveBeenCalledTimes(1);
			expect(sqlQuery).toHaveBeenCalledWith({
				sql: expect.stringContaining("SELECT active_decisioning_type"),
				values: [customerId]
			});
		});

		it("should return default worth_score when configuration does not exist", async () => {
			(sqlQuery as jest.Mock).mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			const result = await workflowDecisioning.getWorkflowDecisioningConfiguration(customerId);

			expect(result.active_decisioning_type).toBe("worth_score");
			expect(sqlQuery).toHaveBeenCalledTimes(1);
		});

		it("should handle database errors correctly", async () => {
			(sqlQuery as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

			await expect(workflowDecisioning.getWorkflowDecisioningConfiguration(customerId)).rejects.toThrow(
				WorkflowDecisioningApiError
			);
		});
	});

	describe("updateWorkflowDecisioningConfiguration", () => {
		it("should update active_decisioning_type to custom_workflow", async () => {
			(sqlQuery as jest.Mock).mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						active_decisioning_type: "custom_workflow"
					}
				]
			});

			const result = await workflowDecisioning.updateWorkflowDecisioningConfiguration(customerId, "custom_workflow");

			expect(result.active_decisioning_type).toBe("custom_workflow");
			expect(sqlQuery).toHaveBeenCalledTimes(1);
			expect(sqlQuery).toHaveBeenCalledWith({
				sql: expect.stringContaining("INSERT INTO public.data_cases_decisioning_config"),
				values: [customerId, "custom_workflow"]
			});
		});

		it("should update active_decisioning_type to worth_score", async () => {
			(sqlQuery as jest.Mock).mockResolvedValueOnce({
				rowCount: 1,
				rows: [
					{
						active_decisioning_type: "worth_score"
					}
				]
			});

			const result = await workflowDecisioning.updateWorkflowDecisioningConfiguration(customerId, "worth_score");

			expect(result.active_decisioning_type).toBe("worth_score");
			expect(sqlQuery).toHaveBeenCalledTimes(1);
		});

		it("should handle database errors correctly", async () => {
			(sqlQuery as jest.Mock).mockRejectedValueOnce(new Error("Database error"));

			await expect(
				workflowDecisioning.updateWorkflowDecisioningConfiguration(customerId, "custom_workflow")
			).rejects.toThrow(WorkflowDecisioningApiError);
		});

		it("should throw error when update returns no rows", async () => {
			(sqlQuery as jest.Mock).mockResolvedValueOnce({
				rowCount: 0,
				rows: []
			});

			const error = await workflowDecisioning
				.updateWorkflowDecisioningConfiguration(customerId, "custom_workflow")
				.catch(e => e);
			expect(error).toBeInstanceOf(WorkflowDecisioningApiError);
			expect(error.message).toBe("Failed to update workflow decisioning configuration");
			expect(error.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
			expect(error.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR);
		});
	});
});
