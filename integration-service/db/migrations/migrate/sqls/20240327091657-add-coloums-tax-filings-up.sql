/* Replace with your SQL commands */
ALTER TABLE integration_data.tax_filings
ADD COLUMN interest numeric NULL,
ADD COLUMN interest_date varchar(50) NULL,
ADD COLUMN penalty numeric NULL,
ADD COLUMN penalty_date varchar(50) NULL,
ADD COLUMN filed_date varchar(50) NULL,
ADD COLUMN balance numeric NULL,
ADD COLUMN tax_period_ending_date varchar(50) NULL,
ADD COLUMN amount_filed numeric NULL;
