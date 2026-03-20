import { UUID } from "crypto";
import { PaymentProcessorOnboardOutcome } from "./types/processor";
import type * as MerchantProfileTypes from "./types/merchantProfile";
import * as PaymentProcessorAccountTypes from "@joinworth/types/dist/types/integration/paymentProcessors/paymentProcessorAccount";

export type PaymentProcessorTrackerSummary = {
	count: number;
	success: PaymentProcessorOnboardOutcome[];
	failed: PaymentProcessorOnboardOutcome[];
};

export class PaymentProcessorOnboardTracker {
	public tracker: PaymentProcessorOnboardOutcome[] = [];

	constructor() {}

	public extendNoMerchantProfileFound(businessId: UUID[]) {
		businessId.forEach(id => {
			this.tracker.push({
				business_id: id,
				failure_reason: "No merchant profile found"
			});
		});
		return this;
	}

	public extendNotReadyForOnboard(profileContexts: MerchantProfileTypes.ProfilesNotReadyToOnboard) {
		profileContexts.forEach(context => {
			this.tracker.push({
				profile_id: context.profile.profileId,
				business_id: context.profile.businessId,
				failure_reason: context.reason
			});
		});
		return this;
	}

	public extendOnboardOutcomes(
		failedBusinessIds: UUID[],
		successfulAccounts: PaymentProcessorAccountTypes.PaymentProcessorAccount[]
	) {
		failedBusinessIds.forEach(businessId => {
			this.tracker.push({
				business_id: businessId,
				failure_reason: "Onboard failed"
			});
		});

		successfulAccounts.forEach(account => {
			this.tracker.push({
				account_id: account.id as UUID,
				business_id: account.business_id as UUID,
				profile_id: account.profile_id as UUID
			});
		});
		return this;
	}

	public push(
		accountId: UUID | undefined = undefined,
		businessId: UUID | undefined = undefined,
		profileId: UUID | undefined = undefined,
		failureReason: UUID | undefined = undefined
	) {
		this.tracker.push({
			account_id: accountId,
			business_id: businessId,
			profile_id: profileId,
			failure_reason: failureReason
		});
	}
	public failures(): PaymentProcessorOnboardOutcome[] {
		return this.tracker.filter(item => item.failure_reason !== undefined);
	}

	public successes(): PaymentProcessorOnboardOutcome[] {
		return this.tracker.filter(item => item.failure_reason === undefined);
	}

	public hasFailures(): boolean {
		return this.failures().length > 0;
	}

	public hasSuccesses(): boolean {
		return this.successes().length > 0;
	}

	public clear(): void {
		this.tracker = [];
	}

	public length(): number {
		return this.tracker.length;
	}

	public toSummary(): PaymentProcessorTrackerSummary {
		return {
			count: this.length(),
			success: this.successes(),
			failed: this.failures()
		};
	}
}
