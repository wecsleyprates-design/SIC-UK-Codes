--
-- Function to update updated_at column on any column update of that row.
--

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


--
-- Table structure for table `core_integration_categories`
--

CREATE TABLE core_integration_categories (
    id serial NOT NULL PRIMARY KEY,
    code VARCHAR UNIQUE NOT NULL,
    label VARCHAR UNIQUE NOT NULL
);

INSERT INTO core_integration_categories (id, code, label) VALUES 
(1, 'accounting','Accounting'),
(2, 'banking','Banking'),
(3, 'verification','Verification');

--
-- Table structure for table `core_integrations`
--

CREATE TABLE core_integrations (
    id serial NOT NULL PRIMARY KEY,
    code VARCHAR UNIQUE NOT NULL,
    label VARCHAR UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL,
    category_id INT NOT NULL,
    CONSTRAINT category_id_fk FOREIGN KEY (category_id) REFERENCES core_integration_categories(id)
);

INSERT INTO core_integrations (id, code, label, is_active, category_id) VALUES 
(1, 'plaid','Plaid', True, 2);

INSERT INTO core_integrations (id, code, label, is_active, category_id) VALUES 
(2, 'quickbooks','Quickbooks', True, 1);

INSERT INTO core_integrations (id, code, label, is_active, category_id) VALUES 
(3, 'persona','Persona', True, 3);


-- Create the ENUM type
CREATE TYPE integration_status AS ENUM ('COMPLETED', 'INITIATED', 'FAILED');

--
-- Table structure for table `data_integrations`
--

CREATE TABLE data_integrations (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    integration_id INT NOT NULL,
    data json NOT NULL,
    status integration_status NOT NULL,
    business_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT integration_id_fk FOREIGN KEY (integration_id) REFERENCES core_integrations(id),
    CONSTRAINT unique_business_integration UNIQUE (business_id, integration_id)
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON data_integrations 
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

