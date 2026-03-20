import { envConfig } from "#configs/index";
import { logger } from "#helpers/index";
import crypto from "crypto";
import express, { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { VerificationApiError } from "#api/v1/modules/verification/error";
import { ERROR_CODES } from "#constants";
import { isNotNil } from "@austinburns/type-guards";

const TRULIOO_WEBHOOK_SECRET = envConfig.TRULIOO_WEBHOOK_SECRET;

/**
 * Verification logic for Trulioo webhook signature
 */
export const truliooVerify = (req: Request, res: Response, buf: Buffer) => {
	const signatureHeader = req.get("x-trulioo-signature");
	const bodyString = buf.toString("utf8");

	// Check if this is a URL verification handshake request
	const isHandshakeRequest = bodyString.includes('"type":"URL_VERIFICATION"');

	// ALL Trulioo webhook requests (including handshake) require HMAC signature validation
	if (!signatureHeader) {
		logger.warn("Trulioo webhook missing x-trulioo-signature header");
		res.locals.invalidSignature = true;
		return null as any;
	}

	if (!TRULIOO_WEBHOOK_SECRET) {
		logger.error("TRULIOO_WEBHOOK_SECRET is not configured");
		res.locals.invalidSignature = true;
		return null as any;
	}

	// Sign the webhook message using the secret key with HMAC-SHA256 and hex encoding
	// The signature is calculated from the raw JSON payload
	const signature = crypto.createHmac("sha256", TRULIOO_WEBHOOK_SECRET).update(bodyString).digest("hex");

	// Use timing-safe comparison to prevent timing attacks
	const signatureBuffer = Buffer.from(signature, "hex");
	const headerBuffer = Buffer.from(signatureHeader, "hex");

	// Compare signatures using timing-safe comparison
	const isValid =
		signatureBuffer.length === headerBuffer.length &&
		crypto.timingSafeEqual(signatureBuffer, headerBuffer);

	if (!isValid) {
		// Log partial signatures for security (first 8 and last 8 chars)
		const sigPreview = signature.substring(0, 8) + "..." + signature.substring(signature.length - 8);
		const headerPreview =
			signatureHeader.length > 16
				? signatureHeader.substring(0, 8) + "..." + signatureHeader.substring(signatureHeader.length - 8)
				: signatureHeader || "missing";
		const requestType = isHandshakeRequest ? "handshake" : "webhook event";
		logger.warn(`Invalid International Business Verification ${requestType} signature. Got ${headerPreview}, Expected ${sigPreview}`);
		res.locals.invalidSignature = true;
		return null as any;
	} else {
		const requestType = isHandshakeRequest ? "handshake" : "webhook event";
		logger.info(`Valid International Business Verification ${requestType} signature.`);
		return null as any;
	}
};

/**
 * Middleware for Trulioo webhook signature verification (HMAC-SHA256)
 *
 * Handshake verification: https://developer.trulioo.com/reference/api-handshake
 * Webhook events: https://docs.verification.trulioo.com/sdk/webhook/index.html
 *
 * Note: ALL Trulioo webhook requests (including URL verification handshake)
 * must include HMAC signature in x-trulioo-signature header and be validated.
 * The signature is computed from the raw JSON payload using HMAC-SHA256.
 */
export const verifyTruliooWebhookSignature = express.json({
	limit: "20MB",
	verify: truliooVerify
});

/**
 * Middleware to return error if signature validation failed
 * All Trulioo webhook requests (including handshake) must have valid signatures
 */
export const errorOnInvalidTruliooSignature = (req: Request, res: Response, next: NextFunction) => {
	if (isNotNil(res.locals.invalidSignature)) {
		throw new VerificationApiError("Invalid International Business Verification webhook signature.", StatusCodes.UNAUTHORIZED, ERROR_CODES.INVALID);
	}
	next();
};
