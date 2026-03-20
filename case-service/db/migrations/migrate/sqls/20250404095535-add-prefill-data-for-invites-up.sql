ALTER TABLE public.data_invites
ADD COLUMN prefill JSONB DEFAULT '{}'::jsonb;