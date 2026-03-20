import { ERROR_CODES } from "#constants";
import { logger } from "#helpers";
import { PaymentProcessorSecretsService } from "#lib/paymentProcessor/paymentProcessorSecretsService";
import { isUUID } from "#utils";
import type { ErrorCode } from "@joinworth/types/dist/constants/errorCodes";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";

class StripeMiddlewareError extends Error {
	status: StatusCodes;
	errorCode: ErrorCode;
	constructor(message: string, httpStatus: StatusCodes, errorCode: ErrorCode) {
		super(message);
		this.name = "StripeMiddlewareError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const verifyStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
	// Parse the last two UUIDs from the path
	const pathParts = req.url.split("/");
	if (pathParts.length < 2) {
		throw new StripeMiddlewareError("invalid URL format", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}
	const customerId = pathParts[pathParts.length - 2];
	const processorId = pathParts[pathParts.length - 1];
	try {
		if (!customerId || !processorId || !isUUID(customerId) || !isUUID(processorId)) {
			throw new StripeMiddlewareError(
				"Customer ID and processor ID are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		const secretsService = new PaymentProcessorSecretsService(customerId, processorId);
		const stripeConfig = await secretsService.getStripeConfig();
		if (!stripeConfig) {
			throw new StripeMiddlewareError("Stripe keys not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		if (!stripeConfig.stripeWebhookSecret) {
			throw new StripeMiddlewareError("Stripe webhook secret not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		const rawBody = await getStripeRawBody(req, res);
		const parsedBody = parseStripeRequestBody(req, rawBody);

		// Stripe validate webhook against the webhook secret
		const signature = req.headers["stripe-signature"];
		if (!signature) {
			throw new StripeMiddlewareError(
				"Stripe signature not found",
				StatusCodes.UNAUTHORIZED,
				ERROR_CODES.UNAUTHENTICATED
			);
		}
		try {
			Stripe.webhooks.constructEvent(rawBody, signature, stripeConfig.stripeWebhookSecret);
			req.body = parsedBody;
			return next();
		} catch (error) {
			logger.error(
				error,
				`Webhook signature verification failed for customer ${customerId} and processor ${processorId}`
			);
			return next(error);
		}
	} catch (error) {
		logger.error(
			{ error, body: req.body, headers: req.headers },
			`Error validating stripe webhook for customer ${customerId} and processor ${processorId}`
		);
		return next(error);
	}
};

const stripeRawBodyParser = express.raw({ limit: "20MB", type: "*/*" });

const getStripeRawBody = async (req: Request, res: Response): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		stripeRawBodyParser(req, res, err => {
			if (err) {
				return reject(
					new StripeMiddlewareError(
						"Unable to read Stripe webhook payload",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					)
				);
			}

			const body = req.body;
			const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body ?? "");
			return resolve(rawBody);
		});
	});
};

const parseStripeRequestBody = (req: Request, rawBody: Buffer): Buffer | Record<string, unknown> => {
	const contentType = req.headers["content-type"] ?? "";
	if (contentType.includes("application/json")) {
		if (rawBody.length === 0) {
			return {};
		}

		try {
			return JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
		} catch (error) {
			throw new StripeMiddlewareError(
				"Stripe webhook payload must be valid JSON",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
	}

	return rawBody;
};
