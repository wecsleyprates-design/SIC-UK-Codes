import { BusinessEventsHandler } from "../business";
import { UUID } from "crypto";
import { kafkaEvents, kafkaTopics } from "#constants/index";

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
	}
}));

// Mock validateMessage
jest.mock("#middlewares/index", () => ({
	validateMessage: jest.fn()
}));

// Mock the fact engine and related dependencies
jest.mock("#lib/facts", () => ({
	FactEngineWithDefaultOverrides: jest.fn(),
	FactRules: {
		factWithHighestConfidence: jest.fn()
	},
	allFacts: {}
}));

// Mock Kafka producer
jest.mock("#helpers/kafka", () => ({
	producer: {
		send: jest.fn().mockResolvedValue(undefined)
	}
}));

describe("BusinessEventsHandler - calculateBusinessFacts", () => {
	let businessEventsHandler: BusinessEventsHandler;
	let mockFactEngine: jest.Mocked<any>;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mock fact engine instance
		mockFactEngine = {
			applyRules: jest.fn().mockResolvedValue(undefined),
			getResults: jest.fn().mockResolvedValue({})
		};

		// Mock the constructor to return our mock instance
		const { FactEngineWithDefaultOverrides } = require("#lib/facts");
		FactEngineWithDefaultOverrides.mockImplementation(() => mockFactEngine);

		businessEventsHandler = new BusinessEventsHandler();
	});

	afterEach(() => {
		// Clean up any timers or async operations
		jest.clearAllTimers();
	});

	describe("calculateBusinessFacts", () => {
		const mockBusinessId = "00000000-0000-0000-0000-000000000000" as UUID;

		it("should successfully calculate business facts with valid business ID", async () => {
			const payload = { business_id: mockBusinessId };

			await businessEventsHandler.calculateBusinessFacts(payload);

			// Verify FactEngineWithDefaultOverrides was instantiated with correct parameters
			const { FactEngineWithDefaultOverrides, allFacts } = require("#lib/facts");
			expect(FactEngineWithDefaultOverrides).toHaveBeenCalledWith(allFacts, { business: mockBusinessId });

			// Verify applyRules was called with the correct rule
			const { FactRules } = require("#lib/facts");
			expect(mockFactEngine.applyRules).toHaveBeenCalledWith(FactRules.factWithHighestConfidence);

			// Verify getResults was called with the expected result fields
			expect(mockFactEngine.getResults).toHaveBeenCalledWith([
				"source.confidence",
				"source.platformId",
				"source.name",
				"ruleApplied.name",
				"ruleApplied.description",
				"fact.confidence",
				"source.weight",
				"fact.weight"
			]);
		});

		it("should propagate errors from fact engine initialization", async () => {
			const constructorError = new Error("Failed to initialize fact engine");
			const { FactEngineWithDefaultOverrides } = require("#lib/facts");
			FactEngineWithDefaultOverrides.mockImplementation(() => {
				throw constructorError;
			});

			const payload = { business_id: mockBusinessId };

			await expect(businessEventsHandler.calculateBusinessFacts(payload)).rejects.toThrow(
				"Failed to initialize fact engine"
			);
		});

		it("should propagate errors from applyRules method", async () => {
			const applyRulesError = new Error("Failed to apply rules");
			mockFactEngine.applyRules.mockRejectedValue(applyRulesError);

			const payload = { business_id: mockBusinessId };

			await expect(businessEventsHandler.calculateBusinessFacts(payload)).rejects.toThrow("Failed to apply rules");

			const { FactRules } = require("#lib/facts");
			expect(mockFactEngine.applyRules).toHaveBeenCalledWith(FactRules.factWithHighestConfidence);
			expect(mockFactEngine.getResults).not.toHaveBeenCalled();
		});

		it("should NOT emit Kafka event when case_id is not provided", async () => {
			const { producer } = require("#helpers/kafka");
			const payload = { business_id: mockBusinessId };

			await businessEventsHandler.calculateBusinessFacts(payload);

			expect(producer.send).not.toHaveBeenCalled();
		});
	});

	describe("calculateBusinessFacts - with case_id", () => {
		const mockBusinessId = "00000000-0000-0000-0000-000000000000" as UUID;
		const mockCaseId = "11111111-1111-1111-1111-111111111111" as UUID;
		const mockCustomerId = "22222222-2222-2222-2222-222222222222" as UUID;

		it("should emit APPLICATION_EDIT_FACTS_READY event when case_id is provided", async () => {
			const { producer } = require("#helpers/kafka");
			const payload = {
				business_id: mockBusinessId,
				case_id: mockCaseId,
				customer_id: mockCustomerId,
				previous_status: "pending_review"
			};

			await businessEventsHandler.calculateBusinessFacts(payload);

			expect(producer.send).toHaveBeenCalledWith({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: kafkaEvents.APPLICATION_EDIT_FACTS_READY,
						value: {
							event: kafkaEvents.APPLICATION_EDIT_FACTS_READY,
							business_id: mockBusinessId,
							case_id: mockCaseId,
							customer_id: mockCustomerId,
							previous_status: "pending_review"
						}
					}
				]
			});
		});

		it("should emit event with undefined optional fields when only case_id is provided", async () => {
			const { producer } = require("#helpers/kafka");
			const payload = {
				business_id: mockBusinessId,
				case_id: mockCaseId
			};

			await businessEventsHandler.calculateBusinessFacts(payload);

			expect(producer.send).toHaveBeenCalledWith({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [
					{
						key: kafkaEvents.APPLICATION_EDIT_FACTS_READY,
						value: {
							event: kafkaEvents.APPLICATION_EDIT_FACTS_READY,
							business_id: mockBusinessId,
							case_id: mockCaseId,
							customer_id: undefined,
							previous_status: undefined
						}
					}
				]
			});
		});

		it("should still calculate facts before emitting event", async () => {
			const { producer } = require("#helpers/kafka");
			const payload = {
				business_id: mockBusinessId,
				case_id: mockCaseId,
				customer_id: mockCustomerId,
				previous_status: "approved"
			};

			await businessEventsHandler.calculateBusinessFacts(payload);

			const { FactEngineWithDefaultOverrides, allFacts, FactRules } = require("#lib/facts");
			expect(FactEngineWithDefaultOverrides).toHaveBeenCalledWith(allFacts, { business: mockBusinessId });
			expect(mockFactEngine.applyRules).toHaveBeenCalledWith(FactRules.factWithHighestConfidence);
			expect(mockFactEngine.getResults).toHaveBeenCalled();
			expect(producer.send).toHaveBeenCalled();
		});
	});
});
