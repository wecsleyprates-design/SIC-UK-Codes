/* Replace with your SQL commands */

-- create esign schema
CREATE SCHEMA IF NOT EXISTS esign;

-- create table esign.data_document_templates
CREATE TABLE esign.data_document_templates (
    template_id UUID DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    name VARCHAR(255) NULL,
    customer_id UUID NULL,
    version INTEGER NOT NULL DEFAULT 1,
    template_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID NOT NULL
);

CREATE TRIGGER update_data_document_templates_timestamp
BEFORE UPDATE ON esign.data_document_templates
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- create table esign.data_documents
CREATE TABLE esign.data_documents (
    document_id UUID DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
    template_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    business_id UUID NOT NULL,
    case_id UUID NOT NULL,
    signed_by UUID NULL,
    mapping_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID NOT NULL,
    CONSTRAINT fk_template_id FOREIGN KEY (template_id) REFERENCES esign.data_document_templates(template_id) ON DELETE CASCADE
);

CREATE TRIGGER update_data_documents_timestamp
BEFORE UPDATE ON esign.data_documents
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- create rel-table
CREATE TABLE esign.rel_customer_templates (
    customer_id UUID NOT NULL,
    template_id UUID NOT NULL,
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (customer_id, template_id),
    CONSTRAINT fk_template_id FOREIGN KEY (template_id) REFERENCES esign.data_document_templates(template_id) ON DELETE CASCADE
);
