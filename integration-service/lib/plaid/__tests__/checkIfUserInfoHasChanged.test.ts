import type { IIdentityVerification } from "#types/db";
import type { Owner } from "#types/worthApi";
import { checkIfUserInfoHasChanged } from "../util/checkIfUserInfoHasChanged";

jest.mock("#utils/encryption", () => ({
	safeDecrypt: jest.fn((value: string) => value) // Returns value as-is for testing
}));

const createOwner = (overrides: Partial<Owner> = {}): Owner =>
	({
		id: "00000000-0000-0000-0000-000000000000",
		first_name: "John",
		last_name: "Doe",
		email: "john@example.com",
		mobile: "5551234567",
		address_line_1: "123 Main St",
		address_line_2: null,
		address_apartment: null,
		address_city: "San Francisco",
		address_state: "CA",
		address_postal_code: "94102",
		address_country: "US",
		ssn: "123456789",
		date_of_birth: "1990-01-01",
		...overrides
	}) as Owner;

const createRecord = (userOverrides: Record<string, unknown> = {}): IIdentityVerification => ({
	meta: {
		user: {
			name: {
				given_name: "John",
				family_name: "Doe"
			},
			email_address: "john@example.com",
			phone_number: "5551234567",
			address: {
				street: "123 Main St",
				street2: null,
				city: "San Francisco",
				region: "CA",
				postal_code: "94102",
				country: "US"
			},
			id_number: {
				value: "123456789"
			},
			date_of_birth: "1990-01-01",
			...userOverrides
		}
	}
}) as unknown as IIdentityVerification;

describe("checkIfUserInfoHasChanged", () => {
	describe("when no previous data exists", () => {
		it("returns true when meta is undefined", () => {
			const owner = createOwner();
			const record = {} as IIdentityVerification;

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});

		it("returns true when meta.user is undefined", () => {
			const owner = createOwner();
			const record = { meta: {} } as IIdentityVerification;

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});
	});

	describe("when all fields match", () => {
		it("returns false when all data is identical", () => {
			const owner = createOwner();
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(false);
		});

		it("returns false with case differences (case insensitive)", () => {
			const owner = createOwner({ first_name: "JOHN", last_name: "DOE" });
			const record = createRecord({
				name: { given_name: "john", family_name: "doe" }
			});

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(false);
		});
	});

	describe("when name changes", () => {
		it("returns true when first name changes", () => {
			const owner = createOwner({ first_name: "Jane" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});

		it("returns true when last name changes", () => {
			const owner = createOwner({ last_name: "Smith" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});
	});

	describe("when contact info changes", () => {
		it("returns true when email changes", () => {
			const owner = createOwner({ email: "jane@example.com" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});

		it("returns true when phone changes", () => {
			const owner = createOwner({ mobile: "5559999999" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});
	});

	describe("when address changes", () => {
		it("returns true when street changes", () => {
			const owner = createOwner({ address_line_1: "456 Oak Ave" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});

		it("returns true when city changes", () => {
			const owner = createOwner({ address_city: "Los Angeles" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});

		it("returns true when state changes", () => {
			const owner = createOwner({ address_state: "NY" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});

		it("returns true when postal code changes", () => {
			const owner = createOwner({ address_postal_code: "10001" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});

		it("returns true when country changes", () => {
			const owner = createOwner({ address_country: "CA" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});
	});

	describe("null/undefined equivalence", () => {
		it("returns false when street2 is null in owner and null in record", () => {
			const owner = createOwner({ address_line_2: null, address_apartment: null });
			const record = createRecord({
				address: {
					street: "123 Main St",
					street2: null,
					city: "San Francisco",
					region: "CA",
					postal_code: "94102",
					country: "US"
				}
			});

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(false);
		});

		it("returns false when street2 is undefined in owner and null in record", () => {
			const owner = createOwner({ address_line_2: undefined, address_apartment: undefined });
			const record = createRecord({
				address: {
					street: "123 Main St",
					street2: null,
					city: "San Francisco",
					region: "CA",
					postal_code: "94102",
					country: "US"
				}
			});

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(false);
		});

		it("returns false when street2 is null in owner and undefined in record", () => {
			const owner = createOwner({ address_line_2: null, address_apartment: null });
			const record = createRecord({
				address: {
					street: "123 Main St",
					street2: undefined,
					city: "San Francisco",
					region: "CA",
					postal_code: "94102",
					country: "US"
				}
			});

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(false);
		});

		it("returns false when both street2 values are empty strings", () => {
			const owner = createOwner({ address_line_2: "", address_apartment: "" });
			const record = createRecord({
				address: {
					street: "123 Main St",
					street2: "",
					city: "San Francisco",
					region: "CA",
					postal_code: "94102",
					country: "US"
				}
			});

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(false);
		});

		it("returns true when street2 has value in owner but null in record", () => {
			const owner = createOwner({ address_line_2: "Apt 5", address_apartment: null });
			const record = createRecord({
				address: {
					street: "123 Main St",
					street2: null,
					city: "San Francisco",
					region: "CA",
					postal_code: "94102",
					country: "US"
				}
			});

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});
	});

	describe("address_apartment fallback", () => {
		it("uses address_apartment when address_line_2 is null", () => {
			const owner = createOwner({ address_line_2: null, address_apartment: "Suite 100" });
			const record = createRecord({
				address: {
					street: "123 Main St",
					street2: "Suite 100",
					city: "San Francisco",
					region: "CA",
					postal_code: "94102",
					country: "US"
				}
			});

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(false);
		});

		it("prefers address_line_2 over address_apartment", () => {
			const owner = createOwner({ address_line_2: "Apt 5", address_apartment: "Suite 100" });
			const record = createRecord({
				address: {
					street: "123 Main St",
					street2: "Apt 5",
					city: "San Francisco",
					region: "CA",
					postal_code: "94102",
					country: "US"
				}
			});

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(false);
		});
	});

	describe("encrypted fields", () => {
		it("returns true when SSN changes", () => {
			const owner = createOwner({ ssn: "987654321" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});

		it("returns true when date of birth changes", () => {
			const owner = createOwner({ date_of_birth: "1985-05-15" });
			const record = createRecord();

			expect(checkIfUserInfoHasChanged(owner, record)).toBe(true);
		});
	});
});
