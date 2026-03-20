import { Rutter } from "../rutter";

class Freshbooks extends Rutter {
	constructor(connection?) {
		super(connection);
	}

	/* Accounts, Expenses, & Bank details not implemented in FreshBooks */
	async getAccounts(): Promise<any> {
		return Promise.resolve({ error: "Freshbooks does not support Accounts" });
	}
	async getExpenses(): Promise<any> {
		return Promise.resolve({ error: "Freshbooks does not support Expenses" });
	}
	async getBankDeposits(): Promise<any> {
		return Promise.resolve({ error: "Freshbooks does not support Bank Deposits" });
	}
	async getBankTransfers(): Promise<any> {
		return Promise.resolve({ error: "Freshbooks does not support Bank Transfers" });
	}
}

module.exports = Freshbooks;
