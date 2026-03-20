-- Delete risk alert config entry from data_risk_alerts_config
DELETE FROM public.data_risk_alerts_config
WHERE risk_alert_config_id = 11;
 
-- Delete the inserted risk alert config from core_risk_alerts_config
DELETE FROM public.core_risk_alerts_config
WHERE id = 11;
 
-- Delete the inserted risk sub-type from core_risk_sub_types
DELETE FROM public.core_risk_sub_types
WHERE id = 9;
 
-- Remove the 'is_enabled' column from core_risk_alerts_config (only if it was added)
ALTER TABLE core_risk_alerts_config DROP COLUMN IF EXISTS is_enabled;