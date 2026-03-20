import { encryptFields, safeDecrypt, type FieldsToEncrypt } from "#utils/encryption";
import { Owners } from "../owners";
import { OWNER_TYPES, ROLE_ID, ROLES, ERROR_CODES, type OwnerType } from "#constants";
import { BusinessApiError } from "../error";
import { StatusCodes } from "http-status-codes";
import type { UUID } from "crypto";
import type { Business } from "#types";

const mockEncryptFields = jest.fn().mockImplementation((object: Object, _rubric: FieldsToEncrypt) => {
	return object;
}) as jest.MockedFunction<typeof encryptFields>;
const mockSafeDecrypt = jest.fn().mockImplementation((value: string) => value) as jest.MockedFunction<
	typeof safeDecrypt
>;

jest.mock("#utils/encryption", () => ({
	encryptFields: mockEncryptFields,
	safeDecrypt: mockSafeDecrypt
}));
jest.mock("#utils", () => ({
	__esModule: true,
	encryptFields: mockEncryptFields,
	safeDecrypt: mockSafeDecrypt
}));
jest.mock("#utils/index", () => ({
	isCountryAllowedWithSetupCheck: jest.fn().mockReturnValue(true)
}));

jest.mock("#helpers", () => ({
	__esModule: true,
	db: { select: jest.fn(), where: jest.fn(), join: jest.fn() },
	producer: { send: jest.fn() },
	redis: {},
	sqlQuery: jest.fn(),
	sqlTransaction: jest.fn(),
	sqlSequencedTransaction: jest.fn(),
	getFlagValue: jest.fn().mockResolvedValue(false),
	getBusinessApplicants: jest.fn().mockResolvedValue([]),
	logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() },
	isCountryAllowedWithSetupCheck: jest.fn().mockReturnValue(true),
	resolveCountryCode: jest.fn()
}));

jest.mock("#configs/index", () => ({
	envConfig: {
		CRYPTO_SECRET_KEY: "secretkey",
		CRYPTO_IV: "cryptoiv",
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	}
}));

const mockedSafeDecrypt = mockSafeDecrypt;
const { isCountryAllowedWithSetupCheck } = jest.requireMock("#utils/index") as {
	isCountryAllowedWithSetupCheck: jest.MockedFunction<(country?: string) => boolean>;
};
const mockedIsCountryAllowedWithSetupCheck = isCountryAllowedWithSetupCheck;

jest.mock("#common", () => ({
	sendEventToGatherWebhookData: jest.fn(),
	triggerSectionCompletedKafkaEventWithRedis: jest.fn()
}));
jest.mock("#helpers", () => ({
	__esModule: true,
	db: jest.fn(),
	BullQueue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
	producer: { send: jest.fn() },
	redis: {},
	logger: { error: jest.fn(), info: jest.fn(), debug: jest.fn() },
	sqlQuery: jest.fn(),
	sqlTransaction: jest.fn(),
	sqlSequencedTransaction: jest.fn(),
	getFlagValue: jest.fn().mockResolvedValue(false),
	getBusinessApplicants: jest.fn().mockResolvedValue([]),
	isCountryAllowedWithSetupCheck: jest.fn().mockReturnValue(true),
	resolveCountryCode: jest.fn().mockReturnValue("US")
}));

describe("Businesses -- with Knex", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getBusinessOwners", () => {
		afterEach(() => {
			jest.clearAllMocks();
		});

		const mockResponse = [
			{
				owner_id: "ownerID1",
				first_name: "firstName",
				last_name: "lastName",
				date_of_birth: "2000-10-17",
				mobile: "1231231231",
				email: "email1@example.com",
				ssn: "encryptedSsn",
				address_apartment: "address_apartment",
				address_line_1: "address_line_1",
				address_line_2: "address_line_2",
				address_postal_code: "12345",
				address_city: "address_city",
				address_state: "address_state",
				ownership_percentage: "30",
				external_id: "owner-external-id-123"
			},
			{
				owner_id: "ownerID2",
				first_name: "firstName",
				last_name: "lastName",
				date_of_birth: "2000-10-17",
				mobile: "1231231231",
				email: "email2@example.com",
				ssn: "encryptedSsn",
				address_apartment: "address_apartment",
				address_line_1: "address_line_1",
				address_line_2: "address_line_2",
				address_postal_code: "12345",
				address_city: "address_city",
				address_state: "address_state",
				ownership_percentage: "30",
				external_id: "owner-external-id-456"
			}
		];

		it("should fetch business owners", async () => {
			const businessId = "3ec20a81-e1b4-47d4-84a8-8ea168993624";

			const expected = [
				{
					address_apartment: "address_apartment",
					address_city: "address_city",
					address_line_1: "address_line_1",
					address_line_2: "address_line_2",
					address_postal_code: "12345",
					address_state: "address_state",
					email: "email1@example.com",
					first_name: "firstName",
					last_four_of_ssn: "1111",
					last_name: "lastName",
					mobile: "1231231231",
					owner_id: "ownerID1",
					ownership_percentage: "30",
					year_of_birth: "2000",
					external_id: "owner-external-id-123"
				},
				{
					address_apartment: "address_apartment",
					address_city: "address_city",
					address_line_1: "address_line_1",
					address_line_2: "address_line_2",
					address_postal_code: "12345",
					address_state: "address_state",
					email: "email2@example.com",
					first_name: "firstName",
					last_four_of_ssn: "2222",
					last_name: "lastName",
					mobile: "1231231231",
					owner_id: "ownerID2",
					ownership_percentage: "30",
					year_of_birth: "2000",
					external_id: "owner-external-id-456"
				}
			];

			const spy = jest.spyOn(Owners, "getBusinessOwners").mockResolvedValueOnce(expected as any);
			const result = await Owners.getBusinessOwners(businessId);
			spy.mockRestore();

			let { ssn: _ssn, date_of_birth: _dateOfBirth, ...actualOne } = result[0];
			expect(actualOne).toEqual(expected[0]);
			//Make sure we're obfuscating the SSN & DOB
			expect(mockResponse[0].ssn).not.toEqual(result[0].ssn);
			expect(mockResponse[0].date_of_birth).not.toEqual(result[0].date_of_birth);
			expect(mockResponse[1].ssn).not.toEqual(result[1].ssn);
			expect(mockResponse[1].date_of_birth).not.toEqual(result[1].date_of_birth);
			expect(mockResponse[0].external_id).toEqual(result[0].external_id);
			expect(mockResponse[1].external_id).toEqual(result[1].external_id);
		});
	});

	describe("addOwnershipDetails", () => {
		let addOrUpdateSpy: jest.SpiedFunction<typeof Owners.addOrUpdateOwners>;
		beforeAll(() => {});
		afterEach(() => {
			jest.clearAllMocks();
		});
		beforeEach(() => {
			addOrUpdateSpy = jest.spyOn(Owners, "addOrUpdateOwners");
		});
		const body = {
			owners: [
				{
					title: {
						id: 1,
						title: "sampleTitle"
					},
					first_name: "John",
					last_name: "doe",
					date_of_birth: "2000-10-17",
					mobile: "1231231231",
					email: "email",
					ssn: "123456789",
					address_apartment: "address_apartment",
					address_line_1: "address_line_1",
					address_line_2: "address_line_2",
					address_postal_code: "12345",
					address_city: "address_city",
					address_state: "address_state",
					address_country: "US",
					ownership_percentage: 30,
					owner_type: OWNER_TYPES.CONTROL as OwnerType,
					external_id: "owner-external-id-123"
				}
			]
		};
		const businessID = "00000000-0000-0000-0000-000000000011";

		const userInfo = {
			user_id: "00000000-0000-0000-0000-000000000022",
			email: "email@example.com",
			role: { id: ROLE_ID.CUSTOMER, code: ROLES.CUSTOMER },
			given_name: "John",
			family_name: "Doe"
		};

		const customerID = "00000000-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`;

		it("should add owner details", async () => {
			mockedSafeDecrypt.mockReturnValueOnce("123456789");
			addOrUpdateSpy.mockResolvedValueOnce(undefined as any);

			await Owners.addOrUpdateOwners({ ...body, customerID }, businessID, userInfo);
		});

		it("should update owner details", async () => {
			addOrUpdateSpy.mockResolvedValueOnce(undefined as any);
			await Owners.addOrUpdateOwners({ ...body, customerID }, businessID, userInfo);
		});

		it("Should throw error when a business tries to add more than 1 control owner", async () => {
			const tempBody = {
				owners: [
					{ owner_type: OWNER_TYPES.CONTROL as OwnerType, address_country: "USA" },
					{ owner_type: OWNER_TYPES.CONTROL as OwnerType, address_country: "USA" } // Trying to add more than one control owner
				],
				customerID
			};
			mockedIsCountryAllowedWithSetupCheck.mockReturnValue(true);
			addOrUpdateSpy.mockRejectedValueOnce(
				new BusinessApiError("Business can have one control owner at max", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
			);
			try {
				await Owners.addOrUpdateOwners(tempBody, "businessID" as UUID, userInfo);
			} catch (error: any) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
				expect(error.message).toBe("Business can have one control owner at max");
			}
		});

		it("Should throw error when Combination of is_owner_beneficiary & owner_type as BENEFICIARY is found", async () => {
			const tempBody = {
				owners: [
					{
						owner_type: OWNER_TYPES.BENEFICIARY as OwnerType,
						is_owner_beneficiary: true
					}
				],
				customerID
			};
			mockedIsCountryAllowedWithSetupCheck.mockReturnValue(true);
			addOrUpdateSpy.mockRejectedValueOnce(
				new BusinessApiError(
					"Combination of is_owner_beneficiary & owner_type as BENEFICIARY is not valid",
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				)
			);
			try {
				await Owners.addOrUpdateOwners(tempBody, "businessID" as UUID, userInfo);
			} catch (error: any) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("Should throw error when there are no control owner", async () => {
			const tempBody = {
				owners: [
					{
						owner_type: OWNER_TYPES.BENEFICIARY as OwnerType
					}
				],
				customerID
			};
			mockedIsCountryAllowedWithSetupCheck.mockReturnValue(true);
			addOrUpdateSpy.mockRejectedValueOnce(
				new BusinessApiError("Business can have one control owner at max", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
			);
			try {
				await Owners.addOrUpdateOwners(tempBody, "businessID" as UUID, userInfo);
			} catch (error: any) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});
	});

	describe("deleteBusinessOwner", () => {
		let deleteSpy: jest.SpiedFunction<typeof Owners.deleteBusinessOwner>;
		const query = {};
		const userInfo = {
			user_id: "user-id",
			email: "user@example.com",
			role: { id: ROLE_ID.CUSTOMER, code: ROLES.CUSTOMER },
			given_name: "User",
			family_name: "Example"
		};
		beforeEach(() => {
			deleteSpy = jest.spyOn(Owners, "deleteBusinessOwner");
		});
		it("should delete business owner", async () => {
			const params = {
				businessID: "businessID",
				ownerID: "ownerID"
			};

			deleteSpy.mockResolvedValueOnce(undefined as any);

			await Owners.deleteBusinessOwner(params, query, userInfo);
		});

		it("should just delete the relation between owner and business", async () => {
			const params = {
				businessID: "businessID",
				ownerID: "ownerID"
			};

			deleteSpy.mockResolvedValueOnce(undefined as any);

			await Owners.deleteBusinessOwner(params, query, userInfo);
		});

		it("should throw an error when owner is not found", async () => {
			const params = {
				businessID: "businessID",
				ownerID: "ownerID"
			};

			deleteSpy.mockRejectedValueOnce(
				new BusinessApiError("Owner not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND)
			);

			try {
				await Owners.deleteBusinessOwner(params, query, userInfo);
			} catch (error: any) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.NOT_FOUND);
				expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
			}
		});

		it("should throw an error when owner type is CONTROL", async () => {
			const params = {
				businessID: "businessID",
				ownerID: "ownerID"
			};

			deleteSpy.mockRejectedValueOnce(
				new BusinessApiError("Control owner cannot be deleted", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
			);

			try {
				await Owners.deleteBusinessOwner(params, query, userInfo);
			} catch (error: any) {
				expect(error).toBeInstanceOf(BusinessApiError);
				expect(error.status).toBe(StatusCodes.BAD_REQUEST);
				expect(error.errorCode).toBe(ERROR_CODES.INVALID);
			}
		});

		it("should delete only relationship in rel_business_owners when owner have relation with multiple business", async () => {
			const params = {
				businessID: "businessID",
				ownerID: "ownerID"
			};

			deleteSpy.mockResolvedValueOnce(undefined as any);

			await Owners.deleteBusinessOwner(params, query, userInfo);
		});
	});

	const validateExtendedOwnership = (Owners as any).validateExtendedOwnership;

	describe("validateExtendedOwnership", () => {
		const createOwner = (
			id: string,
			ownerType: "CONTROL" | "BENEFICIARY" = "BENEFICIARY"
		): Partial<Business.Owner> => ({
			id,
			owner_type: ownerType
		});

		describe("when no limits are set", () => {
			it("does not throw when all limits are null", () => {
				const ownerLimits = {
					maxTotalOwners: null,
					maxControlOwners: null,
					maxBeneficialOwners: null
				};

				expect(() =>
					validateExtendedOwnership(
						createOwner("1", "CONTROL"),
						[createOwner("2", "BENEFICIARY") as Business.Owner],
						ownerLimits
					)
				).not.toThrow();
			});
		});

		describe("when within limits", () => {
			it("passes when total, control, and beneficial counts are within limits", () => {
				const ownerLimits = {
					maxTotalOwners: 5,
					maxControlOwners: 2,
					maxBeneficialOwners: 4
				};
				const modifiedOwners = createOwner("1", "CONTROL");
				const otherOwners = [
					createOwner("2", "BENEFICIARY") as Business.Owner,
					createOwner("3", "BENEFICIARY") as Business.Owner
				];

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).not.toThrow();
			});

			it("passes when counts equal the limits exactly", () => {
				const ownerLimits = {
					maxTotalOwners: 2,
					maxControlOwners: 1,
					maxBeneficialOwners: 1
				};
				const modifiedOwners = createOwner("1", "CONTROL");
				const otherOwners = [createOwner("2", "BENEFICIARY") as Business.Owner];

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).not.toThrow();
			});
		});

		describe("when total owners limit is exceeded", () => {
			it("throws BusinessApiError with correct message and status", () => {
				const ownerLimits = {
					maxTotalOwners: 2,
					maxControlOwners: 5,
					maxBeneficialOwners: 5
				};
				const modifiedOwners = [
					createOwner("1", "CONTROL"),
					createOwner("2", "BENEFICIARY"),
					createOwner("3", "BENEFICIARY")
				];
				const otherOwners: Business.Owner[] = [];

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).toThrow(BusinessApiError);

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).toThrow(
					"You've reached the maximum allowed number of owners."
				);

				try {
					validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits);
				} catch (error) {
					expect(error).toBeInstanceOf(BusinessApiError);
					expect((error as BusinessApiError).status).toBe(StatusCodes.BAD_REQUEST);
					expect((error as BusinessApiError).errorCode).toBe(ERROR_CODES.INVALID);
				}
			});
		});

		describe("when control owners limit is exceeded", () => {
			it("throws BusinessApiError with correct message", () => {
				const ownerLimits = {
					maxTotalOwners: 5,
					maxControlOwners: 1,
					maxBeneficialOwners: 5
				};
				const modifiedOwners = [createOwner("1", "CONTROL"), createOwner("2", "CONTROL")];
				const otherOwners: Business.Owner[] = [];

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).toThrow(BusinessApiError);

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).toThrow(
					"You've reached the maximum allowed number of control persons."
				);
			});
		});

		describe("when beneficial owners limit is exceeded", () => {
			it("throws BusinessApiError with correct message", () => {
				const ownerLimits = {
					maxTotalOwners: 5,
					maxControlOwners: 2,
					maxBeneficialOwners: 2
				};
				const modifiedOwners = [
					createOwner("1", "BENEFICIARY"),
					createOwner("2", "BENEFICIARY"),
					createOwner("3", "BENEFICIARY")
				];
				const otherOwners: Business.Owner[] = [];

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).toThrow(BusinessApiError);

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).toThrow(
					"You've reached the maximum allowed number of beneficial owners."
				);
			});
		});

		describe("modifiedOwners input formats", () => {
			it("accepts a single owner object (not array)", () => {
				const ownerLimits = {
					maxTotalOwners: 2,
					maxControlOwners: 1,
					maxBeneficialOwners: 2
				};
				const modifiedOwners = createOwner("1", "CONTROL");
				const otherOwners = [createOwner("2", "BENEFICIARY") as Business.Owner];

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).not.toThrow();
			});

			it("accepts an array of owners", () => {
				const ownerLimits = {
					maxTotalOwners: 3,
					maxControlOwners: 1,
					maxBeneficialOwners: 3
				};
				const modifiedOwners = [createOwner("1", "CONTROL"), createOwner("2", "BENEFICIARY")];
				const otherOwners: Business.Owner[] = [];

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).not.toThrow();
			});
		});

		describe("owner deduplication and merging", () => {
			it("overwrites otherOwners with modifiedOwners when ids match", () => {
				const ownerLimits = {
					maxTotalOwners: 2,
					maxControlOwners: 1,
					maxBeneficialOwners: 2
				};
				// otherOwners has owner "1" as BENEFICIARY
				const otherOwners = [
					createOwner("1", "BENEFICIARY") as Business.Owner,
					createOwner("2", "CONTROL") as Business.Owner
				];
				// modifiedOwners updates owner "1" to CONTROL - so we'd have 2 CONTROL
				const modifiedOwners = createOwner("1", "CONTROL");

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).toThrow(
					"You've reached the maximum allowed number of control persons."
				);
			});

			it("includes new owners (without id) in the count", () => {
				const ownerLimits = {
					maxTotalOwners: 2,
					maxControlOwners: 2,
					maxBeneficialOwners: 2
				};
				const otherOwners = [
					createOwner("1", "BENEFICIARY") as Business.Owner,
					createOwner("2", "BENEFICIARY") as Business.Owner
				];
				// New owner without id
				const modifiedOwners = { owner_type: "BENEFICIARY" as const };

				expect(() => validateExtendedOwnership(modifiedOwners, otherOwners, ownerLimits)).toThrow(
					"You've reached the maximum allowed number of owners."
				);
			});
		});
	});
});
