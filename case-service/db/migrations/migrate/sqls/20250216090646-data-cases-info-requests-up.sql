CREATE TYPE info_request_status AS ENUM (
  'REQUESTED',
  'COMPLETED'
);

CREATE TABLE public.data_cases_info_requests (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    case_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    stages varchar(50)[] NULL,
    progression_config jsonb[] NULL,
    documents_required boolean NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    status info_request_status NOT NULL,
    CONSTRAINT case_id_fk FOREIGN KEY (case_id) REFERENCES data_cases(id)
);