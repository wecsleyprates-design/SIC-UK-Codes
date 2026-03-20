-- Monitoring schema for all risk monitoring structures
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Cadence enum for template integration groups
CREATE TYPE monitoring.monitoring_cadence_enum AS ENUM (
    'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL'
);

-- Status enum for business monitoring run
CREATE TYPE monitoring.monitoring_run_status_enum AS ENUM (
    'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'
);

CREATE TYPE monitoring.monitoring_association_enum as ENUM ('RULE', 'MANUAL');

-- monitoring_templates: customer templates for risk monitoring
CREATE TABLE monitoring.monitoring_templates (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    customer_id UUID NOT NULL,
    priority SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    label VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL
);

CREATE TRIGGER set_timestamp_monitoring_templates
BEFORE UPDATE ON monitoring.monitoring_templates
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- At most one active template per customer can be the default
CREATE UNIQUE INDEX idx_monitoring_templates_one_default_per_customer
ON monitoring.monitoring_templates (customer_id)
WHERE is_active = true AND is_default = true;

-- At most one active template per customer per priority
CREATE UNIQUE INDEX idx_monitoring_templates_one_active_per_priority
ON monitoring.monitoring_templates (customer_id, priority)
WHERE is_active = true;

-- rel_integration_group_monitoring_template: monitoring_template has many of these; each row is 1:1 integration_group -> cadence for that template
CREATE TABLE monitoring.rel_integration_group_monitoring_template (
    template_id UUID NOT NULL REFERENCES monitoring.monitoring_templates(id) ON DELETE CASCADE ON UPDATE CASCADE,
    integration_group SMALLINT NOT NULL,
    cadence monitoring.monitoring_cadence_enum NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    PRIMARY KEY (template_id, integration_group)
);

-- rel_monitoring_template_business: tracks business:template association (which business uses which template)
CREATE TABLE monitoring.rel_monitoring_template_business (
    business_id UUID NOT NULL REFERENCES public.data_businesses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    customer_id UUID NOT NULL,
    template_id UUID REFERENCES monitoring.monitoring_templates(id) ON DELETE CASCADE ON UPDATE CASCADE,
    association monitoring.monitoring_association_enum NOT NULL, 
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    PRIMARY KEY (business_id, customer_id),
    CONSTRAINT rel_mtb_template_fk FOREIGN KEY (template_id) REFERENCES monitoring.monitoring_templates(id)
);

-- rel_monitoring_rules: rules associated with a template
CREATE TABLE monitoring.rel_monitoring_rules (
    template_id UUID NOT NULL REFERENCES monitoring.monitoring_templates(id) ON DELETE CASCADE ON UPDATE CASCADE,
    rule_id UUID NOT NULL,
    PRIMARY KEY (template_id, rule_id),
    CONSTRAINT rel_mr_template_fk FOREIGN KEY (template_id) REFERENCES monitoring.monitoring_templates(id)
);

-- monitoring_run: one row per template run (when a template was executed)
CREATE TABLE monitoring.monitoring_run (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    customer_id UUID NOT NULL,
    template_id UUID NOT NULL REFERENCES monitoring.monitoring_templates(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL
);

-- rel_business_monitoring_run: per-business run detail for a given template run
CREATE TABLE monitoring.rel_business_monitoring_run (
    run_id UUID NOT NULL REFERENCES monitoring.monitoring_run(id) ON DELETE CASCADE ON UPDATE CASCADE,
    business_id UUID NOT NULL REFERENCES public.data_businesses(id) ON DELETE CASCADE ON UPDATE CASCADE,
    template_id UUID NOT NULL REFERENCES monitoring.monitoring_templates(id) ON DELETE CASCADE ON UPDATE CASCADE,
    start_at TIMESTAMP,
    complete_at TIMESTAMP,
    status monitoring.monitoring_run_status_enum NOT NULL DEFAULT 'PENDING',
    score_trigger_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (run_id, business_id)
);

-- risk_category: lookup for alert categories
CREATE TABLE monitoring.risk_category (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    customer_id UUID NOT NULL,
    label VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL
);

CREATE TRIGGER set_timestamp_risk_category
BEFORE UPDATE ON monitoring.risk_category
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_risk_category_customer_id ON monitoring.risk_category (customer_id);

-- risk_bucket: lookup for alert buckets
CREATE TABLE monitoring.risk_bucket (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    customer_id UUID NOT NULL,
    label VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL
);

CREATE TRIGGER set_timestamp_risk_bucket
BEFORE UPDATE ON monitoring.risk_bucket
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_risk_bucket_customer_id ON monitoring.risk_bucket (customer_id);

-- risk_alert: customer risk alerts
CREATE TABLE monitoring.risk_alert (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    customer_id UUID NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    category_id UUID REFERENCES monitoring.risk_category(id) ON DELETE SET NULL ON UPDATE CASCADE,
    bucket_id UUID REFERENCES monitoring.risk_bucket(id) ON DELETE SET NULL ON UPDATE CASCADE,
    routing JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL
);

CREATE TRIGGER set_timestamp_risk_alert
BEFORE UPDATE ON monitoring.risk_alert
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX idx_risk_alert_customer_id ON monitoring.risk_alert (customer_id);

-- rel_case_risk_alert: link cases to risk alerts (context = what triggered; run_id = monitoring run if applicable)
CREATE TABLE monitoring.rel_case_risk_alert (
    case_id UUID NOT NULL REFERENCES public.data_cases(id) ON DELETE CASCADE ON UPDATE CASCADE,
    risk_alert_id UUID NOT NULL REFERENCES monitoring.risk_alert(id) ON DELETE CASCADE ON UPDATE CASCADE,
    context JSONB NOT NULL DEFAULT '{}',
    run_id UUID NULL REFERENCES monitoring.monitoring_run(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    PRIMARY KEY (case_id, risk_alert_id)
);

-- rel_risk_alert_rule: rules associated with a risk alert
CREATE TABLE monitoring.rel_risk_alert_rule (
    risk_alert_id UUID NOT NULL REFERENCES monitoring.risk_alert(id) ON DELETE CASCADE ON UPDATE CASCADE,
    rule_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    created_by UUID NOT NULL,
    updated_at TIMESTAMP DEFAULT current_timestamp NOT NULL,
    updated_by UUID NOT NULL,
    PRIMARY KEY (risk_alert_id, rule_id)
);

CREATE TRIGGER set_timestamp_rel_risk_alert_rule
BEFORE UPDATE ON monitoring.rel_risk_alert_rule
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Persisted Business State (extended with Facts) per evaluation cycle
CREATE TABLE monitoring.business_states (
   id uuid PRIMARY KEY,
   created_at timestamp NOT NULL default NOW(),
   business_id uuid NOT NULL,
   customer_id uuid NOT NULL,
   state jsonb NOT NULL,
   state_diff jsonb NOT NULL DEFAULT '{}',
   business_score_trigger_id uuid -- nullable; state could change outside a refresh
);

CREATE INDEX idx_business_states_customer_id ON monitoring.business_states (customer_id);
CREATE INDEX idx_business_states_business_id ON monitoring.business_states (business_id);
