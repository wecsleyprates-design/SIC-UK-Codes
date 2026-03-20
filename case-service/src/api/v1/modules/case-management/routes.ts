import {
	methodNotAllowed,
	validateRole,
	validateDataPermission,
	validateSchema,
	validateUser,
	validatePermissions,
	validatePurgedBusiness
} from "#middlewares/index";
import { externalUploadMultipleMiddleware } from "#middlewares/upload.middleware";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";
const router = Router();

router.route("/statuses").get(validateUser, api.getStatuses).all(methodNotAllowed);

router.route("/titles").get(validateUser, api.getTitles).all(methodNotAllowed);
router.route("/internal/titles").get(api.getTitles).all(methodNotAllowed);

router.route("/cases").get(validateUser, api.getCases).all(methodNotAllowed);
router.route("/internal/cases").get(api.getCases).all(methodNotAllowed);

router
	.route("/customers/:customerID/cases/export")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getCaseDetailsExport),
		api.getCaseDetailsExport
	)
	.all(methodNotAllowed);

router
	.route("/cases/:caseID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validatePurgedBusiness,
		validateSchema(schema.getStandaloneCaseByID),
		api.getCaseByID
	)
	.all(methodNotAllowed);

router
	.route("/internal/cases/:caseID")
	.get(validatePurgedBusiness, validateSchema(schema.internalGetCaseByID), api.internalGetCaseByID)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/cases")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.createCase),
		api.createCase
	)
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, api.getCases)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/cases/:caseID")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePurgedBusiness,
		validateSchema(schema.getCaseByID),
		api.getCaseByID
	)
	.patch(
		validateUser,
		validateRole(ROLES.CUSTOMER),
		validateDataPermission,
		validatePurgedBusiness,
		validatePermissions({ permission: "case:write:status" }),
		validateSchema(schema.updateCaseStatus),
		api.updateCaseStatus
	)
	.all(methodNotAllowed);

router.route("/case-types").get(validateUser, api.getCaseTypes).all(methodNotAllowed);

router
	.route("/cases/:caseID/information-update")
	.patch(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateDataPermission,
		validatePurgedBusiness,
		validateSchema(schema.informationUpdate),
		api.informationUpdate
	);

router
	.route("/internal/businesses/:businessID/case")
	.post(validateUser, validatePurgedBusiness, api.createCaseOnApplicationEdit)
	.all(methodNotAllowed);

// Internal route to get case status for report generation
router
	.route("/internal/cases/status/report-generation")
	.get(validateSchema(schema.getCaseStatusReportGeneration), api.getCaseStatusReportGeneration)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/cases/:caseID/information-request")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePurgedBusiness,
		validatePermissions({ permission: "case:write:additional_info" }),
		validateSchema(schema.requestAdditionalInfo),
		api.requestAdditionalInfo
	)
	.all(methodNotAllowed);

router
	.route("/cases/:caseID/information-request")
	.get(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateDataPermission,
		validatePurgedBusiness,
		validateSchema(schema.getInformationRequest),
		api.getInformationRequest
	);

router
	.route("/customers/:customerID/cases/:caseID/additional-documents")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validatePurgedBusiness,
		externalUploadMultipleMiddleware(),
		validateSchema(schema.uploadAdditionalDocuments),
		api.uploadAdditionalDocuments
	)
	.all(methodNotAllowed);

router

	.route("/internal/businesses/:businessID/documents")

	.get(validateSchema(schema.getDocuments), validatePurgedBusiness, api.getDocuments)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/cases/:caseID/re-assign")
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validatePermissions({ permission: "case:write:assignment" }),
		validatePurgedBusiness,
		validateSchema(schema.reassignCase),
		api.reassignCase
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/cases/:caseID/decrypt-ssn")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePurgedBusiness,
		validateSchema(schema.decryptSSN),
		api.decryptSSN
	)
	.all(methodNotAllowed);

module.exports = router;
