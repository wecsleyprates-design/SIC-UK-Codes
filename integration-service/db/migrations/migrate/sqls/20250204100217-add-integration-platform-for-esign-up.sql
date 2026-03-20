/* Replace with your SQL commands */
INSERT INTO integrations.core_integrations_platforms (id, code, label, category_id, created_at)
VALUES (25, 'electronic_signature', 'Electronic Signature', 4, now());

INSERT INTO integrations.core_tasks (id, code, label, created_at) 
VALUES (19, 'esign_tax_consent', 'Esign Tax Consent', now());

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) 
VALUES (60, 19, 25);
