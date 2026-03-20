-- Add PR, AU, NZ to core_jurisdictions table
INSERT INTO onboarding_schema.core_jurisdictions (jurisdiction_code, flag_code, "name", order_index) VALUES
	('PR', 'PR', 'Puerto Rico', 4),
	('AU', 'AU', 'Australia', 5),
	('NZ', 'NZ', 'New Zealand', 6);