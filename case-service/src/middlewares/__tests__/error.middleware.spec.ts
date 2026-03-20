const envConfig = { ENV: "development" };

jest.mock("#configs/index", () => ({
	envConfig
}));

jest.mock("#constants/index", () => ({
	ENVIRONMENTS: {
		DEVELOPMENT: "development",
		PRODUCTION: "production"
	},
	ERROR_CODES: {
		UNKNOWN_ERROR: "UNKNOWN_ERROR"
	}
}));

const mockLoggerError = jest.fn();

jest.mock("#helpers/index", () => ({
	logger: {
		error: mockLoggerError
	}
}));

const mockIsKnexError = jest.fn();
const mockIsPgDatabaseError = jest.fn();

jest.mock("#utils/index", () => ({
	isKnexError: (...args: any[]) => mockIsKnexError(...args),
	isPgDatabaseError: (...args: any[]) => mockIsPgDatabaseError(...args)
}));

const { errorMiddleware } = require("../error.middleware");

describe("errorMiddleware", () => {
	let req: any;
	let res: any;

	beforeEach(() => {
		envConfig.ENV = "development";
		mockIsKnexError.mockReset();
		mockIsPgDatabaseError.mockReset();
		mockLoggerError.mockReset();

		req = {};
		res = {
			jsend: {
				fail: jest.fn(),
				error: jest.fn()
			}
		};
	});

	it("sanitizes DB error message in dev fail responses", () => {
		const error = {
			message: 'ERROR: null value in column "created_by" violates not-null constraint',
			status: 400,
			errorCode: "INVALID",
			details: "detail",
			name: "DatabaseError",
			nativeError: { message: "ERROR: null value in column created_by" }
		};

		mockIsKnexError.mockReturnValue(true);
		mockIsPgDatabaseError.mockReturnValue(false);

		errorMiddleware(error as any, req, res, jest.fn());

		expect(res.jsend.fail).toHaveBeenCalledWith(
			"Unexpected error",
			expect.objectContaining({
				errorName: "DatabaseError",
				dbErrorMessage: "ERROR: null value in column created_by",
				details: ["detail"]
			}),
			"INVALID",
			400
		);
	});

	it("omits dbErrorMessage in production", () => {
		envConfig.ENV = "production";
		const error = {
			message: "ERROR: some SQL error",
			status: 400,
			errorCode: "INVALID",
			details: [],
			name: "DatabaseError",
			nativeError: { message: "ERROR: some SQL error" }
		};

		mockIsKnexError.mockReturnValue(true);
		mockIsPgDatabaseError.mockReturnValue(false);

		errorMiddleware(error as any, req, res, jest.fn());

		const payload = res.jsend.fail.mock.calls[0][1];
		expect(payload.dbErrorMessage).toBeUndefined();
	});

	it("preserves non-DB error messages", () => {
		const error = {
			message: "Regular error",
			status: 500,
			name: "Error",
			details: []
		};

		mockIsKnexError.mockReturnValue(false);
		mockIsPgDatabaseError.mockReturnValue(false);

		errorMiddleware(error as any, req, res, jest.fn());

		expect(res.jsend.error).toHaveBeenCalledWith(
			"Regular error",
			500,
			"UNKNOWN_ERROR",
			expect.objectContaining({
				errorName: "Error"
			})
		);
	});

	it("includes dbErrorMessage for pg errors in dev error responses", () => {
		const error = {
			message: "ERROR: null value in column created_by",
			status: 500,
			name: "DatabaseError",
			details: []
		};

		mockIsKnexError.mockReturnValue(false);
		mockIsPgDatabaseError.mockReturnValue(true);

		errorMiddleware(error as any, req, res, jest.fn());

		expect(res.jsend.error).toHaveBeenCalledWith(
			"Unexpected error",
			500,
			"UNKNOWN_ERROR",
			expect.objectContaining({
				dbErrorMessage: "ERROR: null value in column created_by"
			})
		);
	});
});
