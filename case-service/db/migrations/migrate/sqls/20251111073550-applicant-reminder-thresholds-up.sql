
CREATE TABLE IF NOT EXISTS core_applicant_configs (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    label VARCHAR(200) NOT NULL,
    config JSONB NOT NULL
);


INSERT INTO core_applicant_configs (id, code, label, config)
VALUES
    (1, 'APPLICANT_REMINDER', 'Applicant Reminder', '[
  {
    "urgency": "low",
    "threshold": 30,
    "message": "Please complete your application soon.",
    "allowed_case_status": [1, 3, 20]
  },
  {
    "urgency": "medium",
    "threshold": 60,
    "message": "Your application has been pending for some time — please review missing details.",
    "allowed_case_status": [1, 3, 20]
  },
  {
    "urgency": "high",
    "threshold": 90,
    "message": "Your application is overdue and may be closed soon if no action is taken.",
    "allowed_case_status": [1, 3, 20]
  }
]')
ON CONFLICT (id) DO NOTHING;


CREATE TABLE IF NOT EXISTS business_applicant_configs (
    id SERIAL PRIMARY KEY,
    business_id UUID NOT NULL,
    core_config_id INT NOT NULL REFERENCES core_applicant_configs(id),
    config JSONB NOT NULL
);


CREATE TABLE IF NOT EXISTS customer_applicant_configs (
    id SERIAL PRIMARY KEY,
    customer_id UUID NOT NULL,
    core_config_id INT NOT NULL REFERENCES core_applicant_configs(id),
    config JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS data_applicants_threshold_reminder_tracker (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    applicant_id UUID NOT NULL,
    case_id UUID NOT NULL,
    business_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    threshold_days INT NOT NULL,
    urgency VARCHAR(50) NOT NULL,
    days_since_invite_click INT,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    CONSTRAINT uq_applicant_core_threshold UNIQUE (applicant_id, case_id, urgency)
);


CREATE INDEX IF NOT EXISTS idx_reminder_tracker_applicant_id
    ON data_applicants_threshold_reminder_tracker (applicant_id);

CREATE INDEX IF NOT EXISTS idx_reminder_tracker_case_id
    ON data_applicants_threshold_reminder_tracker (case_id);

CREATE INDEX IF NOT EXISTS idx_reminder_tracker_business_id
    ON data_applicants_threshold_reminder_tracker (business_id);