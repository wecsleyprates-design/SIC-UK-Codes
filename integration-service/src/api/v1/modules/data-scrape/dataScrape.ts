import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import { getOrCreateConnection, logger } from "#helpers";
import { SerpGoogleProfile, SerpSearchGoogleProfileMatchResult } from "#lib/serp";
import { SerpGoogleProfileTaskResponse } from "#lib/serp/types/SerpGoogleProfileTaskResponse";
import { UUID } from "crypto";

export const searchGoogleProfileMatchResult = async (businessID: UUID): Promise<UUID | null> => {
	const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.SERP_GOOGLE_PROFILE);
	const taskManager = new SerpGoogleProfile(dbConnection);

	const taskId = await taskManager.getOrCreateTaskForCode({
		taskCode: "fetch_google_profile"
	});

	if (!taskId) return null;

	const success = await taskManager.fetchGoogleProfile(taskId);

	return success ? taskId : null;
};

export const getGoogleProfileMatchResult = async (
	businessID: UUID
): Promise<SerpSearchGoogleProfileMatchResult | null> => {
	const dbConnection = await getOrCreateConnection(businessID, INTEGRATION_ID.SERP_GOOGLE_PROFILE);
	const taskManager = new SerpGoogleProfile(dbConnection);

	let taskId: UUID | null = null;

	// Get the most recent Google profile task
	const latestTask = await taskManager.getLatestTask(
		businessID,
		INTEGRATION_ID.SERP_GOOGLE_PROFILE,
		"fetch_google_profile"
		// TODO: Comment this back in once this task is properly being triggered when a business is created or updated.
		// true // successful tasks only
	);

	/**
	 * TODO: Refactor this once this task is properly being triggered when a business is created or updated.
	 * 		 The current code is an anti-pattern and should be changed.
	 * 		 In the future, this function should just return null if no successful task is found.
	 *
	 * @see https://worthcrew.slack.com/archives/C09773A8XFV/p1759932712008189
	 */
	if (latestTask?.task_status === TASK_STATUS.SUCCESS) {
		logger.info(`Existing fetch_google_profile task found for business ${businessID}. Using existing task.`);
		taskId = latestTask.id;
	} else if (!latestTask) {
		logger.info(`No fetch_google_profile task found for business ${businessID}. Creating new task.`);
		taskId = await searchGoogleProfileMatchResult(businessID);
	}

	if (!taskId) return null;

	// Get the request response data
	const requestResponse = await taskManager.getRequestResponseByTaskId<SerpGoogleProfileTaskResponse>(taskId);

	return requestResponse?.response?.google_profile_match_result ?? null;
};
