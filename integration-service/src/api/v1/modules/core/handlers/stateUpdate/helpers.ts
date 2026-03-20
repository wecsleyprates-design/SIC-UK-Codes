import type { UUID } from "crypto";
import { rerunIntegrations } from "../rerunIntegrations";
import type { StateUpdateHandler } from "./types";

// Shortcut function to rerun an integration for a given state update handler
export async function rerunIntegration(businessID: UUID | string, stateUpdateHandler: StateUpdateHandler) {
	return rerunIntegrations(
		{ businessID },
		{
			platform_codes: [stateUpdateHandler.platformCode],
			task_codes: [stateUpdateHandler.taskCode]
		}
	);
}
