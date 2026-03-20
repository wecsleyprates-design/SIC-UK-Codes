/**
 * GIACT display mapping: (category, response_code) → { tooltip, status }.
 * Used for case-tab-values endpoint (three rows: Account Status, Account Name, Contact Verification).
 * @see cursor/feature_docs/decisioning-results-on-case/05-giact-three-rows-render-architecture.md
 * @see cursor/feature_docs/decisioning-results-on-case/giact-values-codes.md
 */

import type { CaseTabValueStatus } from "./types";

export type GiactDisplayCategory = "giact_account_status" | "giact_account_name" | "giact_contact_verification";

export interface GiactDisplayEntry {
	tooltip: string;
	status: CaseTabValueStatus;
}

const MISSING_STATUS: CaseTabValueStatus = "missing";
const PASSED_STATUS: CaseTabValueStatus = "passed";
const FAILED_STATUS: CaseTabValueStatus = "failed";

const NOT_AVAILABLE = "Not yet available.";

/** Account Status (gVerify): response_code 0–22 → tooltip + status */
const ACCOUNT_STATUS_MAP: Record<number, GiactDisplayEntry> = {
	0: { tooltip: "There is no AccountResponseCode value for this result.", status: MISSING_STATUS },
	1: { tooltip: "The routing number supplied fails the validation test.", status: FAILED_STATUS },
	2: { tooltip: "The account number supplied fails the validation test.", status: FAILED_STATUS },
	3: { tooltip: "The check number supplied fails the validation test.", status: FAILED_STATUS },
	4: { tooltip: "The amount supplied fails the validation test.", status: FAILED_STATUS },
	5: { tooltip: "The account was found as active in your Private Bad Checks List.", status: FAILED_STATUS },
	6: { tooltip: "The routing number belongs to a reporting bank; however, no positive nor negative information has been reported on the account number.", status: PASSED_STATUS },
	7: { tooltip: "This account should be declined based on the risk factor being reported.", status: FAILED_STATUS },
	8: { tooltip: "This item should be rejected based on the risk factor being reported.", status: FAILED_STATUS },
	9: { tooltip: "Current negative data exists on this account. Accept transaction with risk. (Example: Checking or savings accounts in NSF status, recent returns, or outstanding items)", status: FAILED_STATUS },
	10: { tooltip: "Non-Demand Deposit Account (post no debits), Credit Card Check, Line of Credit, Home Equity, or a Brokerage check.", status: FAILED_STATUS },
	11: { tooltip: NOT_AVAILABLE, status: MISSING_STATUS },
	12: { tooltip: "The account was found to be an open and valid checking account.", status: PASSED_STATUS },
	13: { tooltip: "The account was found to be an American Express Travelers Cheque account", status: PASSED_STATUS },
	14: { tooltip: "This account was reported with acceptable, positive data found in current or recent transactions.", status: PASSED_STATUS },
	15: { tooltip: "The account was found to be an open and valid savings account.", status: PASSED_STATUS },
	16: { tooltip: NOT_AVAILABLE, status: MISSING_STATUS },
	17: { tooltip: NOT_AVAILABLE, status: MISSING_STATUS },
	18: { tooltip: NOT_AVAILABLE, status: MISSING_STATUS },
	19: { tooltip: "Negative information was found in this account's history.", status: FAILED_STATUS },
	20: { tooltip: "The routing number is reported as not currently assigned to a financial institution.", status: FAILED_STATUS },
	21: { tooltip: "No positive or negative information has been reported on the account.", status: PASSED_STATUS },
	22: { tooltip: "This routing number can only be valid for US Government financial institutions.", status: PASSED_STATUS },
};

/** Account Name (gAuthenticate): response_code 0–18 → tooltip + status */
const ACCOUNT_NAME_MAP: Record<number, GiactDisplayEntry> = {
	0: { tooltip: "Bank account is active, but name verification isn't currently available.", status: MISSING_STATUS },
	1: { tooltip: "Information submitted failed gAuthenticate.", status: FAILED_STATUS },
	2: { tooltip: "Customer authentication passed gAuthenticate.", status: PASSED_STATUS },
	3: { tooltip: "The customer or business name data did not match gAuthenticate data.", status: FAILED_STATUS },
	4: { tooltip: "Customer authentication passed. However, the customer's TaxId (SSN/ITIN) data did not match gAuthenticate data.", status: PASSED_STATUS },
	5: { tooltip: "Customer authentication passed. However, the customer's address data did not match gAuthenticate data.", status: PASSED_STATUS },
	6: { tooltip: "Customer authentication passed. However, the customer's phone data did not match gAuthenticate data.", status: PASSED_STATUS },
	7: { tooltip: "Customer authentication passed. However, the customer's date of birth or ID data did not match gAuthenticate data.", status: PASSED_STATUS },
	8: { tooltip: "Customer authentication passed. However, multiple contact data points did not match gAuthenticate data.", status: PASSED_STATUS },
	9: { tooltip: "Information submitted failed gIdentify/CustomerID.", status: FAILED_STATUS },
	10: { tooltip: "Bank account is active, but name verification isn't currently available.", status: MISSING_STATUS },
	11: { tooltip: "Customer identification passed gIdentify/CustomerID.", status: PASSED_STATUS },
	12: { tooltip: "The customer or business name data did not match gIdentify/CustomerID data.", status: FAILED_STATUS },
	13: { tooltip: "Customer authentication passed. However, the customer's TaxId (SSN/ITIN) data did not match gAuthenticate data.", status: PASSED_STATUS },
	14: { tooltip: "Customer authentication passed. However, the customer's address data did not match gAuthenticate data.", status: PASSED_STATUS },
	15: { tooltip: "Customer authentication passed. However, the customer's phone data did not match gAuthenticate data.", status: PASSED_STATUS },
	16: { tooltip: "Customer authentication passed. However, the customer's date of birth or ID data did not match gAuthenticate data.", status: PASSED_STATUS },
	17: { tooltip: "Customer authentication passed. However, multiple contact data points did not match gAuthenticate data.", status: PASSED_STATUS },
	18: { tooltip: "No data was found matching the owner information provided.", status: FAILED_STATUS },
};

/** Contact Verification (gAuthenticate): response_code 0–18 → tooltip + status */
const CONTACT_VERIFICATION_MAP: Record<number, GiactDisplayEntry> = {
	0: { tooltip: "Bank account is active, but name verification isn't currently available.", status: MISSING_STATUS },
	1: { tooltip: "Information submitted failed gAuthenticate.", status: FAILED_STATUS },
	2: { tooltip: "Customer authentication passed gAuthenticate.", status: PASSED_STATUS },
	3: { tooltip: "The customer or business name data did not match gAuthenticate data.", status: FAILED_STATUS },
	4: { tooltip: "The customer's TaxId (SSN/ITIN) data did not match gAuthenticate data.", status: FAILED_STATUS },
	5: { tooltip: "The customer's address data did not match gAuthenticate data.", status: FAILED_STATUS },
	6: { tooltip: "The customer's phone data did not match gAuthenticate data.", status: FAILED_STATUS },
	7: { tooltip: "The customer's date of birth or ID data did not match gAuthenticate data.", status: FAILED_STATUS },
	8: { tooltip: "Multiple contact data points did not match gAuthenticate data.", status: FAILED_STATUS },
	9: { tooltip: "Information submitted failed gIdentify/CustomerID.", status: FAILED_STATUS },
	10: { tooltip: "Bank account is active, but name verification isn't currently available.", status: MISSING_STATUS },
	11: { tooltip: "Customer identification passed gIdentify/CustomerID.", status: PASSED_STATUS },
	12: { tooltip: "The customer or business name data did not match gIdentify/CustomerID data.", status: FAILED_STATUS },
	13: { tooltip: "The customer's TaxId (SSN/ITIN) data did not match gIdentify/CustomerID data.", status: FAILED_STATUS },
	14: { tooltip: "The customer's address data did not match gIdentify/CustomerID data.", status: FAILED_STATUS },
	15: { tooltip: "The customer's phone data did not match gIdentify/CustomerID data.", status: FAILED_STATUS },
	16: { tooltip: "The customer's date of birth or ID data did not match gIdentify/CustomerID data.", status: FAILED_STATUS },
	17: { tooltip: "Multiple contact data points did not match gIdentify/CustomerID data.", status: FAILED_STATUS },
	18: { tooltip: "No data was found matching the owner information provided.", status: FAILED_STATUS },
};

const CATEGORY_MAP: Record<GiactDisplayCategory, Record<number, GiactDisplayEntry>> = {
	giact_account_status: ACCOUNT_STATUS_MAP,
	giact_account_name: ACCOUNT_NAME_MAP,
	giact_contact_verification: CONTACT_VERIFICATION_MAP,
};

/**
 * Returns tooltip and status for a GIACT row. Use response_code from gVerify for Account Status,
 * and from gAuthenticate for Account Name and Contact Verification.
 */
export function getGiactDisplay(
	category: GiactDisplayCategory,
	responseCode: number | null
): GiactDisplayEntry {
	if (responseCode == null) {
		return { tooltip: NOT_AVAILABLE, status: MISSING_STATUS };
	}
	const map = CATEGORY_MAP[category];
	const entry = map[responseCode];
	if (entry) return entry;
	return { tooltip: NOT_AVAILABLE, status: MISSING_STATUS };
}
