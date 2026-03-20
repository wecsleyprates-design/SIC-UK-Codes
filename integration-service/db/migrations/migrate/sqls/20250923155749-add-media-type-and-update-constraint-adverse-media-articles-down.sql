/* Revert unique constraint back to original */
ALTER TABLE integration_data.adverse_media_articles 
DROP CONSTRAINT unique_adverse_media_article_link_business_id_media_type;

ALTER TABLE integration_data.adverse_media_articles 
ADD CONSTRAINT unique_adverse_media_article_link_business_id 
UNIQUE (link, business_id);

/* Revert link field size back to original */
ALTER TABLE integration_data.adverse_media_articles 
ALTER COLUMN link TYPE VARCHAR(512);

/* Revert title field size back to original */
ALTER TABLE integration_data.adverse_media_articles 
ALTER COLUMN title TYPE VARCHAR(512);

/* Remove media_type column from adverse_media_articles table */
ALTER TABLE integration_data.adverse_media_articles 
DROP COLUMN media_type;