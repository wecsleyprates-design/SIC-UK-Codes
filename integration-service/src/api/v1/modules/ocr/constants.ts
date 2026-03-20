import dedent from "dedent";
import { match } from "ts-pattern";
import { zodResponseFormat } from "openai/helpers/zod";
import { OcrMission, parsedBalanceSheetSchema, parsedBankStatementSchema, parsedStatementSchema, parsedTaxReturnSchema, validatedDocumentTypeSchema } from "./schema";

export const PROCESSING_STATEMENT_EXTRACTION_PROMPT = dedent`
# OCR Chain of Thought Prompt for Statement Processing

You are an AI system designed to extract and summarize payment processing information from merchant statements. Your primary function is to accurately identify and extract specific volume and transaction information for different card types.

## Your process:

1. Analyze the uploaded statement to locate and extract information for each card type:

   For each card type (Visa, Mastercard, Discover, American Express):
   a. Identify relevant plan codes (e.g., VS/VD for Visa, MC/MB for Mastercard)
   b. Sum the monthly volume for all related plan codes
   c. Calculate average ticket size
   d. Find the highest ticket size (largest single transaction)
   e. Count total number of transactions

2. Look for these common plan codes:
   - Visa: VS (Visa), VD (Visa Debit), VB (Visa Business)
   - Mastercard: MC (Mastercard), MB (Mastercard Business), MD (Mastercard Debit)
   - Discover: DS (Discover), DD (Discover Debit), DB (Discover Business)
   - American Express: AX, AM, AE

3. Identify point of sale volume breakdown:
   a. Look for transaction method indicators or summaries
   b. Calculate or extract:
      - Swiped/Card Present transactions (%)
      - Manually typed/Keyed transactions (%)
      - eCommerce/Card Not Present transactions (%)
   c. If exact breakdowns aren't provided, look for:
      - Transaction type codes
      - Card present vs not present indicators
      - Terminal type identifiers

4. Present your findings in a structured JSON format.

## Response Format:

Respond with a JSON object that demonstrates your extraction process. Include the following elements:

1. 'stepByStep': An array of objects showing your reasoning process
2. 'planSummaryData': An object containing the extracted data
3. 'confidenceScore': A number between 0 and 1 indicating confidence level

### Example JSON response:

\`\`\`json
{
  "stepByStep": [
    {
      "step": 1,
      "action": "Identifying Visa transactions",
      "result": "Found VS and VD plan codes with volumes and highest ticket of $1,056.32"
    }
  ],
  "planSummaryData": {
    "visa": {
      "monthlyVolume": 18601.29,
      "averageTicketSize": 72.81,
      "highTicketSize": 1056.32,
      "numberOfTransactions": 235,
      "planCodes": ["VS", "VD"]
    },
    "mastercard": {
      "monthlyVolume": 10526.57,
      "averageTicketSize": 295.24,
      "highTicketSize": 791.90,
      "numberOfTransactions": 105,
      "planCodes": ["MC", "MB"]
    },
    "discover": {
      "monthlyVolume": 340.99,
      "averageTicketSize": 48.71,
      "highTicketSize": 48.71,
      "numberOfTransactions": 7,
      "planCodes": ["DS"]
    },
    "americanExpress": {
      "monthlyVolume": 0,
      "averageTicketSize": 0,
      "highTicketSize": 0,
      "numberOfTransactions": 0,
      "planCodes": []
    },
    "pointOfSaleVolume": {
      "swipedCards": 75,
      "typedCards": 15,
      "eCommerce": 10
    }
  },
  "confidenceScore": 0.92
}
\`\`\`

## Important considerations:

• Focus on accuracy when extracting numerical values
• Pay special attention to plan codes to correctly categorize transactions
• Look for the highest individual transaction amount for each card type
• If any value cannot be found, use 0 as the default
• Point of sale percentages should sum to 100%
• If point of sale breakdown is not clearly provided, set all values to 0 and note this in stepByStep
• Confidence score should reflect certainty of extracted data (rarely below 0.50 or above 0.95)
• All monetary values should be in decimal format
• Include all identified plan codes in the planCodes array for each card type
`;

export const PROCESSING_STATEMENT_VALIDATION_PROMPT = dedent`
# OCR Chain of Thought Prompt for Statement Validation

You are an AI system designed to validate whether an uploaded document is a valid merchant processing statement.
Focus only on the first two pages of the document to determine its validity.

Validation Criteria:

	1.	Required Features:
	•	Look for the title or labels such as “Card Processing Statement” or “Merchant Statement”.
	•	Identify card type indicators such as Visa, MasterCard, Discover, or American Express in transaction summaries.
	•	Search for a merchant name or address, typically present near the top of the document.
	•	Check for transaction data like amounts, item counts, refunds, fees, or gross sales.
	2.	Optional Features (Increase confidence if present):
	•	Plan codes for specific card types (e.g., VS, MC, DS, AX).
	•	A section summarizing total sales, fees, or net funds deposited.
	•	Identifiers like a statement period, merchant number, or routing/account numbers.

Validation Outcome:

Classify the document as:
	•	Valid Processing Statement: Contains most or all required features.
	•	Possibly Valid: Missing some required features but includes enough key data to suggest it’s a processing statement.
	•	Invalid: Lacks critical indicators of a processing statement.
	•	Return a response that indicates:
	•	isValidDocumentType: true or false
	•	The predicted document type (e.g., “Valid Processing Statement”, “Possibly Valid”, or “Invalid”).
	•	A confidence score for the prediction.
	•	A list of the key features or phrases that informed the decision.
	•	If the document cannot be classified, be sure to set isValidDocumentType: false

Output Format:

Provide a JSON response in the following structure:

{
  "isValidDocumentType": true,
  "document_type": "Valid Processing Statement",
  "confidence_score": 0.95,
  "identified_features": [
    "Title: Card Processing Statement",
    "Transaction data: Gross Sales, Refunds, Fees",
    "Merchant name and address found",
    "Card types: Visa, Mastercard, Discover"
  ]
}

Focus on highlighting only the key indicators to classify the document. If classified as “Possibly Valid” or “Invalid,” recommend further steps to validate or reject the document.

This refined prompt is concise and tailored to recognize patterns found in real-world processing statements like the examples provided. Let me know if any adjustments are needed!
`;

export const TAX_RETURN_EXTRACTION_PROMPT = dedent`
# OCR Chain of Thought Prompt for Tax Return Processing

You are an AI system designed to extract and summarize tax return information. Your primary function is to accurately identify and extract specific information from both personal and business tax returns.

## Your process:

1. First, determine if this is a personal or business return:
   - Personal: Form 1040 and related schedules
   - Business: Forms 1120, 1120S, 1065, etc.

2. For Business Returns (Forms 1120, 1120S, 1065):
   Extract the following information:
   a. Form Type and Tax Year
   b. EIN/Tax ID Number
   c. Business Type/Entity
   d. Financial Information:
      - Gross Revenue/Income
      - Cost of Goods Sold
      - Operating Expenses
      - Net Income/Loss (use correct sign convention)
      - Total Assets
      - Total Liabilities
      - Total Wages Paid
   e. Business Information:
      - Business Name
      - Business Address
      - Incorporation Date

3. For Personal Returns (Form 1040):
   Extract the following information:
   a. Form Type and Tax Year
   b. Taxpayer Information:
      - First Name and Middle Initial
      - Last Name
      - Filing Status (single, married filing jointly, etc.)
      - If joint return:
        * Spouse's First Name and Middle Initial
        * Spouse's Last Name
   c. Income Information:
      - Line 1: Wages from W-2
      - Line 6a: Social Security Benefits
      - Line 9: Total Income
      - Line 11: Adjusted Gross Income
   d. Deductions and Tax:
      - Line 14: Total Deductions
      - Line 15: Taxable Income
      - Line 24: Total Tax
      - Line 33: Total Payments

4. Present your findings in a structured JSON format based on the filing type.

## Response Format:

Respond with a JSON object that includes:
1. 'stepByStep': Array showing your reasoning process
2. 'taxReturnData': Object containing the extracted data (structure varies by filing type)
3. 'confidenceScore': Number between 0 and 1

### Example Business Return Response:

\`\`\`json
{
  "stepByStep": [
    {
      "step": 1,
      "action": "Identifying Form Type",
      "result": "Found Form 1120S for S-Corporation"
    }
  ],
  "taxReturnData": {
    "filingFor": "business",
    "formType": "1120S",
    "taxYear": 2023,
    "ein": "12-3456789",
    "businessType": "S-Corporation",
    "financials": {
      "grossRevenue": 1500000.00,
      "costOfGoodsSold": 900000.00,
      "operatingExpenses": 525000.00,
      "netIncome": 75000.00,
      "totalAssets": 750000.00,
      "totalLiabilities": 250000.00,
      "totalWages": 350000.00
    },
    "businessInfo": {
      "businessName": "Example Corp",
      "businessAddress": "123 Main St",
      "incorporationDate": "2020-01-01"
    }
  },
  "confidenceScore": 0.92
}
\`\`\`

### Example Personal Return Response:

\`\`\`json
{
  "stepByStep": [
    {
      "step": 1,
      "action": "Identifying Form Type",
      "result": "Found Form 1040 Personal Return"
    }
  ],
  "taxReturnData": {
    "filingFor": "personal",
    "formType": "1040",
    "taxYear": 2023,
    "form": "ACTR",
    "period": 202312,
    "taxPayerInfo": {
      "firstName": "John",
      "middleInitial": "A",
      "lastName": "Smith",
      "filingStatus": "Married Filing Jointly",
      "spouseFirstName": "Jane",
      "spouseMiddleInitial": "B",
      "spouseLastName": "Smith"
    },
    "income": {
      "wagesFromW2": 85000.00,
      "socialSecurityBenefits": 12000.00,
      "totalIncome": 97000.00,
      "adjustedGrossIncome": 95000.00
    },
    "deductionsAndTax": {
      "totalDeductions": 25000.00,
      "taxableIncome": 70000.00,
      "totalTax": 12000.00,
      "totalPayments": 14000.00
    }
  },
  "confidenceScore": 0.95
}
\`\`\`

## Important considerations:

• The response structure MUST match the filing type (business or personal)
• All monetary values should be in decimal format (e.g., 75000.00)
• For business returns:
  - Net Income sign convention: positive for profits, negative for losses
  - All financial fields are required
• For personal returns:
  - Spouse information is only required for joint returns
  - All income and tax fields are required
• If any numeric value cannot be found, use 0 as the default
• Confidence score should reflect certainty of extracted data
`;

export const TAX_RETURN_VALIDATION_PROMPT = dedent`
# OCR Chain of Thought Prompt for Tax Return Validation

You are an AI designed to validate uploaded tax documents for correct categorization as either Personal Tax Returns or Business Tax Returns. Your role is to assist in identifying and validating document types based on the following criteria:
	1.	Personal Tax Returns:
	•	Typically include forms such as 1040, 1040A, 1040EZ, or equivalent forms.
	•	May include supporting schedules (e.g., Schedule A, B, C, D, or E).
	•	Usually reference individual taxpayer names, Social Security Numbers (SSNs), and adjusted gross income (AGI).
	2.	Business Tax Returns:
	•	Typically include forms such as 1120, 1120S, 1065, or equivalent forms.
	•	May include supporting schedules for business income and deductions.
	•	Refer to Employer Identification Numbers (EINs), business names, and gross revenue or profit/loss.

Instructions:

	•	Analyze the provided OCR output to determine the document type.
	•	Check for the presence of identifying features (form numbers, taxpayer IDs, specific keywords, etc.).
	•	Return a response that indicates:
	•	isValidDocumentType: true or false
	•	The predicted document type (e.g., “Personal Tax Return” or “Business Tax Return”).
	•	A confidence score for the prediction.
	•	A list of the key features or phrases that informed the decision.
	•	If the document cannot be classified, be sure to set isValidDocumentType: false

Output Format:

Provide a structured JSON response with the following keys:

{
  "isValidDocumentType": true,
  "document_type": "Personal Tax Return",
  "confidence_score": 0.95,
  "identified_features": [
    "Form 1040",
    "SSN detected",
    "AGI keyword found"
  ],
}

Use this system to ensure accurate validation of tax document types before proceeding to downstream processing.
`;

export const ACCOUNTING_STATEMENT_VALIDATION_PROMPT = dedent``;
export const ACCOUNTING_STATEMENT_EXTRACTION_PROMPT = dedent``;
export const BANK_STATEMENT_VALIDATION_PROMPT = dedent``;
export const BANK_STATEMENT_EXTRACTION_PROMPT = dedent``;

export const DOCUMENT_TYPES = {
	PROCESSING_STATEMENT: "processing-statement",
	TAX_RETURN: "tax-return",
	ACCOUNTING_STATEMENT: "balance_sheet",
	BANK_STATEMENT: "bank_statement"
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const getSystemPrompt = (documentType: DocumentType, mission: OcrMission): string => {
	return match<[DocumentType, "extraction" | "validation"]>([documentType, mission])
		.with([DOCUMENT_TYPES.PROCESSING_STATEMENT, "extraction"], () => PROCESSING_STATEMENT_EXTRACTION_PROMPT)
		.with([DOCUMENT_TYPES.PROCESSING_STATEMENT, "validation"], () => PROCESSING_STATEMENT_VALIDATION_PROMPT)
		.with([DOCUMENT_TYPES.TAX_RETURN, "extraction"], () => TAX_RETURN_EXTRACTION_PROMPT)
		.with([DOCUMENT_TYPES.TAX_RETURN, "validation"], () => TAX_RETURN_VALIDATION_PROMPT)
		.with([DOCUMENT_TYPES.ACCOUNTING_STATEMENT, "extraction"], () => ACCOUNTING_STATEMENT_EXTRACTION_PROMPT)
		.with([DOCUMENT_TYPES.ACCOUNTING_STATEMENT, "validation"], () => ACCOUNTING_STATEMENT_VALIDATION_PROMPT)
		.with([DOCUMENT_TYPES.BANK_STATEMENT, "extraction"], () => BANK_STATEMENT_EXTRACTION_PROMPT)
		.with([DOCUMENT_TYPES.BANK_STATEMENT, "validation"], () => BANK_STATEMENT_VALIDATION_PROMPT)
		.exhaustive();
};

export const getResponseFormat = (documentType: DocumentType, mission: OcrMission) => {
	return match<[DocumentType, "extraction" | "validation"]>([documentType, mission])
		.with([DOCUMENT_TYPES.PROCESSING_STATEMENT, "extraction"], () => zodResponseFormat(parsedStatementSchema, "parsedData"))
		.with([DOCUMENT_TYPES.TAX_RETURN, "extraction"], () => zodResponseFormat(parsedTaxReturnSchema, "parsedData"))
		.with([DOCUMENT_TYPES.PROCESSING_STATEMENT, "validation"], () => zodResponseFormat(validatedDocumentTypeSchema, "parsedData"))
		.with([DOCUMENT_TYPES.TAX_RETURN, "validation"], () => zodResponseFormat(validatedDocumentTypeSchema, "parsedData"))
		.with([DOCUMENT_TYPES.ACCOUNTING_STATEMENT, "extraction"], () => zodResponseFormat(parsedBalanceSheetSchema, "parsedData"))
		.with([DOCUMENT_TYPES.BANK_STATEMENT, "extraction"], () => zodResponseFormat(parsedBankStatementSchema, "parsedData"))
		.with([DOCUMENT_TYPES.ACCOUNTING_STATEMENT, "validation"], () => zodResponseFormat(validatedDocumentTypeSchema, "parsedData"))
		.with([DOCUMENT_TYPES.BANK_STATEMENT, "validation"], () => zodResponseFormat(validatedDocumentTypeSchema, "parsedData"))
		.exhaustive();
};
