/**
 * KYX Sandbox Strategy Implementation
 * Handles API calls to KYX sandbox environment for testing
 */

import { envConfig } from "#configs/index";
import { KyxBaseStrategy } from "./KyxBaseStrategy";
import type { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";

export class KyxSandboxStrategy extends KyxBaseStrategy {
	constructor() {
		super({
			baseUrl: envConfig.KYX_SANDBOX_BASE_URL || envConfig.KYX_BASE_URL || "",
			tenantName: envConfig.KYX_SANDBOX_TENANT_NAME || envConfig.KYX_TENANT_NAME || "",
			clientId: envConfig.KYX_SANDBOX_CLIENT_ID || envConfig.KYX_CLIENT_ID || "",
			clientSecret: envConfig.KYX_SANDBOX_CLIENT_SECRET || envConfig.KYX_CLIENT_SECRET || ""
		});
	}

	getMode(): IntegrationMode {
		return "SANDBOX";
	}
}
