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
 * getInputValue(key) returns raw input value (used by createPostalCodeSanitizer);
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

describe("businessAddresses.address1_postal_code sanitization", () => {
	let sanitizeFn: (mapper: any, value: string) => Promise<string>;

	beforeAll(() => {
		const addressFieldsModule = require("../businessAddresses");
		const fields = addressFieldsModule.getBusinessMailingAddressesFields();

		const postalCodeField = fields.find(
			(f: MapperField) => f.column === "address1_postal_code"
		);

		if (!postalCodeField?.sanitize) {
			throw new Error("address1_postal_code field or sanitize function not found");
		}

		sanitizeFn = postalCodeField.sanitize;
	});

	describe("country-aware sanitization via input fallback", () => {
		it("should NOT pad NZ postal codes", async () => {
			const mapper = createMockMapper({ address_country: "NZ" });
			expect(await sanitizeFn(mapper, "2013")).toBe("2013");
		});

		it("should NOT pad AU postal codes", async () => {
			const mapper = createMockMapper({ address_country: "AU" });
			expect(await sanitizeFn(mapper, "2000")).toBe("2000");
		});

		it("should pad US postal codes to 5 digits", async () => {
			const mapper = createMockMapper({ address_country: "US" });
			expect(await sanitizeFn(mapper, "2013")).toBe("02013");
		});

		it("should preserve CA postal codes without padding", async () => {
			const mapper = createMockMapper({ address_country: "CA" });
			expect(await sanitizeFn(mapper, "M5H 2N2")).toBe("M5H2N2");
		});

		it("should preserve GB postal codes without padding", async () => {
			const mapper = createMockMapper({ address_country: "GB" });
			expect(await sanitizeFn(mapper, "SW1A 1AA")).toBe("SW1A1AA");
		});

		it("should default to US padding when no country in input", async () => {
			const mapper = createMockMapper({});
			expect(await sanitizeFn(mapper, "2013")).toBe("02013");
		});
	});
});
