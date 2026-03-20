import type { UUID } from "crypto";
import type { NormalizedCustomFieldValues } from "../api/v1/modules/onboarding/types";

export namespace BusinessInvite {
	export interface Egg {
		id?: UUID;
		business_id: UUID;
		customer_id: UUID;
		status: (typeof status)[keyof typeof status];
		case_id?: UUID;
		action_taken_by?: UUID;
		created_by: UUID;
		updated_by?: UUID;
		updated_at?: Date;
		created_at?: Date;
		prefill?: {
			custom_field_template_id?: UUID;
			custom_fields?: NormalizedCustomFieldValues;
			esign_template_id?: UUID;
		} & globalThis.Record<string, any>;
	}
	export interface Record extends Egg {
		id: UUID;
		created_at: Date;
		updated_at: Date;
		updated_by: UUID;
	}

	export interface HistoryEgg {
		id?: UUID;
		invitation_id: UUID;
		status: Record["status"];
		created_by: UUID;
		created_at?: Date;
	}
	export interface HistoryRecord extends HistoryEgg {
		id: UUID;
		created_at: Date;
	}

	export const status = {
		INVITED: 1,
		EXPIRED: 2,
		ACCEPTED: 3,
		COMPLETED: 4,
		REJECTED: 5
	} as const;
	export type Status = keyof typeof status;
}
