import { ROLES } from "#constants";
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
const router = Router();

router
	.route("/bureau/score/:business_id/enroll")
	.post(validateUser, validateSchema(schema.scoreOwners), validateRole(ROLES.ADMIN), validatePurgedBusiness, api.enroll)
	.all(methodNotAllowed);
router
	.route("/bureau/score/:business_id/owners")
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.scoreOwners), validatePurgedBusiness, api.enroll)
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.scoreOwners),
		validatePurgedBusiness,
		api.getBusinessOwnerScores
	)
	.all(methodNotAllowed);

router
	.route("/bureau/score/customers/:customer_id/business/:business_id/owners")
	.get(
		validateUser,
		validateRole(ROLES.CUSTOMER, ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.getCustomerBusinessOwnerScores),
		validatePurgedBusiness,
		api.getCustomerBusinessOwnerScores
	)
	.all(methodNotAllowed);

router
	.route("/bureau/score/:business_id/user")
	.get(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.scoreOwners),
		validatePurgedBusiness,
		api.getUserCreditScore
	)
	.all(methodNotAllowed);
router
	.route("/bureau/score/:business_id/owners/latest")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.scoreOwners),
		validatePurgedBusiness,
		api.getBusinessOwnerScoresLatest
	)
	.all(methodNotAllowed);
router
	.route("/bureau/score/:business_id/report/:owner_id")
	.get(validateUser, validateSchema(schema.scoreOwner), validatePurgedBusiness, api.getReportPdf)
	.all(methodNotAllowed);
router
	.route("/bureau/business/:business_id/report")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.getReport),
		validatePurgedBusiness,
		api.getReport
	)
	.all(methodNotAllowed);

/* Admin only route to test matching a business with Equifax judgements -- should normally be handled async via Kafka event */
router
	.route("/businesses/bureau/match/:business_id")
	.get(validateUser, validateRole(ROLES.ADMIN), validatePurgedBusiness, api.matchBusinessToEquifax)
	.all(methodNotAllowed);
router
	.route("/businesses/bureau/match/customers/:customerID/business/:business_id")
	.get(validateUser, validateRole(ROLES.ADMIN), validatePurgedBusiness, api.matchBusinessToEquifax)
	.all(methodNotAllowed);

router
	.route("/businesses/bureau/bulk-match")
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.enrich), api.equifaxMatchBulk)
	.all(methodNotAllowed);

module.exports = router;
