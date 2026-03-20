/**
 * Mappers for case tab values: domain → API response.
 * @see worth-types-and-mappers
 */

import type { CaseTabValues, CaseTabValueItem, CaseTabValuesResult } from "./types";
import type { CaseTabValuesApiResponse } from "./types";

/**
 * Maps domain CaseTabValuesResult to API response (snake_case keys, values + change-detection fields).
 * Includes optional status when present (e.g. for GIACT rows).
 */
export function toApiResponse(domain: CaseTabValuesResult): CaseTabValuesApiResponse {
	const values: CaseTabValuesApiResponse["values"] = {};
	for (const [rowId, item] of Object.entries(domain.values)) {
		if (item == null) continue;
		const typedItem = item as CaseTabValueItem;
		values[rowId] = {
			value: typedItem.value,
			...(typedItem.description != null && { description: typedItem.description }),
			...(typedItem.status != null && { status: typedItem.status }),
		};
	}
	return {
		values,
		...(domain.created_at != null && { created_at: domain.created_at }),
		...(domain.updated_at != null && { updated_at: domain.updated_at }),
		has_updates_since_generated: domain.has_updates_since_generated,
		updates_count: domain.updates_count,
	};
}
