import { db, hasDataPermission } from "#helpers/index";
import {
	applyFiltersToQuery,
	applySearchToQuery,
	applySearchSortsToQuery,
	applySortsToQuery,
	applyDateFiltersToQuery,
	applyPaginationToQuery,
	decryptAndMaskTin
} from "#utils/index";
import { StatusCodes } from "http-status-codes";
import { BusinessApiError } from "../error";
import {
	GetCustomerBusinessesRequestParams,
	GetCustomerBusinessesRequestQuery,
	GetCustomerBusinessesResponse
} from "../types";
import { DatabaseError, PaginationMaxRangeError } from "#errors";
import { UserInfo } from "#types";
import { CORE_PERMISSIONS } from "#constants";

/**
 * This api is binded on Customer side to let customer view all the business invited by them
 * TODO: Role check for customer only
 */
export async function getCustomerBusinesses(
	params: GetCustomerBusinessesRequestParams,
	query: GetCustomerBusinessesRequestQuery,
	userInfo: UserInfo
): Promise<GetCustomerBusinessesResponse> {
	const hasPermission: boolean = await hasDataPermission(userInfo, CORE_PERMISSIONS.READ_PII_DATA);

	/**
	 * The base query that will be used for both the main query and the count query.
	 * The SELECT portion of the query will be overridden in the count query.
	 */
	const baseQuery = db("data_businesses")
		.select(
			"data_businesses.*",
			"cnc.code as naics_code",
			"cnc.label as naics_title",
			"cmc.code as mcc_code",
			"cmc.label as mcc_title",
			"rel_business_customer_monitoring.customer_id as customer_id",
			"rel_business_customer_monitoring.is_monitoring_enabled as is_monitoring_enabled",
			"rel_business_customer_monitoring.external_id as external_id"
		)
		.join("rel_business_customer_monitoring", "rel_business_customer_monitoring.business_id", "data_businesses.id")
		.leftJoin("core_mcc_code as cmc", "cmc.id", "data_businesses.mcc_id")
		.leftJoin("core_naics_code as cnc", "cnc.id", "data_businesses.naics_id")
		.where("rel_business_customer_monitoring.customer_id", params.customerID);

	/** Handle query.filter */
	/************************/
	const filterDataBusinessesStatus = query.filter?.["data_businesses.status"];
	const relBusinessCustomerMonitoringIsMonitoringEnabled =
		query.filter?.["rel_business_customer_monitoring.is_monitoring_enabled"];
	const businessArchivedStatus = query?.filter?.["data_businesses.is_deleted"];

	applyFiltersToQuery(baseQuery, {
		"data_businesses.status": filterDataBusinessesStatus,
		"rel_business_customer_monitoring.is_monitoring_enabled": relBusinessCustomerMonitoringIsMonitoringEnabled
	});

	if (businessArchivedStatus) {
		applyFiltersToQuery(baseQuery, {
			"data_businesses.is_deleted": businessArchivedStatus
		});
	} else {
		/**
		 * This is the default filter for archived businesses.
		 */
		applyFiltersToQuery(baseQuery, {
			"data_businesses.is_deleted": "false"
		});
	}
	/************************/

	/** Handle query.search and query.search_filter */
	/************************************************/
	const searchBusinessesName = query.search?.["data_businesses.name"];
	const searchBusinessesId = query.search?.["data_businesses.id::text"] ?? query.search?.["data_businesses.id"];

	const searchFilterBusinessId = query.search_filter?.["data_businesses.id"];
	const searchFilterExternalId = query.search_filter?.["external_id"];

	baseQuery.where(subquery => {
		applySearchToQuery(subquery, {
			"data_businesses.name::text": searchBusinessesName,
			"data_businesses.id::text": searchBusinessesId
		});

		applyFiltersToQuery(subquery, {
			"data_businesses.id": searchFilterBusinessId,
			"rel_business_customer_monitoring.external_id": searchFilterExternalId
		});
	});
	/************************************************/

	/** Handle query.filter_date */
	/*****************************/
	const dateFilterBusinessesCreatedAt = query.filter_date?.["data_businesses.created_at"];
	applyDateFiltersToQuery(baseQuery, {
		"data_businesses.created_at": dateFilterBusinessesCreatedAt
	});
	/*****************************/

	/**
	 * Begin throwable logic. It is not expected that any errors before this point will be thrown.
	 */
	try {
		/**
		 * Handle count query
		 */
		const countQuery = baseQuery.clone();
		countQuery.clearSelect();
		countQuery.countDistinct("data_businesses.id", { as: "totalcount" });

		const countResult = await countQuery.first();
		const totalcount = parseInt(countResult?.totalcount || "0", 10);

		/** Handle query.search (sorting) */
		/**********************************/

		/**
		 * This is here to ensure that closer matches for the given search terms are sorted before less relevant matches.
		 * e.g. if the search term is "Acme Corp", businesses with the name "Acme Corp" will be sorted before "Acme Widgets".
		 *
		 * This should be done *after* the count query to avoid SQL errors such as: `column X must appear in the GROUP BY
		 * clause or be used in an aggregate function [...]`, but before any other sorting logic to ensure that the closer
		 * matches are still prioritized correctly.
		 */
		applySearchSortsToQuery(baseQuery, {
			"data_businesses.name::text": searchBusinessesName,
			"data_businesses.id::text": searchBusinessesId
		});
		/**********************************/

		/** Handle query.sort */
		/**********************/
		const sortBusinessesCreatedAt = query.sort?.["data_businesses.created_at"];
		const sortBusinessesName = query.sort?.["data_businesses.name"];

		if (sortBusinessesName) {
			applySortsToQuery(baseQuery, {
				"data_businesses.name": sortBusinessesName
			});
		} else {
			/**
			 * This is the default sort if no sort is provided.
			 */
			applySortsToQuery(baseQuery, {
				"data_businesses.created_at": sortBusinessesCreatedAt || "DESC"
			});
		}
		/**********************/

		/** Handle query.pagination */
		/****************************/
		const paginationDetails = applyPaginationToQuery(baseQuery, query, totalcount);
		/****************************/

		/**
		 * Execute main query with pagination applied.
		 */
		const rows = await baseQuery;

		/**
		 * Mask the TINs in the response.
		 */
		rows.forEach(row => {
			if (row.tin) {
				if (hasPermission) {
					row.tin = decryptAndMaskTin(row.tin);
				} else {
					row.tin = null;
				}
			}
		});

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
