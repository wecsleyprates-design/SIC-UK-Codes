import { Router } from "express";
const router = Router();
import {
	methodNotAllowed,
	validateRole,
	validateSchema,
	validateUser,
	externalUploadMiddleware,
	validateDataPermission,
	validateFeatureFlag,
	validatePurgedBusiness
} from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES, FEATURE_FLAGS } from "#constants";
import { validatePermissions } from "#middlewares/permission.middleware";

// For create and update(create new version) custom fields template
router
	.route("/customers/:customerID/custom-fields")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.createCustomTemplate),
		validateDataPermission,
		externalUploadMiddleware("file", "text/csv"),
		api.createCustomTemplate
	)
	.all(methodNotAllowed);

router
	.route("/custom-fields/validate")
	.post(validateUser, validateRole(ROLES.ADMIN), externalUploadMiddleware("file", "text/csv"), api.validateCsv)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/custom-templates/versions")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.getCustomTemplate),
		api.getCustomTemplate
	)
	// soft delete
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.getCustomTemplate),
		api.removeCustomTemplate
	)
	.all(methodNotAllowed);

router
	.route("/internal/customers/:customerID/custom-templates/versions")
	.get(validateSchema(schema.getCustomTemplate), api.getCustomTemplate)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/custom-templates/versions/:version")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.getCustomTemplate),
		api.getCustomTemplate
	)
	// soft delete
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.getCustomTemplate),
		api.removeCustomTemplate
	)
	.all(methodNotAllowed);

router
	.route("/custom-fields/sample-template")
	.get(validateUser, validateRole(ROLES.ADMIN), api.getSampleCustomTemplate)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/customer-onboarding-stages")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getCustomerOnboardingStages),
		api.getCustomerOnboardingStages
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.updateCustomerOnboardingStages),
		api.updateCustomerOnboardingStages
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/reorder-stages")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.reorderStages),
		api.reorderStages
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/onboarding-setups")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getCustomerOnboardingSetups),
		api.getCustomerOnboardingSetups
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.updateCustomerOnboardingSetups),
		api.updateCustomerOnboardingSetups
	)
	.all(methodNotAllowed);

router
	.route("/internal/customers/:customerID/onboarding-setups")
	.get(api.getCustomerOnboardingSetups)
	.all(methodNotAllowed);

router
	.route("/internal/customers/:customerID/onboarding-setups/:setupID/countries")
	.get(validateSchema(schema.getCustomerCountries), api.getCustomerCountries)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/onboarding-setups/:setupID/countries")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getCustomerCountries),
		api.getCustomerCountries
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.updateCustomerCountries),
		api.updateCustomerCountries
	)
	.all(methodNotAllowed);

router
	.route("/internal/customers/:customerID/customer-onboarding-stages")
	.get(validateSchema(schema.getCustomerOnboardingStages), api.getCustomerOnboardingStages)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/stages")
	.get(
		validateUser,
		validateRole(ROLES.CUSTOMER, ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.getAllStages),
		api.getAllStages
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/onboarding/limit")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateFeatureFlag(FEATURE_FLAGS.PAT_260_MONTHLY_ONBOARDING_LIMIT),
		validateSchema(schema.getCustomerOnboardingLimitData),
		api.getCustomerOnboardingLimitData
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateFeatureFlag(FEATURE_FLAGS.PAT_260_MONTHLY_ONBOARDING_LIMIT),
		validateSchema(schema.addOrUpdateCustomerOnboardingLimit),
		api.addOrUpdateCustomerOnboardingLimit
	)
	.all(methodNotAllowed);

router
	.route("/internal/customers/:customerID/onboarding/limit")
	.get(
		validateFeatureFlag(FEATURE_FLAGS.PAT_260_MONTHLY_ONBOARDING_LIMIT),
		validateSchema(schema.getCustomerOnboardingLimitData),
		api.getCustomerOnboardingLimitData
	)
	.post(
		validateFeatureFlag(FEATURE_FLAGS.PAT_260_MONTHLY_ONBOARDING_LIMIT),
		validateSchema(schema.addOrUpdateCustomerOnboardingLimit),
		api.addOrUpdateCustomerOnboardingLimit
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/custom-templates/current")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.getCurrentCustomFieldsTemplate),
		api.getCurrentCustomFieldsTemplate
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/custom-templates/:mode/:role")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.getFieldsForRole),
		api.getFieldsForRole
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/businesses/:businessID/configs")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validatePermissions({ permission: "businesses:read" }),
		validateSchema(schema.getCustomerBusinessConfigs),
		validatePurgedBusiness,
		api.getCustomerBusinessConfigs
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.postCustomerBusinessConfigs),
		validatePurgedBusiness,
		api.addOrUpdateCustomerBusinessConfigs
	)
	.all(methodNotAllowed);

router
	.route("/internal/customers/:customerID/businesses/:businessID/configs")
	.get(validateSchema(schema.getCustomerBusinessConfigs), validatePurgedBusiness, api.getCustomerBusinessConfigs)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/custom-fields")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getCustomFieldData), validatePurgedBusiness,
		api.getBusinessCustomFields
	)
	.all(methodNotAllowed);

router
	.route("/internal/customers/:customerID/custom-fields/summary")
	.get(
		validateSchema(schema.getCustomerCustomFieldsSummary),
		api.getCustomerCustomFieldsSummary
	)
	.all(methodNotAllowed);

module.exports = router;
