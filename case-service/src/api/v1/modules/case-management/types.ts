export interface CaseDetailsExportEntry {
	"Business ID": string;
	"Case ID": string;
	"Submission Date (UTC)": string;
	"Invitation Date (UTC)": string | null;
	"Invited By": string | null;
	"Business Legal Name": string;
	"DBA Name": string | null;
	MCC: string | null;
	MID: string | null;
	"Risk Level": string | null;
	"Transaction Size": string | null;
	"Monthly Volume": string | object | null;
	"Annual Volume": string | object | null;
	"Application Status": string;
	"Application Reason Code": string | null;
	"Analyst Name": string | null;
	"Worth Score": string | number | null;
	"Last Decision Date (UTC)": string | null;
	"Onboarding Date/Time (UTC)": string | null;
	"Auto Approval": "Yes" | "No";
}
