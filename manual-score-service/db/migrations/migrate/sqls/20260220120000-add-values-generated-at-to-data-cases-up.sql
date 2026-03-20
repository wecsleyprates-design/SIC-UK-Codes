-- Persist "Generated on" / "Regenerated on" date per case until user clicks Re-verify (then updated).
ALTER TABLE data_cases ADD COLUMN IF NOT EXISTS values_generated_at TIMESTAMPTZ NULL;
