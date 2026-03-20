import { isObjectWithKeys } from "#utils/typeguards/isObjectWithKeys";
import type { TruliooBusinessData } from "../../common/types";

/**
 * Type guard to check if task metadata contains valid Trulioo business data
 * @param metadata - Task metadata to validate
 * @returns True if metadata is valid TruliooBusinessData
 */
export function isTruliooBusinessDataMetadata(metadata: unknown): metadata is TruliooBusinessData {
	return (
		isObjectWithKeys(metadata, "name", "business_addresses") &&
		Array.isArray(metadata.business_addresses) &&
		metadata.business_addresses.length > 0
	);
}
