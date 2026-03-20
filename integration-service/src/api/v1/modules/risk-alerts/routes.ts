import { Router } from "express";
const router = Router();
import { methodNotAllowed, validateDataPermission, validateRole, validateSchema, validateUser } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

router
	.route("/risk-alerts/configs")
	.patch(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.addUpdateRiskAlertConfig), api.addUpdateRiskAlertConfig)
	.all(methodNotAllowed);

router
	.route("/risk-alerts/customers/:customerID/configs")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.getRiskAlertConfig), api.getRiskAlertConfig)
	.all(methodNotAllowed);

router.route("/internal/risk-alerts/customers/:customerID/configs").get(api.getRiskAlertConfig).all(methodNotAllowed);

router.route("/risk-alerts/customers/:customerID/reasons/stat").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, api.getRiskAlertReasonsStat).all(methodNotAllowed);

router.route("/internal/risk-alerts").get(api.getRiskAlerts).all(methodNotAllowed);

// TODO: PROD EXECUTE API
router.route("/internal/risk-alerts/score-triggers").get(api.getRiskScoreTriggerIDs).all(methodNotAllowed);

// TODO: REMOVE AFTER ONE TIME RUN
router.route("/risk-alerts/update-risk-alert-failure-platforms").post(validateUser, validateRole(ROLES.ADMIN), api.updateRiskAlertFailurePlatforms).all(methodNotAllowed);
// TODO: PROD EXECUTE API
router.route("/risk-alerts/cases").post(validateUser, validateRole(ROLES.ADMIN), api.createRiskCases).all(methodNotAllowed);
// TODO: REMOVE AFTER ONE TIME RUN
//this api call only single time for remove duplicate records only.
router.route("/risk-alerts/delete-duplicate").delete(validateUser, validateRole(ROLES.ADMIN), api.deleteDuplicateRiskCases).all(methodNotAllowed);
module.exports = router;
