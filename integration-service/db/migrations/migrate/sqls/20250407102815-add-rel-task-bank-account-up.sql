-- Create rel_task_bank_account table
CREATE TABLE integration_data.rel_task_bank_account (
    business_integration_task_id UUID PRIMARY KEY,
    bank_account_id UUID[] NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create trigger for updating 'updated_at' column
CREATE OR REPLACE TRIGGER update_rel_task_bank_account_updated_at
BEFORE UPDATE ON integration_data.rel_task_bank_account 
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
