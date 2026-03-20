jest.mock("openai");

jest.mock("#helpers/redis", () => ({
	redis: {
		hgetall: jest.fn(),
		hset: jest.fn(),
		expire: jest.fn(),
		hincrby: jest.fn(),
		delete: jest.fn(),
		get: jest.fn(),
		setex: jest.fn(),
		incr: jest.fn()
	},
	createClusterClient: jest.fn(),
	redisConnect: jest.fn(),
	redisConfig: { ecClusterMode: false, conn: {} }
}));

jest.mock("#helpers/kafka", () => ({
	producer: { send: jest.fn(), init: jest.fn() },
	consumer: { init: jest.fn(), run: jest.fn() },
	confirmKafkaTopicsExist: jest.fn()
}));

jest.mock("#workers/taskHandler", () => ({
	taskQueue: { add: jest.fn(), process: jest.fn(), on: jest.fn() }
}));

jest.mock("#workers/stateUpdateQueue", () => ({ stateQueue: {} }));

jest.mock("../kafka/consumers", () => ({
	handler: jest.fn()
}));

const mockAddJob = jest.fn().mockResolvedValue({ id: "test-job-id" });

const mockQueue = {
	addJob: mockAddJob,
	queue: { process: jest.fn(), on: jest.fn(), setMaxListeners: jest.fn() }
};

import { kafkaToQueue } from "../index";
import { logger } from "#helpers/logger";
import type BullQueue from "#helpers/bull-queue";

describe("kafkaToQueue", () => {
	const mockPayload = { business_id: "test-business-123", case_id: "test-case-456" };

	beforeEach(() => {
		jest.clearAllMocks();
		mockAddJob.mockResolvedValue({ id: "test-job-id" });
	});

	it("should use removeOnFail with count and age retention (not boolean true)", async () => {
		await kafkaToQueue(mockQueue as unknown as BullQueue, "test-event", mockPayload);

		expect(mockAddJob).toHaveBeenCalledTimes(1);

		const [, , opts] = mockAddJob.mock.calls[0];

		expect(opts.removeOnFail).not.toBe(true);
		expect(opts.removeOnFail).toEqual(
			expect.objectContaining({ count: expect.any(Number), age: expect.any(Number) })
		);
	});

	it("should use removeOnComplete with count and age retention (not boolean true)", async () => {
		await kafkaToQueue(mockQueue as unknown as BullQueue, "test-event", mockPayload);

		const [, , opts] = mockAddJob.mock.calls[0];

		expect(opts.removeOnComplete).not.toBe(true);
		expect(opts.removeOnComplete).toEqual(
			expect.objectContaining({ count: expect.any(Number), age: expect.any(Number) })
		);
	});

	it("should retain at least 100 failed jobs for debugging", async () => {
		await kafkaToQueue(mockQueue as unknown as BullQueue, "test-event", mockPayload);

		const [, , opts] = mockAddJob.mock.calls[0];

		expect((opts.removeOnFail as { count: number }).count).toBeGreaterThanOrEqual(100);
	});

	it("should pass the correct event name and payload", async () => {
		await kafkaToQueue(mockQueue as unknown as BullQueue, "case-submitted-execute-tasks", mockPayload);

		expect(mockAddJob).toHaveBeenCalledWith("case-submitted-execute-tasks", mockPayload, expect.any(Object));
	});

	it("should pass optional jobId when provided", async () => {
		await kafkaToQueue(mockQueue as unknown as BullQueue, "test-event", mockPayload, "custom-job-id");

		const [, , opts] = mockAddJob.mock.calls[0];

		expect(opts.jobId).toBe("custom-job-id");
	});

	it("should set delay of 500ms", async () => {
		await kafkaToQueue(mockQueue as unknown as BullQueue, "test-event", mockPayload);

		const [, , opts] = mockAddJob.mock.calls[0];

		expect(opts.delay).toBe(500);
	});

	it("should set timeout of 100000ms", async () => {
		await kafkaToQueue(mockQueue as unknown as BullQueue, "test-event", mockPayload);

		const [, , opts] = mockAddJob.mock.calls[0];

		expect(opts.timeout).toBe(100000);
	});

	it("should rethrow errors from addJob for DLQ handling", async () => {
		const error = new Error("Redis connection failed");
		mockAddJob.mockRejectedValue(error);

		await expect(kafkaToQueue(mockQueue as unknown as BullQueue, "test-event", mockPayload)).rejects.toThrow(
			"Redis connection failed"
		);
	});

	it("should log at info level when enqueueing", async () => {
		await kafkaToQueue(mockQueue as unknown as BullQueue, "test-event", mockPayload);

		expect(logger.info).toHaveBeenCalledWith(
			expect.stringContaining("Enqueueing test-event for business: test-business-123")
		);
	});
});
