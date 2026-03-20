import { Router } from "express";
const router = new Router();
import {
	methodNotAllowed,
	validateRole,
	validateSchema,
	validateUser,
	validateDataPermission,
	validatePurgedBusiness
} from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

// Route to create link-token
router
	.route("/banking/business/:businessID/connect")
	.post(validateUser, validateSchema(schema.plaidLinkInit), validatePurgedBusiness, api.plaidLinkInit)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/auth")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.getDepositAccountInfo),
		validatePurgedBusiness,
		api.getDepositAccountInfo
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.setDepositAccountInfo),
		api.setDepositAccountInfo
	)
	.all(methodNotAllowed);

// Route to exchange public-token for access-token
router
	.route("/banking/business/:businessID/authenticate")
	.post(validateUser, validateSchema(schema.plaidTokenExchange), validatePurgedBusiness, api.plaidTokenExchange)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/refresh")
	.all(validateUser)
	.post(validateSchema(schema.refreshBankingAssets), validatePurgedBusiness, api.refreshBankingAssets)
	.all(methodNotAllowed);

// TODO: validate webhook request
router.route("/banking/plaid/asset-report/webhook").post(api.handleAssetReportWebhook).all(methodNotAllowed);
router.route("/banking/plaid/link/webhook").post(api.enqueueLinkWebhook).all(methodNotAllowed);

// get banking information by caseID or score_trigger_id
router
	.route("/business/:businessID/banking")
	.get(validateUser, validateSchema(schema.getBankingInformation), validatePurgedBusiness, api.getBankingInformation)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/before/:beforeDate")
	.get(
		validateUser,
		validateSchema(schema.getBankingInformationByDate),
		validatePurgedBusiness,
		api.getBankingInformation
	)
	.all(methodNotAllowed);
router
	.route("/banking/business/:businessID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.getBankingInformation),
		validatePurgedBusiness,
		api.getBankingInformation
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/trade-lines")
	.get(
		validateUser,
		validateRole(ROLES.CUSTOMER, ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.getBankingTradeLines),
		validatePurgedBusiness,
		api.getBankingTradeLines
	)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/connection/revoke")
	.post(validateUser, validateSchema(schema.revokePlaidConnection), validatePurgedBusiness, api.revokePlaidConnection)
	.all(methodNotAllowed);

router
	.route("/internal/business/:businessID/deposit-account")
	.get(validatePurgedBusiness, api.getDepositAccount)
	.all(methodNotAllowed);

router
	.route("/internal/banking/business/:businessID/additional-accounts")
	.get(validateSchema(schema.getAdditionalAccountInfo), validatePurgedBusiness, api.getAdditionalAccountInfo)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/additional-accounts")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.getAdditionalAccountInfo),
		validatePurgedBusiness,
		api.getAdditionalAccountInfo
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.setAdditionalAccountInfo),
		validatePurgedBusiness,
		api.setAdditionalAccountInfo
	)
	.put(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.updateAdditionalAccountInfo),
		validatePurgedBusiness,
		api.updateAdditionalAccountInfo
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.deleteAdditionalAccountInfo),
		validatePurgedBusiness,
		api.deleteAdditionalAccountInfo
	)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/all-accounts")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.getAdditionalAccountInfo),
		validatePurgedBusiness,
		api.getAdditionalAccountInfo
	)
	.all(methodNotAllowed);

router
	.route("/banking/bank-statement/businesses/:businessID")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.addBankStatement),
		validatePurgedBusiness,
		api.addBankStatement
	)
	.all(methodNotAllowed);

router
	.route("/banking/bank-statement/businesses/:businessID/:documentID/remove")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.deleteBankStatement),
		validatePurgedBusiness,
		api.deleteBankStatement
	)
	.all(methodNotAllowed);

router
	.route("/internal/banking/business/:businessID/bank-statements")
	.get(validateSchema(schema.getBankStatements), validatePurgedBusiness, api.getBankStatements)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/bank-statements")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getBankStatements),
		validatePurgedBusiness,
		api.getUploadedBankStatements
	)
	.all(methodNotAllowed);

module.exports = router;
