/* Replace with your SQL commands */
DO $$
BEGIN
    -- Check if the column does not exist in the table
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'rel_business_customer_monitoring' 
        AND column_name = 'external_id'
        AND table_schema = 'public' -- Change this to your schema, default is 'public'
    ) THEN
        -- Add the column to the table if it does not exist
        ALTER TABLE public.rel_business_customer_monitoring ADD COLUMN external_id VARCHAR(50);
    END IF;

     IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'rel_business_customer_monitoring' 
        AND column_name = 'metadata'
        AND table_schema = 'public' -- Change this to your schema, default is 'public'
    ) THEN
        -- Add the column to the table if it does not exist
        ALTER TABLE public.rel_business_customer_monitoring ADD COLUMN metadata jsonb;
    END IF;
END
$$;

alter table public.rel_business_customer_monitoring drop constraint if exists rel_business_customer_monitoring_external_id_unique;
alter table public.rel_business_customer_monitoring add constraint rel_business_customer_monitoring_external_id_unique unique (external_id, customer_id);
