import type { MapperField } from "#types";

jest.mock("#helpers/index", () => ({
	logger: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() },
	db: jest.fn(),
	redis: jest.fn(),
	getFlagValue: jest.fn(),
	isUSBusiness: jest.fn((country?: string) => (country ?? "").toString().toUpperCase() === "US" || (country ?? "").toString().toUpperCase() === "USA"),
	BullQueue: jest.fn().mockImplementation(() => ({
		addJob: jest.fn(),
		add: jest.fn(),
		process: jest.fn(),
		close: jest.fn()
	}))
}));

jest.mock("#configs", () => ({
	envConfig: { ENTERPRISE_APPLICANT_ID: "test-applicant-id" }
}));

/**
 * Creates a mock mapper for address fields.
 * getInputValue(key) returns raw input value (used by createStateSanitizer);
 * for address1_country falls back to address_country so tests can pass business country.
 */
function createMockMapper(inputData: Record<string, any>): any {
	const inputMap = new Map(Object.entries(inputData));
	return {
		getMappedValueForColumn: jest.fn().mockReturnValue(undefined),
		input: inputMap,
		getInputValue: jest.fn((key: string) => {
			return inputMap.get(key) ?? (key === "address1_country" ? inputMap.get("address_country") : undefined);
		}),
		getAdditionalMetadata: jest.fn().mockReturnValue({})
	};
}

describe("businessAddresses.address1_state sanitization", () => {
	let sanitizeFn: (mapper: any, value: string) => Promise<string>;

	beforeAll(() => {
		const addressFieldsModule = require("../businessAddresses");
		const fields = addressFieldsModule.getBusinessMailingAddressesFields();

		const stateField = fields.find(
			(f: MapperField) => f.column === "address1_state"
		);

		if (!stateField?.sanitize) {
			throw new Error("address1_state field or sanitize function not found");
		}

		sanitizeFn = stateField.sanitize;
	});

	describe("country-aware sanitization via createStateSanitizer", () => {
		it("should return 'PR' for any state value when country is PR", async () => {
			const mapper = createMockMapper({ address_country: "PR" });
			expect(await sanitizeFn(mapper, "JUANA DÍAZ")).toBe("PR");
			expect(await sanitizeFn(mapper, "San Juan")).toBe("PR");
			expect(await sanitizeFn(mapper, "Bayamón")).toBe("PR");
		});

		it("should abbreviate US state names when country is US", async () => {
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

	describe("per-address-index country isolation", () => {
		let sanitizeFn2: (mapper: any, value: string) => Promise<string>;

		beforeAll(() => {
			const addressFieldsModule = require("../businessAddresses");
			const fields = addressFieldsModule.getBusinessMailingAddressesFields();

			const address2StateField = fields.find(
				(f: MapperField) => f.column === "address2_state"
			);

			if (!address2StateField?.sanitize) {
				throw new Error("address2_state field or sanitize function not found");
			}

			sanitizeFn2 = address2StateField.sanitize;
		});

		it("address2_state should read address2_country, not address1_country", async () => {
			const mapper = createMockMapper({
				address1_country: "US",
				address2_country: "PR"
			});

			// address2 is PR → should return "PR"
			expect(await sanitizeFn2(mapper, "Ponce")).toBe("PR");
		});

		it("address1_state should read address1_country independently", async () => {
			const mapper = createMockMapper({
				address1_country: "US",
				address2_country: "PR"
			});

			// address1 is US → should abbreviate normally
			expect(await sanitizeFn(mapper, "california")).toBe("CA");
		});
	});
});
