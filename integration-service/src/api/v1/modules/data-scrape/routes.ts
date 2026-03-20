import { methodNotAllowed, validatePurgedBusiness, validateTypedSchema, validateUser } from "#middlewares/index";
import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";

const router = Router();

router
	.route("/businesses/:businessID/search-business-details")
	.post(validateUser, validateTypedSchema(schema.dataScrape), validatePurgedBusiness, api.searchForBusiness)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/search-business-details")
	.post(validateTypedSchema(schema.dataScrape), validatePurgedBusiness, api.searchForBusiness)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/serp-result")
	.get(validateUser, validateTypedSchema(schema.getSerpResult), validatePurgedBusiness, api.getSerpResult)
	.all(methodNotAllowed);

router
	.route("/businesses/:businessID/google-profile")
	.get(validateUser, validateTypedSchema(schema.getGoogleProfile), api.getGoogleProfile)
	.post(validateUser, validateTypedSchema(schema.searchGoogleProfile), api.searchGoogleProfile)
	.all(methodNotAllowed);

router
	.route("/internal/businesses/:businessID/google-profile")
	.get(validateTypedSchema(schema.getGoogleProfile), api.getGoogleProfile)
	.post(validateTypedSchema(schema.searchGoogleProfile), api.searchGoogleProfile)
	.all(methodNotAllowed);

module.exports = router;
