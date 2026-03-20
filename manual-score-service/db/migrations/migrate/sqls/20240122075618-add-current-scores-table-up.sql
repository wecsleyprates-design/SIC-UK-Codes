CREATE TABLE data_current_scores (
	score_id uuid NOT NULL,
	business_id uuid NOT NULL,
	customer_id uuid NULL,
	CONSTRAINT data_current_scores_un UNIQUE (score_id,business_id,customer_id),
	CONSTRAINT data_current_scores_fk FOREIGN KEY (score_id) REFERENCES business_scores(id)
);
