import { MapperError } from "../../../mapper";
import type { MapperField } from "#types";

// Mock helpers BEFORE importing businessAddresses to avoid LRUCache issues
jest.mock("#helpers/index", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	}
}));

describe("businessAddresses.address1_state validation", () => {
	let validateFn: (mapper: any, field: MapperField) => Promise<void>;
	const mockMapper = {} as any;

	beforeAll(() => {
		// Import after mocks are set up
		const businessAddressesModule = require("../businessAddresses");
		const getBusinessMailingAddressesFields = businessAddressesModule.getBusinessMailingAddressesFields;
		const fields = getBusinessMailingAddressesFields();
		const address1StateField = fields.find(f => f.column === "address1_state");

		if (!address1StateField?.validate) {
			throw new Error("address1_state field or validate function not found");
		}

		validateFn = address1StateField.validate;
	});

	describe("valid state codes (2-3 characters)", () => {
		it("should accept 2-character US state codes", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: "NY"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept 2-character CA province codes", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: "BC"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept 2-character PR code", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: "PR"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept 3-character AU state codes", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: "VIC"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept 3-character NZ region codes", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: "BOP"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept other 3-character codes", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: "CAN"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});
	});

	describe("invalid state codes", () => {
		it("should reject state codes with less than 2 characters", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: "X"
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject empty string", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: ""
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject state codes with more than 3 characters", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: "TEXAS"
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject non-string values (number)", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: 456 as any
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject non-string values (null)", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: null as any
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject non-string values (undefined)", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: undefined as any
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject non-string values (object)", async () => {
			const field: MapperField = {
				column: "address1_state",
				table: "data_business_addresses",
				value: {} as any
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});
	});
});
