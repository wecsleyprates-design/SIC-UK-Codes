--- Delete google reviews from rel_tasks_integrations
DELETE FROM integrations.rel_tasks_integrations WHERE task_category_id = 14 AND platform_id = 19;

--- Delete core task for google reviews
DELETE FROM integrations.core_tasks WHERE code = 'fetch_google_reviews';

--- Delete google reviews from core_integration_platforms
DELETE FROM integrations.core_integrations_platforms WHERE code = 'google_reviews';

--- Delete trigger for updated_at
DROP TRIGGER IF EXISTS update_integration_data_reviews ON integration_data.reviews;

-- - Delete reviews table
ALTER TABLE integration_data.reviews DROP CONSTRAINT IF EXISTS fk_business_integrations_tasks;
DROP TABLE integration_data.reviews;