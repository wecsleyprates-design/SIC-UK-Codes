CREATE TABLE integration_data.data_category_completions_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL,
    category_id INTEGER NOT NULL,
    customer_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Composite index for querying by business_id and category_id
-- This also covers queries on just business_id (leftmost column)
CREATE INDEX idx_category_completions_history_business_category 
    ON integration_data.data_category_completions_history (business_id, category_id);
