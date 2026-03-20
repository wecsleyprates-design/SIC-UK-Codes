import { canAddBusinesses, isOnboardingLimitExhausted } from "../onboardingLimitHelper";
import { customerLimits } from "../../api/v1/modules/onboarding/customer-limits";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";

jest.mock("../../api/v1/modules/onboarding/customer-limits", () => {
	return {
		customerLimits: {
			willExceedMonthlyOnboardingLimit: jest.fn(),
			isCustomerMonthlyLimitExhaused: jest.fn()
		}
	};
});

describe("canAddBusinesses", () => {
	const customerId = "22f210e4-4455-4107-b132-97e8478546ed";
	const newOnboardingsCount = 10;

	it("should return when the customer onboarding limit will not be reached", async () => {
		(customerLimits.willExceedMonthlyOnboardingLimit as jest.Mock).mockReturnValueOnce(false);
		const result = await canAddBusinesses(customerId, newOnboardingsCount);
		expect(result).toBe(undefined);
	});

	it("should throw an error when the customer onboarding limit will be exceed", async () => {
		(customerLimits.willExceedMonthlyOnboardingLimit as jest.Mock).mockReturnValueOnce(true);
		await expect(canAddBusinesses(customerId, newOnboardingsCount)).rejects.toThrow(
			expect.objectContaining({
				message: "Onboarding limit will be reached, check remaining limit count.",
				status: StatusCodes.BAD_REQUEST,
				errorCode: ERROR_CODES.INVALID
			})
		);
	});
});

describe("isOnboardingLimitExhausted", () => {
	const customerId = "22f210e4-4455-4107-b132-97e8478546ed";

	it("should throw error when the customer onboarding limit will be exceed", async () => {
		(customerLimits.isCustomerMonthlyLimitExhaused as jest.Mock).mockReturnValueOnce(true);
		await expect(isOnboardingLimitExhausted(customerId)).rejects.toThrow(
			expect.objectContaining({
				message: "Monthly onboarding limit exhausted.",
				status: StatusCodes.FORBIDDEN,
				errorCode: ERROR_CODES.NOT_ALLOWED
			})
		);
	});

	it("should return when the customer onboarding limit will not be reached", async () => {
		(customerLimits.isCustomerMonthlyLimitExhaused as jest.Mock).mockReturnValueOnce(false);
		const result = await isOnboardingLimitExhausted(customerId);
		expect(result).toBe(undefined);
	});
});
