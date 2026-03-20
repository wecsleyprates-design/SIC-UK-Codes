-- Seed data
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") VALUES (15, 'tax_status', 'Tax Status', 4);

-- Seed data
INSERT INTO "integrations"."core_tasks" ("id", "code", "label") VALUES (10, 'fetch_tax_filings', 'Fetch Tax Filings');

-- Seed data
INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") VALUES (40, 10, 15);


CREATE TYPE "integration_data"."business_type" AS ENUM (
	'INDIVIDUAL',
	'BUSINESS'
);

CREATE TABLE integration_data.tax_filings (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	business_type integration_data.business_type NOT NULL,
	business_integration_task_id uuid NOT NULL,
	naics numeric NULL,
	naics_title varchar(100) NULL,
	period varchar(10) NOT NULL,
	form varchar(50) NOT NULL,
	form_type varchar(50) NOT NULL,
	filing_status varchar(50) NULL,
	adjusted_gross_income numeric NULL,
	total_income numeric NULL,
	total_sales numeric NULL,
	total_compensation numeric NULL,
	total_wages numeric NULL,
	irs_balance numeric NULL,
	lien_balance numeric NULL,
    CONSTRAINT "fk_business_integration_tasks_id_tax_filing" FOREIGN KEY ("business_integration_task_id") REFERENCES "integrations"."data_business_integrations_tasks" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);