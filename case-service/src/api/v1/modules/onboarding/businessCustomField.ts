import type { UUID } from "crypto";
import { onboardingServiceRepository } from "./repository";
import type { BusinessCustomFieldEnriched, BusinessCustomFieldResponse, BusinessCustomFieldsFromCaseParams, IBusinessCustomField, IBusinessCustomFieldEgg, ICustomField } from "./types";
import { OnboardingApiError } from "./error";
import { StatusCodes } from "http-status-codes";
import { ERROR_CODES } from "#constants";
import { caseManagementService } from "../case-management/case-management";

export class BusinessCustomField<T = any> {
	private businessCustomField: IBusinessCustomFieldEgg<T>;
	private customField: ICustomField | undefined;
	private isDirty = false;
	private userId: UUID | undefined;
	// Import the customField module in a dynamic way to avoid circular dependency issues
	private static customFieldModule: typeof import("./customField") | undefined;

	constructor(businessCustomField: IBusinessCustomFieldEgg<T> | BusinessCustomFieldEnriched<T>, userId?: UUID) {
		if ("field" in businessCustomField) {
			this.customField = businessCustomField.field;
		}
		this.businessCustomField = businessCustomField;
		this.userId = userId;
	}

	static async forCase<T = any>(params: BusinessCustomFieldsFromCaseParams<T>): Promise<BusinessCustomField<T>> {
		let customField: ICustomField | undefined;
		let userId: UUID | undefined = params.userId;
		if (params.fieldId) {
			customField = await onboardingServiceRepository.getCustomField({ id: params.fieldId });
		} else if (params.fieldCode && params.templateId) {
			customField = await onboardingServiceRepository.getCustomField({ code: params.fieldCode, templateId: params.templateId });
		}
		if (!customField) {
			throw new OnboardingApiError(`Invalid request for custom field ${params.fieldId ?? params.fieldCode}`, StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		// Get case info from caseId
		const caseInfo = await caseManagementService.internalGetCaseByID({ caseID: params.caseId });
		if (!caseInfo?.id) {
			throw new OnboardingApiError(`Invalid case ${params.caseId}`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		} else if (caseInfo.customer_id != params.customerId) {
			throw new OnboardingApiError(`Invalid case for customer ${params.customerId}`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		// Default to the case creator if no user id is provided
		if (!userId) {
			userId = caseInfo.created_by as UUID;
		}
		const record = new BusinessCustomField<T>({
			case_id: params.caseId,
			business_id: caseInfo.business_id as UUID,
			field_id: customField.id,
			field_value: params.value,
			template_id: customField.template_id,
			created_by: userId
		});
		record.setValue(params.value);
		return record;
	}

	get(): IBusinessCustomFieldEgg<T> | IBusinessCustomField<T> {
		return this.businessCustomField;
	}

	isSet() {
		return this.businessCustomField.field_value != null;
	}

	setValue(value: T): BusinessCustomField<T> {
		this.businessCustomField.field_value = value;
		this.isDirty = true;
		return this;
	}

	isEnriched(): boolean {
		return (this.businessCustomField as BusinessCustomFieldEnriched).field != null;
	}

	getId(): UUID {
		if (!this.businessCustomField.id) {
			throw new OnboardingApiError("Business custom field is not saved", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		return this.businessCustomField.id;
	}
	getValue(): T {
		return this.businessCustomField.field_value;
	}

	async getCustomField(): Promise<ICustomField> {
		if (this.customField) {
			return this.customField;
		}
		const customField = await onboardingServiceRepository.getCustomField({ id: this.businessCustomField.field_id });
		if (!customField) {
			throw new OnboardingApiError("Invalid custom field", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		this.customField = customField;
		return customField;
	}

	async enrich(): Promise<BusinessCustomFieldEnriched<T>> {
		if (!this.businessCustomField.id) {
			throw new OnboardingApiError("Business custom field is not saved", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		const customField = await this.getCustomField();
		return {
			...(this.businessCustomField as IBusinessCustomField<T>),
			field: customField
		};
	}

	async save(userId?: UUID): Promise<BusinessCustomField> {
		if (!this.isDirty) {
			throw new OnboardingApiError("Business custom field is not dirty", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		const savedBusinessCustomField = await onboardingServiceRepository.saveBusinessCustomField(this.businessCustomField, userId ?? this.userId);
		if (savedBusinessCustomField) {
			this.businessCustomField = savedBusinessCustomField;
			this.isDirty = false;
		}
		return this;
	}

	async toLegacy(): Promise<BusinessCustomFieldResponse> {
		const enriched = await this.enrich();
		// Cache the module import
		if (!BusinessCustomField.customFieldModule) {
			BusinessCustomField.customFieldModule = await import("./customField");
		}
		const field = new BusinessCustomField.customFieldModule.CustomField(enriched.field);
		const fieldOutput = await field.toLegacy();
		return {
			...fieldOutput,
			business_id: enriched.business_id,
			case_id: enriched.case_id,
			created_by: enriched.created_by,
			field_id: enriched.field_id,
			template_id: enriched.template_id,
			value: this.getValue(),
			value_id: this.getId()
		};
	}
}
