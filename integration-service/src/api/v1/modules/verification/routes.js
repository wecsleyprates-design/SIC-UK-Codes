import { errorOnInvalidSignature } from "#lib/middesk";
import { errorOnInvalidTruliooSignature } from "#lib/trulioo";
import {
	methodNotAllowed,
	validateRole,
	validateSchema,
	validateTypedSchema,
	validateUser,
	validateDataPermission,
	validateFeatureFlag,
	validatePurgedBusiness
} from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { internationalBusinessController } from "./internationalBusiness.controller";
import { schema } from "./schema";
import { FEATURE_FLAGS, ROLES } from "#constants/index";

const router = new Router();
router
	.route("/verification/businesses/webhook")
	.post(errorOnInvalidSignature, validateTypedSchema(schema.handleVerificationWebhook), api.handleVerificationWebhook)
	.all(methodNotAllowed);

router
	.route("/verification/international-businesses/webhook")
	.post(errorOnInvalidTruliooSignature, validateTypedSchema(schema.handleInternationalBusinessWebhook), internationalBusinessController.handleInternationalBusinessWebhook)
	.all(methodNotAllowed);

router
	.route("/verification/international-businesses/person/webhook")
	.post(errorOnInvalidTruliooSignature, validateTypedSchema(schema.handleInternationalBusinessWebhook), internationalBusinessController.handleInternationalBusinessPersonWebhook)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/verify-business-entity")
	.post(
		validateUser,
		validateTypedSchema(schema.verifyBusinessEntity),
		validatePurgedBusiness,
		api.verifyBusinessEntity
	)
	.all(methodNotAllowed);

router
	.route("/internal/verification/businesses/:businessID/verify-business-entity/orders")
	.post(
		validateTypedSchema(schema.internalVerifyBusinessEntity),
		validatePurgedBusiness,
		api.internalVerifyBusinessEntityAndCreateOrUpdateOrder
	)
	.all(methodNotAllowed);

router
	.route("/internal/verification/businesses/:businessID/verify-business-entity")
	.post(
		validateTypedSchema(schema.internalVerifyBusinessEntity),
		validatePurgedBusiness,
		api.internalVerifyBusinessEntity
	)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/update-business-entity")
	.post(
		validateUser,
		validateTypedSchema(schema.updateBusinessEntity),
		validatePurgedBusiness,
		api.updateBusinessEntity
	)
	.all(methodNotAllowed);
router
	.route("/internal/verification/businesses/:businessID/update-business-entity")
	.post(validateTypedSchema(schema.updateBusinessEntity), validatePurgedBusiness, api.updateBusinessEntity)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/business-entity")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateTypedSchema(schema.getEntityVerificationDetails),
		validatePurgedBusiness,
		api.getEntityVerificationDetails
	)
	.all(methodNotAllowed);

router
	.route("/internal/verification/businesses/:businessID/business-entity")
	.get(
		validateTypedSchema(schema.getEntityVerificationDetails),
		validatePurgedBusiness,
		api.getEntityVerificationDetails
	)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/people")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateFeatureFlag(FEATURE_FLAGS.WIN_1214_PRE_POPULATE_OWNERS),
		validateSchema(schema.getVerificationPeople),
		validatePurgedBusiness,
		api.getVerificationPeople
	)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/people/watchlist")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validatePurgedBusiness, api.getPeopleWatchlistResult)
	.all(methodNotAllowed);

// get all verification data by businessID
router
	.route("/verification/businesses/:businessID")
	.get(
		validateUser,
		validateSchema(schema.getAllVerificationIntegrations),
		validatePurgedBusiness,
		api.getAllVerificationIntegrations
	)
	.all(methodNotAllowed);

/* Plaid */
router
	.route(["/verification/businesses/:businessID/enroll", "/verification/businesses/:businessID/enroll/:platformID"])
	.post(validateUser, validateSchema(schema.idvEnroll), validatePurgedBusiness, api.idvEnroll)
	.all(methodNotAllowed);
router
	.route("/verification/businesses/:businessID/status")
	.get(validateUser, validateSchema(schema.idvEnroll), validatePurgedBusiness, api.idvEnroll)
	.all(methodNotAllowed);
router
	.route("/verification/businesses/:businessID/status")
	.get(validateUser, validateSchema(schema.idvEnroll), api.idvEnroll)
	.all(methodNotAllowed);

router
	.route([
		"/verification/businesses/:businessID/applicant/:applicantID",
		"/verification/businesses/:businessID/applicant/:applicantID/:platformID"
	])
	.post(validateUser, validateSchema(schema.idvEnrollApplicant), validatePurgedBusiness, api.idvEnroll)
	.get(validateUser, validateSchema(schema.idvEnrollApplicant), validatePurgedBusiness, api.idvGetStatusForApplicant)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/token/applicant/:applicantID")
	.get(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.idvTokenApplicant),
		validatePurgedBusiness,
		api.idvGetTokenForApplicant
	)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/website-data")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.getBusinessWebsiteDetails),
		validatePurgedBusiness,
		api.getBusinessWebsiteDetails
	)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/match-opencorporates")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.openCorporatesMatch),
		validatePurgedBusiness,
		api.matchOpenCorporates
	)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/match-zoominfo")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.zoomInfoMatch),
		validatePurgedBusiness,
		api.matchZoomInfo
	)
	.all(methodNotAllowed);

router
	.route([
		"/verification/businesses/:businessID/match-async/:platformID",
		"/verification/businesses/:businessID/match-async/"
	])
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.match), validatePurgedBusiness, api.matchAsync)
	.all(methodNotAllowed);

// NPI
router
	.route("/verification/businesses/:businessID/:caseID/match-npi/:npiID")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.npiMatch),
		validatePurgedBusiness,
		api.submitHealthcareProviderMatch
	)
	.all(methodNotAllowed);
router
	.route("/verification/businesses/:businessID/healthcare")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.fetchHealthcareProviderDetailsByBusinessId),
		validatePurgedBusiness,
		api.fetchHealthcareProviderByBusinessId
	)
	.all(methodNotAllowed);
router
	.route("/verification/businesses/:businessID/healthcare/:caseID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.fetchHealthcareProviderDetailsByBusinessAndCase),
		validatePurgedBusiness,
		api.fetchHealthcareProviderByBusinessAndCase
	)
	.all(methodNotAllowed);
router
	.route("/verification/businesses/healthcare/doctors")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateFeatureFlag(FEATURE_FLAGS.DOS_445_VERDATA_DOCTORS_RESULT),
		validateSchema(schema.fetchDoctorsDetails),
		validatePurgedBusiness,
		api.fetchDoctorsDetails
	)
	.all(methodNotAllowed);

// Synchronous match for a single platform -- should realistically only be used for testing/debugging
router
	.route(["/verification/businesses/:businessID/match/:platformID"])
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.match), validatePurgedBusiness, api.matchSync)
	.all(methodNotAllowed);

router
	.route("/verification/businesses/:businessID/owners")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getVerificationForBusinessOwners),
		validatePurgedBusiness,
		api.getVerificationForBusinessOwners
	)
	.all(methodNotAllowed);

// MATCH PRO
router
	.route("/verification/customers/:customerID/businesses/:businessID/match-pro")
	.post(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.matchPro), api.matchPro)
	.all(methodNotAllowed);
router
	.route("/verification/businesses/:businessID/match-pro")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validatePurgedBusiness, api.getMatchBusinessResult)
	.all(methodNotAllowed);

// Bulk asynchronous matching for verification platforms
router
	.route("/verification/bulk-match/zoominfo")
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.bulkMatch), api.matchZoomInfoBulk)
	.all(methodNotAllowed);
router
	.route("/verification/bulk-match/opencorporates")
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.bulkMatch), api.matchOpenCorporatesBulk)
	.all(methodNotAllowed);
router
	.route("/verification/bulk-match/npi")
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.bulkMatch), api.matchNPIBulk)
	.all(methodNotAllowed);
router
	.route("/verification/bulk-match")
	.post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.bulkMatch), api.matchAllBulk)
	.all(methodNotAllowed);
router
	.route("/verification/bulk-match/match-pro")
	.post(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.bulkMatchPro), api.matchProBulk)
	.all(methodNotAllowed);

// IDV Quality of Life Improvements
router
	.route("/verification/idv/validate")
	.post(validateUser, validateSchema(schema.idvValidate), api.idvValidate)
	.all(methodNotAllowed);
router
	.route("/verification/idv/schema/:countryCode")
	.get(validateUser, validateSchema(schema.idvSchema), api.idvGetSchema)
	.all(methodNotAllowed);
router
	.route("/verification/idv/template/:templateID")
	.get(validateUser, validateSchema(schema.getIDVTemplate), api.getIDVTemplate)
	.all(methodNotAllowed);
router
	.route("/verification/businesses/:businessID/applicant/:applicantID/document/download")
	.get(validateUser, validateSchema(schema.idvEnrollApplicant), validatePurgedBusiness, api.downloadIdentityDocument)
	.all(methodNotAllowed);

// TRULIOO KYB VERIFICATION
router
	.route("/verification/businesses/:businessID/kyb-verification")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.triggerKYBVerification),
		api.triggerKYBVerification
	)
	.all(methodNotAllowed);

// Note: PSC screening now handled automatically by business verification (following Middesk pattern)

module.exports = router;
