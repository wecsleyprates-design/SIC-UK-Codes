-- Drop config_history_value
DELETE FROM score_config_history
WHERE id = '3d790145-0b4a-4de7-969a-d118123123bc'
AND EXISTS (
    SELECT 1
    FROM score_config_history
    WHERE id = '3d790145-0b4a-4de7-969a-d118123123bc'
);

-- Drop newly added rows
DELETE FROM score_category_factors WHERE id BETWEEN 19 AND 27;

DELETE FROM score_categories WHERE id = 8;

CREATE TRIGGER update_score_config_history
AFTER UPDATE OR INSERT ON score_categories
FOR EACH STATEMENT
EXECUTE FUNCTION capture_score_config();

CREATE TRIGGER update_score_config_history_2
AFTER UPDATE OR INSERT ON score_category_factors
FOR EACH STATEMENT
EXECUTE FUNCTION capture_score_config();

