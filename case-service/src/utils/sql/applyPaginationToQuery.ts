import { Knex } from "knex";
import { paginate } from "#utils/paginate";
import { PaginationMaxRangeError } from "#errors";

type PaginationQueryParams = {
	pagination?: string;
	items_per_page?: number;
	page?: number;
};

export const applyPaginationToQuery = (
	baseQuery: Pick<Knex.QueryBuilder, "limit" | "offset">,
	queryParams: PaginationQueryParams,
	totalCount: number
) => {
	/**
	 * Handle pagination
	 */
	let pagination = true;
	if (queryParams.pagination) pagination = JSON.parse(queryParams.pagination);

	let itemsPerPage = 20;
	let page = 1;

	if (pagination) {
		if (queryParams.items_per_page) itemsPerPage = queryParams.items_per_page;
		if (queryParams.page) page = queryParams.page;
	}

	if (!pagination) itemsPerPage = totalCount;

	const paginationDetails = paginate(totalCount, itemsPerPage);
	if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
		throw new PaginationMaxRangeError();
	}

	if (pagination) {
		const skip = (page - 1) * itemsPerPage;
		baseQuery.limit(itemsPerPage).offset(skip);
	}

	return paginationDetails;
};
