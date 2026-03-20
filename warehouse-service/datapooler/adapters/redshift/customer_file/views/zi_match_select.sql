CREATE OR REPLACE PROCEDURE public.sp_truncate_and_insert_zoominfo_matches_custom_inc_ml()
    LANGUAGE plpgsql
AS
$$
BEGIN
    DROP TABLE IF EXISTS datascience.zoominfo_matches_custom_inc_ml;
    CREATE TABLE datascience.zoominfo_matches_custom_inc_ml DISTKEY ( business_id )
                                                            INTERLEAVED SORTKEY (business_id, zi_c_company_id, zi_c_location_id, zi_es_location_id) AS
    WITH
        initial_select AS (SELECT
                               business_id,
                               CAST(zi_c_company_id AS BIGINT)  AS zi_c_company_id,
                               CAST(zi_c_location_id AS BIGINT) AS zi_c_location_id,
                               zi_es_location_id,
                               zi_probability
                           FROM datascience.ml_model_matches
                           WHERE zi_probability >= 0.8
                             AND (zi_c_company_id IS NOT NULL OR zi_c_location_id IS NOT NULL OR
                                  zi_es_location_id IS NOT NULL)
        ),
        union_matches AS (SELECT
                              business_id,
                              zi_c_company_id,
                              zi_c_location_id,
                              zi_es_location_id,
                              zi_probability,
                              NULL AS similarity_index
                          FROM initial_select
                          UNION ALL
                          SELECT
                              business_id,
                              zi_c_company_id,
                              zi_c_location_id,
                              zi_es_location_id,
                              NULL AS zi_probability,
                              similarity_index

                          FROM datascience.smb_zoominfo_standardized_joined
                          WHERE similarity_index_rank = 1
                            AND similarity_index >= 45
                            AND business_id NOT IN (SELECT business_id FROM initial_select)
        )
    SELECT
        *
    FROM union_matches;
END;
$$;
