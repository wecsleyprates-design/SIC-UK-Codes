import { Request, Response } from "express";
import { FEATURE_FLAGS, ROLES } from "#constants";
import { getFlagValue, redis, logger, updateAuthRedisCache } from "#helpers";
import { validateDataPermission } from "../access.middleware";
import { DeepPartial, UserInfo } from "#types";
import { getBusinessApplicants } from "#helpers/api";

jest.mock("#helpers/index", () => {
	const original = jest.requireActual("#helpers/index");
	return {
		...original,
		getFlagValue: jest.fn(),
		sqlQuery: jest.fn(),
		updateAuthRedisCache: jest.fn(),
		redis: { sismember: jest.fn(), sadd: jest.fn() },
		logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn() }
	};
});
jest.mock("#helpers/api", () => ({
	getBusinessApplicants: jest.fn()
}));

const mockGetFlagValue = getFlagValue as jest.MockedFunction<typeof getFlagValue>;
const mockRedis = redis as jest.Mocked<typeof redis>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockUpdateAuthRedisCache = updateAuthRedisCache as jest.MockedFunction<typeof updateAuthRedisCache>;
const mockGetBusinessApplicants = getBusinessApplicants as jest.MockedFunction<typeof getBusinessApplicants>;

describe("validateDataPermission", () => {
	const mockReq = (): Partial<Request> => ({
		params: {}
	});

	const mockRes = (): Partial<Omit<Response, "locals">> & {
		locals: { user: DeepPartial<UserInfo> };
	} => ({ locals: { user: {} } });

	afterEach(() => {
		jest.resetAllMocks();
	});

	test("should call `getFlagValue` with the expected feature flag", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { id: 2 } }; // ROLE_ID.CUSTOMER
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockResolvedValueOnce(true);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(mockGetFlagValue).toHaveBeenCalledWith(FEATURE_FLAGS.WIN_1098_VALIDATE_DATA_PERMISSION);
	});

	test("should call next() if WIN_1098 feature flag is false", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { id: 2 } }; // ROLE_ID.CUSTOMER
		mockGetFlagValue.mockResolvedValueOnce(false);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(next).toHaveBeenCalledWith();
		expect(next).toHaveBeenCalledTimes(1);
	});

	test("should log if customer_id is not present in userInfo", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: undefined, email: "test@joinworth.com", role: { id: 2, code: ROLES.CUSTOMER } };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockLogger.info = jest.fn();

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(mockLogger.info).toHaveBeenCalledWith(`Customer ID not present in token: ${res.locals.user.email}`);
	});

	test("should not log if customer_id is present in userInfo", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: "C1", email: "test@joinworth.com", role: { code: ROLES.CUSTOMER, id: 2 } };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockResolvedValueOnce(true);
		mockLogger.info = jest.fn();

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining("Customer ID not present in token"));
	});

	test("should call next with error if there is no customer_id in userInfo", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: undefined, role: { code: ROLES.CUSTOMER, id: 2 } };
		mockGetFlagValue.mockResolvedValueOnce(true);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(next).toHaveBeenCalledWith(expect.any(Error));
		expect(next.mock.calls[0][0].message).toBe("You are not allowed to access the data.");
	});

	test("should allow applicant access when applicant is associated with the business", async () => {
		/** Arrange */
		const businessId = "00000000-0000-0000-0000-000000000000";
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessId, customerID: "C1" };
		req.headers = { authorization: "Bearer token" } as any;
		res.locals.user = { user_id: "U1", role: { code: ROLES.APPLICANT, id: 3 } };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockGetBusinessApplicants.mockResolvedValueOnce([{ id: "U1" } as any]);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(mockGetBusinessApplicants).toHaveBeenCalledWith(businessId, "Bearer token");
		expect(next).toHaveBeenCalledWith();
	});

	test("should reject applicant access when applicant is not associated with the business", async () => {
		/** Arrange */
		const businessId = "00000000-0000-0000-0000-000000000000";
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessId, customerID: "C1" };
		req.headers = { authorization: "Bearer token" } as any;
		res.locals.user = { user_id: "U1", role: { code: ROLES.APPLICANT, id: 3 } };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockGetBusinessApplicants.mockResolvedValueOnce([{ id: "U2" } as any]);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(mockGetBusinessApplicants).toHaveBeenCalledWith(businessId, "Bearer token");
		expect(next).toHaveBeenCalledWith(expect.any(Error));
		expect(next.mock.calls[0][0].message).toBe("You are not allowed to access details of this business.");
	});

	test("should call next() if businessID is in Redis (access granted on first redis cache check)", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { code: ROLES.CUSTOMER, id: 2 } };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockResolvedValueOnce(true);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(mockRedis.sismember).toHaveBeenCalledWith("{customer}:C1:businesses", "B1");
		expect(next).toHaveBeenCalledWith();
		expect(next).toHaveBeenCalledTimes(1);
	});

	test("should call next() if businessID is not in Redis but present after cache update", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { code: ROLES.CUSTOMER, id: 2 } };
		// feature flag check in validateDataPermission
		mockGetFlagValue.mockResolvedValueOnce(true);
		// first redis cache check
		mockRedis.sismember.mockResolvedValueOnce(false);

		// updateAuthRedisCache logic
		mockUpdateAuthRedisCache.mockResolvedValueOnce(true);

		// second redis cache check
		mockRedis.sismember.mockResolvedValueOnce(true);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(mockUpdateAuthRedisCache).toHaveBeenCalledWith("C1");
		expect(next).toHaveBeenCalledWith();
		expect(next).toHaveBeenCalledTimes(1);
	});

	test("should call next with error if businessID is not in Redis and still not present after cache update", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { code: ROLES.CUSTOMER, id: 2 } };
		// feature flag check in validateDataPermission
		mockGetFlagValue.mockResolvedValueOnce(true);
		// first redis cache check
		mockRedis.sismember.mockResolvedValueOnce(false);

		// updateAuthRedisCache logic returns false (no access)
		mockUpdateAuthRedisCache.mockResolvedValueOnce(false);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(mockUpdateAuthRedisCache).toHaveBeenCalledWith("C1");
		expect(next).toHaveBeenCalledWith(expect.any(Error));
		expect(next.mock.calls[0][0].message).toBe("You are not allowed to access the data.");
	});

	test("should call next with error if updateAuthRedisCache throws", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { code: ROLES.CUSTOMER, id: 2 } };
		mockGetFlagValue.mockResolvedValueOnce(true);
		// first redis cache check
		mockRedis.sismember.mockResolvedValueOnce(false);
		// updateAuthRedisCache logic
		mockUpdateAuthRedisCache.mockRejectedValueOnce(new Error("cache error"));

		/** Act & Assert */
		await validateDataPermission(req as Request, res as Response, next);
		expect(next).toHaveBeenCalledWith(expect.any(Error));
		expect(next.mock.calls[0][0].message).toBe("cache error");
	});

	test("should call next with error if redis.sismember throws", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { code: ROLES.CUSTOMER, id: 2 } };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockRejectedValueOnce(new Error("redis error"));

		/** Act & Assert */
		await validateDataPermission(req as Request, res as Response, next);
		expect(next).toHaveBeenCalledWith(expect.any(Error));
		expect(next.mock.calls[0][0].message).toBe("redis error");
	});

	test("should call next with error if updateAuthRedisCache throws during sadd operation", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: "B1", customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { code: ROLES.CUSTOMER, id: 2 } };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockResolvedValueOnce(false);
		mockUpdateAuthRedisCache.mockRejectedValueOnce(new Error("redis error"));

		/** Act & Assert */
		await validateDataPermission(req as Request, res as Response, next);
		expect(next).toHaveBeenCalledWith(expect.any(Error));
		expect(next.mock.calls[0][0].message).toBe("redis error");
	});

	test("should not check redis if businessID is not provided", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: undefined as unknown as string, customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { code: ROLES.CUSTOMER, id: 2 } };
		mockGetFlagValue.mockResolvedValueOnce(true);
		mockRedis.sismember.mockResolvedValue(false);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(mockRedis.sismember).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledWith();
		expect(next).toHaveBeenCalledTimes(1);
	});

	test("should call next() if businessID is not provided and customerID matches userInfo.customer_id", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: undefined as unknown as string, customerID: "C1" };
		res.locals.user = { customer_id: "C1", role: { code: ROLES.CUSTOMER, id: 2 } };
		mockGetFlagValue.mockResolvedValueOnce(true);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(next).toHaveBeenCalledWith();
		expect(next).toHaveBeenCalledTimes(1);
	});

	test("should call next with error if businessID is not provided and customerID does not match userInfo.customer_id", async () => {
		/** Arrange */
		const req = mockReq();
		const res = mockRes();
		const next = jest.fn();
		req.params = { businessID: undefined as unknown as string, customerID: "C1" };
		res.locals.user = { customer_id: "C2", role: { code: ROLES.CUSTOMER, id: 2 } };
		mockGetFlagValue.mockResolvedValueOnce(true);

		/** Act */
		await validateDataPermission(req as Request, res as Response, next);

		/** Assert */
		expect(next).toHaveBeenCalledWith(expect.any(Error));
		expect(next.mock.calls[0][0].message).toBe("You are not allowed to access the data.");
	});
});
