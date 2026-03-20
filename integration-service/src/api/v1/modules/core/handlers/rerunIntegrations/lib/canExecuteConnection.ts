import {
	CONNECTION_STATUS,
	INTEGRATION_EXECUTION_OVERRIDE as DEFAULT_INTEGRATION_EXECUTION_OVERRIDE,
	INTEGRATION_ID
} from "#constants";
import type { IntegrationPlatformId } from "#constants";
import type { ConnectionStatus } from "#constants";

const INTEGRATION_EXECUTION_OVERRIDE = {
	...DEFAULT_INTEGRATION_EXECUTION_OVERRIDE,
	/**
	 * For rerun purposes, allow execution of the PlaidIDV connection
	 * if it is still in the CREATED state. This is because the connection
	 * status is only updated to SUCCESS after the platform is retrieved.
	 * @see getPlatform (src/api/v1/modules/core/handlers/rerunIntegrations/lib/getPlatform.ts) for more information.
	 */
	[INTEGRATION_ID.PLAID_IDV]: [CONNECTION_STATUS.CREATED]
};

/**
 * Determines if a connection can be executed based on its status.
 * Checks if the connection status is SUCCESS or if there's an override
 * that allows execution for this platform.
 */
export const canExecuteConnection = (
	platformId: IntegrationPlatformId | number,
	connectionStatus: ConnectionStatus
): boolean => {
	// Check if connection status allows execution
	const overrideRun = INTEGRATION_EXECUTION_OVERRIDE[platformId]?.includes(connectionStatus) ?? false;
	return overrideRun || connectionStatus === CONNECTION_STATUS.SUCCESS;
};
