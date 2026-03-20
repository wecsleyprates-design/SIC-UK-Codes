CREATE TYPE business_status AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'DISABLED'
);

ALTER TABLE IF EXISTS data_businesses ADD COLUMN status business_status NOT NULL DEFAULT 'INACTIVE';

UPDATE data_businesses SET status = 
                          CASE
                            WHEN tin IS NOT NULL THEN 'ACTIVE'::business_status
                            WHEN tin IS NULL THEN 'INACTIVE'::business_status
                          END;