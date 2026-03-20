/* Replace with your SQL commands */

DROP TRIGGER IF EXISTS update_data_documents_timestamp ON esign.data_documents;

DROP TRIGGER IF EXISTS update_data_document_templates_timestamp ON esign.data_document_templates;

DROP TABLE IF EXISTS esign.rel_customer_templates;

DROP TABLE IF EXISTS esign.data_documents;

DROP TABLE IF EXISTS esign.data_document_templates;

DROP SCHEMA IF EXISTS esign;

