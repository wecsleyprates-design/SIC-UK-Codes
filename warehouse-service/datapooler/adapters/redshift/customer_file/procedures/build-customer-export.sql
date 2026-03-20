CREATE OR REPLACE PROCEDURE sp_build_customer_export(
    p_customer_id VARCHAR,
    INOUT o_temp_table VARCHAR
)
    LANGUAGE plpgsql
AS
$$
DECLARE
    v_suffix     VARCHAR(12);
    v_tbl        VARCHAR(128);
    v_select_sql VARCHAR(65535);
BEGIN
    -- Unique temp table name
    v_suffix := SUBSTRING(MD5(RANDOM()::VARCHAR || GETDATE()::VARCHAR), 1, 12);
    v_tbl := 'tmp_customer_export_' || v_suffix;
    o_temp_table := v_tbl;

    /*
      Store the whole export query in a dollar-quoted string.
      Use a placeholder __CUSTOMER_ID__ and replace it with quote_literal(p_customer_id).
    */
    v_select_sql := $export$
WITH
-- 1) Start from the customer’s business_ids (small set), then join facts
customer_businesses AS (SELECT
                            customer_id,
                            business_id,
                            external_id,
                            created_at
                        FROM rds_cases_public.rel_business_customer_monitoring
                        WHERE customer_id = __CUSTOMER_ID__
),

-- 2) Filter facts early to ONLY the fact names you use
filtered_facts AS (SELECT
                       cb.customer_id,
                       f.business_id,
                       cb.external_id,
                       cb.created_at                            AS monitoring_created_at,
                       f.name,
                       JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS fact_value
                   FROM customer_businesses cb
                       JOIN rds_warehouse_public.facts f
                               ON f.business_id = cb.business_id
                   WHERE LENGTH(f.value) < 60000
                     AND f.name IN (
                       -- put ONLY the names you reference in SELECT/CASE below
                                    'business_name', 'legal_name', 'primary_address_string', 'dba', 'year_established',
                                    'naics_code', 'naics_description', 'mcc_code', 'mcc_description',
                                    'revenue', 'net_income', 'num_employees',
                                    'tin', 'tin_match_boolean', 'tin_match', 'tin_submitted',
                                    'sos_filings',
                                    'business_phone', 'phone_found', 'email', 'website', 'website_found',
                                    'bankruptcies', 'num_bankruptcies',
                                    'judgements', 'num_judgements',
                                    'liens', 'num_liens',
                                    'review_count', 'review_rating', 'watchlist_hits',
                                    'dba_found', 'middesk_id', 'zoominfo_id', 'opencorporates_id', 'equifax_id',
                                    'serp_id',
                                    'addresses_submitted', 'primary_city', 'address_verification_boolean',
                                    'addresses', 'addresses_deliverable', 'addresses_found', 'mailing_address',
                                    'countries',
                                    'formation_date', 'formation_state', 'stock_symbol', 'people',
                                    'idv_passed', 'idv_passed_boolean', 'kyb_submitted',
                                    'sos_active', 'sos_match', 'sos_match_boolean',
                                    'minority_owned', 'veteran_owned', 'woman_owned',
                                    'watchlist'
                       )
),

-- 3) Parse SOS filing ONCE per business (first filing + officers)
sos_parsed AS (SELECT
                   business_id,

                   -- first filing JSON object (string)
                   JSON_EXTRACT_ARRAY_ELEMENT_TEXT(fact_value, 0) AS sos0,

                   -- officers array JSON string (from first filing)
                   JSON_EXTRACT_PATH_TEXT(
                           JSON_EXTRACT_ARRAY_ELEMENT_TEXT(fact_value, 0),
                           'officers'
                   )                                              AS officers_json
               FROM filtered_facts
               WHERE name = 'sos_filings'
),

-- 4) Pivot business facts; join sos_parsed to avoid repeated json calls
business_data AS (SELECT
                      ff.customer_id,
                      ff.business_id,
                      ff.external_id,
                      MAX(ff.monitoring_created_at)                                           AS created_at,

                      -- Basic Business Information
                      COALESCE(MAX(CASE WHEN ff.name = 'business_name' THEN ff.fact_value END),
                               '')                                                            AS business_name,
                      COALESCE(MAX(CASE WHEN ff.name = 'legal_name' THEN ff.fact_value END),
                               '')                                                            AS legal_name,
                      COALESCE(MAX(CASE WHEN ff.name = 'primary_address_string' THEN ff.fact_value END),
                               '')                                                            AS primary_address_string,
                      COALESCE(MAX(CASE WHEN ff.name = 'dba' THEN ff.fact_value END), '')     AS dba,
                      COALESCE(MAX(CASE WHEN ff.name = 'year_established' THEN ff.fact_value END),
                               '')                                                            AS year_established,

                      -- Industry
                      COALESCE(MAX(CASE WHEN ff.name = 'naics_code' THEN ff.fact_value END),
                               '')                                                            AS naics_code,
                      COALESCE(MAX(CASE WHEN ff.name = 'naics_description' THEN ff.fact_value END),
                               '')                                                            AS naics_description,
                      COALESCE(MAX(CASE WHEN ff.name = 'mcc_code' THEN ff.fact_value END),
                               '')                                                            AS mcc_code,
                      COALESCE(MAX(CASE WHEN ff.name = 'mcc_description' THEN ff.fact_value END),
                               '')                                                            AS mcc_description,

                      -- Financial
                      COALESCE(MAX(CASE WHEN ff.name = 'revenue' THEN ff.fact_value END), '') AS revenue,
                      COALESCE(MAX(CASE WHEN ff.name = 'net_income' THEN ff.fact_value END),
                               '')                                                            AS net_income,
                      COALESCE(MAX(CASE WHEN ff.name = 'num_employees' THEN ff.fact_value END),
                               '')                                                            AS num_employees,

                      -- Verifications
                      COALESCE(MAX(CASE WHEN ff.name = 'tin' THEN ff.fact_value END), '')     AS tin,
                      COALESCE(MAX(CASE WHEN ff.name = 'tin_match_boolean' THEN ff.fact_value END),
                               '')                                                            AS tin_match_boolean,
                      COALESCE(MAX(CASE WHEN ff.name = 'tin_match' THEN ff.fact_value END),
                               '')                                                            AS tin_match,

                      -- Contact
                      COALESCE(MAX(CASE WHEN ff.name = 'business_phone' THEN ff.fact_value END),
                               '')                                                            AS business_phone,
                      COALESCE(MAX(CASE WHEN ff.name = 'phone_found' THEN ff.fact_value END),
                               '')                                                            AS phone_found,
                      COALESCE(MAX(CASE WHEN ff.name = 'email' THEN ff.fact_value END), '')   AS email,
                      COALESCE(MAX(CASE WHEN ff.name = 'website' THEN ff.fact_value END), '') AS website,
                      COALESCE(MAX(CASE WHEN ff.name = 'website_found' THEN ff.fact_value END),
                               '')                                                            AS website_found,

                      -- Legal/Credit JSON blobs (keep raw + parse counts once)
                      COALESCE(MAX(CASE WHEN ff.name = 'bankruptcies' THEN ff.fact_value END),
                               '')                                                            AS bankruptcies_json,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'bankruptcies' THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'count')
                                   END),
                               '')                                                            AS bankruptcies_count,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'bankruptcies'
                                           THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'most_recent')
                                   END),
                               '')                                                            AS bankruptcies_most_recent_date,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'bankruptcies'
                                           THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'most_recent_status')
                                   END),
                               '')                                                            AS bankruptcies_most_recent_status,

                      COALESCE(MAX(CASE WHEN ff.name = 'judgements' THEN ff.fact_value END),
                               '')                                                            AS judgements_json,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'judgements' THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'count')
                                   END),
                               '')                                                            AS judgements_count,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'judgements'
                                           THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'most_recent')
                                   END),
                               '')                                                            AS judgements_most_recent_date,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'judgements'
                                           THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'most_recent_amount')
                                   END),
                               '')                                                            AS judgements_most_recent_amount,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'judgements'
                                           THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'most_recent_status')
                                   END),
                               '')                                                            AS judgements_most_recent_status,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'judgements'
                                           THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'total_judgement_amount')
                                   END),
                               '')                                                            AS judgements_total_amount,

                      COALESCE(MAX(CASE WHEN ff.name = 'liens' THEN ff.fact_value END), '')   AS liens_json,
                      COALESCE(MAX(CASE WHEN ff.name = 'liens' THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'count') END),
                               '')                                                            AS liens_count,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'liens' THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'most_recent')
                                   END),
                               '')                                                            AS liens_most_recent_date,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'liens'
                                           THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'most_recent_amount')
                                   END),
                               '')                                                            AS liens_most_recent_amount,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'liens'
                                           THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'most_recent_status')
                                   END),
                               '')                                                            AS liens_most_recent_status,
                      COALESCE(MAX(CASE
                                       WHEN ff.name = 'liens'
                                           THEN JSON_EXTRACT_PATH_TEXT(ff.fact_value, 'total_open_lien_amount')
                                   END),
                               '')                                                            AS liens_total_open_amount,

                      -- Reviews / watchlist hits
                      COALESCE(MAX(CASE WHEN ff.name = 'review_count' THEN ff.fact_value END),
                               '')                                                            AS review_count,
                      COALESCE(MAX(CASE WHEN ff.name = 'review_rating' THEN ff.fact_value END),
                               '')                                                            AS review_rating,
                      COALESCE(MAX(CASE WHEN ff.name = 'watchlist_hits' THEN ff.fact_value END),
                               '')                                                            AS watchlist_hits,

                      -- Addresses
                      COALESCE(MAX(CASE WHEN ff.name = 'addresses_deliverable' THEN ff.fact_value END),
                               '')                                                            AS addresses_deliverable,
                      COALESCE(MAX(CASE WHEN ff.name = 'addresses_found' THEN ff.fact_value END),
                               '')                                                            AS addresses_found,

                      -- Ownership
                      COALESCE(MAX(CASE WHEN ff.name = 'minority_owned' THEN ff.fact_value END),
                               '')                                                            AS minority_owned,
                      COALESCE(MAX(CASE WHEN ff.name = 'veteran_owned' THEN ff.fact_value END),
                               '')                                                            AS veteran_owned,
                      COALESCE(MAX(CASE WHEN ff.name = 'woman_owned' THEN ff.fact_value END),
                               '')                                                            AS woman_owned,

                      -- IDV flags
                      COALESCE(MAX(CASE WHEN ff.name = 'idv_passed' THEN ff.fact_value END),
                               '')                                                            AS idv_passed,
                      COALESCE(MAX(CASE WHEN ff.name = 'idv_passed_boolean' THEN ff.fact_value END),
                               '')                                                            AS idv_passed_boolean,

                      -- SOS parsed fields (from pre-parsed sos0/officers_json)
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(sp.sos0, 'state')), '')             AS registry_jurisdiction,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(sp.sos0, 'active')), '')            AS registry_active,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(sp.sos0, 'filing_name')), '')       AS registry_name,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(sp.sos0, 'filing_date')), '')       AS registry_date,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(sp.sos0, 'entity_type')), '')       AS registry_entity_type,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(sp.sos0, 'url')), '')               AS registry_filing_url,

                      -- Director 1 (officers[0])
                      COALESCE(
                              MAX(JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 0), 'name')),
                              '')                                                             AS director_1_name,
                      COALESCE(MAX(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(
                              JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 0), 'titles'),
                              0)),
                               '')                                                            AS director_1_title,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 0),
                                                          'start_date')),
                               '')                                                            AS director_1_start_date,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(
                              JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 0), 'address'),
                              'full_address')),
                               '')                                                            AS director_1_address,

                      -- Director 2 (officers[1])
                      COALESCE(
                              MAX(JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 1), 'name')),
                              '')                                                             AS director_2_name,
                      COALESCE(MAX(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(
                              JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 1), 'titles'),
                              0)),
                               '')                                                            AS director_2_title,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 1),
                                                          'start_date')),
                               '')                                                            AS director_2_start_date,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(
                              JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 1), 'address'),
                              'full_address')),
                               '')                                                            AS director_2_address,

                      -- Director 3 (officers[2])
                      COALESCE(
                              MAX(JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 2), 'name')),
                              '')                                                             AS director_3_name,
                      COALESCE(MAX(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(
                              JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 2), 'titles'),
                              0)),
                               '')                                                            AS director_3_title,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 2),
                                                          'start_date')),
                               '')                                                            AS director_3_start_date,
                      COALESCE(MAX(JSON_EXTRACT_PATH_TEXT(
                              JSON_EXTRACT_PATH_TEXT(JSON_EXTRACT_ARRAY_ELEMENT_TEXT(sp.officers_json, 2), 'address'),
                              'full_address')),
                               '')                                                            AS director_3_address

                  FROM filtered_facts ff
                      LEFT JOIN sos_parsed sp
                              ON ff.business_id = sp.business_id
                  GROUP BY
                      1,
                      2,
                      3
),

-- 5) Compute addr0 once (so final select doesn’t re-run JSON extraction 20x)
addr_once AS (SELECT
                  bd.*,
                  CASE
                      WHEN bd.addresses_deliverable <> '' AND bd.addresses_deliverable <> '[]'
                          THEN JSON_EXTRACT_ARRAY_ELEMENT_TEXT(bd.addresses_deliverable, 0)
                      ELSE NULL
                  END AS addr0
              FROM business_data bd
),

identity_verification AS (SELECT
                              bd.business_id,
                              iv.business_id                                                       AS original_business_id,
                              iv.id                                                                AS idv_id,
                              iv.external_id                                                       AS idv_external_id,
                              iv.applicant_id                                                      AS idv_applicant_id,
                              iv.status                                                            AS idv_status_code,
                              iv.template_id                                                       AS idv_template_id,
                              iv.shareable_url                                                     AS idv_shareable_url,
                              iv.created_at                                                        AS idv_created_at,
                              iv.updated_at                                                        AS idv_updated_at,

                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'name', 'given_name')        AS idv_given_name,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'name', 'family_name')       AS idv_family_name,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'date_of_birth')             AS idv_date_of_birth,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'phone_number')              AS idv_phone_number,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'email_address')             AS idv_email_address,

                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'address', 'street')         AS idv_address_street,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'address', 'street2')        AS idv_address_street2,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'address', 'city')           AS idv_address_city,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'address', 'region')         AS idv_address_state,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'address', 'postal_code')    AS idv_address_postal_code,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'user', 'address', 'country')        AS idv_address_country,

                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'status')                            AS idv_overall_status,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'completed_at')                      AS idv_completed_at,

                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'steps', 'kyc_check')                AS idv_kyc_check_status,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'steps', 'risk_check')               AS idv_risk_check_status,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'steps', 'accept_tos')               AS idv_accept_tos_status,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'steps', 'verify_sms')               AS idv_verify_sms_status,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'steps', 'selfie_check')             AS idv_selfie_check_status,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'steps', 'watchlist_screening')      AS idv_watchlist_screening_status,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'steps', 'documentary_verification') AS idv_documentary_verification_status,

                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'kyc_check', 'status')               AS idv_kyc_status,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'kyc_check', 'name', 'summary')      AS idv_kyc_name_match,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'kyc_check', 'address', 'summary')   AS idv_kyc_address_match,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'kyc_check', 'address', 'type')      AS idv_kyc_address_type,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'kyc_check', 'address', 'po_box')    AS idv_kyc_address_po_box,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'kyc_check', 'phone_number',
                                                     'summary')                                    AS idv_kyc_phone_match,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'kyc_check', 'phone_number',
                                                     'area_code')                                  AS idv_kyc_phone_area_code_match,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'kyc_check', 'date_of_birth',
                                                     'summary')                                    AS idv_kyc_dob_match,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'kyc_check', 'id_number', 'summary') AS idv_kyc_id_number_match,

                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'status')              AS idv_risk_status,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'is_deliverable')                             AS idv_risk_email_deliverable,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'breach_count')                               AS idv_risk_email_breach_count,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'first_breached_at')                          AS idv_risk_email_first_breach,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'last_breached_at')                           AS idv_risk_email_last_breach,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'domain_is_custom')                           AS idv_risk_email_custom_domain,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'domain_is_disposable')                       AS idv_risk_email_disposable,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'domain_is_free_provider')                    AS idv_risk_email_free_provider,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'domain_registered_at')                       AS idv_risk_email_domain_registered,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'top_level_domain_is_suspicious')             AS idv_risk_email_suspicious_tld,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'email',
                                                     'linked_services')                            AS idv_risk_email_linked_services,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'phone',
                                                     'linked_services')                            AS idv_risk_phone_linked_services,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'identity_abuse_signals', 'stolen_identity',
                                                     'score')                                      AS idv_risk_stolen_identity_score,
                              JSON_EXTRACT_PATH_TEXT(iv.meta, 'risk_check', 'identity_abuse_signals',
                                                     'synthetic_identity',
                                                     'score')                                      AS idv_risk_synthetic_identity_score

                          FROM addr_once bd
                              JOIN rds_integration_data.identity_verification iv
                                      ON iv.business_id = bd.business_id
                          QUALIFY ROW_NUMBER() OVER (PARTITION BY bd.business_id ORDER BY iv.created_at DESC) = 1
),

adverse_media AS (SELECT
                      bd.business_id,
                      COALESCE(am.total_risk_count, 0)  AS total_am_count,
                      COALESCE(am.high_risk_count, 0)   AS high_am_count,
                      COALESCE(am.medium_risk_count, 0) AS medium_am_count,
                      COALESCE(am.low_risk_count, 0)    AS low_am_count,

                      ra.final_score                    AS am_top_relevance_score,
                      ra.risk_level                     AS am_top_risk_level,
                      ra.risk_description               AS am_top_risk_description,
                      ra."date"                         AS am_top_date,
                      ra."source"                       AS am_top_source,
                      ra.title                          AS am_top_title,
                      ra.link                           AS am_top_link

                  FROM addr_once bd
                      LEFT JOIN rds_integration_data.adverse_media am
                              ON bd.business_id = am.business_id
                      LEFT JOIN rds_integration_data.adverse_media_articles ra
                              ON bd.business_id = ra.business_id
                  QUALIFY ROW_NUMBER()
                          OVER (PARTITION BY bd.business_id ORDER BY ra.final_score DESC NULLS LAST, ra."date" DESC NULLS LAST) =
                          1
),

personal_credit AS (SELECT
                        bd.business_id,
                        bcs.score
                    FROM addr_once bd
                        LEFT JOIN rds_integration_data.bureau_credit_score bcs
                                USING (business_id)
                    QUALIFY ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY bcs.updated_at DESC) = 1
),

worth_score AS (SELECT
                    bd.business_id,
                    bs.weighted_score_850 AS worth_score
                FROM addr_once bd
                    LEFT JOIN rds_manual_score_public.data_current_scores cs
                            USING (business_id)
                    LEFT JOIN rds_manual_score_public.business_scores bs
                            ON cs.score_id = bs.id
                QUALIFY ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY bs.created_at DESC) = 1
)

SELECT
    bd.customer_id,
    bd.business_id,
    bd.external_id,
    bd.created_at,

    bd.business_name,
    bd.primary_address_string                AS primary_address,
    bd.business_phone,

    bd.legal_name,
    bd.dba,
    bd.email,
    bd.website,
    bd.year_established,

    bd.naics_code,
    UPPER(bd.naics_description)              AS naics_description,
    bd.mcc_code,
    UPPER(bd.mcc_description)                AS mcc_description,

    bd.revenue,
    bd.net_income,
    bd.num_employees,

    bd.tin,
    bd.tin_match_boolean,

    bd.registry_jurisdiction,
    bd.registry_active,
    UPPER(bd.registry_name)                  AS registry_name,
    bd.registry_date,
    UPPER(bd.registry_entity_type)           AS registry_entity_type,
    bd.registry_filing_url,

    -- address parsing now references bd.addr0 once (replace your repeated JSON_EXTRACT_ARRAY_ELEMENT_TEXT calls)
    UPPER(CASE
              WHEN bd.addr0 IS NOT NULL THEN TRIM(SPLIT_PART(bd.addr0, ',', 1))
              ELSE ''
          END)                               AS registry_address_line_1,
    UPPER(bd.director_1_name)                AS director_1_name,
    UPPER(bd.director_1_title)               AS director_1_title,
    bd.director_1_start_date,
    UPPER(bd.director_1_address)             AS director_1_address,

    UPPER(NULLIF(bd.director_2_name, ''))    AS director_2_name,
    UPPER(NULLIF(bd.director_2_title, ''))   AS director_2_title,
    bd.director_2_start_date,
    UPPER(NULLIF(bd.director_2_address, '')) AS director_2_address,

    UPPER(NULLIF(bd.director_3_name, ''))    AS director_3_name,
    UPPER(NULLIF(bd.director_3_title, ''))   AS director_3_title,
    bd.director_3_start_date,
    UPPER(NULLIF(bd.director_3_address, '')) AS director_3_address,

    bd.phone_found,
    bd.website_found,

    bd.bankruptcies_count,
    bd.bankruptcies_most_recent_date,
    bd.bankruptcies_most_recent_status,

    bd.judgements_count,
    bd.judgements_most_recent_date,
    bd.judgements_most_recent_amount,
    bd.judgements_most_recent_status,
    bd.judgements_total_amount,

    bd.liens_count,
    bd.liens_most_recent_date,
    bd.liens_most_recent_amount,
    bd.liens_most_recent_status,
    bd.liens_total_open_amount               AS liens_total_open_amount,

    bd.review_count,
    bd.review_rating,

    bd.idv_passed,
    bd.idv_passed_boolean,

    bd.minority_owned,
    bd.veteran_owned,
    bd.woman_owned,

    bd.watchlist_hits                        AS watchlist_count,

    am.total_am_count,
    am.high_am_count,
    am.medium_am_count,
    am.low_am_count,
    am.am_top_relevance_score,
    am.am_top_risk_level,
    am.am_top_risk_description,
    am.am_top_date,
    am.am_top_source,
    am.am_top_title,
    am.am_top_link,

    bd.addresses_deliverable,
    bd.addresses_found,

    idv.idv_status_code,
    idv.idv_template_id,
    idv.idv_created_at,
    idv.idv_updated_at,

    idv.idv_given_name,
    idv.idv_family_name,
    idv.idv_kyc_name_match,
    idv.idv_date_of_birth,
    idv.idv_kyc_dob_match,
    idv.idv_kyc_id_number_match,
    idv.idv_phone_number,
    idv.idv_kyc_phone_match,
    idv.idv_kyc_phone_area_code_match,
    idv.idv_risk_phone_linked_services,

    idv.idv_address_street,
    idv.idv_address_street2,
    idv.idv_address_city,
    idv.idv_address_state,
    idv.idv_address_postal_code,
    idv.idv_address_country,
    idv.idv_kyc_address_match,
    idv.idv_kyc_address_type,
    idv.idv_kyc_address_po_box,

    idv.idv_overall_status,
    idv.idv_completed_at,

    idv.idv_kyc_check_status,
    idv.idv_risk_check_status,
    idv.idv_accept_tos_status,
    idv.idv_verify_sms_status,
    idv.idv_selfie_check_status,
    idv.idv_watchlist_screening_status,
    idv.idv_documentary_verification_status,

    idv.idv_kyc_status,
    idv.idv_risk_status,

    idv.idv_email_address,
    idv.idv_risk_email_deliverable,
    idv.idv_risk_email_breach_count,
    idv.idv_risk_email_first_breach,
    idv.idv_risk_email_last_breach,
    idv.idv_risk_email_custom_domain,
    idv.idv_risk_email_disposable,
    idv.idv_risk_email_free_provider,
    idv.idv_risk_email_domain_registered,
    idv.idv_risk_email_suspicious_tld,
    idv.idv_risk_email_linked_services,
    idv.idv_risk_stolen_identity_score,
    idv.idv_risk_synthetic_identity_score,

    CASE
        WHEN bd.tin_match <> '' AND bd.tin_match IS NOT NULL
            THEN COALESCE(JSON_EXTRACT_PATH_TEXT(bd.tin_match, 'message'), bd.tin_match)
        ELSE ''
    END                                      AS tin_match,

    pc.score                                 AS personal_credit_score,
    ws.worth_score

FROM addr_once bd
    LEFT JOIN identity_verification idv
            USING (business_id)
    LEFT JOIN adverse_media am
            USING (business_id)
    LEFT JOIN personal_credit pc
            USING (business_id)
    LEFT JOIN worth_score ws
            USING (business_id)
ORDER BY
    bd.created_at DESC;
$export$;

    -- Inject customer_id safely
    v_select_sql := REPLACE(v_select_sql, '__CUSTOMER_ID__', QUOTE_LITERAL(p_customer_id));

    -- Materialize to dynamic temp table
    EXECUTE 'CREATE TEMP TABLE ' || QUOTE_IDENT(v_tbl) || ' AS ' || v_select_sql;

END;
$$;
