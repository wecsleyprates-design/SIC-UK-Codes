CREATE OR REPLACE PROCEDURE public.gather_customer_case_details(customer_id_input VARCHAR, cursor_name refcursor)

    LANGUAGE plpgsql
AS
$$
BEGIN
    OPEN cursor_name FOR WITH
-- Case Data
case_data AS (SELECT
                  dc.business_id AS business_id,
                  dc.id          AS case_id,
                  dc.created_at  AS submission_date,
                  dc.updated_at  AS last_decision_date,
                  cs.code        AS application_status,
                  CASE
                      WHEN cs.code = 'AUTO_APPROVED' THEN TRUE
                      ELSE FALSE
                  END            AS auto_approval
              FROM rds_cases_public.data_cases dc
                  JOIN rds_cases_public.core_case_statuses cs
                          ON dc.status = cs.id
              WHERE dc.customer_id = customer_id_input
),

-- User Data (analyst name per case)
user_data AS (SELECT
                  dc.id AS case_id,
                  NVL(du.first_name, '') ||
                  CASE
                      WHEN du.last_name IS NOT NULL THEN ' ' || du.last_name
                      ELSE ''
                  END   AS analyst_name
              FROM rds_auth_public.data_users du
                  JOIN rds_cases_public.data_cases dc
                          ON du.id = dc.assignee
              WHERE dc.customer_id = customer_id_input
),

-- Invites per case
invites AS (SELECT
                di.case_id,
                dih.created_at AS invitation_date,
                dih.created_by AS invited_by
            FROM rds_cases_public.data_invites_history dih
                JOIN rds_cases_public.data_invites di
                        ON dih.invitation_id = di.id
            WHERE dih.status = 1
),

-- Business data
business_data AS (SELECT
                      db.id         AS business_id,
                      db.name       AS business_legal_name,
                      core_mcc.code AS mcc
                  FROM rds_cases_public.data_businesses db
                      LEFT JOIN rds_cases_public.core_mcc_code core_mcc
                              ON core_mcc.id = db.mcc_id
),

-- First DBA name per business using ROW_NUMBER()
business_names_ranked AS (SELECT
                              dbn.business_id,
                              dbn.name                                                                     AS dba_name,
                              ROW_NUMBER() OVER (PARTITION BY dbn.business_id ORDER BY dbn.created_at ASC) AS rn
                          FROM rds_cases_public.data_business_names dbn
),
business_names AS (SELECT
                       business_id,
                       dba_name
                   FROM business_names_ranked
                   WHERE rn = 1
),

-- Score service data
score_data AS (SELECT
                   sdc.id                AS case_id,
                   bs.risk_level,
                   bs.weighted_score_850 AS worth_score,
                   sdc.score_trigger_id
               FROM rds_manual_score_public.data_cases sdc
                   JOIN rds_manual_score_public.business_scores bs
                           ON sdc.score_trigger_id = bs.score_trigger_id
),

-- Integration transaction average size
integration_txn AS (SELECT
                        cd.case_id,
                        AVG(bat.amount) AS transaction_size
                    FROM rds_integration_data.bank_account_transactions bat
                        JOIN rds_integration_integrations.data_business_integrations_tasks dbit
                                ON bat.business_integration_task_id = dbit.id
                        JOIN rds_integration_integrations.data_connections dc
                                ON dbit.connection_id = dc.id
                        JOIN case_data cd
                                ON cd.business_id = dc.business_id
                    GROUP BY
                        cd.case_id
),

-- Integration processing volume
integration_proc AS (SELECT
                         case_id,
                         JSON_EXTRACT_PATH_TEXT(general_data, 'monthly_volume') AS monthly_volume,
                         JSON_EXTRACT_PATH_TEXT(general_data, 'annual_volume')  AS annual_volume
                     FROM rds_integration_data.data_processing_history
),

-- First status history record per case using ROW_NUMBER()
onboarding_ranked AS (SELECT
                          case_id,
                          created_at                                                       AS onboarding_date_time,
                          ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY created_at ASC) AS rn
                      FROM rds_cases_public.data_case_status_history
),
onboarding AS (SELECT
                   case_id,
                   onboarding_date_time
               FROM onboarding_ranked
               WHERE rn = 1
)

-- Final SELECT
                         SELECT
                             *
                         FROM (SELECT
                                   cd.business_id,
                                   cd.case_id,
                                   cd.submission_date,
                                   i.invitation_date,
                                   i.invited_by,
                                   bd.business_legal_name,
                                   bn.dba_name,
                                   bd.mcc,
                                   ''                                                                        AS mid,
                                   sd.risk_level,
                                   it.transaction_size,
                                   ip.monthly_volume,
                                   ip.annual_volume,
                                   cd.application_status,
                                   ''                                                                        AS application_reason_code,
                                   ud.analyst_name,
                                   sd.worth_score,
                                   cd.last_decision_date,
                                   ob.onboarding_date_time,
                                   cd.auto_approval,
                                   ROW_NUMBER()
                                   OVER (PARTITION BY cd.case_id ORDER BY i.invitation_date DESC NULLS LAST) AS rn
                               FROM case_data cd
                                   LEFT JOIN user_data ud
                                           ON ud.case_id = cd.case_id
                                   LEFT JOIN invites i
                                           ON i.case_id = cd.case_id
                                   LEFT JOIN business_data bd
                                           ON bd.business_id = cd.business_id
                                   LEFT JOIN business_names bn
                                           ON bn.business_id = cd.business_id
                                   LEFT JOIN score_data sd
                                           ON sd.case_id = cd.case_id
                                   LEFT JOIN integration_txn it
                                           ON it.case_id = cd.case_id
                                   LEFT JOIN integration_proc ip
                                           ON ip.case_id = cd.case_id
                                   LEFT JOIN onboarding ob
                                           ON ob.case_id = cd.case_id
                         ) AS deduped
                         WHERE rn = 1;
END
$$;
