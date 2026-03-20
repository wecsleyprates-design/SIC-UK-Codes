import { externalUploadMiddleware, methodNotAllowed, validateDataPermission, validateRole, validateTypedSchema, validateUser } from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

const router = Router();

router
	.route("/customers/:customerId/settings")
	.post(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, validateTypedSchema(schema.createCustomerSettings), api.createCustomerSettings)
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, api.getCustomerSettingsById)
	.patch(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, validateTypedSchema(schema.updatePartialCustomerSettings), api.updatePartialCustomerSetting)
	.all(methodNotAllowed);
router.route("/customers/domain/:domain/settings").get(validateUser, api.getCustomerSettings).all(methodNotAllowed);
router
	.route("/customers/:customerId/settings/upload")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		externalUploadMiddleware("file"),
		validateTypedSchema(schema.uploadFileCustomerSettings),
		api.uploadWhiteLabelFile
	)
	.all(methodNotAllowed);
router.route("/internal/customer-settings/:customerId").get(api.getCustomerSettingsById).all(methodNotAllowed);
router.route("/customers/add-ses-identity").post(validateUser, validateRole(ROLES.ADMIN), validateTypedSchema(schema.addIdentityInSES), api.addIdentityInSES);
module.exports = router;
