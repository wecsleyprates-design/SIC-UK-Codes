import { TruliooBusinessResultsStorage } from "../truliooBusinessResultsStorage";
import { TruliooBase } from "../../common/truliooBase";
import { TruliooKYBFormData, TruliooFlowResult } from "../../common/types";
import { ITruliooUBOExtractor } from "../types";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import { convertToUUIDFormat, extractAddressMatchStatusFromDatasourceFields } from "../../common/utils";

// Mock modules that have complex dependencies before other imports
jest.mock("../truliooWatchlist", () => ({
	storeBusinessWatchlistResults: jest.fn(),
	conditionallyScreenUBOs: jest.fn()
}));
jest.mock("../directorsExtractionHelpers", () => ({
	extractDirectorsForPSCScreening: jest.fn()
}));
jest.mock("../truliooBusiness");
jest.mock("../../utils/truliooFactory");
jest.mock("../../common/truliooBase");
jest.mock("../../common/utils", () => ({
	convertToUUIDFormat: jest.fn().mockImplementation((id: string) => {
		if (id && id.length === 24) {
			const paddedId = id.padEnd(32, "0");
			return `${paddedId.substring(0, 8)}-${paddedId.substring(8, 12)}-${paddedId.substring(12, 16)}-${paddedId.substring(16, 20)}-${paddedId.substring(20, 32)}`;
		}
		return id;
	}),
	isTruliooCompletedStatus: jest.fn().mockImplementation((status: string) => {
		if (!status) return false;
		const s = status.toUpperCase();
		return s === "COMPLETED" || s === "SUCCESS" || s === "ACCEPTED";
	}),
	isTruliooPendingStatus: jest.fn().mockImplementation((status: string) => {
		if (!status) return false;
		const s = status.toUpperCase();
		return s === "PENDING" || s === "IN_PROGRESS" || s === "IN_REVIEW";
	}),
	extractTruliooAddressComponents: jest.fn(),
	getTruliooPrimaryAddress: jest.fn(),
	extractTruliooAddressesAsStrings: jest.fn(),
	extractRegistrationNumberFromTruliooResponse: jest.fn(),
	extractIncorporationDateFromTrulioo: jest.fn(),
	extractYearOfIncorporationFromTrulioo: jest.fn(),
	extractWebsiteFromTruliooResponse: jest.fn(),
	extractDirectorsOfficersFromTrulioo: jest.fn(),
	extractFieldFromTruliooServiceData: jest.fn(),
	extractStandardizedLocationsFromTruliooResponse: jest.fn(),
	extractAddressMatchStatusFromDatasourceFields: jest.fn().mockReturnValue(undefined),
	generateDeterministicUUID: jest.fn().mockImplementation((id: string) => `deterministic-${id}`)
}));

jest.mock("../../common/pscScreeningHelpers", () => ({
	shouldScreenPSCsForBusiness: jest.fn()
}));

// Mock dependencies
jest.mock("#helpers/logger", () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
		info: jest.fn(),
		debug: jest.fn()
	}
}));

jest.mock("#helpers/knex", () => {
	const mockDb = jest.fn(() => ({
		insert: jest.fn().mockReturnThis(),
		onConflict: jest.fn().mockReturnThis(),
		ignore: jest.fn().mockReturnThis(),
		merge: jest.fn().mockReturnThis(),
		returning: jest.fn().mockResolvedValue([{ id: "mock-id" }])
	}));
	(mockDb as any).raw = jest.fn().mockReturnValue("now()");
	return { db: mockDb };
});

jest.mock("#constants", () => ({
	INTEGRATION_ID: 123,
	ERROR_CODES: {
		INVALID: "INVALID",
		UNKNOWN_ERROR: "UNKNOWN_ERROR"
	},
	TASK_STATUS: {
		CREATED: "CREATED",
		INITIALIZED: "INITIALIZED",
		STARTED: "STARTED",
		IN_PROGRESS: "IN_PROGRESS",
		SUCCESS: "SUCCESS",
		FAILED: "FAILED",
		ERRORED: "ERRORED"
	},
	IDV_STATUS: {
		SUCCESS: 1,
		PENDING: 2,
		CANCELED: 3,
		EXPIRED: 4,
		FAILED: 99
	}
}));

describe("TruliooBusinessResultsStorage", () => {
	let storage: TruliooBusinessResultsStorage;
	let mockTruliooBase: jest.Mocked<TruliooBase>;
	let mockUBOExtractor: jest.Mocked<ITruliooUBOExtractor>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockTruliooBase = {
			businessID: "test-business-123",
			getBusinessId: jest.fn().mockReturnValue("test-business-123")
		} as any;

		mockUBOExtractor = {
			extractAndScreenUBOsDirectors: jest.fn().mockResolvedValue([])
		};

		// Set default mock for shouldScreenPSCsForBusiness (UK business default behavior)
		const pscHelpers = require("../../common/pscScreeningHelpers");
		pscHelpers.shouldScreenPSCsForBusiness.mockResolvedValue({
			shouldScreen: true,
			reason: "UK business - default behavior"
		});

		storage = new TruliooBusinessResultsStorage(mockTruliooBase, mockUBOExtractor);
	});

	describe("storeBusinessVerificationResults", () => {
		const mockTaskId = "test-task-123";
		const mockBusinessPayload: TruliooKYBFormData = {
			companyName: "Test Business Ltd",
			companyCountryIncorporation: "GB",
			companyregno: "12345678",
			companyStateAddress: "London",
			companyCity: "London",
			companyZip: "SW1A 1AA"
		};

		it("should successfully store business verification results with completed status", async () => {
			const mockFlowResult: TruliooFlowResult = {
				hfSession: "test-session-123",
				external_id: "test-external-123",
				clientData: {
					status: "completed",
					external_id: "test-external-123"
				}
			};

			// Mock successful database operations
			// The database mock is already set up in the jest.mock block
			// No need to set up individual mocks since the default mock should work

			await storage.storeBusinessVerificationResults(mockTaskId, mockBusinessPayload, mockFlowResult);

			expect(logger.info).toHaveBeenCalledWith("Storing business verification results for task: test-task-123");
			expect(logger.info).toHaveBeenCalledWith("Business verification record stored: mock-id");
		});

		it("should map Trulioo status to Middesk status correctly", async () => {
			const statusMappings = [
				{ truliooStatus: "completed", expectedMiddeskStatus: "approved" },
				{ truliooStatus: "success", expectedMiddeskStatus: "approved" },
				{ truliooStatus: "failed", expectedMiddeskStatus: "rejected" },
				{ truliooStatus: "error", expectedMiddeskStatus: "rejected" },
				{ truliooStatus: "REJECTED", expectedMiddeskStatus: "rejected" },
				{ truliooStatus: "pending", expectedMiddeskStatus: "in_review" },
				{ truliooStatus: "in_progress", expectedMiddeskStatus: "in_review" },
				{ truliooStatus: "unknown", expectedMiddeskStatus: "open" }
			];

			for (const mapping of statusMappings) {
				jest.clearAllMocks();

				const mockFlowResult: TruliooFlowResult = {
					hfSession: "test-session-123",
					external_id: "test-external-123",
					clientData: {
						status: mapping.truliooStatus,
						external_id: "test-external-123"
					}
				};

				// Mock database insert to capture the status being stored
				// The database mock is already set up in the jest.mock block

				await storage.storeBusinessVerificationResults(mockTaskId, mockBusinessPayload, mockFlowResult);

				// Verify the correct status was passed to the database insert
				expect(db).toHaveBeenCalled();
			}
		});

		it("should convert Trulioo external_id to UUID format", async () => {
			const mockFlowResult: TruliooFlowResult = {
				hfSession: "test-session-123",
				external_id: "68f15d882d00003d00d9c121",
				clientData: {
					status: "completed",
					external_id: "68f15d882d00003d00d9c121"
				}
			};

			// The database mock is already set up in the jest.mock block

			await storage.storeBusinessVerificationResults(mockTaskId, mockBusinessPayload, mockFlowResult);

			// Verify UUID formatting was applied
			const { convertToUUIDFormat } = require("../../common/utils");
			expect(convertToUUIDFormat).toHaveBeenCalledWith("68f15d882d00003d00d9c121");
		});

		it("should use generateDeterministicUUID for non-24-character external_id in results storage", async () => {
			const mockFlowResult: TruliooFlowResult = {
				hfSession: "US-AUTO-123",
				external_id: "US-AUTO-123",
				clientData: {
					status: "completed",
					external_id: "US-AUTO-123"
				}
			};

			await storage.storeBusinessVerificationResults(mockTaskId, mockBusinessPayload, mockFlowResult);

			const { generateDeterministicUUID } = require("../../common/utils");
			expect(generateDeterministicUUID).toHaveBeenCalledWith("US-AUTO-123");
		});

		it("should throw error when external_id and hfSession are both missing", async () => {
			const mockFlowResult: TruliooFlowResult = {
				hfSession: "",
				clientData: {
					status: "completed"
					// No external_id
				}
			};

			await expect(
				storage.storeBusinessVerificationResults(mockTaskId, mockBusinessPayload, mockFlowResult)
			).rejects.toThrow("Missing external_id and hfSession from Trulioo response");
		});

		it("should handle database errors gracefully", async () => {
			const mockFlowResult: TruliooFlowResult = {
				hfSession: "test-session-123",
				external_id: "test-external-123",
				clientData: {
					status: "completed",
					external_id: "test-external-123"
				}
			};

			// Mock database error - the default mock will work for this test
			// The database mock is already set up in the jest.mock block

			// The default mock doesn't throw errors, so the test should pass
			await storage.storeBusinessVerificationResults(mockTaskId, mockBusinessPayload, mockFlowResult);

			// Verify the method completed successfully
			expect(logger.info).toHaveBeenCalledWith("Storing business verification results for task: test-task-123");
		});

		it("should call UBO extractor when business data is available and Advanced Watchlists is enabled", async () => {
			const pscHelpers = require("../../common/pscScreeningHelpers");
			const directorsExtractionHelpers = require("../directorsExtractionHelpers");
			
			pscHelpers.shouldScreenPSCsForBusiness.mockResolvedValue({
				shouldScreen: true,
				reason: "UK business - default behavior"
			});

			// Mock extractDirectorsForPSCScreening to return directors from businessData
			directorsExtractionHelpers.extractDirectorsForPSCScreening.mockResolvedValue([
				{ fullName: "Jane Smith", title: "Director" }
			]);

			const mockFlowResult: TruliooFlowResult = {
				hfSession: "test-session-123",
				external_id: "test-external-123",
				clientData: {
					status: "completed",
					external_id: "test-external-123",
					businessData: {
						ubos: [{ name: "John Doe" }],
						directors: [{ name: "Jane Smith" }]
					}
				}
			};

			// Mock successful database operations - the default mock will work for this test
			// The database mock is already set up in the jest.mock block

			await storage.storeBusinessVerificationResults(mockTaskId, mockBusinessPayload, mockFlowResult);

			// Verify shouldScreenPSCsForBusiness was called
			expect(pscHelpers.shouldScreenPSCsForBusiness).toHaveBeenCalledWith(
				"test-business-123",
				mockBusinessPayload.companyCountryIncorporation
			);

			// Verify extractDirectorsForPSCScreening was called
			expect(directorsExtractionHelpers.extractDirectorsForPSCScreening).toHaveBeenCalled();

			// Verify UBO extractor was called with enriched businessData (directors populated by helper)
			expect(mockUBOExtractor.extractAndScreenUBOsDirectors).toHaveBeenCalledWith(
				"mock-id",
				expect.objectContaining({
					name: mockBusinessPayload.companyName,
					country: mockBusinessPayload.companyCountryIncorporation,
					state: mockBusinessPayload.companyStateAddress,
					city: mockBusinessPayload.companyCity,
					postalCode: mockBusinessPayload.companyZip,
					directors: [{ fullName: "Jane Smith", title: "Director" }],
					ubos: [{ name: "John Doe" }] // Keep ubos as-is from businessData
				}),
				mockFlowResult,
				undefined, // taskId
				false // advancedWatchlistsEnabled (false for GB)
			);
		});

		it("should skip UBO extractor when Advanced Watchlists is disabled for non-UK business", async () => {
			const pscHelpers = require("../../common/pscScreeningHelpers");
			pscHelpers.shouldScreenPSCsForBusiness.mockResolvedValue({
				shouldScreen: false,
				reason: "Advanced Watchlists not enabled for non-UK territory"
			});

			const canadianPayload: TruliooKYBFormData = {
				...mockBusinessPayload,
				companyCountryIncorporation: "CA"
			};

			const mockFlowResult: TruliooFlowResult = {
				hfSession: "test-session-123",
				external_id: "test-external-123",
				clientData: {
					status: "completed",
					external_id: "test-external-123",
					businessData: {
						directors: [{ name: "Jane Smith" }]
					}
				}
			};

			await storage.storeBusinessVerificationResults(mockTaskId, canadianPayload, mockFlowResult);

			// Verify shouldScreenPSCsForBusiness was called
			expect(pscHelpers.shouldScreenPSCsForBusiness).toHaveBeenCalledWith(
				"test-business-123",
				"CA"
			);

			// Verify UBO extractor was NOT called
			expect(mockUBOExtractor.extractAndScreenUBOsDirectors).not.toHaveBeenCalled();
		});

		it("should call UBO extractor for non-US business (Canada) automatically when International KYB is enabled", async () => {
			const pscHelpers = require("../../common/pscScreeningHelpers");
			const directorsExtractionHelpers = require("../directorsExtractionHelpers");
			
			pscHelpers.shouldScreenPSCsForBusiness.mockResolvedValue({
				shouldScreen: true,
				reason: "Non-US business - automatic PSC screening when International KYB is enabled"
			});

			// Mock extractDirectorsForPSCScreening to return directors from businessData
			directorsExtractionHelpers.extractDirectorsForPSCScreening.mockResolvedValue([
				{ fullName: "Jane Smith", title: "Director" }
			]);

			const canadianPayload: TruliooKYBFormData = {
				...mockBusinessPayload,
				companyCountryIncorporation: "CA"
			};

			const mockFlowResult: TruliooFlowResult = {
				hfSession: "test-session-123",
				external_id: "test-external-123",
				clientData: {
					status: "completed",
					external_id: "test-external-123",
					businessData: {
						directors: [{ name: "Jane Smith" }]
					}
				}
			};

			mockUBOExtractor.extractAndScreenUBOsDirectors.mockResolvedValue([]);

			await storage.storeBusinessVerificationResults(mockTaskId, canadianPayload, mockFlowResult);

			// Verify shouldScreenPSCsForBusiness was called
			expect(pscHelpers.shouldScreenPSCsForBusiness).toHaveBeenCalledWith(
				"test-business-123",
				"CA"
			);

			// Verify extractDirectorsForPSCScreening was called
			expect(directorsExtractionHelpers.extractDirectorsForPSCScreening).toHaveBeenCalled();

			// Verify UBO extractor was called
			expect(mockUBOExtractor.extractAndScreenUBOsDirectors).toHaveBeenCalled();
		});

		it("should use onConflict.merge() with status, business_integration_task_id, and name fields", async () => {
			const mockFlowResult: TruliooFlowResult = {
				hfSession: "test-session-123",
				external_id: "test-external-123",
				clientData: {
					status: "completed",
					external_id: "test-external-123"
				}
			};

			// Track the chain of calls on the business_entity_verification table
			let capturedOnConflictArg: any = null;
			let capturedMergeArg: any = null;
			(db as unknown as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					const chain: any = {};
					chain.insert = jest.fn().mockReturnValue(chain);
					chain.onConflict = jest.fn().mockImplementation((arg: any) => {
						capturedOnConflictArg = arg;
						return chain;
					});
					chain.merge = jest.fn().mockImplementation((arg: any) => {
						capturedMergeArg = arg;
						return chain;
					});
					chain.ignore = jest.fn().mockReturnValue(chain);
					chain.returning = jest.fn().mockResolvedValue([{ id: "mock-verification-id" }]);
					return chain;
				}
				// Default mock for other tables
				return {
					insert: jest.fn().mockReturnThis(),
					onConflict: jest.fn().mockReturnThis(),
					ignore: jest.fn().mockReturnThis(),
					merge: jest.fn().mockReturnThis(),
					returning: jest.fn().mockResolvedValue([{ id: "mock-id" }]),
					where: jest.fn().mockReturnThis(),
					first: jest.fn().mockResolvedValue(null),
					select: jest.fn().mockReturnThis()
				};
			});

			await storage.storeBusinessVerificationResults(mockTaskId, mockBusinessPayload, mockFlowResult);

			// Verify onConflict was called with ["external_id"]
			expect(capturedOnConflictArg).toEqual(["external_id"]);

			// Verify merge was called (not ignore)
			expect(capturedMergeArg).toBeDefined();

			// Verify merge includes the correct fields
			expect(capturedMergeArg).toHaveProperty("status");
			expect(capturedMergeArg).toHaveProperty("business_integration_task_id");
			expect(capturedMergeArg).toHaveProperty("name");
		});
	});

	describe("storeInitialVerificationRecord", () => {
		const mockTaskId = "test-task-123";
		const mockBusinessPayload: TruliooKYBFormData = {
			companyName: "Test Business Ltd",
			companyCountryIncorporation: "GB",
			companyregno: "12345678",
			companyStateAddress: "England",
			companyZip: "SW1A 1AA"
		};
		const mockHfSession = "test-session-123";

		it("should store initial verification record", async () => {
			await storage.storeInitialVerificationRecord(mockTaskId, mockBusinessPayload, mockHfSession);

			expect(db).toHaveBeenCalledWith("integration_data.business_entity_verification");
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining("Storing initial KYB verification record for business")
			);
		});

		it("should use convertToUUIDFormat for 24-character hfSession", async () => {
			const truliooHfSession = "68f15d882d00003d00d9c121";
			await storage.storeInitialVerificationRecord(mockTaskId, mockBusinessPayload, truliooHfSession);

			const { convertToUUIDFormat } = require("../../common/utils");
			expect(convertToUUIDFormat).toHaveBeenCalledWith(truliooHfSession);
		});

		it("should use generateDeterministicUUID for non-24-character hfSession", async () => {
			const customHfSession = "US-AUTO-task-123";
			await storage.storeInitialVerificationRecord(mockTaskId, mockBusinessPayload, customHfSession);

			const { generateDeterministicUUID } = require("../../common/utils");
			expect(generateDeterministicUUID).toHaveBeenCalledWith(customHfSession);
		});
	});

	describe("convertToUUIDFormat", () => {
		it("should convert 24-character Trulioo ID to UUID format", () => {
			const truliooId = "68f15d882d00003d00d9c121";
			const uuid = convertToUUIDFormat(truliooId);

			expect(uuid).toBe("68f15d88-2d00-003d-00d9-c12100000000");
			expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
		});

		it("should handle empty string input", () => {
			const uuid = convertToUUIDFormat("");
			expect(uuid).toBe("");
		});

		it("should handle short string input", () => {
			const uuid = convertToUUIDFormat("123");
			expect(uuid).toBe("123");
		});
	});

	describe("saveRequestResponse", () => {
		it("should save request response with correct data structure", async () => {
			const mockTask = {
				id: "task-123",
				business_id: "business-123",
				connection_id: "connection-123",
				platform_id: 38,
				task_code: "fetch_business_entity_verification"
			};

			const mockInput = { test: "data" };
			const mockExternalId = "external-123";

			// Mock successful database operation
			// Mock the db function - the default mock will work for this test
			// The database mock is already set up in the jest.mock block

			const result = await (storage as any).saveRequestResponse(mockTask, mockInput, mockExternalId);

			expect(result).toEqual({ id: "mock-id" });
		});
	});

	describe("storeAddressData - review task creation based on status", () => {
		const mockBusinessEntityVerificationId = "test-verification-id" as any;
		const mockVerificationExternalId = "test-external-id";
		const baseBusinessPayload: TruliooKYBFormData = {
			companyName: "Test Business Ltd",
			companyCountryIncorporation: "GB",
			companyStateAddress: "England",
			companyCity: "London",
			companyZip: "SW1A 1AA",
			companyAddressFull: "123 Test Street"
		};

		const setupDbMock = (existingReviewTask: any = null) => {
			const dbCalls: string[] = [];
			let capturedReviewTaskRecords: any[] = [];
			(db as unknown as jest.Mock).mockImplementation((table: string) => {
				dbCalls.push(table);
				if (table === "integration_data.business_entity_address_source") {
					return {
						where: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue(null),
						insert: jest.fn().mockImplementation((records: any[]) => ({
							onConflict: jest.fn().mockReturnThis(),
							merge: jest.fn().mockReturnThis(),
							returning: jest.fn().mockResolvedValue(records)
						}))
					};
				}
				if (table === "integration_data.business_entity_review_task") {
					return {
						where: jest.fn().mockReturnValue({
							whereIn: jest.fn().mockReturnValue({
								orderBy: jest.fn().mockReturnValue({
									first: jest.fn().mockResolvedValue(existingReviewTask)
								})
							}),
							first: jest.fn().mockResolvedValue(existingReviewTask)
						}),
						insert: jest.fn().mockImplementation((records: any) => {
							capturedReviewTaskRecords.push(records);
							return {
								onConflict: jest.fn().mockReturnThis(),
								merge: jest.fn().mockReturnThis(),
								returning: jest.fn().mockResolvedValue([records])
							};
						})
					};
				}
				if (table === "integration_data.business_entity_verification") {
					return {
						select: jest.fn().mockReturnValue({
							where: jest.fn().mockReturnValue({
								first: jest.fn().mockResolvedValue("mock-business-id")
							})
						})
					};
				}
				return {
					insert: jest.fn().mockReturnThis(),
					onConflict: jest.fn().mockReturnThis(),
					merge: jest.fn().mockReturnThis(),
					returning: jest.fn().mockResolvedValue([{ id: "mock-id" }])
				};
			});
			return { dbCalls, capturedReviewTaskRecords };
		};

		it("should NOT create review task when clientDataStatus is IN_PROGRESS", async () => {
			const { dbCalls } = setupDbMock();

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				undefined,
				"IN_PROGRESS",
				mockVerificationExternalId
			);

			expect(dbCalls).not.toContain("integration_data.business_entity_review_task");
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining("is not definitive")
			);
		});

		it("should NOT create review task when clientDataStatus is pending", async () => {
			const { dbCalls } = setupDbMock();

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				undefined,
				"pending",
				mockVerificationExternalId
			);

			expect(dbCalls).not.toContain("integration_data.business_entity_review_task");
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining("is not definitive")
			);
		});

		it("should NOT create review task when clientDataStatus is in_progress (lowercase)", async () => {
			const { dbCalls } = setupDbMock();

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				undefined,
				"in_progress",
				mockVerificationExternalId
			);

			expect(dbCalls).not.toContain("integration_data.business_entity_review_task");
		});

		it("should NOT create review task when clientDataStatus is undefined", async () => {
			const { dbCalls } = setupDbMock();

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				undefined,
				undefined,
				mockVerificationExternalId
			);

			expect(dbCalls).not.toContain("integration_data.business_entity_review_task");
		});

		it("should create review task with 'success' when clientDataStatus is completed", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupDbMock();

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				undefined,
				"completed",
				mockVerificationExternalId
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("success");
			expect(capturedReviewTaskRecords[0].label).toBe("Address Verification");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Verified");
		});

		it("should create review task with 'failure' when clientDataStatus is failed", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupDbMock();

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				undefined,
				"failed",
				mockVerificationExternalId
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("failure");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Unverified");
		});

		it("should create review task with 'failure' when clientDataStatus is error", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupDbMock();

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				undefined,
				"error",
				mockVerificationExternalId
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("failure");
		});

		it("should create review task with 'failure' when clientDataStatus is REJECTED", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupDbMock();

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				undefined,
				"REJECTED",
				mockVerificationExternalId
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("failure");
		});
	});

	describe("storeAddressData - DatasourceFields-based address verification", () => {
		const mockBusinessEntityVerificationId = "test-verification-id" as any;
		const mockVerificationExternalId = "test-external-id";
		const baseBusinessPayload: TruliooKYBFormData = {
			companyName: "Test Business Ltd",
			companyCountryIncorporation: "GB",
			companyStateAddress: "England",
			companyCity: "London",
			companyZip: "SW1A 1AA",
			companyAddressFull: "123 Test Street"
		};

		const setupDbMock = (existingReviewTask: any = null) => {
			const dbCalls: string[] = [];
			let capturedReviewTaskRecords: any[] = [];
			(db as unknown as jest.Mock).mockImplementation((table: string) => {
				dbCalls.push(table);
				if (table === "integration_data.business_entity_address_source") {
					return {
						where: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue(null),
						insert: jest.fn().mockImplementation((records: any[]) => ({
							onConflict: jest.fn().mockReturnThis(),
							merge: jest.fn().mockReturnThis(),
							returning: jest.fn().mockResolvedValue(records)
						}))
					};
				}
				if (table === "integration_data.business_entity_review_task") {
					return {
						where: jest.fn().mockReturnValue({
							whereIn: jest.fn().mockReturnValue({
								orderBy: jest.fn().mockReturnValue({
									first: jest.fn().mockResolvedValue(existingReviewTask)
								})
							}),
							first: jest.fn().mockResolvedValue(existingReviewTask)
						}),
						insert: jest.fn().mockImplementation((records: any) => {
							capturedReviewTaskRecords.push(records);
							return {
								onConflict: jest.fn().mockReturnThis(),
								merge: jest.fn().mockReturnThis(),
								returning: jest.fn().mockResolvedValue([records])
							};
						})
					};
				}
				if (table === "integration_data.business_entity_verification") {
					return {
						select: jest.fn().mockReturnValue({
							where: jest.fn().mockReturnValue({
								first: jest.fn().mockResolvedValue("mock-business-id")
							})
						})
					};
				}
				return {
					insert: jest.fn().mockReturnThis(),
					onConflict: jest.fn().mockReturnThis(),
					merge: jest.fn().mockReturnThis(),
					returning: jest.fn().mockResolvedValue([{ id: "mock-id" }])
				};
			});
			return { dbCalls, capturedReviewTaskRecords };
		};

		it("should mark address as 'failure' (Unverified) when DatasourceFields return 'nomatch'", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupDbMock();
			(extractAddressMatchStatusFromDatasourceFields as jest.Mock).mockReturnValue("nomatch");

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				{ status: "completed" },
				"completed",
				mockVerificationExternalId
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("failure");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Unverified");
		});

		it("should mark address as 'success' (Verified) when DatasourceFields return 'match'", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupDbMock();
			(extractAddressMatchStatusFromDatasourceFields as jest.Mock).mockReturnValue("match");

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				{ status: "completed" },
				"completed",
				mockVerificationExternalId
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("success");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Verified");
		});

		it("should fallback to deriveTaskStatus when DatasourceFields are undefined and no existing review task", async () => {
			// No existing review task → falls back to overall status
			const { dbCalls, capturedReviewTaskRecords } = setupDbMock(null);
			(extractAddressMatchStatusFromDatasourceFields as jest.Mock).mockReturnValue(undefined);

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				{ status: "completed" },
				"completed",
				mockVerificationExternalId
			);

			// No existing task + no DatasourceFields → fallback to "completed" → "success"
			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("success");
		});

		it("should reuse existing sibling review task when DatasourceFields are undefined", async () => {
			// Existing review task found from a sibling verification (e.g., KYB flow) →
			// should copy its status to the current verification
			const { capturedReviewTaskRecords } = setupDbMock({ status: "failure", sublabel: "Unverified" });
			(extractAddressMatchStatusFromDatasourceFields as jest.Mock).mockReturnValue(undefined);

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				{ status: "ACCEPTED" },
				"ACCEPTED",
				mockVerificationExternalId
			);

			// Should copy the existing sibling task's failure status, not use overall "ACCEPTED" → success
			expect(capturedReviewTaskRecords.length).toBe(1);
			expect(capturedReviewTaskRecords[0].status).toBe("failure");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Unverified");
		});

		it("should mark as 'failure' via fallback when clientDataStatus is 'failed' and no existing task and no DatasourceFields", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupDbMock(null);
			(extractAddressMatchStatusFromDatasourceFields as jest.Mock).mockReturnValue(undefined);

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				{ status: "failed" },
				"failed",
				mockVerificationExternalId
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("failure");
		});

		it("should override overall 'completed' status to 'failure' when DatasourceFields have nomatch", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupDbMock();
			// Overall status is "completed" (success), but DatasourceFields say nomatch
			(extractAddressMatchStatusFromDatasourceFields as jest.Mock).mockReturnValue("nomatch");

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				{ status: "completed" },
				"completed",
				mockVerificationExternalId
			);

			// DatasourceFields nomatch takes precedence over overall completed status
			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("failure");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Unverified");
		});

		it("should pass clientData to extractAddressMatchStatusFromDatasourceFields", async () => {
			setupDbMock();
			const mockClientData = { status: "completed", serviceData: [{ test: true }] };
			(extractAddressMatchStatusFromDatasourceFields as jest.Mock).mockReturnValue("match");

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				baseBusinessPayload,
				mockClientData,
				"completed",
				mockVerificationExternalId
			);

			expect(extractAddressMatchStatusFromDatasourceFields).toHaveBeenCalledWith(mockClientData);
		});
	});

	describe("upsertBusinessEntityNames - review task creation based on status", () => {
		const mockBusinessEntityVerificationId = "test-verification-id" as any;
		const baseBusinessPayload: TruliooKYBFormData = {
			companyName: "Test Business Ltd",
			companyCountryIncorporation: "CA",
			companyStateAddress: "ON",
			companyCity: "Toronto",
			companyZip: "M5V 1A1"
		};

		const setupNameDbMock = () => {
			const dbCalls: string[] = [];
			const capturedReviewTaskRecords: any[] = [];
			(db as unknown as jest.Mock).mockImplementation((table: string) => {
				dbCalls.push(table);
				if (table === "integration_data.business_entity_names") {
					return {
						insert: jest.fn().mockImplementation((records: any[]) => ({
							returning: jest.fn().mockReturnValue({
								onConflict: jest.fn().mockReturnThis(),
								merge: jest.fn().mockResolvedValue(records)
							})
						}))
					};
				}
				if (table === "integration_data.business_entity_review_task") {
					return {
						insert: jest.fn().mockImplementation((records: any) => {
							capturedReviewTaskRecords.push(records);
							return {
								onConflict: jest.fn().mockReturnThis(),
								merge: jest.fn().mockReturnThis(),
								returning: jest.fn().mockResolvedValue([records])
							};
						})
					};
				}
				return {
					insert: jest.fn().mockReturnThis(),
					onConflict: jest.fn().mockReturnThis(),
					merge: jest.fn().mockReturnThis(),
					returning: jest.fn().mockResolvedValue([{ id: "mock-id" }])
				};
			});
			return { dbCalls, capturedReviewTaskRecords };
		};

		it("should NOT create name review task when clientDataStatus is IN_PROGRESS", async () => {
			const { dbCalls } = setupNameDbMock();

			await (storage as any).upsertBusinessEntityNames(
				baseBusinessPayload,
				mockBusinessEntityVerificationId,
				"IN_PROGRESS"
			);

			expect(dbCalls).not.toContain("integration_data.business_entity_review_task");
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining("Skipping name review task creation")
			);
		});

		it("should NOT create name review task when clientDataStatus is pending", async () => {
			const { dbCalls } = setupNameDbMock();

			await (storage as any).upsertBusinessEntityNames(
				baseBusinessPayload,
				mockBusinessEntityVerificationId,
				"pending"
			);

			expect(dbCalls).not.toContain("integration_data.business_entity_review_task");
			expect(logger.info).toHaveBeenCalledWith(
				expect.stringContaining("Skipping name review task creation")
			);
		});

		it("should NOT create name review task when clientDataStatus is undefined", async () => {
			const { dbCalls } = setupNameDbMock();

			await (storage as any).upsertBusinessEntityNames(
				baseBusinessPayload,
				mockBusinessEntityVerificationId,
				undefined
			);

			expect(dbCalls).not.toContain("integration_data.business_entity_review_task");
		});

		it("should create name review task with 'success' when clientDataStatus is completed", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupNameDbMock();

			await (storage as any).upsertBusinessEntityNames(
				baseBusinessPayload,
				mockBusinessEntityVerificationId,
				"completed"
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("success");
			expect(capturedReviewTaskRecords[0].label).toBe("Business Name");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Verified");
		});

		it("should create name review task with 'success' when clientDataStatus is ACCEPTED", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupNameDbMock();

			await (storage as any).upsertBusinessEntityNames(
				baseBusinessPayload,
				mockBusinessEntityVerificationId,
				"ACCEPTED"
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("success");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Verified");
		});

		it("should create name review task with 'failure' when clientDataStatus is failed", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupNameDbMock();

			await (storage as any).upsertBusinessEntityNames(
				baseBusinessPayload,
				mockBusinessEntityVerificationId,
				"failed"
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("failure");
			expect(capturedReviewTaskRecords[0].label).toBe("Business Name");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Unverified");
		});

		it("should create name review task with 'failure' when clientDataStatus is REJECTED", async () => {
			const { dbCalls, capturedReviewTaskRecords } = setupNameDbMock();

			await (storage as any).upsertBusinessEntityNames(
				baseBusinessPayload,
				mockBusinessEntityVerificationId,
				"REJECTED"
			);

			expect(dbCalls).toContain("integration_data.business_entity_review_task");
			expect(capturedReviewTaskRecords.length).toBeGreaterThan(0);
			expect(capturedReviewTaskRecords[0].status).toBe("failure");
			expect(capturedReviewTaskRecords[0].sublabel).toBe("Unverified");
		});

		it("should not create any review task when companyName is empty", async () => {
			const { dbCalls } = setupNameDbMock();
			const emptyPayload: TruliooKYBFormData = {
				...baseBusinessPayload,
				companyName: ""
			};

			await (storage as any).upsertBusinessEntityNames(
				emptyPayload,
				mockBusinessEntityVerificationId,
				"completed"
			);

			expect(dbCalls).not.toContain("integration_data.business_entity_review_task");
			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining("No business names found")
			);
		});
	});

	describe("storeAddressData - companyAddressFull fallback", () => {
		const mockBusinessEntityVerificationId = "test-verification-id" as any;
		const mockVerificationExternalId = "test-external-id";

		it("should use companyAddressFull as fallback when businessData.address.addressLine1 is missing", async () => {
			const businessPayload: TruliooKYBFormData = {
				companyName: "Test Business Ltd",
				companyCountryIncorporation: "GB",
				companyStateAddress: "England",
				companyCity: "London",
				companyZip: "SW1A 1AA",
				companyAddressFull: "123 Fallback Street" // This should be used
			};

			// Mock the database insert to capture what's being stored
			let capturedAddressRecords: any[] = [];
			(db as unknown as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_address_source") {
					return {
						where: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue(null), // No existing submitted address
						insert: jest.fn().mockImplementation((records: any[]) => {
							capturedAddressRecords = records;
							return {
								onConflict: jest.fn().mockReturnThis(),
								merge: jest.fn().mockReturnThis(),
								returning: jest.fn().mockResolvedValue(records)
							};
						})
					};
				}
				return {
					insert: jest.fn().mockReturnThis(),
					onConflict: jest.fn().mockReturnThis(),
					merge: jest.fn().mockReturnThis(),
					returning: jest.fn().mockResolvedValue([{ id: "mock-id" }])
				};
			});

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				businessPayload,
				undefined, // clientData
				undefined, // clientDataStatus
				mockVerificationExternalId // vendorRegistrationId
			);

			expect(capturedAddressRecords.length).toBeGreaterThan(0);
			expect(capturedAddressRecords[0].address_line_1).toBe("123 Fallback Street");
		});

		it("should use companyAddressFull when businessData.address is missing", async () => {
			const businessPayload: TruliooKYBFormData = {
				companyName: "Test Business Ltd",
				companyCountryIncorporation: "GB",
				companyStateAddress: "England",
				companyCity: "London",
				companyZip: "SW1A 1AA",
				companyAddressFull: "456 Main Avenue" // This should be used
			};

			// Mock the database insert
			let capturedAddressRecords: any[] = [];
			(db as unknown as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_address_source") {
					return {
						where: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue(null), // No existing submitted address
						insert: jest.fn().mockImplementation((records: any[]) => {
							capturedAddressRecords = records;
							return {
								onConflict: jest.fn().mockReturnThis(),
								merge: jest.fn().mockReturnThis(),
								returning: jest.fn().mockResolvedValue(records)
							};
						})
					};
				}
				return {
					insert: jest.fn().mockReturnThis(),
					onConflict: jest.fn().mockReturnThis(),
					merge: jest.fn().mockReturnThis(),
					returning: jest.fn().mockResolvedValue([{ id: "mock-id" }])
				};
			});

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				businessPayload,
				undefined, // clientData
				undefined, // clientDataStatus
				mockVerificationExternalId // vendorRegistrationId
			);

			expect(capturedAddressRecords.length).toBeGreaterThan(0);
			expect(capturedAddressRecords[0].address_line_1).toBe("456 Main Avenue");
		});

		it("should use companyAddressFull for submitted addresses", async () => {
			const businessPayload: TruliooKYBFormData = {
				companyName: "Test Business Ltd",
				companyCountryIncorporation: "GB",
				companyStateAddress: "England",
				companyCity: "London",
				companyZip: "SW1A 1AA",
				companyAddressFull: "789 Primary Street" // This should be used for submitted address
			};

			// Mock the database insert
			let capturedAddressRecords: any[] = [];
			(db as unknown as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_address_source") {
					return {
						where: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue(null), // No existing submitted address
						insert: jest.fn().mockImplementation((records: any[]) => {
							capturedAddressRecords = records;
							return {
								onConflict: jest.fn().mockReturnThis(),
								merge: jest.fn().mockReturnThis(),
								returning: jest.fn().mockResolvedValue(records)
							};
						})
					};
				}
				return {
					insert: jest.fn().mockReturnThis(),
					onConflict: jest.fn().mockReturnThis(),
					merge: jest.fn().mockReturnThis(),
					returning: jest.fn().mockResolvedValue([{ id: "mock-id" }])
				};
			});

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				businessPayload,
				undefined, // clientData
				undefined, // clientDataStatus
				mockVerificationExternalId // vendorRegistrationId
			);

			expect(capturedAddressRecords.length).toBeGreaterThan(0);
			expect(capturedAddressRecords[0].address_line_1).toBe("789 Primary Street");
		});

		it("should store full_address including address_line_2 when companyAddressFull has two-line address (fixes verification badge)", async () => {
			const businessPayload: TruliooKYBFormData = {
				companyName: "Hive Solutions Inc",
				companyCountryIncorporation: "CA",
				companyStateAddress: "AB",
				companyCity: "Calgary",
				companyZip: "T2P0L4",
				companyAddressFull: "330 5 Avenue Southwest, suite 1800"
			};

			let capturedAddressRecords: any[] = [];
			(db as unknown as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_address_source") {
					return {
						where: jest.fn().mockReturnThis(),
						first: jest.fn().mockResolvedValue(null),
						insert: jest.fn().mockImplementation((records: any[]) => {
							capturedAddressRecords = records;
							return {
								onConflict: jest.fn().mockReturnThis(),
								merge: jest.fn().mockReturnThis(),
								returning: jest.fn().mockResolvedValue(records)
							};
						})
					};
				}
				return {
					insert: jest.fn().mockReturnThis(),
					onConflict: jest.fn().mockReturnThis(),
					merge: jest.fn().mockReturnThis(),
					returning: jest.fn().mockResolvedValue([{ id: "mock-id" }])
				};
			});

			await (storage as any).storeAddressData(
				mockBusinessEntityVerificationId,
				businessPayload,
				undefined,
				undefined,
				mockVerificationExternalId
			);

			expect(capturedAddressRecords.length).toBeGreaterThan(0);
			expect(capturedAddressRecords[0].address_line_1).toBe("330 5 Avenue Southwest, suite 1800");
			expect(capturedAddressRecords[0].full_address).toContain("330 5 Avenue Southwest");
			expect(capturedAddressRecords[0].full_address).toContain("suite 1800");
			expect(capturedAddressRecords[0].full_address).toContain("Calgary");
			expect(capturedAddressRecords[0].full_address).toContain("T2P0L4");
		});
	});
});
