-- Drop indexes for performance optimization
DROP INDEX IF EXISTS onboarding_schema.idx_data_customer_stage_fields_config_stage_id;
DROP INDEX IF EXISTS onboarding_schema.idx_data_customer_stage_fields_config_id;
DROP INDEX IF EXISTS onboarding_schema.idx_core_stage_fields_config_id;

-- Drop tables in reverse order of dependencies
ALTER TABLE onboarding_schema.data_customer_stage_fields_config DROP CONSTRAINT fk_data_customer_stage_fields_config_id;
DROP TABLE IF EXISTS onboarding_schema.data_customer_stage_fields_config CASCADE;

ALTER TABLE onboarding_schema.core_stage_fields_config DROP CONSTRAINT fk_core_stage_fields_config;
DROP TABLE IF EXISTS onboarding_schema.core_stage_fields_config CASCADE;

ALTER TABLE onboarding_schema.rel_customer_setup_status DROP CONSTRAINT fk_rel_customer_setup_status_setup_id;
DROP TABLE IF EXISTS onboarding_schema.rel_customer_setup_status CASCADE;


DROP TABLE IF EXISTS onboarding_schema.core_onboarding_setup_types CASCADE;

ALTER TABLE onboarding_schema.rel_onboarding_stage_type DROP CONSTRAINT fk_rel_onboarding_stage_type_stage_id;
ALTER TABLE  onboarding_schema.rel_onboarding_stage_type DROP CONSTRAINT fk_rel_onboarding_stage_type_id;
DROP TABLE IF EXISTS onboarding_schema.rel_onboarding_stage_type CASCADE;

DROP TABLE IF EXISTS onboarding_schema.core_onboarding_types CASCADE;

ALTER TABLE onboarding_schema.core_onboarding_stages SET SCHEMA public;
-- Truncate the core_onboarding_stages table
TRUNCATE TABLE core_onboarding_stages RESTART IDENTITY CASCADE;
-- Remove columns added to `core_onboarding_stages`
ALTER TABLE core_onboarding_stages
DROP COLUMN IF EXISTS code,
DROP COLUMN IF EXISTS is_removable,
DROP COLUMN IF EXISTS is_orderable;


-- Drop the table if it already exists
DROP TABLE IF EXISTS onboarding_schema.data_customer_onboarding_stages;

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


INSERT INTO core_onboarding_stages (
    id, stage, completion_weightage, allow_back_nav, is_skippable, is_enabled, 
    next_stage, prev_stage, priority_order
) VALUES
(1, 'company', 15, false, false, true, 2, NULL, 1),
(3, 'banking', 20, true, false, true, 4, 2, 3),
(4, 'ownership', 20, true, false, true, 5, 3, 4),
(5, 'accounting', 20, true, false, true, 6, 4, 5),
(6, 'tax consent', 20, true, true, true, 7, 5, 6),
(2, 'company additional info', 5, true, false, true, 3, 1, 2),
(8, 'review', 0, true, false, true, NULL, 7, 8),
(7, 'custom fields', 0, true, false, true, 8, 6, 7);


