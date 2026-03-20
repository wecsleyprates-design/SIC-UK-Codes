UPDATE 
    public.core_onboarding_stages SET id = 8, prev_stage = 7, priority_order = 8 WHERE stage = 'review';
INSERT INTO 
    public.core_onboarding_stages (id, stage, completion_weightage, allow_back_nav, is_skippable, is_enabled, next_stage, prev_stage, priority_order) 
VALUES
    (7, 'custom fields', 0, true, false, true, 8, 6, 7);