import { FEATURE_FLAGS, ROLES } from "#constants";
import { Response, UserInfo } from "#types";
import { getFlagValue } from "./LaunchDarkly";
import { redis } from "./redis";

/**
 *
 * @param userInfo - The user information.
 * @param permission - The permission to check.
 * @returns True if the user has the permission, false otherwise. If the user is not a customer or does not have a subrole, returns true. If the custom roles feature is not enabled for the customer, returns true.
 */
export const checkPermission = async (
	/**
	 * TODO: Unify UserInfo and Response["locals"]["user"] types
	 */
	userInfo:
		| Partial<Pick<UserInfo, "customer_id" | "role" | "subrole_id">>
		| Partial<Pick<NonNullable<Response["locals"]["user"]>, "customer_id" | "role" | "subrole_id">>
		| undefined
		| null,
	permission: `${string}:${string}:${string}`
): Promise<boolean> => {
	/**
	 * If the user is not a customer or does not have a subrole, return true.
	 */
	if (!userInfo || userInfo?.role?.code !== ROLES.CUSTOMER || !userInfo?.subrole_id) return true;

	const isCustomRolesFeatureEnabled = await getFlagValue(FEATURE_FLAGS.PAT_779_ENABLE_CUSTOM_ROLES_FEATURE, {
		key: "customer",
		kind: "customer",
		customer_id: userInfo.customer_id as string
	});

	/**
	 * If the custom roles feature is not enabled for the customer, return true.
	 */
	if (!isCustomRolesFeatureEnabled) return true;

	/**
	 * Check if the user has the permission.
	 */
	return await redis.sismember(`{subroles}:${userInfo.subrole_id}:permissions`, permission);
};
