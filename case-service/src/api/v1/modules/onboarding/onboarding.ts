import { v4 as uuid } from "uuid";
import {
	db,
	getCustomerIntegrationSettings,
	logger,
	producer,
	sqlQuery,
	sqlSequencedTransaction,
	sqlTransaction
} from "#helpers/index";
import { paginate } from "#utils/index";
import { convertFileToJson } from "#utils/csvToJson";
import { copyFile } from "#utils/s3";
import { OnboardingApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import {
	ERROR_CODES,
	BUCKETS,
	DIRECTORIES,
	CUSTOM_ONBOARDING_SETUP,
	CUSTOM_ONBOARDING_TYPES,
	CUSTOM_ONBOARDING_SETUP_ID,
	SECTION_VISIBILITY,
	kafkaTopics,
	kafkaEvents,
	FIELD_ACCESS,
	type FieldAccess
} from "#constants/index";
import { uploadFile, getCachedSignedUrl } from "#utils/s3";
import { envConfig } from "#configs/index";
import { randomUUID, UUID } from "crypto";
import { businesses } from "../businesses/businesses";
import { onboardingServiceRepository } from "./repository";
import type { BusinessCustomFieldEnriched, DetailedBusinessCustomFields, ICustomField, ICustomTemplate, ICustomerCustomFieldsSummary } from "./types";
import { CustomField, type Role } from "./customField";
import { BusinessCustomField } from "./businessCustomField";
import { CustomFieldHelper } from "./customFieldHelper";
import { BusinessInvites } from "../businesses/businessInvites";

class Onboarding {
	private constrainToEnum<T = string>(value: T, column: string, enumType: Record<any, T>): T {
		// Type guard to check if T is a string
		const isString = (value: string | T): value is string => typeof value === "string";

		// Make case-insensitive & replace spaces with underscores if string
		const normalizedValue: T = isString(value) ? (value.replace(/ /g, "_").toUpperCase() as T) : value;

		if (!Object.values(enumType).includes(normalizedValue)) {
			throw new OnboardingApiError(
				`Invalid value for ${column}: ${value}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		return normalizedValue;
	}

	async createCustomTemplate(params: { customerID: string }, file: any, userInfo: any) {
		try {
			console.debug("create custom template", params, file);

			if (!file) {
				throw new OnboardingApiError("Please upload csv file", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}

			const csvCheck = await this.validateCsv(file);
			if (!csvCheck.is_valid) {
				throw new OnboardingApiError(csvCheck.message, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
			}
			const csvHeaders = {
				stepName: "Step Name",
				sectionName: "Section Name",
				fieldName: "Field name",
				internalName: "Internal Name",
				isSensitive: "Is a sensitive data ?",
				rules: "Rules",
				fieldType: "Field type",
				defaultValue: "Default Value",
				fieldOptions: "Field Options",
				sectionVisibility: "Section Visibility",
				applicantAccess: "Applicant Access",
				customerAccess: "Customer Access",

				//conditional logic
				visibilityDependency: "Visibility dependency",
				visibilityValue: "Visibility",
				calculationDependency: "Calculation dependency",
				calculation: "Calculation",
				conditionalRulesDependency: "Conditional rules dependency",
				conditionalRulesValue: "Conditional rules",
				fieldDescription: "Field Description/ Information"
			};

			const jsonArray = await convertFileToJson(undefined, file.buffer);

			let queries: string[] = [];
			let values: any[] = [];

			const customerID = params.customerID;

			const getTemplates = `SELECT id FROM onboarding_schema.data_custom_templates WHERE customer_id = $1`;
			const getTemplatesResult = await sqlQuery({ sql: getTemplates, values: [customerID] });
			const version = getTemplatesResult.rows.length + 1;
			const templateID = uuid();
			const fileNameExtension = file.originalname.split(".");
			const metadata = { fileName: `${fileNameExtension[0]}_version${version}.${fileNameExtension[1]}` };
			const createdBy = userInfo.user_id;

			const insertQueryForCustomTemplates = `INSERT INTO onboarding_schema.data_custom_templates(id, customer_id, version, title, metadata, created_by, updated_by, is_enabled)
								VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

			queries.push(insertQueryForCustomTemplates);
			values.push([templateID, customerID, version, customerID, metadata, createdBy, createdBy, true]);

			//cutoms fields
			const insertQueryForCustomFields = `INSERT INTO onboarding_schema.data_custom_fields(id, template_id, label, code, type, property, rules, is_sensitive, step_name, section_name, sequence_number, conditional_logic, section_visibility, applicant_access, customer_access)
								VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,$10, $11, $12, $13, $14, $15)`;

			const getCorePropertiesQuery = `SELECT id, code, label FROM onboarding_schema.core_field_properties`;
			const getCorePropertiesResult = await sqlQuery({ sql: getCorePropertiesQuery });

			if (!getCorePropertiesResult.rows.length) {
				throw new OnboardingApiError(
					"No data found in Core Properties table",
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.NOT_FOUND
				);
			}

			// get all the codes
			const codeList = jsonArray.map(json => json[csvHeaders.internalName]);

			let sequenceNumber = 0;
			for (const json of jsonArray) {
				sequenceNumber++;
				if (!json[csvHeaders.fieldName]) break;
				const fieldID = uuid();
				const label = json[csvHeaders.fieldName];
				const code = json[csvHeaders.internalName];
				const stepName = json[csvHeaders.stepName];
				if (!json[csvHeaders.sectionName]) break;
				const sectionName = json[csvHeaders.sectionName];
				const sectionVisibility = json[csvHeaders.sectionVisibility]?.trim() || SECTION_VISIBILITY.DEFAULT;
				const applicantAccess = this.constrainToEnum<FieldAccess>(
					json[csvHeaders.applicantAccess]?.trim() || FIELD_ACCESS.DEFAULT,
					"Applicant Access",
					FIELD_ACCESS
				);
				const customerAccess = this.constrainToEnum<FieldAccess>(
					json[csvHeaders.customerAccess]?.trim() || FIELD_ACCESS.DEFAULT,
					"Customer Access",
					FIELD_ACCESS
				);
				const isSensitive = json[csvHeaders.isSensitive];
				const rules = createJsonSchema(
					json[csvHeaders.rules],
					code,
					json[csvHeaders.fieldType],
					json[csvHeaders.defaultValue],
					json[csvHeaders.fieldDescription]
				);
				const property = getCorePropertiesResult.rows.filter(row => {
					return row.label == json[csvHeaders.fieldType];
				});

				// Function to wrap array elements in the string with {{ }}
				function wrapWithBraces(array, str) {
					let result = str;
					array.forEach(value => {
						const regex = new RegExp(`\\b${value}\\b`, "g");
						result = result.replace(regex, `{{${value}}}`);
					});
					return result;
				}

				function replaceAndOr(str) {
					if (str.includes("and") || str.includes("or")) {
						return str.replace(/\band\b/g, "&&").replace(/\bor\b/g, "||");
					}
					return str;
				}

				// conditional logic
				const conditionalLogic: any = {};
				const conditionalLogicForFE: any = [];
				if (json[csvHeaders.visibilityDependency]) {
					conditionalLogic.visibilityDependency = json[csvHeaders.visibilityDependency];
					conditionalLogic.visibilityValue = json[csvHeaders.visibilityValue];
					const fields = codeList.filter(value => json[csvHeaders.visibilityDependency].includes(value));
					let dependency = wrapWithBraces(fields, json[csvHeaders.visibilityDependency]);
					dependency = replaceAndOr(dependency);
					conditionalLogicForFE.push({
						rule: "field_visibility",
						condition: {
							dependency,
							fields,
							visibility: json[csvHeaders.visibilityValue]
						}
					});
				}
				if (json[csvHeaders.calculation]) {
					conditionalLogic.calculation = json[csvHeaders.calculation];
					const fields = codeList.filter(value => json[csvHeaders.calculation].includes(value));
					const calculation = wrapWithBraces(fields, json[csvHeaders.calculation]);
					//dependency = replaceAndOr(dependency);
					conditionalLogicForFE.push({
						rule: "field_calculation",
						condition: {
							calculation,
							fields
						}
					});
				}
				if (json[csvHeaders.conditionalRulesDependency]) {
					conditionalLogic.conditionalRulesDependency = json[csvHeaders.conditionalRulesDependency];
					conditionalLogic.conditionalRulesValue = json[csvHeaders.conditionalRulesValue];
					const fields = codeList.filter(value => json[csvHeaders.conditionalRulesDependency].includes(value));
					let dependency = wrapWithBraces(fields, json[csvHeaders.conditionalRulesDependency]);
					dependency = replaceAndOr(dependency);
					//validation
					const rules = conditionalLogic.conditionalRulesValue.split(";");
					const validation: any = {};
					// for "required" create separate rule
					for (const rule of rules) {
						if (!rule) break;
						if (rule.trim() === "required") {
							conditionalLogicForFE.push({
								rule: "required_condition",
								condition: {
									dependency,
									fields
								}
							});
						} else {
							const [key, value] = rule.split(":");
							validation[key] = value;
						}
					}

					conditionalLogicForFE.push({
						rule: "field_validation",
						condition: {
							dependency,
							fields,
							validation
						}
					});
				}
				conditionalLogic.ruleList = conditionalLogicForFE;

				queries.push(insertQueryForCustomFields);
				values.push([
					fieldID,
					templateID,
					label,
					code,
					null,
					property[0]?.id,
					rules,
					isSensitive,
					stepName,
					sectionName,
					sequenceNumber,
					conditionalLogic,
					sectionVisibility,
					applicantAccess,
					customerAccess
				]);
				if (json[csvHeaders.fieldOptions]) {
					if (json[csvHeaders.fieldType] === "Checkbox") {
						const options = json[csvHeaders.fieldOptions].split(";");
						options.forEach(option => {
							let checkboxOption: any = option.split(",");
							let checkboxValues: any = [];
							checkboxOption.forEach(optionProperty => {
								const labelValue = optionProperty.split(":");
								if (labelValue[0]) {
									checkboxValues.push(labelValue[0]);
									checkboxValues.push(labelValue[1]);
								}
							});
							if (checkboxValues[0] && checkboxValues[1]) {
								const insertQueryForCustomFieldOptions = `INSERT INTO onboarding_schema.data_field_options(id, field_id, label, value, checkbox_type, input_type, icon, icon_position)
									VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
								queries.push(insertQueryForCustomFieldOptions);
								values.push([
									uuid(),
									fieldID,
									checkboxValues[0].trim(),
									checkboxValues[1].trim(),
									checkboxValues[2],
									checkboxValues[3],
									checkboxValues[4],
									checkboxValues[5]
								]);
							}
						});
					} else {
						const options = json[csvHeaders.fieldOptions].split(";");
						options.forEach(option => {
							const labelValue = option.split(":");
							const insertQueryForCustomFieldOptions = `INSERT INTO onboarding_schema.data_field_options(id, field_id, label, value)
									VALUES ($1, $2, $3, $4)`;
							queries.push(insertQueryForCustomFieldOptions);
							values.push([uuid(), fieldID, labelValue[0].trim(), labelValue[1].trim()]);
						});
					}
				}
			}

			await sqlSequencedTransaction(queries, values);

			const contentType = fileNameExtension[1];
			const directory = `${DIRECTORIES.CUSTOM_FIELDS}/customers/${customerID}`;
			await uploadFile(file.buffer, metadata.fileName, contentType, directory, BUCKETS.BACKEND);
		} catch (error: any) {
			throw error;
		}
	}

	async validateCsv(file: any) {
		const csvHeaders = {
			stepName: "Step Name",
			sectionName: "Section Name",
			fieldName: "Field name",
			internalName: "Internal Name",
			isSensitive: "Is a sensitive data ?",
			rules: "Rules",
			fieldType: "Field type",
			defaultValue: "Default Value",
			fieldOptions: "Field Options",
			sectionVisibility: "Section Visibility",
			applicantAccess: "Applicant Access",
			customerAccess: "Customer Access"
		};

		// If a column has a default value, we'll skip checking if it's missing from the CSV
		const defaultValues = {
			applicantAccess: FIELD_ACCESS.DEFAULT,
			customerAccess: FIELD_ACCESS.DEFAULT,
			sectionVisibility: SECTION_VISIBILITY.DEFAULT
		};

		try {
			const jsonArray = await convertFileToJson(undefined, file.buffer);

			const result = {
				is_valid: true,
				message: ""
			};

			const csvHeadersKeys = Object.keys(csvHeaders);
			const headersReceived = Object.keys(jsonArray[0]);
			csvHeadersKeys
				.filter(header => !defaultValues[header])
				.forEach(header => {
					// Skip if checking if a header has a default value because its fine if not defined in the CSV -- we'll just use the default
					if (headersReceived.indexOf(csvHeaders[header]) === -1) {
						result.is_valid = false;
						result.message = `Header ${csvHeaders[header]} missing`;
					}
				});
			if (result.is_valid) {
				const getCoreProperties = `SELECT label FROM onboarding_schema.core_field_properties`;
				const getCorePropertiesResult = await sqlQuery({ sql: getCoreProperties });
				if (!getCorePropertiesResult.rows.length) {
					throw new OnboardingApiError(
						"No data found in Core Properties table",
						StatusCodes.INTERNAL_SERVER_ERROR,
						ERROR_CODES.NOT_FOUND
					);
				}
				const propertiesArray = getCorePropertiesResult.rows.map(item => item.label);
				const ruleFields = [
					"required",
					"min",
					"max",
					"file_type",
					"max_file_size",
					"decimal_places",
					"sum",
					"equal",
					"min_num_files",
					"max_num_files"
				];
				try {
					let sectionVisibilityMap = new Map();
					for (const json of jsonArray) {
						if (!json[csvHeaders.fieldName]) break;
						if (!json[csvHeaders.sectionVisibility]?.trim())
							json[csvHeaders.sectionVisibility] = SECTION_VISIBILITY.DEFAULT;

						if (![SECTION_VISIBILITY.DEFAULT, SECTION_VISIBILITY.HIDDEN].includes(json[csvHeaders.sectionVisibility])) {
							result.is_valid = false;
							result.message = `Please check the ${csvHeaders.sectionVisibility} column values; they should be either '${SECTION_VISIBILITY.DEFAULT}' or '${SECTION_VISIBILITY.HIDDEN}' throughout the entire section.`;
							break;
						}

						if (sectionVisibilityMap.has(json[csvHeaders.sectionName])) {
							if (sectionVisibilityMap.get(json[csvHeaders.sectionName]) !== json[csvHeaders.sectionVisibility]) {
								result.is_valid = false;
								result.message = `Please check the ${csvHeaders.sectionVisibility} column values; they should be either '${SECTION_VISIBILITY.DEFAULT}' or '${SECTION_VISIBILITY.HIDDEN}' throughout the entire section.`;
								break;
							}
						} else {
							sectionVisibilityMap.set(json[csvHeaders.sectionName], json[csvHeaders.sectionVisibility]);
						}

						if (json[csvHeaders.applicantAccess]) {
							try {
								this.constrainToEnum<FieldAccess>(json[csvHeaders.applicantAccess], "Applicant Access", FIELD_ACCESS);
							} catch (_error) {
								result.is_valid = false;
								result.message = `Invalid access value for ${json[csvHeaders.fieldName]}`;
								break;
							}
						}
						if (json[csvHeaders.customerAccess]) {
							try {
								this.constrainToEnum<FieldAccess>(json[csvHeaders.customerAccess], "Customer Access", FIELD_ACCESS);
							} catch (_error) {
								result.is_valid = false;
								result.message = `Invalid access value for ${json[csvHeaders.fieldName]}`;
								break;
							}
						}
						if (!propertiesArray.includes(json[csvHeaders.fieldType])) {
							result.is_valid = false;
							result.message = `Invalid Field Type detected. Please ensure all Field Types are correctly spelled for ${
								json[csvHeaders.fieldName]
							}`;
							break;
						}
						if (json[csvHeaders.fieldType] === "Dropdown" && !json[csvHeaders.fieldOptions]) {
							result.is_valid = false;
							result.message = `Dropdown field options are missing. Please recheck and add them`;
							break;
						}
						if (!["TRUE", "FALSE"].includes(json[csvHeaders.isSensitive])) {
							result.is_valid = false;
							result.message = `Please correct Is Sensitive field for ${json[csvHeaders.fieldName]}`;
							break;
						}
						if (json[csvHeaders.fieldType] === "Boolean" && json[csvHeaders.fieldName].length > 10000) {
							result.is_valid = false;
							result.message = `The Boolean field label exceeds the maximum allowed length of 10,000 characters`;
							break;
						}
						const ruleArray = json["Rules"].split(";");
						for (const ruleStr of ruleArray) {
							if (!ruleStr) break;
							logger.debug("ruleStr", ruleStr, json[csvHeaders.fieldName]);
							const ruleField = ruleStr.split(":");
							logger.debug("ruleField", ruleField);
							if (!ruleFields.includes(ruleField[0])) {
								result.is_valid = false;
								result.message = `Please correct Rules for ${json[csvHeaders.fieldName]}`;
								break;
							}
							if (["min", "max", "decimal_places", "min_num_files", "max_num_files"].includes(ruleField[0])) {
								if (isNaN(ruleField[1])) {
									result.is_valid = false;
									result.message = `Please correct Rules for ${json[csvHeaders.fieldName]}`;
									break;
								}
							}
						}
						if (!result.is_valid) break;
					}
				} catch (_error: any) {
					throw new OnboardingApiError(
						"Please ensure all the Rules are in correct format",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}
			return result;
		} catch (error: any) {
			throw new OnboardingApiError(error.message, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async getCustomTemplate(params: { customerID: string; version: string }) {
		try {
			let getQueryForCustomTemplate;
			let getTemplatesResult;
			if (params.version) {
				getQueryForCustomTemplate = `SELECT * FROM onboarding_schema.data_custom_templates WHERE customer_id = $1 AND version = $2 AND is_enabled = TRUE`;
				getTemplatesResult = await sqlQuery({
					sql: getQueryForCustomTemplate,
					values: [params.customerID, params.version]
				});
			} else {
				getQueryForCustomTemplate = `SELECT * FROM onboarding_schema.data_custom_templates WHERE customer_id = $1 AND is_enabled = TRUE ORDER BY version DESC LIMIT 1`;
				getTemplatesResult = await sqlQuery({ sql: getQueryForCustomTemplate, values: [params.customerID] });
			}

			if (!getTemplatesResult.rows.length) {
				return {
					message: "No template found",
					data: {}
				};
			}

			const templateId = getTemplatesResult.rows[0].id;
			const version = getTemplatesResult.rows[0].version;
			const metadata = getTemplatesResult.rows[0].metadata;

			const getCustomFieldsQuery = `SELECT json_build_object(
                'id', dcf.id,
                'templateId', dcf.template_id,
                'label', dcf.label,
                'code', dcf.code,
                'property', json_agg(
                    json_build_object(
                    'id', cfp.id,
                    'label', cfp.label,
                    'code', cfp.code
                    )
                ),
                'rules', dcf.rules,
                'isSensitive', dcf.is_sensitive,
                'options', json_agg(
                    json_build_object(
                    'id', dfo.id,
                    'label', dfo.label,
                    'value', dfo.value
                    )
                )
            )
            FROM onboarding_schema.data_custom_fields dcf
            LEFT JOIN onboarding_schema.core_field_properties cfp ON dcf.property = cfp.id
            LEFT JOIN onboarding_schema.data_field_options dfo ON dcf.id = dfo.field_id
            WHERE dcf.template_id = $1
            GROUP BY dcf.id`;

			const getCustomFieldsResult = await sqlQuery({ sql: getCustomFieldsQuery, values: [templateId] });

			if (!getCustomFieldsResult.rows.length) {
				throw new OnboardingApiError(
					"No custom fields found",
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.NOT_FOUND
				);
			}

			// format custom fields result
			const customFieldsDetails = getCustomFieldsResult.rows.map(row => {
				const newRow = row.json_build_object;
				if (!newRow.options[0].id) {
					delete newRow.options;
				}
				newRow.property = newRow.property[0];
				return newRow;
			});

			const result: any = {
				template_id: templateId,
				version: version,
				custom_fields_details: customFieldsDetails,
				attachments: []
			};

			const file = await getCachedSignedUrl(
				metadata.fileName,
				`${DIRECTORIES.CUSTOM_FIELDS}/customers/${params.customerID}`,
				BUCKETS.BACKEND
			);
			result.attachments.push(file);

			return {
				message: "Custom template fetched successfully.",
				data: result
			};
		} catch (error) {
			throw error;
		}
	}

	async removeCustomTemplate(params: { customerID: string; version?: string }) {
		let disableTemplateQuery = `UPDATE onboarding_schema.data_custom_templates
				SET is_enabled = FALSE
				WHERE customer_id = $1`;
		const values = [params.customerID];
		if (params.version) {
			disableTemplateQuery = disableTemplateQuery + ` AND version = $2`;
			values.push(params.version);
		}
		const disableTemplateResult = await sqlQuery({ sql: disableTemplateQuery, values: values });
		if (!disableTemplateResult.rowCount) {
			throw new Error("No template found");
		}
	}

	async getSampleCustomTemplate() {
		try {
			const file = await getCachedSignedUrl(
				`${envConfig.CUSTOM_FIELDS_TEMPLATE}.csv`,
				`${DIRECTORIES.CUSTOM_FIELDS}`,
				BUCKETS.BACKEND
			);
			return file;
		} catch (error) {
			throw error;
		}
	}

	/*
	 * Get customer onboarding stages
	 * @param {Object} params - The request params- customerID
	 * @param {Object} query - The request body - setupType (modify_pages_fields_setup, onboarding_setup, white_label_setup, lightning_verification_setup)
	 * @param {Object} userInfo - The user information - user_id
	 * @returns {Promise} - The response - customer onboarding stages
	 */
	async getCustomerOnboardingStages(
		params: { customerID: string },
		query: { setupType: string },
		throwError: boolean = true
	) {
		try {
			// Get customer onboarding setups
			const getCustomerOnboardingSetupsQuery = `SELECT rcss.setup_id, rcss.is_enabled, cost.code, cost.label
				FROM onboarding_schema.rel_customer_setup_status rcss
				LEFT JOIN onboarding_schema.core_onboarding_setup_types cost ON cost.id = rcss.setup_id
				WHERE rcss.customer_id = $1 AND cost.code = $2`;
			const getCustomerOnboardingSetupsResult = await sqlQuery({
				sql: getCustomerOnboardingSetupsQuery,
				values: [params.customerID, query.setupType]
			});

			if (!getCustomerOnboardingSetupsResult.rows.length || !getCustomerOnboardingSetupsResult.rows[0].is_enabled) {
				if (throwError) {
					throw new OnboardingApiError(
						"Customer onboarding setup not found or not enabled",
						StatusCodes.NOT_FOUND,
						ERROR_CODES.NOT_FOUND
					);
				} else {
					return null;
				}
			} else {
				const getCustomerOnboardingStagesQuery = `SELECT dcos.id AS stage_id, dcos.stage, dcos.completion_weightage, dcos.allow_back_nav, dcos.is_skippable, dcos.is_enabled, dcos.is_removable, dcos.is_orderable, dcos.next_stage, dcos.prev_stage, dcos.priority_order, dcos.stage_code, dcsfc.config
					FROM onboarding_schema.data_customer_onboarding_stages dcos
					LEFT JOIN onboarding_schema.data_customer_stage_fields_config dcsfc ON dcsfc.customer_stage_id = dcos.id
					LEFT JOIN onboarding_schema.core_onboarding_stages cos ON cos.code = dcos.stage_code
					LEFT JOIN onboarding_schema.rel_onboarding_stage_type ON rel_onboarding_stage_type.stage_id = cos.id
					LEFT JOIN onboarding_schema.core_onboarding_types cot ON cot.id = rel_onboarding_stage_type.onboarding_type_id
					WHERE dcos.customer_id = $1 AND cot.code = $2`;
				const getCustomerOnboardingStagesValues = [params.customerID];
				getCustomerOnboardingStagesValues.push(
					query.setupType === CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
						? CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING
						: CUSTOM_ONBOARDING_TYPES.LIGHTNING_ONBOARDING
				);
				const getCustomerOnboardingStagesResult = await sqlQuery({
					sql: getCustomerOnboardingStagesQuery,
					values: getCustomerOnboardingStagesValues
				});
				return getCustomerOnboardingStagesResult.rows;
			}
		} catch (error) {
			throw error;
		}
	}

	/*
	 * Update customer onboarding stages
	 * @param {Object} params - The request params- customerID
	 * @param {Object} body - The request body - setupType (modify_pages_fields_setup, onboarding_setup, white_label_setup, lightning_verification_setup), stages
	 * @param {Object} userInfo - The user information - user_id
	 * @returns {Promise} - The response - customer onboarding stages updated successfully
	 */
	async updateCustomerOnboardingStages(
		params: { customerID: string },
		body: { setupType: string; stages: any },
		userInfo: any
	) {
		try {
			const customerIntegrationSettings = await getCustomerIntegrationSettings(params.customerID);
			if (customerIntegrationSettings?.settings?.gverify?.status === "ACTIVE") {
				const { bankingStage, ownershipStage } = body.stages.reduce(
					(acc, stage) => {
						if (stage.stage === "Banking") acc.bankingStage = stage;
						if (stage.stage === "Ownership") acc.ownershipStage = stage;
						return acc;
					},
					{ bankingStage: null, ownershipStage: null }
				);

				if (bankingStage !== null) {
					if (!bankingStage?.is_enabled) {
						throw new OnboardingApiError(
							"The Banking page cannot be removed while the GIACT gVerify feature is enabled. Disable it first to proceed.",
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					} else if (bankingStage?.is_skippable) {
						throw new OnboardingApiError(
							"Applicants cannot skip the Banking page in onboarding settings while the GIACT gVerify feature is enabled. Disable it first to proceed.",
							StatusCodes.BAD_REQUEST,
							ERROR_CODES.INVALID
						);
					}
				}

				if (customerIntegrationSettings?.settings?.gauthenticate?.status === "ACTIVE") {
					if (ownershipStage !== null) {
						if (!ownershipStage?.is_enabled) {
							throw new OnboardingApiError(
								"The Ownership page cannot be removed while the GIACT gAuthenticate feature is enabled. Disable it first to proceed.",
								StatusCodes.BAD_REQUEST,
								ERROR_CODES.INVALID
							);
						} else if (ownershipStage?.is_skippable) {
							throw new OnboardingApiError(
								"Applicants cannot skip the Ownership page in onboarding settings while the GIACT gAuthenticate feature is enabled. Disable it first to proceed.",
								StatusCodes.BAD_REQUEST,
								ERROR_CODES.INVALID
							);
						}
					}
				}
			}
			const queries: Array<string> = [];
			const values: any = [];
			const onboardingType =
				body.setupType === CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP
					? CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING
					: CUSTOM_ONBOARDING_TYPES.LIGHTNING_ONBOARDING;
			const updateCustomerOnboardingStagesQuery = `UPDATE onboarding_schema.data_customer_onboarding_stages
															SET
															stage = $1,
															is_enabled = CASE WHEN is_removable = false THEN is_enabled ELSE $2 END,
															updated_by = $3,
															is_skippable = $4
															WHERE customer_id = $5 AND id = $6`;
			body.stages.forEach((stage: any) => {
				queries.push(updateCustomerOnboardingStagesQuery);
				values.push([
					stage.stage,
					stage.is_enabled,
					userInfo.user_id,
					stage.is_skippable,
					params.customerID,
					stage.stage_id
				]);
				if (stage.config) {
					if (stage.config.fields) {
						stage.config.fields.forEach((field: any) => {
							// Update main field
							const updateFieldQuery = `
								UPDATE onboarding_schema.data_customer_stage_fields_config
								SET config = jsonb_set(
									config,
									'{fields}',
									(SELECT jsonb_agg(
										CASE
											WHEN item->>'name' = $1
												AND ($2::text IS NULL OR item->>'section_name' = $2)
												AND item->>'status' != 'Always Required'
											THEN
												CASE
													WHEN $3::text = 'true' OR $3::text = 'false'
													THEN jsonb_set(item, '{status}', to_jsonb($3::boolean))
													ELSE jsonb_set(item, '{status}', to_jsonb($3::text))
												END
											ELSE item
										END
									) FROM jsonb_array_elements(config->'fields') AS item)
								)
								WHERE customer_stage_id = $4 AND customer_id = $5
							`;
							queries.push(updateFieldQuery);
							values.push([field.name, field.section_name, field.status, stage.stage_id, params.customerID]);

							// Process subfields (no recursion required)
							if (field.sub_fields && Array.isArray(field.sub_fields)) {
								const updateSubFieldQuery = `
									UPDATE onboarding_schema.data_customer_stage_fields_config
									SET config = jsonb_set(
										config,
										'{fields}',
										(SELECT jsonb_agg(
											CASE
												WHEN item->>'name' = $1
													AND item->>'status' != 'Always Required'
												THEN
													CASE
														WHEN $2::text = 'true' OR $2::text = 'false'
														THEN jsonb_set(item, '{status}', to_jsonb($2::boolean))
														ELSE jsonb_set(item, '{status}', to_jsonb($2::text))
													END
												ELSE item
											END
										) FROM jsonb_array_elements(config->'fields') AS item)
									)
									WHERE customer_stage_id = $3 AND customer_id = $4
								`;
								field.sub_fields.forEach((sub_field: any) => {
									queries.push(updateSubFieldQuery);
									values.push([sub_field.name, sub_field.status, stage.stage_id, params.customerID]);
								});
							}
						});
					}

					if (stage.config.sub_fields) {
						stage.config.sub_fields.forEach((subfield: any) => {
							// Update main field
							const updateFieldQuery = `
								UPDATE onboarding_schema.data_customer_stage_fields_config
								SET config = (
									SELECT jsonb_set(
										config,
										'{fields}',
										jsonb_agg(
											CASE
												WHEN field->>'name' = $1
												THEN field || jsonb_build_object(
													'sub_fields',
													(SELECT jsonb_agg(
														CASE
															WHEN sub_field->>'name' = $2
															THEN jsonb_set(
																sub_field,
																'{status}',
																CASE
																	WHEN $3::text = 'true' THEN $3::jsonb
																	WHEN $3::text = 'false' THEN $3::jsonb
																	ELSE to_jsonb($3::text)
																END
															)
															ELSE sub_field
														END
													)
													FROM jsonb_array_elements(field->'sub_fields') AS sub_field)
												)
												ELSE field
											END
										)
									)
									FROM jsonb_array_elements(config->'fields') AS field
								)
								WHERE customer_stage_id = $4 AND customer_id = $5
							`;
							queries.push(updateFieldQuery);
							values.push([subfield.parent_name, subfield.name, subfield.status, stage.stage_id, params.customerID]);
						});
					}

					if (stage.config.integrations) {
						stage.config.integrations.forEach((integration: any) => {
							const updateCustomerStageFieldsConfigQuery = `UPDATE onboarding_schema.data_customer_stage_fields_config
								SET config = jsonb_set(
									config,
									'{integrations}',
									(SELECT jsonb_agg(
											  CASE
												  WHEN item->>'name' = $1
												  THEN jsonb_set(item, '{is_enabled}', to_jsonb($2::boolean))
												  ELSE item
											  END
										   )
									 FROM jsonb_array_elements(config->'integrations') AS item
									)
								)
								WHERE customer_stage_id = $3 AND customer_id = $4`;
							queries.push(updateCustomerStageFieldsConfigQuery);
							values.push([integration.name, integration.is_enabled, stage.stage_id, params.customerID]);
						});
					}
					if (stage.config.additional_settings) {
						stage.config.additional_settings.forEach((setting: any) => {
							const updateCustomerStageFieldsConfigQuery = `UPDATE onboarding_schema.data_customer_stage_fields_config
								SET config = jsonb_set(
									config,
									'{additional_settings}',
									(SELECT jsonb_agg(
											  CASE
												  WHEN item->>'name' = $1
												  THEN jsonb_set(item, '{is_enabled}', to_jsonb($2::boolean))
												  ELSE item
											  END
										   )
									 FROM jsonb_array_elements(config->'additional_settings') AS item
									)
								)
								WHERE customer_stage_id = $3 AND customer_id = $4`;
							queries.push(updateCustomerStageFieldsConfigQuery);
							values.push([setting.name, setting.is_enabled, stage.stage_id, params.customerID]);
						});
					}
				}
			});

			const nextStageQuery = `WITH next_stage_subquery AS (
										SELECT
											d1.id AS current_id,
											d2.id AS next_id
										FROM onboarding_schema.data_customer_onboarding_stages d1
										LEFT JOIN onboarding_schema.core_onboarding_stages cos ON cos.code = d1.stage_code
										LEFT JOIN onboarding_schema.rel_onboarding_stage_type ON rel_onboarding_stage_type.stage_id = cos.id
										LEFT JOIN onboarding_schema.core_onboarding_types cot ON cot.id = rel_onboarding_stage_type.onboarding_type_id
										LEFT JOIN LATERAL (
											SELECT id
											FROM onboarding_schema.data_customer_onboarding_stages
											WHERE customer_id = d1.customer_id
											AND priority_order > d1.priority_order
											AND is_enabled = TRUE
											ORDER BY priority_order ASC
											LIMIT 1
										) d2 ON TRUE
										WHERE d1.is_enabled = $1 and d1.customer_id = $2 AND cot.code = $3
									)
									UPDATE onboarding_schema.data_customer_onboarding_stages AS current_stage
									SET next_stage = next_stage_subquery.next_id
									FROM next_stage_subquery
									WHERE current_stage.id = next_stage_subquery.current_id`;
			queries.push(nextStageQuery);
			values.push([true, params.customerID, onboardingType]);
			const prevStageQuery = `WITH prev_stage_subquery AS (
										SELECT
											d1.id AS current_id,
											d2.id AS prev_id
										FROM onboarding_schema.data_customer_onboarding_stages d1
										LEFT JOIN onboarding_schema.core_onboarding_stages cos ON cos.code = d1.stage_code
										LEFT JOIN onboarding_schema.rel_onboarding_stage_type ON rel_onboarding_stage_type.stage_id = cos.id
										LEFT JOIN onboarding_schema.core_onboarding_types cot ON cot.id = rel_onboarding_stage_type.onboarding_type_id
										LEFT JOIN LATERAL (
											SELECT id
											FROM onboarding_schema.data_customer_onboarding_stages
											WHERE customer_id = d1.customer_id
											AND priority_order < d1.priority_order
											AND is_enabled = TRUE
											ORDER BY priority_order DESC
											LIMIT 1
										) d2 ON TRUE
										WHERE d1.is_enabled = $1 and d1.customer_id = $2 AND cot.code = $3
									)
									UPDATE onboarding_schema.data_customer_onboarding_stages AS current_stage
									SET prev_stage = prev_stage_subquery.prev_id
									FROM prev_stage_subquery
									WHERE current_stage.id = prev_stage_subquery.current_id`;
			queries.push(prevStageQuery);
			values.push([true, params.customerID, onboardingType]);
			await sqlSequencedTransaction(queries, values);
		} catch (error) {
			throw error;
		}
	}

	async getCustomerOnboardingSetups(params: { customerID: string }) {
		try {
			// Get customer onboarding setup records
			const getCustomerOnboardingSetupsQuery = `SELECT rcss.setup_id, rcss.is_enabled, cost.code, cost.label FROM onboarding_schema.rel_customer_setup_status rcss
			LEFT JOIN onboarding_schema.core_onboarding_setup_types cost ON cost.id = rcss.setup_id
			WHERE rcss.customer_id = $1;`;

			const getCustomerOnboardingSetupsResult = await sqlQuery({
				sql: getCustomerOnboardingSetupsQuery,
				values: [params.customerID]
			});

			return getCustomerOnboardingSetupsResult.rows;
		} catch (error) {
			throw error;
		}
	}

	async createCustomerOnboardingSetups(
		customerID: string,
		body: { module_permissions: Record<string, boolean> },
		user_id?: string
	) {
		try {
			// 1. Get all core setup types
			const coreSetups = await sqlQuery({
				sql: `SELECT * FROM onboarding_schema.core_onboarding_setup_types;`,
				values: []
			});

			const insertSetupQuery = `
				INSERT INTO onboarding_schema.rel_customer_setup_status (setup_id, customer_id, is_enabled)
				VALUES ($1, $2, $3)
    		`;

			const setupPermissionMap: Record<string, string> = {
				[CUSTOM_ONBOARDING_SETUP_ID.ONBOARDING_SETUP]: "onboarding",
				[CUSTOM_ONBOARDING_SETUP_ID.WHITE_LABEL_SETUP]: "white_labeling",
				[CUSTOM_ONBOARDING_SETUP_ID.MODIFY_PAGES_FIELDS_SETUP]: "modify_pages_fields",
				[CUSTOM_ONBOARDING_SETUP_ID.LIGHTNING_VERIFICATION_SETUP]: "lightning_verification",
				[CUSTOM_ONBOARDING_SETUP_ID.EQUIFAX_CREDIT_SCORE_SETUP]: "equifax_credit_score",
				[CUSTOM_ONBOARDING_SETUP_ID.POST_SUBMISSION_EDITING_SETUP]: "post_submission_editing",
				[CUSTOM_ONBOARDING_SETUP_ID.INTERNATIONAL_BUSINESS_SETUP]: "international_business"
			};

			let queries: string[] = [];
			let values: any[] = [];
			let isPageEnabled = false;

			const whiteLabelEnabled = body.module_permissions["white_labeling"] ?? false;

			const setups = coreSetups.rows.map(setup => {
				const permissionKey = setupPermissionMap[setup.id];
				const setupStatus =
					body.module_permissions.onboarding && permissionKey
						? (body.module_permissions[permissionKey] ?? false)
						: false;

				// --- Special business rules ---
				switch (setup.id) {
					case CUSTOM_ONBOARDING_SETUP_ID.POST_SUBMISSION_EDITING_SETUP: {
						if (!whiteLabelEnabled && setupStatus) {
							throw new OnboardingApiError(
								`Post-submission editing is restricted to White Label customers`,
								StatusCodes.BAD_REQUEST,
								ERROR_CODES.INVALID
							);
						}
						break;
					}
					case CUSTOM_ONBOARDING_SETUP_ID.MODIFY_PAGES_FIELDS_SETUP:
					case CUSTOM_ONBOARDING_SETUP_ID.LIGHTNING_VERIFICATION_SETUP: {
						if (setupStatus) {
							isPageEnabled = true;
						}
						break;
					}
				}

				queries.push(insertSetupQuery);
				values.push([setup.id, customerID, setupStatus]);

				return {
					code: setup.code,
					label: setup.label,
					setup_id: setup.id,
					is_enabled: setupStatus
				};
			});

			// 2. Insert all setup records
			await sqlSequencedTransaction(queries, values);

			// 3. Insert default onboarding stages if page features enabled
			if (isPageEnabled) {
				const getStagesQuery = `SELECT * FROM onboarding_schema.data_customer_onboarding_stages WHERE customer_id = $1`;
				const stagesResult = await sqlQuery({ sql: getStagesQuery, values: [customerID] });

				if (stagesResult.rows.length === 0) {
					const createdBy = user_id ?? null;

					const insertStagesQuery = `WITH inserted_stages AS (
                                      INSERT INTO onboarding_schema.data_customer_onboarding_stages (
                                        id,
                                        customer_id,
                                        version,
                                        stage,
                                        completion_weightage,
                                        allow_back_nav,
                                        is_skippable,
                                        is_enabled,
                                        is_removable,
                                        is_orderable,
                                        next_stage,
                                        prev_stage,
                                        priority_order,
                                        created_by,
                                        updated_by,
                                        stage_code
                                      )
                                      SELECT
                                        gen_random_uuid(),
                                        $1,
                                        1,
                                        stage,
                                        completion_weightage,
                                        allow_back_nav,
                                        is_skippable,
                                        is_enabled,
                                        is_removable,
                                        is_orderable,
                                        NULL,
                                        NULL,
                                        priority_order,
                                        $2,
                                        $2,
                                        code
                                      FROM onboarding_schema.core_onboarding_stages
                                      RETURNING id, stage_code, customer_id
                                    ),
                                    config_data AS (
                                      SELECT
                                        dos.id AS customer_stage_id,
                                        dos.customer_id,
                                        csc.config
                                      FROM inserted_stages dos
                                      JOIN onboarding_schema.core_stage_fields_config csc
                                      ON csc.stage_id = (SELECT id FROM onboarding_schema.core_onboarding_stages WHERE code = dos.stage_code)
                                    )
                                    INSERT INTO onboarding_schema.data_customer_stage_fields_config (customer_id, customer_stage_id, config)
                                    SELECT
                                      customer_id,
                                      customer_stage_id,
                                      config
                                    FROM config_data`;
					await sqlQuery({ sql: insertStagesQuery, values: [customerID, createdBy] });

					// Update next_stage
					const nextStageQuery = `WITH next_stage_subquery AS (
                                  SELECT d1.id AS current_id, d2.id AS next_id
                                  FROM onboarding_schema.data_customer_onboarding_stages d1
                                  LEFT JOIN LATERAL (
                                    SELECT id
                                    FROM onboarding_schema.data_customer_onboarding_stages
                                    WHERE customer_id = d1.customer_id
                                    AND priority_order > d1.priority_order
                                    AND is_enabled = TRUE
                                    ORDER BY priority_order ASC
                                    LIMIT 1
                                  ) d2 ON TRUE
                                  WHERE d1.is_enabled = $1 AND d1.customer_id = $2
                                )
                                UPDATE onboarding_schema.data_customer_onboarding_stages AS current_stage
                                SET next_stage = next_stage_subquery.next_id
                                FROM next_stage_subquery
                                WHERE current_stage.id = next_stage_subquery.current_id`;
					await sqlQuery({ sql: nextStageQuery, values: [true, customerID] });

					// Update prev_stage
					const prevStageQuery = `WITH prev_stage_subquery AS (
                                  SELECT d1.id AS current_id, d2.id AS prev_id
                                  FROM onboarding_schema.data_customer_onboarding_stages d1
                                  LEFT JOIN LATERAL (
                                    SELECT id
                                    FROM onboarding_schema.data_customer_onboarding_stages
                                    WHERE customer_id = d1.customer_id
                                    AND priority_order < d1.priority_order
                                    AND is_enabled = TRUE
                                    ORDER BY priority_order DESC
                                    LIMIT 1
                                  ) d2 ON TRUE
                                  WHERE d1.is_enabled = $1 AND d1.customer_id = $2
                                )
                                UPDATE onboarding_schema.data_customer_onboarding_stages AS current_stage
                                SET prev_stage = prev_stage_subquery.prev_id
                                FROM prev_stage_subquery
                                WHERE current_stage.id = prev_stage_subquery.current_id`;
					await sqlQuery({ sql: prevStageQuery, values: [true, customerID] });
				}
			}

			// 4. Return array of setup results
			return setups;
		} catch (error) {
			logger.error({ customerID, error }, "Failed to create customer onboarding setups");
			throw error;
		}
	}

	async copyCustomerSetups(parentCustomerID: string, childCustomerID: string, user_id?: string) {
		try {
			// 1. Get parent customer's onboarding setups
			const getParentSetupsQuery = `SELECT rcss.setup_id, rcss.is_enabled, cost.code, cost.label
				FROM onboarding_schema.rel_customer_setup_status rcss
				LEFT JOIN onboarding_schema.core_onboarding_setup_types cost ON cost.id = rcss.setup_id
				WHERE rcss.customer_id = $1;`;

			const parentSetups = await sqlQuery({
				sql: getParentSetupsQuery,
				values: [parentCustomerID]
			});

			if (!parentSetups.rows.length) {
				throw new OnboardingApiError(
					"Parent customer has no onboarding setups",
					StatusCodes.NOT_FOUND,
					ERROR_CODES.NOT_FOUND
				);
			}

			// 2. Insert parent's setups for child customer
			const insertQueries: string[] = [];
			const insertValues: any[] = [];

			parentSetups.rows.forEach(setup => {
				const insertQuery = `
					INSERT INTO onboarding_schema.rel_customer_setup_status (setup_id, customer_id, is_enabled)
					VALUES ($1, $2, $3)
					ON CONFLICT (setup_id, customer_id)
					DO UPDATE SET is_enabled = EXCLUDED.is_enabled;
				`;
				insertQueries.push(insertQuery);
				insertValues.push([setup.setup_id, childCustomerID, setup.is_enabled]);
			});

			// 3. Copy ALL parent's onboarding stages (regardless of any setup being enabled)
			// Get parent's onboarding stages with their IDs
			const getParentStagesQuery = `
				SELECT id, stage, completion_weightage, allow_back_nav, is_skippable,
					   is_enabled, is_removable, is_orderable, stage_code, priority_order
				FROM onboarding_schema.data_customer_onboarding_stages
				WHERE customer_id = $1
				ORDER BY priority_order;
			`;

			const parentStages = await sqlQuery({
				sql: getParentStagesQuery,
				values: [parentCustomerID]
			});

			if (parentStages.rows.length > 0) {
				// Prepare user_id for audit columns, defaulting to null if not provided
				const auditUserId = user_id || null;

				// STEP 1: Insert all stages for child customer with audit columns
				for (const stage of parentStages.rows) {
					const insertStageQuery = `
						INSERT INTO onboarding_schema.data_customer_onboarding_stages
						(customer_id, stage, completion_weightage, allow_back_nav, is_skippable,
						 is_enabled, is_removable, is_orderable, stage_code, priority_order,
						 version, created_by, created_at, updated_by, updated_at)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, NOW(), $11, NOW())
						ON CONFLICT (customer_id, stage_code, version)
						DO UPDATE SET
							stage = EXCLUDED.stage,
							completion_weightage = EXCLUDED.completion_weightage,
							allow_back_nav = EXCLUDED.allow_back_nav,
							is_skippable = EXCLUDED.is_skippable,
							is_enabled = EXCLUDED.is_enabled,
							is_removable = EXCLUDED.is_removable,
							is_orderable = EXCLUDED.is_orderable,
							priority_order = EXCLUDED.priority_order,
							updated_by = EXCLUDED.updated_by,
							updated_at = NOW();
					`;
					insertQueries.push(insertStageQuery);
					insertValues.push([
						childCustomerID,
						stage.stage,
						stage.completion_weightage,
						stage.allow_back_nav,
						stage.is_skippable,
						stage.is_enabled,
						stage.is_removable,
						stage.is_orderable,
						stage.stage_code,
						stage.priority_order,
						auditUserId
					]);
				}

				// STEP 2: Update next_stage and prev_stage references
				// This must happen AFTER all stages are inserted but BEFORE copying configs
				const updateNextPrevQuery = `
					WITH parent_stage_mapping AS (
						-- Get parent stages with their next/prev stage codes
						SELECT
							p1.stage_code,
							p1.next_stage as next_stage_id,
							p1.prev_stage as prev_stage_id,
							p2.stage_code as next_stage_code,
							p3.stage_code as prev_stage_code
						FROM onboarding_schema.data_customer_onboarding_stages p1
						LEFT JOIN onboarding_schema.data_customer_onboarding_stages p2
							ON p1.next_stage = p2.id AND p2.customer_id = $2
						LEFT JOIN onboarding_schema.data_customer_onboarding_stages p3
							ON p1.prev_stage = p3.id AND p3.customer_id = $2
						WHERE p1.customer_id = $2
					),
					child_stage_mapping AS (
						-- Map child stages to their corresponding parent stage codes
						SELECT
							c.id as child_id,
							c.stage_code,
							psm.next_stage_code,
							psm.prev_stage_code
						FROM onboarding_schema.data_customer_onboarding_stages c
						JOIN parent_stage_mapping psm ON c.stage_code = psm.stage_code
						WHERE c.customer_id = $1
					)
					UPDATE onboarding_schema.data_customer_onboarding_stages child
					SET
						next_stage = next_child.id,
						prev_stage = prev_child.id
					FROM child_stage_mapping csm
					LEFT JOIN onboarding_schema.data_customer_onboarding_stages next_child
						ON next_child.stage_code = csm.next_stage_code
						AND next_child.customer_id = $1
					LEFT JOIN onboarding_schema.data_customer_onboarding_stages prev_child
						ON prev_child.stage_code = csm.prev_stage_code
						AND prev_child.customer_id = $1
					WHERE child.id = csm.child_id;
				`;
				insertQueries.push(updateNextPrevQuery);
				insertValues.push([childCustomerID, parentCustomerID]);

				// STEP 3: Copy stage field configurations
				// This MUST happen AFTER stages are created because customer_stage_id is a foreign key
				const copyStageConfigsQuery = `
					INSERT INTO onboarding_schema.data_customer_stage_fields_config
					(customer_id, customer_stage_id, config)
					SELECT
						$1,
						child_stage.id,
						parent_config.config
					FROM onboarding_schema.data_customer_stage_fields_config parent_config
					JOIN onboarding_schema.data_customer_onboarding_stages parent_stage
						ON parent_stage.id = parent_config.customer_stage_id
					JOIN onboarding_schema.data_customer_onboarding_stages child_stage
						ON child_stage.customer_id = $1
						AND child_stage.stage_code = parent_stage.stage_code
					WHERE parent_stage.customer_id = $2;
				`;

				insertQueries.push(copyStageConfigsQuery);
				insertValues.push([childCustomerID, parentCustomerID]);
			}

			// 4. Execute all queries in a transaction
			await sqlSequencedTransaction(insertQueries, insertValues);

			// 5. Log the action
			if (user_id) {
				logger.info(
					{ parentCustomerID, childCustomerID, user_id },
					"Customer onboarding setups copied from parent to child"
				);
			}

			// 6. Return the setups that were copied
			return parentSetups.rows.map(setup => ({
				code: setup.code,
				label: setup.label,
				setup_id: setup.setup_id,
				is_enabled: setup.is_enabled
			}));
		} catch (error) {
			logger.error({ parentCustomerID, childCustomerID, error }, "Failed to copy customer onboarding setups");
			throw error;
		}
	}

	async copyCustomFilesConfiguration(parentCustomerID: string, childCustomerID: string, user_id?: string) {
		try {
			// 1. Get parent customer's custom templates
			const getParentTemplatesQuery = `
				SELECT id, version, title, metadata, is_enabled, created_by, updated_by
				FROM onboarding_schema.data_custom_templates
				WHERE customer_id = $1 AND is_enabled = true
				ORDER BY version;
			`;

			const parentTemplates = await sqlQuery({
				sql: getParentTemplatesQuery,
				values: [parentCustomerID]
			});

			if (!parentTemplates.rows.length) {
				logger.info({ parentCustomerID, childCustomerID }, "Parent customer has no custom templates to copy");
				return;
			}

			// 2. Copy each template and its fields
			for (const template of parentTemplates.rows) {
				const newTemplateId = randomUUID();

				// Parse metadata to check for file references
				let updatedMetadata = template.metadata;

				// Check if metadata exists and has a fileName property
				if (
					template.metadata &&
					typeof template.metadata === "object" &&
					template.metadata.fileName &&
					typeof template.metadata.fileName === "string"
				) {
					const parentFilePath = `custom-fields/customers/${parentCustomerID}/${template.metadata.fileName}`;
					const childFilePath = `custom-fields/customers/${childCustomerID}/${template.metadata.fileName}`;

					try {
						await copyFile(parentFilePath, childFilePath, BUCKETS.BACKEND);
						logger.info(
							`Successfully copied template file from parent to child customer: ${JSON.stringify({
								parentFilePath,
								childFilePath,
								parentCustomerID,
								childCustomerID
							})}`
						);
						updatedMetadata = { ...template.metadata };
					} catch (fileError: any) {
						logger.error(
							`Failed to copy template file, continuing without file: ${JSON.stringify({
								fileError: fileError?.message || String(fileError),
								parentFilePath,
								childFilePath,
								parentCustomerID,
								childCustomerID,
								bucket: BUCKETS.BACKEND,
								errorCode: fileError?.code,
								errorName: fileError?.name
							})}`
						);
						updatedMetadata = { ...template.metadata };
						delete updatedMetadata.fileName;
					}
				}

				// Insert new template for child customer
				const insertTemplateQuery = `
					INSERT INTO onboarding_schema.data_custom_templates
					(id, customer_id, version, title, metadata, is_enabled, created_by, updated_by)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
					ON CONFLICT (customer_id, version)
					DO UPDATE SET
						title = EXCLUDED.title,
						metadata = EXCLUDED.metadata,
						is_enabled = EXCLUDED.is_enabled,
						updated_by = EXCLUDED.updated_by,
						updated_at = CURRENT_TIMESTAMP;
				`;

				await sqlQuery({
					sql: insertTemplateQuery,
					values: [
						newTemplateId,
						childCustomerID,
						template.version,
						template.title,
						updatedMetadata,
						template.is_enabled,
						user_id || template.created_by,
						user_id || template.updated_by
					]
				});

				// Get the actual template ID (in case of conflict, use existing)
				const getTemplateIdQuery = `
					SELECT id FROM onboarding_schema.data_custom_templates
					WHERE customer_id = $1 AND version = $2;
				`;

				const templateResult = await sqlQuery({
					sql: getTemplateIdQuery,
					values: [childCustomerID, template.version]
				});

				const actualTemplateId = templateResult.rows[0].id;

				// 3. Get parent template's custom fields
				const getParentFieldsQuery = `
					SELECT id, label, code, type, property, rules, is_sensitive, sequence_number,
						   conditional_logic, section_name, section_visibility, customer_access, applicant_access, step_name
					FROM onboarding_schema.data_custom_fields
					WHERE template_id = $1
					ORDER BY sequence_number;
				`;

				const parentFields = await sqlQuery({
					sql: getParentFieldsQuery,
					values: [template.id]
				});

				// 4. Copy custom fields to new template
				if (parentFields.rows.length > 0) {
					for (const field of parentFields.rows) {
						// Check if field already exists
						const existingFieldQuery = `
							SELECT id FROM onboarding_schema.data_custom_fields
							WHERE template_id = $1 AND label = $2
						`;

						const existingField = await sqlQuery({
							sql: existingFieldQuery,
							values: [actualTemplateId, field.label]
						});

						let fieldId: string;

						if (existingField.rows.length > 0) {
							// Update existing field
							fieldId = existingField.rows[0].id;
							const updateFieldQuery = `
								UPDATE onboarding_schema.data_custom_fields
								SET code = $3, type = $4, property = $5, rules = $6, is_sensitive = $7,
									sequence_number = $8, conditional_logic = $9, section_name = $10,
									section_visibility = $11, customer_access = $12, applicant_access = $13, step_name = $14
								WHERE template_id = $1 AND label = $2
							`;

							await sqlQuery({
								sql: updateFieldQuery,
								values: [
									actualTemplateId,
									field.label,
									field.code,
									field.type,
									field.property,
									field.rules,
									field.is_sensitive,
									field.sequence_number,
									field.conditional_logic,
									field.section_name,
									field.section_visibility,
									field.customer_access,
									field.applicant_access,
									field.step_name
								]
							});
						} else {
							// Insert new field
							fieldId = randomUUID();
							const insertFieldQuery = `
								INSERT INTO onboarding_schema.data_custom_fields
								(id, template_id, label, code, type, property, rules, is_sensitive,
								 sequence_number, conditional_logic, section_name, section_visibility, customer_access, applicant_access, step_name)
								VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
							`;

							await sqlQuery({
								sql: insertFieldQuery,
								values: [
									fieldId,
									actualTemplateId,
									field.label,
									field.code,
									field.type,
									field.property,
									field.rules,
									field.is_sensitive,
									field.sequence_number,
									field.conditional_logic,
									field.section_name,
									field.section_visibility,
									field.customer_access,
									field.applicant_access,
									field.step_name
								]
							});
						}

						// 5. Copy field options for this field
						const getParentFieldOptionsQuery = `
							SELECT label, value, checkbox_type, input_type, icon, icon_position
							FROM onboarding_schema.data_field_options
							WHERE field_id = $1
						`;

						const parentFieldOptions = await sqlQuery({
							sql: getParentFieldOptionsQuery,
							values: [field.id]
						});

						if (parentFieldOptions.rows.length > 0) {
							// Delete existing options for this field (in case of update)
							const deleteFieldOptionsQuery = `
								DELETE FROM onboarding_schema.data_field_options
								WHERE field_id = $1
							`;
							await sqlQuery({
								sql: deleteFieldOptionsQuery,
								values: [fieldId]
							});

							// Insert new field options
							for (const option of parentFieldOptions.rows) {
								// Use the same logic as CSV insertion - full INSERT for checkbox, simple for others
								let insertFieldOptionQuery: string;
								let values: any[];

								if (field.type === "checkbox" || field.property === "checkbox") {
									// Full INSERT for checkbox fields (same as CSV logic)
									insertFieldOptionQuery = `
										INSERT INTO onboarding_schema.data_field_options
										(id, field_id, label, value, checkbox_type, input_type, icon, icon_position)
										VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
									`;
									values = [
										randomUUID(),
										fieldId,
										option.label,
										option.value,
										option.checkbox_type,
										option.input_type,
										option.icon,
										option.icon_position
									];
								} else {
									// Full INSERT for all field types to preserve all data including checkbox_type
									insertFieldOptionQuery = `
										INSERT INTO onboarding_schema.data_field_options
										(id, field_id, label, value, checkbox_type, input_type, icon, icon_position)
										VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
									`;
									values = [
										randomUUID(),
										fieldId,
										option.label,
										option.value,
										option.checkbox_type,
										option.input_type,
										option.icon,
										option.icon_position
									];
								}

								await sqlQuery({
									sql: insertFieldOptionQuery,
									values: values
								});
							}
						}
					}
				}

				logger.info(
					{
						parentCustomerID,
						childCustomerID,
						templateId: template.id,
						newTemplateId: actualTemplateId,
						fieldsCount: parentFields.rows.length
					},
					"Successfully copied custom template and fields"
				);
			}

			logger.info(
				{
					parentCustomerID,
					childCustomerID,
					templatesCount: parentTemplates.rows.length
				},
				"Successfully copied all custom files configuration"
			);
		} catch (error) {
			logger.error({ error, parentCustomerID, childCustomerID }, "Failed to copy custom files configuration");
			throw error;
		}
	}

	async updateCustomerOnboardingSetups(
		params: { customerID: string },
		body: { setups: { setup_id: number; is_enabled: boolean }[] },
		userInfo: any
	) {
		try {
			// Get core onboarding setup records
			const getCoreOnboardingSetupsQuery = `SELECT * FROM onboarding_schema.core_onboarding_setup_types;`;
			// Get customer onboarding setup records
			const getCustomerOnboardingSetupsQuery = `SELECT rcss.setup_id, rcss.is_enabled, cost.code, cost.label FROM onboarding_schema.rel_customer_setup_status rcss
			LEFT JOIN onboarding_schema.core_onboarding_setup_types cost ON cost.id = rcss.setup_id
			WHERE rcss.customer_id = $1;`;
			// Get customer config setup records
			const getCustomerOnboardingStagesQuery = `SELECT * FROM onboarding_schema.data_customer_onboarding_stages dcos WHERE dcos.customer_id = $1`;

			const [getCoreOnboardingSetupsResult, getCustomerOnboardingSetupsResult, getCustomerOnboardingStagesResult] =
				await sqlTransaction(
					[getCoreOnboardingSetupsQuery, getCustomerOnboardingSetupsQuery, getCustomerOnboardingStagesQuery],
					[[], [params.customerID], [params.customerID]]
				);

			const customerWhiteLabelSetup = getCustomerOnboardingSetupsResult.rows.find(
				s => s.setup_id === CUSTOM_ONBOARDING_SETUP_ID.WHITE_LABEL_SETUP
			);

			let queries: string[] = [];
			let values: any[] = [];
			let isPageEnabled = false;
			let settings: Record<string, boolean> = {};

			body.setups.map(setup => {
				const { setup_id, is_enabled } = setup;

				switch (setup_id) {
					case CUSTOM_ONBOARDING_SETUP_ID.ONBOARDING_SETUP: {
						settings.onboarding = is_enabled;
						break;
					}
					case CUSTOM_ONBOARDING_SETUP_ID.WHITE_LABEL_SETUP: {
						settings.white_label_onboarding = is_enabled;
						break;
					}
					case CUSTOM_ONBOARDING_SETUP_ID.INTERNATIONAL_BUSINESS_SETUP: {
						settings.international_business_setup = is_enabled;
						break;
					}
					default: {
						logger.error(`Invalid Custom Onboarding setup_id ${setup_id}`);
						break;
					}
				}
				// Validate setup_id
				if (!getCoreOnboardingSetupsResult.rows.find(s => s.id === setup_id)) {
					throw new OnboardingApiError(`Invalid setup_id: ${setup_id}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
				}

				// Check if the setup is restricted to White Label customers
				if (
					customerWhiteLabelSetup &&
					!customerWhiteLabelSetup.is_enabled &&
					setup_id === CUSTOM_ONBOARDING_SETUP_ID.POST_SUBMISSION_EDITING_SETUP &&
					is_enabled
				) {
					throw new OnboardingApiError(
						`Post-submission editing is restricted to White Label customers`,
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}

				// Check if the setup already exists for the customer
				const existingSetup = getCustomerOnboardingSetupsResult.rows.find(cs => cs.setup_id === setup_id);

				if (existingSetup) {
					const updateQueryForCustomerOnboardingSetup = `UPDATE onboarding_schema.rel_customer_setup_status SET is_enabled = $1 WHERE setup_id = $2 AND customer_id = $3;`;
					queries.push(updateQueryForCustomerOnboardingSetup);
					values.push([is_enabled, setup_id, params.customerID]);
					logger.info(existingSetup.code);

					// If the white label setup is disabled, then disable the dependent post submission editing setup
					if (setup_id === CUSTOM_ONBOARDING_SETUP_ID.WHITE_LABEL_SETUP && !is_enabled) {
						const updateQueryForCustomerPostSubmissionEditingSetup = `UPDATE onboarding_schema.rel_customer_setup_status SET is_enabled = $1 WHERE setup_id = $2 AND customer_id = $3;`;
						queries.push(updateQueryForCustomerPostSubmissionEditingSetup);
						values.push([false, CUSTOM_ONBOARDING_SETUP_ID.POST_SUBMISSION_EDITING_SETUP, params.customerID]);
					}

					if (
						[
							CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP,
							CUSTOM_ONBOARDING_SETUP.LIGHTNING_VERIFICATION_SETUP
						].includes(existingSetup.code) &&
						is_enabled
					) {
						isPageEnabled = true;
					}
				} else {
					const insertQueryForCustomerOnboardingSetup = `INSERT INTO onboarding_schema.rel_customer_setup_status(setup_id, customer_id, is_enabled) VALUES ($1, $2, $3) ON CONFLICT (setup_id, customer_id) DO NOTHING`;
					queries.push(insertQueryForCustomerOnboardingSetup);
					let setupStatus = is_enabled;
					if (setup_id === CUSTOM_ONBOARDING_SETUP_ID.ONBOARDING_SETUP) {
						setupStatus = true;
					}
					values.push([setup_id, params.customerID, setupStatus]);
				}
			});

			// default config is available or not for the customer if not then insert the default config
			if (isPageEnabled && getCustomerOnboardingStagesResult.rows.length === 0) {
				const insertCustomerOnboardingStagesQuery = `WITH inserted_stages AS (
																		INSERT INTO onboarding_schema.data_customer_onboarding_stages (
																			id,
																			customer_id,
																			version,
																			stage,
																			completion_weightage,
																			allow_back_nav,
																			is_skippable,
																			is_enabled,
																			is_removable,
																			is_orderable,
																			next_stage,
																			prev_stage,
																			priority_order,
																			created_by,
																			updated_by,
																			stage_code
																		)
																		SELECT
																			gen_random_uuid(),
																			$1,
																			1,
																			stage,
																			completion_weightage,
																			allow_back_nav,
																			is_skippable,
																			is_enabled,
																			is_removable,
																			is_orderable,
																			NULL,
																			NULL,
																			priority_order,
																			$2,
																			$2,
																			code
																		FROM onboarding_schema.core_onboarding_stages
																		RETURNING id, stage_code, customer_id
																	),
																	config_data AS (
																		SELECT
																			dos.id AS customer_stage_id,
																			dos.customer_id,
																			csc.config
																		FROM inserted_stages dos
																		JOIN onboarding_schema.core_stage_fields_config csc
																		ON csc.stage_id = (SELECT id FROM onboarding_schema.core_onboarding_stages WHERE code = dos.stage_code)
																	)
																	INSERT INTO onboarding_schema.data_customer_stage_fields_config (customer_id,customer_stage_id, config)
																	SELECT
																		customer_id,
																		customer_stage_id,
																		config
																	FROM config_data`;
				queries.push(insertCustomerOnboardingStagesQuery);
				values.push([params.customerID, userInfo.user_id]);
				const nextStageQuery = `WITH next_stage_subquery AS (
																		SELECT
																			d1.id AS current_id,
																			d2.id AS next_id
																		FROM onboarding_schema.data_customer_onboarding_stages d1
																		LEFT JOIN LATERAL (
																			SELECT id
																			FROM onboarding_schema.data_customer_onboarding_stages
																			WHERE customer_id = d1.customer_id
																			AND priority_order > d1.priority_order
																			AND is_enabled = TRUE
																			ORDER BY priority_order ASC
																			LIMIT 1
																		) d2 ON TRUE
																		WHERE d1.is_enabled = $1 and d1.customer_id = $2
																	)
																	UPDATE onboarding_schema.data_customer_onboarding_stages AS current_stage
																	SET next_stage = next_stage_subquery.next_id
																	FROM next_stage_subquery
																	WHERE current_stage.id = next_stage_subquery.current_id`;
				queries.push(nextStageQuery);
				values.push([true, params.customerID]);
				const prevStageQuery = `WITH prev_stage_subquery AS (
																		SELECT
																			d1.id AS current_id,
																			d2.id AS prev_id
																		FROM onboarding_schema.data_customer_onboarding_stages d1
																		LEFT JOIN LATERAL (
																			SELECT id
																			FROM onboarding_schema.data_customer_onboarding_stages
																			WHERE customer_id = d1.customer_id
																			AND priority_order < d1.priority_order
																			AND is_enabled = TRUE
																			ORDER BY priority_order DESC
																			LIMIT 1
																		) d2 ON TRUE
																		WHERE d1.is_enabled = $1 and d1.customer_id = $2
																	)
																	UPDATE onboarding_schema.data_customer_onboarding_stages AS current_stage
																	SET prev_stage = prev_stage_subquery.prev_id
																	FROM prev_stage_subquery
																	WHERE current_stage.id = prev_stage_subquery.current_id`;
				queries.push(prevStageQuery);
				values.push([true, params.customerID]);
			}
			if (queries.length) await sqlSequencedTransaction(queries, values);

			const message = {
				customer_id: params.customerID,
				settings: settings
			};

			await producer.send({
				topic: kafkaTopics.USERS_NEW,
				messages: [{
					key: params.customerID,
					value: {
						event: kafkaEvents.UPDATE_CUSTOMER,
						...message
					}
				}]
			});

			return null;
		} catch (error) {
			throw error;
		}
	}

	/*
	 * Reorder stages
	 * @param {object} body - stages array with stageID and priorityOrder
	 * @param {object} customerID - customerID
	 */
	async reorderStages(
		body: { onboardingType: string; stages: { priorityOrder: number; stageID: UUID }[] },
		{ customerID }: { customerID: UUID }
	) {
		try {
			const getCustomerOnboardingStagesQuery = `SELECT d1.id, d1.priority_order, d1.is_orderable, d1.stage
														FROM onboarding_schema.data_customer_onboarding_stages d1
														LEFT JOIN onboarding_schema.core_onboarding_stages cos ON cos.code = d1.stage_code
														LEFT JOIN onboarding_schema.rel_onboarding_stage_type ON rel_onboarding_stage_type.stage_id = cos.id
														LEFT JOIN onboarding_schema.core_onboarding_types cot ON cot.id = rel_onboarding_stage_type.onboarding_type_id
														WHERE d1.customer_id = $1 AND cot.code = $2`;
			const getCustomerOnboardingStagesResult = await sqlQuery({
				sql: getCustomerOnboardingStagesQuery,
				values: [customerID, body.onboardingType]
			});
			const queries: Array<string> = [];
			const values: any = [];
			// Update the priority orders in the database
			for (const stage of body.stages) {
				const isChangeExist = getCustomerOnboardingStagesResult.rows.find(
					(s: any) => s.id === stage.stageID && s.priority_order !== stage.priorityOrder
				);
				if (isChangeExist && isChangeExist.is_orderable === false) {
					throw new OnboardingApiError(
						`Stage ${isChangeExist.stage} is not orderable`,
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				} else if (isChangeExist) {
					const updatePriorityOrderQuery = `
					UPDATE onboarding_schema.data_customer_onboarding_stages
					SET priority_order = $1 WHERE customer_id = $2 AND id = $3`;
					queries.push(updatePriorityOrderQuery);
					values.push([stage.priorityOrder, customerID, stage.stageID]);
				}
			}
			// To update next stage
			if (queries.length) {
				const nextStageQuery = `WITH next_stage_subquery AS (
									SELECT
										d1.id AS current_id,
										d2.id AS next_id
									FROM onboarding_schema.data_customer_onboarding_stages d1
									LEFT JOIN onboarding_schema.core_onboarding_stages cos ON cos.code = d1.stage_code
									LEFT JOIN onboarding_schema.rel_onboarding_stage_type ON rel_onboarding_stage_type.stage_id = cos.id
									LEFT JOIN onboarding_schema.core_onboarding_types cot ON cot.id = rel_onboarding_stage_type.onboarding_type_id
									LEFT JOIN LATERAL (
										SELECT id
										FROM onboarding_schema.data_customer_onboarding_stages
										WHERE customer_id = d1.customer_id
										AND priority_order > d1.priority_order
										AND is_enabled = TRUE
										ORDER BY priority_order ASC
										LIMIT 1
									) d2 ON TRUE
									WHERE d1.is_enabled = $1 and d1.customer_id = $2 AND cot.code = $3
								)
								UPDATE onboarding_schema.data_customer_onboarding_stages AS current_stage
								SET next_stage = next_stage_subquery.next_id
								FROM next_stage_subquery
								WHERE current_stage.id = next_stage_subquery.current_id`;
				queries.push(nextStageQuery);
				values.push([true, customerID, body.onboardingType]);
				const prevStageQuery = `WITH prev_stage_subquery AS (
									SELECT
										d1.id AS current_id,
										d2.id AS prev_id
									FROM onboarding_schema.data_customer_onboarding_stages d1
									LEFT JOIN onboarding_schema.core_onboarding_stages cos ON cos.code = d1.stage_code
									LEFT JOIN onboarding_schema.rel_onboarding_stage_type ON rel_onboarding_stage_type.stage_id = cos.id
									LEFT JOIN onboarding_schema.core_onboarding_types cot ON cot.id = rel_onboarding_stage_type.onboarding_type_id
									LEFT JOIN LATERAL (
										SELECT id
										FROM onboarding_schema.data_customer_onboarding_stages
										WHERE customer_id = d1.customer_id
										AND priority_order < d1.priority_order
										AND is_enabled = TRUE
										ORDER BY priority_order DESC
										LIMIT 1
									) d2 ON TRUE
									WHERE d1.is_enabled = $1 and d1.customer_id = $2 AND cot.code = $3
								)
								UPDATE onboarding_schema.data_customer_onboarding_stages AS current_stage
								SET prev_stage = prev_stage_subquery.prev_id
								FROM prev_stage_subquery
								WHERE current_stage.id = prev_stage_subquery.current_id`;
				queries.push(prevStageQuery);
				values.push([true, customerID, body.onboardingType]);
				await sqlSequencedTransaction(queries, values);
				logger.info(`Reordering stages for Customer ID: ${customerID} done successfully`);
			}
		} catch (error: any) {
			throw error;
		}
	}

	async getAllStages(params: { customerID: UUID }, body: { include_config: boolean }) {
		try {
			// Fetch all stages for the customer
			const getProgressionConfigQuery = `SELECT dcos.id::text , dcos.stage AS label, stage_code  as stage, dcos.priority_order , dcos.prev_stage::text , dcos.next_stage::text ,dcos.is_enabled , dcos.is_skippable, dcos.allow_back_nav, dcos.completion_weightage, dcsfc.config
								FROM onboarding_schema.data_customer_onboarding_stages dcos
								LEFT JOIN onboarding_schema.core_onboarding_stages cos ON cos.code = dcos.stage_code
								LEFT JOIN onboarding_schema.rel_onboarding_stage_type rost ON rost.stage_id = cos.id
								LEFT JOIN onboarding_schema.core_onboarding_types cot2 ON cot2.id = rost.onboarding_type_id
								LEFT JOIN onboarding_schema.data_customer_stage_fields_config dcsfc ON dcsfc.customer_stage_id = dcos.id
								WHERE cot2.code = $1
								AND dcos.customer_id = $2
								AND (
									(SELECT rcss.is_enabled
									FROM onboarding_schema.rel_customer_setup_status rcss
									INNER JOIN onboarding_schema.core_onboarding_setup_types cost2
									ON cost2.id = rcss.setup_id
									WHERE cost2.code = $4
									AND rcss.customer_id = $2) = $5
								)

								UNION ALL

								SELECT cos.id::text,stage AS label, cos.code AS stage, priority_order , prev_stage::text , next_stage::text ,is_enabled , is_skippable, allow_back_nav, completion_weightage, csfc.config
								FROM onboarding_schema.core_onboarding_stages cos
								LEFT JOIN onboarding_schema.rel_onboarding_stage_type rost ON rost.stage_id = cos.id
								LEFT JOIN onboarding_schema.core_onboarding_types cot2 ON cot2.id = rost.onboarding_type_id
								LEFT JOIN onboarding_schema.core_stage_fields_config csfc ON csfc.stage_id = cos.id
								WHERE cot2.code = $1 AND cos.is_enabled = $3
								AND NOT EXISTS (
									SELECT rcss.is_enabled
									FROM onboarding_schema.rel_customer_setup_status rcss
									INNER JOIN onboarding_schema.core_onboarding_setup_types cost2
									ON cost2.id = rcss.setup_id
									WHERE cost2.code = $4
									AND rcss.customer_id = $2
									AND rcss.is_enabled = $5
								)ORDER BY priority_order ASC`;
			const getProgressionConfigQueryValues = [
				CUSTOM_ONBOARDING_TYPES.NORMAL_ONBOARDING,
				params.customerID,
				true,
				CUSTOM_ONBOARDING_SETUP.MODIFY_PAGES_FIELDS_SETUP,
				true
			];

			const progressionConfigResult = await sqlQuery({
				sql: getProgressionConfigQuery,
				values: getProgressionConfigQueryValues
			});

			const getTemplatesResult = await db("onboarding_schema.data_custom_templates")
				.select("*")
				.where({ customer_id: params.customerID, is_enabled: true })
				.first();

			let progressionConfig;
			const customFieldsStage = progressionConfigResult.rows.filter(stage => stage.stage === "custom_fields");
			if (customFieldsStage.length && getTemplatesResult) {
				progressionConfig = await businesses.getProgressionConfigWithCustomFields(
					progressionConfigResult.rows,
					params.customerID,
					[SECTION_VISIBILITY.HIDDEN, SECTION_VISIBILITY.DEFAULT]
				);
			} else {
				progressionConfig = progressionConfigResult.rows;
			}

			progressionConfig = progressionConfig
				.filter(stage => !["review", "login", "get_started", "company", "custom_fields", "rfi"].includes(stage.stage))
				.map(stage => {
					const formattedStage = {
						id: stage.id,
						label: stage.label,
						stage: stage.stage,
						priority_order: stage.priority_order,
						visibility: stage.visibility || (stage.is_enabled ? "Default" : "Hidden")
					};
					if (body?.include_config === true) {
						formattedStage["config"] = stage.config;
					}
					return formattedStage;
				});

			return progressionConfig;
		} catch (error) {
			logger.error(error, "Error fetching stages:");
			throw error;
		}
	}

	async getCurrentOnboardingTemplate(customerId: UUID): Promise<ICustomTemplate | undefined> {
		const templates = await onboardingServiceRepository.getOnboardingTemplates({ customerId });
		if (!templates.length) {
			return;
		}
		return templates[0];
	}
	async getOnboardingTemplate(templateId: UUID): Promise<ICustomTemplate> {
		const templates = await onboardingServiceRepository.getOnboardingTemplates({ templateId });
		if (!templates.length) {
			throw new OnboardingApiError(`Template ${templateId} not found`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return templates[0];
	}

	/* Given either customerId or templateId, return the custom fields */
	async getCustomFields({
		customerId,
		templateId
	}: { customerId: UUID; templateId?: UUID } | { customerId?: UUID; templateId: UUID }): Promise<CustomField[]> {
		if (!customerId && !templateId) {
			throw new OnboardingApiError("No customer or template ID provided", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		} else if (customerId && !templateId) {
			templateId = await onboardingServiceRepository
				.getOnboardingTemplates({ customerId })
				.then(template => template?.[0]?.id);
		}
		if (!templateId) {
			logger.info(`No onboarding template found for customer: ${customerId}`);
			return [];
		}
		return onboardingServiceRepository
			.getCustomFields(templateId)
			.then(fields => fields.map(field => new CustomField(field)));
	}

	async getRequiredFieldsForRole(templateId: UUID, role: Role): Promise<CustomField[]> {
		const customFields = await this.getCustomFields({ templateId });
		const requiredFields = CustomFieldHelper.getRequiredFields(customFields);
		return requiredFields.filter(field => field.isEditable(role));
	}

	async getEditableFieldsForRole(templateId: UUID, role: Role): Promise<CustomField[]> {
		const customFields = await this.getCustomFields({ templateId });
		return customFields.filter(field => field.isEditable(role));
	}

	async getCustomerCustomFieldsSummary(customerId: UUID): Promise<ICustomerCustomFieldsSummary[]> {
		return onboardingServiceRepository.getCustomerCustomFieldsSummary(customerId);
	}

	/**
	 * Create business custom field values for an invite
	 * 	Intentionally prevents overwriting existing field values.
	 * Pass in field keys that are intentionally being overwritten to prevent throwing
	 * @param inviteID - invite ID
	 * @param overwriteKeys - keys to overwrite (otherwise throws if we attempt to overwrite a field that already exists)
	 * @returns Record<ICustomField["code"], BusinessCustomField>
	 */
	async createBusinessCustomFieldValuesForInvite(
		inviteID: UUID,
		overwriteKeys: string[] = []
	): Promise<Record<ICustomField["code"], BusinessCustomField>> {
		const invite = await BusinessInvites.fromId(inviteID);
		if (invite.case_id && invite.prefill?.custom_fields && invite.prefill?.custom_field_template_id) {
			if (invite.prefill.custom_fields_prefilled && overwriteKeys.length == 0) {
				logger.warn(`Custom fields already prefilled for inviteId=${invite.id} and caseId=${invite.case_id}`);
			}
			const existingCustomFields = await onboardingServiceRepository.getBusinessCustomFields({
				caseId: invite.case_id,
				templateId: invite.prefill.custom_field_template_id
			});
			const existingFields: BusinessCustomFieldEnriched[] = await Promise.all(
				existingCustomFields.map(async record => {
					const businessCustomField = new BusinessCustomField(record);
					return businessCustomField.enrich();
				})
			);
			// Find collisions
			const collisions = Object.keys(invite.prefill.custom_fields).filter(field =>
				existingFields.some(existingField => existingField.field?.code === field)
			);
			if (collisions.length > 0) {
				const errorMessage = `Custom fields already exist: ${collisions.join(", ")}`;
				const disallowedCollisions = collisions.filter(collision => !overwriteKeys.includes(collision));
				if (disallowedCollisions.length > 0) {
					logger.error(`${errorMessage} for case ${invite.case_id} and invite ${inviteID}: Throwing Error`);
					throw new OnboardingApiError(errorMessage, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
				}
				logger.warn(`${errorMessage} for case ${invite.case_id} and invite ${inviteID}: Overwriting`);
			}
			const savedFields = await CustomFieldHelper.saveCustomFieldValuesFromInvite(
				{ ...invite },
				invite.prefill.custom_field_template_id,
				invite.prefill.custom_fields
			);
			await BusinessInvites.updateInvite(inviteID, {
				prefill: { ...invite.prefill, custom_fields_prefilled: new Date().toISOString() }
			});
			return savedFields;
		}
		return {};
	}

	async getCustomerBusinessConfigs(params: { customerID: string; businessID: string }) {
		try {
			const getCustomerBusinessConfigsQuery = `SELECT * FROM onboarding_schema.data_customer_business_configs WHERE customer_id = $1 AND business_id = $2;`;
			const getCustomerBusinessConfigsResult = await sqlQuery({
				sql: getCustomerBusinessConfigsQuery,
				values: [params.customerID, params.businessID]
			});

			return getCustomerBusinessConfigsResult.rows;
		} catch (error) {
			throw error;
		}
	}

	async addOrUpdateCustomerBusinessConfigs(
		params: { customerID: string; businessID: string },
		body: any,
		userInfo: any
	) {
		try {
			const insertCustomerBusinessConfigsQuery = `INSERT INTO onboarding_schema.data_customer_business_configs (customer_id, business_id, config, created_by, updated_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (customer_id, business_id) DO UPDATE SET config = data_customer_business_configs.config || EXCLUDED.config, updated_by = $5, updated_at = NOW() RETURNING *`;
			const insertCustomerBusinessConfigsResult = await sqlQuery({
				sql: insertCustomerBusinessConfigsQuery,
				values: [params.customerID, params.businessID, body, userInfo.user_id, userInfo.user_id]
			});
			return insertCustomerBusinessConfigsResult.rows;
		} catch (error) {
			throw error;
		}
	}

	async getCustomerCountries(params: { customerID: string; setupID: number }) {
		try {
			const getAvailableCountriesQuery = `SELECT jurisdiction_code, flag_code, name, order_index
				FROM onboarding_schema.core_jurisdictions
				ORDER BY order_index ASC`;

			const getSelectedCountriesQuery = `SELECT jurisdiction_code, is_enabled
				FROM onboarding_schema.rel_customer_setup_countries
				WHERE customer_id = $1 AND setup_id = $2 AND is_enabled = true`;

			const [availableCountriesResult, selectedCountriesResult] = await sqlTransaction(
				[getAvailableCountriesQuery, getSelectedCountriesQuery],
				[[], [params.customerID, params.setupID]]
			);

			const availableCountries = availableCountriesResult.rows;
			const selectedCountryCodes = selectedCountriesResult.rows.map(row => row.jurisdiction_code);

			const countriesWithSelection = availableCountries.map(country => ({
				...country,
				is_selected: selectedCountryCodes.includes(country.jurisdiction_code)
			}));

			return countriesWithSelection;
		} catch (error) {
			logger.error(error, "Error getting customer countries:");
			throw error;
		}
	}

	async updateCustomerCountries(
		params: { customerID: string; setupID: number },
		body: { countries: { jurisdiction_code: string; is_enabled: boolean }[] }
	) {
		try {
			const queries: string[] = [];
			const values: any[] = [];

			body.countries.forEach(country => {
				const upsertQuery = `INSERT INTO onboarding_schema.rel_customer_setup_countries
					(customer_id, setup_id, jurisdiction_code, is_enabled)
					VALUES ($1, $2, $3, $4)
					ON CONFLICT (customer_id, setup_id, jurisdiction_code)
					DO UPDATE SET
						is_enabled = EXCLUDED.is_enabled`;

				queries.push(upsertQuery);
				values.push([
					params.customerID,
					params.setupID,
					country.jurisdiction_code,
					country.is_enabled
				]);
			});

			if (queries.length > 0) {
				await sqlSequencedTransaction(queries, values);
			}

			return null;
		} catch (error) {
			logger.error(error, "Error updating customer countries:");
			throw error;
		}
	}

	// getBusinessCustomFields exists in the repository functions but does not return data relevant to an external end-user.
	// In GET Customer Case by ID the custom fields are returned with all properties including some which should be kept internal-only
	// so this new function broadly incorporates elements of the previously mentioned endpoint while keeping the focus on code clarity
	// and end-user developer experience.
	async getDetailedBusinessCustomFields(
		params: { businessID: UUID },
		query: { pagination: boolean; itemsPerPage: number; page: number }
	): Promise<{ records: DetailedBusinessCustomFields[]; total_pages: number; total_items: number }> {
		const pagination = Object.hasOwn(query, "pagination") ? query.pagination : true;
		let itemsPerPage = Object.hasOwn(query, "itemsPerPage") && pagination ? query.itemsPerPage : 20;
		const page = Object.hasOwn(query, "page") && pagination ? query.page : 1;

		const totalcount = await onboardingServiceRepository.countBusinessCustomFields(params.businessID);

		if (!pagination) {
			itemsPerPage = totalcount;
		}

		const paginationDetails = paginate(totalcount, itemsPerPage);

		if (page > paginationDetails.totalPages && paginationDetails.totalPages !== 0) {
			throw new OnboardingApiError(
				`Page requested is out of max page range (${paginationDetails.totalPages})`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		const customFieldsResult = await onboardingServiceRepository.getBusinessCustomFieldsForExternalUsers(
			params.businessID,
			{ page: page, itemsPerPage: itemsPerPage }
		);

		// If no custom fields come back then this is a quick shortcut out of the function.
		if (!customFieldsResult?.length) {
			return {
				records: [],
				total_pages: 0,
				total_items: 0
			};
		}

		// We store all values as strings but custom fields can be other types as well.
		// Instead of returning a stringified numeric value for a field which should be an integer,
		// or a stringified JSON object, there are some quick conversions here. This was simply
		// an additional to benefit the developer experience for end users.
		const finalCustomFields: DetailedBusinessCustomFields[] = customFieldsResult.reduce((acc, row) => {
			if (!row || !row.json_build_object) {
				return acc;
			}

			const item = row.json_build_object as DetailedBusinessCustomFields;

			if (!item.data_type || !item.value) {
				return acc;
			}

			const dataType = item.data_type.toLowerCase();

			if (dataType === "integer" && !isNaN(item.value)) {
				item.value = parseInt(item.value, 10);
			} else if (dataType === "decimal" && !isNaN(item.value)) {
				item.value = parseFloat(item.value);
			} else if (dataType === "checkbox" || dataType === "dropdown") {
				if (item.value.trim() !== "") {
					item.value = JSON.parse(item.value);
				}
			}

			acc.push(item);
			return acc;
		}, [] as DetailedBusinessCustomFields[]);

		return {
			records: finalCustomFields,
			total_pages: paginationDetails.totalPages,
			total_items: paginationDetails.totalItems
		};
	}

}

// convert rules string(from csv file) to jsonSchema object for validation purpose
function createJsonSchema(
	rules: string,
	fieldName: string,
	property: string,
	defaultValue: string,
	fieldDescription: string
) {
	let schema: any = {
		type: "object",
		properties: {}
	};
	schema.properties[fieldName] = {};

	if (defaultValue) {
		schema.properties[fieldName].default = defaultValue;
	}
	if (fieldDescription) {
		schema.properties[fieldName].description = fieldDescription;
	}

	if (!rules) return schema;

	const ruleArray = rules.split(";");
	const ruleActions = {
		required: () => {
			schema.required = [fieldName];
		},
		file_type: value => {
			schema.properties[fieldName].fileType = value;
		},
		max_file_size: value => {
			schema.properties[fieldName].maxFileSize = value;
		},
		min_num_files: value => {
			schema.properties[fieldName].minNumFiles = value;
		},
		max_num_files: value => {
			schema.properties[fieldName].maxNumFiles = value;
		},
		min: (value, property) => {
			const key = ["integer", "decimal"].includes(property?.toLowerCase()) ? "minimum" : "minLength";
			schema.properties[fieldName][key] = value;
		},
		sum: value => {
			schema.properties[fieldName].sum = value;
		},
		equal: value => {
			schema.properties[fieldName].equal = value;
		},
		max: (value, property) => {
			const key = ["integer", "decimal"].includes(property?.toLowerCase()) ? "maximum" : "maxLength";
			schema.properties[fieldName][key] = value;
		},
		decimal_places: value => {
			schema.properties[fieldName].decimalPlaces = value;
		}
	};
	ruleArray.forEach(rule => {
		if (!rule) return;

		Object.keys(ruleActions).forEach(ruleType => {
			if (rule.includes(`${ruleType}:`) || rule.includes("required")) {
				const value = rule.split(":")[1];
				ruleActions[ruleType](value, property);
			}
		});
	});
	if (property?.toLowerCase() === "upload") {
		const rulesToCheck = ["min_num_files", "max_num_files"];
		rulesToCheck.forEach(rule => {
			if (!rules.includes(rule)) {
				ruleActions[rule]("1");
			}
		});
	}
	return schema;
}

export const onboarding = new Onboarding();
