import { Owner } from "#types";

/**
 * Metadata for Plaid IDV adapter.
 * Contains the list of owners (applicants) to enroll in identity verification.
 */
export interface PlaidIdvMetadata {
	/** Array of owner/applicant information to enroll in IDV */
	owners: Owner[];
}
