// express.d.ts
import type { ErrorCode } from "@joinworth/types/dist/constants/errorCodes";
import "express";
import type { AgentDetails } from "express-useragent";

declare global {
	namespace Express {
		interface Request {
			useragent?: AgentDetails;
		}
		interface Response {
			jsend: {
				success: (data: any, message?: string, statusCode?: number) => void;
				fail: (message: string, data: any, errorCode?: number | null | ErrorCode, statusCode?: number) => void;
				error: (message: string, statusCode?: number, errorCode?: number | null | ErrorCode, data?: any) => void;
			};
			locals?: {
				user?: {
					user_id: string;
					given_name: string;
					family_name: string;
					email: string;
					role: {
						code: string;
						id: number;
					};
				};
				[key: string]: any;
			};
		}
	}
}
