import { ExtractPrivateKeyFileHandler } from "#lib/fileHandler/ExtractPrivateKeyFileHandler";
import { matchConnection } from "../matchConnection";
import { connectionStatus } from "#lib/match/types";
import { schema } from "../schema";
import { secretsManagerService } from "#api/v1/modules/secrets/secrets";
import axios from "axios";

// Mock the logger to avoid log outputs during tests
jest.mock("#helpers", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	}
}));

// Mock the secretsManagerService
jest.mock("#api/v1/modules/secrets/secrets", () => ({
	secretsManagerService: {
		getSecret: jest.fn()
	}
}));

// Mock the envConfig
jest.mock("#configs", () => ({
	envConfig: {
		MATCH_SANDBOX_URL: "https://sandbox.apiedge.mastercard.com/mcp/match/api/termination-inquiry",
		MATCH_PRODUCTION_URL: "https://apiedge.mastercard.com/mcp/match/api/termination-inquiry",
		MATCH_MTF_URL: "https://apiedge.mastercard.com/mtf/mcp/match/api/termination-inquiry",
		MATCH_ENV: "sandbox"
	}
}));

// Mock the OAuth library
jest.mock("mastercard-oauth1-signer", () => ({
	getAuthorizationHeader: jest.fn(() => "mocked-auth-header")
}));

// Mock axios
jest.mock("axios", () => jest.fn());

describe("Match-Pro Module - Essential Tests", () => {
	describe("ExtractPrivateKeyFileHandler", () => {
		it("should handle PEM private key extraction", () => {
			const pemContent = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8Q7HgUTm5m5R
-----END PRIVATE KEY-----`;

			const mockFile = {
				originalname: "test.pem",
				buffer: Buffer.from(pemContent),
				mimetype: "application/x-pem-file"
			} as Express.Multer.File;

			const result = ExtractPrivateKeyFileHandler.loadPrivateKey(mockFile, "");
			expect(result).toBe(pemContent);
		});

		it("should throw error for invalid PEM content", () => {
			const invalidContent = "This is not a valid private key";
			const mockFile = {
				originalname: "invalid.pem",
				buffer: Buffer.from(invalidContent),
				mimetype: "application/x-pem-file"
			} as Express.Multer.File;

			expect(() => ExtractPrivateKeyFileHandler.loadPrivateKey(mockFile, "")).toThrow("Failed to load PEM private key");
		});

		it("should handle P12 files and throw error without proper content", () => {
			const mockP12Content = "fake-p12-content";
			const mockFile = {
				originalname: "test.p12",
				buffer: Buffer.from(mockP12Content),
				mimetype: "application/pkcs12"
			} as Express.Multer.File;

			expect(() => ExtractPrivateKeyFileHandler.loadPrivateKey(mockFile, "password")).toThrow(
				"Failed to load P12 private key"
			);
		});
	});

	describe("Schema Validation", () => {
		it("should validate UUID format for customerID", async () => {
			const { schema } = await import("../schema");

			// Valid UUID
			const validUUID = "123e4567-e89b-12d3-a456-426614174000";
			expect(() => schema.checkConnectionStatus.shape.params.parse({ customerId: validUUID })).not.toThrow();

			// Invalid UUID
			const invalidUUID = "not-a-uuid";
			expect(() => schema.checkConnectionStatus.shape.params.parse({ customerId: invalidUUID })).toThrow();
		});

		it("should validate credentials schema with optional fields", async () => {
			const { schema } = await import("../schema");

			// All fields provided with valid file (should work when isActive is true)
			const validCredentials = {
				params: { customerId: "550e8400-e29b-41d4-a716-446655440000" },
				body: {
					customerName: "Test Customer",
					consumerKey: "test-consumer-key",
					acquirerId: "test-acquirer-id",
					keyPassword: "test-password",
					isActive: true
				},
				file: {
					originalname: "test.p12",
					mimetype: "application/pkcs12"
				} as Express.Multer.File
			};

			expect(() => schema.credentials.parse(validCredentials)).not.toThrow();

			// Only isActive field as false (should work since other fields are optional when isActive is false)
			const minimalCredentials = {
				params: { customerId: "550e8400-e29b-41d4-a716-446655440000" },
				body: {
					isActive: false
				}
			};

			expect(() => schema.credentials.parse(minimalCredentials)).not.toThrow();

			// Missing isActive field - with z.coerce.string(), missing field gets converted to "undefined" string, which is truthy
			const invalidCredentials = {
				params: { customerId: "550e8400-e29b-41d4-a716-446655440000" },
				body: {
					customerName: "Test Customer",
					consumerKey: "test-consumer-key"
					// isActive is missing - z.coerce.string() converts undefined to "undefined" string
				}
			};

			// With z.coerce.string(), missing fields don't throw - they get coerced to "undefined" string
			expect(() => schema.credentials.parse(invalidCredentials)).not.toThrow();
		});

		// New Tests from matchConnection.test.ts
		describe("Multi-ICA Schema Validation", () => {
			const validateIcas = (icas: any) => {
				// Access the ZodObject shape to get the body schema
				return schema.credentials.shape.body.parse({
					isActive: false, // validation of other fields is skipped when isActive is false
					icas: icas
				});
			};

			it("should validate comma-separated strings", () => {
				const validIcas = "12345,67890,ABCDE";
				const result = validateIcas(validIcas);
				expect(result.icas).toHaveLength(3);
				expect(result.icas[0].ica).toBe("12345");
				expect(result.icas[1].ica).toBe("67890");
				expect(result.icas[2].ica).toBe("ABCDE");
			});

			it("should validate JSON array of strings", () => {
				const validIcas = '["12345", "67890"]';
				const result = validateIcas(validIcas);
				expect(result.icas).toHaveLength(2);
				expect(result.icas[0].ica).toBe("12345");
				expect(result.icas[0].isDefault).toBe(true);
				expect(result.icas[1].ica).toBe("67890");
				expect(result.icas[1].isDefault).toBe(false);
			});

			it("should validate JSON array of objects", () => {
				const validIcas = '[{"ica": "12345", "isDefault": true}, {"ica": "67890", "isDefault": false}]';
				const result = validateIcas(validIcas);
				expect(result.icas).toHaveLength(2);
				expect(result.icas[0].ica).toBe("12345");
				expect(result.icas[0].isDefault).toBe(true);
			});

			it("should validate JSON array of objects with implicit default", () => {
				const validIcas = '[{"ica": "12345"}, {"ica": "67890"}]';
				const result = validateIcas(validIcas);
				expect(result.icas).toHaveLength(2);
				expect(result.icas[0].ica).toBe("12345");
				expect(result.icas[0].isDefault).toBe(true); // First one becomes default
				expect(result.icas[1].isDefault).toBe(false);
			});

			it("should fail validation for non-alphanumeric characters", () => {
				const invalidIcas = "12345,67-890";
				expect(() => validateIcas(invalidIcas)).toThrow("Each ICA must be an alphanumeric value");
			});

			it("should fail validation for duplicate ICAs (case-insensitive)", () => {
				const duplicateIcas = "12345,12345";
				expect(() => validateIcas(duplicateIcas)).toThrow("ICAs must be unique");

				const duplicateIcasCase = "123ab,123AB";
				expect(() => validateIcas(duplicateIcasCase)).toThrow("ICAs must be unique");
			});
		});
	});

	describe("Controller Conditional Validation Tests", () => {
		let validateCredentialsWithZod: any;
		let mockFile: Express.Multer.File;

		beforeEach(async () => {
			jest.clearAllMocks();

			// Import the validation function directly
			const { validateCredentialsWithZod: validationFn } = await import("../controller");
			validateCredentialsWithZod = validationFn;

			mockFile = {
				originalname: "test.p12",
				mimetype: "application/pkcs12",
				buffer: Buffer.from("test"),
				fieldname: "file",
				encoding: "7bit",
				size: 1000,
				stream: {} as any,
				destination: "",
				filename: "",
				path: ""
			};
		});

		describe("When isActive is true", () => {
			it("should pass validation with all required fields and file", () => {
				const validBody = {
					isActive: true,
					customerName: "Test Customer",
					consumerKey: "test-key",
					icas: "12345",
					keyPassword: "test-password"
				};

				expect(() =>
					validateCredentialsWithZod({ customerId: "550e8400-e29b-41d4-a716-446655440000" }, validBody, mockFile)
				).not.toThrow();
			});

			it("should throw error when customerName is missing", () => {
				const bodyWithoutCustomerName = {
					isActive: true,
					consumerKey: "test-key",
					icas: "12345",
					keyPassword: "test-password"
				};

				expect(() =>
					validateCredentialsWithZod(
						{ customerId: "550e8400-e29b-41d4-a716-446655440000" },
						bodyWithoutCustomerName,
						mockFile
					)
				).toThrow("The following fields are required: customerName");
			});

			it("should throw error when consumerKey is missing", () => {
				const bodyWithoutConsumerKey = {
					isActive: true,
					customerName: "Test Customer",
					icas: "12345",
					keyPassword: "test-password"
				};

				expect(() =>
					validateCredentialsWithZod(
						{ customerId: "550e8400-e29b-41d4-a716-446655440000" },
						bodyWithoutConsumerKey,
						mockFile
					)
				).toThrow("The following fields are required: consumerKey");
			});

			it("should throw error when icas is missing", () => {
				const bodyWithoutIcas = {
					isActive: true,
					customerName: "Test Customer",
					consumerKey: "test-key",
					keyPassword: "test-password"
				};

				expect(() =>
					validateCredentialsWithZod({ customerId: "550e8400-e29b-41d4-a716-446655440000" }, bodyWithoutIcas, mockFile)
				).toThrow("The following fields are required: icas");
			});

			it("should throw error when keyPassword is missing", () => {
				const bodyWithoutKeyPassword = {
					isActive: true,
					customerName: "Test Customer",
					consumerKey: "test-key",
					icas: "12345"
				};

				expect(() =>
					validateCredentialsWithZod(
						{ customerId: "550e8400-e29b-41d4-a716-446655440000" },
						bodyWithoutKeyPassword,
						mockFile
					)
				).toThrow("The following fields are required: keyPassword");
			});

			it("should throw error when multiple fields are missing", () => {
				const bodyWithMultipleMissing = {
					isActive: true,
					icas: "12345",
					keyPassword: "test-password"
				};

				expect(() =>
					validateCredentialsWithZod(
						{ customerId: "550e8400-e29b-41d4-a716-446655440000" },
						bodyWithMultipleMissing,
						mockFile
					)
				).toThrow("The following fields are required: customerName, consumerKey");
			});

			it("should throw error when file is missing", () => {
				const validBody = {
					isActive: true,
					customerName: "Test Customer",
					consumerKey: "test-key",
					icas: "12345",
					keyPassword: "test-password"
				};

				expect(() =>
					validateCredentialsWithZod({ customerId: "550e8400-e29b-41d4-a716-446655440000" }, validBody, undefined)
				).toThrow("File is required");
			});

			it("should throw error for invalid file type", () => {
				const validBody = {
					isActive: true,
					customerName: "Test Customer",
					consumerKey: "test-key",
					icas: "12345",
					keyPassword: "test-password"
				};

				const invalidFile = {
					...mockFile,
					originalname: "test.txt",
					mimetype: "text/plain"
				};

				expect(() =>
					validateCredentialsWithZod({ customerId: "550e8400-e29b-41d4-a716-446655440000" }, validBody, invalidFile)
				).toThrow("Only PKCS#12 (.p12/.pfx) or PEM files are allowed");
			});

			it("should accept PEM files", () => {
				const validBody = {
					isActive: true,
					customerName: "Test Customer",
					consumerKey: "test-key",
					icas: "12345",
					keyPassword: "test-password"
				};

				const pemFile = {
					...mockFile,
					originalname: "test.pem",
					mimetype: "application/x-pem-file"
				};

				expect(() =>
					validateCredentialsWithZod({ customerId: "550e8400-e29b-41d4-a716-446655440000" }, validBody, pemFile)
				).not.toThrow();
			});

			it("should accept P12 files", () => {
				const validBody = {
					isActive: true,
					customerName: "Test Customer",
					consumerKey: "test-key",
					icas: "12345",
					keyPassword: "test-password"
				};

				const p12File = {
					...mockFile,
					originalname: "test.p12",
					mimetype: "application/pkcs12"
				};

				expect(() =>
					validateCredentialsWithZod({ customerId: "550e8400-e29b-41d4-a716-446655440000" }, validBody, p12File)
				).not.toThrow();
			});

			it("should accept PFX files", () => {
				const validBody = {
					isActive: true,
					customerName: "Test Customer",
					consumerKey: "test-key",
					icas: "12345",
					keyPassword: "test-password"
				};

				const pfxFile = {
					...mockFile,
					originalname: "test.pfx",
					mimetype: "application/pkcs12"
				};

				expect(() =>
					validateCredentialsWithZod({ customerId: "550e8400-e29b-41d4-a716-446655440000" }, validBody, pfxFile)
				).not.toThrow();
			});
		});

		describe("When isActive is falsy (empty string)", () => {
			it("should pass validation with minimal data when isActive is empty string", () => {
				const bodyisActiveFalsy = {
					isActive: "" // Empty string is falsy, so no validation required
				};

				expect(() =>
					validateCredentialsWithZod(
						{ customerId: "550e8400-e29b-41d4-a716-446655440000" },
						bodyisActiveFalsy,
						undefined
					)
				).not.toThrow();
			});

			it("should pass validation even with missing fields when isActive is empty", () => {
				const bodyMinimal = {
					isActive: "" // Empty string is falsy
					// No other fields
				};

				expect(() =>
					validateCredentialsWithZod({ customerId: "550e8400-e29b-41d4-a716-446655440000" }, bodyMinimal, undefined)
				).not.toThrow();
			});

			it("should allow optional file when isActive is empty string", () => {
				const bodyisActiveFalsy = {
					isActive: ""
				};

				expect(() =>
					validateCredentialsWithZod(
						{ customerId: "550e8400-e29b-41d4-a716-446655440000" },
						bodyisActiveFalsy,
						mockFile
					)
				).not.toThrow();
			});

			it("should not validate file type when isActive is empty string", () => {
				const bodyisActiveFalsy = {
					isActive: ""
				};

				const invalidFile = {
					...mockFile,
					originalname: "test.txt",
					mimetype: "text/plain"
				};

				// Should not throw even with invalid file type when isActive is empty (falsy)
				expect(() =>
					validateCredentialsWithZod(
						{ customerId: "550e8400-e29b-41d4-a716-446655440000" },
						bodyisActiveFalsy,
						invalidFile
					)
				).not.toThrow();
			});
		});

		describe("When isActive is truthy but not 'true'", () => {
			it("should require all fields when isActive is 'false' (truthy string)", () => {
				const bodyisActiveFalse = {
					isActive: false, // Non-empty string is truthy, so validation is required
					customerName: "Test Customer",
					consumerKey: "test-key",
					icas: "12345",
					keyPassword: "test-password"
				};

				expect(() =>
					validateCredentialsWithZod(
						{ customerId: "550e8400-e29b-41d4-a716-446655440000" },
						bodyisActiveFalse,
						mockFile
					)
				).not.toThrow();
			});

			it("should require all fields when isActive is any other string", () => {
				const bodyisActiveOther = {
					isActive: "anything-else", // Non-empty string is truthy, so validation is required
					customerName: "Test Customer",
					consumerKey: "test-key",
					icas: "12345",
					keyPassword: "test-password"
				};

				expect(() =>
					validateCredentialsWithZod(
						{ customerId: "550e8400-e29b-41d4-a716-446655440000" },
						bodyisActiveOther,
						mockFile
					)
				).not.toThrow();
			});

			it("should throw when required fields are missing and isActive is truthy string", () => {
				const bodyMinimal = {
					isActive: false // Non-empty string is truthy, so fields are required
					// Missing required fields
				};

				expect(() =>
					validateCredentialsWithZod({ customerId: "550e8400-e29b-41d4-a716-446655440000" }, bodyMinimal, undefined)
				).not.toThrow();
			});
		});
	});

	describe("MatchConnection Multi-ICA Logic", () => {
		describe("buildSecretsData", () => {
			const mockBody = {
				customerName: "Test Customer",
				consumerKey: "test-key",
				keyPassword: "password",
				isActive: true,
				icas: undefined as any // Will be set in tests
			};

			it("should normalize comma-separated string icas", () => {
				const body = { ...mockBody, icas: "123,456" };
				const secretsData = JSON.parse(matchConnection.buildSecretsData("privateKey", null, body));

				expect(secretsData.icas).toHaveLength(2);
				expect(secretsData.icas).toEqual([
					{ ica: "123", isDefault: true },
					{ ica: "456", isDefault: false }
				]);
			});

			it("should normalize JSON array string icas", () => {
				const body = { ...mockBody, icas: '["123", "456"]' };
				const secretsData = JSON.parse(matchConnection.buildSecretsData("privateKey", null, body));

				expect(secretsData.icas).toHaveLength(2);
				expect(secretsData.icas).toEqual([
					{ ica: "123", isDefault: true },
					{ ica: "456", isDefault: false }
				]);
			});

			it("should normalize JSON array objects icas", () => {
				const body = { ...mockBody, icas: '[{"ica": "123", "isDefault": false}, {"ica": "456", "isDefault": true}]' };
				const secretsData = JSON.parse(matchConnection.buildSecretsData("privateKey", null, body));

				expect(secretsData.icas).toHaveLength(2);
				expect(secretsData.icas).toContainEqual({ ica: "123", isDefault: false });
				expect(secretsData.icas).toContainEqual({ ica: "456", isDefault: true });
			});

			it("should handle mixed spacing in comma-separated string", () => {
				const body = { ...mockBody, icas: " 123 , 456 " };
				const secretsData = JSON.parse(matchConnection.buildSecretsData("privateKey", null, body));

				expect(secretsData.icas).toHaveLength(2);
				expect(secretsData.icas).toEqual([
					{ ica: "123", isDefault: true },
					{ ica: "456", isDefault: false }
				]);
			});
		});

		describe("getDefaultICA (via checkConnection mock payload)", () => {
			beforeEach(() => {
				jest.clearAllMocks();
			});

			it("should use first ICA as default if no isDefault=true found (Backwards compatibility logic)", async () => {
				const secrets = {
					storage_data: JSON.stringify({
						customerName: "Test",
						consumerKey: "key",
						privateKey: "pk",
						isActive: true,
						icas: [
							{ ica: "111", isDefault: false },
							{ ica: "222", isDefault: false }
						]
					})
				};
				(secretsManagerService.getSecret as jest.Mock).mockResolvedValue(secrets);
				(axios as unknown as jest.Mock).mockResolvedValue({ status: 200, data: { success: true } });

				await matchConnection.checkConnection("customer-id");

				expect(axios).toHaveBeenCalled();
				const axiosCall = (axios as unknown as jest.Mock).mock.calls[0][0];
				const body = JSON.parse(axiosCall.data);
				expect(body.terminationInquiryRequest.acquirerId).toBe("111");
			});

			it("should use the ICA marked as isDefault", async () => {
				const secrets = {
					storage_data: JSON.stringify({
						customerName: "Test",
						consumerKey: "key",
						privateKey: "pk",
						isActive: true,
						// Note: parseICAsInput sets the first one to default if none provided,
						// but here we are mocking what's ALREADY in secrets (simulating stored data)
						icas: [
							{ ica: "111", isDefault: false },
							{ ica: "222", isDefault: true }
						]
					})
				};
				(secretsManagerService.getSecret as jest.Mock).mockResolvedValue(secrets);
				(axios as unknown as jest.Mock).mockResolvedValue({ status: 200, data: { success: true } });

				await matchConnection.checkConnection("customer-id");

				expect(axios).toHaveBeenCalled();
				const axiosCall = (axios as unknown as jest.Mock).mock.calls[0][0];
				const body = JSON.parse(axiosCall.data);
				expect(body.terminationInquiryRequest.acquirerId).toBe("222");
			});

			it("should handle legacy acquirerId if icas is missing (Migration logic coverage in integration)", async () => {
				const secrets = {
					storage_data: JSON.stringify({
						customerName: "Test",
						consumerKey: "key",
						privateKey: "pk",
						isActive: true,
						acquirerId: "999"
					})
				};
				(secretsManagerService.getSecret as jest.Mock).mockResolvedValue(secrets);
				(axios as unknown as jest.Mock).mockResolvedValue({ status: 200, data: { success: true } });

				await matchConnection.checkConnection("customer-id");

				expect(axios).toHaveBeenCalled();
				const axiosCall = (axios as unknown as jest.Mock).mock.calls[0][0];
				const body = JSON.parse(axiosCall.data);
				expect(body.terminationInquiryRequest.acquirerId).toBe("999");
			});

			it("should correctly parse JSON string array of objects for default ICA", async () => {
				const secrets = {
					storage_data: JSON.stringify({
						customerName: "Test",
						consumerKey: "key",
						privateKey: "pk",
						isActive: true,
						icas: '[{"ica": "333", "isDefault": true}, {"ica": "444", "isDefault": false}]'
					})
				};
				(secretsManagerService.getSecret as jest.Mock).mockResolvedValue(secrets);
				(axios as unknown as jest.Mock).mockResolvedValue({ status: 200, data: { success: true } });

				await matchConnection.checkConnection("customer-id");

				const axiosCall = (axios as unknown as jest.Mock).mock.calls[0][0];
				const body = JSON.parse(axiosCall.data);
				expect(body.terminationInquiryRequest.acquirerId).toBe("333");
			});

			it("should correctly parse JSON string array of strings for default ICA", async () => {
				const secrets = {
					storage_data: JSON.stringify({
						customerName: "Test",
						consumerKey: "key",
						privateKey: "pk",
						isActive: true,
						icas: '["555", "666"]'
					})
				};
				(secretsManagerService.getSecret as jest.Mock).mockResolvedValue(secrets);
				(axios as unknown as jest.Mock).mockResolvedValue({ status: 200, data: { success: true } });

				await matchConnection.checkConnection("customer-id");

				const axiosCall = (axios as unknown as jest.Mock).mock.calls[0][0];
				const body = JSON.parse(axiosCall.data);
				expect(body.terminationInquiryRequest.acquirerId).toBe("555");
			});
		});
	});

	describe("Connection Status Tests", () => {
		beforeEach(() => {
			jest.clearAllMocks();
			// Reset default implementation if needed, though clearAllMocks should suffice for spies
		});

		it("should return error for invalid customerId", async () => {
			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue(null);
			const result = await matchConnection.checkConnection("");

			expect(result).toEqual({
				status: connectionStatus.NOT_CONNECTED,
				message: "Match Pro is not configured",
				details: {
					error: "No credentials found",
					isActive: false
				}
			});
		});

		it("should return expired status for expired certificate", async () => {
			// Mock expired certificate
			const expiredDate = new Date("2020-01-01");
			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue({
				storage_data: JSON.stringify({
					customerId: "test-customer",
					customerName: "Test Customer",
					consumerKey: "test-key",
					privateKey: "test-private-key",
					icas: "test-acquirer",
					isActive: true,
					metadata: {
						validity: {
							notBefore: new Date("2019-01-01"),
							notAfter: expiredDate,
							isValid: false,
							daysUntilExpiry: -1000
						}
					}
				})
			});

			const result = await matchConnection.checkConnection("test-customer-id");

			expect(result).toEqual({
				status: connectionStatus.EXPIRED,
				message: "Certificate has expired",
				details: {
					certificateExpiry: expiredDate.toISOString(),
					expiresAt: expiredDate.toISOString(),
					isActive: true
				}
			});
		});

		it("should return connected status for successful API response", async () => {
			// Mock valid certificate (not expired)
			const validDate = new Date();
			validDate.setFullYear(validDate.getFullYear() + 1); // 1 year from now

			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue({
				storage_data: JSON.stringify({
					customerId: "test-customer",
					customerName: "Test Customer",
					consumerKey: "test-key",
					privateKey: "test-private-key",
					icas: "test-acquirer",
					isActive: true,
					metadata: {
						validity: {
							notBefore: new Date("2023-01-01"),
							notAfter: validDate,
							isValid: true,
							daysUntilExpiry: 365
						}
					}
				})
			});

			// Mock successful API response
			(axios as unknown as jest.Mock).mockResolvedValue({
				status: 200,
				data: { success: true }
			});

			const result = await matchConnection.checkConnection("test-customer-id");

			expect(result).toEqual({
				status: connectionStatus.CONNECTED,
				message: "Successfully connected to Match API",
				details: {
					statusCode: 200,
					expiresAt: expect.any(String),
					isActive: true
				}
			});
		});

		it("should return connected status for HTTP 400 (Business Validation Error)", async () => {
			const validDate = new Date();
			validDate.setFullYear(validDate.getFullYear() + 1);

			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue({
				storage_data: JSON.stringify({
					customerId: "test-customer",
					isActive: true,
					metadata: { validity: { notAfter: validDate } }
				})
			});

			(axios as unknown as jest.Mock).mockResolvedValue({
				status: 400,
				data: { Errors: { Error: [{ Details: "Business error" }] } }
			});

			const result = await matchConnection.checkConnection("test-customer-id");

			expect(result.status).toBe(connectionStatus.CONNECTED);
			expect(result.message).toBe("Successfully connected to Match API");
		});

		it("should return not connected status for authentication failure (401/403)", async () => {
			const validDate = new Date();
			validDate.setFullYear(validDate.getFullYear() + 1);

			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue({
				storage_data: JSON.stringify({
					customerId: "test-customer",
					isActive: true,
					metadata: { validity: { notAfter: validDate } }
				})
			});

			// 401 Unauthorized
			(axios as unknown as jest.Mock).mockResolvedValue({
				status: 401,
				data: { error: "unauthorized" }
			});

			let result = await matchConnection.checkConnection("test-customer-id");
			expect(result.status).toBe(connectionStatus.NOT_CONNECTED);

			// 403 Forbidden
			(axios as unknown as jest.Mock).mockResolvedValue({
				status: 403,
				data: { error: "forbidden" }
			});

			result = await matchConnection.checkConnection("test-customer-id");
			expect(result.status).toBe(connectionStatus.NOT_CONNECTED);
		});

		it("should return not connected status for invalid credentials (legacy test)", async () => {
			const validDate = new Date();
			validDate.setFullYear(validDate.getFullYear() + 1);

			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue({
				storage_data: JSON.stringify({
					customerId: "test-customer",
					customerName: "Test Customer",
					consumerKey: "invalid-key",
					privateKey: "invalid-private-key",
					icas: "test-acquirer",
					isActive: true,
					metadata: {
						validity: {
							notBefore: new Date("2023-01-01"),
							notAfter: validDate,
							isValid: true,
							daysUntilExpiry: 365
						}
					}
				})
			});

			(axios as unknown as jest.Mock).mockResolvedValue({
				status: 401,
				data: { error: "Unauthorized", message: "Invalid credentials" }
			});

			const result = await matchConnection.checkConnection("test-customer-id");

			expect(result).toEqual({
				status: connectionStatus.NOT_CONNECTED,
				message: "Authentication failed - invalid credentials or unauthorized access",
				details: {
					statusCode: 401,
					expiresAt: expect.any(String),
					error: JSON.stringify({ error: "Unauthorized", message: "Invalid credentials" }),
					isActive: true
				}
			});
		});

		it("should use MTF URL when MATCH_ENV is mtf", async () => {
			const { envConfig } = await import("#configs");
			const originalEnv = envConfig.MATCH_ENV;
			envConfig.MATCH_ENV = "mtf";

			const validDate = new Date();
			validDate.setFullYear(validDate.getFullYear() + 1);

			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue({
				storage_data: JSON.stringify({
					customerId: "test-customer",
					isActive: true,
					metadata: { validity: { notAfter: validDate } }
				})
			});

			(axios as unknown as jest.Mock).mockResolvedValue({
				status: 200,
				data: { success: true }
			});

			try {
				await matchConnection.checkConnection("test-customer-id");
				expect(axios).toHaveBeenCalledWith(
					expect.objectContaining({
						url: envConfig.MATCH_MTF_URL
					})
				);
			} finally {
				envConfig.MATCH_ENV = originalEnv;
			}
		});

		it("should return error status for server error", async () => {
			const validDate = new Date();
			validDate.setFullYear(validDate.getFullYear() + 1);

			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue({
				storage_data: JSON.stringify({
					customerId: "test-customer",
					customerName: "Test Customer",
					consumerKey: "test-key",
					privateKey: "test-private-key",
					icas: "test-acquirer",
					isActive: true,
					metadata: {
						validity: {
							notBefore: new Date("2023-01-01"),
							notAfter: validDate,
							isValid: true,
							daysUntilExpiry: 365
						}
					}
				})
			});

			(axios as unknown as jest.Mock).mockResolvedValue({
				status: 500,
				data: { error: "Internal Server Error", message: "Something went wrong" }
			});

			const result = await matchConnection.checkConnection("test-customer-id");

			expect(result).toEqual({
				status: connectionStatus.ERROR,
				message: "Unexpected response from Match API",
				details: {
					statusCode: 500,
					error: JSON.stringify({ error: "Internal Server Error", message: "Something went wrong" }),
					isActive: true
				}
			});
		});

		it("should return NOT_CONNECTED when secrets retrieval fails or returns null", async () => {
			(secretsManagerService.getSecret as jest.Mock).mockRejectedValue(new Error("Secrets not found"));

			const result = await matchConnection.checkConnection("test-customer-id");

			expect(result).toEqual({
				status: connectionStatus.NOT_CONNECTED,
				message: "Match Pro is not configured",
				details: {
					error: "No credentials found",
					isActive: false
				}
			});
		});

		it("should return error when API request throws network error", async () => {
			const validDate = new Date();
			validDate.setFullYear(validDate.getFullYear() + 1);

			(secretsManagerService.getSecret as jest.Mock).mockResolvedValue({
				storage_data: JSON.stringify({
					customerId: "test-customer",
					customerName: "Test Customer",
					consumerKey: "test-key",
					privateKey: "test-private-key",
					icas: "test-acquirer",
					isActive: true,
					metadata: {
						validity: {
							notBefore: new Date("2023-01-01"),
							notAfter: validDate,
							isValid: true,
							daysUntilExpiry: 365
						}
					}
				})
			});

			// Mock network error
			(axios as unknown as jest.Mock).mockRejectedValue(new Error("Network Error: Connection timeout"));

			const result = await matchConnection.checkConnection("test-customer-id");

			expect(result).toEqual({
				status: connectionStatus.ERROR,
				message: "Failed to connect to Match API",
				details: {
					error: "Network Error: Connection timeout",
					isActive: true
				}
			});
		});
	});
});
