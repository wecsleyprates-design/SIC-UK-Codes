import { ROLES, FEATURE_FLAGS } from "#constants/index";
import {
	externalUploadMultipleMiddleware,
	methodNotAllowed,
	or,
	rateLimitMiddleware,
	uploadMiddleware,
	validateDataPermission,
	validateFeatureFlag,
	validateRole,
	validateSchema,
	validateUser,
	validateOnboardingLimit,
	validatePermissions,
	validatePurgedBusiness
} from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";

/** @type Router */
const router = Router();

// Debug route to save a business state
router
	.route("/admin/businesses/:businessID/save-state")
	.post(validateUser, validateRole(ROLES.ADMIN), api.saveBusinessState)
	.all(methodNotAllowed);

router
	.route("/businesses/unarchive")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validatePermissions({ permission: "businesses:write" }),
		validateSchema(schema.unarchiveBusinesses),
		api.unarchiveBusinesses
	)
	.all(methodNotAllowed);

router.route("/businesses").get(validateUser, validateRole(ROLES.ADMIN), api.getBusinesses).all(methodNotAllowed);
router.route("/internal/businesses").get(validateUser, api.getBusinesses).all(methodNotAllowed);

router
	.route("/businesses/purge")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.purgeBusinesses),
		api.purgeBusinesses
	)
	.all(methodNotAllowed);

router
	.route("/businesses/archive")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validatePermissions({ permission: "businesses:write" }),
		validateSchema(schema.getPurgedBusinesses),
		api.getPurgedBusinesses
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validatePermissions({ permission: "businesses:write" }),
		validateSchema(schema.archiveBusinesses),
		api.archiveBusinesses
	)
	.all(methodNotAllowed);

// NOTE: This route can override your route if it has endpoint like /businesses/[anything] so make sure to put your route above this
router
	.route("/businesses/:businessID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePurgedBusiness,
		validateSchema(schema.getBusinessByID),
		api.getBusinessByID
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.updateBusinessDetails),
		validatePurgedBusiness,
		api.updateBusinessDetails
	)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID")
	.get(validateSchema(schema.getBusinessByID), validatePurgedBusiness, api.getBusinessByID)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/tin")
	.patch(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.updateOrLinkBusiness),
		validatePurgedBusiness,
		api.updateOrLinkBusiness
	)
	.all(methodNotAllowed);
// @deprecated:
router
	.route("/business/:businessID/start")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.startApplication),
		validatePurgedBusiness,
		api.startApplication
	)
	.all(methodNotAllowed);
router
	.route("/business/:businessID/case/:caseID/submit")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.submitCase),
		validatePurgedBusiness,
		api.submitCase
	)
	.all(methodNotAllowed);
router
	.route("/businesses/status")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), api.getBusinessStatus)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/owners")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.getBusinessOwners),
		validatePurgedBusiness,
		api.getBusinessOwners
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.ownershipDetails),
		validatePurgedBusiness,
		api.addOrUpdateOwners
	)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/owners")
	.get(validatePurgedBusiness, api.getBusinessOwners)
	.all(methodNotAllowed); // returns encrypted DOB and SSN
router
	.route("/internal/businesses/:businessID/owners/unencrypted")
	.get(validatePurgedBusiness, api.getBusinessOwnersUnencrypted)
	.all(methodNotAllowed); // returns unencrypted DOB and SSN

router
	.route("/businesses/:businessID/owners/:ownerID")
	.put(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.updateOwner),
		validatePurgedBusiness,
		api.updateOwner
	)
	.delete(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.deleteBusinessOwner),
		validatePurgedBusiness,
		api.deleteBusinessOwner
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/customers")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getBusinessCustomers),
		validatePurgedBusiness,
		api.getBusinessCustomers
	)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/customers")
	.get(validateSchema(schema.internalBusinessCustomers), validatePurgedBusiness, api.internalBusinessCustomers)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/cases")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.getCasesByBusinessID),
		validatePurgedBusiness,
		api.getCasesByBusinessID
	)
	.all(methodNotAllowed);
router
	.route("/internal/businesses/:businessID/cases")
	.get(validateSchema(schema.getCasesByBusinessID), validatePurgedBusiness, api.getCasesByBusinessID)
	.all(methodNotAllowed);
router
	.route("/customers/:customerID/businesses/:businessID/cases")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getCustomerBusinessCases),
		validatePurgedBusiness,
		api.getCasesByBusinessID
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/businesses/:businessID/applicants")
	.get(
		validateUser,
		validateRole(ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getBusinessApplicants),
		validatePurgedBusiness,
		api.getBusinessApplicantsForCustomer
	)
	.all(methodNotAllowed);

router
	.route("/customers/aurora/businesses/invite")
	.post(validateSchema(schema.auroraInviteBusiness), api.auroraInviteBusiness)
	.all(methodNotAllowed);
router
	.route("/customers/:customerID/businesses/invite")
	.post(
		validateUser,
		validateRole(ROLES.CUSTOMER, ROLES.ADMIN),
		validateDataPermission,
		validatePermissions(or("businesses:write", "businesses:create:invite")),
		externalUploadMultipleMiddleware(),
		validateSchema(schema.inviteBusiness),
		api.inviteBusiness
	)
	.all(methodNotAllowed);

router
	.route("/customer/:customerID/business/:businessID/invites")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getBusinessInvites),
		validatePurgedBusiness,
		api.getBusinessInvites
	)
	.all(methodNotAllowed);

router
	.route("/applicants/:applicantID/invites")
	.get(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.getApplicantBusinessInvites),
		api.getApplicantBusinessInvites
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/business/:businessID/invitations/:invitationID/resend")
	.post(
		validateUser,
		validateRole(ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "businesses:write" }),
		validateSchema(schema.resendCustomerBusinessInvite),
		validatePurgedBusiness,
		api.resendCustomerBusinessInvite
	)
	.all(methodNotAllowed);

router
	.route("/invitation/:invitationID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.getInvitationByID),
		api.getInvitationByID
	)
	.all(methodNotAllowed);
router
	.route("/internal/invitation/:invitationID")
	.get(validateSchema(schema.getInvitationByID), api.getInvitationByID)
	.all(methodNotAllowed);

// business invite details
router
	.route("/business/invitation/details")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.getInvitationDetails),
		api.getInvitationDetails
	)
	.all(methodNotAllowed);

router
	.route("/invitation/:invitationToken/verify")
	.post(validateSchema(schema.verifyInvitationToken), validatePurgedBusiness, api.verifyInvitationToken)
	.all(methodNotAllowed);

router
	.route("/invitation/action")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT, ROLES.CUSTOMER),
		validateSchema(schema.updateInvitationStatus),
		api.updateInvitationStatus
	)
	.all(methodNotAllowed);

router
	.route("/businesses/customers/:customerID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getCustomerBusinesses),
		api.getCustomerBusinesses
	)
	// post route is alias for bulk one, but used for adding single business at a time
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateFeatureFlag(FEATURE_FLAGS.PAT_120_ADD_BUSINESS),
		validateOnboardingLimit,
		validateDataPermission,
		validateSchema(schema.addBusiness),
		api.convertRequestDataFormatToArray,
		api.bulkProcessBusiness
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateFeatureFlag(FEATURE_FLAGS.PAT_120_ADD_BUSINESS),
		validateDataPermission,
		validateSchema(schema.updateBusiness),
		api.convertRequestDataFormatToArray,
		api.bulkProcessBusiness
	)
	.all(methodNotAllowed);

// TODO: deprecate above route
router
	.route("/customers/:customerID/businesses")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.getCustomerBusinesses),
		validateDataPermission,
		validatePermissions({ permission: "businesses:read" }),
		api.getCustomerBusinesses
	)
	.all(methodNotAllowed);

// Search businesses by name, business ID, or case ID
router
	.route("/customers/:customerID/businesses/search")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "businesses:read" }),
		validateSchema(schema.searchCustomerBusinesses),
		api.searchCustomerBusinesses
	)
	.all(methodNotAllowed);

// TODO: add role validation middleware for checking customer
router
	.route("/business/monitoring")
	.post(validateUser, validateSchema(schema.setBusinessMonitoring), validatePurgedBusiness, api.setBusinessMonitoring)
	.all(methodNotAllowed);

/* ----- BULK PROCESS JSON ---------------------------------------------- */
router
	.route([
		"/businesses/customers/:customerID/bulk/validate",
		"/businesses/customers/:customerID/bulk/validate/:applicantID"
	])
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.postBulkProcessBusiness),
		validateDataPermission,
		uploadMiddleware("file"),
		api.bulkValidateBusinesses
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.patchBulkProcessBusiness),
		validateDataPermission,
		uploadMiddleware("file"),
		api.bulkValidateBusinesses
	)
	.all(methodNotAllowed);
router
	.route([
		"/businesses/customers/:customerID/bulk/process",
		"/businesses/customers/:customerID/bulk/process/:applicantID"
	])
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateOnboardingLimit,
		validateSchema(schema.postBulkProcessBusiness),
		validateDataPermission,
		validatePermissions(or("businesses:create", "businesses:create:application")),
		uploadMiddleware("file"),
		api.bulkProcessBusiness
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.patchBulkProcessBusiness),
		uploadMiddleware("file"),
		api.bulkProcessBusiness
	)
	.all(methodNotAllowed);
// Internal route for bulk processing businesses
router
	.route([
		"/internal/businesses/customers/:customerID/bulk/validate",
		"/internal/businesses/customers/:customerID/bulk/validate/:applicantID"
	])
	.post(validateSchema(schema.postBulkProcessBusiness), uploadMiddleware("file"), api.bulkValidateBusinesses)
	.patch(validateSchema(schema.postBulkProcessBusiness), uploadMiddleware("file"), api.bulkValidateBusinesses)
	.all(methodNotAllowed);
router
	.route([
		"/internal/businesses/customers/:customerID/bulk/process",
		"/internal/businesses/customers/:customerID/bulk/process/:applicantID"
	])
	.post(validateSchema(schema.postBulkProcessBusiness), uploadMiddleware("file"), api.bulkProcessBusiness)
	.patch(validateSchema(schema.postBulkProcessBusiness), uploadMiddleware("file"), api.bulkProcessBusiness)
	.all(methodNotAllowed);

router
	.route("/businesses/customers/:customerID/bulk/fields")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, api.bulkProcessBusinessFields)
	.all(methodNotAllowed);

/* ----- BULK PROCESS CSV ---------------------------------------------- */
// NOTE: the bulkProcessBusinessCSV does not exist. Product has requested we keep csv inputs very flexible.
router
	.route([
		"/businesses/customers/:customerID/bulk/csv/validate",
		"/businesses/customers/:customerID/bulk/csv/validate/:applicantID"
	])
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		uploadMiddleware("file"),
		api.bulkValidateBusinesses
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		uploadMiddleware("file"),
		api.bulkValidateBusinesses
	)
	.all(methodNotAllowed);
router
	.route([
		"/businesses/customers/:customerID/bulk/csv/process",
		"/businesses/customers/:customerID/bulk/csv/process/:applicantID"
	])
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateOnboardingLimit,
		validateDataPermission,
		uploadMiddleware("file"),
		api.bulkProcessBusiness
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		uploadMiddleware("file"),
		api.bulkProcessBusiness
	)
	.all(methodNotAllowed);
// Internal route for bulk processing businesses
router
	.route([
		"/internal/businesses/customers/:customerID/bulk/csv/validate",
		"/internal/businesses/customers/:customerID/bulk/csv/validate/:applicantID"
	])
	.post(uploadMiddleware("file"), api.bulkValidateBusinesses)
	.patch(uploadMiddleware("file"), api.bulkValidateBusinesses)
	.all(methodNotAllowed);
router
	.route([
		"/internal/businesses/customers/:customerID/bulk/csv/process",
		"/internal/businesses/customers/:customerID/bulk/csv/process/:applicantID"
	])
	.post(uploadMiddleware("file"), api.bulkProcessBusiness)
	.patch(uploadMiddleware("file"), api.bulkProcessBusiness)
	.all(methodNotAllowed);

router
	.route("/businesses/customers/:customerID/bulk/csv/fields")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, api.bulkProcessBusinessFields)
	.all(methodNotAllowed);

/* ------- END BULK PROCESS --------------------------------------------------- */
router
	.route("/applicant/business")
	.post(validateUser, validateRole(ROLES.APPLICANT), api.createApplicantBusiness)
	.all(methodNotAllowed);

// to get business and owner details for tax-status consent
router
	.route("/internal/business/:businessID")
	.get(validatePurgedBusiness, api.getBusinessDetails)
	.all(methodNotAllowed);

router
	.route("/internal/applicant/business")
	.post(validateUser, validateRole(ROLES.APPLICANT), api.createApplicantBusiness)
	.all(methodNotAllowed);

// to get all businesses in manual-score-service for score refresh
router.route("/internal/businesses").get(validateUser, api.getBusinessesInternal).all(methodNotAllowed);

router
	.route("/business/:businessID/progression")
	.get(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.getProgression),
		validatePurgedBusiness,
		api.getProgression
	)
	.all(methodNotAllowed);

router
	.route("/cases/:caseID/custom-fields")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT, ROLES.ADMIN),
		validateSchema(schema.addOrUpdateCustomFields),
		externalUploadMultipleMiddleware(),
		api.addOrUpdateCustomFields
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/assert-tin-valid")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT, ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.assertTinValid),
		validatePurgedBusiness,
		api.assertTinValid
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/validate")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateSchema(schema.validateBusiness),
		validatePurgedBusiness,
		api.validateBusiness
	)
	.all(methodNotAllowed);

// @deprecated
router
	.route("/invitation/:invitationID/accept")
	.post(validateUser, validateRole(ROLES.APPLICANT), validateSchema(schema.acceptInvitation), api.acceptInvitation)
	.all(methodNotAllowed);

// single business-tin encryption
router
	.route("/existing-business/encrypt-data/:businessID")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.singleBusinessEncryption),
		validatePurgedBusiness,
		api.singleBusinessEncryption
	)
	.all(methodNotAllowed);

// Handle finding a business by TIN
router
	.route("/internal/businesses/tin/:tin")
	.get(validateSchema(schema.getBusinessByTin), api.getBusinessByTin)
	.all(methodNotAllowed);
router
	.route("/businesses/tin/:tin")
	.get(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.getBusinessByTin), api.getBusinessByTin)
	.all(methodNotAllowed);
// Handle finding a business by customer external id
router
	.route("/internal/businesses/customers/:customerID/external_id/:externalID")
	.get(validateSchema(schema.getBusinessByExternalId), api.getBusinessByExternalId)
	.all(methodNotAllowed);
// Handle getting a business enriched with a customer's information for it
router
	.route("/internal/businesses/:businessID/customers/:customerID")
	.get(validateSchema(schema.getCustomerBusiness), validatePurgedBusiness, api.getCustomerBusiness)
	.all(methodNotAllowed);
router
	.route("/customers/:customerID/businesses/external_id/:externalID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "businesses:read" }),
		validateSchema(schema.getBusinessByExternalId),
		api.getBusinessByExternalId
	)
	.all(methodNotAllowed);
// Handle getting a business enriched with a customer's information for it
router
	.route("/customers/:customerID/businesses/:businessID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions({ permission: "businesses:read" }),
		validateSchema(schema.getCustomerBusiness),
		validatePurgedBusiness,
		api.getCustomerBusiness
	)
	.all(methodNotAllowed);
router
	.route("/customers/:customerID/businesses/:businessID/refresh-score")
	.post(
		validateUser,
		validateRole(ROLES.CUSTOMER, ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.refreshScore),
		validatePurgedBusiness,
		api.refreshBusinessScore
	)
	.all(methodNotAllowed);

router
	.route("/business/:businessID/names")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validatePurgedBusiness, api.getBusinessAllNames)
	.all(methodNotAllowed);
router
	.route("/business/:businessID/addresses")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validatePurgedBusiness, api.getBusinessAllAddresses)
	.all(methodNotAllowed);
router
	.route("/internal/businesses/:businessID/names-addresses")
	.get(validatePurgedBusiness, api.getBusinessAllNamesAddresses)
	.all(methodNotAllowed);
// score refresh by admin by using only businessId
router
	.route("/score/businesses/:businessID/refresh")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.refreshScoreBusiness),
		validatePurgedBusiness,
		api.refreshBusinessScore
	)
	.all(methodNotAllowed);
router
	.route("/score/businesses/:businessID/refresh-processing-time")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.refreshProcessingTime),
		validatePurgedBusiness,
		api.refreshProcessingTime
	)
	.all(methodNotAllowed);

// temp api to update naics code for businesses
router
	.route("/bulk-update-naics-code")
	.post(validateUser, validateRole(ROLES.ADMIN), api.bulkUpdateNaicsCode)
	.all(methodNotAllowed);

// to update and insert core naics and mcc codes
router
	.route("/bulk-update-core-naics-mcc")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateFeatureFlag(FEATURE_FLAGS.DOS_395_NAICS_MCC_MAPPING),
		uploadMiddleware("file"),
		api.bulkUpdateCoreNaicsMccCode
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateFeatureFlag(FEATURE_FLAGS.DOS_395_NAICS_MCC_MAPPING),
		api.deleteRelNaicsMccCodes
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/invite/co-applicants")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateFeatureFlag(FEATURE_FLAGS.PAT_55_INVITE_CO_APPLICANTS),
		validateSchema(schema.inviteCoApplicants),
		validatePurgedBusiness,
		api.inviteCoApplicants
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/co-applicants/invites")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateFeatureFlag(FEATURE_FLAGS.PAT_55_INVITE_CO_APPLICANTS),
		validateSchema(schema.getCoApplicantInvites),
		validatePurgedBusiness,
		api.getCoApplicantInvites
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/invitations/:invitationID/resend")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateDataPermission,
		validateFeatureFlag(FEATURE_FLAGS.PAT_58_MANAGE_INVITEE_AND_LINK_EXPIRY),
		validateSchema(schema.resendCoApplicantInvite),
		validatePurgedBusiness,
		api.resendCoApplicantInvite
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/invitations/:invitationID/revoke")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateDataPermission,
		validateFeatureFlag(FEATURE_FLAGS.PAT_58_MANAGE_INVITEE_AND_LINK_EXPIRY),
		validateSchema(schema.revokeCoApplicantInvite),
		validatePurgedBusiness,
		api.revokeCoApplicantInvite
	)
	.all(methodNotAllowed);

router
	.route("/businesses/invite/request-invite-link")
	.post(
		rateLimitMiddleware(),
		validateFeatureFlag(FEATURE_FLAGS.PAT_58_MANAGE_INVITEE_AND_LINK_EXPIRY),
		validateSchema(schema.requestInviteLink),
		api.requestInviteLink
	)
	.all(methodNotAllowed);

router
	.route("/applicant/invite-link-request/:requestToken/accept")
	.post(
		validateFeatureFlag(FEATURE_FLAGS.PAT_58_MANAGE_INVITEE_AND_LINK_EXPIRY),
		validateSchema(schema.acceptInviteLinkRequest),
		api.acceptInviteLinkRequest
	)
	.all(methodNotAllowed);

router
	.route("/applicant/invite-link-request/:requestToken/deny")
	.post(
		validateFeatureFlag(FEATURE_FLAGS.PAT_58_MANAGE_INVITEE_AND_LINK_EXPIRY),
		validateSchema(schema.denyInviteLinkRequest),
		api.denyInviteLinkRequest
	)
	.all(methodNotAllowed);

// Debug/Temporary route to add custom fields to a case from an invite
router
	.route("/admin/invites/:inviteID/add-custom-fields")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.addCustomFieldsFromInvite),
		api.addCustomFieldsFromInvite
	)
	.all(methodNotAllowed);

router
	.route("/admin/owner/:ownerID/send-owner-updated-event")
	.post(validateUser, validateRole(ROLES.ADMIN), api.sendOwnerUpdatedEvent)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/related-businesses")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.getRelatedBusinessesAdmin),
		validatePurgedBusiness,
		api.getRelatedBusinesses
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/businesses/:businessID/related-businesses")
	.get(
		validateUser,
		validateRole(ROLES.CUSTOMER, ROLES.ADMIN),
		validateDataPermission,
		validatePermissions({ permission: "businesses:read" }),
		validateSchema(schema.getRelatedBusinessesCustomer),
		validatePurgedBusiness,
		api.getRelatedBusinesses
	)
	.all(methodNotAllowed);

// Internal route to get related businesses
router
	.route("/internal/businesses/business/:businessID/related-businesses")
	.post(
		validateSchema(schema.getRelatedBusinessByBusinessId),
		validatePurgedBusiness,
		api.getRelatedBusinessByBusinessId
	)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/applicant")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.validateBusinessHasApplicant),
		validatePurgedBusiness,
		api.validateBusinessHasApplicant
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/businesses/:businessID/cases/:caseID/clone")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.cloneBusiness),
		validatePurgedBusiness,
		api.cloneBusiness
	)
	.all(methodNotAllowed);

router
	.route("/validation/disposable-domain")
	.get(validateUser, validateSchema(schema.checkDisposableDomain), api.checkDisposableDomain)
	.all(methodNotAllowed);

/**
 * Internal endpoints for custom fields (used by integration-service for inline editing)
 * These endpoints support case management inline editing functionality
 */
router
	.route("/internal/customers/:customerID/custom-field-template")
	.get(validateSchema(schema.getCustomFieldTemplate), api.getCustomFieldTemplate)
	.all(methodNotAllowed);

router
	.route("/internal/custom-fields/templates/:templateId/fields")
	.get(validateSchema(schema.getCustomFieldDefinitions), api.getCustomFieldDefinitions)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/cases/:caseID/custom-fields")
	.get(validateSchema(schema.getBusinessCustomFieldValues), validatePurgedBusiness, api.getBusinessCustomFieldValues)
	.patch(validateSchema(schema.updateBusinessCustomFieldValues), validatePurgedBusiness, api.updateBusinessCustomFieldValues)
	.all(methodNotAllowed);

module.exports = router;
