import { ERROR_CODES, FEATURE_FLAGS } from "#constants";
import { getFlagValue, logger } from "#helpers";
import { UserInfo } from "#types";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { OnboardingApiError } from "./error";
import { onboardingServiceRepository } from "./repository";
import { DataCustomerOnboardingLimits } from "./types";

class CustomerLimits {
	async addCustomerOnboardingLimit(params: { customerID: UUID }, body: { limit: number }, userInfo: UserInfo) {
		// fetch onboarding limit for the customer
		const customerOnboardingLimitData = await onboardingServiceRepository.getCustomerOnboardingLimitData(params.customerID);

		if (customerOnboardingLimitData) {
			// throw error if onboarding limit already exists for the customer
			throw new OnboardingApiError("Customer onboarding limit already exists", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		await onboardingServiceRepository.addCustomerOnboardingLimit(params.customerID, body.limit, userInfo.user_id);
	}

	async updateCustomerOnboardingLimit(params: { customerID: UUID }, body: { limit: number | null }, userInfo: UserInfo) {
		// fetch onboarding limit for the customer
		const customerOnboardingLimitData = await onboardingServiceRepository.getCustomerOnboardingLimitData(params.customerID);

		if (!customerOnboardingLimitData) {
			// throw error if onboarding limit does not exist for the customer
			throw new OnboardingApiError("Customer onboarding limit does not exist", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}

		await onboardingServiceRepository.updateCustomerOnboardingLimit(params.customerID, body.limit, userInfo.user_id);
	}

	async getCustomerOnboardingLimitData(params: { customerID: UUID }): Promise<DataCustomerOnboardingLimits> {
		let customerOnboardingLimitData = await onboardingServiceRepository.getCustomerOnboardingLimitData(params.customerID);

		if (!customerOnboardingLimitData) {
			customerOnboardingLimitData = await onboardingServiceRepository.addCustomerOnboardingLimit(params.customerID, null);
		}

		return customerOnboardingLimitData;
	}

	async addOrUpdateCustomerOnboardingLimit(params: { customerID: UUID }, body: { limit: number | null }, userInfo: UserInfo): Promise<void> {
		const customerOnboardingLimitData = await onboardingServiceRepository.getCustomerOnboardingLimitData(params.customerID);

		if (customerOnboardingLimitData) {
			await onboardingServiceRepository.updateCustomerOnboardingLimit(params.customerID, body.limit, userInfo.user_id);
			return;
		}

		await onboardingServiceRepository.addCustomerOnboardingLimit(params.customerID, body.limit, userInfo.user_id);
	}

	async isCustomerMonthlyLimitExhaused(customerId: UUID): Promise<boolean> {
		const customerOnboardingLimitData = await this.getCustomerOnboardingLimitData({ customerID: customerId });

		// if limit is null return false
		if (customerOnboardingLimitData?.onboarding_limit === null) {
			return false;
		}

		// if limit is present check if current count is greater than or equal to limit
		return customerOnboardingLimitData.current_count >= customerOnboardingLimitData.onboarding_limit;
	}

	async willExceedMonthlyOnboardingLimit(customerId: UUID, newOnboardingsCount: number): Promise<boolean> {
		const customerOnboardingLimitData = await this.getCustomerOnboardingLimitData({ customerID: customerId });

		// if limit is null return false
		if (customerOnboardingLimitData?.onboarding_limit === null) {
			return false;
		}

		// if limit is present check if current count + new onboardings count is greater than limit
		return customerOnboardingLimitData.current_count + newOnboardingsCount > customerOnboardingLimitData.onboarding_limit;
	}

	async addBusinessCount(customerId: UUID, businessId: UUID, user?: { key: string; name: string; email: string }): Promise<void> {
		let customerOnboardingLimitData = await onboardingServiceRepository.getCustomerOnboardingLimitData(customerId);

		// if no data is present, create a new one with null as limit
		if (!customerOnboardingLimitData) {
			customerOnboardingLimitData = await onboardingServiceRepository.addCustomerOnboardingLimit(customerId, null);
		}

		const isEasyFlow = (user && (await getFlagValue(FEATURE_FLAGS.WIN_1152_EASY_ONBOARDING_FLOW, user))) ?? false;

		// if easy flow is enabled then update easy flow count
		if (isEasyFlow) {
			await onboardingServiceRepository.updateEasyFlowOnboardingCount(customerId, businessId, customerOnboardingLimitData.easyflow_count + 1);
			return;
		}

		// otherwise update the normal onboarding count
		await onboardingServiceRepository.updateCurrentBusinessOnboardingCount(customerId, businessId, customerOnboardingLimitData.current_count + 1);
	}

	async checkAndIncreasePurgeCount(customerId: UUID, businessId: UUID): Promise<void> {
		const customerOnboardingLimitData = await this.getCustomerOnboardingLimitData({ customerID: customerId });

		const result = customerOnboardingLimitData.onboarded_businesses.find(business => business === businessId);

		if (result === undefined) {
			logger.debug(`Business ${businessId} was onboarded by ${customerId} prior to this month`);
			return;
		}

		await onboardingServiceRepository.updatePurgedBusinessesCountAndDecreaseCurrentBusinessesCount(customerId, businessId, customerOnboardingLimitData.purged_businesses_count + 1, customerOnboardingLimitData.current_count - 1);
	}
}

export const customerLimits = new CustomerLimits();
