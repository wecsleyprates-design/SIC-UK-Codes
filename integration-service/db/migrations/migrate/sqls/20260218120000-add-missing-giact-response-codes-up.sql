-- Add missing gVerify (AccountResponseCode) rows.
-- Source: https://sandbox.api.giact.com/verificationservices/web_api/Help/ResourceModel?modelName=AccountResponseCode
-- Existing rows are not modified.
INSERT INTO integrations.core_giact_response_codes
  (verification_type, name, code, description, verification_response, response_code)
VALUES
  ('gVerify', 'N/A', 'RT05', 'N/A', 'NoData', 11),
  ('gVerify', 'AMEX Travelers Cheque', '_2222', 'AMEX – The account was found to be an American Express Travelers Cheque account.', 'Pass', 13),
  ('gVerify', 'N/A', '_7777', 'N/A', 'NoData', 16),
  ('gVerify', 'N/A', '_8888', 'N/A', 'NoData', 17),
  ('gVerify', 'N/A', '_9999', 'N/A', 'NoData', 18),
  ('gVerify', 'Routing Not Assigned', 'GN05', 'The routing number is reported as not currently assigned to a financial institution.', 'Declined', 20);

-- Add missing gAuthenticate (CustomerResponseCode) rows.
-- Source: https://sandbox.api.giact.com/verificationservices/web_api/Help/ResourceModel?modelName=CustomerResponseCode
INSERT INTO integrations.core_giact_response_codes
  (verification_type, name, code, description, verification_response, response_code)
VALUES
  ('gAuthenticate', 'Failed gIdentify', 'CI01', 'Information submitted failed gIdentify/CustomerID.', 'Declined', 9),
  ('gAuthenticate', 'N/A', 'CI02', 'N/A', 'No Data', 10),
  ('gAuthenticate', 'Customer Identified', 'CI11', 'Customer identification passed gIdentify/CustomerID.', 'Pass', 11),
  ('gAuthenticate', 'Name Mismatch gIdentify', 'CI21', 'The customer or business name data did not match gIdentify/CustomerID data.', 'RiskAlert', 12),
  ('gAuthenticate', 'TaxId Mismatch gIdentify', 'CI22', 'The customer''s TaxId (SSN/ITIN) data did not match gIdentify/CustomerID data.', 'RiskAlert', 13),
  ('gAuthenticate', 'Address Mismatch gIdentify', 'CI23', 'The customer''s address data did not match gIdentify/CustomerID data.', 'AcceptWithRisk', 14),
  ('gAuthenticate', 'Phone Mismatch gIdentify', 'CI24', 'The customer''s phone data did not match gIdentify/CustomerID data.', 'AcceptWithRisk', 15),
  ('gAuthenticate', 'DoB/ID Mismatch gIdentify', 'CI25', 'The customer''s date of birth or ID data did not match gIdentify/CustomerID data.', 'AcceptWithRisk', 16),
  ('gAuthenticate', 'Multiple Mismatch gIdentify', 'CI30', 'Multiple contact data points did not match gIdentify/CustomerID data.', 'RiskAlert', 17);
