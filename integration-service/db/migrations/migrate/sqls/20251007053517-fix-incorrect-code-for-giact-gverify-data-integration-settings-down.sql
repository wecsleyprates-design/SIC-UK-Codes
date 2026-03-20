-- Rollback: Revert gVerify code back to previous value
-- Note: This rollback assumes the previous code was "gverify" (lowercase)
-- If the previous code was different, this rollback may not be accurate
UPDATE data_customer_integration_settings 
SET settings = jsonb_set(
    settings, 
    '{gverify,code}', 
    '"GIACT"'
)
WHERE settings ? 'gverify' 
  AND settings->'gverify' ? 'code'
  AND settings->'gverify'->>'code' = 'GVERIFY';