/**
 * Equifax Production Strategy
 * Handles Equifax production configuration
 */

import { envConfig } from "#configs/env.config";
import { Equifax } from "../equifax";
import { IDBConnection } from "#types/db";
import { createStrategyLogger } from "#helpers";
import { STRATEGY_ENUM } from "#constants/integrations.constant";

export class EquifaxProductionStrategy extends Equifax {
	constructor(dbConnection?: IDBConnection) {
		super(dbConnection, {
			baseUrl: envConfig.EQUIFAX_BASE_URL!,
			clientId: envConfig.EQUIFAX_CLIENT_ID!,
			secret: envConfig.EQUIFAX_CLIENT_SECRET!,
			memberNumber: envConfig.EQUIFAX_MEMBER_NUMBER!,
			securityCode: envConfig.EQUIFAX_SECURITY_CODE!,
			accessTokenKey: "equifax.access_token.production",
			mode: STRATEGY_ENUM.PRODUCTION
		});

		const strategyLogger = createStrategyLogger("EQUIFAX", STRATEGY_ENUM.PRODUCTION);
		strategyLogger.info("Equifax initialized with production strategy", {
			connection_id: this.dbConnection?.id,
			business_id: this.dbConnection?.business_id,
			customer_id: this.dbConnection?.configuration?.customer_id
		});
	}
}

export default EquifaxProductionStrategy;
