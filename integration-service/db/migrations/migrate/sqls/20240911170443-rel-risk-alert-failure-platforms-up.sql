/* Replace with your SQL commands */
CREATE TABLE public.rel_risk_alert_failure_platforms (
	risk_alert_id uuid NOT NULL,
	platform_id int NOT null,
	CONSTRAINT rel_risk_alert_failure_platforms_data_risk_alerts_fk FOREIGN KEY (risk_alert_id) REFERENCES public.data_risk_alerts(id),
    CONSTRAINT rel_risk_alert_failure_platforms_core_integrations_platforms_fk FOREIGN KEY (platform_id) REFERENCES integrations.core_integrations_platforms(id),
	CONSTRAINT unique_platform_risk_alert UNIQUE (platform_id, risk_alert_id)
);
