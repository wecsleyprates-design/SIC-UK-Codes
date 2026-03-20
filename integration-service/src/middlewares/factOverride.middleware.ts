import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES, FEATURE_FLAGS, ROLES } from "#constants/index";
import { getFlagValue, logger, redis } from "#helpers";
import { UserInfo } from "#types";

/**
 * Custom error class for fact override permission failures
 */
class FactOverridePermissionError extends Error {
	status: number;
	errorCode: string;

	constructor(message: string, httpStatus: number, errorCode: string) {
		super(message);
		this.name = "FactOverridePermissionError";
		this.status = httpStatus;
		this.errorCode = errorCode;
	}
}

/**
 * Additional role codes that are allowed for fact overrides
 */
const ALLOWED_ROLE_CODES = ["admin", "risk_analyst"] as const;

/**
 * Permission code that grants fact override access
 */
const EDIT_APPLICATION_PERMISSION = "case:edit:application";

/**
 * Middleware to verify fact override permissions before executing save logic.
 *
 * This middleware enforces the following rules:
 * 1. The PAT_874_CM_APP_EDITING feature flag must be enabled
 * 2. The user must have one of the following:
 *    - Role: Admin
 *    - Role: Risk Analyst
 *    - Permission: Edit Application (case:edit:application)
 *
 * If unauthorized, returns a 403 Forbidden response.
 *
 * @example
 * ```typescript
 * // Usage in routes
 * import { validateFactOverridePermission } from '#middlewares/factOverride.middleware';
 *
 * router.patch(
 *   '/businesses/:businessId/fields/:fieldKey',
 *   authMiddleware,
 *   validateFactOverridePermission,
 *   caseController.updateField
 * );
 * ```
 */
export const validateFactOverridePermission = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const userInfo: Pick<UserInfo, "role" | "customer_id" | "email" | "subrole_id"> =
		res.locals.user;

	const forbiddenError = new FactOverridePermissionError(
		"You do not have permission to override fact data.",
		StatusCodes.FORBIDDEN,
		ERROR_CODES.UNAUTHORIZED
	);

	try {
		/**
		 * Step 1: Check if the feature flag is enabled
		 */
		const isFeatureFlagEnabled = await getFlagValue(
			FEATURE_FLAGS.PAT_874_CM_APP_EDITING,
			{
				key: "customer",
				kind: "customer",
				customer_id: userInfo.customer_id as string,
			}
		);

		/**
		 * If the feature flag is not enabled, fact overrides are disabled globally.
		 * Return 403 Forbidden.
		 */
		if (!isFeatureFlagEnabled) {
			logger.info(
				`Fact override feature flag disabled for customer: ${userInfo.customer_id}`
			);
			throw forbiddenError;
		}

		/**
		 * Step 2: Check if user has Admin or Risk Analyst role
		 * These roles have access by default (no permission check needed)
		 */
		const userRoleCode = userInfo.role?.code?.toLowerCase();
		const isAdminOrRiskAnalyst =
			userInfo.role?.code === ROLES.ADMIN ||
			(userRoleCode && ALLOWED_ROLE_CODES.includes(userRoleCode as typeof ALLOWED_ROLE_CODES[number]));

		if (isAdminOrRiskAnalyst) {
			return next();
		}

		/**
		 * Step 3: For custom roles, check if user has the Edit Application permission
		 */
		let hasEditPermission = false;

		if (userInfo.subrole_id) {
			hasEditPermission = Boolean(
				await redis.sismember(
					`{subroles}:${userInfo.subrole_id}:permissions`,
					EDIT_APPLICATION_PERMISSION
				)
			);
		}

		if (hasEditPermission) {
			return next();
		}

		/**
		 * Step 4: User doesn't meet criteria - deny access
		 */
		logger.info(
			`Fact override permission denied for user: ${userInfo.email}, role: ${userRoleCode}`
		);
		throw forbiddenError;
	} catch (error) {
		// Re-throw FactOverridePermissionError as-is
		if (error instanceof FactOverridePermissionError) {
			return next(error);
		}

		// Log unexpected errors and return a generic forbidden response
		logger.error(
			{ err: error instanceof Error ? error : new Error(String(error)) },
			"Error checking fact override permission"
		);
		return next(forbiddenError);
	}
};

/**
 * Helper function to check fact override permission programmatically.
 *
 * Useful for permission checks within service functions.
 *
 * @param userInfo - The user information object
 * @returns Promise<boolean> - True if user can override facts, false otherwise
 */
export const canOverrideFact = async (
	userInfo: Pick<UserInfo, "role" | "customer_id" | "subrole_id">
): Promise<boolean> => {
	try {
		// Check feature flag
		const isFeatureFlagEnabled = await getFlagValue(
			FEATURE_FLAGS.PAT_874_CM_APP_EDITING,
			{
				key: "customer",
				kind: "customer",
				customer_id: userInfo.customer_id as string,
			}
		);

		if (!isFeatureFlagEnabled) {
			return false;
		}

		// Check role - Admin and Risk Analyst have access by default
		const userRoleCode = userInfo.role?.code?.toLowerCase();
		const isAdminOrRiskAnalyst =
			userInfo.role?.code === ROLES.ADMIN ||
			(userRoleCode && ALLOWED_ROLE_CODES.includes(userRoleCode as typeof ALLOWED_ROLE_CODES[number]));

		if (isAdminOrRiskAnalyst) {
			return true;
		}

		// For custom roles, check if they have the Edit Application permission
		if (userInfo.subrole_id) {
			const hasEditPermission = await redis.sismember(
				`{subroles}:${userInfo.subrole_id}:permissions`,
				EDIT_APPLICATION_PERMISSION
			);
			return Boolean(hasEditPermission);
		}

		return false;
	} catch (error) {
		logger.error(
			{ err: error instanceof Error ? error : new Error(String(error)) },
			"Error in canOverrideFact check"
		);
		return false;
	}
};

export default validateFactOverridePermission;
