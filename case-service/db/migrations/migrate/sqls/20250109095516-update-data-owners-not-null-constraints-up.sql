/* Replace with your SQL commands */
ALTER TABLE public.data_owners
    ALTER COLUMN title DROP NOT NULL,
    ALTER COLUMN ssn DROP NOT NULL,
    ALTER COLUMN date_of_birth DROP NOT NULL,
    ALTER COLUMN address_line_1 DROP NOT NULL,
    ALTER COLUMN address_city DROP NOT NULL,
    ALTER COLUMN address_state DROP NOT NULL,
    ALTER COLUMN address_country DROP NOT NULL;