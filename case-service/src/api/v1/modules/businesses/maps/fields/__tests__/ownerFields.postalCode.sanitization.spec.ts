import type { MapperField } from "#types";

// Mock helpers BEFORE importing ownerFields to avoid LRUCache issues
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

jest.mock("#helpers", () => ({
	logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() }
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
	validateBusiness: jest.fn().mockResolvedValue({
		data: { business_id: "test-business-id" }
	})
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

// addressUtil imports isUSBusiness from #helpers/countryHelper; must export it so sanitizePostalCode works
jest.mock("#helpers/countryHelper", () => ({
	resolveCountryCode: jest.fn(),
	isUSBusiness: jest.fn((country?: string) => (country ?? "").toString().toUpperCase() === "US" || (country ?? "").toString().toUpperCase() === "USA"),
	isCountryAllowedWithSetupCheck: jest.fn().mockResolvedValue(true)
}));

jest.mock("#common", () => ({ addIndustryAndNaicsPlatform: jest.fn() }));

// Break the import chain: ownerFields → BulkCreateBusinessMap → fields/index → applicantFields → businessInvites → customFieldHelper → customField
jest.mock("../../bulkCreateBusinessMap", () => ({
	BulkCreateBusinessMap: jest.fn()
}));

jest.mock("../../../owners", () => ({
	Owners: { getOwnerTitles: jest.fn().mockResolvedValue({}) }
}));

jest.mock("#configs", () => ({
	envConfig: { ENTERPRISE_APPLICANT_ID: "test-applicant-id" }
}));

jest.mock("#constants", () => ({
	OWNER_TYPES: { BENEFICIARY: "BENEFICIARY", CONTROL: "CONTROL" }
}));

/**
 * Creates a mock mapper simulating the resolve phase where
 * getMappedValueForColumn returns undefined (fields not yet resolved)
 * but input.get() returns the raw payload value.
 */
function createMockMapper(inputData: Record<string, any>): any {
	return {
		getMappedValueForColumn: jest.fn().mockReturnValue(undefined),
		input: new Map(Object.entries(inputData)),
		getAdditionalMetadata: jest.fn().mockReturnValue({})
	};
}

describe("ownerFields.owner1_address_postal sanitization", () => {
	let sanitizeFn: (mapper: any, value: string) => Promise<string>;

	beforeAll(() => {
		const ownerFieldsModule = require("../ownerFields");
		const fields = ownerFieldsModule.getOwnerFields("create");

		// getOwnerFields generates owner1_..owner5_ fields;
		// we test the first owner's postal code
		const postalCodeField = fields.find(
			(f: MapperField) => f.column === "owner1_address_postal"
		);

		if (!postalCodeField?.sanitize) {
			throw new Error("owner1_address_postal field or sanitize function not found");
		}

		sanitizeFn = postalCodeField.sanitize;
	});

	describe("country-aware sanitization via input fallback (resolve phase)", () => {
		it("should NOT pad NZ postal codes", async () => {
			const mapper = createMockMapper({ address_country: "NZ" });
			const result = await sanitizeFn(mapper, "2013");
			expect(result).toBe("2013");
			expect(result).not.toBe("02013");
		});

		it("should NOT pad AU postal codes", async () => {
			const mapper = createMockMapper({ address_country: "AU" });
			expect(await sanitizeFn(mapper, "3000")).toBe("3000");
		});

		it("should pad US postal codes to 5 digits", async () => {
			const mapper = createMockMapper({ address_country: "US" });
			expect(await sanitizeFn(mapper, "2013")).toBe("02013");
		});

		it("should pad PR postal codes to 5 digits", async () => {
			const mapper = createMockMapper({ address_country: "PR" });
			expect(await sanitizeFn(mapper, "901")).toBe("00901");
		});

		it("should preserve CA alphanumeric postal codes", async () => {
			const mapper = createMockMapper({ address_country: "CA" });
			expect(await sanitizeFn(mapper, "K1A 0B1")).toBe("K1A0B1");
		});

		it("should preserve GB alphanumeric postal codes", async () => {
			const mapper = createMockMapper({ address_country: "GB" });
			expect(await sanitizeFn(mapper, "EC1A 1BB")).toBe("EC1A1BB");
		});

		it("should default to US when no country in input", async () => {
			const mapper = createMockMapper({});
			expect(await sanitizeFn(mapper, "2013")).toBe("02013");
		});
	});

	describe("generated owner fields (owner2-5) should also sanitize correctly", () => {
		it("owner2_address_postal should have a sanitize function", () => {
			const ownerFieldsModule = require("../ownerFields");
			const fields = ownerFieldsModule.getOwnerFields("create");
			const owner2Postal = fields.find(
				(f: MapperField) => f.column === "owner2_address_postal"
			);
			expect(owner2Postal).toBeDefined();
			expect(owner2Postal?.sanitize).toBeDefined();
		});

		it("owner2_address_postal should NOT pad NZ postal codes", async () => {
			const ownerFieldsModule = require("../ownerFields");
			const fields = ownerFieldsModule.getOwnerFields("create");
			const owner2Postal = fields.find(
				(f: MapperField) => f.column === "owner2_address_postal"
			);
			const mapper = createMockMapper({ address_country: "NZ" });
			expect(await owner2Postal!.sanitize!(mapper, "6011")).toBe("6011");
		});
	});
});
