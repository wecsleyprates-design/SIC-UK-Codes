CREATE OR REPLACE PROCEDURE public.sp_insert_smb_zoominfo_standardized_joined()

    LANGUAGE plpgsql
AS
$$
BEGIN

    CREATE TABLE IF NOT EXISTS datascience.smb_zoominfo_standardized_joined
    (
        request_id                      VARCHAR(65535),
        requested_at                    TIMESTAMP WITH TIME ZONE ENCODE AZ64,
        request_type                    VARCHAR(65535),
        customer_name                   VARCHAR(65535),
        business_id                     VARCHAR(65535) DISTKEY,
        latest_requested_at             BIGINT ENCODE AZ64,
        external_id                     VARCHAR(65535),
        tax_id                          VARCHAR(65535),
        company_name                    VARCHAR(65535),
        company_dba                     VARCHAR(65535),
        client_year_established         VARCHAR(65535),
        company_address                 VARCHAR(65535),
        company_address_2               VARCHAR(65535),
        company_city                    VARCHAR(65535),
        company_state                   CHAR(2),
        company_postalcode              VARCHAR(65535),
        smb_eng_companyname             VARCHAR(65535),
        smb_eng_companyname_firstletter VARCHAR(4),
        smb_eng_dba                     VARCHAR(65535),
        smb_eng_dba_firstletter         VARCHAR(4),
        smb_eng_address                 VARCHAR(65535),
        smb_eng_street_num              VARCHAR(65535),
        smb_eng_state                   CHAR(2),
        smb_eng_city                    VARCHAR(65535),
        smb_eng_zipcode                 VARCHAR(20),
        smb_eng_zipcode_threedigits     VARCHAR(12),
        smb_eng_zip4                    VARCHAR(16),
        created_at                      TIMESTAMP ENCODE AZ64,
        processed_at                    TIMESTAMP WITH TIME ZONE ENCODE AZ64,
        smb_annual_income               VARCHAR(65535),
        zi_c_location_id                BIGINT ENCODE AZ64,
        zi_c_company_id                 BIGINT ENCODE AZ64,
        zi_es_location_id               VARCHAR(16383),
        zi_c_name                       VARCHAR(16383),
        zi_c_name_display               VARCHAR(16383),
        zi_c_names_other                VARCHAR(16383),
        zi_c_url                        VARCHAR(16383),
        zi_c_street                     VARCHAR(16383),
        zi_c_street_2                   VARCHAR(16383),
        zi_c_city                       VARCHAR(16383),
        zi_c_state                      VARCHAR(16383),
        zi_c_zip                        VARCHAR(16383),
        zi_c_country                    VARCHAR(16383),
        zi_c_county                     VARCHAR(16383),
        zi_c_latitude                   DOUBLE PRECISION,
        zi_c_longitude                  VARCHAR(16383),
        zi_c_year_founded               DOUBLE PRECISION,
        zi_c_phone                      VARCHAR(16383),
        zi_c_fax                        VARCHAR(16383),
        zi_c_ein                        DOUBLE PRECISION,
        zi_eng_companyname              VARCHAR(24576),
        zi_eng_dba                      VARCHAR(24576),
        zi_eng_dba2                     VARCHAR(24576),
        zi_eng_website                  VARCHAR(24574),
        zi_eng_address                  VARCHAR(65535),
        zi_eng_street_num               VARCHAR(16383),
        zi_eng_state                    VARCHAR(24574),
        zi_eng_city                     VARCHAR(24574),
        zi_eng_zipcode                  VARCHAR(20),
        zi_eng_zipcode_threedigits      VARCHAR(12),
        zi_eng_zip4                     VARCHAR(16),
        zi_eng_county                   VARCHAR(24574),
        zi_eng_country                  VARCHAR(24574),
        zi_eng_phone_number             VARCHAR(16383),
        zi_eng_phone_countrycode        VARCHAR(16383),
        zi_eng_fax_number               VARCHAR(16383),
        zi_eng_fax_countrycode          VARCHAR(16383),
        levdistance_address             INTEGER ENCODE AZ64,
        state_match                     INTEGER ENCODE AZ64,
        city_match                      INTEGER ENCODE AZ64,
        zipcode_match                   INTEGER ENCODE AZ64,
        levdistance_name                INTEGER ENCODE AZ64,
        similarity_index_rank           BIGINT,
        similarity_index                INTEGER ENCODE AZ64
    )
        DISTSTYLE KEY
        INTERLEAVED SORTKEY (smb_eng_companyname, similarity_index_rank);


    INSERT INTO
        datascience.smb_zoominfo_standardized_joined (request_id, requested_at, request_type, customer_name,
                                                      business_id, latest_requested_at, external_id, tax_id,
                                                      company_name, company_dba, client_year_established,
                                                      company_address, company_address_2, company_city, company_state,
                                                      company_postalcode, smb_eng_companyname,
                                                      smb_eng_companyname_firstletter, smb_eng_dba,
                                                      smb_eng_dba_firstletter, smb_eng_address, smb_eng_street_num,
                                                      smb_eng_state, smb_eng_city, smb_eng_zipcode,
                                                      smb_eng_zipcode_threedigits, smb_eng_zip4, created_at,
                                                      processed_at, smb_annual_income, zi_c_location_id,
                                                      zi_c_company_id, zi_es_location_id, zi_c_name, zi_c_name_display,
                                                      zi_c_names_other, zi_c_url, zi_c_street, zi_c_street_2, zi_c_city,
                                                      zi_c_state, zi_c_zip, zi_c_country, zi_c_county, zi_c_latitude,
                                                      zi_c_longitude, zi_c_year_founded, zi_c_phone, zi_c_fax, zi_c_ein,
                                                      zi_eng_companyname, zi_eng_dba, zi_eng_dba2, zi_eng_website,
                                                      zi_eng_address, zi_eng_street_num, zi_eng_state, zi_eng_city,
                                                      zi_eng_zipcode, zi_eng_zipcode_threedigits, zi_eng_zip4,
                                                      zi_eng_county, zi_eng_country, zi_eng_phone_number,
                                                      zi_eng_phone_countrycode, zi_eng_fax_number,
                                                      zi_eng_fax_countrycode, levdistance_address, state_match,
                                                      city_match, zipcode_match, levdistance_name,
                                                      similarity_index_rank, similarity_index)
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
                        AND business_id NOT IN
                            (SELECT DISTINCT business_id FROM datascience.smb_zoominfo_standardized_joined)

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
END;
$$
