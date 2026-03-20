CREATE TABLE rel_business_process_completion (
  business_id  UUID      NOT NULL
                 REFERENCES data_businesses(id)
                   ON DELETE CASCADE
                   ON UPDATE CASCADE,
  category     TEXT      NOT NULL,
  tasks        JSONB     NOT NULL DEFAULT '{}',
  created_on   TIMESTAMP NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, category)
);
