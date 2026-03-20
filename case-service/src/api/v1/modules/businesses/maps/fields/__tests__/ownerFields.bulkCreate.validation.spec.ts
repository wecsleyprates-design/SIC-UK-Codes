import { validateOwnerFields } from "../ownerFields";
import { BulkCreateBusinessMap } from "../../bulkCreateBusinessMap";
import { OWNER_TYPES } from "#constants";

jest.mock("../../../owners", () => ({
	Owners: {
		getOwnerTitles: jest.fn().mockResolvedValue({
			1: { id: 1, title: "Mr" },
			2: { id: 2, title: "Ms" }
		})
	}
}));

jest.mock("../../../businesses", () => ({
	businesses: {
		getProgressionConfig: jest.fn().mockResolvedValue([])
	}
}));

jest.mock("#helpers/index", () => {
	const originalModule = jest.requireActual("#helpers/index");
	return {
		...originalModule,
		logger: {
			info: i => console.log(i),
			error: i => console.log(i),
			debug: i => console.debug(i),
			warn: i => console.debug(i)
		}
	};
});

describe("ownerFields.validateOwnerFields (BulkCreate permutations)", () => {
	const makeMapper = (args: { customerID?: string; fields: Array<{ column: string; value?: any }> }) => {
		const addWarning = jest.fn();
		const addAdditionalMetadata = jest.fn();
		const getAdditionalMetadata = jest.fn().mockReturnValue({ customerID: args.customerID ?? "cust-1" });
		const getMappedFields = jest.fn().mockReturnValue(args.fields.map(f => ({ table: "data_owners", ...f })));

		// We need `mapper instanceof BulkCreateBusinessMap` to be true inside validateOwnerFields
		const mapper = Object.create(BulkCreateBusinessMap.prototype);
		Object.assign(mapper, {
			addWarning,
			addAdditionalMetadata,
			getAdditionalMetadata,
			getMappedFields
		});
		return { mapper, addWarning, addAdditionalMetadata };
	};

	it("passes for a control + beneficiary owner (<= 100% total)", async () => {
		const { mapper, addAdditionalMetadata } = makeMapper({
			fields: [
				{ column: "owner1_title", value: "mr" },
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner1_ownership_percentage", value: 60 },

				{ column: "owner2_title", value: "Ms" },
				{ column: "owner2_first_name", value: "Alex" },
				{ column: "owner2_last_name", value: "Roe" },
				{ column: "owner2_dob", value: "1999-01-01" },
				{ column: "owner2_owner_type", value: OWNER_TYPES.BENEFICIARY },
				{ column: "owner2_ownership_percentage", value: 40 }
			]
		});

		await expect(validateOwnerFields(mapper as any)).resolves.toBeUndefined();
		// Control owner should be tracked in metadata
		expect(addAdditionalMetadata).toHaveBeenCalledWith({ controlOwner: 1 });
	});

	it("passes when no owner title is provided", async () => {
		const { mapper, addAdditionalMetadata } = makeMapper({
			fields: [
				// owner1_title omitted on purpose
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner1_ownership_percentage", value: 100 }
			]
		});

		await expect(validateOwnerFields(mapper as any)).resolves.toBeUndefined();
		expect(addAdditionalMetadata).toHaveBeenCalledWith({ controlOwner: 1 });
	});

	it("passes when owner title matches a value from Owners.getOwnerTitles()", async () => {
		const { mapper, addAdditionalMetadata } = makeMapper({
			fields: [
				{ column: "owner1_title", value: "Mr" },
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner1_ownership_percentage", value: 100 }
			]
		});

		await expect(validateOwnerFields(mapper as any)).resolves.toBeUndefined();
		expect(addAdditionalMetadata).toHaveBeenCalledWith({ controlOwner: 1 });
	});

	it("throws when owner title does not match a value from Owners.getOwnerTitles()", async () => {
		const { mapper } = makeMapper({
			fields: [
				{ column: "owner1_title", value: "Bad" },
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner1_ownership_percentage", value: 100 }
			]
		});

		await expect(validateOwnerFields(mapper as any)).rejects.toThrow(/Invalid owner title/i);
	});

	it("passes and warns when beneficiary owner is missing ownership percentage", async () => {
		const { mapper, addWarning, addAdditionalMetadata } = makeMapper({
			fields: [
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner1_ownership_percentage", value: 100 },

				{ column: "owner2_first_name", value: "Alex" },
				{ column: "owner2_last_name", value: "Roe" },
				{ column: "owner2_dob", value: "1999-01-01" },
				{ column: "owner2_owner_type", value: OWNER_TYPES.BENEFICIARY }
				// owner2_ownership_percentage omitted on purpose
			]
		});

		await expect(validateOwnerFields(mapper as any)).resolves.toBeUndefined();
		expect(addAdditionalMetadata).toHaveBeenCalledWith({ controlOwner: 1 });
		expect(addWarning).toHaveBeenCalledWith(
			expect.stringContaining("Ownership percentage is required for beneficiary owner 2")
		);
	});

	it("passes and warns when IDV enabled and missing DOB/first/last for an owner", async () => {
		const { businesses } = jest.requireMock("../../../businesses") as any;
		businesses.getProgressionConfig.mockResolvedValueOnce([
			{
				stage: "ownership",
				config: {
					fields: [{ name: "Enable Identity Verification", status: true }]
				}
			}
		]);

		const { mapper, addWarning, addAdditionalMetadata } = makeMapper({
			fields: [
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner1_ownership_percentage", value: 100 },

				// Owner 2 missing DOB (and could be missing names) should warn but not throw
				{ column: "owner2_owner_type", value: OWNER_TYPES.BENEFICIARY }
			]
		});

		await expect(validateOwnerFields(mapper as any)).resolves.toBeUndefined();
		expect(addAdditionalMetadata).toHaveBeenCalledWith({ controlOwner: 1 });
		expect(addWarning).toHaveBeenCalledWith(expect.stringContaining("For IDV verification"));
	});

	it("passes when address fields are omitted (address fields are not required for validation)", async () => {
		const { mapper, addAdditionalMetadata } = makeMapper({
			fields: [
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner1_ownership_percentage", value: 100 }
				// No owner1_address_* fields
			]
		});

		await expect(validateOwnerFields(mapper as any)).resolves.toBeUndefined();
		expect(addAdditionalMetadata).toHaveBeenCalledWith({ controlOwner: 1 });
	});

	it("throws when total ownership exceeds 100%", async () => {
		const { mapper } = makeMapper({
			fields: [
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner1_ownership_percentage", value: 60 },

				{ column: "owner2_first_name", value: "Alex" },
				{ column: "owner2_last_name", value: "Roe" },
				{ column: "owner2_dob", value: "1999-01-01" },
				{ column: "owner2_owner_type", value: OWNER_TYPES.BENEFICIARY },
				{ column: "owner2_ownership_percentage", value: 50 }
			]
		});

		await expect(validateOwnerFields(mapper as any)).rejects.toThrow(/must not exceed 100%/i);
	});

	it("throws when more than one control owner is provided", async () => {
		const { mapper } = makeMapper({
			fields: [
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner1_ownership_percentage", value: 50 },

				{ column: "owner2_first_name", value: "Alex" },
				{ column: "owner2_last_name", value: "Roe" },
				{ column: "owner2_dob", value: "1999-01-01" },
				{ column: "owner2_owner_type", value: OWNER_TYPES.CONTROL },
				{ column: "owner2_ownership_percentage", value: 50 }
			]
		});

		await expect(validateOwnerFields(mapper as any)).rejects.toThrow(/one control owner is required/i);
	});

	it("throws when all provided owners are beneficiaries (BulkCreate requires at least one control owner)", async () => {
		const { mapper } = makeMapper({
			fields: [
				{ column: "owner1_first_name", value: "Jane" },
				{ column: "owner1_last_name", value: "Doe" },
				{ column: "owner1_dob", value: "2000-10-17" },
				{ column: "owner1_owner_type", value: OWNER_TYPES.BENEFICIARY },
				{ column: "owner1_ownership_percentage", value: 50 },

				{ column: "owner2_first_name", value: "Alex" },
				{ column: "owner2_last_name", value: "Roe" },
				{ column: "owner2_dob", value: "1999-01-01" },
				{ column: "owner2_owner_type", value: OWNER_TYPES.BENEFICIARY },
				{ column: "owner2_ownership_percentage", value: 50 }
			]
		});

		await expect(validateOwnerFields(mapper as any)).rejects.toThrow(/at least one control owner is required/i);
	});

	it("throws when an out-of-range owner index is provided (owner6_*)", async () => {
		const { mapper } = makeMapper({
			fields: [{ column: "owner6_first_name", value: "Jane" }]
		});

		await expect(validateOwnerFields(mapper as any)).rejects.toThrow(/invalid owner number/i);
	});
});
