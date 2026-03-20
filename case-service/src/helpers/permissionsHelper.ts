import { ERROR_CODES, FEATURE_FLAGS, ROLES } from "#constants";
import { UserInfo } from "#types";
import { getFlagValue } from "./LaunchDarkly";
import { redis } from "./redis/redis";
import { logger } from "./logger";
import { CaseManagementApiError } from "../api/v1/modules/case-management/error";
import { StatusCodes } from "http-status-codes";
import type { UUID } from "crypto";

export const hasDataPermission = async (
	userInfo: UserInfo,
	core_permission_code: string,
	checkFeatureFlag: boolean = true
): Promise<boolean> => {
	if (checkFeatureFlag) {
		const flag = await getFlagValue(FEATURE_FLAGS.PAT_691_APPLYING_FEATURE_PERMISSION_SET);

		if (!flag) {
			return true;
		}
	}

	if (!userInfo || userInfo?.role?.code !== ROLES.CUSTOMER) {
		return true;
	}

	if (!userInfo?.subrole_id) {
		return false;
	}

	const hasPermission: boolean = await redis.sismember(
		`{subroles}:${userInfo?.subrole_id}:permissions`,
		core_permission_code
	);

	return hasPermission;
};

/**
 * Checks if the user has a CUSTOMER role.
 */
export const isCustomerRole = (userInfo: UserInfo): boolean => {
	return userInfo?.role?.code === ROLES.CUSTOMER;
};

/**
 * Checks if the customer owns the case.
 */
export const isCustomerOwner = (userInfo: UserInfo, caseCustomerId: UUID): boolean => {
	return Boolean(userInfo?.customer_id) && userInfo.customer_id === caseCustomerId;
};

/**
 * Throws an unauthorized access error for case access violations.
 */
export const throwCaseAccessError = (
	errorCode: ERROR_CODES,
	userInfo: UserInfo,
	caseId: string,
	caseCustomerId: UUID
): never => {
	logger.warn(
		`Unauthorized case access attempt: user ${userInfo.email} (customer: ${userInfo.customer_id}) attempted to access case ${caseId} belonging to customer ${caseCustomerId}`
	);
	throw new CaseManagementApiError(
		"You are not authorized to view this case",
		StatusCodes.FORBIDDEN,
		errorCode
	);
};

/**
 * Verifies if the customer has access to a given case by ID.
 * @param caseCustomerId This is the customer ID linked to the related case.
 * @param isStandaloneCase This is a flag that indicates if the params contains a customer ID.
 * @param customerID The logged in customer ID.
 * @param userInfo The logged in user information.
 * @param caseId The case ID being accessed.
 * @returns boolean if check has passed. If not it throws an error.
 */
export const verifyCaseAccessByID = (
	caseCustomerId: UUID,
	isStandaloneCase: boolean,
	customerID: string,
	userInfo: UserInfo,
	caseId: string
): boolean => {
	if (!isStandaloneCase && caseCustomerId !== customerID) {
		throwCaseAccessError(ERROR_CODES.INVALID, userInfo, caseId, caseCustomerId);
	} else if (isStandaloneCase && isCustomerRole(userInfo)) {
		if (!isCustomerOwner(userInfo, caseCustomerId)) {
			throwCaseAccessError(ERROR_CODES.UNAUTHORIZED, userInfo, caseId, caseCustomerId);
		}
	}
	return true;
};
