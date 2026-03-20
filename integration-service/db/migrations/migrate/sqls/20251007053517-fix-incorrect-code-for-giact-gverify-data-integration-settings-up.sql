-- Fix incorrect code for GIACT gVerify in customer integration settings
-- Update the code from incorrect value to "GVERIFY" to match constants
UPDATE data_customer_integration_settings 
SET settings = jsonb_set(
    settings, 
    '{gverify,code}', 
    '"GVERIFY"'
)
WHERE settings ? 'gverify' 
  AND settings->'gverify' ? 'code'
  AND settings->'gverify'->>'code' != 'GVERIFY';