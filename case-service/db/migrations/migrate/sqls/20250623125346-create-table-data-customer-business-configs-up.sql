/* Replace with your SQL commands */
CREATE TABLE onboarding_schema.data_customer_business_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    business_id UUID NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (customer_id, business_id)
);
