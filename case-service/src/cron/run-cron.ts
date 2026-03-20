/**
 * Entrypoint for running cron jobs
 */
import { logger } from "#helpers";
import { applicantReminder } from "./jobs/application-reminder";
import { refreshSubscriptionScores } from "./jobs/business-score-refresh";
import { updateCaseStatus } from "./jobs/case-status-update";
import { monthlyOnboardingLimitReset } from "./jobs/monthly-onboarding-limit-reset";
import { riskMonitoringDueRefresh } from "./jobs/risk-monitoring-due-refresh";

const JOB_HANDLERS: Record<string, () => Promise<void>> = {
	"applicant-reminder": applicantReminder,
	"business-score-refresh": refreshSubscriptionScores,
	"case-status-update": updateCaseStatus,
	"monthly-onboarding-limit-reset": monthlyOnboardingLimitReset,
	"risk-monitoring-due-refresh": riskMonitoringDueRefresh
};

const JOB_NAMES = Object.keys(JOB_HANDLERS);

async function main(): Promise<void> {
	// Kubernetes CronJobs set CRON_JOB_NAME environment variable
	const jobName = process.env.CRON_JOB_NAME;
	if (!jobName) {
		logger.error(`Cron job could not be run because CRON_JOB_NAME environment variable is not set. Valid job names: ${JOB_NAMES.join(", ")}`);
		process.exit(1);
	}

	const handler = JOB_HANDLERS[jobName];
	if (!handler) {
		logger.error(`Cron job could not be run because the job name is not valid. Valid job names: ${JOB_NAMES.join(", ")}`);
		process.exit(1);
	}

	try {
		logger.info(`Running cron job: ${jobName}`);
		await handler();
		logger.info(`Cron job completed: ${jobName}`);
		process.exit(0);
	} catch (error) {
		logger.error(error, `Cron job failed: ${jobName}`);
		process.exit(1);
	}
}

main();
