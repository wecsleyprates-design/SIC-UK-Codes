CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id
    ON integration_data.bank_account_transactions USING btree
    (transaction_id)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_bankaccounts_account_id
    ON integration_data.bank_accounts USING btree
    (bank_account)
    TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS integration_data.banking_balances_daily
(
    bank_account_id UUID NOT NULL,
    date date NOT NULL,
    currency varchar NOT NULL,
    current numeric(20, 2) NOT NULL DEFAULT 0,
    available numeric(20, 2) NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone, 
    CONSTRAINT banking_balances_daily_pkey PRIMARY KEY (bank_account_id, date),
    CONSTRAINT fk_banking_balance_daily_account FOREIGN KEY (bank_account_id) REFERENCES integration_data.bank_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
);
