/**
 * PlaidIdv Sandbox Strategy
 * Handles PlaidIDV Sandbox configuration
 */

import { envConfig } from "#configs/env.config";
import { PlaidIdv } from "../plaidIdv";
import { IDBConnection } from "#types/db";
import { STRATEGY_ENUM } from "#constants/integrations.constant";
import { createStrategyLogger } from "#helpers";

export class PlaidIdvSandboxStrategy extends PlaidIdv {
	constructor(dbConnection?: IDBConnection) {
		super(dbConnection, {
			clientId: envConfig.PLAID_SANDBOX_CLIENT_ID!,
			secret: envConfig.PLAID_SANDBOX_SECRET!,
			plaidEnv: envConfig.PLAID_SANDBOX_ENV || "sandbox",
			mode: STRATEGY_ENUM.SANDBOX
		});

		const strategyLogger = createStrategyLogger("IDENTITY_VERIFICATION", STRATEGY_ENUM.SANDBOX);
		strategyLogger.info("PlaidIDV initialized with sandbox strategy", {
			connection_id: this.dbConnection?.id,
			business_id: this.dbConnection?.business_id,
			customer_id: this.dbConnection?.configuration?.customer_id
		});
	}
}

export default PlaidIdvSandboxStrategy;
