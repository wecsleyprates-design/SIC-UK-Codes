
CREATE TABLE IF NOT EXISTS integration_data.business_entity_people
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    business_entity_verification_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    name text not null,
    titles text[] not null,
    submitted boolean,
    source jsonb not null default '{}',
    metadata jsonb NOT NULL default '{}',
    CONSTRAINT pk_business_entity_people PRIMARY KEY (id),
    CONSTRAINT business_entity_verification_id_person_name_unique UNIQUE (business_entity_verification_id, name),
    CONSTRAINT fk_business_entity_verification_id_business_entity_people FOREIGN KEY (business_entity_verification_id)
        REFERENCES integration_data.business_entity_verification (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_entity_people_verification_id
    ON integration_data.business_entity_people USING btree
    (business_entity_verification_id ASC NULLS LAST);

CREATE OR REPLACE TRIGGER update_business_entity_people_timestamp
    AFTER UPDATE 
    ON integration_data.business_entity_people
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();