import { TruliooPersonDataStorage } from "../truliooPersonDataStorage";
import { TruliooUBOPersonData, TruliooPersonVerificationData } from "../../common/types";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";

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
	const mockDb = jest.fn();
	(mockDb as any).raw = jest.fn((str: string) => str);
	return { db: mockDb };
});

describe("TruliooPersonDataStorage", () => {
	let storage: TruliooPersonDataStorage;

	beforeEach(() => {
		jest.clearAllMocks();
		storage = new TruliooPersonDataStorage();
	});

	describe("storePersonInBusinessEntityPeople", () => {
		const mockPersonData: TruliooUBOPersonData = {
			fullName: "John Doe",
			firstName: "John",
			lastName: "Doe",
			dateOfBirth: "1990-01-01",
			addressLine1: "123 Test Street",
			city: "London",
			postalCode: "SW1A 1AA",
			country: "GB",
			nationality: "GB",
			controlType: "UBO"
		};

		const mockBusinessEntityVerificationId = "test-business-verification-123";

		const mockVerificationData: TruliooPersonVerificationData = {
			inquiryId: "test-inquiry-123",
			status: "completed",
			results: {
				watchlistHits: [],
				screeningStatus: "COMPLETED"
			}
		};

		it("should successfully store person data in business_entity_people table", async () => {
			// Mock successful database operation
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockReturnThis();
			const mockReturning = jest.fn().mockResolvedValue([{ id: "new-person-id" }]);

			(db as any as jest.Mock).mockImplementation(() => ({
				insert: mockInsert,
				onConflict: mockOnConflict,
				ignore: mockIgnore,
				returning: mockReturning
			}));

			await storage.storePersonInBusinessEntityPeople(
				mockPersonData,
				mockBusinessEntityVerificationId,
				mockVerificationData
			);

			// Verify database insert was called with correct data structure
			expect(db).toHaveBeenCalledWith("integration_data.business_entity_people");
		});

		it("should handle database errors gracefully without throwing", async () => {
			// Mock database error
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockReturnThis();
			const mockReturning = jest.fn().mockRejectedValue(new Error("Database connection failed"));

			(db as any as jest.Mock).mockImplementation(() => ({
				insert: mockInsert,
				onConflict: mockOnConflict,
				ignore: mockIgnore,
				returning: mockReturning
			}));

			// Should not throw error - method catches and logs errors
			await expect(
				storage.storePersonInBusinessEntityPeople(
					mockPersonData,
					mockBusinessEntityVerificationId,
					mockVerificationData
				)
			).resolves.toBeUndefined();

			// Verify error was logged
			expect(logger.error).toHaveBeenCalledWith(
				expect.any(Error),
				"Error storing person in business_entity_people for John Doe:"
			);
		});

		it("should store person with correct data mapping", async () => {
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockReturnThis();
			const mockReturning = jest.fn().mockResolvedValue([{ id: "new-person-id" }]);

			(db as any).mockImplementation(() => ({
				insert: mockInsert,
				onConflict: mockOnConflict,
				ignore: mockIgnore,
				returning: mockReturning
			}));

			await storage.storePersonInBusinessEntityPeople(
				mockPersonData,
				mockBusinessEntityVerificationId,
				mockVerificationData
			);

			// Verify the insert was called with the correct data structure
			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					business_entity_verification_id: mockBusinessEntityVerificationId,
					name: mockPersonData.fullName,
					source: expect.any(String),
					submitted: true,
					titles: [],
					metadata: expect.any(String)
				})
			);
		});

		it("should handle missing optional fields gracefully", async () => {
			const incompletePersonData: TruliooUBOPersonData = {
				fullName: "Jane Smith",
				firstName: "Jane",
				lastName: "Smith",
				dateOfBirth: "",
				addressLine1: "",
				city: "",
				postalCode: "",
				country: "",
				nationality: "",
				controlType: "DIRECTOR"
			};

			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockReturnThis();
			const mockReturning = jest.fn().mockResolvedValue([{ id: "new-person-id" }]);

			(db as any).mockImplementation(() => ({
				insert: mockInsert,
				onConflict: mockOnConflict,
				ignore: mockIgnore,
				returning: mockReturning
			}));

			await storage.storePersonInBusinessEntityPeople(
				incompletePersonData,
				mockBusinessEntityVerificationId,
				mockVerificationData
			);

			// Should still insert with empty strings for missing fields
			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Jane Smith",
					source: expect.any(String),
					submitted: true,
					titles: [],
					metadata: expect.any(String)
				})
			);
		});

		it("should serialize verification metadata as JSON string", async () => {
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockReturnThis();
			const mockReturning = jest.fn().mockResolvedValue([{ id: "new-person-id" }]);

			(db as any).mockImplementation(() => ({
				insert: mockInsert,
				onConflict: mockOnConflict,
				ignore: mockIgnore,
				returning: mockReturning
			}));

			await storage.storePersonInBusinessEntityPeople(
				mockPersonData,
				mockBusinessEntityVerificationId,
				mockVerificationData
			);

			// Verify verification metadata is JSON stringified
			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					source: expect.stringContaining('"inquiryId":"test-inquiry-123"')
				})
			);
		});

		it("should use onConflict merge strategy for duplicate prevention", async () => {
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockMerge = jest.fn().mockReturnThis();

			(db as any).mockImplementation(() => ({
				insert: mockInsert,
				onConflict: mockOnConflict,
				merge: mockMerge
			}));

			await storage.storePersonInBusinessEntityPeople(
				mockPersonData,
				mockBusinessEntityVerificationId,
				mockVerificationData
			);

			// Verify conflict resolution strategy
			expect(mockOnConflict).toHaveBeenCalledWith(["business_entity_verification_id", "name"]);
			expect(mockMerge).toHaveBeenCalled();
		});
	});

	describe("storeInitialPersonRecord", () => {
		const mockBusinessId = "test-business-123";
		const mockHfSession = "test-hf-session-123";
		const mockBusinessContext = {
			companyName: "Test Company Ltd",
			companyCountryIncorporation: "GB",
			companyregno: "12345678",
			companyStateAddress: "London",
			companyCity: "London",
			companyZip: "SW1A 1AA"
		};
		const mockTaskId = "test-task-id-123";
		const mockBusinessEntityVerificationId = "test-kyb-verification-id-123";

		it("should store record when taskId is provided directly", async () => {
			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockOrderBy = jest.fn().mockReturnThis();
			const mockFirst = jest.fn().mockResolvedValue(undefined);
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockResolvedValue(undefined);

			(db as any as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					return {
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						orderBy: mockOrderBy,
						first: mockFirst,
						insert: mockInsert,
						onConflict: mockOnConflict,
						ignore: mockIgnore
					};
				}
				return {};
			});

			await storage.storeInitialPersonRecord(
				mockBusinessId,
				mockHfSession,
				mockBusinessContext,
				mockTaskId
			);

			// Should insert with provided taskId
			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					business_id: mockBusinessId,
					business_integration_task_id: mockTaskId,
					status: "in_progress"
				})
			);
			expect(mockOnConflict).toHaveBeenCalledWith(["external_id"]);
		});

		it("should fetch taskId from KYB verification record when taskId not provided but businessEntityVerificationId is", async () => {
			const mockKybRecord = {
				id: mockBusinessEntityVerificationId,
				business_integration_task_id: mockTaskId
			};

			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockOrderBy = jest.fn().mockReturnThis();
			const mockFirst = jest.fn()
				.mockResolvedValueOnce(mockKybRecord) // First call: fetch from KYB record
				.mockResolvedValueOnce(undefined); // Second call: insert result
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockResolvedValue(undefined);

			(db as any as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					return {
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						orderBy: mockOrderBy,
						first: mockFirst,
						insert: mockInsert,
						onConflict: mockOnConflict,
						ignore: mockIgnore
					};
				}
				return {};
			});

			await storage.storeInitialPersonRecord(
				mockBusinessId,
				mockHfSession,
				mockBusinessContext,
				undefined,
				mockBusinessEntityVerificationId
			);

			// Should query for KYB record
			expect(mockWhere).toHaveBeenCalledWith({ id: mockBusinessEntityVerificationId });
			expect(mockWhereNotNull).toHaveBeenCalledWith("business_integration_task_id");

			// Should insert with fetched taskId
			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					business_integration_task_id: mockTaskId
				})
			);
		});

		it("should fallback to recent KYB verification when businessEntityVerificationId not found", async () => {
			const mockRecentKybRecord = {
				id: "recent-kyb-id",
				business_integration_task_id: mockTaskId
			};

			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockOrderBy = jest.fn().mockReturnThis();
			const mockFirst = jest.fn()
				.mockResolvedValueOnce(undefined) // First call: KYB record not found
				.mockResolvedValueOnce(mockRecentKybRecord) // Second call: recent KYB record found
				.mockResolvedValueOnce(undefined); // Third call: insert result
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockResolvedValue(undefined);

			(db as any as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					return {
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						orderBy: mockOrderBy,
						first: mockFirst,
						insert: mockInsert,
						onConflict: mockOnConflict,
						ignore: mockIgnore
					};
				}
				return {};
			});

			await storage.storeInitialPersonRecord(
				mockBusinessId,
				mockHfSession,
				mockBusinessContext,
				undefined,
				mockBusinessEntityVerificationId
			);

			// Should query for recent KYB record by business_id
			expect(mockWhere).toHaveBeenCalledWith({ business_id: mockBusinessId });
			expect(mockOrderBy).toHaveBeenCalledWith("created_at", "desc");

			// Should insert with fetched taskId from recent record
			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					business_integration_task_id: mockTaskId
				})
			);
		});

		it("should exit early and log error when no taskId can be found", async () => {
			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockOrderBy = jest.fn().mockReturnThis();
			const mockFirst = jest.fn()
				.mockResolvedValueOnce(undefined) // First call: KYB record not found
				.mockResolvedValueOnce(undefined); // Second call: recent KYB record not found
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockResolvedValue(undefined);

			(db as any as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					return {
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						orderBy: mockOrderBy,
						first: mockFirst,
						insert: mockInsert,
						onConflict: mockOnConflict,
						ignore: mockIgnore
					};
				}
				return {};
			});

			await storage.storeInitialPersonRecord(
				mockBusinessId,
				mockHfSession,
				mockBusinessContext,
				undefined,
				mockBusinessEntityVerificationId
			);

			// Should not insert when no taskId found
			expect(mockInsert).not.toHaveBeenCalled();

			// Should log error
			expect(logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Cannot store PSC verification record without taskId")
			);
		});

		it("should handle KYB record with null taskId gracefully", async () => {
			const mockKybRecord = {
				id: mockBusinessEntityVerificationId,
				business_integration_task_id: null // NULL taskId
			};

			const mockRecentKybRecord = {
				id: "recent-kyb-id",
				business_integration_task_id: mockTaskId
			};

			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockOrderBy = jest.fn().mockReturnThis();
			const mockFirst = jest.fn()
				.mockResolvedValueOnce(mockKybRecord) // First call: KYB record found but taskId is NULL
				.mockResolvedValueOnce(mockRecentKybRecord) // Second call: recent KYB record found with taskId
				.mockResolvedValueOnce(undefined); // Third call: insert result
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockResolvedValue(undefined);

			(db as any as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					return {
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						orderBy: mockOrderBy,
						first: mockFirst,
						insert: mockInsert,
						onConflict: mockOnConflict,
						ignore: mockIgnore
					};
				}
				return {};
			});

			await storage.storeInitialPersonRecord(
				mockBusinessId,
				mockHfSession,
				mockBusinessContext,
				undefined,
				mockBusinessEntityVerificationId
			);

			// Should fallback to recent KYB record when first record has NULL taskId
			expect(mockWhere).toHaveBeenCalledWith({ business_id: mockBusinessId });

			// Should insert with taskId from recent record
			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					business_integration_task_id: mockTaskId
				})
			);
		});

		it("should handle database errors when fetching KYB record gracefully", async () => {
			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockOrderBy = jest.fn().mockReturnThis();
			const mockFirst = jest.fn()
				.mockRejectedValueOnce(new Error("Database connection failed")) // First call: error fetching KYB record
				.mockResolvedValueOnce(undefined); // Second call: recent KYB record not found
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockResolvedValue(undefined);

			(db as any as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					return {
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						orderBy: mockOrderBy,
						first: mockFirst,
						insert: mockInsert,
						onConflict: mockOnConflict,
						ignore: mockIgnore
					};
				}
				return {};
			});

			await storage.storeInitialPersonRecord(
				mockBusinessId,
				mockHfSession,
				mockBusinessContext,
				undefined,
				mockBusinessEntityVerificationId
			);

			// Should log warning about error
			expect(logger.warn).toHaveBeenCalledWith(
				expect.any(Error),
				expect.stringContaining("Could not fetch taskId from KYB verification record")
			);

			// Should still try to find recent KYB record
			expect(mockWhere).toHaveBeenCalledWith({ business_id: mockBusinessId });
		});

		it("should handle database errors when fetching recent KYB record gracefully", async () => {
			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockOrderBy = jest.fn().mockReturnThis();
			const mockFirst = jest.fn()
				.mockResolvedValueOnce(undefined) // First call: KYB record not found
				.mockRejectedValueOnce(new Error("Database connection failed")); // Second call: error fetching recent KYB
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockResolvedValue(undefined);

			(db as any as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					return {
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						orderBy: mockOrderBy,
						first: mockFirst,
						insert: mockInsert,
						onConflict: mockOnConflict,
						ignore: mockIgnore
					};
				}
				return {};
			});

			await storage.storeInitialPersonRecord(
				mockBusinessId,
				mockHfSession,
				mockBusinessContext,
				undefined,
				mockBusinessEntityVerificationId
			);

			// Should log warning about error
			expect(logger.warn).toHaveBeenCalledWith(
				expect.any(Error),
				expect.stringContaining("Could not fetch taskId from recent KYB verification")
			);

			// Should not insert when no taskId found
			expect(mockInsert).not.toHaveBeenCalled();
		});

		it("should handle database errors during insert gracefully", async () => {
			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockOrderBy = jest.fn().mockReturnThis();
			const mockFirst = jest.fn().mockResolvedValue(undefined);
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockRejectedValue(new Error("Insert failed"));

			(db as any as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					return {
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						orderBy: mockOrderBy,
						first: mockFirst,
						insert: mockInsert,
						onConflict: mockOnConflict,
						ignore: mockIgnore
					};
				}
				return {};
			});

			// Should not throw error - method catches and logs errors
			await expect(
				storage.storeInitialPersonRecord(
					mockBusinessId,
					mockHfSession,
					mockBusinessContext,
					mockTaskId
				)
			).resolves.toBeUndefined();

			// Verify error was logged
			expect(logger.error).toHaveBeenCalledWith(
				expect.any(Error),
				expect.stringContaining("Error storing initial PSC verification record")
			);
		});

		it("should prioritize provided taskId over fetching from database", async () => {
			const mockKybRecord = {
				id: mockBusinessEntityVerificationId,
				business_integration_task_id: "different-task-id"
			};

			const mockWhere = jest.fn().mockReturnThis();
			const mockWhereNotNull = jest.fn().mockReturnThis();
			const mockOrderBy = jest.fn().mockReturnThis();
			const mockFirst = jest.fn().mockResolvedValue(mockKybRecord);
			const mockInsert = jest.fn().mockReturnThis();
			const mockOnConflict = jest.fn().mockReturnThis();
			const mockIgnore = jest.fn().mockResolvedValue(undefined);

			(db as any as jest.Mock).mockImplementation((table: string) => {
				if (table === "integration_data.business_entity_verification") {
					return {
						where: mockWhere,
						whereNotNull: mockWhereNotNull,
						orderBy: mockOrderBy,
						first: mockFirst,
						insert: mockInsert,
						onConflict: mockOnConflict,
						ignore: mockIgnore
					};
				}
				return {};
			});

			await storage.storeInitialPersonRecord(
				mockBusinessId,
				mockHfSession,
				mockBusinessContext,
				mockTaskId,
				mockBusinessEntityVerificationId
			);

			// Should use provided taskId, not fetch from database
			expect(mockFirst).not.toHaveBeenCalled();
			expect(mockInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					business_integration_task_id: mockTaskId
				})
			);
		});
	});
});
