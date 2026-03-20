/**
 * Trulioo Person Module Types
 * Defines interfaces for person module components to avoid circular dependencies
 */

import {
	TruliooPSCFormData,
	TruliooUBOPersonData,
	TruliooWatchlistHit,
	TruliooPersonInquiryResult,
	TruliooPersonVerificationData,
	TruliooFlowResult
} from "../common/types";

/**
 * Interface for person inquiry operations
 */
export interface ITruliooPersonInquiryManager {
	createPersonInquiry(
		personData: TruliooUBOPersonData,
		businessData: TruliooPSCFormData,
		businessEntityVerificationId?: string,
		taskId?: string
	): Promise<TruliooPersonInquiryResult>;

	getPersonVerificationDetails(): Promise<TruliooPersonInquiryResult>;

	completePersonInquiry(): Promise<void>;
}

/**
 * Interface for person data storage operations
 */
export interface ITruliooPersonDataStorage {
	storePersonInBusinessEntityPeople(
		personData: TruliooUBOPersonData,
		businessEntityVerificationId: string,
		verificationData: TruliooPersonVerificationData
	): Promise<void>;
}

/**
 * Interface for person verification processing operations
 */
export interface ITruliooPersonVerificationProcessor {
	processPersonVerification(
		personData: TruliooUBOPersonData,
		businessData: TruliooPSCFormData,
		taskId?: string,
		businessEntityVerificationId?: string
	): Promise<TruliooPersonVerificationData>;
}

/**
 * Interface for screening results processing operations
 */
export interface ITruliooPersonScreeningProcessor {
	processScreeningResults(
		personData: TruliooUBOPersonData,
		flowResult: TruliooFlowResult
	): Promise<{
		person: TruliooUBOPersonData;
		status: "PENDING" | "COMPLETED" | "FAILED";
		watchlistHits: TruliooWatchlistHit[];
		provider: string;
		screenedAt: string;
		metadata: Record<string, unknown>;
	}>;
}
