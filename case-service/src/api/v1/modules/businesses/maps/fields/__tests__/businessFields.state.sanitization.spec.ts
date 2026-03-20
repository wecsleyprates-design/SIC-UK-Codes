import type { MapperField } from "#types";

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
 * Simulates the resolve phase: getMappedValueForColumn returns undefined,
 * input.get() returns the raw payload value.
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
 * Simulates the post-resolve phase: getMappedValueForColumn returns the mapped value.
 */
function createMockMapperWithMappedFields(country: string): any {
	return {
		getMappedValueForColumn: jest.fn().mockReturnValue(country),
		input: new Map([["address_country", country]]),
		getAdditionalMetadata: jest.fn().mockReturnValue({})
	};
}

describe("businessFields.address_state sanitization", () => {
	let sanitizeFn: (mapper: any, value: string) => Promise<string>;

	beforeAll(() => {
		const businessFieldsModule = require("../businessFields");
		const fields = businessFieldsModule.getBusinessFields();
		const stateField = fields.find((f: MapperField) => f.column === "address_state");

		if (!stateField?.sanitize) {
			throw new Error("address_state field or sanitize function not found");
		}

		sanitizeFn = stateField.sanitize;
	});

	describe("during resolve phase (mappedFields empty — input fallback)", () => {
		it("should return 'PR' for any state value when country is PR", async () => {
			const mapper = createMockMapper({ address_country: "PR" });
			expect(await sanitizeFn(mapper, "JUANA DÍAZ")).toBe("PR");
			expect(await sanitizeFn(mapper, "San Juan")).toBe("PR");
			expect(await sanitizeFn(mapper, "Bayamón")).toBe("PR");
		});

		it("should abbreviate US state names", async () => {
			const mapper = createMockMapper({ address_country: "US" });
			expect(await sanitizeFn(mapper, "california")).toBe("CA");
			expect(await sanitizeFn(mapper, "New York")).toBe("NY");
		});

		it("should pass through US state codes unchanged", async () => {
			const mapper = createMockMapper({ address_country: "US" });
			expect(await sanitizeFn(mapper, "CA")).toBe("CA");
			expect(await sanitizeFn(mapper, "TX")).toBe("TX");
		});

		it("should abbreviate AU state names", async () => {
			const mapper = createMockMapper({ address_country: "AU" });
			expect(await sanitizeFn(mapper, "newsouthwales")).toBe("NSW");
			expect(await sanitizeFn(mapper, "victoria")).toBe("VIC");
		});

		it("should abbreviate NZ region names", async () => {
			const mapper = createMockMapper({ address_country: "NZ" });
			expect(await sanitizeFn(mapper, "auckland")).toBe("AUK");
			expect(await sanitizeFn(mapper, "wellington")).toBe("WGN");
		});

		it("should abbreviate CA province names", async () => {
			const mapper = createMockMapper({ address_country: "CA" });
			expect(await sanitizeFn(mapper, "ontario")).toBe("ON");
			expect(await sanitizeFn(mapper, "britishcolumbia")).toBe("BC");
		});

		it("should fallback to stateMap lookup when no country in input", async () => {
			const mapper = createMockMapper({});
			expect(await sanitizeFn(mapper, "california")).toBe("CA");
			expect(await sanitizeFn(mapper, "NSW")).toBe("NSW");
		});
	});

	describe("post-resolve phase (mappedFields populated)", () => {
		it("should use mapped country value for PR", async () => {
			const mapper = createMockMapperWithMappedFields("PR");
			expect(await sanitizeFn(mapper, "Ponce")).toBe("PR");
		});

		it("should use mapped country value for US", async () => {
			const mapper = createMockMapperWithMappedFields("US");
			expect(await sanitizeFn(mapper, "california")).toBe("CA");
		});

		it("should use mapped country value for AU", async () => {
			const mapper = createMockMapperWithMappedFields("AU");
			expect(await sanitizeFn(mapper, "queensland")).toBe("QLD");
		});
	});

	describe("Puerto Rico regression — JUANA DÍAZ should not fail validation", () => {
		it("should sanitize municipality names to 'PR' before validation length check", async () => {
			const mapper = createMockMapper({ address_country: "PR" });
			const result = await sanitizeFn(mapper, "JUANA DÍAZ");
			expect(result).toBe("PR");
			expect(result.length).toBeGreaterThanOrEqual(2);
			expect(result.length).toBeLessThanOrEqual(3);
		});
	});
});
