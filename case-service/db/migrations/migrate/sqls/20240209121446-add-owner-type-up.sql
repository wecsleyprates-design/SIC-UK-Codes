CREATE TYPE owner_type AS ENUM (
  'CONTROL',
  'BENEFICIARY'
);

--- Add column owner_type as enum
ALTER TABLE IF EXISTS rel_business_owners ADD COLUMN owner_type owner_type NOT NULL DEFAULT 'BENEFICIARY';

--- Update old owners as CONTROL owner
UPDATE rel_business_owners SET owner_type = 'CONTROL'::owner_type;
