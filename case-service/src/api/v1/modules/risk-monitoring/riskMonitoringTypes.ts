import type { UUID } from "crypto";
import { CADENCE_VALUES, type MONITORING_ASSOCIATION_VALUES, type MONITORING_RUN_STATUS_VALUES } from "./constants";

export type Cadence = keyof typeof CADENCE_VALUES;
export type MonitoringRunStatus = (typeof MONITORING_RUN_STATUS_VALUES)[number];
export type MonitoringAssociation = (typeof MONITORING_ASSOCIATION_VALUES)[number];

export interface MonitoringTemplateRow {
	id: UUID;
	customer_id: UUID;
	priority: number;
	is_active: boolean;
	is_default: boolean;
	label: string;
	created_at: string;
	updated_at: string;
	created_by: UUID;
	updated_by: UUID;
}

export interface RelIntegrationGroupMonitoringTemplateRow {
	template_id: UUID;
	integration_group: number;
	cadence: Cadence;
}

export interface RelMonitoringTemplateBusinessRow {
	business_id: UUID;
	customer_id: UUID;
	template_id: UUID;
	association: MonitoringAssociation;
}

export interface RelMonitoringRulesRow {
	template_id: UUID;
	rule_id: UUID;
}

export interface MonitoringRunRow {
	id: UUID;
	customer_id: UUID;
	template_id: UUID;
	created_at: string;
}

export interface RelBusinessMonitoringRunRow {
	run_id: UUID;
	business_id: UUID;
	template_id: UUID;
	start_at: string | null;
	complete_at: string | null;
	status: MonitoringRunStatus;
	score_trigger_id?: UUID | null;
	metadata: Record<string, unknown>;
}

/** One row from the due-for-refresh query: one business per template with due integration groups. */
export interface DueForRefreshRow {
	customer_id: UUID;
	business_id: UUID;
	template_id: UUID;
	due_integration_groups: string[];
	last_run_at: string | null;
	days_overdue: number;
}

/** Cursor for paginating due-for-refresh (ORDER BY days_overdue DESC, business_id ASC, template_id ASC). */
export interface DueForRefreshCursor {
	days_overdue: number;
	business_id: UUID;
	template_id: UUID;
}

export interface DueForRefreshPage {
	rows: DueForRefreshRow[];
	nextCursor: DueForRefreshCursor | null;
}

export interface MonitoringTemplateParams {
	customerID: UUID;
	templateID?: UUID;
}

export interface MonitoringTemplateBody {
	label: string;
	priority?: number;
	is_active?: boolean;
	is_default?: boolean;
	integration_groups?: Array<{ integration_group: number; cadence: Cadence }>;
	rule_ids?: UUID[];
}

export interface BusinessTemplateParams {
	customerID: UUID;
	businessID: UUID;
}

export interface BusinessTemplateBody {
	template_id: UUID;
}

// --- Risk alert, category, bucket ---

export interface RiskCategoryRow {
	id: UUID;
	customer_id: UUID;
	label: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	created_by: UUID;
	updated_by: UUID;
}

export interface RiskBucketRow {
	id: UUID;
	customer_id: UUID;
	label: string;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	created_by: UUID;
	updated_by: UUID;
}

export interface RiskAlertRow {
	id: UUID;
	customer_id: UUID;
	label: string;
	description: string | null;
	is_active: boolean;
	category_id: UUID | null;
	bucket_id: UUID | null;
	routing: Record<string, unknown>;
	created_at: string;
	updated_at: string;
	created_by: UUID;
	updated_by: UUID;
}

export interface RelCaseRiskAlertRow {
	case_id: UUID;
	risk_alert_id: UUID;
	/** What triggered the alert (e.g. rule output, score, payload). */
	context?: Record<string, unknown>;
	/** Monitoring run that triggered this link, if any. */
	run_id?: UUID | null;
}

export interface RelRiskAlertRuleRow {
	risk_alert_id: UUID;
	rule_id: UUID;
	created_at: string;
	created_by: UUID;
	updated_at: string;
	updated_by: UUID;
}

export interface RiskCategoryParams {
	customerID: UUID;
	categoryID?: UUID;
}

export interface RiskCategoryBody {
	label: string;
	is_active?: boolean;
}

export interface RiskBucketParams {
	customerID: UUID;
	bucketID?: UUID;
}

export interface RiskBucketBody {
	label: string;
	is_active?: boolean;
}

export interface RiskAlertParams {
	customerID: UUID;
	alertID?: UUID;
}

export interface RiskAlertBody {
	label: string;
	description?: string | null;
	is_active?: boolean;
	category_id?: UUID | null;
	bucket_id?: UUID | null;
	routing?: Record<string, unknown>;
	rule_ids?: UUID[];
}

/* Monitoring Run Queue Event Shape */
export interface MonitoringRunQueueEvent {
	idempotency_key: string;
	run_id: UUID;
	customer_id: UUID;
	business_id: UUID;
	integration_groups: number[];
	created_at: string;
}
