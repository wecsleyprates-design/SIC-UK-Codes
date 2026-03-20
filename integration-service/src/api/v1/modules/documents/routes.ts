import { Router } from "express";
const router = Router();
import { methodNotAllowed, validatePurgedBusiness, validateRole, validateSchema, validateUser } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

router.route("/documents/businesses/:businessID").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.getDocuments), validatePurgedBusiness, api.getDocuments).all(methodNotAllowed);
router.route("/documents/download/").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.downloadDocument), api.downloadDocument).all(methodNotAllowed);
module.exports = router;
