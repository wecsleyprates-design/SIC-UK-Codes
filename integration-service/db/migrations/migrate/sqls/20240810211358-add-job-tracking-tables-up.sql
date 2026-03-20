CREATE schema jobs;


create table jobs.request (
    id UUID not null default gen_random_uuid() primary key,
    type int not null default 0,
    state int not null default 0,
    trigger int not null default 0,
    customer_id UUID,
    business_id UUID,
    metadata jsonb not null default '{}',
    comments text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone,
    started_at TIMESTAMP with time zone,
    completed_at timestamp with time zone,
    errored_at timestamp with time zone,
    updated_by UUID,
    created_by UUID not null
);

CREATE INDEX IF NOT EXISTS idx_request_business_id
    ON jobs.request USING btree
    (business_id ASC NULLS LAST)
    TABLESPACE pg_default;

    CREATE INDEX IF NOT EXISTS idx_request_customer_id
    ON jobs.request USING btree
    (customer_id ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_request_started_at
    ON jobs.request USING btree
    (started_at DESC NULLS FIRST)
    TABLESPACE pg_default;

CREATE TABLE jobs.job (
    id UUID not null default gen_random_uuid() primary key,
    request_id UUID not null CONSTRAINT fk_request
    REFERENCES jobs.request(id),
    state int not null default 0,
    business_id UUID,
    customer_id UUID,
    metadata jsonb not null default '{}',
    created_at timestamp with time zone default now(),
    started_at TIMESTAMP with time zone,
    completed_at timestamp with time zone,
    errored_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_job_started_at
    ON jobs.job USING btree
    (started_at DESC NULLS FIRST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_job_request_id
    ON jobs.job USING btree
    (request_id ASC)
    TABLESPACE pg_default;

CREATE TABLE jobs.job_history (
    id UUID not null default gen_random_uuid() primary key,
    job_id UUID not null CONSTRAINT fk_job
    REFERENCES jobs.job(id) on delete cascade on update cascade,
    state int not null default 0,
    type int not null default 0,
    comments text,
    metadata jsonb not null default '{}',
    created_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_job_history_job_id
    ON jobs.job_history USING btree
    (job_id ASC)
    TABLESPACE pg_default;


COMMENT ON TABLE jobs.request IS 'Store information about various job requests and their processing states. A request has one or many jobs';
COMMENT ON TABLE jobs.job IS 'Store information about each job in a request';
COMMENT ON TABLE jobs.job_history IS 'Store state changes on jobs';


