import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { envConfig } from "#configs/env.config";
import type { SecretsManagerServiceConfig } from "./types";

/**
 * Creates and configures AWS Secrets Manager client with proper credentials validation
 * @returns {SecretsManager} Object containing the configured client and KMS key ID
 * @throws {Error} When AWS credentials are missing or invalid
 */
export class SecretsManager {
	public client: SecretsManagerClient;
	public kmsKeyId: string;

	constructor() {
		if (!envConfig.AWS_COGNITO_REGION || !envConfig.AWS_ACCESS_KEY_ID || !envConfig.AWS_ACCESS_KEY_SECRET || !envConfig.AWS_KMS_KEY_ID) {
			throw new Error("AWS credentials are required");
		}

		const serviceConfig: SecretsManagerServiceConfig = {
			region: envConfig.AWS_COGNITO_REGION,
			accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
			secretAccessKey: envConfig.AWS_ACCESS_KEY_SECRET,
			kmsKeyId: envConfig.AWS_KMS_KEY_ID
		};

		this.client = new SecretsManagerClient({
			region: serviceConfig.region,
			credentials: {
				accessKeyId: serviceConfig.accessKeyId,
				secretAccessKey: serviceConfig.secretAccessKey
			}
		});

		this.kmsKeyId = serviceConfig.kmsKeyId;
	}
}
