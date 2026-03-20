import { Router } from "express";
import {
	methodNotAllowed,
	validateDataPermission,
	validateRole,
	validateSchema,
	validateUser
} from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

const router = Router();

router
	.route("/case-decisioning/customers/:customerID/configuration")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getWorkflowDecisioningConfiguration),
		api.getWorkflowDecisioningConfiguration
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateWorkflowDecisioningConfiguration),
		api.updateWorkflowDecisioningConfiguration
	)
	.all(methodNotAllowed);

module.exports = router;
