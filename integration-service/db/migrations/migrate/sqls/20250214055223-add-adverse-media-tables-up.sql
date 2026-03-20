/* Replace with your SQL commands */
INSERT INTO "integrations"."core_integrations_platforms" ("id", "code", "label", "category_id") 
VALUES (27, 'adverse_media', 'Adverse Media', 5);

INSERT INTO "integrations"."core_tasks" ("id", "code", "label") 
VALUES (21, 'fetch_adverse_media', 'Fetch Adverse Media');

INSERT INTO "integrations"."rel_tasks_integrations" ("id", "task_category_id", "platform_id") 
VALUES (62, 21, 27);


-- Table for storing basic information
CREATE TABLE integration_data.adverse_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    business_integration_task_id UUID NOT NULL,
    total_risk_count INT NOT NULL,
    high_risk_count INT NOT NULL,
    medium_risk_count INT NOT NULL,
    low_risk_count INT NOT NULL,
    average_risk_score DECIMAL NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}', -- all data that we got can be stored in this
	created_at timestamp NOT NULL DEFAULT current_timestamp,
	updated_at timestamp NOT NULL DEFAULT current_timestamp,
	CONSTRAINT "fk_adverse_media_task_id_business_integration_tasks_id" FOREIGN KEY ("business_integration_task_id") REFERENCES "integrations"."data_business_integrations_tasks" ("id") ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT "unique_business_integration_task_id" UNIQUE ("business_id", "business_integration_task_id")
);

-- Table for storing articles data
CREATE TABLE integration_data.adverse_media_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adverse_media_id UUID NOT NULL,
    business_id UUID NOT NULL,
    title VARCHAR(512) NOT NULL,
    link VARCHAR(512) NOT NULL,
    date TIMESTAMP NOT NULL,
    source VARCHAR(255) NOT NULL,
    keywords_score INT NOT NULL,
    negative_sentiment_score INT NOT NULL,
    entity_focus_score INT NOT NULL,
    final_score INT NOT NULL,
    risk_level VARCHAR(50) NOT NULL,
    risk_description TEXT NOT NULL,
	created_at timestamp NOT NULL DEFAULT current_timestamp,
	updated_at timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT "fk_adverse_media_id" FOREIGN KEY ("adverse_media_id") REFERENCES "integration_data"."adverse_media" ("id") ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT "unique_adverse_media_article_link_business_id" UNIQUE ("link", "business_id")
);
