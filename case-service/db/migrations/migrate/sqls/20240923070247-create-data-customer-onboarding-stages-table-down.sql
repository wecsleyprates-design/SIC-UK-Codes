-- Drop the trigger if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_version_before_insert_for_pair') THEN
        DROP TRIGGER set_version_before_insert_for_pair ON data_customer_onboarding_stages;
    END IF;
END $$;

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS increment_version_if_pair_exists();

-- Drop the table if it exists
DROP TABLE IF EXISTS data_customer_onboarding_stages;