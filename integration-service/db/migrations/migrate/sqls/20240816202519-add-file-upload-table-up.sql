create schema if not exists files;

create table if not exists files.uploads (
    id UUID primary key default uuid_generate_v4(),
    display_name varchar(255) not null,
    file_name varchar(255) not null,
    file_size int, -- in bytes
    mime_type varchar(255),
    customer_id uuid,
    business_id uuid,
    s3_bucket varchar(64) not null,
    s3_key varchar(1024) not null,
    created_by uuid not null,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    metadata jsonb not null default '{}'
);

CREATE INDEX IF NOT EXISTS idx_uploads_customer_id
    ON files.uploads USING btree
    (customer_id ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_uploads_created_by
    ON files.uploads USING btree
    (created_by ASC NULLS LAST)
    TABLESPACE pg_default;