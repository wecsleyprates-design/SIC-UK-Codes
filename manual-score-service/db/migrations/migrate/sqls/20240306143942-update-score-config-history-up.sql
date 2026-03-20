INSERT INTO score_config_history(id, score_config)
SELECT 'c2c620a0-4e21-4008-b9c1-d6b1db50de74', json_agg(categories)
FROM (
    SELECT score_categories.*, factors
    FROM score_categories
    LEFT JOIN (
        SELECT category_id , json_agg(score_category_factors) as factors
        FROM score_category_factors
        GROUP BY category_id
    ) as factors ON factors.category_id = score_categories.id
    WHERE score_categories.id NOT IN (1, 2, 3)
) categories;
