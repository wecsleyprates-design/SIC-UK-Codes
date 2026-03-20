// @ts-nocheck
// Mock knex/db - MUST be before any imports that use db
jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

// Mock OpenAI first to prevent initialization issues
jest.mock("openai");

// Mock config to prevent initialization issues
jest.mock("#configs/env.config", () => ({
	envConfig: {
		OPEN_AI_KEY: "MOCK_OPEN_AI_KEY",
		AWS_COGNITO_REGION: "us-east-1",
		AWS_ACCESS_KEY_ID: "test-access-key",
		AWS_ACCESS_KEY_SECRET: "test-secret-key",
		AWS_KMS_KEY_ID: "test-kms-key"
	}
}));

// Mock redis to avoid real connections
jest.mock("#helpers/redis", () => ({
	redis: {
		hgetall: jest.fn(),
		hset: jest.fn(),
		expire: jest.fn(),
		hincrby: jest.fn(),
		delete: jest.fn()
	},
	createClusterClient: jest.fn(),
	redisConnect: jest.fn(),
	redisConfig: {
		ecClusterMode: false,
		conn: {}
	}
}));

// Mock kafka producer/consumer to avoid socket handles
jest.mock("#helpers/kafka", () => ({
	producer: {
		send: jest.fn(),
		init: jest.fn()
	},
	consumer: {
		init: jest.fn(),
		run: jest.fn()
	}
}));

// Mock taskQueue to prevent the entire import chain that leads to OpenAI
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

// Mock state update queue to avoid bull/redis initialization
jest.mock("#workers/stateUpdateQueue", () => ({
	stateQueue: {}
}));

// Mock all the heavy dependencies
jest.mock("#helpers", () => ({
	...jest.requireActual("#helpers"),
	sqlQuery: jest.fn(),
	sqlTransaction: jest.fn(),
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn()
	},
	producer: {
		send: jest.fn()
	},
	internalGetCaseByID: jest.fn()
}));

// Mock validateMessage
jest.mock("#middlewares", () => ({
	validateMessage: jest.fn()
}));

import { NotificationEventHandler } from "../notifications";
import { kafkaEvents } from "#constants/index";
import type { CompletionEvent } from "#helpers/integrationsCompletionTracker";
import { db } from "#helpers/knex";
import { createTracker, Tracker } from "knex-mock-client";

describe("NotificationEventHandler", () => {
	let handler: NotificationEventHandler;
	let tracker: Tracker;

	// Helper to create a mock CompletionEvent payload
	const createMockPayload = (overrides: Partial<CompletionEvent> = {}): CompletionEvent => ({
		category_id: 7,
		category_name: "KYB",
		business_id: "123e4567-e89b-12d3-a456-426614174000" as `${string}-${string}-${string}-${string}-${string}`,
		customer_id: "223e4567-e89b-12d3-a456-426614174000" as `${string}-${string}-${string}-${string}-${string}`,
		case_id: null,
		score_trigger_id: null,
		completion_state: {
			business_id: "123e4567-e89b-12d3-a456-426614174000" as `${string}-${string}-${string}-${string}-${string}`,
			customer_id: null,
			case_id: null,
			score_trigger_id: null,
			required_tasks_by_category: {},
			completed_categories: [],
			completed_tasks: [],
			timed_out_tasks: [],
			tasks_ignored: 0,
			tasks_required: 0,
			tasks_completed: 0,
			tasks_timed_out: 0,
			is_all_complete: false,
			timeout_threshold_seconds: 480,
			started_at: null,
			initialized_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		},
		action: "category_completed",
		...overrides
	});

	beforeAll(() => {
		tracker = createTracker(db);
	});

	afterAll(() => {
		tracker.reset();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		tracker.reset();
		handler = new NotificationEventHandler();
	});

	describe("handleCategoryCompletion", () => {
		it("should skip when category_id is 'all'", async () => {
			const payload = createMockPayload({ category_id: "all" });

			await handler.handleCategoryCompletion(payload);

			// Should not have any database queries when skipping
			expect(tracker.history.insert).toHaveLength(0);
		});

		it("should insert record for numeric category_id", async () => {
			tracker.on.insert(/data_category_completions_history/).response([]);

			const payload = createMockPayload({ category_id: 7 });

			await handler.handleCategoryCompletion(payload);

			expect(tracker.history.insert).toHaveLength(1);
			const insertQuery = tracker.history.insert[0];
			expect(insertQuery.bindings).toContain(payload.business_id);
			expect(insertQuery.bindings).toContain(payload.category_id);
		});

		it("should handle null customer_id", async () => {
			tracker.on.insert(/data_category_completions_history/).response([]);

			const payload = createMockPayload({ category_id: 7, customer_id: null });

			await handler.handleCategoryCompletion(payload);

			expect(tracker.history.insert).toHaveLength(1);
		});

		it("should throw error on database failure", async () => {
			tracker.on.insert(/data_category_completions_history/).simulateError("Database error");

			const payload = createMockPayload({ category_id: 7, customer_id: null });

			await expect(handler.handleCategoryCompletion(payload)).rejects.toThrow("Database error");
		});
	});

	describe("handleEvent", () => {
		it("should handle INTEGRATION_CATEGORY_COMPLETE event", async () => {
			tracker.on.insert(/data_category_completions_history/).response([]);

			const payload = {
				event: kafkaEvents.INTEGRATION_CATEGORY_COMPLETE,
				...createMockPayload({ category_id: 7 })
			};

			const message = {
				value: Buffer.from(JSON.stringify(payload))
			};

			await handler.handleEvent(message);

			expect(tracker.history.insert).toHaveLength(1);
		});
	});
});
