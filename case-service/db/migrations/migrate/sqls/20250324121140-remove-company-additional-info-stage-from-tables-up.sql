-- Step 1: Handle the foreign key constraint by deleting from `rel_onboarding_stage_type` table
DELETE FROM onboarding_schema.rel_onboarding_stage_type
WHERE onboarding_type_id = 1
AND stage_id = (SELECT id FROM onboarding_schema.core_onboarding_stages WHERE code = 'company_additional_info');


-- Step 2: Fetch the IDs of the current stage and its neighboring stages
WITH stage_to_remove AS (
  SELECT id, prev_stage, next_stage, priority_order
  FROM onboarding_schema.core_onboarding_stages
  WHERE code = 'company_additional_info'
),
updated_links AS (
  -- Step 3: Update the previous stage's next_stage to point to the correct next stage
  UPDATE onboarding_schema.core_onboarding_stages
  SET next_stage = (SELECT next_stage FROM stage_to_remove)
  WHERE id = (SELECT prev_stage FROM stage_to_remove)
  RETURNING id
),
update_next_stage AS (
  -- Step 4: Update the next stage's prev_stage to point to the correct previous stage
  UPDATE onboarding_schema.core_onboarding_stages
  SET prev_stage = (SELECT prev_stage FROM stage_to_remove)
  WHERE id = (SELECT next_stage FROM stage_to_remove)
  RETURNING id
),
delete_stage AS (
  -- Step 5: Delete the `company_additional_info` stage
  DELETE FROM onboarding_schema.core_onboarding_stages
  WHERE id = (SELECT id FROM stage_to_remove)
  RETURNING priority_order
)
-- Step 6: Adjust priority_order of remaining stages
UPDATE onboarding_schema.core_onboarding_stages
SET priority_order = priority_order - 1
WHERE priority_order > (SELECT priority_order FROM delete_stage);


-- Step 7: Handle `data_customer_onboarding_stages` for all customers
WITH customer_stage_to_remove AS (
  SELECT customer_id, id, prev_stage, next_stage, priority_order
  FROM onboarding_schema.data_customer_onboarding_stages
  WHERE stage_code = 'company_additional_info'
),
customer_updated_links AS (
  -- Step 8: Update the previous stage's next_stage to point to the correct next_stage, for each customer
  UPDATE onboarding_schema.data_customer_onboarding_stages c
  SET next_stage = cs.next_stage
  FROM customer_stage_to_remove cs
  WHERE c.id = cs.prev_stage AND c.customer_id = cs.customer_id
),
customer_update_next_stage AS (
  -- Step 9: Update the next stage's prev_stage to point to the correct prev_stage, for each customer
  UPDATE onboarding_schema.data_customer_onboarding_stages c
  SET prev_stage = cs.prev_stage
  FROM customer_stage_to_remove cs
  WHERE c.id = cs.next_stage AND c.customer_id = cs.customer_id
),
customer_delete_customer_stage AS (
  -- Step 10: Delete `company_additional_info` for all customers
  DELETE FROM onboarding_schema.data_customer_onboarding_stages
  WHERE stage_code = 'company_additional_info'
  RETURNING customer_id, priority_order
)
-- Step 11: Adjust the priority_order for the remaining stages, for each customer
UPDATE onboarding_schema.data_customer_onboarding_stages c
SET priority_order = c.priority_order - 1
FROM customer_delete_customer_stage d
WHERE c.customer_id = d.customer_id AND c.priority_order > d.priority_order;
