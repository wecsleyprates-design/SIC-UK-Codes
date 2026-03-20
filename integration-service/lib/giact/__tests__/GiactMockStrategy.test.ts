/**
 * Tests for GIACT Mock Strategy
 * Comprehensive tests for predefined request-response mappings
 */

import { GiactMockStrategy } from "../strategies/GiactMockStrategy";
import type { ServiceRequest } from "../types";

describe("GiactMockStrategy", () => {
	let strategy: GiactMockStrategy;

	beforeEach(() => {
		strategy = new GiactMockStrategy();
	});

	describe("Basic Functionality", () => {
		it("should have correct mode", () => {
			expect(strategy.getMode()).toBe("MOCK");
		});

		it("should always be available", () => {
			expect(strategy.isAvailable()).toBe(true);
		});
	});

	describe("Test Account Mappings", () => {
		it("should return test bank response for test account numbers", async () => {
			const testRequest: ServiceRequest = {
				UniqueId: "test-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "test123456",
					RoutingNumber: "123456789",
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(testRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Test Bank");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
			expect(response.UniqueID).toBe("test-123"); // Should use request ID
		});

		it("should return mock bank response for mock account numbers", async () => {
			const mockRequest: ServiceRequest = {
				UniqueId: "mock-456" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "mock123456",
					RoutingNumber: "123456789",
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(mockRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Mock Bank");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
		});
	});

	describe("Invalid Account Mappings", () => {
		it("should return error response for invalid account numbers", async () => {
			const invalidRequest: ServiceRequest = {
				UniqueId: "invalid-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "invalid123",
					RoutingNumber: "123456789",
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(invalidRequest);

			expect(response.VerificationResult).toBe(0);
			expect(response.ErrorMessages).toContain("Invalid account number");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(0);
		});

		it("should return error response for error account numbers", async () => {
			const errorRequest: ServiceRequest = {
				UniqueId: "error-456" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "error123",
					RoutingNumber: "123456789",
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(errorRequest);

			expect(response.VerificationResult).toBe(0);
			expect(response.ErrorMessages).toContain("Account verification error");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(0);
		});
	});

	describe("Specific Bank Mappings", () => {
		it("should return Chase Bank for Chase routing number", async () => {
			const chaseRequest: ServiceRequest = {
				UniqueId: "chase-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "1234567890",
					RoutingNumber: "021000021", // Chase routing number
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(chaseRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("JPMorgan Chase");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
		});

		it("should return Wells Fargo for Wells Fargo routing number", async () => {
			const wellsRequest: ServiceRequest = {
				UniqueId: "wells-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "1234567890",
					RoutingNumber: "011401533", // Wells Fargo routing number
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(wellsRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Wells Fargo Bank");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
		});

		it("should return Bank of America for BofA routing number", async () => {
			const boaRequest: ServiceRequest = {
				UniqueId: "boa-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "1234567890",
					RoutingNumber: "121000248", // Bank of America routing number
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(boaRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Bank of America, N.A.");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
		});
	});

	describe("Business Account Mappings", () => {
		it("should return excellent business response for excellent business names", async () => {
			const excellentRequest: ServiceRequest = {
				UniqueId: "excellent-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["authenticate"],
				BankAccountEntity: {
					AccountNumber: "1234567890",
					RoutingNumber: "123456789",
					AccountType: 0
				},
				BusinessEntity: {
					BusinessName: "Excellent Business Corp",
					FEIN: "123456789",
					PhoneNumber: "5551234567"
				}
			};

			const response = await strategy.authenticateAccount(excellentRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Premium Business Bank");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
			expect(response.AccountAuthenticationResult?.ResponseCode).toBe(2);
			expect(response.AccountAuthenticationResult?.AccountOwnerSigner).toBe(2);
		});

		it("should return poor business response for poor business names", async () => {
			const poorRequest: ServiceRequest = {
				UniqueId: "poor-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["authenticate"],
				BankAccountEntity: {
					AccountNumber: "1234567890",
					RoutingNumber: "123456789",
					AccountType: 0
				},
				BusinessEntity: {
					BusinessName: "Poor Business Inc",
					FEIN: "123456789",
					PhoneNumber: "5551234567"
				}
			};

			const response = await strategy.authenticateAccount(poorRequest);

			expect(response.VerificationResult).toBe(0);
			expect(response.AccountVerificationResult?.BankName).toBe("Basic Business Bank");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(0);
			expect(response.AccountAuthenticationResult?.ResponseCode).toBe(0);
			expect(response.AccountAuthenticationResult?.AccountOwnerSigner).toBe(0);
		});
	});

	describe("Personal Account Mappings", () => {
		it("should return John response for John personal accounts", async () => {
			const johnRequest: ServiceRequest = {
				UniqueId: "john-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["authenticate"],
				BankAccountEntity: {
					AccountNumber: "1234567890",
					RoutingNumber: "123456789",
					AccountType: 0
				},
				PersonEntity: {
					FirstName: "John",
					LastName: "Doe",
					TaxID: "123456789",
					PhoneNumber: "5551234567",
					DateOfBirth: "1990-01-01"
				}
			};

			const response = await strategy.authenticateAccount(johnRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Personal Banking");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
			expect(response.AccountAuthenticationResult?.ResponseCode).toBe(2);
			expect(response.AccountAuthenticationResult?.AccountOwnerSigner).toBe(1);
		});

		it("should return Jane response for Jane personal accounts", async () => {
			const janeRequest: ServiceRequest = {
				UniqueId: "jane-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["authenticate"],
				BankAccountEntity: {
					AccountNumber: "1234567890",
					RoutingNumber: "123456789",
					AccountType: 0
				},
				PersonEntity: {
					FirstName: "Jane",
					LastName: "Smith",
					TaxID: "123456789",
					PhoneNumber: "5551234567",
					DateOfBirth: "1990-01-01"
				}
			};

			const response = await strategy.authenticateAccount(janeRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Personal Banking");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
			expect(response.AccountAuthenticationResult?.ResponseCode).toBe(2);
			expect(response.AccountAuthenticationResult?.AccountOwnerSigner).toBe(1);
		});
	});

	describe("Account Type Mappings", () => {
		it("should return checking account response for checking accounts", async () => {
			const checkingRequest: ServiceRequest = {
				UniqueId: "checking-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "1111111111", // Different from specific account number
					RoutingNumber: "123456789",
					AccountType: 0 // Checking
				}
			};

			const response = await strategy.verifyAccount(checkingRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Checking Account Bank");
			expect(response.AccountVerificationResult?.BankAccountType).toBe("Checking");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
		});

		it("should return savings account response for savings accounts", async () => {
			const savingsRequest: ServiceRequest = {
				UniqueId: "savings-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "2222222222", // Different from specific account number
					RoutingNumber: "123456789",
					AccountType: 1 // Savings
				}
			};

			const response = await strategy.verifyAccount(savingsRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Savings Account Bank");
			expect(response.AccountVerificationResult?.BankAccountType).toBe("Savings");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
		});
	});

	describe("Specific Account Number Mappings", () => {
		it("should return specific response for account number 1234567890", async () => {
			const specificRequest: ServiceRequest = {
				UniqueId: "specific-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "1234567890",
					RoutingNumber: "123456789",
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(specificRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Specific Account Bank");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
		});

		it("should return error response for account number 9876543210", async () => {
			const errorRequest: ServiceRequest = {
				UniqueId: "error-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "9876543210",
					RoutingNumber: "123456789",
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(errorRequest);

			expect(response.VerificationResult).toBe(0);
			expect(response.ErrorMessages).toContain("Account number 9876543210 is not valid");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(0);
		});
	});

	describe("Unknown Routing Number Mappings", () => {
		it("should return mock bank name for unknown routing number", async () => {
			const unknownRequest: ServiceRequest = {
				UniqueId: "unknown-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "3333333333", // Different from specific account number
					RoutingNumber: "999888777", // Unknown routing number
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(unknownRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Mock Bank 777");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
		});
	});

	describe("Business + Account Combination Mappings", () => {
		it("should return ACME business response for ACME business with matching account", async () => {
			const acmeRequest: ServiceRequest = {
				UniqueId: "acme-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["authenticate"],
				BankAccountEntity: {
					AccountNumber: "acme123456",
					RoutingNumber: "123456789",
					AccountType: 0
				},
				BusinessEntity: {
					BusinessName: "ACME Corporation",
					FEIN: "123456789",
					PhoneNumber: "5551234567"
				}
			};

			const response = await strategy.authenticateAccount(acmeRequest);

			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("ACME Business Bank");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
			expect(response.AccountAuthenticationResult?.ResponseCode).toBe(2);
			expect(response.AccountAuthenticationResult?.AccountOwnerSigner).toBe(2);
		});
	});

	describe("Fallback to Default Response", () => {
		it("should fallback to default response for unmapped requests", async () => {
			const unmappedRequest: ServiceRequest = {
				UniqueId: "unmapped-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "9999999999", // Not in predefined mappings
					RoutingNumber: "999999999", // Not in predefined mappings
					AccountType: 2 // Different account type (not 0 or 1)
				}
			};

			const response = await strategy.verifyAccount(unmappedRequest);

			// Should use default response (not predefined mapping)
			expect(response.VerificationResult).toBe(1);
			expect(response.AccountVerificationResult?.BankName).toBe("Mock Bank");
			expect(response.AccountVerificationResult?.ResponseCode).toBe(1);
		});
	});

	describe("Specific Methods", () => {
		it("should execute verify account request", async () => {
			const request: ServiceRequest = {
				UniqueId: "execute-test-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["verify"],
				BankAccountEntity: {
					AccountNumber: "test123456",
					RoutingNumber: "123456789",
					AccountType: 0
				}
			};

			const response = await strategy.verifyAccount(request);

			expect(response).toBeDefined();
			expect(response.VerificationResult).toBe(1);
			expect(response.UniqueID).toBe("execute-test-123");
		});

		it("should execute authenticate account request", async () => {
			const request: ServiceRequest = {
				UniqueId: "execute-auth-123" as `${string}-${string}-${string}-${string}-${string}`,
				ServiceFlags: ["authenticate"],
				BankAccountEntity: {
					AccountNumber: "test123456",
					RoutingNumber: "123456789",
					AccountType: 0
				}
			};

			const response = await strategy.authenticateAccount(request);

			expect(response).toBeDefined();
			expect(response.VerificationResult).toBe(1);
			expect(response.UniqueID).toBe("execute-auth-123");
		});
	});
});
