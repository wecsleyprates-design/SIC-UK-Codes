ALTER TABLE public.data_cases_info_requests
DROP CONSTRAINT case_id_fk;

ALTER TABLE public.rel_invites_info_requests
DROP CONSTRAINT data_invite_id_fk,
DROP CONSTRAINT data_info_request_id_fk;

ALTER TABLE public.data_cases_info_requests
ADD CONSTRAINT case_id_fk FOREIGN KEY (case_id)
REFERENCES data_cases(id);

ALTER TABLE public.rel_invites_info_requests
ADD CONSTRAINT data_invite_id_fk FOREIGN KEY (data_invite_id)
REFERENCES data_invites(id),
ADD CONSTRAINT data_info_request_id_fk FOREIGN KEY (data_info_request_id)
REFERENCES data_cases_info_requests(id);