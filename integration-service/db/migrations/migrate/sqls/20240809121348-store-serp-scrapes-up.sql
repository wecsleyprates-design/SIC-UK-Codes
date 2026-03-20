-- Seed data
INSERT INTO integrations.core_integrations_platforms ("id", "code", "label", "category_id") VALUES (22, 'serp_scrape', 'SERP Scrape', 7) on conflict do nothing;

-- -- Seed data
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (49, 15, 22);

-- Create Google_Maps_Serp_Queries table
CREATE TABLE IF NOT EXISTS integration_data.google_maps_serp_queries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_integration_task_id uuid NOT NULL, -- foreign key referencing the business integration task
    business_id uuid NOT NULL,
    submitted_business_name TEXT NOT NULL,
    submitted_business_address TEXT NOT NULL,
    serp_query_url TEXT NOT NULL,
    hit_found BOOLEAN,
    title_response TEXT,
    website_response TEXT,
    address_response TEXT,
    raw_business_match JSONB,
    raw_local_match JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    CONSTRAINT fk_business_integration_tasks_id_business_entity_website_data FOREIGN KEY (business_integration_task_id)
        REFERENCES integrations.data_business_integrations_tasks (id) MATCH SIMPLE
        ON UPDATE RESTRICT
        ON DELETE CASCADE -- on deletion of the referenced record, delete this record as well
);

-- Create trigger for updating 'updated_at' column
CREATE OR REPLACE TRIGGER update_google_maps_serp_queries_updated_at
BEFORE UPDATE ON integration_data.google_maps_serp_queries
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Add index for google_maps_serp_queries table
CREATE INDEX idx_google_maps_serp_queries_business_id ON integration_data.google_maps_serp_queries(business_id);

-- Create Serialized_Website_Scrapes table
CREATE TABLE IF NOT EXISTS integration_data.serialized_website_scrapes (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    serp_query_id uuid NOT NULL,
    company_description TEXT,
    target_audience TEXT,
    industry TEXT,
    industry_vertical TEXT,
    relevant_tags TEXT[],
    generative_response_rating INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    CONSTRAINT fk_serp_query
        FOREIGN KEY (serp_query_id)
        REFERENCES integration_data.google_maps_serp_queries(id)
        ON DELETE CASCADE
);

-- Create trigger for updating 'updated_at' column
CREATE OR REPLACE TRIGGER update_serialized_website_scrapes_updated_at
BEFORE UPDATE ON integration_data.serialized_website_scrapes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Add index for serialized_website_scrapes table
CREATE INDEX idx_serialized_website_scrapes_serp_query_id ON integration_data.serialized_website_scrapes(serp_query_id);

-- Create Inferred_Business_Classifications table
CREATE TABLE IF NOT EXISTS integration_data.inferred_business_classifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    serp_query_id uuid NOT NULL,
    naics_code TEXT,
    secondary_naics_code TEXT,
    sic_code TEXT,
    secondary_sic_code TEXT,
    legit_business_confidence FLOAT,
    generative_response_rating INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    updated_at TIMESTAMP NOT NULL DEFAULT current_timestamp,
    CONSTRAINT fk_serp_query
        FOREIGN KEY (serp_query_id)
        REFERENCES integration_data.google_maps_serp_queries(id)
        ON DELETE CASCADE
);

-- Create trigger for updating 'updated_at' column
CREATE OR REPLACE TRIGGER update_inferred_business_classifications_updated_at
BEFORE UPDATE ON integration_data.inferred_business_classifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Add indexes for inferred_business_classifications table
CREATE INDEX idx_inferred_business_classifications_serp_query_id ON integration_data.inferred_business_classifications(serp_query_id);
CREATE INDEX idx_inferred_business_classifications_naics_code ON integration_data.inferred_business_classifications(naics_code);
CREATE INDEX idx_inferred_business_classifications_sic_code ON integration_data.inferred_business_classifications(sic_code);

-- Add comments to explain each table
COMMENT ON TABLE integration_data.google_maps_serp_queries IS 'Stores Google Maps SERP query results for business searches';
COMMENT ON TABLE integration_data.serialized_website_scrapes IS 'Stores serialized website scrape data related to SERP queries';
COMMENT ON TABLE integration_data.inferred_business_classifications IS 'Stores inferred business classifications based on SERP query results';