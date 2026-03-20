import { randomUUID } from "crypto";
import { PaymentProcessorOnboardTracker } from "../paymentProcessorOnboardTracker";
import type * as MerchantProfileTypes from "../types/merchantProfile";
import * as PaymentProcessorAccountTypes from "@joinworth/types/dist/types/integration/paymentProcessors/paymentProcessorAccount";

describe("PaymentProcessorOnboardTracker", () => {
	let tracker: PaymentProcessorOnboardTracker;

	beforeEach(() => {
		tracker = new PaymentProcessorOnboardTracker();
	});

	describe("Constructor", () => {
		it("should initialize with an empty tracker array", () => {
			expect(tracker.tracker).toEqual([]);
			expect(tracker.length()).toBe(0);
		});
	});

	describe("extendNoMerchantProfileFound", () => {
		it("should add entries for business IDs with no merchant profile found", () => {
			const businessIds = [randomUUID(), randomUUID(), randomUUID()];

			tracker.extendNoMerchantProfileFound(businessIds);

			expect(tracker.length()).toBe(3);
			expect(tracker.failures().length).toBe(3);

			tracker.tracker.forEach((entry, index) => {
				expect(entry.business_id).toBe(businessIds[index]);
				expect(entry.failure_reason).toBe("No merchant profile found");
			});
		});

		it("should return the tracker instance for chaining", () => {
			const businessIds = [randomUUID()];
			const result = tracker.extendNoMerchantProfileFound(businessIds);

			expect(result).toBe(tracker);
		});

		it("should handle empty business ID array", () => {
			tracker.extendNoMerchantProfileFound([]);

			expect(tracker.length()).toBe(0);
		});
	});

	describe("extendNotReadyForOnboard", () => {
		it("should add entries for profiles not ready to onboard", () => {
			const profileContexts: MerchantProfileTypes.ProfilesNotReadyToOnboard = [
				{
					profile: {
						profileId: randomUUID(),
						businessId: randomUUID()
					},
					reason: "Missing required data"
				},
				{
					profile: {
						profileId: randomUUID(),
						businessId: randomUUID()
					},
					reason: "Pending verification"
				}
			] as any;

			tracker.extendNotReadyForOnboard(profileContexts);

			expect(tracker.length()).toBe(2);
			expect(tracker.failures().length).toBe(2);

			tracker.tracker.forEach((entry, index) => {
				expect(entry.profile_id).toBe(profileContexts[index].profile.profileId);
				expect(entry.business_id).toBe(profileContexts[index].profile.businessId);
				expect(entry.failure_reason).toBe(profileContexts[index].reason);
			});
		});

		it("should return the tracker instance for chaining", () => {
			const profileContexts: MerchantProfileTypes.ProfilesNotReadyToOnboard = [
				{
					profile: {
						profileId: randomUUID(),
						businessId: randomUUID()
					},
					reason: "Test reason"
				}
			] as any;

			const result = tracker.extendNotReadyForOnboard(profileContexts);

			expect(result).toBe(tracker);
		});

		it("should handle empty profile contexts array", () => {
			tracker.extendNotReadyForOnboard([]);

			expect(tracker.length()).toBe(0);
		});
	});

	describe("extendOnboardOutcomes", () => {
		it("should add both failed and successful onboard outcomes", () => {
			const failedBusinessIds = [randomUUID(), randomUUID()];
			const successfulAccounts: PaymentProcessorAccountTypes.PaymentProcessorAccount[] = [
				{
					id: randomUUID(),
					business_id: randomUUID(),
					profile_id: randomUUID()
				} as any,
				{
					id: randomUUID(),
					business_id: randomUUID(),
					profile_id: randomUUID()
				} as any
			];

			tracker.extendOnboardOutcomes(failedBusinessIds, successfulAccounts);

			expect(tracker.length()).toBe(4);
			expect(tracker.failures().length).toBe(2);
			expect(tracker.successes().length).toBe(2);
		});

		it("should add failure entries with correct failure reason", () => {
			const failedBusinessIds = [randomUUID()];

			tracker.extendOnboardOutcomes(failedBusinessIds, []);

			const failures = tracker.failures();
			expect(failures[0].business_id).toBe(failedBusinessIds[0]);
			expect(failures[0].failure_reason).toBe("Onboard failed");
		});

		it("should add success entries with account, business, and profile IDs", () => {
			const successfulAccounts: PaymentProcessorAccountTypes.PaymentProcessorAccount[] = [
				{
					id: randomUUID(),
					business_id: randomUUID(),
					profile_id: randomUUID()
				} as any
			];

			tracker.extendOnboardOutcomes([], successfulAccounts);

			const successes = tracker.successes();
			expect(successes[0].account_id).toBe(successfulAccounts[0].id);
			expect(successes[0].business_id).toBe(successfulAccounts[0].business_id);
			expect(successes[0].profile_id).toBe(successfulAccounts[0].profile_id);
			expect(successes[0].failure_reason).toBeUndefined();
		});

		it("should return the tracker instance for chaining", () => {
			const result = tracker.extendOnboardOutcomes([], []);

			expect(result).toBe(tracker);
		});

		it("should handle empty arrays", () => {
			tracker.extendOnboardOutcomes([], []);

			expect(tracker.length()).toBe(0);
		});
	});

	describe("push", () => {
		it("should add an entry with all parameters", () => {
			const accountId = randomUUID();
			const businessId = randomUUID();
			const profileId = randomUUID();
			const failureReason = "Custom failure";

			tracker.push(accountId, businessId, profileId, failureReason as any);

			expect(tracker.length()).toBe(1);
			expect(tracker.tracker[0].account_id).toBe(accountId);
			expect(tracker.tracker[0].business_id).toBe(businessId);
			expect(tracker.tracker[0].profile_id).toBe(profileId);
			expect(tracker.tracker[0].failure_reason).toBe(failureReason);
		});

		it("should add an entry with only some parameters", () => {
			const businessId = randomUUID();

			tracker.push(undefined, businessId, undefined, "Error message" as any);

			expect(tracker.length()).toBe(1);
			expect(tracker.tracker[0].account_id).toBeUndefined();
			expect(tracker.tracker[0].business_id).toBe(businessId);
			expect(tracker.tracker[0].profile_id).toBeUndefined();
			expect(tracker.tracker[0].failure_reason).toBe("Error message");
		});

		it("should add an entry with all undefined parameters", () => {
			tracker.push();

			expect(tracker.length()).toBe(1);
			expect(tracker.tracker[0].account_id).toBeUndefined();
			expect(tracker.tracker[0].business_id).toBeUndefined();
			expect(tracker.tracker[0].profile_id).toBeUndefined();
			expect(tracker.tracker[0].failure_reason).toBeUndefined();
		});
	});

	describe("failures", () => {
		it("should return only entries with failure_reason", () => {
			const businessId1 = randomUUID();
			const businessId2 = randomUUID();
			const successAccount = {
				id: randomUUID(),
				business_id: randomUUID(),
				profile_id: randomUUID()
			} as any;

			tracker.extendNoMerchantProfileFound([businessId1]);
			tracker.extendOnboardOutcomes([businessId2], [successAccount]);

			const failures = tracker.failures();

			expect(failures.length).toBe(2);
			failures.forEach(entry => {
				expect(entry.failure_reason).toBeDefined();
			});
		});

		it("should return empty array when no failures exist", () => {
			const successAccount = {
				id: randomUUID(),
				business_id: randomUUID(),
				profile_id: randomUUID()
			} as any;

			tracker.extendOnboardOutcomes([], [successAccount]);

			expect(tracker.failures()).toEqual([]);
		});
	});

	describe("successes", () => {
		it("should return only entries without failure_reason", () => {
			const businessId = randomUUID();
			const successAccounts = [
				{
					id: randomUUID(),
					business_id: randomUUID(),
					profile_id: randomUUID()
				} as any,
				{
					id: randomUUID(),
					business_id: randomUUID(),
					profile_id: randomUUID()
				} as any
			];

			tracker.extendNoMerchantProfileFound([businessId]);
			tracker.extendOnboardOutcomes([], successAccounts);

			const successes = tracker.successes();

			expect(successes.length).toBe(2);
			successes.forEach(entry => {
				expect(entry.failure_reason).toBeUndefined();
			});
		});

		it("should return empty array when no successes exist", () => {
			tracker.extendNoMerchantProfileFound([randomUUID()]);

			expect(tracker.successes()).toEqual([]);
		});
	});

	describe("hasFailures", () => {
		it("should return true when failures exist", () => {
			tracker.extendNoMerchantProfileFound([randomUUID()]);

			expect(tracker.hasFailures()).toBe(true);
		});

		it("should return false when no failures exist", () => {
			const successAccount = {
				id: randomUUID(),
				business_id: randomUUID(),
				profile_id: randomUUID()
			} as any;

			tracker.extendOnboardOutcomes([], [successAccount]);

			expect(tracker.hasFailures()).toBe(false);
		});

		it("should return false when tracker is empty", () => {
			expect(tracker.hasFailures()).toBe(false);
		});
	});

	describe("hasSuccesses", () => {
		it("should return true when successes exist", () => {
			const successAccount = {
				id: randomUUID(),
				business_id: randomUUID(),
				profile_id: randomUUID()
			} as any;

			tracker.extendOnboardOutcomes([], [successAccount]);

			expect(tracker.hasSuccesses()).toBe(true);
		});

		it("should return false when no successes exist", () => {
			tracker.extendNoMerchantProfileFound([randomUUID()]);

			expect(tracker.hasSuccesses()).toBe(false);
		});

		it("should return false when tracker is empty", () => {
			expect(tracker.hasSuccesses()).toBe(false);
		});
	});

	describe("clear", () => {
		it("should clear all entries from the tracker", () => {
			tracker.extendNoMerchantProfileFound([randomUUID(), randomUUID()]);
			expect(tracker.length()).toBe(2);

			tracker.clear();

			expect(tracker.length()).toBe(0);
			expect(tracker.tracker).toEqual([]);
		});

		it("should handle clearing an already empty tracker", () => {
			tracker.clear();

			expect(tracker.length()).toBe(0);
			expect(tracker.tracker).toEqual([]);
		});
	});

	describe("length", () => {
		it("should return the correct count of entries", () => {
			expect(tracker.length()).toBe(0);

			tracker.extendNoMerchantProfileFound([randomUUID()]);
			expect(tracker.length()).toBe(1);

			tracker.extendNoMerchantProfileFound([randomUUID(), randomUUID()]);
			expect(tracker.length()).toBe(3);
		});
	});

	describe("toSummary", () => {
		it("should return a summary with count, successes, and failures", () => {
			const failedBusinessId = randomUUID();
			const successAccount = {
				id: randomUUID(),
				business_id: randomUUID(),
				profile_id: randomUUID()
			} as any;

			tracker.extendNoMerchantProfileFound([failedBusinessId]);
			tracker.extendOnboardOutcomes([], [successAccount]);

			const summary = tracker.toSummary();

			expect(summary.count).toBe(2);
			expect(summary.success.length).toBe(1);
			expect(summary.failed.length).toBe(1);
			expect(summary.success[0]).toEqual(tracker.successes()[0]);
			expect(summary.failed[0]).toEqual(tracker.failures()[0]);
		});

		it("should return a summary with only failures", () => {
			tracker.extendNoMerchantProfileFound([randomUUID(), randomUUID()]);

			const summary = tracker.toSummary();

			expect(summary.count).toBe(2);
			expect(summary.success.length).toBe(0);
			expect(summary.failed.length).toBe(2);
		});

		it("should return a summary with only successes", () => {
			const successAccounts = [
				{
					id: randomUUID(),
					business_id: randomUUID(),
					profile_id: randomUUID()
				} as any
			];

			tracker.extendOnboardOutcomes([], successAccounts);

			const summary = tracker.toSummary();

			expect(summary.count).toBe(1);
			expect(summary.success.length).toBe(1);
			expect(summary.failed.length).toBe(0);
		});

		it("should return an empty summary when tracker is empty", () => {
			const summary = tracker.toSummary();

			expect(summary.count).toBe(0);
			expect(summary.success).toEqual([]);
			expect(summary.failed).toEqual([]);
		});
	});

	describe("Method chaining", () => {
		it("should support method chaining for multiple operations", () => {
			const businessIds = [randomUUID(), randomUUID()];
			const profileContexts: MerchantProfileTypes.ProfilesNotReadyToOnboard = [
				{
					profile: {
						profileId: randomUUID(),
						businessId: randomUUID()
					},
					reason: "Not ready"
				}
			] as any;
			const failedBusinessIds = [randomUUID()];
			const successAccounts = [
				{
					id: randomUUID(),
					business_id: randomUUID(),
					profile_id: randomUUID()
				} as any
			];

			tracker
				.extendNoMerchantProfileFound(businessIds)
				.extendNotReadyForOnboard(profileContexts)
				.extendOnboardOutcomes(failedBusinessIds, successAccounts);

			expect(tracker.length()).toBe(5);
			expect(tracker.failures().length).toBe(4);
			expect(tracker.successes().length).toBe(1);
		});
	});

	describe("Complex scenarios", () => {
		it("should correctly track mixed success and failure outcomes", () => {
			// Add various types of failures
			tracker.extendNoMerchantProfileFound([randomUUID()]);

			const profileContexts: MerchantProfileTypes.ProfilesNotReadyToOnboard = [
				{
					profile: {
						profileId: randomUUID(),
						businessId: randomUUID()
					},
					reason: "Missing data"
				}
			] as any;
			tracker.extendNotReadyForOnboard(profileContexts);

			// Add mixed outcomes
			const successAccounts = [
				{
					id: randomUUID(),
					business_id: randomUUID(),
					profile_id: randomUUID()
				} as any,
				{
					id: randomUUID(),
					business_id: randomUUID(),
					profile_id: randomUUID()
				} as any
			];
			tracker.extendOnboardOutcomes([randomUUID(), randomUUID()], successAccounts);

			// Manual push
			tracker.push(undefined, randomUUID(), undefined, "Custom error" as any);

			expect(tracker.length()).toBe(7);
			expect(tracker.hasFailures()).toBe(true);
			expect(tracker.hasSuccesses()).toBe(true);
			expect(tracker.failures().length).toBe(5);
			expect(tracker.successes().length).toBe(2);

			const summary = tracker.toSummary();
			expect(summary.count).toBe(7);
			expect(summary.success.length).toBe(2);
			expect(summary.failed.length).toBe(5);
		});

		it("should maintain state after multiple operations and clear", () => {
			tracker.extendNoMerchantProfileFound([randomUUID()]);
			expect(tracker.length()).toBe(1);

			tracker.clear();
			expect(tracker.length()).toBe(0);

			const successAccount = {
				id: randomUUID(),
				business_id: randomUUID(),
				profile_id: randomUUID()
			} as any;
			tracker.extendOnboardOutcomes([], [successAccount]);

			expect(tracker.length()).toBe(1);
			expect(tracker.successes().length).toBe(1);
			expect(tracker.failures().length).toBe(0);
		});
	});
});
