export interface BusinessesCustomerMonitoringParams {
	customerID: string;
	businessID: string;
}

export interface BusinessesCustomerMonitoringBody {
	risk_monitoring: boolean;
}

export interface CustomerBusinessesMonitoring {
	business_id: string;
	customer_id: string;
	is_monitoring_enabled: boolean;
	created_at: string;
	created_by: string;
	external_id: string;
	metadata: string;
}

export interface GetScoreTriggerIDBody {
	case_id: string;
}

export interface ICaseBody {
	id: string;
	applicant_id: string;
	created_at: string;
	case_type: string;
	business_name: string;
	status_label: string;
	assignee: Record<string, string>,
	applicant: Record<string, string>,
	status: Record<string, string>,
}

export interface IEnrichedCaseBody extends ICaseBody {
	risk_alerts?: Array<Record<string, string>>;
}
