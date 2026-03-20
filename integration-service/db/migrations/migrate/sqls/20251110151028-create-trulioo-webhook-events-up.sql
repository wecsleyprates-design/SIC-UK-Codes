-- Create table for Trulioo webhook idempotency tracking
CREATE TABLE integration_data.trulioo_webhook_events (
	id bigserial PRIMARY KEY,
	webhook_id varchar(255) NOT NULL,
	transaction_id varchar(255) NOT NULL,
	client_id varchar(255) NULL,
	event_name varchar(100) NULL,
	event_type varchar(100) NULL,
	event_result varchar(100) NULL,
	has_error boolean DEFAULT false,
	processed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT uq_trulioo_webhook_id_transaction UNIQUE (webhook_id, transaction_id)
);

-- Create index for faster lookups
CREATE INDEX idx_trulioo_webhook_events_webhook_id ON integration_data.trulioo_webhook_events (webhook_id);
CREATE INDEX idx_trulioo_webhook_events_transaction_id ON integration_data.trulioo_webhook_events (transaction_id);
CREATE INDEX idx_trulioo_webhook_events_processed_at ON integration_data.trulioo_webhook_events (processed_at);

COMMENT ON TABLE integration_data.trulioo_webhook_events IS 'Tracks processed Trulioo webhook events for idempotency';
COMMENT ON COLUMN integration_data.trulioo_webhook_events.webhook_id IS 'Trulioo webhook identifier from the webhook payload';
COMMENT ON COLUMN integration_data.trulioo_webhook_events.transaction_id IS 'Trulioo transaction ID from the webhook payload';
COMMENT ON COLUMN integration_data.trulioo_webhook_events.processed_at IS 'Timestamp when the webhook was first processed';

