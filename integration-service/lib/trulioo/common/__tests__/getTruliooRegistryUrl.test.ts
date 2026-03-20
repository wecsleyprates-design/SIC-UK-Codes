/**
 * Tests for getTruliooRegistryUrl function
 * 
 * Tests the registry URL generation for different countries and states/provinces
 */

import { getTruliooRegistryUrl } from "../utils";

describe("getTruliooRegistryUrl", () => {
	describe("Canada (CA)", () => {
		it("should return Ontario registry URL for CA with ON state", () => {
			const result = getTruliooRegistryUrl("CA", "ON");
			expect(result).toBe("https://www.ontario.ca/page/search-ontario-business-registry");
		});

		it("should return Ontario registry URL for CA with lowercase on state", () => {
			const result = getTruliooRegistryUrl("CA", "on");
			expect(result).toBe("https://www.ontario.ca/page/search-ontario-business-registry");
		});

		it("should return federal Canada registry URL for CA without state", () => {
			const result = getTruliooRegistryUrl("CA");
			expect(result).toBe("https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/fdrlCrpSrch.html");
		});

		it("should return federal Canada registry URL for CA with non-Ontario state", () => {
			const result = getTruliooRegistryUrl("CA", "BC");
			expect(result).toBe("https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/fdrlCrpSrch.html");
		});

		it("should return federal Canada registry URL for CA with lowercase country code", () => {
			const result = getTruliooRegistryUrl("ca", "BC");
			expect(result).toBe("https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/fdrlCrpSrch.html");
		});
	});

	describe("Australia (AU)", () => {
		it("should return ASIC registry URL for AU", () => {
			const result = getTruliooRegistryUrl("AU");
			expect(result).toBe("https://connectonline.asic.gov.au/RegistrySearch/faces/landing/SearchRegisters.jspx");
		});

		it("should return ASIC registry URL for AU with lowercase country code", () => {
			const result = getTruliooRegistryUrl("au");
			expect(result).toBe("https://connectonline.asic.gov.au/RegistrySearch/faces/landing/SearchRegisters.jspx");
		});

		it("should return ASIC registry URL for AU regardless of state parameter", () => {
			const result = getTruliooRegistryUrl("AU", "NSW");
			expect(result).toBe("https://connectonline.asic.gov.au/RegistrySearch/faces/landing/SearchRegisters.jspx");
		});
	});

	describe("New Zealand (NZ)", () => {
		it("should return Companies Office registry URL for NZ", () => {
			const result = getTruliooRegistryUrl("NZ");
			expect(result).toBe("https://app.companiesoffice.govt.nz/");
		});

		it("should return Companies Office registry URL for NZ with lowercase country code", () => {
			const result = getTruliooRegistryUrl("nz");
			expect(result).toBe("https://app.companiesoffice.govt.nz/");
		});

		it("should return Companies Office registry URL for NZ regardless of state parameter", () => {
			const result = getTruliooRegistryUrl("NZ", "Auckland");
			expect(result).toBe("https://app.companiesoffice.govt.nz/");
		});
	});

	describe("Puerto Rico (PR)", () => {
		it("should return Departamento de Estado registry URL for PR", () => {
			const result = getTruliooRegistryUrl("PR");
			expect(result).toBe("https://prcorpfiling.f1hst.com/CorporationSearch.aspx");
		});

		it("should return Departamento de Estado registry URL for PR with lowercase country code", () => {
			const result = getTruliooRegistryUrl("pr");
			expect(result).toBe("https://prcorpfiling.f1hst.com/CorporationSearch.aspx");
		});

		it("should return Departamento de Estado registry URL for PR regardless of state parameter", () => {
			const result = getTruliooRegistryUrl("PR", "San Juan");
			expect(result).toBe("https://prcorpfiling.f1hst.com/CorporationSearch.aspx");
		});
	});

	describe("Edge cases", () => {
		it("should return empty string when country is not provided", () => {
			const result = getTruliooRegistryUrl();
			expect(result).toBe("");
		});

		it("should return empty string when country is undefined", () => {
			const result = getTruliooRegistryUrl(undefined);
			expect(result).toBe("");
		});

		it("should return empty string when country is empty string", () => {
			const result = getTruliooRegistryUrl("");
			expect(result).toBe("");
		});

		it("should return empty string for unsupported countries", () => {
			const result = getTruliooRegistryUrl("US");
			expect(result).toBe("");
		});

		it("should return empty string for unsupported countries with state", () => {
			const result = getTruliooRegistryUrl("GB", "London");
			expect(result).toBe("");
		});

		it("should handle null state parameter", () => {
			const result = getTruliooRegistryUrl("CA", null as any);
			expect(result).toBe("https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/fdrlCrpSrch.html");
		});
	});
});
