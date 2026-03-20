-- Create the table data_customer_onboarding_stages if it does not exist
CREATE TABLE IF NOT EXISTS data_customer_onboarding_stages (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,  -- Unique identifier for each record, auto-generated
    customer_id UUID NOT NULL,                              -- Reference to the customer who owns the onboarding configuration
    core_stage_id INT NOT NULL,                             -- Reference to the core onboarding stage, linking to core_onboarding_stages table
    version INT NOT NULL DEFAULT 1,                         -- Version of the customer’s specific configuration for the same stage
    completion_weightage INT NULL,                          -- Custom weightage for progress tracking, can be null
    allow_back_nav BOOLEAN NOT NULL DEFAULT TRUE,           -- Indicates if back navigation is allowed for this stage, default is true
    is_skippable BOOLEAN NOT NULL DEFAULT FALSE,            -- Indicates if the stage is skippable, default is false
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,              -- Indicates if the stage is enabled, default is false
    prev_stage INT NULL,                                    -- Reference to the previous stage in the custom flow, nullable
    next_stage INT NULL,                                    -- Reference to the next stage in the custom flow, nullable
    priority_order INT NULL,                                -- Custom ordering of the stage, specific to the customer, nullable
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,            -- Timestamp of when the record was created
    created_by UUID NOT NULL,                               -- Reference to the user who created the record
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,            -- Timestamp of when the record was last updated
    updated_by UUID NOT NULL,                               -- Reference to the user who last updated the record
    FOREIGN KEY (core_stage_id) REFERENCES core_onboarding_stages(id),  -- Ensures core_stage_id references a valid stage in core_onboarding_stages
    UNIQUE (customer_id, core_stage_id, version)            -- Enforces uniqueness for a combination of customer_id, core_stage_id, and version
);

-- Create or replace the trigger function that will auto-increment the version number for the same customer_id and core_stage_id
CREATE OR REPLACE FUNCTION increment_version_if_pair_exists()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the pair of customer_id and core_stage_id already exists, and increment the version accordingly
    SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
    FROM data_customer_onboarding_stages
    WHERE customer_id = NEW.customer_id
    AND core_stage_id = NEW.core_stage_id;
    
    -- Return the new record with the incremented version
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that automatically calls the version increment function before an insert
DO $$
BEGIN
    -- Check if the trigger does not already exist
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_version_before_insert_for_pair') THEN
        -- Create a trigger that runs before each insert on data_customer_onboarding_stages
        CREATE TRIGGER set_version_before_insert_for_pair
        BEFORE INSERT ON data_customer_onboarding_stages
        FOR EACH ROW
        EXECUTE FUNCTION increment_version_if_pair_exists();
    END IF;
END $$;
