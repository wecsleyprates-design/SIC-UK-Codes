DROP TABLE IF EXISTS public.data_case_assignee_history;

CREATE TABLE public.data_case_assignee_history (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	case_id uuid NOT NULL,
	existing_assignee uuid NULL,
  new_assignee uuid NULL,
	assigner uuid NOT NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT data_case_assignee_history_pkey PRIMARY KEY (id),
	CONSTRAINT case_id_fk FOREIGN KEY (case_id) REFERENCES public.data_cases(id) ON DELETE CASCADE ON UPDATE RESTRICT
);