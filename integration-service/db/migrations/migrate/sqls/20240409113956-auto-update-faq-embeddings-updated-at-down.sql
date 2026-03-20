-- Drop the trigger associated with the table
DROP TRIGGER IF EXISTS faq_embeddings_before_update ON public.faq_embeddings;

-- Drop the function used by the trigger
DROP FUNCTION IF EXISTS public.update_faq_embeddings_timestamp;