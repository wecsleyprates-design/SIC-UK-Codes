UPDATE data_cases
SET    status = (SELECT id
                 FROM   core_case_statuses
                 WHERE  code = 'UNDER_MANUAL_REVIEW')
WHERE  id IN (SELECT dc.id
              FROM   data_cases AS dc
                     LEFT JOIN core_case_types AS cct
                            ON cct.id = dc.case_type
                     LEFT JOIN core_case_statuses AS ccs
                            ON ccs.id = dc.status
              WHERE  cct.code = 'risk'
                     AND ccs.code = 'RISK_ALERT');
                     
DELETE FROM core_case_statuses WHERE id IN (14, 15, 16, 17, 18);