export const ROLES = {
	ADMIN: "admin",
	CUSTOMER: "customer",
	APPLICANT: "applicant"
};

export const ROLE_ID = {
	ADMIN: 1,
	CUSTOMER: 2,
	APPLICANT: 3
};

export const ADMIN_UUID = "e9d43901-3fc6-4ee9-97be-74cd23b39aa0";

export const SUBROLES = {
	OWNER: "owner",
	CRO: "cro",
	RISK_ANALYST: "risk_analyst",
	APPLICANT: "applicant",
	USER: "user"
};

export const ROLE_ID_TO_ROLE = {
	[ROLE_ID.ADMIN]: ROLES.ADMIN,
	[ROLE_ID.CUSTOMER]: ROLES.CUSTOMER,
	[ROLE_ID.APPLICANT]: ROLES.APPLICANT
};
