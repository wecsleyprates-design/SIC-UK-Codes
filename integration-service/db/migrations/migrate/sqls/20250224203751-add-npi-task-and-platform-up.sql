INSERT INTO integrations.core_integrations_platforms (
    "id", "code", "label", "category_id"
) VALUES (28, 'npi', 'National Provider Identifier', 7)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS integration_data.healthcare_provider_information (
    "npi_id" VARCHAR(10) PRIMARY KEY,
    "business_integration_task_id" UUID NOT NULL,
    "business_id" VARCHAR(255) NOT NULL,
    "employer_identification_number" VARCHAR(255),
    "is_sole_proprietor" BOOLEAN,
    "provider_first_name" VARCHAR(255),
    "provider_last_name" VARCHAR(255),
    "provider_middle_name" VARCHAR(255),
    "provider_gender_code" VARCHAR(255),
    "provider_credential_text" VARCHAR(255),
    "provider_organization_name" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_business_integration_tasks_id_idv_status FOREIGN KEY (
        business_integration_task_id
    ) REFERENCES integrations.data_business_integrations_tasks (
        id
    ) ON DELETE CASCADE ON UPDATE RESTRICT
);
INSERT 
INTO 
    integrations.core_tasks 
    (id,code,"label",created_at)
VALUES
	(22,'fetch_healthcare_provider_verification','Fetch Healthcare Provider Information','2025-03-04 12:35:46.605')
ON CONFLICT DO NOTHING;

INSERT 
INTO
    integrations.rel_tasks_integrations
    ("id","task_category_id", "platform_id") 
VALUES
    (63, 22, 28);
