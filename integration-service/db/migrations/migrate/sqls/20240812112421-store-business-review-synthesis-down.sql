-- Drop trigger
DROP TRIGGER IF EXISTS update_business_review_synthesis_updated_at ON integration_data.business_review_synthesis;

-- Drop index
DROP INDEX IF EXISTS integration_data.idx_business_review_synthesis_serp_query_id;

-- Drop table
DROP TABLE IF EXISTS integration_data.business_review_synthesis;