import { SecretsManagerClient, CreateSecretCommand, GetSecretValueCommand, PutSecretValueCommand, DeleteSecretCommand } from "@aws-sdk/client-secrets-manager";
import type { CreateSecretParams, GetSecretParams, UpdateSecretParams, DeleteSecretParams, AWSSecretResponse } from "./types";

/**
 * Creates a new secret in AWS Secrets Manager
 * @param client - AWS Secrets Manager client
 * @param params - Parameters for creating the secret
 * @returns Promise resolving to the AWS response
 */
export async function createSecret(client: SecretsManagerClient, params: CreateSecretParams): Promise<AWSSecretResponse> {
	const command = new CreateSecretCommand({
		Name: params.name,
		SecretString: params.secretString,
		KmsKeyId: params.kmsKeyId,
		Description: params.description
	});

	return await client.send(command);
}

/**
 * Retrieves a secret from AWS Secrets Manager
 * @param client - AWS Secrets Manager client
 * @param params - Parameters for getting the secret
 * @returns Promise resolving to the AWS response
 */
export async function getSecret(client: SecretsManagerClient, params: GetSecretParams): Promise<AWSSecretResponse> {
	const command = new GetSecretValueCommand({
		SecretId: params.secretId,
		VersionStage: params.versionStage
	});

	return await client.send(command);
}

/**
 * Updates an existing secret in AWS Secrets Manager
 * @param client - AWS Secrets Manager client
 * @param params - Parameters for updating the secret
 * @returns Promise resolving to the AWS response
 */
export async function updateSecret(client: SecretsManagerClient, params: UpdateSecretParams): Promise<AWSSecretResponse> {
	const command = new PutSecretValueCommand({
		SecretId: params.secretId,
		SecretString: params.secretString
	});

	return await client.send(command);
}

/**
 * Deletes a secret from AWS Secrets Manager
 * @param client - AWS Secrets Manager client
 * @param params - Parameters for deleting the secret
 * @returns Promise resolving to the AWS response
 */
export async function deleteSecret(client: SecretsManagerClient, params: DeleteSecretParams): Promise<AWSSecretResponse> {
	const command = new DeleteSecretCommand({
		SecretId: params.secretId
	});

	return await client.send(command);
}
