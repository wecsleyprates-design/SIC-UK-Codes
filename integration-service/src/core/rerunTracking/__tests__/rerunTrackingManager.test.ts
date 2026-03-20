import { RerunTrackingManager } from "../rerunTrackingManager";
import { IntegrationsCompletionTracker } from "#helpers/integrationsCompletionTracker";
import { SCORE_TRIGGER } from "#constants";
import type { UUID } from "crypto";

jest.mock("#helpers/integrationsCompletionTracker");
jest.mock("#helpers/logger", () => ({
	logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const mockMergeAndInitializeTracking =
	IntegrationsCompletionTracker.mergeAndInitializeTracking as jest.MockedFunction<
		typeof IntegrationsCompletionTracker.mergeAndInitializeTracking
	>;
const mockGetRequiredTasksByTaskType =
	IntegrationsCompletionTracker.getRequiredTasksByTaskType as jest.MockedFunction<
		typeof IntegrationsCompletionTracker.getRequiredTasksByTaskType
	>;

const MOCK_BUSINESS_ID = "00000000-0000-0000-0000-000000000001" as UUID;
const MOCK_CUSTOMER_ID = "00000000-0000-0000-0000-000000000002" as UUID;
const MOCK_CASE_ID = "00000000-0000-0000-0000-000000000003" as UUID;
const MOCK_TRIGGER_ID = "00000000-0000-0000-0000-000000000099" as UUID;

const createMockScoreTrigger = (overrides = {}) => ({
	id: MOCK_TRIGGER_ID,
	business_id: MOCK_BUSINESS_ID,
	trigger_type: SCORE_TRIGGER.MANUAL_REFRESH,
	version: 2,
	customer_id: MOCK_CUSTOMER_ID,
	created_at: "2025-01-01T00:00:00.000Z",
	...overrides
});

const createMockConnection = (overrides = {}) => ({
	connection_id: "conn-1",
	platform_id: 1,
	platform_code: "serp_google_profile",
	task_codes: ["fetch_profile"],
	...overrides
});

const createMockRepo = () => ({
	getLatestByBusinessId: jest.fn(),
	create: jest.fn()
});

const createMockCaseClient = () => ({
	getCasesByBusinessId: jest.fn()
});

describe("RerunTrackingManager", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockMergeAndInitializeTracking.mockResolvedValue({} as any);
		mockGetRequiredTasksByTaskType.mockReturnValue({});
	});

	describe("initialize", () => {
		it("should create a score trigger with next version and inherited customer_id", async () => {
			const mockRepo = createMockRepo();
			const mockCaseClient = createMockCaseClient();

			mockRepo.getLatestByBusinessId.mockResolvedValue(
				createMockScoreTrigger({ version: 2, customer_id: MOCK_CUSTOMER_ID })
			);
			mockRepo.create.mockResolvedValue(createMockScoreTrigger({ version: 3 }));
			mockCaseClient.getCasesByBusinessId.mockResolvedValue([{ id: MOCK_CASE_ID }]);

			const manager = new RerunTrackingManager({
				businessScoreTriggerRepository: mockRepo as any,
				caseServiceClient: mockCaseClient as any
			});

			await manager.initialize({
				businessID: MOCK_BUSINESS_ID,
				connectionsWithTasks: [createMockConnection()]
			});

			expect(mockRepo.create).toHaveBeenCalledWith({
				business_id: MOCK_BUSINESS_ID,
				trigger_type: SCORE_TRIGGER.MANUAL_REFRESH,
				version: 3,
				customer_id: MOCK_CUSTOMER_ID
			});
		});

		it("should use version 1 when no existing trigger", async () => {
			const mockRepo = createMockRepo();
			const mockCaseClient = createMockCaseClient();

			mockRepo.getLatestByBusinessId.mockResolvedValue(undefined);
			mockRepo.create.mockResolvedValue(createMockScoreTrigger({ version: 1, customer_id: undefined }));
			mockCaseClient.getCasesByBusinessId.mockResolvedValue([]);

			const manager = new RerunTrackingManager({
				businessScoreTriggerRepository: mockRepo as any,
				caseServiceClient: mockCaseClient as any
			});

			await manager.initialize({
				businessID: MOCK_BUSINESS_ID,
				connectionsWithTasks: [createMockConnection()]
			});

			expect(mockRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ version: 1, customer_id: undefined })
			);
		});

		it("should resolve case_id from case-service", async () => {
			const mockRepo = createMockRepo();
			const mockCaseClient = createMockCaseClient();

			mockRepo.getLatestByBusinessId.mockResolvedValue(undefined);
			mockRepo.create.mockResolvedValue(createMockScoreTrigger());
			mockCaseClient.getCasesByBusinessId.mockResolvedValue([{ id: MOCK_CASE_ID }]);

			const manager = new RerunTrackingManager({
				businessScoreTriggerRepository: mockRepo as any,
				caseServiceClient: mockCaseClient as any
			});

			const result = await manager.initialize({
				businessID: MOCK_BUSINESS_ID,
				connectionsWithTasks: [createMockConnection()]
			});

			expect(result.caseId).toBe(MOCK_CASE_ID);
			expect(mockCaseClient.getCasesByBusinessId).toHaveBeenCalledWith(MOCK_BUSINESS_ID);
		});

		it("should gracefully handle case-service failure with null case_id", async () => {
			const mockRepo = createMockRepo();
			const mockCaseClient = createMockCaseClient();

			mockRepo.getLatestByBusinessId.mockResolvedValue(undefined);
			mockRepo.create.mockResolvedValue(createMockScoreTrigger());
			mockCaseClient.getCasesByBusinessId.mockRejectedValue(new Error("case-service down"));

			const manager = new RerunTrackingManager({
				businessScoreTriggerRepository: mockRepo as any,
				caseServiceClient: mockCaseClient as any
			});

			const result = await manager.initialize({
				businessID: MOCK_BUSINESS_ID,
				connectionsWithTasks: [createMockConnection()]
			});

			expect(result.caseId).toBeNull();
		});

		it("should build TaskTypes from connections and call mergeAndInitializeTracking", async () => {
			const mockRepo = createMockRepo();
			const mockCaseClient = createMockCaseClient();
			/** Simulate all tasks mapping to known categories */
			const mockRequirements = {
				1: ["plaid:fetch_transactions", "plaid:fetch_balances"],
				5: ["serp_google_profile:fetch_profile"]
			};

			mockRepo.getLatestByBusinessId.mockResolvedValue(
				createMockScoreTrigger({ version: 1, customer_id: MOCK_CUSTOMER_ID })
			);
			mockRepo.create.mockResolvedValue(createMockScoreTrigger());
			mockCaseClient.getCasesByBusinessId.mockResolvedValue([{ id: MOCK_CASE_ID }]);
			mockGetRequiredTasksByTaskType.mockReturnValue(mockRequirements as any);

			const connections = [
				createMockConnection({ platform_code: "serp_google_profile", task_codes: ["fetch_profile"] }),
				createMockConnection({ platform_code: "plaid", task_codes: ["fetch_transactions", "fetch_balances"] })
			];

			const manager = new RerunTrackingManager({
				businessScoreTriggerRepository: mockRepo as any,
				caseServiceClient: mockCaseClient as any
			});

			await manager.initialize({
				businessID: MOCK_BUSINESS_ID,
				connectionsWithTasks: connections
			});

			expect(mockGetRequiredTasksByTaskType).toHaveBeenCalledWith([
				"serp_google_profile:fetch_profile",
				"plaid:fetch_transactions",
				"plaid:fetch_balances"
			]);

			/** All tasks were in the mapping, so requirements are passed through as-is */
			expect(mockMergeAndInitializeTracking).toHaveBeenCalledWith(
				{
					business_id: MOCK_BUSINESS_ID,
					customer_id: MOCK_CUSTOMER_ID,
					case_id: MOCK_CASE_ID,
					business_score_trigger_id: MOCK_TRIGGER_ID
				},
				mockRequirements,
				undefined,
				expect.objectContaining({ started_at: expect.any(String) })
			);
		});

		it("should place unmapped tasks under catch-all category 0", async () => {
			const mockRepo = createMockRepo();
			const mockCaseClient = createMockCaseClient();

			/**
			 * Simulate getRequiredTasksByTaskType returning empty — none of the
			 * rerun tasks exist in PLATFORM_PROCESS_MAPPING
			 */
			mockGetRequiredTasksByTaskType.mockReturnValue({});

			mockRepo.getLatestByBusinessId.mockResolvedValue(
				createMockScoreTrigger({ version: 1, customer_id: MOCK_CUSTOMER_ID })
			);
			mockRepo.create.mockResolvedValue(createMockScoreTrigger());
			mockCaseClient.getCasesByBusinessId.mockResolvedValue([{ id: MOCK_CASE_ID }]);

			const connections = [
				createMockConnection({ platform_code: "serp_google_profile", task_codes: ["fetch_google_profile"] })
			];

			const manager = new RerunTrackingManager({
				businessScoreTriggerRepository: mockRepo as any,
				caseServiceClient: mockCaseClient as any
			});

			await manager.initialize({
				businessID: MOCK_BUSINESS_ID,
				connectionsWithTasks: connections
			});

			/** Unmapped tasks should go under category 0 */
			expect(mockMergeAndInitializeTracking).toHaveBeenCalledWith(
				expect.anything(),
				{ 0: ["serp_google_profile:fetch_google_profile"] },
				undefined,
				expect.objectContaining({ started_at: expect.any(String) })
			);
		});

		it("should handle a mix of mapped and unmapped tasks", async () => {
			const mockRepo = createMockRepo();
			const mockCaseClient = createMockCaseClient();

			/** Only plaid tasks map; serp doesn't */
			mockGetRequiredTasksByTaskType.mockReturnValue({
				3: ["plaid:fetch_assets_data"]
			} as any);

			mockRepo.getLatestByBusinessId.mockResolvedValue(
				createMockScoreTrigger({ version: 1, customer_id: MOCK_CUSTOMER_ID })
			);
			mockRepo.create.mockResolvedValue(createMockScoreTrigger());
			mockCaseClient.getCasesByBusinessId.mockResolvedValue([{ id: MOCK_CASE_ID }]);

			const connections = [
				createMockConnection({ platform_code: "serp_google_profile", task_codes: ["fetch_google_profile"] }),
				createMockConnection({ platform_code: "plaid", task_codes: ["fetch_assets_data"] })
			];

			const manager = new RerunTrackingManager({
				businessScoreTriggerRepository: mockRepo as any,
				caseServiceClient: mockCaseClient as any
			});

			await manager.initialize({
				businessID: MOCK_BUSINESS_ID,
				connectionsWithTasks: connections
			});

			expect(mockMergeAndInitializeTracking).toHaveBeenCalledWith(
				expect.anything(),
				{
					3: ["plaid:fetch_assets_data"],
					0: ["serp_google_profile:fetch_google_profile"]
				},
				undefined,
				expect.objectContaining({ started_at: expect.any(String) })
			);
		});

		it("should return scoreTriggerId and caseId", async () => {
			const mockRepo = createMockRepo();
			const mockCaseClient = createMockCaseClient();

			mockRepo.getLatestByBusinessId.mockResolvedValue(undefined);
			mockRepo.create.mockResolvedValue(createMockScoreTrigger());
			mockCaseClient.getCasesByBusinessId.mockResolvedValue([{ id: MOCK_CASE_ID }]);

			const manager = new RerunTrackingManager({
				businessScoreTriggerRepository: mockRepo as any,
				caseServiceClient: mockCaseClient as any
			});

			const result = await manager.initialize({
				businessID: MOCK_BUSINESS_ID,
				connectionsWithTasks: [createMockConnection()]
			});

			expect(result).toEqual({
				scoreTriggerId: MOCK_TRIGGER_ID,
				caseId: MOCK_CASE_ID
			});
		});

		it("should pass timeoutThresholdSeconds to mergeAndInitializeTracking", async () => {
			const mockRepo = createMockRepo();
			const mockCaseClient = createMockCaseClient();

			mockRepo.getLatestByBusinessId.mockResolvedValue(undefined);
			mockRepo.create.mockResolvedValue(createMockScoreTrigger());
			mockCaseClient.getCasesByBusinessId.mockResolvedValue([]);

			const manager = new RerunTrackingManager({
				businessScoreTriggerRepository: mockRepo as any,
				caseServiceClient: mockCaseClient as any
			});

			await manager.initialize({
				businessID: MOCK_BUSINESS_ID,
				connectionsWithTasks: [createMockConnection()],
				timeoutThresholdSeconds: 300
			});

			expect(mockMergeAndInitializeTracking).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				300,
				expect.objectContaining({ started_at: expect.any(String) })
			);
		});
	});
});
