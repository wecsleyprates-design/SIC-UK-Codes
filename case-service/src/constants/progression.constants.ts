/**
 * Progression constants
 *
 * This file contains the constants for the progression API.
 *
 */

// Delivered stages
export const progressionStages = {
	BANKING: "banking",
	ACCOUNTING: "accounting",
	OWNERSHIP: "ownership",
	REVIEW: "review"
} as const;
export type ProgressionStages = (typeof progressionStages)[keyof typeof progressionStages];

// Delivered fields
export const progressionFields = {
	DEPOSIT_ACCOUNT: "deposit account",
	MANUAL_ACCOUNT_VERIFICATION: "manual account verification"
} as const;
export type ProgressionFields = (typeof progressionFields)[keyof typeof progressionFields];

// Associate delivered fields with desired stage here
export const progressionFieldsByStage: Partial<Record<ProgressionStages, ProgressionFields[]>> = {
	[progressionStages.BANKING]: [progressionFields.DEPOSIT_ACCOUNT, progressionFields.MANUAL_ACCOUNT_VERIFICATION]
};

// Constants for company field names used in field resolution
export const COMPANY_FIELD_NAMES = {
	COMPANY_NAME: 'Company Name',
	COMPANY_ADDRESS: 'Company Address',
	TAX_ID: 'Tax ID Number/Employer Identification Number',
	WEBSITE: 'Website',
	COMPANY_PHONE: 'Company Phone Number',
	LINKEDIN: 'LinkedIn',
	INDUSTRY: 'Industry',
	MAILING_ADDRESS: 'Mailing Address',
	NPI_NUMBER: 'Primary Provider’s NPI Number*'
};

// Constants for tax field names used in field resolution
export const TAX_FIELD_NAMES = {
	FILED_DATE: 'Tax Document Filed/Processed Date',
	TOTAL_SALES: 'Total Sales',
	TOTAL_COMPENSATION: 'Total Compensation',
	TOTAL_WAGES: 'Total Wages',
	COST_OF_GOODS_SOLD: 'Cost of Goods Sold',
	IRS_BALANCE: 'IRS Balance',
	IRS_LIENS: 'IRS Liens',
	TAX_PERIOD_ENDING: 'Tax Period Ending',
	AMOUNT_FILED: 'Amount Filed',
	ACCOUNT_BALANCE: 'Account Balance',
	ACCRUED_INTEREST: 'Accrued Interest',
	ACCRUED_PENALTY: 'Accrued Penalty'
};

// Constants for processing history field names used in field resolution
export const PROCESSING_HISTORY_FIELD_NAMES = {
	MONTHLY_VOLUME: 'Monthly Volume',
	ANNUAL_VOLUME: 'Annual Volume',
	AVERAGE_TICKET_SIZE: 'Average Ticket Size',
	HIGH_TICKET_SIZE: 'High Ticket Size',
	MONTHLY_OCCURRENCE_HIGH_TICKET: 'Monthly Occurrence of High Ticket',
	EXPLANATION_HIGH_TICKET: 'Explanation of High Ticket',
	DESIRED_LIMIT: 'Desired Limit',
	DEFINE_SEASONAL_BUSINESS: 'Define Seasonal Business',
	HIGH_VOLUME_MONTHS: 'High Volume Months',
	EXPLANATION_HIGH_VOLUME_MONTHS: 'Explanation of High Volume Months',
	CARD_SWIPED: 'Card (Swiped)',
	CARD_KEYED: 'Card (Keyed)',
	MAIL_TELEPHONE: 'Mail & Telephone',
	E_COMMERCE: 'eCommerce',
	VISA_MONTHLY_VOLUME: 'Visa Monthly Volume',
	VISA_ANNUAL_VOLUME: 'Visa Annual Volume',
	VISA_AVERAGE_TICKET_SIZE: 'Visa Average Ticket Size',
	VISA_HIGH_TICKET_SIZE: 'Visa High Ticket Size',
	VISA_DESIRED_LIMIT: 'Visa Desired Limit',
	AMERICAN_MONTHLY_VOLUME: 'American Monthly Volume',
	AMERICAN_ANNUAL_VOLUME: 'American Annual Volume',
	AMERICAN_AVERAGE_TICKET_SIZE: 'American Average Ticket Size',
	AMERICAN_HIGH_TICKET_SIZE: 'American High Ticket Size',
	AMERICAN_DESIRED_LIMIT: 'American Desired Limit'
};

// Constants for ownership field names used in field mapping
export const OWNERSHIP_FIELD_NAMES = {
	FULL_NAME: 'Full Name',
	TITLE: 'Title',
	PHONE_NUMBER: 'Phone Number',
	EMAIL_ADDRESS: 'Email Address',
	HOME_ADDRESS: 'Home Address',
	DATE_OF_BIRTH: 'Date of Birth',
	SOCIAL_SECURITY_NUMBER: 'Social Security Number',
	OWNERSHIP_PERCENTAGE: 'Ownership Percentage',
	EXTENDED_OWNERSHIP: 'Extended Ownership',
};

export const OWNERSHIP_SUB_FIELD_NAMES = {
	MAX_BENEFICIAL_OWNERS: 'Max # of Beneficial Owners',
	MAX_CONTROL_PERSONS: 'Max # of Control Persons',
	MAX_TOTAL_OWNERS: 'Max # of Total Owners'
}