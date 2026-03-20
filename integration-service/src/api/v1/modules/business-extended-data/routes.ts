import { validateUser, validateSchema, validatePurgedBusiness } from "#middlewares/index";
import { Router } from "express";
import { schema } from "./schema";
import { controller as api } from "./controllers";
import { methodNotAllowed } from "#middlewares/route.middleware";
import { validateRole } from "#middlewares/role.middleware";
import { ROLES } from "#constants";
import { validateDataPermission } from "#middlewares/access.middleware";
const router = Router();

router
	.route("/businesses/:businessID/extended-data")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.businessIDParam), validatePurgedBusiness, api.getBusinessExtendedData)
	.all(methodNotAllowed);

module.exports = router;
