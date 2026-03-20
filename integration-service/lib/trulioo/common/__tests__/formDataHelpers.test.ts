/**
 * Tests for formDataHelpers.ts
 * 
 * Tests the helper functions for handling Trulioo form data mapping,
 * validation, and fallback logic.
 */

import {
	resolveRequiredFieldValue,
	shouldIncludeFieldValue,
	ResolvedFieldValue
} from "../formDataHelpers";
import type { FlowElement } from "../types";
import type { TruliooKYBFormData } from "../types";

describe("formDataHelpers", () => {
	describe("resolveRequiredFieldValue", () => {
		const mockFormData: Partial<TruliooKYBFormData> = {
			companyName: "Test Business Ltd",
			companyCountryIncorporation: "GB",
			companyCity: "London",
			companyStateAddress: "England"
		};

		describe("Non-required fields", () => {
			it("should return null for non-required empty field", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_dob",
					validations: [] // Not required
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyDob",
					undefined,
					mockFormData
				);

				expect(result).toBeNull();
			});

			it("should return value for non-required field with value", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_dob",
					validations: []
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyDob",
					"1990-01-01",
					mockFormData
				);

				expect(result).toEqual({
					value: "1990-01-01",
					usedFallback: false
				});
			});
		});

		describe("Required fields with values", () => {
			it("should return value for required field with value", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_name",
					validations: [{ type: "required" }]
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyName",
					"Test Business Ltd",
					mockFormData
				);

				expect(result).toEqual({
					value: "Test Business Ltd",
					usedFallback: false
				});
			});
		});

		describe("Required fields without values - UK state fallback", () => {
			it("should apply UK city fallback for missing state when country is GB", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_state_address",
					validations: [{ type: "required" }]
				};

				const formDataWithCity: Partial<TruliooKYBFormData> = {
					companyCountryIncorporation: "GB",
					companyCity: "London"
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyStateAddress",
					undefined,
					formDataWithCity
				);

				expect(result).toEqual({
					value: "London",
					usedFallback: true,
					fallbackReason: "UK business missing state - using city as fallback"
				});
			});

			it("should apply UK default fallback (England) when city is also missing", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_state_address",
					validations: [{ type: "required" }]
				};

				const formDataWithoutCity: Partial<TruliooKYBFormData> = {
					companyCountryIncorporation: "GB"
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyStateAddress",
					undefined,
					formDataWithoutCity
				);

				expect(result).toEqual({
					value: "England",
					usedFallback: true,
					fallbackReason: "UK business missing state - using default 'England' as fallback"
				});
			});

			it("should apply UK city fallback for missing state when country is UK (not GB)", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_state_address",
					validations: [{ type: "required" }]
				};

				const formDataWithUK: Partial<TruliooKYBFormData> = {
					companyCountryIncorporation: "UK",
					companyCity: "Manchester"
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyStateAddress",
					undefined,
					formDataWithUK
				);

				expect(result).toEqual({
					value: "Manchester",
					usedFallback: true,
					fallbackReason: "UK business missing state - using city as fallback"
				});
			});

			it("should not apply fallback for non-UK countries", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_state_address",
					validations: [{ type: "required" }]
				};

				const formDataCA: Partial<TruliooKYBFormData> = {
					companyCountryIncorporation: "CA",
					companyCity: "Toronto"
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyStateAddress",
					undefined,
					formDataCA
				);

				expect(result).toEqual({
					value: "",
					usedFallback: false
				});
			});

			it("should not apply fallback for non-state fields", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_name",
					validations: [{ type: "required" }]
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyName",
					undefined,
					mockFormData
				);

				expect(result).toEqual({
					value: "",
					usedFallback: false
				});
			});
		});

		describe("Edge cases", () => {
			it("should handle null value", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_name",
					validations: [{ type: "required" }]
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyName",
					null,
					mockFormData
				);

				expect(result).toEqual({
					value: "",
					usedFallback: false
				});
			});

			it("should handle empty string value", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_name",
					validations: [{ type: "required" }]
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyName",
					"",
					mockFormData
				);

				expect(result).toEqual({
					value: "",
					usedFallback: false
				});
			});

			it("should handle undefined validations array", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_dob",
					validations: undefined as any
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyDob",
					undefined,
					mockFormData
				);

				expect(result).toBeNull();
			});

			it("should handle empty validations array", () => {
				const element: FlowElement = {
					id: "test-id",
					role: "company_dob",
					validations: []
				};

				const result = resolveRequiredFieldValue(
					element,
					"companyDob",
					undefined,
					mockFormData
				);

				expect(result).toBeNull();
			});
		});
	});

	describe("shouldIncludeFieldValue", () => {
		describe("Required fields", () => {
			it("should include required field with value", () => {
				const resolvedValue: ResolvedFieldValue = {
					value: "Test Value",
					usedFallback: false
				};

				const result = shouldIncludeFieldValue(resolvedValue, true);

				expect(result).toBe(true);
			});

			it("should include required field even when empty", () => {
				const resolvedValue: ResolvedFieldValue = {
					value: "",
					usedFallback: false
				};

				const result = shouldIncludeFieldValue(resolvedValue, true);

				expect(result).toBe(true);
			});

			it("should include required field with fallback value", () => {
				const resolvedValue: ResolvedFieldValue = {
					value: "England",
					usedFallback: true,
					fallbackReason: "UK business missing state"
				};

				const result = shouldIncludeFieldValue(resolvedValue, true);

				expect(result).toBe(true);
			});
		});

		describe("Non-required fields", () => {
			it("should include non-required field with value", () => {
				const resolvedValue: ResolvedFieldValue = {
					value: "Test Value",
					usedFallback: false
				};

				const result = shouldIncludeFieldValue(resolvedValue, false);

				expect(result).toBe(true);
			});

			it("should exclude non-required field when empty", () => {
				const resolvedValue: ResolvedFieldValue = {
					value: "",
					usedFallback: false
				};

				const result = shouldIncludeFieldValue(resolvedValue, false);

				expect(result).toBe(false);
			});

			it("should exclude null resolved value", () => {
				const result = shouldIncludeFieldValue(null, false);

				expect(result).toBe(false);
			});

			it("should exclude null resolved value even for required fields", () => {
				const result = shouldIncludeFieldValue(null, true);

				expect(result).toBe(false);
			});
		});
	});
});
