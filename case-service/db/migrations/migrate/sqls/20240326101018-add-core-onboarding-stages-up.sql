CREATE TABLE core_onboarding_stages (
    id INT PRIMARY KEY,
    stage VARCHAR(50) NOT NULL,
    completion_weightage INT NULL,
    allow_back_nav BOOLEAN NOT NULL DEFAULT TRUE,
    is_skippable BOOLEAN NOT NULL DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    next_stage INT NULL,
    prev_stage INT NULL,
    priority_order INT
);

INSERT INTO public.core_onboarding_stages (id, stage, completion_weightage, allow_back_nav, is_skippable, is_enabled, next_stage, prev_stage, priority_order) VALUES
    (1, 'company', 15, false, false, true, 2, NULL, 1),
    (2, 'company additional info', 5, true, true, true, 3, 1, 2),
    (3, 'banking', 20, true, false, true, 4, 2, 3),
    (4, 'ownership', 20, true, false, true, 5, 3, 4),
    (5, 'accounting', 20, true, false, true, 6, 4, 5),
    (6, 'tax consent', 20, true, true, true, 7, 5, 6),
    (7, 'review', 0, true, false, true, NULL, 6, 7);
