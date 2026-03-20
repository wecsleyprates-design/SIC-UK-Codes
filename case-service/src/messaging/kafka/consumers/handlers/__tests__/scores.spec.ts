import { BUSINESS_STATUS, FEATURE_FLAGS, SCORE_TRIGGER } from "#constants/index";
import {
	getCustomersRiskAlertConfigs,
	getCustomerWithPermissions,
	getFlagValue,
	logger,
	producer,
	sqlQuery,
	sqlTransaction
} from "#helpers/index";
import { scoreEventsHandler } from "../scores";
import { workflowDecisioning } from "../../../../../api/v1/modules/case-decisioning/case-decisioning";

// Mock all dependencies
jest.mock("#helpers/index", () => {
	const originalHelpers = jest.requireActual("#helpers/index");
	return {
		...originalHelpers,
		sqlQuery: jest.fn(),
		sqlTransaction: jest.fn(),
		producer: {
			send: jest.fn()
		},
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn()
		},
		getFlagValue: jest.fn(),
		getCustomerWithPermissions: jest.fn(),
		getCustomersRiskAlertConfigs: jest.fn(),
		fetchCaseVerifications: jest.fn(),
		getBusinessKybDetails: jest.fn()
	};
});

jest.mock("#middlewares/index", () => ({
	validateMessage: jest.fn()
}));

jest.mock("#common/index", () => ({
	sendWebhookEvent: jest.fn()
}));

jest.mock("../../../../../api/v1/modules/case-decisioning/case-decisioning", () => ({
	workflowDecisioning: {
		getWorkflowDecisioningConfiguration: jest.fn()
	}
}));

jest.mock("../../../../../api/v1/modules/case-management/case-management", () => ({
	caseManagementService: {
		getCaseStatusUpdatedWebhookPayload: jest.fn()
	}
}));

describe("ScoreEventsHandler", () => {
	const mockCustomerID = "123e4567-e89b-12d3-a456-426614174000";
	const mockBusinessID = "123e4567-e89b-12d3-a456-426614174001";
	const mockCaseID = "123e4567-e89b-12d3-a456-426614174002";

	const basePayload = {
		business_id: mockBusinessID,
		case_id: mockCaseID,
		customer_id: mockCustomerID,
		score_trigger_id: "123e4567-e89b-12d3-a456-426614174003",
		trigger_type: SCORE_TRIGGER.ONBOARDING_INVITE,
		score_100: 75,
		score_850: 750,
		risk_level: "LOW",
		decision: "APPROVED",
		created_at: new Date().toISOString()
	};

	beforeEach(() => {
		jest.clearAllMocks();

		// Default mocks
		(sqlQuery as jest.Mock).mockResolvedValue({
			rows: [
				{
					customer_id: mockCustomerID,
					business_id: mockBusinessID,
					business_status: BUSINESS_STATUS.VERIFIED,
					business_mcc_id: "1234",
					name: "Test Business"
				}
			]
		});

		(sqlTransaction as jest.Mock).mockResolvedValue(undefined);
		(getFlagValue as jest.Mock).mockResolvedValue(false);
		(getCustomerWithPermissions as jest.Mock).mockResolvedValue({});
		(getCustomersRiskAlertConfigs as jest.Mock).mockResolvedValue({
			customer: {
				risk_alert_statuses: { risk_alerts_status: false },
				score_config: {
					LOW: { measurement_config: { min: 700 } },
					MODERATE: { measurement_config: { min: 500, max: 699 } }
				}
			},
			admin: {
				risk_alert_statuses: { risk_alerts_status: false },
				score_config: {
					LOW: { measurement_config: { min: 700 } },
					MODERATE: { measurement_config: { min: 500, max: 699 } }
				}
			}
		});
		(workflowDecisioning.getWorkflowDecisioningConfiguration as jest.Mock).mockResolvedValue({
			active_decisioning_type: "worth_score"
		});
	});

	describe("scoreCalculated - active_decisioning_type and feature flag logic", () => {
		it("should skip case status update when feature flag is enabled and active_decisioning_type is custom_workflow", async () => {
			// Arrange
			const payload = { ...basePayload };
			// Mock FOTC_79_APPROVAL_WORKFLOWS flag = true
			(getFlagValue as jest.Mock).mockResolvedValueOnce(true);
			// Mock PAT_926_PAUSE_DECISIONING flag = false
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			(workflowDecisioning.getWorkflowDecisioningConfiguration as jest.Mock).mockResolvedValue({
				active_decisioning_type: "custom_workflow"
			});

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(workflowDecisioning.getWorkflowDecisioningConfiguration).toHaveBeenCalledWith(mockCustomerID);
			expect(getFlagValue).toHaveBeenCalledWith(
				(FEATURE_FLAGS as any).FOTC_79_APPROVAL_WORKFLOWS,
				{ key: "customer", kind: "customer", customer_id: mockCustomerID },
				false
			);
			expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Skipping case status update for case"));

			// Verify that case status update queries are NOT added
			const transactionCalls = (sqlTransaction as jest.Mock).mock.calls;
			const updateCaseQuery = transactionCalls.find(call => {
				const queries = call[0];
				return queries.some((query: string) => query.includes("UPDATE data_cases SET status"));
			});
			expect(updateCaseQuery).toBeUndefined();
		});

		it("should update case status when feature flag is enabled but active_decisioning_type is worth_score", async () => {
			// Arrange
			const payload = { ...basePayload };
			// Mock FOTC_79_APPROVAL_WORKFLOWS flag = true
			(getFlagValue as jest.Mock).mockResolvedValueOnce(true);
			// Mock PAT_926_PAUSE_DECISIONING flag = false
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			(workflowDecisioning.getWorkflowDecisioningConfiguration as jest.Mock).mockResolvedValue({
				active_decisioning_type: "worth_score"
			});

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(workflowDecisioning.getWorkflowDecisioningConfiguration).toHaveBeenCalledWith(mockCustomerID);
			expect(getFlagValue).toHaveBeenCalledWith(
				(FEATURE_FLAGS as any).FOTC_79_APPROVAL_WORKFLOWS,
				{ key: "customer", kind: "customer", customer_id: mockCustomerID },
				false
			);
			// Verify that case status update queries ARE added
			const transactionCalls = (sqlTransaction as jest.Mock).mock.calls;
			const updateCaseQuery = transactionCalls.find(call => {
				const queries = call[0];
				return queries.some((query: string) => query.includes("UPDATE data_cases SET status"));
			});
			expect(updateCaseQuery).toBeDefined();
		});

		it("should update case status when feature flag is disabled even if active_decisioning_type is custom_workflow", async () => {
			// Arrange
			const payload = { ...basePayload };
			// Mock FOTC_79_APPROVAL_WORKFLOWS flag = false
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			// Mock PAT_926_PAUSE_DECISIONING flag = false
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			(workflowDecisioning.getWorkflowDecisioningConfiguration as jest.Mock).mockResolvedValue({
				active_decisioning_type: "custom_workflow"
			});

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(workflowDecisioning.getWorkflowDecisioningConfiguration).toHaveBeenCalledWith(mockCustomerID);
			expect(getFlagValue).toHaveBeenCalledWith(
				(FEATURE_FLAGS as any).FOTC_79_APPROVAL_WORKFLOWS,
				{ key: "customer", kind: "customer", customer_id: mockCustomerID },
				false
			);
			expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining("Skipping case status update"));

			// Verify that case status update queries ARE added
			const transactionCalls = (sqlTransaction as jest.Mock).mock.calls;
			const updateCaseQuery = transactionCalls.find(call => {
				const queries = call[0];
				return queries.some((query: string) => query.includes("UPDATE data_cases SET status"));
			});
			expect(updateCaseQuery).toBeDefined();
		});

		it("should update case status when feature flag is disabled and active_decisioning_type is worth_score", async () => {
			// Arrange
			const payload = { ...basePayload };
			// Mock FOTC_79_APPROVAL_WORKFLOWS flag = false
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			// Mock PAT_926_PAUSE_DECISIONING flag = false
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			(workflowDecisioning.getWorkflowDecisioningConfiguration as jest.Mock).mockResolvedValue({
				active_decisioning_type: "worth_score"
			});

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(workflowDecisioning.getWorkflowDecisioningConfiguration).toHaveBeenCalledWith(mockCustomerID);
			expect(getFlagValue).toHaveBeenCalledWith(
				(FEATURE_FLAGS as any).FOTC_79_APPROVAL_WORKFLOWS,
				{ key: "customer", kind: "customer", customer_id: mockCustomerID },
				false
			);

			// Verify that case status update queries ARE added
			const transactionCalls = (sqlTransaction as jest.Mock).mock.calls;
			const updateCaseQuery = transactionCalls.find(call => {
				const queries = call[0];
				return queries.some((query: string) => query.includes("UPDATE data_cases SET status"));
			});
			expect(updateCaseQuery).toBeDefined();
		});

		it("should continue normally when workflowDecisioning.getWorkflowDecisioningConfiguration throws an error", async () => {
			// Arrange
			const payload = { ...basePayload };
			const mockError = new Error("Database connection error");
			(workflowDecisioning.getWorkflowDecisioningConfiguration as jest.Mock).mockRejectedValue(mockError);

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(workflowDecisioning.getWorkflowDecisioningConfiguration).toHaveBeenCalledWith(mockCustomerID);
			expect(logger.error).toHaveBeenCalledWith(
				mockError,
				expect.stringContaining("Error getting workflow decisioning configuration")
			);

			// Verify that case status update queries ARE added (normal behavior continues)
			const transactionCalls = (sqlTransaction as jest.Mock).mock.calls;
			const updateCaseQuery = transactionCalls.find(call => {
				const queries = call[0];
				return queries.some((query: string) => query.includes("UPDATE data_cases SET status"));
			});
			expect(updateCaseQuery).toBeDefined();
		});

		it("should not call workflowDecisioning when customerID is null", async () => {
			// Arrange
			const payload = { ...basePayload, customer_id: null };
			(sqlQuery as jest.Mock).mockResolvedValueOnce({
				rows: [
					{
						customer_id: null,
						business_id: mockBusinessID,
						business_status: BUSINESS_STATUS.VERIFIED,
						business_mcc_id: "1234",
						name: "Test Business"
					}
				]
			});

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(workflowDecisioning.getWorkflowDecisioningConfiguration).not.toHaveBeenCalled();
			expect(getFlagValue).not.toHaveBeenCalledWith(
				(FEATURE_FLAGS as any).FOTC_79_APPROVAL_WORKFLOWS,
				expect.anything(),
				expect.anything()
			);

			// Verify that case status update queries ARE added (normal behavior)
			const transactionCalls = (sqlTransaction as jest.Mock).mock.calls;
			const updateCaseQuery = transactionCalls.find(call => {
				const queries = call[0];
				return queries.some((query: string) => query.includes("UPDATE data_cases SET status"));
			});
			expect(updateCaseQuery).toBeDefined();
		});

		it("should not check feature flag when case_id is null", async () => {
			// Arrange
			const payload = { ...basePayload, case_id: null };

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(getFlagValue).not.toHaveBeenCalledWith(
				(FEATURE_FLAGS as any).FOTC_79_APPROVAL_WORKFLOWS,
				expect.anything(),
				expect.anything()
			);
		});

		it("should handle MONITORING_REFRESH with null case_id without calling getCaseStatusUpdatedWebhookPayload", async () => {
			// Arrange
			const payload = {
				...basePayload,
				case_id: null,
				trigger_type: "MONITORING_REFRESH"
			};
			const getCaseStatusUpdatedWebhookPayloadSpy = jest.spyOn(
				require("../../../../../api/v1/modules/case-management/case-management").caseManagementService,
				"getCaseStatusUpdatedWebhookPayload"
			);

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			// Verify getCaseStatusUpdatedWebhookPayload was never called with null
			expect(getCaseStatusUpdatedWebhookPayloadSpy).not.toHaveBeenCalled();
			// Verify business score was still inserted
			expect(sqlTransaction).toHaveBeenCalled();
			const transactionCalls = (sqlTransaction as jest.Mock).mock.calls;
			expect(transactionCalls.length).toBeGreaterThan(0);
			// Verify no case status update queries were added
			const updateCaseQuery = transactionCalls.find(call => {
				const queries = call[0];
				return queries.some((query: string) => query.includes("UPDATE data_cases SET status"));
			});
			expect(updateCaseQuery).toBeUndefined();

			getCaseStatusUpdatedWebhookPayloadSpy.mockRestore();
		});

		it("should handle SUBSCRIPTION_REFRESH with null case_id without errors", async () => {
			// Arrange
			const payload = {
				...basePayload,
				case_id: null,
				trigger_type: "SUBSCRIPTION_REFRESH"
			};

			// Act & Assert - should not throw
			await expect(scoreEventsHandler.scoreCalculated(payload)).resolves.not.toThrow();

			// Verify business score was inserted
			expect(sqlTransaction).toHaveBeenCalled();
		});

		it("should handle MANUAL_REFRESH with null case_id without errors", async () => {
			// Arrange
			const payload = {
				...basePayload,
				case_id: null,
				trigger_type: "MANUAL_REFRESH"
			};

			// Act & Assert - should not throw
			await expect(scoreEventsHandler.scoreCalculated(payload)).resolves.not.toThrow();

			// Verify business score was inserted
			expect(sqlTransaction).toHaveBeenCalled();
		});

		it("should get active_decisioning_type from helper when customerID is available", async () => {
			// Arrange
			const payload = { ...basePayload };
			(workflowDecisioning.getWorkflowDecisioningConfiguration as jest.Mock).mockResolvedValue({
				active_decisioning_type: "custom_workflow"
			});

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(workflowDecisioning.getWorkflowDecisioningConfiguration).toHaveBeenCalledWith(mockCustomerID);
			expect(workflowDecisioning.getWorkflowDecisioningConfiguration).toHaveBeenCalledTimes(1);
		});

		it("should use default worth_score when helper returns worth_score", async () => {
			// Arrange
			const payload = { ...basePayload };
			// Mock FOTC_79_APPROVAL_WORKFLOWS flag = true
			(getFlagValue as jest.Mock).mockResolvedValueOnce(true);
			// Mock PAT_926_PAUSE_DECISIONING flag = false
			(getFlagValue as jest.Mock).mockResolvedValueOnce(false);
			(workflowDecisioning.getWorkflowDecisioningConfiguration as jest.Mock).mockResolvedValue({
				active_decisioning_type: "worth_score"
			});

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(workflowDecisioning.getWorkflowDecisioningConfiguration).toHaveBeenCalledWith(mockCustomerID);
			// Should not skip update when it's worth_score
			expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining("Skipping case status update"));
		});

		it("should handle undefined caseDetails.rows[0].name gracefully", async () => {
			// Arrange
			const payload = { ...basePayload };
			// Mock case query with row that has undefined name
			(sqlQuery as jest.Mock).mockResolvedValueOnce({
				rows: [
					{
						customer_id: mockCustomerID,
						business_id: mockBusinessID,
						business_status: BUSINESS_STATUS.VERIFIED,
						business_mcc_id: "1234",
						name: undefined
					}
				]
			});
			// Mock subsequent queries for first score
			(sqlQuery as jest.Mock).mockResolvedValue({ rows: [] });

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("SCORE: score calculated event"));
			// Verify code continues execution without throwing error
			const producerCalls = (producer.send as jest.Mock).mock.calls;
			expect(producer.send).toHaveBeenCalled();
			// Verify audit message was sent
			const auditCall = producerCalls.find(
				call => call[0]?.messages?.[0]?.value?.event === "score_generated_audit_event"
			);
			expect(auditCall).toBeDefined();
			if (auditCall) {
				// business_name should be undefined
				expect(auditCall[0].messages[0].value.business_name).toBeUndefined();
			}
			// Should not throw error when name is undefined
			expect(logger.error).not.toHaveBeenCalled();
		});

		it("should handle undefined businessDetails.rows[0].name gracefully", async () => {
			// Arrange
			const payload = { ...basePayload, case_id: null };
			// Mock business query with row that has undefined name
			(sqlQuery as jest.Mock).mockResolvedValueOnce({
				rows: [
					{
						name: undefined
					}
				]
			});
			// Mock subsequent queries
			(sqlQuery as jest.Mock).mockResolvedValue({ rows: [] });

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("SCORE: score calculated event"));
			// Verify code continues execution without throwing error
			expect(producer.send).toHaveBeenCalled();
			// Verify audit message was sent
			const producerCalls = (producer.send as jest.Mock).mock.calls;
			const auditCall = producerCalls.find(
				call => call[0]?.messages?.[0]?.value?.event === "score_generated_audit_event"
			);
			expect(auditCall).toBeDefined();
			if (auditCall) {
				// business_name should be undefined
				expect(auditCall[0].messages[0].value.business_name).toBeUndefined();
			}
			// Should not throw error when name is undefined
			expect(logger.error).not.toHaveBeenCalled();
		});

		it("should return early when businessDetails has no rows", async () => {
			// Arrange
			const payload = { ...basePayload, case_id: null };
			// Mock business query with empty rows
			(sqlQuery as jest.Mock).mockResolvedValueOnce({
				rows: []
			});

			// Act
			await scoreEventsHandler.scoreCalculated(payload);

			// Assert
			expect(logger.warn).toHaveBeenCalledWith(`No business found with id: ${mockBusinessID}`);
			// Verify function returns early and audit is not sent
			expect(producer.send).not.toHaveBeenCalled();
		});
	});
});
