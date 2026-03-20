import { Router } from "express";
import { methodNotAllowed, validateRole, validateSchema, validateUser, validateDataPermission, validatePurgedBusiness } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

const router = Router();

router
	.route("/business/:businessId/adverse-media")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.getAdverseMediaByBusinessId), validatePurgedBusiness, api.getAdverseMediaByBusinessId)
	.all(methodNotAllowed);

router
	.route("/cases/:caseId/adverse-media")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.getAdverseMediaDataByCaseId), api.getAdverseMediaDataByCaseId)
	.all(methodNotAllowed);

// admin only route for debugging purposes of adverse media
router.route("/temp/adverse-media").post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.debugAdverseMedia), api.debugAdverseMedia).all(methodNotAllowed);

module.exports = router;
