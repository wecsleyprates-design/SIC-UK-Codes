import { ROLES } from "#constants";
import { validateUser } from "#middlewares/authentication.middleware";
import { validateRole } from "#middlewares/role.middleware";
import { validateSchema } from "#middlewares/validation.middleware";
import { Router } from "express";
import { schema } from "./schema";
import { methodNotAllowed } from "#middlewares/route.middleware";
import { controller as api } from "./controller";
import { get } from "http";
import { validateDataPermission } from "#middlewares/access.middleware";
import { validateFeatureFlag } from "#middlewares";
import { FEATURE_FLAGS } from "#constants";
const router = Router();

router
	.route("/customer-integration-settings")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.addCustomerIntegrationSettings),
		validateDataPermission,
		api.createOrUpdateCustomerIntegrationSettings
	);

router
	.route("/customer-integration-settings/:customerID")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, api.findById)
	.all(methodNotAllowed);

router
	.route("/customers/:customerID/integration-settings/:integrationName")
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateSchema(schema.patchCustomerIntegrationSetting),
		validateDataPermission,
		api.patchCustomerIntegrationSetting
	)
	.all(methodNotAllowed);

router.route("/internal/customer-integration-settings/:customerID").get(api.findById).all(methodNotAllowed);

router
	.route("/integration-status/customers/:customerID")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.updateIntegrationStatusForCustomer),
		api.updateIntegrationStatusForCustomer
	)
	.get(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.getIntegrationStatusForCustomer),
		api.getIntegrationStatusForCustomer
	);

router
	.route("/sync-customer-integration-settings")
	.get(validateUser, validateRole(ROLES.ADMIN), api.syncAllFromCaseSettings)
	.all(methodNotAllowed);

router
	.route("/internal/integration-status/customers/:customerID")
	.get(validateSchema(schema.getIntegrationStatusForCustomer), api.getIntegrationStatusForCustomer);

module.exports = router;
