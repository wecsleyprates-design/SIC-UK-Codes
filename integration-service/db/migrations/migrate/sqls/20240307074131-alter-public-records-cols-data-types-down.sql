/* Replace with your SQL commands */
ALTER TABLE integration_data.public_records ALTER COLUMN webmd_review_percentage TYPE INT USING webmd_review_percentage::INT;

ALTER TABLE integration_data.public_records ALTER COLUMN vitals_review_percentage TYPE INT USING vitals_review_percentage::INT;

ALTER TABLE integration_data.public_records ALTER COLUMN healthgrades_review_percentage TYPE INT USING healthgrades_review_percentage::INT;

ALTER TABLE integration_data.public_records ALTER COLUMN yelp_review_percentage TYPE INT USING yelp_review_percentage::INT;

ALTER TABLE integration_data.public_records ALTER COLUMN google_review_percentage TYPE INT USING google_review_percentage::INT;

ALTER TABLE integration_data.public_records ALTER COLUMN bbb_review_percentage TYPE INT USING bbb_review_percentage::INT;

ALTER TABLE integration_data.public_records ALTER COLUMN angi_review_percentage TYPE INT USING angi_review_percentage::INT;