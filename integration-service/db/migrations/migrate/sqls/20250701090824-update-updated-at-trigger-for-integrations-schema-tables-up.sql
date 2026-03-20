--- drop existing triggers
DROP TRIGGER update_data_business_integrations_tasks_timestamp ON integrations.data_business_integrations_tasks;
DROP TRIGGER update_data_connections_timestamp ON integrations.data_connections;

--- create new trigger to update the updated_at column
CREATE TRIGGER update_data_connections_updated_at
BEFORE UPDATE ON integrations.data_connections
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER update_data_business_integrations_tasks_updated_at
BEFORE UPDATE ON integrations.data_business_integrations_tasks
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();
