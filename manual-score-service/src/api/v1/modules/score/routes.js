import { Router } from "express";
const router = new Router();
import { methodNotAllowed, validatePurgedBusiness, validateRole, validateSchema, validateUser } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants/roles.constant";

router.route("/score/business/:businessID").get(validateUser, validateSchema(schema.getScore), validatePurgedBusiness, api.getScore).all(methodNotAllowed);

router.route("/internal/score/business/:businessID").get(validateSchema(schema.getScore), api.getScore).all(methodNotAllowed);

router.route("/score/business/:businessID/score-trend-chart").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.getScoreTrendChart), validatePurgedBusiness, api.getScoreTrendChart).all(methodNotAllowed);

router.route("/score/business/:businessID/date").get(validateUser, validateSchema(schema.getScoreDate), validatePurgedBusiness, api.getScoreDate).all(methodNotAllowed);

router
	.route("/score/cases/:caseID")
	.get(validateUser, validateSchema(schema.getCaseScore), api.getCaseScore)
	.patch(validateUser, validateSchema(schema.patchCaseScore), api.patchCaseScore)
	.all(methodNotAllowed);

router.route("/score/business/:businessID/:scoreTriggerID").post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.forceScore), validatePurgedBusiness, api.forceScoreGeneration).all(methodNotAllowed);

router.route("/score/inputs/:scoreID").get(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.getScoreInputs), api.getScoreInputs).all(methodNotAllowed);

router.route("/score/score-config").get(validateUser, validateRole(ROLES.ADMIN), api.getScoreConfig).all(methodNotAllowed);

router.route("/score/customer/:customerID/config").get(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.getCustomerScoreConfig), api.getCustomerScoreConfig).post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.addCustomerScoreConfig), api.addCustomerScoreConfig).patch(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.updateCustomerScoreConfig), api.updateCustomerScoreConfig).all(methodNotAllowed);

// TODO: remove after executing on PROD
router.route("/temp/score/version").post(api.scoreVersioning).all(methodNotAllowed);

module.exports = router;
