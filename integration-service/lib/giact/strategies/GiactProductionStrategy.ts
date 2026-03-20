/**
 * GIACT Production Strategy Implementation
 * Handles live API calls to GIACT production environment
 */

import { envConfig } from "#configs/index";
import { GiactBaseStrategy } from "./GiactBaseStrategy";
import type { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";

export class GiactProductionStrategy extends GiactBaseStrategy {
	constructor() {
		super(envConfig.GIACT_API_ENDPOINT || "", envConfig.GIACT_API_USERNAME || "", envConfig.GIACT_API_PASSWORD || "");
	}

	getMode(): IntegrationMode {
		return "PRODUCTION";
	}
}
