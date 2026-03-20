import { logger } from "#helpers/index";
import { fetchEconomicsData } from "./jobs/fetch-economics-data";

const JOB_HANDLERS: Record<string, () => Promise<void>> = {
	"fetch-economics-data": fetchEconomicsData
};

const JOB_NAMES = Object.keys(JOB_HANDLERS);

async function main(): Promise<void> {
	const jobName = process.env.CRON_JOB_NAME;
	if (!jobName) {
		logger.error(
			`Cron job could not be run because CRON_JOB_NAME environment variable is not set. Valid job names: ${JOB_NAMES.join(", ")}`
		);
		process.exit(1);
	}

	const handler = JOB_HANDLERS[jobName];
	if (!handler) {
		logger.error(
			`Cron job could not be run because the job name is not valid. Valid job names: ${JOB_NAMES.join(", ")}`
		);
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
