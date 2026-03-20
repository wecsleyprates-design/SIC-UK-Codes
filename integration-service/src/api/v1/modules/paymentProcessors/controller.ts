import { ERROR_CODES, INTEGRATION_ID, type IntegrationPlatformId } from "#constants";
import type { InitializeStripeProcessorArgs } from "#lib/paymentProcessor/adapters/stripeAPIAdapter";
import { logger } from "#helpers";
import {
	enrichAccountsWithProcessorStatus,
	enrichAccountWithProcessorStatus
} from "#lib/paymentProcessor/helpers/stripe";
import { MerchantProfile } from "#lib/paymentProcessor/merchantProfile";
import { MerchantProfileConverter } from "#lib/paymentProcessor/merchantProfileConverter";
import { PaymentProcessorError } from "#lib/paymentProcessor/paymentProcessorError";
import { PaymentProcessorService } from "#lib/paymentProcessor/paymentProcessorService";
import { PaymentProcessorSecretsService } from "#lib/paymentProcessor/paymentProcessorSecretsService";
import { MerchantProfileRepository } from "#lib/paymentProcessor/repositories/merchantProfileRepository";
import { PaymentProcessorAccountRepository } from "#lib/paymentProcessor/repositories/paymentProcessorAccountRepository";
import * as MerchantProfileTypes from "#lib/paymentProcessor/types/merchantProfile";
import { CreateMerchantProfileParams } from "#lib/paymentProcessor/types/merchantProfile";
import { stripeWebhookHandler } from "#lib/paymentProcessor/webhooks/stripeWebhookHandler";
import type { Response, UserInfo } from "#types/index";
import { catchAsync, isUUID } from "#utils";
import { UUID } from "crypto";
import type { Request } from "express";
import { StatusCodes } from "http-status-codes";
import type Stripe from "stripe";

const merchantProfileRepository = new MerchantProfileRepository();
const paymentProcessorAccountRepository = new PaymentProcessorAccountRepository();
export const controller = {
	getMerchantProfileBusinessId: catchAsync(async (req: Request, res: Response) => {
		const { customerId, businessId } = req.params;
		const withAccountInfo = req.query.withAccountInfo === "true";
		const platformId = req.query.platformId;
		const merchantProfile = await merchantProfileRepository.get(
			businessId as UUID,
			Number(platformId) as IntegrationPlatformId,
			withAccountInfo
		);

		if (!merchantProfile) {
			return res.jsend.success(null, "Merchant profile not found");
		}

		return res.jsend.success(merchantProfile.toApiResponse());
	}),

	getMerchantProfileManyByBusinessIds: catchAsync(async (req: Request, res: Response) => {
		const { businessIds, platformId } = req.body;

		const merchantProfiles = await merchantProfileRepository.findByBusinessId(
			businessIds as UUID[],
			Number(platformId) as IntegrationPlatformId
		);

		if (!merchantProfiles || merchantProfiles.length === 0) {
			return res.jsend.success([], "No Merchant profiles found");
		}
		return res.jsend.success(
			merchantProfiles.map(mp => mp.toApiResponse()),
			"Merchant profiles retrieved"
		);
	}),

	createMerchantProfiles: catchAsync(async (req: Request, res: Response) => {
		const customerId = req.params.customerId as UUID;
		const merchantProfileCreateRequest = req.body as MerchantProfileTypes.MerchantProfileCreateRequest;

		if (merchantProfileCreateRequest.businesses.length === 0) {
			return res.jsend.error("Request body must be a non-empty array of merchant profile contexts", 400);
		}

		const contexts: CreateMerchantProfileParams[] = merchantProfileCreateRequest.businesses.map(
			(context: Record<string, any>) => ({
				customerId: customerId,
				params: { ...(context as CreateMerchantProfileParams["params"]) }
			})
		);

		const service = await PaymentProcessorService.forProcessor(merchantProfileCreateRequest.processorId);

		// This will prepare the stripe context if the platform is Stripe, otherwise it will be undefined
		// TODO: Use a factory pattern to pass the right method for other payment processors when we add them
		// This is smart enough to handle multiple payment processors in the future
		// however this assumes all profiles in the request are for the same platform
		// if we continued this approach the method signature will grow very large and unwieldy
		const merchantProfileStripeContext = MerchantProfileConverter.prepareStripeContext(
			merchantProfileCreateRequest.platformId,
			merchantProfileCreateRequest.capabilities,
			merchantProfileCreateRequest.paymentGroupId
		);

		const merchantProfiles: MerchantProfile[] = await service.createMerchantProfiles(
			merchantProfileCreateRequest.onboardImmediately,
			contexts,
			merchantProfileStripeContext
		);

		return res.jsend.success(
			merchantProfiles.map(mp => mp.toApiResponse()),
			"Merchant profiles created"
		);
	}),

	setTermsOfService: catchAsync(async (req: Request, res: Response) => {
		const { _, businessId, processorId } = req.params;
		const tosInput = req.body as MerchantProfileTypes.TermsOfServiceInput;
		const service = await PaymentProcessorService.forProcessor(processorId as UUID);

		try {
			const updatedProfile = await service.setTermsOfService(businessId as UUID, tosInput);

			if (!updatedProfile) {
				return res.jsend.fail(
					null,
					"No merchant profile found to update Terms of Service",
					StatusCodes.PRECONDITION_FAILED
				);
			}
			return res.jsend.success(updatedProfile.toApiResponse(), "Terms of Service set successfully");
		} catch (error) {
			return res.jsend.error("An error occurred while setting Terms of Service", StatusCodes.INTERNAL_SERVER_ERROR);
		}
	}),

	createPaymentProcessorAccounts: catchAsync(async (req: Request, res: Response) => {
		// TODO: Pass the PlatformID when we have multiple payment Processors
		// Currently we only support Stripe, thus we can default to Stripe
		const { customerId, platformId, businessIds, processorId } = req.body;
		const { force } = req.query;
		const service = await PaymentProcessorService.forProcessor(processorId);
		const paymentProcessorOnboardSummary = await service.prefillPaymentProcessorAccountData(
			businessIds,
			force as unknown as boolean
		);
		if (paymentProcessorOnboardSummary.success.length === 0) {
			return res.jsend.fail(
				paymentProcessorOnboardSummary,
				"No payment processor accounts were created",
				StatusCodes.PRECONDITION_FAILED
			);
		}

		if (paymentProcessorOnboardSummary.failed.length > 0 && paymentProcessorOnboardSummary.success.length > 0) {
			return res.jsend.success(
				paymentProcessorOnboardSummary,
				"Some payment processor accounts were created, some failed",
				StatusCodes.MULTI_STATUS
			);
		}

		return res.jsend.success(paymentProcessorOnboardSummary, "Payment processor accounts created");
	}),
	getProcessorAccountStatus: catchAsync(async (req: Request, res: Response) => {
		const { customerId, processorAccountId } = req.params;
		if (!customerId || !processorAccountId) {
			throw new PaymentProcessorError(
				"Customer ID, Processor Account ID are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		// get processor account
		const processorAccount = await paymentProcessorAccountRepository.get(processorAccountId as UUID);
		if (!processorAccount?.processor_id || !processorAccount?.account_id) {
			throw new PaymentProcessorError("Processor account not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		const service = await PaymentProcessorService.forProcessor(processorAccount.processor_id as UUID);
		if (String(service.customerId) !== String(customerId)) {
			throw new PaymentProcessorError(
				"Processor does not belong to customer",
				StatusCodes.FORBIDDEN,
				ERROR_CODES.NOT_ALLOWED
			);
		}
		const statusSummary = await service.syncAccountStatus(processorAccountId as UUID);
		return res.jsend.success(statusSummary, "Payment processor account status synced");
	}),
	managePaymentProcessorEntitlements: catchAsync(async (req: Request, res: Response) => {
		const { customerId } = req.params;
		const { enabled } = req.body;
		const isEnabled = await PaymentProcessorService.setEnabled(customerId as UUID, enabled);
		return res.jsend.success(
			{ status: isEnabled ? "ACTIVE" : "INACTIVE", customer_id: customerId },
			`Payment processor entitlements set to ${enabled ? "ACTIVE" : "INACTIVE"} for customer ${customerId}`
		);
	}),
	getPaymentProcessorEntitlements: catchAsync(async (req: Request, res: Response) => {
		const { customerId } = req.params;
		const isEnabled = await PaymentProcessorService.isEnabled(customerId as UUID);
		return res.jsend.success(
			{ status: isEnabled ? "ACTIVE" : "INACTIVE", customer_id: customerId },
			"Payment processor entitlements fetched for customer " + customerId
		);
	}),
	getProcessor: catchAsync(async (req: Request, res: Response) => {
		const { customerId, processorId } = req.params;
		if (!customerId || !processorId || !isUUID(customerId) || !isUUID(processorId)) {
			throw new PaymentProcessorError(
				"Customer ID and Processor ID are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		const processor = await PaymentProcessorService.getProcessorRecord(processorId as UUID);
		return res.jsend.success(processor, "Processor fetched for customer " + customerId);
	}),
	listProcessors: catchAsync(async (req: Request, res: Response) => {
		const { customerId } = req.params;
		const includeDeleted = req.query.includeDeleted ? req.query.includeDeleted === "true" : false;
		if (!customerId || !isUUID(customerId)) {
			throw new PaymentProcessorError("Customer ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		const processors = await PaymentProcessorService.getProcessorRecordsForCustomer(customerId as UUID);
		return res.jsend.success(
			processors.filter(p => (includeDeleted ? true : p.deleted_at === null)),
			"Processors fetched for customer " + customerId
		);
	}),
	deleteProcessor: catchAsync(async (req: Request, res: Response) => {
		const { customerId, processorId } = req.params;
		const userId = res.locals.user?.user_id;
		if (!customerId || !processorId || !isUUID(customerId) || !isUUID(processorId)) {
			throw new PaymentProcessorError(
				"Customer ID and Processor ID are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		if (!userId || !isUUID(userId)) {
			throw new PaymentProcessorError("User ID is required", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
		}
		await PaymentProcessorService.deleteProcessor(processorId as UUID, userId as UUID);
		return res.jsend.success(null, "Processor deleted for customer " + customerId);
	}),
	createProcessor: catchAsync(async (req: Request, res: Response) => {
		const { customerId } = req.params;
		const userId = res.locals.user?.user_id;
		const { name } = req.body;
		if (!customerId || !name || !userId) {
			throw new PaymentProcessorError(
				"Customer ID, Name, UserID are required for all processors",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		const [platformName, platformOptions] = getAppropriateProcessor(req.body);

		const processor = await PaymentProcessorService.initializeProcessor({
			name,
			customerId: customerId as UUID,
			platformId: INTEGRATION_ID.STRIPE,
			userId: userId as UUID,
			implementationOptions: platformOptions
		});
		return res.jsend.success(processor, `${platformName} initialized for customer`);
	}),
	updateProcessor: catchAsync(async (req: Request, res: Response) => {
		const { customerId, processorId } = req.params;
		const { name } = req.body;
		const userId = res.locals.user?.user_id;
		if (!customerId || !processorId || !userId) {
			throw new PaymentProcessorError(
				"Customer ID, Processor Id, userId are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		// If an integration name is provided, update the processor with the new credentials
		if (hasProcessorBody(req.body)) {
			const [_, platformOptions] = getAppropriateProcessor(req.body);
			const processor = await PaymentProcessorService.forProcessor(processorId as UUID);
			const update = await processor.updateProcessor({ name, userId: userId as UUID }, platformOptions);
			return res.jsend.success(update, "Processor updated for customer");
		}
		// Otherwise just updating the name
		const processor = await PaymentProcessorService.forProcessor(processorId as UUID);
		const update = await processor.updateProcessor({ name, userId: userId as UUID });
		return res.jsend.success(update, "Processor updated for customer");
	}),
	deleteStripe: catchAsync(async (req: Request, res: Response) => {
		const { customerId, processorId } = req.params;
		if (!customerId || !processorId) {
			throw new PaymentProcessorError(
				"Customer ID and Processor ID are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		return res.jsend.success(null, "Stripe deleted for customer");
	}),
	handleStripeWebhook: catchAsync(async (req: Request, res: Response) => {
		const { customerId, processorId } = req.params;
		if (!customerId || !processorId) {
			throw new PaymentProcessorError(
				"Customer ID and Processor ID are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		const event = req.body as Stripe.Event;
		const { type } = event;
		const paymentProcessorService = await PaymentProcessorService.forProcessor(processorId as UUID);
		const webhook = await stripeWebhookHandler({
			event,
			type,
			paymentProcessorService
		});
		logger.info({ customerId, processorId, event }, "Stripe webhook handled");
		return res.jsend.success(webhook, "Stripe webhook handled");
	}),
	getBusinessPaymentProcessorAccounts: catchAsync(async (req: Request, res: Response) => {
		const { customerId, businessId } = req.params;
		if (!isUUID(customerId) || !isUUID(businessId)) {
			throw new PaymentProcessorError(
				"Customer ID and Business ID are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		const paymentProcessorAccounts = await paymentProcessorAccountRepository.findByBusinessId(businessId as UUID);

		return res.jsend.success(
			enrichAccountsWithProcessorStatus(paymentProcessorAccounts),
			`Payment processor accounts fetched for business ${businessId}`
		);
	}),
	getBusinessPaymentProcessorAccount: catchAsync(async (req: Request, res: Response) => {
		const { customerId, businessId, processorAccountId } = req.params;
		if (!isUUID(customerId) || !isUUID(businessId) || !isUUID(processorAccountId)) {
			throw new PaymentProcessorError(
				"Customer ID, Business ID, and Processor Account ID are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		const paymentProcessorAccount = await paymentProcessorAccountRepository.get(processorAccountId);
		if (
			!paymentProcessorAccount ||
			paymentProcessorAccount.business_id !== businessId ||
			paymentProcessorAccount.customer_id !== customerId
		) {
			throw new PaymentProcessorError(
				"Payment processor account not found",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}

		return res.jsend.success(
			enrichAccountWithProcessorStatus(paymentProcessorAccount),
			`Payment processor account fetched`
		);
	}),
	/**
	 * Generate an ephemeral session token for the given processor account
	 */
	getProcessorAccountSession: catchAsync(async (req: Request, res: Response) => {
		const { customerId, processorAccountId, businessId } = req.params;
		const { user_id: userId } = res.locals?.user as UserInfo;
		if (!isUUID(customerId) || !isUUID(processorAccountId) || !isUUID(businessId) || !isUUID(userId)) {
			throw new PaymentProcessorError(
				"Customer ID, Processor Account ID, user ID, and Business ID are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		const processorAccount = await paymentProcessorAccountRepository.get(processorAccountId);
		if (
			!processorAccount ||
			processorAccount.business_id !== businessId ||
			processorAccount.customer_id !== customerId
		) {
			throw new PaymentProcessorError(
				"Payment processor account not found for session generation",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}
		const paymentProcessorService = await PaymentProcessorService.forProcessor(processorAccount.processor_id as UUID);
		const session = await paymentProcessorService.getProcessorSession(processorAccount);
		
		// Fetch publishable_key from AWS Secrets Manager
		const secretsService = new PaymentProcessorSecretsService(customerId as UUID, processorAccount.processor_id as UUID);
		const stripeConfig = await secretsService.getStripeConfig();
		
		// Enrich with processor_status and add publishable_key
		const enrichedAccount = enrichAccountWithProcessorStatus(processorAccount);
		const response = {
			...(session as Record<string, any>),
			publishable_key: stripeConfig?.stripePublishableKey || null,
			processor_status: enrichedAccount.processor_status
		};
		
		logger.info({ customerId, userId, processorAccountId, businessId }, "Processor account session generated");
		return res.jsend.success(response, "Processor session fetched");
	})
};

function hasProcessorBody(body: Record<string, any>): boolean {
	const platformNames = Object.keys(INTEGRATION_ID).map(key => key.toLowerCase());
	return Object.keys(body).some(key => platformNames.includes(key) && Object.keys(body[key]).length > 0);
}

/**
 * Match req.body with a platform name to extract the appropriate platform options from the request body name
 * returns a tuple of the platform name & platform specific options to pass to the payment processor service's constructor
 * @param Express JSON body
 * @returns [platform name, platform options]
 */
function getAppropriateProcessor(body: Record<string, any>): [string, Record<string, any>] {
	// Find a platform name's in the request body -- this indicates the platform-specific configuration has been sent
	const platform = Object.keys(INTEGRATION_ID)
		.map(key => key.toLowerCase())
		.find(key => {
			return key in body && Object.keys(body[key])?.length > 0;
		}) as Lowercase<keyof typeof INTEGRATION_ID> | undefined;

	if (platform === "stripe") {
		const { publishable_key, secret_key } = body.stripe;
		if (!publishable_key || !secret_key) {
			throw new PaymentProcessorError(
				"Stripe Publishable Key and Stripe Secret Key are required",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		return [
			platform,
			{
				publishable_key,
				secret_key
			}
		];
	}
	throw new PaymentProcessorError("Unknown platform specified", StatusCodes.BAD_REQUEST, ERROR_CODES.INVALID);
}
