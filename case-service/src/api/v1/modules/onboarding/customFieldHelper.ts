import { StatusCodes } from "http-status-codes";
import { OnboardingApiError } from "./error";
import type { BusinessCustomFieldResponse, NormalizedCustomFieldValues } from "./types";
import { BUCKETS, DIRECTORIES, ERROR_CODES, ROLES } from "#constants";
import { CustomField } from "./customField";
import { BusinessCustomField } from "./businessCustomField";
import type { UUID } from "crypto";
import { joiExtended, logger } from "#helpers";
import { uploadFile as uploadFileToS3, copyFile } from "#utils";
import { BusinessInvites } from "../businesses/businessInvites";
import type { BusinessInvite } from "#types/businessInvite";
import { parse } from "#helpers/expressions";

export abstract class CustomFieldHelper {
	private static INVITES_FILE_PATH = `${DIRECTORIES.CUSTOM_FIELD_FILES}/customers/:customerID/invites/:inviteID`;
	private static CASES_FILE_PATH = `${DIRECTORIES.CUSTOM_FIELD_FILES}/businesses/:businessID/cases/:caseID`;
	private static BUCKET = BUCKETS.BACKEND;

	static getDirectoryForInvites(customerID: UUID, inviteID: UUID) {
		return this.INVITES_FILE_PATH.replace(":customerID", customerID).replace(":inviteID", inviteID);
	}
	static getDirectoryForCases(businessID: UUID, caseID: UUID) {
		return this.CASES_FILE_PATH.replace(":businessID", businessID).replace(":caseID", caseID);
	}

	/***
	 * Given the array of fields normalize them into a key value pairs
	 * @param {CustomField[]} customFields - The array of custom fields for a template
	 * @param {Record<string, any>} givenValues - The provided key value pairs of field values
	 * @returns {Promise<NormalizedCustomFieldValues>} - The normalized Records
	 * 	The returned object is a Record of field_code -> field_value
	 */
	static normalizeCustomFields = (
		customFields: CustomField[],
		givenValues: Record<string, any>
	): NormalizedCustomFieldValues => {
		if (Object.keys(givenValues).length === 0) {
			throw new OnboardingApiError("No fields to normalize", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		if (customFields.length === 0) {
			throw new OnboardingApiError("No custom fields found for customer", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		// Normalize the fields we were given to code,value pairs that relate to the custom fields in the template
		return Object.entries(givenValues).reduce((acc, [key, value]) => {
			const customField = customFields.find(field => field.getId() === key || field.getCode() === key);
			if (customField) {
				if (customField.isCheckbox() || customField.isFile()) {
					if (!Array.isArray(value)) {
						try {
							value = JSON.parse(value);
						} catch (_error) {
							value = [value];
						}
					}
				}
				acc[customField.getCode()] = value;
			} else {
				logger.warn(`Ignored custom field with key ${key}`);
			}
			return acc;
		}, {});
	};

	static getRequiredFields = (customFields: CustomField[]): CustomField[] => {
		return customFields.filter(field => field.isRequired());
	};

	static async uploadFile(directory: string, file: Express.Multer.File) {
		const { buffer, originalname } = file;
		if (!buffer || !originalname) {
			throw new OnboardingApiError("No file buffer or filename found", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		let contentType = originalname.split(".").pop();
		if (contentType === "pdf") {
			contentType = "application/pdf";
		}

		return uploadFileToS3(buffer, originalname, contentType, directory, BUCKETS.BACKEND);
	}

	/**
	 * Copy a file for invite to a case instead
	 * @param field
	 * @param inviteID
	 * @returns {Promise<BusinessCustomField>} - The updated BusinessCustomField
	 */
	static async copyInviteFileToCase(inviteID: UUID, field: BusinessCustomField): Promise<BusinessCustomField> {
		const invite = await BusinessInvites.fromId(inviteID);
		if (!invite) {
			throw new OnboardingApiError("Could not find invite", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		const { customer_id } = invite;
		const { business_id, case_id, field_value } = field.get();

		const inviteDirectory = CustomFieldHelper.getDirectoryForInvites(customer_id, invite.id);
		const currentPath = `${inviteDirectory}/${field_value}`;
		const newDirectory = CustomFieldHelper.getDirectoryForCases(business_id, case_id);
		const fieldParts = field_value.split(".");
		let contentType = fieldParts.pop();
		const fileName = fieldParts.join(".");

		const newFile = `${fileName}.${contentType}`;
		const newPath = `${newDirectory}/${newFile}`;

		try {
			await copyFile(currentPath, newPath, this.BUCKET);
			await field.setValue(newFile).save();
			return field;
		} catch (error) {
			logger.error({ error }, `Error copying invite file ${currentPath} to case at ${newPath}`);
			throw new OnboardingApiError(
				"Error copying invite file to case",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}

	static validateCustomerCustomFields(
		templateCustomFields: CustomField[],
		providedCustomFieldValues: NormalizedCustomFieldValues
	): void {
		const problems: string[] = [];

		const providedKeys = Object.keys(providedCustomFieldValues);

		const allFields = templateCustomFields.map(field => field.getCode());
		const requiredFields = templateCustomFields.filter(field => field.isRequired() && field.isEditable(ROLES.CUSTOMER));

		// Identify povided fields that are not editable by the customer
		const nonEditableFields = templateCustomFields
			.filter(field => !field.isEditable(ROLES.CUSTOMER))
			.map(field => field.getCode());
		if (nonEditableFields.length) {
			const nonEditableProvidedKeys = providedKeys.filter(key => nonEditableFields.includes(key));
			if (nonEditableProvidedKeys.length) {
				problems.push(
					`The following custom fields are not editable by your role: ${nonEditableProvidedKeys.join(", ")}`
				);
			}
		}

		// Identify fields that aren't actually custom fields
		const orphanFields = providedKeys.filter(field => !allFields.includes(field));
		if (orphanFields.length) {
			problems.push(`The following customfields are not present in the template: ${orphanFields.join(", ")}`);
		}

		// trim the customs fields json
		const trimmedCustomFields = templateCustomFields.map(item => ({
			key: item.getCode(),
			property: item.getProperty(),
			value: parse(providedCustomFieldValues[item.getCode()])
		}));
		// Identify the fields that are not present in the request and that are only editable by the cutomer
		const missingFields = requiredFields.filter(field => !providedKeys.includes(field.getCode()));
		const visibleMissingFields = missingFields.filter(
			field => field.isVisible(ROLES.CUSTOMER) && field.isConditionallyVisible(field.get(), trimmedCustomFields)
		);
		if (visibleMissingFields.length) {
			problems.push(
				`The following customfields are required and were not provided: ${missingFields
					.map(field => field.getCode())
					.join(", ")}`
			);
		}

		// TODO: Validate data types

		//Throw if we have any errors
		if (problems.length) {
			throw new OnboardingApiError(problems.join("\n"), StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
	}

	private static async createBusinessCustomField(
		invite: Pick<BusinessInvite.Record, "id" | "case_id" | "customer_id" | "created_by">,
		fieldCode: string,
		customFieldTemplateID: UUID,
		value: string
	): Promise<BusinessCustomField | undefined> {
		if (!invite.case_id) {
			throw new OnboardingApiError("Case ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		const businessCustomField = await BusinessCustomField.forCase({
			caseId: invite.case_id,
			fieldCode: fieldCode,
			templateId: customFieldTemplateID,
			value,
			userId: invite.created_by,
			customerId: invite.customer_id
		});
		const savedField = await businessCustomField.save(invite.created_by);
		if (savedField) {
			const { id } = savedField?.get();
			if (id) {
				return savedField;
			}
		}
		return undefined;
	}

	static async saveCustomFieldValuesFromInvite(
		invite: Pick<BusinessInvite.Record, "id" | "case_id" | "customer_id" | "created_by">,
		customFieldTemplateID: UUID,
		customFields: NormalizedCustomFieldValues
	): Promise<Record<string, BusinessCustomField>> {
		logger.debug(`Saving custom field values from invite ${invite.id} to case ${invite.case_id}`);
		const savedFields: Record<string, BusinessCustomField> = {};
		if (!invite.case_id) {
			throw new OnboardingApiError("Case ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		for (const fieldCode in customFields) {
			// Get the field for the template
			const field = await CustomField.fromFieldCodeAndTemplateId(fieldCode, customFieldTemplateID);
			if (!field) {
				throw new OnboardingApiError(
					`Custom field with code ${fieldCode} not found in template ${customFieldTemplateID}`,
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
			let fieldValues: unknown | Array<unknown> = customFields[fieldCode];
			// If the field is a file then we need to make sure we are trying to parse the value as an array
			if (field.isFile()) {
				if (typeof fieldValues === "string") {
					try {
						fieldValues = JSON.parse(fieldValues);
					} catch (_error) {
						fieldValues = [fieldValues];
					}
				}
			}
			// When a checkbox, we want to turn a possible array into a JSON string instead :)
			if (field.isCheckbox()) {
				if (Array.isArray(fieldValues)) {
					fieldValues = JSON.stringify(fieldValues);
				}
			}
			if (!Array.isArray(fieldValues)) {
				fieldValues = [fieldValues];
			}
			if (Array.isArray(fieldValues)) {
				// Coerce the fieldValues as an array of strings so we can make sure we're not assigning any "any" type to the savedFields
				for (const value of fieldValues as Array<string>) {
					const businessCustomField = await CustomFieldHelper.createBusinessCustomField(
						invite,
						fieldCode,
						customFieldTemplateID,
						value
					);
					if (businessCustomField) {
						savedFields[fieldCode] = businessCustomField;
						if (field.isFile()) {
							const inviteFile = await CustomFieldHelper.copyInviteFileToCase(invite.id, businessCustomField);
							savedFields[fieldCode] = inviteFile;
						}
					}
				}
			}
		}
		return savedFields;
	}

	static validateCustomFieldValues(fields: BusinessCustomFieldResponse[]) {
		let schema: any;
		let errorMsg = "";
		for (const field of fields) {
			schema = null;
			let { value, type, rules } = field;
			value = value?.toString();
			if (!rules || !value) continue;
			switch (type) {
				case "integer":
					const properties1 = rules.reduce(
						(acc, rule) => {
							if (rule.rule === "minimum") acc.min = parseInt(rule.value);
							if (rule.rule === "maximum") acc.max = parseInt(rule.value);
							return acc;
						},
						{ min: 0, max: parseInt(value) }
					);
					schema = joiExtended.number().integer().min(properties1.min).max(properties1.max);
					break;
				case "text":
				case "full_text":
				case "alphanumeric":
					const properties2 = rules.reduce(
						(acc, rule) => {
							if (rule.rule === "minLength") acc.min = parseInt(rule.value);
							if (rule.rule === "maxLength") acc.max = parseInt(rule.value);
							return acc;
						},
						{ min: 0, max: value.length }
					);
					schema = joiExtended.string().min(properties2.min).max(properties2.max);
					break;
				case "email":
					schema = joiExtended.emailextended().noDisposableDomains().lowercase().trim();
					break;
				case "decimal":
					const properties3 = rules.reduce(
						(acc, rule) => {
							if (rule.rule === "minimum") acc.min = parseInt(rule.value);
							if (rule.rule === "maximum") acc.max = parseInt(rule.value);
							if (rule.rule === "decimalPlaces") acc.decimal = parseInt(rule.value);
							return acc;
						},
						{ min: 0 }
					);
					const createDecimalPattern = (decimalPlaces?: number) => {
						if (decimalPlaces) {
							return new RegExp(`^\\d+(\\.\\d{1,${decimalPlaces}})?$`);
						}
						return new RegExp(`^\\d+(\\.\\d+)?$`); // Allows any number of decimal places when no rule is specified
					};
					const decimalPattern = createDecimalPattern(properties3.decimal ? parseInt(properties3.decimal) : undefined);
					schema = joiExtended
						.string()
						.pattern(decimalPattern, "decimal number")
						.custom((value, helpers) => {
							const numberValue = parseFloat(value);
							if (isNaN(numberValue) || numberValue < properties3.min || numberValue > properties3.max) {
								return helpers.error("any.invalid");
							}
							return numberValue;
						});
					break;
				case "boolean":
					schema = joiExtended.string().lowercase().valid("true", "false");
					break;
				case "phone_number":
					const phoneNumberPattern = /^\d{10}$/;
					schema = joiExtended.string().pattern(phoneNumberPattern, "phone number");
			}
			if (schema) {
				const { error } = schema.validate(value);
				if (error && error.details.length) {
					errorMsg = error.details[0].message;
					return { error: true, message: errorMsg };
				}
			} else {
				continue;
			}
		}
		return { error: false, message: errorMsg };
	}
}
