--Re-add the address_apartment column
ALTER TABLE data_businesses
    ADD COLUMN address_apartment VARCHAR(50) NULL;

--Restore data from the temporary table
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'tmp_data_businesses_address_apartment'
    ) THEN 
        UPDATE data_businesses db
            SET address_apartment = tmp.address_apartment
            FROM tmp_data_businesses_address_apartment tmp
            WHERE db.id = tmp.id;
    END IF;
END $$;

--Drop the temporary table
DROP TABLE IF EXISTS tmp_data_businesses_address_apartment;