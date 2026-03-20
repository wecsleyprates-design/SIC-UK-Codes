import type { FieldAccess, SectionVisibility } from "#constants";
import { UUID } from "crypto";
import { Cases } from "@joinworth/types";

export interface DataCustomerOnboardingLimits {
	customer_id: UUID;
	onboarding_limit: number;
	current_count: number;
	easyflow_count: number;
	purged_businesses_count: number;
	created_at: string;
	created_by: UUID;
	updated_at: string;
	updated_by: UUID;
	reset_at: string | null;
	onboarded_businesses: UUID[];
}

export interface IDataCustomerOnboardingLimitsHistory {
	customer_id: UUID;
	onboarding_limit: number;
	used_count: number;
	easyflow_count: number;
	purged_businesses_count: number;
	total_count: number;
	created_at: string;
	onboarded_businesses: UUID[];
}

export interface ICustomTemplateEgg {
	id?: UUID;
	customer_id: UUID;
	version: number;
	metadata: Record<string, any>;
	is_enabled: boolean;
	created_by: UUID;
	created_at?: Date;
	updated_at?: Date;
	updated_by?: UUID;
}
export interface ICustomTemplate extends ICustomTemplateEgg {
	id: UUID;
	created_at: Date;
	updated_at: Date;
	updated_by: UUID;
}

type CustomFieldProperty =
	| "text"
	| "dropdown"
	| "integer"
	| "full_text"
	| "phone_number"
	| "upload"
	| "email"
	| "boolean"
	| "alphanumeric"
	| "decimal"
	| "checkbox"
	| "date";

export interface ICustomFieldEgg {
	id?: UUID;
	template_id: ICustomTemplate["id"];
	label: string;
	code: string;
	type: "upload" | string;
	property: CustomFieldProperty;
	rules: {
		type?: string;
		required?: string[];
		properties?: Record<string, any>;
		[key: string]: any;
	};
	is_sensitive: boolean;
	step_name: string;
	sequence_number: number;
	conditional_logic: any;
	section_name: string;
	section_visibility: SectionVisibility;
	applicant_access: FieldAccess;
	customer_access: FieldAccess;
}

export interface ICustomField extends ICustomFieldEgg {
	id: UUID;
}

export interface IFieldOption<T = any> {
	id: UUID;
	field_id: UUID;
	label: string;
	value: T;
	checkbox_type: string;
	input_type: "number" | "" | "No" | null | string;
	icon: string;
	icon_position: "first" | "last" | "" | null | string;
}

export type CustomFieldEnriched = ICustomField & { template: ICustomTemplate; field_options: IFieldOption[] };
export interface IBusinessCustomFieldEgg<T = any> {
	id?: UUID;
	business_id: UUID;
	case_id: UUID;
	template_id: ICustomTemplate["id"];
	field_id: ICustomField["id"];
	field_value: T;
	created_by: UUID;
	created_at?: Date;
}

export type BusinessCustomFieldEnriched<T = any> = IBusinessCustomField<T> & { field: ICustomField };

export interface IBusinessCustomField<T = any> extends IBusinessCustomFieldEgg<T> {
	id: UUID;
	created_at: Date;
}

export type BusinessCustomFieldRequest<T = any> = {
	value: T;
} & ({ fieldId: UUID; fieldCode?: never } | { fieldId?: never; fieldCode: string });

export type BusinessCustomFieldsFromCaseParams<T = any> = BusinessCustomFieldRequest<T> & {
	caseId: UUID;
	userId?: UUID;
	customerId: UUID | null;
	templateId?: UUID;
};

export type NormalizedCustomFieldValues = Record<ICustomField["code"], IBusinessCustomField["field_value"]>;

export type CustomFieldResponse = {
	id: UUID;
	label: string;
	internalName: string;
	property: CustomFieldProperty;
	value: any | null;
	value_id: UUID | null;
	type: string;
	is_sensitive_info: boolean;
	rules: {
		type?: string;
		required?: string[];
		properties?: Record<string, any>;
		[key: string]: any;
	};
	step_name: string;
	section_name: string;
	field_options: IFieldOption[];
	conditionalLogic: string;
	sequence_number: number;
	customer_access: FieldAccess;
	applicant_access: FieldAccess;
};

export type BusinessCustomFieldResponse<T = any> = CustomFieldResponse & {
	business_id: UUID;
	case_id: UUID;
	created_by: UUID;
	field_id: UUID;
	template_id: UUID;
	value: T;
	value_id: UUID;
};

export type DetailedBusinessCustomFields = {
	label: string;
	field_id: string;
	step_name: string;
	sequence_number: number;
	value: any | null;
	data_type: CustomFieldProperty;
	applicant_access: FieldAccess;
	customer_access: FieldAccess;
	is_sensitive: boolean;
	rules: {
		type?: string;
		required?: string[];
		properties?: Record<string, any>;
		[key: string]: any;
	};
}

export type ICustomerCustomFieldsSummary = Cases.CustomFields.CustomFieldSummaryItem;