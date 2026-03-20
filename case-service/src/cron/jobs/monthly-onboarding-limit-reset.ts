import { logger } from "#helpers";
import { onboardingServiceRepository } from "../../api/v1/modules/onboarding/repository";

export const monthlyOnboardingLimitReset = async () => {
	try {
		logger.info("=============== Executing Cron Job to Reset Monthly Onboarding Data ===============");

		const onboardingLimitData = await onboardingServiceRepository.getAllOnboardingLimitData();

		logger.info(`Executing Cron Job to Reset Monthly Onboarding Data for ${onboardingLimitData.length} customers.`);

		const values: any[] = [];

		onboardingLimitData.forEach(data => {
			values.push({
				customer_id: data.customer_id,
				onboarding_limit: data.onboarding_limit,
				used_count: data.current_count,
				easyflow_count: data.easyflow_count,
				purged_businesses_count: data.purged_businesses_count,
				total_count: data.current_count + data.easyflow_count + data.purged_businesses_count,
				created_at: new Date().toISOString(),
				onboarded_businesses: data.onboarded_businesses
			});
		});

		await onboardingServiceRepository.insertHistoryDataAndResetLimitData(values);

		logger.info(
			"=============== Cron Job to Reset Monthly Onboarding Data has been executed successfully. ==============="
		);
	} catch (error: any) {
		logger.error(JSON.stringify(error));
		logger.error({ error }, "Error in Resetting Monthly Onboarding Data monthlyOnboardingLimitReset");
	}
};
