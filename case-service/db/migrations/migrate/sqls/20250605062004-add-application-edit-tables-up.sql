/* Replace with your SQL commands */

-- create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS application_edits;

CREATE TABLE application_edits.data_application_edits (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    case_id UUID NOT NULL,
    business_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    stage_name varchar(100), 
    field_name varchar(100),
    old_value varchar DEFAULT NULL,
    new_value varchar DEFAULT NULL,
    metadata JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    CONSTRAINT case_id_fk FOREIGN KEY (case_id) REFERENCES data_cases(id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT business_id_fk FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE ON UPDATE RESTRICT
);
