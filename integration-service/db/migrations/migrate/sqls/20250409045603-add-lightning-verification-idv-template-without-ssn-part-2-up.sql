/* Replace with your SQL commands */

INSERT INTO integrations.core_identity_verification_templates (id, name, template_id, steps, platform)
VALUES 
(9, 'Lightning Verification Flow Without SSN', 'idvtmp_c847MSsxZxJsYk', ARRAY['kyc_check_without_ssn']::idv_template_steps_enum[], 'sandbox'),
(10, 'Lightning Verification Flow Without SSN', 'idvtmp_38S6KuLDLbmxti', ARRAY['kyc_check_without_ssn']::idv_template_steps_enum[], 'production');