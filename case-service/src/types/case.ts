import { CASE_STATUS, CASE_TYPE } from "#constants";
import type { UUID } from "crypto";

export namespace Case {
	export interface Egg {
		id?: UUID;
		applicant_id?: UUID | string;
		customer_id?: UUID | string | null;
		business_id: UUID | string;
		status: (typeof CASE_STATUS)[keyof typeof CASE_STATUS];
		updated_by: UUID | string;
		created_by: UUID | string;
		case_type?: CASE_TYPE;
		updated_at?: Date;
		created_at?: Date;
		customer_initiated?: boolean;
	}
	export interface Record extends Egg {
		id: UUID;
		case_type: CASE_TYPE;
		updated_at: Date;
		created_at: Date;
	}

	export interface HistoryEgg {
		id?: string;
		case_id: string;
		status: (typeof CASE_STATUS)[keyof typeof CASE_STATUS];
		created_by: string;
		created_at?: Date;
	}
	export interface History extends HistoryEgg {
		id: string;
		created_at: Date;
	}
}
