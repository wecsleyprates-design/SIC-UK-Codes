import type { UUID } from "crypto";

/**
 * Request payload for updating a single custom field (same as facts override)
 */
export interface UpdateCustomFieldPayload {
	value: string | number | boolean | Record<string, unknown> | null;
	comment?: string;
}

/**
 * Request body for updating custom fields: { [fieldId]: { value, comment } }
 */
export interface UpdateCustomFieldsRequestBody {
	[fieldId: string]: UpdateCustomFieldPayload;
}

/**
 * Context for custom field operations
 */
export interface CustomFieldUpdateContext {
	method: "PATCH" | "PUT" | "DELETE";
	userID: UUID;
	customerID: UUID;
	businessID: UUID;
}

/**
 * Custom field definition from case-service
 */
export interface CustomFieldDefinition {
	id: UUID;
	template_id: UUID;
	label: string;
	code: string;
	type: string;
	property: number;
	rules: Record<string, unknown> | null;
	is_sensitive: boolean;
	step_name: string | null;
	sequence_number: number;
	section_name: string | null;
	section_visibility: "Default" | "Hidden";
	conditional_logic: Record<string, unknown> | null;
	applicant_access: string;
	customer_access: string;
}

/**
 * Custom field value from database
 */
export interface CustomFieldValue {
	id: UUID;
	business_id: UUID;
	case_id: UUID;
	template_id: UUID;
	field_id: UUID;
	field_value: string | null;
	created_at: string;
	created_by: UUID;
}

/**
 * Audit data for custom field updates
 */
export interface CustomFieldAuditData {
	field_id: UUID;
	field_code: string;
	field_label: string;
	field_type: string;
	previous_value: string | null;
	new_value: string | null;
	comment?: string;
}

/**
 * Response from custom field operations
 */
export interface CustomFieldResponse {
	field_id: UUID;
	field_code: string;
	field_label: string;
	field_type: string;
	value: string | null;
	template_id: UUID;
}

/**
 * Kafka event for custom field audit
 */
export interface CustomFieldAuditEvent {
	event: string;
	business_id: UUID;
	customer_id: UUID;
	user_id: UUID;
	case_id: UUID;
	template_id: UUID;
	data: CustomFieldAuditData[];
	created_at: Date;
}
