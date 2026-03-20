-- inserting new id's based on v2.2
-- dropping triggers
DROP TRIGGER IF EXISTS update_score_config_history_2 ON score_category_factors;
DROP TRIGGER IF EXISTS update_score_config_history ON score_categories;


-- inserting new category
INSERT INTO score_categories (id, code, label, is_deleted, total_weightage)
VALUES (8, 'PERFORMANCE_MEASURES', 'Performance Measures', false, 0);

-- Financial trends sub-category
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (19, 'LIQUIDITY_RATIOS_AI_PLACEHOLDER', 'Liquidity Ratios', 6, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (20, 'SOLVENCY_RATIOS_AI_PLACEHOLDER', 'Solvency Ratio', 6, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (21, 'EFFICIENCY_RATIOS_AI_PLACEHOLDER', 'Efficiency Ratio', 6, false, null, 0);

-- Performace measures sub-category
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (22, 'PROFITABILITY_RATIOS_AI_PLACEHOLDER', 'Profitability Ratio', 8, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (23, 'VALUATION_RATIOS_AI_PLACEHOLDER', 'Valuation Ratio', 8, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (24, 'FINANCIAL_RISKS_AI_PLACEHOLDER', 'Financial Risks', 8, false, null, 0);

-- Business operations sub-category
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (25, 'PROFIT_AND_LOSS_AI_PLACEHOLDER', 'Profit and Loss', 4, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (26, 'CASH_FLOW_AI_PLACEHOLDER', 'Cash Flow', 4, false, null, 0);
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) VALUES (27, 'BALANCE_SHEET_AI_PLACEHOLDER', 'Balance Sheet', 4, false, null, 0);


INSERT INTO score_config_history(id, score_config)
SELECT '3d790145-0b4a-4de7-969a-d118123123bc', json_agg(categories)
FROM (
    SELECT score_categories.*, factors
    FROM score_categories
    LEFT JOIN (
        SELECT category_id , json_agg(score_category_factors) as factors
        FROM score_category_factors
        WHERE score_category_factors.id BETWEEN 14 AND 27
        GROUP BY category_id
    ) as factors ON factors.category_id = score_categories.id
    WHERE score_categories.id IN (2, 4, 5, 6, 8)
) categories;

