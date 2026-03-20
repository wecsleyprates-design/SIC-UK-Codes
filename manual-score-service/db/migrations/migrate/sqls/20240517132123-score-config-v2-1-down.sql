-- Drop config_history_value
DELETE FROM score_config_history
WHERE id = '32e97f95-794f-49d4-b853-506cb2d1c7f6'
AND EXISTS (
    SELECT 1
    FROM score_config_history
    WHERE id = '32e97f95-794f-49d4-b853-506cb2d1c7f6'
);

-- Drop newly added rows
DELETE FROM score_category_factors WHERE code IN ('JUDGEMENTS_AND_LIENS_AI_PLACEHOLDER', 'SOCIAL_REVIEWS_AI_PLACEHOLDER', 'BANKRUPTCIES_AI_PLACEHOLDER', 'CREDIT_BUREAU_AI_PLACEHOLDER', 'ECONOMICS_AI_PLACEHOLDER');
