-- Create the enum type .
CREATE TYPE verification_type_enum AS ENUM ('gVerify', 'gAuthenticate');

-- Create the table using the newly created enum type.
CREATE TABLE integrations.core_giact_response_codes (
    id SERIAL PRIMARY KEY,
    verification_type verification_type_enum,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    verification_response VARCHAR(255),
    response_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert gVerify entries.
INSERT INTO integrations.core_giact_response_codes 
    (verification_type, name, code, description, verification_response, response_code)
VALUES
  ('gVerify', 'Account Verified', '_1111', 'Account Verified – The account was found to be an open and valid account.', 'Pass', '12'),
  ('gVerify', 'Account Verified', '_3333', 'Non-Participant Provider – This account was reported with acceptable, positive data found in current or recent transactions.', 'Pass', '14'),
  ('gVerify', 'Account Verified', '_5555', 'Savings Account Verified – The account was found to be an open and valid account.', 'Pass', '15'),
  ('gVerify', 'Unverified Account', 'ND00', 'The routing number submitted belongs to a financial institution; however, this financial institution does not report information to the National Shared Database. The financial institutions that do report to the National Shared Database have not reported any recent experience (positive or negative) with this account.', 'Informational (formerly NoData)', '21'),
  ('gVerify', 'Unverified Account', 'ND01', 'No positive or negative information has been reported on the account. This routing number can only be valid for US Government financial institutions. Please verify this item with its issuing authority.', 'No Data', '22'),
  ('gVerify', 'Invalid Routing Number', 'GS01', 'Invalid Routing Number - The routing number supplied did not match the format of a valid routing number.', 'Declined', '1'),
  ('gVerify', 'Invalid Account Number', 'GS02', 'Invalid Account Number - The account number supplied did not match the format of a valid account number.', 'Declined', '2'),
  ('gVerify', 'Invalid Check Number', 'GS03', 'Invalid Check Number - The check number supplied did not match the format of a valid check number.', 'Declined', '3'),
  ('gVerify', 'Invalid Amount', 'GS04', 'Invalid Amount - The amount supplied did not match the format of a valid amount.', 'Declined', '4'),
  ('gVerify', 'Private Bad Checks List', 'GP01', 'Private Bad Checks List – Variable - The value for Details will vary depending on the value set for Check Reject reason in the Private Bad Checks List.', 'PrivateBadChecksList', '5'),
  ('gVerify', 'No Information Found', 'RT00', 'No Information Found - The routing number appears to be accurate; however, no positive or negative information has been reported on the account. Please contact customer to ensure that the correct account information was entered.', 'Declined', '6'),
  ('gVerify', 'High Risk Account', 'RT01', 'Declined - This account should be returned based on the risk factor being reported.', 'Declined', '7'),
  ('gVerify', 'High Risk Account', 'RT02', 'RejectItem - This item should be rejected based on the risk factor being reported.', 'RejectItem', '8'),
  ('gVerify', 'High Risk Account', 'RT03', 'AcceptWith Risk - Current negative data exists on this account. Accept transaction with risk. (Example: Checking or savings accounts in NSF status, recent returns, or outstanding items)', 'AcceptWithRisk', '9'),
  ('gVerify', 'Non-Demand Account', 'RT04', 'Non-Demand Deposit Account - This is a Non-Demand Deposit Account (post no debits), Credit Card Check, Line of Credit, Home Equity or a Brokerage check.', 'PassNdd', '10'),
  ('gVerify', 'Negative Data', 'GN01', 'Negative Data - Negative information was found.', 'NegativeData', '19');

-- Insert gAuthenticate entries.
INSERT INTO integrations.core_giact_response_codes 
    (verification_type, name, code, description, verification_response, response_code)
VALUES
  ('gAuthenticate', 'Account Authenticated', 'CA11', 'Customer authentication passed gAuthenticate.', 'Pass', '2'),
  ('gAuthenticate', 'Unauthenticated Account', 'ND02', 'No data was found matching the customer information provided.', 'No Data', '18'),
  ('gAuthenticate', 'Invalid Address', 'CA23', 'The customers address data did not match gAuthenticate data.', 'AcceptWithRisk', '5'),
  ('gAuthenticate', 'Invalid Phone Number', 'CA24', 'The customers phone data did not match gAuthenticate data.', 'AcceptWithRisk', '6'),
  ('gAuthenticate', 'Invalid Date Of Birth', 'CA25', 'The customers date of birth or ID data did not match gAuthenticate data.', 'AcceptWithRisk', '7'),
  ('gAuthenticate', 'High Risk Account', 'CA21', 'The customer or business name data did not match gAuthenticate data.', 'RiskAlert', '3'),
  ('gAuthenticate', 'High Risk Account', 'CA22', 'The customers TaxId (SSN/ITIN) data did not match gAuthenticate data.', 'RiskAlert', '4'),
  ('gAuthenticate', 'High Risk Account', 'CA30', 'Multiple secondary data points did not match gAuthenticate data.', 'RiskAlert', '8'),
  ('gAuthenticate', 'Failed', 'CA01', 'Information submitted failed gAuthenticate.', 'Declined', '1');
