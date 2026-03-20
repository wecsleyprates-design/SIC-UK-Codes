/* Added SQL command to add column is_enabled */
ALTER TABLE data_risk_alerts_config 
ADD is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Add new enum to risk_condition_measurement_type
DO $$
BEGIN
    -- Check if the value exists in the enum type
    IF NOT EXISTS (SELECT 1 FROM pg_type t
                   JOIN pg_enum e ON t.oid = e.enumtypid
                   JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                   WHERE t.typname = 'risk_condition_measurement_type'
                   AND e.enumlabel = 'TRANSITION') THEN
        -- If it doesn't exist, add the value
        ALTER TYPE risk_condition_measurement_type ADD VALUE 'TRANSITION';
    END IF;
END $$;


-- Revert alter column length
ALTER TABLE core_risk_sub_types 
ALTER COLUMN code TYPE VARCHAR(50),
ALTER COLUMN label TYPE VARCHAR(50);