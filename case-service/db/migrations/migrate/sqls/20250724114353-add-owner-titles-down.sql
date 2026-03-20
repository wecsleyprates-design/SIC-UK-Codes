-- Remove newly inserted titles from core_owner_titles

DELETE FROM core_owner_titles
WHERE id BETWEEN 22 AND 38;