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
-- Table structure for table `core_case_statuses`
--
CREATE TABLE core_case_statuses (
    id serial NOT NULL PRIMARY KEY,
    code varchar NOT NULL UNIQUE,
    label varchar NOT NULL
);

INSERT INTO core_case_statuses (id, code, label) VALUES
    (1, 'INVITED','INVITED'),
    (2, 'INVITE_EXPIRED','INVITE EXPIRED'),
    (3, 'ONBOARDING','ONBOARDING'),
    (4, 'UNDER_MANUAL_REVIEW','UNDER MANUAL REVIEW'),
    (5, 'MANUALLY_APPROVED','MANUALLY APPROVED'),
    (6, 'AUTO_APPROVED','AUTO APPROVED'),
    (7, 'SCORE_CALCULATED','SCORE CALCULATED'),
    (8, 'REJECTED','REJECTED'),
    (9, 'ARCHIVED','ARCHIVED'), 
    (10, 'PENDING_DECISION','PENDING DECISION'),
    (11, 'INFORMATION_REQUESTED','INFORMATION REQUESTED');


--
-- Table structure for table `data_businesses`
--
CREATE TABLE data_businesses (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name VARCHAR(100) NULL,
    tin VARCHAR(9) NULL,
    mobile VARCHAR(15) NULL UNIQUE,
    official_website VARCHAR(50) NULL,
    public_website VARCHAR(50) NULL,
    social_account VARCHAR(50) NULL,
    address_apartment VARCHAR(50) NULL,
    address_line_1 VARCHAR(100) NULL,
    address_line_2 VARCHAR(100) NULL,
    address_city VARCHAR(25) NULL,
    address_state VARCHAR NULL,
    address_postal_code VARCHAR(10) NULL,
    address_country VARCHAR NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON data_businesses 
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

--
-- Table structure for table `data_cases`
--
CREATE TABLE data_cases (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    applicant_id UUID NOT NULL,
    customer_id UUID NULL,
    business_id UUID NOT NULL REFERENCES data_businesses(id),
    status INT NOT NULL REFERENCES core_case_statuses(id),
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT status_fk FOREIGN KEY (status) REFERENCES core_case_statuses(id),
    CONSTRAINT business_id_fk FOREIGN KEY (business_id) REFERENCES data_businesses(id)
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON data_cases 
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

--
-- Table structure for table `data_case_status_history`
--
CREATE TABLE data_case_status_history (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES data_cases(id),
    status INT NOT NULL REFERENCES core_case_statuses(id),
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    CONSTRAINT status_fk FOREIGN KEY (status) REFERENCES core_case_statuses(id),
    CONSTRAINT case_id_fk FOREIGN KEY (case_id) REFERENCES data_cases(id)
);

--
-- Table structure for table `core_owner_titles`
--
CREATE TABLE core_owner_titles (
    id INT NOT NULL PRIMARY KEY,
    title VARCHAR NOT NULL UNIQUE
);

INSERT INTO core_owner_titles (id, title) VALUES
    (1, 'Partner'),
    (2, 'Limited Partner'),
    (3, 'Director'),
    (4, 'PARTNER'),
    (5, 'Chief Accounting Officer'),
    (6, 'Chief Executive Officer'),
    (7, 'Chief Operations Officer'),
    (8, 'President'),
    (9, 'Vice President'),
    (10, 'Treasurer'),
    (11, 'Assistant Treasurer'),
    (12, '1% Shareholder'),
    (13, 'Shareholder'),
    (14, 'Controller'),
    (15, 'Managing Member'),
    (16, 'Owner'),
    (17, 'Sole Proprietor'),
    (18, 'Executor'),
    (19, 'Beneficiary'),
    (20, 'Trustee'),
    (21, 'Administrator');

--
-- Table structure for table `data_owners`
--
CREATE TABLE data_owners (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    title INT NOT NULL REFERENCES core_owner_titles(id),
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    SSN VARCHAR(9) NOT NULL,
    email VARCHAR(50) NULL,
    mobile VARCHAR(15) NULL,
    date_of_birth DATE NOT NULL,
    address_apartment VARCHAR(50) NULL,
    address_line_1 VARCHAR(100) NOT NULL,
    address_line_2 VARCHAR(100) NULL,
    address_city VARCHAR(50) NOT NULL,
    address_state VARCHAR NOT NULL,
    address_postal_code VARCHAR(10) NULL,
    address_country VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT title_fk FOREIGN KEY (title) REFERENCES core_owner_titles(id)
);
 
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON data_owners
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

--
-- Table structure for table `rel_business_owners`
--
CREATE TABLE rel_business_owners (
    business_id UUID NOT NULL REFERENCES data_businesses(id),
    owner_id UUID NOT NULL REFERENCES data_owners(id),
    ownership_percentage DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (business_id, owner_id),
    CONSTRAINT owner_id_fk FOREIGN KEY (owner_id) REFERENCES data_owners(id),
    CONSTRAINT business_id_fk FOREIGN KEY (business_id) REFERENCES data_businesses(id)
);
 
--
-- Table structure for table `rel_business_customer_monitoring`
--
CREATE TABLE rel_business_customer_monitoring (
    business_id UUID NOT NULL REFERENCES data_businesses(id),
    customer_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    PRIMARY KEY (business_id, customer_id),
    CONSTRAINT business_id_fk FOREIGN KEY (business_id) REFERENCES data_businesses(id)
);
 
--
-- Table structure for table `rel_business_applicants`
--
CREATE TABLE rel_business_applicants (
    business_id UUID NOT NULL REFERENCES data_businesses(id),
    applicant_id UUID NOT NULL,
    PRIMARY KEY (business_id, applicant_id),
    CONSTRAINT business_id_fk FOREIGN KEY (business_id) REFERENCES data_businesses(id)
);
