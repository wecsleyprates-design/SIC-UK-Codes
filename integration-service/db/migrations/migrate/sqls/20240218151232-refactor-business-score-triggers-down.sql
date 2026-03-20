ALTER TABLE "data_cases"
ADD COLUMN "applicant_id" UUID,
ADD COLUMN "customer_id" UUID;

UPDATE "data_cases"
SET
	"applicant_id" = "business_score_triggers"."applicant_id",
	"customer_id" = "business_score_triggers"."customer_id"
FROM "integrations"."business_score_triggers"
WHERE "data_cases"."score_trigger_id" = "business_score_triggers"."id";

ALTER TABLE "integrations"."business_score_triggers"
DROP COLUMN "applicant_id",
DROP COLUMN "customer_id";
