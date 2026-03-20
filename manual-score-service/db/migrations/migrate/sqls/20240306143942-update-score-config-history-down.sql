DELETE FROM score_config_history
WHERE id = 'c2c620a0-4e21-4008-b9c1-d6b1db50de74'
AND EXISTS (
    SELECT 1
    FROM score_config_history
    WHERE id = 'c2c620a0-4e21-4008-b9c1-d6b1db50de74'
);
