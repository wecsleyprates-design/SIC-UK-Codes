CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE  FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TYPE "risk_level" AS ENUM (
	'HIGH',
	'MODERATE',
	'LOW'
);

CREATE TYPE "score_decision" AS ENUM (
	'DECLINE',
	'FURTHER_REVIEW_NEEDED',
	'APPROVE'
);

CREATE TABLE "score_decision_matrix" (
	"id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	"customer_id" uuid NULL,
	"range_start" int NOT NULL,
	"range_end" int NULL,
	"risk_level" risk_level NOT NULL,
	"decision" score_decision NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp
);

CREATE TABLE "score_decision_history" (
	"id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	"customer_id" uuid NULL,
	"decision_matrix" json NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp
);

INSERT INTO score_decision_matrix (range_start, range_end, risk_level, decision) VALUES (0, 549, 'HIGH', 'DECLINE');
INSERT INTO score_decision_matrix (range_start, range_end, risk_level, decision) VALUES (550, 699, 'MODERATE', 'FURTHER_REVIEW_NEEDED');
INSERT INTO score_decision_matrix (range_start, range_end, risk_level, decision) VALUES (700, 850, 'LOW', 'APPROVE');

-- Have a initial history of score decision matrix
INSERT INTO score_decision_history(customer_id, decision_matrix)
	SELECT customer_id, json_agg(score_decision_matrix) decision_matrix FROM score_decision_matrix GROUP BY customer_id;

-- Create a function to insert a row in "score_decision_history" on update of "score_decision_matrix"
CREATE OR REPLACE FUNCTION capture_score_decision_matrix()
RETURNS TRIGGER AS $$
BEGIN
		IF NEW.customer_id IS NOT NULL THEN
  		INSERT INTO score_decision_history(customer_id, decision_matrix)
				SELECT customer_id, json_agg(score_decision_matrix) decision_matrix FROM score_decision_matrix WHERE customer_id = NEW.customer_id GROUP BY customer_id;
		ELSE
			INSERT INTO score_decision_history(decision_matrix, test)
				SELECT json_agg(score_decision_matrix) decision_matrix FROM score_decision_matrix WHERE customer_id IS NULL GROUP BY customer_id;
		END IF;

RETURN NEW;

END;

$$ LANGUAGE plpgsql;

-- Create a trigger on "table1" to execute the function on update
CREATE TRIGGER update_score_decision_history
AFTER INSERT OR UPDATE  ON score_decision_matrix
FOR EACH ROW
EXECUTE FUNCTION capture_score_decision_matrix();

CREATE TABLE "score_categories" (
	"id" int PRIMARY KEY,
	"code" varchar(50) NOT NULL,
	"label" varchar(50) NOT NULL,
	"is_deleted" boolean NOT NULL DEFAULT false,
	"total_weightage" decimal NOT NULL
);

-- public records, credit utilization, financial strength
 INSERT INTO score_categories (id, code, label, is_deleted, total_weightage) VALUES (1, 'CREDIT_UTILIZATION', 'Credit Utilization', false, 20.0);
 INSERT INTO score_categories (id, code, label, is_deleted, total_weightage) VALUES (2, 'PUBLIC_RECORDS', 'Public Records', false, 40.0);
 INSERT INTO score_categories (id, code, label, is_deleted, total_weightage) VALUES (3, 'FINANCIAL_STRENGTH', 'Financial Strength', false, 40.0);

CREATE TABLE "score_category_factors" (
	"id" int PRIMARY KEY,
	"code" varchar(50) NOT NULL,
	"label" varchar(50) NOT NULL,
	"category_id" int NOT NULL,
	"is_deleted" boolean NOT NULL DEFAULT false,
	"parent_factor_id" int NULL,
	"weightage" decimal NOT NULL,
	CONSTRAINT "fk_score_category_factors" FOREIGN KEY ("category_id") REFERENCES "score_categories" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT "fk_score_category_factors_parent_factor_id" FOREIGN KEY ("parent_factor_id") REFERENCES "score_category_factors" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- Financial Strength: Net profit margin 10 , Return on assets 10 , debt to equity ratio 10 , current ratio 10
-- Credit Utilization: Credit utilization 20
-- Public Records: Bankruptcies 15, liens 10, judgements 10, social profile 5
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (1, 'NET_PROFIT_MARGIN', 'Net Profit Margin', 3, false, null, 10.0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (2, 'RETURN_ON_ASSETS', 'Return on Assets', 3, false, null, 10.0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (3, 'DEBT_TO_EQUITY_RATIO', 'Debt to Equity Ratio', 3, false, null, 10.0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (4, 'CURRENT_RATIO', 'Current Ratio', 3, false, null, 10.0);

INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (5, 'CREDIT_UTILIZATION', 'Credit Utilization', 1, false, null, 20.0);

INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (6, 'BANKRUPTCIES', 'Bankruptcies', 2, false, null, 15.0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (7, 'LIENS', 'Liens', 2, false, null, 10.0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (8, 'JUDGEMENTS', 'Judgements', 2, false, null, 10.0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (9, 'SOCIAL_PROFILE', 'Social Profile', 2, false, null, 5.0);


CREATE TABLE "score_config_history" (
	"id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	"score_config" json,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp
);

-- Have a initial history of score config

INSERT INTO score_config_history(score_config)
  SELECT json_agg(categories) FROM (SELECT score_categories.*, factors FROM score_categories LEFT JOIN
	(SELECT category_id , json_agg(score_category_factors) as factors FROM score_category_factors  GROUP BY category_id) as factors ON factors.category_id = score_categories.id) categories;
-- Create a function to insert a row in "score_config_history" on update of "score_category_factors" or "score_categories"
CREATE OR REPLACE FUNCTION capture_score_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new row into "table2" with the updated values from "table1"
  INSERT INTO score_config_history(score_config)
  SELECT json_agg(categories) FROM (SELECT score_categories.*, factors FROM score_categories LEFT JOIN (SELECT category_id , json_agg(score_category_factors) as factors FROM score_category_factors  GROUP BY category_id) as factors ON factors.category_id = score_categories.id) categories;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger on "table1" to execute the function on update
CREATE TRIGGER update_score_config_history
AFTER UPDATE OR INSERT ON score_categories
FOR EACH STATEMENT
EXECUTE FUNCTION capture_score_config();

CREATE TRIGGER update_score_config_history_2
AFTER UPDATE OR INSERT ON score_category_factors
FOR EACH STATEMENT
EXECUTE FUNCTION capture_score_config();

CREATE TYPE "score_base" AS ENUM (
	'100',
	'850'
);

CREATE TABLE "rel_score_factor_evaluation_config" (
		"id" serial PRIMARY KEY,
		"score_factor_id" int NOT NULL,
		"base" score_base NOT NULL,
		"default_score" int NOT NULL,
		CONSTRAINT "fk_score_evaluation_config" FOREIGN KEY ("score_factor_id") REFERENCES "score_category_factors" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "score_evaluation_config" (
	"id" int PRIMARY KEY,
	"config_id" int NOT NULL,
	"range_start" DECIMAL NULL,
	"is_start_inclusive" boolean NOT NULL,
	"range_end" DECIMAL NULL,
	"is_end_inclusive" boolean NOT NULL,
	"score_value" int NOT NULL,
	CONSTRAINT "fk_score_evaluation_config" FOREIGN KEY ("config_id") REFERENCES "rel_score_factor_evaluation_config" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "business_score_triggers" (
	"id" uuid PRIMARY KEY,
	"business_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"customer_id" uuid NULL
);

CREATE TYPE "score_status" AS ENUM (
	'PROCESSING',
	'SUCCESS',
	'FAILED'
);
CREATE TABLE "business_scores" (
	"id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	"score_trigger_id" uuid,
	"weighted_score_100" decimal NULL,
	"weighted_score_850" decimal NULL,
	"status" score_status NOT NULL,
	"score_weightage_config" uuid NOT NULL,
	"risk_level" risk_level,
	"score_decision" score_decision,
	"score_decision_config" uuid NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	"updated_at" timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_business_score_score_config" FOREIGN KEY ("score_weightage_config") REFERENCES "score_config_history" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT "fk_business_score_trigger" FOREIGN KEY ("score_trigger_id") REFERENCES "business_score_triggers" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT "fk_business_score_decision" FOREIGN KEY ("score_decision_config") REFERENCES "score_decision_history" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TRIGGER update_scores_timestamp
    AFTER UPDATE
    ON
    business_scores
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

CREATE TABLE "business_score_history" (
	"id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	"score_id" uuid NOT NULL,
	"status" score_status NOT NULL,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_business_score_history" FOREIGN KEY ("score_id") REFERENCES "business_scores" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);


CREATE TABLE "business_score_factors" (
	"id" uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
	"score_id" uuid NOT NULL,
	"category_id" int NOT NULL,
	"factor_id" int NOT NULL,
	"weightage" decimal NOT NULL,
	"value" decimal NULL,
	"score_100" decimal NULL,
	"weighted_score_100" decimal NULL,
	"score_850" decimal NULL,
	"weighted_score_850" decimal NULL,
	"status" score_status NOT NULL,
	"log" text,
	"created_at" timestamp NOT NULL DEFAULT current_timestamp,
	"updated_at" timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_business_factors_scores" FOREIGN KEY ("score_id") REFERENCES "business_scores" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT "fk_business_score_factors_score_categories" FOREIGN KEY ("category_id") REFERENCES "score_categories" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT "fk_business_factors_score_factors" FOREIGN KEY ("factor_id") REFERENCES "score_category_factors" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TRIGGER update_score_factors_timestamp
    AFTER UPDATE
    ON
    business_score_factors
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

CREATE TABLE "data_cases" (
	"id" uuid PRIMARY KEY,
	"score_trigger_id" uuid NOT NULL,
	CONSTRAINT "fk_data_cases_score_trigger" FOREIGN KEY ("score_trigger_id") REFERENCES "business_score_triggers" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);


-- seed config data

-- Financial strength base 100
-- Net Profit Margin base 100 = IF((C4) >= 15%, 100, IF((C4) >= 10%, 80, IF((C4) >= 5%, 60, IF((C4) >= 0%, 40, 20)))) -- added = to 15
-- Return on Assets base 100 = = IF((C5) >= 15%, 100, IF((C5) >= 10%, 80, IF((C5) >= 5%, 60, IF((C5) >= 0%, 40, 20)))) -- added = to 15
-- Debt to Equity Ratio base 100 =IF(C7 < 0, 0, IF(C7 <= 0.5, 100, IF(C7 <= 1, 50, 25)))
-- Current Ratio base 100 = IF((C6 ) >= 2, 100, IF((C6) >= 1.5, 80, IF((C6 ) >= 1, 60, IF((C6) > 0, 40, 20)))) -- added = to 2

-- credit utilization base 100
-- credit utilization base 100 = IF((C8) <= 10%, 100, IF((C8) <=20%, 75, IF((C8)>=30%, 25, 50))) -- added = to 30 // TBD

-- public records base 100
-- bankruptcies base 100 = =IF(C10=0, 100, IF(C10=1,50,25))
-- liens base 100 =IF(C11=0, 100, IF(C11=1,50,25))
-- judgements base 100 =IF(C12=0, 100, IF(C12=1,50,25))
-- social profile base 100 =if(C13>=4, 100, if(C13>=3, 80, if(C13>=2, 60, if(C13>=1, 40, 20))))

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (1, 1, '100', 20);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (1, 1, 15, true, null, false, 100);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (2, 1, 10, true, 15, false, 80);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (3, 1, 5, true, 10, false, 60);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (4, 1, 0, true, 5, false, 40);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (2, 2, '100', 20);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (5, 2, 15, true, null, false, 100);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (6, 2, 10, true, 15, false, 80);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (7, 2, 5, true, 10, false, 60);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (8, 2, 0, true, 5, false, 40);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (3, 3, '100', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (9, 3, 0, true, 0.5, false, 100);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (10, 3, 0.5, true, 1, false, 50);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (11, 3, 1, true, null, false, 25);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (4, 4, '100', 20);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (12, 4, 2, true, null, false, 100);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (13, 4, 1.5, true, 2, false, 80);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (14, 4, 1, true, 1.5, false, 60);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (15, 4, 0, true, 1, false, 40);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (5, 5, '100', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (16, 5, 0, false, 10, false, 100);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (17, 5, 10, true, 20, false, 75);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (18, 5, 20, true, 30, false, 50);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (19, 5, 30, true, null, false, 25);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (6, 6, '100', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (20, 6, 0, true, 0, true, 100); -- equivalent to condition == 0
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (21, 6, 1, true, 1, true, 50); -- equivalent to condition == 1
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (22, 6, 2, true, null, false, 25); -- equivalent to condition > 1

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (7, 7, '100', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (23, 7, 0, true, 0, true, 100); -- equivalent to condition == 0
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (24, 7, 1, true, 1, true, 50); -- equivalent to condition == 1
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (25, 7, 2, true, null, false, 25); -- equivalent to condition > 1

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (8, 8, '100', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (26, 8, 0, true, 0, true, 100); -- equivalent to condition == 0
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (27, 8, 1, true, 1, true, 50); -- equivalent to condition == 1
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (28, 8, 2, true, null, false, 25); -- equivalent to condition > 1

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (9, 9, '100', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (29, 9, 0, true, 1, false, 20);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (30, 9, 1, true, 2, false, 40);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (31, 9, 2, true, 3, false, 60);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (32, 9, 3, true, 4, false, 80);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (33, 9, 4, true, 5, true, 100);


-- Financial strength base 850
-- Net Profit Margin base 850 = IF((C4) >= 15%, 850, IF((C4) >= 10%, 680, IF((C4) >= 5%, 510, IF((C4) > 0%, 340, 170)))) -- added = to 15
-- Return on Assets base 850 = IF((C5) >= 15%,850, IF((C5) >= 10%, 680, IF((C5) >= 5%, 510, IF((C5) > 0%, 340, 170)))) -- added = to 15
-- Debt to Equity Ratio base 850 =IF(C7 < 0, 0, IF(C7 <= 0.5, 850, IF(C7 <= 1, 425, 212.5)))
-- Current Ratio base 850 = IF((C6 ) >= 2, 850, IF((C6) >= 1.5, 680, IF((C6 ) >= 1, 510, IF((C6) > 0, 340, 170)))) -- added = to 2

-- credit utilization base 850
-- credit utilization base 850 = IF((C8) <= 10%, 850, IF((C8) <=20%, 637.5, IF((C8)>30%, 212.5, 425))) -- equal tos are excluded // TBD

-- public records base 850
-- bankruptcies base 850 =IF(C10=0, 850, IF(C10=1,425,283.33))
-- liens base 850 =IF(C11=0, 850, IF(C11=1,425,283.33))
-- judgements base 850 =IF(C12=0, 850, IF(C12=1,425,283.33))
-- social profile base 850 =if(C13>=4, 850, if(C13>=3, 680, if(C13>=2, 510, if(C13>=1, 340, 170))))

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (10, 1, '850', 170);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (34, 10, 15, true, null, false, 850);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (35, 10, 10, true, 15, false, 680);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (36, 10, 5, true, 10, false, 510);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (37, 10, 0, true, 5, false, 340);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (11, 2, '850', 170);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (38, 11, 15, true, null, false, 850);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (39, 11, 10, true, 15, false, 680);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (40, 11, 5, true, 10, false, 510);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (41, 11, 0, true, 5, false, 340);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (12, 3, '850', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (42, 12, 0, true, 0.5, false, 850);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (43, 12, 0.5, true, 1, false, 425);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (44, 12, 1, true, null, false, 212.5);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (13, 4, '850', 170);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (45, 13, 2, true, null, false, 850);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (46, 13, 1.5, true, 2, false, 680);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (47, 13, 1, true, 1.5, false, 510);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (48, 13, 0, true, 1, false, 340);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (14, 5, '850', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (49, 14, 0, false, 10, false, 850);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (50, 14, 10, true, 20, false, 637.5);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (51, 14, 20, true, 30, false, 425);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (52, 14, 30, true, null, false, 212.5);

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (15, 6, '850', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (53, 15, 0, true, 0, true, 850); -- equivalent to condition == 0
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (54, 15, 1, true, 1, true, 425); -- equivalent to condition == 1
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (55, 15, 2, true, null, false, 212.5); -- equivalent to condition > 1

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (16, 7, '850', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (56, 16, 0, true, 0, true, 850); -- equivalent to condition == 0
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (57, 16, 1, true, 1, true, 425); -- equivalent to condition == 1
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (58, 16, 2, true, null, false, 212.5); -- equivalent to condition > 1

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (17, 8, '850', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (59, 17, 0, true, 0, true, 850); -- equivalent to condition == 0
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (60, 17, 1, true, 1, true, 425); -- equivalent to condition == 1
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (61, 17, 2, true, null, false, 212.5); -- equivalent to condition > 1

INSERT INTO rel_score_factor_evaluation_config (id, score_factor_id, base, default_score) VALUES (18, 9, '850', 0);

INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (62, 18, 0, true, 1, false, 170);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (63, 18, 1, true, 2, false, 340);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (64, 18, 2, true, 3, false, 510);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (65, 18, 3, true, 4, false, 680);
INSERT INTO score_evaluation_config (id, config_id, range_start, is_start_inclusive, range_end, is_end_inclusive, score_value) VALUES (66, 18, 4, true, 5, true, 850);
