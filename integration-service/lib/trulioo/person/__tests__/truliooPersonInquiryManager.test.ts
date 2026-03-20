import { TruliooPersonInquiryManager } from "../truliooPersonInquiryManager";
import { TruliooBase } from "../../common/truliooBase";
import { TruliooPSCFormData, TruliooUBOPersonData } from "../../common/types";
import { ITruliooPersonDataStorage, ITruliooPersonVerificationProcessor } from "../types";
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

jest.mock("#helpers/knex", () => ({
	db: jest.fn(() => ({
		insert: jest.fn().mockReturnThis(),
		onConflict: jest.fn().mockReturnThis(),
		ignore: jest.fn().mockReturnThis(),
		merge: jest.fn().mockReturnThis(),
		returning: jest.fn().mockResolvedValue([{ id: "mock-id" }]),
		where: jest.fn().mockReturnThis(),
		first: jest.fn().mockResolvedValue(null),
		update: jest.fn().mockReturnThis(),
		catch: jest.fn().mockResolvedValue(null)
	}))
}));

jest.mock("../../common/truliooBase");

jest.mock("#constants", () => ({
	INTEGRATION_ID: {
		TRULIOO: 38
	},
	INTEGRATION_STATUS: {
		INITIATED: "initiated",
		COMPLETED: "completed"
	},
	ERROR_CODES: {
		INVALID: "INVALID",
		UNKNOWN_ERROR: "UNKNOWN_ERROR"
	}
}));

describe("TruliooPersonInquiryManager", () => {
	let manager: TruliooPersonInquiryManager;
	let mockTruliooBase: jest.Mocked<TruliooBase>;
	let mockDataStorage: jest.Mocked<ITruliooPersonDataStorage>;
	let mockVerificationProcessor: jest.Mocked<ITruliooPersonVerificationProcessor>;

	beforeEach(() => {
		jest.clearAllMocks();

		mockTruliooBase = {
			businessID: "test-business-123",
			getBusinessId: jest.fn().mockReturnValue("test-business-123")
		} as any;

		mockDataStorage = {
			storePersonInBusinessEntityPeople: jest.fn().mockResolvedValue(undefined)
		};

		mockVerificationProcessor = {
			processPersonVerification: jest.fn().mockResolvedValue({
				inquiryId: "test-inquiry-123",
				status: "completed",
				results: {
					watchlistHits: [],
					screeningStatus: "COMPLETED"
				}
			})
		};

		manager = new TruliooPersonInquiryManager(
			mockTruliooBase,
			"test-business-123",
			mockDataStorage,
			mockVerificationProcessor
		);
	});

	describe("createPersonInquiry", () => {
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

		const mockBusinessData: TruliooPSCFormData = {
			companyName: "Test Company Ltd",
			companyCountryIncorporation: "GB",
			companyregno: "12345678",
			companyStateAddress: "London",
			companyCity: "London",
			companyZip: "SW1A 1AA"
		};

		const mockBusinessEntityVerificationId = "test-business-verification-123";

		it("should create new person inquiry when no existing verification found", async () => {
			// Mock no existing verification; chain needs .catch() for data_integrations insert
			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(null),
				insert: jest.fn().mockReturnThis(),
				onConflict: jest.fn().mockReturnThis(),
				ignore: jest.fn().mockReturnThis(),
				returning: jest.fn().mockResolvedValue([{ id: "new-inquiry-id" }]),
				catch: jest.fn().mockResolvedValue(null)
			}));

			const result = await manager.createPersonInquiry(
				mockPersonData,
				mockBusinessData,
				mockBusinessEntityVerificationId
			);

			expect(result).toEqual({
				data: {
					inquiry_id: "test-inquiry-123",
					inquiry_status: "completed",
					person_data: mockPersonData,
					business_data: mockBusinessData,
					verification_type: "PSC",
					business_entity_verification_id: mockBusinessEntityVerificationId,
					is_trulioo_verified: false
				},
				message: "Trulioo person verification process has been started."
			});

			// Verify verification processor was called
			expect(mockVerificationProcessor.processPersonVerification).toHaveBeenCalledWith(
				mockPersonData,
				mockBusinessData,
				undefined,
				mockBusinessEntityVerificationId
			);
		});

		it("should return existing verification when person already verified", async () => {
			// Mock existing verification with completed status
			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({
					id: "existing-person-id",
					metadata: JSON.stringify({
						screeningResults: {
							status: "COMPLETED"
						}
					})
				})
			}));

			const result = await manager.createPersonInquiry(
				mockPersonData,
				mockBusinessData,
				mockBusinessEntityVerificationId
			);

			expect(result).toEqual({
				data: {
					is_trulioo_verified: true,
					personId: "existing-person-id"
				},
				message: "A connected Trulioo verification has been located."
			});

			// Should not call verification processor for existing completed verification
			expect(mockVerificationProcessor.processPersonVerification).not.toHaveBeenCalled();
		});

		it("should return pending status when verification is in progress", async () => {
			// Mock existing verification with pending status
			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({
					id: "existing-person-id",
					metadata: JSON.stringify({
						screeningResults: {
							status: "PENDING",
							metadata: {
								hfSession: "pending-session-123"
							}
						}
					})
				})
			}));

			const result = await manager.createPersonInquiry(
				mockPersonData,
				mockBusinessData,
				mockBusinessEntityVerificationId
			);

			expect(result).toEqual({
				data: {
					inquiry_id: "pending-session-123",
					trulioo_status: "pending",
					personId: "existing-person-id"
				},
				message: "Verification pending"
			});
		});

		it("should handle invalid metadata gracefully", async () => {
			// Mock existing verification with invalid metadata; chain needs .catch() for data_integrations insert
			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue({
					id: "existing-person-id",
					metadata: "invalid-json"
				}),
				insert: jest.fn().mockReturnThis(),
				onConflict: jest.fn().mockReturnThis(),
				ignore: jest.fn().mockReturnThis(),
				returning: jest.fn().mockResolvedValue([{ id: "new-inquiry-id" }]),
				catch: jest.fn().mockResolvedValue(null)
			}));

			const result = await manager.createPersonInquiry(
				mockPersonData,
				mockBusinessData,
				mockBusinessEntityVerificationId
			);

			// Should create new inquiry when metadata is invalid
			expect(result.data.is_trulioo_verified).toBe(false);
			expect(logger.warn).toHaveBeenCalledWith(
				"Invalid metadata format for person record existing-person-id, using empty object"
			);
		});

		it("should store person data in both tables when businessEntityVerificationId is provided", async () => {
			// Mock no existing verification; chain needs .catch() for data_integrations insert
			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(null),
				insert: jest.fn().mockReturnThis(),
				onConflict: jest.fn().mockReturnThis(),
				ignore: jest.fn().mockReturnThis(),
				returning: jest.fn().mockResolvedValue([{ id: "new-inquiry-id" }]),
				catch: jest.fn().mockResolvedValue(null)
			}));

			await manager.createPersonInquiry(mockPersonData, mockBusinessData, mockBusinessEntityVerificationId);

			// Verify both storage operations were called
			expect(mockDataStorage.storePersonInBusinessEntityPeople).toHaveBeenCalledWith(
				mockPersonData,
				mockBusinessEntityVerificationId,
				expect.objectContaining({
					inquiryId: "test-inquiry-123",
					status: "completed"
				})
			);
		});

		it("should handle database errors during inquiry creation", async () => {
			// Mock database error
			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockRejectedValue(new Error("Database connection failed"))
			}));

			await expect(
				manager.createPersonInquiry(mockPersonData, mockBusinessData, mockBusinessEntityVerificationId)
			).rejects.toThrow("Database connection failed");

			expect(logger.error).toHaveBeenCalledWith(expect.any(Error), "Error creating person verification inquiry:");
		});

		it("should succeed when data_integrations insert fails (legacy table missing) and still store in business_entity_people", async () => {
			// data_integrations insert rejects; .catch() swallows it; Promise.allSettled allows business_entity_people to succeed
			(db as unknown as jest.Mock).mockImplementation((table: string) => {
				const chain = {
					select: jest.fn().mockReturnThis(),
					where: jest.fn().mockReturnThis(),
					first: jest.fn().mockResolvedValue(null),
					insert: jest.fn().mockReturnThis(),
					onConflict: jest.fn().mockReturnThis(),
					ignore: jest.fn().mockReturnThis(),
					returning: jest.fn().mockResolvedValue([{ id: "new-inquiry-id" }]),
					catch: jest.fn().mockImplementation((fn: (err: Error) => unknown) => {
						// Simulate legacy table error being caught
						return Promise.resolve(fn(new Error("relation \"data_integrations\" does not exist")));
					})
				};
				// When querying data_integrations we get the chain with catch; when querying business_entity_people we get chain without catch needed for select/first
				return chain;
			});

			const result = await manager.createPersonInquiry(
				mockPersonData,
				mockBusinessData,
				mockBusinessEntityVerificationId
			);

			expect(result.message).toBe("Trulioo person verification process has been started.");
			expect(mockDataStorage.storePersonInBusinessEntityPeople).toHaveBeenCalled();
			expect(logger.debug).toHaveBeenCalledWith(
				expect.stringContaining("data_integrations table not available (legacy table)")
			);
		});
	});

	describe("getPersonVerificationDetails", () => {
		it("should return verification details for existing person", async () => {
			const mockPersonData = {
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

			const mockBusinessData = {
				companyName: "Test Company Ltd",
				companyregno: "12345678",
				companyCity: "London",
				companyStateAddress: "London",
				companyZip: "SW1A 1AA",
				companyCountryIncorporation: "GB"
			};

			const mockVerificationData = {
				id: "person-123",
				data: {
					inquiry_id: "inquiry-123",
					inquiry_status: "completed",
					person_data: mockPersonData,
					business_data: mockBusinessData,
					verification_results: { status: "completed" }
				}
			};

			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockVerificationData)
			}));

			const result = await manager.getPersonVerificationDetails();

			expect(result).toEqual({
				data: {
					inquiry_id: "inquiry-123",
					trulioo_status: "completed",
					person_data: mockPersonData,
					business_data: mockBusinessData,
					verification_results: { status: "completed" }
				},
				message: "Verification completed"
			});
		});

		it("should return not found when person verification does not exist", async () => {
			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(null)
			}));

			await expect(manager.getPersonVerificationDetails()).rejects.toThrow("No Trulioo verification found");
		});
	});

	describe("completePersonInquiry", () => {
		it("should update existing verification with completion data", async () => {
			const mockExistingData = {
				id: "person-123",
				data: {
					inquiry_status: "pending",
					inquiry_id: "inquiry-123"
				}
			};

			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(mockExistingData),
				update: jest.fn().mockReturnThis()
			}));

			await manager.completePersonInquiry();

			// Verify the update was called
			expect(db).toHaveBeenCalled();
		});

		it("should handle missing existing verification gracefully", async () => {
			(db as unknown as jest.Mock).mockImplementation(() => ({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				first: jest.fn().mockResolvedValue(null)
			}));

			await expect(manager.completePersonInquiry()).rejects.toThrow("No verification found");
		});
	});
});
