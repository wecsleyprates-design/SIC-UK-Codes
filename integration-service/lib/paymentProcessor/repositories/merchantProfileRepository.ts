import { IntegrationPlatformId } from "#constants";
import { logger } from "#helpers";
import { db } from "#helpers/knex";
import { MerchantProfile } from "#lib/paymentProcessor/merchantProfile";
import { UUID } from "crypto";
import { Knex } from "knex";

export class MerchantProfileRepository {
	private static readonly tableName = "integration_data.payment_processor_merchant_profiles";

	private table(): Knex.QueryBuilder {
		return db(MerchantProfileRepository.tableName);
	}

	private get accountRelationship(): string {
		return "integration_data.payment_processor_accounts";
	}

	public async save(merchantProfiles: MerchantProfile[]): Promise<MerchantProfile[]> {
		if (merchantProfiles.length === 0) return merchantProfiles;

		try {
			const records = merchantProfiles.map(profile => profile.toDbRecord());
			const savedRecords = await this.table()
				.insert(records)
				.onConflict(["business_id", "platform_id"])
				.merge(["profile", "updated_at"])
				.returning("*");
			return savedRecords
				.map((record: Record<string, any>) => MerchantProfile.fromDb(record))
				.filter(MerchantProfile.isValidProfile);
		} catch (error) {
			// TODO: Do something with error for auditing.
			logger.error({ error }, "Error saving MerchantProfiles");
			return [];
		}
	}

	public async get(
		businessId: UUID,
		platformId: IntegrationPlatformId,
		withAccountInfo: boolean = false
	): Promise<MerchantProfile | null> {
		let query: Knex.QueryBuilder = this.table().where({
			"payment_processor_merchant_profiles.business_id": businessId,
			"payment_processor_merchant_profiles.platform_id": platformId
		});

		if (withAccountInfo) {
			query = query
				.leftJoin(
					`${this.accountRelationship}`,
					"payment_processor_merchant_profiles.id",
					`${this.accountRelationship}.profile_id`
				)
				.select(
					`${MerchantProfileRepository.tableName}.*`,
					`${this.accountRelationship}.account`,
					`${this.accountRelationship}.status`,
					`${this.accountRelationship}.id as account_id`,
					`${this.accountRelationship}.account_id as processor_account_id`
				);
			return MerchantProfile.fromDbWithRelationships(await query);
		}

		return MerchantProfile.fromDb(await query.first());
	}

	public async findByBusinessId(businessId: UUID[], platformId: IntegrationPlatformId): Promise<MerchantProfile[]> {
		// TODO: when we have multiple platforms, we need to filter by platform_id as well;

		const results = await this.table().whereIn("business_id", businessId).andWhere({ platform_id: platformId });

		return results.map(result => MerchantProfile.fromDb(result)).filter(MerchantProfile.isValidProfile);
	}

	public async findByCustomerId(customerId: UUID): Promise<MerchantProfile[]> {
		const results = await this.table().where({ customer_id: customerId });
		return results.map(result => MerchantProfile.fromDb(result)).filter(MerchantProfile.isValidProfile);
	}

	public async findByAccountId(accountId: string): Promise<MerchantProfile | null> {
		const result = await this.table().where({ account_id: accountId }).first();

		return MerchantProfile.fromDb(result);
	}
}
