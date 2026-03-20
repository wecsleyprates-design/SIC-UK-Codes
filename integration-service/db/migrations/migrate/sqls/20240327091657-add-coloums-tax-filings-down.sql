/* Replace with your SQL commands */
ALTER TABLE integration_data.tax_filings
DROP COLUMN IF EXISTS amount_filed,
DROP COLUMN IF EXISTS tax_period_ending_date,
DROP COLUMN IF EXISTS balance,
DROP COLUMN IF EXISTS filed_date,
DROP COLUMN IF EXISTS penalty_date,
DROP COLUMN IF EXISTS penalty,
DROP COLUMN IF EXISTS interest_date,
DROP COLUMN IF EXISTS interest;