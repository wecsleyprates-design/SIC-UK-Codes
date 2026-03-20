/* Replace with your SQL commands */
DROP INDEX IF EXISTS integrations.idx_connections_connection_id;

CREATE INDEX IF NOT EXISTS idx_connections_connection_id
    ON integrations.data_connections USING btree
    (((configuration -> 'connection'::text) ->> 'id'::text) COLLATE pg_catalog."default" ASC NULLS LAST)
    WITH (deduplicate_items=True)
    TABLESPACE pg_default;