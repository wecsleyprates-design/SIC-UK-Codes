import { sanitizePostalCode } from "../sanitizers";

describe("sanitizePostalCode", () => {
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
		])("sanitizePostalCode(%s, %s) => %s", (input, country, expected) => {
			expect(sanitizePostalCode(input, country)).toBe(expected);
		});

		it("defaults to US behavior when country is undefined", () => {
			expect(sanitizePostalCode("2013")).toBe("02013");
			expect(sanitizePostalCode("12345")).toBe("12345");
		});

		it("defaults to US behavior when country is empty string", () => {
			expect(sanitizePostalCode("2013", "")).toBe("02013");
		});
	});

	describe("Australia — 4-digit, no padding", () => {
		it.each([
			["2013", "AU", "2013"],
			["2000", "AU", "2000"],
			["6011", "AU", "6011"],
			["200", "AU", "200"],
			["12345", "AU", "1234"]
		])("sanitizePostalCode(%s, %s) => %s", (input, country, expected) => {
			expect(sanitizePostalCode(input, country)).toBe(expected);
		});
	});

	describe("New Zealand — 4-digit, no padding", () => {
		it.each([
			["2013", "NZ", "2013"],
			["6011", "NZ", "6011"],
			["0600", "NZ", "0600"],
			["12345", "NZ", "1234"]
		])("sanitizePostalCode(%s, %s) => %s", (input, country, expected) => {
			expect(sanitizePostalCode(input, country)).toBe(expected);
		});
	});

	describe("Canada — alphanumeric, no padding, max 10 chars", () => {
		it.each([
			["M5H2N2", "CA", "M5H2N2"],
			["M5H 2N2", "CA", "M5H2N2"],
			["K1A0B1", "CA", "K1A0B1"]
		])("sanitizePostalCode(%s, %s) => %s", (input, country, expected) => {
			expect(sanitizePostalCode(input, country)).toBe(expected);
		});
	});

	describe("UK / GB — alphanumeric, no padding, max 10 chars", () => {
		it.each([
			["SW1A1AA", "GB", "SW1A1AA"],
			["SW1A 1AA", "GB", "SW1A1AA"],
			["SW1A1AA", "UK", "SW1A1AA"],
			["EC1A1BB", "GB", "EC1A1BB"]
		])("sanitizePostalCode(%s, %s) => %s", (input, country, expected) => {
			expect(sanitizePostalCode(input, country)).toBe(expected);
		});
	});

	describe("special character removal", () => {
		it("removes dashes from US zip+4", () => {
			expect(sanitizePostalCode("12345-6789", "US")).toBe("12345");
		});

		it("removes spaces from CA postal code", () => {
			expect(sanitizePostalCode("M5H 2N2", "CA")).toBe("M5H2N2");
		});

		it("removes dashes from NZ postal code", () => {
			expect(sanitizePostalCode("60-11", "NZ")).toBe("6011");
		});
	});

	describe("country case insensitivity", () => {
		it("handles lowercase country codes", () => {
			expect(sanitizePostalCode("2013", "nz")).toBe("2013");
			expect(sanitizePostalCode("2013", "au")).toBe("2013");
			expect(sanitizePostalCode("2013", "us")).toBe("02013");
		});

		it("handles mixed-case country codes", () => {
			expect(sanitizePostalCode("2013", "Nz")).toBe("2013");
			expect(sanitizePostalCode("2013", "Au")).toBe("2013");
		});
	});
});
