/**
 * GIACT Mock Mappings
 * Predefined mappings of specific requests to specific responses.
 *
 * Account verification date fields use the new GIACT property names:
 * - AccountAdded, AccountLastUpdated, AccountClosed (date-range strings). Values are sample strings grabbed from: https://sandbox.api.giact.com/verificationservices/web_api/Help/Api/POST-web_api-inquiries_v5_8
 * Legacy names (AccountAddedDate, AccountLastUpdatedDate, AccountClosedDate) are not used
 * in mocks; the type and getAccountVerificationDateRanges() support both for backwards
 * compatibility when reading from stored meta or live API.
 */

import type { ServiceRequest, GIACTResponse } from "#lib/giact/types";

/**
 * Helper function to find matching response for a request
 */
export function findMatchingMockResponse(request: ServiceRequest): GIACTResponse | null {
	for (const mapping of GIACT_MOCK_MAPPINGS) {
		const { requestPattern } = mapping;

		// Check account number match
		if (requestPattern.accountNumber) {
			const accountNumber = request.BankAccountEntity?.AccountNumber || "";
			if (requestPattern.accountNumber instanceof RegExp) {
				if (!requestPattern.accountNumber.test(accountNumber)) continue;
			} else {
				if (accountNumber !== requestPattern.accountNumber) continue;
			}
		}

		// Check routing number match
		if (requestPattern.routingNumber) {
			const routingNumber = request.BankAccountEntity?.RoutingNumber || "";
			if (requestPattern.routingNumber instanceof RegExp) {
				if (!requestPattern.routingNumber.test(routingNumber)) continue;
			} else {
				if (routingNumber !== requestPattern.routingNumber) continue;
			}
		}

		// Check business name match
		if (requestPattern.businessName) {
			const businessName = request.BusinessEntity?.BusinessName || "";
			if (requestPattern.businessName instanceof RegExp) {
				if (!requestPattern.businessName.test(businessName)) continue;
			} else {
				if (businessName !== requestPattern.businessName) continue;
			}
		}

		// Check person name match
		if (requestPattern.personName) {
			const personName = `${request.PersonEntity?.FirstName || ""} ${request.PersonEntity?.LastName || ""}`.trim();
			if (requestPattern.personName instanceof RegExp) {
				if (!requestPattern.personName.test(personName)) continue;
			} else {
				if (personName !== requestPattern.personName) continue;
			}
		}

		// Check account type match
		if (requestPattern.accountType !== undefined) {
			const accountType = request.BankAccountEntity?.AccountType;
			if (accountType !== requestPattern.accountType) continue;
		}

		// If we get here, all patterns matched
		return {
			...mapping.response,
			UniqueID: request.UniqueId,
			CreatedDate: new Date().toISOString()
		};
	}

	return null; // No matching pattern found
}

/**
 * Default successful response template.
 * Uses new date-range fields (AccountAdded, AccountLastUpdated, AccountClosed) only.
 */
const DEFAULT_SUCCESS_RESPONSE: GIACTResponse = {
	ItemReferenceID: 12345,
	CreatedDate: new Date().toISOString(),
	ErrorMessages: [],
	UniqueID: "mock-unique-id",
	VerificationResult: 1,
	AlertMessages: null,
	AccountVerificationResult: {
		ResponseCode: 1,
		BankName: "Mock Bank",
		AccountAdded: "sample string 6",
		AccountLastUpdated: "sample string 7",
		AccountClosed: "sample string 8",
		BankAccountType: "Checking",
		FundsConfirmationResult: null
	},
	AccountAuthenticationResult: null,
	PersonIdentificationResult: null,
	BusinessIdentificationResult: null,
	WorldSanctionScanResult: null,
	ESIResult: null,
	IPAddressResult: null,
	DomainWhoIsResult: null,
	MobileResult: null,
	AccountInsightsResult: null,
	IdentityScoreResult: null,
	PhoneVerificationResult: null
} as GIACTResponse;

/**
 * Mock request-response mappings
 * Each entry maps a specific request pattern to a specific response
 */
export const GIACT_MOCK_MAPPINGS: Array<{
	requestPattern: {
		accountNumber?: string | RegExp;
		routingNumber?: string | RegExp;
		businessName?: string | RegExp;
		personName?: string | RegExp;
		accountType?: number;
	};
	response: GIACTResponse;
	description: string;
}> = [
	// Test Account Mappings
	{
		requestPattern: {
			accountNumber: /^test/i
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "test-account-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Test Bank",
				ResponseCode: 1
			}
		},
		description: "Test account - always succeeds"
	},

	{
		requestPattern: {
			accountNumber: /^mock/i
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "mock-account-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Mock Bank",
				ResponseCode: 1
			}
		},
		description: "Mock account - always succeeds"
	},

	// Invalid Account Mappings
	{
		requestPattern: {
			accountNumber: /^invalid/i
		},
		response: {
			ItemReferenceID: 0,
			CreatedDate: new Date().toISOString(),
			ErrorMessages: ["Invalid account number"],
			UniqueID: "invalid-account-response",
			VerificationResult: 0,
			AlertMessages: "Mock error occurred during verification",
			AccountVerificationResult: {
				ResponseCode: 0,
				BankName: "Unknown",
				AccountAdded: "sample string 6",
				AccountLastUpdated: "sample string 7",
				AccountClosed: "sample string 8",
				BankAccountType: "0",
				FundsConfirmationResult: null
			},
			AccountAuthenticationResult: null,
			PersonIdentificationResult: null,
			BusinessIdentificationResult: null,
			WorldSanctionScanResult: null,
			ESIResult: null,
			IPAddressResult: null,
			DomainWhoIsResult: null,
			MobileResult: null,
			AccountInsightsResult: null,
			IdentityScoreResult: null,
			PhoneVerificationResult: null
		},
		description: "Invalid account - always fails"
	},

	{
		requestPattern: {
			accountNumber: /^error/i
		},
		response: {
			ItemReferenceID: 0,
			CreatedDate: new Date().toISOString(),
			ErrorMessages: ["Account verification error"],
			UniqueID: "error-account-response",
			VerificationResult: 0,
			AlertMessages: "Mock error occurred during verification",
			AccountVerificationResult: {
				ResponseCode: 0,
				BankName: "Unknown",
				AccountAdded: "sample string 6",
				AccountLastUpdated: "sample string 7",
				AccountClosed: "sample string 8",
				BankAccountType: "0",
				FundsConfirmationResult: null
			},
			AccountAuthenticationResult: null,
			PersonIdentificationResult: null,
			BusinessIdentificationResult: null,
			WorldSanctionScanResult: null,
			ESIResult: null,
			IPAddressResult: null,
			DomainWhoIsResult: null,
			MobileResult: null,
			AccountInsightsResult: null,
			IdentityScoreResult: null,
			PhoneVerificationResult: null
		},
		description: "Error account - always fails"
	},

	// Specific Bank Mappings
	{
		requestPattern: {
			routingNumber: "021000021" // Chase
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "chase-bank-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "JPMorgan Chase",
				ResponseCode: 1
			}
		},
		description: "Chase Bank routing - always succeeds"
	},

	{
		requestPattern: {
			routingNumber: "011401533" // Wells Fargo
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "wells-fargo-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Wells Fargo Bank",
				ResponseCode: 1
			}
		},
		description: "Wells Fargo routing - always succeeds"
	},

	{
		requestPattern: {
			routingNumber: "121000248" // Bank of America
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "boa-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Bank of America, N.A.",
				ResponseCode: 1
			}
		},
		description: "Bank of America routing - always succeeds"
	},

	// Business Account Mappings
	{
		requestPattern: {
			businessName: /^excellent/i
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "excellent-business-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Premium Business Bank",
				ResponseCode: 1
			},
			AccountAuthenticationResult: {
				ResponseCode: 2,
				AccountOwnerSigner: 2,
				VoidedCheckImage: "data:image/jpeg;base64,mock-check-image-data"
			}
		},
		description: "Excellent business - high success rate"
	},

	{
		requestPattern: {
			businessName: /^poor/i
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "poor-business-response",
			VerificationResult: 0,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Basic Business Bank",
				ResponseCode: 0
			},
			AccountAuthenticationResult: {
				ResponseCode: 0,
				AccountOwnerSigner: 0,
				VoidedCheckImage: null
			}
		},
		description: "Poor business - low success rate"
	},

	// Personal Account Mappings
	{
		requestPattern: {
			personName: /^john/i
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "john-person-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Personal Banking",
				ResponseCode: 1
			},
			AccountAuthenticationResult: {
				ResponseCode: 2,
				AccountOwnerSigner: 1,
				VoidedCheckImage: "data:image/jpeg;base64,mock-check-image-data"
			}
		},
		description: "John personal account - good success rate"
	},

	{
		requestPattern: {
			personName: /^jane/i
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "jane-person-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Personal Banking",
				ResponseCode: 1
			},
			AccountAuthenticationResult: {
				ResponseCode: 2,
				AccountOwnerSigner: 1,
				VoidedCheckImage: "data:image/jpeg;base64,mock-check-image-data"
			}
		},
		description: "Jane personal account - good success rate"
	},

	// Specific Account Number Mappings (MUST come before generic account type mappings)
	{
		requestPattern: {
			accountNumber: "1234567890"
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "specific-account-1234567890",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Specific Account Bank",
				ResponseCode: 1
			}
		},
		description: "Specific account number 1234567890 - always succeeds"
	},

	{
		requestPattern: {
			accountNumber: "9876543210"
		},
		response: {
			ItemReferenceID: 0,
			CreatedDate: new Date().toISOString(),
			ErrorMessages: ["Account number 9876543210 is not valid"],
			UniqueID: "specific-account-9876543210",
			VerificationResult: 0,
			AlertMessages: "Mock error occurred during verification",
			AccountVerificationResult: {
				ResponseCode: 0,
				BankName: "Unknown",
				AccountAdded: "sample string 6",
				AccountLastUpdated: "sample string 7",
				AccountClosed: "sample string 8",
				BankAccountType: "0",
				FundsConfirmationResult: null
			},
			AccountAuthenticationResult: null,
			PersonIdentificationResult: null,
			BusinessIdentificationResult: null,
			WorldSanctionScanResult: null,
			ESIResult: null,
			IPAddressResult: null,
			DomainWhoIsResult: null,
			MobileResult: null,
			AccountInsightsResult: null,
			IdentityScoreResult: null,
			PhoneVerificationResult: null
		},
		description: "Specific account number 9876543210 - always fails"
	},

	// Routing Number Mappings
	{
		requestPattern: {
			routingNumber: "999888777"
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "unknown-routing-999888777",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Mock Bank 777",
				ResponseCode: 1
			}
		},
		description: "Unknown routing number - mock bank name"
	},

	// Business + Account Combination Mappings
	{
		requestPattern: {
			businessName: /^acme/i,
			accountNumber: /^acme/i
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "acme-business-account",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "ACME Business Bank",
				ResponseCode: 1
			},
			AccountAuthenticationResult: {
				ResponseCode: 2,
				AccountOwnerSigner: 2,
				VoidedCheckImage: "data:image/jpeg;base64,mock-check-image-data"
			}
		},
		description: "ACME business with matching account - high success"
	},

	// Account Type Mappings (MUST come after specific mappings)
	{
		requestPattern: {
			accountType: 0 // Checking
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "checking-account-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Checking Account Bank",
				BankAccountType: "Checking",
				ResponseCode: 1
			}
		},
		description: "Checking account - standard success"
	},

	{
		requestPattern: {
			accountType: 1 // Savings
		},
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "savings-account-response",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				BankName: "Savings Account Bank",
				BankAccountType: "Savings",
				ResponseCode: 1
			}
		},
		description: "Savings account - standard success"
	},

	// -------------------------
	// gVerify SCENARIOS
	// -------------------------
	{
		requestPattern: { accountNumber: /^1111$/ },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gverify-open-valid",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: 1111,
				BankName: "Open & Valid Checking",
				BankAccountType: "Checking"
			}
		},
		description: "gVerify - Open & valid checking account"
	},
	{
		requestPattern: { accountNumber: /^5555$/ },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gverify-open-savings",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: 5555,
				BankName: "Open & Valid Savings",
				BankAccountType: "Savings"
			}
		},
		description: "gVerify - Open & valid savings account"
	},
	{
		requestPattern: { accountNumber: /^3333$/ },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gverify-open-dda",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: 3333,
				BankName: "Open & Valid DDA",
				BankAccountType: "DDA"
			}
		},
		description: "gVerify - Open & valid DDA account"
	},
	{
		requestPattern: { accountNumber: /^rt03$/i },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gverify-nsf-negative",
			VerificationResult: 0,
			AlertMessages: "Negative data / NSF",
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: -3,
				BankName: "NSF / Negative Data Bank"
			}
		},
		description: "gVerify - NSF / recent returns / negative data"
	},
	{
		requestPattern: { accountNumber: /^closed$/i },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gverify-closed",
			VerificationResult: 0,
			ErrorMessages: ["Account is closed"],
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: -1,
				BankName: "Closed Account Bank",
				AccountClosed: new Date().toISOString()
			}
		},
		description: "gVerify - Account closed"
	},
	{
		requestPattern: { accountNumber: /^nd00$/i },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gverify-not-found",
			VerificationResult: 2,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: 0,
				BankName: "Routing valid - no reports",
				BankAccountType: "Unknown"
			}
		},
		description: "gVerify - Account not located / no data"
	},
	{
		requestPattern: { accountNumber: /^prepaid$/i },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gverify-prepaid",
			VerificationResult: 2,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: 0,
				BankName: "Prepaid Bank",
				BankAccountType: "Prepaid Debit"
			}
		},
		description: "gVerify - Prepaid / non-DDA / special type"
	},

	// -------------------------
	// gAuthenticate SCENARIOS
	// -------------------------
	{
		requestPattern: { personName: /^auth pass$/i },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gauth-pass",
			VerificationResult: 1,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: 1111,
				BankName: "Authentication Bank"
			},
			AccountAuthenticationResult: {
				ResponseCode: 1,
				AccountOwnerSigner: 1,
				VoidedCheckImage: "data:image/jpeg;base64,auth-pass"
			}
		},
		description: "gAuthenticate - Successful authentication"
	},
	{
		requestPattern: { personName: /^auth fail$/i },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gauth-fail",
			VerificationResult: 0,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: 1111,
				BankName: "Authentication Bank"
			},
			AccountAuthenticationResult: {
				ResponseCode: 0,
				AccountOwnerSigner: 0,
				VoidedCheckImage: null
			},
			ErrorMessages: ["Customer data mismatch"]
		},
		description: "gAuthenticate - Failed authentication (mismatch)"
	},
	{
		requestPattern: { personName: /^nonparticipant$/i },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gauth-nonparticipant",
			VerificationResult: 2,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: 0,
				BankName: "Non-Participant Bank"
			},
			AccountAuthenticationResult: null,
			AlertMessages: "Bank not participating in authentication network"
		},
		description: "gAuthenticate - Non-participating bank"
	},
	{
		requestPattern: { personName: /^inel$/i },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gauth-ineligible",
			VerificationResult: 0,
			AccountVerificationResult: {
				...DEFAULT_SUCCESS_RESPONSE.AccountVerificationResult!,
				ResponseCode: -1,
				BankName: "Closed Account Bank",
				AccountClosed: new Date().toISOString()
			},
			AccountAuthenticationResult: null,
			ErrorMessages: ["Account ineligible for authentication"]
		},
		description: "gAuthenticate - Ineligible account (closed/invalid)"
	},
	{
		requestPattern: { personName: /^authonly$/i },
		response: {
			...DEFAULT_SUCCESS_RESPONSE,
			UniqueID: "gauth-only",
			VerificationResult: 1,
			AccountVerificationResult: null,
			AccountAuthenticationResult: {
				ResponseCode: 1,
				AccountOwnerSigner: 1,
				VoidedCheckImage: "data:image/jpeg;base64,authonly-pass"
			}
		},
		description: "gAuthenticate - AuthOnly successful signature match"
	}
];
