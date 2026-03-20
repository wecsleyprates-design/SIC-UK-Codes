DELETE FROM 
    public.core_onboarding_stages 
WHERE 
    id = 7 AND stage = 'custom fields';

    
UPDATE 
    public.core_onboarding_stages SET id = 7, prev_stage = 6, priority_order = 7 WHERE stage = 'review';