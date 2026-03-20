import { convertWorthToPlaid, formatPostalCode } from "../convert";

describe("conversion functions", () => {
	it("should convert state name to abbreviation", () => {
		const result = convertWorthToPlaid("states", "CALIFORNIA");
		expect(result).toBe("CA");
	});
	it("should convert state with spaces", () => {
		const result = convertWorthToPlaid("states", "NORTH CAROLINA");
		expect(result).toBe("NC");
	});

	it("should convert country name to abbreviation", () => {
		const result = convertWorthToPlaid("country", "UNITES STATES");
		expect(result).toBe("US");
	});

	it("should format zip code to 5 digit expectation", () => {
		const result = formatPostalCode("12345-1234");
		expect(result).toBe("12345");
	});
	it("should pad 0s when necessary in a zipcode", () => {
		const result = formatPostalCode("1234");
		expect(result).toBe("01234");
	});

	it("should remove non-alphanumeric characters from a postal code", () => {
		const usPostalCode = formatPostalCode("12345-1234");
		expect(usPostalCode).toBe("12345");

		const caPostalCode = formatPostalCode("A1B 2C3", "CA");
		expect(caPostalCode).toBe("A1B2C3");

		const ukPostalCode1 = formatPostalCode("SW1a 1aa", "GB");
		expect(ukPostalCode1).toBe("SW1A1AA");

		const ukPostalCode2 = formatPostalCode("SW1a 1aa", "UNITED kingdom");
		expect(ukPostalCode2).toBe("SW1A1AA");
	});

	it("should return undefined if the postal code is null", () => {
		const result = formatPostalCode(null);
		expect(result).toBeUndefined();
	});

	it("should convert worth to plaid for countries", () => {
		const usCountry = convertWorthToPlaid("country", "UNITES STATES");
		expect(usCountry).toBe("US");

		const caCountry = convertWorthToPlaid("country", "CANADA");
		expect(caCountry).toBe("CA");

		const gbCountry = convertWorthToPlaid("country", "united kingdom");
		expect(gbCountry).toBe("GB");

		const gbCountry2 = convertWorthToPlaid("country", "UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND");
		expect(gbCountry2).toBe("GB");

		const gbCountry3 = convertWorthToPlaid("country", "gb");
		expect(gbCountry3).toBe("GB");
	});
});
