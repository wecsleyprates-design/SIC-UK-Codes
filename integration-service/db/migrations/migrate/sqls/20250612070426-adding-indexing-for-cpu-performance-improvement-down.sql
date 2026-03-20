-- Drop index on category_id in integrations.core_integrations_platforms
DROP INDEX IF EXISTS integrations.core_integrations_platforms_category_id_key;

-- Drop index on platform_id in integrations.rel_platforms_status
DROP INDEX IF EXISTS integrations.rel_platforms_status_platform_id_key;

-- Drop index on connection_id in integrations.data_connections_history
DROP INDEX IF EXISTS integrations.data_connections_history_connection_id_key;

-- Drop index on connection_status in integrations.data_connections_history
DROP INDEX IF EXISTS integrations.data_connections_history_connection_status_key;