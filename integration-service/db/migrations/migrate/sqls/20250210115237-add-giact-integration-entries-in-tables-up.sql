-- Insert a new integration platform for GIACT under the 'banking' category
INSERT INTO integrations.core_integrations_platforms (id, code, label, category_id)
VALUES (
    '26',  -- Unique ID for the GIACT platform
    'giact',  -- Code representing the platform
    'GIACT',  -- Human-readable label
    (SELECT id FROM integrations.core_categories WHERE code = 'banking')  
    -- Fetch category_id dynamically where core_categories.code = 'banking'
);

-- Insert a new task definition for fetching bank verification via GIACT
INSERT INTO integrations.core_tasks (id, code, label)
VALUES (
    '20',  -- Unique ID for the task
    'fetch_giact_verification',  -- Code representing the task
    'Fetch GIACT Verification'  -- Human-readable label
);

-- Associate the newly created task with the GIACT platform
INSERT INTO integrations.rel_tasks_integrations (id, task_category_id, platform_id)
VALUES (
    '61',  -- Unique ID for this task-platform association
    '20',  -- References the task 'fetch_giact_verification'
    '26'   -- References the platform 'giact'
);
