CREATE OR REPLACE PROCEDURE sp_truncate_and_insert_review_metrics()
    LANGUAGE plpgsql
AS
$$
BEGIN
    -- Start by truncating the table
    DROP TABLE IF EXISTS clients.review_metrics;

    -- Insert the data into the table
    CREATE TABLE clients.review_metrics DISTKEY ( business_id ) AS
    WITH
        public_records_cte AS (SELECT DISTINCT
                                   dc.business_id                                                                                                           AS business_id,
                                   pr.corporate_filing_business_name,
                                   FIRST_VALUE(pr.number_of_business_liens IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS num_business_liens,
                                   FIRST_VALUE(pr.most_recent_business_lien_filing_date IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS recent_lien_filing_date,
                                   FIRST_VALUE(pr.most_recent_business_lien_status IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS recent_lien_status,
                                   FIRST_VALUE(pr.number_of_bankruptcies IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS num_bankruptcies,
                                   FIRST_VALUE(pr.most_recent_bankruptcy_filing_date IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS recent_bankruptcy_filing_date,
                                   FIRST_VALUE(pr.number_of_judgement_fillings IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS num_judgements,
                                   FIRST_VALUE(pr.most_recent_judgement_filling_date IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS recent_judgement_filing_date,
                                   FIRST_VALUE(pr.average_rating IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS avg_rating,
                                   FIRST_VALUE(pr.angi_review_count IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS angi_review_count,
                                   FIRST_VALUE(pr.angi_review_percentage IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS angi_review_pct,
                                   FIRST_VALUE(pr.bbb_review_count IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS bbb_review_count,
                                   FIRST_VALUE(pr.bbb_review_percentage IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS bbb_review_pct,
                                   FIRST_VALUE(pr.google_review_count IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS google_review_count,
                                   FIRST_VALUE(pr.google_review_percentage IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS google_review_pct,
                                   FIRST_VALUE(pr.yelp_review_count IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS yelp_review_count,
                                   FIRST_VALUE(pr.yelp_review_percentage IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS yelp_review_pct,
                                   FIRST_VALUE(pr.healthgrades_review_count IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS healthgrades_review_count,
                                   FIRST_VALUE(pr.healthgrades_review_percentage IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS healthgrades_review_pct,
                                   FIRST_VALUE(pr.vitals_review_count IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS vitals_review_count,
                                   FIRST_VALUE(pr.vitals_review_percentage IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS vitals_review_pct,
                                   FIRST_VALUE(pr.webmd_review_count IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS webmd_review_count,
                                   FIRST_VALUE(pr.webmd_review_percentage IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS webmd_review_pct,
                                   FIRST_VALUE(pr.monthly_rating IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS monthly_rating,
                                   FIRST_VALUE(pr.monthly_rating_date IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS monthly_rating_date,
                                   FIRST_VALUE(pr.official_website IGNORE NULLS)
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)  AS official_website,
                                   ROW_NUMBER()
                                   OVER (PARTITION BY dc.business_id ORDER BY pr.created_at DESC)                                                           AS rn
                               FROM rds_integration_data.public_records pr
                                   LEFT JOIN rds_integration_integrations.data_business_integrations_tasks dbit
                                           ON pr.business_integration_task_id = dbit.id
                                   LEFT JOIN rds_integration_integrations.data_connections dc
                                           ON dbit.connection_id = dc.id
        ),
        industry_cte AS (SELECT DISTINCT
                             db.id                                                                                                           AS business_id,
                             FIRST_VALUE(iid.name IGNORE NULLS)
                             OVER (PARTITION BY db.id ORDER BY db.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS industry_name,
                             FIRST_VALUE(nid.code IGNORE NULLS)
                             OVER (PARTITION BY db.id ORDER BY db.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS naics_code,
                             FIRST_VALUE(nid.label IGNORE NULLS)
                             OVER (PARTITION BY db.id ORDER BY db.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS naics_desc,
                             FIRST_VALUE(mid.code IGNORE NULLS)
                             OVER (PARTITION BY db.id ORDER BY db.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS mcc_code,
                             FIRST_VALUE(mid.label IGNORE NULLS)
                             OVER (PARTITION BY db.id ORDER BY db.created_at DESC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING ) AS mcc_desc,
                             ROW_NUMBER()
                             OVER (PARTITION BY db.id ORDER BY db.created_at DESC)                                                           AS rn
                         FROM rds_cases_public.data_businesses db
                             LEFT JOIN rds_cases_public.core_business_industries iid
                                     ON db.industry = iid.id
                             LEFT JOIN rds_cases_public.core_naics_code nid
                                     ON db.naics_id = nid.id
                             LEFT JOIN rds_cases_public.core_mcc_code mid
                                     ON db.mcc_id = mid.id
        )
    SELECT DISTINCT
        bev.business_id        AS business_id,
        reg.name               AS corp_filing_business_name,
        bev.formation_date     AS corp_filing_filing_date,
        reg.registration_state AS corp_filing_incorporation_state,
        reg.entity_type        AS corp_filing_corp_type,
        reg.jurisdiction       AS corp_filing_reg_type,
        reg.status             AS corp_filing_sos_status,
        reg.registration_date  AS corp_filing_sos_status_date,
        pr2.num_business_liens,
        pr2.recent_lien_filing_date,
        pr2.recent_lien_status,
        pr2.num_bankruptcies,
        pr2.recent_bankruptcy_filing_date,
        pr2.num_judgements,
        pr2.recent_judgement_filing_date,
        pr2.avg_rating,
        pr2.angi_review_count,
        pr2.angi_review_pct,
        pr2.bbb_review_count,
        pr2.bbb_review_pct,
        pr2.google_review_count,
        pr2.google_review_pct,
        pr2.yelp_review_count,
        pr2.yelp_review_pct,
        pr2.healthgrades_review_count,
        pr2.healthgrades_review_pct,
        pr2.vitals_review_count,
        pr2.vitals_review_pct,
        pr2.webmd_review_count,
        pr2.webmd_review_pct,
        pr2.monthly_rating,
        pr2.monthly_rating_date,
        pr2.official_website,
        ind.industry_name,
        ind.naics_code,
        ind.naics_desc,
        ind.mcc_code,
        ind.mcc_desc,
        CURRENT_TIMESTAMP      AS processed_at
    FROM (SELECT * FROM public_records_cte WHERE rn = 1) AS pr2
        LEFT JOIN rds_integration_data.business_entity_verification bev
                USING (business_id)
        LEFT JOIN rds_integration_data.business_entity_registration reg
                ON reg.business_entity_verification_id = bev.id
            AND reg.registration_state = bev.formation_state
        LEFT JOIN (SELECT * FROM industry_cte WHERE rn = 1) ind
                ON bev.business_id = ind.business_id;
END;
$$;
