/* Add media_type column to adverse_media_articles table */
ALTER TABLE integration_data.adverse_media_articles 
ADD COLUMN media_type VARCHAR(50) DEFAULT 'business';

/* Increase link field size to accommodate longer URLs */
ALTER TABLE integration_data.adverse_media_articles 
ALTER COLUMN link TYPE VARCHAR(2048);

/* Increase title field size to accommodate longer titles */
ALTER TABLE integration_data.adverse_media_articles 
ALTER COLUMN title TYPE VARCHAR(2048);

/* Update unique constraint to include media_type */
ALTER TABLE integration_data.adverse_media_articles 
DROP CONSTRAINT unique_adverse_media_article_link_business_id;

ALTER TABLE integration_data.adverse_media_articles 
ADD CONSTRAINT unique_adverse_media_article_link_business_id_media_type 
UNIQUE (link, business_id, media_type);