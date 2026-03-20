import { Router } from "express";
const router = Router();
import {
	methodNotAllowed,
	validateDataPermission,
	validatePurgedBusiness,
	validateRole,
	validateSchema,
	validateUser,
	verifyVerdataWebhookMiddleware
} from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants/roles.constant";

router
	.route("/business/:businessID/public-records")
	.get(
		validateUser,
		validateRole(ROLES.APPLICANT, ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getPublicRecords),
		validatePurgedBusiness,
		api.getPublicRecords
	)
	.all(methodNotAllowed);
router
	.route("/business/:businessID/google-reviews")
	.get(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.getGoogleReviews),
		validatePurgedBusiness,
		api.getGoogleReviews
	)
	.all(methodNotAllowed);
router
	.route("/business/:businessID/ratings")
	.get(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.getBusinessRatings),
		validatePurgedBusiness,
		api.getBusinessRatings
	)
	.all(methodNotAllowed);
router
	.route("/business/:businessID/google-business/consent/init")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.businessAPIConsentInit),
		validatePurgedBusiness,
		api.businessAPIConsentInit
	)
	.all(methodNotAllowed);
router
	.route("/business/:businessID/case/:caseID/reviews")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.fetchGoogleBusinessReviews),
		validatePurgedBusiness,
		api.fetchGoogleBusinessReviews
	)
	.all(methodNotAllowed);

/* Temporary (?) route to allow fetching public records but enriching it with externally-provided data */
router
	.route("/businesses/public-records/enrich")
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.enrich), api.enrich)
	.all(methodNotAllowed);
router
	.route("/businesses/public-records/enrich/customer/:customerID")
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.enrich), api.enrich)
	.all(methodNotAllowed);

// TODO: remove after executing onto PROD
router
	.route("/business/public-records/update-percentage")
	.post(validateUser, validateRole(ROLES.ADMIN), api.updatePublicRecordsPercentage)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/businesses-data")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.getBusinessesData),
		api.getBusinessesData
	)
	.all(methodNotAllowed);

router
	.route("/verdata/webhook")
	.post(validateSchema(schema.verdataWebhook), verifyVerdataWebhookMiddleware, api.handleVerdataWebhook)
	.all(methodNotAllowed);
router
	.route("/verdata/task/:taskId")
	.post(validateUser, validateRole(ROLES.ADMIN), api.forceVerdataTaskRun)
	.all(methodNotAllowed);
module.exports = router;
