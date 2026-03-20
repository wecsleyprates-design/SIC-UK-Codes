CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE  FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE SCHEMA "integrations";

-- accounting, indentity_verification, banking, public_records, taxation
CREATE TABLE "integrations"."core_categories" (
  "id" int PRIMARY KEY,
  "code" varchar(50) NOT NULL,
	"label" VARCHAR(50) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp
);

-- Seed data
INSERT INTO "integrations"."core_categories" ("id", "code", "label") VALUES (1, 'accounting', 'Accounting');
INSERT INTO "integrations"."core_categories" ("id", "code", "label") VALUES (2, 'identity_verification', 'Identity Verification');
INSERT INTO "integrations"."core_categories" ("id", "code", "label") VALUES (3, 'banking', 'Banking');
INSERT INTO "integrations"."core_categories" ("id", "code", "label") VALUES (4, 'taxation', 'Taxation');

-- plaid, quickbooks, persona etc
CREATE TABLE "integrations"."core_integrations_platforms" (
  "id" int PRIMARY KEY,
  "code" varchar(50) NOT NULL,
	"label" VARCHAR(50) NOT NULL,
	"category_id" int,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp,
  CONSTRAINT "fk_integration_category" FOREIGN KEY ("category_id") REFERENCES "integrations"."core_categories" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- Seed data
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (1, 'plaid', 'Plaid', 3);
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (2, 'quickbooks', 'Quickbooks', 1);
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (3, 'persona', 'Persona', 2);

-- fetch_balances, fetch_transactions, fetch_public_records, fetch_assets etc
CREATE TABLE "integrations"."core_tasks" (
  "id" int PRIMARY KEY,
  "code" varchar(50) NOT NULL,
	"label" VARCHAR(50) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp
);

-- Seed data
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (1, 'fetch_balance_sheet', 'Fetch Balance Sheet');
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (2, 'fetch_profit_and_loss_statement', 'Fetch Profit and Loss Statement');
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (3, 'fetch_assets_data', 'Fetch Assets Data');

-- each integration will have a set of tasks, a task can be done by more than one integration but only is assigned to do a specific task
CREATE TABLE "integrations"."rel_tasks_integrations" (
  "id" int PRIMARY KEY,
  "task_category_id" int,
  "platform_id" int,
	CONSTRAINT "fk_tasks_category" FOREIGN KEY ("task_category_id") REFERENCES "integrations"."core_tasks" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT "fk_integrations_variants" FOREIGN KEY ("platform_id") REFERENCES "integrations"."core_integrations_platforms" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- Seed data
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") VALUES (1, 1, 2);
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") VALUES (2, 2, 2);
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") VALUES (3, 3, 1);

CREATE TYPE "integrations"."connection_status" AS ENUM (
	'CREATED',
  'INITIALIZED',
  'SUCCESS',
  'FAILED',
  'NEEDS_ACTION',
  'REVOKED'
);

CREATE TABLE "integrations"."data_connections" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "business_id" uuid,
  "platform_id" int,
  "configuration" json,
  "connection_status" integrations.connection_status,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	"updated_at" timestamp NOT NULL DEFAULT current_timestamp,
	UNIQUE("business_id", "platform_id"),
	CONSTRAINT "fk_integrations_connections" FOREIGN KEY ("platform_id") REFERENCES "integrations"."core_integrations_platforms" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TRIGGER update_data_connections_timestamp
    AFTER UPDATE
    ON
    integrations.data_connections
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

-- log can be split more atomically
CREATE TABLE "integrations"."data_connections_history" (
  "id" uuid PRIMARY KEY,
  "connection_id" uuid,
  "log" text,
  "connection_status" integrations.connection_status,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_integrations_connections_history" FOREIGN KEY ("connection_id") REFERENCES "integrations"."data_connections" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TYPE "integrations"."score_trigger" AS ENUM (
  'ONBOARDING_INVITE',
  'MANUAL_REFRESH',
	'MONITORING_REFRESH'
);

CREATE TABLE "integrations"."business_score_triggers" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "business_id" uuid NOT NULL,
  "trigger_type"  integrations.score_trigger,
	"version" int NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	UNIQUE ("business_id", "version")
);

CREATE TYPE "integrations"."integration_task_status" AS ENUM (
	'CREATED',
  'INITIALIZED',
  'STARTED',
  'IN_PROGRESS',
  'SUCCESS',
  'FAILED',
  'ERRORED'
);

CREATE TABLE "integrations"."data_business_integrations_tasks" (
  "id" uuid PRIMARY KEY,
  "connection_id" uuid,
  "integration_task_id" int,
  "business_score_trigger_id" uuid,
  "task_status" integrations.integration_task_status,
  "reference_id" varchar,
	"metadata" json,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp,
  "updated_at" timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_business_integrations" FOREIGN KEY ("connection_id") REFERENCES "integrations"."data_connections" ("id") ON DELETE CASCADE ON UPDATE RESTRICT,
	CONSTRAINT "fk_business_score_trigger" FOREIGN KEY ("business_score_trigger_id") REFERENCES "integrations"."business_score_triggers" ("id") ON DELETE CASCADE ON UPDATE RESTRICT,
	CONSTRAINT "fk_integrations_tasks" FOREIGN KEY ("integration_task_id") REFERENCES "integrations"."rel_tasks_integrations" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TRIGGER update_data_business_integrations_tasks_timestamp
    AFTER UPDATE
    ON
    integrations.data_business_integrations_tasks
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

CREATE TABLE "integrations"."business_integration_tasks_events" (
  "id" uuid PRIMARY KEY ,
  "business_integration_task_id" uuid NOT NULL,
  "log" json,
  "task_status" integrations.integration_task_status,
  "created_at" timestamp NOT NULL DEFAULT current_timestamp,
  CONSTRAINT "fk_business_integrations_tasks" FOREIGN KEY ("business_integration_task_id") REFERENCES "integrations"."data_business_integrations_tasks" ("id") ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE SCHEMA "integration_data";

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


CREATE TABLE "integration_data"."bank_accounts" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
  "business_integration_task_id" uuid,
  "bank_account" varchar(50) NOT NULL,
	"bank_name" varchar(50),
	"official_name" varchar(50),
	"institution_name" varchar(50) NOT NULL,
	"verification_status" varchar(50),
  "balance_current" decimal,
	"balance_available" decimal,
	"balance_limit" decimal,
	"currency" char(3),
  "type" varchar(20) NOT NULL,
	"subtype" varchar(20),
	"mask" varchar(10),
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_business_integration_tasks_bank_accounts" FOREIGN KEY ("business_integration_task_id") REFERENCES "integrations"."data_business_integrations_tasks" ("id") ON DELETE CASCADE ON UPDATE RESTRICT
);


CREATE TABLE "integration_data"."bank_account_transactions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
  "bank_account_id" uuid NOT NULL,
	"business_integration_task_id" uuid,
  "transaction_id" varchar(50) NOT NULL,
	"date" timestamp NOT NULL,
  "amount" decimal,
	"description" varchar(100),
  "payment_metadata" json,
  "currency" char(3),
  "category" varchar(50),
  "payment_type" varchar(20),
  "is_pending" boolean,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_bank_accounts" FOREIGN KEY ("bank_account_id") REFERENCES "integration_data"."bank_accounts" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT "fk_integration_tasks_transactions" FOREIGN KEY ("business_integration_task_id") REFERENCES "integrations"."data_business_integrations_tasks" ("id") ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TABLE "integration_data"."banking_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4 (),
	"bank_account_id" uuid NOT NULL,
	"business_integration_task_id" uuid,
	"month" int NOT NULL,
	"balance" decimal NOT NULL,
	"currency" char(3) NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_bank_accounts" FOREIGN KEY ("bank_account_id") REFERENCES "integration_data"."bank_accounts" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT "fk_integration_tasks_balances" FOREIGN KEY ("business_integration_task_id") REFERENCES "integrations"."data_business_integrations_tasks" ("id") ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TABLE "data_cases" (
  "id" uuid PRIMARY KEY,
  "business_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"customer_id" uuid NULL,
	"score_trigger_id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "fk_business_score_trigger" FOREIGN KEY ("score_trigger_id") REFERENCES "integrations"."business_score_triggers" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CREATE TABLE "score_categories_configset" (
--   "id" int PRIMARY KEY,
--   "name" varchar(50)
-- );

-- CREATE TABLE "business_score" (
--   "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
--   "business_score_trigger_id" uuid NOT NULL,
--   "score" int NOT NULL,
--   "score_categories_configset_id" int,
-- 	"created_at" timestamp NOT NULL DEFAULT current_timestamp
-- );

-- CREATE TABLE "score_categories" (
--   "id" int PRIMARY KEY,
--   "name" VARCHAR(50) NOT NULL
-- );

-- CREATE TABLE "score_categories_config" (
--   "id" int PRIMARY KEY,
--   "score_categories_configset_id" int,
--   "score_category_id" int,
--   "weightage" int,
-- 	CONSTRAINT "fk_score_categories_configset" FOREIGN KEY ("score_categories_configset_id") REFERENCES "score_categories_configset" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
-- 	CONSTRAINT "fk_score_categories" FOREIGN KEY ("score_category_id") REFERENCES "score_categories" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
-- );


