-- Remove new unique constraint
ALTER TABLE public.data_applicants_threshold_reminder_tracker
DROP CONSTRAINT IF EXISTS uq_applicant_core_threshold;

-- Restore old unique constraint (without threshold_days)
ALTER TABLE public.data_applicants_threshold_reminder_tracker
ADD CONSTRAINT uq_applicant_core_threshold
UNIQUE (case_id, applicant_id, urgency);