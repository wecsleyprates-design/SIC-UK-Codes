import { constrainInput, validate } from "../idvInputValidation";
import { IDNumberType, Strategy, type IdentityVerificationCreateRequest, type IdentityVerificationCreateRequestUser, type UserAddress, type UserIDNumber } from "plaid";

const baseInput: IdentityVerificationCreateRequest = {
	client_user_id: "123",
	template_id: "123",
	is_shareable: false,
	gave_consent: true,
	user: {
		address: {
			country: "US",
			postal_code: "12345",
			region: "CA"
		},
		id_number: {
			type: IDNumberType.UsSsn,
			value: "123456789"
		}
	}
};

describe("constrainInput", () => {
	it("it should drop region and id number for GB", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "GB";
		const result = constrainInput(input);

		expect(result.user?.address?.region).toBeUndefined();
		expect(result.user?.id_number).toBeUndefined();
	});

	it("should drop id number for ireland", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "IE";
		const result = constrainInput(input);

		expect(result.user?.id_number).toBeUndefined();
	});

	it("should drop invalid id number pattern for US", () => {
		const input = structuredClone(baseInput);
		(input.user?.id_number as UserIDNumber).value = "123456789123";
		(input.user?.id_number as UserIDNumber).type = IDNumberType.UsSsnLast4;
		const result = constrainInput(input);
		expect(result.user?.id_number).toBeUndefined();
	});
});

describe("validate", () => {
	it("should throw if postal code not defined for US", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "US";
		(input.user?.address as UserAddress).postal_code = undefined;
		expect(() => validate(input)).toThrow("Address postal code is required");
	});
	it("should throw if region is not set for US", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "US";
		(input.user?.address as UserAddress).region = undefined;
		expect(() => validate(input)).toThrow("Address region/subdivision is required");
	});

	it("should throw if postal code or region not set for Ireland", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "IE";
		(input.user?.address as UserAddress).region = undefined;
		(input.user?.address as UserAddress).postal_code = undefined;
		expect(() => validate(input)).toThrow("Address postal code is required");
		expect(() => validate(input)).toThrow("Address region/subdivision is required");
	});

	it("should throw if id number, postal code, or region not set for Mexico", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "MX";
		(input.user as IdentityVerificationCreateRequestUser).id_number = null;
		(input.user?.address as UserAddress).postal_code = undefined;
		(input.user?.address as UserAddress).region = undefined;
		expect(() => validate(input)).toThrow("ID number is required");
		expect(() => validate(input)).toThrow("Address postal code is required");
		expect(() => validate(input)).toThrow("Address region/subdivision is required");
	});

	it("should throw if postal code is not set for UK", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "GB";
		(input.user?.address as UserAddress).postal_code = undefined;
		expect(() => validate(input)).toThrow("Address postal code is required");
	});

	it("should throw if ID number too short", () => {
		const input = structuredClone(baseInput);
		(input.user?.id_number as UserIDNumber).value = "123";
		expect(() => validate(input)).toThrow("ID number length must be at least");
	});
	it("should throw if id number too long", () => {
		const input = structuredClone(baseInput);
		(input.user?.id_number as UserIDNumber).value = "1234567890";
		expect(() => validate(input)).toThrow("ID number length must be less than 9 characters long");
	});

	it("should throw if pattern match fails", () => {
		const input = structuredClone(baseInput);
		(input.user?.id_number as UserIDNumber).value = "AB3456789";
		(input.user?.id_number as UserIDNumber).type = IDNumberType.UsSsn;
		expect(() => validate(input)).toThrow("ID number does not match pattern");
	});

	it("should happy path US", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "US";
		(input.user?.address as UserAddress).postal_code = "12345";
		(input.user?.address as UserAddress).region = "CA";
		(input.user?.id_number as UserIDNumber).value = "123456789";
		(input.user?.id_number as UserIDNumber).type = IDNumberType.UsSsn;
		expect(() => validate(input)).not.toThrow();
	});

	it("should happy path Ireland", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "IE";
		(input.user?.address as UserAddress).postal_code = "12345";
		(input.user?.address as UserAddress).region = "CA";
		(input.user as IdentityVerificationCreateRequestUser).id_number = null;
		expect(() => validate(input)).not.toThrow();
	});

	it("should happy path Canada", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "CA";
		(input.user?.address as UserAddress).postal_code = "12345";
		(input.user?.address as UserAddress).region = "CA";
		(input.user as IdentityVerificationCreateRequestUser).id_number = {
			type: IDNumberType.CaSin,
			value: "123456789"
		};
		expect(() => validate(input)).not.toThrow();
	});

	it("should happy path Mexico", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "MX";
		(input.user?.address as UserAddress).postal_code = "12345";
		(input.user?.address as UserAddress).region = "CA";
		(input.user as IdentityVerificationCreateRequestUser).id_number = {
			type: IDNumberType.MxRfc,
			value: "HEGJ820506M10"
		};
		expect(() => validate(input)).not.toThrow();
	});

	it("should happy path UK", () => {
		const input = structuredClone(baseInput);
		(input.user?.address as UserAddress).country = "GB";
		(input.user?.address as UserAddress).postal_code = "12345";
		(input.user?.address as UserAddress).region = undefined;
		(input.user as IdentityVerificationCreateRequestUser).id_number = null;

		expect(() => validate(input)).not.toThrow();
	});
});
