-- Integration groups (e.g. for grouping rel_tasks_integrations)
CREATE TABLE integrations.core_integration_groups (
    id smallint PRIMARY KEY,
    name varchar(255) NOT NULL UNIQUE
);

-- Association: which integration tasks belong to which group
CREATE TABLE integrations.rel_integration_integration_groups (
    integration_group smallint NOT NULL,
    integration_task integer NOT NULL,
    PRIMARY KEY (integration_group, integration_task),
    CONSTRAINT fk_integration_group FOREIGN KEY (integration_group)
        REFERENCES integrations.core_integration_groups (id) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_integration_task FOREIGN KEY (integration_task)
        REFERENCES integrations.rel_tasks_integrations (id) ON DELETE CASCADE ON UPDATE RESTRICT
);

COMMENT ON TABLE integrations.core_integration_groups IS 'Named groups for grouping integration tasks';
COMMENT ON TABLE integrations.rel_integration_integration_groups IS 'Links integration groups to rel_tasks_integrations (task-platform pairs)';

INSERT INTO integrations.core_integration_groups (id, name) VALUES (1, 'Watchlists / Sanctions');
INSERT INTO integrations.core_integration_groups (id, name) VALUES (2, 'Website Scan');
INSERT INTO integrations.core_integration_groups (id, name) VALUES (3, 'Bank Verification');
INSERT INTO integrations.core_integration_groups (id, name) VALUES (4, 'Identity Verification');
INSERT INTO integrations.core_integration_groups (id, name) VALUES (5, 'Bankruptcies, Judgements, and Liens (BJL)');
INSERT INTO integrations.core_integration_groups (id, name) VALUES (6, 'Registry Filings');
INSERT INTO integrations.core_integration_groups (id, name) VALUES (7, 'Reviews');

-- Watchlist / Sanctions: Trulioo & Middesk
INSERT INTO integrations.rel_integration_integration_groups (integration_group, integration_task) VALUES (1, 42), (1, 78);
-- Website Scan: Middesk & Inhouse
INSERT INTO integrations.rel_integration_integration_groups (integration_group, integration_task) VALUES (2, 47), (2, 65);
-- Bank Verification: GIact
INSERT INTO integrations.rel_integration_integration_groups (integration_group, integration_task) VALUES (3, 61);
-- Identity Verification: KYX & Plaid IDV
INSERT INTO integrations.rel_integration_integration_groups (integration_group, integration_task) VALUES (4, 43), (4, 81);
-- Bankruptcies, Judgements, and Liens (BJL): Equifax & Verdata
INSERT INTO integrations.rel_integration_integration_groups (integration_group, integration_task) VALUES (5, 45), (5, 4);
-- Registry Filings: Middesk, Entity Match, & Trulioo
INSERT INTO integrations.rel_integration_integration_groups (integration_group, integration_task) VALUES (6, 42), (6, 64), (6, 78);
-- Reviews: Verdata, Google Reviews & Google Business Reviews
INSERT INTO integrations.rel_integration_integration_groups (integration_group, integration_task) VALUES (7, 4), (7, 49), (7, 80), (7, 44), (7, 46);



