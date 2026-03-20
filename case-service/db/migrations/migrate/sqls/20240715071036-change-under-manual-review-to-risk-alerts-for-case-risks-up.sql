INSERT INTO core_case_statuses (id, code, label) VALUES
    (14, 'RISK_ALERT','RISK ALERT'),
    (15, 'INVESTIGATING','INVESTIGATING'),
    (16, 'DISMISSED','DISMISSED'),
    (17, 'ESCALATED','ESCALATED'),
    (18, 'PAUSED','PAUSED');
     
UPDATE data_cases
SET    status = (SELECT id
                 FROM   core_case_statuses
                 WHERE  code = 'RISK_ALERT')
WHERE  id IN (SELECT dc.id
              FROM   data_cases AS dc
                     LEFT JOIN core_case_types AS cct
                            ON cct.id = dc.case_type
                     LEFT JOIN core_case_statuses AS ccs
                            ON ccs.id = dc.status
              WHERE  cct.code = 'risk'
                     AND ccs.code = 'UNDER_MANUAL_REVIEW'); 