import { validateUser, validateSchema, validatePurgedBusiness } from "#middlewares/index";
import { Router } from "express";
import { schema } from "./schema";
import { controller as api } from "./controllers";
import { methodNotAllowed } from "#middlewares/route.middleware";
import { validateRole } from "#middlewares/role.middleware";
import { validateDataPermission } from "#middlewares/access.middleware";
import { ROLES } from "#constants";

const router = Router();

/**
 * Custom Fields Routes
 *
 * These endpoints support inline editing of custom fields in Case Management.
 */

router
	.route(["/custom-fields/business/:businessID/override/:fieldId", "/custom-fields/business/:businessID/override"])
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getCustomFields),
		validatePurgedBusiness,
		api.getCustomFields
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateCustomFields),
		validatePurgedBusiness,
		api.updateCustomFields
	)
	.put(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateCustomFields),
		validatePurgedBusiness,
		api.updateCustomFields
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.deleteCustomFields),
		validatePurgedBusiness,
		api.deleteCustomFields
	)
	.all(methodNotAllowed);

/**
 * Internal routes (no user validation)
 * Used for internal service-to-service communication
 */
router
	.route("/internal/custom-fields/business/:businessID/override")
	.get(validateSchema(schema.getCustomFields), validatePurgedBusiness, api.getCustomFields)
	.patch(validateSchema(schema.updateCustomFields), validatePurgedBusiness, api.updateCustomFields)
	.all(methodNotAllowed);

module.exports = router;
