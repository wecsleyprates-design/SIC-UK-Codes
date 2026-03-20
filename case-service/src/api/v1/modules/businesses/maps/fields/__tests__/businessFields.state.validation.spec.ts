import { MapperError } from "../../../mapper";
import type { MapperField } from "#types";

// Mock helpers BEFORE importing businessFields to avoid LRUCache issues
jest.mock("#helpers/index", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	},
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
	validateBusiness: jest.fn().mockResolvedValue({
		data: { business_id: "test-business-id" }
	})
}));

jest.mock("../../../../onboarding/onboarding", () => ({
	onboarding: {
		addOrUpdateCustomerBusinessConfigs: jest.fn()
	}
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

jest.mock("#common", () => ({
	addIndustryAndNaicsPlatform: jest.fn()
}));

jest.mock("#configs", () => ({
	envConfig: {
		ENTERPRISE_APPLICANT_ID: "test-applicant-id"
	}
}));

jest.mock("../../utils", () => {
	const { MapperError } = require("../../../mapper");
	const mockLogger = {
		info: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn()
	};
	return {
		...jest.requireActual("../../utils"),
		assertTruthy: (value: boolean, field?: any) => {
			if (!value) {
				mockLogger.error({ field, message: "Validation failed" });
				if (field) {
					throw new MapperError(`Validation failed`, field);
				}
				throw new Error(`Validation failed`);
			}
		}
	};
});

describe("businessFields.address_state validation", () => {
	let validateFn: (mapper: any, field: MapperField) => Promise<void>;
	const mockMapper = {} as any;

	beforeAll(() => {
		// Import after mocks are set up
		const businessFieldsModule = require("../businessFields");
		const getBusinessFields = businessFieldsModule.getBusinessFields;
		const fields = getBusinessFields();
		const addressStateField = fields.find(f => f.column === "address_state");

		if (!addressStateField?.validate) {
			throw new Error("address_state field or validate function not found");
		}

		validateFn = addressStateField.validate;
	});

	describe("valid state codes (2-3 characters)", () => {
		it("should accept 2-character US state codes", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: "CA"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept 2-character CA province codes", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: "ON"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept 2-character PR code", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: "PR"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept 3-character AU state codes", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: "NSW"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept 3-character NZ region codes", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: "AUK"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});

		it("should accept other 3-character codes", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: "QLD"
			};

			await expect(validateFn(mockMapper, field)).resolves.toBeUndefined();
		});
	});

	describe("invalid state codes", () => {
		it("should reject state codes with less than 2 characters", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: "A"
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject empty string", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: ""
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject state codes with more than 3 characters", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: "CALIF"
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject non-string values (number)", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: 123 as any
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject non-string values (null)", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: null as any
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject non-string values (undefined)", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: undefined as any
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});

		it("should reject non-string values (object)", async () => {
			const field: MapperField = {
				column: "address_state",
				table: "data_businesses",
				value: {} as any
			};

			await expect(validateFn(mockMapper, field)).rejects.toThrow(MapperError);
		});
	});
});
