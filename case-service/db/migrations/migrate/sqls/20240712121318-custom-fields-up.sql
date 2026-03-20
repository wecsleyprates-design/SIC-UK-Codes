CREATE FUNCTION update_updated_at_for_custom_templates()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE SCHEMA onboarding_schema;

CREATE TABLE "onboarding_schema"."data_custom_templates" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "customer_id" uuid NOT NULL,
  "version" INT NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "metadata" JSONB NOT NULL,
  "is_enabled" BOOLEAN DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp,
  "created_by" uuid NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT current_timestamp,
  "updated_by" uuid NOT NULL,
  CONSTRAINT "unique_customer_id_version" UNIQUE("customer_id", "version")
);


CREATE TRIGGER update_data_custom_templates
    BEFORE UPDATE
    ON
    onboarding_schema.data_custom_templates
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_for_custom_templates();

CREATE TABLE "onboarding_schema"."core_field_properties" (
  "id" SERIAL PRIMARY KEY,
  "code" VARCHAR(55) NOT NULL UNIQUE, 
  "label" VARCHAR(55) NOT NULL UNIQUE
);

INSERT INTO "onboarding_schema"."core_field_properties" (id, code, label) VALUES
    (1, 'text', 'Text'),
    (2, 'dropdown', 'Dropdown'), 
    (3, 'integer', 'Integer'), 
    (4, 'full_text', 'FullText'), 
    (5, 'upload', 'Upload'), 
    (6, 'phone_number', 'PhoneNumber'), 
    (7, 'email','Email'), 
    (8, 'boolean', 'Boolean'), 
    (9, 'alphanumeric', 'Alphanumeric');


CREATE TABLE "onboarding_schema"."data_custom_fields" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "template_id" uuid NOT NULL,
  "label" VARCHAR(255) NOT NULL,
  "code" VARCHAR(255) NOT NULL,
  "type" VARCHAR(30),
  "property" INT,
  "rules" JSONB NOT NULL,
  "is_sensitive" BOOLEAN DEFAULT false,
  CONSTRAINT "fk_template_id" FOREIGN KEY ("template_id") REFERENCES "onboarding_schema"."data_custom_templates" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_property_id" FOREIGN KEY ("property") REFERENCES "onboarding_schema"."core_field_properties" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "unique_template_id_label" UNIQUE("template_id", "label")
);

CREATE TABLE "onboarding_schema"."data_business_custom_fields" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "business_id" uuid NOT NULL,
  "case_id" uuid NOT NULL,
  "template_id" uuid NOT NULL,
  "field_id" uuid NOT NULL,
  "field_value" VARCHAR(255),
  "created_at" timestamp NOT NULL DEFAULT current_timestamp,
  "created_by" uuid NOT NULL,
  CONSTRAINT "fk_business_id" FOREIGN KEY ("business_id") REFERENCES "data_businesses" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_case_id" FOREIGN KEY ("case_id") REFERENCES "data_cases" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_template_id" FOREIGN KEY ("template_id") REFERENCES "onboarding_schema"."data_custom_templates" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "fk_field_id" FOREIGN KEY ("field_id") REFERENCES "onboarding_schema"."data_custom_fields" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "onboarding_schema"."data_field_options" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "field_id" uuid NOT NULL,  
  "label" VARCHAR(55) NOT NULL,
  "value" VARCHAR(55) NOT NULL,
  CONSTRAINT "fk_field_id" FOREIGN KEY ("field_id") REFERENCES "onboarding_schema"."data_custom_fields" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
