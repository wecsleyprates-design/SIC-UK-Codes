/**
 * GIACT Sandbox Strategy Implementation
 * Handles API calls to GIACT sandbox environment for testing
 */

import { envConfig } from "#configs/index";
import { GiactBaseStrategy } from "./GiactBaseStrategy";
import type { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";

export class GiactSandboxStrategy extends GiactBaseStrategy {
	constructor() {
		super(
			envConfig.GIACT_SANDBOX_API_ENDPOINT || "",
			envConfig.GIACT_SANDBOX_API_USERNAME || "",
			envConfig.GIACT_SANDBOX_API_PASSWORD || ""
		);
	}

	getMode(): IntegrationMode {
		return "SANDBOX";
	}
}
