alter table integration_data.payment_processor_accounts add column status smallint not null default 0;
alter table integration_data.payment_processor_accounts add column manual_sync_at timestamp without time zone;
alter table integration_data.payment_processor_accounts add column webhook_received_at timestamp without time zone;