import { methodNotAllowed, validateSchema } from "#middlewares/index";
import { validateWebhookRequest } from "#middlewares/plaid.middleware";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";
const router = Router();

router.route("/callback/rutter").post(validateSchema(schema.rutter), api.handleRutter).all(methodNotAllowed);
router.route("/callback/plaid_idv").post(validateWebhookRequest, validateSchema(schema.plaid_idv), api.handlePlaidIdv).all(methodNotAllowed);

module.exports = router;
