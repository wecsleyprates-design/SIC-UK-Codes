--- Table structure for table `rel_risk_cases`
CREATE TABLE rel_risk_cases (
  case_id UUID NOT NULL REFERENCES data_cases(id),
  risk_alert_id UUID NOT NULL,
  CONSTRAINT case_id_fk FOREIGN KEY (case_id) REFERENCES data_cases(id) 
);