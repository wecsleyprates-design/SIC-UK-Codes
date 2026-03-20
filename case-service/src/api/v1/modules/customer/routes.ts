import { Router } from "express";
import { controller as api } from "./controller";
import { validateUser } from "#middlewares/authentication.middleware";
import { methodNotAllowed } from "#middlewares/route.middleware";
import { validateRole } from "#middlewares/role.middleware";
import { ROLES } from "#constants";
import { validateDataPermission, validatePermissions, validateSchema, or } from "#middlewares";
import { schema } from "./schema";
const router = Router();

router
	.route("/temp/customer-authorization/prepare-cache")
	.post(validateUser, validateRole(ROLES.ADMIN), api.prepareCustomerAuthorizationCache)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/cases/:caseID/application-edit/invite")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validatePermissions(or("case:write", "businesses:create:application")),
		validateSchema(schema.getCustomerInviteForApplicationEdit),
		api.getCustomerInviteForApplicationEdit
	)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/cases/:caseID/application-edit/sessions")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getApplicationEditSessions),
		api.getApplicationEditSessions
	)
	.all(methodNotAllowed);
router
	.route("/internal/customer-authorization/update-cache/:customerID")
	.post(api.updateCustomerAuthorizationCache)
	.all(methodNotAllowed);

module.exports = router;
