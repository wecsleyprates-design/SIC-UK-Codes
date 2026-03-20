/* Replace with your SQL commands */
ALTER TABLE public.data_owners
    ALTER COLUMN ssn SET NOT NULL,
    ALTER COLUMN title SET NOT NULL,
    ALTER COLUMN date_of_birth SET NOT NULL,
    ALTER COLUMN address_line_1 SET NOT NULL,
    ALTER COLUMN address_city SET NOT NULL,
    ALTER COLUMN address_state SET NOT NULL,
    ALTER COLUMN address_country SET NOT NULL;