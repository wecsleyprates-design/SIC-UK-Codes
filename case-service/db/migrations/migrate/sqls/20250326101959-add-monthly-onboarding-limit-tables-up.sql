-- create data_customer_onboarding_limits table
CREATE TABLE onboarding_schema.data_customer_onboarding_limits (
    customer_id UUID NOT NULL PRIMARY KEY,
    onboarding_limit INT NULL, -- onboarding_limit can be updated to null
    current_count INT NOT NULL DEFAULT 0,
    easyflow_count INT NOT NULL DEFAULT 0,
    purged_businesses_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID NOT NULL,
    reset_at TIMESTAMP NULL
);

-- create data_customer_onboarding_limits_history table
CREATE TABLE onboarding_schema.data_customer_onboarding_limits_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL,
    onboarding_limit INT NULL,
    used_count INT NOT NULL,
    easyflow_count INT NOT NULL,
    purged_businesses_count INT NOT NULL,
    total_count INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customer_id FOREIGN KEY (customer_id) 
    REFERENCES onboarding_schema.data_customer_onboarding_limits (customer_id) ON DELETE CASCADE
);
