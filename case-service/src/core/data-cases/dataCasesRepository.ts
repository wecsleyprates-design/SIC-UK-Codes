/**
 * Data access for data_cases. DB queries only; no business logic.
 */

import { db } from "#helpers";
import type { UUID } from "crypto";
import type { DataCase, GetCaseParams } from "./types";

export interface DataCaseIdAndCustomerRow {
	id: UUID;
	customer_id: UUID;
}

export interface GetCaseByBusinessParams {
	businessId: string;
	caseId?: string;
	applicantId?: string;
}

/**
 * Fetches the first matching data_cases row for the given params (column names, snake_case).
 * Undefined params are ignored. Result is ordered by created_at desc.
 * Caller example:
 *   const getCaseParams: GetCaseParams = { business_id: "456" };
 *   if (caseId) getCaseParams.id = caseId;
 *   if (applicantId) getCaseParams.applicant_id = applicantId;
 *   const dataCase = await getCase(getCaseParams);
 *   const idAndCustomer: Pick<DataCase, "id" | "customer_id"> | undefined = dataCase;
 */
export async function getCase(params: GetCaseParams): Promise<DataCase | undefined> {
	const query = db<DataCase>("data_cases").select("*");
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined) query.andWhere(key, value);
	});
	return query.orderBy("created_at", "desc").first();
}
