import type { UUID } from "crypto";
import type { Knex } from "knex";
import type { RiskAlertRow, RelCaseRiskAlertRow, RelRiskAlertRuleRow } from "../riskMonitoringTypes";

const SCHEMA = "monitoring";
const RISK_ALERT = `${SCHEMA}.risk_alert`;
const REL_CASE_RISK_ALERT = `${SCHEMA}.rel_case_risk_alert`;
const REL_RISK_ALERT_RULE = `${SCHEMA}.rel_risk_alert_rule`;

export type RiskAlertWithRelationsRow = RiskAlertRow & { rule_ids: UUID[] };

export class RiskAlertRepository {
	private readonly db: Knex;

	constructor(db: Knex) {
		this.db = db;
	}

	async listByCustomer(customerId: UUID): Promise<RiskAlertRow[]> {
		return this.db<RiskAlertRow>(RISK_ALERT).where("customer_id", customerId).orderBy("created_at", "asc").select("*");
	}

	async listByCustomerWithRules(customerId: UUID): Promise<RiskAlertWithRelationsRow[]> {
		const rulesSubquery = this.db(REL_RISK_ALERT_RULE)
			.select("risk_alert_id")
			.select(this.db.raw("COALESCE(array_agg(rule_id), ARRAY[]::uuid[]) as rule_ids"))
			.groupBy("risk_alert_id")
			.as("r");

		const rows = await this.db(RISK_ALERT)
			.leftJoin(rulesSubquery, `${RISK_ALERT}.id`, "r.risk_alert_id")
			.where(`${RISK_ALERT}.customer_id`, customerId)
			.orderBy(`${RISK_ALERT}.created_at`, "asc")
			.select(`${RISK_ALERT}.*`)
			.select(this.db.raw("COALESCE(r.rule_ids, ARRAY[]::uuid[]) as rule_ids"));

		return (rows as (RiskAlertRow & { rule_ids: UUID[] })[]).map(normalizeAlertRowWithRules);
	}

	async getByIdAndCustomer(alertId: UUID, customerId: UUID): Promise<RiskAlertRow | undefined> {
		return this.db<RiskAlertRow>(RISK_ALERT).where("id", alertId).andWhere("customer_id", customerId).first();
	}

	async create(data: {
		customer_id: UUID;
		label: string;
		description: string | null;
		is_active: boolean;
		category_id: UUID | null;
		bucket_id: UUID | null;
		routing: Record<string, unknown>;
		created_by: UUID;
		updated_by: UUID;
	}): Promise<RiskAlertRow> {
		const rows = await this.db<RiskAlertRow>(RISK_ALERT)
			.insert({
				...data,
				routing: this.db.raw("?::jsonb", [JSON.stringify(data.routing ?? {})]) as unknown as Record<string, unknown>
			} as Record<string, unknown>)
			.returning("*");
		const row = rows[0];
		if (row && typeof (row as { routing?: unknown }).routing === "string") {
			(row as RiskAlertRow).routing = JSON.parse((row as unknown as { routing: string }).routing) as Record<
				string,
				unknown
			>;
		}
		return row as RiskAlertRow;
	}

	async update(
		alertId: UUID,
		customerId: UUID,
		data: Partial<
			Pick<RiskAlertRow, "label" | "description" | "is_active" | "category_id" | "bucket_id" | "routing" | "updated_by">
		>
	): Promise<RiskAlertRow | undefined> {
		const payload = { ...data } as Record<string, unknown>;
		if (payload.routing != null && typeof payload.routing === "object") {
			payload.routing = this.db.raw("?::jsonb", [JSON.stringify(payload.routing)]);
		}
		const rows = await this.db<RiskAlertRow>(RISK_ALERT)
			.where("id", alertId)
			.andWhere("customer_id", customerId)
			.update(payload)
			.returning("*");
		const row = rows[0];
		if (row && typeof (row as { routing?: unknown }).routing === "string") {
			(row as RiskAlertRow).routing = JSON.parse((row as unknown as { routing: string }).routing) as Record<
				string,
				unknown
			>;
		}
		return row;
	}

	async delete(alertId: UUID, customerId: UUID): Promise<boolean> {
		const deleted = await this.db(RISK_ALERT).where("id", alertId).andWhere("customer_id", customerId).del();
		return deleted > 0;
	}

	async getRuleIdsByAlertIds(alertIds: UUID[]): Promise<UUID[]> {
		const rows = await this.db<RelRiskAlertRuleRow>(REL_RISK_ALERT_RULE)
			.whereIn("risk_alert_id", alertIds)
			.select("rule_id");
		return rows.map(r => r.rule_id);
	}

	async getRuleIdsByAlertId(alertId: UUID): Promise<UUID[]> {
		const rows = await this.db<RelRiskAlertRuleRow>(REL_RISK_ALERT_RULE)
			.where("risk_alert_id", alertId)
			.select("rule_id");
		return rows.map(r => r.rule_id);
	}

	async replaceRules(alertId: UUID, ruleIds: UUID[], userId: UUID): Promise<void> {
		await this.db.transaction(async trx => {
			await trx(REL_RISK_ALERT_RULE).where("risk_alert_id", alertId).del();
			if (ruleIds.length) {
				await trx(REL_RISK_ALERT_RULE).insert(
					ruleIds.map(rule_id => ({
						risk_alert_id: alertId,
						rule_id,
						created_by: userId,
						updated_by: userId
					}))
				);
			}
		});
	}

	/**
	 * Link a case to a risk alert. On conflict (case_id, risk_alert_id), context and run_id are updated.
	 * When a monitoring run triggers an alert for a case, pass run_id and context (e.g. rule output, score).
	 */
	async linkCaseToAlert(
		caseId: UUID,
		riskAlertId: UUID,
		options: { context?: Record<string, unknown>; run_id?: UUID | null } = {}
	): Promise<void> {
		const { context = {}, run_id = null } = options;
		const payload = {
			case_id: caseId,
			risk_alert_id: riskAlertId,
			context: this.db.raw("?::jsonb", [JSON.stringify(context)]),
			run_id
		} as Record<string, unknown>;
		await this.db<RelCaseRiskAlertRow>(REL_CASE_RISK_ALERT)
			.insert(payload)
			.onConflict(["case_id", "risk_alert_id"])
			.merge({ context: this.db.raw("EXCLUDED.context"), run_id: this.db.raw("EXCLUDED.run_id") });
	}

	async unlinkCaseFromAlert(caseId: UUID, riskAlertId: UUID): Promise<boolean> {
		const deleted = await this.db(REL_CASE_RISK_ALERT)
			.where("case_id", caseId)
			.andWhere("risk_alert_id", riskAlertId)
			.del();
		return deleted > 0;
	}

	async getAlertIdsByCaseId(caseId: UUID): Promise<string[]> {
		const rows = await this.db<RelCaseRiskAlertRow>(REL_CASE_RISK_ALERT)
			.where("case_id", caseId)
			.select("risk_alert_id");
		return rows.map(r => r.risk_alert_id);
	}

	/** Returns full case–alert links with context and run_id (for "why was this case linked"). */
	async getCaseRiskAlerts(caseId: UUID): Promise<RelCaseRiskAlertRow[]> {
		const rows = await this.db<RelCaseRiskAlertRow>(REL_CASE_RISK_ALERT).where("case_id", caseId).select("*");
		return rows.map(parseContext);
	}
}

function normalizeAlertRowWithRules(
	row: RiskAlertRow & { rule_ids: UUID[]; routing?: string | Record<string, unknown> }
): RiskAlertWithRelationsRow {
	const out = { ...row, rule_ids: row.rule_ids ?? [] } as RiskAlertWithRelationsRow;
	if (typeof (row as { routing?: unknown }).routing === "string") {
		(out as RiskAlertRow).routing = JSON.parse((row as unknown as { routing: string }).routing) as Record<
			string,
			unknown
		>;
	}
	return out;
}

function parseContext(row: RelCaseRiskAlertRow): RelCaseRiskAlertRow {
	const r = row as RelCaseRiskAlertRow & { context?: string | Record<string, unknown> };
	if (typeof r.context === "string") {
		return { ...r, context: JSON.parse(r.context) as Record<string, unknown> };
	}
	return r;
}
