CREATE TABLE "public"."rel_business_industry_naics" (
    "business_id" uuid NOT NULL,
    "platform" VARCHAR(255) NOT NULL,
    "industry_id" INT NULL,
    "naics_id" INT NULL,
    CONSTRAINT "fk_business_id" FOREIGN KEY ("business_id") REFERENCES "public"."data_businesses" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "fk_industry_id" FOREIGN KEY ("industry_id") REFERENCES "public"."core_business_industries" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "fk_naics_id" FOREIGN KEY ("naics_id") REFERENCES "public"."core_naics_code" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "unique_business_id_platform" UNIQUE("business_id", "platform")
);