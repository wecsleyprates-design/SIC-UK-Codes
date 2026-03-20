import type { TDateISO } from "#types/datetime";
import type { UUID } from "crypto";
import { AssetReportTransaction, AssetsProductReadyWebhook, ItemAddResultWebhook, LinkSessionFinishedWebhook } from "plaid";

export declare namespace IBanking {
	interface BankAccountEgg {
		business_integration_task_id: string | UUID;
		bank_account: string; // plaid's internal id
		bank_name: string;
		official_name: string;
		institution_name: string;
		verification_status?: string;
		balance_current: number;
		balance_available: number;
		balance_limit: number;
		currency: string;
		type: string;
		subtype?: string;
		mask: string;
		routing_number?: string;
		wire_routing_number?: string | null;
		account_holder_name?: string | null;
		account_holder_type?: string | null;
		deposit_account?: boolean;
		is_selected?: boolean;
		is_additional_account?: boolean;
	}
	interface BankAccountRecord extends BankAccountEgg, Record {}

	export interface BankingResponse extends BankAccountRecord {
		average_balance: number;
		transactions: IBanking.BankAccountTransactionRecord[];
		balances: IBanking.BankAccountBalanceRecord[];
		verification_result?: IBanking.BankAccountVerificationRecord | null;
		match: boolean;
		depositAccountInfo?: any | null;
		routing?: string; // decrypted routing number
		wire_routing?: string | null; // decrypted wire routing number
		ach_account_id?: string; // added during normalization
	}

	interface BankAccountBalanceEgg {
		bank_account_id: string | UUID; // BankAccountRecord.id
		business_integration_task_id: string | UUID;
		month: number;
		year: number;
		balance: number;
		currency: string;
	}

	interface BankAccountBalanceRecord extends BankAccountBalanceEgg, Record {}

	interface BankAccountTransactionEgg {
		bank_account_id: string | UUID; // BankAccountRecord.id
		business_integration_task_id: string | UUID;
		transaction_id: string; // plaid's internal id
		date: TDateISO | string;
		amount: number;
		description: string;
		merchant_name?: string | null;
		payment_metadata: any;
		currency: string;
		payment_type: string;
		is_pending: boolean;
		category: string;
	}
	interface BankAccountTransactionRecord extends BankAccountTransactionEgg, Record {}

	interface BankAccountVerificationEgg {
		bank_account_id?: string | UUID; // BankAccountRecord.id
		case_id?: string | UUID;
		giact_verify_response_code_id?: number | null;
		giact_authenticate_response_code_id?: number | null;
		meta?: any;
		verification_status: string;
		gverify_response?: {
			name: string | null;
			code: string | null;
			description: string | null;
			verification_response: string | null;
		} | null;
		gauthenticate_response?: {
			name: string | null;
			code: string | null;
			description: string | null;
			verification_response: string | null;
		} | null;
	}
	interface BankAccountVerificationRecord extends BankAccountVerificationEgg, Record {}

	interface BankAccountBalanceDailyEgg {
		bank_account_id: string | UUID; // BankAccountRecord.id
		date: Date;
		current: number;
		available: number | null;
		currency: string;
	}

	interface BankAccountBalanceDailyRecord extends BankAccountBalanceDailyEgg, Record {}

	interface Record {
		id: string | UUID;
		created_at: string;
		updated_at?: string;
	}

	type ExtendedAssetsProductReadyWebhook = AssetsProductReadyWebhook & {
		error?: any;
	};

	type ExtendedAssetReportTransaction = AssetReportTransaction & {
		payment_type?: string;
	};

	type ExtendedLinkSessionFinishedWebhook = LinkSessionFinishedWebhook & {
		error?: any;
	};

	type ExtendedItemAddResultWebhook = ItemAddResultWebhook & {
		error?: any;
	};

	type AccessTokenConfigurationObject = {
		access_token: string;
		item_id: string;
		request_id: string;
		asset_report_token: string;
	};

	interface TaskBankAccounts {
		business_integration_task_id: string | UUID;
		bank_account_id: string[] | UUID[];
	}
}
export enum BankingTaskAction {
	"CREATE_ASSET_REPORT" = "CREATE_ASSET_REPORT",
	"REFRESH_ASSET_REPORT" = "REFRESH_ASSET_REPORT"
}
export default IBanking;

export interface IAdditionalAccountInfoBody {
	accountData: {
		bank_name: string;
		official_name: string;
		bank_account: string;
		routing_number: string;
		subtype: string;
		account_holder_name: string | null;
		account_holder_type: string | null;
	};
	case_id: UUID;
}

export interface IAdditionalAccountInfoResponse {
	id: UUID;
	bank_account: string;
	routing_number: string;
	wire_routing_number: string | null;
	bank_name: string;
	official_name: string;
	institution_name: string;
	mask: string;
	type: string;
	subtype: string;
	account_holder_name: string | null;
	account_holder_type: string | null;
	verification_status: string;
}

export interface IAllBankingAccountsResponse extends IAdditionalAccountInfoResponse {
	is_additional_account: boolean;
	is_deposit_account: boolean;
}

export interface AddBankStatementBody {
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
