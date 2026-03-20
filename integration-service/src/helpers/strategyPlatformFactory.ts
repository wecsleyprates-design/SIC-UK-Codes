import { IDBConnection } from "#types/db";
import { UUID } from "crypto";
import { INTEGRATION_ID, IntegrationPlatformId, Strategy, STRATEGY_ENUM } from "#constants/integrations.constant";
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { getOrCreateConnection, updateConnectionByConnectionId, createStrategyLogger } from "#helpers";

// Platforms currently supported by the strategy pattern
const platformMap: Partial<Record<IntegrationPlatformId, Record<Strategy /*strategy*/, string /* classPath */>>> = {
	[INTEGRATION_ID.EQUIFAX]: {
		PRODUCTION: "../../lib/equifax/strategies/EquifaxProductionStrategy",
		SANDBOX: "../../lib/equifax/strategies/EquifaxSandboxStrategy"
	},
	[INTEGRATION_ID.PLAID_IDV]: {
		PRODUCTION: "../../lib/plaid/strategies/PlaidIdvProductionStrategy",
		SANDBOX: "../../lib/plaid/strategies/PlaidIdvSandboxStrategy"
	}
};

export const getIntegrationStrategiesForCustomer = async (customerID: UUID) => {
	const customerIntegrationsSettings = await customerIntegrationSettings.findById(customerID);
	const settings = customerIntegrationsSettings?.settings;

	// add mapping for other integrations when migrating additional platforms to this strategy pattern
	const integrationStrategyMap: Partial<Record<IntegrationPlatformId, Strategy>> = {
		[INTEGRATION_ID.EQUIFAX]: (settings?.["equifax"]?.mode as Strategy) || STRATEGY_ENUM.PRODUCTION,
		[INTEGRATION_ID.PLAID_IDV]: (settings?.["identity_verification"]?.mode as Strategy) || STRATEGY_ENUM.PRODUCTION
	};
	return integrationStrategyMap;
};

// dbConnection can be provided directly and strategy mode will be used from the connection if available
// alternatively, businessID and platformID can be provided to look up the connection
// customerID should be provided when available to set the proper strategy mode if not already set in the connection
// platform defaults to production strategy as the fallback
export const strategyPlatformFactory = async <T>({
	dbConnection,
	businessID,
	platformID,
	customerID
}: {
	dbConnection?: IDBConnection;
	businessID?: UUID;
	platformID?: IntegrationPlatformId;
	customerID?: UUID;
}): Promise<T> => {
	let connection: IDBConnection | undefined = dbConnection;

	// if no connection provided, fetch using businessID and platformID
	if (!connection && businessID && platformID) {
		connection = await getOrCreateConnection(businessID, platformID);
	}

	if (!connection) {
		throw new Error("No connection provided or created");
	}

	const integrationPlatformId = platformID || (connection?.platform_id as IntegrationPlatformId);

	const platformStrategies = platformMap[integrationPlatformId];

	// throw error if strategy pattern is not implemented for the platform
	if (!platformStrategies) {
		throw new Error(`No platform strategies found for platform ${integrationPlatformId}`);
	}

	let strategy: Strategy | undefined = connection?.strategy;

	// if strategy not provided from connection, fetch from customer settings and update connection
	if (!strategy && customerID) {
		const integrationStrategies = await getIntegrationStrategiesForCustomer(customerID);
		strategy = integrationStrategies[integrationPlatformId];
		await updateConnectionByConnectionId(connection.id, connection.connection_status, undefined, strategy);
	}

	// if no strategy found, default to production mode
	if (!strategy) {
		const platformName =
			Object.keys(INTEGRATION_ID).find(key => INTEGRATION_ID[key] === integrationPlatformId) ??
			`PLATFORM_${integrationPlatformId}`;
		const strategyLogger = createStrategyLogger(platformName, STRATEGY_ENUM.PRODUCTION);
		strategyLogger.debug("No strategy found, defaulting to production mode", {
			business_id: businessID ?? connection?.business_id,
			customer_id: customerID
		});
		strategy = STRATEGY_ENUM.PRODUCTION;
	}

	const classPath = platformStrategies[strategy];
	if (!classPath) {
		throw new Error(`No strategy class path found for strategy ${strategy} on platform ${integrationPlatformId}`);
	}

	const { default: platformClass } = await import(classPath);
	if (!platformClass) {
		throw new Error(`Error importing platform class for strategy ${strategy} on platform ${integrationPlatformId}`);
	}

	return new platformClass(connection);
};
