DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'data_integration_tasks_progress_case_id_key'
    ) THEN
        ALTER TABLE data_integration_tasks_progress 
        ADD CONSTRAINT data_integration_tasks_progress_case_id_key UNIQUE (case_id);
    END IF;
END  $$;
