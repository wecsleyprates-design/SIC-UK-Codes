ALTER TABLE IF EXISTS business_score_history DROP CONSTRAINT IF EXISTS fk_business_score_history;

ALTER TABLE IF EXISTS business_score_history ADD CONSTRAINT fk_business_score_history FOREIGN KEY (score_id) REFERENCES business_scores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS business_score_factors DROP CONSTRAINT IF EXISTS fk_business_factors_scores;

ALTER TABLE IF EXISTS business_score_factors ADD CONSTRAINT fk_business_factors_scores FOREIGN KEY (score_id) REFERENCES business_scores(id) ON DELETE RESTRICT ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS business_scores DROP CONSTRAINT IF EXISTS fk_business_score_trigger;

ALTER TABLE IF EXISTS business_scores ADD CONSTRAINT fk_business_score_trigger FOREIGN KEY (score_trigger_id) REFERENCES business_score_triggers(id) ON DELETE RESTRICT ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS data_cases DROP CONSTRAINT IF EXISTS fk_data_cases_score_trigger;

ALTER TABLE IF EXISTS data_cases ADD CONSTRAINT fk_data_cases_score_trigger FOREIGN KEY (score_trigger_id) REFERENCES business_score_triggers(id) ON DELETE RESTRICT ON UPDATE RESTRICT;


ALTER TABLE IF EXISTS score_inputs DROP CONSTRAINT IF EXISTS score_inputs_score_id_fk;

ALTER TABLE IF EXISTS score_inputs ADD CONSTRAINT score_inputs_score_id_fk FOREIGN KEY (score_id) REFERENCES business_scores(id);


ALTER TABLE IF EXISTS data_current_scores DROP CONSTRAINT IF EXISTS data_current_scores_fk;

ALTER TABLE IF EXISTS data_current_scores ADD CONSTRAINT data_current_scores_fk FOREIGN KEY (score_id) REFERENCES business_scores(id);








