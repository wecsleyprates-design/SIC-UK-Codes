import { INTEGRATION_ID } from "#constants/integrations.constant";
import { decryptData } from "#utils/encryption";
import BankAccount from "#api/v1/modules/banking/models/bankAccount";
import type IBanking from "#api/v1/modules/banking/types";

/**
 * Removes duplicate bank accounts when fetching bank accounts for a business, preferring Plaid versions over manual ones
 * @param bankAccounts - Array of bank account records
 * @returns Promise<BankAccount[]> - Deduplicated array of bank accounts
 */
export const deduplicateBankAccounts = async (bankAccounts: BankAccount[]): Promise<BankAccount[]> => {
	const accountMap = new Map<string, BankAccount>();

	for (const accountRecord of bankAccounts) {
		const account = accountRecord.getRecord();
		let decryptedAccountNumber: string = "";
		let decryptedRoutingNumber: string = "";

		// Create a key to identify duplicate bank accounts using the pattern: bank_account + routing_number + bank_subtype + mask
		try {
			decryptedAccountNumber = account.bank_account ? decryptData(account.bank_account) : "";
		} catch (error) {
			decryptedAccountNumber = account.bank_account || "";
		}
		try {
			decryptedRoutingNumber = account.routing_number ? decryptData(account.routing_number) : "";
		} catch (error) {
			decryptedRoutingNumber = account.routing_number || "";
		}

		const key = `${decryptedAccountNumber}_${decryptedRoutingNumber}_${account.subtype || "unknown"}_${account.mask || "no_mask"}`;

		// If this is the first account with this key, store it
		if (!accountMap.has(key)) {
			accountMap.set(key, accountRecord);
		} else {
			const existingAccount = accountMap.get(key)!;
			const existingAccountData = existingAccount.getRecord();

			// If the new account is Plaid and the existing one is not, overwrite the key/account pair with the new account
			// i.e. prefer Plaid accounts over manual accounts
			if (account.platform_id === INTEGRATION_ID.PLAID && existingAccountData.platform_id !== INTEGRATION_ID.PLAID) {
				accountMap.set(key, accountRecord);
			} else if (account.platform_id === existingAccountData.platform_id) {
				// Tie-breaker when both are from the same platform: prefer the most recently created account
				const accountCreatedAt = account.created_at ? new Date(account.created_at).getTime() : 0;
				const existingCreatedAt = existingAccountData.created_at ? new Date(existingAccountData.created_at).getTime() : 0;
				if (accountCreatedAt > existingCreatedAt) {
					accountMap.set(key, accountRecord);
				}
			}
		}
	}

	return Array.from(accountMap.values());
};

/**
 * @name normalizePlaidLinkedBankAccounts
 * @desc Centralizes deduplication logic for Plaid linked bank accounts. Plaid linked bank accounts are currently stored in the
 * bank_accounts table across multiple records - one reflects the Plaid asset report and is not stored with a 
 * bank account number nor a routing number. This function normalizes the data by combining the records into a single record
 * using the bank_name, official_name, and institution_name as a unique identifier. Manual accounts without these fields are skipped.
 * @param {any[]} bankAccounts - Array of bank account records
 * @returns {any[]} bankAccountsCombined - Array of normalized bank account records
 */
export const normalizePlaidLinkedBankAccounts = (bankAccounts: IBanking.BankingResponse[]): IBanking.BankingResponse[] => {
    if (!bankAccounts || !bankAccounts.length) return [];
    const sortedAccounts = [...bankAccounts].sort(
        (a, b) => Number(a.institution_name === "ACH") - Number(b.institution_name === "ACH")
    );
    const bankAccountsCombined = sortedAccounts.reduce((acc: Record<string, IBanking.BankingResponse>, record) => {
		if (!record.bank_name) {
			acc[record.id] = { ...record };
		}
		else {
			const key = `${record.bank_name}-${record.official_name ?? ""}-${record.institution_name}`;
			let keysToUpdate: string[] = [];
			if (record.institution_name === "ACH") {
				keysToUpdate = Object.keys(acc)
				.filter(k => k.includes(`${record.bank_name}-${record.official_name ?? ""}`));
			}
			if (!acc[key] && keysToUpdate.length === 0) {
				acc[key] = { ...record };
			} else {
				keysToUpdate.forEach(k => {
					acc[k] = {
						...acc[k],
						routing_number: record.routing_number,
						wire_routing_number: record.wire_routing_number,
						is_selected: acc[k].is_selected || record.is_selected,
						verification_status: record.verification_status,
						deposit_account: acc[k].deposit_account || record.deposit_account,
						depositAccountInfo: record.depositAccountInfo,
						verification_result: record.verification_result,
						ach_account_id: record.id,
						bank_account: record.bank_account,
						// routing and wire_routing are the raw routing numbers, while
						// routing_number and wire_routing_number are encrypted UUIDs
						routing: record.routing ?? undefined,
						wire_routing: record.wire_routing ?? undefined,
					};
				});
			}
		}
        return acc;
    }, {});
    return Object.values(bankAccountsCombined);
};