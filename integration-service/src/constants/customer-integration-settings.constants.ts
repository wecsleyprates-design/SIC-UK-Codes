export const INTEGRATION_SETTING_KEYS = {
	BJL: "bjl",
	EQUIFAX: "equifax",
	GVERIFY: "gverify",
	GAUTHENTICATE: "gauthenticate",
	WEBSITE: "website",
	NPI: "npi",
	IDENTITY_VERIFICATION: "identity_verification",
	ADVERSE_MEDIA: "adverse_media"
} as const;

export const DEFAULT_CUSTOMER_INTEGRATION_SETTINGS: Record<
	string,
	{
		status: "ACTIVE" | "INACTIVE";
		code: string;
		label: string;
		description: string;
		mode: "SANDBOX" | "PRODUCTION" | "MOCK";
		options: ("PRODUCTION" | "SANDBOX" | "MOCK" | "DISABLE")[];
	}
> = {
	bjl: {
		status: "INACTIVE",
		code: "BJL",
		label: "Bankruptcies, Judgements, and Liens (BJL)",
		description: "Gather BJL records associated to the company and its owners.",
		mode: "PRODUCTION",
		options: ["PRODUCTION", "DISABLE"]
	},
	equifax: {
		status: "ACTIVE",
		code: "EQUIFAX",
		label: "Personal Credit Reports",
		description: "View and download a company owners’ personal credit scores and reports.",
		mode: "PRODUCTION",
		options: ["PRODUCTION", "SANDBOX", "DISABLE"]
	},
	gverify: {
		status: "INACTIVE",
		code: "GVERIFY",
		label: "GIACT gVerify",
		description: "Enable integration to check if bank accounts are open, active, and in good standing.",
		mode: "PRODUCTION",
		options: ["PRODUCTION", "SANDBOX", "DISABLE"]
	},
	gauthenticate: {
		status: "INACTIVE",
		code: "GAUTHENTICATE",
		label: "GIACT gAuthenticate",
		description:
			"Enable integration to verify bank accounts belong to the company or owner of the company. Please note: gAuthenticate cannot run without Enhanced Bank Verification.",
		mode: "PRODUCTION",
		options: ["PRODUCTION", "SANDBOX", "DISABLE"]
	},
	website: {
		status: "INACTIVE",
		code: "WEBSITE",
		label: "Website",
		description: "Run analysis on the company’s website and check its authenticity.",
		mode: "PRODUCTION",
		options: ["PRODUCTION", "DISABLE"]
	},
	npi: {
		status: "INACTIVE",
		code: "NPI",
		label: "National Provider Identifier (NPI) Number",
		description: "Collect and verify the status of the primary doctor with a provided NPI number.",
		mode: "PRODUCTION",
		options: ["PRODUCTION", "DISABLE"]
	},
	identity_verification: {
		status: "INACTIVE",
		code: "IDENTITY_VERIFICATION",
		label: "Identity Verification",
		description: "Verify the identity of each owner of the company.",
		mode: "PRODUCTION",
		options: ["PRODUCTION", "SANDBOX", "DISABLE"]
	},
	adverse_media: {
		status: "INACTIVE",
		code: "ADVERSE_MEDIA",
		label: "Adverse Media",
		description: "Gather media that can impact the health of the company.",
		mode: "PRODUCTION",
		options: ["PRODUCTION", "DISABLE"]
	}
};
