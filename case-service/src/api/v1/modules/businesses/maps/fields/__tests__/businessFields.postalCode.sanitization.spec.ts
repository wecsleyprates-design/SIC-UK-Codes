import type { MapperField } from "#types";

// Mock helpers BEFORE importing businessFields to avoid LRUCache issues
jest.mock("#helpers/index", () => ({
	logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
	db: jest.fn(),
	redis: jest.fn(),
	getFlagValue: jest.fn(),
	BullQueue: jest.fn().mockImplementation(() => ({
		addJob: jest.fn(),
		add: jest.fn(),
		process: jest.fn(),
		close: jest.fn()
	}))
}));

jest.mock("../../../businesses", () => ({
	businesses: {
		getProgressionConfig: jest.fn().mockResolvedValue([]),
		createBusinessFromEgg: jest.fn(),
		getBusinessByID: jest.fn(),
		updateBusinessDetails: jest.fn(),
		sendBusinessInvited: jest.fn()
	}
}));

jest.mock("../../../validateBusiness", () => ({
	validateBusiness: jest.fn().mockResolvedValue({ data: { business_id: "test-business-id" } })
}));

jest.mock("../../../../onboarding/onboarding", () => ({
	onboarding: { addOrUpdateCustomerBusinessConfigs: jest.fn() }
}));

jest.mock("../../../../case-management/case-management", () => ({
	caseManagementService: {
		getCasesByBusinessId: jest.fn().mockResolvedValue([]),
		createCaseFromEgg: jest.fn()
	}
}));

jest.mock("#helpers/businessLookupHelper", () => ({
	businessLookupHelper: jest.fn().mockRejectedValue(new Error("Business not found"))
}));

// addressUtil imports isUSBusiness from #helpers/countryHelper
jest.mock("#helpers/countryHelper", () => ({
	resolveCountryCode: jest.fn(),
	isUSBusiness: jest.fn((country?: string) => (country ?? "").toString().toUpperCase() === "US" || (country ?? "").toString().toUpperCase() === "USA"),
	isCountryAllowedWithSetupCheck: jest.fn().mockResolvedValue(true)
}));

jest.mock("#common", () => ({ addIndustryAndNaicsPlatform: jest.fn() }));

jest.mock("#configs", () => ({
	envConfig: { ENTERPRISE_APPLICANT_ID: "test-applicant-id" }
}));

jest.mock("../../utils", () => ({
	...jest.requireActual("../../utils")
}));

/**
 * Creates a mock mapper that simulates the resolve phase:
 * - getMappedValueForColumn returns undefined (mappedFields not yet populated)
 * - input.get() returns the raw payload value (always available)
 *
 * This mirrors the real bug where sanitize runs before mappedFields is set.
 */
function createMockMapper(inputData: Record<string, any>): any {
	const inputMap = new Map(Object.entries(inputData));
	return {
		getMappedValueForColumn: jest.fn().mockReturnValue(undefined),
		input: inputMap,
		getAdditionalMetadata: jest.fn().mockReturnValue({})
	};
}

/**
 * Creates a mock mapper that simulates the post-resolve phase:
 * - getMappedValueForColumn returns the actual mapped value
 * - input.get() also returns the raw payload value
 */
function createMockMapperWithMappedFields(country: string): any {
	return {
		getMappedValueForColumn: jest.fn().mockReturnValue(country),
		input: new Map([["address_country", country]]),
		getAdditionalMetadata: jest.fn().mockReturnValue({})
	};
}

describe("businessFields.address_postal_code sanitization", () => {
	let sanitizeFn: (mapper: any, value: string) => Promise<string>;

	beforeAll(() => {
		const businessFieldsModule = require("../businessFields");
		const fields = businessFieldsModule.getBusinessFields();
		const postalCodeField = fields.find((f: MapperField) => f.column === "address_postal_code");

		if (!postalCodeField?.sanitize) {
			throw new Error("address_postal_code field or sanitize function not found");
		}

		sanitizeFn = postalCodeField.sanitize;
	});

	describe("during resolve phase (mappedFields empty — input fallback)", () => {
		it("should NOT pad NZ postal codes (4 digits stay 4 digits)", async () => {
			const mapper = createMockMapper({ address_country: "NZ", address_postal_code: "2013" });
			const result = await sanitizeFn(mapper, "2013");
			expect(result).toBe("2013");
			expect(result).not.toBe("02013"); // The exact bug we fixed
		});

		it("should NOT pad AU postal codes", async () => {
			const mapper = createMockMapper({ address_country: "AU", address_postal_code: "2000" });
			const result = await sanitizeFn(mapper, "2000");
			expect(result).toBe("2000");
			expect(result).not.toBe("02000");
		});

		it("should pad US postal codes to 5 digits", async () => {
			const mapper = createMockMapper({ address_country: "US", address_postal_code: "2013" });
			const result = await sanitizeFn(mapper, "2013");
			expect(result).toBe("02013");
		});

		it("should pad PR postal codes to 5 digits", async () => {
			const mapper = createMockMapper({ address_country: "PR", address_postal_code: "901" });
			const result = await sanitizeFn(mapper, "901");
			expect(result).toBe("00901");
		});

		it("should preserve CA alphanumeric postal codes without padding", async () => {
			const mapper = createMockMapper({ address_country: "CA", address_postal_code: "M5H 2N2" });
			const result = await sanitizeFn(mapper, "M5H 2N2");
			expect(result).toBe("M5H2N2");
		});

		it("should preserve UK/GB alphanumeric postal codes without padding", async () => {
			const mapper = createMockMapper({ address_country: "GB", address_postal_code: "SW1A 1AA" });
			const result = await sanitizeFn(mapper, "SW1A 1AA");
			expect(result).toBe("SW1A1AA");
		});

		it("should default to US behavior when country is missing from input", async () => {
			const mapper = createMockMapper({ address_postal_code: "2013" });
			const result = await sanitizeFn(mapper, "2013");
			expect(result).toBe("02013"); // US default: padded
		});
	});

	describe("post-resolve phase (mappedFields populated)", () => {
		it("should use mapped country value for NZ", async () => {
			const mapper = createMockMapperWithMappedFields("NZ");
			const result = await sanitizeFn(mapper, "6011");
			expect(result).toBe("6011");
		});

		it("should use mapped country value for US", async () => {
			const mapper = createMockMapperWithMappedFields("US");
			const result = await sanitizeFn(mapper, "123");
			expect(result).toBe("00123");
		});
	});

	describe("real-world NZ/AU postal codes (regression)", () => {
		const nzCases: [string, string][] = [
			["2013", "2013"], // East Tamaki, Auckland
			["6011", "6011"], // Wellington
			["0600", "0600"], // Whangarei (leading zero preserved, no extra padding)
			["8013", "8013"] // Christchurch
		];

		it.each(nzCases)(
			"NZ postal code %s should remain %s (no padding)",
			async (input, expected) => {
				const mapper = createMockMapper({ address_country: "NZ" });
				expect(await sanitizeFn(mapper, input)).toBe(expected);
			}
		);

		const auCases: [string, string][] = [
			["2000", "2000"], // Sydney
			["3000", "3000"], // Melbourne
			["4000", "4000"], // Brisbane
			["6000", "6000"] // Perth
		];

		it.each(auCases)(
			"AU postal code %s should remain %s (no padding)",
			async (input, expected) => {
				const mapper = createMockMapper({ address_country: "AU" });
				expect(await sanitizeFn(mapper, input)).toBe(expected);
			}
		);
	});
});
