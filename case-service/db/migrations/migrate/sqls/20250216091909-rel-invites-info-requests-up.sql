CREATE TABLE public.rel_invites_info_requests (
    data_invite_id UUID NOT NULL,
    data_info_request_id UUID NOT NULL,
    CONSTRAINT data_invite_id_fk FOREIGN KEY (data_invite_id) REFERENCES data_invites(id),
    CONSTRAINT data_info_request_id_fk FOREIGN KEY (data_info_request_id) REFERENCES data_cases_info_requests(id)
);