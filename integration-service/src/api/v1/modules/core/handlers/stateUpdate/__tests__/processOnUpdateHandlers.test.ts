import { logger } from "#helpers/logger";
import { processOnUpdateHandlers, registeredOnUpdateHandlers } from "../index";
import { websiteScanBusinessStateUpdateHandler } from "../handlers/worthWebsiteScanning";
import { entityMatchStateUpdateHandler } from "../handlers/entityMatchRequest";
import { middeskBusinessStateUpdateHandler } from "../handlers/middeskBusinessEntityVerification";
import { IntegrationsCompletionTracker } from "#helpers/integrationsCompletionTracker";
import { INTEGRATION_CATEGORIES } from "#constants";

jest.mock("#core/scoreTrigger", () => ({
	BusinessScoreTriggerRepository: jest.fn().mockImplementation(() => ({
		getBusinessScoreTriggerByBusinessId: jest.fn().mockResolvedValue({ id: "test-business-score-trigger-id" })
	}))
}));

jest.mock("#helpers/integrationsCompletionTracker", () => {
	const initializeTracking = jest.fn().mockResolvedValue(undefined);

	return {
		IntegrationsCompletionTracker: {
			getRequiredTasksByTaskType: jest.fn().mockReturnValue({
				[7]: ["middesk:fetch_business_entity_verification"]
			}),
			initializeTracking
		}
	};
});

jest.mock("../handlers/middeskBusinessEntityVerification", () => {
	const run = jest.fn(async () => undefined);
	return {
		middeskBusinessStateUpdateHandler: {
			trigger: "synchronous",
			id: "middesk-rerun-on-update",
			description: "test middesk handler",
			platformCode: "MIDDESK",
			taskCode: "fetch_business_entity_verification",
			fields: ["data_businesses.tin"],
			run
		}
	};
});

jest.mock("../handlers/worthWebsiteScanning", () => {
	const run = jest.fn(async () => undefined);
	return {
		websiteScanBusinessStateUpdateHandler: {
			trigger: "asynchronous",
			id: "worth-website-scan-on-update",
			description: "test worth handler",
			platformCode: "WORTH_WEBSITE_SCANNING",
			taskCode: "fetch_business_entity_website_details",
			fields: ["data_businesses.official_website"],
			run
		}
	};
});

jest.mock("../handlers/entityMatchRequest", () => {
	const run = jest.fn(async () => undefined);
	return {
		entityMatchStateUpdateHandler: {
			trigger: "asynchronous",
			id: "entity-match-rerun-on-update",
			description: "test entity match handler",
			platformCode: "ENTITY_MATCHING",
			taskCode: "fetch_business_entity_verification",
			fields: [["field_a", "field_b"]],
			run
		}
	};
});

const loggerMock = logger as jest.Mocked<typeof logger>;
const integrationsCompletionTrackerMock = IntegrationsCompletionTracker as jest.Mocked<
	typeof IntegrationsCompletionTracker
>;

const basePayload = {
	businessId: "biz-1",
	customerId: "cust-1",
	source: "test-source",
	changes: {} as Record<string, unknown>
};

describe("processOnUpdateHandlers", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns all handlers as skipped when no fields changed", async () => {
		const result = await processOnUpdateHandlers({ ...basePayload, changes: {} }, "synchronous");

		expect(result.triggered).toEqual([]);
		expect(result.skipped).toEqual(registeredOnUpdateHandlers.map(handler => handler.id));
		expect(loggerMock.debug).toHaveBeenCalledWith(
			{ businessId: basePayload.businessId, source: basePayload.source },
			"[stateUpdateHandler] No applicable changes detected; skipping handlers."
		);
	});

	it("executes only handlers matching the trigger and changed fields", async () => {
		const result = await processOnUpdateHandlers(
			{ ...basePayload, changes: { "data_businesses.tin": "new-tin" } },
			"synchronous"
		);

		expect(middeskBusinessStateUpdateHandler.run).toHaveBeenCalledTimes(1);
		expect(middeskBusinessStateUpdateHandler.run).toHaveBeenCalledWith(
			expect.objectContaining({ businessScoreTriggerId: "test-business-score-trigger-id" })
		);
		expect(websiteScanBusinessStateUpdateHandler.run).not.toHaveBeenCalled();
		expect(entityMatchStateUpdateHandler.run).not.toHaveBeenCalled();
		expect(integrationsCompletionTrackerMock.getRequiredTasksByTaskType).toHaveBeenCalledWith([
			"middesk:fetch_business_entity_verification"
		]);
		expect(integrationsCompletionTrackerMock.getRequiredTasksByTaskType).toHaveBeenCalledWith([
			"middesk:fetch_business_entity_verification"
		]);
		expect(integrationsCompletionTrackerMock.initializeTracking).toHaveBeenCalledTimes(1);
		expect(integrationsCompletionTrackerMock.initializeTracking).toHaveBeenCalledWith(
			expect.objectContaining({
				business_id: basePayload.businessId,
				customer_id: basePayload.customerId,
				business_score_trigger_id: "test-business-score-trigger-id"
			}),
			{ [INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION]: ["middesk:fetch_business_entity_verification"] }
		);
		expect(result.triggered).toEqual(["middesk-rerun-on-update"]);
		// non-synchronous handlers
		const nonSynchronousHandlers = registeredOnUpdateHandlers
			.filter(handler => handler.trigger !== "synchronous")
			.map(handler => handler.id);
		expect(result.skipped.sort()).toEqual(nonSynchronousHandlers.sort());
		expect(result.errors).toBeUndefined();
	});

	it("does not execute async handlers when invoked synchronously (even if fields match)", async () => {
		const result = await processOnUpdateHandlers(
			{
				...basePayload,
				changes: {
					"data_businesses.tin": "123",
					"data_businesses.official_website": "https://example.com"
				}
			},
			"synchronous"
		);

		expect(middeskBusinessStateUpdateHandler.run).toHaveBeenCalledTimes(1);
		expect(websiteScanBusinessStateUpdateHandler.run).not.toHaveBeenCalled();
		expect(entityMatchStateUpdateHandler.run).not.toHaveBeenCalled();
		expect(result.triggered).toEqual(["middesk-rerun-on-update"]);
	});

	it("satisfies AND field groups case-insensitively", async () => {
		const result = await processOnUpdateHandlers(
			{ ...basePayload, changes: { FIELD_A: "a", field_b: "b" } },
			"asynchronous"
		);

		expect(entityMatchStateUpdateHandler.run).toHaveBeenCalledWith(
			expect.objectContaining({
				changedFields: expect.arrayContaining(["FIELD_A", "field_b"]),
				businessScoreTriggerId: "test-business-score-trigger-id"
			})
		);
		expect(integrationsCompletionTrackerMock.getRequiredTasksByTaskType).toHaveBeenCalledWith([
			"entity_matching:fetch_business_entity_verification"
		]);
		expect(integrationsCompletionTrackerMock.initializeTracking).toHaveBeenCalledWith(
			expect.objectContaining({
				business_id: basePayload.businessId,
				customer_id: basePayload.customerId,
				business_score_trigger_id: "test-business-score-trigger-id"
			}),
			{ [INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION]: ["middesk:fetch_business_entity_verification"] }
		);
		expect(result.triggered).toEqual(["entity-match-rerun-on-update"]);
		expect(result.skipped).not.toContain(["entity-match-rerun-on-update"]);
		expect(result.skipped).not.toHaveLength(0);
	});

	it("does not execute sync handlers when invoked asynchronously (even if fields match)", async () => {
		const result = await processOnUpdateHandlers(
			{
				...basePayload,
				changes: {
					"data_businesses.tin": "123",
					"data_businesses.official_website": "https://example.com"
				}
			},
			"asynchronous"
		);

		expect(middeskBusinessStateUpdateHandler.run).not.toHaveBeenCalled();
		expect(websiteScanBusinessStateUpdateHandler.run).toHaveBeenCalledTimes(1);
		expect(entityMatchStateUpdateHandler.run).not.toHaveBeenCalled();
		expect(result.triggered).toEqual(["worth-website-scan-on-update"]);
	});

	it("continues executing handlers and surfaces errors", async () => {
		const error = new Error("website failure");
		(websiteScanBusinessStateUpdateHandler.run as jest.Mock).mockRejectedValueOnce(error);
		(entityMatchStateUpdateHandler.run as jest.Mock).mockResolvedValueOnce(undefined);

		const result = await processOnUpdateHandlers(
			{
				...basePayload,
				changes: {
					"data_businesses.official_website": "https://example.com",
					"data_businesses.tin": "123",
					field_a: "value",
					field_b: "value"
				}
			},
			"asynchronous"
		);

		expect(websiteScanBusinessStateUpdateHandler.run).toHaveBeenCalledTimes(1);
		expect(entityMatchStateUpdateHandler.run).toHaveBeenCalledTimes(1);
		expect(integrationsCompletionTrackerMock.getRequiredTasksByTaskType).toHaveBeenCalledWith(
			expect.arrayContaining([
				"worth_website_scanning:fetch_business_entity_website_details",
				"entity_matching:fetch_business_entity_verification"
			])
		);
		expect(integrationsCompletionTrackerMock.initializeTracking).toHaveBeenCalledWith(
			expect.objectContaining({
				business_id: basePayload.businessId,
				customer_id: basePayload.customerId,
				business_score_trigger_id: "test-business-score-trigger-id"
			}),
			{ [INTEGRATION_CATEGORIES.BUSINESS_ENTITY_VERIFICATION]: ["middesk:fetch_business_entity_verification"] }
		);
		expect(result.triggered).toContain("entity-match-rerun-on-update");
		expect(result.skipped).toContain("middesk-rerun-on-update");
		expect(result.errors).toEqual([{ handlerId: "worth-website-scan-on-update", error }]);
	});
});
