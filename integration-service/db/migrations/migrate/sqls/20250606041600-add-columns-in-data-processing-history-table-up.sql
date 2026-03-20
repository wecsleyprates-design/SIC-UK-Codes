/* Replace with your SQL commands */
ALTER TABLE integration_data.data_processing_history
ADD COLUMN general_data jsonb NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN seasonal_data jsonb NOT NULL DEFAULT '{}'::jsonb;