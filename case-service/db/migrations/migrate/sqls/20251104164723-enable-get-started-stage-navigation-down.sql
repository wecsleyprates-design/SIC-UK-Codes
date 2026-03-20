-- Revert changes: Disable navigation back to the "Get Started" page during onboarding

-- Revert core_onboarding_stages table changes
-- 1. Disable the get_started stage
-- 2. Remove back navigation from company stage  
-- 3. Remove get_started as previous stage for company

UPDATE onboarding_schema.core_onboarding_stages
SET is_enabled = false
WHERE code = 'get_started';

UPDATE onboarding_schema.core_onboarding_stages
SET 
    prev_stage = NULL,
    allow_back_nav = false
WHERE code = 'company';

-- Revert data_customer_onboarding_stages table changes
-- 1. Disable get_started for all customers
-- 2. Revert back navigation and get_started as the previous stage for company for all customers
UPDATE onboarding_schema.data_customer_onboarding_stages
SET 
    is_enabled = false,
    next_stage = NULL,
    updated_at = NOW()
WHERE stage_code = 'get_started';

UPDATE onboarding_schema.data_customer_onboarding_stages
SET 
    prev_stage = NULL,
    allow_back_nav = false,
    updated_at = NOW()
WHERE stage_code = 'company'
    AND prev_stage IS NOT NULL;