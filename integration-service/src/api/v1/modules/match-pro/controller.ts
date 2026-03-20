import { matchConnection } from "./matchConnection";
import { catchAsync } from "#utils/index";
import { VerificationApiError } from "../verification/error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { Request } from "express";
import { Response } from "#types/index";
import { secretsManagerService } from "../secrets/secrets";
import { schema } from "./schema";
import { normalizeBooleans } from "#utils/normalizer";

// Helper function to validate credentials using Zod schema with advanced validation
export const validateCredentialsWithZod = (params: any, body: any, file?: Express.Multer.File) => {
	try {
		schema.credentialsWithValidation.parse({
			params,
			body,
			file
		});
	} catch (error: any) {
		// Extract meaningful error message from Zod validation error
		const errorMessage = error.errors?.[0]?.message || error.message || "Validation failed";
		throw new VerificationApiError(errorMessage, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}
};

export const controller = {
	checkConnectionStatus: catchAsync(async (req: Request, res: Response) => {
		try {
			const { customerId } = req.params;
			const statusConnection = await matchConnection.checkConnection(customerId);
			return res.jsend.success({ statusConnection });
		} catch (error) {
			throw new VerificationApiError(`Failed Match-Pro connection: ${error}`, StatusCodes.UNAUTHORIZED);
		}
	}),
	getCredentials: catchAsync(async (req: Request, res: Response) => {
		const secret = await secretsManagerService.getSecret(req.params.customerId);

		// Filter out sensitive data from response (secret might be null)
		if (!secret) {
			return res.jsend.success(null, "Credentials not found");
		}

		// Filter out sensitive data from response
		const filteredSecret = matchConnection.filterSecretResponse(secret);
		return res.jsend.success(filteredSecret, "Credentials retrieved successfully");
	}),
	saveCredentials: catchAsync(async (req: Request, res: Response) => {
		// Validate credentials using Zod schema
		normalizeBooleans(req.body, ["isActive"]);
		validateCredentialsWithZod(req.params, req.body, req.file);

		if (req.body.isActive || req.file) {
			if (!req.file) {
				throw new VerificationApiError("Key file not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			const { privateKey, metadata } = matchConnection.extractPrivateKeyFromKeyFile(req.file, req.body.keyPassword);
			const secret = await secretsManagerService.createSecret({
				customer_id: req.params.customerId,
				storage_data: matchConnection.buildSecretsData(privateKey, metadata, req.body)
			});

			// Filter out sensitive data from response
			const filteredSecret = matchConnection.filterSecretResponse(secret);
			return res.jsend.success(filteredSecret, "The credentials have been saved successfully");
		} else {
			// If isActive is not true and no file provided, just save the basic data
			const secret = await secretsManagerService.createSecret({
				customer_id: req.params.customerId,
				storage_data: matchConnection.buildSecretsData(null, null, req.body)
			});

			// Filter out sensitive data from response
			const filteredSecret = matchConnection.filterSecretResponse(secret);
			return res.jsend.success(filteredSecret, "The credentials have been saved successfully");
		}
	}),
	updateCredentials: catchAsync(async (req: Request, res: Response) => {
		// Validate credentials using Zod schema
		normalizeBooleans(req.body, ["isActive"]);
		validateCredentialsWithZod(req.params, req.body, req.file);
		if (req.body.isActive || req.file) {
			if (!req.file) {
				throw new VerificationApiError("Key file not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			const { privateKey, metadata } = matchConnection.extractPrivateKeyFromKeyFile(req.file, req.body.keyPassword);
			const secret = await secretsManagerService.updateSecret(req.params.customerId, {
				customer_id: req.params.customerId,
				storage_data: matchConnection.buildSecretsData(privateKey, metadata, req.body)
			});

			// Filter out sensitive data from response
			const filteredSecret = matchConnection.filterSecretResponse(secret);
			return res.jsend.success(filteredSecret, "The credentials have been updated successfully");
		} else {
			// If isActive is not true and no file provided, just update the basic data
			const secret = await secretsManagerService.updateSecret(req.params.customerId, {
				customer_id: req.params.customerId,
				storage_data: matchConnection.buildSecretsData(null, null, req.body)
			});

			// Filter out sensitive data from response
			const filteredSecret = matchConnection.filterSecretResponse(secret);
			return res.jsend.success(filteredSecret, "The credentials have been updated successfully");
		}
	})
};
