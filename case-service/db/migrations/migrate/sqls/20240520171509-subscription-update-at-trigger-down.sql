DROP TRIGGER  update_subscription_updated_at ON subscriptions.data_businesses_subscriptions;

-- - Revert the trigger
CREATE TRIGGER update_data_businesses_subscription_timestamp
    AFTER UPDATE
    ON
    subscriptions.data_businesses_subscriptions
    FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();