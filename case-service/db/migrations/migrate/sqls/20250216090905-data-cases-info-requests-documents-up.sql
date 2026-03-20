CREATE TABLE public.data_cases_info_requests_documents (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    info_request_id UUID NOT NULL,
    document varchar(255),
    CONSTRAINT info_request_id_fk FOREIGN KEY (info_request_id) REFERENCES data_cases_info_requests(id) ON DELETE CASCADE
);