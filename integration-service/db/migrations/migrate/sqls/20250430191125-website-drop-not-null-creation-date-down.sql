UPDATE integration_data.business_entity_website_data SET creation_date = '1970-01-01' WHERE creation_date is null;
ALTER TABLE integration_data.business_entity_website_data ALTER COLUMN creation_date SET NOT NULL;

UPDATE integration_data.business_entity_website_data SET expiration_date = '1970-01-01' WHERE expiration_date is null;
ALTER TABLE integration_data.business_entity_website_data ALTER COLUMN expiration_date SET NOT NULL;