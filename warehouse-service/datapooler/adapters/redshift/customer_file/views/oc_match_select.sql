CREATE OR REPLACE PROCEDURE public.sp_truncate_and_insert_oc_matches_custom_inc_ml()
    LANGUAGE plpgsql
AS
$$
BEGIN

    DROP TABLE IF EXISTS datascience.oc_matches_custom_inc_ml;

    CREATE TABLE datascience.oc_matches_custom_inc_ml AS
    WITH
        initial_select AS (SELECT
                               business_id,
                               company_number    AS company_number,
                               jurisdiction_code AS jurisdiction_code,
                               oc_probability
                           FROM datascience.ml_model_matches
                           WHERE ml_model_matches.oc_probability >= 0.8
                             AND company_number IS NOT NULL
        ),
        union_matches AS (SELECT
                              business_id,
                              company_number,
                              jurisdiction_code,
                              oc_probability,
                              NULL AS similarity_index
                          FROM initial_select
                          UNION ALL
                          SELECT
                              business_id,
                              company_number,
                              jurisdiction_code,
                              NULL AS oc_probability,
                              similarity_index
                          FROM datascience.smb_open_corporate_standardized_joined
                          WHERE similarity_index_rank = 1
                            AND similarity_index >= 45
                            AND business_id NOT IN (SELECT business_id FROM initial_select)
        )
    SELECT
        *
    FROM union_matches;
END
$$
