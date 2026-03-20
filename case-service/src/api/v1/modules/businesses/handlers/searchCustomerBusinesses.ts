import { db } from "#helpers";
import { BusinessApiError } from "../error";
import { DatabaseError, PaginationMaxRangeError } from "#errors";
import { StatusCodes } from "http-status-codes";
import type {
	SearchCustomerBusinessesRequestParams,
	SearchCustomerBusinessesRequestQuery,
	SearchCustomerBusinessesResponse,
	SearchBusinessResult
} from "../types";

/**
 * Search businesses by name, business ID, or case ID for a specific customer.
 * This is a unified search endpoint that allows searching across multiple fields.
 */
export async function searchCustomerBusinesses(
	params: SearchCustomerBusinessesRequestParams,
	query: SearchCustomerBusinessesRequestQuery
): Promise<SearchCustomerBusinessesResponse> {
	const { customerID } = params;
	const { query: searchQuery, limit = 10 } = query;

	const hasSearchTerm = searchQuery && searchQuery.trim().length > 0;
	const searchTerm = hasSearchTerm ? searchQuery.trim() : "";
	const searchPattern = `%${searchTerm}%`;
	const isUUIDLike = hasSearchTerm && /^[0-9a-f-]{8,36}$/i.test(searchTerm);

	try {
		const baseQuery = db("data_businesses")
			.select(
				"data_businesses.id",
				"data_businesses.name",
				"data_businesses.address_city",
				"data_businesses.address_state",
				"data_businesses.address_country",
				"latest_case.id as case_id"
			)
			.join("rel_business_customer_monitoring", "rel_business_customer_monitoring.business_id", "data_businesses.id")
			.leftJoin(
				db.raw(
					`LATERAL (
						SELECT data_cases.id 
						FROM data_cases 
						WHERE data_cases.business_id = data_businesses.id 
						AND data_cases.customer_id = ? 
						ORDER BY data_cases.created_at DESC 
						LIMIT 1
					) latest_case ON true`,
					[customerID]
				)
			)
			.where("rel_business_customer_monitoring.customer_id", customerID)
			.where("data_businesses.is_deleted", false);

		if (hasSearchTerm) {
			baseQuery.where(function () {
				this.whereRaw("data_businesses.name ILIKE ?", [searchPattern])
					.orWhere(function () {
						if (isUUIDLike) {
							this.where("data_businesses.id", searchTerm)
								.orWhereRaw("data_businesses.id::text ILIKE ?", [searchPattern]);
						} else {
							this.whereRaw("data_businesses.id::text ILIKE ?", [searchPattern]);
						}
					})
					.orWhereRaw(
						`EXISTS (
							SELECT 1 
							FROM data_cases 
							WHERE data_cases.business_id = data_businesses.id 
							AND data_cases.customer_id = ? 
							AND (
								${isUUIDLike ? "data_cases.id = ? OR" : ""}
								data_cases.id::text ILIKE ?
							)
						)`,
						isUUIDLike ? [customerID, searchTerm, searchPattern] : [customerID, searchPattern]
					);
			});
		}

		if (hasSearchTerm) {
			baseQuery
				.orderByRaw("CASE WHEN data_businesses.name ILIKE ? THEN 0 ELSE 1 END", [searchTerm])
				.orderBy("data_businesses.name", "asc");
		} else {
			baseQuery.orderBy("data_businesses.name", "asc");
		}

		baseQuery.limit(limit);

		const countQuery = db("data_businesses")
			.countDistinct("data_businesses.id", { as: "totalcount" })
			.join("rel_business_customer_monitoring", "rel_business_customer_monitoring.business_id", "data_businesses.id")
			.where("rel_business_customer_monitoring.customer_id", customerID)
			.where("data_businesses.is_deleted", false);

		if (hasSearchTerm) {
			countQuery.where(function () {
				this.whereRaw("data_businesses.name ILIKE ?", [searchPattern])
					.orWhere(function () {
						if (isUUIDLike) {
							this.where("data_businesses.id", searchTerm)
								.orWhereRaw("data_businesses.id::text ILIKE ?", [searchPattern]);
						} else {
							this.whereRaw("data_businesses.id::text ILIKE ?", [searchPattern]);
						}
					})
					.orWhereRaw(
						`EXISTS (
							SELECT 1 
							FROM data_cases 
							WHERE data_cases.business_id = data_businesses.id 
							AND data_cases.customer_id = ? 
							AND (
								${isUUIDLike ? "data_cases.id = ? OR" : ""}
								data_cases.id::text ILIKE ?
							)
						)`,
						isUUIDLike ? [customerID, searchTerm, searchPattern] : [customerID, searchPattern]
					);
			});
		}

		const countResult = await countQuery.first();
		const total = parseInt(String(countResult?.totalcount || "0"), 10);
		const rows = await baseQuery;

		const records: SearchBusinessResult[] = rows.map((row: {
			id: string;
			name: string;
			address_city?: string;
			address_state?: string;
			address_country?: string;
			case_id?: string;
		}) => {
			const locationParts = [row.address_city, row.address_state, row.address_country].filter(Boolean);
			const location = locationParts.join(", ") || "N/A";

			return {
				id: row.id,
				business_id: row.id,
				name: row.name,
				location,
				case_id: row.case_id || undefined
			};
		});

		return {
			records,
			total
		};
	} catch (error) {
		if (error instanceof BusinessApiError) {
			throw error;
		} else if (error instanceof PaginationMaxRangeError) {
			throw new BusinessApiError(error.message, StatusCodes.BAD_REQUEST);
		} else {
			throw new DatabaseError(error);
		}
	}
}

