import { validateDataPermission } from "#middlewares/access.middleware";
import { ROLES } from "#constants";
import { StatusCodes } from "http-status-codes";

// Mock dependencies
jest.mock("#helpers", () => ({
	getFlagValue: jest.fn().mockResolvedValue(true),
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn()
	},
	redis: {
		sismember: jest.fn()
	},
	updateAuthRedisCache: jest.fn()
}));

jest.mock("#helpers/api", () => ({
	getBusinessApplicants: jest.fn()
}));

describe("Match-Pro Access Control (Middleware)", () => {
	let req: any;
	let res: any;
	let next: any;

	const targetCustomerId = "123e4567-e89b-12d3-a456-426614174000";
	const otherCustomerId = "987e6543-e21b-12d3-a456-426614174000";

	beforeEach(() => {
		req = {
			params: { customerId: targetCustomerId },
			headers: {},
			body: {}
		};
		res = {
			locals: {
				user: {
					role: { code: ROLES.CUSTOMER },
					customer_id: otherCustomerId,
					email: "test@example.com",
					user_id: "user-123"
				}
			}
		};
		next = jest.fn();
	});

	const testAuthorization = async () => {
		// 1. Unauthorized Access (Customer)
		res.locals.user.role.code = ROLES.CUSTOMER;
		res.locals.user.customer_id = otherCustomerId;

		await validateDataPermission(req, res, next);
		expect(next).toHaveBeenCalledWith(
			expect.objectContaining({
				status: StatusCodes.FORBIDDEN,
				name: "AccessMiddlewareError"
			})
		);
		next.mockClear();

		// 2. Authorized Access (Customer)
		res.locals.user.customer_id = targetCustomerId;
		await validateDataPermission(req, res, next);
		expect(next).toHaveBeenCalledWith(); // Called with no args (success)
		next.mockClear();

		// 3. Admin Access
		res.locals.user.role.code = ROLES.ADMIN;
		res.locals.user.customer_id = "any-customer-id";
		await validateDataPermission(req, res, next);
		expect(next).toHaveBeenCalledWith();
		next.mockClear();
	};

	it("should enforce authorization logic via middleware", async () => {
		await testAuthorization();
	});

	it("should allow access if feature flag is disabled", async () => {
		const { getFlagValue } = require("#helpers");
		getFlagValue.mockResolvedValueOnce(false);

		res.locals.user.role.code = ROLES.CUSTOMER;
		res.locals.user.customer_id = otherCustomerId; // Should fail if flag was on

		await validateDataPermission(req, res, next);
		expect(next).toHaveBeenCalledWith(); // Passes because flag is off
	});
});
