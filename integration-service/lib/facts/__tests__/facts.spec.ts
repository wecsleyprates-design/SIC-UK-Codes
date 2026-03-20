/* */

import { INTEGRATION_ID } from "#constants";
import { producer } from "#helpers/kafka";
import type { UUID } from "crypto";
import { DEFAULT_FACT_WEIGHT, FactEngine } from "../factEngine";
import { factWithHighestConfidence, WEIGHT_THRESHOLD, weightedFactSelector } from "../rules";
import type { Fact, FactName, FactSource } from "../types";
import currencyjs from "currency.js";
require("kafkajs");
jest.mock("kafkajs");
jest.mock("#helpers/index", () => {
	const originalModule = jest.requireActual("#helpers/index");
	return {
		...originalModule,
		producer: {
			send: jest.fn()
		},
		sqlQuery: jest.fn(),
		sqlTransaction: jest.fn(),
		getFlagValue: jest.fn(),
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn()
		}
	};
});
jest.mock("#configs/env.config", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id",
		KAFKA_GROUP_ID: "mocked_group_id",
		PLAID_IDV_TEMPLATE_ID: "1"
		//   ... other mocked configuration properties
	}
}));
jest.mock("#helpers/knex", () => {
	const createMockQuery = (result: any) => {
		const query: any = {};

		// Add query builder methods - each returns the query object for chaining
		query.select = jest.fn(() => query);
		query.where = jest.fn(() => query);
		query.andWhere = jest.fn(() => query);
		query.whereIn = jest.fn(() => query);
		query.join = jest.fn(() => query);
		query.orderBy = jest.fn(() => query);
		query.limit = jest.fn(() => query);
		query.first = jest.fn(() => query); // Return query object so andWhere can be called after first()

		// Make the query object thenable (awaitable)
		query.then = jest.fn((resolve: any) => Promise.resolve(result).then(resolve));
		query.catch = jest.fn((reject: any) => Promise.resolve(result).catch(reject));

		return query;
	};

	let mockQueryResult: any = null;
	const mockDb: any = jest.fn((table: string) => createMockQuery(mockQueryResult));
	mockDb.raw = jest.fn((query: string) => query);

	// Allow setting the result for tests
	mockDb.__setResult = (result: any) => {
		mockQueryResult = result;
	};

	return {
		db: mockDb
	};
});
jest.mock("#helpers/api", () => ({
	confidenceScore: jest.fn(),
	confidenceScoreMany: jest.fn(),
	getBusinessCustomers: jest.fn(),
	TIN_BEHAVIOR: {}
}));
// Note: We'll spy on NormalizedBusiness methods in individual tests rather than mocking the entire module
// This allows the fromTrulioo tests to use the actual implementation
const mockZoomInfoResposne = {
	company: {
		name: "ZoomInfoCompanyName" as FactName,
		website: "www.zoominfo.com"
	}
};
const mockOpenCorporatesResponse = {
	data: {
		result: {
			company: {
				name: "OCCompanyName" as FactName,
				website: "www.occompany.com"
			}
		}
	}
};

const mockBusinessDetailsResponse = {
	official_website: "www.businessdetails.com",
	name: "BusinessDetailsCompanyName" as FactName
};

const mockBusinessDetailsSource: FactSource = {
	name: "businessDetails" as FactName,
	scope: "business",
	platformId: 0,
	category: "kyb",
	getter: async () => Promise.resolve(mockBusinessDetailsResponse),
	confidence: 0.2,
	weight: 10
};

const mockZoomInfoSource: FactSource = {
	name: "zoominfo" as FactName,
	scope: "business",
	platformId: INTEGRATION_ID.ZOOMINFO,
	category: "kyb",
	getter: async () => Promise.resolve(mockZoomInfoResposne),
	confidence: 0.2,
	weight: 1
};
const mockOpenCorporatesSource: FactSource = {
	name: "open-corporates" as FactName,
	scope: "business",
	platformId: INTEGRATION_ID.OPENCORPORATES,
	category: "kyb",
	getter: async () => Promise.resolve(mockOpenCorporatesResponse),
	confidence: 0.1
};
const undefinedSource: FactSource = {
	name: "undefinedSource" as FactName,
	scope: "business",
	category: "kyb",
	getter: async () => Promise.resolve(undefined),
	confidence: 0.1,
	platformId: -1
};
describe("Facts Engine", () => {
	const businessID = "00000000-0000-0000-0000-000000000001";

	it("should resolve the highest weighted fact", async () => {
		const mockFacts: Fact[] = [
			{
				name: "company_name" as FactName,
				source: mockZoomInfoSource,
				path: "company.name"
			},
			{
				name: "company_name" as FactName,
				source: mockBusinessDetailsSource,
				path: "name"
			}
		];
		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();
		expect(output).toEqual({
			company_name: {
				name: "company_name" as FactName,
				value: "BusinessDetailsCompanyName",
				alternatives: [{ confidence: 0.2, source: 24, value: "ZoomInfoCompanyName", updatedAt: undefined }],
				override: null,
				schema: null,
				source: {
					confidence: 0.2,
					platformId: 0,
					updatedAt: undefined
				}
			}
		});
	});

	it("should map source to facts", async () => {
		const mockFacts: Fact[] = [
			{
				name: "company_name" as FactName,
				source: mockZoomInfoSource,
				path: "company.name"
			},
			{
				name: "company_name" as FactName,
				source: mockOpenCorporatesSource,
				path: "data.result.company.name"
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();
		expect(output).toEqual({
			company_name: {
				name: "company_name" as FactName,
				value: "ZoomInfoCompanyName",
				alternatives: [{ confidence: 0.1, source: 23, value: "OCCompanyName", updatedAt: undefined }],
				override: null,
				schema: null,
				source: {
					confidence: 0.2,
					platformId: 24,
					updatedAt: undefined
				}
			}
		});
	});

	it("should retain consistant response shape", async () => {
		const mockFacts: Fact[] = [
			{
				name: "company_name" as FactName,
				source: mockZoomInfoSource,
				path: "company.name"
			},
			{
				name: "company_name" as FactName,
				source: mockOpenCorporatesSource,
				path: "data.result.company.name"
			},
			{
				name: "foo" as FactName,
				source: null,
				path: ""
			}
		];
		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();
		expect(output).toEqual({
			company_name: {
				name: "company_name" as FactName,
				value: "ZoomInfoCompanyName",
				alternatives: [{ confidence: 0.1, source: 23, value: "OCCompanyName" }],
				override: null,
				schema: null,
				source: {
					confidence: 0.2,
					platformId: 24,
					updatedAt: undefined
				}
			},
			foo: {
				alternatives: [],
				name: "foo" as FactName,
				value: null,
				override: null,
				schema: null,
				source: null
			}
		});
	});

	it("should choose the best source for a fact", async () => {
		const mockFacts: Fact[] = [
			{
				name: "company_name" as FactName,
				source: mockZoomInfoSource,
				path: "company.name"
			},
			{
				name: "company_name" as FactName,
				source: mockOpenCorporatesSource,
				path: "data.result.company.name"
			},
			{
				name: "some_other_name" as FactName,
				source: mockOpenCorporatesSource,
				path: "data.result.company.name"
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();
		expect(output).toEqual({
			company_name: {
				name: "company_name" as FactName,
				value: "ZoomInfoCompanyName",
				dependencies: undefined,
				isDefault: undefined,
				alternatives: [{ confidence: 0.1, source: 23, value: "OCCompanyName", updatedAt: undefined }],
				override: null,
				schema: null,
				source: {
					confidence: 0.2,
					platformId: 24,
					updatedAt: undefined
				}
			},
			some_other_name: {
				name: "some_other_name" as FactName,
				value: "OCCompanyName",
				dependencies: undefined,
				isDefault: undefined,
				override: null,
				schema: null,
				source: {
					confidence: 0.1,
					platformId: 23,
					updatedAt: undefined
				},
				alternatives: []
			}
		});
	});

	it("handles default fact values", async () => {
		const mockFacts: Fact[] = [
			{
				name: "company_name" as FactName,
				source: mockZoomInfoSource,
				path: "company.name",
				default: "DefaultCompanyName"
			},
			{
				name: "default_fact" as FactName,
				source: undefinedSource,
				path: "foobar",
				default: "ThisIsTheDefault"
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();
		expect(output).toEqual({
			company_name: {
				name: "company_name" as FactName,
				value: "ZoomInfoCompanyName",
				alternatives: [],
				override: null,
				schema: null,
				source: {
					confidence: 0.2,
					platformId: 24,
					updatedAt: undefined
				}
			},
			default_fact: {
				name: "default_fact" as FactName,
				value: "ThisIsTheDefault",
				isDefault: true,
				alternatives: [],
				override: null,
				schema: null,
				source: null
			}
		});
	});

	it("handles dependencies correctly", async () => {
		const mockFacts: Fact[] = [
			{
				name: "company_name" as FactName,
				source: mockZoomInfoSource,
				fn: () => Promise.resolve(2)
			},
			{
				name: "foo" as FactName,
				source: null,
				fn: async (engine: FactEngine) => {
					const dependentFact = engine.getResolvedFact("company_name" as FactName);
					const currentValue = dependentFact?.value;
					return currentValue * 2;
				},
				dependencies: ["company_name" as FactName]
			},
			{
				name: "bar" as FactName,
				source: mockZoomInfoSource,
				fn: async (engine: FactEngine) => {
					const dependentFact = engine.getResolvedFact("foo" as FactName);
					const currentValue = dependentFact?.value;
					return currentValue * 3;
				},
				dependencies: ["foo" as FactName]
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();
		expect(output).toEqual({
			company_name: {
				name: "company_name" as FactName,
				value: 2,
				alternatives: [],
				override: null,
				schema: null,
				source: {
					confidence: 0.2,
					platformId: 24,
					updatedAt: undefined
				}
			},
			foo: {
				name: "foo" as FactName,
				value: 4,
				dependencies: ["company_name"],
				alternatives: [],
				override: null,
				schema: null,
				source: null
			},
			bar: {
				name: "bar" as FactName,
				value: 12,
				dependencies: ["foo"],
				alternatives: [],
				override: null,
				schema: null,
				source: null
			}
		});
	});

	it("should do some normalization when defined", async () => {
		const normalizeSource: FactSource<any> = {
			name: "normalize"
		} as FactSource;
		const mockFacts: Fact[] = [
			{
				name: "company_name" as FactName,
				source: mockZoomInfoSource,
				fn: () => Promise.resolve("this is a test")
			},
			{
				name: "company_name" as FactName,
				source: normalizeSource,
				fn: async (engine: FactEngine, input: any) => {
					return typeof input === "string" ? input.toUpperCase() : input;
				}
			}
		];
		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();
		expect(output).toEqual({
			company_name: {
				name: "company_name" as FactName,
				value: "THIS IS A TEST",
				alternatives: [],
				isNormalized: true,
				override: null,
				schema: null,
				source: {
					confidence: 0.2,
					platformId: 24,
					updatedAt: undefined
				}
			}
		});
	});

	describe("BEST-107: Fact Overrides", () => {
		const getManualSource = (overrides?: Record<string, Fact["override"]>) => {
			return {
				name: "manual" as FactName,
				scope: "business",
				category: "kyb",
				getter: async () => Promise.resolve(overrides),
				confidence: 0.1,
				platformId: INTEGRATION_ID.MANUAL
			} as FactSource<Record<string, Fact["override"]>>;
		};
		it("should allow an override to be set on a fact manually", async () => {
			const mockFacts: Fact[] = [
				{
					name: "company_name" as FactName,
					source: mockZoomInfoSource,
					fn: () => Promise.resolve("this is a test")
				},
				{
					name: "company_name" as FactName,
					source: undefinedSource,
					fn: async (engine: FactEngine, input: any) => {
						return typeof input === "string" ? input.toUpperCase() : input;
					}
				}
			];

			const override: Record<string, Fact["override"]> = {
				company_name: {
					value: "Manual Company Name",
					comment: "yes",
					userID: "00000000-2222-0000-0000-000000000000" as UUID,
					timestamp: new Date(),
					source: "manual"
				}
			};

			const manualSource = getManualSource(override);
			const factEngine = new FactEngine(mockFacts, { business: businessID }, manualSource);
			await factEngine.applyRules(factWithHighestConfidence);
			const output = await factEngine.getResults();
			expect(output).toEqual({
				company_name: {
					name: "company_name" as FactName,
					value: override?.company_name?.value,
					alternatives: [
						{
							confidence: 0.2,
							source: 24,
							value: "this is a test",
							updatedAt: undefined
						}
					],
					override: override?.company_name,
					schema: null,
					source: {
						confidence: 0.1,
						platformId: 21,
						updatedAt: undefined
					}
				}
			});
		});
	});

	describe("Trulioo Integration", () => {
		const businessID = "00000000-0000-0000-0000-000000000001";

		describe("NormalizedBusiness.fromTrulioo", () => {
			const { NormalizedBusiness } = require("#lib/business/normalizedBusiness");

			it("should create NormalizedBusiness from Trulioo business data with address object", () => {
				const businessData = {
					name: "Test Company Ltd" as FactName,
					address: {
						addressLine1: "123 Main St",
						city: "London",
						state: "England",
						postalCode: "SW1A 1AA",
						country: "GB"
					}
				};

				const result = NormalizedBusiness.fromTrulioo(businessID, businessData);

				expect(result).toBeDefined();
				expect(result?.business_id).toBe(businessID);
				expect(result?.name).toBe("Test Company Ltd");
				expect(result?.address).toBe("123 Main St");
				expect(result?.city).toBe("London");
				expect(result?.state).toBe("England");
				expect(result?.zip).toBe("SW1A 1AA");
				expect(result?.country).toBe("GB");
				expect(result?.source).toBe("trulioo");
			});

			it("should create NormalizedBusiness from Trulioo business data with business_addresses array", () => {
				const businessData = {
					name: "Test Company Inc" as FactName,
					business_addresses: [
						{
							addressLine1: "456 Oak Ave",
							city: "Toronto",
							state: "Ontario",
							postalCode: "M5H 2N2",
							country: "CA"
						}
					]
				};

				const result = NormalizedBusiness.fromTrulioo(businessID, businessData);

				expect(result).toBeDefined();
				expect(result?.name).toBe("Test Company Inc");
				expect(result?.address).toBe("456 Oak Ave");
				expect(result?.city).toBe("Toronto");
				expect(result?.state).toBe("Ontario");
				expect(result?.zip).toBe("M5H 2N2");
				expect(result?.country).toBe("CA");
			});

			it("should use fallback values from businessData root when address fields are missing", () => {
				const businessData = {
					name: "Fallback Company" as FactName,
					address: {
						addressLine1: "789 Pine Rd"
					},
					city: "Vancouver",
					state: "British Columbia",
					postalCode: "V6B 1A1",
					country: "CA"
				};

				const result = NormalizedBusiness.fromTrulioo(businessID, businessData);

				expect(result).toBeDefined();
				expect(result?.city).toBe("Vancouver");
				expect(result?.state).toBe("British Columbia");
				expect(result?.zip).toBe("V6B 1A1");
				expect(result?.country).toBe("CA");
			});

			it("should return undefined when businessData is missing", () => {
				const result = NormalizedBusiness.fromTrulioo(businessID, undefined as any);
				expect(result).toBeUndefined();
			});

			it("should return undefined when name is missing", () => {
				const businessData = {
					address: {
						addressLine1: "123 Main St",
						city: "London",
						state: "England",
						postalCode: "SW1A 1AA"
					}
				};

				const result = NormalizedBusiness.fromTrulioo(businessID, businessData);
				expect(result).toBeUndefined();
			});

			it("should return undefined when address is missing", () => {
				const businessData = {
					name: "Test Company"
				};

				const result = NormalizedBusiness.fromTrulioo(businessID, businessData);
				expect(result).toBeUndefined();
			});

			it("should return undefined when required address fields are missing", () => {
				const businessData = {
					name: "Test Company" as FactName,
					address: {
						addressLine1: "123 Main St"
						// Missing city, state, postalCode
					}
				};

				const result = NormalizedBusiness.fromTrulioo(businessID, businessData);
				expect(result).toBeUndefined();
			});

			it("should return undefined when country is missing", () => {
				const businessData = {
					name: "Test Company" as FactName,
					address: {
						addressLine1: "100 Test St",
						city: "London",
						state: "England",
						postalCode: "SW1A 1AA"
						// Missing country
					}
				};

				const result = NormalizedBusiness.fromTrulioo(businessID, businessData);

				expect(result).toBeUndefined();
			});
		});

		describe("Trulioo Source Confidence Scoring", () => {
			const db = require("#helpers/knex").db;
			const { sources } = require("../sources");
			const { confidenceScore } = require("#helpers/api");
			const { NormalizedBusiness } = require("#lib/business/normalizedBusiness");
			const { logger } = require("#helpers/logger");

			beforeEach(() => {
				jest.clearAllMocks();
				db.__setResult(null); // Reset query result
				// Reset source confidence to ensure clean state
				sources.business.confidence = undefined;
			});

			afterEach(() => {
				// Restore all spies to their original implementations
				jest.restoreAllMocks();
			});

			it("should use warehouse service confidence when both customer and Trulioo businesses are available", async () => {
				const mockTruliooResponse = {
					clientData: {
						status: "completed",
						businessData: {
							name: "Trulioo Company" as FactName,
							address: {
								addressLine1: "123 Trulioo St",
								city: "London",
								state: "England",
								postalCode: "SW1A 1AA",
								country: "GB"
							}
						}
					}
				};

				const mockCustomerBusiness = new NormalizedBusiness(
					businessID,
					"Customer Company",
					"123 Customer St",
					"London",
					"England",
					"GB",
					"SW1A 1AA",
					"customer"
				);

				const mockTruliooBusiness = new NormalizedBusiness(
					businessID,
					"Trulioo Company",
					"123 Trulioo St",
					"London",
					"England",
					"GB",
					"SW1A 1AA",
					"trulioo"
				);

				// Mock database query to return Trulioo response
				const mockQueryResult = {
					response: mockTruliooResponse,
					requested_at: new Date(),
					request_received: new Date()
				};
				db.__setResult(mockQueryResult);

				// Mock NormalizedBusiness methods
				jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(mockCustomerBusiness);
				jest.spyOn(NormalizedBusiness, "fromTrulioo").mockReturnValue(mockTruliooBusiness);

				// Mock confidenceScore
				confidenceScore.mockResolvedValue({
					prediction: 0.85
				});

				const source = sources.business;
				const result = await source.getter(businessID);

				expect(result).toBeDefined();
				expect(source.confidence).toBe(0.85);
				expect(confidenceScore).toHaveBeenCalledWith({
					business: mockCustomerBusiness,
					integration_business: mockTruliooBusiness
				});
			});

			it("should fallback to calculated confidence when warehouse service fails", async () => {
				const mockTruliooResponse = {
					clientData: {
						status: "completed",
						businessData: {
							name: "Trulioo Company" as FactName,
							address: {
								addressLine1: "123 Trulioo St",
								city: "London",
								state: "England",
								postalCode: "SW1A 1AA",
								country: "GB"
							}
						}
					}
				};

				const mockCustomerBusiness = new NormalizedBusiness(
					businessID,
					"Customer Company",
					"123 Customer St",
					"London",
					"England",
					"GB",
					"SW1A 1AA",
					"customer"
				);

				const mockTruliooBusiness = new NormalizedBusiness(
					businessID,
					"Trulioo Company",
					"123 Trulioo St",
					"London",
					"England",
					"GB",
					"SW1A 1AA",
					"trulioo"
				);

				// Mock database query
				const mockQueryResult = {
					response: mockTruliooResponse,
					requested_at: new Date(),
					request_received: new Date()
				};
				db.__setResult(mockQueryResult);

				// Mock NormalizedBusiness methods
				jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(mockCustomerBusiness);
				jest.spyOn(NormalizedBusiness, "fromTrulioo").mockReturnValue(mockTruliooBusiness);

				// Mock confidenceScore to throw error
				confidenceScore.mockRejectedValue(new Error("Service unavailable"));

				const source = sources.business;
				const result = await source.getter(businessID);

				expect(result).toBeDefined();
				// Should use calculated confidence (0.7 base + 0.1 name + 0.1 address = 0.9, capped at 0.95)
				expect(source.confidence).toBeGreaterThanOrEqual(0.7);
				expect(source.confidence).toBeLessThanOrEqual(0.95);
				expect(logger.warn).toHaveBeenCalled();
			});

			it("should use calculated confidence when customer business is not available", async () => {
				const mockTruliooResponse = {
					clientData: {
						status: "completed",
						businessData: {
							name: "Trulioo Company" as FactName,
							address: {
								addressLine1: "123 Trulioo St",
								city: "London",
								state: "England",
								postalCode: "SW1A 1AA",
								country: "GB"
							}
						}
					}
				};

				// Mock database query
				const mockQueryResult = {
					response: mockTruliooResponse,
					requested_at: new Date(),
					request_received: new Date()
				};
				db.__setResult(mockQueryResult);

				// Mock NormalizedBusiness.fromCustomerSubmission to return undefined
				jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(undefined);

				const source = sources.business;
				const result = await source.getter(businessID);

				expect(result).toBeDefined();
				// Should use calculated confidence
				expect(source.confidence).toBeGreaterThanOrEqual(0.7);
				expect(source.confidence).toBeLessThanOrEqual(0.95);
				expect(confidenceScore).not.toHaveBeenCalled();
			});

			it("should calculate confidence based on verification status", async () => {
				const testCases = [
					{ status: "completed", expectedMin: 0.7, expectedMax: 0.95 }, // 0.7 base + 0.2 (name+address) = 0.9
					{ status: "success", expectedMin: 0.7, expectedMax: 0.95 },
					{ status: "pending", expectedMin: 0.4, expectedMax: 0.6 }, // 0.4 base + 0.2 (name+address) = 0.6
					{ status: "in_progress", expectedMin: 0.4, expectedMax: 0.6 },
					{ status: "failed", expectedMin: 0.2, expectedMax: 0.4 }, // 0.2 base + 0.2 (name+address) = 0.4
					{ status: "error", expectedMin: 0.2, expectedMax: 0.4 }, // 0.2 base + 0.2 (name+address) = 0.4
					{ status: "REJECTED", expectedMin: 0.2, expectedMax: 0.4 }, // 0.2 base + 0.2 (name+address) = 0.4
					{ status: "unknown", expectedMin: 0.3, expectedMax: 0.6 } // 0.3 base + 0.2 (name+address) = 0.5
				];

				for (const testCase of testCases) {
					const mockTruliooResponse = {
						clientData: {
							status: testCase.status,
							businessData: {
								name: "Test Company" as FactName,
								address: {
									addressLine1: "123 Test St",
									city: "Test City",
									state: "Test State",
									postalCode: "12345",
									country: "US"
								}
							}
						}
					};

					const mockQueryResult = {
						response: mockTruliooResponse,
						requested_at: new Date(),
						request_received: new Date()
					};
					db.__setResult(mockQueryResult);

					// Ensure fromCustomerSubmission returns undefined to avoid warehouse service call
					jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(undefined);
					// Ensure fromTrulioo also returns undefined to avoid warehouse service call
					jest.spyOn(NormalizedBusiness, "fromTrulioo").mockReturnValue(undefined);

					const source = sources.business;
					// Reset confidence before each test case
					source.confidence = undefined;
					await source.getter(businessID);

					expect(source.confidence).toBeGreaterThanOrEqual(testCase.expectedMin);
					if (testCase.expectedMax) {
						expect(source.confidence).toBeLessThanOrEqual(testCase.expectedMax);
					}

					// Restore spies after each iteration
					jest.restoreAllMocks();
				}
			});

			it("should increase confidence based on data completeness", async () => {
				const mockTruliooResponse = {
					clientData: {
						status: "completed",
						businessData: {
							name: "Complete Company" as FactName,
							address: {
								addressLine1: "123 Complete St",
								city: "Complete City",
								state: "Complete State",
								postalCode: "12345",
								country: "US"
							},
							ubos: [{ name: "UBO 1" }],
							directors: [{ name: "Director 1" }]
						}
					}
				};

				const mockQueryResult = {
					response: mockTruliooResponse,
					requested_at: new Date(),
					request_received: new Date()
				};
				db.__setResult(mockQueryResult);

				jest.spyOn(NormalizedBusiness, "fromCustomerSubmission").mockResolvedValue(undefined);
				jest.spyOn(NormalizedBusiness, "fromTrulioo").mockReturnValue(undefined);

				const source = sources.business;
				// Reset confidence to ensure clean test
				source.confidence = undefined;
				await source.getter(businessID);

				// Base 0.7 + name 0.1 + address 0.1 + ubos/directors 0.05 = 0.95 (capped)
				expect(source.confidence).toBe(0.95);
			});

			it("should return undefined when Trulioo response is missing", async () => {
				db.__setResult(undefined);

				const source = sources.business;
				const result = await source.getter(businessID);

				expect(result).toBeUndefined();
			});
		});

		describe("Trulioo Person Source", () => {
			const db = require("#helpers/knex").db;
			const { sources } = require("../sources");

			beforeEach(() => {
				jest.clearAllMocks();
				db.__setResult(null); // Reset query result
			});

			afterEach(() => {
				// Restore all spies to their original implementations
				jest.restoreAllMocks();
			});

		it("should calculate confidence based on person screening results", async () => {
			const mockTruliooPersonResponse = {
				screenedPersons: [
					{
						fullName: "John Doe",
						screeningStatus: "completed",
						screeningResults: {
							screeningStatus: "completed",
							watchlistHits: []
						}
					},
					{
						fullName: "Jane Smith",
						screeningStatus: "completed",
						screeningResults: {
							watchlistHits: [{ type: "sanctions" }]
						}
					}
				]
			};
				// Mock returns array of records (new implementation expects array)
				const mockQueryResult = [
					{
						response: JSON.stringify(mockTruliooPersonResponse),
						requested_at: new Date(),
						request_received: new Date()
					}
				];
				db.__setResult(mockQueryResult);

				const source = sources.person;
				const result = await source.getter(businessID);

				expect(result).toBeDefined();
				// Base 0.6 + completion rate bonus + results bonus
				expect(source.confidence).toBeGreaterThanOrEqual(0.6);
				expect(source.confidence).toBeLessThanOrEqual(0.95);
			});

			it("should have lower confidence when no persons are screened", async () => {
				const mockTruliooPersonResponse = {
					screenedPersons: []
				};
				// Mock returns array of records (new implementation expects array)
				const mockQueryResult = [
					{
						response: JSON.stringify(mockTruliooPersonResponse),
						requested_at: new Date(),
						request_received: new Date()
					}
				];
				db.__setResult(mockQueryResult);
				const source = sources.person;
				const result = await source.getter(businessID);

				// Should return undefined when no persons are screened
				expect(result).toBeUndefined();
			});

			it("should aggregate multiple PSC records (one per owner) into a single response", async () => {
				// Simulate multiple owners, each with their own request_response record
				const owner1Response = {
					screenedPersons: [
						{
							fullName: "John Doe",
							screeningStatus: "completed",
							screeningResults: {
								watchlistHits: [{ type: "PEP" }]
							}
						}
					]
				};

				const owner2Response = {
					screenedPersons: [
						{
							fullName: "Jane Smith",
							screeningStatus: "completed",
							screeningResults: {
								watchlistHits: [{ type: "SANCTIONS" }]
							}
						}
					]
				};

				// Mock getAllFromRequestResponse to return multiple records
				const mockRecords = [
					{
						response: JSON.stringify(owner1Response),
						requested_at: new Date("2024-01-01"),
						request_received: new Date("2024-01-01")
					},
					{
						response: JSON.stringify(owner2Response),
						requested_at: new Date("2024-01-02"),
						request_received: new Date("2024-01-02")
					}
				];

				// Mock the database query to return all records
				db.__setResult(mockRecords);

				const source = sources.person;
				const result = await source.getter(businessID);

				expect(result).toBeDefined();
				expect(result?.screenedPersons).toBeDefined();
				expect(Array.isArray(result?.screenedPersons)).toBe(true);
				expect(result?.screenedPersons.length).toBe(2);
				expect(result?.screenedPersons[0].fullName).toBe("John Doe");
				expect(result?.screenedPersons[1].fullName).toBe("Jane Smith");
			});

			it("should handle single PSC record correctly", async () => {
				const mockTruliooPersonResponse = {
					screenedPersons: [
						{
							fullName: "Single Owner",
							screeningStatus: "completed",
							screeningResults: {
								watchlistHits: []
							}
						}
					]
				};

				const mockRecord = {
					response: JSON.stringify(mockTruliooPersonResponse),
					requested_at: new Date(),
					request_received: new Date()
				};

				db.__setResult([mockRecord]); // Return as array (even if single)

				const source = sources.person;
				const result = await source.getter(businessID);

				expect(result).toBeDefined();
				expect(result?.screenedPersons).toBeDefined();
				expect(result?.screenedPersons.length).toBe(1);
				expect(result?.screenedPersons[0].fullName).toBe("Single Owner");
			});

			it("should return undefined when no PSC records exist", async () => {
				db.__setResult([]); // Empty array

				const source = sources.person;
				const result = await source.getter(businessID);

				expect(result).toBeUndefined();
			});

			it("should use the most recent updatedAt from all records", async () => {
				const owner1Response = {
					screenedPersons: [{ fullName: "Owner 1", screeningStatus: "completed" }]
				};

				const owner2Response = {
					screenedPersons: [{ fullName: "Owner 2", screeningStatus: "completed" }]
				};

				const olderDate = new Date("2024-01-01");
				const newerDate = new Date("2024-01-02");

				const mockRecords = [
					{
						response: JSON.stringify(owner1Response),
						requested_at: olderDate,
						request_received: olderDate
					},
					{
						response: JSON.stringify(owner2Response),
						requested_at: newerDate,
						request_received: newerDate
					}
				];

				db.__setResult(mockRecords);
				const source = sources.person;
				await source.getter(businessID);

				expect(source.updatedAt).toBeDefined();
				expect(source.updatedAt?.getTime()).toBe(newerDate.getTime());
			});

			it("should handle records with invalid JSON gracefully", async () => {
				const validResponse = {
					screenedPersons: [
						{
							fullName: "Valid Owner",
							screeningStatus: "completed"
						}
					]
				};

				const mockRecords = [
					{
						response: JSON.stringify(validResponse),
						requested_at: new Date(),
						request_received: new Date()
					},
					{
						response: "invalid json {",
						requested_at: new Date(),
						request_received: new Date()
					}
				];

				db.__setResult(mockRecords);

				const source = sources.person;
				const result = await source.getter(businessID);

				// Should still return valid data, ignoring invalid records
				expect(result).toBeDefined();
				expect(result?.screenedPersons.length).toBe(1);
				expect(result?.screenedPersons[0].fullName).toBe("Valid Owner");
			});
		});
	});
});

describe("weightedFactSelector", () => {
	it("returns the fact with higher weight", () => {
		const factA: Fact<number> = {
			name: "factA" as FactName,
			path: "a.path",
			source: { weight: 5, confidence: 0.8, rawResponse: {} } as any,
			weight: 5,
			value: 10
		};

		const factB: Fact<number> = {
			name: "factB" as FactName,
			path: "b.path",
			source: { weight: 2, confidence: 0.8, rawResponse: {} } as any,
			weight: 2,
			value: 20
		};

		const result = weightedFactSelector(factA, factB);
		expect(result).toBe(factA);
	});

	it("returns the other fact if it has higher weight", () => {
		const factA: Fact<number> = {
			name: "factA" as FactName,
			path: "a.path",
			source: { weight: 3, confidence: 0.5, rawResponse: {} } as any,
			weight: 3,
			value: 100
		};

		const factB: Fact<number> = {
			name: "factB" as FactName,
			path: "b.path",
			source: { weight: 10, confidence: 0.9, rawResponse: {} } as any,
			weight: 10,
			value: 200
		};

		const result = weightedFactSelector(factA, factB);
		expect(result).toBe(factB);
	});

	it("uses source weight when local weight equals the default", () => {
		const factA: Fact<number> = {
			name: "factA" as FactName,
			path: "a.path",
			source: { weight: 8, confidence: 0.7, rawResponse: {} } as any,
			weight: DEFAULT_FACT_WEIGHT,
			value: 50
		};

		const factB: Fact<number> = {
			name: "factB" as FactName,
			path: "b.path",
			source: { weight: 2, confidence: 0.9, rawResponse: {} } as any,
			weight: DEFAULT_FACT_WEIGHT,
			value: 60
		};

		const result = weightedFactSelector(factA, factB);
		expect(result).toBe(factA);
	});

	it("returns the first fact on a tie", () => {
		const factA: Fact<number> = {
			name: "factA" as FactName,
			path: "a.path",
			source: { weight: 5, confidence: 0.5, rawResponse: {} } as any,
			weight: 5,
			value: 111
		};

		const factB: Fact<number> = {
			name: "factB" as FactName,
			path: "b.path",
			source: { weight: 5, confidence: 0.5, rawResponse: {} } as any,
			weight: 5,
			value: 222
		};

		const result = weightedFactSelector(factA, factB);
		expect(result).toBe(factA);
	});

	it("handles undefined weights safely", () => {
		const factA: Fact<number> = {
			name: "factA" as FactName,
			path: "a.path",
			source: { weight: 1, confidence: 0.5, rawResponse: {} } as any,
			weight: undefined,
			value: 1
		};

		const factB: Fact<number> = {
			name: "factB" as FactName,
			path: "b.path",
			source: { weight: 3, confidence: 0.8, rawResponse: {} } as any,
			weight: 3,
			value: 2
		};

		const result = weightedFactSelector(factA, factB);
		expect(result).toBe(factB);
	});

	it("works with a fact using fn instead of path", async () => {
		const factA: Fact<number> = {
			name: "factA" as FactName,
			fn: async () => 42,
			source: { weight: 2, confidence: 0.5, rawResponse: {} } as any,
			weight: 2,
			value: 42
		};

		const factB: Fact<number> = {
			name: "factB" as FactName,
			path: "b.path",
			source: { weight: 5, confidence: 0.8, rawResponse: {} } as any,
			weight: 5,
			value: 99
		};

		const result = weightedFactSelector(factA, factB);
		expect(result).toBe(factB);
	});
});

describe("factWithHighestConfidence with threshold", () => {
	const businessID = "00000000-0000-0000-0000-000000000001";

	const createMockSource = (name: string, confidence: number, weight: number = 1): FactSource => ({
		name,
		scope: "business",
		platformId: 0,
		category: "kyb",
		getter: async () => Promise.resolve({ value: `${name}_value` }),
		confidence,
		weight
	});

	it("should use weightedFactSelector when confidence values are within the hard coded threshold", async () => {
		const sourceAConfidence = 0.9993281364440918;
		const sourceA = createMockSource("sourceA", sourceAConfidence, 1);
		const sourceB = createMockSource("sourceB", 1, 0.9);

		const mockFacts: Fact[] = [
			{
				name: "test_fact" as FactName,
				source: sourceA,
				fn: () => Promise.resolve("valueA")
			},
			{
				name: "test_fact" as FactName,
				source: sourceB,
				fn: () => Promise.resolve("valueB")
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();

		// Should select sourceA because it has higher weight (10 vs 5) even though confidence is slightly lower
		expect(output["test_fact"].value).toBe("valueA");
		expect(output["test_fact"].source?.confidence).toBe(sourceAConfidence);
	});

	it("should use weightedFactSelector when confidence values are exactly equal", async () => {
		const sourceA = createMockSource("sourceA", 0.85, 3);
		const sourceB = createMockSource("sourceB", 0.85, 8);

		const mockFacts: Fact[] = [
			{
				name: "test_fact" as FactName,
				source: sourceA,
				fn: () => Promise.resolve("valueA")
			},
			{
				name: "test_fact" as FactName,
				source: sourceB,
				fn: () => Promise.resolve("valueB")
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();

		// Should select sourceB because it has higher weight (8 vs 3)
		expect(output["test_fact"].value).toBe("valueB");
		expect(output["test_fact"].source?.confidence).toBe(0.85);
	});

	it("should select fact with higher confidence when difference exceeds threshold", async () => {
		const sourceA = createMockSource("sourceA", 0.7, 10);
		const sourceB = createMockSource("sourceB", 0.85, 5);

		const mockFacts: Fact[] = [
			{
				name: "test_fact" as FactName,
				source: sourceA,
				fn: () => Promise.resolve("valueA")
			},
			{
				name: "test_fact" as FactName,
				source: sourceB,
				fn: () => Promise.resolve("valueB")
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();

		// Should select sourceB because confidence difference (0.15) exceeds threshold (0.01)
		// even though sourceA has higher weight
		expect(output["test_fact"].value).toBe("valueB");
		expect(output["test_fact"].source?.confidence).toBe(0.85);
	});

	it("should use weightedFactSelector at exact threshold boundary", async () => {
		const baseConfidence = 0.8;
		const sourceA = createMockSource("sourceA", baseConfidence, 10);
		const sourceB = createMockSource("sourceB", baseConfidence - WEIGHT_THRESHOLD, 5);

		const mockFacts: Fact[] = [
			{
				name: "test_fact" as FactName,
				source: sourceA,
				fn: () => Promise.resolve("valueA")
			},
			{
				name: "test_fact" as FactName,
				source: sourceB,
				fn: () => Promise.resolve("valueB")
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();

		// Difference is exactly 0.01, should use weighted selector
		// sourceA should win with higher weight (10 vs 5)
		expect(output["test_fact"].value).toBe("valueA");
		expect(output["test_fact"].source?.confidence).toBe(baseConfidence);
	});

	it("should select higher confidence when just greater than threshold", async () => {
		const baseConfidence = 0.8;
		const sourceBConfidence = currencyjs(baseConfidence).add(WEIGHT_THRESHOLD).add(0.01).value;
		const sourceA = createMockSource("sourceA", baseConfidence, 10);
		const sourceB = createMockSource("sourceB", sourceBConfidence, 5);

		const mockFacts: Fact[] = [
			{
				name: "test_fact" as FactName,
				source: sourceA,
				fn: () => Promise.resolve("valueA")
			},
			{
				name: "test_fact" as FactName,
				source: sourceB,
				fn: () => Promise.resolve("valueB")
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();

		// Difference is just outside threshold, should select higher confidence
		expect(output["test_fact"].source?.confidence).toBe(sourceBConfidence);
		expect(output["test_fact"].value).toBe("valueB");
	});

	it("should handle multiple facts with varying confidence differences", async () => {
		const baseConfidence = 0.75;
		const sourceBConfidence = currencyjs(baseConfidence).add(WEIGHT_THRESHOLD).add(0.001).value;
		const sourceCConfidence = 0.9;
		const sourceA = createMockSource("sourceA", baseConfidence, 10);
		const sourceB = createMockSource("sourceB", sourceBConfidence, 8);
		const sourceC = createMockSource("sourceC", sourceCConfidence, 3);

		const mockFacts: Fact[] = [
			{
				name: "test_fact" as FactName,
				source: sourceA,
				fn: () => Promise.resolve("valueA")
			},
			{
				name: "test_fact" as FactName,
				source: sourceB,
				fn: () => Promise.resolve("valueB")
			},
			{
				name: "test_fact" as FactName,
				source: sourceC,
				fn: () => Promise.resolve("valueC")
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();

		// sourceC has significantly higher confidence (0.90), should win despite lower weight
		expect(output["test_fact"].value).toBe("valueC");
		expect(output["test_fact"].source?.confidence).toBe(sourceCConfidence);
	});

	it("should ignore facts with undefined values", async () => {
		const sourceA = createMockSource("sourceA", 0.85, 10);
		const sourceB = createMockSource("sourceB", 0.8, 5);

		const mockFacts: Fact[] = [
			{
				name: "test_fact" as FactName,
				source: sourceA,
				fn: () => Promise.resolve(undefined)
			},
			{
				name: "test_fact" as FactName,
				source: sourceB,
				fn: () => Promise.resolve("valueB")
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();

		// Should select sourceB even though sourceA has higher confidence, because sourceA's value is undefined
		expect(output["test_fact"].value).toBe("valueB");
		expect(output["test_fact"].source?.confidence).toBe(0.8);
	});

	it("should ignore facts with empty arrays", async () => {
		const sourceA = createMockSource("sourceA", 0.85, 10);
		const sourceB = createMockSource("sourceB", 0.8, 5);

		const mockFacts: Fact[] = [
			{
				name: "test_fact" as FactName,
				source: sourceA,
				fn: () => Promise.resolve([])
			},
			{
				name: "test_fact" as FactName,
				source: sourceB,
				fn: () => Promise.resolve(["item"])
			}
		];

		const factEngine = new FactEngine(mockFacts, { business: businessID });
		await factEngine.applyRules(factWithHighestConfidence);
		const output = await factEngine.getResults();

		// Should select sourceB even though sourceA has higher confidence, because sourceA's value is an empty array
		expect(output["test_fact"].value).toEqual(["item"]);
		expect(output["test_fact"].source?.confidence).toBe(0.8);
	});

	describe.only("isValidFactValue", () => {
		it("should return true for a valid fact value", () => {
			/** Arrange */
			const factEngine = new FactEngine([], { business: businessID });

			/** Act */	
			const result = factEngine.isValidFactValue("test");

			/** Assert */
			expect(result).toBe(true);
		});

		it.each([
			["array", [1, 2, 3]],
			["boolean", false],
			["object", { a: 1, b: 2 }],
			["string", "test"],
			["number", 1],
			["zero", 0],
			["null", null],
		])("should return true for a valid fact value (%s)", (_description, value) => {
			/** Arrange */
			const factEngine = new FactEngine([], { business: businessID });
			/** Act */
			
			const result = factEngine.isValidFactValue(value);

			/** Assert */
			expect(result).toBe(true);
		});

		it.each([
			["undefined", undefined],
			["empty array", []],
			["empty object", {}],
			["empty string", ""],
		])("should return false an invalid fact value (%s)", (_description, value) => {
			/** Arrange */
			const factEngine = new FactEngine([], { business: businessID });

			/** Act */
			const result = factEngine.isValidFactValue(value);

			/** Assert */
			expect(result).toBe(false);
		});
	});
});
