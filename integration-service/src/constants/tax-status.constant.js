export const TAX_STATUS_ENDPOINTS = {
	REQUEST: "request",
	TAXPAYERS: "taxpayers",
	BUSINESS: "business",
	INDIVIDUAL: "individual",
	LAST_STATUS: "laststatus",
	UPDATE: "update",
	REVOKE: "revoke",
	TRANSCRIPT: "transcript",
	TRANSCRIPTDETAIL: "transcriptdetail"
};

export const ALLOWED_TAX_FORMS = {
	941: "941",
	1120: "1120"
};

export const TAX_STATUS_FORMS = {
	ANNUALLY: "1120",
	QUARTERLY: "941"
};

export const TAX_STATUS_FORMS_TYPE = {
	RETR: "RETR"
};

export const FORM_TO_FORM_TYPE_MAPPING = {
	941: "RETR",
	943: "RETR",
	1040: "ACTR",
	1120: "ACTR",
	1065: "ACTR",
	990: "ACTR",
	"1040-ES": "RECA",
	"1040ES": "RECA",
	"1120-ES": "RECA",
	"1120ES": "RECA",
	"1120S": "ACTR",
	"1120-S": "ACTR"
};

export const BUSINESS_ANNUAL_FORMS = {
	1120: "1120",
	"1120-S": "1120-S",
	"1120S": "1120S",
	1065: "1065",
	990: "990",
	1099: "1099"
};

export const BUSINESS_QUARTERLY_FORMS = {
	941: "941",
	943: "943",
	944: "944",
	720: "720"
};

export const INDIVIDUAL_ANNUAL_FORMS = {
	1040: "1040",
	"1040-SR": "1040-SR",
	"1040-NR": "1040-NR",
	4868: "4868"
};

export const INDIVIDUAL_QUARTERLY_FORMS = {
	"1040-ES": "1040-ES",
	"1040ES": "1040ES",
	"1040-ES(NR)": "1040-ES(NR)"
};
