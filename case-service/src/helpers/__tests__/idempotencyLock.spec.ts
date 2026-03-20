import { getOrCreateLock } from "../idempotencyLock";
import { redis } from "../redis";
import { logger } from "../logger";

jest.mock("../redis", () => {
	return {
		redis: {
			setNx: jest.fn(),
			get: jest.fn(),
			delete: jest.fn(),
			set: jest.fn()
		}
	};
});

jest.mock("../logger", () => {
	return {
		logger: {
			error: jest.fn()
		}
	};
});

describe("getOrCreateLock", () => {
	const key = "lock:key";
	const ttl = 60;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns acquired lock and original context", async () => {
		const context = { runId: "123", status: "in_progress" };
		(redis.setNx as jest.Mock).mockResolvedValueOnce(true);

		const result = await getOrCreateLock(key, context, ttl);

		expect(redis.setNx).toHaveBeenCalledWith(key, JSON.stringify(context), ttl);
		expect(redis.get).not.toHaveBeenCalled();
		expect(result).toEqual([true, context]);
	});

	it("returns existing context when lock is not acquired", async () => {
		const existing = { runId: "456", status: "completed" };
		(redis.setNx as jest.Mock).mockResolvedValueOnce(false);
		(redis.get as jest.Mock).mockResolvedValueOnce(existing);

		const result = await getOrCreateLock(key, { runId: "new" }, ttl);

		expect(redis.setNx).toHaveBeenCalled();
		expect(redis.get).toHaveBeenCalledWith(key);
		expect(result).toEqual([false, existing]);
	});

	it("returns [false, null] when redis throws", async () => {
		const context = { runId: "789" };
		const error = new Error("redis down");
		(redis.setNx as jest.Mock).mockRejectedValueOnce(error);

		const result = await getOrCreateLock(key, context, ttl);

		expect(logger.error).toHaveBeenCalledWith(
			{ error, key, ttl, context },
			`Error creating idempotency lock for key: ${key}`
		);
		expect(result).toEqual([false, null]);
	});
});
