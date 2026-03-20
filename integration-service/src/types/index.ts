export * from "./common";
export * from "./datetime";
export * from "./db";
export * from "./eggPattern";
export * from "./kafka";
export * from "./worthApi";
export * from "./secrets";

import { IntegrationPlatformId, type ROLE_ID, type ROLES } from "#constants";
import type { CognitoJwtPayload } from "aws-jwt-verify/jwt-model";
import { UUID } from "crypto";
import { Response as ExpressResponse, Request as ExpressRequest } from "express";
import type { StatusCodes } from "http-status-codes";
import { Readable } from "stream";
import type { PaginationOptions } from "./eggPattern";

export interface Request extends ExpressRequest {
	paginate?: [unknown[], PaginationOptions<any>];
}
export interface Response extends ExpressResponse {
	jsend: {
		success(data: any, message?: string, statusCode?: number);
		download(fileStream: Readable, fileName: string, statusCode?: number);
		fail(message: any, data: any, errorCode?: number, statusCode?: number);
		error(message: any, statusCode?: number, errorCode?: number, data?: any);
	};
	locals: Record<any, any> & {
		user?: CognitoJwtPayload & {
			user_id: UUID;
			email: string;
			given_name: string;
			family_name: string;
			role: {
				id: ROLE_ID;
				code: ROLES;
			};
			customer_id?: UUID;
			subrole_id?: UUID;
		};
		cacheOutput?: {
			data: unknown;
			message?: string;
			statusCode?: StatusCodes;
		};
		cachedResponse?: unknown;
	};
}

export type IntegrationResponse = {
	platform_id: IntegrationPlatformId;
	category: string;
	business_id: UUID;
	connection_id: UUID;
	status: string;
	platform_code: string;
	platform_label: string;
};
