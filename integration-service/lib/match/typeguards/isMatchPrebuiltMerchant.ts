import { isObjectWithKeys } from "#utils/typeguards/isObjectWithKeys";
import type { MatchPrebuiltMerchant } from "../types";

/**
 * Type guard to check if task metadata contains a pre-built Match merchant payload
 * constructed by the rerun integrations adapter.
 */
export function isMatchPrebuiltMerchant(metadata: unknown): metadata is { merchant: MatchPrebuiltMerchant } {
	return (
		isObjectWithKeys(metadata, "merchant") &&
		isObjectWithKeys(metadata.merchant, "name", "address", "principals")
	);
}
