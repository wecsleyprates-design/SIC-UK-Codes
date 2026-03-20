import { StatusCodes } from "http-status-codes";
import { customerLimits } from "../customer-limits";
import { OnboardingApiError } from "../error";
import { onboardingServiceRepository } from "../repository";
import { ERROR_CODES } from "#constants";
import { getFlagValue } from "#helpers";

require("kafkajs");
jest.mock("kafkajs");
jest.mock("../repository");
jest.mock("#helpers/index", () => {
	const originalModule = jest.requireActual("#helpers/index");
	return {
		...originalModule,
		sqlQuery: jest.fn(),
		sqlTransaction: jest.fn(),
		getFlagValue: jest.fn(),
		logger: {
			info: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		}
	};
});

jest.mock("#configs/index", () => ({
	envConfig: {
		KAFKA_BROKERS: "mocked_brokers",
		KAFKA_SSL_ENABLED: false,
		KAFKA_CLIENT_ID: "mocked_client_id"
		//   ... other mocked configuration properties
	},
	tokenConfig: {
		TOKEN_LIFE: "3h",
		REFRESH_TOKEN_LIFE: "30d",
		REFRESH_TOKEN_LIFE_SECONDS: 2592000, // 30*24*60*60
		FORGOT_PASSWORD_TOKEN_LIFE_SECONDS: 10 * 60, // 10 minutes
		VERIFY_EMAIL_TOKEN_LIFE_SECONDS: 10 * 60 // 10 minutes
	}
}));

describe("CustomerLimits", () => {
	afterEach(() => {
		jest.resetAllMocks();
	});

	describe("addCustomerOnboardingLimit", () => {
		const customerId = "22f210e4-4455-4107-b132-97e8478546ed";
		const limit = 10;
		const userInfo = {
			user_id: "userId",
			family_name: "familyName",
			given_name: "givenName",
			email: "email@example.com",
			role: {
				id: 1,
				code: "admin"
			}
		};

		it("should add the customer onboarding limit", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(null);
			(onboardingServiceRepository.addCustomerOnboardingLimit as jest.Mock).mockReturnValueOnce({});

			await customerLimits.addCustomerOnboardingLimit({ customerID: customerId }, { limit }, userInfo);
		});

		it("should throw an error when customer already having onboarding limit", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce({});

			await expect(
				customerLimits.addCustomerOnboardingLimit({ customerID: customerId }, { limit }, userInfo)
			).rejects.toThrow(
				new OnboardingApiError("Customer onboarding limit already exists", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
			);
		});
	});

	describe("updateCustomerOnboardingLimit", () => {
		const customerId = "22f210e4-4455-4107-b132-97e8478546ed";
		const limit = 15;
		const userInfo = {
			user_id: "userId",
			family_name: "familyName",
			given_name: "givenName",
			email: "email@example.com",
			role: {
				id: 1,
				code: "admin"
			}
		};

		it("should update the customer onboarding limit", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce({
				onboarding_limit: 10
			});
			(onboardingServiceRepository.updateCustomerOnboardingLimit as jest.Mock).mockReturnValueOnce({});

			await customerLimits.updateCustomerOnboardingLimit({ customerID: customerId }, { limit }, userInfo);
		});

		it("should throw an error when customer does not have onboarding limit", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(null);

			await expect(
				customerLimits.updateCustomerOnboardingLimit({ customerID: customerId }, { limit }, userInfo)
			).rejects.toThrow(
				new OnboardingApiError("Customer onboarding limit does not exist", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID)
			);
		});
	});

	describe("getCustomerOnboardingLimitData", () => {
		const customerId = "22f210e4-4455-4107-b132-97e8478546ed";
		const customerOnboardingLimitData = {
			onboarding_limit: 10,
			current_count: 5,
			easyflow_count: 3,
			purged_businesses_count: 2
		};

		it("should return customer onboarding limit data", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(
				customerOnboardingLimitData
			);

			const response = await customerLimits.getCustomerOnboardingLimitData({ customerID: customerId });

			expect(response).toEqual(customerOnboardingLimitData);
		});

		it("should add customer onboarding limit data when not found", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(null);
			(onboardingServiceRepository.addCustomerOnboardingLimit as jest.Mock).mockReturnValueOnce(
				customerOnboardingLimitData
			);

			const response = await customerLimits.getCustomerOnboardingLimitData({ customerID: customerId });
			expect(response).toEqual(customerOnboardingLimitData);
		});
	});

	describe("addOrUpdateCustomerOnboardingLimit", () => {
		const customerId = "22f210e4-4455-4107-b132-97e8478546ed";
		const limit = 15;
		const userInfo = {
			user_id: "userId",
			family_name: "familyName",
			given_name: "givenName",
			email: "email@example.com",
			role: {
				id: 1,
				code: "admin"
			}
		};

		it("should update the customer onboarding limit if already present", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce({
				onboarding_limit: 10
			});
			(onboardingServiceRepository.updateCustomerOnboardingLimit as jest.Mock).mockReturnValueOnce({});

			await customerLimits.addOrUpdateCustomerOnboardingLimit({ customerID: customerId }, { limit }, userInfo);
		});

		it("should add the customer onboarding limit if not present", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(null);
			(onboardingServiceRepository.addCustomerOnboardingLimit as jest.Mock).mockReturnValueOnce({});

			await customerLimits.addOrUpdateCustomerOnboardingLimit({ customerID: customerId }, { limit }, userInfo);
		});
	});

	describe("isCustomerMonthlyLimitExhaused", () => {
		const customerId = "22f210e4-4455-4107-b132-97e8478546ed";
		const customerOnboardingLimitData = {
			onboarding_limit: 10,
			current_count: 5,
			easyflow_count: 3,
			purged_businesses_count: 2
		};

		it("should return false when customer limit is not exhausted", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(
				customerOnboardingLimitData
			);

			const response = await customerLimits.isCustomerMonthlyLimitExhaused(customerId);
			expect(response).toBeFalsy();
		});

		it("should return true when customer limit is exhausted", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce({
				...customerOnboardingLimitData,
				current_count: 10
			});

			const response = await customerLimits.isCustomerMonthlyLimitExhaused(customerId);
			expect(response).toBeTruthy();
		});

		it("should return false when customer onboarding limit is null", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce({
				...customerOnboardingLimitData,
				onboarding_limit: null
			});

			const response = await customerLimits.isCustomerMonthlyLimitExhaused(customerId);
			expect(response).toBeFalsy();
		});
	});

	describe("willExceedMonthlyOnboardingLimit", () => {
		const customerId = "22f210e4-4455-4107-b132-97e8478546ed";
		const newOnboardingsCount = 1;

		const customerOnboardingLimitData = {
			onboarding_limit: 10,
			current_count: 5,
			easyflow_count: 3,
			purged_businesses_count: 2
		};

		it("should return false when customer limit will not exceed with new onboarding count", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(
				customerOnboardingLimitData
			);

			const response = await customerLimits.willExceedMonthlyOnboardingLimit(customerId, newOnboardingsCount);
			expect(response).toBeFalsy();
		});

		it("should return true when customer limit will exceed with new onboarding count", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce({
				...customerOnboardingLimitData,
				current_count: 10
			});

			const response = await customerLimits.willExceedMonthlyOnboardingLimit(customerId, newOnboardingsCount);
			expect(response).toBeTruthy();
		});

		it("should return false when customer onboarding limit is null", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce({
				...customerOnboardingLimitData,
				onboarding_limit: null
			});

			const response = await customerLimits.willExceedMonthlyOnboardingLimit(customerId, newOnboardingsCount);
			expect(response).toBeFalsy();
		});
	});

	describe("addBusinessCount", () => {
		const customerId = "22f210e4-4455-4107-b132-97e8478546ed";
		const businessId = "22f210e4-4455-4107-b132-97e8478546ee";
		const customerOnboardingLimitData = {
			onboarding_limit: 10,
			current_count: 5,
			easyflow_count: 3,
			purged_businesses_count: 2
		};

		it("should increment the customer's onboarding count", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(
				customerOnboardingLimitData
			);
			(getFlagValue as jest.Mock).mockReturnValueOnce(false);
			(onboardingServiceRepository.updateCurrentBusinessOnboardingCount as jest.Mock).mockReturnValueOnce({});

			await customerLimits.addBusinessCount(customerId, businessId);
		});

		it("should increment the customer's easyflow onboarding count", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(
				customerOnboardingLimitData
			);
			(getFlagValue as jest.Mock).mockReturnValueOnce(true);
			(onboardingServiceRepository.updateEasyFlowOnboardingCount as jest.Mock).mockReturnValueOnce({});

			await customerLimits.addBusinessCount(customerId, businessId, {
				key: "user_id",
				name: `John Smith`,
				email: "abc@xyz.com"
			});
		});

		it("should create a customer onboarding limit with null value when no data found", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(null);
			(onboardingServiceRepository.addCustomerOnboardingLimit as jest.Mock).mockReturnValueOnce(
				customerOnboardingLimitData
			);

			await customerLimits.addBusinessCount(customerId, businessId);
		});
	});

	describe("checkAndIncreasePurgeCount", () => {
		const customerId = "22f210e4-4455-4107-b132-97e8478546ed";
		const businessId = "22f210e4-4455-4107-b132-97e8478546ee";
		const customerOnboardingLimitData = {
			onboarding_limit: 10,
			current_count: 5,
			easyflow_count: 3,
			purged_businesses_count: 2,
			onboarded_businesses: [businessId]
		};

		it("should increase purged businesses count and decrease current businesses count when purging this month business", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce(
				customerOnboardingLimitData
			);
			(
				onboardingServiceRepository.updatePurgedBusinessesCountAndDecreaseCurrentBusinessesCount as jest.Mock
			).mockReturnValueOnce({});

			await customerLimits.checkAndIncreasePurgeCount(customerId, businessId);
		});

		it("should return when the purge business is not onboarded this month", async () => {
			(onboardingServiceRepository.getCustomerOnboardingLimitData as jest.Mock).mockReturnValueOnce({
				...customerOnboardingLimitData,
				onboarded_businesses: ["some-other-business-id"]
			});
			(
				onboardingServiceRepository.updatePurgedBusinessesCountAndDecreaseCurrentBusinessesCount as jest.Mock
			).mockReturnValueOnce({});

			await customerLimits.checkAndIncreasePurgeCount(customerId, businessId);
		});
	});
});
