create table
    integration_data.payment_processor_merchant_profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
        platform_id integer not null,
        "business_id" UUID  NOT NULL,
        "customer_id" UUID NOT NULL,
        profile jsonb not null DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW (),
        updated_at TIMESTAMP DEFAULT NOW ()
    );

create index idx_merchant_profile_platform_id_customer_id ON integration_data.payment_processor_merchant_profiles (platform_id, customer_id);

create index idx_merchant_profile_business_id ON integration_data.payment_processor_merchant_profiles (business_id);

CREATE TRIGGER update_merchant_profiles_timestamp AFTER
UPDATE ON integration_data.payment_processor_merchant_profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at ();