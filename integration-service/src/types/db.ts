import {
	ConnectionStatus,
	GiactVerificationStatus,
	GiactVerificationType,
	IdvStatusId,
	IntegrationCategory,
	IntegrationCategoryId,
	IntegrationPlatformId,
	ScoreTrigger,
	Strategy,
	TaskCode,
	TaskStatus
} from "#constants/integrations.constant";
import { Json, JsonObject } from "aws-jwt-verify/safe-json-parse";
import { UUID } from "crypto";
import { TDateISO } from "./datetime";
import type { IdentityVerification as PlaidIdentityVerification } from "plaid";

export type Count = {
	count: number;
};
/* Database related types */
export interface IRequestResponse<T = any> {
	request_id?: UUID; //not set until instantiated
	business_id: UUID;
	platform_id: IntegrationPlatformId | null;
	external_id?: string | null;
	request_type: string;
	requested_at?: TDateISO;
	connection_id?: UUID | null;
	response: T;
	org_id?: any;
	request_code?: any;
	async_key?: any;
	status?: any;
	idempotency_key?: any;
	request_received: TDateISO | Date;
}
export interface IDBConnectionEgg {
	business_id: UUID;
	platform_id: IntegrationPlatformId;
	configuration: any;
	connection_status: ConnectionStatus;
	created_at?: TDateISO;
	strategy?: Strategy;
}
export interface IBusinessScoreTriggerEgg {
	business_id: UUID;
	trigger_type: ScoreTrigger;
	version: number;
	customer_id?: UUID;
	applicant_id?: UUID;
	created_at?: TDateISO;
}
interface fromEgg {
	id: UUID;
	updated_at?: TDateISO | Date;
}
export interface IIdentityVerification<T = PlaidIdentityVerification> {
	id: UUID;
	business_integration_task_id: UUID;
	business_id: UUID;
	platform_id: IntegrationPlatformId;
	external_id: string;
	created_at: TDateISO;
	updated_at?: TDateISO;
	applicant_id: UUID;
	meta: T;
	status: IdvStatusId;
	template_id?: number | null;
	shareable_url?: string | null;
	document_s3_keys?: { front?: string; back?: string } | null;
	documents_uploaded_at?: TDateISO | null;
}
export interface IIdentityVerificationEgg<T = PlaidIdentityVerification>
	extends Omit<IIdentityVerification<T>, "id" | "updated_at" | "created_at"> {
	created_at?: TDateISO;
}

export interface BusinessScoreTrigger extends IBusinessScoreTriggerEgg, fromEgg {
	created_at: TDateISO;
}
export interface IDBConnection extends IDBConnectionEgg, fromEgg {
	created_at: TDateISO;
	updated_at: TDateISO;
}

interface AccountingFields {
	id?: UUID;
	business_integration_task_id: UUID;
	business_id: UUID;
	platform_id: IntegrationPlatformId;
	external_id: string | null;
	start_date: TDateISO;
	end_date: TDateISO;
	currency: string;
	meta: JsonObject;
	created_at: TDateISO;
	updated_at: TDateISO;
}
export interface IAccountingBalanceSheet extends AccountingFields {
	total_assets: number;
	total_equity: number;
	total_liabilities: number;
	assets: Json;
	equity: JsonObject;
	liabilities: JsonObject;
}
export interface IAccountingIncomeStatement extends AccountingFields {
	accounting_standard?: number;
	net_income?: number;
	total_revenue?: number;
	total_depreciation?: number;
	total_expenses?: number;
	total_cost_of_goods_sold?: number;
	revenue?: JsonObject | number;
	expenses?: JsonObject;
	cost_of_sales?: JsonObject;
}
export interface IAccountingCashFlows extends AccountingFields {
	starting_balance: number;
	ending_balance: number;
	net_flow?: number;
	gross_cash_in?: number;
	gross_cash_out?: number;
	total_operating_activities?: number;
	total_investing_activities?: number;
	total_financing_activities?: number;
	operating_activities?: JsonObject;
	investing_activities?: JsonObject;
	financing_activities?: JsonObject;
}
export interface IAccountingBusinessInfo {
	id: UUID;
	business_integration_task_id: UUID;
	business_id: UUID;
	platform_id: IntegrationPlatformId;
	external_id?: string;
	display_name?: string;
	currencies?: string[];
	legal_name?: string;
	tin?: string;
	addresses?: any;
	country?: string;
	state?: string;
	city?: string;
	phone?: string;
	fax?: string;
	email?: string;
	postal?: string;
	meta?: any;
	created_at?: TDateISO;
	updated_at?: TDateISO;
}

export type AccountType =
	| "accounts_payable"
	| "accounts_receivable"
	| "bank"
	| "fixed_asset"
	| "other_asset"
	| "other_current_asset"
	| "liability"
	| "equity"
	| "expense"
	| "other_expense"
	| "income"
	| "other_income"
	| "credit_card"
	| "cost_of_goods_sold"
	| "other_current_liability"
	| "long_term_liability"
	| "non_posting"
	| "unknown";

export type AccountingStatus = "active" | "inactive" | "pending";

export type AccountingCategory = "asset" | "expense" | "equity" | "liability" | "income" | "nonposting" | "unknown";

export type Account = {
	id: string;
	platform_id: string;
	name: string;
	nominal_code: string | null;
	balance: number;
	category: AccountingCategory;
	status: AccountingStatus;
	account_type: AccountType;
	currency_code: string;
	parent_id: string | null;
	subsidiaries: Array<any>;
	created_at: TDateISO;
	updated_at: TDateISO;
	last_synced_at: string;
	platform_url: string;
};

export interface IAccountingAccounts extends Omit<AccountingFields, "updated_at"> {
	balance: number;
	category: AccountingCategory;
	status: AccountingStatus;
	account_type: AccountType;
	updated_at?: TDateISO;
}

export interface IAccountingTaskEgg {
	id: UUID;
	task_id: UUID;
	created_at?: TDateISO;
}
export interface IAccountingTask extends IAccountingTaskEgg {
	created_at: TDateISO;
}
export interface IBusinessIntegrationTaskEgg<T = any> {
	connection_id: UUID;
	integration_task_id: number;
	business_score_trigger_id?: UUID | null;
	task_status: TaskStatus;
	reference_id?: string;
	metadata?: T;
	created_at?: TDateISO | Date;
}
export interface IBusinessIntegrationTask<T = any> extends IBusinessIntegrationTaskEgg<T>, fromEgg {
	created_at: TDateISO | Date;
	updated_at: TDateISO | Date;
}

export interface IBusinessIntegrationTaskEventEgg<T = any> {
	business_integration_task_id: IBusinessIntegrationTask["id"];
	task_status: TaskStatus;
	log?: T;
}
export interface IBusinessIntegrationTaskEvent<T = any> extends IBusinessIntegrationTaskEventEgg<T>, fromEgg {
	created_at: TDateISO | Date;
}
export interface ICoreTasks {
	id: number;
	code: TaskCode;
	label: string;
	created_at?: TDateISO;
}
export interface ICoreIntegrationsPlatforms {
	id: IntegrationPlatformId;
	code: string;
	label: string;
	category_id: IntegrationCategoryId;
	created_at?: TDateISO;
}

export interface IRelTasksIntegrations {
	id: number;
	task_category_id: ICoreTasks["id"];
	platform_id: ICoreIntegrationsPlatforms["id"];
}

export interface IBusinessIntegrationTaskEnriched<T = any> extends IBusinessIntegrationTask<T> {
	business_id: IDBConnection["business_id"];
	platform_id: ICoreIntegrationsPlatforms["id"];
	platform_code: ICoreIntegrationsPlatforms["code"];
	platform_category_code: IntegrationCategory;
	task_code: TaskCode;
	task_label: ICoreTasks["label"];
	trigger_type?: ScoreTrigger;
	trigger_version?: number;
	customer_id?: UUID;
	case_id?: UUID;
}

export interface IBureauCreditScore {
	id?: UUID;
	business_integration_task_id: UUID;
	business_id: UUID;
	platform_id: IntegrationPlatformId;
	external_id: string | null;
	as_of: TDateISO | null;
	score: number | null;
	meta: any;
	created_at?: TDateISO;
	updated_at?: TDateISO;
}

// #region Business Entity Verification tables
export interface IBusinessEntityVerification {
	id: UUID;
	created_at: TDateISO;
	updated_at: TDateISO;
	business_integration_task_id: UUID;
	/** vendor business_id */
	external_id: string;
	business_id: string;
	name: string;
	/** 'open' | 'in_review' where 'in_review' from our current vendor means approved for us. */
	status: string;
	tin: string | null;
	formation_state?: string;
	formation_date?: TDateISO;
	unique_external_id?: UUID | string | null;
}

type TaskKey =
	| "address_deliverability"
	| "address_property_type"
	| "address_registered_agent"
	| "address_verification"
	| "bankruptcies"
	| "entity_type_match"
	| "industry"
	| "name"
	| "person_verification"
	| "sos_active"
	| "sos_domestic"
	| "sos_domestic_sub_status"
	| "sos_inactive"
	| "sos_match"
	| "sos_not_found"
	| "sos_unknown"
	| "tin"
	| "tin_error"
	| "tin_issued"
	| "watchlist";
export interface IBusinessEntityReviewTask {
	id: UUID;
	business_entity_verification_id: UUID;
	created_at: TDateISO;
	updated_at: TDateISO;
	category: string;
	key: TaskKey;
	status: "success" | "failure" | "warning" | undefined;
	message: string;
	label: string;
	sublabel: string;
	metadata:
		| Array<{
				id: UUID;
				type: string;
		  }>
		| any;
}

export interface IBusinessEntityRegistration {
	id: UUID;
	business_entity_verification_id: UUID;
	created_at: TDateISO;
	updated_at: TDateISO;
	/** vendor registration_id */
	external_id: UUID;
	name: string;
	status: string;
	sub_status: string;
	status_details: string;
	jurisdiction: string;
	entity_type: string;
	file_number: string;
	full_addresses: Array<string>;
	/** example: 2024-01-30 */
	registration_date: string;
	registration_state: string;
	source: string;
}

export interface IBusinessEntityAddressSource {
	id: UUID;
	business_entity_verification_id: UUID;
	created_at: TDateISO;
	updated_at: TDateISO;
	/** vendor address_id */
	external_id: UUID;
	/** this informs which (if any) secretary of state filling this 'business address' was associated with */
	external_registration_id?: UUID | null;
	full_address: string;
	address_line_1: string;
	address_line_2?: string;
	city: string;
	state: string;
	country: string;
	postal_code: string;
	lat: number;
	long: number;
	submitted: boolean;
	deliverable: boolean;
	/** Commercial Mail Receiving Agency */
	cmra: boolean;
	address_property_type: string;
}

export interface IBusinessEntityPerson {
	id: UUID;
	business_entity_verification_id: UUID;
	created_at: TDateISO;
	updated_at: TDateISO;
	/** vendor person_id */
	name: string;
	submitted: boolean;
	metadata: any;
	source: any;
	titles: string[];
}

export interface IBusinessEntityName {
	id: UUID;
	business_entity_verification_id: UUID;
	created_at: TDateISO;
	updated_at: TDateISO;
	name: string;
	submitted: boolean;
	metadata: any;
	source: any;
	type: string;
}

export interface SqlQueryResult {
	rows: any[];
}

export type SqlTransactionResult = SqlQueryResult[];

export interface IRelBankingVerfication {
	id?: UUID;
	bank_account_id: UUID;
	case_id: UUID;
	giact_verify_response_code_id: number | null;
	giact_authenticate_response_code_id: number | null;
	verification_status: GiactVerificationStatus;
	meta: any;
	created_at?: TDateISO;
	updated_at?: TDateISO;
}

export interface ICoreGiactResponseCodes {
	id: number;
	verification_type: GiactVerificationType;
	name: string;
	code: string;
	description: string;
	verification_response: string;
	response_code: number;
	created_at?: TDateISO;
}

export interface ICoreIdentityVerificationTemplates {
	id: number;
	name: string;
	template_id: string;
	steps: string;
	platform: "sandbox" | "production";
	created_at?: TDateISO;
	updated_at?: TDateISO;
}
// #endregion
