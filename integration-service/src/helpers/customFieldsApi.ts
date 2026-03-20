import { envConfig } from "#configs/index";
import { ERROR_CODES } from "#constants/index";
import { logger } from "#helpers/index";
import axios, { AxiosRequestConfig, isAxiosError } from "axios";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { InternalApiError } from "./api";

/**
 * Custom field template from case-service
 */
export interface CustomFieldTemplate {
	id: UUID;
	customer_id: UUID;
	version: number;
	title: string;
	is_enabled: boolean;
	created_at: string;
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
	/** Property code from core_field_properties (e.g., "dropdown", "text", "boolean", "date", "upload") */
	property_code: string | null;
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
 * Custom field value from case-service
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
 * Get the custom field template for a customer
 */
export const getCustomFieldTemplate = async (customerID: UUID): Promise<CustomFieldTemplate | null> => {
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/customers/${customerID}/custom-field-template`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios.request(config);
		return response.data?.data ?? null;
	} catch (error) {
		if (isAxiosError(error) && error.response?.status === 404) {
			// No template found - return null
			return null;
		}

		logger.error({ error, customerID }, "Failed to get custom field template");
		throw new InternalApiError(
			"Something went wrong fetching custom field template",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

/**
 * Get custom field definitions for a template
 */
export const getCustomFields = async (templateId: UUID): Promise<CustomFieldDefinition[] | null> => {
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/custom-fields/templates/${templateId}/fields`,
			headers: {
				"Content-Type": "application/json"
			}
		};

		const response = await axios.request(config);
		return response.data?.data ?? null;
	} catch (error) {
		if (isAxiosError(error) && error.response?.status === 404) {
			return null;
		}

		logger.error({ error, templateId }, "Failed to get custom field definitions");
		throw new InternalApiError(
			"Something went wrong fetching custom field definitions",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

/**
 * Get custom field values for a business/case
 */
export const getCustomFieldValues = async (
	businessID: UUID,
	caseID: UUID,
	templateId: UUID
): Promise<CustomFieldValue[] | null> => {
	try {
		const config: AxiosRequestConfig = {
			method: "get",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/businesses/${businessID}/cases/${caseID}/custom-fields`,
			headers: {
				"Content-Type": "application/json"
			},
			params: {
				templateId
			}
		};

		const response = await axios.request(config);
		return response.data?.data ?? null;
	} catch (error) {
		if (isAxiosError(error) && error.response?.status === 404) {
			return null;
		}

		logger.error({ error, businessID, caseID, templateId }, "Failed to get custom field values");
		throw new InternalApiError(
			"Something went wrong fetching custom field values",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.UNKNOWN_ERROR
		);
	}
};

/**
 * Update custom field values via case-service internal API
 */
export const updateCustomFieldValues = async (params: {
	businessID: UUID;
	caseID: UUID;
	templateId: UUID;
	fields: Array<{
		customer_field_id: string;
		value: string | null;
		type: string;
		value_id?: UUID;
	}>;
	userID: UUID;
}): Promise<void> => {
	const { businessID, caseID, templateId, fields, userID } = params;

	try {
		const config: AxiosRequestConfig = {
			method: "patch",
			url: `${envConfig.CASE_BASE_URL}/api/v1/internal/businesses/${businessID}/cases/${caseID}/custom-fields`,
			headers: {
				"Content-Type": "application/json"
			},
			data: {
				businessId: businessID,
				templateId,
				fields,
				userId: userID
			}
		};

		await axios.request(config);
		logger.info({ businessID, caseID, fieldsCount: fields.length }, "Custom fields updated successfully");
	} catch (error) {
		logger.error({ error, businessID, caseID, templateId }, "Failed to update custom field values");

		if (isAxiosError(error)) {
			throw new InternalApiError(
				"Something went wrong updating custom fields",
				error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR,
				error.response?.data?.errorCode || ERROR_CODES.UNKNOWN_ERROR
			);
		}

		throw error;
	}
};

/**
 * Get custom fields with their values for a business/case
 * This is a combined call that returns field definitions with current values
 */
export const getCustomFieldsWithValues = async (params: {
	businessID: UUID;
	caseID: UUID;
	customerID: UUID;
}): Promise<{
	template: CustomFieldTemplate | null;
	fields: Array<CustomFieldDefinition & { value: string | null }>;
} | null> => {
	const { businessID, caseID, customerID } = params;

	try {
		// Get template
		const template = await getCustomFieldTemplate(customerID);
		if (!template) {
			return null;
		}

		// Get field definitions
		const definitions = await getCustomFields(template.id);
		if (!definitions) {
			return { template, fields: [] };
		}

		// Get current values
		const values = await getCustomFieldValues(businessID, caseID, template.id);

		// Merge definitions with values
		const fields = definitions.map(def => {
			const fieldValue = values?.find(v => v.field_id === def.id);
			return {
				...def,
				value: fieldValue?.field_value ?? null
			};
		});

		return { template, fields };
	} catch (error) {
		logger.error({ error, businessID, caseID, customerID }, "Failed to get custom fields with values");
		throw error;
	}
};
