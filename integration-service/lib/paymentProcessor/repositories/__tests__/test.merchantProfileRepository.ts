// Mock the database connection FIRST before any imports
jest.mock("#helpers/knex", () => ({
	db: Object.assign(
		jest.fn(() => ({})),
		{ raw: jest.fn((sql: string) => sql) }
	)
}));

// Mock logger
jest.mock("#helpers", () => ({
	...jest.requireActual("#helpers"),
	logger: {
		error: jest.fn()
	}
}));

import { MerchantProfileRepository } from "../merchantProfileRepository";
import { MerchantProfile } from "#lib/paymentProcessor/merchantProfile";
import { generateMerchantProfiles } from "#lib/paymentProcessor/__tests__/test.utils";
import { INTEGRATION_ID } from "#constants";
import { db } from "#helpers/knex";
import { randomUUID } from "crypto";

describe("MerchantProfileRepository", () => {
	let repository: MerchantProfileRepository;
	let mockConnection: any;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock connection with chainable methods
		mockConnection = {
			insert: jest.fn().mockReturnThis(),
			onConflict: jest.fn().mockReturnThis(),
			merge: jest.fn().mockReturnThis(),
			returning: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			whereIn: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			first: jest.fn().mockReturnThis()
		};

		(db as unknown as jest.Mock).mockReturnValue(mockConnection);

		repository = new MerchantProfileRepository();
	});

	describe("constructor", () => {
		it("should initialize with database connection", () => {
			expect(repository).toBeInstanceOf(MerchantProfileRepository);
		});
	});

	describe("save", () => {
		it("should save multiple merchant profiles successfully", async () => {
			const merchantProfiles = generateMerchantProfiles(2, INTEGRATION_ID.STRIPE, false, false);
			const mockDbRecords = merchantProfiles.map((profile, idx) => ({
				...profile.toDbRecord(),
				id: idx + 1,
				created_at: new Date(),
				updated_at: new Date()
			}));

			mockConnection.returning.mockResolvedValue(mockDbRecords);

			const result = await repository.save(merchantProfiles);

			expect(mockConnection.insert).toHaveBeenCalledWith(merchantProfiles.map(p => p.toDbRecord()));
			expect(mockConnection.onConflict).toHaveBeenCalledWith(["business_id", "platform_id"]);
			expect(mockConnection.merge).toHaveBeenCalled();
			expect(mockConnection.returning).toHaveBeenCalledWith("*");
			expect(result).toHaveLength(2);
			expect(result[0]).toBeInstanceOf(MerchantProfile);
			expect(result[1]).toBeInstanceOf(MerchantProfile);
		});

		it("should return empty array when given empty array", async () => {
			const result = await repository.save([]);

			expect(mockConnection.insert).not.toHaveBeenCalled();
			expect(result).toEqual([]);
		});

		it("should handle database errors and return empty array", async () => {
			const merchantProfiles = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, false, false);
			const error = new Error("Database connection failed");

			mockConnection.returning.mockRejectedValue(error);

			const result = await repository.save(merchantProfiles);

			expect(result).toEqual([]);
		});

		it("should handle insert with conflict (upsert behavior)", async () => {
			const existingProfile = generateMerchantProfiles(1, INTEGRATION_ID.STRIPE, true, true)[0];
			const updatedProfile = new MerchantProfile(
				existingProfile.customerId,
				existingProfile.businessId,
				existingProfile.platformId!,
				{
					...existingProfile.profile,
					business_name: "Updated Business Name"
				},
				existingProfile.profileId
			);

			const mockDbRecord = {
				id: existingProfile.profileId,
				customer_id: updatedProfile.customerId,
				business_id: updatedProfile.businessId,
				platform_id: updatedProfile.platformId,
				profile: updatedProfile.profile,
				created_at: existingProfile.createdAt,
				updated_at: new Date()
			};

			mockConnection.returning.mockResolvedValue([mockDbRecord]);

			const result = await repository.save([updatedProfile]);

			expect(mockConnection.insert).toHaveBeenCalled();
			expect(mockConnection.onConflict).toHaveBeenCalledWith(["business_id", "platform_id"]);
			expect(mockConnection.merge).toHaveBeenCalled();
			expect(result).toHaveLength(1);
			expect(result[0]).toBeInstanceOf(MerchantProfile);
			expect(result[0].profile.business_name).toBe("Updated Business Name");
		});
	});

	describe("get", () => {
		it("should find a single merchant profile by business ID and platform ID", async () => {
			const businessId = randomUUID();
			const platformId = INTEGRATION_ID.STRIPE;
			const mockDbRecord = {
				id: 1,
				customer_id: randomUUID(),
				business_id: businessId,
				platform_id: platformId,
				profile: {
					business_name: "Test Business",
					address_line_1: "123 Test St",
					address_city: "Test City",
					address_state: "TS",
					address_postal_code: "12345",
					country: "US",
					tin: null,
					mcc_code: null,
					business_phone: null,
					business_website: null,
					people: { owners: [] },
					banking_info: null
				},
				created_at: new Date(),
				updated_at: new Date()
			};

			mockConnection.first.mockResolvedValue(mockDbRecord);

			const result = await repository.get(businessId, platformId);

			expect(mockConnection.where).toHaveBeenCalledWith({
				"payment_processor_merchant_profiles.business_id": businessId,
				"payment_processor_merchant_profiles.platform_id": platformId
			});
			expect(mockConnection.first).toHaveBeenCalled();
			expect(result).toBeInstanceOf(MerchantProfile);
			expect((result as MerchantProfile).businessId).toBe(businessId);
		});
		it("should return null when no profile found for single business ID", async () => {
			const businessId = randomUUID();
			const platformId = INTEGRATION_ID.STRIPE;

			mockConnection.first.mockResolvedValue(undefined);

			const result = await repository.get(businessId, platformId);

			expect(result).toBeNull();
		});
	});
	describe("findByBusinessId", () => {
		it("should find multiple merchant profiles by array of business IDs", async () => {
			const businessIds = [randomUUID(), randomUUID()];
			const platformId = INTEGRATION_ID.STRIPE;
			const mockDbRecords = businessIds.map((id, idx) => ({
				id: idx + 1,
				customer_id: randomUUID(),
				business_id: id,
				platform_id: platformId,
				profile: {
					business_name: `Test Business ${idx}`,
					address_line_1: "123 Test St",
					address_city: "Test City",
					address_state: "TS",
					address_postal_code: "12345",
					country: "US",
					tin: null,
					mcc_code: null,
					business_phone: null,
					business_website: null,
					people: { owners: [] },
					banking_info: null
				},
				created_at: new Date(),
				updated_at: new Date()
			}));

			mockConnection.andWhere.mockResolvedValue(mockDbRecords);

			const result = await repository.findByBusinessId(businessIds, platformId);

			expect(mockConnection.whereIn).toHaveBeenCalledWith("business_id", businessIds);
			expect(mockConnection.andWhere).toHaveBeenCalledWith({ platform_id: platformId });
			expect(Array.isArray(result)).toBe(true);
			expect((result as MerchantProfile[]).length).toBe(2);
			expect((result as MerchantProfile[])[0]).toBeInstanceOf(MerchantProfile);
			expect((result as MerchantProfile[])[1]).toBeInstanceOf(MerchantProfile);
		});

		it("should return empty array when no profiles found for multiple business IDs", async () => {
			const businessIds = [randomUUID(), randomUUID()];
			const platformId = INTEGRATION_ID.STRIPE;

			mockConnection.andWhere.mockResolvedValue([]);

			const result = await repository.findByBusinessId(businessIds, platformId);

			expect(Array.isArray(result)).toBe(true);
			expect((result as MerchantProfile[]).length).toBe(0);
		});
	});

	describe("findByCustomerId", () => {
		it("should find all merchant profiles by customer ID", async () => {
			const customerId = randomUUID();
			const mockDbRecords = [
				{
					id: 1,
					customer_id: customerId,
					business_id: randomUUID(),
					platform_id: INTEGRATION_ID.STRIPE,
					profile: {
						business_name: "Test Business 1",
						address_line_1: "123 Test St",
						address_city: "Test City",
						address_state: "TS",
						address_postal_code: "12345",
						country: "US",
						tin: null,
						mcc_code: null,
						business_phone: null,
						business_website: null,
						people: { owners: [] },
						banking_info: null
					},
					created_at: new Date(),
					updated_at: new Date()
				},
				{
					id: 2,
					customer_id: customerId,
					business_id: randomUUID(),
					platform_id: INTEGRATION_ID.STRIPE,
					profile: {
						business_name: "Test Business 2",
						address_line_1: "456 Test Ave",
						address_city: "Test City",
						address_state: "TS",
						address_postal_code: "12345",
						country: "US",
						tin: null,
						mcc_code: null,
						business_phone: null,
						business_website: null,
						people: { owners: [] },
						banking_info: null
					},
					created_at: new Date(),
					updated_at: new Date()
				}
			];

			mockConnection.where.mockResolvedValue(mockDbRecords);

			const result = await repository.findByCustomerId(customerId);

			expect(mockConnection.where).toHaveBeenCalledWith({ customer_id: customerId });
			expect(result).toHaveLength(2);
			expect(result[0]).toBeInstanceOf(MerchantProfile);
			expect(result[1]).toBeInstanceOf(MerchantProfile);
			expect(result[0].customerId).toBe(customerId);
			expect(result[1].customerId).toBe(customerId);
		});

		it("should return empty array when no profiles found for customer ID", async () => {
			const customerId = randomUUID();

			mockConnection.where.mockResolvedValue([]);

			const result = await repository.findByCustomerId(customerId);

			expect(result).toEqual([]);
		});
	});

	describe("findByAccountId", () => {
		it("should find a merchant profile by account ID", async () => {
			const accountId = "acct_test123";
			const mockDbRecord = {
				id: 1,
				customer_id: randomUUID(),
				business_id: randomUUID(),
				platform_id: INTEGRATION_ID.STRIPE,
				account_id: accountId,
				profile: {
					business_name: "Test Business",
					address_line_1: "123 Test St",
					address_city: "Test City",
					address_state: "TS",
					address_postal_code: "12345",
					country: "US",
					tin: null,
					mcc_code: null,
					business_phone: null,
					business_website: null,
					people: { owners: [] },
					banking_info: null
				},
				created_at: new Date(),
				updated_at: new Date()
			};

			mockConnection.first.mockResolvedValue(mockDbRecord);

			const result = await repository.findByAccountId(accountId);

			expect(mockConnection.where).toHaveBeenCalledWith({ account_id: accountId });
			expect(mockConnection.first).toHaveBeenCalled();
			expect(result).toBeInstanceOf(MerchantProfile);
		});

		it("should return null when no profile found for account ID", async () => {
			const accountId = "acct_nonexistent";

			mockConnection.first.mockResolvedValue(undefined);

			const result = await repository.findByAccountId(accountId);

			expect(result).toBeNull();
		});
	});
});
