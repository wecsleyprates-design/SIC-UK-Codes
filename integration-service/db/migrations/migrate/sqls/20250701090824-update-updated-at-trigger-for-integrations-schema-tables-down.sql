-- Drop newly created triggers
DROP TRIGGER update_data_business_integrations_tasks_updated_at ON integrations.data_business_integrations_tasks;
DROP TRIGGER update_data_connections_updated_at ON integrations.data_connections;


-- Revert the trigger
CREATE TRIGGER update_data_connections_timestamp
    AFTER UPDATE
    ON
    integrations.data_connections
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER update_data_business_integrations_tasks_timestamp
    AFTER UPDATE
    ON
    integrations.data_business_integrations_tasks
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();
