import { FEATURE_FLAGS, kafkaEvents, kafkaTopics } from "#constants/index";
import { getFlagValue, logger, producer } from "#helpers/index";
import { getOnboardingCaseByBusinessId } from "#helpers/index";
import type { UUID } from "crypto";
import { CustomFieldPermissionError, CustomFieldValidationError } from "./error";
import type {
	CustomFieldAuditData,
	CustomFieldAuditEvent,
	CustomFieldUpdateContext,
	CustomFieldResponse,
	UpdateCustomFieldsRequestBody
} from "./types";
import {
	getCustomFields,
	getCustomFieldValues,
	updateCustomFieldValues,
	getCustomFieldTemplate
} from "#helpers/customFieldsApi";

export class CustomFieldsService {
	/**
	 * Get custom fields for a business
	 */
	static async getCustomFields(params: {
		businessID: UUID;
		customerID: UUID;
	}): Promise<CustomFieldResponse[]> {
		const { businessID, customerID } = params;

		try {
			const template = await getCustomFieldTemplate(customerID);
			if (!template) {
				return [];
			}

			const fieldDefinitions = await getCustomFields(template.id);
			if (!fieldDefinitions?.length) {
				return [];
			}

			// Get caseID for fetching values
			let caseID: UUID | undefined;
			try {
				const onboardingCase = await getOnboardingCaseByBusinessId(businessID, customerID);
				caseID = onboardingCase?.id as UUID;
			} catch {
				logger.warn({ businessID, customerID }, "Could not find onboarding case");
			}

			// Get current values if we have a caseID
			const fieldValues = caseID ? await getCustomFieldValues(businessID, caseID, template.id) : null;

			return fieldDefinitions.map(field => ({
				field_id: field.id,
				field_code: field.code,
				field_label: field.label,
				field_type: field.type,
				value: fieldValues?.find(v => v.field_id === field.id)?.field_value ?? null,
				template_id: template.id
			}));
		} catch (error) {
			logger.error({ error, businessID }, "Error fetching custom fields");
			throw error;
		}
	}

	/**
	 * Update custom fields
	 */
	static async updateCustomFields(
		updates: UpdateCustomFieldsRequestBody,
		context: CustomFieldUpdateContext
	): Promise<CustomFieldResponse[]> {
		const { businessID, customerID, userID } = context;

		try {
			// Check feature flag
			const isEnabled = await getFlagValue(FEATURE_FLAGS.PAT_874_CM_APP_EDITING, {
				key: "customer",
				kind: "customer",
				customer_id: customerID as string
			});

			if (!isEnabled) {
				throw new CustomFieldPermissionError("Custom fields editing is not enabled");
			}

			// Validate payload
			this.validateUpdatePayload(updates);

			// Get template
			const template = await getCustomFieldTemplate(customerID);
			if (!template) {
				throw new CustomFieldValidationError("No custom field template found");
			}

			// Get caseID
			const onboardingCase = await getOnboardingCaseByBusinessId(businessID, customerID);
			const caseID = onboardingCase?.id as UUID;
			if (!caseID) {
				throw new CustomFieldValidationError("Could not find case for business");
			}

			// Get field definitions and current values
			const fieldDefinitions = await getCustomFields(template.id);
			
			if (!fieldDefinitions || fieldDefinitions.length === 0) {
				throw new CustomFieldValidationError("No field definitions found for template");
			}

			const currentValues = await getCustomFieldValues(businessID, caseID, template.id);

			// Check we have updates to process
			const updateEntries = Object.entries(updates);
			
			if (updateEntries.length === 0) {
				throw new CustomFieldValidationError("No fields to update");
			}

			// Build fields to update
			const auditData: CustomFieldAuditData[] = [];
			const fieldsToUpdate = updateEntries.map(([fieldKey, payload]) => {
				const fieldDef = fieldDefinitions.find(
					f => f.id === fieldKey || f.code === fieldKey || f.code.toLowerCase() === fieldKey.toLowerCase()
				);

				if (!fieldDef) {
					logger.warn({ fieldKey, availableFields: fieldDefinitions.map(f => ({ id: f.id, code: f.code })) }, "Field not found");
					throw new CustomFieldValidationError(`Field "${fieldKey}" not found in template`);
				}
				
				const propertyCode = fieldDef.property_code ?? null;

				// Format value according to the field's property type so it matches
				// the storage format expected by the case-service readers
				const serializedValue = this.serializeFieldValue(payload.value, propertyCode);

				const currentValue = currentValues?.find(v => v.field_id === fieldDef.id);

				auditData.push({
					field_id: fieldDef.id as UUID,
					field_code: fieldDef.code,
					field_label: fieldDef.label,
					field_type: propertyCode ?? fieldDef.type,
					previous_value: currentValue?.field_value ?? null,
					new_value: serializedValue,
					comment: payload.comment
				});

				return {
					customer_field_id: fieldDef.id,
					value: serializedValue,
					type: propertyCode ?? fieldDef.type ?? "text"
				};
			});

			// Update in case-service
			await updateCustomFieldValues({
				businessID,
				caseID,
				templateId: template.id,
				fields: fieldsToUpdate,
				userID
			});

			// Send audit event
			await this.sendAuditEvent({
				businessID,
				caseID,
				customerID,
				templateId: template.id,
				userID,
				auditData
			});

			return this.getCustomFields({ businessID, customerID });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorStack = error instanceof Error ? error.stack : undefined;
			logger.error({ 
				errorMessage, 
				errorStack,
				errorName: error instanceof Error ? error.name : 'Unknown',
				businessID, 
				context 
			}, "Error updating custom fields");
			throw error;
		}
	}

	/**
	 * Delete custom fields (set to null)
	 */
	static async deleteCustomFields(
		fieldIds: string[],
		context: CustomFieldUpdateContext
	): Promise<CustomFieldResponse[]> {
		const updates: UpdateCustomFieldsRequestBody = {};
		fieldIds.forEach(id => {
			updates[id] = { value: null };
		});
		return this.updateCustomFields(updates, context);
	}

	private static validateUpdatePayload(updates: UpdateCustomFieldsRequestBody): void {
		if (!updates || typeof updates !== "object") {
			throw new CustomFieldValidationError("Invalid payload: must be an object");
		}

		for (const [fieldId, payload] of Object.entries(updates)) {
			if (!fieldId) {
				throw new CustomFieldValidationError("Invalid field ID");
			}
			if (payload !== null && payload !== undefined && (typeof payload !== "object" || !("value" in payload))) {
				throw new CustomFieldValidationError(`Invalid payload for field ${fieldId}`);
			}
		}
	}

	/**
	 * Serialize a field value to the string format expected by the case-service
	 * for each property type.
	 *
	 * - dropdown: stored as JSON `{"label":"...","value":"..."}` so the reader
	 *   can do `JSON.parse(value).label`
	 * - boolean: stored as "true" / "false"
	 * - all others: stored as plain string
	 */
	private static serializeFieldValue(value: unknown, propertyCode: string | null): string | null {
		if (value === null || value === undefined) return null;

		if (propertyCode === "dropdown") {
			// If already a JSON object with label, stringify it as-is
			if (typeof value === "object" && value !== null && "label" in (value as Record<string, unknown>)) {
				return JSON.stringify(value);
			}
			// Plain string → wrap in the expected dropdown format
			const label = typeof value === "string" ? value : String(value);
			return JSON.stringify({ label, value: label });
		}

		if (typeof value === "string") return value;
		if (typeof value === "number" || typeof value === "boolean") return String(value);
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	}

	private static async sendAuditEvent(params: {
		businessID: UUID;
		caseID: UUID;
		customerID: UUID;
		templateId: UUID;
		userID: UUID;
		auditData: CustomFieldAuditData[];
	}): Promise<void> {
		const { businessID, caseID, customerID, templateId, userID, auditData } = params;

		const changedFields = auditData.filter(f => f.previous_value !== f.new_value);
		if (!changedFields.length) return;

		const event: CustomFieldAuditEvent = {
			event: kafkaEvents.CUSTOM_FIELD_UPDATED_AUDIT,
			business_id: businessID,
			customer_id: customerID,
			user_id: userID,
			case_id: caseID,
			template_id: templateId,
			data: changedFields,
			created_at: new Date()
		};

		try {
			await producer.send({
				topic: kafkaTopics.NOTIFICATIONS,
				messages: [{ key: businessID, value: event }]
			});
			logger.info({ businessID, fieldsUpdated: changedFields.length }, "Audit event sent");
		} catch (error) {
			logger.error({ error, businessID }, "Failed to send audit event");
		}
	}
}
