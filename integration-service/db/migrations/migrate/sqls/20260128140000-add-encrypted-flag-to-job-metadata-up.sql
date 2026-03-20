-- Migration: Add _encrypted flag to job metadata
-- This migration updates all existing job records to include the _encrypted flag in metadata
-- All existing data is assumed to be NOT encrypted, so we set _encrypted to false

DO $$
DECLARE
    updated_count INTEGER := 0;
    total_count INTEGER;
BEGIN
    -- Get total count
    SELECT COUNT(*) INTO total_count FROM jobs.job;
    
    RAISE NOTICE 'Starting migration: Adding _encrypted flag to % job records', total_count;
    
    -- Update all jobs to have _encrypted = false (existing data is not encrypted)
    UPDATE jobs.job
    SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{_encrypted}',
        'false'::jsonb
    )
    WHERE NOT (COALESCE(metadata, '{}'::jsonb) ? '_encrypted');
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Set _encrypted flag to false for % existing job records', updated_count;
    
    RAISE NOTICE 'Migration complete: Added _encrypted flag to all job records';
END $$;
