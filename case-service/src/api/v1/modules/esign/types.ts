import { UUID } from "crypto";

export interface CreateSessionBody {
	templateId: string;
	eSignTemplateId?: string;
	signer: {
		id: string;
		email: string;
		fullName: string;
		title?: string;
	};
	documentFields: {
		legalName?: string;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		zip?: string;
		taxId?: string;
		// Add support for mappingData
		[key: string]: string | number | boolean | object | undefined;
	};
	caseId?: string;
	userId?: string;
	customerId?: string;
}

export interface IDataDocumentTemplate {
	template_id: UUID;
	name: string | null;
	customer_id: UUID | null;
	version: number;
	template_fields: object;
	metadata: { tags: string[] };
	created_by: UUID;
	updated_by: UUID;
	created_at: Date;
	updated_at: Date;
}

export interface IDataDocuments {
	document_id: UUID;
	template_id: UUID;
	customer_id: UUID;
	business_id: UUID;
	case_id: UUID;
	signed_by: UUID | null;
	mapping_data: object;
	created_at: Date;
	created_by: UUID;
	updated_at: Date;
	updated_by: UUID;
}

export interface IRelCustomerTemplates {
	customer_id: UUID;
	template_id: UUID;
	is_selected: boolean;
}

export type Applicant = {
	id: UUID;
	first_name: string;
	last_name: string;
	email: string;
	mobile: string;
	subrole_id: UUID;
	code: "standalone_applicant" | "owner" | "applicant" | "user";
	status: "ACTIVE" | "INACTIVE";
};
