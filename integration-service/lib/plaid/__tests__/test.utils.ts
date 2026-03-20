import type IBanking from "#api/v1/modules/banking/types";
import { AssetReportTransaction } from "plaid";

/* Some testing structures for plaid */

export const generateWorthAccounts = (num: number) => {
	const out: IBanking.BankAccountRecord[] = [];
	for (let i = 0; i < num && i < 31; i++) {
		out.push({
			id: `existing-account-id-${i}`,
			institution_name: "Plaid Bank",
			business_integration_task_id: "task-id",
			bank_account: `plaid-account-id-${i}`,
			bank_name: "Plaid Bank",
			official_name: "Plaid Bank",
			mask: `00${i.toString().padStart(2, "0")}`,
			balance_available: i,
			balance_current: i,
			balance_limit: 100,
			currency: "USD",
			type: "depository",
			subtype: "checking",
			created_at: "2022-01-01",
			updated_at: "2022-01-01"
		});
	}
	return out;
};
export const generateWorthTransactions = (num: number, worthBankAccountId: string): IBanking.BankAccountTransactionRecord[] => {
	const out: IBanking.BankAccountTransactionRecord[] = [];
	for (let i = 0; i < num && i < 31; i++) {
		out.push({
			id: `existing-transaction-id-${i}`,
			amount: i,
			date: `2022-01-${(i + 1).toString().padStart(2, "0")}`,
			description: `Transaction ${i + 1}`,
			category: "Food",
			payment_type: "Credit",
			transaction_id: `plaid-transaction-id-${i}`,
			bank_account_id: worthBankAccountId,
			business_integration_task_id: "task-id",
			created_at: "2022-01-01",
			updated_at: "2022-01-01",
			currency: "USD",
			is_pending: false,
			payment_metadata: null
		});
	}
	return out;
};

export const generatePlaidTransactions = (num: number, accountId: string): IBanking.ExtendedAssetReportTransaction[] => {
	const out: IBanking.ExtendedAssetReportTransaction[] = [];
	for (let i = 0; i < num && i < 31; i++) {
		out.push({
			account_id: accountId,
			iso_currency_code: "USD",
			transaction_id: `plaid-transaction-id-${i}`,
			amount: i,
			date: `2022-01-${(i + 1).toString().padStart(2, "0")}`,
			original_description: `Transaction ${i + 1}`,
			category: ["Food"],
			payment_type: "Credit",
			pending: false,
			unofficial_currency_code: null
		});
	}
	return out;
};
