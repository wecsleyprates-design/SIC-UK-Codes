import { BUSINESS_STATUS, ERROR_CODES, FEATURE_FLAGS } from "#constants";
import { businessLookupHelper } from "#helpers/businessLookupHelper";
import {
	db,
	getBusinessApplicants,
	getBusinessEntityVerificationDetails,
	getFlagValue,
	getFlagValueByToken,
	logger,
	upsertBusinessOwnerApplicant
} from "#helpers/index";
import { assertTINValid, BusinessValidationError, validateBusiness } from "../validateBusiness";
import { Tracker, createTracker } from "knex-mock-client";
import { businesses } from "../businesses";
import { StatusCodes } from "http-status-codes";
import { BusinessApiError } from "../error";

const getFlagValueMock = getFlagValue as jest.Mock;
const getFlagValueByTokenMock = getFlagValueByToken as jest.Mock;

jest.mock("kafkajs");
jest.mock("#utils/index", () => {
	const originalModule = jest.requireActual("#utils/index");
	return {
		...originalModule,
		encryptEin: jest.fn().mockImplementation((ein: string) => ein),
		decryptEin: jest.fn().mockImplementation((ein: string) => ein)
	};
});

const enterpriseApplicantID = "1111-000-0000-0000-0000";
const businessID = "0000-000-0000-0000-0000";

jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id",
		ENTERPRISE_APPLICANT_ID: enterpriseApplicantID,
		LD_SDK_KEY: "mock_ld_sdk_key",
		TIN_VERIFICATION_ATTEMPTS: 10
		// Other mocked configuration properties
	},
	tokenConfig: {
		TOKEN_LIFE: "3h",
		REFRESH_TOKEN_LIFE: "30d",
		REFRESH_TOKEN_LIFE_SECONDS: 2592000, // 30*24*60*60
		FORGOT_PASSWORD_TOKEN_LIFE_SECONDS: 10 * 60, // 10 minutes
		VERIFY_EMAIL_TOKEN_LIFE_SECONDS: 10 * 60 // 10 minutes
	}
}));
jest.mock("#helpers/businessLookupHelper");
jest.mock("#helpers/index", () => {
	const originalModule = jest.requireActual("#helpers/index");

	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		...originalModule,
		businessLookupHelper: jest.fn(),
		producer: {
			send: jest.fn()
		},
		getBusinessEntityVerificationDetails: jest.fn(),
		getBusinessApplicants: jest.fn(),
		getApplicantByID: jest.fn(),
		submitBusinessEntityForReview: jest.fn(),
		upsertBusinessOwnerApplicant: jest.fn(),
		getIntegrationStatusForCustomer: jest.fn(),
		db: knex({ client: MockClient, dialect: "pg" }),
		getFlagValue: jest.fn(),
		getFlagValueByToken: jest.fn(),
		isCountryAllowedWithSetupCheck: jest.fn(() => true),
		BullQueue: jest.fn().mockImplementation(() => {
			return {};
		}),
		logger: {
			info: i => console.log(i),
			error: i => console.log(i),
			debug: i => console.debug(i),
			warn: i => console.warn(i)
		}
	};
});

describe("assertTINValid", () => {
	let tracker: Tracker;

	beforeAll(() => {
		tracker = createTracker(db);
	});

	afterEach(() => {
		jest.clearAllMocks(); // Clear mocks to reset between tests
		tracker.reset();
	});

	it("should return if TIN is valid according to task", async () => {
		tracker.on.update("data_businesses").response([1]);
		(getBusinessEntityVerificationDetails as jest.Mock).mockResolvedValueOnce({
			businessEntityVerification: {
				tin: "123456789"
			},
			reviewTasks: [
				{
					category: "tin",
					status: "success"
				}
			]
		});
		await assertTINValid(businessID);
		const updateHistory = tracker.history.update;

		expect(updateHistory).toHaveLength(1);
		expect(updateHistory[0].method).toEqual("update");
		expect(updateHistory[0].bindings).toEqual([BUSINESS_STATUS.VERIFIED, "123456789", businessID, false]);
	});

	it("should throw if TIN is invalid according to task", async () => {
		tracker.on.update("data_businesses").response([1]);
		(getBusinessEntityVerificationDetails as jest.Mock).mockResolvedValueOnce({
			businessEntityVerification: {
				tin: "123456789"
			},
			reviewTasks: [
				{
					category: "tin",
					status: "failed"
				}
			]
		});
		await expect(assertTINValid(businessID)).rejects.toThrow();
	});

	it("should throw if no tasks", async () => {
		tracker.on.update("data_businesses").response([1]);
		(getBusinessEntityVerificationDetails as jest.Mock).mockRejectedValue(new Error("Meh"));
		await expect(assertTINValid(businessID, 5, 5)).rejects.toThrow();
	});

	it("should throw if TIN not set", async () => {
		tracker.on.update("data_businesses").response([1]);
		(getBusinessEntityVerificationDetails as jest.Mock).mockResolvedValue({
			businessEntityVerification: {
				tin: null
			}
		});
		await expect(assertTINValid(businessID, 5, 5)).rejects.toThrow();
	});

	it("should wait the timeout to throw", async () => {
		const timeoutSpy = jest.spyOn(global, "setTimeout");
		tracker.on.update("data_businesses").response([1]);
		(getBusinessEntityVerificationDetails as jest.Mock).mockResolvedValue({
			businessEntityVerification: {
				tin: null
			}
		});
		const startTime = Date.now();
		// Wait 10 times for 10ms, so 10*10 = 100ms
		await expect(assertTINValid(businessID, 10, 10)).rejects.toThrow();
		const duration = Date.now() - startTime;
		expect(duration).toBeGreaterThanOrEqual(100);
		// We cannot be exactly sure how many times we wait, but we can be sure it's more than 100ms and less than 1000ms
		expect(duration).toBeLessThan(1000);
		expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10);
		expect(timeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(10);
	});
});

describe("validateBusiness", () => {
	const tin = "123456789";
	const customerID = "0000-000-0000-0000-1111";
	const newBusinessID = "0000-000-0000-0000-0000";
	let tracker: Tracker;

	beforeAll(() => {
		tracker = createTracker(db);
		// Globally mock the getFlagValue to return false for known flags -- can override in specific tests if needed
		getFlagValueMock.mockImplementation(async flag => {
			if (flag === FEATURE_FLAGS.DOS_84_LIGHTNING_VERIFICATION) {
				return false;
			} else if (flag === FEATURE_FLAGS.WIN_1223_SEND_WEBHOOK_EVENTS) {
				return false;
			} else if (flag === FEATURE_FLAGS.DOS_387_MIDDESK_FAILED_TIN_ORDERS) {
				return false;
			}
			logger.warn(`Flag ${flag} not found in getFlagValue mock -- returning false`);
			return false;
		});
	});

	beforeEach(() => {
		jest.spyOn(businesses, "getProgressionConfig").mockResolvedValue([]);
	});
	afterEach(() => {
		jest.clearAllMocks(); // Clear mocks to reset between tests
		tracker.reset();
	});

	it("should throw error if no TIN match -- failing TIN", async () => {
		const existingCustomerID = "0000-000-0000-0000-3333";
		const existingCaseId = "0000-0000-0000-0000-0000";
		const newBusiness = { id: newBusinessID, status: BUSINESS_STATUS.UNVERIFIED };
		const newApplicant: any = {
			first_name: "Dummy",
			last_name: "User",
			id: enterpriseApplicantID,
			email: "anotherEmail@joinworth.com",
			mobile: "",
			status: "ACTIVE",
			subrole_id: "0000-000-0000-0000-0000-0000",
			code: "owner"
		};

		tracker.on.select("data_cases").response([{ id: existingCaseId }]);
		tracker.on.select("data_businesses").response([{ official_website: "http://abc.com" }]);

		(getBusinessApplicants as jest.Mock).mockImplementation(async businessID => {
			if (businessID === newBusinessID) {
				return [newApplicant];
			}
			return [];
		});
		(upsertBusinessOwnerApplicant as jest.Mock).mockImplementation(async (userId, businessId) => {
			return { id: userId, business_id: businessId };
		});
		jest.spyOn(businesses, "getCustomersWithBusiness").mockResolvedValue([]);
		jest
			.spyOn(businesses, "businessCreationSideEffects")
			.mockResolvedValueOnce({ case_id: existingCaseId, business_id: newBusinessID });
		(businessLookupHelper as jest.Mock).mockImplementation(async args => {
			if (args.tin) {
				throw new Error("No business found");
			}
			return [newBusiness];
		});
		tracker.on.update("data_businesses").response([1]);
		(getBusinessEntityVerificationDetails as jest.Mock).mockResolvedValueOnce({
			businessEntityVerification: {
				tin: "123456789"
			},
			reviewTasks: [
				{
					category: "tin",
					status: "failure",
					message: "tin is no good"
				}
			]
		});
		const validatePayload = {
			id: newBusinessID,
			customer_id: existingCustomerID,
			tin,
			address_line_1: "123 Main St",
			address_postal_code: "12345",
			address_city: "Anytown",
			address_state: "NY",
			address_country: "USA",
			name: "New Business",
			official_website: "https://newbusiness.com",
			dba_names: [],
			mailing_addresses: [],
			case_type: "ONBOARDING"
		};
		try {
			await validateBusiness(newBusinessID, validatePayload, enterpriseApplicantID, { isBulk: true, userInfo: {} });
		} catch (error: any) {
			expect(error).toBeInstanceOf(BusinessValidationError);
			expect(error.status).toBe(StatusCodes.NOT_FOUND);
			expect(error.errorCode).toBe(ERROR_CODES.NOT_FOUND);
		}
	});
	it("throw error if invitation is completed", async () => {
		try {
			getFlagValueByTokenMock.mockResolvedValueOnce(false);
			tracker.on.select("data_invites").response([{ id: "00000000-0000-0000-0000-000000000000", status: 4 }]);
			await validateBusiness(
				newBusinessID,
				{
					invite_id: "00000000-0000-0000-0000-000000000000",
					id: newBusinessID,
					customer_id: customerID,
					tin,
					address_line_1: "123 Main St",
					address_postal_code: "12345",
					address_city: "Anytown",
					address_state: "NY",
					address_country: "USA",
					name: "New Business",
					official_website: "https://newbusiness.com",
					dba_names: [],
					mailing_addresses: [],
					case_type: "ONBOARDING"
				},
				enterpriseApplicantID,
				{ userInfo: {} }
			);
		} catch (error: any) {
			expect(error).toBeInstanceOf(BusinessApiError);
			expect(error.message).toBe("Invitation already completed");
		}
	});
});
