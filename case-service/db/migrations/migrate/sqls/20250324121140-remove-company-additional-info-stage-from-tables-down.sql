-- Step 1: Fetch the IDs of the `company` stage, its current next stage, and its priority_order
WITH fetch_stage_ids AS (
  SELECT id AS company_id, next_stage AS next_stage_id, priority_order AS company_priority
  FROM onboarding_schema.core_onboarding_stages
  WHERE code = 'company'
),
increment_priority_order AS (
  -- Step 2: Increment priority_order for all subsequent stages to make space for `company_additional_info`
  UPDATE onboarding_schema.core_onboarding_stages
  SET priority_order = priority_order + 1
  WHERE priority_order > (SELECT company_priority FROM fetch_stage_ids)
),
insert_company_additional_info AS (
  -- Step 3: Insert `company_additional_info` back into `core_onboarding_stages`
  INSERT INTO onboarding_schema.core_onboarding_stages
  (id, stage, completion_weightage, allow_back_nav, is_skippable, is_enabled, next_stage, prev_stage, priority_order, code, is_removable, is_orderable)
  VALUES (
    (SELECT MAX(id) + 1 FROM onboarding_schema.core_onboarding_stages),  -- Generate a new ID
    'Company Additional Info', 5, true, false, true,
    (SELECT next_stage_id FROM fetch_stage_ids),  -- Set the correct next_stage (original next stage of `company`)
    (SELECT company_id FROM fetch_stage_ids),     -- prev_stage = `company`
    (SELECT company_priority + 1 FROM fetch_stage_ids),  -- priority_order is incremented by 1
    'company_additional_info', false, false
  )
  RETURNING id AS company_additional_info_id, next_stage AS next_stage_after
),
update_next_stage_of_following_stage AS (
  -- Step 4: Update the `prev_stage` of the stage that originally followed `company`
  UPDATE onboarding_schema.core_onboarding_stages
  SET prev_stage = (SELECT company_additional_info_id FROM insert_company_additional_info)
  WHERE id = (SELECT next_stage_after FROM insert_company_additional_info)
)
-- Step 5: Update the `next_stage` of the `company` stage to point to `company_additional_info`
UPDATE onboarding_schema.core_onboarding_stages
SET next_stage = (SELECT company_additional_info_id FROM insert_company_additional_info)
WHERE id = (SELECT company_id FROM fetch_stage_ids);

-- Step 6: Reinsert entry in `rel_onboarding_stage_type`
INSERT INTO onboarding_schema.rel_onboarding_stage_type (onboarding_type_id, stage_id)
SELECT 1, id
FROM onboarding_schema.core_onboarding_stages
WHERE code = 'company_additional_info';

-- Step 7: Handle reinsertion of `company_additional_info` for all customers
WITH fetch_customer_stage AS (
  SELECT customer_id, id AS company_id, next_stage, priority_order
  FROM onboarding_schema.data_customer_onboarding_stages
  WHERE stage_code = 'company'
),
increment_customer_priority AS (
  -- Increment priority_order for all subsequent customer stages
  UPDATE onboarding_schema.data_customer_onboarding_stages c
  SET priority_order = c.priority_order + 1
  FROM fetch_customer_stage f
  WHERE c.priority_order > f.priority_order AND c.customer_id = f.customer_id
),
insert_customer_stage AS (
  -- Insert `company_additional_info` for all customers with correct prev_stage and next_stage
  INSERT INTO onboarding_schema.data_customer_onboarding_stages
  (customer_id, "version", stage, stage_code, completion_weightage, allow_back_nav, is_skippable, is_enabled, is_removable, is_orderable, next_stage, prev_stage, priority_order, created_at, created_by, updated_at, updated_by)
  SELECT
    f.customer_id, 1, 'Company Additional Info', 'company_additional_info',
    5, true, false, true, false, false,
    f.next_stage, f.company_id,  -- next_stage and prev_stage based on stored values
    f.priority_order + 1,
    NOW(), 'e9d43901-3fc6-4ee9-97be-74cd23b39aa0', NOW(), 'e9d43901-3fc6-4ee9-97be-74cd23b39aa0'
  FROM fetch_customer_stage f
  RETURNING customer_id, id AS new_stage_id, next_stage AS next_stage_after
),
update_following_customer_stage AS (
  -- Step 8: Update the `prev_stage` of the stage that originally followed `company`
  UPDATE onboarding_schema.data_customer_onboarding_stages c
  SET prev_stage = i.new_stage_id
  FROM insert_customer_stage i
  WHERE c.id = i.next_stage_after AND c.customer_id = i.customer_id
)
-- Step 9: Update the `next_stage` of `company` to point to `company_additional_info`
UPDATE onboarding_schema.data_customer_onboarding_stages c
SET next_stage = i.new_stage_id
FROM insert_customer_stage i
WHERE c.stage_code = 'company' AND c.customer_id = i.customer_id;
