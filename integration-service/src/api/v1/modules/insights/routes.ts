import { methodNotAllowed, validateTypedSchema, validateUser } from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";

const router = Router();

router.route("/insights/:caseId").get(validateUser, validateTypedSchema(schema.getInsightsReport), api.getInsights).all(methodNotAllowed);

router.route("/insights/:caseId/action-items").get(validateUser, validateTypedSchema(schema.getActionItems), api.getActionItems).all(methodNotAllowed);

router.route("/insights/:actionItemId/action-items/update").put(validateUser, validateTypedSchema(schema.updateActionItem), api.updateActionItem).all(methodNotAllowed);

router.route("/insights/:caseId/action-items/remove").delete(validateUser, validateTypedSchema(schema.deleteActionItems), api.deleteActionItems).all(methodNotAllowed);

router.route("/insights/:caseId/action-items/create").post(validateUser, validateTypedSchema(schema.createActionItem), api.createActionItem).all(methodNotAllowed);

router.route("/insights-chatbot").post(validateUser, validateTypedSchema(schema.submitUserQuery), api.submitUserQuery).all(methodNotAllowed);

module.exports = router;
