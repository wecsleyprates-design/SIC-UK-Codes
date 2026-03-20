ALTER TABLE "rel_business_customer_monitoring" ADD COLUMN "is_monitoring_enabled" BOOLEAN NOT NULL DEFAULT FALSE;


CREATE TABLE "data_business_scores" (
	"score_trigger_id" UUID PRIMARY KEY,
	"business_id" UUID NOT NULL,
	"customer_id" UUID NULL,
	"trigger_type" VARCHAR NOT NULL,
	"score_100" DECIMAL(10, 2) NOT NULL,
	"score_850" DECIMAL(10, 2) NOT NULL,
	"risk_level" VARCHAR(25) NOT NULL,
	"decision" VARCHAR(25) NOT NULL,
	"created_at" TIMESTAMP DEFAULT current_timestamp NOT NULL
);
