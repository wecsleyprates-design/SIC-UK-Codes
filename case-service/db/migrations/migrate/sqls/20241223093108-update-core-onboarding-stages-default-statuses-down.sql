/* Replace with your SQL commands */
UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(config, 
                  '{fields, 4, status}', '"Required"'::jsonb
                  ),
                  '{fields, 5, status}', '"Required"'::jsonb
                ),
                '{fields, 6, status}', '"Required"'::jsonb
              ),
              '{fields, 7, status}', '"Required"'::jsonb
            )
WHERE id = 3;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
              jsonb_set(config, '{fields, 0, status}', '"Required"'::jsonb),
              '{fields, 1, status}', '"Required"'::jsonb
            )
WHERE id = 4;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
              jsonb_set(config, '{fields, 3, status}', '"Required"'::jsonb),
              '{fields, 4, status}', '"Required"'::jsonb
            )
WHERE id = 5;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(config, '{fields, 0, status}', '"Required"'::jsonb)
WHERE id = 6;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(config, '{fields, 0, status}', '"Required"'::jsonb)
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
                                  jsonb_set(config, '{fields,2,status}', '"Required"'::jsonb),
                                  '{fields,3,status}', '"Required"'::jsonb
                                ),
                                '{fields,4,status}', '"Required"'::jsonb
                              ),
                              '{fields,5,status}', '"Required"'::jsonb
                            ),
                            '{fields,6,status}', '"Required"'::jsonb
                          ),
                          '{fields,7,status}', '"Required"'::jsonb
                        ),
                        '{fields,8,status}', '"Required"'::jsonb
                      ),
                      '{fields,9,status}', '"Required"'::jsonb
                    ),
                    '{fields,10,status}', '"Required"'::jsonb
                  ),
                  '{fields,11,status}', '"Required"'::jsonb
                ),
                '{fields,12,status}', '"Required"'::jsonb
              )
WHERE id = 8;

UPDATE onboarding_schema.core_stage_fields_config
SET config = jsonb_set(
              jsonb_set(config, '{fields, 2, status}', '"Required"'::jsonb),
              '{fields, 3, status}', '"Required"'::jsonb
            )
WHERE id = 10;