import { INTEGRATION_ID, type IntegrationPlatformId } from "#constants";
import { logger } from "#helpers";
import { db } from "#helpers/knex";
import * as StripeTypes from "#lib/paymentProcessor/types/stripe";
import { UUID } from "crypto";
import { PaymentProcessorAccountStatus } from "../paymentProcessorAccount.constants";
import type { Knex } from "knex";
import * as PaymentProcessorAccountTypes from "@joinworth/types/dist/types/integration/paymentProcessors/paymentProcessorAccount";

export interface PaymentProcessorAccount<T extends Record<string, any> = Record<string, any>>
	extends PaymentProcessorAccountTypes.PaymentProcessorAccount {
	account: T;
}

type Injectable = {
	db?: Knex;
};
export class PaymentProcessorAccountRepository {
	private static readonly tableName = "integration_data.payment_processor_accounts";
	public static readonly PLATFORM_ID: IntegrationPlatformId = INTEGRATION_ID.STRIPE;
	private readonly knex: Knex;

	constructor(args?: Injectable) {
		this.knex = args?.db ?? db;
	}

	public async saveAccountInfo(processorId: UUID, accountInfos: StripeTypes.AccountInfo[]): Promise<PaymentProcessorAccountTypes.PaymentProcessorAccount[]> {
		if (accountInfos.length === 0) return [];
		try {
			const records = accountInfos.map(info => ({
				profile_id: info.profileId,
				customer_id: info.customerId,
				business_id: info.businessId,
				platform_id: PaymentProcessorAccountRepository.PLATFORM_ID,
				account_id: info.accountId,
				account: info.data,
				processor_id: processorId,
				status: info.status ?? PaymentProcessorAccountStatus.UNKNOWN
			}));
			return await this.table()
				.insert(records)
				.onConflict(["platform_id", "profile_id", "account_id"])
				.merge(["account", "status", "updated_at"])
				.returning("*");
		} catch (error) {
			const accountIds = accountInfos.map(info => info.accountId).join(", ");
			logger.error({error: error}, `Error saving AccountInfo for accounts: [${accountIds}]`);
			return [];
		}
	}

	public async get(processorAccountId: UUID): Promise<PaymentProcessorAccount | null> {
		const result = await this.table().where({ id: processorAccountId }).first();
		return result ?? null;
	}

	public async findByAccountId(accountId: string): Promise<PaymentProcessorAccount | null> {
		const result = await this.table()
			.where({ account_id: accountId, platform_id: PaymentProcessorAccountRepository.PLATFORM_ID })
			.first();
		return result || null;
	}

	public async findByProfileId(profileId: UUID): Promise<PaymentProcessorAccount[]> {
		const results = await this.table().where({
			profile_id: profileId,
			platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
		});
		return results || [];
	}

	public async findByBusinessId<T extends Record<string, any> = Record<string, any>>(
		businessId: UUID
	): Promise<Array<PaymentProcessorAccount<T>>> {
		return this.table().where({
			business_id: businessId,
			platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
		});
	}

	public async findByCustomerId(customerId: UUID): Promise<PaymentProcessorAccount[]> {
		const results = await this.table().where({
			customer_id: customerId,
			platform_id: PaymentProcessorAccountRepository.PLATFORM_ID
		});
		return results || [];
	}

	public async updateAccountSnapshot<T extends Record<string, any> = Record<string, any>>(
		paymentProcessorAccountId: UUID,
		attributes: Partial<PaymentProcessorAccount<T>>,
		source: "manual" | "webhook" = "manual"
	): Promise<PaymentProcessorAccount<T> | null> {
		try {
			const updatePayload: Partial<PaymentProcessorAccount<T>> = {
				...attributes,
				updated_at: new Date().toISOString()
			};
			if (source === "manual") {
				updatePayload.manual_sync_at = new Date().toISOString();
			} else if (source === "webhook") {
				updatePayload.webhook_received_at = new Date().toISOString();
			}
			const updated = await this.table<T>()
				.where({
					id: paymentProcessorAccountId
				})
				.update(updatePayload)
				.returning("*");
			return updated?.[0] ?? null;
		} catch (error) {
			logger.error({ error }, `Error updating AccountInfo ${paymentProcessorAccountId}`);
			return null;
		}
	}

	private table<T extends Record<string, any> = Record<string, any>>(): Knex.QueryBuilder<PaymentProcessorAccount<T>> {
		return this.knex<PaymentProcessorAccount<T>>(PaymentProcessorAccountRepository.tableName);
	}
}
