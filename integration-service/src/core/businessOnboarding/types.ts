import type { UUID } from "crypto";

export interface BusinessInviteAcceptedPayload {
	case_id?: UUID;
	business_id: UUID;
	customer_id?: UUID | null;
	applicant_id: string;
	required_task_categories?: number[];
}
