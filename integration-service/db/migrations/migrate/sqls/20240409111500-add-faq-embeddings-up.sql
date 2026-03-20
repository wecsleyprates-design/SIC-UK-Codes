CREATE TABLE IF NOT EXISTS public.faq_embeddings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    embedding vector (1536) not null
);

-- cosine similarity function
create or replace function faq_search (
  query_embedding vector(1536),
  similarity_threshold float,
  match_count int
)
returns table (
  id uuid,
  question text,
  answer text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    public.faq_embeddings.id,
    public.faq_embeddings.question,
    public.faq_embeddings.answer,
    1 - (public.faq_embeddings.embedding <=> query_embedding) as similarity
    from public.faq_embeddings
    where 1 - (public.faq_embeddings.embedding <=> query_embedding) > similarity_threshold
    order by public.faq_embeddings.embedding <=> query_embedding
    limit match_count;
    end;
    $$;