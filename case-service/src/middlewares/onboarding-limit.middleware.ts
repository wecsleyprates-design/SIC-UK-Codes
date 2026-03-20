import { FEATURE_FLAGS, ROLE_ID } from "#constants";
import { getFlagValue, isOnboardingLimitExhausted } from "#helpers";

export const validateOnboardingLimit = async (req, res, next) => {
	try {
		const validateOnboardingLimitFlag = await getFlagValue(FEATURE_FLAGS.PAT_260_MONTHLY_ONBOARDING_LIMIT);

		if (validateOnboardingLimitFlag) {
			const userInfo = res.locals.user;
			if (userInfo.role.id === ROLE_ID.CUSTOMER) {
				// Check if onboarding limit is exhausted or not
				await isOnboardingLimitExhausted(userInfo.customer_id);
			}
		}

		return next();
	} catch (error) {
		return next(error);
	}
};
