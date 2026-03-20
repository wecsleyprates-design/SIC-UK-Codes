-- Drop the cosine similarity function
DROP FUNCTION IF EXISTS faq_search(
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int
);

-- Drop the faq_embeddings table
DROP TABLE IF EXISTS public.faq_embeddings;