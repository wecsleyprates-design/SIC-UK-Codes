--- Drop column owner_type
ALTER TABLE IF EXISTS rel_business_owners DROP COLUMN owner_type;

--- Drop type owner_type
DROP TYPE IF EXISTS owner_type;