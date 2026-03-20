CREATE TABLE IF NOT EXISTS integration_data.business_review_synthesis (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    serp_query_id uuid NOT NULL,
    worst_review TEXT,
    best_review TEXT,
    general_sentiment TEXT,
    relevant_emotions TEXT[],
    suggested_focus_area TEXT,
    overall_rating DECIMAL(3,2),
    total_reviews INTEGER,
    generative_response_rating INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_serp_query
        FOREIGN KEY (serp_query_id)
        REFERENCES integration_data.google_maps_serp_queries(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_business_review_synthesis_serp_query_id ON integration_data.business_review_synthesis(serp_query_id);

-- Create trigger for updating 'updated_at' column
CREATE OR REPLACE TRIGGER update_business_review_synthesis_updated_at
BEFORE UPDATE ON integration_data.business_review_synthesis
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE integration_data.business_review_synthesis IS 'Stores synthesized information from business reviews';