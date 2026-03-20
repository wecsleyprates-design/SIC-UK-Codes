import { Router } from "express";
import {
	methodNotAllowed,
	validateDataPermission,
	validateRole,
	validateSchema,
	validateUser
} from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";
import { validatePermissions } from "#middlewares/permission.middleware";
import { validatePurgedBusiness } from "#middlewares/purgedBusiness.middleware";

const router = Router();

router
	.route("/customers/:customerID/business/:businessID/monitoring")
	.patch(
		validateUser,
		validateDataPermission,
		validatePermissions({ permission: "risk_monitoring_module:write" }),
		validateSchema(schema.updateBusinessesCustomerMonitoring), validatePurgedBusiness,
		api.updateBusinessesCustomerMonitoring
	)
	.all(methodNotAllowed);
router
	.route("/risk-alerts/customers/:customerID/businesses/:businessID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getRiskAlertsByBusiness), validatePurgedBusiness,
		api.getRiskAlertsByBusiness
	)
	.all(methodNotAllowed);

// TODO: remove after executing on PROD
router
	.route("/risk-alerts/score-triggers/data-fill")
	.post(validateUser, validateRole(ROLES.ADMIN), api.triggerDataFill)
	.all(methodNotAllowed);

router.route("/internal/risk-alerts/score-trigger-id").get(api.getScoreTriggerID).all(methodNotAllowed);

// TODO: remove after executing on PROD
// this api call only singal time for remove duplicate records.
router.route("/internal/risk-alerts/delete-duplicate").post(api.deleteDuplicateRiskCases).all(methodNotAllowed);

// TODO: PROD EXECUTE API
router.route("/internal/risk-alerts/cases").get(api.getRiskAlertCases).all(methodNotAllowed);

module.exports = router;
