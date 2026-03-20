/* Replace with your SQL commands */
alter table public.rel_business_customer_monitoring drop constraint if exists rel_business_customer_monitoring_external_id_unique;
DO $$
BEGIN
    -- Check if the column does not exist in the table
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'rel_business_customer_monitoring' 
        AND column_name = 'external_id'
        AND table_schema = 'public' -- Change this to your schema, default is 'public'
    ) THEN
        -- Add the column to the table if it does not exist
        ALTER TABLE public.rel_business_customer_monitoring DROP COLUMN external_id;
    END IF;

     IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'rel_business_customer_monitoring' 
        AND column_name = 'metadata'
        AND table_schema = 'public' -- Change this to your schema, default is 'public'
    ) THEN
        -- Add the column to the table if it does not exist
        ALTER TABLE public.rel_business_customer_monitoring DROP COLUMN metadata;
    END IF;
END
$$;

