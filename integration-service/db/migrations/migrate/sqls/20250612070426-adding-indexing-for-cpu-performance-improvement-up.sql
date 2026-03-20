-- Add index on category_id in integrations.core_integrations_platforms
CREATE INDEX IF NOT EXISTS core_integrations_platforms_category_id_key
    ON integrations.core_integrations_platforms (category_id);

-- Add index on platform_id in integrations.rel_platforms_status
CREATE INDEX IF NOT EXISTS rel_platforms_status_platform_id_key
    ON integrations.rel_platforms_status (platform_id);

-- Add index on connection_id in integrations.data_connections_history
CREATE INDEX IF NOT EXISTS data_connections_history_connection_id_key
    ON integrations.data_connections_history (connection_id);

-- Add index on connection_status in integrations.data_connections_history
CREATE INDEX IF NOT EXISTS data_connections_history_connection_status_key
    ON integrations.data_connections_history (connection_status);