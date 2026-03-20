CREATE OR REPLACE PROCEDURE sp_truncate_and_populate_smb_standard()
    LANGUAGE plpgsql
AS
$$
BEGIN
    -- Step 2: https://worth-ai.atlassian.net/browse/INFRA-44
    DROP TABLE IF EXISTS datascience.smb_standard;

    CREATE TABLE datascience.smb_standard DISTKEY ( business_id )
                                          INTERLEAVED SORTKEY (business_id, customer_name, company_postalcode, company_dba, company_address) AS
    WITH
        -- Re-populate the table
        latest_instance AS (SELECT
                                business_id,
                                MAX(requested_at) AS latest_requested_at
                            FROM rds_integration_data.request_response
                            WHERE request_type = 'manual_upload'
                              AND JSON_EXTRACT_PATH_TEXT(response, 'name') IS NOT NULL
                            GROUP BY
                                business_id

        ),

        most_recent_request_ids AS (SELECT
                                        request_id
                                    FROM rds_integration_data.request_response
                                        INNER JOIN latest_instance
                                                ON requested_at = latest_requested_at
                                            AND request_response.business_id = latest_instance.business_id
                                    WHERE request_type = 'manual_upload'
        ),
        cleaned_addresses AS (SELECT
                                  business_id,
                                  UPPER(REGEXP_REPLACE(JSON_EXTRACT_PATH_TEXT(response, 'address_line_1'),
                                                       '[^a-zA-Z0-9 ]', ''))              AS clean_address,
                                  REGEXP_REPLACE(
                                          UPPER(JSON_EXTRACT_PATH_TEXT(response, 'name')),
                                          '[^a-zA-Z0-9 ]',
                                          ''
                                  )                                                       AS clean_name,
                                  JSON_EXTRACT_PATH_TEXT(response, 'address_line_1')      AS address_line_1,
                                  JSON_EXTRACT_PATH_TEXT(response, 'address_line_2')      AS address_line_2,
                                  JSON_EXTRACT_PATH_TEXT(response, 'address_city')        AS address_city,
                                  UPPER(JSON_EXTRACT_PATH_TEXT(response, 'state'))        AS address_state,
                                  JSON_EXTRACT_PATH_TEXT(response, 'address_postal_code') AS address_postal_code
                              FROM rds_integration_data.request_response rr
                              WHERE request_type = 'manual_upload'
                                AND request_id IN (SELECT request_id FROM most_recent_request_ids)
        ),
        monitoring_customers AS (SELECT
                                     bcm.business_id,
                                     dc.name             AS customer_name,
                                     MAX(bcm.created_at) AS created_at
                                 FROM rds_cases_public.rel_business_customer_monitoring bcm
                                     LEFT JOIN rds_auth_public.data_customers dc
                                             ON bcm.customer_id = dc.id
                                 GROUP BY
                                     bcm.business_id,
                                     dc.name
        ),

        extract_fields AS (SELECT DISTINCT
                               rr.request_id,
                               rr.requested_at,
                               rr.request_type,
                               mc.customer_name,
                               rr.business_id,
                               ROW_NUMBER()
                               OVER (PARTITION BY rr.business_id ORDER BY rr.requested_at DESC) AS latest_requested_at,
                               JSON_EXTRACT_PATH_TEXT(rr.response, 'external_id')               AS external_id,
                               JSON_EXTRACT_PATH_TEXT(rr.response, 'tin')                       AS tax_id,
                               JSON_EXTRACT_PATH_TEXT(rr.response, 'name')                      AS company_name,
                               JSON_EXTRACT_PATH_TEXT(rr.response, 'dba')                       AS company_dba,
                               JSON_EXTRACT_PATH_TEXT(rr.response, 'year')                      AS client_year_established,
                               JSON_EXTRACT_PATH_TEXT(rr.response, 'address_line_1')            AS company_address,
                               JSON_EXTRACT_PATH_TEXT(rr.response, 'address_line_2')            AS company_address_2,
                               JSON_EXTRACT_PATH_TEXT(rr.response, 'address_city')              AS company_city,
                               address_state                                                    AS company_state,
                               JSON_EXTRACT_PATH_TEXT(rr.response, 'address_postal_code')       AS company_postalcode,
                               UPPER(REGEXP_REPLACE(JSON_EXTRACT_PATH_TEXT(rr.response, 'name'), '[^a-zA-Z0-9 ]',
                                                    ''))                                        AS smb_eng_companyname,
                               SUBSTRING(
                                       REGEXP_REPLACE(JSON_EXTRACT_PATH_TEXT(rr.response, 'name'), '[^a-zA-Z0-9 ]', ''),
                                       1,
                                       1)                                                       AS smb_eng_companyname_firstletter,
                               UPPER(REGEXP_REPLACE(JSON_EXTRACT_PATH_TEXT(rr.response, 'dba'), '[^a-zA-Z0-9 ]',
                                                    ''))                                        AS smb_eng_dba,
                               SUBSTRING(
                                       REGEXP_REPLACE(JSON_EXTRACT_PATH_TEXT(rr.response, 'dba'), '[^a-zA-Z0-9 ]', ''),
                                       1,
                                       1)                                                       AS smb_eng_dba_firstletter,

                               UPPER(ca.clean_address)                                          AS smb_eng_address,
                               REGEXP_SUBSTR(ca.address_line_1, '^[0-9]+')                      AS smb_eng_street_num,
                               sl.state_code                                                    AS smb_eng_state,
                               UPPER(ca.address_city)                                           AS smb_eng_city,
                               LPAD(REGEXP_SUBSTR(ca.address_postal_code, '^[0-9]{5}'), 5, '0') AS smb_eng_zipcode,
                               LPAD(REGEXP_SUBSTR(ca.address_postal_code, '^[0-9]{3}'), 3, '0') AS smb_eng_zipcode_threedigits,
                               LPAD(REGEXP_SUBSTR(ca.address_postal_code, '^[0-9]{4}'), 4, '0') AS smb_eng_zip4,
                               mc.created_at,
                               CURRENT_TIMESTAMP                                                AS processed_at,
                               JSON_EXTRACT_PATH_TEXT(response, 'is_revenue')                   AS smb_annual_income

                           FROM rds_integration_data.request_response rr

                               -- Join with cleaned_addresses CTE
                               LEFT JOIN cleaned_addresses ca
                                       ON rr.business_id = ca.business_id

                               -- Join with monitoring_customers CTE
                               LEFT JOIN monitoring_customers mc
                                       ON rr.business_id = mc.business_id

                               -- Join with the state lookup table to get state codes
                               LEFT JOIN state_lookup sl
                                       ON ca.address_state = sl.state_code
                           WHERE request_type = 'manual_upload'
                             AND request_id IN (SELECT request_id FROM most_recent_request_ids)
        )

    SELECT
        request_id,
        requested_at,
        request_type,
        customer_name,
        business_id,
        smb_annual_income                         AS annual_income,
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
        smb_annual_income
    FROM extract_fields;

END;
$$;
