import { envConfig } from "#configs";
export const DIRECTORIES = {
	CUSTOM_FIELDS: "custom-fields",
	CUSTOM_FIELD_FILES: "custom-fields-data",
	ADDITIONAL_DOCUMENTS: "additional-documents",
	PDF_TEMPLATES: "pdf-templates",
	CASE_EXPORTS: "cases-export"
};

export const BUCKETS = {
	BACKEND: envConfig.AWS_BACKEND_BUCKET,
	ASSETS: envConfig.AWS_ASSETS_BUCKET,
	ELECTRONIC_CONSENT: envConfig.AWS_ELECTRONIC_CONSENT_BUCKET
};
