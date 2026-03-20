import { MapperError } from "../mapper";
import type { MapperField } from "#types/index";
import type { AgingConfig } from "../types";

const MAX_THRESHOLD_DAYS = 365;

/**
 * Checks if a threshold value exceeds the maximum allowed days
 * @param value - The threshold value to check
 * @returns true if the value is defined and exceeds MAX_THRESHOLD_DAYS
 */
const exceedsMaxThreshold = (value: number | undefined): boolean => {
	return value !== undefined && value > MAX_THRESHOLD_DAYS;
};

/**
 * Validates aging configuration thresholds
 * Ensures threshold values do not exceed 365 days
 * 
 * @param agingField - The mapper field containing the aging configuration
 * @throws MapperError if any threshold exceeds 365 days
 */
export const validateAgingConfigThresholds = (agingField: MapperField): void => {
	if (!agingField?.value) return;

	const config = agingField.value as AgingConfig;
	if (!config?.thresholds) return;

	const { thresholds } = config;
	const hasExceededThreshold = 
		exceedsMaxThreshold(thresholds.low) ||
		exceedsMaxThreshold(thresholds.medium) ||
		exceedsMaxThreshold(thresholds.high);

	if (hasExceededThreshold) {
		throw new MapperError(`Threshold values cannot exceed ${MAX_THRESHOLD_DAYS} days`, agingField);
	}
};
