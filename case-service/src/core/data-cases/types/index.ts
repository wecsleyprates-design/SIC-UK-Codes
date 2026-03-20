/**
 * Align with data_cases.status / case_type in DB. Expand as needed.
 */
export const CASE_STATUS = {
	ACTIVE: "active",
	CLOSED: "closed",
} as const;

export const CASE_TYPE = {
	ONBOARDING: "onboarding",
	RENEWAL: "renewal",
} as const;

export type DataCase = {
	id: string;
	applicant_id: string;
	customer_id?: string;
	business_id: string;
	status: (typeof CASE_STATUS)[keyof typeof CASE_STATUS];
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	case_type: (typeof CASE_TYPE)[keyof typeof CASE_TYPE];
};

export type GetCaseParams = Partial<DataCase>;
