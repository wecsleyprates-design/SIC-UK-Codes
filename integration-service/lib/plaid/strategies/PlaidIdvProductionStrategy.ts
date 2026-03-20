/**
 * PlaidIdv Production Strategy
 * Handles production PlaidIDV configuration
 */

import { envConfig } from "#configs/env.config";
import { PlaidIdv } from "../plaidIdv";
import { IDBConnection } from "#types/db";
import { STRATEGY_ENUM } from "#constants/integrations.constant";
import { createStrategyLogger } from "#helpers";

export class PlaidIdvProductionStrategy extends PlaidIdv {
	constructor(dbConnection?: IDBConnection) {
		super(dbConnection, {
			clientId: envConfig.PLAID_CLIENT_ID!,
			secret: envConfig.PLAID_SECRET!,
			plaidEnv: envConfig.PLAID_ENV || "production",
			mode: STRATEGY_ENUM.PRODUCTION
		});

		const strategyLogger = createStrategyLogger("IDENTITY_VERIFICATION", STRATEGY_ENUM.PRODUCTION);
		strategyLogger.info("PlaidIDV initialized with production strategy", {
			connection_id: this.dbConnection?.id,
			business_id: this.dbConnection?.business_id,
			customer_id: this.dbConnection?.configuration?.customer_id
		});
	}
}

export default PlaidIdvProductionStrategy;
