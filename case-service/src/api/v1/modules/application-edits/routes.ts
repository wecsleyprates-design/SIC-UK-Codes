import { Router } from "express";
import { methodNotAllowed, validateSchema, validateUser, validateRole, validatePurgedBusiness } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

const router = Router();

router
	.route("/internal/business/:businessID/application-edit")
	.post(validateSchema(schema.applicationEdit), validatePurgedBusiness, api.applicationEdit)
	.get(validateSchema(schema.getApplicationEdit), validatePurgedBusiness, api.getApplicationEdit)
	.all(methodNotAllowed);

router
	.route("/customer/:customerID/application-edit/status")
	.get(validateUser, validateSchema(schema.applicationEditStatus), api.applicationEditStatus)
	.all(methodNotAllowed);

router
	.route("/business/:businessID/application-edit/delete")
	.post(
		validateUser,
		validateRole(ROLES.APPLICANT, ROLES.CUSTOMER),
		validateSchema(schema.clearApplicationEditLock),
		validatePurgedBusiness,
		api.clearApplicationEditLock
	)
	.all(methodNotAllowed);

router
	.route("/business/:businessID/application-edit/submit")
	.post(validateUser, validateSchema(schema.applicationEditSubmit), validatePurgedBusiness, api.applicationEditSubmit)
	.all(methodNotAllowed);

module.exports = router;
