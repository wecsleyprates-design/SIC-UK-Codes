/* Create Tables */
create table if not exists integration_data.accounting_business_info_tasks (
	id uuid not null,
	task_id uuid not null,
	created_at timestamp without time zone not null default now(),
	primary key (id,task_id),
	    CONSTRAINT fk_business_integration_tasks_id_accounting_company_info FOREIGN KEY (task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
	    CONSTRAINT fk_id_accounting_company_info FOREIGN KEY (id)
        REFERENCES integration_data.accounting_business_info (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE
);

create table if not exists integration_data.accounting_cashflow_tasks (
	id uuid not null,
	task_id uuid not null,
	created_at timestamp without time zone not null default now(),
	primary key (id,task_id),
	    CONSTRAINT fk_business_integration_tasks_id_accounting_cashflow FOREIGN KEY (task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
	    CONSTRAINT fk_id_accounting_cashflow FOREIGN KEY (id)
        REFERENCES integration_data.accounting_cashflow (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE
);

create table if not exists integration_data.accounting_balancesheet_tasks (
	id uuid not null,
	task_id uuid not null,
	created_at timestamp without time zone not null default now(),
	primary key (id,task_id),
	    CONSTRAINT fk_business_integration_tasks_id_accounting_balancesheet FOREIGN KEY (task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
	    CONSTRAINT fk_id_accounting_balancesheet FOREIGN KEY (id)
        REFERENCES integration_data.accounting_balancesheet (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE
);

create table if not exists integration_data.accounting_incomestatement_tasks (
	id uuid not null,
	task_id uuid not null,
	created_at timestamp without time zone not null default now(),
	primary key (id,task_id),
	    CONSTRAINT fk_business_integration_tasks_id_accounting_incomestatement FOREIGN KEY (task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
	    CONSTRAINT fk_id_accounting_incomestatement FOREIGN KEY (id)
        REFERENCES integration_data.accounting_incomestatement (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE
);

/* Backfill data */
insert into integration_data.accounting_business_info_tasks (select id,business_integration_task_id,created_at from integration_data.accounting_business_info) on conflict do nothing;
insert into integration_data.accounting_cashflow_tasks (select id,business_integration_task_id,created_at from integration_data.accounting_cashflow) on conflict do nothing;
insert into integration_data.accounting_balancesheet_tasks (select id,business_integration_task_id,created_at from integration_data.accounting_balancesheet) on conflict do nothing;
insert into integration_data.accounting_incomestatement_tasks (select id,business_integration_task_id,created_at from integration_data.accounting_incomestatement) on conflict do nothing;
