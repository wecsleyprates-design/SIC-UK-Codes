import { UUID } from "crypto";
import { AccountingRest } from "./accountingRest";

export type ReportTable = (typeof AccountingRest.VALID_REPORT_TABLES)[number];
export type ObjectTable = (typeof AccountingRest.VALID_OBJECT_TABLES)[number];
export type ObjectRequest = GetParams & { object: ObjectTable };
export type ReportRequest = GetParams & { report: ReportTable };

export type ReportResponse = IAccountingResponse & Partial<ReportTableKeys>;
export type ObjectResponse = IAccountingResponse & Partial<ObjectTableKeys>;
export interface IObjectTableContents {
	table: string;
	columns: string[];
	whereColumns: string[];
}
export interface IValidation {
	object?: ObjectTable;
	report?: ReportTable;
	page?: number;
	limit?: number | "all";
	params: Partial<Parameters>;
}
type Parameters = {
	groupBy?: "year" | "month";
	orderBy: "start_date" | "end_date" | "id" | string | number;
	orderDirection: "asc" | "desc";
	limit: number | "all";
	id: UUID;
	start_date: string;
	end_date: string;
} & {
	[key: string]: any;
};

type GetBusinessParams = {
	business_id: UUID;
	case_id?: UUID;
};
type GetCaseParams = {
	case_id: UUID;
	business_id?: UUID;
};
type GetParams = (GetBusinessParams | GetCaseParams) & {
	task_id?: UUID;
	page?: number;
	params?: Partial<Parameters>;
};
type ReportTableKeys = {
	[key in ReportTable]: any[] | any;
};
type ObjectTableKeys = {
	[key in ObjectTable]: any[] | any;
};

interface IAccountingResponse {
	count?: number;
	page?: number;
	total?: number;
}

export type RevokeTaxStatusParams = {
	businessID: UUID;
};

export type RevokeTaxStatusQuery = {
	invitation_id?: UUID;
};

export interface RevokeTaxStatusHeaders {
	authorization: string;
}

export interface RevokeTaxStatusUserInfo {
	user_id: string;
}

export type RevokeAccountingParams = {
	businessID: UUID;
};

export type RevokeAccountingBody = {
	platforms: [
		{
			platform: string;
		}
	];
	invitation_id?: string;
};

export interface RevokeAccountingHeaders {
	authorization: string;
}

export interface RevokeAccountingUserInfo {
	user_id: string;
}

export interface AddAccountingBody {
	case_id: UUID;
	customer_id?: UUID | null;
	validation_ocr_document_ids: UUID[];
}

export interface IUploadedStatement {
	file_name: string;
	file_url: string;
	file_path: string;
	id: UUID;
}
