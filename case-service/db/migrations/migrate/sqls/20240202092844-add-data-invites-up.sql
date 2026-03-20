CREATE TABLE core_invite_statuses (
    id serial NOT NULL PRIMARY KEY,
    code varchar NOT NULL UNIQUE,
    label varchar NOT NULL
);

INSERT INTO core_invite_statuses (id, code, label) VALUES
    (1, 'invited','INVITED'),
    (2, 'expired','EXPIRED'),
    (3, 'accepted','ACCEPTED'),
    (4, 'completed','COMPLETED'),
    (5, 'rejected','REJECTED');


CREATE TABLE data_invites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,  
	business_id uuid NOT NULL,
	customer_id uuid NOT NULL,
	status INT NOT NULL,
    action_taken_by UUID NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT "fk_business_id_data_invites" FOREIGN KEY ("business_id") REFERENCES "data_businesses" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "fk_status_data_invites" FOREIGN KEY ("status") REFERENCES "core_invite_statuses" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON data_invites
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE data_invites_history (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    invitation_id UUID NOT NULL,
    status INT NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NULL,
    CONSTRAINT "fk_invitation_id_data_invites_history" FOREIGN KEY ("invitation_id") REFERENCES "data_invites" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "fk_status_data_invites_history" FOREIGN KEY ("status") REFERENCES "core_invite_statuses" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- Add new status types to business_status ENUM
ALTER TYPE business_status ADD VALUE 'VERIFIED';
ALTER TYPE business_status ADD VALUE 'UNVERIFIED';

-- Commit the changes made to the ENUM
COMMIT;

-- Create a new enumerated type without the values you want to remove
CREATE TYPE new_business_status AS ENUM ('VERIFIED', 'UNVERIFIED');

-- Remove the default value for the status column
ALTER TABLE data_businesses
    ALTER COLUMN status DROP DEFAULT;

-- Update entries in data_businesses based on the condition
UPDATE data_businesses
SET status = CASE 
    WHEN status = 'INACTIVE' THEN 'UNVERIFIED'::business_status
    ELSE 'VERIFIED'::business_status
END
WHERE status IN ('INACTIVE', 'ACTIVE', 'DISABLED');

-- Alter the data_businesses table to change the column type to the new enum type
ALTER TABLE data_businesses
    ALTER COLUMN status TYPE new_business_status
    USING status::text::new_business_status;

-- Drop the old enum type
DROP TYPE business_status;

-- Create a new enumerated type without the values you want to remove
CREATE TYPE business_status AS ENUM ('VERIFIED', 'UNVERIFIED');

-- Alter the data_businesses table to change the column type to the old enum type
ALTER TABLE data_businesses
    ALTER COLUMN status TYPE business_status
    USING status::text::business_status;

-- Drop the enum type
DROP TYPE new_business_status;

