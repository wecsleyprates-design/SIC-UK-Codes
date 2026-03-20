CREATE TABLE integration_data.payload_cache (
  id         bigserial PRIMARY KEY,
  request_payload    jsonb NOT NULL,
  request_fingerprint text not null,
  response_payload jsonb,
  response_fingerprint text,
  platform_id integer not null,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_platform FOREIGN KEY (platform_id) REFERENCES integrations.core_integrations_platforms (id)
);
CREATE UNIQUE INDEX idx_payload_cache_fingerprint ON integration_data.payload_cache (request_fingerprint, platform_id);

COMMENT ON COLUMN integration_data.payload_cache.request_fingerprint IS 'Fingerprint of the request payload calculated with a SHA256 HEX hash';
COMMENT ON COLUMN integration_data.payload_cache.response_fingerprint IS 'Fingerprint of the response payload calculated with a SHA256 HEX hash';