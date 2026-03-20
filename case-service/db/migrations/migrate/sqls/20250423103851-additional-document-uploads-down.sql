-- Recreate the old table
CREATE TABLE public.data_cases_info_requests_documents (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	info_request_id uuid NOT NULL,
	document varchar(255) NULL,
	CONSTRAINT data_cases_info_requests_documents_pkey PRIMARY KEY (id),
	CONSTRAINT info_request_id_fk FOREIGN KEY (info_request_id) REFERENCES public.data_cases_info_requests(id) ON DELETE CASCADE
);

-- Restore data from additional_document_uploads
INSERT INTO public.data_cases_info_requests_documents (id, info_request_id, document)
SELECT 
	case_info_request_id AS id,
	case_info_request_id AS info_request_id,
	document
FROM public.additional_document_uploads
WHERE case_info_request_id IS NOT NULL;

-- Drop the new table
DROP TABLE IF EXISTS public.additional_document_uploads;
