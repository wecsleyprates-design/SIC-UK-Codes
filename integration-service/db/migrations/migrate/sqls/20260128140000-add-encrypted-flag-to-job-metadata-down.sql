-- Rollback: Remove _encrypted flag from job metadata

DO $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Rolling back: Removing _encrypted flag from job metadata';
    
    -- Remove _encrypted key from all job metadata
    UPDATE jobs.job
    SET metadata = metadata - '_encrypted'
    WHERE metadata IS NOT NULL
    AND metadata ? '_encrypted';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Removed _encrypted flag from % job records', updated_count;
    
    RAISE NOTICE 'Rollback complete';
END $$;
