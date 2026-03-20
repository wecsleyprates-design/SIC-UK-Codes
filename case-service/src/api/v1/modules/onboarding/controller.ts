import { ERROR_CODES, ROLE_ID_TO_ROLE, ROLES } from "#constants";
import { catchAsync, pick } from "#utils/index";
import { StatusCodes } from "http-status-codes";
import { customerLimits } from "./customer-limits";
import { onboarding } from "./onboarding";
import type { Role } from "./customField";
import type { UUID } from "crypto";

export const controller = {
	createCustomTemplate: catchAsync(async (req, res) => {
		const response = await onboarding.createCustomTemplate(req.params, req.file, res.locals.user);
		res.jsend.success(response, "Custom template created successfully.");
	}),

	validateCsv: catchAsync(async (req, res) => {
		const response = await onboarding.validateCsv(req.file);
		res.jsend.success(response, "Template validated successfully.");
	}),

	getCustomTemplate: catchAsync(async (req, res) => {
		const response = await onboarding.getCustomTemplate(req.params);
		res.jsend.success(response.data, response.message);
	}),

	removeCustomTemplate: catchAsync(async (req, res) => {
		const response = await onboarding.removeCustomTemplate(req.params);
		res.jsend.success(response, "Custom template removed successfully.");
	}),

	getSampleCustomTemplate: catchAsync(async (req, res) => {
		const response = await onboarding.getSampleCustomTemplate();
		res.jsend.success(response, "Sample template fetched successfully.");
	}),

	getCustomerOnboardingStages: catchAsync(async (req, res) => {
		const response = await onboarding.getCustomerOnboardingStages(req.params, req.query);
		res.jsend.success(response, "Customer onboarding stages fetched successfully.");
	}),

	updateCustomerOnboardingStages: catchAsync(async (req, res) => {
		const response = await onboarding.updateCustomerOnboardingStages(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Customer onboarding stages updated successfully.");
	}),

	getCustomerOnboardingSetups: catchAsync(async (req, res) => {
		const response = await onboarding.getCustomerOnboardingSetups(req.params);
		res.jsend.success(response, "Onboarding setups fetched successfully.");
	}),

	updateCustomerOnboardingSetups: catchAsync(async (req, res) => {
		const response = await onboarding.updateCustomerOnboardingSetups(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Onboarding setups updated successfully.");
	}),

	reorderStages: catchAsync(async (req, res) => {
		const response = await onboarding.reorderStages(req.body, req.params);
		res.jsend.success(response, "customer onboarding stages reordered successfully");
	}),

	getAllStages: catchAsync(async (req, res) => {
		const response = await onboarding.getAllStages(req.params, req.body);
		res.jsend.success(response, "All stages of progression fetched successfully.");
	}),

	getCustomerOnboardingLimitData: catchAsync(async (req, res) => {
		const response = await customerLimits.getCustomerOnboardingLimitData(req.params);
		res.jsend.success(response, "Onboarding limit fetched successfully.");
	}),

	addOrUpdateCustomerOnboardingLimit: catchAsync(async (req, res) => {
		const response = await customerLimits.addOrUpdateCustomerOnboardingLimit(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Onboarding limit inserted or updated successfully.");
	}),

	getFieldsForRole: catchAsync(async (req, res) => {
		const { customerID, role, mode }: { customerID: UUID; role: Role; mode: "required-fields" | "editable-fields" } = req.params;
		let { templateID }: { templateID: UUID | undefined } = req.query;
		const userRole: Role = ROLE_ID_TO_ROLE[res.locals?.user?.role?.id] ?? ROLES.APPLICANT;
		if (userRole && userRole === ROLES.APPLICANT && role !== ROLES.APPLICANT) {
			return res.jsend.error("Applicant role is not allowed to fetch required fields for non-applicant roles", StatusCodes.FORBIDDEN, ERROR_CODES.UNAUTHORIZED);
		}
		// If templateID is not provided, get the current template
		if (!templateID) {
			const template = await onboarding.getCurrentOnboardingTemplate(customerID);
			if (!template || !template?.id || template.customer_id !== customerID) {
				return res.jsend.success([], `Template not found`);
			}
			templateID = template.id;
		}
		// Make sure templateId belongs to customerId
		const template = await onboarding.getOnboardingTemplate(templateID);
		if (!template || template.customer_id !== customerID) {
			return res.jsend.error(`Template ${templateID} not found`, StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		if (mode === "required-fields") {
			const response = await onboarding.getRequiredFieldsForRole(templateID, role ?? userRole);
			const legacyResponse = await Promise.all(response.map(async field => field.toLegacy()));
			res.jsend.success(legacyResponse, `Required fields for ${role ?? userRole} role fetched successfully.`);
		} else {
			const response = await onboarding.getEditableFieldsForRole(templateID, role ?? userRole);
			const legacyResponse = await Promise.all(response.map(async field => field.toLegacy()));
			res.jsend.success(legacyResponse, `Editable fields for ${role ?? userRole} role fetched successfully.`);
		}
	}),
	getCurrentCustomFieldsTemplate: catchAsync(async (req, res) => {
		const { customerID }: { customerID: UUID } = req.params;

		const template = await onboarding.getCurrentOnboardingTemplate(customerID);
		if (!template || template.customer_id !== customerID) {
			return res.jsend.success([], `Template not found`);
		}
		res.jsend.success(pick(template, ["id", "version", "created_at", "updated_at", "updated_by", "created_by", "is_enabled"]), "Current template fetched successfully.");
	}),
	getCustomerBusinessConfigs: catchAsync(async (req, res) => {
		const response = await onboarding.getCustomerBusinessConfigs(req.params);
		res.jsend.success(response, "Customer business configs fetched successfully.");
	}),
	addOrUpdateCustomerBusinessConfigs: catchAsync(async (req, res) => {
		const response = await onboarding.addOrUpdateCustomerBusinessConfigs(req.params, req.body, res.locals.user);
		res.jsend.success(response, "Customer business configs added/updated successfully.");
	}),
	getBusinessCustomFields: catchAsync(async (req, res) => {
		const response = await onboarding.getDetailedBusinessCustomFields(req.params, req.query);
		res.jsend.success(response, "Detailed custom fields fetched successfully.");
	}),

	getCustomerCountries: catchAsync(async (req, res) => {
		const response = await onboarding.getCustomerCountries(req.params);
		res.jsend.success(response, "Customer countries fetched successfully.");
	}),

	updateCustomerCountries: catchAsync(async (req, res) => {
		const response = await onboarding.updateCustomerCountries(req.params, req.body);
		res.jsend.success(response, "Customer countries updated successfully.");
	}),

	getCustomerCustomFieldsSummary: catchAsync(async (req, res) => {
		const response = await onboarding.getCustomerCustomFieldsSummary(req.params.customerID);
		res.jsend.success(response, "Customer custom fields summary fetched successfully.");
	}),
};
