import { controller } from "../controller";
import { KYX } from "#lib/kyx/kyx";
import type { UUID } from "crypto";
import type { Request } from "express";
import type { Response } from "#types/index";

// Mock the logger to avoid log outputs during tests
jest.mock("#helpers", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	}
}));

// Mock platformHelper to prevent zod-v4 import chain
jest.mock("#helpers/platformHelper", () => ({
	getOrCreateConnection: jest.fn(),
	platformFactory: jest.fn()
}));

// Mock encryption utilities - will be overridden in encryption tests
jest.mock("#utils/encryption");

// Mock catchAsync to directly execute the function instead of wrapping it
jest.mock("#utils/catchAsync", () => ({
	catchAsync: (fn: any) => fn
}));

// Mock utils/index to prevent zod-v4 import chain through controller
jest.mock("#utils/index", () => ({
	catchAsync: (fn: any) => fn
}));

// Mock axios
jest.mock("axios", () => jest.fn());

// Mock taskHandler to prevent zod-v4 import chain
jest.mock("#workers/taskHandler", () => ({
	taskQueue: {
		queue: {
			process: jest.fn()
		}
	},
	initTaskWorker: jest.fn()
}));

// Mock the KYX class for controller tests
jest.mock("#lib/kyx/kyx", () => {
	const actualModule = jest.requireActual("#lib/kyx/kyx");
	return {
		...actualModule,
		KYX: class extends actualModule.KYX {
			static getKYXResult = jest.fn();
		}
	};
});

describe("KYX Module - Route Tests", () => {
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;
	let mockNext: jest.Mock;

	const businessId = "00000000-0000-0000-0000-000000000001" as UUID;

	const mockKYXResponse = {
		txId: "a9c6c3c8-xxxx-4071-xxx-9cf34b564a36",
		timestamp: "2025-11-12T18:50:09.747Z",
		prefillExpress: {
			status: "pass",
			details: {
				phone: {
					type: "Mobile",
					carrier: "T-Mobile USA",
					phoneNumber: "+15555555555",
					activityScore: 800
				},
				emails: [],
				person: {
					dob: "1999-02-2",
					ssn: "777-77-7777",
					fullName: "Test Name",
					lastName: "last name",
					firstName: "test",
					middleName: "name"
				},
				addresses: [
					{
						city: "Sanford",
						zip4: "",
						state: "FL",
						county: "Seminole",
						country: "USA",
						address1: "6985 Test Address",
						address2: "",
						postalCode: "35555"
					}
				]
			},
			reasons: [
				{
					code: "MC1006",
					message: "Phone number intelligence check met"
				}
			],
			sources: [
				{
					id: "global-phone",
					sourceId: "s1597",
					matchCode: "MC1006",
					matchCriteria: ["phoneNumber"]
				},
				{
					id: "usa_gov",
					sourceId: "s1354",
					matchCode: "MC1006",
					matchCriteria: ["phoneNumber"]
				}
			],
			attributes: {
				phoneNumber: {
					status: "MATCH",
					sources: [
						{
							status: "MATCH",
							sourceId: "s1354"
						},
						{
							status: "MATCH",
							sourceId: "s1597"
						}
					],
					sourceId: "s1354"
				}
			},
			reasonCodes: ["MC1006"]
		}
	};

	beforeEach(() => {
		mockRequest = {
			params: {
				businessId
			},
			body: {},
			query: {},
			headers: {
				authorization: "Bearer test-token"
			}
		};

		mockResponse = {
			jsend: {
				success: jest.fn(),
				error: jest.fn()
			}
		} as any;

		mockNext = jest.fn();

		jest.clearAllMocks();
	});

	describe("Schema Validation", () => {
		it("should validate UUID format for businessId", async () => {
			const { schema } = await import("../schema");

			// Valid UUID
			const validUUID = "123e4567-e89b-12d3-a456-426614174000";
			const validResult = schema.getKyxMatch.params.validate({ businessId: validUUID });
			expect(validResult.error).toBeUndefined();
			expect(validResult.value.businessId).toBe(validUUID);

			// Invalid UUID
			const invalidUUID = "not-a-uuid";
			const invalidResult = schema.getKyxMatch.params.validate({ businessId: invalidUUID });
			expect(invalidResult.error).toBeDefined();
			expect(invalidResult.error?.message).toMatch(/uuid|GUID/i);
		});

		it("should require businessId parameter", async () => {
			const { schema } = await import("../schema");

			// Missing businessId
			const result = schema.getKyxMatch.params.validate({});
			expect(result.error).toBeDefined();
			expect(result.error?.message).toContain("required");
		});

		it("should reject empty string businessId", async () => {
			const { schema } = await import("../schema");

			const result = schema.getKyxMatch.params.validate({ businessId: "" });
			expect(result.error).toBeDefined();
		});
	});

	describe("Controller - getKYXMatch", () => {
		it("should successfully fetch KYX result for a business", async () => {
			(KYX.getKYXResult as jest.Mock).mockResolvedValue(mockKYXResponse);

			await controller.getKYXMatch(mockRequest as Request, mockResponse as Response, mockNext);

			expect(KYX.getKYXResult).toHaveBeenCalledWith({ businessId });
			expect(mockResponse.jsend?.success).toHaveBeenCalledWith(
				mockKYXResponse,
				"Business KYX result fetched successfully."
			);
			expect(mockResponse.jsend?.error).not.toHaveBeenCalled();
		});

		it("should return empty object message when no KYX data exists for the business", async () => {
			(KYX.getKYXResult as jest.Mock).mockResolvedValue({});

			await controller.getKYXMatch(mockRequest as Request, mockResponse as Response, mockNext);

			expect(KYX.getKYXResult).toHaveBeenCalledWith({ businessId });
			expect(mockResponse.jsend?.success).toHaveBeenCalledWith({}, "There is no KYX data for this business.");
			expect(mockResponse.jsend?.error).not.toHaveBeenCalled();
		});

		it("should handle errors when fetching KYX result fails", async () => {
			const errorMessage = "Database connection error";
			(KYX.getKYXResult as jest.Mock).mockRejectedValue(new Error(errorMessage));

			await expect(
				controller.getKYXMatch(mockRequest as Request, mockResponse as Response, mockNext)
			).rejects.toThrow(errorMessage);

			expect(KYX.getKYXResult).toHaveBeenCalledWith({ businessId });
			expect(mockResponse.jsend?.success).not.toHaveBeenCalled();
		});

		it("should handle partial KYX response data", async () => {
			const partialResponse = {
				txId: "a9c6c3c8-xxxx-4071-xxx-9cf34b564a37",
				timestamp: "2025-11-12T18:50:09.747Z",
				prefillExpress: {
					status: "pass"
				}
			};
			(KYX.getKYXResult as jest.Mock).mockResolvedValue(partialResponse);

			await controller.getKYXMatch(mockRequest as Request, mockResponse as Response, mockNext);

			expect(KYX.getKYXResult).toHaveBeenCalledWith({ businessId });
			expect(mockResponse.jsend?.success).toHaveBeenCalledWith(
				partialResponse,
				"Business KYX result fetched successfully."
			);
		});

		it("should handle KYX response with failed status", async () => {
			const failedResponse = {
				txId: "a9c6c3c8-xxxx-4071-xxx-9cf34b564a38",
				timestamp: "2025-11-12T18:50:09.747Z",
				prefillExpress: {
					status: "fail",
					details: {
						phone: {
							type: "Mobile",
							carrier: "Unknown",
							phoneNumber: "+15555555555",
							activityScore: 0
						},
						emails: [],
						person: {},
						addresses: []
					},
					reasons: [
						{
							code: "MC1001",
							message: "Phone number verification failed"
						}
					],
					sources: [],
					attributes: {},
					reasonCodes: ["MC1001"]
				}
			};
			(KYX.getKYXResult as jest.Mock).mockResolvedValue(failedResponse);

			await controller.getKYXMatch(mockRequest as Request, mockResponse as Response, mockNext);

			expect(KYX.getKYXResult).toHaveBeenCalledWith({ businessId });
			expect(mockResponse.jsend?.success).toHaveBeenCalledWith(
				failedResponse,
				"Business KYX result fetched successfully."
			);
		});

		it("should call getKYXResult with correct businessId parameter", async () => {
			const differentBusinessId = "11111111-1111-1111-1111-111111111111" as UUID;
			mockRequest.params = {
				businessId: differentBusinessId
			};

			(KYX.getKYXResult as jest.Mock).mockResolvedValue(mockKYXResponse);

			await controller.getKYXMatch(mockRequest as Request, mockResponse as Response, mockNext);

			expect(KYX.getKYXResult).toHaveBeenCalledWith({ businessId: differentBusinessId });
		});

		it("should handle response with null or undefined values", async () => {
			const responseWithNulls = {
				txId: "a9c6c3c8-xxxx-4071-xxx-9cf34b564a39",
				timestamp: "2025-11-12T18:50:09.747Z",
				prefillExpress: null
			};
			(KYX.getKYXResult as jest.Mock).mockResolvedValue(responseWithNulls);

			await controller.getKYXMatch(mockRequest as Request, mockResponse as Response, mockNext);

			expect(KYX.getKYXResult).toHaveBeenCalledWith({ businessId });
			expect(mockResponse.jsend?.success).toHaveBeenCalledWith(
				responseWithNulls,
				"Business KYX result fetched successfully."
			);
		});

		it("should handle network errors gracefully", async () => {
			const networkError = new Error("Network Error: Connection timeout");
			(KYX.getKYXResult as jest.Mock).mockRejectedValue(networkError);

			await expect(
				controller.getKYXMatch(mockRequest as Request, mockResponse as Response, mockNext)
			).rejects.toThrow("Network Error: Connection timeout");

			expect(KYX.getKYXResult).toHaveBeenCalledWith({ businessId });
			expect(mockResponse.jsend?.success).not.toHaveBeenCalled();
		});

		it("should handle database query errors", async () => {
			const dbError = new Error("Database query failed: connection lost");
			(KYX.getKYXResult as jest.Mock).mockRejectedValue(dbError);

			await expect(
				controller.getKYXMatch(mockRequest as Request, mockResponse as Response, mockNext)
			).rejects.toThrow("Database query failed: connection lost");

			expect(KYX.getKYXResult).toHaveBeenCalledWith({ businessId });
		});
	});

	describe("KYX Class - Encryption/Decryption Functions", () => {
		// Import the actual KYX class and encryption utilities
		let KYXClass: typeof KYX;
		let encryptData: (data: any) => string;
		let decryptData: (data: string) => any;
		const mockEncryptData = jest.fn((data: any) => `encrypted_${JSON.stringify(data)}`);
		const mockDecryptData = jest.fn((data: string) => {
			if (typeof data === 'string' && data.startsWith('encrypted_')) {
				return JSON.parse(data.replace('encrypted_', ''));
			}
			throw new Error("Invalid encrypted data");
		});

		beforeAll(async () => {
			// Mock encryption utilities with our test mocks
			jest.doMock("#utils/encryption", () => ({
				encryptData: mockEncryptData,
				decryptData: mockDecryptData
			}));

			// Clear the module cache and re-import
			jest.resetModules();
			KYXClass = (await import("#lib/kyx/kyx")).KYX;
			const encryptionModule = await import("#utils/encryption");
			encryptData = encryptionModule.encryptData;
			decryptData = encryptionModule.decryptData;
		});

		describe("transformObjectValues", () => {
			it("should transform primitive values in a simple object", () => {
				const obj = { name: "John", age: 30, active: true };
				const transformFn = (value: any) => `transformed_${value}`;
				
				// Access private method via type casting
				const result = (KYXClass as any).transformObjectValues(obj, transformFn);
				
				expect(result).toEqual({
					name: "transformed_John",
					age: "transformed_30",
					active: "transformed_true"
				});
			});

			it("should handle nested objects", () => {
				const obj = {
					person: {
						firstName: "John",
						lastName: "Doe",
						age: 30
					},
					status: "active"
				};
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(obj, transformFn);
				
				expect(result).toEqual({
					person: {
						firstName: "transformed_John",
						lastName: "transformed_Doe",
						age: "transformed_30"
					},
					status: "transformed_active"
				});
			});

			it("should handle arrays", () => {
				const obj = {
					items: ["item1", "item2", "item3"],
					count: 3
				};
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(obj, transformFn);
				
				expect(result).toEqual({
					items: ["transformed_item1", "transformed_item2", "transformed_item3"],
					count: "transformed_3"
				});
			});

			it("should handle arrays of objects", () => {
				const obj = {
					addresses: [
						{ city: "New York", zip: "10001" },
						{ city: "Los Angeles", zip: "90001" }
					]
				};
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(obj, transformFn);
				
				expect(result).toEqual({
					addresses: [
						{ city: "transformed_New York", zip: "transformed_10001" },
						{ city: "transformed_Los Angeles", zip: "transformed_90001" }
					]
				});
			});

			it("should handle null values", () => {
				const obj = { name: "John", value: null };
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(obj, transformFn);
				
				expect(result).toEqual({
					name: "transformed_John",
					value: null
				});
			});

			it("should handle undefined values", () => {
				const obj = { name: "John", value: undefined };
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(obj, transformFn);
				
				expect(result).toEqual({
					name: "transformed_John",
					value: undefined
				});
			});

			it("should return null if input is null", () => {
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(null, transformFn);
				
				expect(result).toBeNull();
			});

			it("should return undefined if input is undefined", () => {
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(undefined, transformFn);
				
				expect(result).toBeUndefined();
			});

			it("should handle empty objects", () => {
				const obj = {};
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(obj, transformFn);
				
				expect(result).toEqual({});
			});

			it("should handle empty arrays", () => {
				const obj: any[] = [];
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(obj, transformFn);
				
				expect(result).toEqual([]);
			});

			it("should handle deeply nested structures", () => {
				const obj = {
					level1: {
						level2: {
							level3: {
								value: "deep"
							}
						}
					}
				};
				const transformFn = (value: any) => `transformed_${value}`;
				
				const result = (KYXClass as any).transformObjectValues(obj, transformFn);
				
				expect(result).toEqual({
					level1: {
						level2: {
							level3: {
								value: "transformed_deep"
							}
						}
					}
				});
			});
		});

		describe("encryptDetailsValues", () => {
			let kyxInstance: any;
			let mockDbConnection: any;

			beforeEach(() => {
				mockDbConnection = {
					id: "test-connection-id",
					business_id: businessId,
					platform_id: "KYX",
					created_at: new Date(),
					updated_at: new Date(),
					configuration: null,
					connection_status: "SUCCESS"
				} as any;

				// Create a mock strategy
				const mockStrategy = {
					getAccessToken: jest.fn(),
					verifyIdentity: jest.fn(),
					getMode: jest.fn(() => "MOCK"),
					isAvailable: jest.fn(() => true)
				};

				// Mock the strategy factory
				jest.doMock("#lib/kyx/strategies", () => ({
					KyxStrategyFactory: {
						createStrategy: jest.fn(() => mockStrategy)
					}
				}));

				// Reset modules to get the mocked strategy
				jest.resetModules();
				const { KYX } = require("#lib/kyx/kyx");
				kyxInstance = new KYX(mockDbConnection, { phoneNumber: "+15555555555" });
			});

			it("should encrypt values in prefillExpress.details", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						details: {
							person: {
								firstName: "John",
								lastName: "Doe",
								ssn: "123-45-6789"
							},
							phone: {
								phoneNumber: "+15555555555",
								activityScore: 800
							}
						}
					}
				};

				const result = kyxInstance.encryptDetailsValues(response);

				// Verify structure is preserved
				expect(result.txId).toBe(response.txId);
				expect(result.timestamp).toBe(response.timestamp);
				expect(result.prefillExpress.status).toBe(response.prefillExpress.status);
				
				// Verify details values are encrypted (they should be strings starting with encrypted_)
				expect(typeof result.prefillExpress.details.person.firstName).toBe("string");
				expect(typeof result.prefillExpress.details.person.lastName).toBe("string");
				expect(typeof result.prefillExpress.details.person.ssn).toBe("string");
				expect(typeof result.prefillExpress.details.phone.phoneNumber).toBe("string");
				expect(typeof result.prefillExpress.details.phone.activityScore).toBe("string");
			});

			it("should preserve structure outside of prefillExpress.details", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						reasonCodes: ["MC1006"],
						details: {
							person: {
								firstName: "John"
							}
						}
					}
				};

				const result = kyxInstance.encryptDetailsValues(response);

				expect(result.prefillExpress.status).toBe("pass");
				expect(result.prefillExpress.reasonCodes).toEqual(["MC1006"]);
			});

			it("should handle response without prefillExpress.details", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass"
					}
				};

				const result = kyxInstance.encryptDetailsValues(response);

				expect(result).toEqual(response);
			});

			it("should handle response without prefillExpress", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z"
				};

				const result = kyxInstance.encryptDetailsValues(response);

				expect(result).toEqual(response);
			});

			it("should encrypt nested arrays in details", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						details: {
							addresses: [
								{ city: "New York", state: "NY" },
								{ city: "Los Angeles", state: "CA" }
							]
						}
					}
				};

				const result = kyxInstance.encryptDetailsValues(response);

				expect(Array.isArray(result.prefillExpress.details.addresses)).toBe(true);
				expect(result.prefillExpress.details.addresses.length).toBe(2);
				expect(typeof result.prefillExpress.details.addresses[0].city).toBe("string");
				expect(typeof result.prefillExpress.details.addresses[0].state).toBe("string");
			});

			it("should not mutate the original response", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						details: {
							person: {
								firstName: "John"
							}
						}
					}
				};

				const originalFirstName = response.prefillExpress.details.person.firstName;
				kyxInstance.encryptDetailsValues(response);

				expect(response.prefillExpress.details.person.firstName).toBe(originalFirstName);
			});
		});

		describe("decryptDetailsValues", () => {
			it("should decrypt values in prefillExpress.details", () => {
				const encryptedResponse = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						details: {
							person: {
								firstName: encryptData("John"),
								lastName: encryptData("Doe"),
								ssn: encryptData("123-45-6789")
							},
							phone: {
								phoneNumber: encryptData("+15555555555"),
								activityScore: encryptData(800)
							}
						}
					}
				};

				const result = (KYXClass as any).decryptDetailsValues(encryptedResponse);

				// Verify structure is preserved
				expect(result.txId).toBe(encryptedResponse.txId);
				expect(result.timestamp).toBe(encryptedResponse.timestamp);
				expect(result.prefillExpress.status).toBe(encryptedResponse.prefillExpress.status);
				
				// Verify details values are decrypted
				expect(result.prefillExpress.details.person.firstName).toBe("John");
				expect(result.prefillExpress.details.person.lastName).toBe("Doe");
				expect(result.prefillExpress.details.person.ssn).toBe("123-45-6789");
				expect(result.prefillExpress.details.phone.phoneNumber).toBe("+15555555555");
				expect(result.prefillExpress.details.phone.activityScore).toBe(800);
			});

			it("should preserve non-encrypted values", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						reasonCodes: ["MC1006"],
						details: {
							person: {
								firstName: "John" // Not encrypted
							}
						}
					}
				};

				const result = (KYXClass as any).decryptDetailsValues(response);

				expect(result.prefillExpress.status).toBe("pass");
				expect(result.prefillExpress.reasonCodes).toEqual(["MC1006"]);
				// If decryption fails, it should keep the original value
				expect(result.prefillExpress.details.person.firstName).toBe("John");
			});

			it("should handle response without prefillExpress.details", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass"
					}
				};

				const result = (KYXClass as any).decryptDetailsValues(response);

				expect(result).toEqual(response);
			});

			it("should handle response without prefillExpress", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z"
				};

				const result = (KYXClass as any).decryptDetailsValues(response);

				expect(result).toEqual(response);
			});

			it("should decrypt nested arrays in details", () => {
				const encryptedResponse = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						details: {
							addresses: [
								{ city: encryptData("New York"), state: encryptData("NY") },
								{ city: encryptData("Los Angeles"), state: encryptData("CA") }
							]
						}
					}
				};

				const result = (KYXClass as any).decryptDetailsValues(encryptedResponse);

				expect(Array.isArray(result.prefillExpress.details.addresses)).toBe(true);
				expect(result.prefillExpress.details.addresses.length).toBe(2);
				expect(result.prefillExpress.details.addresses[0].city).toBe("New York");
				expect(result.prefillExpress.details.addresses[0].state).toBe("NY");
				expect(result.prefillExpress.details.addresses[1].city).toBe("Los Angeles");
				expect(result.prefillExpress.details.addresses[1].state).toBe("CA");
			});

			it("should handle mixed encrypted and non-encrypted values", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						details: {
							person: {
								firstName: encryptData("John"),
								lastName: "Doe", // Not encrypted
								ssn: encryptData("123-45-6789")
							}
						}
					}
				};

				const result = (KYXClass as any).decryptDetailsValues(response);

				expect(result.prefillExpress.details.person.firstName).toBe("John");
				expect(result.prefillExpress.details.person.lastName).toBe("Doe");
				expect(result.prefillExpress.details.person.ssn).toBe("123-45-6789");
			});

			it("should not mutate the original response", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						details: {
							person: {
								firstName: encryptData("John")
							}
						}
					}
				};

				const originalEncryptedValue = response.prefillExpress.details.person.firstName;
				(KYXClass as any).decryptDetailsValues(response);

				expect(response.prefillExpress.details.person.firstName).toBe(originalEncryptedValue);
			});

			it("should handle empty details object", () => {
				const response = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						details: {}
					}
				};

				const result = (KYXClass as any).decryptDetailsValues(response);

				expect(result.prefillExpress.details).toEqual({});
			});
		});

		describe("Encryption and Decryption Integration", () => {
			it("should encrypt and then decrypt to get original values", () => {
				const originalResponse = {
					txId: "test-tx-id",
					timestamp: "2025-01-01T00:00:00Z",
					prefillExpress: {
						status: "pass",
						details: {
							person: {
								firstName: "John",
								lastName: "Doe",
								ssn: "123-45-6789",
								dob: "1990-01-01"
							},
							phone: {
								phoneNumber: "+15555555555",
								activityScore: 800,
								type: "Mobile"
							},
							addresses: [
								{ city: "New York", state: "NY", zip: "10001" }
							]
						}
					}
				};

				const mockDbConnection = {
					id: "test-connection-id",
					business_id: businessId,
					platform_id: "KYX",
					created_at: new Date(),
					updated_at: new Date(),
					configuration: null,
					connection_status: "SUCCESS"
				} as any;

				const mockStrategy = {
					getAccessToken: jest.fn(),
					verifyIdentity: jest.fn(),
					getMode: jest.fn(() => "MOCK"),
					isAvailable: jest.fn(() => true)
				};

				jest.doMock("#lib/kyx/strategies", () => ({
					KyxStrategyFactory: {
						createStrategy: jest.fn(() => mockStrategy)
					}
				}));

				jest.resetModules();
				const { KYX } = require("#lib/kyx/kyx");
				const kyxInstance = new KYX(mockDbConnection, { phoneNumber: "+15555555555" });

				// Encrypt
				const encrypted = kyxInstance.encryptDetailsValues(originalResponse);
				
				// Decrypt
				const decrypted = (KYXClass as any).decryptDetailsValues(encrypted);

				// Verify all values match
				expect(decrypted.prefillExpress.details.person.firstName).toBe(originalResponse.prefillExpress.details.person.firstName);
				expect(decrypted.prefillExpress.details.person.lastName).toBe(originalResponse.prefillExpress.details.person.lastName);
				expect(decrypted.prefillExpress.details.person.ssn).toBe(originalResponse.prefillExpress.details.person.ssn);
				expect(decrypted.prefillExpress.details.person.dob).toBe(originalResponse.prefillExpress.details.person.dob);
				expect(decrypted.prefillExpress.details.phone.phoneNumber).toBe(originalResponse.prefillExpress.details.phone.phoneNumber);
				expect(decrypted.prefillExpress.details.phone.activityScore).toBe(originalResponse.prefillExpress.details.phone.activityScore);
				expect(decrypted.prefillExpress.details.phone.type).toBe(originalResponse.prefillExpress.details.phone.type);
				expect(decrypted.prefillExpress.details.addresses[0].city).toBe(originalResponse.prefillExpress.details.addresses[0].city);
				expect(decrypted.prefillExpress.details.addresses[0].state).toBe(originalResponse.prefillExpress.details.addresses[0].state);
				expect(decrypted.prefillExpress.details.addresses[0].zip).toBe(originalResponse.prefillExpress.details.addresses[0].zip);
			});
		});
	});
});

