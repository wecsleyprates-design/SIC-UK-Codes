/**
 * @fileoverview
 * This file contains the PaymentProcessorService class which is responsible for creating, deleting, and managing payment processors.
 */
import { customerIntegrationSettings } from "#api/v1/modules/customer-integration-settings/customer-integration-settings";
import { ERROR_CODES, INTEGRATION_ID, type IntegrationPlatformId } from "#constants";
import { logger } from "#helpers";
import { CreateMerchantProfileParams } from "#lib/paymentProcessor/types/merchantProfile";
import * as PaymentProcessorAccountTypes from "@joinworth/types/dist/types/integration/paymentProcessors/paymentProcessorAccount";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { BaseAPIAdapter, type AccountStatusSyncResult, type IBaseAPIAdapterConfig } from "./adapters/baseAdapter";
import { StripeAPIAdapter, type StripeAPIAdapterConfig } from "./adapters/stripeAPIAdapter";
import { paymentProcessorHandlerMap } from "./handlers";
import { MerchantProfile } from "./merchantProfile";
import { PaymentProcessorAccountStatus } from "./paymentProcessorAccount.constants";
import { PaymentProcessorError } from "./paymentProcessorError";
import { PaymentProcessorOnboardTracker, PaymentProcessorTrackerSummary } from "./paymentProcessorOnboardTracker";
import { PaymentProcessorSecretsService } from "./paymentProcessorSecretsService";
import { MerchantProfileRepository } from "./repositories/merchantProfileRepository";
import { PaymentProcessorAccountRepository } from "./repositories/paymentProcessorAccountRepository";
import { PaymentProcessorRepository, type PaymentProcessor } from "./repositories/paymentProcessorRepository";
import type * as MerchantProfileTypes from "./types/merchantProfile";
import { PaymentProcessorStatus } from "./types/processor";

export const AvailableProcessors = {
	[INTEGRATION_ID.STRIPE]: StripeAPIAdapter
} satisfies Partial<Record<IntegrationPlatformId, typeof BaseAPIAdapter>>;

type AdapterStatusSummary<TAdapter extends BaseAPIAdapter> =
	Awaited<ReturnType<TAdapter["syncAccountStatus"]>> extends AccountStatusSyncResult<infer TSummary, any>
		? TSummary
		: unknown;

export class PaymentProcessorService<T extends BaseAPIAdapter = BaseAPIAdapter> {
	private readonly client: T;
	private readonly merchantProfileRepository: MerchantProfileRepository;
	private readonly accountRepository: PaymentProcessorAccountRepository;
	private readonly paymentProcessorRepository: PaymentProcessorRepository;
	private readonly paymentProcessorSecrets: PaymentProcessorSecretsService;
	private readonly processor: PaymentProcessor;
	private readonly handler?: (typeof paymentProcessorHandlerMap)[number];
	private readonly tracker: PaymentProcessorOnboardTracker;

	private constructor(
		client: T, // can be extended to other processors in future
		processor: PaymentProcessor
	) {
		this.client = client;
		this.processor = processor;

		this.merchantProfileRepository = new MerchantProfileRepository();
		this.accountRepository = new PaymentProcessorAccountRepository();
		this.paymentProcessorRepository = new PaymentProcessorRepository();
		this.paymentProcessorSecrets = new PaymentProcessorSecretsService(
			this.processor.customer_id,
			this.processor.id as UUID
		);
		this.handler = paymentProcessorHandlerMap[this.processor.platform_id];
		this.tracker = new PaymentProcessorOnboardTracker();
	}

	public get customerId(): UUID {
		return this.processor.customer_id as UUID;
	}
	public get processorId(): UUID {
		return this.processor.id as UUID;
	}

	static async isEnabled(customerId: UUID): Promise<boolean> {
		const customerSettings = await customerIntegrationSettings.findById(customerId);
		return customerSettings?.settings?.payment_processors?.status === "ACTIVE";
	}

	/***
		Updates the payment processor entitlement status in the customer integration settings
		@param customerId - The customer ID
		@param enabled - The enabled status (true/false)
		@returns The enabled status (true/false)
	*/
	static async setEnabled(customerId: UUID, enabled: boolean = true): Promise<boolean> {
		await customerIntegrationSettings.updateSingleIntegrationSetting(customerId, "payment_processors", {
			status: enabled ? "ACTIVE" : "INACTIVE"
		});
		return enabled;
	}

	/**
	 * Handle the initialization of a new payment processor for a customer
	 *
	 * Creates a new payment processor record in the database
	 * then Delegates the actual implementation to the appropriate api adapter
	 * @param
	 * @returns
	 */
	static async initializeProcessor({
		name,
		customerId,
		platformId,
		userId,
		implementationOptions
	}: {
		name: string;
		customerId: UUID;
		platformId: IntegrationPlatformId;
		userId: UUID;
		implementationOptions: any;
	}) {
		const apiAdapter = AvailableProcessors[platformId];
		if (!apiAdapter) {
			throw new PaymentProcessorError(
				`Unsupported payment processor platform: ${platformId}`,
				StatusCodes.NOT_IMPLEMENTED,
				ERROR_CODES.INVALID
			);
		}
		if (!(await PaymentProcessorService.isEnabled(customerId))) {
			throw new PaymentProcessorError(
				"Payment Processor Entitlements are not enabled",
				StatusCodes.FORBIDDEN,
				ERROR_CODES.UNAUTHORIZED
			);
		}
		const paymentProcesorRepository = new PaymentProcessorRepository();
		const existingRecords = await paymentProcesorRepository.findByFields(
			{
				customer_id: customerId,
				name
			},
			true
		);
		if (existingRecords?.[0]?.id) {
			throw new PaymentProcessorError(
				`Payment processor already exists with name ${name}: ${existingRecords?.[0]?.id}`,
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		const [validatedCredentials, account] = await apiAdapter.checkCredentials(implementationOptions);
		if (!validatedCredentials) {
			logger.error(`Invalid credentials provided for ${platformId} customer: ${customerId}`);
			throw new PaymentProcessorError(
				"The credentials provided are invalid",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}

		// Create the payment processor record
		const processorRecord = await paymentProcesorRepository.create({
			customer_id: customerId,
			name,
			platform_id: platformId,
			status: PaymentProcessorStatus.ACTIVE,
			created_by: userId,
			updated_by: userId
		});
		if (!processorRecord?.id) {
			throw new PaymentProcessorError(
				"Unable to create payment processor record",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.INVALID
			);
		}
		const service = new PaymentProcessorService(apiAdapter, processorRecord);
		const config = apiAdapter.buildConfiguration(processorRecord.id, implementationOptions);
		await service.persistProcessorConfig(config);
		const createdRecord = await apiAdapter.initializeProcessor(processorRecord, config);
		await service.postProcessorInitialization(createdRecord);
		if (createdRecord) {
			return paymentProcesorRepository.update({
				id: processorRecord.id as UUID,
				updated_by: userId,
				updated_at: new Date(),
				status: PaymentProcessorStatus.ACTIVE,
				metadata: {
					account,
					...processorRecord.metadata,
					...createdRecord
				}
			});
		}
		throw new PaymentProcessorError(
			"Unable to initialize payment processor",
			StatusCodes.INTERNAL_SERVER_ERROR,
			ERROR_CODES.INVALID
		);
	}

	static async deleteProcessor(processorId: UUID, userID: UUID): Promise<void> {
		const paymentProcesorRepository = new PaymentProcessorRepository();

		const processorRecord = await paymentProcesorRepository.get(processorId as UUID);
		if (!processorRecord?.deleted_at !== null) {
			throw new PaymentProcessorError("Processor not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		if (!processorRecord?.customer_id || !processorRecord.id) {
			throw new PaymentProcessorError("Processor missing identifiers", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}

		await PaymentProcessorService.forProcessor(processorRecord.id).then(async service => {
			await service.delete();
		});
	}

	private async delete(): Promise<void> {
		// Allow instances of the class to delete themselves
		await this.client.deleteProcessor(this.processor);
		await this.clearProcessorSecrets();
		await this.paymentProcessorRepository.delete(this.processor.id as UUID, this.processor.updated_by as UUID);
	}

	/**
	 * Create a new PaymentProcessorService instance
	 * @param processorId
	 * @returns
	 */
	static async forProcessor(processorId: UUID): Promise<PaymentProcessorService> {
		const paymentProcessorRepository = new PaymentProcessorRepository();
		const paymentProcessorRecord = (await paymentProcessorRepository.get(processorId)) as PaymentProcessor;
		if (!paymentProcessorRecord) {
			throw new PaymentProcessorError("Payment processor not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
		}
		const customerId = paymentProcessorRecord.customer_id;
		const platformId = paymentProcessorRecord.platform_id;

		const isEnabled = await PaymentProcessorService.isEnabled(customerId as UUID);
		if (!isEnabled) {
			throw new PaymentProcessorError(
				"Payment Processor Entitlements are not enabled",
				StatusCodes.FORBIDDEN,
				ERROR_CODES.NOT_ALLOWED
			);
		}

		const client = await PaymentProcessorService.selectProcessorClient(platformId, processorId, customerId);
		return new PaymentProcessorService(client, paymentProcessorRecord);
	}

	async createMerchantProfiles(
		onboardImmediately: boolean,
		args: CreateMerchantProfileParams[],
		stripeContext: MerchantProfileTypes.MerchantProfileStripeContext | undefined = undefined
	): Promise<MerchantProfile[]> {
		// This method is smart enough to update existing profiles based on unique constraints.
		// Since we only have 1 profile per businessId per platformId, it will update existing ones.
		// Its safe to be called with businessIds that already have profiles.

		// Create MerchantProfile Instances
		const merchantProfiles: MerchantProfile[] = await MerchantProfile.createMany(args, stripeContext);

		// Save MerchantProfiles to DB
		const savedMerchantProfiles = await this.merchantProfileRepository.save(merchantProfiles);

		// Validate that if we are onboarding immediately with Stripe, we are running for the correct platform
		// and we have the necessary Stripe context to proceed
		if (this.isStripeReadyToOnboardImmediately(onboardImmediately, stripeContext)) {
			// Prefill Payment Processor Account Data
			logger.info(
				`Prefilling Payment Processor Account onto Stripe: ${this.processor.customer_id} - Total Profiles: ${savedMerchantProfiles.length}`
			);
			const businessIdsToOnboard = savedMerchantProfiles.map(mp => mp.businessId);
			// TODO: Typically we would return some data here to help the caller continue the onboarding flow IE: account IDs
			// We may want to change the return type to include that data in future.
			// The API response currently only returns the MerchantProfile data.
			await this.prefillPaymentProcessorAccountData(businessIdsToOnboard);
		}

		return savedMerchantProfiles;
	}

	async setTermsOfService(
		businessId: UUID,
		tos: MerchantProfileTypes.TermsOfServiceInput
	): Promise<MerchantProfile | null> {
		const merchantProfile = await this.merchantProfileRepository.get(businessId, this.processor.platform_id);

		if (!merchantProfile) {
			return null;
		}
		merchantProfile.setTermsOfService(tos);

		const updatedProfile = await this.merchantProfileRepository.save([merchantProfile]);

		// We will only ever have one profile here
		return updatedProfile.pop() || null;
	}

	// TODO: updateAccount methods for updating existing accounts.
	async prefillPaymentProcessorAccountData(
		businessIds: UUID[],
		force: boolean = false
	): Promise<PaymentProcessorTrackerSummary> {
		// WARNING: Currently this assumes that you are attempting to create new accounts.
		// If a businessId already has an account, this will still attempt to create a new one.
		// Resulting in multiple accounts for the same businessId.

		// Since we are passing an array of business Ids, we will get back an array of MerchantProfiles
		const merchantProfiles = await this.merchantProfileRepository.findByBusinessId(
			businessIds,
			this.processor.platform_id as IntegrationPlatformId
		);

		if (merchantProfiles === null || merchantProfiles.length === 0) {
			logger.warn(`No Merchant Profiles found for Business IDs: ${businessIds.join(", ")}`);
			return this.tracker.extendNoMerchantProfileFound(businessIds).toSummary();
		}

		// This method checks a group of merchant profiles and separates them into those ready to onboard and those not ready
		// based on the case status of each profile.
		const merchantProfileOnboardContext = await MerchantProfile.gatherMerchantProfileOnboardContext(
			merchantProfiles,
			force
		);
		this.tracker.extendNotReadyForOnboard(merchantProfileOnboardContext.profilesNotReadyToOnboard);

		const [createdAccounts, failedBusinessIds] = await this.client.createAccount(
			merchantProfileOnboardContext.profilesReadyToOnboard
		);

		// TODO: Trigger some type of audit/logging for failed accounts using failedBusinessIds
		if (failedBusinessIds.length > 0) {
			logger.warn(`Failed Business IDs, ${failedBusinessIds.join(",")}`);
			this.tracker.extendOnboardOutcomes(failedBusinessIds as UUID[], []);
		}

		// Attach persons to created accounts
		const processedAccounts = await Promise.all(
			createdAccounts.map(async accountInfo => {
				const merchantProfile = merchantProfiles.find(profile => profile.businessId === accountInfo.businessId);
				// We will Always find the profile here as we just created them above
				if (merchantProfile) {
					return await this.client.attachPersonsToAccount(merchantProfile, accountInfo.accountId);
				}
				// If some how we don't find the profile, we just return the accountInfo as is.
				return accountInfo;
			})
		);

		const accountsWithStatus = processedAccounts.map(account => {
			const derivedStatus =
				account.status ??
				this.client.deriveAccountStatus((account.data as Record<string, any>) ?? {}) ??
				PaymentProcessorAccountStatus.UNKNOWN;
			return {
				...account,
				status: derivedStatus
			};
		});
		const savedAccountInfo = await this.accountRepository.saveAccountInfo(this.processor.id, accountsWithStatus);

		if (savedAccountInfo.length === 0) {
			// TODO: Trigger some type of alerting here as this is a critical failure
			logger.error(
				{ customerId: this.customerId, processorId: this.processor.id },
				"No Payment Processor Account Info was saved after account creation"
			);
		}

		// Return Summary of onboard tracking
		// TODO: Add Error Messages from Stripe when request fails to the tracker
		// for better visibility on why onboardings are failing.
		this.tracker.extendOnboardOutcomes([], savedAccountInfo);
		return this.tracker.toSummary();
	}

	async syncAccountStatus(
		processorAccountId: UUID,
		type: "manual" | "webhook" = "manual"
	): Promise<AdapterStatusSummary<T>> {
		const existingAccount = await this.accountRepository.get(processorAccountId);
		if (!existingAccount) {
			throw new PaymentProcessorError(
				"Payment processor account not found",
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}
		const {
			summary,
			account: updatedAccount,
			mappedStatus
		} = await this.client.syncAccountStatus(existingAccount.account_id, {
			type
		});
		const updatedAccountRecord = await this.accountRepository.updateAccountSnapshot(
			processorAccountId,
			{ account: updatedAccount as Record<string, any>, status: mappedStatus },
			type
		);
		if (updatedAccountRecord) {
			if (this.handler?.onAccountUpdated) {
				await this.handler.onAccountUpdated({
					processor: this.processor,
					originalAccount: existingAccount,
					updatedAccount: updatedAccountRecord
				});
			}
		}
		return summary as AdapterStatusSummary<T>;
	}

	public async getProcessorSession<T>(
		processorAccount: PaymentProcessorAccountTypes.PaymentProcessorAccount
	): Promise<T> {
		return this.client.getProcessorSession(processorAccount) as T;
	}

	public async updateProcessor(
		{ name, userId }: { name?: string; userId: UUID },
		platformOptions?: any
	): Promise<PaymentProcessor> {
		if (name !== undefined && name !== this.processor.name) {
			const existingRecords = await this.paymentProcessorRepository.findByFields(
				{
					customer_id: this.processor.customer_id,
					name
				},
				true
			);
			if (existingRecords?.[0]?.id) {
				throw new PaymentProcessorError(
					`Payment processor already exists with name ${name}: ${existingRecords[0].id}`,
					StatusCodes.BAD_REQUEST,
					ERROR_CODES.INVALID
				);
			}
		}
		if (platformOptions) {
			if (this.handler?.validateAndPersistCredentials) {
				await this.handler.validateAndPersistCredentials({
					processor: this.processor,
					platformOptions,
					client: this.client,
					secrets: this.paymentProcessorSecrets
				});
			} else {
				const [validatedCredentials] = await this.client.checkCredentials(platformOptions);
				if (!validatedCredentials) {
					throw new PaymentProcessorError(
						"The credentials provided are invalid",
						StatusCodes.BAD_REQUEST,
						ERROR_CODES.INVALID
					);
				}
			}
		}
		const updatedProcessor = await this.paymentProcessorRepository.update({
			id: this.processor.id as UUID,
			updated_by: userId,
			updated_at: new Date(),
			...(name ? { name: name } : {})
		});
		return updatedProcessor;
	}
	private isStripeReadyToOnboardImmediately(
		onboardImmediately: boolean,
		stripeContext: Partial<MerchantProfileTypes.MerchantProfileStripeContext> | undefined
	): boolean {
		if (onboardImmediately && this.processor.platform_id === INTEGRATION_ID.STRIPE) {
			if (!stripeContext || Object.keys(stripeContext).length === 0) {
				return false;
			}
			return true;
		}
		return false;
	}

	private static async selectProcessorClient(
		platformId: IntegrationPlatformId,
		processorId: UUID,
		customerId: UUID
	): Promise<BaseAPIAdapter> {
		const clientCtor = AvailableProcessors[platformId];
		if (!clientCtor) {
			throw new PaymentProcessorError(
				`Payment processor client not registered for processor ${processorId}`,
				StatusCodes.NOT_FOUND,
				ERROR_CODES.NOT_FOUND
			);
		}
		const config = await PaymentProcessorService.buildAdapterConfig(platformId, processorId, customerId);
		return new clientCtor(customerId, config);
	}

	private static async buildAdapterConfig(
		platformId: IntegrationPlatformId,
		processorId: UUID,
		customerId: UUID
	): Promise<IBaseAPIAdapterConfig> {
		// TODO: Since this is a static method we should move this logic the payment ProcessorSecretsService
		// and have it return the config based on platform. This will help encapsulate the logic and avoid having platform specific
		// secrets logic within the higherlevel service.

		const secretsService = new PaymentProcessorSecretsService(customerId, processorId);

		switch (platformId) {
			case INTEGRATION_ID.STRIPE:
				const config = await secretsService.getStripeConfig();
				if (!config) {
					throw new PaymentProcessorError("Stripe config not found", StatusCodes.NOT_FOUND, ERROR_CODES.NOT_FOUND);
				}
				return config;
			default:
				throw new PaymentProcessorError(
					`Adapter config resolution not implemented for platform ${platformId}`,
					StatusCodes.NOT_IMPLEMENTED,
					ERROR_CODES.INVALID
				);
		}
	}

	private async clearProcessorSecrets(): Promise<void> {
		// TODO: Move this inside the paymentProcessorSecretsService so that the implementation is encapsulated
		// and not spread out across multiple services the switch can be contained there.
		switch (this.processor.platform_id) {
			case INTEGRATION_ID.STRIPE:
				await this.paymentProcessorSecrets.updateStripeAPIKeys({
					stripeWebhookSecret: null,
					stripePublishableKey: null,
					stripeSecretKey: null
				});
				break;
			default:
				break;
		}
	}

	private async persistProcessorConfig(config: IBaseAPIAdapterConfig): Promise<void> {
		// TODO: Move this inside the paymentProcessorSecretsService so that the implementation is encapsulated
		// and not spread out across multiple services the switch can be contained there.
		switch (this.processor.platform_id) {
			case INTEGRATION_ID.STRIPE: {
				const stored = await this.paymentProcessorSecrets.setStripeAPIKeys(config as StripeAPIAdapterConfig);
				if (!stored) {
					throw new PaymentProcessorError(
						"Failed to set Stripe API keys",
						StatusCodes.INTERNAL_SERVER_ERROR,
						ERROR_CODES.INVALID
					);
				}
				break;
			}
			default:
				throw new PaymentProcessorError(
					`Adapter config persistence not implemented for platform ${this.processor.platform_id}`,
					StatusCodes.NOT_IMPLEMENTED,
					ERROR_CODES.INVALID
				);
		}
	}

	private async postProcessorInitialization(initializationResult: unknown): Promise<void> {
		// TODO: Move this inside the paymentProcessorSecretsService so that the implementation is encapsulated
		// and not spread out across multiple services the switch can be contained there along with the result parsing.
		switch (this.processor.platform_id) {
			case INTEGRATION_ID.STRIPE: {
				const webhookSecret =
					initializationResult && typeof initializationResult === "object"
						? ((initializationResult as { secret?: string | null }).secret ?? null)
						: null;
				await this.paymentProcessorSecrets.updateStripeAPIKeys({ stripeWebhookSecret: webhookSecret });
				break;
			}
			default:
				break;
		}
	}

	// Grouping Data Fetching Methods
	static async getProcessorRecord(processorId: UUID): Promise<PaymentProcessor> {
		const paymentProcessorRepository = new PaymentProcessorRepository();
		return await paymentProcessorRepository.get(processorId);
	}

	static async getProcessorRecordsForCustomer(customerId: UUID): Promise<PaymentProcessor[]> {
		const paymentProcessorRepository = new PaymentProcessorRepository();
		return await paymentProcessorRepository.findByCustomerId(customerId);
	}

	async getMerchantProfile(businessId: UUID, withAccountInfo: boolean = false): Promise<MerchantProfile | null> {
		return this.merchantProfileRepository.get(
			businessId,
			this.processor.platform_id as IntegrationPlatformId,
			withAccountInfo
		);
	}
}
