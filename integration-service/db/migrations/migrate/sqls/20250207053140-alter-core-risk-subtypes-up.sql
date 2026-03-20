-- Alter table to add 'is_enabled' column if it does not exist
ALTER TABLE core_risk_alerts_config ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT FALSE;
 
-- Insert new risk sub-type
INSERT INTO public.core_risk_sub_types (id, code, label, parent_risk_type)
VALUES (10, 'new_adverse_media', 'New Adverse Media', 1)
ON CONFLICT (id) DO NOTHING;
 
-- Insert new risk alert config
INSERT INTO public.core_risk_alerts_config (id, risk_type, measurement_operation, measurement_config_schema, customer_managed, risk_sub_type, created_at)
VALUES (12, 1, 'NEW_DATA', '{}', TRUE, 10, current_timestamp)
ON CONFLICT (id) DO NOTHING;
 
 
 
-- Insert risk alert config entry
INSERT INTO public.data_risk_alerts_config (id, risk_alert_config_id, measurement_config, is_enabled, customer_id, created_at, created_by, updated_at, updated_by)
VALUES (gen_random_uuid(), 12, '{"threshold":1}', FALSE, NULL, current_timestamp, 'e9d43901-3fc6-4ee9-97be-74cd23b39aa0', current_timestamp, 'e9d43901-3fc6-4ee9-97be-74cd23b39aa0');