/**
 * KYX Production Strategy Implementation
 * Handles live API calls to KYX production environment
 */

import { envConfig } from "#configs/index";
import { KyxBaseStrategy } from "./KyxBaseStrategy";
import type { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";

export class KyxProductionStrategy extends KyxBaseStrategy {
	constructor() {
		super({
			baseUrl: envConfig.KYX_BASE_URL || "",
			tenantName: envConfig.KYX_TENANT_NAME || "",
			clientId: envConfig.KYX_CLIENT_ID || "",
			clientSecret: envConfig.KYX_CLIENT_SECRET || ""
		});
	}

	getMode(): IntegrationMode {
		return "PRODUCTION";
	}
}
