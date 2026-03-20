 INSERT INTO "integrations"."core_categories" ("id", "code", "label") VALUES (6, 'commerce', 'Commerce') on conflict do nothing;

-- Seed the enums for rutter platforms
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (5, 'rutter_quickbooks', 'Quickbooks', 1);
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (6, 'rutter_xero', 'Xero', 1);
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (7, 'rutter_zoho', 'Zoho', 1);
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (8, 'rutter_freshbooks', 'Freshbooks', 1);
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (9, 'rutter_quickbooksdesktop', 'Quickbooks Desktop', 1);
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (10, 'rutter_wave', 'Wave', 1);
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (11, 'rutter_netsuite', 'NetSuite', 1);
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (12, 'rutter_stripe', 'Stripe', 6);
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (13, 'rutter_square', 'Square', 6);
 INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (14, 'rutter_paypal', 'PayPal', 6);

INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (5, 'fetch_cash_flow','Fetch Cash Flow statements');
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (6, 'fetch_accounting_records', 'Fetch all Accounting Records');
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (7, 'fetch_accounting_business_info','Fetch Business Information Profile');
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (8, 'fetch_commerce_payments', 'Fetch Commerce Payment Records');
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (9, 'fetch_commerce_records', 'Fetch Commerce Records');



/* Add links for all */
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (5, 1, 5);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (6, 2, 5);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (7, 5, 5);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (8, 6, 5);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (9, 7, 5);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (10, 1, 6);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (11, 2, 6);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (12, 5, 6);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (13, 6, 6);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (14, 7, 6);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (15, 1, 7);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (16, 2, 7);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (17, 5, 7);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (18, 6, 7);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (19, 7, 7);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (20, 1, 8);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (21, 2, 8);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (22, 5, 8);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (23, 6, 8);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (24, 7, 8);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (25, 1, 9);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (26, 2, 9);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (27, 5, 9);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (28, 6, 9);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (29, 7, 9);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (30, 1, 10);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (31, 2, 10);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (32, 5, 10);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (33, 6, 10);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (34, 7, 10);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (35, 1, 11);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (36, 2, 11);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (37, 5, 11);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (38, 6, 11);
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (39, 7, 11);


CREATE INDEX IF NOT EXISTS idx_connections_access_token
    ON integrations.data_connections USING btree
    (((configuration -> 'connection'::text) ->> 'access_token'::text) COLLATE pg_catalog."default" ASC NULLS LAST)
    WITH (deduplicate_items=True)
    TABLESPACE pg_default;

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_connection_id
    ON integrations.data_connections USING btree
    (((configuration -> 'connection'::text) ->> 'id'::text) COLLATE pg_catalog."default" ASC NULLS LAST)
    WITH (deduplicate_items=True)
    TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS integration_data.accounting_balancesheet
(
    id uuid NOT NULL DEFAULT gen_random_uuid() NOT NULL,
    business_integration_task_id uuid NOT NULL,
    business_id uuid NOT NULL,
    platform_id integer NOT NULL,
    external_id character varying(100) COLLATE pg_catalog."default",
    start_date date,
    end_date date,
    currency character(3) COLLATE pg_catalog."default",
    total_assets numeric,
    total_equity numeric,
    total_liabilities numeric,
    assets jsonb,
    equity jsonb,
    liabilities jsonb,
    meta jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    CONSTRAINT accounting_balancesheet_pkey PRIMARY KEY (id),
    CONSTRAINT fk_business_integration_tasks_id_accounting_balancesheet FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT accounting_balancesheet_unique UNIQUE (business_id, platform_id, external_id),
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_balancesheet_external_id
    ON integration_data.accounting_balancesheet USING btree
    (external_id COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

---
CREATE TABLE IF NOT EXISTS integration_data.accounting_cashflow
(
    id uuid NOT NULL DEFAULT gen_random_uuid() NOT NULL,
    business_integration_task_id uuid NOT NULL,
    business_id uuid NOT NULL,
    platform_id integer NOT NULL,
    external_id character varying(100) COLLATE pg_catalog."default",
    start_date date,
    end_date date,
    currency character(3) COLLATE pg_catalog."default",
    starting_balance numeric,
    ending_balance numeric,
    net_flow numeric,
    gross_cash_in numeric,
    gross_cash_out numeric,
    total_operating_activities numeric,
    total_investing_activities numeric,
    total_financing_activities numeric,
    operating_activities jsonb,
    investing_activities jsonb,
    financing_activities jsonb,
    meta jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    CONSTRAINT accounting_cashflow_pkey PRIMARY KEY (id),
    CONSTRAINT fk_business_integration_tasks_id_accounting_cashflow FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT accounting_cashflow_unique UNIQUE (business_id, platform_id, external_id),
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cashflow_external_id
    ON integration_data.accounting_cashflow USING btree
    (external_id COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS integration_data.accounting_incomestatement
(
    id uuid NOT NULL DEFAULT gen_random_uuid() NOT NULL,
    business_integration_task_id uuid NOT NULL,
    external_id character varying(100) COLLATE pg_catalog."default",
    business_id uuid NOT NULL,
    platform_id integer NOT NULL,
    start_date date,
    end_date date,
    currency character(3) COLLATE pg_catalog."default",
    accounting_standard smallint,
    net_income numeric,
    total_revenue numeric,
    total_depreciation numeric,
    total_expenses numeric,
    total_cost_of_goods_sold numeric,
    revenue jsonb,
    expenses jsonb,
    cost_of_sales jsonb,
    meta jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    CONSTRAINT accounting_incomestatement_pkey PRIMARY KEY (id),
    CONSTRAINT fk_business_integration_tasks_id_accounting_incomestatement FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT accounting_incomestatement_unique UNIQUE (business_id, platform_id, external_id),
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_incomestatement_external_id
    ON integration_data.accounting_incomestatement USING btree
    (external_id COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

create table if not exists integration_data.accounting_PandL (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    business_integration_task_id uuid not null,
    business_id uuid NOT NULL,
    platform_id integer NOT NULL,
    external_id character varying(100) COLLATE pg_catalog."default",
  start_date date,
  end_date date,
  sales_products decimal,
  sales_services decimal,
  sales_other decimal,
  cogs_products decimal,
  cogs_services decimal,
  cogs_other decimal,
  all_expenses decimal,
  taxes decimal,
    CONSTRAINT accounting_pandl_pkey PRIMARY KEY (id),
    CONSTRAINT fk_business_integration_tasks_id_accounting_pandl FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE
  );

CREATE INDEX IF NOT EXISTS idx_pandl_external_id
    ON integration_data.accounting_pandl USING btree
    (external_id COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

ALTER TABLE integrations.data_business_integrations_tasks ALTER column ID set default gen_random_uuid();
ALTER TABLE integrations.business_integration_tasks_events ALTER column ID set default gen_random_uuid();
ALTER TABLE integrations.data_connections_history ALTER column ID set default gen_random_uuid();

CREATE TABLE IF NOT EXISTS integration_data.request_response
(
    request_id UUID NOT NULL DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    platform_id integer NOT NULL,
    external_id character varying(100) COLLATE pg_catalog."default",
    request_type character varying COLLATE pg_catalog."default",
    requested_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    connection_id uuid NOT NULL,
    response jsonb,
    request_received timestamp with time zone,
    org_id uuid,
    request_code character varying COLLATE pg_catalog."default",
    idempotency_key uuid,
    async_key uuid,
    status integer,
    CONSTRAINT request_response_pkey PRIMARY KEY (request_id),
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE
);


COMMENT ON TABLE integration_data.request_response
    IS 'temporary table to store raw responses from 3rd party system';


CREATE INDEX IF NOT EXISTS ix_async_key
    ON integration_data.request_response USING btree
    (async_key ASC NULLS LAST)
    TABLESPACE pg_default;


CREATE INDEX IF NOT EXISTS ix_idempotency_key
    ON integration_data.request_response USING btree
    (idempotency_key ASC NULLS LAST)
    TABLESPACE pg_default;


CREATE INDEX IF NOT EXISTS ix_request_most_recent
    ON integration_data.request_response USING btree
    (business_id ASC NULLS LAST, request_type COLLATE pg_catalog."default" ASC NULLS LAST, request_received DESC NULLS FIRST)
    TABLESPACE pg_default;


CREATE INDEX IF NOT EXISTS ix_request_response_connection_id
    ON integration_data.request_response USING btree
    (connection_id ASC NULLS LAST)
    WITH (deduplicate_items=True)
    TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS integration_data.accounting_business_info
(
    id uuid NOT NULL DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    business_integration_task_id uuid NOT NULL,
    business_id uuid NOT NULL,
    platform_id integer NOT NULL,
    external_id character varying(100),
	display_name character varying(100),
	currencies character varying(5)[],
	legal_name character varying(100),
	tin character varying(100),
	addresses jsonb,
	country character varying(5),
	state character varying(10),
	city character varying(100),
	postal character varying(30),
	phone character varying(20),
	fax character varying(20),
	email character varying(100),
    corptype smallint,
	meta jsonb,
	created_at timestamp,
	updated_at timestamp,
	CONSTRAINT fk_business_integration_tasks_id_accounting_company_info FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT accounting_company_info_unique UNIQUE (business_id, platform_id, external_id),
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE);