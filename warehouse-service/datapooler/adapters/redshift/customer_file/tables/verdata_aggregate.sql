CREATE OR REPLACE PROCEDURE sp_truncate_insert_verdata_aggregate()
    LANGUAGE plpgsql
AS
$$
BEGIN
    -- Step 9: https://worth-ai.atlassian.net/browse/INFRA-45

    DROP TABLE IF EXISTS datascience.verdata_aggregate;
    DROP TABLE IF EXISTS datascience.verdata_extract;

    CREATE TABLE datascience.verdata_aggregate AS
    SELECT * FROM rds_integration_public.verdata_aggregate_mv_v2;

END;
$$;
