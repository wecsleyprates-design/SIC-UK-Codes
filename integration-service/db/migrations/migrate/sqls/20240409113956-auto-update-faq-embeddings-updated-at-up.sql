-- Step 1: Create the function
CREATE OR REPLACE FUNCTION public.update_faq_embeddings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create the trigger
CREATE TRIGGER faq_embeddings_before_update
BEFORE UPDATE ON public.faq_embeddings
FOR EACH ROW
EXECUTE FUNCTION public.update_faq_embeddings_timestamp();