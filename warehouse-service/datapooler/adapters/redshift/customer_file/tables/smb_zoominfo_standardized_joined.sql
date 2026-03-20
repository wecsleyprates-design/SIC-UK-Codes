CREATE OR REPLACE PROCEDURE public.sp_truncate_and_insert_smb_zoominfo_standardized_joined()

    LANGUAGE plpgsql
AS
$$
BEGIN
    DROP TABLE IF EXISTS datascience.smb_zoominfo_standardized_joined;


    CREATE TABLE datascience.smb_zoominfo_standardized_joined DISTKEY ( business_id )
                                                              INTERLEAVED SORTKEY (smb_eng_companyname, similarity_index_rank) AS
    WITH
        join_data AS (SELECT
                          *,
                          CASE
                              WHEN zi_eng_address NOT IN ('', ' ')
                                  AND smb_eng_address NOT IN ('', ' ')
                                  THEN levenshtein_distance(TRIM(zi_eng_address), TRIM(smb_eng_address))
                              ELSE 9999
                          END AS levdistance_address,
                          CASE
                              WHEN zi_eng_state = smb_eng_state
                                  THEN 5
                              ELSE 0
                          END AS state_match,
                          CASE
                              WHEN zi_eng_city = smb_eng_city
                                  THEN 5
                              ELSE 0
                          END AS city_match,
                          CASE
                              WHEN zi_eng_zipcode = smb_eng_zipcode
                                  THEN 5
                              ELSE 0
                          END AS zipcode_match
                      FROM datascience.smb_standard c1
                          JOIN datascience.zoominfo_standard c2
                                  ON smb_eng_state = zi_eng_state
                              AND smb_eng_zipcode_threedigits = zi_eng_zipcode_threedigits
                              AND (
                                         (SUBSTRING(smb_eng_companyname, 1, 3) = SUBSTRING(zi_eng_companyname, 1, 3) AND
                                          smb_eng_companyname != '' AND zi_eng_companyname != '')
                                             OR (SUBSTRING(smb_eng_dba, 1, 3) = SUBSTRING(zi_eng_dba, 1, 3) AND
                                                 smb_eng_dba != '' AND zi_eng_dba != '')
                                             OR (SUBSTRING(smb_eng_companyname, 1, 3) = SUBSTRING(zi_eng_dba, 1, 3) AND
                                                 smb_eng_companyname != '' AND zi_eng_dba != '')
                                             OR (SUBSTRING(smb_eng_dba, 1, 3) = SUBSTRING(zi_eng_companyname, 1, 3) AND
                                                 smb_eng_dba != '' AND zi_eng_companyname != '')
                                         )
                      WHERE LENGTH(zi_eng_address) <= 100

        ),
        similarity_data AS (SELECT
                                *,
                                LEAST(CASE
                                          WHEN zi_eng_companyname NOT IN ('', ' ')
                                              AND smb_eng_companyname NOT IN ('', ' ')
                                              THEN levenshtein_distance(TRIM(zi_eng_companyname),
                                                                        TRIM(smb_eng_companyname))
                                          ELSE 9999
                                      END,
                                      CASE
                                          WHEN zi_eng_companyname NOT IN ('', ' ')
                                              AND smb_eng_dba NOT IN ('', ' ')
                                              THEN levenshtein_distance(TRIM(zi_eng_companyname), TRIM(smb_eng_dba))
                                          ELSE 9999
                                      END,
                                      CASE
                                          WHEN zi_eng_dba NOT IN ('', ' ')
                                              AND smb_eng_companyname NOT IN ('', ' ')
                                              THEN levenshtein_distance(TRIM(zi_eng_dba), TRIM(smb_eng_companyname))
                                          ELSE 9999
                                      END,
                                      CASE
                                          WHEN zi_eng_dba NOT IN ('', ' ')
                                              AND smb_eng_dba NOT IN ('', ' ')
                                              THEN levenshtein_distance(TRIM(zi_eng_dba), TRIM(smb_eng_dba))
                                          ELSE 9999
                                      END
                                )                                                                        AS levdistance_name,

                                ROW_NUMBER() OVER (PARTITION BY external_id ORDER BY (20 - LEAST(CASE
                                                                                                     WHEN
                                                                                                         zi_eng_companyname NOT IN
                                                                                                         ('', ' ')
                                                                                                             AND
                                                                                                         smb_eng_companyname NOT IN
                                                                                                         ('', ' ')
                                                                                                         THEN levenshtein_distance(
                                                                                                             TRIM(zi_eng_companyname),
                                                                                                             TRIM(smb_eng_companyname))
                                                                                                     ELSE 9999
                                                                                                 END,
                                                                                                 CASE
                                                                                                     WHEN
                                                                                                         zi_eng_companyname NOT IN
                                                                                                         ('', ' ')
                                                                                                             AND
                                                                                                         smb_eng_dba NOT IN
                                                                                                         ('', ' ')
                                                                                                         THEN levenshtein_distance(TRIM(zi_eng_companyname), TRIM(smb_eng_dba))
                                                                                                     ELSE 9999
                                                                                                 END,
                                                                                                 CASE
                                                                                                     WHEN
                                                                                                         zi_eng_dba NOT IN
                                                                                                         ('', ' ')
                                                                                                             AND
                                                                                                         smb_eng_companyname NOT IN
                                                                                                         ('', ' ')
                                                                                                         THEN levenshtein_distance(TRIM(zi_eng_dba), TRIM(smb_eng_companyname))
                                                                                                     ELSE 9999
                                                                                                 END,
                                                                                                 CASE
                                                                                                     WHEN
                                                                                                         zi_eng_dba NOT IN
                                                                                                         ('', ' ')
                                                                                                             AND
                                                                                                         smb_eng_dba NOT IN
                                                                                                         ('', ' ')
                                                                                                         THEN levenshtein_distance(TRIM(zi_eng_dba), TRIM(smb_eng_dba))
                                                                                                     ELSE 9999
                                                                                                 END
                                                                                           )) + (20 - CASE
                                                                                                          WHEN
                                                                                                              zi_eng_address NOT IN
                                                                                                              ('', ' ')
                                                                                                                  AND
                                                                                                              smb_eng_address NOT IN
                                                                                                              ('', ' ')
                                                                                                              THEN levenshtein_distance(TRIM(zi_eng_address), TRIM(smb_eng_address))
                                                                                                          ELSE 9999
                                                                                                      END) +
                                                                                     state_match +
                                                                                     city_match +
                                                                                     zipcode_match DESC) AS similarity_index_rank,

                                (20 - LEAST(CASE
                                                WHEN zi_eng_companyname NOT IN ('', ' ')
                                                    AND smb_eng_companyname NOT IN ('', ' ')
                                                    THEN levenshtein_distance(TRIM(zi_eng_companyname),
                                                                              TRIM(smb_eng_companyname))
                                                ELSE 9999
                                            END,
                                            CASE
                                                WHEN zi_eng_companyname NOT IN ('', ' ')
                                                    AND smb_eng_dba NOT IN ('', ' ')
                                                    THEN levenshtein_distance(TRIM(zi_eng_companyname), TRIM(smb_eng_dba))
                                                ELSE 9999
                                            END,
                                            CASE
                                                WHEN zi_eng_dba NOT IN ('', ' ')
                                                    AND smb_eng_companyname NOT IN ('', ' ')
                                                    THEN levenshtein_distance(TRIM(zi_eng_dba), TRIM(smb_eng_companyname))
                                                ELSE 9999
                                            END,
                                            CASE
                                                WHEN zi_eng_dba NOT IN ('', ' ')
                                                    AND smb_eng_dba NOT IN ('', ' ')
                                                    THEN levenshtein_distance(TRIM(zi_eng_dba), TRIM(smb_eng_dba))
                                                ELSE 9999
                                            END
                                      )) + (20 - CASE
                                                     WHEN zi_eng_address NOT IN ('', ' ')
                                                         AND smb_eng_address NOT IN ('', ' ')
                                                         THEN levenshtein_distance(TRIM(zi_eng_address), TRIM(smb_eng_address))
                                                     ELSE 9999
                                                 END) + state_match + city_match +
                                zipcode_match                                                            AS similarity_index
                            FROM join_data

        )

    SELECT
        request_id,
        requested_at,
        request_type,
        customer_name,
        business_id,
        latest_requested_at,
        external_id,
        tax_id,
        company_name,
        company_dba,
        client_year_established,
        company_address,
        company_address_2,
        company_city,
        company_state,
        company_postalcode,
        remove_prefix_suffix(smb_eng_companyname) AS smb_eng_companyname,
        smb_eng_companyname_firstletter,
        remove_prefix_suffix(smb_eng_dba)         AS smb_eng_dba,
        smb_eng_dba_firstletter,
        smb_eng_address,
        smb_eng_street_num,
        smb_eng_state,
        smb_eng_city,
        smb_eng_zipcode,
        smb_eng_zipcode_threedigits,
        smb_eng_zip4,
        created_at,
        processed_at,
        smb_annual_income,
        zi_c_location_id,
        zi_c_company_id,
        zi_es_location_id,
        zi_c_name,
        zi_c_name_display,
        zi_c_names_other,
        zi_c_url,
        zi_c_street,
        zi_c_street_2,
        zi_c_city,
        zi_c_state,
        zi_c_zip,
        zi_c_country,
        zi_c_county,
        zi_c_latitude,
        zi_c_longitude,
        zi_c_year_founded,
        zi_c_phone,
        zi_c_fax,
        zi_c_ein,
        zi_eng_companyname,
        zi_eng_dba,
        zi_eng_dba2,
        zi_eng_website,
        zi_eng_address,
        zi_eng_street_num,
        zi_eng_state,
        zi_eng_city,
        zi_eng_zipcode,
        zi_eng_zipcode_threedigits,
        zi_eng_zip4,
        zi_eng_county,
        zi_eng_country,
        zi_eng_phone_number,
        zi_eng_phone_countrycode,
        zi_eng_fax_number,
        zi_eng_fax_countrycode,
        levdistance_address,
        state_match,
        city_match,
        zipcode_match,
        levdistance_name,
        similarity_index_rank,
        similarity_index
    FROM similarity_data
    WHERE similarity_index_rank <= 1000;


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
                           FROM datascience.ml_worldpay_matches
                           WHERE zi_probability >= 0.8
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
$$
