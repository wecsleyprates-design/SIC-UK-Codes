CREATE TABLE public.additional_document_uploads (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	case_id uuid NOT NULL,
	case_info_request_id uuid NULL,
	"document" varchar(255) NULL,
	CONSTRAINT additional_document_uploads_pkey PRIMARY KEY (id),
	CONSTRAINT case_id_fk FOREIGN KEY (case_id) REFERENCES public.data_cases(id) ON DELETE CASCADE,
	CONSTRAINT case_info_request_id_fk FOREIGN KEY (case_info_request_id) REFERENCES public.data_cases_info_requests(id) ON DELETE CASCADE
);

INSERT INTO public.additional_document_uploads (case_info_request_id, document, case_id)
SELECT 
  dcird.info_request_id AS case_info_request_id,
  dcird.document,
  dcir.case_id
FROM data_cases_info_requests_documents dcird
JOIN data_cases_info_requests dcir ON dcird.info_request_id = dcir.id;

DROP TABLE IF EXISTS data_cases_info_requests_documents;
