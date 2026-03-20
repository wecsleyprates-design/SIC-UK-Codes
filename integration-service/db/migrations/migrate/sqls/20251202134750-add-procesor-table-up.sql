CREATE TABLE
    integration_data.payment_processors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        customer_id UUID NOT NULL, -- Customer that owns this record
        name VARCHAR(255) NOT NULL, -- Customer provided friendly name for the processor.
        status smallint not null, -- See PaymentProcessorStatus enum for possible values.
        platform_id INTEGER NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW (),
        updated_at TIMESTAMP DEFAULT NOW (),
        deleted_at TIMESTAMP DEFAULT NULL,
        created_by UUID NOT NULL,
        updated_by UUID NOT NULL,
        deleted_by UUID DEFAULT NULL,
        CONSTRAINT fk_platform_id FOREIGN KEY (platform_id) REFERENCES integrations.core_integrations_platforms (id) ON DELETE RESTRICT
    );

    create unique index idx_payment_processors_customer_id_name on integration_data.payment_processors (customer_id,name);

ALTER TABLE integration_data.payment_processor_accounts
    ADD COLUMN processor_id UUID NOT NULL,
    ADD CONSTRAINT fk_processor_id
        FOREIGN KEY (processor_id)
        REFERENCES integration_data.payment_processors (id)
        ON DELETE RESTRICT;

    create index idx_payment_processor_accounts_processor_id on integration_data.payment_processor_accounts (processor_id);