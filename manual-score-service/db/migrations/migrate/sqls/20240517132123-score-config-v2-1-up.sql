-- inserting new id's based on v2.1
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (14, 'JUDGEMENTS_AND_LIENS_AI_PLACEHOLDER', 'Judgements and Liens', 2, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (15, 'SOCIAL_REVIEWS_AI_PLACEHOLDER', 'Social Reviews', 2, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (16, 'BANKRUPTCIES_AI_PLACEHOLDER', 'Bankruptcies', 2, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (17, 'CREDIT_BUREAU_AI_PLACEHOLDER', 'Credit Bureau', 5, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (18, 'ECONOMICS_AI_PLACEHOLDER', 'Economics', 6, false, null, 0);


-- 2 => PUBLIC_RECORDS
-- 5 => COMPANY_PROFILE
-- 6 => FINANCIAL_TRENDS
INSERT INTO score_config_history(id, score_config)
SELECT '32e97f95-794f-49d4-b853-506cb2d1c7f6', json_agg(categories)
FROM (
    SELECT score_categories.*, factors
    FROM score_categories
    LEFT JOIN (
        SELECT category_id , json_agg(score_category_factors) as factors
        FROM score_category_factors
        WHERE score_category_factors.id IN (14, 15, 16, 17, 18)
        GROUP BY category_id
    ) as factors ON factors.category_id = score_categories.id
    WHERE score_categories.id IN (2, 5, 6)
) categories;

