import { Router } from "express";
const router = new Router();
import {
	methodNotAllowed,
	validateRole,
	validateSchema,
	validateUser,
	validatePurgedBusiness
} from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "../../../../constants/roles.constant";

router
	.route("/data-refresh-config")
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.updateDataRefreshConfig),
		api.updateDataRefreshConfig
	)
	.all(methodNotAllowed);

router
	.route("/temp/refresh")
	.post(validateUser, validateRole(ROLES.ADMIN), api.tempRefreshSubscriptionScores)
	.all(methodNotAllowed);

router.route("/core/business-industries").get(validateUser, api.getBusinessIndustries).all(methodNotAllowed);

router
	.route("/core/cron-config")
	.get(validateUser, validateRole(ROLES.ADMIN), api.getCronConfig)
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.addCronConfig), api.addCronConfig)
	.patch(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.updateCronConfig), api.updateCronConfig)
	.all(methodNotAllowed);

router.route("/core/onboarding-stages").get(api.getOnboardingStages);

router
	.route("/core/onboarding-stages")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.updateOnboardingStagesOrder),
		api.updateOnboardingStagesOrder
	);

router
	.route("/core/onboarding-stages/:stageID")
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.updateOnboardingStage),
		api.updateOnboardingStage
	);

router.route("/internal/core/naics").get(api.getNaicsCodes).all(methodNotAllowed);

router.route("/internal/core/mcc").get(api.getMccCodes).all(methodNotAllowed);

router.route("/internal/core/business-industries").get(api.getIndustriesBySector).all(methodNotAllowed);

router.route("/temp/businesses/reset").patch(validateUser, validateRole(ROLES.ADMIN), api.resetBusinessDetails);

router
	.route("/temp/businesses/:businessID/reset")
	.patch(validateUser, validateRole(ROLES.ADMIN), validatePurgedBusiness, api.resetBusinessDetailsByBusinessID);

router
	.route("/temp/cases/prefill-customer-initiated")
	.patch(validateUser, validateRole(ROLES.ADMIN), api.prefillCustomerInitiatedCases)
	.all(methodNotAllowed);

// Public routes for NAICS and MCC code search
router.route("/core/naics").get(validateUser, api.getNaicsCodes).all(methodNotAllowed);

router.route("/core/mcc").get(validateUser, api.getMccCodes).all(methodNotAllowed);

module.exports = router;
