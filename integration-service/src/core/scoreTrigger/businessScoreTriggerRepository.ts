import type { UUID } from "crypto";
import type { Knex } from "knex";
import { db } from "#helpers/knex";
import type { BusinessScoreTrigger, IBusinessScoreTriggerEgg } from "#types/db";
import { SCORE_TRIGGER, ScoreTrigger } from "#constants";

export class BusinessScoreTriggerRepositoryError extends Error {
	constructor(message?: string) {
		super(message);
		this.name = "BusinessScoreTriggerRepositoryError";
	}
}

type Injectable = { db?: Knex };

export class BusinessScoreTriggerRepository {
	public static readonly TABLE = "integrations.business_score_triggers";
	public static readonly ERROR_CLASS = BusinessScoreTriggerRepositoryError;
	private readonly knex: Knex;

	constructor(args?: Injectable) {
		this.knex = args?.db ?? db;
	}

	/** Get the most recent score trigger for a business, ordered by version desc */
	public async getLatestByBusinessId(businessId: UUID): Promise<BusinessScoreTrigger | undefined> {
		return this.table().select("*").where({ business_id: businessId }).orderBy("version", "desc").first();
	}

	/** Insert a new score trigger and return the full row */
	public async create(egg: IBusinessScoreTriggerEgg): Promise<BusinessScoreTrigger> {
		const [record] = await this.table().insert(egg).returning("*");
		if (!record) {
			throw new BusinessScoreTriggerRepositoryError("Failed to create business score trigger");
		}
		return record;
	}

	public async getById(scoreTriggerId: UUID): Promise<BusinessScoreTrigger> {
		const businessScoreTrigger = await this.table()
			.select<BusinessScoreTrigger>("*")
			.where({ id: scoreTriggerId })
			.first();
		if (!businessScoreTrigger) {
			throw new BusinessScoreTriggerRepositoryError(`Business score trigger ${scoreTriggerId} not found`);
		}
		return businessScoreTrigger;
	}

	public async getBusinessScoreTriggerByBusinessId(
		businessId: UUID,
		triggerType: ScoreTrigger = SCORE_TRIGGER.ONBOARDING_INVITE
	): Promise<BusinessScoreTrigger> {
		// prefer where customer_id is not null
		const query = this.table()
			.select<BusinessScoreTrigger>("*")
			.where({ business_id: businessId, trigger_type: triggerType });

		if (triggerType === SCORE_TRIGGER.ONBOARDING_INVITE) {
			// When selecting for onboarding, we want the OLDEST version that has a customer_id
			query.whereNotNull("customer_id").orderBy("version", "asc").orderBy("customer_id", "desc");
		}

		const businessScoreTrigger = await query.first();
		if (!businessScoreTrigger) {
			throw new Error(`Business score trigger for business ${businessId} and trigger type ${triggerType} not found`);
		}
		return businessScoreTrigger;
	}

	public async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
		return this.knex.transaction(callback);
	}

	private table(): Knex.QueryBuilder {
		return this.knex(BusinessScoreTriggerRepository.TABLE);
	}
}
