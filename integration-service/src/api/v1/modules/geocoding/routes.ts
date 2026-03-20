import { Router } from "express";
import { controller as api } from "./controller";
import { methodNotAllowed, validateSchema, validateUser } from "#middlewares";
import { schema } from "./schema";

const router = Router();

router
	.route("/geocoding")
	.get(
		validateUser,
		validateSchema(schema.geocodeAddress),
		api.geocodeAddress
	)
	.all(methodNotAllowed);

export default router;

