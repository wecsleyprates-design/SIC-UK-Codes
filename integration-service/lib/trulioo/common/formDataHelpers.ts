/**
 * Form Data Helpers for Trulioo Integration
 * 
 * Contains helper functions for handling form data mapping, validation, and fallback logic.
 * Follows SRP (Single Responsibility Principle) by separating concerns:
 * - Field value resolution (with fallbacks)
 * - Required field validation
 * - Country-specific handling
 */

import type { FlowElement } from "./types";
import type { TruliooKYBFormData, TruliooPSCFormData } from "./types";
import { logger } from "#helpers/logger";

/**
 * UK country codes (GB and UK are equivalent)
 */
const UK_COUNTRY_CODES = ["GB", "UK"] as const;

/**
 * Result of resolving a field value, including whether a fallback was used
 */
export interface ResolvedFieldValue {
	value: string;
	usedFallback: boolean;
	fallbackReason?: string;
}

/**
 * Resolves the value for a required field, applying fallbacks when necessary
 * 
 * @param element - The flow element from Trulioo
 * @param formDataKey - The internal form data key (e.g., "companyStateAddress")
 * @param value - The original value from form data
 * @param formData - The complete form data object for accessing related fields
 * @returns Resolved field value with metadata, or null if field should be skipped
 */
export function resolveRequiredFieldValue(
	element: FlowElement,
	formDataKey: string,
	value: string | undefined | null,
	formData: Partial<TruliooKYBFormData | TruliooPSCFormData>
): ResolvedFieldValue | null {
	// Check if field is required
	const validations = element.validations as Array<{ type: string }> | undefined;
	const isRequired = validations?.some((v) => v.type === "required") ?? false;
	
	// If not required and empty, skip it
	if (!isRequired && (value === undefined || value === null || value === "")) {
		return null;
	}
	
	// If required but empty, try to apply fallbacks
	if (isRequired && (value === undefined || value === null || value === "")) {
		const fallbackResult = applyFieldFallback(element.role, formDataKey, formData);
		
		if (fallbackResult) {
			return {
				value: fallbackResult.value,
				usedFallback: true,
				fallbackReason: fallbackResult.reason
			};
		}
		
		// No fallback available, return empty string (may cause validation error)
		return {
			value: "",
			usedFallback: false
		};
	}
	
	// Value is present and valid
	return {
		value: value as string,
		usedFallback: false
	};
}

/**
 * Applies country-specific fallbacks for empty required fields
 * 
 * @param role - The Trulioo field role (e.g., "company_state_address")
 * @param formDataKey - The internal form data key
 * @param formData - The complete form data object
 * @returns Fallback value with reason, or null if no fallback applies
 */
function applyFieldFallback(
	role: string,
	formDataKey: string,
	formData: Partial<TruliooKYBFormData | TruliooPSCFormData>
): { value: string; reason: string } | null {
	// Handle UK businesses missing state/province
	if (role === "company_state_address" && formData.companyCountryIncorporation) {
		const country = formData.companyCountryIncorporation.toUpperCase();
		
		if (UK_COUNTRY_CODES.includes(country as any)) {
			// For UK businesses, use city as fallback, or "England" as default
			const fallbackValue = formData.companyCity || "England";
			return {
				value: fallbackValue,
				reason: `UK business missing state - using ${formData.companyCity ? "city" : "default 'England'"} as fallback`
			};
		}
	}
	
	// Add more fallback rules here as needed for other countries/fields
	// Example: if (role === "company_city" && country === "XX") { ... }
	
	return null;
}

/**
 * Determines if a field value should be included in the Trulioo payload
 * 
 * @param value - The resolved field value
 * @param isRequired - Whether the field is required
 * @returns true if the value should be included, false otherwise
 */
export function shouldIncludeFieldValue(
	resolvedValue: ResolvedFieldValue | null,
	isRequired: boolean
): boolean {
	if (!resolvedValue) {
		return false;
	}
	
	// Always include required fields (even if empty)
	if (isRequired) {
		return true;
	}
	
	// For non-required fields, only include non-empty values
	// Trulioo rejects empty strings for some optional fields (e.g., dob)
	return resolvedValue.value !== "";
}
