DROP TABLE IF EXISTS "data_cases";

DROP TABLE IF EXISTS "business_score_factors";

DROP TABLE IF EXISTS "business_score_history";

DROP TABLE IF EXISTS "business_scores";

DROP TABLE IF EXISTS "business_score_triggers";

DROP TABLE IF EXISTS "score_config_history";

DROP TABLE IF EXISTS "score_evaluation_config";

DROP TABLE IF EXISTS "rel_score_factor_evaluation_config";

DROP TABLE IF EXISTS "score_category_factors";

DROP TABLE IF EXISTS "score_categories";

DROP TABLE IF EXISTS "score_decision_history";

DROP TABLE IF EXISTS "score_decision_matrix";

-- drop types

DROP TYPE IF EXISTS "risk_level";

DROP TYPE IF EXISTS "score_decision";

DROP TYPE IF EXISTS "score_status";

DROP TYPE IF EXISTS "score_base";

-- drop triggers and functions

DROP FUNCTION IF EXISTS "capture_score_decision_matrix"();

DROP FUNCTION IF EXISTS "capture_score_config"();

DROP FUNCTION IF EXISTS "update_updated_at"();
