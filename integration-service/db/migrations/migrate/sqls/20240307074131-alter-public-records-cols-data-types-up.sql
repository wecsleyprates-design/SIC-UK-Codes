/* Replace with your SQL commands */
ALTER TABLE "integration_data"."public_records" ALTER COLUMN angi_review_percentage TYPE DOUBLE PRECISION USING angi_review_percentage::DOUBLE PRECISION;

ALTER TABLE "integration_data"."public_records" ALTER COLUMN bbb_review_percentage TYPE DOUBLE PRECISION USING bbb_review_percentage::DOUBLE PRECISION;

ALTER TABLE "integration_data"."public_records" ALTER COLUMN google_review_percentage TYPE DOUBLE PRECISION USING google_review_percentage::DOUBLE PRECISION;

ALTER TABLE "integration_data"."public_records" ALTER COLUMN yelp_review_percentage TYPE DOUBLE PRECISION USING yelp_review_percentage::DOUBLE PRECISION;

ALTER TABLE "integration_data"."public_records" ALTER COLUMN healthgrades_review_percentage TYPE DOUBLE PRECISION USING healthgrades_review_percentage::DOUBLE PRECISION;

ALTER TABLE "integration_data"."public_records" ALTER COLUMN vitals_review_percentage TYPE DOUBLE PRECISION USING vitals_review_percentage::DOUBLE PRECISION;

ALTER TABLE "integration_data"."public_records" ALTER COLUMN webmd_review_percentage TYPE DOUBLE PRECISION USING webmd_review_percentage::DOUBLE PRECISION;
