CREATE TABLE public.data_cases_decisioning_config
(
    customer_id uuid
        CONSTRAINT data_cases_decisioning_config_pk
            PRIMARY KEY,
    active_decisioning_type VARCHAR(20) NOT NULL DEFAULT 'worth_score'
        CONSTRAINT check_workflow_decisioning_type
            CHECK (active_decisioning_type IN ('worth_score', 'custom_workflow')),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_data_cases_decisioning_config_customer_id 
ON public.data_cases_decisioning_config(customer_id);

