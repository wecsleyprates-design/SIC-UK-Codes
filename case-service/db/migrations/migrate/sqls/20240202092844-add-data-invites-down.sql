-- Add new status types to business_status ENUM
ALTER TYPE business_status ADD VALUE 'INACTIVE';
ALTER TYPE business_status ADD VALUE 'ACTIVE';

-- Commit the changes made to the ENUM
COMMIT;

-- Create a new enumerated type without the values you want to remove
CREATE TYPE new_business_status AS ENUM ('INACTIVE', 'ACTIVE', 'DISABLED');

-- Remove the default value for the status column
ALTER TABLE data_businesses
    ALTER COLUMN status DROP DEFAULT;

-- Update entries in data_businesses based on the condition
UPDATE data_businesses
SET status = CASE 
    WHEN status = 'UNVERIFIED' THEN 'INACTIVE'::business_status
    ELSE 'ACTIVE'::business_status
END
WHERE status IN ('VERIFIED', 'UNVERIFIED');

-- Alter the data_businesses table to change the column type to the new enum type
ALTER TABLE data_businesses
    ALTER COLUMN status TYPE new_business_status
    USING status::text::new_business_status;

-- Drop the old enum type
DROP TYPE business_status;

-- Create a new enumerated type without the values you want to remove
CREATE TYPE business_status AS ENUM ('INACTIVE', 'ACTIVE', 'DISABLED');

-- Alter the data_businesses table to change the column type to the old enum type
ALTER TABLE data_businesses
    ALTER COLUMN status TYPE business_status
    USING status::text::business_status;

-- Drop the enum type
DROP TYPE new_business_status;


DROP TABLE IF EXISTS "data_invites_history";

DROP TABLE IF EXISTS "data_invites";

DROP TABLE IF EXISTS "core_invite_statuses";