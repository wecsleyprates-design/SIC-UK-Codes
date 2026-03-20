--- Delete google business reviews from rel_tasks_integrations
DELETE FROM integrations.rel_tasks_integrations WHERE id = 46;

--- Delete google business reviews from core_integration_platforms
DELETE FROM integrations.core_integrations_platforms WHERE code = 'google_business_reviews';

--- Revert the platform name to google_reviews
UPDATE integrations.core_integrations_platforms
SET 
  code = 'google_reviews',
  label = 'Google Places Reviews'
WHERE code = 'google_places_reviews';
