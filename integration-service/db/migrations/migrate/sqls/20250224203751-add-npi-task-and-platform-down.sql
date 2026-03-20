DROP TABLE IF EXISTS integration_data.healthcare_provider_information;

DELETE FROM integrations.data_business_integrations_tasks 
WHERE "integration_task_id" = 63;

DELETE FROM integrations.rel_tasks_integrations
WHERE "id" = 63;

DELETE FROM integrations.core_integrations_platforms
WHERE "id" = 28;

DELETE FROM integrations.core_tasks
WHERE "id" = 22;