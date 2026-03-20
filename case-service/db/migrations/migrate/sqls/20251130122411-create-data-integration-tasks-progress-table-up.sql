CREATE TABLE data_integration_tasks_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL,
    business_id UUID NOT NULL,
    customer_id UUID,
    total_tasks INT NOT NULL DEFAULT 0,
    completed_tasks INT NOT NULL DEFAULT 0,
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    required_tasks_array JSONB NOT NULL DEFAULT '[]',
    completed_tasks_array JSONB NOT NULL DEFAULT '[]',
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX idx_data_integration_tasks_progress_case_id 
    ON data_integration_tasks_progress (case_id);