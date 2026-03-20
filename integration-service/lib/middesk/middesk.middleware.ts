import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";
import crypto from "crypto";
import express, { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { VerificationApiError } from "#api/v1/modules/verification/error";
import { ERROR_CODES } from "#constants";
import { isNotNil } from "@austinburns/type-guards";

const MIDDLEWARE_WEBHOOK_SECRET = envConfig.MIDDESK_WEBHOOK_SECRET;

/**
 * Verification logic for Middesk webhook signature
 */
export const middeskVerify = (req: Request, res: Response, buf: Buffer) => {
	const signatureHeader = req.get("X-Middesk-Signature-256");

	if (!signatureHeader) {
		logger.error("No signature header found.");
		res.locals.invalidSignature = true;
		return null as any;
	}

	const signature = crypto.createHmac("sha256", MIDDLEWARE_WEBHOOK_SECRET!).update(buf.toString("utf8")).digest("hex");

	// Use timing-safe comparison to prevent timing attacks
	const signatureBuffer = Buffer.from(signature, "hex");
	const headerBuffer = Buffer.from(signatureHeader, "hex");

	const isValid =
		signatureBuffer.length === headerBuffer.length && crypto.timingSafeEqual(signatureBuffer, headerBuffer);

	if (!isValid) {
		// Log partial signatures for security (first 8 and last 8 chars)
		const sigPreview = signature.substring(0, 8) + "..." + signature.substring(signature.length - 8);
		const headerPreview =
			signatureHeader.length > 16
				? signatureHeader.substring(0, 8) + "..." + signatureHeader.substring(signatureHeader.length - 8)
				: signatureHeader || "missing";

		logger.error(`Invalid webhook signature. Got ${headerPreview}, Expected ${sigPreview}`);
		// Adding invalidSignature to the res.locals object. So that we can short-circuit the request before it hits the controller.
		res.locals.invalidSignature = true;
		return null as any;
	} else {
		logger.info("Valid webhook signature.");
		return null as any;
	}
};

// Route-specific middleware for raw body parsing with signature verification.
// reference: https://docs.middesk.com/docs/using-webhooks-1
export const verifyWebhookSignature = express.json({
	limit: "20MB",
	verify: middeskVerify
});

export const errorOnInvalidSignature = (req: Request, res: Response, next: NextFunction) => {
	if (isNotNil(res.locals.invalidSignature)) {
		throw new VerificationApiError("Invalid signature. Short-circuiting the request.", StatusCodes.UNAUTHORIZED, ERROR_CODES.INVALID);
	}
	next();
};
