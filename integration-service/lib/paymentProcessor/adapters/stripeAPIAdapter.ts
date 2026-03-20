import { envConfig } from "#configs";
import { ERROR_CODES, INTEGRATION_ID } from "#constants";
import { logger } from "#helpers";
import { MerchantProfile } from "#lib/paymentProcessor/merchantProfile";
import * as StripeTypes from "#lib/paymentProcessor/types/stripe";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import stripe, { type Stripe } from "stripe";
import { collapseStripeAccountStatus, isStripeAccount, mapStripeStatusToAccountStatus } from "../helpers/stripe";
import { PaymentProcessorAccountStatus } from "../paymentProcessorAccount.constants";
import { PaymentProcessorError } from "../paymentProcessorError";
import type { PaymentProcessor } from "../repositories/paymentProcessorRepository";
import { stripeAccountSessionComponents, stripeWebhookEventTypes } from "../stripe.constants";
import { BaseAPIAdapter, type AccountStatusSyncResult, type IBaseAPIAdapterConfig } from "./baseAdapter";
import type { PaymentProcessorAccount } from "../repositories/paymentProcessorAccountRepository";

export type StripeAPIAdapterConfig = IBaseAPIAdapterConfig & {
	stripePublishableKey: string | null;
	stripeSecretKey: string | null;
	stripeWebhookSecret: string | null;
};

export type InitializeStripeProcessorArgs = {
	publishable_key: string;
	secret_key: string;
};

export type StripeMetadata = Partial<Stripe.WebhookEndpoint>;
export class StripeAPIAdapter extends BaseAPIAdapter {
	public readonly client: stripe;
	public readonly usedCustomerCredentials: boolean;
	public readonly testMode: boolean;

	constructor(customerId: UUID, config: StripeAPIAdapterConfig) {
		super(customerId, config);
		this.platformId = INTEGRATION_ID.STRIPE;
		// TODO : use config when provided to instantiate stripe client,
		// Will need to remove envConfig usage later because it uses our own keys.
		if (config?.stripeSecretKey) {
			this.usedCustomerCredentials = true;
			this.client = new stripe(config.stripeSecretKey);
			this.testMode = config.stripeSecretKey.startsWith("sk_test_");
		} else {
			this.usedCustomerCredentials = false;
			this.client = new stripe(envConfig.STRIPE_SECRET_KEY as string);
			this.testMode = (envConfig.STRIPE_SECRET_KEY as string).startsWith("sk_test_");
		}
	}

	public static override buildConfiguration(processorId: UUID, implementationOptions: unknown): StripeAPIAdapterConfig {
		if (!StripeAPIAdapter.isInitializeStripeArgs(implementationOptions)) {
			throw new PaymentProcessorError(
				"Invalid Stripe initialization arguments",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		const { publishable_key, secret_key } = implementationOptions;
		return {
			processorId,
			platformId: INTEGRATION_ID.STRIPE,
			stripePublishableKey: publishable_key,
			stripeSecretKey: secret_key,
			stripeWebhookSecret: null
		};
	}

	public static override async initializeProcessor<
		TConfig extends IBaseAPIAdapterConfig = StripeAPIAdapterConfig,
		R = Stripe.WebhookEndpoint
	>(processor: PaymentProcessor, config: TConfig): Promise<R> {
		if (!StripeAPIAdapter.isStripeConfig(config)) {
			throw new PaymentProcessorError(
				"Stripe configuration missing required credentials",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.INVALID
			);
		}
		const webhook = await StripeAPIAdapter.createProcessor(processor, config);
		return webhook as R;
	}

	public static override async checkCredentials(credentials: {
		secret_key: string;
	}): Promise<[boolean, Stripe.Account?]> {
		const { secret_key } = credentials;
		const stripeClient = new stripe(secret_key);
		try {
			const account: Stripe.Account = await stripeClient.accounts.retrieve();
			return [true, account];
		} catch (error) {
			logger.error({ error }, `Error checking Stripe credentials`);
			return [false, undefined];
		}
	}

	/**
	 * Create a new Stripe record
	 */
	public static override async createProcessor<T = StripeAPIAdapterConfig, R = Stripe.WebhookEndpoint>(
		processor: PaymentProcessor,
		platformSpecificArguments: T
	): Promise<R> {
		if (!StripeAPIAdapter.isStripeConfig(platformSpecificArguments)) {
			throw new PaymentProcessorError(
				"Stripe configuration missing required credentials",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.INVALID
			);
		}
		const config = platformSpecificArguments as StripeAPIAdapterConfig;
		const { customer_id: customerId, name, id: processorId } = processor;
		// Use String() coercion to ensure types are comparable
		if (!customerId || String(processorId) !== String(config.processorId)) {
			throw new PaymentProcessorError(
				"Processor record missing identifiers",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.INVALID
			);
		}

		const stripeAdapter = new StripeAPIAdapter(customerId, config);
		try {
			const currentWebhook = await stripeAdapter.getWebhook();
			await stripeAdapter.deleteWebhook(currentWebhook.id);
		} catch (error: unknown) {
			if (error instanceof PaymentProcessorError && error.errorCode === ERROR_CODES.NOT_FOUND) {
				// Webhook not found, continue
			} else {
				throw error;
			}
		}

		const webhook = await stripeAdapter.createWebhook(name);
		if (!webhook) {
			throw new PaymentProcessorError(
				"Failed to create Stripe webhook",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.INVALID
			);
		}

		return webhook as R;
	}

	/**
	 * Clean up Stripe resources associated with the processor.
	 * Currently removes the Worth-managed webhook if it exists.
	 * Secrets cleanup is handled by PaymentProcessorService.
	 */
	async deleteProcessor(processor: PaymentProcessor): Promise<void> {
		try {
			const currentWebhook = await this.getWebhook();
			await this.deleteWebhook(currentWebhook.id);
		} catch (error: unknown) {
			if (error instanceof PaymentProcessorError && error.errorCode === ERROR_CODES.NOT_FOUND) {
				// Webhook not found, continue
				// This is expected if the webhook is not yet created
			} else {
				throw error;
			}
		}
	}

	async createAccount(merchantProfiles: MerchantProfile[]): Promise<[StripeTypes.AccountInfo[], string[]]> {
		const createAccountContexts: StripeTypes.CreateAccountContext[] = merchantProfiles.map(profile => {
			return profile.toStripeCreateAccountFormat(this.testMode);
		});

		const accountResults: Array<StripeTypes.AccountInfo | string> = await Promise.all(
			createAccountContexts.map(async context => {
				try {
					const customer = await this.client.accounts.create(context.payload);
					return {
						profileId: context.profileId,
						accountId: customer.id,
						customerId: this.customerId,
						businessId: context.businessId,
						platformId: INTEGRATION_ID.STRIPE,
						data: customer
					};
				} catch (error) {
					logger.warn(`Error creating customer in Stripe for business ID ${context.businessId}: ${error}`);
					return context.businessId;
				}
			})
		);

		const successfulCustomers = accountResults.filter(
			result => typeof result !== "string"
		) as StripeTypes.AccountInfo[];
		const failedBusinessIds = accountResults.filter(result => typeof result === "string") as string[];

		return [successfulCustomers, failedBusinessIds];
	}

	async attachPersonsToAccount(merchantProfile: MerchantProfile, accountId: string): Promise<StripeTypes.AccountInfo> {
		if (merchantProfile.profileId === undefined) {
			throw new Error("MerchantProfile needs to be saved before attaching persons.");
		}

		const createPersonContexts: StripeTypes.CreatePersonContext[] = merchantProfile.toStripePersonsContext();

		for (const personContext of createPersonContexts) {
			try {
				await this.client.accounts.createPerson(accountId, personContext);
				await this.client.accounts.update(accountId, { company: { owners_provided: true } });
			} catch (error) {
				logger.error(
					`Error attaching person to merchant account ${accountId} for business ID ${merchantProfile.businessId}: ${error}`
				);
			}
		}

		return {
			profileId: merchantProfile.profileId,
			accountId: accountId,
			customerId: this.customerId,
			businessId: merchantProfile.businessId,
			platformId: INTEGRATION_ID.STRIPE,
			data: await this.client.accounts.retrieve(accountId)
		};
	}

	async attachExternalAccountToAccount(
		merchantProfile: MerchantProfile,
		accountId: string
	): Promise<StripeTypes.AccountInfo | null> {
		// By default, we should create the external account on the during its creation, but in some cases we will want to associate a new
		// external account after the fact (e.g., updating bank account info). In other cases maybe we didn't have the banking info at creation time.
		// In those cases, we can call this method to attach the external account after the fact. Most often it will be set during creation.
		// and there will be no need to call this method.
		if (merchantProfile.profileId === undefined) {
			throw new Error("MerchantProfile needs to be saved before attaching external accounts.");
		}

		const createExternalAccountContext = merchantProfile.toStripeExternalAccountFormat({ testMode: this.testMode });

		if (!createExternalAccountContext) {
			return null;
		}

		try {
			await this.client.accounts.createExternalAccount(accountId, { external_account: createExternalAccountContext });

			return {
				profileId: merchantProfile.profileId!,
				accountId: accountId,
				customerId: this.customerId,
				businessId: merchantProfile.businessId,
				platformId: INTEGRATION_ID.STRIPE,
				data: await this.client.accounts.retrieve(accountId)
			};
		} catch (error) {
			logger.error(
				`Error attaching external account to merchant account ${accountId} for business ID ${merchantProfile.businessId}: ${error}`
			);
			// TODO: decide what to do if this fails and how to report it back to caller in bulk operations.
			return null;
		}
	}

	async retrieveAccount(accountId: string): Promise<Stripe.Response<Stripe.Account>> {
		try {
			return await this.client.accounts.retrieve(accountId);
		} catch (error) {
			logger.error({ error }, `Error retrieving Stripe account ${accountId} for customer ${this.customerId}`);
			throw new PaymentProcessorError("Error retrieving Stripe account", StatusCodes.BAD_GATEWAY, ERROR_CODES.INVALID);
		}
	}

	public override async syncAccountStatus<T extends Record<string, any> = Record<string, any>>(
		accountId: string,
		_context?: T
	): Promise<AccountStatusSyncResult<StripeTypes.StripeProcessorStatusSummary, Stripe.Response<Stripe.Account>>> {
		const account = await this.retrieveAccount(accountId);
		const summary = collapseStripeAccountStatus(account);
		logger.debug({ summary }, "Stripe account status summary");
		const mappedStatus = this.deriveAccountStatus(account) ?? PaymentProcessorAccountStatus.UNKNOWN;

		return {
			summary,
			account,
			mappedStatus
		};
	}

	public override deriveAccountStatus(account: Stripe.Response<Stripe.Account>): PaymentProcessorAccountStatus {
		const summary = collapseStripeAccountStatus(account);
		return mapStripeStatusToAccountStatus(summary.status, summary.reasons).status;
	}

	async updateMerchant(
		accountId: string,
		merchantProfileUpdate: stripe.AccountUpdateParams
	): Promise<stripe.Response<stripe.Account> | null> {
		try {
			const existingMerchant = await this.client.accounts.update(accountId, merchantProfileUpdate);

			return existingMerchant;
		} catch (error) {
			logger.error({ error }, `Error updating merchant profile for business ID ${this.customerId}`);
		}
		return null;
	}

	async getWebhookUrl(): Promise<string> {
		if (!envConfig.STRIPE_WEBHOOK_URL) {
			throw new PaymentProcessorError(
				"Stripe has not been configured with a webhook URL",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.INVALID
			);
		}
		// handle trailing "/"
		const base = envConfig.STRIPE_WEBHOOK_URL?.endsWith("/")
			? envConfig.STRIPE_WEBHOOK_URL
			: `${envConfig.STRIPE_WEBHOOK_URL}/`;
		return `${base}${this.customerId}/${this.processorId}`;
	}

	async getWebhook(): Promise<stripe.WebhookEndpoint> {
		// This may be paginated, so we need to handle that -- need to find the ID for the Worth Webhook: url == envConfig.STRIPE_WEBHOOK_URL
		let starting_after: string | undefined = undefined;
		const webhookUrl = await this.getWebhookUrl();
		while (true) {
			const webhooks: stripe.ApiList<stripe.WebhookEndpoint> = await this.client.webhookEndpoints.list({
				limit: 100,
				starting_after: starting_after
			});
			if (!webhooks.data || !Array.isArray(webhooks.data) || webhooks.data.length === 0) {
				throw new PaymentProcessorError("No webhooks found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
			}
			const worthWebhook = webhooks.data.find(webhook => webhook.url === webhookUrl && webhook.status === "enabled");
			if (worthWebhook) {
				return worthWebhook;
			}
			if (!webhooks.has_more) {
				break;
			}
			starting_after = webhooks.data[webhooks.data.length - 1]?.id ?? undefined;
			if (!starting_after) {
				// end the loop - nothing to iterate through
				break;
			}
		}
		throw new PaymentProcessorError("No Worth webhook found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
	}

	async deleteWebhook(webhookId: string): Promise<void> {
		try {
			await this.client.webhookEndpoints.del(webhookId);
		} catch (error) {
			logger.error({ error }, `Error deleting webhook ${webhookId} for account ${this.customerId}`);
			throw new PaymentProcessorError("Error deleting webhook", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async createWebhook(processorName: string): Promise<stripe.Response<stripe.WebhookEndpoint>> {
		try {
			const webhookUrl = await this.getWebhookUrl();
			const webhook = await this.client.webhookEndpoints.create({
				url: webhookUrl,
				description: "Worth Account Update Webhooks. Required for Worth to work.",
				metadata: {
					"worth:customerId": this.customerId,
					"worth:processorId": this.processorId,
					"worth:processorName": processorName
				},
				connect: true,
				enabled_events: stripeWebhookEventTypes
			});
			return webhook;
		} catch (error) {
			logger.error({ error }, `Error creating webhook for account ${this.customerId}`);
			throw new PaymentProcessorError("Error creating webhook", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	public override getProcessorSession(
		processorAccount: PaymentProcessorAccount<Stripe.Account>
	): Promise<Stripe.AccountSession> {
		if (!isStripeAccount(processorAccount.account)) {
			throw new PaymentProcessorError(
				"Processor account is not a Stripe account",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		return this.client.accountSessions.create({
			account: processorAccount.account_id,
			components: stripeAccountSessionComponents
		});
	}

	private static isStripeConfig(args: unknown): args is StripeAPIAdapterConfig {
		if (!args || typeof args !== "object") {
			return false;
		}
		const candidate = args as Partial<StripeAPIAdapterConfig>;
		return (
			typeof candidate.processorId === "string" &&
			typeof candidate.platformId === "number" &&
			typeof candidate.stripeSecretKey === "string"
		);
	}

	public static isInitializeStripeArgs(args: unknown): args is InitializeStripeProcessorArgs {
		if (!args || typeof args !== "object") {
			return false;
		}
		const candidate = args as Partial<InitializeStripeProcessorArgs>;
		return typeof candidate.publishable_key === "string" && typeof candidate.secret_key === "string";
	}
}
