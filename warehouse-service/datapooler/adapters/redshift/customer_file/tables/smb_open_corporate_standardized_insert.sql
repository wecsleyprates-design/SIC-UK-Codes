CREATE OR REPLACE PROCEDURE public.sp_insert_smb_open_corporate_standardized_joined()
    LANGUAGE plpgsql
AS

$$
BEGIN
    -- Step 8: https://worth-ai.atlassian.net/browse/INFRA-63
    CREATE TABLE IF NOT EXISTS datascience.smb_open_corporate_standardized_joined
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
        smb_eng_companyname_firstletter VARCHAR(4) ENCODE BYTEDICT,
        smb_eng_dba                     VARCHAR(65535),
        smb_eng_dba_firstletter         VARCHAR(4) ENCODE BYTEDICT,
        smb_eng_address                 VARCHAR(65535),
        smb_eng_street_num              VARCHAR(65535),
        smb_eng_state                   CHAR(2),
        smb_eng_city                    VARCHAR(65535),
        smb_eng_zipcode                 VARCHAR(20),
        smb_eng_zipcode_threedigits     VARCHAR(12),
        smb_eng_zip4                    VARCHAR(16),
        company_number                  VARCHAR(16383),
        jurisdiction_code               VARCHAR(16383) ENCODE BYTEDICT,
        oc_normalised_name              VARCHAR(16383),
        oc_previous_names               VARCHAR(16383),
        oc_incorporation_date           VARCHAR(16383),
        oc_street_address               VARCHAR(16383),
        oc_street_address_normalized    VARCHAR(65535),
        oc_locality                     VARCHAR(16383),
        oc_region                       VARCHAR(16383),
        oc_postal_code                  VARCHAR(16383),
        oc_country                      VARCHAR(16383),
        oc_company_name_normalized      VARCHAR(24576),
        oc_dba_normalized               VARCHAR(24576),
        oc_alternative_dba_normalized   VARCHAR(24576),
        oc_website_normalized           VARCHAR(1),
        oc_zipcode                      VARCHAR(20),
        oc_zipcode_threedigits          VARCHAR(12),
        oc_zipcode_plus4                VARCHAR(16),
        state_match                     INTEGER ENCODE AZ64,
        city_match                      INTEGER ENCODE AZ64,
        zipcode_match                   INTEGER ENCODE AZ64,
        levdistance_name                INTEGER ENCODE AZ64,
        levdistance_address             INTEGER ENCODE AZ64,
        similarity_index_rank           BIGINT ENCODE AZ64,
        similarity_index                INTEGER ENCODE AZ64
    )
        DISTSTYLE KEY;

    INSERT INTO
        datascience.smb_open_corporate_standardized_joined (request_id, requested_at, request_type, customer_name,
                                                            business_id, latest_requested_at, external_id, tax_id,
                                                            company_name, company_dba, client_year_established,
                                                            company_address, company_address_2, company_city,
                                                            company_state, company_postalcode, smb_eng_companyname,
                                                            smb_eng_companyname_firstletter, smb_eng_dba,
                                                            smb_eng_dba_firstletter, smb_eng_address,
                                                            smb_eng_street_num, smb_eng_state, smb_eng_city,
                                                            smb_eng_zipcode, smb_eng_zipcode_threedigits, smb_eng_zip4,
                                                            company_number, jurisdiction_code, oc_normalised_name,
                                                            oc_previous_names, oc_incorporation_date, oc_street_address,
                                                            oc_street_address_normalized, oc_locality, oc_region,
                                                            oc_postal_code, oc_country, oc_company_name_normalized,
                                                            oc_dba_normalized, oc_alternative_dba_normalized,
                                                            oc_website_normalized, oc_zipcode, oc_zipcode_threedigits,
                                                            oc_zipcode_plus4, state_match, city_match, zipcode_match,
                                                            levdistance_name, levdistance_address,
                                                            similarity_index_rank, similarity_index)
    WITH
        joined_data AS (SELECT
                            request_id,
                            requested_at,
                            request_type,
                            customer_name,
                            business_id,
                            latest_requested_at,
                            external_id,
                            tax_id,
                            c1.company_name,
                            company_dba,
                            client_year_established,
                            company_address,
                            company_address_2,
                            company_city,
                            company_state,
                            company_postalcode,
                            smb_eng_companyname,
                            smb_eng_companyname_firstletter,
                            smb_eng_dba,
                            smb_eng_dba_firstletter,
                            smb_eng_address,
                            smb_eng_street_num,
                            smb_eng_state,
                            smb_eng_city,
                            smb_eng_zipcode,
                            smb_eng_zipcode_threedigits,
                            smb_eng_zip4,
                            company_number,
                            jurisdiction_code,
                            oc.normalised_name            AS oc_normalised_name,
                            oc.previous_names             AS oc_previous_names,
                            oc.incorporation_date         AS oc_incorporation_date,
                            oc.street_address             AS oc_street_address,
                            oc.street_address_normalized  AS oc_street_address_normalized,
                            oc.locality                   AS oc_locality,
                            oc.region                     AS oc_region,
                            oc.postal_code                AS oc_postal_code,
                            oc.country                    AS oc_country,
                            oc.companyname_normalized     AS oc_company_name_normalized,
                            oc.dba_normalized             AS oc_dba_normalized,
                            oc.alternative_dba_normalized AS oc_alternative_dba_normalized,
                            oc.website_normalized         AS oc_website_normalized,
                            oc.zipcode                    AS oc_zipcode,
                            oc.zipcode_threedigits        AS oc_zipcode_threedigits,
                            oc.zipcode_plus4              AS oc_zipcode_plus4,
                            CASE
                                WHEN oc.state_abbreviation = smb_eng_state
                                    THEN 5
                                ELSE 0
                            END                           AS state_match,

                            CASE
                                WHEN oc.city = smb_eng_city
                                    THEN 5
                                ELSE 0
                            END                           AS city_match,

                            CASE
                                WHEN oc.zipcode = smb_eng_zipcode
                                    THEN 5
                                ELSE 0
                            END                           AS zipcode_match
                        FROM datascience.smb_standard c1
                            JOIN datascience.open_corporates_standard oc
                                    ON smb_eng_zipcode_threedigits = oc.zipcode_threedigits
                                AND (
                                           (SUBSTRING(smb_eng_companyname, 1, 3) =
                                            SUBSTRING(oc.normalised_name, 1, 3) AND smb_eng_companyname != '' AND
                                            oc.normalised_name != '')
                                               OR (SUBSTRING(smb_eng_dba, 1, 3) = SUBSTRING(oc.dba_normalized, 1, 3) AND
                                                   smb_eng_dba != '' AND oc.dba_normalized != '')
                                               OR
                                           (SUBSTRING(smb_eng_companyname, 1, 3) =
                                            SUBSTRING(oc.dba_normalized, 1, 3) AND smb_eng_companyname != '' AND
                                            oc.dba_normalized != '')
                                               OR
                                           (SUBSTRING(smb_eng_dba, 1, 3) = SUBSTRING(oc.normalised_name, 1, 3) AND
                                            smb_eng_dba != '' AND oc.normalised_name != '')
                                           )

                        WHERE LENGTH(oc.street_address_normalized) <= 100
                          AND business_id NOT IN
                              (SELECT DISTINCT business_id FROM datascience.smb_open_corporate_standardized_joined)

        ),

        similarity_data AS (SELECT
                                request_id,
                                requested_at,
                                request_type,
                                customer_name,
                                business_id,
                                latest_requested_at,
                                external_id,
                                tax_id,
                                joined_data.company_name,
                                company_dba,
                                client_year_established,
                                company_address,
                                company_address_2,
                                company_city,
                                company_state,
                                company_postalcode,
                                smb_eng_companyname,
                                smb_eng_companyname_firstletter,
                                smb_eng_dba,
                                smb_eng_dba_firstletter,
                                smb_eng_address,
                                smb_eng_street_num,
                                smb_eng_state,
                                smb_eng_city,
                                smb_eng_zipcode,
                                smb_eng_zipcode_threedigits,
                                smb_eng_zip4,
                                company_number,
                                jurisdiction_code,
                                oc_normalised_name,
                                oc_previous_names,
                                oc_incorporation_date,
                                oc_street_address,
                                oc_street_address_normalized,
                                oc_locality,
                                oc_region,
                                oc_postal_code,
                                oc_country,
                                oc_company_name_normalized,
                                oc_dba_normalized,
                                oc_alternative_dba_normalized,
                                oc_website_normalized,
                                oc_zipcode,
                                oc_zipcode_threedigits,
                                oc_zipcode_plus4,
                                state_match,
                                city_match,
                                zipcode_match,
                                LEAST(
                                        CASE
                                            WHEN oc_normalised_name NOT IN ('', ' ')
                                                AND smb_eng_companyname NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_normalised_name),
                                                                          TRIM(smb_eng_companyname))
                                            ELSE 9999
                                        END,
                                        CASE
                                            WHEN oc_normalised_name NOT IN ('', ' ')
                                                AND smb_eng_dba NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_normalised_name), TRIM(smb_eng_dba))
                                            ELSE 9999
                                        END,
                                        CASE
                                            WHEN oc_dba_normalized NOT IN ('', ' ')
                                                AND smb_eng_companyname NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_dba_normalized),
                                                                          TRIM(smb_eng_companyname))
                                            ELSE 9999
                                        END,
                                        CASE
                                            WHEN oc_dba_normalized NOT IN ('', ' ')
                                                AND smb_eng_dba NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_dba_normalized), TRIM(smb_eng_dba))
                                            ELSE 9999
                                        END
                                )                                                                        AS levdistance_name,

                                CASE
                                    WHEN oc_street_address_normalized NOT IN ('', ' ')
                                        AND smb_eng_address NOT IN ('', ' ')
                                        THEN levenshtein_distance(TRIM(oc_street_address_normalized),
                                                                  TRIM(smb_eng_address))
                                    ELSE 9999
                                END                                                                      AS levdistance_address,

                                ROW_NUMBER() OVER (PARTITION BY external_id ORDER BY (20 - LEAST(
                                        CASE
                                            WHEN oc_normalised_name NOT IN ('', ' ')
                                                AND smb_eng_companyname NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_normalised_name),
                                                                          TRIM(smb_eng_companyname))
                                            ELSE 9999
                                        END,
                                        CASE
                                            WHEN oc_normalised_name NOT IN ('', ' ')
                                                AND smb_eng_dba NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_normalised_name), TRIM(smb_eng_dba))
                                            ELSE 9999
                                        END,
                                        CASE
                                            WHEN oc_dba_normalized NOT IN ('', ' ')
                                                AND smb_eng_companyname NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_dba_normalized),
                                                                          TRIM(smb_eng_companyname))
                                            ELSE 9999
                                        END,
                                        CASE
                                            WHEN oc_dba_normalized NOT IN ('', ' ')
                                                AND smb_eng_dba NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_dba_normalized), TRIM(smb_eng_dba))
                                            ELSE 9999
                                        END
                                                                                           )) + (20 - CASE
                                                                                                          WHEN
                                                                                                              oc_street_address_normalized NOT IN
                                                                                                              ('', ' ')
                                                                                                                  AND
                                                                                                              smb_eng_address NOT IN
                                                                                                              ('', ' ')
                                                                                                              THEN levenshtein_distance(
                                                                                                                  TRIM(oc_street_address_normalized),
                                                                                                                  TRIM(smb_eng_address))
                                                                                                          ELSE 9999
                                                                                                      END) +
                                                                                     state_match +
                                                                                     city_match +
                                                                                     zipcode_match DESC) AS similarity_index_rank,

                                (20 - LEAST(
                                        CASE
                                            WHEN oc_normalised_name NOT IN ('', ' ')
                                                AND smb_eng_companyname NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_normalised_name),
                                                                          TRIM(smb_eng_companyname))
                                            ELSE 9999
                                        END,
                                        CASE
                                            WHEN oc_normalised_name NOT IN ('', ' ')
                                                AND smb_eng_dba NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_normalised_name), TRIM(smb_eng_dba))
                                            ELSE 9999
                                        END,
                                        CASE
                                            WHEN oc_dba_normalized NOT IN ('', ' ')
                                                AND smb_eng_companyname NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_dba_normalized),
                                                                          TRIM(smb_eng_companyname))
                                            ELSE 9999
                                        END,
                                        CASE
                                            WHEN oc_dba_normalized NOT IN ('', ' ')
                                                AND smb_eng_dba NOT IN ('', ' ')
                                                THEN levenshtein_distance(TRIM(oc_dba_normalized), TRIM(smb_eng_dba))
                                            ELSE 9999
                                        END
                                      )) + (20 - CASE
                                                     WHEN oc_street_address_normalized NOT IN ('', ' ')
                                                         AND smb_eng_address NOT IN ('', ' ')
                                                         THEN levenshtein_distance(TRIM(company_address), TRIM(smb_eng_address))
                                                     ELSE 9999
                                                 END) + state_match + city_match +
                                zipcode_match                                                            AS similarity_index

                            FROM joined_data
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
        smb_eng_companyname,
        smb_eng_companyname_firstletter,
        smb_eng_dba,
        smb_eng_dba_firstletter,
        smb_eng_address,
        smb_eng_street_num,
        smb_eng_state,
        smb_eng_city,
        smb_eng_zipcode,
        smb_eng_zipcode_threedigits,
        smb_eng_zip4,
        company_number,
        jurisdiction_code,
        oc_normalised_name,
        oc_previous_names,
        oc_incorporation_date,
        oc_street_address,
        oc_street_address_normalized,
        oc_locality,
        oc_region,
        oc_postal_code,
        oc_country,
        oc_company_name_normalized,
        oc_dba_normalized,
        oc_alternative_dba_normalized,
        oc_website_normalized,
        oc_zipcode,
        oc_zipcode_threedigits,
        oc_zipcode_plus4,
        state_match,
        city_match,
        zipcode_match,
        levdistance_name,
        levdistance_address,
        similarity_index_rank,
        similarity_index
    FROM similarity_data
    WHERE similarity_index_rank <= 1000;

END;
$$
