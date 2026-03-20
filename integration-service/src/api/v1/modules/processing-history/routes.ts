import {
	methodNotAllowed,
	validateUser,
	validateRole,
	validateTypedSchema,
	validatePurgedBusiness,
	validateDataPermission
} from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

const router = Router();

router
	.route("/business/:businessId/processing-history")
	.post(validateUser, validateRole(ROLES.APPLICANT), validateTypedSchema(schema.addProcessingHistory), validatePurgedBusiness, api.addProcessingHistory)
	.get(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN, ROLES.CUSTOMER), validateTypedSchema(schema.getProcessingHistory), validatePurgedBusiness, api.getProcessingHistory)
	.all(methodNotAllowed);

router.route("/internal/businesses/:businessId/processing-history").get(validateTypedSchema(schema.getProcessingHistory), validatePurgedBusiness, api.getProcessingHistory).all(methodNotAllowed);

module.exports = router;
