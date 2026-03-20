import type { UUID } from "crypto";

export interface IntegrationData {
	score_trigger_id: UUID;
	task_id: UUID;
	task_status: string;
	business_id: UUID;
	platform_id: number;
	connection_id: UUID;
	metadata?: Record<string, unknown> | null;
	task_code: string;
	task_label: string;
	platform_category_code: string;
	platform_code: string;
	trigger_type: string;
	trigger_version: number;
	case_id?: UUID | null;
	cases_to_link?: Array<{
		case_id: UUID;
	}> | null;
	customer_id?: UUID | null;
	applicant_id?: UUID | null;
}
export type IntegrationDataStructure = {
	category?: Record<string, Record<string, Array<{ task_code: string; status: string }>>>;
	meta?: Record<string, unknown>;
	case_status?: {
		status: "SUBMITTED" | "INFORMATION_REQUESTED" | "INFORMATION_UPDATED";
	};
} | null;

export type CaseDataStructure = {
	case_status: {
		status: "SUBMITTED" | "INFORMATION_REQUESTED" | "INFORMATION_UPDATED";
	};
} | null;

