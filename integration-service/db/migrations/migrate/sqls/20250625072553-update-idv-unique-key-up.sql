/* Replace with your SQL commands */
ALTER TABLE integration_data.identity_verification 
DROP CONSTRAINT idv_status_unique;

ALTER TABLE integration_data.identity_verification 
ADD CONSTRAINT idv_status_unique 
UNIQUE (business_id, platform_id, external_id, business_integration_task_id);
