--
-- Table structure for table `core_data_refresh_config`
--
CREATE TABLE core_data_refresh_config (
    id INT NOT NULL PRIMARY KEY,
    refresh_type VARCHAR NOT NULL UNIQUE,
    refresh_cycle_in_days INT NOT NULL
);

INSERT INTO core_data_refresh_config (id, refresh_type, refresh_cycle_in_days) VALUES
    (1, 'MONITORING_REFRESH', 30),
    (2, 'SUBSCRIPTION_REFRESH', 30);