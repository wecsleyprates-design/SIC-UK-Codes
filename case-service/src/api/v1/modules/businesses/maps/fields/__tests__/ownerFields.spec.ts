import { updateValidateOwnerFields } from "../ownerFields";

// `ownerFields.ts` imports Owners via a relative path that resolves to `src/api/v1/modules/businesses/owners.ts`.
// Mock that module at its resolved path from this test file so the import in `ownerFields.ts` gets the mock.
jest.mock("../../../owners", () => ({
	Owners: {
		getOwnerTitles: jest.fn().mockResolvedValue({
			1: { id: 1, title: "Mr" }
		})
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

describe("ownerFields.updateValidateOwnerFields", () => {
	it("coalesces to existing owner when fingerprint (name + dob) matches", async () => {
		const existingOwner = {
			id: "owner-1",
			first_name: "Jane",
			last_name: "Doe",
			date_of_birth: "2000-10-17",
			email: "old@example.com",
			owner_type: "CONTROL"
		};

		const originalState = {
			getState: () => ({
				data_business_owners: [existingOwner]
			})
		} as any;

		const mappedFields = [
			{ table: "data_owners", column: "owner1_first_name", value: "Jane" },
			{ table: "data_owners", column: "owner1_last_name", value: "Doe" },
			{ table: "data_owners", column: "owner1_dob", value: "2000-10-17" },
			// Change a field to prove we treat as update, not duplicate
			{ table: "data_owners", column: "owner1_email", value: "new@example.com" }
		] as any[];

		let addedOwners: any[] | undefined;
		const mapperMock = {
			getAdditionalMetadata: () => ({ originalState, customerID: "cust-1" }),
			getMappedFields: () => mappedFields,
			addAdditionalMetadata: (meta: any) => {
				if (meta?.owners) addedOwners = meta.owners;
			}
		} as any;

		await expect(updateValidateOwnerFields(mapperMock)).resolves.toBeUndefined();

		expect(addedOwners).toBeDefined();
		expect(addedOwners).toHaveLength(1);
		expect(addedOwners?.[0]).toEqual(
			expect.objectContaining({
				id: "owner-1",
				first_name: "Jane",
				last_name: "Doe",
				date_of_birth: "2000-10-17",
				email: "new@example.com"
			})
		);
	});

	it("coalesces to existing owner when external_id matches", async () => {
		const existingOwner = {
			id: "owner-abc-123",
			first_name: "Jane",
			last_name: "Doe",
			email: "old@example.com",
			owner_type: "CONTROL",
			external_id: "ext-id-999"
		};

		const originalState = {
			getState: () => ({ data_business_owners: [existingOwner] })
		} as any;

		const mappedFields = [
			{ table: "data_owners", column: "owner1_first_name", value: "Jane" },
			{ table: "data_owners", column: "owner1_last_name", value: "Doe" },
			{ table: "data_owners", column: "owner1_email", value: "updated@example.com" },
			{ table: "data_owners", column: "owner1_external_id", value: "ext-id-999" }
		] as any[];

		let addedOwners: any[] | undefined;
		const mapperMock = {
			getAdditionalMetadata: () => ({ originalState, customerID: "cust-1" }),
			getMappedFields: () => mappedFields,
			addAdditionalMetadata: (meta: any) => {
				if (meta?.owners) addedOwners = meta.owners;
			}
		} as any;

		await expect(updateValidateOwnerFields(mapperMock)).resolves.toBeUndefined();

		expect(addedOwners).toHaveLength(1);
		// Carries over the existing owner's id — treated as an update, not a new insert
		expect(addedOwners?.[0]).toEqual(
			expect.objectContaining({
				id: "owner-abc-123",
				external_id: "ext-id-999",
				email: "updated@example.com"
			})
		);
	});

	it("creates a new owner when external_id does not match any existing owner", async () => {
		const existingOwner = {
			id: "owner-abc-123",
			first_name: "Jane",
			last_name: "Doe",
			owner_type: "CONTROL",
			external_id: "ext-id-existing"
		};

		const originalState = {
			getState: () => ({ data_business_owners: [existingOwner] })
		} as any;

		const mappedFields = [
			{ table: "data_owners", column: "owner1_first_name", value: "Bob" },
			{ table: "data_owners", column: "owner1_last_name", value: "Smith" },
			{ table: "data_owners", column: "owner1_owner_type", value: "BENEFICIAL_OWNER" },
			// external_id that does not match the existing owner's ext-id-existing
			{ table: "data_owners", column: "owner1_external_id", value: "ext-id-brand-new" }
		] as any[];

		let addedOwners: any[] | undefined;
		const mapperMock = {
			getAdditionalMetadata: () => ({ originalState, customerID: "cust-1" }),
			getMappedFields: () => mappedFields,
			addAdditionalMetadata: (meta: any) => {
				if (meta?.owners) addedOwners = meta.owners;
			}
		} as any;

		await expect(updateValidateOwnerFields(mapperMock)).resolves.toBeUndefined();

		expect(addedOwners).toHaveLength(1);
		// No id carried over — will be treated as a new insert by addOrUpdateOwners
		expect(addedOwners?.[0].id).toBeUndefined();
		expect(addedOwners?.[0].external_id).toBe("ext-id-brand-new");
		expect(addedOwners?.[0].first_name).toBe("Bob");
	});
});
