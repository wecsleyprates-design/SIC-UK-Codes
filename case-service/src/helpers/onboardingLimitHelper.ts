import { ERROR_CODES } from "#constants";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { customerLimits } from "../api/v1/modules/onboarding/customer-limits";

class OnboardingLimitError extends Error {
	status: number;
	errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "OnboardingLimitError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

export const canAddBusinesses = async (customerId: UUID, newOnboardingsCount: number) => {
	// Logic to check if onboarding limit will reach for the given customer
	// Return true if limit will be reached, false otherwise
	const willLimitExceed = await customerLimits.willExceedMonthlyOnboardingLimit(customerId, newOnboardingsCount);

	if (willLimitExceed) {
		throw new OnboardingLimitError("Onboarding limit will be reached, check remaining limit count.", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
	}
};

export const isOnboardingLimitExhausted = async (customerId: UUID) => {
	const isExhausted = await customerLimits.isCustomerMonthlyLimitExhaused(customerId);
	if (isExhausted) {
		throw new OnboardingLimitError("Monthly onboarding limit exhausted.", StatusCodes.FORBIDDEN, ERROR_CODES.NOT_ALLOWED);
	}
};
