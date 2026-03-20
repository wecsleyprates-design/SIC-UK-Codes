-- Using a JSONB column while the worth score categories are still in flux
-- Once the structure is finalized, we can then consider
-- normalizing the data into separate columns or tables
CREATE TABLE IF NOT EXISTS integration_data.insights_report (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_data JSONB not null,
    external_id uuid not null, -- case_id
    created_at timestamp with time zone not null default now()
);

CREATE TABLE IF NOT EXISTS integration_data.insights_action_items (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_item text not null,
    external_id uuid not null, -- case_id
    is_complete boolean not null default false,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);