create table public.data_customer_integration_settings
(
    customer_id uuid
        constraint data_customer_integration_settings_pk
            primary key,
    settings    jsonb not null default '{}'
);
