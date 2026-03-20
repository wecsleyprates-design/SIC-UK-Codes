-- Update "Ownership Percentage" from Optional to Required

-- Create a temporary table to backup customer onboarding configs
CREATE TABLE IF NOT EXISTS onboarding_schema.tmp_ownership_percentage_migration (
    id int PRIMARY KEY,
    old_config JSONB NOT null,
    customer_stage_id UUID NOT null
);


-- Backup customers onboarding config to the temporary table
INSERT INTO onboarding_schema.tmp_ownership_percentage_migration (id, old_config, customer_stage_id)
SELECT dcsfc.id, dcsfc.config, dcsfc.customer_stage_id
FROM onboarding_schema.data_customer_stage_fields_config dcsfc
WHERE dcsfc.customer_stage_id IN (
    SELECT id FROM onboarding_schema.data_customer_onboarding_stages 
    WHERE stage_code = 'ownership'
)
AND dcsfc.config->'fields' @> '[{"name": "Ownership Percentage", "status": "Optional"}]';


-- Update data_customer_stage_fields_config to change Ownership Percentage from Optional to Required
UPDATE onboarding_schema.data_customer_stage_fields_config dcsfc
SET config = jsonb_set(
    dcsfc.config,
    '{fields}',
    (
        SELECT jsonb_agg(
            CASE
                WHEN field->>'name' = 'Ownership Percentage' AND field->>'status' = 'Optional'
                THEN jsonb_set(field, '{status}', '"Required"')
                ELSE field
            END
        )
        FROM jsonb_array_elements(dcsfc.config->'fields') AS field
    )
)
WHERE dcsfc.customer_stage_id IN (
    SELECT id FROM onboarding_schema.data_customer_onboarding_stages
    WHERE stage_code = 'ownership'
)
  AND dcsfc.config->'fields' @> '[{"name": "Ownership Percentage", "status": "Optional"}]';