/* Change external_id to be a varchar since OpenCorporates & ZoomInfo do not use UUID IDs */
ALTER TABLE integration_data.business_entity_verification ALTER COLUMN external_id TYPE VARCHAR(50) USING external_id::VARCHAR(50);

/* Drop existing unique constraint -- this will just cause problems on subsequent business entity verification runs  */
ALTER TABLE integration_data.business_entity_verification DROP CONSTRAINT IF EXISTS business_entity_verification_external_id_key;

/* Add Open Corporates */
insert into integrations.core_integrations_platforms (id, code, label, category_id, created_at) values (23, 'opencorporates', 'Open Corporates', 7, now());
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (57, 12, 23);

/* Add ZoomInfo */
insert into integrations.core_integrations_platforms (id, code, label, category_id, created_at) values (24, 'zoominfo', 'ZoomInfo', 7, now());
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) VALUES (58, 12, 24);
