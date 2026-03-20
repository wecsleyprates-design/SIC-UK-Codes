CREATE OR REPLACE PROCEDURE sp_truncate_and_insert_verification_results()
    LANGUAGE plpgsql
AS
$$
BEGIN
    DROP TABLE IF EXISTS clients.verification_results;

    CREATE TABLE clients.verification_results DISTKEY ( business_id ) AS
    WITH
        initial_select AS (SELECT DISTINCT
                               bert.business_entity_verification_id,
                               bev.business_id,
                               formation_date,
                               MAX(CASE
                                       WHEN bert.category = 'name' AND bert.sublabel IN ('Verified', 'Similar Match')
                                           THEN 1
                                       ELSE 0
                                   END)                                                                      AS name_verification,
                               MAX(CASE
                                       WHEN bert.category = 'address' AND
                                            bert.sublabel IN ('Verified', 'Approximate Match', 'Similar Match')
                                           THEN 1
                                       ELSE 0
                                   END)                                                                      AS address_verification,
                               MAX(CASE
                                       WHEN bert.category = 'tin' AND bert.sublabel IN ('Found')
                                           THEN 1
                                       ELSE 0
                                   END)                                                                      AS tin_verification,
                               MAX(CASE
                                       WHEN bert.category = 'watchlist' AND bert.sublabel IN ('No Hits')
                                           THEN 1
                                       ELSE 0
                                   END)                                                                      AS watchlist_verification,
                               MAX(CASE
                                       WHEN bert.key = 'sos_domestic'
                                           AND bert.sublabel IN ('Domestic Active')
                                           THEN 1
                                       ELSE 0
                                   END)                                                                      AS sos_domestic_verification,
                               MAX(CASE
                                       WHEN bert.key = 'sos_match' AND bert.sublabel IN ('Submitted Active')
                                           THEN 1
                                       ELSE 0
                                   END)                                                                      AS sos_match_verification,
                               MAX(CASE
                                       WHEN bert.category = 'sos' AND bert.key = 'sos_active' AND
                                            bert.status = 'Success'
                                           THEN 1
                                       ELSE 0
                                   END)                                                                      AS sos_active_verification,
                               ROW_NUMBER() OVER (PARTITION BY bev.business_id ORDER BY bev.created_at DESC) AS rn_bev,
                               CURRENT_TIMESTAMP                                                             AS processed_at

                           FROM rds_integration_data.business_entity_review_task AS bert
                               LEFT JOIN "dev"."rds_integration_data"."business_entity_verification" AS bev
                                       ON bert.business_entity_verification_id = bev.id
                           GROUP BY
                               business_entity_verification_id,
                               business_id,
                               formation_date,
                               bev.created_at
                           QUALIFY rn_bev = 1
        )
    SELECT
        business_entity_verification_id,
        business_id,
        formation_date,
        name_verification,
        address_verification,
        tin_verification,
        watchlist_verification,
        sos_domestic_verification,
        sos_match_verification,
        sos_active_verification,
        processed_at,
        full_address          AS beas_full_address,
        address_line_1        AS beas_address_line_1,
        address_line_2        AS beas_address_line_2,
        city                  AS beas_city,
        state                 AS beas_state,
        postal_code           AS beas_postal_code,
        lat                   AS beas_lat,
        long                  AS beas_long,
        cmra                  AS beas_cmra,
        address_property_type AS beas_address_property_type
    FROM initial_select
        LEFT JOIN
    rds_integration_data.business_entity_address_source AS beas
                USING (business_entity_verification_id);

    GRANT ALL ON TABLE clients.verification_results to "IAM:worthai-dataplatform-service-user";
END;
$$;
