-- Seed data
INSERT INTO "integrations"."core_categories" ("id", "code", "label") VALUES (5, 'public_records', 'Public Records');

-- Seed data
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (4, 'verdata', 'Verdata', 5);

-- Seed data
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (4, 'fetch_public_records', 'Fetch Public Records');

-- Seed data
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") VALUES (4, 4, 4);

CREATE TABLE "integration_data"."public_records" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
  "business_integration_task_id" uuid NOT NULL,
  "number_of_business_liens" varchar(50) NULL,
  "most_recent_business_lien_filing_date" varchar(50) NULL,
  "most_recent_business_lien_status" varchar(50) NULL,
  "number_of_bankruptcies" varchar(50) NULL,
  "most_recent_bankruptcy_filing_date" varchar(50) NULL,
  "number_of_judgement_fillings" varchar(50) NULL,
  "most_recent_judgement_filling_date" varchar(50) NULL,
  "corporate_filing_business_name" varchar(50) NULL,
  "corporate_filing_filling_date" varchar(50) NULL,
  "corporate_filing_incorporation_state" varchar(50) NULL,
  "corporate_filing_corporation_type" varchar(50) NULL,
  "corporate_filing_resgistration_type" varchar(50) NULL,
  "corporate_filing_secretary_of_state_status" varchar(50) NULL,
  "corporate_filing_secretary_of_state_status_date" varchar(50) NULL,
  "average_rating" DECIMAL(10, 2) NULL,
  "angi_review_count" INT NULL,
  "angi_review_percentage" INT NULL,
  "bbb_review_count" INT NULL,
  "bbb_review_percentage" INT NULL,
  "google_review_count" INT NULL,
  "google_review_percentage" INT NULL,
  "yelp_review_count" INT NULL,
  "yelp_review_percentage" INT NULL,
  "healthgrades_review_count" INT NULL,
	"healthgrades_review_percentage" INT NULL,
  "vitals_review_count" INT NULL,
	"vitals_review_percentage" INT NULL,
  "webmd_review_count" INT NULL,
	"webmd_review_percentage" INT NULL,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp,
  "updated_at" timestamp NOT NULL DEFAULT current_timestamp,
  CONSTRAINT "fk_business_integration_tasks_id_public_records" FOREIGN KEY ("business_integration_task_id") REFERENCES "integrations"."data_business_integrations_tasks" ("id") ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TRIGGER update_public_records_timestamp
    AFTER UPDATE
    ON
    integration_data.public_records
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();