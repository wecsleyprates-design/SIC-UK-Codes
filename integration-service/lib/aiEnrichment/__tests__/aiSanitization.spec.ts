import { INTEGRATION_ID, FEATURE_FLAGS } from "#constants";
import { AISanitization, type AISanitizationResponse } from "../aiSanitization";
import { FactEngine } from "#lib/facts/factEngine";
import { getOrCreateConnection, platformFactory } from "#helpers/platformHelper";
import { logger } from "#helpers/logger";
import { getFlagValue } from "#helpers/LaunchDarkly";
import { createTracker } from "knex-mock-client";
import { db } from "#helpers/knex";
import { DeferrableTaskManager } from "#api/v1/modules/tasks/deferrableTaskManager";

import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types/db";
import type OpenAI from "openai";
import type { Knex } from "knex";
import type BullQueue from "#helpers/bull-queue";
import type { EntityMatching } from "#lib/entityMatching/entityMatching";
import type { BusinessAddress } from "#helpers/api";
import type { UUID } from "crypto";

// Mock dependencies
jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn()
	}
}));

jest.mock("#helpers/LaunchDarkly", () => ({
	getFlagValue: jest.fn()
}));

jest.mock("#helpers/platformHelper", () => ({
	getOrCreateConnection: jest.fn(),
	platformFactory: jest.fn()
}));

jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

jest.mock("#lib/facts", () => ({
	allFacts: [
		{ name: "business_names_submitted" },
		{ name: "business_addresses_submitted" },
		{ name: "internal_platform_matches" }
	]
}));

jest.mock("#lib/facts/rules", () => ({
	combineFacts: jest.fn()
}));

describe("AISanitization", () => {
	let aiSanitization: AISanitization;
	let mockDbConnection: IDBConnection;
	let mockDb: Knex;
	let mockOpenaiClient: OpenAI;
	let mockBullQueue: BullQueue;
	let tracker: any;

	const businessID: UUID = "00000000-0000-0000-0000-000000000001";
	const connectionID: UUID = "00000000-0000-0000-0000-000000000002";
	const taskID: UUID = "00000000-0000-0000-0000-000000000003";
	const triggerID: UUID = "00000000-0000-0000-0000-000000000004";

	beforeEach(() => {
		tracker = createTracker(db);

		mockDbConnection = {
			id: connectionID,
			business_id: businessID,
			platform_id: INTEGRATION_ID.AI_SANITIZATION,
			connection_type: "ai_sanitization",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			configuration: {},
			connection_status: "SUCCESS"
		} as IDBConnection;

		mockDb = db;

		mockOpenaiClient = {
			chat: {
				completions: {
					create: jest.fn()
				}
			}
		} as unknown as OpenAI;

		mockBullQueue = {
			addJob: jest.fn().mockResolvedValue({ id: "123" }),
			queue: { name: "ai-enrichment" },
			getDelay: jest.fn(),
			isSandboxedJob: jest.fn()
		} as unknown as BullQueue;

		aiSanitization = new AISanitization({
			dbConnection: mockDbConnection,
			db: mockDb,
			openaiClient: mockOpenaiClient,
			bullQueue: mockBullQueue
		});

		// Mock static methods
		(AISanitization as any).getEnrichedTask = jest.fn();
		(AISanitization as any).selectFacts = jest.fn().mockReturnValue([]);
		aiSanitization.updateTaskStatus = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("constructor", () => {
		it("should initialize with correct integration ID", () => {
			expect(AISanitization.PLATFORM_ID).toBe(INTEGRATION_ID.AI_SANITIZATION);
		});

		it("should set up fact engine with correct facts", () => {
			expect(AISanitization.DEPENDENT_FACTS).toEqual({
				business_names_submitted: { minimumSources: 1 },
				business_addresses_submitted: { minimumSources: 1 },
				internal_platform_matches: { minimumSources: 0, maximumSources: 1 }
			});
		});

		it("should set up dependent tasks correctly", () => {
			expect(AISanitization.DEPENDENT_TASKS).toEqual({
				fetch_business_entity_verification: [
					{ platformId: INTEGRATION_ID.ZOOMINFO, timeoutInSeconds: 60 * 3 },
					{ platformId: INTEGRATION_ID.OPENCORPORATES, timeoutInSeconds: 60 * 3 },
					{ platformId: INTEGRATION_ID.CANADA_OPEN, timeoutInSeconds: 60 * 3 }
				],
				fetch_public_records: [{ platformId: INTEGRATION_ID.EQUIFAX, timeoutInSeconds: 60 * 3 }],
				fetch_business_entity_website_details: [{ platformId: INTEGRATION_ID.SERP_SCRAPE, timeoutInSeconds: 60 * 3 }]
			});
		});

		it("should set task timeout correctly", () => {
			expect(AISanitization.TASK_TIMEOUT_IN_SECONDS).toBe(60 * 3);
		});
	});

	describe("calculateConfidence", () => {
		it("should return correct confidence values", () => {
			expect(aiSanitization["calculateConfidence"]("HIGH")).toBe(0.2);
			expect(aiSanitization["calculateConfidence"]("MED")).toBe(0.15);
			expect(aiSanitization["calculateConfidence"]("LOW")).toBe(0.1);
			expect(aiSanitization["calculateConfidence"](null)).toBe(0);
		});
	});

	describe("enqueueTask", () => {
		it("should enqueue task when feature flag is enabled", async () => {
			(getFlagValue as jest.Mock).mockResolvedValue(true);
			const parentEnqueueTask = jest.spyOn(Object.getPrototypeOf(aiSanitization), "enqueueTask");

			await aiSanitization.enqueueTask(taskID);

			expect(getFlagValue).toHaveBeenCalledWith(FEATURE_FLAGS.TIG_50_NAME_ADDR_SANITIZATION);
			expect(parentEnqueueTask).toHaveBeenCalledWith(taskID);
		});

		it("should not enqueue task when feature flag is disabled", async () => {
			const parentEnqueueTask = jest.spyOn(DeferrableTaskManager.prototype as any, "enqueueTask");
			(getFlagValue as jest.Mock).mockResolvedValue(false);

			await aiSanitization.enqueueTask(taskID);

			expect(getFlagValue).toHaveBeenCalledWith(FEATURE_FLAGS.TIG_50_NAME_ADDR_SANITIZATION);
			expect(parentEnqueueTask).not.toHaveBeenCalled();
		});

		it("should pass job options when provided", async () => {
			// Clear any previous calls
			jest.clearAllMocks();
			(getFlagValue as jest.Mock).mockResolvedValue(true);
			const mockSuperEnqueueTask = jest
				.spyOn(Object.getPrototypeOf(aiSanitization), "enqueueTask")
				.mockResolvedValue(undefined);
			const jobOpts = { delay: 1000 };

			await aiSanitization.enqueueTask(taskID, jobOpts);

			expect(mockSuperEnqueueTask).toHaveBeenCalledWith(taskID, jobOpts);
		});
	});

	describe("executePostProcessing", () => {
		let mockEntityMatching: EntityMatching;
		let mockEnrichedTask: IBusinessIntegrationTaskEnriched;

		beforeEach(() => {
			mockEntityMatching = {
				createTaskForCode: jest.fn(),
				processTask: jest.fn()
			} as unknown as EntityMatching;

			mockEnrichedTask = {
				id: taskID,
				business_id: businessID,
				business_score_trigger_id: triggerID,
				platform_id: INTEGRATION_ID.AI_SANITIZATION,
				platform_code: "ai_sanitization",
				platform_category_code: "MANUAL",
				task_code: "fetch_business_entity_verification",
				task_label: "AI Sanitization",
				connection_id: connectionID,
				integration_task_id: 1,
				task_status: "CREATED",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
				metadata: {}
			} as IBusinessIntegrationTaskEnriched;

			(getOrCreateConnection as jest.Mock).mockResolvedValue(mockDbConnection);
			(platformFactory as jest.Mock).mockReturnValue(mockEntityMatching);
		});

		it("should invoke entity matching when new addresses and names are found", async () => {
			const response: AISanitizationResponse = {
				reasoning: "test reasoning",
				new_names: ["New Business Name"],
				new_addresses: ["123 Main St"],
				new_addresses_components: [
					{
						is_physical: true,
						line1: "123 Main St",
						line2: "",
						city: "Test City",
						state: "CA",
						postal_code: "12345",
						postal_full: "12345-6789",
						country: "US",
						confidence: "HIGH"
					}
				],
				is_sole_proprietor: false,
				sole_proprietor_confidence: "MED",
				new_address_confidence: "HIGH",
				new_name_confidence: "HIGH",
				confidence: "HIGH"
			};

			(mockEntityMatching.createTaskForCode as jest.Mock).mockResolvedValue("new-task-id");

			await aiSanitization.executePostProcessing(mockEnrichedTask, response);

			expect(getOrCreateConnection).toHaveBeenCalledWith(businessID, INTEGRATION_ID.ENTITY_MATCHING);
			expect(platformFactory).toHaveBeenCalledWith({ dbConnection: mockDbConnection });
			expect(mockEntityMatching.createTaskForCode).toHaveBeenCalledWith({
				taskCode: "fetch_business_entity_verification",
				scoreTriggerId: triggerID
			});
			expect(mockEntityMatching.processTask).toHaveBeenCalledWith({ taskId: "new-task-id" });
		});

		it("should not invoke entity matching when no new addresses or names", async () => {
			const response: AISanitizationResponse = {
				reasoning: "test reasoning",
				new_names: [],
				new_addresses: [],
				new_addresses_components: [],
				is_sole_proprietor: false,
				sole_proprietor_confidence: "MED",
				new_address_confidence: "LOW",
				new_name_confidence: "HIGH",
				confidence: "LOW"
			};

			await aiSanitization.executePostProcessing(mockEnrichedTask, response);

			expect(getOrCreateConnection).not.toHaveBeenCalled();
			expect(platformFactory).not.toHaveBeenCalled();
		});

		it("should handle entity matching errors gracefully", async () => {
			const response: AISanitizationResponse = {
				reasoning: "test reasoning",
				new_names: ["New Business Name"],
				new_addresses: ["123 Main St"],
				new_addresses_components: [
					{
						is_physical: true,
						line1: "123 Main St",
						line2: "",
						city: "Test City",
						state: "CA",
						postal_code: "12345",
						postal_full: "12345-6789",
						country: "US",
						confidence: "HIGH"
					}
				],
				is_sole_proprietor: false,
				sole_proprietor_confidence: "MED",
				new_address_confidence: "HIGH",
				new_name_confidence: "HIGH",
				confidence: "HIGH"
			};

			const error = new Error("Entity matching failed");
			(mockEntityMatching.createTaskForCode as jest.Mock).mockResolvedValue("new-task-id");
			(mockEntityMatching.processTask as jest.Mock).mockRejectedValue(error);

			await aiSanitization.executePostProcessing(mockEnrichedTask, response);

			expect(logger.error).toHaveBeenCalledWith(
				error,
				"Error invoking Entity Matching task: Error: Entity matching failed"
			);
		});

		it("should handle null task ID from entity matching", async () => {
			const response: AISanitizationResponse = {
				reasoning: "test reasoning",
				new_names: ["New Business Name"],
				new_addresses: ["123 Main St"],
				new_addresses_components: [
					{
						is_physical: true,
						line1: "123 Main St",
						line2: "",
						city: "Test City",
						state: "CA",
						postal_code: "12345",
						postal_full: "12345-6789",
						country: "US",
						confidence: "HIGH"
					}
				],
				is_sole_proprietor: false,
				sole_proprietor_confidence: "MED",
				new_address_confidence: "HIGH",
				new_name_confidence: "HIGH",
				confidence: "HIGH"
			};

			(mockEntityMatching.createTaskForCode as jest.Mock).mockResolvedValue(null);

			await aiSanitization.executePostProcessing(mockEnrichedTask, response);

			expect(mockEntityMatching.processTask).not.toHaveBeenCalled();
		});
	});

	describe("getPrompt", () => {
		it("should generate prompt with business names only", async () => {
			const params = {
				business_names_submitted: ["Test Business", "Another Business"],
				business_addresses_submitted: []
			};

			const prompt = await aiSanitization.getPrompt(params);

			expect(prompt).toContain("business names:");
			expect(prompt).toContain("Test Business");
			expect(prompt).toContain("Another Business");
			expect(prompt).toContain("business addresses:");
		});

		it("should generate prompt with business addresses only", async () => {
			const addresses: BusinessAddress[] = [
				{
					line_1: "123 Main St",
					apartment: "Suite 100",
					city: "Test City",
					state: "CA",
					postal_code: "12345",
					country: "US",
					mobile: null,
					is_primary: true
				}
			];

			const params = {
				business_names_submitted: [],
				business_addresses_submitted: addresses
			};

			const prompt = await aiSanitization.getPrompt(params);

			expect(prompt).toContain("business addresses:");
			expect(prompt).toContain("123 Main St");
			expect(prompt).toContain("Test City");
			expect(prompt).toContain("business names:");
		});

		it("should generate prompt with both names and addresses", async () => {
			const addresses: BusinessAddress[] = [
				{
					line_1: "123 Main St",
					apartment: "Suite 100",
					city: "Test City",
					state: "CA",
					postal_code: "12345",
					country: "US",
					mobile: null,
					is_primary: true
				}
			];

			const params = {
				business_names_submitted: ["Test Business"],
				business_addresses_submitted: addresses
			};

			const prompt = await aiSanitization.getPrompt(params);

			expect(prompt).toContain("business names:");
			expect(prompt).toContain("Test Business");
			expect(prompt).toContain("business addresses:");
			expect(prompt).toContain("123 Main St");
		});

		it("should handle null/undefined address fields", async () => {
			const addresses: BusinessAddress[] = [
				{
					line_1: "123 Main St",
					apartment: null,
					city: "Test City",
					state: "CA",
					postal_code: "12345",
					country: "US",
					mobile: null,
					is_primary: true
				}
			];

			const params = {
				business_names_submitted: [],
				business_addresses_submitted: addresses
			};

			const prompt = await aiSanitization.getPrompt(params);

			expect(prompt).toContain("business addresses:");
			expect(prompt).toContain("Test City");
			expect(prompt).toContain("CA");
			expect(prompt).toContain("12345");
			expect(prompt).toContain("US");
		});

		it("should include expected prompt structure", async () => {
			const params = {
				business_names_submitted: ["Test Business"],
				business_addresses_submitted: []
			};

			const prompt = await aiSanitization.getPrompt(params);

			expect(prompt).toContain("You are an expert at correcting business names and addresses");
			expect(prompt).toContain("COMMON ADJUSTMENTS TO NAMES:");
			expect(prompt).toContain("COMMON ADJUSTMENTS TO ADDRESSES:");
			expect(prompt).toContain("SOLE PROPRIETORSHIP INFERENCE:");
			expect(prompt).toContain("Return JSON in this format:");
		});

		it("should include examples in the prompt", async () => {
			const params = {
				business_names_submitted: ["Test Business"],
				business_addresses_submitted: []
			};

			const prompt = await aiSanitization.getPrompt(params);

			expect(prompt).toContain("EXAMPLES:");
			expect(prompt).toContain("TSA MEELAP, INC. / TNB MEELAP, INC.");
			expect(prompt).toContain("IBM COMPTER");
			expect(prompt).toContain("ONE THOUSAND MAIN STRET");
		});
	});
});
