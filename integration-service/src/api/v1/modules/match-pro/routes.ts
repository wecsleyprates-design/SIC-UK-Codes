import { Router } from "express";
import { controller as api } from "./controller";
import { externalUploadMiddleware, methodNotAllowed, validateDataPermission, validateRole, validateSchema, validateTypedSchema, validateUser } from "#middlewares";
import { schema } from "./schema";
import { ROLES } from "#constants/roles.constant";

const router = Router();

router.route("/match-pro/:customerId/check-connection-status").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.checkConnectionStatus), api.checkConnectionStatus);

router
	.route("/match-pro/:customerId/credentials")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, validateTypedSchema(schema.getCredentials), api.getCredentials)
	.post(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, externalUploadMiddleware("keyFile"), validateTypedSchema(schema.credentials), api.saveCredentials)
	.put(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, externalUploadMiddleware("keyFile"), validateTypedSchema(schema.credentials), api.updateCredentials)
	.all(methodNotAllowed);
export default router;
