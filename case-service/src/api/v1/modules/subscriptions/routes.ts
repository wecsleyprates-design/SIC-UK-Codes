import { Router } from "express";
const router = Router();
import { methodNotAllowed, validateDataPermission, validateRole, validateSchema, validateUser, validatePurgedBusiness } from "#middlewares/index";
import { controller as api } from "./controller";
import { schema } from "./schema";
import { ROLES } from "#constants";

router.route("/subscriptions/plans").get(validateUser, api.getSubscriptionPlans).all(methodNotAllowed);

router.route("/subscriptions/businesses/:businessID").get(validateUser, validateRole(ROLES.ADMIN, ROLES.APPLICANT), validateSchema(schema.getBusinessSubscriptionDetails), validatePurgedBusiness, api.getBusinessSubscriptionDetails).all(methodNotAllowed);

router.route("/subscriptions/businesses/:businessID/create").post(validateUser, validateSchema(schema.createSubscription), validatePurgedBusiness, api.createSubscription).all(methodNotAllowed);

router.route("/subscriptions/businesses/:businessID/status").get(validateUser, validateSchema(schema.getBusinessSubscriptionStatus), validatePurgedBusiness, api.getBusinessSubscriptionStatus).all(methodNotAllowed);

router.route("/subscriptions/businesses/:businessID/customer-portal-session").post(validateUser, validateSchema(schema.customerPortalSession), validatePurgedBusiness, api.createCustomerPortalSession).all(methodNotAllowed);

router.route("/subscriptions/businesses/:businessID/history").get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, validateSchema(schema.getBusinessSubscriptionHistory), validatePurgedBusiness, api.getBusinessSubscriptionHistory).all(methodNotAllowed);

router.route("/subscriptions/businesses/:businessID/cancel").post(validateUser, validateRole(ROLES.ADMIN), validateSchema(schema.cancelBusinessSubscription), validatePurgedBusiness, api.cancelBusinessSubscription).all(methodNotAllowed);

module.exports = router;
