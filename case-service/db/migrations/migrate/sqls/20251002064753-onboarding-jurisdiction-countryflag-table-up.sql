/* Replace with your SQL commands */

-- Create core_jurisdictions table
CREATE TABLE onboarding_schema.core_jurisdictions (
	jurisdiction_code varchar(2) NOT NULL,
	flag_code varchar(2) NULL,
	"name" varchar NOT NULL,
	order_index int NOT NULL,
	CONSTRAINT core_jurisdictions_flag_code_check CHECK (((flag_code)::text = upper((flag_code)::text))),
	CONSTRAINT core_jurisdictions_jurisdiction_code_check CHECK (((jurisdiction_code)::text = upper((jurisdiction_code)::text))),
	CONSTRAINT core_jurisdictions_pk PRIMARY KEY (jurisdiction_code)
);
COMMENT ON TABLE onboarding_schema.core_jurisdictions IS 'Supported countries/jurisdictions';

-- Insert default jurisdictions
INSERT INTO onboarding_schema.core_jurisdictions (jurisdiction_code, flag_code, "name", order_index) VALUES
	('US', 'US', 'United States', 1),
	('CA', 'CA', 'Canada', 2),
	('UK', 'GB', 'United Kingdom', 3);

-- Create rel_customer_setup_countries table
CREATE TABLE onboarding_schema.rel_customer_setup_countries (
	customer_id uuid NOT NULL,
	setup_id int4 NOT NULL,
	jurisdiction_code varchar(2) NOT NULL,
	is_enabled bool DEFAULT true NOT NULL,
	CONSTRAINT rel_customer_setup_countries_pk PRIMARY KEY (customer_id, setup_id, jurisdiction_code),
	CONSTRAINT rel_customer_setup_countries_jurisdiction_fk FOREIGN KEY (jurisdiction_code) REFERENCES onboarding_schema.core_jurisdictions(jurisdiction_code),
	CONSTRAINT rel_customer_setup_countries_setup_fk FOREIGN KEY (setup_id) REFERENCES onboarding_schema.core_onboarding_setup_types(id)
);
COMMENT ON TABLE onboarding_schema.rel_customer_setup_countries IS 'Enabled countries for a customer in the onboarding setup';
