ALTER TABLE IF EXISTS integration_data.tax_filings
ADD COLUMN version INT NOT NULL DEFAULT 1;
