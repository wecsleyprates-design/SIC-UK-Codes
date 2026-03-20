import { FEATURE_FLAGS } from "#constants";
import { getFlagValue, redis, sqlQuery, logger } from "#helpers";
import { QueryResult } from "pg";
import { customer } from "../customer";

jest.mock("#helpers/index", () => {
	const original = jest.requireActual("#helpers/index");
	return {
		...original,
		getFlagValue: jest.fn(),
		sqlQuery: jest.fn(),
		redis: { sismember: jest.fn(), sadd: jest.fn() },
		logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() }
	};
});

const mockGetFlagValue = getFlagValue as jest.MockedFunction<typeof getFlagValue>;
const mockRedis = redis as jest.Mocked<typeof redis>;
const mockSqlQuery = sqlQuery as jest.MockedFunction<typeof sqlQuery>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe("_validateDataPermission", () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	test("should call `getFlagValue` with the expected feature flag", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		mockGetFlagValue.mockResolvedValueOnce(true);

		/** Act */
		await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(mockGetFlagValue).toHaveBeenCalledWith(FEATURE_FLAGS.WIN_1098_VALIDATE_DATA_PERMISSION);
	});

	test("should return true if WIN_1098 feature flag is false", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		mockGetFlagValue.mockResolvedValueOnce(false);

		/** Act */
		const access = await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(access).toBeTruthy();
	});

	test("should log if customer_id is not present in userInfo", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: undefined, email: "test@joinworth.com" };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockLogger.info = jest.fn();

		/** Act */
		await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(mockLogger.info).toHaveBeenCalledWith(`Customer ID not present in token: ${userInfo.email}`);
	});

	test("should not log if customer_id is present in userInfo", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: "C1", email: "test@joinworth.com" };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockLogger.info = jest.fn();

		/** Act */
		await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("Customer ID not present in token"));
	});

	test("should return false if there is no customer_id in userInfo", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: undefined };
		mockGetFlagValue.mockResolvedValueOnce(true);

		/** Act */
		const access = await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(access).toBe(false);
	});

	test("should return true if businessID is in Redis (access granted on first redis cache check)", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockResolvedValueOnce(true);

		/** Act */
		const access = await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(mockRedis.sismember).toHaveBeenCalledWith("{customer}:C1:businesses", "B1");
		expect(access).toBe(true);
	});

	test("should return true if businessID is not in Redis but present after cache update", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		// feature flag check in _validateDataPermission
		mockGetFlagValue.mockResolvedValueOnce(true);
		// first redis cache check
		mockRedis.sismember.mockResolvedValueOnce(false);

		// updateCustomerAuthorizationCache logic
		mockGetFlagValue.mockResolvedValueOnce(true); // feature flag check in updateCustomerAuthorizationCache
		mockSqlQuery.mockResolvedValueOnce({ rows: [{ customer_id: "C1", business_id: "B1" }] } as QueryResult);
		mockRedis.sadd.mockResolvedValueOnce(true);

		// second redis cache check
		mockRedis.sismember.mockResolvedValueOnce(true);

		/** Act */
		const access = await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(mockSqlQuery).toHaveBeenCalledWith({
			sql: expect.stringContaining("where rel_business_customer_monitoring.customer_id = $1 AND db.is_deleted = false"),
			values: ["C1"]
		});
		expect(mockRedis.sadd).toHaveBeenCalledWith("{customer}:C1:businesses", ["B1"]);
		expect(access).toBe(true);
	});

	test("should return false if businessID is not in Redis and still not present after cache update", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		// feature flag check in _validateDataPermission
		mockGetFlagValue.mockResolvedValueOnce(true);
		// first redis cache check
		mockRedis.sismember.mockResolvedValueOnce(false);

		// updateCustomerAuthorizationCache logic
		mockGetFlagValue.mockResolvedValueOnce(true); // feature flag check in updateCustomerAuthorizationCache
		mockSqlQuery.mockResolvedValueOnce({ rows: [{ customer_id: "C1", business_id: "B2" }] } as QueryResult); // B1 not present
		mockRedis.sadd.mockResolvedValueOnce(true);

		// second redis cache check
		mockRedis.sismember.mockResolvedValueOnce(false);

		/** Act */
		const access = await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(mockSqlQuery).toHaveBeenCalledWith({
			sql: expect.stringContaining("where rel_business_customer_monitoring.customer_id = $1 AND db.is_deleted = false"),
			values: ["C1"]
		});
		expect(mockRedis.sadd).toHaveBeenCalledWith("{customer}:C1:businesses", ["B2"]);
		expect(access).toBe(false);
	});

	test("should throw if updateCustomerAuthorizationCache throws", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		mockGetFlagValue.mockResolvedValueOnce(true);
		// first redis cache check
		mockRedis.sismember.mockResolvedValueOnce(false);
		// updateCustomerAuthorizationCache logic
		mockGetFlagValue.mockResolvedValueOnce(true); // feature flag check in updateCustomerAuthorizationCache
		mockSqlQuery.mockRejectedValueOnce(new Error("cache error"));

		/** Act & Assert */
		await expect(customer._validateDataPermission(queryParam, userInfo)).rejects.toThrow("cache error");
	});

	test("should throw if redis.sismember throws", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockRejectedValueOnce(new Error("redis error"));

		/** Act & Assert */
		await expect(customer._validateDataPermission(queryParam, userInfo)).rejects.toThrow("redis error");
	});

	test("should throw if redis.sadd throws", async () => {
		/** Arrange */
		const queryParam = { businessID: "B1", customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockResolvedValueOnce(false);
		mockGetFlagValue.mockResolvedValueOnce(true); // feature flag check in updateCustomerAuthorizationCache
		mockSqlQuery.mockResolvedValueOnce({ rows: [{ customer_id: "C1", business_id: "B1" }] } as QueryResult);
		mockRedis.sadd.mockRejectedValueOnce(new Error("redis error"));

		/** Act & Assert */
		await expect(customer._validateDataPermission(queryParam, userInfo)).rejects.toThrow("redis error");
	});

	test("should not check redis if businessID is not provided", async () => {
		/** Arrange */
		const queryParam = { businessID: undefined, customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockResolvedValue(false);

		/** Act */
		const access = await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(mockRedis.sismember).not.toHaveBeenCalled();
		expect(access).toBeTruthy();
	});

	test("should return true if businessID is not provided and customerID matches userInfo.customer_id", async () => {
		/** Arrange */
		const queryParam = { businessID: undefined, customerID: "C1" };
		const userInfo = { customer_id: "C1" };
		mockGetFlagValue.mockResolvedValueOnce(true);

		/** Act */
		const access = await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(access).toBeTruthy();
	});

	test("should return false if businessID is not provided and customerID does not match userInfo.customer_id", async () => {
		/** Arrange */
		const queryParam = { businessID: undefined, customerID: "C1" };
		const userInfo = { customer_id: "C2" };
		mockGetFlagValue.mockResolvedValueOnce(true);

		/** Act */
		const access = await customer._validateDataPermission(queryParam, userInfo);

		/** Assert */
		expect(access).toBe(false);
	});
});
