/* Replace with your SQL commands */
-- Seed data
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (18, 'plaid_idv', 'Plaid Identity Verification', 2);

-- Seed data
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (13, 'fetch_identity_verification', 'Fetch Identity Verification');

-- Seed data
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") VALUES (43, 13, 18);

DROP TABLE IF EXISTS "integration_data"."identity_verification";

CREATE TABLE IF NOT EXISTS "integration_data"."identity_verification" (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    business_integration_task_id uuid NOT NULL,
    business_id uuid NOT NULL,
    platform_id integer NOT NULL,
    external_id character varying(100) COLLATE pg_catalog."default",
    applicant_id UUID,
	status smallint,
	meta jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    CONSTRAINT fk_business_integration_tasks_id_idv_status FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT idv_status_unique UNIQUE (business_id, platform_id, external_id),
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_idv_status_applicant_id ON integration_data.identity_verification (applicant_id);
CREATE INDEX IF NOT EXISTS idx_idv_status_external_id ON integration_data.identity_verification (external_id);

CREATE OR REPLACE TRIGGER update_identity_verifications_tasks_timestamp
    AFTER UPDATE 
    ON integration_data.identity_verification
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at();
