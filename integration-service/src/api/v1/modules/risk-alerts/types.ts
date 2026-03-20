export interface getRiskAlertReasonsStatParams {
	customerID: string;
}

export interface getRiskAlertReasonsStatQuery {
	period: string;
	filter: any;
}

export interface RisksData {
	month_in_tz: string;
	month: string;
	sub_type_code: string;
	count: string;
}

export interface IRiskAlertsQueryResult {
	id: string;
	customer_id: string;
	measurement_config: any;
	created_at: string;
	risk_level: string;
	risk_type_code: string;
	risk_sub_type_code: string;
	integration_task_id: string;
	score_trigger_id: string;
}
