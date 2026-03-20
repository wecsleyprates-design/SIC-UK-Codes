/* Replace with your SQL commands */
-- Create the enum type .
CREATE TYPE idv_template_steps_enum AS ENUM ('accept_tos', 'verify_sms', 'kyc_check', 'documentary_verification', 'selfie_check', 'watchlist_screening', 'risk_check');
CREATE TYPE platform_enum AS ENUM ('production', 'sandbox');

-- Create the table using the newly created enum type.
CREATE TABLE integrations.core_identity_verification_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    template_id VARCHAR(255) UNIQUE NOT NULL,
    steps idv_template_steps_enum[] NOT NULL,
    platform platform_enum NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE integration_data.identity_verification
ADD COLUMN template_id INTEGER NULL,
ADD COLUMN shareable_url VARCHAR(255) NULL,
ADD CONSTRAINT fk_template_id FOREIGN KEY (template_id) REFERENCES integrations.core_identity_verification_templates(id) ON DELETE CASCADE;

-- Insertion into core_identity_verification_templates table

INSERT INTO integrations.core_identity_verification_templates (id, name, template_id, steps, platform)
VALUES 
(1, 'Lightning Verification Flow', 'idvtmp_emgBPdc9a4wboC', ARRAY['kyc_check']::idv_template_steps_enum[], 'sandbox'),
(2, 'Lightning And Documentary Verification Flow', 'idvtmp_c728qFdfRADC3s', ARRAY['kyc_check', 'documentary_verification']::idv_template_steps_enum[], 'sandbox'),
(3, 'Lightning And Selfie Verification Flow', 'idvtmp_aB79PgKDNrEsEV', ARRAY['kyc_check', 'selfie_check']::idv_template_steps_enum[], 'sandbox'),
(4, 'Lightning, Documentary And Selfie Verification Flow', 'idvtmp_92TcUL7orpjePY', ARRAY['kyc_check', 'documentary_verification', 'selfie_check']::idv_template_steps_enum[], 'sandbox'),
(5, 'Lightning Verification Flow', 'idvtmp_cAP7um9NqZHN9K', ARRAY['kyc_check']::idv_template_steps_enum[], 'production'),
(6, 'Lightning And Documentary Verification Flow', 'idvtmp_93bETAcyCLMG7i', ARRAY['kyc_check', 'documentary_verification']::idv_template_steps_enum[], 'production'),
(7, 'Lightning And Selfie Verification Flow', 'idvtmp_3ToYxBHP4Uj6Lf', ARRAY['kyc_check', 'selfie_check']::idv_template_steps_enum[], 'production'),
(8, 'Lightning, Documentary And Selfie Verification Flow', 'idvtmp_8T4wfcmze7aJKY', ARRAY['kyc_check', 'documentary_verification', 'selfie_check']::idv_template_steps_enum[], 'production');
