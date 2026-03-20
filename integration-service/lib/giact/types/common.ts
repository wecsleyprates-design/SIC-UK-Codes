import { UUID } from "crypto";

export type GIACTTask = {
	bank_account_ids?: UUID[];
};

export type AddressEntity = {
	AddressLine1: string;
	AddressLine2?: string | null;
	City: string;
	State: string;
	ZipCode: string;
	Country: string;
};

export type BankAccountEntity = {
	RoutingNumber: string;
	AccountNumber: string;
	AccountType: number;
};

export type PersonEntity = {
	FirstName: string;
	LastName: string;
	AddressEntity?: AddressEntity;
	PhoneNumber: string;
	TaxID: string;
	DateOfBirth: string;
};

export type BusinessEntity = {
	BusinessName: string;
	AddressEntity?: AddressEntity;
	PhoneNumber: string | null;
	FEIN: string;
};

export type ServiceRequest = {
	UniqueId: UUID;
	ServiceFlags: string[];
	BankAccountEntity: BankAccountEntity;
	PersonEntity?: PersonEntity;
	BusinessEntity?: BusinessEntity;
};

/**
 * GIACT AccountVerificationResult date fields were renamed by the API:
 * - Old (specific dates): AccountAddedDate, AccountLastUpdatedDate, AccountClosedDate
 * - New (date ranges, strings): AccountAdded, AccountLastUpdated, AccountClosed
 *
 * We support both for backwards compatibility: existing rows in rel_banking_verifications.meta
 * and older API responses may still have the old property names. New code and mocks use the
 * new names; when reading from stored meta or live API, use getAccountVerificationDateRanges()
 * to normalize so either shape works.
 */
export type AccountVerificationResult = {
	ResponseCode: number;
	BankName: string;
	/** New: date range string properties. This are the new properties from the GIACT API. */
	AccountAdded?: string;
	AccountLastUpdated?: string;
	AccountClosed?: string | null;
	/**
	 * Legacy date properties: specific dates when account was added, last updated, and closed. Kept optional so old meta/API responses
	 * still type-check. Prefer AccountAdded when writing; when reading use getAccountVerificationDateRanges().
	 * We can remove these after GIACT API is fully updated to use the new property names.
	 */
	AccountAddedDate?: string;
	AccountLastUpdatedDate?: string;
	AccountClosedDate?: string | null;
	BankAccountType: string | null;
	FundsConfirmationResult: any | null;
};

export type AccountAuthenticationResult = {
	ResponseCode: number;
	AccountOwnerSigner: number;
	VoidedCheckImage: string | null;
};

export type GIACTResponse = {
	ItemReferenceID: number;
	CreatedDate: string;
	ErrorMessages: string[];
	UniqueID: string;
	VerificationResult: number;
	AlertMessages: string | null;
	AccountVerificationResult: AccountVerificationResult | null;
	AccountAuthenticationResult: AccountAuthenticationResult | null;
	PersonIdentificationResult: any | null;
	BusinessIdentificationResult: any | null;
	WorldSanctionScanResult: any | null;
	ESIResult: any | null;
	IPAddressResult: any | null;
	DomainWhoIsResult: any | null;
	MobileResult: any | null;
	AccountInsightsResult: any | null;
	IdentityScoreResult: any | null;
	PhoneVerificationResult: any | null;
};

/**
 * Normalized date-range values for GIACT account verification.
 * Use this when exposing these dates to APIs or frontend so that both old and new
 * response shapes (AccountAddedDate vs AccountAdded, etc.) are supported.
 */
export type AccountVerificationDateRanges = {
	accountAdded: string | null;
	accountLastUpdated: string | null;
	accountClosed: string | null;
};

/**
 * Returns the account verification date ranges from a GIACT AccountVerificationResult,
 * supporting both the new property names (AccountAdded, AccountLastUpdated, AccountClosed)
 * and the legacy names (AccountAddedDate, AccountLastUpdatedDate, AccountClosedDate).
 * Use this when reading from rel_banking_verifications.meta.giactResponse or from
 * a live GIACT API response so that existing data and new responses both work.
 *
 * @param result - AccountVerificationResult from GIACT (or from meta.giactResponse)
 * @returns Normalized date range values; nulls when result is null/undefined or has no dates
 */
export function getAccountVerificationDateRanges(
	result: AccountVerificationResult | null | undefined
): AccountVerificationDateRanges {
	if (!result) {
		return { accountAdded: null, accountLastUpdated: null, accountClosed: null };
	}
	return {
		accountAdded: result.AccountAdded ?? result.AccountAddedDate ?? null,
		accountLastUpdated: result.AccountLastUpdated ?? result.AccountLastUpdatedDate ?? null,
		accountClosed: result.AccountClosed ?? result.AccountClosedDate ?? null
	};
}
