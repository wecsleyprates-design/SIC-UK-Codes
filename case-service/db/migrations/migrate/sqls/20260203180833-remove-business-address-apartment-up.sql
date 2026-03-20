--Creates a temporary table to backup the address_apartment column
CREATE TABLE IF NOT EXISTS tmp_data_businesses_address_apartment (
    id UUID PRIMARY KEY,
    address_apartment VARCHAR(50) NULL
);

--Backup address_apartment column data to the temporary table
INSERT INTO tmp_data_businesses_address_apartment (id, address_apartment)
    SELECT id, address_apartment
    FROM data_businesses
    WHERE address_apartment IS NOT NULL;

--Set address_line_2 equal to address_apartment when address_apartment is not null
UPDATE data_businesses
    SET address_line_2 = address_apartment
    WHERE address_apartment IS NOT NULL;

--Drop address_apartment column
ALTER TABLE data_businesses
    DROP COLUMN address_apartment;