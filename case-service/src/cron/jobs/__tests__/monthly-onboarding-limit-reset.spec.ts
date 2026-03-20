import { onboardingServiceRepository } from "../../../api/v1/modules/onboarding/repository";
import { logger } from "#helpers/index"; // ✅ so we can check error logging

require("kafkajs");
jest.mock("kafkajs");

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
	},
	tokenConfig: {
		TOKEN_LIFE: "3h",
		REFRESH_TOKEN_LIFE: "30d",
		REFRESH_TOKEN_LIFE_SECONDS: 2592000,
		FORGOT_PASSWORD_TOKEN_LIFE_SECONDS: 10 * 60,
		VERIFY_EMAIL_TOKEN_LIFE_SECONDS: 10 * 60
	}
}));

jest.mock("../../../api/v1/modules/onboarding/repository", () => ({
	onboardingServiceRepository: {
		getAllOnboardingLimitData: jest.fn(),
		insertHistoryDataAndResetLimitData: jest.fn()
	}
}));

describe("monthlyOnboardingLimitResetJob", () => {
	let monthlyOnboardingLimitReset: () => Promise<void>; // ✅ type-safe

	beforeAll(() => {
		// Import after mocks are set up
		const module = require("../monthly-onboarding-limit-reset");
		monthlyOnboardingLimitReset = module.monthlyOnboardingLimitReset;
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should call monthlyOnboardingLimitReset and reset limit data", async () => {
		const mockOnboardingData = [
			{ customer_id: 1, onboarding_limit: 100, current_count: 10, easyflow_count: 5, purged_businesses_count: 2 },
			{ customer_id: 2, onboarding_limit: 200, current_count: 20, easyflow_count: 15, purged_businesses_count: 4 }
		];

		(onboardingServiceRepository.getAllOnboardingLimitData as jest.Mock).mockResolvedValueOnce(mockOnboardingData);
		(onboardingServiceRepository.insertHistoryDataAndResetLimitData as jest.Mock).mockResolvedValueOnce(true);

		await monthlyOnboardingLimitReset();

		expect(onboardingServiceRepository.getAllOnboardingLimitData).toHaveBeenCalled();
		expect(onboardingServiceRepository.insertHistoryDataAndResetLimitData).toHaveBeenCalledWith([
			{
				customer_id: 1,
				onboarding_limit: 100,
				used_count: 10,
				easyflow_count: 5,
				purged_businesses_count: 2,
				total_count: 17,
				created_at: expect.any(String)
			},
			{
				customer_id: 2,
				onboarding_limit: 200,
				used_count: 20,
				easyflow_count: 15,
				purged_businesses_count: 4,
				total_count: 39,
				created_at: expect.any(String)
			}
		]);
	});

	it("should log an error if something goes wrong in the monthlyOnboardingLimitReset function", async () => {
		const mockError = new Error("Database error");
		(onboardingServiceRepository.getAllOnboardingLimitData as jest.Mock).mockRejectedValue(mockError);

		await monthlyOnboardingLimitReset();

		// ✅ safe additional assertion
		expect(logger.error).toHaveBeenCalled();
	});
});
