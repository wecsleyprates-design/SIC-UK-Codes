CREATE OR REPLACE PROCEDURE public.sp_truncate_and_insert_open_corporates_us_standard()
    LANGUAGE plpgsql
AS
$$
BEGIN

    -- Step 5: https://worth-ai.atlassian.net/browse/INFRA-57
    DROP TABLE IF EXISTS datascience.open_corporates_us_standard;
    CREATE TABLE datascience.open_corporates_us_standard DISTKEY ( company_number)
                                                         INTERLEAVED SORTKEY (company_number, normalised_name, street_address_normalized) AS
    WITH
        alt_names AS (
            -- CTE for selecting distinct alternative names
            SELECT DISTINCT
                alt.company_number,
                alt.jurisdiction_code,
                alt.name AS alternative_name
            FROM open_corporate.alternative_names alt
        ),

        normalized_companies AS (
            -- CTE for normalizing companies data
            SELECT
                c.company_number,
                c.jurisdiction_code,
                c.name                                                                         AS company_name,
                c.normalised_name,
                c.current_alternative_legal_name,
                alt.alternative_name,
                c.previous_names,
                c.incorporation_date,
                c.dissolution_date,
                c."registered_address.country"                                                 AS street_address,
                c."registered_address.locality"                                                AS locality,
                c."registered_address.region"                                                  AS region,
                c."registered_address.postal_code"                                             AS postal_code,
                c."registered_address.country"                                                 AS country,

                -- Normalize and clean company name and DBA
                UPPER(REGEXP_REPLACE(c.name, '[^a-zA-Z0-9 ]', ''))                             AS companyname_normalized,
                UPPER(REGEXP_REPLACE(c.normalised_name, '[^a-zA-Z0-9 ]', ''))                  AS dba_normalized,
                UPPER(REGEXP_REPLACE(alt.alternative_name, '[^a-zA-Z0-9 ]', ''))               AS alternative_dba_normalized,
                ''                                                                             AS website_normalized,

                -- Normalize street address
                REPLACE(
                        REPLACE(
                                REPLACE(
                                        REPLACE(
                                                REPLACE(
                                                        REPLACE(
                                                                UPPER(
                                                                        REGEXP_REPLACE(
                                                                                TRANSLATE(
                                                                                        CAST(street_address AS VARCHAR),
                                                                                        '!"#$%&()*+,./:;<=>?@[\\]^_`{|}~',
                                                                                        ''), -- Remove non-alphanumeric characters
                                                                                '([0-9]+)[A-Z]{2}',
                                                                                '$1' -- Simplify address numbers followed by letters (like 123A to 123)
                                                                        )
                                                                ),
                                                                ' AVE ', ' AVENUE '
                                                        ),
                                                        ' APT ', ' '
                                                ),
                                                ' STE ', ' '
                                        ),
                                        ' BLVD ', ' BOULEVARD '
                                ),
                                ' DR ', ' DRIVE '
                        ),
                        ' ST ', ' STREET '
                )                                                                              AS street_address_normalized,
                -- Extract street number
                REGEXP_SUBSTR(street_address, '^[0-9]+')                                       AS street_number,

                -- Uppercase locality (city) UPPER(locality) AS city,

                -- Postal Code Formatting
                LPAD(SPLIT_PART(TRIM(postal_code), '-', 1), 5, '0')                            AS zipcode,
                SUBSTRING(LPAD(SPLIT_PART(TRIM(postal_code), '-', 1), 5, '0'), 1, 3)           AS
                                                                                                  zipcode_threedigits,
                LPAD(SPLIT_PART(TRIM(postal_code), '-', 2), 4, '0')                            AS zipcode_plus4,

                -- Extract first letter of company name and DBA
                SUBSTRING(UPPER(REGEXP_REPLACE(c.name, '[^a-zA-Z0-9 ]', '')), 1,
                          1)                                                                   AS companyname_firstletter,
                SUBSTRING(UPPER(REGEXP_REPLACE(c.normalised_name, '[^a-zA-Z0-9 ]', '')), 1, 1) AS dba_firstletter
            FROM open_corporate.companies c
                LEFT JOIN alt_names alt
                        ON c.company_number = alt.company_number
                    AND c.jurisdiction_code = alt.jurisdiction_code
        )
    SELECT
        nc.company_number,
        nc.jurisdiction_code,
        nc.company_name,
        remove_prefix_suffix(nc.normalised_name)                AS normalised_name,
        remove_prefix_suffix(nc.current_alternative_legal_name) AS current_alternative_legal_name,
        remove_prefix_suffix(nc.alternative_name)               AS alternative_name,
        nc.previous_names,
        nc.incorporation_date,
        nc.dissolution_date,
        nc.street_address,
        nc.locality,
        nc.region,
        nc.postal_code,
        nc.country,

        -- Already normalized fields
        remove_prefix_suffix(nc.companyname_normalized)         AS companyname_normalized,
        remove_prefix_suffix(nc.dba_normalized)                 AS dba_normalized,
        remove_prefix_suffix(nc.alternative_dba_normalized)     AS alternative_dba_normalized,
        nc.website_normalized,
        nc.street_address_normalized,
        nc.street_number,
        nc.locality                                             AS city,
        nc.zipcode,
        nc.zipcode_threedigits,
        nc.zipcode_plus4,

        -- Lookup State Abbreviation using `state_lookup`
        sl.state_code                                           AS state_abbreviation,

        -- Lookup Country using `country_lookup`
        cl.country_name_upper                                   AS country_normalized,

        nc.companyname_firstletter,
        nc.dba_firstletter

    FROM normalized_companies nc

-- Join with `state_lookup` using the upper-case state name
        LEFT JOIN public.state_lookup sl
                ON UPPER(nc.region) = sl.state_name_upper OR UPPER(nc.region) = sl.state_code

-- Join with `country_lookup` using the upper-case country name
        LEFT JOIN public.country_lookup cl
                ON UPPER(nc.country) = cl.country_name_upper

    WHERE nc.jurisdiction_code LIKE 'us_%'
      AND nc.postal_code != '';
END
$$;
