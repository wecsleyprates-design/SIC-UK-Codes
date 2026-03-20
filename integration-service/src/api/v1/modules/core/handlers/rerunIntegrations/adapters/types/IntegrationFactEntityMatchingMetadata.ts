import { BusinessAddress } from "#helpers/api";

/**
 * Metadata format for any integrations that run indirectly via EntityMatching.
 * This matches the metadata shape expected by `fetchBusinessEntityVerification` in `entityMatching.ts`
 * and other EntityMatching integrations.
 */
export interface IntegrationFactEntityMatchingMetadata {
	names: string[];
	originalAddresses: Omit<BusinessAddress, "is_primary" | "mobile">[];
}
