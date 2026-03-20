import { AddressUtil } from "../addressUtil";

describe("AddressUtil.sanitizePostalCode", () => {
	describe("US / Puerto Rico — 5-digit zero-padded", () => {
		it.each([
			["12345", "US", "12345"],
			["2013", "US", "02013"],
			["123", "US", "00123"],
			["1", "US", "00001"],
			["123456", "US", "12345"],
			["12345", "PR", "12345"],
			["2013", "PR", "02013"],
			["12345", "USA", "12345"],
			["2013", "USA", "02013"]
		])("sanitizePostalCode(%s, %s) => %s", (postalCode, countryCode, expected) => {
			expect(AddressUtil.sanitizePostalCode(countryCode, postalCode)).toBe(expected);
		});

		it("defaults to US behavior when countryCode is undefined", () => {
			expect(AddressUtil.sanitizePostalCode(undefined, "2013")).toBe("02013");
			expect(AddressUtil.sanitizePostalCode(undefined, "12345")).toBe("12345");
		});

		it("defaults to US behavior when countryCode is empty string", () => {
			expect(AddressUtil.sanitizePostalCode("", "2013")).toBe("02013");
		});
	});

	describe("Australia — 4-digit, no padding", () => {
		it.each([
			["2013", "AU", "2013"],
			["2000", "AU", "2000"],
			["6011", "AU", "6011"],
			["200", "AU", "200"],
			["12345", "AU", "1234"]
		])("sanitizePostalCode(%s, %s) => %s", (postalCode, countryCode, expected) => {
			expect(AddressUtil.sanitizePostalCode(countryCode, postalCode)).toBe(expected);
		});
	});

	describe("New Zealand — 4-digit, no padding", () => {
		it.each([
			["2013", "NZ", "2013"],
			["6011", "NZ", "6011"],
			["0600", "NZ", "0600"],
			["12345", "NZ", "1234"]
		])("sanitizePostalCode(%s, %s) => %s", (postalCode, countryCode, expected) => {
			expect(AddressUtil.sanitizePostalCode(countryCode, postalCode)).toBe(expected);
		});
	});

	describe("Canada — alphanumeric, no padding, max 10 chars", () => {
		it.each([
			["M5H2N2", "CA", "M5H2N2"],
			["M5H 2N2", "CA", "M5H2N2"],
			["K1A0B1", "CA", "K1A0B1"]
		])("sanitizePostalCode(%s, %s) => %s", (postalCode, countryCode, expected) => {
			expect(AddressUtil.sanitizePostalCode(countryCode, postalCode)).toBe(expected);
		});

		it("truncates to 10 chars for long alphanumeric codes", () => {
			expect(AddressUtil.sanitizePostalCode("CA", "A1A1A1A1A1A1")).toBe("A1A1A1A1A1");
		});
	});

	describe("UK / GB — alphanumeric, no padding, max 10 chars", () => {
		it.each([
			["SW1A1AA", "GB", "SW1A1AA"],
			["SW1A 1AA", "GB", "SW1A1AA"],
			["SW1A1AA", "UK", "SW1A1AA"],
			["EC1A1BB", "GB", "EC1A1BB"]
		])("sanitizePostalCode(%s, %s) => %s", (postalCode, countryCode, expected) => {
			expect(AddressUtil.sanitizePostalCode(countryCode, postalCode)).toBe(expected);
		});
	});

	describe("special character removal", () => {
		it("removes dashes from US zip+4", () => {
			expect(AddressUtil.sanitizePostalCode("US", "12345-6789")).toBe("12345");
		});

		it("removes spaces from CA postal code", () => {
			expect(AddressUtil.sanitizePostalCode("CA", "M5H 2N2")).toBe("M5H2N2");
		});

		it("removes dashes from NZ postal code", () => {
			expect(AddressUtil.sanitizePostalCode("NZ", "60-11")).toBe("6011");
		});
	});

	describe("country case insensitivity", () => {
		it("handles lowercase country codes", () => {
			expect(AddressUtil.sanitizePostalCode("nz", "2013")).toBe("2013");
			expect(AddressUtil.sanitizePostalCode("au", "2013")).toBe("2013");
			expect(AddressUtil.sanitizePostalCode("us", "2013")).toBe("02013");
		});

		it("handles mixed-case country codes", () => {
			expect(AddressUtil.sanitizePostalCode("Nz", "2013")).toBe("2013");
			expect(AddressUtil.sanitizePostalCode("Au", "2013")).toBe("2013");
		});
	});

	describe("SupportedCountryCode enum", () => {
		it("treats SupportedCountryCode.US as US", () => {
			expect(AddressUtil.sanitizePostalCode("US", "2013")).toBe("02013");
		});

		it("treats SupportedCountryCode.CA as Canada", () => {
			expect(AddressUtil.sanitizePostalCode("CA", "M5H 2N2")).toBe("M5H2N2");
		});
	});
});

describe("AddressUtil.sanitizeStateToAbbreviation", () => {
	describe("US states", () => {
		it.each([
			["CA", "CA"],
			["california", "CA"],
			["New York", "NY"],
			["TX", "TX"]
		])("sanitizeStateToAbbreviation(%s) => %s", (input, expected) => {
			expect(AddressUtil.sanitizeStateToAbbreviation(input)).toBe(expected);
		});
	});

	describe("Canadian provinces", () => {
		it.each([
			["ON", "ON"],
			["ontario", "ON"],
			["BC", "BC"],
			["britishcolumbia", "BC"]
		])("sanitizeStateToAbbreviation(%s) => %s", (input, expected) => {
			expect(AddressUtil.sanitizeStateToAbbreviation(input)).toBe(expected);
		});
	});

	describe("Australian states", () => {
		it.each([
			["NSW", "NSW"],
			["newsouthwales", "NSW"],
			["VIC", "VIC"],
			["victoria", "VIC"],
			["QLD", "QLD"],
			["queensland", "QLD"]
		])("sanitizeStateToAbbreviation(%s) => %s", (input, expected) => {
			expect(AddressUtil.sanitizeStateToAbbreviation(input)).toBe(expected);
		});
	});

	describe("New Zealand regions", () => {
		it.each([
			["AUK", "AUK"],
			["auckland", "AUK"],
			["WGN", "WGN"],
			["wellington", "WGN"]
		])("sanitizeStateToAbbreviation(%s) => %s", (input, expected) => {
			expect(AddressUtil.sanitizeStateToAbbreviation(input)).toBe(expected);
		});
	});

	describe("Puerto Rico — countryCode-aware", () => {
		it("returns 'PR' when countryCode is 'PR' regardless of input", () => {
			expect(AddressUtil.sanitizeStateToAbbreviation("JUANA DÍAZ", { countryCode: "PR" })).toBe("PR");
			expect(AddressUtil.sanitizeStateToAbbreviation("San Juan", { countryCode: "PR" })).toBe("PR");
			expect(AddressUtil.sanitizeStateToAbbreviation("Bayamón", { countryCode: "PR" })).toBe("PR");
			expect(AddressUtil.sanitizeStateToAbbreviation("Aguilita", { countryCode: "PR" })).toBe("PR");
		});

		it("handles lowercase countryCode 'pr'", () => {
			expect(AddressUtil.sanitizeStateToAbbreviation("JUANA DÍAZ", { countryCode: "pr" })).toBe("PR");
		});

		it("handles mixed-case countryCode 'Pr'", () => {
			expect(AddressUtil.sanitizeStateToAbbreviation("San Juan", { countryCode: "Pr" })).toBe("PR");
		});

		it("maps 'puertorico' to PR when no countryCode is provided (existing behavior)", () => {
			expect(AddressUtil.sanitizeStateToAbbreviation("puertorico")).toBe("PR");
			expect(AddressUtil.sanitizeStateToAbbreviation("Puerto Rico")).toBe("PR");
		});
	});

	describe("truncate mode", () => {
		it("truncates unknown values to first 2 characters when truncate=true", () => {
			expect(AddressUtil.sanitizeStateToAbbreviation("UnknownState", { truncate: true })).toBe("UN");
		});

		it("returns original uppercase value when truncate=false and not found", () => {
			expect(AddressUtil.sanitizeStateToAbbreviation("UnknownState", { truncate: false })).toBe("UNKNOWNSTATE");
		});
	});

	describe("backward compatibility — no countryCode", () => {
		it("works without countryCode parameter", () => {
			expect(AddressUtil.sanitizeStateToAbbreviation("CA")).toBe("CA");
			expect(AddressUtil.sanitizeStateToAbbreviation("california")).toBe("CA");
			expect(AddressUtil.sanitizeStateToAbbreviation("NSW")).toBe("NSW");
		});
	});
});
