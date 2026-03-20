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

jest.mock("#helpers/countryHelper", () => ({
	resolveCountryCode: jest.fn(),
	isUSBusiness: jest.fn((country?: string) => (country ?? "").toString().toUpperCase() === "US" || (country ?? "").toString().toUpperCase() === "USA"),
	isCountryAllowedWithSetupCheck: jest.fn().mockResolvedValue(true)
}));

jest.mock("#common", () => ({ addIndustryAndNaicsPlatform: jest.fn() }));

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
 * Owner state sanitization reads the **business** country (address_country in data_businesses),
 * not the owner's own country. This mock simulates that lookup.
 */
function createMockMapper(inputData: Record<string, any>): any {
	return {
		getMappedValueForColumn: jest.fn().mockReturnValue(undefined),
		input: new Map(Object.entries(inputData)),
		getAdditionalMetadata: jest.fn().mockReturnValue({})
	};
}

function createMockMapperWithMappedFields(country: string): any {
	return {
		getMappedValueForColumn: jest.fn().mockReturnValue(country),
		input: new Map([["address_country", country]]),
		getAdditionalMetadata: jest.fn().mockReturnValue({})
	};
}

describe("ownerFields.owner1_address_state sanitization", () => {
	let sanitizeFn: (mapper: any, value: string) => Promise<string>;

	beforeAll(() => {
		const ownerFieldsModule = require("../ownerFields");
		const fields = ownerFieldsModule.getOwnerFields("create");

		const stateField = fields.find(
			(f: MapperField) => f.column === "owner1_address_state"
		);

		if (!stateField?.sanitize) {
			throw new Error("owner1_address_state field or sanitize function not found");
		}

		sanitizeFn = stateField.sanitize;
	});

	describe("country-aware sanitization via business country (resolve phase)", () => {
		it("should return 'PR' for any state value when business country is PR", async () => {
			const mapper = createMockMapper({ address_country: "PR" });
			expect(await sanitizeFn(mapper, "JUANA DÍAZ")).toBe("PR");
			expect(await sanitizeFn(mapper, "Bayamón")).toBe("PR");
			expect(await sanitizeFn(mapper, "Ponce")).toBe("PR");
		});

		it("should abbreviate US state names when business country is US", async () => {
			const mapper = createMockMapper({ address_country: "US" });
			expect(await sanitizeFn(mapper, "california")).toBe("CA");
			expect(await sanitizeFn(mapper, "New York")).toBe("NY");
		});

		it("should pass through US state codes unchanged", async () => {
			const mapper = createMockMapper({ address_country: "US" });
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

		it("should fallback to stateMap when no country in input", async () => {
			const mapper = createMockMapper({});
			expect(await sanitizeFn(mapper, "california")).toBe("CA");
		});
	});

	describe("post-resolve phase (mappedFields populated)", () => {
		it("should use mapped business country for PR", async () => {
			const mapper = createMockMapperWithMappedFields("PR");
			expect(await sanitizeFn(mapper, "Mayagüez")).toBe("PR");
		});

		it("should use mapped business country for US", async () => {
			const mapper = createMockMapperWithMappedFields("US");
			expect(await sanitizeFn(mapper, "florida")).toBe("FL");
		});
	});

	describe("generated owner fields (owner2-5) share the same sanitize", () => {
		it("owner2_address_state should have a sanitize function", () => {
			const ownerFieldsModule = require("../ownerFields");
			const fields = ownerFieldsModule.getOwnerFields("create");
			const owner2State = fields.find(
				(f: MapperField) => f.column === "owner2_address_state"
			);
			expect(owner2State).toBeDefined();
			expect(owner2State?.sanitize).toBeDefined();
		});

		it("owner2_address_state should return 'PR' for PR business", async () => {
			const ownerFieldsModule = require("../ownerFields");
			const fields = ownerFieldsModule.getOwnerFields("create");
			const owner2State = fields.find(
				(f: MapperField) => f.column === "owner2_address_state"
			);
			const mapper = createMockMapper({ address_country: "PR" });
			expect(await owner2State!.sanitize!(mapper, "Aguadilla")).toBe("PR");
		});
	});
});
