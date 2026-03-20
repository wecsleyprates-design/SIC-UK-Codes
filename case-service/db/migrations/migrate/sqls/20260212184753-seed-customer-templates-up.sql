-- Seed data for "dummy" customer 00000000-0000-0000-0000-000000000000.
-- Init copies these templates and risk alerts to new customers when they have none.
-- System user for created_by/updated_by:
-- 00000000-0000-0000-0000-000000000001

-- Fixed IDs for seed rows (so init can rely on seed customer data existing)
-- Seed categories (fraud, reputational, financial, operational, legal/reputational)
-- Seed buckets (high, medium, low)
-- Seed template and risk_alert (dummy customer)

-- 1. Seed risk categories for dummy customer: fraud, reputational, financial, operational, legal/reputational
INSERT INTO monitoring.risk_category (id, customer_id, label, is_active, created_by, updated_by)
VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000000', 'Fraud', true, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000000', 'Reputational', true, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000000', 'Financial', true, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0001-000000000004', '00000000-0000-0000-0000-000000000000', 'Operational', true, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0001-000000000005', '00000000-0000-0000-0000-000000000000', 'Legal/Reputational', true, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed risk buckets for dummy customer: high, medium, low
INSERT INTO monitoring.risk_bucket (id, customer_id, label, is_active, created_by, updated_by)
VALUES
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000000', 'High', true, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000000', 'Medium', true, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0000-000000000000', 'Low', true, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed monitoring template for dummy customer
INSERT INTO monitoring.monitoring_templates (
  id,
  customer_id,
  priority,
  is_active,
  is_default,
  label,
  created_by,
  updated_by
)
VALUES (
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0000-000000000000',
  0,
  true,
  true,
  'Medium Risk Template',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;


