--- Set is_skippable to false for additional details stage
UPDATE public.core_onboarding_stages SET is_skippable = false WHERE id = 2 AND stage = 'company additional info';