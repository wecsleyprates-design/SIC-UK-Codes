-- add kyx integration status, default is disabled
INSERT INTO integrations.core_integration_status (integration_code,integration_label,status) VALUES
	('kyx','KYX','DISABLED'::public.customer_integration_status);
