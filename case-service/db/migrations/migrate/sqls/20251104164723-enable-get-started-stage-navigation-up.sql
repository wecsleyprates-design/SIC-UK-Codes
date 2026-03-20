-- Enable navigation back to the "Get Started" page during onboarding

-- Update core_onboarding_stages table
-- 1. Enable the get_started stage
-- 2. Update company stage to allow back navigation
-- 3. Update company stage to have get_started as its previous stage

UPDATE onboarding_schema.core_onboarding_stages
SET is_enabled = true
WHERE code = 'get_started';

UPDATE onboarding_schema.core_onboarding_stages
SET 
    prev_stage = (SELECT id FROM onboarding_schema.core_onboarding_stages WHERE code = 'get_started'),
    allow_back_nav = true
WHERE code = 'company';

-- Update data_customer_onboarding_stages table
-- 1. Enable the get_started stage for all customers and set next_stage to company per customer
-- 2. Update company stage to allow back navigation for all customers
-- 3. Update company stage to have get_started as its previous stage per customer

-- Enable get_started and set its next_stage to company per customer
UPDATE onboarding_schema.data_customer_onboarding_stages AS gs_stage
SET 
    is_enabled = true,
    next_stage = company_stage.id, -- ID of company stage, specific to the customer
    updated_at = NOW()
FROM onboarding_schema.data_customer_onboarding_stages AS company_stage
WHERE
    gs_stage.customer_id = company_stage.customer_id
    AND gs_stage.stage_code = 'get_started'
    AND company_stage.stage_code = 'company';

-- Set allow_back_nav and prev_stage for company stage per customer
UPDATE onboarding_schema.data_customer_onboarding_stages AS company_stage
SET
    allow_back_nav = true,
    prev_stage = gs_stage.id, -- ID of get_started stage, specific to the customer
    updated_at = NOW()
FROM onboarding_schema.data_customer_onboarding_stages AS gs_stage
WHERE
    company_stage.customer_id = gs_stage.customer_id
    AND company_stage.stage_code = 'company'
    AND gs_stage.stage_code = 'get_started';

