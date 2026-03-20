import { TDateISO } from "#types/datetime";
import { IDBConnection } from "#types/db";
import { JsonObject } from "aws-jwt-verify/safe-json-parse";

export type AccountingPlatformEnum = "QUICKBOOKS" | "FRESHBOOKS" | "QUICKBOOKS_DESKTOP" | "ZOHOBOOKS" | "PLAID" | "XERO" | "NETSUITE";
export type CommercePlatformEnum = "SHOPIFY" | "STRIPE" | "AMAZON" | "EBAY" | "SHOPEE" | "SQUARE" | "LAZADA";
export type PlatformEnum = AccountingPlatformEnum | CommercePlatformEnum;
export type APIVersion = "2023-03-14" | "2023-02-07";

export interface ITokenExchangeRequest extends JsonObject {
	client_id: string;
	secret: string;
	public_token: string;
}
export interface ITokenExchangeResponse {
	connection_id: UUID;
	access_token: string;
	is_ready: boolean;
	platform: PlatformEnum;
	store_unique_name: string;
}
interface IResponseConnection {
	id: UUID;
	orgId: UUID;
	platform: PlatformEnum;
}
export type GenericResponse = Omit<JsonObject, ObjectType> & { [K in Lowercase<ObjectType>]?: any[] } & {
	connection?: IResponseConnection;
};

export type PaginatedResponse<T> = GenericResponse & {
	next_cursor?: string;
};

type WebhookCode = "INITIAL_UPDATE" | "HISTORICAL_UPDATE" | "CONNECTION_UPDATED" | "CONNECTION_NEEDS_UPDATE" | "CONNECTION_DISABLED" | "CONNECTION_LINK_ERROR" | "CONNECTION_ERROR" | "JOB_COMPLETED";

export type ObjectType = (typeof rutterObjectTypes)[number];

interface IWebhookBody {
	type: Uppercase<ObjectType> | "CONNECTION";
	code: WebhookCode;
	access_token: UUID;
	connection_id: UUID;
}
export type ResponseBody = IWebhookBody & {};
export type WebhookBody = IWebhookBody & {
	[K in Lowercase<ObjectType>]?: JsonObject[];
};

export interface IHeaders {
	"X-Rutter-Version": APIVersion;
}

/** db  layer  **/
export type RutterDBConnection = IDBConnection & { configuration: RutterConnectionConfiguration };
export type RutterConnectionConfiguration = IDBConnection["configuration"] & {
	access_token: string;
	id: string;
	platform: PlatformEnum;
};

export interface IDBResponse {
	request_id: number;
	connection_id: UUID;
	organization_id: UUID;
	request_type: string; //TODO: make type
	requested_at: TDateISO;
	response: JsonObject;
	response_recieved: TDateISO | null;
	idempotency_key?: UUID;
	async_key?: UUID;
}

type UUID = string;

/* specific response types */
/**
 * /company_info
 */
export type CompanyInfo = GenericResponse & {
	connection: IResponseConnection;
	company_info: {
		id: UUID;
		currency_code: string;
		name: string;
		addresses: string[];
		legal_name: string;
		created_at: TDateISO;
		updated_at: TDateISO;
		platform_data?: JsonObject;
	};
};
export type Connection = {
	id: UUID;
	store_unique_id: string;
	estimated_completed_at: TDateISO | null;
	last_sync_completed_at: TDateISO | null;
	last_sync_started_at: TDateISO | null;
	oldest_ordedr_date: TDateISO | null;
	newest_order_date: TDateISO | null;
	disabled: boolean;
	link_url: string;
	needs_update: boolean;
	platform: PlatformEnum;
	initial_orders_synced_count?: number;
	store_domain: string | null;
	store_name: string | null;
	created_at?: TDateISO | null;
};
interface IConnectionStatus {
	connection: IResponseConnection;
	status: {
		platform: PlatformEnum;
		needs_update_status: {
			needs_update: boolean;
		};
		disabled_status: {
			is_disabled: boolean;
			disabled_reason: string | null;
			historical_sync_status: JsonObject;
		};
		is_ready: boolean;
		link_url: string;
		created_at: TDateISO;
		last_sync_completed_at: TDateISO;
	};
}

export type ConnectionStatusResponse = IConnectionStatus & GenericResponse;
/**
 * Job complete webhook
 */
type JobStatus = "prequeued" | "pending" | "success" | "failure" | "partial_success";
export interface IJobCompleteWebhook {
	type: "JOB";
	code: "JOB_COMPLETED";
	job: {
		id: UUID;
		status: JobStatus;
		request: {
			url: string;
			method: "POST";
			body: JsonObject;
		};
		response: {
			http_status: number;
			body: JsonObject;
		};
	};
}

/* Balance Sheet */
interface LineItem extends JsonObject {
	account_id: number;
	name: string;
	value: number;
	items: LineItem[];
}
export interface IBalanceSheet {
	id: UUID;
	start_date: TDateISO;
	end_date: TDateISO;
	currency_code: string;
	total_assets: number;
	total_equity: number;
	total_liabilities: number;
	assets: LineItem[];
	equity: LineItem[];
	liabilities: LineItem[];
	created_at: TDateISO;
	updated_at: TDateISO;
	platform_data: JsonObject;
}
export interface IIncomeStatement {
	id: UUID;
	start_date: TDateISO;
	end_date: TDateISO;
	accounting_standard: "cash" | "accrual" | "unknown";
	currency_code: string;
	gross_profit: number;
	net_income: number;
	total_cost_of_sales: number;
	total_expenses: number;
	total_income: number;
	net_operating_income: number;
	expenses: LineItem[];
	income: LineItem[];
	cost_of_sales: LineItem[];
	created_at: TDateISO;
	updated_at: TDateISO;
	platform_data: JsonObject;
}
export interface ICashFlowStatement {
	id: UUID;
	start_date: TDateISO;
	end_date: TDateISO;
	currency_code: string;
	ending_balance: number;
	starting_balance: number;
	total_financing: number;
	total_investing: number;
	total_operating: number;
	gross_cash_in_flow: number;
	gross_cash_out_flow: number;
	financing_activities: LineItem[];
	investing_activities: LineItem[];
	operating_activities: LineItem[];
	created_at: TDateISO;
	updated_at: TDateISO;
	platform_data: JsonObject;
}

export type BalanceSheet = PaginatedResponse<GenericResponse | { balance_sheets: IBalanceSheet[] }>;
export type IncomeStatement = PaginatedResponse<GenericResponse | { income_statements: IIncomeStatement[] }>;
export type CashFlow = PaginatedResponse<GenericResponse | { cash_flows: ICashFlowStatement[] }>;

/* Data that generates literals */
export const rutterObjectTypes = [
	"account",
	"accounts",
	"balance_sheets",
	"bank_deposits",
	"bank_transfers",
	"bill_payment",
	"bill",
	"cash_flows",
	"company_info",
	"customer",
	"expenses",
	"income_statements",
	"invoice_credit_memo",
	"invoice",
	"job",
	"journal_entry",
	"order",
	"product",
	"report",
	"store",
	"vendor"
] as const;
