DROP TRIGGER IF EXISTS set_timestamp ON "integration_data"."google_ratings";

ALTER TABLE "integration_data"."business_ratings" DROP CONSTRAINT IF EXISTS fk_business_integration_task_id;

DROP TABLE IF EXISTS "integration_data"."business_ratings";