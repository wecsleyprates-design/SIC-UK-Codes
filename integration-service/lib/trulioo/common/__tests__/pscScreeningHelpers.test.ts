/**
 * Tests for pscScreeningHelpers.ts
 * 
 * Tests the helper functions for determining if PSC screening should be performed
 * based on customer settings and business territory.
 */

import { shouldScreenPSCsForBusiness } from "../pscScreeningHelpers";
import { getBusinessCustomers } from "#helpers/api";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";

// Mock dependencies
jest.mock("#helpers/api", () => ({
	getBusinessCustomers: jest.fn()
}));

jest.mock("#api/v1/modules/customer-integration-settings/customer-integration-settings", () => ({
	customerIntegrationSettings: {
		getIntegrationStatusForCustomer: jest.fn(),
		isCustomerIntegrationSettingEnabled: jest.fn()
	}
}));

jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn()
	}
}));

describe("pscScreeningHelpers", () => {
	const mockBusinessId = "00000000-0000-0000-0000-000000000000" as const;
	const mockCustomerId = "customer-123";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("shouldScreenPSCsForBusiness", () => {

	describe("UK businesses", () => {
		it("should return shouldScreen=true for UK business when International KYB is enabled (legacy test - now uses non-US logic)", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "GB");

			expect(result.shouldScreen).toBe(true);
			expect(result.reason).toBe("Non-US business - automatic PSC screening when International KYB is enabled");
			expect(customerIntegrationSettings.isCustomerIntegrationSettingEnabled).not.toHaveBeenCalled();
		});

		it("should return shouldScreen=false for UK business when International KYB is disabled", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "DISABLED"
				}
			]);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "GB");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("International KYB not enabled");
		});
	});

	describe("Non-US businesses (Canada, UK, etc.)", () => {
		it("should return shouldScreen=true for Canada when International KYB is enabled (automatic PSC screening)", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(true);
			expect(result.reason).toBe("Non-US business - automatic PSC screening when International KYB is enabled");
			// Should NOT check Advanced Watchlists for non-US businesses
			expect(customerIntegrationSettings.isCustomerIntegrationSettingEnabled).not.toHaveBeenCalled();
		});

		it("should return shouldScreen=true for Canada even when Advanced Watchlists is disabled (International KYB is sufficient)", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			// Even if Advanced Watchlists is disabled, Canada should still screen (it's automatic)
			(customerIntegrationSettings.isCustomerIntegrationSettingEnabled as jest.Mock).mockResolvedValue(false);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(true);
			expect(result.reason).toBe("Non-US business - automatic PSC screening when International KYB is enabled");
			// Should NOT check Advanced Watchlists for non-US businesses
			expect(customerIntegrationSettings.isCustomerIntegrationSettingEnabled).not.toHaveBeenCalled();
		});
	});

	describe("US businesses", () => {
		it("should return shouldScreen=false for US when Advanced Watchlists is disabled", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			(customerIntegrationSettings.isCustomerIntegrationSettingEnabled as jest.Mock).mockResolvedValue(false);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "US");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("Advanced Watchlists not enabled for US business");
			expect(customerIntegrationSettings.isCustomerIntegrationSettingEnabled).toHaveBeenCalledWith(
				mockCustomerId,
				"advanced_watchlist"
			);
		});

		it("should return shouldScreen=true for US when Advanced Watchlists is enabled and International KYB is enabled", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			(customerIntegrationSettings.isCustomerIntegrationSettingEnabled as jest.Mock).mockResolvedValue(true);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "US");

			expect(result.shouldScreen).toBe(true);
			expect(result.reason).toBe("Advanced Watchlists enabled for US business");
			expect(customerIntegrationSettings.isCustomerIntegrationSettingEnabled).toHaveBeenCalledWith(
				mockCustomerId,
				"advanced_watchlist"
			);
		});

		it("should return shouldScreen=false for non-UK when International KYB is disabled (even if Advanced Watchlists is enabled)", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "DISABLED"
				}
			]);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("International KYB not enabled");
			expect(customerIntegrationSettings.isCustomerIntegrationSettingEnabled).not.toHaveBeenCalled();
		});
	});

	describe("Edge cases", () => {
		it("should return shouldScreen=false when customer ID cannot be determined", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: []
			});

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("No customer ID found");
		});

		it("should return shouldScreen=false when getBusinessCustomers throws an error", async () => {
			(getBusinessCustomers as jest.Mock).mockRejectedValue(new Error("API Error"));

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toContain("Error checking settings");
		});

		it("should handle UK country code variations (GB and UK)", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			const resultGB = await shouldScreenPSCsForBusiness(mockBusinessId, "GB");
			const resultUK = await shouldScreenPSCsForBusiness(mockBusinessId, "UK");

			expect(resultGB.shouldScreen).toBe(true);
			expect(resultUK.shouldScreen).toBe(true);
			expect(resultGB.reason).toBe("Non-US business - automatic PSC screening when International KYB is enabled");
			expect(resultUK.reason).toBe("Non-US business - automatic PSC screening when International KYB is enabled");
		});

		it("should normalize country codes (lowercase, whitespace)", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			const result1 = await shouldScreenPSCsForBusiness(mockBusinessId, "ca");
			const result2 = await shouldScreenPSCsForBusiness(mockBusinessId, "  CA  ");
			const result3 = await shouldScreenPSCsForBusiness(mockBusinessId, "Ca");

			expect(result1.shouldScreen).toBe(true);
			expect(result2.shouldScreen).toBe(true);
			expect(result3.shouldScreen).toBe(true);
			// Should NOT check Advanced Watchlists for non-US businesses
			expect(customerIntegrationSettings.isCustomerIntegrationSettingEnabled).not.toHaveBeenCalled();
		});

		it("should handle empty/undefined/null country as non-US (automatic PSC screening when International KYB enabled)", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			const resultEmpty = await shouldScreenPSCsForBusiness(mockBusinessId, "");
			const resultNull = await shouldScreenPSCsForBusiness(mockBusinessId, null as any);
			const resultUndefined = await shouldScreenPSCsForBusiness(mockBusinessId, undefined as any);

			// Empty/null/undefined country is treated as non-US, so automatic PSC screening applies
			expect(resultEmpty.shouldScreen).toBe(true);
			expect(resultNull.shouldScreen).toBe(true);
			expect(resultUndefined.shouldScreen).toBe(true);
			expect(resultEmpty.reason).toBe("Non-US business - automatic PSC screening when International KYB is enabled");
		});

		it("should handle when integrationStatus is empty array", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([]);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("International KYB not enabled");
		});

		it("should handle when integrationStatus does not contain trulioo", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "middesk",
					status: "ENABLED"
				},
				{
					integration_code: "other",
					status: "ENABLED"
				}
			]);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("International KYB not enabled");
		});

		it("should handle when truliooStatus exists but status is not ENABLED", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "DISABLED"
				}
			]);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("International KYB not enabled");
		});

		it("should handle when truliooStatus.status is null or undefined", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: null
				}
			]);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("International KYB not enabled");
		});

		it("should handle when getBusinessCustomers returns null", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue(null);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("No customer ID found");
		});

		it("should handle when getBusinessCustomers returns undefined", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue(undefined);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("No customer ID found");
		});

		it("should handle when getIntegrationStatusForCustomer throws an error", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockRejectedValue(
				new Error("Integration status API error")
			);

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toContain("Error checking settings");
		});

		it("should handle when isCustomerIntegrationSettingEnabled throws an error (for US businesses)", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			(customerIntegrationSettings.isCustomerIntegrationSettingEnabled as jest.Mock).mockRejectedValue(
				new Error("Settings API error")
			);

			// For US businesses, Advanced Watchlists check is required, so error should be caught
			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "US");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toContain("Error checking settings");
		});

		it("should handle other non-US countries (e.g., FR, DE, AU) - automatic PSC screening", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: [mockCustomerId]
			});

			(customerIntegrationSettings.getIntegrationStatusForCustomer as jest.Mock).mockResolvedValue([
				{
					integration_code: "trulioo",
					status: "ENABLED"
				}
			]);

			const resultFR = await shouldScreenPSCsForBusiness(mockBusinessId, "FR");
			const resultDE = await shouldScreenPSCsForBusiness(mockBusinessId, "DE");
			const resultAU = await shouldScreenPSCsForBusiness(mockBusinessId, "AU");

			expect(resultFR.shouldScreen).toBe(true);
			expect(resultDE.shouldScreen).toBe(true);
			expect(resultAU.shouldScreen).toBe(true);
			expect(resultFR.reason).toBe("Non-US business - automatic PSC screening when International KYB is enabled");
			expect(resultDE.reason).toBe("Non-US business - automatic PSC screening when International KYB is enabled");
			expect(resultAU.reason).toBe("Non-US business - automatic PSC screening when International KYB is enabled");
			// Should NOT check Advanced Watchlists for non-US businesses
			expect(customerIntegrationSettings.isCustomerIntegrationSettingEnabled).not.toHaveBeenCalled();
		});

		it("should handle when businessCustomers.customer_ids is null", async () => {
			(getBusinessCustomers as jest.Mock).mockResolvedValue({
				customer_ids: null
			});

			const result = await shouldScreenPSCsForBusiness(mockBusinessId, "CA");

			expect(result.shouldScreen).toBe(false);
			expect(result.reason).toBe("No customer ID found");
		});
	});
	});
});
