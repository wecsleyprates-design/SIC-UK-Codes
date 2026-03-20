--- Insert the new score categories for ai score
INSERT INTO score_categories (id, code, label, is_deleted, total_weightage) 
  VALUES 
       (4, 'BUSINESS_OPERATIONS', 'Business Operations', false, 0), 
       (5, 'COMPANY_PROFILE', 'Company Profile', false, 0), 
       (6, 'FINANCIAL_TRENDS', 'Financial Trends', false, 0), 
       (7, 'LIQUIDITY', 'Liquidity', false, 0);

--- Insert the new score factors for ai score
INSERT INTO score_category_factors (id, code, label, category_id, is_deleted, parent_factor_id, weightage) 
  VALUES
       (10, 'BUSINESS_OPERATIONS_AI_PLACEHOLDER', 'Business Operations AI Placeholder', 4, false, null, 0), 
       (11, 'COMPANY_PROFILE_AI_PLACEHOLDER', 'Company Profile AI Placeholder', 5, false, null, 0), 
       (12, 'FINANCIAL_TRENDS_AI_PLACEHOLDER', 'Financial Trends AI Placeholder', 6, false, null, 0), 
       (13, 'LIQUIDITY_AI_PLACEHOLDER', 'Liquidity AI Placeholder', 7, false, null, 0);