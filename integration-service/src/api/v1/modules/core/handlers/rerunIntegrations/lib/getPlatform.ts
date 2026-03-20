import { IDBConnection } from "#types/db";
import { platformFactory } from "#helpers/platformHelper";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";

export const getPlatform = async <T extends TaskManager>(dbConnection: IDBConnection): Promise<T> => {
	switch (dbConnection.platform_id) {
		/**
		 * Instances of the PlaidIDV class should not be initialized directly.
		 * Instead, the strategyPlatformFactory function should be used to initialize the platform.
		 * @see PlaidIdv.initializePlaidIdvConnectionConfiguration for more information.
		 */
		case INTEGRATION_ID.PLAID_IDV:
			const plaidIdvWithStrategy = await strategyPlatformFactory<PlaidIdv>({
				businessID: dbConnection.business_id,
				platformID: dbConnection.platform_id,
				customerID: dbConnection.configuration?.customer_id
			});
			if (!plaidIdvWithStrategy) throw new Error("Failed to initialize PlaidIDV platform");

			const plaidIdv = await plaidIdvWithStrategy.initializePlaidIdvConnectionConfiguration(
				dbConnection.configuration?.customer_id
			);
			if (!plaidIdv) throw new Error("Failed to initialize PlaidIDV platform");

			await plaidIdv.updateConnectionStatus(
				CONNECTION_STATUS.SUCCESS,
				JSON.stringify({ task: "fetch_identity_verification" })
			);

			return plaidIdv as unknown as T;
		/**
		 * @todo: Add support for Equifax here. Similar to PlaidIDV, use the strategyPlatformFactory to initialize the platform.
		 */
		case INTEGRATION_ID.EQUIFAX:
			throw new Error("Equifax is not yet supported by this function.");
		default:
			return platformFactory({ dbConnection });
	}
};
