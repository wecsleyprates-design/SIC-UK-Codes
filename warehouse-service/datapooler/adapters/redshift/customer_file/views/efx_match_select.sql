CREATE OR REPLACE PROCEDURE public.sp_truncate_and_insert_efx_matches_custom_inc_ml()
    LANGUAGE plpgsql
AS
$$
BEGIN


    DROP TABLE IF EXISTS datascience.efx_matches_custom_inc_ml;

    CREATE TABLE datascience.efx_matches_custom_inc_ml AS
    WITH
        initial_select AS (SELECT
                               business_id,
                               CAST(efx_id AS BIGINT) AS efx_id,
                               efx_probability
                           FROM datascience.ml_model_matches
                           WHERE efx_probability >= 0.8
                             AND efx_id IS NOT NULL
        ),
        union_matches AS (SELECT
                              business_id,
                              efx_id,
                              efx_probability,
                              NULL AS similarity_index
                          FROM initial_select
                          UNION ALL
                          SELECT
                              business_id,
                              efx_id,
                              NULL AS efx_probability,
                              similarity_index
                          FROM datascience.smb_equifax_standardized_joined
                          WHERE similarity_index_rank = 1
                            AND similarity_index >= 45
                            AND business_id NOT IN (SELECT business_id FROM initial_select)
        )
    SELECT
        *
    FROM union_matches;
END;
$$;
