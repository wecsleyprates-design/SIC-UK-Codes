import { methodNotAllowed, validateTypedSchema } from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";

const router = Router();

router.route("/faq-chatbot").post(validateTypedSchema(schema.submitUserQuery), api.submitUserQuery).all(methodNotAllowed);

module.exports = router;
