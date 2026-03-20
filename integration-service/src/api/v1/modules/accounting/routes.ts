import {
	methodNotAllowed,
	validateDataPermission,
	validatePurgedBusiness,
	validateRole,
	validateSchema,
	validateUser
} from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";
const router = Router();

router
	.route("/accounting/integrations/:business_id/")
	.get(
		validateUser,
		validateSchema(schema.needBusinessId),
		validateDataPermission,
		validatePurgedBusiness,
		api.getIntegrations
	)
	.all(methodNotAllowed);

router
	.route("/accounting/:business_id/financials/balancesheet")
	.get(
		validateUser,
		validateSchema(schema.getBalanceSheet),
		validateDataPermission,
		validatePurgedBusiness,
		api.getBalanceSheet
	)
	.all(methodNotAllowed);
router
	.route("/accounting/:business_id/financials/income-statement")
	.get(validateUser, validateSchema(schema.getIncomeStatement), validatePurgedBusiness, api.getIncomeStatement)
	.all(methodNotAllowed);
/* Report routes */
router
	.route("/accounting/report/:business_id/case/:case_id/:report/")
	.get(validateUser, validateSchema(schema.getReport), validatePurgedBusiness, api.getReport)
	.all(methodNotAllowed);
router
	.route("/accounting/report/:business_id/task/:task_id/:report/")
	.get(validateUser, validateSchema(schema.getReport), validatePurgedBusiness, api.getReport)
	.all(methodNotAllowed);

router
	.route("/accounting/report/:business_id/:report/:id")
	.get(validateUser, validateSchema(schema.getReportByID), validatePurgedBusiness, api.getReportById)
	.all(methodNotAllowed);
router
	.route("/accounting/report/:business_id/:report/")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.getReport),
		validatePurgedBusiness,
		api.getReport
	)
	.all(methodNotAllowed);
router
	.route("/internal/accounting/report/:business_id/:report/")
	.get(validateSchema(schema.getReport), validatePurgedBusiness, api.getReport)
	.all(methodNotAllowed);
/* Object routes */
router
	.route("/accounting/object/:business_id/:object")
	.get(validateUser, validateSchema(schema.getObject), validatePurgedBusiness, api.getObject)
	.all(methodNotAllowed);
router
	.route("/accounting/object/:business_id/:object/:id")
	.get(validateUser, validateSchema(schema.getObjectByID), validatePurgedBusiness, api.getObjectById)
	.all(methodNotAllowed);

/* Rutter specific routes -- pubkey should be public */
router
	.route(["/rutter/pubkey", "/accounting/public-key", "/accounting/publickey"])
	.get(api.getRutterToken)
	.all(methodNotAllowed);
router
	.route(["/rutter/create/:business_id/:public_token", "/accounting/create/:business_id/:public_token"])
	.post(validateUser, validateSchema(schema.createConnection), validatePurgedBusiness, api.createRutterConnection)
	.all(methodNotAllowed);
/* This is not a public API: it should be used by an admin to force-link a connection that may be orphaned */
router
	.route("/rutter/sync-connection/:business_id/:access_token")
	.post(validateUser, validateSchema(schema.syncConnection), validatePurgedBusiness, api.syncRutterConnection)
	.all(methodNotAllowed);

// tax-status consent init
router
	.route("/accounting/business/:business_id/tax-filing/consent/init")
	.post(validateUser, validateSchema(schema.taxStatusConsentInit), validatePurgedBusiness, api.taxStatusConsentInit)
	.all(methodNotAllowed);

// tax-status revoke
router
	.route("/accounting/business/:businessID/taxation/revoke")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.revokeTaxStatus),
		validatePurgedBusiness,
		api.revokeTaxStatus
	)
	.all(methodNotAllowed);

router
	.route("/accounting/business/:businessID/revoke")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.revokeAccounting),
		validatePurgedBusiness,
		api.revokeAccounting
	)
	.all(methodNotAllowed);

router
	.route("/accounting/balance-sheet/businesses/:businessID")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.addBalanceSheet),
		validatePurgedBusiness,
		api.addBalanceSheet
	)
	.all(methodNotAllowed);

router
	.route("/accounting/balance-sheet/businesses/:businessID/:documentID/remove")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.deleteBalanceSheet),
		validatePurgedBusiness,
		api.deleteBalanceSheet
	)
	.all(methodNotAllowed);

router
	.route("/internal/accounting/business/:businessID/accounting-statements")
	.get(validateSchema(schema.getAccountingStatements), validatePurgedBusiness, api.getAccountingStatements)
	.all(methodNotAllowed);

router
	.route("/accounting/business/:businessID/accounting-statements")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getAccountingStatements),
		validatePurgedBusiness,
		api.getUploadedAccountingStatements
	)
	.all(methodNotAllowed);
module.exports = router;
