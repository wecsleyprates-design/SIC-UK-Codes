CREATE TABLE "score_inputs" (
	"id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    "score_id" uuid NOT NULL,
    "inputs" jsonb not null default '{}',
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
    "updated_at" timestamp not null DEFAULT current_timestamp,
   	CONSTRAINT score_inputs_score_id_fk FOREIGN KEY (score_id) REFERENCES business_scores(id)
);
-- Index "score_id" column
CREATE INDEX "idx_score_inputs_score_id" ON "score_inputs" ("score_id");