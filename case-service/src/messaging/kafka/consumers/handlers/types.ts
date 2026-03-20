import { CASE_STATUS, CASE_TYPE } from "#constants";
import { UUID } from "crypto";

export interface IBusinessIntegrationTask {
	id: string;
	connection_id: string;
	integration_task_id: number;
	business_score_trigger_id?: string;
	task_status: string;
	reference_id: string;
	metadata: any;
	created_at?: any;
	updated_at?: any;
}

export interface IBusinessIntegrationTaskEnriched extends IBusinessIntegrationTask {
	business_id: string;
	platform_id: number;
	platform_code: string;
	task_code: string;
	task_label: string;
	platform_category_code: string;
}

export type DataCase = {
	id: string;
	applicant_id: string;
	customer_id?: string;
	business_id: string;
	status: (typeof CASE_STATUS)[keyof typeof CASE_STATUS];
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	case_type: (typeof CASE_TYPE)[keyof typeof CASE_TYPE];
};

export interface ICreateRiskCase {
	business_id: string;
	customer_id: string;
	risk_alert_id: string;
	score_trigger_id: string;
	risk_alert_subtype: string;
}

// TODO: This is not final payload interface may change as code progresses
export interface I360Report {
	report_id: UUID;
	business_id: UUID;
	case_id: UUID;
	score_trigger_id: UUID;
	customer_id: UUID;
}

export interface ICompanyOverviewResponse {
	ownership: {
		id: UUID;
		first_name: string;
		last_name: string;
		ownership_percentage: string;
	}[];
}

export interface IntegrationCategoryCompleted {
	category_id: string;
	category_name: string;
	business_id: UUID;
	case_id: UUID;
	customer_id?: UUID;
	score_trigger_id?: UUID;
	action?: string;
	completion_state: {
		tasks_completed?: number;
		tasks_required?: number;
		is_all_complete?: boolean;
		required_tasks?: string[];
		completed_tasks?: string[];
		timed_out_tasks?: string[];
		completed_categories?: string[];
		initialized_at?: string;
		started_at?: string;
		business_id: UUID;
		case_id: UUID;
		customer_id?: UUID;
		score_trigger_id?: UUID;
		required_tasks_by_category?: Record<string, string[]>;
		timeout_threshold_seconds?: number;
		tasks_timed_out?: number;
		updated_at?: string;
		tasks_ignored?: number;
	};
}
