import type { UUID } from "crypto";

/*
    Describe the shape received by the integration_data_uploaded event
*/
export type IntegrationDataUploadedEventType<T = any> = {
	id: UUID;
	case_id: UUID;
	business_id: UUID;
	customer_id: UUID;
	user_id: UUID;
	created_at: Date;
	data: T;
	trigger:
		| "bulkCreateBusinessMapper"
		| "bulkUpdateBusinessMapper"
		| "factOverride:DELETE"
		| "factOverride:PUT"
		| "factOverride:PATCH";
};
// NOTE: This file can contain interfaces & types for kafka and kafka messages.
export interface IKafkaMessage {
	key: string;
	value: { event: string; [key: string]: any };
}

export interface ICreateRiskAlert {
	business_id: string;
	customer_id: string;
	integration_task_id?: string;
	risk_alert_subtype: string;
	risk_level: string;
	risk_alert_config_id: string;
	measurement_config: string;
	created_by?: string;
	score_trigger_id: string;
}
