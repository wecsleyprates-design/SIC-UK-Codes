CREATE SCHEMA purge_business;

CREATE TABLE IF NOT EXISTS purge_business.data_purged_businesses (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    business_id UUID NOT NULL,
    customer_id UUID NULL,
    name TEXT NOT NULL,
    tin TEXT NULL,
    deleted_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    deleted_by UUID NULL
);
