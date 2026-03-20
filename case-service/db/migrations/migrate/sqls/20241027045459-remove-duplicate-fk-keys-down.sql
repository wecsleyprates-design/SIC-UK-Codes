ALTER TABLE IF EXISTS rel_risk_cases ADD CONSTRAINT rel_risk_cases_case_id_fkey FOREIGN KEY (case_id) REFERENCES data_cases(id);

ALTER TABLE IF EXISTS rel_business_customer_monitoring ADD CONSTRAINT rel_business_customer_monitoring_business_id_fkey FOREIGN KEY (business_id) REFERENCES data_businesses(id);

ALTER TABLE IF EXISTS rel_business_owners ADD CONSTRAINT rel_business_owners_business_id_fkey FOREIGN KEY (business_id) REFERENCES data_businesses(id);

ALTER TABLE IF EXISTS rel_business_owners ADD CONSTRAINT rel_business_owners_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES data_owners(id);

ALTER TABLE IF EXISTS data_case_status_history ADD CONSTRAINT data_case_status_history_case_id_fkey FOREIGN KEY (case_id) REFERENCES data_cases(id);

ALTER TABLE IF EXISTS data_case_status_history ADD CONSTRAINT data_case_status_history_status_fkey FOREIGN KEY (status) REFERENCES core_case_statuses(id);

ALTER TABLE IF EXISTS data_cases ADD CONSTRAINT data_cases_business_id_fkey FOREIGN KEY (business_id) REFERENCES data_businesses(id);

ALTER TABLE IF EXISTS data_cases ADD CONSTRAINT data_cases_status_fkey FOREIGN KEY (status) REFERENCES core_case_statuses(id);