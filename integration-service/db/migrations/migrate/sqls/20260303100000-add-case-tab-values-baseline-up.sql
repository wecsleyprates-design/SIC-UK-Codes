-- Store "created_at" baseline per case for case tab values. When user clicks "Re-verify Data Now"
-- and execution succeeds, we set created_at = now() here; GET /values uses it and resets
-- has_updates_since_generated and updates_count accordingly.
CREATE TABLE IF NOT EXISTS integration_data.case_results_executions (
    case_id UUID NOT NULL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')
);

COMMENT ON TABLE integration_data.case_results_executions IS 'Baseline timestamp for case tab values; updated when user acknowledges (Re-verify Data Now).';
