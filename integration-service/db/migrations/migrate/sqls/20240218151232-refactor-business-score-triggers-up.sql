-- move applicant_id and customer_id from data_cases to integrations.business_score_triggers
-- and remove them from data_cases
-- TODO: drop applicant_id from business_score_triggers
ALTER TABLE "integrations"."business_score_triggers"
	ADD COLUMN "applicant_id" UUID,
	ADD COLUMN "customer_id" UUID;


UPDATE "integrations"."business_score_triggers"
SET
	"applicant_id" = "data_cases"."applicant_id",
	"customer_id" = "data_cases"."customer_id"
FROM "data_cases"
WHERE "business_score_triggers"."id" = "data_cases"."score_trigger_id";

ALTER TABLE "data_cases"
	DROP COLUMN "applicant_id",
	DROP COLUMN "customer_id";
