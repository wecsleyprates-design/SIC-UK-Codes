/* Replace with your SQL commands */

-- ============================================
-- PART 1: Add to core_onboarding_stages
-- ============================================

-- Insert new stage with NULL navigation references (stage is disabled initially)
-- ID 14 is the next available ID
-- priority_order 13 ensures it comes after Review (11) in normal onboarding
INSERT INTO onboarding_schema.core_onboarding_stages (
    id, stage, completion_weightage, allow_back_nav, is_skippable, 
    is_enabled, next_stage, prev_stage, priority_order, code, is_removable, is_orderable
) VALUES
(14, 'RFI', 0, false, false, false, NULL, NULL, 13, 'rfi', true, false);

-- ============================================
-- PART 2: Link to onboarding types
-- ============================================

-- RFI stage is only for normal onboarding (id=1)
INSERT INTO onboarding_schema.rel_onboarding_stage_type (onboarding_type_id, stage_id)
VALUES
(1, 14);

-- ============================================
-- PART 3: Add to existing customers
-- ============================================

-- Insert for all existing customers with NULL navigation references
INSERT INTO onboarding_schema.data_customer_onboarding_stages (
    id, customer_id, version, stage, stage_code, completion_weightage,
    allow_back_nav, is_skippable, is_enabled, is_removable, is_orderable,
    next_stage, prev_stage, priority_order, created_by, updated_by
)
SELECT
    gen_random_uuid(),
    dist.customer_id,
    1,
    s.stage,
    s.code,
    s.completion_weightage,
    s.allow_back_nav,
    s.is_skippable,
    s.is_enabled,
    s.is_removable,
    s.is_orderable,
    NULL,  -- next_stage (NULL - stage is disabled)
    NULL,  -- prev_stage (NULL - stage is disabled)
    s.priority_order,
    'e9d43901-3fc6-4ee9-97be-74cd23b39aa0'::uuid, -- Admin user
    'e9d43901-3fc6-4ee9-97be-74cd23b39aa0'::uuid
FROM (SELECT DISTINCT customer_id FROM onboarding_schema.data_customer_onboarding_stages) dist
CROSS JOIN onboarding_schema.core_onboarding_stages s
WHERE s.code = 'rfi';
