import { Request, Response, NextFunction } from "express";
import { truliooVerify, errorOnInvalidTruliooSignature } from "../trulioo.middleware";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { logger } from "#helpers/index";

// Mock dependencies
jest.mock("#configs/index", () => ({
	envConfig: {
		TRULIOO_WEBHOOK_SECRET: "test-secret"
	}
}));

jest.mock("#helpers/index", () => ({
	logger: {
		warn: jest.fn(),
		error: jest.fn(),
		info: jest.fn()
	}
}));

describe("Trulioo Webhook Middleware", () => {
	let req: Partial<Request>;
	let res: any;
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		req = {
			get: jest.fn(),
			body: {}
		};
		res = {
			locals: {}
		};
		next = jest.fn();
	});

	describe("truliooVerify", () => {
		it("should set res.locals.invalidSignature and return null if signature header is missing", () => {
			const buf = Buffer.from(JSON.stringify({ type: "URL_VERIFICATION", challenge: "test" }));

			// Mock req.get to return undefined for signature header
			(req.get as jest.Mock).mockReturnValue(undefined);

			const result = truliooVerify(req as Request, res as Response, buf);

			expect(res.locals.invalidSignature).toBe(true);
			expect(result).toBeNull();
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("missing x-trulioo-signature header"));
		});

		it("should set res.locals.invalidSignature and log partial signature if signature is invalid", () => {
			const payload = { type: "URL_VERIFICATION", challenge: "test" };
			const buf = Buffer.from(JSON.stringify(payload));

			// A very long invalid signature
			const longInvalidSignature = "a".repeat(64);
			(req.get as jest.Mock).mockReturnValue(longInvalidSignature);

			const result = truliooVerify(req as Request, res as Response, buf);

			expect(res.locals.invalidSignature).toBe(true);
			expect(result).toBeNull();
			// Check if log contains the "..." preview pattern
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("..."));
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid International Business Verification handshake signature"));
		});

		it("should fail if the body is tampered with (HMAC sensitivity)", () => {
			const crypto = require("crypto");
			const secret = "test-secret";
			const payload = { type: "URL_VERIFICATION", challenge: "test" };
			const bodyString = JSON.stringify(payload);
			const validSignature = crypto.createHmac("sha256", secret).update(bodyString).digest("hex");

			(req.get as jest.Mock).mockReturnValue(validSignature);

			// Tamper with the buffer by adding a space
			const tamperedBuf = Buffer.from(bodyString + " ");

			truliooVerify(req as Request, res as Response, tamperedBuf);

			expect(res.locals.invalidSignature).toBe(true);
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Invalid International Business Verification handshake signature"));
		});

		it("should not set res.locals.invalidSignature and return null if signature is valid", () => {
			const crypto = require("crypto");
			const secret = "test-secret";
			const payload = { type: "URL_VERIFICATION", challenge: "test" };
			const bodyString = JSON.stringify(payload);
			const buf = Buffer.from(bodyString);
			const validSignature = crypto.createHmac("sha256", secret).update(bodyString).digest("hex");

			(req.get as jest.Mock).mockReturnValue(validSignature);

			const result = truliooVerify(req as Request, res as Response, buf);

			expect(res.locals.invalidSignature).toBeUndefined();
			expect(result).toBeNull();
			expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Valid International Business Verification handshake signature"));
		});
	});

	describe("errorOnInvalidTruliooSignature", () => {
		it("should throw VerificationApiError if res.locals.invalidSignature is true", () => {
			res.locals.invalidSignature = true;

			expect(() => {
				errorOnInvalidTruliooSignature(req as Request, res as Response, next);
			}).toThrow(VerificationApiError);
		});

		it("should call next() if res.locals.invalidSignature is not set", () => {
			errorOnInvalidTruliooSignature(req as Request, res as Response, next);

			expect(next).toHaveBeenCalled();
		});
	});
});
