import type { IBusinessIntegrationTaskEnriched } from "#types/db";
import type { UUID } from "crypto";
import { createAbortErrorMessage } from "../util";

export class SerpGoogleProfileMissingDataError extends Error {
	constructor(task: IBusinessIntegrationTaskEnriched<unknown>, businessID: UUID, missingData: string) {
		const message = createAbortErrorMessage(task, businessID, `${missingData} was not found`);
		super(message);
		this.name = "SerpGoogleProfileMissingDataError";
	}
}
