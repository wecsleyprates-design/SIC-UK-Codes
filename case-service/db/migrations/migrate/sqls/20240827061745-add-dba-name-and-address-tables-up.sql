-- create table `data_business_names`
CREATE TABLE IF NOT EXISTS data_business_names (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_id UUID NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT fk_business_id FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE
);

-- create table `data_business_addresses`
CREATE TABLE IF NOT EXISTS data_business_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_1 VARCHAR(255) NOT NULL,
    apartment VARCHAR(255) NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    country VARCHAR(50) NOT NULL DEFAULT 'USA',
    mobile VARCHAR(15) NULL,
    business_id UUID NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    CONSTRAINT fk_business_id FOREIGN KEY (business_id) REFERENCES data_businesses(id) ON DELETE CASCADE
);


-- insert data into business names table
INSERT INTO data_business_names (is_primary, business_id, name, created_at, created_by, updated_at, updated_by)
    SELECT true, id, name, created_at, created_by, updated_at, updated_by
    FROM data_businesses
    WHERE name IS NOT NULL;


-- insert data into business addresses table
INSERT INTO data_business_addresses (is_primary, business_id, line_1, apartment, city, state, country, postal_code, mobile, created_at, created_by, updated_at, updated_by)
    SELECT true, id, address_line_1, COALESCE(address_line_2, address_apartment), address_city, address_state, COALESCE(address_country, 'USA'), address_postal_code, mobile, created_at, created_by, updated_at, updated_by
    FROM data_businesses
    WHERE address_line_1 IS NOT NULL;

