/**
 * Unit tests for case tab values mappers (domain → API response).
 */

import { toApiResponse } from "../mappers";
import type { CaseTabValuesResult } from "../types";

describe("case-tab-values mappers", () => {
	describe("toApiResponse", () => {
		it("maps domain values to API shape with value and optional description", () => {
			const domain: CaseTabValuesResult = {
				values: {
					tin_business_registration: { value: "12-3456789", description: null },
					watchlist_hits: { value: 0, description: "None found." },
				},
				created_at: "2026-02-18T12:00:00.000Z",
				updated_at: "2026-02-18T12:00:00.000Z",
				has_updates_since_generated: false,
				updates_count: 0,
			};
			const result = toApiResponse(domain);
			// Mapper omits description when null
			expect(result.values.tin_business_registration).toEqual({ value: "12-3456789" });
			expect(result.values.watchlist_hits).toEqual({ value: 0, description: "None found." });
			expect(result.created_at).toBe(domain.created_at);
			expect(result.has_updates_since_generated).toBe(false);
			expect(result.updates_count).toBe(0);
		});

		it("includes status in API value when present (e.g. GIACT rows)", () => {
			const domain: CaseTabValuesResult = {
				values: {
					giact_account_status: {
						value: null,
						description: "Account verified.",
						status: "passed",
					},
				},
				created_at: null,
				updated_at: null,
				has_updates_since_generated: false,
				updates_count: 0,
			};
			const result = toApiResponse(domain);
			expect(result.values.giact_account_status).toEqual({
				value: null,
				description: "Account verified.",
				status: "passed",
			});
		});

		it("omits description and status when null/undefined", () => {
			const domain: CaseTabValuesResult = {
				values: {
					bankruptcies: { value: 0 },
				},
				created_at: null,
				updated_at: null,
				has_updates_since_generated: false,
				updates_count: 0,
			};
			const result = toApiResponse(domain);
			expect(result.values.bankruptcies).toEqual({ value: 0 });
		});

		it("skips null/undefined entries in values", () => {
			const domain: CaseTabValuesResult = {
				values: {
					tin_business_registration: { value: "99", description: null },
					// @ts-expect-error - testing runtime behavior
					empty: null,
				},
				created_at: null,
				updated_at: null,
				has_updates_since_generated: false,
				updates_count: 0,
			};
			const result = toApiResponse(domain);
			expect(Object.keys(result.values)).toContain("tin_business_registration");
			expect(result.values.empty).toBeUndefined();
		});
	});
});
