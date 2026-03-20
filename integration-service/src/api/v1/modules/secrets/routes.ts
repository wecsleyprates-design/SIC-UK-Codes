import { Router } from "express";
import { controller as api } from "./controller";
import { methodNotAllowed, validateDataPermission, validateRole, validateSchema, validateUser } from "#middlewares";
import { schema } from "./schema";
import { ROLES } from "#constants/roles.constant";

const router = Router();

router
	.route("/secrets/customers/:customer_id")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.getSecret), api.getSecret)
	.put(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.updateSecret), api.updateSecret)
	.delete(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.deleteSecret), api.deleteSecret)
	.all(methodNotAllowed);

router.route("/secrets/customers").post(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateSchema(schema.createSecret), api.createSecret).all(methodNotAllowed);

export default router;
