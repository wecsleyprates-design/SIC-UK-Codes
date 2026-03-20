import { db } from "#helpers/index";
import {
	applySearchToQuery,
	applySearchSortsToQuery,
	applySortsToQuery,
	applyPaginationToQuery,
	applyFiltersToQuery
} from "#utils/index";
import { StatusCodes } from "http-status-codes";
import { BusinessApiError } from "../error";
import { GetPurgedBusinessesRequestQuery, GetPurgedBusinessesResponse } from "../types";
import { DatabaseError, PaginationMaxRangeError } from "#errors";
import { ERROR_CODES, ROLES } from "#constants";
import { UserInfo } from "#types";

export async function getPurgedBusinesses(
	query: GetPurgedBusinessesRequestQuery,
	userInfo: UserInfo
): Promise<GetPurgedBusinessesResponse> {
	let baseQuery;

	if (userInfo.role.code === ROLES.ADMIN) {
		baseQuery = db("purge_business.data_purged_businesses").select("*");
	} else {
		if (!query.customerID) {
			throw new BusinessApiError(`Please provide valid customer ID`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		baseQuery = db("purge_business.data_purged_businesses")
			.select("*")
			.where("purge_business.data_purged_businesses.customer_id", query.customerID);
	}

	/** Handle query.search and query.search_filter */
	/************************************************/
	const searchBusinessesName = query.search?.["purge_business.data_purged_businesses.name"];
	const searchBusinessesId =
		query.search?.["purge_business.data_purged_businesses.business_id::text"] ??
		query.search?.["purge_business.data_purged_businesses.business_id"];

	const searchFilterBusinessId = query.search_filter?.["data_businesses.id"];

	baseQuery.where(subquery => {
		applySearchToQuery(subquery, {
			"purge_business.data_purged_businesses.name::text": searchBusinessesName,
			"purge_business.data_purged_businesses.business_id::text": searchBusinessesId
		});

		applyFiltersToQuery(subquery, {
			"data_businesses.id": searchFilterBusinessId
		});
	});

	try {
		/**
		 * Handle count query
		 */
		const countQuery = baseQuery.clone();
		countQuery.clearSelect();
		countQuery.countDistinct("purge_business.data_purged_businesses.business_id", { as: "totalcount" });

		const countResult = await countQuery.first();
		const totalcount = parseInt(countResult?.totalcount || "0", 10);

		/** Handle query.search (sorting) */
		/**********************************/
		applySearchSortsToQuery(baseQuery, {
			"purge_business.data_purged_businesses.name::text": searchBusinessesName,
			"purge_business.data_purged_businesses.business_id::text": searchBusinessesId
		});
		/**********************************/

		/** Handle query.sort */
		/**********************/
		const sortBusinessesDeletedAt = query.sort?.["data_purged_businesses.deleted_at"];
		const sortBusinessesName = query.sort?.["data_purged_businesses.name"];

		if (sortBusinessesName) {
			applySortsToQuery(baseQuery, {
				"purge_business.data_purged_businesses.name": sortBusinessesName
			});
		} else {
			/**
			 * This is the default sort if no sort is provided.
			 */
			applySortsToQuery(baseQuery, {
				"purge_business.data_purged_businesses.deleted_at": sortBusinessesDeletedAt || "DESC"
			});
		}

		/** Handle query.pagination */
		/****************************/
		const paginationDetails = applyPaginationToQuery(baseQuery, query, totalcount);
		/****************************/

		/**
		 * Execute main query with pagination applied.
		 */
		const rows = await baseQuery;
		/**
		 * Finally, return the response.
		 */
		return {
			records: rows,
			total_pages: paginationDetails.totalPages,
			total_items: paginationDetails.totalItems
		};
	} catch (error) {
		if (error instanceof BusinessApiError) {
			throw error;
		} else if (error instanceof PaginationMaxRangeError) {
			/**
			 * Rethrow PaginationMaxRangeError as a BusinessApiError for consistency.
			 */
			throw new BusinessApiError(error.message, StatusCodes.BAD_REQUEST);
		} else {
			/**
			 * Remap error to our DatabaseError class to redact any sensitive information
			 * (e.g. raw SQL queries) and provide a consistent error structure.
			 */
			throw new DatabaseError(error);
		}
	}
}
