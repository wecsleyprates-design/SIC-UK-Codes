import type { UUID } from "crypto";
import type { Knex } from "knex";
import type { RiskBucketRow } from "../riskMonitoringTypes";

const SCHEMA = "monitoring";
const TABLE = `${SCHEMA}.risk_bucket`;

export class RiskBucketRepository {
	private readonly db: Knex;

	constructor(db: Knex) {
		this.db = db;
	}

	async listByCustomer(customerId: UUID, activeOnly = true): Promise<RiskBucketRow[]> {
		const query = this.db<RiskBucketRow>(TABLE).where("customer_id", customerId).orderBy("label", "asc").select("*");
		if (activeOnly) {
			query.andWhere("is_active", true);
		}
		return query;
	}

	async getByIdAndCustomer(id: UUID, customerId: UUID): Promise<RiskBucketRow | undefined> {
		return this.db<RiskBucketRow>(TABLE).where("id", id).andWhere("customer_id", customerId).first();
	}

	async create(data: {
		customer_id: UUID;
		label: string;
		is_active: boolean;
		created_by: UUID;
		updated_by: UUID;
	}): Promise<RiskBucketRow> {
		const rows = await this.db<RiskBucketRow>(TABLE).insert(data).returning("*");
		return rows[0];
	}

	async update(
		id: UUID,
		customerId: UUID,
		data: Partial<Pick<RiskBucketRow, "label" | "is_active" | "updated_by">>
	): Promise<RiskBucketRow | undefined> {
		const rows = await this.db<RiskBucketRow>(TABLE)
			.where("id", id)
			.andWhere("customer_id", customerId)
			.update(data)
			.returning("*");
		return rows[0];
	}

	async delete(id: UUID, customerId: UUID): Promise<boolean> {
		const deleted = await this.db(TABLE).where("id", id).andWhere("customer_id", customerId).del();
		return deleted > 0;
	}
}
