CREATE TABLE IF NOT EXISTS integration_data.accounting_accounts
(
	id uuid NOT NULL DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
	business_integration_task_id uuid NOT NULL,
	business_id uuid NOT NULL,
	platform_id integer NOT NULL,
	external_id character varying(100),
	balance numeric,
	category character varying(100),
	status character varying(100),
	account_type character varying(100),
	currency character varying(5),
	meta jsonb,
	created_at timestamp,
	updated_at timestamp,
	CONSTRAINT fk_business_integration_tasks_id_accounting_accounts FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT accounting_accounts_unique UNIQUE (business_id, platform_id, external_id),
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE);


INSERT INTO integrations.core_tasks (id, code, label, created_at)
VALUES (17, 'fetch_accounting_accounts', 'Fetch Accounting Accounts', DEFAULT);

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (50, 17, 6);

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (51, 17, 7);

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (52, 17, 8);

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (53, 17, 9);

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (54, 17, 10);

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (55, 17, 11);

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (56, 17, 5);
