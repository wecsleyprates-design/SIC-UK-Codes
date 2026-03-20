/**
 * Equifax Sandbox Strategy
 * Handles Equifax sandbox configuration
 */

import { envConfig } from "#configs/env.config";
import { createStrategyLogger } from "#helpers";
import { IDBConnection } from "#types/db";
import { Equifax } from "../equifax";
import { STRATEGY_ENUM } from "#constants/integrations.constant";

export class EquifaxSandboxStrategy extends Equifax {
	constructor(dbConnection?: IDBConnection) {
		super(dbConnection, {
			baseUrl: envConfig.EQUIFAX_SANDBOX_BASE_URL!,
			clientId: envConfig.EQUIFAX_SANDBOX_CLIENT_ID!,
			secret: envConfig.EQUIFAX_SANDBOX_CLIENT_SECRET!,
			memberNumber: envConfig.EQUIFAX_SANDBOX_MEMBER_NUMBER!,
			securityCode: envConfig.EQUIFAX_SANDBOX_SECURITY_CODE!,
			accessTokenKey: "equifax.access_token.sandbox",
			mode: STRATEGY_ENUM.SANDBOX
		});

		const strategyLogger = createStrategyLogger("EQUIFAX", STRATEGY_ENUM.SANDBOX);
		strategyLogger.info("Equifax initialized with sandbox strategy", {
			connection_id: this.dbConnection?.id,
			business_id: this.dbConnection?.business_id,
			customer_id: this.dbConnection?.configuration?.customer_id
		});
	}
}

export default EquifaxSandboxStrategy;
