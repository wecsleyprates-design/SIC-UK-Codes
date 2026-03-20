/* Replace with your SQL commands */

-- Step 1: Remove from data_customer_onboarding_stages
DELETE FROM onboarding_schema.data_customer_onboarding_stages
WHERE stage_code = 'rfi';

-- Step 2: Remove link from rel_onboarding_stage_type
DELETE FROM onboarding_schema.rel_onboarding_stage_type
WHERE stage_id = 14;

-- Step 3: Remove from core_onboarding_stages
DELETE FROM onboarding_schema.core_onboarding_stages
WHERE code = 'rfi';
