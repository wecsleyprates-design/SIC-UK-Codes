import { Router } from "express";
const router = Router();
import { methodNotAllowed, validateDataPermission, validateRole, validateSchema, validateUser } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

router.route("/accounting/tax-filing/businesses/:businessID").post(validateUser, validateRole(ROLES.APPLICANT), validateSchema(schema.addTaxFiling), api.addTaxFiling).all(methodNotAllowed);

router.route("/accounting/tax-filing/business/:businessID/stats").get(validateUser, validateSchema(schema.getTaxStats), api.getTaxStats).all(methodNotAllowed);

// get tax filing data from business or score_trigger_id or caseID
router
	.route("/accounting/tax-filing/business/:businessID/:formType?")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT), validateDataPermission, validateSchema(schema.getTaxFilings), api.getTaxFilings)
	.all(methodNotAllowed);

router.route("/accounting/tax-status/webhook/:webhookID").post(api.taxStatusWebHookHandler).all(methodNotAllowed);

// admin-api to fetch data based on caseID
router.route("/accounting/tax-filing/data/fetch/cases/:caseID").post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.taxFilingDataFetch), api.taxFilingDataFetch).all(methodNotAllowed);

// admin-api for all existing connected tax-status cases
router.route("/accounting/tax-filing/data/fetch").post(validateUser, validateRole(ROLES.ADMIN), api.fetchAllCasesData).all(methodNotAllowed);

module.exports = router;
