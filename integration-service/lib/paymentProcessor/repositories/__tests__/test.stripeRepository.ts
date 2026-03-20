// Mock the database connection FIRST before any imports
jest.mock("#helpers/knex", () => ({
	db: Object.assign(
		jest.fn(() => ({})),
		{ raw: jest.fn((sql: string) => sql) }
	)
}));

import { PaymentProcessorAccountRepository, type PaymentProcessorAccount } from "../paymentProcessorAccountRepository";
import { INTEGRATION_ID } from "#constants";
import { db } from "#helpers/knex";
import { randomUUID } from "crypto";
import * as StripeTypes from "#lib/paymentProcessor/types/stripe";
import type Stripe from "stripe";
import { PaymentProcessorAccountStatus } from "#lib/paymentProcessor/paymentProcessorAccount.constants";

const buildStripeAccount = (overrides: Partial<Stripe.Account> = {}): Stripe.Account => {
	return {
		id: overrides.id ?? `acct_${randomUUID()}`,
		object: "account",
		charges_enabled: overrides.charges_enabled ?? true,
		payouts_enabled: overrides.payouts_enabled ?? true,
		requirements: {
			currently_due: [],
			eventually_due: [],
			past_due: [],
			pending_verification: [],
			errors: [],
			...overrides.requirements
		},
		future_requirements: {
			currently_due: [],
			eventually_due: [],
			past_due: [],
			pending_verification: [],
			errors: [],
			...overrides.future_requirements
		}
	} as Stripe.Account;
};

describe("StripeRepository", () => {
	const processorId = "00000000-0000-0000-2222-000000000000";
	let repository: PaymentProcessorAccountRepository;
	let mockConnection: any;

	beforeEach(() => {
		jest.clearAllMocks();

	// Setup mock connection with chainable methods
		mockConnection = {
			insert: jest.fn().mockReturnThis(),
			onConflict: jest.fn().mockReturnThis(),
			merge: jest.fn().mockReturnThis(),
			returning: jest.fn().mockResolvedValue([]),
			where: jest.fn().mockReturnThis(),
			first: jest.fn().mockReturnThis(),
			update: jest.fn().mockReturnThis()
		};

		(db as unknown as jest.Mock).mockReturnValue(mockConnection);

		repository = new PaymentProcessorAccountRepository();
	});

	describe("PLATFORM_ID", () => {
		it("should have correct platform ID constant", () => {
			expect(PaymentProcessorAccountRepository.PLATFORM_ID).toBe(INTEGRATION_ID.STRIPE);
		});
	});

	describe("saveAccountInfo", () => {
		it("should save multiple account infos successfully", async () => {
			const accountInfos: StripeTypes.AccountInfo[] = [
				{
					profileId: randomUUID(),
					customerId: randomUUID(),
					businessId: randomUUID(),
					platformId: PaymentProcessorAccountRepository.PLATFORM_ID,
					accountId: "acct_test123",
					data: {
						id: "acct_test123",
						business_type: "company",
						charges_enabled: true,
						payouts_enabled: true
					} as any
				},
				{
					profileId: randomUUID(),
					customerId: randomUUID(),
					businessId: randomUUID(),
					platformId: PaymentProcessorAccountRepository.PLATFORM_ID,
					accountId: "acct_test456",
					data: {
						id: "acct_test456",
						business_type: "company",
						charges_enabled: false,
						payouts_enabled: false
					} as any,
					status: PaymentProcessorAccountStatus.UNKNOWN
				}
			];
			mockConnection.returning.mockResolvedValue([]);

			const result = await repository.saveAccountInfo(processorId, accountInfos);

			expect(mockConnection.insert).toHaveBeenCalledWith(
				accountInfos.map(info => ({
					processor_id: processorId,
					profile_id: info.profileId,
					customer_id: info.customerId,
					business_id: info.businessId,
					platform_id: PaymentProcessorAccountRepository.PLATFORM_ID,
					account_id: info.accountId,
					account: info.data,
					status: info.status ?? PaymentProcessorAccountStatus.UNKNOWN
				}))
			);
			expect(mockConnection.onConflict).toHaveBeenCalledWith(["platform_id", "profile_id", "account_id"]);
			expect(mockConnection.merge).toHaveBeenCalled();
			expect(Array.isArray(result)).toBe(true);
		});

		it("should return empty array when given empty array", async () => {
			const result = await repository.saveAccountInfo(processorId, []);

			expect(mockConnection.insert).not.toHaveBeenCalled();
			expect(result).toEqual([]);
		});

		it("should handle database errors and return empty array", async () => {
			const accountInfos: StripeTypes.AccountInfo[] = [
				{
					profileId: randomUUID(),
					customerId: randomUUID(),
					businessId: randomUUID(),
					platformId: PaymentProcessorAccountRepository.PLATFORM_ID,
					accountId: "acct_test123",
					data: {
						id: "acct_test123",
						business_type: "company",
						charges_enabled: true,
						payouts_enabled: true
					} as any
				}
			];
			mockConnection.returning.mockRejectedValue(new Error("Database connection failed"));

			const result = await repository.saveAccountInfo(processorId, accountInfos);

			expect(result).toEqual([]);
		});

		it("should handle insert with conflict (upsert behavior)", async () => {
			const accountInfo: StripeTypes.AccountInfo = {
				profileId: randomUUID(),
				customerId: randomUUID(),
				businessId: randomUUID(),
				platformId: PaymentProcessorAccountRepository.PLATFORM_ID,
				accountId: "acct_existing",
				data: {
					id: "acct_existing",
					business_type: "company",
					charges_enabled: true,
					payouts_enabled: true
				} as any
			};
			mockConnection.returning.mockResolvedValue([]);

			const result = await repository.saveAccountInfo(processorId, [accountInfo]);

			expect(mockConnection.insert).toHaveBeenCalled();
			expect(mockConnection.onConflict).toHaveBeenCalledWith(["platform_id", "profile_id", "account_id"]);
			expect(mockConnection.merge).toHaveBeenCalled();
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe("findByAccountId", () => {
		it("should find account info by account ID", async () => {
			const accountId = "acct_test123";
			const mockRecord: Partial<PaymentProcessorAccount> = {
				profile_id: randomUUID(),
				customer_id: randomUUID(),
				business_id: randomUUID(),
				platform_id: PaymentProcessorAccountRepository.PLATFORM_ID,
				account_id: accountId,
				account: {
					id: accountId,
					business_type: "company",
					charges_enabled: true,
					payouts_enabled: true
				} as any
			};
			mockConnection.first.mockResolvedValue(mockRecord);

			const result = await repository.findByAccountId(accountId);

			expect(mockConnection.where).toHaveBeenCalledWith({
				account_id: accountId,
				platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
			});
			expect(mockConnection.first).toHaveBeenCalled();
			expect(result).toEqual(mockRecord);
			expect(result?.account_id).toBe(accountId);
		});

		it("should return null when no account info found", async () => {
			const accountId = "acct_nonexistent";

			mockConnection.first.mockResolvedValue(undefined);

			const result = await repository.findByAccountId(accountId);

			expect(mockConnection.where).toHaveBeenCalledWith({
				account_id: accountId,
				platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
			});
			expect(result).toBeNull();
		});

		it("should filter by platform ID correctly", async () => {
			const accountId = "acct_test123";

			mockConnection.first.mockResolvedValue(null);

			await repository.findByAccountId(accountId);

			expect(mockConnection.where).toHaveBeenCalledWith({
				account_id: accountId,
				platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
			});
		});
	});

	describe("findByProfileId", () => {
		it("should find all account infos by profile ID", async () => {
			const profileId = randomUUID();
			const mockRecords: Partial<PaymentProcessorAccount>[] = [
				{
					profile_id: profileId,
					customer_id: randomUUID(),
					business_id: randomUUID(),
					platform_id: PaymentProcessorAccountRepository.PLATFORM_ID,
					account_id: "acct_test123",
					account: {
						id: "acct_test123",
						business_type: "company",
						charges_enabled: true,
						payouts_enabled: true
					} as any
				},
				{
					profile_id: profileId,
					customer_id: randomUUID(),
					business_id: randomUUID(),
					platform_id: PaymentProcessorAccountRepository.PLATFORM_ID,
					account_id: "acct_test321",
					account: {
						id: "acct_test321",
						business_type: "company",
						charges_enabled: true,
						payouts_enabled: true
					} as any
				}
			];
			mockConnection.where.mockResolvedValue(mockRecords);

			const result = await repository.findByProfileId(profileId);

			expect(mockConnection.where).toHaveBeenCalledWith({
				profile_id: profileId,
				platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
			});
			expect(result).toEqual(mockRecords);
			expect(result).toHaveLength(2);
			expect(result[0].profile_id).toBe(profileId);
			expect(result[1].profile_id).toBe(profileId);
		});

		it("should return empty array when no account infos found", async () => {
			const profileId = randomUUID();

			mockConnection.where.mockResolvedValue([]);

			const result = await repository.findByProfileId(profileId);

			expect(result).toEqual([]);
		});

		it("should filter by platform ID correctly", async () => {
			const profileId = randomUUID();

			mockConnection.where.mockResolvedValue([]);

			await repository.findByProfileId(profileId);

			expect(mockConnection.where).toHaveBeenCalledWith({
				profile_id: profileId,
				platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
			});
		});
	});

	describe("findByCustomerId", () => {
		it("should find all account infos by customer ID", async () => {
			const customerId = randomUUID();
			const mockRecords: Partial<PaymentProcessorAccount>[] = [
				{
					profile_id: randomUUID(),
					customer_id: customerId,
					business_id: randomUUID(),
					platform_id: PaymentProcessorAccountRepository.PLATFORM_ID,
					account_id: "acct_test123",
					account: {
						id: "acct_test123",
						business_type: "company",
						charges_enabled: true,
						payouts_enabled: true
					} as any
				},
				{
					profile_id: randomUUID(),
					customer_id: customerId,
					business_id: randomUUID(),
					platform_id: PaymentProcessorAccountRepository.PLATFORM_ID,
					account_id: "acct_test456",
					account: {
						id: "acct_test456",
						business_type: "individual",
						charges_enabled: true,
						payouts_enabled: true
					} as any
				}
			];
			mockConnection.where.mockResolvedValue(mockRecords);

			const result = await repository.findByCustomerId(customerId);

			expect(mockConnection.where).toHaveBeenCalledWith({
				customer_id: customerId,
				platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
			});
			expect(result).toEqual(mockRecords);
			expect(result).toHaveLength(2);
			expect(result[0].customer_id).toBe(customerId);
			expect(result[1].customer_id).toBe(customerId);
		});

		it("should return empty array when no account infos found", async () => {
			const customerId = randomUUID();

			mockConnection.where.mockResolvedValue([]);

			const result = await repository.findByCustomerId(customerId);

			expect(result).toEqual([]);
		});

		it("should filter by platform ID correctly", async () => {
			const customerId = randomUUID();

			mockConnection.where.mockResolvedValue([]);

			await repository.findByCustomerId(customerId);

			expect(mockConnection.where).toHaveBeenCalledWith({
				customer_id: customerId,
				platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
			});
		});
	});

	describe("updateAccountSnapshot", () => {
		it("updates account payload, status, and manual sync timestamp for manual source", async () => {
			mockConnection.update.mockResolvedValue(1);
			const accountRecordId = randomUUID();

			const result = await repository.updateAccountSnapshot(accountRecordId, {
				account: buildStripeAccount({ payouts_enabled: false }),
				status: PaymentProcessorAccountStatus.RESTRICTED
			});

			expect(mockConnection.where).toHaveBeenCalledWith({
				id: accountRecordId
			});
			expect(mockConnection.update).toHaveBeenCalledWith(
				expect.objectContaining({
					account: expect.any(Object),
					status: PaymentProcessorAccountStatus.RESTRICTED,
					manual_sync_at: expect.any(String),
					updated_at: expect.any(String)
				})
			);
		});

		it("updates webhook timestamp when source is webhook", async () => {
			mockConnection.update.mockResolvedValue(1);

			const accountRecordId = randomUUID();
			const result = await repository.updateAccountSnapshot(
				accountRecordId,
				{
					account: buildStripeAccount(),
					status: PaymentProcessorAccountStatus.ACTIVE
				},
				"webhook"
			);
			expect(mockConnection.update).toHaveBeenCalledWith(
				expect.objectContaining({
					account: expect.any(Object),
					status: PaymentProcessorAccountStatus.ACTIVE,
					webhook_received_at: expect.any(String),
					updated_at: expect.any(String)
				})
			);
		});
	});
});
