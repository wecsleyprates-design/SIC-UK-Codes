import { READY_STATE } from "#api/v1/modules/tasks/deferrableTaskManager";
import { logger } from "#helpers/logger";
import { getOrCreateConnection, platformFactory } from "#helpers/platformHelper";
import { INTEGRATION_ID } from "#constants";
import type { DeferrableTaskManager } from "#api/v1/modules/tasks/deferrableTaskManager";
import type { Job } from "bull";

/**
 * Generic sandboxed worker for deferrable task managers.
 *
 * This worker can handle any deferrable task manager by using the platform_id
 * from the job data to determine which specific platform to instantiate.
 *
 * If you need custom logic, you can create a custom sandboxed worker for that a platform.
 */
module.exports = async function (job: Job) {
	let message: string | null = null;
	const { platform_id: platformID, business_id: businessID } = job.data;

	// Get the platform name for logging (fallback to platform_id if name not available)
	const platformName = getPlatformDisplayName(platformID);

	logger.info(`${platformName} Worker: Processing ${job.name} :: ${job.id} :: ${JSON.stringify(job.data)}`);

	const dbConnection = await getOrCreateConnection(businessID, platformID);
	const platform = platformFactory<DeferrableTaskManager>({ dbConnection });

	try {
		const jobProgress = job.progress();
		if (jobProgress === platform.getFailJobProgress()) {
			await job.discard();
			await platform.getJobStatus(job);
			return Promise.reject();
		} else if (jobProgress >= platform.getSuccessJobProgress()) {
			await platform.getJobStatus(job);
			return Promise.resolve(message);
		}
		const [readyState, evaluateMessage] = await platform.evaluateJob(job);
		message = evaluateMessage;
		if (readyState === READY_STATE.DEFER) {
			await platform.getJobStatus(job);
			const deferError = new Error(message ?? "Task Deferred");
			deferError.name = "DeferredTask";
			return Promise.reject(deferError);
		} else if (readyState === READY_STATE.FAIL) {
			await platform.getJobStatus(job);
			return Promise.reject(new Error(message ?? "Task Failed"));
		}
	} catch (error) {
		logger.error(
			`❌ ${platformName} Worker: Error executing deferrable task ${job.data.task_id} :: ${JSON.stringify(job.data)} - Discarding job`
		);
		logger.error(error);
		try {
			await platform.discardJob(job, (error as Error).message ?? "Task Failed");
		} catch (error) {
			logger.error(error, `Error discarding job ${job.id} for queue ${platform.getBullQueue().queue.name}`);
		}
		await platform.getJobStatus(job);
		return Promise.reject(error);
	}

	await platform.getJobStatus(job);
	return Promise.resolve(message);
};

function getPlatformDisplayName(platformID: number): string {
	for (const [name, id] of Object.entries(INTEGRATION_ID)) {
		if (id === platformID) {
			// Convert constant name to display name (e.g., "WORTH_WEBSITE_SCANNING" -> "Website Scanning")
			return name
				.replace(/_/g, " ")
				.replace(/\b\w/g, l => l.toUpperCase())
				.replace(/\bAI\b/g, "AI")
				.replace(/\bID\b/g, "ID")
				.replace(/\bAPI\b/g, "API");
		}
	}
	return `Platform ${platformID}`;
}
