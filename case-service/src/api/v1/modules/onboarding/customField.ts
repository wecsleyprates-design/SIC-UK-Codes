import { ERROR_CODES, FIELD_ACCESS, ROLES, type FieldAccess } from "#constants";
import { StatusCodes } from "http-status-codes";
import { OnboardingApiError } from "./error";
import { onboardingServiceRepository } from "./repository";
import type { CustomFieldEnriched, CustomFieldResponse, ICustomField, ICustomTemplate, IFieldOption } from "./types";
import type { UUID } from "crypto";
import { evaluateCondition } from "#helpers/expressions";
import { toMDY } from "#utils/dateUtil";

export type Role = (typeof ROLES)[keyof typeof ROLES];

export class CustomField {
	private field: ICustomField;
	private template: ICustomTemplate | undefined;
	private fieldOptions: IFieldOption[] | undefined;

	static EDITABLE: FieldAccess[] = [FIELD_ACCESS.READ_WRITE, FIELD_ACCESS.WRITE_ONLY, FIELD_ACCESS.DEFAULT];
	static VISIBLE: FieldAccess[] = [FIELD_ACCESS.READ_WRITE, FIELD_ACCESS.READ_ONLY, FIELD_ACCESS.DEFAULT];

	constructor(field: ICustomField) {
		this.field = field;
		if (!this.isFieldWithOptions()) {
			this.fieldOptions = [];
		}
	}

	static async fromTemplateId(templateId: UUID): Promise<CustomField[]> {
		return (await onboardingServiceRepository.getCustomFields(templateId)).map(f => new CustomField(f));
	}
	static async fromFieldId(fieldId: UUID): Promise<CustomField> {
		const customField = await onboardingServiceRepository.getCustomField({ id: fieldId });
		if (!customField) {
			throw new OnboardingApiError("Custom field not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return new CustomField(customField);
	}
	static async fromFieldCodeAndTemplateId(fieldCode: string, templateId: UUID): Promise<CustomField> {
		const customField = await onboardingServiceRepository.getCustomField({ code: fieldCode, templateId });
		if (!customField) {
			throw new OnboardingApiError("Custom field not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		return new CustomField(customField);
	}

	get(): ICustomField {
		return this.field;
	}
	getCode(): string {
		return this.field.code;
	}
	getId(): UUID {
		return this.field.id;
	}
	getType(): ICustomField["type"] {
		return this.field.type;
	}
	getProperty() {
		return this.field.property;
	}
	isFieldWithOptions(): boolean {
		const propsWithOptions = ["dropdown", "checkbox"];
		return propsWithOptions.includes(this.field.property);
	}
	async getFieldOptions(): Promise<IFieldOption[]> {
		if (!this.fieldOptions) {
			this.fieldOptions = await onboardingServiceRepository.getCustomFieldOptions(this.getId());
		}
		return this.fieldOptions;
	}
	isRequired(): boolean {
		if (this.field?.rules?.required) {
			return this.field.rules.required?.length > 0;
		}
		return false;
	}
	isEditable(role: Role): boolean {
		const field = role === ROLES.CUSTOMER ? this.getCustomerAccess() : this.getApplicantAccess();
		return CustomField.EDITABLE.includes(field);
	}

	isFile(): boolean {
		return this.getType() === "upload" || this.getProperty() === "upload";
	}

	isCheckbox(): boolean {
		return this.getType() === "checkbox" || this.getProperty() === "checkbox";
	}

	isVisible(role: Role): boolean {
		const field = role === ROLES.CUSTOMER ? this.getCustomerAccess() : this.getApplicantAccess();
		return CustomField.VISIBLE.includes(field);
	}

	isConditionallyVisible(field, allFields): boolean {
		const fieldVisibilityRule = field.conditional_logic?.ruleList.find(rule => rule.rule === "field_visibility");
		const condition = fieldVisibilityRule.condition;
		const keys = condition?.fields ?? [];
		const types = allFields?.filter(val => {
			return keys?.find((key: string) => key === val.internalName);
		});
		const res = types?.reduce((acc: any, item) => {
			if (item.property === "dropdown") {
				acc[item.key] = item.value?.label?.trim() ?? "";
			} else if (item.property === "boolean") {
				acc[item.key] = item.value ? "TRUE" : "FALSE";
			} else if (item.property === "date") {
				acc[item.key] = toMDY(item.value) ?? "";
			} else {
				acc[item.key] = item.value;
			}
			return acc;
		}, {});

		if (!(condition.dependency && evaluateCondition(condition.dependency, res))) {
			return false;
		}
		return true;
	}

	getCustomerAccess(): FieldAccess {
		return this.field.customer_access ?? FIELD_ACCESS.DEFAULT;
	}

	getApplicantAccess(): FieldAccess {
		return this.field.applicant_access ?? FIELD_ACCESS.DEFAULT;
	}

	async getTemplate(): Promise<ICustomTemplate> {
		if (this.template) {
			return this.template;
		}
		const template = await onboardingServiceRepository.getOnboardingTemplates({ templateId: this.field.template_id });
		if (!template) {
			throw new OnboardingApiError("Invalid custom field", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		this.template = template[0];
		return this.template;
	}

	async enrich(): Promise<CustomFieldEnriched> {
		if (!this.field.id) {
			throw new OnboardingApiError("Custom field is not saved", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		const [template, fieldOptions] = await Promise.all([this.getTemplate(), this.getFieldOptions()]);
		return {
			...(this.field as ICustomField),
			template,
			field_options: fieldOptions
		};
	}

	consolidateRules(): ICustomField["rules"] {
		return CustomField.staticConsolidateRules(this.field);
	}

	static staticConsolidateRules(
		field: ICustomField | CustomFieldResponse
	): Array<{ rule: string; value?: any } | ICustomField["rules"]> {
		const { rules } = field;

		const mergedRules: Array<{ rule: string; value?: any }> = [];

		if (rules.required && rules.required.length > 0) {
			mergedRules.push({ rule: "required" });
		}

		if (rules.properties) {
			const ruleMap: Record<string, (value: any) => any> = {
				minimum: value => parseInt(value),
				maximum: value => parseInt(value),
				minLength: value => parseInt(value),
				maxLength: value => parseInt(value),
				default: value => value,
				description: value => value,
				fileType: value => value,
				maxFileSize: value => value,
				decimalPlaces: value => value,
				sum: value => value,
				equal: value => value,
				minNumFiles: value => parseInt(value),
				maxNumFiles: value => parseInt(value)
			};
			for (const properties of Object.values(rules.properties)) {
				for (const [rule, value] of Object.entries(properties)) {
					if (rule && ruleMap[rule]) {
						mergedRules.push({ rule, value: ruleMap[rule](value) });
					}
				}
			}
		}

		const conditionalLogic = "conditionalLogic" in field ? field.conditionalLogic : field.conditional_logic;
		const ruleList = conditionalLogic?.ruleList || [];

		for (const rule of ruleList) {
			if (!rule) continue;
			if (rule.rule === "field_visibility" && rule.condition) {
				// Clean up fields: remove empty strings
				rule.condition.fields = (rule.condition.fields || []).filter(f => f.trim() !== "");

				// Clean up dependency string
				let dep = rule.condition.dependency || "";

				// Remove empty brackets and normalize
				dep = dep
					.replace(/{{}}/g, "") // remove any stray empty brackets
					.replace(/{{.*?}}/g, match => {
						// Extract key from pattern like {{{{}}{{}}loan_purpose{{}}{{}}}}
						const key = match.replace(/[{|}]/g, "").replace(/^.*?([a-zA-Z0-9_]+).*$/, "$1");
						return `{${key}}`;
					})
					.replace(/\s+/g, " ") // normalize spaces
					.trim();

				// Split into field and value (assumes '=' separator)
				const parts = dep.split("=");
				if (parts.length === 2) {
					const field = parts[0].trim(); // field name (already in {field} format)
					const value = parts[1].trim();
					dep = `{${field}}= ${value}`;
				}

				rule.condition.dependency = dep;
			}
			mergedRules.push(rule);
		}
		return mergedRules;
	}

	/**
		Return a version of the object that is compatible with the legacy onboarding API (e.g. doesn't use a typed response =\)
	*/
	async toLegacy(): Promise<CustomFieldResponse> {
		const fieldOptions = await this.getFieldOptions();
		return {
			id: this.field.id,
			label: this.field.label,
			internalName: this.field.code,
			property: this.field.property,
			type: this.field.type ?? this.field.property,
			value: null,
			value_id: null,
			is_sensitive_info: this.field.is_sensitive,
			rules: this.consolidateRules(),
			step_name: this.field.step_name,
			section_name: this.field.section_name,
			field_options: fieldOptions,
			conditionalLogic: this.field.conditional_logic,
			sequence_number: this.field.sequence_number,
			customer_access: this.field.customer_access,
			applicant_access: this.field.applicant_access
		};
	}
}
