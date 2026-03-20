import { Router } from "express";
const router = new Router();
import { methodNotAllowed, validateSchema } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";

router.route("/internal/integration-data/banking").get(validateSchema(schema.getBankingData), api.getBankingData).all(methodNotAllowed);

router.route("/internal/integration-data/public-records").get(validateSchema(schema.getPublicRecords), api.getPublicRecords).all(methodNotAllowed);

module.exports = router;
