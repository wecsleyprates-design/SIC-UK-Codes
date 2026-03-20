/* Replace with your SQL commands */
-- Step 1: Change table with Old name 
ALTER TABLE core_score_refresh_config RENAME TO core_data_refresh_config;
-- Step 1: Remove the specific entry added during the migration
DELETE FROM core_data_refresh_config
WHERE refresh_type = 'MANUAL_REFRESH';

-- Step 2: Add the refresh_cycle_in_days column back
ALTER TABLE core_data_refresh_config
ADD COLUMN refresh_cycle_in_days INT;  

-- Step 3: Populate the refresh_cycle_in_days column from the config column
UPDATE core_data_refresh_config
SET refresh_cycle_in_days = (config->>'refresh_value')::INTEGER
WHERE config IS NOT NULL;


-- Step 4: Drop the config column after storing values
ALTER TABLE core_data_refresh_config
DROP COLUMN config;

-- Step 5: Alter the column to add the NOT NULL constraint
ALTER TABLE core_data_refresh_config
ALTER COLUMN refresh_cycle_in_days SET NOT NULL;

