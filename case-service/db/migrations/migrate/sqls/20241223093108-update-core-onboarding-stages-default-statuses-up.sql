/* Replace with your SQL commands */
-- Update the status field in the table for each record based on id

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(config, 
                  '{fields, 4, status}', '"Optional"'::jsonb
                  ),
                  '{fields, 5, status}', '"Optional"'::jsonb
                ),
                '{fields, 6, status}', '"Optional"'::jsonb
              ),
              '{fields, 7, status}', '"Optional"'::jsonb
            )
WHERE id = 3;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
              jsonb_set(config, '{fields, 0, status}', '"Optional"'::jsonb),
              '{fields, 1, status}', '"Hidden"'::jsonb
            )
WHERE id = 4;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
              jsonb_set(config, '{fields, 3, status}', '"Optional"'::jsonb),
              '{fields, 4, status}', '"Optional"'::jsonb
            )
WHERE id = 5;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(config, '{fields, 0, status}', '"Optional"'::jsonb)
WHERE id = 6;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(config, '{fields, 0, status}', '"Optional"'::jsonb)
WHERE id = 7;
 
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            jsonb_set(
                              jsonb_set(
                                jsonb_set(
                                  jsonb_set(config, '{fields,2,status}', '"Optional"'::jsonb),
                                  '{fields,3,status}', '"Optional"'::jsonb
                                ),
                                '{fields,4,status}', '"Optional"'::jsonb
                              ),
                              '{fields,5,status}', '"Optional"'::jsonb
                            ),
                            '{fields,6,status}', '"Optional"'::jsonb
                          ),
                          '{fields,7,status}', '"Optional"'::jsonb
                        ),
                        '{fields,8,status}', '"Optional"'::jsonb
                      ),
                      '{fields,9,status}', '"Optional"'::jsonb
                    ),
                    '{fields,10,status}', '"Optional"'::jsonb
                  ),
                  '{fields,11,status}', '"Optional"'::jsonb
                ),
                '{fields,12,status}', '"Optional"'::jsonb
              )
WHERE id = 8;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
              jsonb_set(config, '{fields, 2, status}', '"Optional"'::jsonb),
              '{fields, 3, status}', '"Optional"'::jsonb
            )
WHERE id = 10;