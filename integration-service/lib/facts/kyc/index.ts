import { sources } from "../sources";
import { type Fact } from "../types";
import { type FactEngine } from "../factEngine";
import z from "zod-v4";

/**
 * Owner data schema for KYC facts
 * This represents the user-submitted owner information from the data_owners table
 */
const ownerSchema = z.object({
	id: z.string().uuid(),
	first_name: z.string().nullable(),
	last_name: z.string().nullable(),
	date_of_birth: z.string().nullable(),
	ssn: z.string().nullable(),
	email: z.string().nullable(),
	mobile: z.string().nullable(),
	title: z.union([z.number(), z.object({ id: z.number(), title: z.string() })]).nullable().optional(),
	address_line_1: z.string().nullable(),
	address_line_2: z.string().nullable(),
	address_apartment: z.string().nullable(),
	address_city: z.string().nullable(),
	address_state: z.string().nullable(),
	address_postal_code: z.string().nullable(),
	address_country: z.string().nullable(),
	ownership_percentage: z.number().nullable().optional(),
	owner_type: z.enum(["CONTROL", "BENEFICIARY"]).nullable().optional(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
}).passthrough();

export type OwnerData = z.infer<typeof ownerSchema>;

/**
 * Email report schema - data from Plaid IDV for email verification
 */
const emailReportSchema = z.object({
	name: z.string().nullable().optional(),
	email: z.string().nullable().optional(),
	is_deliverable: z.string().nullable().optional(),
	breach_count: z.number().nullable().optional(),
	first_breached_at: z.string().nullable().optional(),
	last_breached_at: z.string().nullable().optional(),
	domain_registered_at: z.string().nullable().optional(),
	domain_is_free_provider: z.string().nullable().optional(),
	domain_is_disposable: z.string().nullable().optional(),
	top_level_domain_is_suspicious: z.string().nullable().optional(),
	ip_spam_list_count: z.number().nullable().optional(),
}).nullable();

/**
 * Fraud report schema - data from Plaid IDV for fraud detection
 */
const fraudReportSchema = z.object({
	name: z.string().nullable().optional(),
	user_interactions: z.string().nullable().optional(),
	fraud_ring_detected: z.string().nullable().optional(),
	bot_detected: z.string().nullable().optional(),
	synthetic_identity_risk_score: z.number().nullable().optional(),
	stolen_identity_risk_score: z.number().nullable().optional(),
}).nullable();

/**
 * Owner verification data schema
 */
const ownerVerificationSchema = z.object({
	email_report: emailReportSchema,
	fraud_report: fraudReportSchema,
}).passthrough();

export type OwnerVerificationData = z.infer<typeof ownerVerificationSchema>;

/**
 * KYC Facts - Owner/Applicant information and verification data
 * 
 * Override support:
 * - Overrides are stored as a complete array of owners (the entire fact value)
 * - When an override exists, the override array replaces the source data
 */

const ownersSubmittedFact: Omit<Fact, "name"> = {
	description: "User-submitted owner/applicant data from onboarding",
	schema: z.array(ownerSchema),
	source: sources.ownerDetails,
	fn: async function (this: Fact, engine: FactEngine, owners: OwnerData[]): Promise<OwnerData[] | undefined> {
		if (!owners || owners.length === 0) {
			return undefined;
		}
		
		// If there's an override array, use it directly
		if (this.override?.value && Array.isArray(this.override.value)) {
			return this.override.value as OwnerData[];
		}
		
		return owners;
	}
};

/**
 * Owner verification fact - Email Report and Fraud Report data from Plaid IDV
 * Returns verification data for each owner, keyed by owner ID
 */
const ownerVerificationFact: Omit<Fact, "name"> = {
	schema: z.record(z.string(), ownerVerificationSchema),
	source: sources.ownerVerification,
	fn: async function (this: Fact, engine: FactEngine, verificationData: Record<string, OwnerVerificationData>): Promise<Record<string, OwnerVerificationData> | undefined> {
		// Return the verification data as-is (keyed by owner ID)
		if (!verificationData || Object.keys(verificationData).length === 0) {
			return undefined;
		}
		return verificationData;
	}
};

// Export KYC facts
export const kycFacts: readonly Fact[] = Object.freeze([
	{ ...ownersSubmittedFact, name: "owners_submitted" } as Fact,
	{ ...ownerVerificationFact, name: "owner_verification" } as Fact,
]);
