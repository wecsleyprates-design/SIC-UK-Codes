CREATE TYPE customer_integration_status AS ENUM ('ENABLED', 'DISABLED', 'REQUIRED');

CREATE TABLE integrations.core_integration_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    integration_code VARCHAR NOT NULL,
    integration_label VARCHAR NOT NULL,
    status customer_integration_status NOT NULL
);

INSERT INTO integrations.core_integration_status 
    (integration_code, integration_label, status)
VALUES
    ('middesk', 'Middesk', 'ENABLED'),
    ('verdata', 'Verdata', 'ENABLED');
    
CREATE TABLE integrations.data_customer_integration_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL,
    integration_status_id UUID NOT NULL,
    status customer_integration_status NOT NULL,
    CONSTRAINT integration_status_id_fk FOREIGN KEY (integration_status_id) REFERENCES integrations.core_integration_status(id),
    CONSTRAINT customer_integration_unique UNIQUE (customer_id, integration_status_id)
);