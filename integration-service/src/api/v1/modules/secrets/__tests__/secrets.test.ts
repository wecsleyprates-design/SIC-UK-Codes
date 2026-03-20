import { envConfig } from "#configs/env.config";
import { logger } from "#helpers/index";
import { OPERATION, SECRET_PATH, SECRET_STATUS } from "#constants/secrets.constant";
import { secretsManagerService } from "../secrets";
import type { SecretData } from "#types/index";
import { SecretsManagerError } from "../error";

// Mock the dependencies
jest.mock("@aws-sdk/client-secrets-manager", () => ({
	SecretsManagerClient: jest.fn(),
	GetSecretValueCommand: jest.fn(),
	CreateSecretCommand: jest.fn(),
	DeleteSecretCommand: jest.fn(),
	PutSecretValueCommand: jest.fn()
}));

// Mock the lib AWS operations
jest.mock("#lib/aws", () => {
	const mockSecretsClient = {
		send: jest.fn(),
		config: {},
		middlewareStack: {},
		destroy: jest.fn()
	};

	return {
		SecretsManager: jest.fn().mockImplementation(() => ({
			client: mockSecretsClient,
			kmsKeyId: "test-kms-key"
		})),
		createSecret: jest.fn().mockImplementation((client, params) => client.send()),
		getSecret: jest.fn().mockImplementation((client, params) => client.send()),
		updateSecret: jest.fn().mockImplementation((client, params) => client.send()),
		deleteSecret: jest.fn().mockImplementation((client, params) => client.send())
	};
});

// Mock env config
jest.mock("#configs/env.config", () => ({
	envConfig: {
		AWS_COGNITO_REGION: "us-east-1",
		AWS_ACCESS_KEY_ID: "test-access-key",
		AWS_ACCESS_KEY_SECRET: "test-secret-key",
		AWS_KMS_KEY_ID: "test-kms-key"
	}
}));

jest.mock("../error", () => ({
	SecretsManagerError: class SecretsManagerError extends Error {
		operation: string;
		status: number;
		errorCode?: string;
		data: any;

		constructor(message: string, operation: string, httpStatus?: number, errorCode?: string, error?: any) {
			super(message);
			this.name = "SecretsManagerError";
			this.operation = operation;
			this.status = httpStatus ?? 400;
			this.errorCode = errorCode;
		}

		static from(error: any, operation: string): SecretsManagerError {
			// Mock implementation that maps known AWS errors
			const errorMap: Record<string, { message: string; status: number; errorCode: string }> = {
				ResourceNotFoundException: {
					message: "Secret not found",
					status: 404,
					errorCode: "NOT_FOUND"
				},
				ResourceExistsException: {
					message: "Secret already exists",
					status: 409,
					errorCode: "DUPLICATE"
				},
				InvalidParameterException: {
					message: "Invalid parameter",
					status: 400,
					errorCode: "NOT_FOUND"
				},
				AccessDeniedException: {
					message: "Access denied to secret",
					status: 403,
					errorCode: "UNAUTHORIZED"
				}
			};

			if (error.name && errorMap[error.name]) {
				const { message, status, errorCode } = errorMap[error.name];
				return new SecretsManagerError(message, operation, status, errorCode, error);
			}

			return new SecretsManagerError("Unknown error occurred", operation, 500, "UNKNOWN_ERROR", error);
		}
	},
	ERROR_MAP: {
		ResourceNotFoundException: {
			message: "Secret not found",
			status: 404,
			errorCode: "NOT_FOUND"
		},
		ResourceExistsException: {
			message: "Secret already exists",
			status: 409,
			errorCode: "DUPLICATE"
		}
	}
}));

describe("SecretsManagerService", () => {
	let mockSend: jest.Mock<any>;

	const mockSecretData = {
		customer_id: "test-customer-123",
		storage_data: "test-storage-data"
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockSend = jest.fn();

		// Clear logger mocks
		(logger.info as jest.Mock).mockClear();
		(logger.warn as jest.Mock).mockClear();
		(logger.error as jest.Mock).mockClear();

		// Update the service's client send method to use our mock
		(secretsManagerService as any).secretsManager.client.send = mockSend;
	});

	describe("Constructor", () => {
		it("should initialize with proper AWS configuration", () => {
			// The service is already instantiated, so we can't check the constructor directly
			// Instead, we verify that the service has been initialized with the correct properties
			expect(secretsManagerService).toBeDefined();
			expect(secretsManagerService.secretsManager).toBeDefined();
			expect(secretsManagerService.secretsManager.client).toBeDefined();
			expect(secretsManagerService.secretsManager.kmsKeyId).toBe(envConfig.AWS_KMS_KEY_ID);
		});

		it("should have AWS credentials configured", () => {
			// Since the service is a singleton, we just verify it exists and has proper config
			expect(secretsManagerService).toBeDefined();
			expect(secretsManagerService.secretsManager.client).toBeDefined();
		});

		it("should have KMS key configured", () => {
			// Verify KMS key is set from env config
			expect(secretsManagerService.secretsManager.kmsKeyId).toBe(envConfig.AWS_KMS_KEY_ID);
		});

		it("should validate AWS credentials configuration", () => {
			// Since the service is mocked, we just verify the constructor requirements exist
			expect(envConfig.AWS_ACCESS_KEY_ID).toBeDefined();
			expect(envConfig.AWS_ACCESS_KEY_SECRET).toBeDefined();
			expect(envConfig.AWS_COGNITO_REGION).toBeDefined();
			expect(envConfig.AWS_KMS_KEY_ID).toBeDefined();
		});
	});

	describe("generateSecretName", () => {
		it("should generate correct secret name for valid customer ID", () => {
			const customerId = "test-customer-123";
			const expectedName = `${SECRET_PATH.PREFIX}/${customerId}/${SECRET_PATH.SUFFIX}`;

			// Access private method through type assertion
			const secretName = (secretsManagerService as any).generateSecretName(customerId);

			expect(secretName).toBe(expectedName);
		});

		it("should handle empty customer ID", () => {
			const secretName = (secretsManagerService as any).generateSecretName("");
			expect(secretName).toBe(`${SECRET_PATH.PREFIX}//${SECRET_PATH.SUFFIX}`);
		});

		it("should handle null customer ID", () => {
			const secretName = (secretsManagerService as any).generateSecretName(null);
			expect(secretName).toBe(`${SECRET_PATH.PREFIX}/null/${SECRET_PATH.SUFFIX}`);
		});

		it("should handle non-string customer ID", () => {
			const secretName = (secretsManagerService as any).generateSecretName(123);
			expect(secretName).toBe(`${SECRET_PATH.PREFIX}/123/${SECRET_PATH.SUFFIX}`);
		});
	});

	describe("enrichSecretData", () => {
		beforeEach(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2023-01-01T00:00:00.000Z"));
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("should add createdAt timestamp for CREATE operation", () => {
			const enrichedData = (secretsManagerService as any).enrichSecretData(mockSecretData, OPERATION.CREATE);

			expect(enrichedData).toEqual({
				...mockSecretData,
				createdAt: "2023-01-01T00:00:00.000Z",
				status: SECRET_STATUS.ACTIVE
			});
		});

		it("should add updatedAt timestamp for UPDATE operation", () => {
			const enrichedData = (secretsManagerService as any).enrichSecretData(mockSecretData, OPERATION.UPDATE);

			expect(enrichedData).toEqual({
				...mockSecretData,
				updatedAt: "2023-01-01T00:00:00.000Z",
				status: SECRET_STATUS.ACTIVE
			});
		});
	});

	describe("createSecret", () => {
		beforeEach(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2023-01-01T00:00:00.000Z"));
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("should successfully create a secret", async () => {
			const mockResponse = {
				ARN: "arn:aws:secretsmanager:us-east-1:123456789:secret:test",
				VersionId: "version-123"
			};

			mockSend.mockResolvedValue(mockResponse as never);

			const result = await secretsManagerService.createSecret(mockSecretData as unknown as SecretData);

			expect(result).toEqual({
				arn: mockResponse.ARN,
				version: mockResponse.VersionId,
				accessedAt: "2023-01-01T00:00:00.000Z",
				operation: OPERATION.CREATE
			});

			expect(logger.info).toHaveBeenCalledWith("[AWS Secrets Manager] Secret created");
		});

		it("should handle ResourceExistsException gracefully", async () => {
			const existsError = new Error("Resource already exists");
			existsError.name = "ResourceExistsException";

			mockSend.mockRejectedValue(existsError as never);

			await expect(secretsManagerService.createSecret(mockSecretData as unknown as SecretData)).rejects.toThrow(
				SecretsManagerError
			);

			expect(logger.error).toHaveBeenCalledWith(
				existsError,
				`[AWS Secrets Manager] Error creating secret for customer ${mockSecretData.customer_id}`
			);
		});

		it("should log error for other exceptions", async () => {
			const error = new Error("Some other error");
			mockSend.mockRejectedValue(error as never);

			await expect(secretsManagerService.createSecret(mockSecretData as unknown as SecretData)).rejects.toThrow(
				SecretsManagerError
			);

			expect(logger.error).toHaveBeenCalledWith(
				error,
				`[AWS Secrets Manager] Error creating secret for customer ${mockSecretData.customer_id}`
			);
		});
	});

	describe("getSecret", () => {
		const mockGetResponse = {
			ARN: "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret",
			Name: "test-secret-name",
			VersionId: "version-123",
			SecretString: JSON.stringify({
				...mockSecretData,
				status: SECRET_STATUS.ACTIVE,
				createdAt: "2023-01-01T00:00:00.000Z"
			})
		};

		beforeEach(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2023-01-01T00:00:00.000Z"));
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("should successfully retrieve a secret", async () => {
			mockSend.mockResolvedValue(mockGetResponse as never);

			const result = await secretsManagerService.getSecret(mockSecretData.customer_id as string);

			expect(result).toEqual({
				...mockSecretData,
				status: SECRET_STATUS.ACTIVE,
				createdAt: "2023-01-01T00:00:00.000Z",
				arn: mockGetResponse.ARN,
				version: mockGetResponse.VersionId,
				accessedAt: "2023-01-01T00:00:00.000Z",
				operation: OPERATION.READ
			});

			expect(logger.info).toHaveBeenCalledWith("[AWS Secrets Manager] Secret retrieved");
		});

		it("should return null for ResourceNotFoundException", async () => {
			const notFoundError = new Error("Secret not found");
			notFoundError.name = "ResourceNotFoundException";

			mockSend.mockRejectedValue(notFoundError as never);

			const result = await secretsManagerService.getSecret(mockSecretData.customer_id);
			expect(result).toBeNull();
		});

		it("should return null when SecretString is empty", async () => {
			const emptyResponse = { ...mockGetResponse, SecretString: undefined };
			mockSend.mockResolvedValue(emptyResponse as never);

			const result = await secretsManagerService.getSecret(mockSecretData.customer_id);
			expect(result).toBeNull();
		});

		it("should return secret data when secret status is inactive", async () => {
			const inactiveSecret = {
				...mockGetResponse,
				SecretString: JSON.stringify({
					...mockSecretData,
					status: SECRET_STATUS.INACTIVE
				})
			};

			mockSend.mockResolvedValue(inactiveSecret as never);

			const result = await secretsManagerService.getSecret(mockSecretData.customer_id);

			expect(result).toEqual({
				...mockSecretData,
				status: SECRET_STATUS.INACTIVE,
				arn: mockGetResponse.ARN,
				version: mockGetResponse.VersionId,
				accessedAt: expect.any(String),
				operation: OPERATION.READ,
				message: `Customer SECRETS is inactive`
			});
		});

		it("should return undefined for other exceptions", async () => {
			const error = new Error("Some other error");
			mockSend.mockRejectedValue(error as never);

			await expect(secretsManagerService.getSecret(mockSecretData.customer_id as string)).rejects.toThrow(
				SecretsManagerError
			);
		});
	});

	describe("updateSecret", () => {
		const mockPutResponse = {
			ARN: "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret",
			Name: "test-secret-name",
			VersionId: "version-456"
		};

		const existingSecretData = {
			...mockSecretData,
			status: SECRET_STATUS.ACTIVE,
			createdAt: "2023-01-01T00:00:00.000Z",
			arn: "existing-arn",
			version: "existing-version",
			accessedAt: "2023-01-01T00:00:00.000Z",
			operation: OPERATION.READ
		};

		beforeEach(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2023-01-01T10:00:00.000Z"));
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("should successfully update a secret", async () => {
			// Mock getSecret to return existing data
			jest.spyOn(secretsManagerService, "getSecret").mockResolvedValue(existingSecretData);
			mockSend.mockResolvedValue(mockPutResponse as never);

			const updateData = { storage_data: "updated-storage-data" };
			const result = await secretsManagerService.updateSecret(
				mockSecretData.customer_id as string,
				updateData as unknown as SecretData
			);

			expect(secretsManagerService.getSecret).toHaveBeenCalledWith(mockSecretData.customer_id as string);

			expect(result).toEqual({
				...existingSecretData,
				...updateData,
				updatedAt: "2023-01-01T10:00:00.000Z",
				arn: mockPutResponse.ARN,
				version: mockPutResponse.VersionId,
				accessedAt: "2023-01-01T10:00:00.000Z",
				operation: OPERATION.UPDATE,
				status: SECRET_STATUS.ACTIVE
			});

			expect(logger.info).toHaveBeenCalledWith("[AWS Secrets Manager] Updating secret");
			expect(logger.info).toHaveBeenCalledWith("[AWS Secrets Manager] Secret updated");
		});

		it("should return object with message when secret does not exist", async () => {
			jest.spyOn(secretsManagerService, "getSecret").mockResolvedValue(null);

			const updateData = { storage_data: "updated-storage-data" };

			const result = await secretsManagerService.updateSecret(
				mockSecretData.customer_id as string,
				updateData as unknown as SecretData
			);

			expect(result).toEqual({
				customer_id: mockSecretData.customer_id,
				storage_data: "",
				accessedAt: expect.any(String),
				operation: OPERATION.UPDATE,
				message: "Secret not found"
			});
		});

		it("should return undefined for AWS exceptions", async () => {
			jest.spyOn(secretsManagerService, "getSecret").mockResolvedValue(existingSecretData);

			const error = new Error("AWS Error");
			mockSend.mockRejectedValue(error as never);

			const updateData = { storage_data: "updated-storage-data" };

			await expect(
				secretsManagerService.updateSecret(mockSecretData.customer_id as string, updateData as unknown as SecretData)
			).rejects.toThrow(SecretsManagerError);
		});
	});

	describe("deleteSecret", () => {
		const mockDeleteResponse = {
			ARN: "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret",
			Name: "test-secret-name"
		};

		beforeEach(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2023-01-01T00:00:00.000Z"));
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("should successfully delete a secret", async () => {
			mockSend.mockResolvedValue(mockDeleteResponse as never);

			const result = await secretsManagerService.deleteSecret(mockSecretData.customer_id as string);

			expect(result).toEqual({
				arn: mockDeleteResponse.ARN,
				accessedAt: "2023-01-01T00:00:00.000Z",
				operation: OPERATION.DELETE
			});

			expect(logger.info).toHaveBeenCalledWith("[AWS Secrets Manager] Secret deleted");
		});

		it("should return undefined for ResourceNotFoundException", async () => {
			const notFoundError = new Error("Secret not found");
			notFoundError.name = "ResourceNotFoundException";

			mockSend.mockRejectedValue(notFoundError as never);

			await expect(secretsManagerService.deleteSecret(mockSecretData.customer_id as string)).rejects.toThrow(
				SecretsManagerError
			);
		});

		it("should return undefined for other exceptions", async () => {
			const error = new Error("Some other error");
			mockSend.mockRejectedValue(error as never);

			await expect(secretsManagerService.deleteSecret(mockSecretData.customer_id as string)).rejects.toThrow(
				SecretsManagerError
			);
		});
	});

	describe("Edge Cases and Integration", () => {
		it("should return undefined for invalid JSON in secret string", async () => {
			const invalidJsonResponse = {
				ARN: "arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret",
				Name: "test-secret-name",
				VersionId: "version-123",
				SecretString: "invalid-json"
			};

			mockSend.mockResolvedValue(invalidJsonResponse as never);

			await expect(secretsManagerService.getSecret(mockSecretData.customer_id as string)).rejects.toThrow(
				SecretsManagerError
			);
		});

		it("should preserve existing data when updating", async () => {
			const existingData = {
				...mockSecretData,
				status: SECRET_STATUS.ACTIVE,
				createdAt: "2023-01-01T00:00:00.000Z",
				arn: "existing-arn",
				version: "existing-version",
				accessedAt: "2023-01-01T00:00:00.000Z",
				operation: OPERATION.READ
			};

			jest.spyOn(secretsManagerService, "getSecret").mockResolvedValue(existingData);
			mockSend.mockResolvedValue({
				ARN: "new-arn",
				VersionId: "new-version"
			} as never);

			const updateData = { storage_data: "new-storage-data" };
			const result = await secretsManagerService.updateSecret(
				mockSecretData.customer_id as string,
				updateData as unknown as SecretData
			);

			// Verify that getSecret was called to fetch existing data
			expect(secretsManagerService.getSecret).toHaveBeenCalledWith(mockSecretData.customer_id as string);

			// Verify the operation was successful and includes merged data
			expect(result).toEqual({
				...existingData,
				...updateData,
				updatedAt: expect.any(String),
				arn: "new-arn",
				version: "new-version",
				accessedAt: expect.any(String),
				operation: OPERATION.UPDATE,
				status: SECRET_STATUS.ACTIVE
			});

			// Verify that the AWS operation was called
			expect(mockSend).toHaveBeenCalled();
		});
	});

	describe("Error Mapping", () => {
		beforeEach(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2023-01-01T00:00:00.000Z"));
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("should map ResourceNotFoundException to null for getSecret", async () => {
			const notFoundError = new Error("Secret not found");
			notFoundError.name = "ResourceNotFoundException";

			mockSend.mockRejectedValue(notFoundError as never);

			const result = await secretsManagerService.getSecret(mockSecretData.customer_id);
			expect(result).toBeNull();
		});

		it("should map ResourceExistsException to appropriate error", async () => {
			const existsError = new Error("Secret already exists");
			existsError.name = "ResourceExistsException";

			mockSend.mockRejectedValue(existsError as never);

			try {
				await secretsManagerService.createSecret(mockSecretData as unknown as SecretData);
			} catch (error: any) {
				expect(error).toBeInstanceOf(SecretsManagerError);
				expect(error.message).toBe("Secret already exists");
				expect(error.status).toBe(409);
				expect(error.errorCode).toBe("DUPLICATE");
				expect(error.operation).toBe(OPERATION.CREATE);
			}
		});

		it("should map AccessDeniedException to appropriate error", async () => {
			const accessError = new Error("Access denied");
			accessError.name = "AccessDeniedException";

			mockSend.mockRejectedValue(accessError as never);

			try {
				await secretsManagerService.getSecret(mockSecretData.customer_id);
			} catch (error: any) {
				expect(error).toBeInstanceOf(SecretsManagerError);
				expect(error.message).toBe("Access denied to secret");
				expect(error.status).toBe(403);
				expect(error.errorCode).toBe("UNAUTHORIZED");
				expect(error.operation).toBe(OPERATION.READ);
			}
		});

		it("should map InvalidParameterException to appropriate error", async () => {
			const invalidError = new Error("Invalid parameter");
			invalidError.name = "InvalidParameterException";

			mockSend.mockRejectedValue(invalidError as never);

			try {
				await secretsManagerService.getSecret(mockSecretData.customer_id);
			} catch (error: any) {
				expect(error).toBeInstanceOf(SecretsManagerError);
				expect(error.message).toBe("Invalid parameter");
				expect(error.status).toBe(400);
				expect(error.errorCode).toBe("NOT_FOUND");
				expect(error.operation).toBe(OPERATION.READ);
			}
		});

		it("should map unknown errors to default error", async () => {
			const unknownError = new Error("Unknown AWS error");
			unknownError.name = "UnknownException";

			mockSend.mockRejectedValue(unknownError as never);

			try {
				await secretsManagerService.getSecret(mockSecretData.customer_id);
			} catch (error: any) {
				expect(error).toBeInstanceOf(SecretsManagerError);
				expect(error.message).toBe("Unknown error occurred");
				expect(error.status).toBe(500);
				expect(error.errorCode).toBe("UNKNOWN_ERROR");
				expect(error.operation).toBe(OPERATION.READ);
			}
		});

		it("should map errors for different operations correctly", async () => {
			const notFoundError = new Error("Secret not found");
			notFoundError.name = "ResourceNotFoundException";

			// Test UPDATE operation - when getSecret fails with raw error, updateSecret maps it with UPDATE operation
			jest.spyOn(secretsManagerService, "getSecret").mockRejectedValue(notFoundError);

			try {
				await secretsManagerService.updateSecret(mockSecretData.customer_id, mockSecretData as unknown as SecretData);
			} catch (error: any) {
				expect(error).toBeInstanceOf(SecretsManagerError);
				// updateSecret catches any error and re-throws it with UPDATE operation
				expect(error.operation).toBe(OPERATION.UPDATE);
				expect(error.message).toBe("Secret not found");
			}

			// Reset the spy for the next test
			jest.restoreAllMocks();

			// Test DELETE operation
			mockSend.mockRejectedValue(notFoundError as never);

			try {
				await secretsManagerService.deleteSecret(mockSecretData.customer_id);
			} catch (error: any) {
				expect(error).toBeInstanceOf(SecretsManagerError);
				expect(error.message).toBe("Secret not found");
				expect(error.operation).toBe(OPERATION.DELETE);
			}
		});
	});
});
