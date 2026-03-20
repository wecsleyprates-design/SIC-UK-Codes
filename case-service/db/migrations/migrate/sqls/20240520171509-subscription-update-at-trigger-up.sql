--- drop existing trigger
DROP TRIGGER update_data_businesses_subscription_timestamp ON subscriptions.data_businesses_subscriptions;

--- create new trigger to update the updated_at column
CREATE TRIGGER update_subscription_updated_at
BEFORE UPDATE ON subscriptions.data_businesses_subscriptions
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();