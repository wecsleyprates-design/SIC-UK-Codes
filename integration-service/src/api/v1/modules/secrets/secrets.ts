import { logger } from "#helpers/index";
import type { SecretData, SecretOperationResult } from "#types/index";
import { SecretsManagerError } from "./error";
import { OPERATION, SECRET_PATH, SECRET_STATUS, VERSION_STAGE } from "#constants/secrets.constant";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants/error-codes.constant";
import {
	SecretsManager,
	createSecret as awsCreateSecret,
	getSecret as awsGetSecret,
	updateSecret as awsUpdateSecret,
	deleteSecret as awsDeleteSecret
} from "#lib/aws";

export class SecretsManagerService {
	secretsManager: SecretsManager;

	constructor() {
		this.secretsManager = new SecretsManager();
	}

	protected generateSecretName(customerId: string): string {
		return `${SECRET_PATH.PREFIX}/${customerId}/${SECRET_PATH.SUFFIX}`;
	}

	private enrichSecretData(data: SecretData, operation: keyof typeof OPERATION): SecretData {
		const now = new Date().toISOString();

		return {
			...data,
			...(operation === OPERATION.UPDATE ? { updatedAt: now } : { createdAt: now }),
			status: SECRET_STATUS.ACTIVE
		};
	}

	async createSecret(data: SecretData) {
		try {
			const secretName = this.generateSecretName(data.customer_id);
			const enrichedData = this.enrichSecretData(data, OPERATION.CREATE);
			const secretData = JSON.stringify(enrichedData);

			const response = await awsCreateSecret(this.secretsManager.client, {
				name: secretName,
				secretString: secretData,
				kmsKeyId: this.secretsManager.kmsKeyId,
				description: `Customer SECRETS configuration for ${data.customer_id}`
			});

			logger.info("[AWS Secrets Manager] Secret created");

			return {
				arn: response.ARN,
				version: response.VersionId,
				accessedAt: new Date().toISOString(),
				operation: OPERATION.CREATE
			};
		} catch (error: any) {
			logger.error(error, `[AWS Secrets Manager] Error creating secret for customer ${data.customer_id}`);
			throw SecretsManagerError.from(error, OPERATION.CREATE);
		}
	}

	/**
	 * Retrieves the secret for a customer.
	 *
	 * @param customerId - The customer ID to retrieve the secret for.
	 * @returns The secret operation result if found, or null if the secret does not exist or is empty.
	 * @throws SecretsManagerError - Throws an error for any other failures (e.g. AccessDenied, Throttling).
	 */
	async getSecret(customerId: string): Promise<SecretOperationResult | null> {
		try {
			const secretName = this.generateSecretName(customerId);

			const response = await awsGetSecret(this.secretsManager.client, {
				secretId: secretName,
				versionStage: VERSION_STAGE
			});

			if (!response.SecretString) {
				logger.warn(`[AWS Secrets Manager] Secret string is empty for customer ${customerId}`);
				return null;
			}

			const secretData = JSON.parse(response.SecretString) as SecretData;

			let message: string | undefined;
			if (secretData.status === SECRET_STATUS.INACTIVE) {
				message = `Customer SECRETS is inactive`;
				logger.warn(`[AWS Secrets Manager] ${message}`);
			}

			logger.info("[AWS Secrets Manager] Secret retrieved");

			return {
				...secretData,
				arn: response.ARN,
				version: response.VersionId,
				accessedAt: new Date().toISOString(),
				operation: OPERATION.READ,
				message
			};
		} catch (error: any) {
			if (error.name === "ResourceNotFoundException" || error.code === "ResourceNotFoundException") {
				logger.warn(`[AWS Secrets Manager] Secret not found for customer ${customerId}`);
				return null;
			}
			logger.error(error, `[AWS Secrets Manager] Error retrieving secret for customer ${customerId}`);
			throw SecretsManagerError.from(error, OPERATION.READ);
		}
	}

	async updateSecret(customerId: string, data: SecretData): Promise<SecretOperationResult | undefined> {
		try {
			const existingSecret = await this.getSecret(customerId);

			if (!existingSecret) {
				logger.warn(`[AWS Secrets Manager] Secret not found for customer ${customerId}`);
				return {
					customer_id: customerId,
					storage_data: "",
					accessedAt: new Date().toISOString(),
					operation: OPERATION.UPDATE,
					message: "Secret not found"
				};
			}

			// Parse only the SecretData fields, excluding metadata (arn, version, accessedAt, operation)
			const { arn, version, accessedAt, operation, ...existingSecretData } = existingSecret;

			const secretName = this.generateSecretName(customerId);

			// Merge only the secret data fields
			const mergedData = {
				...existingSecretData,
				...data
			};

			const enrichedData = this.enrichSecretData(mergedData, OPERATION.UPDATE);
			const secretData = JSON.stringify(enrichedData);
			logger.info("[AWS Secrets Manager] Updating secret");

			const response = await awsUpdateSecret(this.secretsManager.client, {
				secretId: secretName,
				secretString: secretData
			});
			logger.info("[AWS Secrets Manager] Secret updated");

			return {
				...enrichedData,
				arn: response.ARN,
				version: response.VersionId,
				accessedAt: new Date().toISOString(),
				operation: OPERATION.UPDATE
			};
		} catch (error: any) {
			logger.error(error, `[AWS Secrets Manager] Error updating secret for customer ${customerId}`);
			throw SecretsManagerError.from(error, OPERATION.UPDATE);
		}
	}

	async deleteSecret(
		customerId: string
	): Promise<Omit<SecretOperationResult, "customer_id" | "storage_data"> | undefined> {
		try {
			const secretName = this.generateSecretName(customerId);

			const response = await awsDeleteSecret(this.secretsManager.client, {
				secretId: secretName
			});

			logger.info("[AWS Secrets Manager] Secret deleted");

			return {
				arn: response.ARN,
				accessedAt: new Date().toISOString(),
				operation: OPERATION.DELETE
			};
		} catch (error: any) {
			logger.error(error, `[AWS Secrets Manager] Error deleting secret for customer ${customerId}`);
			throw SecretsManagerError.from(error, OPERATION.DELETE);
		}
	}
	async secretExists(customerId: string): Promise<boolean> {
		try {
			const secretResponse = await this.getSecret(customerId);
			if (secretResponse && secretResponse.status === SECRET_STATUS.ACTIVE) {
				return true;
			}
		} catch (error: any) {
			// Not a real exception, just a check -- return false
		}
		return false;
	}
}

export const secretsManagerService = new SecretsManagerService();
