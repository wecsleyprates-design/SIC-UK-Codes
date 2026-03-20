/* Replace with your SQL commands */
create table if not exists integration_data.bureau_credit_score (
    id uuid NOT NULL DEFAULT gen_random_uuid() NOT NULL,
    business_integration_task_id uuid NOT NULL,
    business_id uuid NOT NULL,
    platform_id integer NOT NULL,
    external_id character varying(100) COLLATE pg_catalog."default",
	score smallint,
    as_of date,
	meta jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
        CONSTRAINT bureau_credit_score_pkey PRIMARY KEY (id),
    CONSTRAINT fk_business_integration_tasks_id_bureau_credit_score FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT bureau_creditscore_unique UNIQUE (business_id, platform_id, external_id),
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE
);
insert into integrations.core_categories (id,code,label) values(8,'bureau','Credit Bureau') on conflict do nothing;

insert into integrations.core_integrations_platforms (id,code,label,category_id) values(16,'equifax','Equifax',8) on conflict do nothing;

insert into integrations.core_tasks (id,code,label) values(11,'fetch_bureau_score_owners','Pull credit scores for the business owners') on conflict do nothing;


insert into integrations.rel_tasks_integrations values (41,11,16) on conflict do nothing;