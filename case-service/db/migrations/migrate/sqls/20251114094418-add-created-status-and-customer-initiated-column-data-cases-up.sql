
INSERT INTO public.core_case_statuses (id, code, label) 
VALUES (20, 'CREATED', 'CREATED')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE data_cases
ADD COLUMN IF NOT EXISTS customer_initiated BOOLEAN NOT NULL DEFAULT false;

