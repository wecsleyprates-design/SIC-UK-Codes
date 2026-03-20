-- Step 1: Revert the stage name back to 'Review'
UPDATE onboarding_schema.data_customer_onboarding_stages
SET stage = 'Review'
WHERE stage_code = 'review';

-- Step 2: Remove MPA config entries that were inserted in the migrate up
DELETE FROM onboarding_schema.data_customer_stage_fields_config
WHERE customer_stage_id IN (
    SELECT id
    FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'review'
);
