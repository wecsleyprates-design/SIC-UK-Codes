--- Revert company additional info stage to skippable
UPDATE public.core_onboarding_stages SET is_skippable = true WHERE id = 2 AND stage = 'company additional info';