import type { IBusinessIntegrationTaskEnriched } from "#types/db";
import type { UUID } from "crypto";

export const createAbortErrorMessage = (
	task: IBusinessIntegrationTaskEnriched<unknown>,
	businessID: UUID,
	reasonForAborting: string
) => {
	return `Aborting task ${task.id} with code ${task.task_code} for business ${businessID} because ${reasonForAborting}`;
};
