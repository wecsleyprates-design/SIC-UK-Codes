ALTER TABLE data_invites ADD COLUMN case_id UUID,
ADD CONSTRAINT fk_data_invites_data_cases_case_id FOREIGN KEY (case_id) REFERENCES data_cases(id);
