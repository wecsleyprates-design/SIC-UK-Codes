import { Router } from "express";
import {
	externalUploadMultipleMiddleware,
	methodNotAllowed,
	validateDataPermission,
	validateRole,
	validateSchema,
	validateUser,
	validatePurgedBusiness
} from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

const router = Router();

router
	.route("/sessions/business/:businessID")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.createSession),
		validatePurgedBusiness,
		api.createSession
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/esign/templates")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.addTemplate),
		api.addTemplate
	)
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getTemplates),
		api.getTemplates
	)
	.all(methodNotAllowed);

router
	.route("/esign/templates")
	.get(validateUser, validateRole(ROLES.ADMIN), api.getGlobalTemplates)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		externalUploadMultipleMiddleware("file"),
		validateSchema(schema.addGlobalTemplate),
		api.addGlobalTemplates
	)
	.all(methodNotAllowed);

router
	.route("/business/:businessID/esign")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getSignedDocuments),
		validatePurgedBusiness,
		api.getSignedDocuments
	)
	.all(methodNotAllowed);

router
	.route("/business/:businessID/mock-esign")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.mockEsign),
		validatePurgedBusiness,
		api.mockEsign
	)
	.all(methodNotAllowed);

module.exports = router;
