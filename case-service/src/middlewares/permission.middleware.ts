import { type Request, type Response, type NextFunction } from "express";
import { type TResponseFlagValue, type TResponseLocals } from "#types";
import { ERROR_CODES, FEATURE_FLAGS, ROLES } from "#constants/index";
import { getFlagValue, redis, refreshSubrolePermissions } from "#helpers/index";
import { StatusCodes } from "http-status-codes";

type PermissionLeaf = string | { permission: string };

class PermissionMiddlewareError extends Error {
	status: number;
	errorCode: string;
	data: any;

	constructor(
		message: string,
		status: number = StatusCodes.FORBIDDEN,
		errorCode: string = ERROR_CODES.NOT_ALLOWED,
		data?: any
	) {
		super(message);
		this.name = "PermissionMiddlewareError";
		this.status = status;
		this.errorCode = errorCode;
		this.data = data;
	}
}

export type PermissionNode =
	| { type: "AND"; conditions: PermissionNode[] }
	| { type: "OR"; conditions: PermissionNode[] }
	| PermissionLeaf;

// Builder functions for creating permission expressions
export const and = (...conditions: (PermissionNode | PermissionLeaf)[]): PermissionNode => ({
	type: "AND",
	conditions
});

export const or = (...conditions: (PermissionNode | PermissionLeaf)[]): PermissionNode => ({ type: "OR", conditions });

// Helper to normalize permission strings
const normalize = (p: PermissionLeaf): string => (typeof p === "string" ? p : p.permission);

// Recursive permission evaluation
const evaluatePermission = (node: PermissionNode, userPermissions: string[]): boolean => {
	// Handle leaf nodes (individual permissions)
	if (typeof node === "string" || "permission" in node) {
		return userPermissions.includes(normalize(node as PermissionLeaf));
	}

	if (node.type === "AND") {
		return node.conditions.every(condition => evaluatePermission(condition, userPermissions));
	}

	if (node.type === "OR") {
		return node.conditions.some(condition => evaluatePermission(condition, userPermissions));
	}

	// Fallback for unknown node types
	return false;
};

export const validatePermissions = (expression: PermissionNode) => {
	return async (req: Request, res: Response & TResponseLocals & TResponseFlagValue, next: NextFunction) => {
		try {
			// Only validate permissions for customer roles, skip for admin and applicant
			const userRole = res.locals.user.role?.code;
			if (userRole !== ROLES.CUSTOMER) {
				return next();
			}

			const isCustomRolesFeatureEnabled = await getFlagValue(FEATURE_FLAGS.PAT_779_ENABLE_CUSTOM_ROLES_FEATURE, {
				key: "customer",
				kind: "customer",
				customer_id: res.locals.user?.customer_id as string
			});

			if (!isCustomRolesFeatureEnabled) {
				return next();
			}

			const subroleId = res.locals.user.subrole_id;

			if (!subroleId) {
				throw new PermissionMiddlewareError(
					"User subrole not found",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.UNAUTHENTICATED
				);
			}

			const redisKey = `{subroles}:${subroleId}:permissions`;

			// Check if Redis key exists
			const keyExists = await redis.exists(redisKey);

			if (!keyExists) {
				// Key doesn't exist, repopulate from API
				try {
					await refreshSubrolePermissions(subroleId);
				} catch (apiError) {
					throw new Error(`Permission API fetch failed: ${apiError instanceof Error ? apiError.message : "API error"}`);
				}
			}

			// Fetch permissions from Redis
			const userPermissions = await redis.smembers(redisKey);

			// Evaluate permission against cached permissions
			const hasPermissions = evaluatePermission(expression, userPermissions);

			if (!hasPermissions) {
				throw new PermissionMiddlewareError(
					"You do not have the necessary permissions to perform this action.",
					StatusCodes.FORBIDDEN,
					ERROR_CODES.UNAUTHENTICATED
				);
			}

			next();
		} catch (error) {
			throw error;
		}
	};
};
