import { Router } from "express";
import { methodNotAllowed, validatePurgedBusiness, validateRole, validateSchema, validateUser } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

const router = Router();

router.route("/sessions/business/:businessID").post(validateUser, validateRole(ROLES.ADMIN, ROLES.APPLICANT), validateSchema(schema.createSession), validatePurgedBusiness, api.createSession).all(methodNotAllowed);

module.exports = router;
