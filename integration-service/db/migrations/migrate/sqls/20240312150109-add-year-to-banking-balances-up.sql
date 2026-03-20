DO $$
BEGIN
    -- Check if the column does not exist in the table
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'banking_balances' 
        AND column_name = 'year'
        AND table_schema = 'integration_data' -- Change this to your schema, default is 'public'
    ) THEN
        -- Add the column to the table if it does not exist
        ALTER TABLE integration_data.banking_balances ADD COLUMN year INTEGER;
    END IF;
END
$$;