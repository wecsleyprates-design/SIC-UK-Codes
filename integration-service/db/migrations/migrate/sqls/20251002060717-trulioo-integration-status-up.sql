
-- add trulioo integration status, default is disabled
INSERT INTO integrations.core_integration_status (integration_code,integration_label,status) VALUES
	('trulioo','Trulioo','DISABLED'::public.customer_integration_status);
