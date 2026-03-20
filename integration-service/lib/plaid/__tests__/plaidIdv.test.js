import {
	TASK_STATUS,
	STAGE_FIELDS,
	ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS,
	CUSTOM_ONBOARDING_SETUP,
	IDV_STATUS,
	FEATURE_FLAGS
} from "#constants";
import { createTracker } from "knex-mock-client";
import { PlaidIdv } from "../plaidIdv";
import { IdentityVerificationStatus, PlaidApi } from "plaid";
import { decryptData, encryptData } from "#utils/encryption";
import { getFlagValue } from "#helpers";
import { checkIfUserInfoHasChanged } from "../util/checkIfUserInfoHasChanged";
import { TaskManager } from "../../../src/api/v1/modules/tasks/taskManager";

const { db } = require("#helpers/knex"); // Initialize db here

const dummyUuid = "10000000-0000-0000-0000-000000000001";

/** @type jest.MockedFunction<typeof decryptData> */
const mockDecryptData = decryptData;
/** @type jest.MockedFunction<typeof encryptData> */
const mockEncryptData = encryptData;

jest.mock("plaid");

jest.mock("#configs/index");

jest.mock("#configs/env.config", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id",
		KAFKA_GROUP_ID: "mocked_group_id",
		PLAID_IDV_TEMPLATE_ID: "1",
		PLAID_ENV: "sandbox"
		//   ... other mocked configuration properties
	}
}));

jest.mock("#helpers", () => ({
	updateConnectionByConnectionId: jest.fn(),
	getFlagValue: jest.fn(),
	logger: {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn()
	}
}));

jest.mock("#helpers/api", () => ({
	getOnboardingCustomerSettings: jest.fn(),
	getCustomerOnboardingStagesSettings: jest.fn(),
	InternalApiError: class InternalApiError extends Error {
		constructor(message, httpStatus, errorCode) {
			super(message);
			this.httpStatus = httpStatus;
			this.errorCode = errorCode;
		}
	}
}));

jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

jest.mock("#utils/encryption");

jest.mock("../util/checkIfUserInfoHasChanged", () => ({
	checkIfUserInfoHasChanged: jest.fn()
}));

/**
 * A class that extends PlaidIdv and overrides the methods to return mock values.
 * This simplifies the test setup and makes it easier to test the PlaidIdv class.
 */
class PlaidIDVUnderTest extends PlaidIdv {
	constructor(dbConnection) {
		super(dbConnection);
		this.updateTaskStatus = jest.fn().mockResolvedValue(undefined);
		this.getDBConnection = jest.fn().mockReturnValue({
			configuration: {
				idv_enabled: true
			}
		});
		this.updateBusinessIntegrationTask = jest.fn().mockResolvedValue(undefined);
		this.saveIdvResponse = jest.fn().mockResolvedValue({ id: "any" });
		this.getIdvStatusFromPlaid = jest.fn().mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
		this.decrypt = jest.fn();

		const mockPlaidClient = jest.createMockFromModule("plaid");
		mockPlaidClient.identityVerificationCreate = jest.fn().mockResolvedValue({ data: { id: "any" } });
		mockPlaidClient.linkTokenCreate = jest.fn().mockResolvedValue({
			data: {}
		});
		this.plaidClient = mockPlaidClient;
	}
	static getLatestLocalIdentityVerificationRecordsForApplicant() {
		return Promise.resolve([]);
	}
}

describe("PlaidIdv", () => {
	let plaidIdv, tracker;

	let saveIdvResponseProtoSpy;

	beforeEach(() => {
		plaidIdv = new PlaidIdv();
		tracker = createTracker(db);

		// Mock saveIdvResponse so no test triggers real identity_verification insert (avoids unhandled rejection)
		saveIdvResponseProtoSpy = jest.spyOn(PlaidIdv.prototype, "saveIdvResponse").mockResolvedValue({ id: dummyUuid });

		// Mock the getDefaultIdvTemplateForEnvironment database query
		tracker.on.select("core_identity_verification_templates").response([
			{
				id: 1,
				template_id: "default_template_123",
				steps: "{kyc_check}",
				platform: "sandbox",
				created_at: new Date("2023-01-01")
			}
		]);

		// Mock inserts used by saveIdvResponse and updateTaskStatus so tests don't need per-test handlers
		tracker.on.insert("identity_verification").response([{ id: dummyUuid }]);
		tracker.on.insert("business_integration_tasks_events").response([]);
	});
	afterEach(() => {
		saveIdvResponseProtoSpy?.mockRestore();
		jest.resetAllMocks();
		tracker.reset();
		mockDecryptData.mockImplementation(value => value);
	});

	const getOwner = (overrides = {}) => ({
		id: "123e4567-e89b-12d3-a456-426614174000",
		title: 1,
		first_name: "John",
		last_name: "Doe",
		ssn: "encrypted-ssn-string",
		email: "john.doe@example.com",
		mobile: 1234567890,
		date_of_birth: "encrypted-dob-string",
		address_apartment: "Apt 101",
		address_line_1: "123 Main St",
		address_line_2: "Building 5",
		address_city: "Metropolis",
		address_state: "NY",
		address_postal_code: "12345",
		address_country: "USA",
		created_at: "2024-05-01T12:00:00Z",
		created_by: "123e4567-e89b-12d3-a456-426614174001",
		updated_at: "2024-06-01T12:00:00Z",
		updated_by: "123e4567-e89b-12d3-a456-426614174002",
		last_four_of_ssn: "1234",
		year_of_birth: 1980,
		...overrides
	});

	const getDefaultTask = () => ({
		id: dummyUuid,
		platform_id: PlaidIdv.PLATFORM_ID,
		task_status: "CREATED",
		task_code: "fetch_identity_verification",
		metadata: {
			request: {
				id: "plaid123"
			}
		}
	});
	// Mutable task shared by tests; reset in beforeEach so one test cannot leak state into another
	let task = getDefaultTask();
	beforeEach(() => {
		task = getDefaultTask();
	});

	describe("getSSNVerificationStatus", () => {
		it("returns no_match when synthetic risk score exceeds threshold", () => {
			const result = PlaidIdv.getSSNVerificationStatus("match", 90);
			expect(result).toBe("no_match");
		});

		it("returns original status when synthetic risk score is below threshold or missing", () => {
			expect(PlaidIdv.getSSNVerificationStatus("match", 40)).toBe("match");
			expect(PlaidIdv.getSSNVerificationStatus("no_match", undefined)).toBe("no_match");
			expect(PlaidIdv.getSSNVerificationStatus("match", NaN)).toBe("match");
		});
	});

	describe("getApplicantVerificationResponse", () => {
		const applicantId = "123e4567-e89b-12d3-a456-426614174000";

		const createMockRecord = (overrides = {}) => ({
			applicant_id: applicantId,
			status: 2, // IDV_STATUS.SUCCESS
			updated_at: "2024-01-01T12:00:00.000Z",
			external_id: "idv_test123",
			meta: {
				kyc_check: {
					name: { summary: "match" },
					address: { summary: "match", po_box: "no_data", type: "residential" },
					date_of_birth: { summary: "match" },
					id_number: { summary: "match" },
					phone_number: { summary: "match", area_code: "match" }
				},
				risk_check: {
					email: { is_deliverable: "yes", breach_count: 0 },
					phone: { linked_services: ["google", "facebook"] },
					behavior: null,
					identity_abuse_signals: null,
					devices: [{ ip_spam_list_count: 0 }]
				},
				steps: {
					kyc_check: "success",
					documentary_verification: "success"
				},
				documentary_verification: {
					status: "success",
					documents: [
						{
							status: "success",
							attempt: 1,
							extracted_data: {
								category: "drivers_license",
								expiration_date: "2030-01-01",
								issuing_country: "US",
								issuing_region: "CA"
							}
						}
					]
				}
			},
			...overrides
		});

		it("should return documents array with extracted_data when documentary_verification exists", async () => {
			const mockRecord = createMockRecord();
			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(mockRecord);

			const result = await PlaidIdv.getApplicantVerificationResponse(applicantId);

			expect(result).toHaveLength(1);
			expect(result[0].documents).toHaveLength(1);
			expect(result[0].documents[0]).toEqual({
				type: "Driver's License",
				status: "success",
				document_id: mockRecord.external_id,
				extracted_data: {
					category: "drivers_license",
					expiration_date: "2030-01-01",
					issuing_country: "US",
					issuing_region: "CA"
				}
			});
		});

		it("should return document with undefined extracted_data when documentary_verification.documents is undefined", async () => {
			const mockRecord = createMockRecord({
				meta: {
					kyc_check: { name: { summary: "match" } },
					documentary_verification: { status: "success" }
					// documents array is missing
				}
			});
			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(mockRecord);

			const result = await PlaidIdv.getApplicantVerificationResponse(applicantId);

			expect(result).toHaveLength(1);
			// Document is created but with undefined extracted_data
			expect(result[0].documents).toHaveLength(1);
			expect(result[0].documents[0]).toEqual({
				type: "Identity Document",
				status: "success",
				document_id: mockRecord.external_id,
				extracted_data: undefined
			});
		});

		it("should return undefined documents when documentary_verification is undefined", async () => {
			const mockRecord = createMockRecord({
				meta: {
					kyc_check: { name: { summary: "match" } }
					// documentary_verification is missing
				}
			});
			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(mockRecord);

			const result = await PlaidIdv.getApplicantVerificationResponse(applicantId);

			expect(result).toHaveLength(1);
			// No documents when documentary_verification is missing
			expect(result[0].documents).toBeUndefined();
		});

		it("should return latest successful document when multiple documents in documentary_verification", async () => {
			const mockRecord = createMockRecord({
				meta: {
					kyc_check: { name: { summary: "match" } },
					documentary_verification: {
						status: "success",
						documents: [
							{
								status: "failed",
								attempt: 1,
								extracted_data: { category: "passport" }
							},
							{
								status: "success",
								attempt: 2,
								extracted_data: {
									category: "drivers_license",
									issuing_country: "US"
								}
							}
						]
					}
				}
			});
			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(mockRecord);

			const result = await PlaidIdv.getApplicantVerificationResponse(applicantId);

			expect(result).toHaveLength(1);
			// Only the latest successful document is returned
			expect(result[0].documents).toHaveLength(1);
			expect(result[0].documents[0]).toEqual({
				type: "Driver's License",
				status: "success",
				document_id: mockRecord.external_id,
				extracted_data: { category: "drivers_license", issuing_country: "US" }
			});
		});

		it("should handle documents with undefined extracted_data", async () => {
			const mockRecord = createMockRecord({
				meta: {
					kyc_check: { name: { summary: "match" } },
					documentary_verification: {
						status: "success",
						documents: [
							{
								status: "success",
								attempt: 1
								// extracted_data is missing
							}
						]
					}
				}
			});
			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(mockRecord);

			const result = await PlaidIdv.getApplicantVerificationResponse(applicantId);

			expect(result).toHaveLength(1);
			expect(result[0].documents).toHaveLength(1);
			expect(result[0].documents[0]).toEqual({
				type: "Identity Document",
				status: "success",
				document_id: mockRecord.external_id,
				extracted_data: undefined
			});
		});

		it("should return empty array when no records found", async () => {
			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(undefined);

			const result = await PlaidIdv.getApplicantVerificationResponse(applicantId);

			expect(result).toEqual([]);
		});
	});

	describe("Encryption Behavior", () => {
		let plaidIdv;

		beforeEach(() => {
			plaidIdv = new PlaidIdv();
			// Set up encryption mock to return predictable encrypted values
			mockEncryptData.mockImplementation(value => `encrypted_${value}`);
			mockDecryptData.mockImplementation(value => {
				if (typeof value === "string" && value.startsWith("encrypted_")) {
					return value.replace("encrypted_", "");
				}
				return value;
			});
		});

		afterEach(() => {
			jest.resetAllMocks();
		});

		describe("encryptNestedProperty", () => {
			it("should encrypt a top-level property matching the target key", () => {
				const input = {
					name: "John Doe",
					date_of_birth: "1990-01-15"
				};

				const result = plaidIdv.encryptNestedProperty(input, "date_of_birth");

				expect(result.name).toBe("John Doe");
				expect(result.date_of_birth).toBe("encrypted_1990-01-15");
				expect(mockEncryptData).toHaveBeenCalledWith("1990-01-15");
			});

			it("should encrypt deeply nested properties like user.id_number.value", () => {
				const input = {
					user: {
						name: { given_name: "John", family_name: "Doe" },
						id_number: {
							type: "us_ssn",
							value: "123456789"
						},
						date_of_birth: "1990-01-15"
					}
				};

				// First encrypt 'value'
				let result = plaidIdv.encryptNestedProperty(input, "value");
				expect(result.user.id_number.value).toBe("encrypted_123456789");
				expect(result.user.id_number.type).toBe("us_ssn"); // type should remain unchanged
				expect(mockEncryptData).toHaveBeenCalledWith("123456789");

				// Then encrypt 'date_of_birth'
				result = plaidIdv.encryptNestedProperty(result, "date_of_birth");
				expect(result.user.date_of_birth).toBe("encrypted_1990-01-15");
				expect(mockEncryptData).toHaveBeenCalledWith("1990-01-15");
			});

			it("should not encrypt null or undefined values", () => {
				const input = {
					user: {
						date_of_birth: null,
						id_number: {
							value: undefined
						}
					}
				};

				const result = plaidIdv.encryptNestedProperty(input, "date_of_birth");

				expect(result.user.date_of_birth).toBeNull();
				expect(mockEncryptData).not.toHaveBeenCalled();
			});

			it("should not encrypt object values (only primitives)", () => {
				const input = {
					value: { nested: "object" }
				};

				const result = plaidIdv.encryptNestedProperty(input, "value");

				// Object should not be encrypted
				expect(result.value).toEqual({ nested: "object" });
				expect(mockEncryptData).not.toHaveBeenCalled();
			});

			it("should encrypt numeric values", () => {
				const input = {
					user: {
						id_number: {
							value: 123456789
						}
					}
				};

				const result = plaidIdv.encryptNestedProperty(input, "value");

				expect(result.user.id_number.value).toBe("encrypted_123456789");
				expect(mockEncryptData).toHaveBeenCalledWith(123456789);
			});

			it("should handle arrays and encrypt matching properties within them", () => {
				const input = {
					documents: [
						{ id: 1, value: "secret1" },
						{ id: 2, value: "secret2" }
					]
				};

				const result = plaidIdv.encryptNestedProperty(input, "value");

				expect(result.documents[0].value).toBe("encrypted_secret1");
				expect(result.documents[1].value).toBe("encrypted_secret2");
				expect(mockEncryptData).toHaveBeenCalledTimes(2);
			});
		});

		describe("decrypt method", () => {
			it("should decrypt owner date_of_birth property", () => {
				const encryptedOwner = {
					id: "owner-123",
					first_name: "John",
					last_name: "Doe",
					date_of_birth: "encrypted_1990-01-15"
				};

				const result = plaidIdv.decrypt("owners", encryptedOwner);

				expect(result.date_of_birth).toBe("1990-01-15");
				expect(result.first_name).toBe("John"); // Other fields unchanged
				expect(mockDecryptData).toHaveBeenCalledWith("encrypted_1990-01-15");
			});

			it("should decrypt identity_verification date_of_birth property", () => {
				const encryptedRecord = {
					id: "idv-123",
					applicant_id: "applicant-123",
					date_of_birth: "encrypted_1985-06-20"
				};

				const result = plaidIdv.decrypt("identity_verification", encryptedRecord);

				expect(result.date_of_birth).toBe("1985-06-20");
				expect(mockDecryptData).toHaveBeenCalledWith("encrypted_1985-06-20");
			});

			it("should not attempt to decrypt null or undefined values", () => {
				const owner = {
					id: "owner-123",
					first_name: "John",
					date_of_birth: null
				};

				const result = plaidIdv.decrypt("owners", owner);

				expect(result.date_of_birth).toBeNull();
				expect(mockDecryptData).not.toHaveBeenCalled();
			});

			it("should handle missing properties gracefully", () => {
				const owner = {
					id: "owner-123",
					first_name: "John"
					// date_of_birth is missing
				};

				const result = plaidIdv.decrypt("owners", owner);

				expect(result.date_of_birth).toBeUndefined();
				expect(mockDecryptData).not.toHaveBeenCalled();
			});
		});

		describe("ENCRYPTED_PROPERTIES configuration", () => {
			it("should have correct properties defined for owners", () => {
				expect(plaidIdv.ENCRYPTED_PROPERTIES.owners).toContain("date_of_birth");
			});

			it("should have correct properties defined for identity_verification", () => {
				expect(plaidIdv.ENCRYPTED_PROPERTIES.identity_verification).toContain("date_of_birth");
			});

			it("should have correct properties defined for request_response", () => {
				expect(plaidIdv.ENCRYPTED_PROPERTIES.request_response).toContain("date_of_birth");
				expect(plaidIdv.ENCRYPTED_PROPERTIES.request_response).toContain("value");
			});
		});

		describe("Encryption roundtrip", () => {
			it("should properly encrypt and decrypt date_of_birth", () => {
				const originalOwner = {
					id: "owner-123",
					first_name: "John",
					last_name: "Doe",
					date_of_birth: "1990-01-15"
				};

				// Simulate storing encrypted data
				const encrypted = plaidIdv.encryptNestedProperty({ ...originalOwner }, "date_of_birth");
				expect(encrypted.date_of_birth).toBe("encrypted_1990-01-15");

				// Simulate retrieving and decrypting
				const decrypted = plaidIdv.decrypt("owners", encrypted);
				expect(decrypted.date_of_birth).toBe("1990-01-15");
				expect(decrypted.first_name).toBe("John"); // Other fields unchanged
			});

			it("should properly encrypt and decrypt nested SSN value in plaidRequest", () => {
				const plaidRequest = {
					client_user_id: "user-123",
					template_id: "template-123",
					user: {
						name: { given_name: "John", family_name: "Doe" },
						date_of_birth: "1990-01-15",
						id_number: {
							type: "us_ssn",
							value: "123456789"
						}
					}
				};

				// Encrypt both date_of_birth and value as done in the actual code
				let encrypted = plaidIdv.encryptNestedProperty({ ...plaidRequest }, "date_of_birth");
				encrypted = plaidIdv.encryptNestedProperty(encrypted, "value");

				// Verify encryption
				expect(encrypted.user.date_of_birth).toBe("encrypted_1990-01-15");
				expect(encrypted.user.id_number.value).toBe("encrypted_123456789");
				expect(encrypted.user.id_number.type).toBe("us_ssn"); // type unchanged
				expect(encrypted.user.name.given_name).toBe("John"); // name unchanged
			});
		});
	});

	describe("fetch_identity_verification", () => {
		it("should throw when connection is null", async () => {
			const decryptSpy = jest.spyOn(plaidIdv, "decrypt");
			await expect(plaidIdv.fetch_identity_verification(task)).rejects.toThrow("No connection available");
			expect(decryptSpy).not.toHaveBeenCalled();
		});

		it("should throw an error when ownerInfo is not present", async () => {
			const plaidIdvWithDB = new PlaidIdv(db);
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection").mockReturnValueOnce({
				configuration: { idv_enabled: true }
			});
			delete task.metadata.ownerInfo;
			await expect(plaidIdvWithDB.fetch_identity_verification(task)).rejects.toThrow("Could not find owner");
			getDBConnectionSpy.mockRestore();
		});

		it("should throw an error when ownerInfo is null", async () => {
			const plaidIdvWithDB = new PlaidIdv(db);
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection").mockReturnValueOnce({
				configuration: { idv_enabled: true }
			});
			task.metadata.ownerInfo = null;
			await expect(plaidIdvWithDB.fetch_identity_verification(task)).rejects.toThrow("Could not find owner");
			getDBConnectionSpy.mockRestore();
		});

		it("should throw and exit early when owner data is incomplete (missing required fields for IDV)", async () => {
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
			const generateRequestSpy = jest.spyOn(plaidIdvWithDB, "generateRequest");
			const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");

			const owner = getOwner();
			owner.first_name = undefined;
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);
			getDBConnectionSpy.mockReturnValueOnce({
				configuration: { idv_enabled: true }
			});
			generateRequestSpy.mockResolvedValueOnce({});

			await expect(plaidIdvWithDB.fetch_identity_verification(task)).rejects.toThrow(/Incomplete data for ownerId/);
			expect(identityVerificationCreateSpy).not.toHaveBeenCalled();

			decryptSpy.mockRestore();
			getDBConnectionSpy.mockRestore();
			generateRequestSpy.mockRestore();
			identityVerificationCreateSpy.mockRestore();
		});

		it("should throw when ownerInfo.address_line_1 is not present (incomplete data early exit)", async () => {
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
			const saveIdvResponseSpy = jest.spyOn(plaidIdvWithDB, "saveIdvResponse").mockResolvedValue(undefined);
			const owner = getOwner();
			owner.address_line_1 = undefined;
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);
			getDBConnectionSpy.mockReturnValueOnce({ configuration: { idv_enabled: true } });
			await expect(plaidIdvWithDB.fetch_identity_verification(task)).rejects.toThrow(
				/Owner info is missing required fields|Incomplete data for ownerId/
			);
			saveIdvResponseSpy.mockRestore();
			getDBConnectionSpy.mockRestore();
			decryptSpy.mockRestore();
		});

		it("should throw when ownerInfo.address_city is not present (incomplete data early exit)", async () => {
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
			const saveIdvResponseSpy = jest.spyOn(plaidIdvWithDB, "saveIdvResponse").mockResolvedValue(undefined);
			const owner = getOwner();
			owner.address_city = undefined;
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);
			getDBConnectionSpy.mockReturnValueOnce({ configuration: { idv_enabled: true } });
			await expect(plaidIdvWithDB.fetch_identity_verification(task)).rejects.toThrow(
				/Owner info is missing required fields|Incomplete data for ownerId/
			);
			saveIdvResponseSpy.mockRestore();
			getDBConnectionSpy.mockRestore();
			decryptSpy.mockRestore();
		});

		it("should use mocked IdentityVerificationCreateRequest when the last name suffix is __test", async () => {
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
			const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
			const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
			const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
			const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
			const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
				PlaidIdv,
				"getLatestLocalIdentityVerificationRecordsForApplicant"
			);
			getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue([]);
			identityVerificationCreateSpy.mockResolvedValue({ data: { id: "any" } });
			isPassThroughSpy.mockReturnValue(true);
			updateTaskSpy.mockResolvedValue();
			getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
			updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);
			const owner = getOwner();
			owner.last_name = "__test";
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);
			await plaidIdvWithDB.fetch_identity_verification(task);
			isPassThroughSpy.mockRestore();
			identityVerificationCreateSpy.mockRestore();
			updateTaskSpy.mockRestore();
			getIdvStatusFromPlaidSpy.mockRestore();
			updateBusinessIntegrationTaskSpy.mockRestore();
			decryptSpy.mockRestore();
			getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockRestore();
		});

		it("should have the expected createRequest.user.id_number value and type if the full owner ssn is present", async () => {
			/** Arrange */
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
			const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
			const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
			const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
			const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
			const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
				PlaidIdv,
				"getLatestLocalIdentityVerificationRecordsForApplicant"
			);
			getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue([]);
			identityVerificationCreateSpy.mockResolvedValue({ data: { id: "any" } });
			isPassThroughSpy.mockReturnValue(false);
			updateTaskSpy.mockResolvedValue();
			getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
			updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);
			const owner = getOwner();
			owner.ssn = "123456789";
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);

			getDBConnectionSpy.mockReturnValueOnce({
				configuration: {
					idv_enabled: true
				}
			});

			const mockPlaidClient = plaidIdvWithDB.plaidClient;
			mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({
				data: {}
			});

			/** Act */
			await plaidIdvWithDB.fetch_identity_verification(task);

			/** Assert */
			expect(mockPlaidClient.identityVerificationCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					user: expect.objectContaining({
						id_number: {
							value: "123456789",
							type: "us_ssn"
						}
					})
				})
			);

			/** Cleanup */
			isPassThroughSpy.mockRestore();
			identityVerificationCreateSpy.mockRestore();
			updateTaskSpy.mockRestore();
			getIdvStatusFromPlaidSpy.mockRestore();
			updateBusinessIntegrationTaskSpy.mockRestore();
			decryptSpy.mockRestore();
		});

		it("should have the expected createRequest.user.id_number value and type if only the last four of the owner ssn is present", async () => {
			/** Arrange */
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
			const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
			const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
			const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
			const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
			const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
				PlaidIdv,
				"getLatestLocalIdentityVerificationRecordsForApplicant"
			);
			getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue([]);
			identityVerificationCreateSpy.mockResolvedValue({ data: { id: "any" } });
			isPassThroughSpy.mockReturnValue(false);
			updateTaskSpy.mockResolvedValue();
			getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
			updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);
			const owner = getOwner();
			owner.ssn = null;
			owner.last_four_of_ssn = "6789";
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);

			getDBConnectionSpy.mockReturnValueOnce({
				configuration: {
					idv_enabled: true
				}
			});

			const mockPlaidClient = plaidIdvWithDB.plaidClient;
			mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({
				data: {}
			});

			/** Act */
			await plaidIdvWithDB.fetch_identity_verification(task);

			isPassThroughSpy.mockRestore();
			identityVerificationCreateSpy.mockRestore();
			updateTaskSpy.mockRestore();
			getIdvStatusFromPlaidSpy.mockRestore();
			updateBusinessIntegrationTaskSpy.mockRestore();
			decryptSpy.mockRestore();

			/** Assert */
			expect(mockPlaidClient.identityVerificationCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					user: expect.objectContaining({
						id_number: {
							value: "6789",
							type: "us_ssn_last_4"
						}
					})
				})
			);
		});

		it("should have a null createRequest.user.id_number value if neither the full owner ssn nor the last four of the owner ssn are present", async () => {
			/** Arrange */
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
			const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
			const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
			const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
			const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
			const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
				PlaidIdv,
				"getLatestLocalIdentityVerificationRecordsForApplicant"
			);
			getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue([]);
			identityVerificationCreateSpy.mockResolvedValue({ data: { id: "any" } });
			isPassThroughSpy.mockReturnValue(false);
			updateTaskSpy.mockResolvedValue();
			getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
			updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);
			const owner = getOwner();
			owner.ssn = null;
			owner.last_four_of_ssn = null;
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);

			getDBConnectionSpy.mockReturnValueOnce({
				configuration: {
					idv_enabled: true
				}
			});

			const mockPlaidClient = plaidIdvWithDB.plaidClient;
			mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({
				data: {}
			});

			/** Act */
			await plaidIdvWithDB.fetch_identity_verification(task);

			isPassThroughSpy.mockRestore();
			identityVerificationCreateSpy.mockRestore();
			updateTaskSpy.mockRestore();
			getIdvStatusFromPlaidSpy.mockRestore();
			updateBusinessIntegrationTaskSpy.mockRestore();
			decryptSpy.mockRestore();

			/** Assert */
			expect(mockPlaidClient.identityVerificationCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					user: expect.not.objectContaining({
						id_number: expect.anything()
					})
				})
			);
		});

		describe("retry logic", () => {
			const createPreviousRecord = (status, overrides = {}) => ({
				id: "previous-idv-record-123",
				business_integration_task_id: dummyUuid,
				business_id: dummyUuid,
				platform_id: PlaidIdv.PLATFORM_ID,
				applicant_id: "123e4567-e89b-12d3-a456-426614174000",
				status,
				external_id: "plaid-previous-123",
				template_id: "template-123",
				shareable_url: null,
				meta: {},
				created_at: "2024-01-01T00:00:00.000Z",
				...overrides
			});

			it("should use identityVerificationRetry when previous record exists and user info has changed", async () => {
				/** Arrange */
				const plaidIdvWithDB = new PlaidIdv(db);
				const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
				const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
				const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
				const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
				const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
				const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
				const identityVerificationRetrySpy = jest.spyOn(PlaidApi.prototype, "identityVerificationRetry");
				const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
				const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
					PlaidIdv,
					"getLatestLocalIdentityVerificationRecordsForApplicant"
				);

				const previousRecord = createPreviousRecord(IDV_STATUS.SUCCESS);
				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue(previousRecord);

				/** Mock checkIfUserInfoHasChanged to return true (user info changed) */
				checkIfUserInfoHasChanged.mockReturnValue(true);

				identityVerificationRetrySpy.mockResolvedValue({ data: { id: "plaid-retry-456" } });
				isPassThroughSpy.mockReturnValue(false);
				updateTaskSpy.mockResolvedValue();
				getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
				updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);

				const owner = getOwner();
				task.metadata.ownerInfo = owner;
				decryptSpy.mockReturnValueOnce(owner);

				getDBConnectionSpy.mockReturnValueOnce({
					configuration: {
						idv_enabled: true
					}
				});

				const mockPlaidClient = plaidIdvWithDB.plaidClient;
				mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({
					data: {}
				});

				/** Act */
				await plaidIdvWithDB.fetch_identity_verification(task);

				/** Assert */
				expect(checkIfUserInfoHasChanged).toHaveBeenCalledWith(owner, previousRecord);
				expect(identityVerificationRetrySpy).toHaveBeenCalled();
				expect(identityVerificationCreateSpy).not.toHaveBeenCalled();

				isPassThroughSpy.mockRestore();
				identityVerificationRetrySpy.mockRestore();
				identityVerificationCreateSpy.mockRestore();
				updateTaskSpy.mockRestore();
				getIdvStatusFromPlaidSpy.mockRestore();
				updateBusinessIntegrationTaskSpy.mockRestore();
				decryptSpy.mockRestore();
				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockRestore();
				checkIfUserInfoHasChanged.mockReset();
			});

			it("should use identityVerificationCreate when previous record exists but user info has NOT changed", async () => {
				/** Arrange */
				const plaidIdvWithDB = new PlaidIdv(db);
				const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
				const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
				const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
				const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
				const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
				const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
				const identityVerificationRetrySpy = jest.spyOn(PlaidApi.prototype, "identityVerificationRetry");
				const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
				const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
					PlaidIdv,
					"getLatestLocalIdentityVerificationRecordsForApplicant"
				);

				const previousRecord = createPreviousRecord(IDV_STATUS.SUCCESS);
				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue(previousRecord);

				/** Mock checkIfUserInfoHasChanged to return false (user info unchanged) */
				checkIfUserInfoHasChanged.mockReturnValue(false);

				identityVerificationCreateSpy.mockResolvedValue({ data: { id: "plaid-create-789" } });
				isPassThroughSpy.mockReturnValue(false);
				updateTaskSpy.mockResolvedValue();
				getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
				updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);

				const owner = getOwner();
				task.metadata.ownerInfo = owner;
				decryptSpy.mockReturnValueOnce(owner);

				getDBConnectionSpy.mockReturnValueOnce({
					configuration: {
						idv_enabled: true
					}
				});

				const mockPlaidClient = plaidIdvWithDB.plaidClient;
				mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({
					data: {}
				});

				/** Act */
				await plaidIdvWithDB.fetch_identity_verification(task);

				/** Assert */
				expect(checkIfUserInfoHasChanged).toHaveBeenCalledWith(owner, previousRecord);
				expect(identityVerificationCreateSpy).toHaveBeenCalled();
				expect(identityVerificationRetrySpy).not.toHaveBeenCalled();

				isPassThroughSpy.mockRestore();
				identityVerificationRetrySpy.mockRestore();
				identityVerificationCreateSpy.mockRestore();
				updateTaskSpy.mockRestore();
				getIdvStatusFromPlaidSpy.mockRestore();
				updateBusinessIntegrationTaskSpy.mockRestore();
				decryptSpy.mockRestore();
				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockRestore();
				checkIfUserInfoHasChanged.mockReset();
			});

			it("should use identityVerificationCreate when no previous record exists", async () => {
				/** Arrange */
				const plaidIdvWithDB = new PlaidIdv(db);
				const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
				const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
				const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
				const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
				const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
				const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
				const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
				const identityVerificationRetrySpy = jest.spyOn(PlaidApi.prototype, "identityVerificationRetry");
				const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
					PlaidIdv,
					"getLatestLocalIdentityVerificationRecordsForApplicant"
				);

				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue(null);
				identityVerificationCreateSpy.mockResolvedValue({ data: { id: "plaid-create-123" } });
				isPassThroughSpy.mockReturnValue(false);
				updateTaskSpy.mockResolvedValue();
				getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
				updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);

				const owner = getOwner();
				task.metadata.ownerInfo = owner;
				decryptSpy.mockReturnValueOnce(owner);

				getDBConnectionSpy.mockReturnValueOnce({
					configuration: {
						idv_enabled: true
					}
				});

				const mockPlaidClient = plaidIdvWithDB.plaidClient;
				mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({
					data: {}
				});

				/** Act */
				await plaidIdvWithDB.fetch_identity_verification(task);

				/** Assert */
				expect(identityVerificationCreateSpy).toHaveBeenCalled();
				expect(identityVerificationRetrySpy).not.toHaveBeenCalled();
				expect(checkIfUserInfoHasChanged).not.toHaveBeenCalled();

				isPassThroughSpy.mockRestore();
				identityVerificationCreateSpy.mockRestore();
				identityVerificationRetrySpy.mockRestore();
				updateTaskSpy.mockRestore();
				getIdvStatusFromPlaidSpy.mockRestore();
				updateBusinessIntegrationTaskSpy.mockRestore();
				decryptSpy.mockRestore();
				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockRestore();
			});
		});

		it("should store plaidRequest in metadata with encrypted date_of_birth and SSN value properties", async () => {
			/** Arrange */
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
			const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
			const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
			const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
			const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
			const encryptNestedPropertySpy = jest.spyOn(plaidIdvWithDB, "encryptNestedProperty");
			const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
				PlaidIdv,
				"getLatestLocalIdentityVerificationRecordsForApplicant"
			);

			getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue([]);
			identityVerificationCreateSpy.mockResolvedValue({ data: { id: "plaid-idv-123" } });
			isPassThroughSpy.mockReturnValue(false);
			updateTaskSpy.mockResolvedValue();
			getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
			updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);

			const owner = getOwner();
			owner.ssn = "123456789";
			owner.date_of_birth = "1990-01-15";
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);

			getDBConnectionSpy.mockReturnValueOnce({
				configuration: {
					idv_enabled: true,
					background_verification_only: true
				}
			});

			const mockPlaidClient = plaidIdvWithDB.plaidClient;
			mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({ data: {} });

			/** Act */
			await plaidIdvWithDB.fetch_identity_verification(task);

			/** Assert */
			// Verify encryptNestedProperty was called for both 'date_of_birth' and 'value' (SSN)
			expect(encryptNestedPropertySpy).toHaveBeenCalledWith(expect.any(Object), "date_of_birth");
			expect(encryptNestedPropertySpy).toHaveBeenCalledWith(expect.any(Object), "value");

			// Verify updateBusinessIntegrationTask was called to store the encrypted plaidRequest
			// The second call should be for plaidRequest (first call is for linkTokenData if applicable)
			const updateCalls = updateBusinessIntegrationTaskSpy.mock.calls;
			expect(updateCalls.length).toBeGreaterThan(0);

			// Find the call that contains plaidRequest in the metadata
			const plaidRequestCall = updateCalls.find(call => {
				const metadataArg = call[1]?.metadata;
				return metadataArg && metadataArg.toString().includes("plaidRequest");
			});
			expect(plaidRequestCall).toBeDefined();

			/** Cleanup */
			isPassThroughSpy.mockRestore();
			identityVerificationCreateSpy.mockRestore();
			updateTaskSpy.mockRestore();
			getIdvStatusFromPlaidSpy.mockRestore();
			updateBusinessIntegrationTaskSpy.mockRestore();
			decryptSpy.mockRestore();
			encryptNestedPropertySpy.mockRestore();
			getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockRestore();
		});

		describe("SDK_IDV_ROUTING template selection", () => {
			const baseSetup = () => {
				const plaidIdvWithDB = new PlaidIdv(db);
				const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
				const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
				const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
				const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
				const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
				const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
				const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
					PlaidIdv,
					"getLatestLocalIdentityVerificationRecordsForApplicant"
				);

				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue([]);
				isPassThroughSpy.mockReturnValue(false);
				updateTaskSpy.mockResolvedValue();
				getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
				updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);

				const mockPlaidClient = plaidIdvWithDB.plaidClient;
				mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({ data: {} });
				mockPlaidClient.identityVerificationCreate.mockResolvedValueOnce({ data: { id: "any" } });

				return {
					plaidIdvWithDB,
					decryptSpy,
					getDBConnectionSpy,
					isPassThroughSpy,
					updateTaskSpy,
					updateBusinessIntegrationTaskSpy,
					getIdvStatusFromPlaidSpy,
					getLatestLocalIdentityVerificationRecordsForApplicantSpy
				};
			};

			it("should use SDK routing template_id when exact match is configured", async () => {
				const {
					plaidIdvWithDB,
					decryptSpy,
					getDBConnectionSpy,
					isPassThroughSpy,
					updateTaskSpy,
					updateBusinessIntegrationTaskSpy,
					getIdvStatusFromPlaidSpy,
					getLatestLocalIdentityVerificationRecordsForApplicantSpy
				} = baseSetup();

				getFlagValue.mockImplementation((flagName, _ctx, defaultVal) => {
					if (flagName === FEATURE_FLAGS.SDK_IDV_ROUTING) {
						return Promise.resolve({
							"cust-123": {
								address_country: {
									US: "sdk-template-us"
								}
							}
						});
					}
					if (flagName === FEATURE_FLAGS.BEST_91_DISABLE_IDV_SANITIZATION) return Promise.resolve(false);
					return Promise.resolve(defaultVal ?? null);
				});

				const owner = getOwner({ address_country: "US", ssn: "123456789" });
				task.metadata.ownerInfo = owner;
				decryptSpy.mockReturnValueOnce(owner);

				getDBConnectionSpy.mockReturnValue({
					configuration: {
						idv_enabled: true,
						template_id: "legacy-template"
					}
				});

				await plaidIdvWithDB.fetch_identity_verification({ ...task, customer_id: "cust-123" });

				expect(plaidIdvWithDB.plaidClient.identityVerificationCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						template_id: "sdk-template-us"
					})
				);

				isPassThroughSpy.mockRestore();
				updateTaskSpy.mockRestore();
				updateBusinessIntegrationTaskSpy.mockRestore();
				getIdvStatusFromPlaidSpy.mockRestore();
				decryptSpy.mockRestore();
				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockRestore();
			});

			it("should use SDK routing template_id when regex match is configured", async () => {
				const {
					plaidIdvWithDB,
					decryptSpy,
					getDBConnectionSpy,
					isPassThroughSpy,
					updateTaskSpy,
					updateBusinessIntegrationTaskSpy,
					getIdvStatusFromPlaidSpy,
					getLatestLocalIdentityVerificationRecordsForApplicantSpy
				} = baseSetup();

				getFlagValue.mockImplementation((flagName, _ctx, defaultVal) => {
					if (flagName === FEATURE_FLAGS.SDK_IDV_ROUTING) {
						return Promise.resolve({
							"cust-456": {
								email: {
									"/@example\\.com$/i": "sdk-template-example-email"
								}
							}
						});
					}
					if (flagName === FEATURE_FLAGS.BEST_91_DISABLE_IDV_SANITIZATION) return Promise.resolve(false);
					return Promise.resolve(defaultVal ?? null);
				});

				const owner = getOwner({ email: "john.doe@example.com", ssn: "123456789" });
				task.metadata.ownerInfo = owner;
				decryptSpy.mockReturnValueOnce(owner);

				getDBConnectionSpy.mockReturnValue({
					configuration: {
						idv_enabled: true,
						template_id: "legacy-template"
					}
				});

				await plaidIdvWithDB.fetch_identity_verification({ ...task, customer_id: "cust-456" });

				expect(plaidIdvWithDB.plaidClient.identityVerificationCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						template_id: "sdk-template-example-email"
					})
				);

				isPassThroughSpy.mockRestore();
				updateTaskSpy.mockRestore();
				updateBusinessIntegrationTaskSpy.mockRestore();
				getIdvStatusFromPlaidSpy.mockRestore();
				decryptSpy.mockRestore();
				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockRestore();
			});

			it("should fall back to legacy connection template_id when no SDK routing match is found", async () => {
				const {
					plaidIdvWithDB,
					decryptSpy,
					getDBConnectionSpy,
					isPassThroughSpy,
					updateTaskSpy,
					updateBusinessIntegrationTaskSpy,
					getIdvStatusFromPlaidSpy,
					getLatestLocalIdentityVerificationRecordsForApplicantSpy
				} = baseSetup();

				getFlagValue.mockImplementation((flagName, _ctx, defaultVal) => {
					if (flagName === FEATURE_FLAGS.SDK_IDV_ROUTING) {
						return Promise.resolve({
							"cust-999": {
								address_country: {
									CA: "sdk-template-ca"
								}
							}
						});
					}
					if (flagName === FEATURE_FLAGS.BEST_91_DISABLE_IDV_SANITIZATION) return Promise.resolve(false);
					return Promise.resolve(defaultVal ?? null);
				});

				const owner = getOwner({ address_country: "US", ssn: "123456789" });
				task.metadata.ownerInfo = owner;
				decryptSpy.mockReturnValueOnce(owner);

				getDBConnectionSpy.mockReturnValue({
					configuration: {
						idv_enabled: true,
						template_id: "legacy-template"
					}
				});

				await plaidIdvWithDB.fetch_identity_verification({ ...task, customer_id: "cust-999" });

				expect(plaidIdvWithDB.plaidClient.identityVerificationCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						template_id: "legacy-template"
					})
				);

				isPassThroughSpy.mockRestore();
				updateTaskSpy.mockRestore();
				updateBusinessIntegrationTaskSpy.mockRestore();
				getIdvStatusFromPlaidSpy.mockRestore();
				decryptSpy.mockRestore();
				getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockRestore();
			});
		});
	});

	describe("enrollApplicantOrGetExistingIdvRecord", () => {
		it("should enroll an applicant when no previous record exists", async () => {
			const applicantInfo = {
				id: "123"
			};

			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(null);
			jest.spyOn(plaidIdv, "enrollApplicant").mockResolvedValue({
				taskId: dummyUuid,
				taskStatus: TASK_STATUS.IN_PROGRESS
			});

			const result = await plaidIdv.enrollApplicantOrGetExistingIdvRecord(applicantInfo);

			expect(result).toEqual({
				taskId: dummyUuid,
				taskStatus: TASK_STATUS.IN_PROGRESS
			});
			expect(plaidIdv.enrollApplicant).toHaveBeenCalledWith(applicantInfo);
		});

		it("should return existing successful task when user info has not changed", async () => {
			const applicantInfo = {
				id: "123"
			};
			const latestRecord = {
				id: "record-123",
				business_integration_task_id: dummyUuid,
				status: IDV_STATUS.SUCCESS,
				meta: { user: { name: { given_name: "John" } } }
			};
			const existingTask = {
				id: dummyUuid,
				task_status: TASK_STATUS.SUCCESS
			};

			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(latestRecord);
			jest.spyOn(TaskManager, "getTaskById").mockResolvedValue(existingTask);
			checkIfUserInfoHasChanged.mockReturnValue(false);

			const result = await plaidIdv.enrollApplicantOrGetExistingIdvRecord(applicantInfo);

			expect(result).toEqual({
				taskId: dummyUuid,
				taskStatus: TASK_STATUS.SUCCESS,
				previousSuccess: true,
				record: latestRecord
			});
			expect(checkIfUserInfoHasChanged).toHaveBeenCalledWith(applicantInfo, latestRecord);
			checkIfUserInfoHasChanged.mockReset();
		});

		it("should return existing in-progress task when IDV is pending and user info has not changed", async () => {
			const applicantInfo = {
				id: "123"
			};
			const latestRecord = {
				id: "record-123",
				business_integration_task_id: dummyUuid,
				status: IDV_STATUS.PENDING,
				meta: { user: { name: { given_name: "John" } } }
			};
			const existingTask = {
				id: dummyUuid,
				task_status: TASK_STATUS.IN_PROGRESS
			};

			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(latestRecord);
			jest.spyOn(TaskManager, "getTaskById").mockResolvedValue(existingTask);
			checkIfUserInfoHasChanged.mockReturnValue(false);

			const result = await plaidIdv.enrollApplicantOrGetExistingIdvRecord(applicantInfo);

			expect(result).toEqual({
				taskId: dummyUuid,
				taskStatus: TASK_STATUS.IN_PROGRESS,
				record: latestRecord
			});
			expect(checkIfUserInfoHasChanged).toHaveBeenCalledWith(applicantInfo, latestRecord);
			checkIfUserInfoHasChanged.mockReset();
		});

		it("should enroll applicant when user info has changed", async () => {
			const applicantInfo = {
				id: "123"
			};
			const latestRecord = {
				id: "record-123",
				business_integration_task_id: dummyUuid,
				status: IDV_STATUS.SUCCESS,
				meta: { user: { name: { given_name: "John" } } }
			};
			const existingTask = {
				id: dummyUuid,
				task_status: TASK_STATUS.SUCCESS
			};

			jest.spyOn(PlaidIdv, "getLatestLocalIdentityVerificationRecordsForApplicant").mockResolvedValue(latestRecord);
			jest.spyOn(TaskManager, "getTaskById").mockResolvedValue(existingTask);
			checkIfUserInfoHasChanged.mockReturnValue(true);
			jest.spyOn(plaidIdv, "enrollApplicant").mockResolvedValue({
				taskId: "new-task-uuid",
				taskStatus: TASK_STATUS.IN_PROGRESS
			});

			const result = await plaidIdv.enrollApplicantOrGetExistingIdvRecord(applicantInfo);

			expect(result).toEqual({
				taskId: "new-task-uuid",
				taskStatus: TASK_STATUS.IN_PROGRESS
			});
			expect(plaidIdv.enrollApplicant).toHaveBeenCalledWith(applicantInfo);
			checkIfUserInfoHasChanged.mockReset();
		});
	});

	describe("BEST-91 Constraints", () => {
		it("should not constrain IDV inputs if the flag is enabled", async () => {
			getFlagValue.mockResolvedValue(true);

			/** Arrange */
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
			const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
			const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
			const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
			const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
			const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
				PlaidIdv,
				"getLatestLocalIdentityVerificationRecordsForApplicant"
			);
			getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue([]);
			identityVerificationCreateSpy.mockResolvedValue({ data: { id: "any" } });
			isPassThroughSpy.mockReturnValue(false);
			updateTaskSpy.mockResolvedValue();
			getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
			updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);
			const owner = getOwner();
			owner.address_country = "GB";
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);

			getDBConnectionSpy.mockReturnValueOnce({
				configuration: {
					idv_enabled: true
				}
			});

			const mockPlaidClient = plaidIdvWithDB.plaidClient;
			mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({
				data: {}
			});

			/** Act */
			await plaidIdvWithDB.fetch_identity_verification(task);

			/** Assert */
			expect(mockPlaidClient.identityVerificationCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					user: expect.objectContaining({
						address: {
							city: "METROPOLIS",
							country: "GB",
							postal_code: "12345",
							region: "NY",
							street: "123 MAIN ST",
							street2: "BUILDING 5"
						}
					})
				})
			);

			/** Cleanup */
			isPassThroughSpy.mockRestore();
			identityVerificationCreateSpy.mockRestore();
			updateTaskSpy.mockRestore();
			getIdvStatusFromPlaidSpy.mockRestore();
			updateBusinessIntegrationTaskSpy.mockRestore();
			decryptSpy.mockRestore();
		});
		it("should constrain IDV inputs if the flag is disabled", async () => {
			getFlagValue.mockResolvedValue(false);

			/** Arrange */
			const plaidIdvWithDB = new PlaidIdv(db);
			const decryptSpy = jest.spyOn(plaidIdvWithDB, "decrypt");
			const isPassThroughSpy = jest.spyOn(plaidIdvWithDB, "isPassThrough");
			const updateTaskSpy = jest.spyOn(plaidIdvWithDB, "updateTaskStatus");
			const getDBConnectionSpy = jest.spyOn(plaidIdvWithDB, "getDBConnection");
			const updateBusinessIntegrationTaskSpy = jest.spyOn(plaidIdvWithDB, "updateBusinessIntegrationTask");
			const getIdvStatusFromPlaidSpy = jest.spyOn(plaidIdvWithDB, "getIdvStatusFromPlaid");
			const identityVerificationCreateSpy = jest.spyOn(PlaidApi.prototype, "identityVerificationCreate");
			const getLatestLocalIdentityVerificationRecordsForApplicantSpy = jest.spyOn(
				PlaidIdv,
				"getLatestLocalIdentityVerificationRecordsForApplicant"
			);
			getLatestLocalIdentityVerificationRecordsForApplicantSpy.mockResolvedValue([]);
			identityVerificationCreateSpy.mockResolvedValue({ data: { id: "any" } });
			isPassThroughSpy.mockReturnValue(false);
			updateTaskSpy.mockResolvedValue();
			getIdvStatusFromPlaidSpy.mockResolvedValue({ status: IdentityVerificationStatus.PendingReview });
			updateBusinessIntegrationTaskSpy.mockResolvedValue(undefined);
			const owner = getOwner();
			owner.address_country = "GB";
			task.metadata.ownerInfo = owner;
			decryptSpy.mockReturnValueOnce(owner);

			getDBConnectionSpy.mockReturnValueOnce({
				configuration: {
					idv_enabled: true
				}
			});

			const mockPlaidClient = plaidIdvWithDB.plaidClient;
			mockPlaidClient.linkTokenCreate.mockResolvedValueOnce({
				data: {}
			});

			/** Act */
			await plaidIdvWithDB.fetch_identity_verification(task);

			/** Assert */
			expect(mockPlaidClient.identityVerificationCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					user: expect.objectContaining({
						address: {
							city: "METROPOLIS",
							postal_code: "12345",
							street: "123 MAIN ST",
							street2: "BUILDING 5",
							country: "GB"
						}
					})
				})
			);

			/** Cleanup */
			isPassThroughSpy.mockRestore();
			identityVerificationCreateSpy.mockRestore();
			updateTaskSpy.mockRestore();
			getIdvStatusFromPlaidSpy.mockRestore();
			updateBusinessIntegrationTaskSpy.mockRestore();
			decryptSpy.mockRestore();
		});
	});

	describe("BEST-91 Input Sanitization", () => {
		let plaidIdvWithDB;

		beforeEach(() => {
			plaidIdvWithDB = new PlaidIDVUnderTest(db);
		});

		const phoneScenarios = [
			["empty string should use default #", "", PlaidIdv.DEFAULT_PHONE_NUMBER],
			["null should use default #", null, PlaidIdv.DEFAULT_PHONE_NUMBER],
			["unparsable should use default #", "8544 20a123455678", PlaidIdv.DEFAULT_PHONE_NUMBER],
			["911 should use default #", "911", PlaidIdv.DEFAULT_PHONE_NUMBER],
			["no country code should default to US", "5088636908", "+15088636908"],
			["with +1", "+15088636908", "+15088636908"],
			["british phone number", "+44 20 1234 5678", "+442012345678"],
			["mexican phone number", "+52 555555-5555", "+525555555555"],
			["canadian phone number", "+1 613 555-0155", "+16135550155"],
			[
				"passing lastname with __test should override",
				{ last_name: "Robinson__test", mobile: "+14076641508" },
				"+12345678909"
			]
		];

		const idScenarios = [
			["canada", { ssn: "983456789", address_country: "CA" }, { value: "983456789", type: "ca_sin" }],
			["usa ssn", { ssn: "123456789", address_country: "US" }, { value: "123456789", type: "us_ssn" }],
			["usa ssn last 4", { ssn: "5678", address_country: "US" }, { value: "5678", type: "us_ssn_last_4" }],
			["mexican rfc", { ssn: "HEGJ820506M10", address_country: "MX" }, { value: "HEGJ820506M10", type: "mx_rfc" }],
			[
				"mexican curp",
				{ ssn: "ZAZD801124MBSYQN13", address_country: "mx" },
				{ value: "ZAZD801124MBSYQN13", type: "mx_curp" }
			],
			["empty ssn to null", { ssn: "", last_four_of_ssn: "" }, null],
			["null ssn to null", { ssn: null, last_four_of_ssn: "" }, null],
			["invalid ssn to null", { ssn: "12345678901", last_four_of_ssn: null }, null]
		];

		const nameScenarios = [
			[
				"lastname ending with __test should override",
				{ first_name: "Anna", last_name: "Wintour__test" },
				{ first_name: "Leslie", last_name: "Knope" }
			],
			[
				"normally leave name alone",
				{ first_name: "Anna", last_name: "Wintour" },
				{ first_name: "Anna", last_name: "Wintour" }
			]
		];

		phoneScenarios.forEach(([scenario, mobile, expected]) => {
			it(`should sanitize phone number - ${scenario}: ${mobile} => ${expected}`, async () => {
				const owner = getOwner(typeof mobile === "object" ? mobile : { mobile });
				task.metadata.ownerInfo = owner;
				plaidIdvWithDB.decrypt.mockReturnValueOnce(owner);

				await plaidIdvWithDB.fetch_identity_verification(task);

				/** Assert */
				expect(plaidIdvWithDB.plaidClient.identityVerificationCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						user: expect.objectContaining({
							phone_number: expected
						})
					})
				);
			});
		});

		idScenarios.forEach(([scenario, ownerOverrides, expected]) =>
			test(`should use correct id numbers: ${scenario} => ${JSON.stringify(expected)}`, async () => {
				const owner = getOwner(ownerOverrides);
				task.metadata.ownerInfo = owner;
				plaidIdvWithDB.decrypt.mockReturnValueOnce(owner);

				/** Act */
				await plaidIdvWithDB.fetch_identity_verification(task);

				/** Assert */
				expect(plaidIdvWithDB.plaidClient.identityVerificationCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						user: expect.objectContaining({
							id_number: expected
						})
					})
				);
			})
		);

		nameScenarios.forEach(([scenario, input, expected]) => {
			it(`should handle name scenarios - ${scenario}`, async () => {
				const owner = getOwner(input);
				task.metadata.ownerInfo = owner;
				plaidIdvWithDB.decrypt.mockReturnValueOnce(owner);

				await plaidIdvWithDB.fetch_identity_verification(task);

				/** Assert */
				expect(plaidIdvWithDB.plaidClient.identityVerificationCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						user: expect.objectContaining({
							name: {
								family_name: expected.last_name,
								given_name: expected.first_name
							}
						})
					})
				);
			});
		});
	});

	describe("initializePlaidIdvConnectionConfiguration", () => {
		let plaidIdv;
		let mockConnection;
		let mockCustomerSettings;
		let mockIdvTemplates;
		let mockCustomOnboardingSettings;
		let getOnboardingCustomerSettings;
		let getCustomerOnboardingStagesSettings;
		let updateConnectionByConnectionId;

		// Helper function to create mock onboarding stages settings
		const createMockOnboardingStages = (subFieldOverrides = {}) => {
			const defaultSubFields = [
				{ name: ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.COLLECT_DRIVER_LICENSE, status: false },
				{ name: ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.CONDUCT_LIVELINESS_CHECK, status: false },
				{ name: ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.CUSTOM_PLAID_TEMPLATE, status: false },
				{ name: ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.PLAID_TEMPLATE_ID, status: "" }
			];

			// Merge overrides with defaults
			const subFields = defaultSubFields.map(field => ({
				...field,
				...(subFieldOverrides[field.name] && { status: subFieldOverrides[field.name] })
			}));

			return [
				{
					stage_code: "ownership",
					config: {
						fields: [
							{
								name: STAGE_FIELDS.IDENTITY_VERIFICATION,
								sub_fields: subFields
							}
						]
					}
				}
			];
		};

		beforeEach(() => {
			jest.clearAllMocks();

			// Get fresh references to the mocked functions
			({ getOnboardingCustomerSettings, getCustomerOnboardingStagesSettings } = require("#helpers/api"));
			({ updateConnectionByConnectionId, logger } = require("#helpers"));

			// Clear the API mocks
			getOnboardingCustomerSettings.mockClear();
			getCustomerOnboardingStagesSettings.mockClear();

			// Initialize base mock for onboarding customer settings
			mockCustomOnboardingSettings = [
				{
					code: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP,
					is_enabled: true
				}
			];

			mockConnection = {
				id: "connection-123",
				business_id: dummyUuid,
				platform_id: "PLAID_IDV",
				connection_status: "ACTIVE",
				configuration: {
					customer_id: "test-customer-id"
				}
			};

			mockCustomerSettings = {
				status: "ACTIVE",
				mode: "SANDBOX"
			};

			mockIdvTemplates = [
				{
					id: "internal-default-template-id",
					template_id: "default-template-id",
					steps: "{kyc_check}",
					environment: "SANDBOX"
				},
				{
					id: "internal-fallback-template-id",
					template_id: "fallback-template-id",
					steps: "{kyc_check_without_ssn}",
					environment: "SANDBOX"
				},
				{
					id: "internal-comprehensive-template-id",
					template_id: "comprehensive-template-id",
					steps: "{kyc_check,documentary_verification,selfie_check}",
					environment: "SANDBOX"
				},
				{
					id: "internal-license-template-id",
					template_id: "license-template-id",
					steps: "{kyc_check,documentary_verification}",
					environment: "SANDBOX"
				},
				{
					id: "internal-selfie-template-id",
					template_id: "selfie-template-id",
					steps: "{kyc_check,selfie_check}",
					environment: "SANDBOX"
				}
			];

			mockCustomerIdvIntegrationSettings = {
				status: "ACTIVE",
				mode: "SANDBOX"
			};

			mockCustomOnboardingSettings = [
				{
					code: CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP,
					is_enabled: true
				}
			];

			plaidIdv = new PlaidIdv(mockConnection);

			// Mock the methods called by initializePlaidIdvConnectionConfiguration
			plaidIdv.getCustomerIntegrationIdvSettings = jest.fn().mockResolvedValue(mockCustomerSettings);
			plaidIdv.getIdvTemplatesForEnvironment = jest.fn().mockResolvedValue(mockIdvTemplates);
			// Don't mock processCustomerSettings - let it run actual logic
		});

		it("should select default template when customer has no custom onboarding settings", async () => {
			plaidIdv.getCustomerIntegrationIdvSettings.mockResolvedValue(mockCustomerIdvIntegrationSettings);
			getOnboardingCustomerSettings.mockResolvedValue([]);

			const mockUpdatedConnection = { ...mockConnection };
			updateConnectionByConnectionId.mockResolvedValue(mockUpdatedConnection);

			const result = await plaidIdv.initializePlaidIdvConnectionConfiguration("test-customer-id");

			expect(updateConnectionByConnectionId).toHaveBeenCalledWith(
				"connection-123",
				"SUCCESS",
				expect.objectContaining({
					customer_id: "test-customer-id",
					template_id: "default-template-id", // Should select default kyc_check template
					idv_id: "internal-default-template-id",
					idv_enabled: true,
					custom_template_used: false,
					background_verification_only: true,
					fallback_template_id: "fallback-template-id",
					fallback_idv_id: "internal-fallback-template-id"
				})
			);

			expect(result).toBe(plaidIdv);
		});

		it("should select comprehensive template when customer has both license and selfie enabled", async () => {
			plaidIdv.getCustomerIntegrationIdvSettings.mockResolvedValue(mockCustomerIdvIntegrationSettings);

			getOnboardingCustomerSettings.mockResolvedValue(mockCustomOnboardingSettings);

			// Use helper to create mock with both license and selfie enabled
			getCustomerOnboardingStagesSettings.mockResolvedValue(
				createMockOnboardingStages({
					[ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.COLLECT_DRIVER_LICENSE]: true,
					[ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.CONDUCT_LIVELINESS_CHECK]: true
				})
			);

			updateConnectionByConnectionId.mockResolvedValue({ ...mockConnection });

			await plaidIdv.initializePlaidIdvConnectionConfiguration("test-customer-id");

			expect(updateConnectionByConnectionId).toHaveBeenCalledWith(
				"connection-123",
				"SUCCESS",
				expect.objectContaining({
					customer_id: "test-customer-id",
					idv_enabled: true,
					template_id: "comprehensive-template-id", // kyc_check,documentary_verification,selfie_check
					idv_id: "internal-comprehensive-template-id",
					custom_template_used: false,
					background_verification_only: false // Not the default template
				})
			);
		});

		it("should select license-only template when only driver license is enabled", async () => {
			plaidIdv.getCustomerIntegrationIdvSettings.mockResolvedValue(mockCustomerIdvIntegrationSettings);

			getOnboardingCustomerSettings.mockResolvedValue(mockCustomOnboardingSettings);

			// Use helper to create mock with only driver license enabled
			getCustomerOnboardingStagesSettings.mockResolvedValue(
				createMockOnboardingStages({
					[ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.COLLECT_DRIVER_LICENSE]: true
					// CONDUCT_LIVELINESS_CHECK defaults to false
				})
			);

			updateConnectionByConnectionId.mockResolvedValue({ ...mockConnection });

			await plaidIdv.initializePlaidIdvConnectionConfiguration("test-customer-id");

			expect(updateConnectionByConnectionId).toHaveBeenCalledWith(
				"connection-123",
				"SUCCESS",
				expect.objectContaining({
					customer_id: "test-customer-id",
					idv_enabled: true,
					template_id: "license-template-id", // kyc_check,documentary_verification
					idv_id: "internal-license-template-id",
					custom_template_used: false,
					background_verification_only: false
				})
			);
		});

		it("should select selfie-only template when only selfie check is enabled", async () => {
			plaidIdv.getCustomerIntegrationIdvSettings.mockResolvedValue(mockCustomerIdvIntegrationSettings);

			getOnboardingCustomerSettings.mockResolvedValue(mockCustomOnboardingSettings);

			// Use helper to create mock with only liveliness check enabled
			getCustomerOnboardingStagesSettings.mockResolvedValue(
				createMockOnboardingStages({
					// COLLECT_DRIVER_LICENSE defaults to false
					[ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.CONDUCT_LIVELINESS_CHECK]: true
				})
			);

			updateConnectionByConnectionId.mockResolvedValue({ ...mockConnection });

			await plaidIdv.initializePlaidIdvConnectionConfiguration("test-customer-id");

			expect(updateConnectionByConnectionId).toHaveBeenCalledWith(
				"connection-123",
				"SUCCESS",
				expect.objectContaining({
					customer_id: "test-customer-id",
					idv_enabled: true,
					template_id: "selfie-template-id", // kyc_check,selfie_check
					idv_id: "internal-selfie-template-id",
					custom_template_used: false,
					background_verification_only: false
				})
			);
		});

		it("should select default template when driver license and selfie check are disabled", async () => {
			plaidIdv.getCustomerIntegrationIdvSettings.mockResolvedValue(mockCustomerIdvIntegrationSettings);

			getOnboardingCustomerSettings.mockResolvedValue(mockCustomOnboardingSettings);

			// Use helper to create mock with both license and liveliness check disabled (default)
			getCustomerOnboardingStagesSettings.mockResolvedValue(createMockOnboardingStages());

			updateConnectionByConnectionId.mockResolvedValue({ ...mockConnection });

			await plaidIdv.initializePlaidIdvConnectionConfiguration("test-customer-id");

			expect(updateConnectionByConnectionId).toHaveBeenCalledWith(
				"connection-123",
				"SUCCESS",
				expect.objectContaining({
					customer_id: "test-customer-id",
					idv_enabled: true,
					template_id: "default-template-id", // kyc_check,selfie_check
					idv_id: "internal-default-template-id",
					custom_template_used: false,
					background_verification_only: true,
					fallback_template_id: "fallback-template-id",
					fallback_idv_id: "internal-fallback-template-id"
				})
			);
		});

		it("should use custom template when custom template is enabled", async () => {
			plaidIdv.getCustomerIntegrationIdvSettings.mockResolvedValue(mockCustomerIdvIntegrationSettings);

			getOnboardingCustomerSettings.mockResolvedValue(mockCustomOnboardingSettings);

			// Use helper to create mock with custom template enabled
			getCustomerOnboardingStagesSettings.mockResolvedValue(
				createMockOnboardingStages({
					[ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.CUSTOM_PLAID_TEMPLATE]: true,
					[ENABLE_IDENTITY_VERIFICATION_SUB_FIELDS.PLAID_TEMPLATE_ID]: "custom-template-id"
				})
			);

			updateConnectionByConnectionId.mockResolvedValue({ ...mockConnection });

			await plaidIdv.initializePlaidIdvConnectionConfiguration("test-customer-id");

			// Should use custom template ID
			expect(updateConnectionByConnectionId).toHaveBeenCalledWith(
				"connection-123",
				"SUCCESS",
				expect.objectContaining({
					customer_id: "test-customer-id",
					idv_enabled: true,
					template_id: "custom-template-id", // Custom template from settings
					custom_template_used: true,
					background_verification_only: false // Custom template ≠ default
				})
			);
		});

		it("should handle IDV disabled in customer integration settings", async () => {
			plaidIdv.getCustomerIntegrationIdvSettings.mockResolvedValue(mockCustomerIdvIntegrationSettings);

			mockCustomerIdvIntegrationSettings.status = "INACTIVE";

			updateConnectionByConnectionId.mockResolvedValue({ ...mockConnection });

			await plaidIdv.initializePlaidIdvConnectionConfiguration("test-customer-id");

			expect(updateConnectionByConnectionId).toHaveBeenCalledWith(
				"connection-123",
				"SUCCESS",
				expect.objectContaining({
					customer_id: "test-customer-id",
					idv_enabled: false, // IDV is disabled in customer integration settings
					template_id: "default-template-id",
					idv_id: "internal-default-template-id",
					custom_template_used: false,
					background_verification_only: true
				})
			);
		});

		it("should handle IDV disabled in onboarding settings", async () => {
			plaidIdv.getCustomerIntegrationIdvSettings.mockResolvedValue(mockCustomerIdvIntegrationSettings);

			getOnboardingCustomerSettings.mockResolvedValue(mockCustomOnboardingSettings);

			getCustomerOnboardingStagesSettings.mockResolvedValue([
				{
					stage_code: "ownership",
					config: {
						fields: [
							{
								name: STAGE_FIELDS.DISABLE_IDENTITY_VERIFICATION,
								status: true // IDV is disabled in onboarding
							}
						]
					}
				}
			]);

			updateConnectionByConnectionId.mockResolvedValue({ ...mockConnection });

			await plaidIdv.initializePlaidIdvConnectionConfiguration("test-customer-id");

			// Should log warning about mismatched settings
			expect(logger.warn).toHaveBeenCalledWith(
				{ customerID: "test-customer-id" },
				expect.stringContaining("Mismatching IDV configuration")
			);

			// Should fall back to default template but keep IDV enabled (per integration settings)
			expect(updateConnectionByConnectionId).toHaveBeenCalledWith(
				"connection-123",
				"SUCCESS",
				expect.objectContaining({
					customer_id: "test-customer-id",
					idv_enabled: true, // Stays true because integration setting is ACTIVE
					template_id: "default-template-id", // Falls back to default
					idv_id: "internal-default-template-id",
					custom_template_used: false,
					background_verification_only: true,
					fallback_template_id: "fallback-template-id",
					fallback_idv_id: "internal-fallback-template-id"
				})
			);
		});

		it("should throw error when no database connection exists", async () => {
			plaidIdv.dbConnection = null;

			await expect(plaidIdv.initializePlaidIdvConnectionConfiguration("test-customer-id")).rejects.toThrow(
				"PlaidIDV connection not found"
			);
		});
	});
});
