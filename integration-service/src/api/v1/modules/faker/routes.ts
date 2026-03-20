import { methodNotAllowed, validatePurgedBusiness, validateRole, validateSchema, validateUser } from "#middlewares/index";
import { ROLES } from "#constants";
import { schema } from "./schema";
import { Router } from "express";
import { controller as api } from "./controller";
const router = Router();

router.route("/faker/business/:business_id/accounting").post(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.accounting), validatePurgedBusiness, api.generateAccoutingFakerData).all(methodNotAllowed);

router.route("/faker/business/:business_id/places").post(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.places), validatePurgedBusiness, api.generatePlacesFakerData).all(methodNotAllowed);

router.route("/faker/business/:business_id/plaid-data").post(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.plaid_data), validatePurgedBusiness, api.generatePlaidFakerData).all(methodNotAllowed);

router.route("/faker/business/:business_id/google-business").post(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.google_business), validatePurgedBusiness, api.generateGoogleBusinessFakerData).all(methodNotAllowed);

router.route("/faker/business/:business_id/tax-filing").post(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.tax_filing), validatePurgedBusiness, api.generateFakeTaxFilingFakerData).all(methodNotAllowed);

router.route("/faker/business/:business_id/verdata").post(validateUser, validateRole(ROLES.APPLICANT, ROLES.ADMIN), validateSchema(schema.verdata), validatePurgedBusiness, api.generateVerdataFakerData).all(methodNotAllowed);

module.exports = router;
