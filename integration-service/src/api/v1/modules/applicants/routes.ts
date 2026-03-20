import { Router } from "express";
const router = Router();
import { methodNotAllowed, validatePurgedBusiness, validateRole, validateSchema, validateUser } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants/index";

router.route("/banking/business/:businessID/transactions/accounts").get(validateUser, validateSchema(schema.getBusinessTransactionAccounts), validatePurgedBusiness, api.getBusinessTransactionAccounts).all(methodNotAllowed);
router.route("/banking/business/:businessID/transactions/export").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.exportBusinessTransactionsAsCSV), validatePurgedBusiness, api.exportBusinessTransactionsAsCSV).all(methodNotAllowed);
router.route("/banking/business/:businessID/transactions").get(validateUser, validateSchema(schema.getBusinessPlaidTransactions), validatePurgedBusiness, api.getBusinessPlaidTransactions).all(methodNotAllowed);

router
	.route("/banking/business/:businessID/transactions/stats")
	.get(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.getBusinessStats), validatePurgedBusiness, api.getTransactionsStats)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/balances")
	.get(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.getAccountBalances), validatePurgedBusiness, api.getAccountBalances)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/balances/stats")
	.get(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.getBusinessStats), validatePurgedBusiness, api.getBalancesStats)
	.all(methodNotAllowed);

router
	.route("/banking/business/:businessID/transactions/years")
	.get(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.getBusinessStats), validatePurgedBusiness, api.getTransactionYears)
	.all(methodNotAllowed);

router
	.route("/accounting/business/:businessID/balance-sheet/stats")
	.get(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.getBalanceSheetStats), validatePurgedBusiness, api.getBalanceSheetStats)
	.all(methodNotAllowed);

router
	.route("/accounting/business/:businessID/income-statement/stats")
	.get(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.getIncomeStatementStats), validatePurgedBusiness, api.getIncomeStatementStats)
	.all(methodNotAllowed);

module.exports = router;
