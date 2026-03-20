import { IntegrationFactEntityMatchingMetadata } from "../../types";

/**
 * Metadata format for OpenCorporates entity matching.
 * This matches the metadata shape expected by `fetchBusinessEntityVerification` in `entityMatching.ts`
 */
export interface OpenCorporatesEntityMatchingMetadata extends IntegrationFactEntityMatchingMetadata {}
