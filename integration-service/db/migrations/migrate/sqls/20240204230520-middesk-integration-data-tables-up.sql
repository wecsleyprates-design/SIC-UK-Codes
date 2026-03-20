CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language plpgsql;

-- top level table for business entity verification
CREATE TABLE IF NOT EXISTS integration_data.business_entity_verification
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    business_integration_task_id uuid NOT NULL, -- foreign key referencing the business integration task
    external_id uuid NOT NULL UNIQUE,
    business_id uuid NOT NULL,
    name varchar(255),
    status varchar(50),
    tin varchar(255) NOT NULL, -- Tax Identification Number of the business entity (will not be stored in plain text)
    CONSTRAINT pk_business_entity_verification PRIMARY KEY (id),
    CONSTRAINT fk_business_integration_tasks_id_business_entity_verification FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE -- on deletion of the referenced record, delete this record as well
);

-- trigger to update the updated_at column on each update
CREATE OR REPLACE TRIGGER update_business_entity_verification_timestamp
    AFTER UPDATE ON integration_data.business_entity_verification
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- table for review tasks related to business entity verification
CREATE TABLE IF NOT EXISTS integration_data.business_entity_review_task
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_entity_verification_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    category varchar(255) NOT NULL,
    key varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    message text NOT NULL,
    label varchar(255) NOT NULL,
    sublabel varchar(255) NOT NULL,
    metadata jsonb, -- additional data related to the review task
    CONSTRAINT pk_business_entity_review_task PRIMARY KEY (id),
    CONSTRAINT business_entity_verification_id_key_unique UNIQUE (business_entity_verification_id, key),
    CONSTRAINT fk_business_entity_verification_id_business_entity_review_task FOREIGN KEY (business_entity_verification_id)
        REFERENCES integration_data.business_entity_verification (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE -- on deletion of the referenced record, delete this record as well
);

-- trigger to update the updated_at column on each update
CREATE OR REPLACE TRIGGER update_business_entity_review_task_timestamp
    AFTER UPDATE ON integration_data.business_entity_review_task
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- table for business entity registration data i.e. secretary of state filings
CREATE TABLE IF NOT EXISTS integration_data.business_entity_registration
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_entity_verification_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    external_id uuid NOT NULL UNIQUE,
    name varchar(255),
    status varchar(255),
    sub_status varchar(255),
    status_details text,
    jurisdiction varchar(255),
    entity_type varchar(255),
    file_number varchar(255),
    full_addresses text[], -- array of full addresses for the business entity
    registration_date date,
    registration_state varchar(2),
    source text,
    CONSTRAINT pk_business_entity_registration PRIMARY KEY (id),
    CONSTRAINT fk_business_entity_verification_id_business_entity_registration FOREIGN KEY (business_entity_verification_id)
        REFERENCES integration_data.business_entity_verification (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE -- on deletion of the referenced record, delete this record as well
);

-- trigger to update the updated_at column on each update
CREATE OR REPLACE TRIGGER update_business_entity_registration_timestamp
    AFTER UPDATE ON integration_data.business_entity_registration
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- table for business entity address source data
-- each business entity can have multiple addresses
CREATE TABLE IF NOT EXISTS integration_data.business_entity_address_source
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_entity_verification_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    external_id uuid NOT NULL UNIQUE,
    external_registration_id uuid, -- this informs which (if any) secretary of state filling this 'business address' was associated with
    full_address text,
    address_line_1 text NOT NULL,
    address_line_2 varchar(255),
    city varchar(255) NOT NULL,
    state varchar(2) NOT NULL,
    postal_code varchar(20) NOT NULL,
    lat double precision,
    long double precision,
    submitted boolean,
    deliverable boolean,
    cmra boolean,
    address_property_type varchar(255),
    CONSTRAINT pk_business_entity_address_source PRIMARY KEY (id),
    CONSTRAINT fk_business_entity_verification_id_business_entity_address_source FOREIGN KEY (business_entity_verification_id)
        REFERENCES integration_data.business_entity_verification (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE -- on deletion of the referenced record, delete this record as well
);

-- trigger to update the updated_at column on each update
CREATE OR REPLACE TRIGGER update_business_entity_address_source_timestamp
    AFTER UPDATE ON integration_data.business_entity_address_source
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_business_entity_verification_task_id ON integration_data.business_entity_verification (business_integration_task_id);
CREATE INDEX IF NOT EXISTS idx_business_entity_review_verification_id ON integration_data.business_entity_review_task (business_entity_verification_id);
CREATE INDEX IF NOT EXISTS idx_business_entity_registration_verification_id ON integration_data.business_entity_registration (business_entity_verification_id);
CREATE INDEX IF NOT EXISTS idx_business_entity_address_source_verification_id ON integration_data.business_entity_address_source (business_entity_verification_id);