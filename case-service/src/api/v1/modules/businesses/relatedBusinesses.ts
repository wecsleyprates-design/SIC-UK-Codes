import { getReportStatusForBusiness, sqlQuery } from "#helpers";
import { paginate } from "#utils";
import { UUID } from "crypto";
import { CaseManagementApiError } from "../case-management/error";
import { StatusCodes } from "http-status-codes";
import { businesses } from "./businesses";
import { TIN_BEHAVIOR } from "#constants";

class RelatedBusinesses {
	/**
	 * @param body
	 * @returns report status of the case
	 */
	async _enrichBusinessReportStatus(body: any[], customer_id: string | null): Promise<any[]> {
		const businessIds: { id: UUID; status: string }[] = body.reduce((acc: any, row: any) => {
			acc.push({ id: row.id, status: row.case_status });
			return acc;
		}, []);

		const filteredBusinessIds = businessIds.filter(business => business?.id && business?.status);
		const reportStatus = await getReportStatusForBusiness(filteredBusinessIds, customer_id);

		// extract all report Status ids
		const mappedReportStatusCases = reportStatus.reduce((acc: any, row: any) => {
			acc[row.id] = { status: row.status, report_id: row.report_id, created_at: row.created_at };
			return acc;
		}, {});

		// map the report Status with the body
		return body.map(businessItem => {
			businessItem.report_status = mappedReportStatusCases[businessItem.id]?.status || null;
			businessItem.report_id = mappedReportStatusCases[businessItem.id]?.report_id || null;
			businessItem.report_created_at = mappedReportStatusCases[businessItem.id]?.created_at || null;
			return businessItem;
		});
	}

	/**
	 * @param {uuid} businessID  original businessId to fetch related businesses
	 * @param {uuid} customerID  customerId to filter businesses by customer
	 * @param {Object} query this contains payload sent from frontend
	 * @param {*} headers.authorization to fetch customerIDs search by customer name from auth-service
	 * @returns This api is used by admin for fetching all businesses that have related TINs
	 *
	 */
	async getRelatedBusinesses(params: { businessID: UUID; customerID: UUID }, query: Record<string, any>) {
		const DEFAULT_ITEMS_PER_PAGE = 20;
		const DEFAULT_PAGE = 1;
		const DEFAULT_SORT_PARAM = "db.created_at";
		const DEFAULT_SORT_ORDER = "DESC";
		const ALLOWED_SORT_PARAMS = ["db.name", "db.created_at"];

		const { businessID, customerID } = params;
		const pagination = Object.hasOwn(query, "pagination") ? JSON.parse(query.pagination) : true;
		const customerId = customerID || null;

		// Initialize pagination variables
		const itemsPerPage = pagination ? query.items_per_page || DEFAULT_ITEMS_PER_PAGE : 0;
		const page = pagination ? query.page || DEFAULT_PAGE : 1;

		// Parse sorting parameters
		const sortParam =
			query.sort && ALLOWED_SORT_PARAMS.includes(Object.keys(query.sort)[0])
				? Object.keys(query.sort)[0]
				: DEFAULT_SORT_PARAM;
		const sortParamValue = query.sort?.[sortParam] || DEFAULT_SORT_ORDER;

		const sort = ` ORDER BY ${sortParam} ${sortParamValue} `;
		const { tin } = await businesses.getBusinessByID({ businessID, tinBehavior: TIN_BEHAVIOR.ENCRYPT });

		// Build shared query components
		const lateralJoin = `
			LEFT JOIN LATERAL (
				SELECT dc.id, dc.status, dc.business_id, dc.customer_id
				FROM data_cases dc
				WHERE dc.business_id = db.id
				${customerId ? `AND dc.customer_id = $3` : ""}
				ORDER BY dc.created_at DESC
				LIMIT 1
			) dc ON true`;

		const baseWhereClause = ` WHERE db.is_deleted = false AND db.tin = $1 AND db.id != $2 `;
		const customerFilter = customerId ? ` AND dc.customer_id IS NOT NULL` : "";
		const values = customerId ? [tin, businessID, customerId] : [tin, businessID];

		// Build both queries using shared components
		const countQuery = `
			SELECT COUNT(*) 
			FROM data_businesses db
			${lateralJoin}
			${baseWhereClause}${customerFilter}`;

		let businessesQuery = `
			SELECT db.id, db.name, db.status, db.created_at, 
			       dc.id AS case_id, 
			       core_case_statuses.code AS case_status, 
			       dc.customer_id
			FROM data_businesses db
			${lateralJoin}
			LEFT JOIN core_case_statuses ON core_case_statuses.id = dc.status
			${baseWhereClause}${customerFilter}${sort}`;

		const countQueryResult = await sqlQuery({ sql: countQuery, values });

		const totalCount = parseInt(countQueryResult.rows[0].count);

		/**
		 * If the count query returned 0, there's no point in performing the regular query.
		 * Short-circuit here and return an empty array.
		 */
		if (!totalCount) {
			return { records: [], total_pages: 0, total_items: 0 };
		}

		const effectiveItemsPerPage = pagination ? itemsPerPage : totalCount;
		const paginationDetails = paginate(totalCount, effectiveItemsPerPage);

		if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
			throw new CaseManagementApiError("Page Requested is Out of Max Page Range", StatusCodes.BAD_REQUEST);
		}

		if (pagination) {
			const skip = (page - 1) * effectiveItemsPerPage;
			businessesQuery += ` LIMIT ${effectiveItemsPerPage} OFFSET ${skip}`;
		}

		const result = await sqlQuery({ sql: businessesQuery, values });
		const records = await this._enrichBusinessReportStatus(result.rows, customerId);

		return {
			records,
			total_pages: paginationDetails.totalPages,
			total_items: paginationDetails.totalItems
		};
	}

	async getRelatedBusinessByBusinessId(businessID: UUID, customerID: string | null = null) {
		const { tin } = await businesses.getBusinessByID({ businessID, tinBehavior: TIN_BEHAVIOR.ENCRYPT });

		const values = [tin];
		let businessesQuery = `SELECT db.id, db.name, db.status, db.created_at, dc.id AS case_id, core_case_statuses.code AS case_status, dc.customer_id FROM data_businesses db
			LEFT JOIN LATERAL (
				SELECT dc.id, dc.status, dc.business_id, dc.customer_id
				FROM data_cases dc
				WHERE dc.business_id = db.id`;

		if (customerID) {
			businessesQuery += ` AND dc.customer_id = $2`;
			values.push(customerID);
		}
		businessesQuery += `
				ORDER BY dc.created_at DESC
				LIMIT 1
			)  dc ON true
			LEFT JOIN core_case_statuses ON core_case_statuses.id = dc.status
			WHERE db.is_deleted = false AND db.tin = $1`;
		if (customerID) {
			businessesQuery += ` AND dc.customer_id IS NOT NULL `;
		}

		let result = await sqlQuery({ sql: businessesQuery, values: values });
		let records = result.rows;
		return records;
	}
}

export const relatedBusinesses = new RelatedBusinesses();
