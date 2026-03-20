CREATE OR REPLACE PROCEDURE public.sp_recreate_customer_files()
    LANGUAGE plpgsql
AS

$$
BEGIN

    -- https://worth-ai.atlassian.net/browse/INFRA-66
    DROP TABLE IF EXISTS datascience.customer_files;
    DROP TABLE IF EXISTS warehouse.latest_score;

    CREATE TABLE warehouse.latest_score DISTKEY ( business_id ) AS
    WITH
        initial_select AS (SELECT
                               score_trigger_id,
                               business_id,
                               score,
                               CAST(partition_0 || '-' || partition_1 || '-' || partition_2 AS DATE) AS score_date

                           FROM awsdatacatalog."aws-data-exchange".scores_ai_dataplatform_v1
        ),

        rank_ids AS (SELECT
                         score_trigger_id,
                         business_id,
                         score,
                         score_date,
                         ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY score_date DESC ) AS rn
                     FROM initial_select
        )

    SELECT DISTINCT
        score_trigger_id,
        business_id,
        score,
        score_date
    FROM rank_ids
    WHERE rn = 1;

    CREATE TABLE datascience.customer_files DISTKEY ( business_id ) AS
    WITH
        initial_select AS (SELECT DISTINCT
                               business_id,
                               customer_unique_identifier,
                               company_name,
                               created_at,
                               tax_id,
                               score                                                               AS worth_score,
                               company_address,
                               company_city,
                               company_state,
                               company_postalcode,
                               name_verification,
                               address_verification,
                               tin_verification,
                               watchlist_verification,
                               sos_domestic_verification,
                               sos_match_verification,
                               corp_filing_business_name                                           AS corporate_filing_business_name,
                               corp_filing_filing_date                                             AS corporate_filing_filling_date,
                               corp_filing_incorporation_state                                     AS corporate_filing_incorporation_state,
                               corp_filing_corp_type                                               AS corporate_filing_corporation_type,
                               corp_filing_reg_type                                                AS corporate_filing_registration_type,
                               corp_filing_sos_status                                              AS corporate_filing_secretary_of_state_status,
                               CASE
                                   WHEN name_verification = 1 THEN corp_filing_sos_status_date
                                   ELSE NULL
                               END                                                                 AS corporate_filing_secretary_of_state_status_date,
                               COALESCE(avg_rating, 0.0)                                           AS average_rating,
                               COALESCE(google_review_count, 0) + COALESCE(angi_review_count, 0) +
                               COALESCE(bbb_review_count, 0) +
                               COALESCE(yelp_review_count, 0) + COALESCE(healthgrades_review_count, 0) +
                               COALESCE(vitals_review_count, 0) +
                               COALESCE(webmd_review_count, 0)                                     AS total_review_count,
                               COALESCE(
                                       CASE
                                           WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                               THEN zi_match_confidence
                                           ELSE efx_match_confidence
                                       END,
                                       0.0
                               )                                                                   AS match_confidence,
                               CASE
                                   WHEN average_rating IS NOT NULL OR match_confidence IS NOT NULL OR
                                        name_verification = 1 THEN 1
                                   ELSE NULL
                               END                                                                 AS sos_online_firm_coverage,
                               CASE
                                   WHEN average_rating IS NOT NULL OR match_confidence IS NOT NULL OR
                                        name_verification = 1 OR
                                        tin_verification = 1
                                       THEN 1
                                   ELSE NULL
                               END                                                                 AS sos_online_firm_tin_coverage,
                               CASE WHEN efx_gov = 'Y' THEN 'Y' ELSE 'N' END                       AS gov_flag,
                               CASE WHEN efx_nonprofit = 'Y' THEN 'Y' ELSE 'N' END                 AS nonprofit_flag,
                               CASE WHEN efx_edu = 'Y' THEN 'Y' ELSE 'N' END                       AS edu_flag,
                               COALESCE(serp.phone_match, CAST(zi_c_phone AS VARCHAR),
                                        CAST(efx_phone AS VARCHAR))                                AS phone_number,
                               COALESCE(CAST(zi_c_latitude AS VARCHAR), CAST(efx_lat AS VARCHAR))  AS latitude,
                               COALESCE(CAST(zi_c_longitude AS VARCHAR), CAST(efx_lon AS VARCHAR)) AS longitude,
                               COALESCE(efx_primnaicsdesc, naics_desc)                             AS primary_naics_description,
                               CASE
                                   WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                       THEN CAST(NULLIF(REGEXP_REPLACE(zi_c_employees, '[^0-9]', ''), '') AS INTEGER)
                                   ELSE CAST(NULLIF(REGEXP_REPLACE(efx_corpempcnt, '[^0-9]', ''), '') AS INTEGER)
                               END                                                                 AS employee_count,
                               CASE
                                   WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                       THEN CAST(NULLIF(REGEXP_REPLACE(zi_c_year_founded, '[^0-9]', ''), '') AS INTEGER)
                                   ELSE CAST(NULLIF(REGEXP_REPLACE(efx_yrest, '[^0-9]', ''), '') AS INTEGER)
                               END                                                                 AS year_established,
                               COALESCE(CASE
                                            WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                                THEN CAST(NULLIF(REGEXP_REPLACE(zi_c_naics6, '[^0-9]', ''), '') AS INTEGER)
                                            ELSE CAST(NULLIF(REGEXP_REPLACE(efx_primnaicscode, '[^0-9]', ''), '') AS INTEGER)
                                        END,
                                        naics_code)                                                AS primary_naics_code,
                               mcc_code,
                               mcc_desc,
                               COALESCE(CASE
                                            WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                                THEN
                                                CAST(NULLIF(REGEXP_REPLACE(zi_c_revenue, '[^0-9\.]', ''), '') AS NUMERIC) *
                                                1000
                                            ELSE CASE
                                                     WHEN efx_locamount > 0 THEN efx_locamount * 1000
                                                     ELSE efx_corpamount * 1000
                                                 END
                                        END,
                                        0)                                                         AS revenue,
                               CASE
                                   WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                       THEN UPPER(zi_c_name)
                                   ELSE UPPER(efx_name)
                               END                                                                 AS company_name_firmographic,
                               CASE
                                   WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                       THEN UPPER(zi_c_company_name)
                                   ELSE UPPER(efx_legal_name)
                               END                                                                 AS legal_company_name_firmographic,
                               COALESCE(CASE
                                            WHEN serp.website_response IS NOT NULL AND serp.website_response != ''
                                                THEN serp.website_response
                                            WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                                THEN REGEXP_REPLACE(LOWER(zi_c_url), '^https?://', '')
                                            ELSE REGEXP_REPLACE(LOWER(efx_web), '^https?://', '')
                                        END,
                                        REGEXP_REPLACE(LOWER(official_website), '^https?://', '')) AS website_url,
                               zi_c_url_status                                                     AS website_status,
                               CASE
                                   WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                       THEN UPPER(zi_c_street)
                                   ELSE UPPER(efx_address)
                               END                                                                 AS address,
                               CASE
                                   WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                       THEN UPPER(zi_c_city)
                                   ELSE UPPER(efx_city)
                               END                                                                 AS city,
                               CASE
                                   WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0) THEN LEFT
                                                                                                                  (
                                           zi_c_zip,
                                           5
                                                                                                                  )
                                   ELSE CAST
                                        (
                                           efx_zipcode AS
                                       VARCHAR
                                        )
                               END                                                                 AS zipcode,
                               CASE
                                   WHEN COALESCE
                                        (
                                                zi_match_confidence,
                                                0
                                        ) > COALESCE
                                            (
                                                efx_match_confidence,
                                                0
                                            ) THEN CASE zi_c_country
                                                       WHEN 'United States' THEN 'US'
                                                       WHEN 'United States of America' THEN 'US'
                                                       ELSE zi_c_country
                                                   END
                                   ELSE CASE efx_ctryname
                                            WHEN 'United States' THEN 'US'
                                            WHEN 'United States of America' THEN 'US'
                                            ELSE efx_ctryname
                                        END
                               END                                                                 AS country,
                               CASE
                                   WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                                       THEN UPPER(zi_c_county)
                                   ELSE UPPER(efx_countynm)
                               END                                                                 AS county,
                               efx_affllinkedind                                                   AS affiliate,
                               CASE
                                   WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0) THEN CASE
                                                                                                                      WHEN COALESCE(CAST(zi_c_is_hq AS INT), 0) = 1
                                                                                                                          THEN 'Y'
                                                                                                                      ELSE 'N'
                                                                                                                  END
                                   ELSE COALESCE(efx_afflparentind, 'N')
                               END                                                                 AS affiliate_parent,
                               zi_c_linkedin_url                                                   AS linkedin_url,
                               zi_c_facebook_url                                                   AS facebook_url,
                               zi_c_twitter_url                                                    AS twitter_url,
                               zi_c_yelp_url                                                       AS yelp_url,
                               zi_c_domain_rank                                                    AS domain_rank,
                               zi_c_keywords                                                       AS keywords,
                               efx_contct                                                          AS contact,
                               efx_titlecd                                                         AS contact_title,
                               efx_titledesc                                                       AS contact_title_description,
                               efx_lastnam                                                         AS contact_last_name,
                               efx_fstnam                                                          AS contact_first_name,
                               efx_email                                                           AS contact_email,
                               CASE
                                   WHEN zi_c_is_small_business = 1 THEN 'Small Business Enterprise'
                                   ELSE efx_cert7
                               END                                                                 AS certification,
                               zi_c_num_locations                                                  AS num_locations,
                               zi_c_hr_contacts                                                    AS hr_contacts,
                               zi_c_sales_contacts                                                 AS sales_contacts,
                               zi_c_marketing_contacts                                             AS marketing_contacts,
                               zi_c_finance_contacts                                               AS finance_contacts,
                               zi_c_c_suite_contacts                                               AS c_suite_contacts,
                               zi_c_engineering_contacts                                           AS engineering_contacts,
                               zi_c_it_contacts                                                    AS it_contacts,
                               zi_c_operations_contacts                                            AS operations_contacts,
                               zi_c_legal_contacts                                                 AS legal_contacts,
                               COALESCE(smb_pr_verification_cs.officer_1_name,
                                        smb_pr_verification_cs.md_officer_1_name)                  AS officer_1_name,
                               COALESCE(smb_pr_verification_cs.officer_1_title,
                                        smb_pr_verification_cs.md_officer_1_title)                 AS officer_1_title,
                               COALESCE(smb_pr_verification_cs.officer_2_name,
                                        smb_pr_verification_cs.md_officer_2_name)                  AS officer_2_name,
                               COALESCE(smb_pr_verification_cs.officer_2_title,
                                        smb_pr_verification_cs.md_officer_2_title)                 AS officer_2_title,
                               zi_c_medical_contacts                                               AS medical_contacts,
                               review_metrics.num_business_liens                                   AS number_of_business_liens,
                               recent_lien_filing_date                                             AS most_recent_business_lien_filing_date,
                               review_metrics.recent_lien_status                                   AS most_recent_business_lien_status,
                               review_metrics.num_bankruptcies                                     AS number_of_bankruptcies,
                               review_metrics.recent_bankruptcy_filing_date                        AS most_recent_bankruptcy_filing_date,
                               review_metrics.num_judgements                                       AS number_of_judgement_fillings,
                               recent_judgement_filing_date,
                               count_of_complaint_containing_alert_words_all_time                  AS complaint_alerts,
                               percent_of_reviews_containing_alert_words_all_time                  AS review_alerts,
                               angi_review_count,
                               review_metrics.angi_review_pct                                      AS angi_review_percentage,
                               bbb_review_count,
                               review_metrics.bbb_review_pct                                       AS bbb_review_percentage,
                               google_review_count,
                               review_metrics.google_review_pct                                    AS google_review_percentage,
                               yelp_review_count,
                               review_metrics.yelp_review_pct                                      AS yelp_review_percentage,
                               healthgrades_review_count,
                               review_metrics.healthgrades_review_pct                              AS healthgrades_review_percentage,
                               vitals_review_count,
                               review_metrics.vitals_review_pct                                    AS vitals_review_percentage,
                               webmd_review_count,
                               review_metrics.webmd_review_pct                                     AS webmd_review_percentage,
                               CASE
                                   WHEN COALESCE(zi_c_ticker, efx_tcksym, '') != '' THEN 1
                                   ELSE 0
                               END                                                                 AS is_public,
                               COALESCE(zi_c_ticker, efx_tcksym, '')                               AS ticker,
                               zi_c_num_of_investors                                               AS num_of_investors,
                               zi_c_investor_names                                                 AS investor_names,
                               zi_c_funding_strength                                               AS funding_strength,
                               zi_c_funding_type                                                   AS funding_type,
                               zi_c_total_funding_amount                                           AS total_funding_amount,
                               zi_c_latest_funding_amount                                          AS latest_funding_amount,
                               zi_c_latest_funding_date                                            AS latest_funding_date,
                               zi_c_num_funding_rounds                                             AS num_funding_rounds,

                               mid,
                               vid,
                               efx_id                                                              AS efx_id,
                               zi_c_location_id                                                    AS zi_lid,
                               zi_c_company_id                                                     AS zi_cid,
                               zi_es_location_id                                                   AS zi_elid,
                               company_number                                                      AS oc_cn,
                               jurisdiction_code                                                   AS oc_jc

                           FROM datascience.smb_pr_verification_cs
                               LEFT JOIN clients.review_metrics
                                       USING (business_id)
                               LEFT JOIN warehouse.latest_score
                                       USING (business_id)
                               LEFT JOIN rds_integration_public.serp_website_phone_response_mv AS serp
                                       USING (business_id)
                           QUALIFY ROW_NUMBER() OVER (PARTITION BY business_id) = 1

        )

    SELECT DISTINCT
        business_id,
        customer_unique_identifier,
        company_name,
        created_at,
        tax_id,
        worth_score,
        company_address,
        company_city,
        company_state,
        company_postalcode,
        name_verification,
        address_verification,
        tin_verification,
        watchlist_verification,
        sos_domestic_verification,
        sos_match_verification,
        corporate_filing_business_name,
        corporate_filing_filling_date,
        corporate_filing_incorporation_state,
        corporate_filing_corporation_type,
        corporate_filing_registration_type,
        corporate_filing_secretary_of_state_status,
        corporate_filing_secretary_of_state_status_date,
        average_rating,
        total_review_count,
        match_confidence,
        sos_online_firm_coverage,
        sos_online_firm_tin_coverage,
        gov_flag,
        nonprofit_flag,
        edu_flag,
        phone_number,
        latitude,
        longitude,
        primary_naics_description,
        employee_count,
        year_established,
        primary_naics_code,
        mcc_code,
        mcc_desc,
        revenue,
        company_name_firmographic,
        legal_company_name_firmographic,
        website_url,
        website_status,
        address,
        city,
        zipcode,
        country,
        county,
        affiliate,
        affiliate_parent,
        linkedin_url,
        facebook_url,
        twitter_url,
        yelp_url,
        domain_rank,
        keywords,
        contact,
        contact_title,
        contact_title_description,
        contact_last_name,
        contact_first_name,
        contact_email,
        certification,
        num_locations,
        hr_contacts,
        sales_contacts,
        marketing_contacts,
        finance_contacts,
        c_suite_contacts,
        engineering_contacts,
        it_contacts,
        operations_contacts,
        legal_contacts,
        officer_1_name,
        officer_1_title,
        officer_2_name,
        officer_2_title,
        medical_contacts,
        number_of_business_liens,
        most_recent_business_lien_filing_date,
        most_recent_business_lien_status,
        number_of_bankruptcies,
        most_recent_bankruptcy_filing_date,
        number_of_judgement_fillings,
        recent_judgement_filing_date,
        complaint_alerts,
        review_alerts,
        angi_review_count,
        angi_review_percentage,
        bbb_review_count,
        bbb_review_percentage,
        google_review_count,
        google_review_percentage,
        yelp_review_count,
        yelp_review_percentage,
        healthgrades_review_count,
        healthgrades_review_percentage,
        vitals_review_count,
        vitals_review_percentage,
        webmd_review_count,
        webmd_review_percentage,
        is_public,
        ticker,
        num_of_investors,
        investor_names,
        funding_strength,
        funding_type,
        total_funding_amount,
        latest_funding_amount,
        latest_funding_date,
        num_funding_rounds,
        mid,
        vid,
        efx_id,
        zi_lid,
        zi_cid,
        zi_elid,
        oc_cn,
        oc_jc

    FROM initial_select;



END;
$$
