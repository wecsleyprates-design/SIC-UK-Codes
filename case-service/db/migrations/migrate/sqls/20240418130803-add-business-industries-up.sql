--- Create table core_business_industries
CREATE TABLE core_business_industries (
    id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(255) NOT NULL UNIQUE,
    sector_code VARCHAR(10) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT core_business_industries_name_key UNIQUE (name),
    CONSTRAINT core_business_industries_code_key UNIQUE (code),
    CONSTRAINT core_business_industries_sector_code_key UNIQUE (sector_code)
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON core_business_industries 
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

INSERT INTO core_business_industries (id, name, code, sector_code) VALUES
(1, 'Agriculture, Forestry, Fishing and Hunting', 'agriculture_forestry_fishing_and_hunting', '11'),
(2, 'Mining, Quarrying, and Oil and Gas Extraction', 'mining_quarrying_and_oil_and_gas_extraction', '21'),
(3, 'Utilities', 'utilities', '22'),
(4, 'Construction', 'construction', '23'),
(5, 'Manufacturing', 'manufacturing', '31-33'),
(6, 'Wholesale Trade', 'wholesale_trade', '42'),
(7, 'Retail Trade', 'retail_trade', '44-45'),
(8, 'Transportation and Warehousing', 'transportation_and_warehousing', '48-49'),
(9, 'Information', 'information', '51'),
(10, 'Finance and Insurance', 'finance_and_insurance', '52'),
(11, 'Real Estate and Rental and Leasing', 'real_estate_and_rental_and_leasing', '53'),
(12, 'Professional, Scientific, and Technical Services', 'professional_scientific_and_technical_services', '54'),
(13, 'Management of Companies and Enterprises', 'management_of_companies_and_enterprises', '55'),
(14, 'Administrative and Support and Waste Management and Remediation Services', 'administrative_and_support_and_waste_management_and_remediation_services', '56'),
(15, 'Educational Services', 'educational_services', '61'),
(16, 'Health Care and Social Assistance', 'health_care_and_social_assistance', '62'),
(17, 'Arts, Entertainment, and Recreation', 'arts_entertainment_and_recreation', '71'),
(18, 'Accommodation and Food Services', 'accommodation_and_food_services', '72'),
(19, 'Other Services (except Public Administration)', 'other_services', '81'),
(20, 'Public Administration', 'public_administration', '92');

ALTER TABLE IF EXISTS data_businesses ADD COLUMN industry INT;

ALTER TABLE IF EXISTS data_businesses ADD CONSTRAINT fk_business_industries FOREIGN KEY (industry) REFERENCES core_business_industries(id);