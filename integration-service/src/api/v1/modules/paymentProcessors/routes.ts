import { Router } from "express";
import { controller as api } from "./controller";
import { schema } from "./schema";
import {
	methodNotAllowed,
	validateDataPermission,
	validateRole,
	validateSchema,
	validateUser
} from "#middlewares/index";
import { ROLES } from "#constants/roles.constant";

const router = Router();

router
	.route("/payment-processors/:customerId/merchant-profiles/:businessId")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getMerchantProfileBusinessId),
		api.getMerchantProfileBusinessId
	);

router
	.route("/internal/payment-processors/:customerId/merchant-profiles/:businessId")
	.get(validateSchema(schema.getMerchantProfileBusinessId), api.getMerchantProfileBusinessId)
	.all(methodNotAllowed);

router
	.route("/payment-processors/:customerId/merchant-profiles")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.createMerchantProfiles),
		api.createMerchantProfiles
	)
	.all(methodNotAllowed);

router
	.route("/payment-processors/:customerId/merchant-profiles/tos/:businessId/:processorId")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateDataPermission,
		validateSchema(schema.setTermsOfService),
		api.setTermsOfService
	)
	.all(methodNotAllowed);

router
	.route("/payment-processors/:customerId/businesses/:businessId/accounts/:processorAccountId")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.getBusinessPaymentProcessorAccount),
		validateDataPermission,
		api.getBusinessPaymentProcessorAccount
	)
	.all(methodNotAllowed);

// Intentionally only Admin & Applicant can access this route -- it allows performing actions on behalf of the merchant
// Get ephemeral session token
router
	.route("/payment-processors/:customerId/businesses/:businessId/accounts/:processorAccountId/session")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.APPLICANT),
		validateSchema(schema.getProcessorAccountSession),
		validateDataPermission,
		api.getProcessorAccountSession
	)
	.all(methodNotAllowed);

router
	.route("/payment-processors/:customerId/businesses/:businessId/accounts")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER, ROLES.APPLICANT),
		validateSchema(schema.getBusinessPaymentProcessorAccounts),
		validateDataPermission,
		api.getBusinessPaymentProcessorAccounts
	)
	.all(methodNotAllowed);

router
	.route("/payment-processors/:customerId/accounts")
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.prefillPaymentProcessorAccounts),
		api.createPaymentProcessorAccounts
	)
	.all(methodNotAllowed);

router
	.route("/payment-processors/:customerId/processors")
	.get(validateUser, validateRole(ROLES.ADMIN, ROLES.CUSTOMER), validateDataPermission, api.listProcessors)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.createProcessor),
		api.createProcessor
	)
	.all(methodNotAllowed);

router
	.route("/payment-processors/:customerId/processors/:processorId")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getOrDeleteProcessor),
		api.getProcessor
	)
	.delete(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getOrDeleteProcessor),
		api.deleteProcessor
	)
	.patch(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.updateProcessor),
		api.updateProcessor
	)
	.all(methodNotAllowed);
router
	.route("/payment-processors/:customerId/accounts/:processorAccountId/status")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN, ROLES.CUSTOMER),
		validateDataPermission,
		validateSchema(schema.getProcessorAccountStatus),
		api.getProcessorAccountStatus
	)
	.all(methodNotAllowed);

router
	.route("/payment-processors/webhook/stripe/:customerId/:processorId")
	.post(validateSchema(schema.stripeWebhook), api.handleStripeWebhook);

// Debug Admin only route to manage payment processor entitlements
router
	.route("/payment-processors/:customerId/entitlements")
	.get(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateSchema(schema.getPaymentProcessorEntitlements),
		validateDataPermission,
		api.getPaymentProcessorEntitlements
	)
	.post(
		validateUser,
		validateRole(ROLES.ADMIN),
		validateDataPermission,
		validateSchema(schema.postPaymentProcessorEntitlements),
		api.managePaymentProcessorEntitlements
	);

module.exports = router;
