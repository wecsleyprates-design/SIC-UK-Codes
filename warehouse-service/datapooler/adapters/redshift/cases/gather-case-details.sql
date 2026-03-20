CREATE OR REPLACE PROCEDURE public.gather_case_details(case_id_input VARCHAR, cursor_name refcursor)

    LANGUAGE plpgsql
AS
$$
BEGIN
    OPEN cursor_name FOR
        WITH
            case_data AS (SELECT
                              dc.business_id AS case_business_id,
                              dc.id          AS case_id,
                              dc.created_at  AS submission_date,
                              dc.assignee    AS analyst_name,
                              dc.updated_at  AS last_decision_date,
                              cs.code        AS application_status,
                              CASE
                                  WHEN cs.code = 'AUTO_APPROVED' THEN TRUE
                                  ELSE FALSE
                              END            AS auto_approval
                          FROM rds_cases_public.data_cases dc
                              JOIN rds_cases_public.core_case_statuses cs
                                      ON dc.status = cs.id
                          WHERE dc.id = case_id_input
            ),
            invites AS (SELECT
                            dih.created_at AS invitation_date,
                            dih.created_by AS invited_by
                        FROM rds_cases_public.data_invites_history dih
                            JOIN rds_cases_public.data_invites di
                                    ON dih.invitation_id = di.id
                        WHERE di.case_id = case_id_input
                          AND dih.status = 1
            ),
            business_data AS (SELECT
                                  db.name       AS legal_name,
                                  mcc_code.code AS mcc
                              FROM rds_cases_public.data_businesses db
                                  LEFT JOIN rds_cases_public.core_mcc_code AS mcc_code
                                          ON db.mcc_id = mcc_code.id
                              WHERE db.id = (SELECT case_business_id FROM case_data)

            ),
            business_names AS (SELECT
                                   dbn.name AS dba_name
                               FROM rds_cases_public.data_business_names dbn
                               WHERE dbn.business_id = (SELECT case_business_id FROM case_data)
                               LIMIT 1
            ),
-- Score service data
            score_data AS (SELECT
                               bs.risk_level,
                               bs.weighted_score_850 AS worth_score,
                               sdc.score_trigger_id
                           FROM rds_manual_score_public.data_cases sdc
                               JOIN rds_manual_score_public.business_scores bs
                                       ON sdc.score_trigger_id = bs.id
                           WHERE sdc.id = case_id_input
            ),
-- Integration service data
            integration_txn AS (SELECT
                                    AVG(bat.amount) AS transaction_size
                                FROM rds_integration_data.bank_account_transactions bat
                                    JOIN rds_integration_integrations.data_business_integrations_tasks dbit
                                            ON bat.business_integration_task_id = dbit.id
                                    JOIN rds_integration_integrations.data_connections dc
                                            ON dbit.connection_id = dc.id
                                WHERE dc.business_id = (SELECT case_business_id FROM case_data)
            ),
            integration_proc AS (SELECT
                                     JSON_EXTRACT_PATH_TEXT(general_data, 'monthly_volume') AS monthly_volume,
                                     JSON_EXTRACT_PATH_TEXT(general_data, 'annual_volume')  AS annual_volume
                                 FROM rds_integration_data.data_processing_history
                                 WHERE case_id = case_id_input
            ),
-- Status history
            onboarding AS (SELECT
                               created_at AS onboarding_date_time
                           FROM rds_cases_public.data_case_status_history
                           WHERE case_id = case_id_input
                           ORDER BY
                               created_at
            )
-- Final SELECT
        SELECT
            cd.case_business_id,
            cd.case_id,
            cd.submission_date,
            i.invitation_date,
            i.invited_by,
            bd.legal_name,
            bn.dba_name,
            bd.mcc,
            sd.risk_level,
            it.transaction_size,
            ip.monthly_volume,
            ip.annual_volume,
            cd.application_status,
            cd.analyst_name,
            sd.worth_score,
            cd.last_decision_date,
            ob.onboarding_date_time,
            cd.auto_approval,
            '' AS mid,
            '' AS application_reason_code
        FROM case_data cd
            LEFT JOIN invites i
                    ON TRUE
            LEFT JOIN business_data bd
                    ON TRUE
            LEFT JOIN business_names bn
                    ON TRUE
            LEFT JOIN score_data sd
                    ON TRUE
            LEFT JOIN integration_txn it
                    ON TRUE
            LEFT JOIN integration_proc ip
                    ON TRUE
            LEFT JOIN onboarding ob
                    ON TRUE;
END
$$;
BEGIN;
