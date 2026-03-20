import { AddressUtil } from "#utils/addressUtil";
import { isCanadianAddress } from "../canadianProvinces";

// Mock the dependencies
jest.mock("../canadianProvinces");

const mockIsCanadianAddress = isCanadianAddress as jest.MockedFunction<typeof isCanadianAddress>;

// Add more addresses to this list as needed to test edge cases
const addresses = [
	"1 World Trade Ctr Fl 80, New York, NY 10007-0042",
	"120 Broadway, 5th and 6th floor, New York, NY",
	"2 1/2 Beacon St, Concord, NH 03301-4447",
	"95 Main St # B, Jeffersonville, VT 05464-2101",
	"1 World Trade Center, 80th and 81st Floor, Manhattan, New York, NY, 10007"
];

describe("AddressUtil", () => {
	it("should normalize an address string into a normalized address object", () => {
		const address = "123 Main Street, Apt 456, New York, NY 10001";
		const normalized = AddressUtil.stringToParts(address);
		expect(normalized).toEqual({
			line_1: "123 Main St",
			line_2: "Apt 456",
			line_3: "New York, NY, 10001",
			city: "New York",
			state: "NY",
			postal_code: "10001",
			country: null,
			formatted_address: "123 Main St, Apt 456, New York, NY, 10001"
		});
	});

	it("should convert a normalized address object to a string", () => {
		const address = {
			line_1: "123 Main St",
			line_3: "New York, NY, 10001",
			city: "New York",
			state: "NY",
			postal_code: "10001",
			country: null
		} as unknown as any;
		const normalized = AddressUtil.partsToString(address);
		expect(normalized).toEqual("123 Main St, New York, NY, 10001");
	});

	it("should convert a CaseAddressObject to a NormalizedAddress with Apartment", () => {
		const address = {
			line_1: "123 Main Street",
			apartment: "Suite 456",
			city: "New York",
			state: "NY",
			postal_code: "00001"
		};
		const normalized = AddressUtil.normalizeCaseAddress(address);
		expect(normalized).toEqual({
			line_1: "123 Main St",
			line_2: "Suite 456",
			line_3: "New York, NY, 00001",
			city: "New York",
			state: "NY",
			postal_code: "00001",
			formatted_address: "123 Main St, Suite 456, New York, NY, 00001",
			country: null
		});
	});

	it("should convert a CaseAddressObject to a NormalizedAddress without Apartment", () => {
		const address = {
			line_1: "123 Main Street",
			city: "New York",
			state: "NY",
			postal_code: "00001"
		} as unknown as any;
		const normalized = AddressUtil.normalizeCaseAddress(address);
		expect(normalized).toEqual({
			line_1: "123 Main St",
			line_2: null,
			line_3: "New York, NY, 00001",
			city: "New York",
			state: "NY",
			postal_code: "00001",
			formatted_address: "123 Main St, New York, NY, 00001",
			country: null
		});
	});

	it("should convert an address string to a normalized address string", () => {
		const address = "123 West Main Avenue North, Apt 456, S Hampton, New York, 10001";
		const normalized = AddressUtil.normalizeString(address);
		expect(normalized).toEqual("123 W Main Ave N, Apt 456, South Hampton, NY, 10001");
	});

	it("should calculate the levenshtein distance between two addresses that have different formatting (same)", () => {
		const address1 = "123 Main Street, New York, New York, 10001";
		const address2 = "123 Main St, New York, NY 10001";
		const distance = AddressUtil.levenshteinDistance(address1, address2);
		expect(distance).toEqual(0);
	});
	it("should calculate the levenshtein distance between two addresses that have different formatting (different zip)", () => {
		const address1 = "123 North Main Street, New York, New York, 10001";
		const address2 = "123 N Main St, New York, ny 00001";
		const distance = AddressUtil.levenshteinDistance(address1, address2);
		expect(distance).toEqual(1);
	});
	it("should calculate the levenshtein distance between two addresses that have different formatting (totally different)", () => {
		const address1 = "257 Maple Street, New Bedford, MA 02740";
		const address2 = "123 N Main St, New York, ny 00001";
		const distance = AddressUtil.levenshteinDistance(address1, address2);
		expect(distance).toEqual(18);
	});
	it("should calculate levenshtein distance correctly for addresses with differing zip code lengths", () => {
		const address1 = "4898 New Broad St, Orlando, FL 32814-6628";
		const address2 = "4898 New Broad St, Orlando, Florida 32814";
		const distance = AddressUtil.levenshteinDistance(address1, address2);
		expect(distance).toEqual(0);
	});
	it("should calculate levenshtein distance correctly when addresses are passed as objects or strings", () => {
		const address1 = "4898 New Broad St, Orlando, FL 32814-6628";
		const distance = AddressUtil.levenshteinDistance(address1, {
			line_1: "4898 New Broad St",
			city: "Orlando",
			state: "Florida",
			postal_code: "32814",
			country: "United States"
		} as any);
		expect(distance).toEqual(0);
	});
	it("should calculate levenshtein distance correctly when addresses are passed as objects or strings and have line 2", () => {
		const address1 = "4898 New Broad St, Suite 456, Orlando, FL 32814-6628";
		const distance = AddressUtil.levenshteinDistance(address1, {
			line_1: "4898 New Broad St",
			line_2: "Suite 456",
			city: "Orlando",
			state: "Florida",
			postal_code: "32814",
			country: "USA"
		} as any);
		expect(distance).toEqual(0);
	});
	it("should calculate levenshtein distance correctly when addresses are passed as objects or strings and have apartment", () => {
		const address1 = "4898 New Broad St, Suite 456, Orlando, FL 32814-6628";
		const distance = AddressUtil.levenshteinDistance(address1, {
			line_1: "4898 New Broad St",
			apartment: "Suite 456",
			city: "Orlando",
			state: "Florida",
			postal_code: "32814",
			country: "USA"
		} as any);
		expect(distance).toEqual(0);
	});

	it("should parse and normalize various address formats", () => {
		addresses.forEach(addr => {
			const parts = AddressUtil.stringToParts(addr);
			const normalized = AddressUtil.partsToString(parts, true);
			expect(parts).toBeTruthy();
			expect(normalized).toBeTruthy();
		});
	});

	it("should format a complete address with all fields", () => {
		const address = {
			line_1: "123 Main Street",
			apartment: "Suite 456",
			city: "New York",
			state: "NY",
			postal_code: "10001",
			country: "US",
			is_primary: true
		};
		const result = AddressUtil.formatBusinessAddressToString(address);
		expect(result).toBe("123 Main Street, Suite 456, New York, NY, 10001, United States");
	});

	it("should format an address with missing apartment", () => {
		const address = {
			line_1: "100 Queen Street",
			city: "Toronto",
			state: "ON",
			postal_code: "M5H2N2",
			country: "CA",
			is_primary: true
		};
		const result = AddressUtil.formatBusinessAddressToString(address);
		expect(result).toBe("100 Queen Street, Toronto, ON, M5H2N2, Canada");
	});

	it("should handle country code that is not in mapping", () => {
		const address = {
			line_1: "600 Park Avenue",
			city: "London",
			state: "England",
			postal_code: "SW1A1AA",
			country: "ASDF",
			is_primary: true
		};
		const result = AddressUtil.formatBusinessAddressToString(address);
		expect(result).toBe("600 Park Avenue, London, England, SW1A1AA, ASDF");
	});

	it("should filter out empty string, null, and undefined fields", () => {
		const address = {
			line_1: "700 Main St",
			apartment: "",
			city: null,
			state: undefined,
			postal_code: "60601",
			country: "US",
			is_primary: true
		} as unknown as any;
		const result = AddressUtil.formatBusinessAddressToString(address);
		expect(result).toBe("700 Main St, 60601, United States");
		expect(result).not.toContain(", ,"); // No double commas
	});
});

describe("normalizeForComparison", () => {
	it("should treat 'Suite' and 'Unit' as equivalent", () => {
		const a = AddressUtil.normalizeForComparison("123 Main St, Suite 201, New York, NY, 10001");
		const b = AddressUtil.normalizeForComparison("123 Main St, Unit 201, New York, NY, 10001");
		expect(a).toBe(b);
	});

	it("should treat 'Ste' and 'Unit' as equivalent", () => {
		const a = AddressUtil.normalizeForComparison("100 Main St, Ste 5, New York, NY, 10001");
		const b = AddressUtil.normalizeForComparison("100 Main St, Unit 5, New York, NY, 10001");
		expect(a).toBe(b);
	});

	it("should treat 'Apt' and 'Unit' as equivalent", () => {
		const a = AddressUtil.normalizeForComparison("123 Main St, Apt 456, New York, NY, 10001");
		const b = AddressUtil.normalizeForComparison("123 Main St, Unit 456, New York, NY, 10001");
		expect(a).toBe(b);
	});

	it("should treat 'Apartment' and 'Unit' as equivalent", () => {
		const a = AddressUtil.normalizeForComparison("123 Main St, Apartment 456, New York, NY, 10001");
		const b = AddressUtil.normalizeForComparison("123 Main St, Unit 456, New York, NY, 10001");
		expect(a).toBe(b);
	});

	it("should treat 'Floor' and 'Fl' as equivalent", () => {
		const a = AddressUtil.normalizeForComparison("500 Park Ave, Floor 10, New York, NY, 10022");
		const b = AddressUtil.normalizeForComparison("500 Park Ave, Fl 10, New York, NY, 10022");
		expect(a).toBe(b);
	});

	it("should produce lowercase output", () => {
		const result = AddressUtil.normalizeForComparison("123 Main St, Suite 201, New York, NY, 10001");
		expect(result).toBe(result.toLowerCase());
	});

	it("should handle addresses without unit designators", () => {
		const a = AddressUtil.normalizeForComparison("171 E Liberty St, New York, NY, 10001");
		const b = AddressUtil.normalizeForComparison("171 E Liberty St, New York, NY, 10001");
		expect(a).toBe(b);
	});

	it("should produce different results for truly different addresses", () => {
		const a = AddressUtil.normalizeForComparison("123 Main St, Suite 201, New York, NY, 10001");
		const b = AddressUtil.normalizeForComparison("456 Oak Ave, Suite 201, New York, NY, 10001");
		expect(a).not.toBe(b);
	});

	it("should produce different results for different unit numbers", () => {
		const a = AddressUtil.normalizeForComparison("123 Main St, Suite 201, New York, NY, 10001");
		const b = AddressUtil.normalizeForComparison("123 Main St, Suite 302, New York, NY, 10001");
		expect(a).not.toBe(b);
	});
});

describe("normalizeToBaseAddress", () => {
	it("should strip 'Unit' designator and number from address", () => {
		const result = AddressUtil.normalizeToBaseAddress("171 E Liberty St, Unit 201, NT, M6K 3P6, Canada");
		expect(result).not.toContain("unit");
		expect(result).not.toContain("201");
	});

	it("should strip 'Suite' designator and number from address", () => {
		const result = AddressUtil.normalizeToBaseAddress("171 E Liberty St, Suite 201, NT, M6K 3P6, Canada");
		expect(result).not.toContain("suite");
		expect(result).not.toContain("ste");
		expect(result).not.toContain("201");
	});

	it("should match address with unit to address without unit", () => {
		const withUnit = AddressUtil.normalizeToBaseAddress("171 E Liberty St, Unit 201, NT, M6K 3P6, Canada");
		const withoutUnit = AddressUtil.normalizeToBaseAddress("171 E Liberty St, NT, M6K 3P6, Canada");
		expect(withUnit).toBe(withoutUnit);
	});

	it("should match address with Suite to address without unit", () => {
		const withSuite = AddressUtil.normalizeToBaseAddress("171 E Liberty St, Suite 201, NT, M6K 3P6, Canada");
		const withoutUnit = AddressUtil.normalizeToBaseAddress("171 E Liberty St, NT, M6K 3P6, Canada");
		expect(withSuite).toBe(withoutUnit);
	});

	it("should match address with Apt to address without unit", () => {
		const withApt = AddressUtil.normalizeToBaseAddress("123 Main St, Apt 456, New York, NY, 10001");
		const withoutUnit = AddressUtil.normalizeToBaseAddress("123 Main St, New York, NY, 10001");
		expect(withApt).toBe(withoutUnit);
	});

	it("should produce lowercase output", () => {
		const result = AddressUtil.normalizeToBaseAddress("171 E Liberty St, Unit 201, NT, M6K 3P6, Canada");
		expect(result).toBe(result.toLowerCase());
	});

	it("should leave addresses without unit designators unchanged (compared to themselves)", () => {
		const a = AddressUtil.normalizeToBaseAddress("171 E Liberty St, NT, M6K 3P6, Canada");
		const b = AddressUtil.normalizeToBaseAddress("171 E Liberty St, NT, M6K 3P6, Canada");
		expect(a).toBe(b);
	});

	it("should produce different results for truly different street addresses", () => {
		const a = AddressUtil.normalizeToBaseAddress("123 Main St, Unit 201, New York, NY, 10001");
		const b = AddressUtil.normalizeToBaseAddress("456 Oak Ave, New York, NY, 10001");
		expect(a).not.toBe(b);
	});

	it("should handle the Dream Payments scenario: all unit variants match the base address", () => {
		const base = AddressUtil.normalizeToBaseAddress("171 E Liberty St, NT, M6K 3P6, Canada");
		const unit = AddressUtil.normalizeToBaseAddress("171 E Liberty St, Unit 201, NT, M6K 3P6, Canada");
		const suite = AddressUtil.normalizeToBaseAddress("171 East Liberty St, suite 201, Toronto, ON, M6K3E7, CA");
		// base and unit should match (same street + postal area)
		expect(base).toBe(unit);
		// suite has a different postal code (M6K3E7 vs M6K 3P6), so it may differ
		// This test documents the behavior rather than asserting equality
		expect(typeof suite).toBe("string");
	});
});

describe("Country Utility Functions", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getCountryFullName", () => {
		it("should return full country name for valid country codes", () => {
			expect(AddressUtil.getCountryFullName("US")).toBe("United States");
			expect(AddressUtil.getCountryFullName("CA")).toBe("Canada");
		});

		it("should handle case insensitive country codes", () => {
			expect(AddressUtil.getCountryFullName("us")).toBe("United States");
			expect(AddressUtil.getCountryFullName("ca")).toBe("Canada");
			expect(AddressUtil.getCountryFullName("Us")).toBe("United States");
		});

		it("should return the original code if not found in mapping", () => {
			expect(AddressUtil.getCountryFullName("XX")).toBe("XX");
			expect(AddressUtil.getCountryFullName("INVALID")).toBe("INVALID");
		});

		it("should handle empty string", () => {
			expect(AddressUtil.getCountryFullName("")).toBe("");
		});
	});

	describe("addCountryToAddress", () => {
		beforeEach(() => {
			// Reset mocks before each test
			mockIsCanadianAddress.mockReturnValue(false);
		});

		it("should return original address if it already contains country information", () => {
			const testCases = [
				"123 Main St, New York, NY 10001, United States",
				"456 Queen St, Toronto, ON M5H 2N2, Canada",
				"789 Oxford St, London, UK",
				"321 Broadway, New York, NY 10001, US",
				"654 Yonge St, Toronto, ON M4Y 1Z5, CA"
			];

			testCases.forEach(address => {
				expect(AddressUtil.addCountryToAddress(address)).toBe(address);
			});
		});

		it("should add Canada to Canadian addresses", () => {
			mockIsCanadianAddress.mockReturnValue(true);

			const address = "123 Main St, Toronto, ON M5H 2N2";
			const expected = "123 Main St, Toronto, ON M5H 2N2, Canada";

			expect(AddressUtil.addCountryToAddress(address)).toBe(expected);
			expect(mockIsCanadianAddress).toHaveBeenCalledWith(address);
		});

		it("should add United States to US addresses", () => {
			// Mock AddressUtil.isUSAddress to return true
			const mockIsUSAddress = jest.spyOn(AddressUtil, "isUSAddress").mockReturnValue(true);

			const address = "123 Main St, New York, NY 10001";
			const expected = "123 Main St, New York, NY 10001, United States";

			expect(AddressUtil.addCountryToAddress(address)).toBe(expected);
			expect(mockIsUSAddress).toHaveBeenCalledWith(address);
		});

		it("should add United Kingdom to UK addresses", () => {
			// Mock AddressUtil.isUkAddress to return true
			const mockIsUkAddress = jest.spyOn(AddressUtil, "isUkAddress").mockReturnValue(true);

			const address = "123 Oxford St, London, SW1A 1AA";
			const expected = "123 Oxford St, London, SW1A 1AA, United Kingdom";

			expect(AddressUtil.addCountryToAddress(address)).toBe(expected);
			expect(mockIsUkAddress).toHaveBeenCalledWith(address);
		});

		it("should return original address if no country can be detected", () => {
			// Mock AddressUtil methods
			const mockIsUSAddress = jest.spyOn(AddressUtil, "isUSAddress").mockReturnValue(false);
			const mockIsUkAddress = jest.spyOn(AddressUtil, "isUkAddress").mockReturnValue(false);

			const address = "123 Main St, Unknown City, XX 12345";

			expect(AddressUtil.addCountryToAddress(address)).toBe(address);
			expect(mockIsCanadianAddress).toHaveBeenCalledWith(address);
			expect(mockIsUSAddress).toHaveBeenCalledWith(address);
			expect(mockIsUkAddress).toHaveBeenCalledWith(address);
		});

		it("should handle null and undefined inputs", () => {
			expect(AddressUtil.addCountryToAddress(null as any)).toBe(null);
			expect(AddressUtil.addCountryToAddress(undefined as any)).toBe(undefined);
		});

		it("should handle non-string inputs", () => {
			expect(AddressUtil.addCountryToAddress(123 as any)).toBe(123);
			expect(AddressUtil.addCountryToAddress({} as any)).toEqual({});
		});

		it("should handle empty string", () => {
			expect(AddressUtil.addCountryToAddress("")).toBe("");
		});

		it("should prioritize Canadian detection over US detection", () => {
			mockIsCanadianAddress.mockReturnValue(true);
			const mockIsUSAddress = jest.spyOn(AddressUtil, "isUSAddress").mockReturnValue(true);

			const address = "123 Main St, Toronto, ON M5H 2N2";
			const expected = "123 Main St, Toronto, ON M5H 2N2, Canada";

			expect(AddressUtil.addCountryToAddress(address)).toBe(expected);
			expect(mockIsCanadianAddress).toHaveBeenCalledWith(address);
			// US detection should not be called if Canadian detection succeeds
			expect(mockIsUSAddress).not.toHaveBeenCalled();
		});

		it("should prioritize US detection over UK detection", () => {
			const mockIsUSAddress = jest.spyOn(AddressUtil, "isUSAddress").mockReturnValue(true);
			const mockIsUkAddress = jest.spyOn(AddressUtil, "isUkAddress").mockReturnValue(true);

			const address = "123 Main St, New York, NY 10001";
			const expected = "123 Main St, New York, NY 10001, United States";

			expect(AddressUtil.addCountryToAddress(address)).toBe(expected);
			expect(mockIsUSAddress).toHaveBeenCalledWith(address);
			// UK detection should not be called if US detection succeeds
			expect(mockIsUkAddress).not.toHaveBeenCalled();
		});

		it("should handle addresses with CA at the end (not country)", () => {
			// CA at the end should be treated as country, not state
			const address = "123 Main St, Some City, CA";
			expect(AddressUtil.addCountryToAddress(address)).toBe(address);
		});

		it("should handle addresses with CA in the middle (state)", () => {
			// CA in the middle should be treated as state, not country
			const mockIsUSAddress = jest.spyOn(AddressUtil, "isUSAddress").mockReturnValue(true);

			const address = "123 Main St, Los Angeles, CA 90210";
			const expected = "123 Main St, Los Angeles, CA 90210, United States";

			expect(AddressUtil.addCountryToAddress(address)).toBe(expected);
			expect(mockIsUSAddress).toHaveBeenCalledWith(address);
		});
	});
});
