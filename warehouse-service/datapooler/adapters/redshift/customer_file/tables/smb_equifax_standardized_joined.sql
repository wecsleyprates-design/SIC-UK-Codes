CREATE OR REPLACE PROCEDURE public.sp_truncate_and_insert_smb_equifax_standardized_joined()

    LANGUAGE plpgsql
AS

$$
BEGIN

    -- step 6: https://worth-ai.atlassian.net/browse/INFRA-58


    DROP TABLE IF EXISTS datascience.smb_equifax_standardized_joined;

    CREATE TABLE datascience.smb_equifax_standardized_joined DISTKEY ( business_id )
                                                             INTERLEAVED SORTKEY (smb_eng_companyname, similarity_index_rank) AS
    WITH
        similarity_data AS (SELECT DISTINCT
                                business_id,
                                smb_eng_companyname,
                                smb_eng_dba,
                                smb_eng_address,
                                smb_eng_state,
                                smb_eng_city,
                                smb_eng_zipcode,
                                efx_id,
                                efx_eng_companyname,
                                efx_eng_legalname,
                                efx_eng_address,
                                efx_eng_state,
                                efx_eng_city,
                                efx_eng_zipcode,
                                LEAST(CASE
                                          WHEN efx_eng_companyname NOT IN ('', ' ')
                                              AND smb_eng_companyname NOT IN ('', ' ')
                                              THEN levenshtein_distance(TRIM(efx_eng_companyname),
                                                                        TRIM(smb_eng_companyname))
                                          ELSE 9999
                                      END,
                                      CASE
                                          WHEN efx_eng_companyname NOT IN ('', ' ')
                                              AND smb_eng_dba NOT IN ('', ' ')
                                              THEN levenshtein_distance(TRIM(efx_eng_companyname), TRIM(smb_eng_dba))
                                          ELSE 9999
                                      END,
                                      CASE
                                          WHEN efx_eng_legalname NOT IN ('', ' ')
                                              AND smb_eng_companyname NOT IN ('', ' ')
                                              THEN levenshtein_distance(TRIM(efx_eng_legalname),
                                                                        TRIM(smb_eng_companyname))
                                          ELSE 9999
                                      END,
                                      CASE
                                          WHEN efx_eng_legalname NOT IN ('', ' ')
                                              AND smb_eng_dba NOT IN ('', ' ')
                                              THEN levenshtein_distance(TRIM(efx_eng_legalname), TRIM(smb_eng_dba))
                                          ELSE 9999
                                      END
                                )   AS levdistance_name,
                                CASE
                                    WHEN efx_eng_address NOT IN ('', ' ')
                                        AND smb_eng_address NOT IN ('', ' ')
                                        THEN levenshtein_distance(TRIM(efx_eng_address), TRIM(smb_eng_address))
                                    ELSE 9999
                                END AS levdistance_address,
                                CASE
                                    WHEN efx_eng_state = smb_eng_state
                                        THEN 5
                                    ELSE 0
                                END AS state_match,
                                CASE
                                    WHEN efx_eng_city = smb_eng_city
                                        THEN 5
                                    ELSE 0
                                END AS city_match,
                                CASE
                                    WHEN efx_eng_zipcode = smb_eng_zipcode
                                        THEN 5
                                    ELSE 0
                                END AS zipcode_match
                            FROM datascience.smb_standard
                                INNER JOIN warehouse.equifax_us_standardized c2
                                        ON smb_standard.smb_eng_state = c2.efx_eng_state
                                    AND smb_standard.smb_eng_zipcode_threedigits = c2.efx_eng_zipcode_threedigits
                                    AND ((SUBSTRING(smb_eng_companyname, 1, 3) =
                                          SUBSTRING(efx_eng_companyname, 1, 3) AND smb_eng_companyname != '' AND
                                          efx_eng_companyname != '')
                                        OR (SUBSTRING(smb_eng_dba, 1, 3) = SUBSTRING(efx_eng_legalname, 1, 3) AND
                                            smb_eng_dba != '' AND efx_eng_legalname != '')
                                        OR
                                         (SUBSTRING(smb_eng_companyname, 1, 3) = SUBSTRING(efx_eng_legalname, 1, 3) AND
                                          smb_eng_companyname != '' AND efx_eng_legalname != '')
                                        OR
                                         (SUBSTRING(smb_eng_dba, 1, 3) = SUBSTRING(efx_eng_companyname, 1, 3) AND
                                          smb_eng_dba != '' AND efx_eng_companyname != '')
                                               )
        ),

        ranked_similarity AS (SELECT
                                  *,
                                  (20 - levdistance_name) + (20 - levdistance_address) + state_match + city_match +
                                  zipcode_match                                                            AS similarity_index,
                                  ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY (20 - levdistance_name) +
                                                                                       (20 - levdistance_address) +
                                                                                       state_match + city_match +
                                                                                       zipcode_match DESC) AS similarity_index_rank
                              FROM similarity_data
        )

    SELECT
        *
    FROM ranked_similarity
    WHERE similarity_index_rank <= 1000;

END;
$$
