import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

export interface AWSSecretsManagerConfig {
	client: SecretsManagerClient;
	kmsKeyId: string;
}

export interface SecretsManagerServiceConfig {
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
	kmsKeyId: string;
}

export interface CreateSecretParams {
	name: string;
	secretString: string;
	kmsKeyId: string;
	description: string;
}

export interface GetSecretParams {
	secretId: string;
	versionStage: string;
}

export interface UpdateSecretParams {
	secretId: string;
	secretString: string;
}

export interface DeleteSecretParams {
	secretId: string;
}

export interface AWSSecretResponse {
	ARN?: string;
	Name?: string;
	VersionId?: string;
	SecretString?: string;
}
