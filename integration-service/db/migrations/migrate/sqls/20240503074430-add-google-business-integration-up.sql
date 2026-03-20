UPDATE integrations.core_integrations_platforms
SET 
  code = 'google_places_reviews',
  label = 'Google Places Reviews'
WHERE code = 'google_reviews';

INSERT INTO integrations.core_integrations_platforms
(id, code, label, category_id) 
VALUES (20, 'google_business_reviews', 'Google Business Reviews', 5);

INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id) values (46,14,20) on conflict do nothing;