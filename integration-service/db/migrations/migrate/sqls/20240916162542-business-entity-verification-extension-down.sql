/* Change column back to UUID, setting to NULL if not a valid UUID */
ALTER TABLE integration_data.business_entity_verification ALTER COLUMN external_id TYPE UUID USING (
  CASE
    WHEN external_id ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    THEN external_id::UUID
    ELSE NULL
  END);

/* Add Constraint Back In */
ALTER TABLE integration_data.business_entity_verification ADD CONSTRAINT business_entity_verification_external_id_key UNIQUE (external_id);


/* Delete Open Corporates */
DELETE from integrations.rel_tasks_integrations where id = 57;
DELETE from integrations.core_integrations_platforms where id =23;

/* Delete ZoomInfo */
DELETE from integrations.rel_tasks_integrations where id = 58;
DELETE from integrations.core_integrations_platforms where id =24;
