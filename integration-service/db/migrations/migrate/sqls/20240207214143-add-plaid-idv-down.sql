/* Replace with your SQL commands */
DROP TABLE IF EXISTS "integration_data"."identity_verification";

DELETE FROM "integrations"."rel_tasks_integrations" WHERE task_category_id=(select id from integrations.core_tasks where code = 'fetch_identity_verification');

DELETE FROM integrations.core_tasks where code = 'fetch_identity_verification';

DELETE FROM integrations.core_integrations_platforms where code = 'plaid_idv';

-- put back the original idv table
CREATE TABLE "integration_data"."identity_verification" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
  "business_integration_task_id" uuid,
	"applicant_id" uuid NOT NULL,
  "firstname" varchar(50),
  "middlename" varchar(50),
  "lastname" varchar(50),
  "birthdate" date,
  "addresssline1" varchar(100),
  "addresssline2" varchar(100),
  "city" varchar(100),
  "postalcode" varchar(100),
  "ssn" varchar(10),
  "identification_number" varchar(50),
  "email" varchar(20),
  "phone" varchar(15),
  "mobile" varchar(15),
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	"updated_at" timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_business_integration_tasks_id_verification" FOREIGN KEY ("business_integration_task_id") REFERENCES "integrations"."data_business_integrations_tasks" ("id") ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TRIGGER update_identity_verifications_tasks_timestamp
    AFTER UPDATE
    ON
    integration_data.identity_verification
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();
