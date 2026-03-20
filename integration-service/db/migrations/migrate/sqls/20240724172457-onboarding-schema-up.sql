CREATE SCHEMA "onboarding_schema";

CREATE TABLE onboarding_schema.data_customer_settings
(
    customer_id uuid NOT NULL,
    domain      varchar(512) NOT NULL UNIQUE,
    settings    jsonb default '{}',
    created_at  date default now(),
    updated_at  date,
		CONSTRAINT pk_data_customer_settings PRIMARY KEY (customer_id)
);




