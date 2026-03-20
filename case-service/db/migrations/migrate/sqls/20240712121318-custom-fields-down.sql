ALTER TABLE IF EXISTS "onboarding_schema"."data_field_options" DROP CONSTRAINT IF EXISTS fk_field_id;
DROP TABLE IF EXISTS "onboarding_schema"."data_field_options";

ALTER TABLE IF EXISTS "onboarding_schema"."data_business_custom_fields" DROP CONSTRAINT IF EXISTS fk_business_id;
ALTER TABLE IF EXISTS "onboarding_schema"."data_business_custom_fields" DROP CONSTRAINT IF EXISTS fk_case_id;
ALTER TABLE IF EXISTS "onboarding_schema"."data_business_custom_fields" DROP CONSTRAINT IF EXISTS fk_template_id;
ALTER TABLE IF EXISTS "onboarding_schema"."data_business_custom_fields" DROP CONSTRAINT IF EXISTS fk_field_id;
DROP TABLE IF EXISTS "onboarding_schema"."data_business_custom_fields";

ALTER TABLE IF EXISTS "onboarding_schema"."data_custom_fields" DROP CONSTRAINT IF EXISTS fk_template_id;
ALTER TABLE IF EXISTS "onboarding_schema"."data_custom_fields" DROP CONSTRAINT IF EXISTS fk_property_id;
ALTER TABLE IF EXISTS "onboarding_schema"."data_custom_fields" DROP CONSTRAINT IF EXISTS unique_template_id_label;
DROP TABLE IF EXISTS "onboarding_schema"."data_custom_fields";

DROP TRIGGER IF EXISTS update_data_custom_templates ON onboarding_schema.data_custom_templates RESTRICT;
ALTER TABLE IF EXISTS "onboarding_schema"."data_custom_templates" DROP CONSTRAINT IF EXISTS unique_customer_id_version;
DROP TABLE IF EXISTS "onboarding_schema"."data_custom_templates";

DROP TABLE IF EXISTS "onboarding_schema"."core_field_properties";

DROP FUNCTION IF EXISTS update_updated_at_for_custom_templates;

DROP SCHEMA IF EXISTS onboarding_schema;


