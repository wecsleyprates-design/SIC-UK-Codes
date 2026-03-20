import { ERROR_CODES, INTEGRATION_ID, kafkaEvents, kafkaTopics, type IntegrationPlatformId } from "#constants";
import { StatusCodes } from "http-status-codes";
import { PaymentProcessorError } from "../paymentProcessorError";
import {
	collapseStripeAccountStatus,
	isStripeAccount,
	isStripeBankAccount,
	mapStripeStatusToAccountStatus
} from "../helpers/stripe";
import type { StripeAPIAdapter } from "../adapters/stripeAPIAdapter";
import type { PaymentProcessorHandler } from "./types";
import type { PaymentProcessor } from "../repositories/paymentProcessorRepository";
import type { PaymentProcessorAccount } from "../repositories/paymentProcessorAccountRepository";
import type { PaymentProcessorSecretsService } from "../paymentProcessorSecretsService";
import type Stripe from "stripe";
import * as PaymentProcessorAccountTypes from "@joinworth/types/dist/types/integration/paymentProcessors/paymentProcessorAccount";
import { getOnboardingCaseByBusinessId, internalGetCaseByID, logger, producer } from "#helpers";
import type { UUID } from "crypto";
import { BankAccount } from "#api/v1/modules/banking/models";
import type IBanking from "#api/v1/modules/banking/types";

type StripeValidateAndPersistArgs = {
	processor: PaymentProcessor;
	platformOptions: { publishable_key: string; secret_key: string };
	client: StripeAPIAdapter;
	secrets: PaymentProcessorSecretsService;
};
type NormalizedStripeAccount = PaymentProcessorAccountTypes.PaymentProcessorAccountCalculated & {
	stripe_account: Stripe.Account;
};

type CalculatedAccountChanges<T extends Record<string, any> = Record<string, any>> = {
	current: T;
	previous: T | null;
	changes: Partial<Record<keyof T, any>>;
};

export class StripeHandler implements PaymentProcessorHandler<StripeAPIAdapter> {
	async validateAndPersistCredentials({
		processor,
		platformOptions,
		client,
		secrets
	}: StripeValidateAndPersistArgs): Promise<void> {
		const [validatedCredentials, account] = await client.checkCredentials(platformOptions);
		if (!validatedCredentials) {
			throw new PaymentProcessorError(
				"The credentials provided are invalid",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		if (!isStripeAccount(account)) {
			throw new PaymentProcessorError(
				"The existing account ID is not a valid Stripe account",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		if (account.id !== processor.metadata?.account?.id) {
			throw new PaymentProcessorError(
				"Credentials provided are not the same as the existing account ID - please create a new processor record to associate with a different account",
				StatusCodes.BAD_REQUEST,
				ERROR_CODES.INVALID
			);
		}
		await secrets.updateStripeAPIKeys({
			stripePublishableKey: platformOptions.publishable_key,
			stripeSecretKey: platformOptions.secret_key
		});
	}

	async onAccountUpdated({
		originalAccount,
		updatedAccount
	}: {
		processor: PaymentProcessor;
		originalAccount: PaymentProcessorAccount;
		updatedAccount: PaymentProcessorAccount;
	}): Promise<void> {
		const originalStripeRecord = originalAccount.account;
		const updatedStripeRecord = updatedAccount.account;
		if (!isStripeAccount(updatedStripeRecord) || !isStripeAccount(originalStripeRecord)) {
			logger.warn({ originalStripeRecord, updatedStripeRecord }, "no-op: invalid stripe account records provided");
			return;
		}

		const currentStripeAccount = await this.normalizeStripeAccount(updatedAccount, updatedStripeRecord);
		if (!currentStripeAccount) {
			return;
		}
		const previousStripeAccount = await this.normalizeStripeAccount(originalAccount, originalStripeRecord);
		const { changes } = this.collectStripeChanges(currentStripeAccount, previousStripeAccount);
		if (!changes || Object.values(changes).every(value => value == null)) {
			// no changes detected -- no reason to send a notification
			return;
		}
		const platformName = INTEGRATION_ID[originalAccount.platform_id as IntegrationPlatformId];
		await producer.send({
			topic: kafkaTopics.NOTIFICATIONS,
			messages: [
				{
					key: originalAccount.business_id,
					value: {
						event: kafkaEvents.PAYMENT_PROCESSOR_ACCOUNT_UPDATED,
						processor_id: originalAccount.processor_id,
						processor_name: platformName,
						previous_account: previousStripeAccount,
						changes,
						...currentStripeAccount
					}
				}
			]
		});
	}

	private async normalizeStripeAccount(
		processorAccount: PaymentProcessorAccountTypes.PaymentProcessorAccount,
		account: Stripe.Account
	): Promise<null | NormalizedStripeAccount> {
		try {
			const onboardingCase = await getOnboardingCaseByBusinessId(
				processorAccount.business_id as UUID,
				processorAccount.customer_id as UUID
			);
			const caseRecord = await internalGetCaseByID(onboardingCase.id);

			const businessBankAccounts = (
				await BankAccount.findByBusinessId<BankAccount>(processorAccount.business_id as UUID)
			).map(account => account.getRecord() as IBanking.BankAccountRecord);
			const depositAccounts = businessBankAccounts.filter(account => account.deposit_account);

			const normalizedStripeAccounts: PaymentProcessorAccountTypes.PaymentProcessorDepositAccountInfo[] =
				account.external_accounts?.data?.filter(isStripeBankAccount)?.map((account: Stripe.BankAccount) => {
					const businessBankAccount = depositAccounts.find(
						depositAccount =>
							depositAccount.routing_number === account.routing_number &&
							depositAccount.mask?.substring(depositAccount.mask.length - 4) === account.last4
					);
					return {
						bank_account_id: account.metadata?.["worth:bankAccountId"] ?? businessBankAccount?.id ?? "",
						bank_name: account.bank_name ?? businessBankAccount?.bank_name ?? "",
						external_bank_account_id: account.id,
						bank_account_last_four: account.last4,
						bank_account_routing_number: account.routing_number,
						status: account.status,
						created_at: businessBankAccount?.created_at ?? new Date().toISOString(),
						updated_at: businessBankAccount?.updated_at ?? new Date().toISOString()
					};
				}) ?? [];

			const platformName = INTEGRATION_ID[processorAccount.platform_id as IntegrationPlatformId];
			return {
				id: processorAccount.id,
				account_id: processorAccount.account_id,
				platform_name: platformName,
				profile_id: processorAccount.profile_id,
				business_id: processorAccount.business_id,
				customer_id: processorAccount.customer_id,
				case_id: onboardingCase.id,
				case_status: caseRecord.status?.label,
				processor_status:
					mapStripeStatusToAccountStatus(collapseStripeAccountStatus(account).status)?.code ?? "UNKNOWN",
				charges_enabled: account.charges_enabled,
				payouts_enabled: account.payouts_enabled,
				stripe_account: account,
				created_at: processorAccount.created_at,
				updated_at: processorAccount.updated_at,
				capabilities: account.capabilities
					? Object.entries(account.capabilities).map(([name, status]) => ({ name, status }))
					: [],
				deposit_accounts: normalizedStripeAccounts
			};
		} catch (error) {
			logger.error(
				{ processorAccount, error },
				`Error calculating current stripe state for business ${processorAccount.business_id}`
			);
			return null;
		}
	}

	private collectStripeChanges(
		currentAccount: NormalizedStripeAccount,
		previousAccount: NormalizedStripeAccount | null
	): CalculatedAccountChanges<NormalizedStripeAccount> {
		type Keys = Pick<
			NormalizedStripeAccount,
			"charges_enabled" | "payouts_enabled" | "capabilities" | "processor_status" | "deposit_accounts"
		>;
		const changes: Partial<Record<keyof Keys, any>> = {
			charges_enabled: currentAccount.charges_enabled,
			payouts_enabled: currentAccount.payouts_enabled,
			capabilities: currentAccount.stripe_account.capabilities,
			processor_status: currentAccount.processor_status,
			deposit_accounts: currentAccount.stripe_account.external_accounts?.data
		};

		if (previousAccount) {
			if (currentAccount.charges_enabled !== previousAccount.charges_enabled) {
				changes.charges_enabled = currentAccount.charges_enabled;
			} else {
				changes.charges_enabled = undefined;
			}
			if (currentAccount.payouts_enabled !== previousAccount.payouts_enabled) {
				changes.payouts_enabled = currentAccount.payouts_enabled;
			} else {
				changes.payouts_enabled = undefined;
			}
			if (currentAccount.processor_status !== previousAccount.processor_status) {
				changes.processor_status = currentAccount.processor_status;
			} else {
				changes.processor_status = undefined;
			}
			if (
				currentAccount.stripe_account.external_accounts?.data?.length !==
				previousAccount.stripe_account.external_accounts?.data?.length
			) {
				changes.deposit_accounts = currentAccount.stripe_account.external_accounts?.data;
			} else {
				changes.deposit_accounts = undefined;
			}

			// Iterate through the capabilities and check if any have changed
			Object.entries(currentAccount.stripe_account.capabilities ?? {}).forEach(([name, status]) => {
				if (status !== previousAccount?.stripe_account.capabilities?.[name]) {
					changes.capabilities[name] = status;
				} else {
					delete changes.capabilities[name];
				}
			});

			// Remove changes.capabilities if it is empty
			if (Object.keys(changes.capabilities ?? {}).length === 0) {
				changes.capabilities = undefined;
			}

			return {
				current: currentAccount,
				previous: previousAccount,
				changes
			};
		}
		return {
			current: currentAccount,
			previous: null,
			changes
		};
	}
}
