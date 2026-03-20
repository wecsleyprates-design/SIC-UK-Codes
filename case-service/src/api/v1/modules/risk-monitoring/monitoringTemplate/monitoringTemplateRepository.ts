import type { UUID } from "crypto";
import type { Knex } from "knex";
import type {
	Cadence,
	MonitoringTemplateRow,
	RelIntegrationGroupMonitoringTemplateRow,
	RelMonitoringTemplateBusinessRow,
	RelMonitoringRulesRow,
	MonitoringAssociation
} from "../riskMonitoringTypes";

const SCHEMA = "monitoring";
const MONITORING_TEMPLATES = `${SCHEMA}.monitoring_templates`;
const REL_INTEGRATION_GROUP = `${SCHEMA}.rel_integration_group_monitoring_template`;
const REL_TEMPLATE_BUSINESS = `${SCHEMA}.rel_monitoring_template_business`;
const REL_RULES = `${SCHEMA}.rel_monitoring_rules`;
const MONITORING_RUN = `${SCHEMA}.monitoring_run`;

export class TemplateRepository {
	private readonly db: Knex;

	constructor(db: Knex) {
		this.db = db;
	}

	async listByCustomer(customerId: string): Promise<MonitoringTemplateRow[]> {
		return this.db<MonitoringTemplateRow>(MONITORING_TEMPLATES)
			.where("customer_id", customerId)
			.orderBy("priority", "asc")
			.orderBy("created_at", "asc")
			.select("*");
	}

	async getByIdAndCustomer(templateId: UUID, customerId: string): Promise<MonitoringTemplateRow | undefined> {
		return this.db<MonitoringTemplateRow>(MONITORING_TEMPLATES)
			.where("id", templateId)
			.andWhere("customer_id", customerId)
			.first();
	}

	async create(
		data: Pick<
			MonitoringTemplateRow,
			"customer_id" | "priority" | "is_active" | "is_default" | "label" | "created_by" | "updated_by"
		>
	): Promise<MonitoringTemplateRow> {
		const rows = await this.db<MonitoringTemplateRow>(MONITORING_TEMPLATES).insert(data).returning("*");
		return rows[0];
	}

	async update(
		templateId: UUID,
		customerId: UUID,
		data: Partial<Pick<MonitoringTemplateRow, "priority" | "is_active" | "is_default" | "label" | "updated_by">>
	): Promise<MonitoringTemplateRow | undefined> {
		const rows = await this.db<MonitoringTemplateRow>(MONITORING_TEMPLATES)
			.where("id", templateId)
			.andWhere("customer_id", customerId)
			.update(data)
			.returning("*");
		return rows[0];
	}

	async delete(templateId: UUID, customerId: string): Promise<boolean> {
		const deleted = await this.db(MONITORING_TEMPLATES)
			.where("id", templateId)
			.andWhere("customer_id", customerId)
			.del();
		return deleted > 0;
	}

	async clearOtherDefaultsForCustomer(customerId: string, excludeTemplateId?: string): Promise<void> {
		const query = this.db(MONITORING_TEMPLATES)
			.where({ customer_id: customerId, is_active: true, is_default: true })
			.update({ is_default: false });
		if (excludeTemplateId) {
			query.andWhereNot("id", excludeTemplateId);
		}
		await query;
	}

	async getActiveTemplateIdByCustomerAndPriority(
		customerId: UUID,
		priority: number,
		excludeTemplateId?: UUID
	): Promise<UUID | undefined> {
		let q = this.db<MonitoringTemplateRow>(MONITORING_TEMPLATES)
			.where({ customer_id: customerId, priority, is_active: true })
			.select("id");
		if (excludeTemplateId) {
			q = q.andWhereNot("id", excludeTemplateId);
		}
		const row = await q.first();
		return row?.id;
	}

	async getIntegrationGroupsByTemplateId(
		templateId: UUID
	): Promise<Array<{ integration_group: number; cadence: Cadence }>> {
		const rows = await this.db<RelIntegrationGroupMonitoringTemplateRow>(REL_INTEGRATION_GROUP)
			.where("template_id", templateId)
			.select("integration_group", "cadence");
		return rows.map(r => ({ integration_group: r.integration_group, cadence: r.cadence as Cadence }));
	}

	async replaceIntegrationGroups(
		templateId: UUID,
		items: Array<{ integration_group: number; cadence: Cadence }>,
		userId: UUID
	): Promise<void> {
		await this.db.transaction(async trx => {
			await trx(REL_INTEGRATION_GROUP).where("template_id", templateId).del();
			if (items.length) {
				await trx(REL_INTEGRATION_GROUP).insert(
					items.map(({ integration_group, cadence }) => ({
						template_id: templateId,
						integration_group,
						cadence,
						created_by: userId,
						updated_by: userId
					}))
				);
			}
		});
	}

	async getRuleIdsByTemplateId(templateId: UUID): Promise<UUID[]> {
		const rows = await this.db<RelMonitoringRulesRow>(REL_RULES).where("template_id", templateId).select("rule_id");
		return rows.map(r => r.rule_id);
	}

	async replaceRules(templateId: UUID, ruleIds: UUID[]): Promise<void> {
		await this.db.transaction(async trx => {
			await trx(REL_RULES).where("template_id", templateId).del();
			if (ruleIds.length) {
				await trx(REL_RULES).insert(ruleIds.map(rule_id => ({ template_id: templateId, rule_id })));
			}
		});
	}

	async setIntegrationGroupsAndRules(
		templateId: UUID,
		integrationGroups: Array<{ integration_group: number; cadence: Cadence }>,
		ruleIds: UUID[],
		userId: UUID
	): Promise<void> {
		await this.db.transaction(async trx => {
			await trx(REL_INTEGRATION_GROUP).where("template_id", templateId).del();
			await trx(REL_RULES).where("template_id", templateId).del();
			if (integrationGroups.length) {
				await trx(REL_INTEGRATION_GROUP).insert(
					integrationGroups.map(({ integration_group, cadence }) => ({
						template_id: templateId,
						integration_group,
						cadence,
						created_by: userId,
						updated_by: userId
					}))
				);
			}
			if (ruleIds.length) {
				await trx(REL_RULES).insert(ruleIds.map(rule_id => ({ template_id: templateId, rule_id })));
			}
		});
	}

	async upsertBusinessTemplate(
		businessId: UUID,
		customerId: UUID,
		templateId: UUID,
		association: MonitoringAssociation = "RULE"
	): Promise<void> {
		await this.db<RelMonitoringTemplateBusinessRow>(REL_TEMPLATE_BUSINESS)
			.insert({ business_id: businessId, customer_id: customerId, template_id: templateId, association })
			.onConflict(["business_id", "customer_id"])
			.merge({ template_id: templateId });
	}

	async getBusinessTemplate(businessId: UUID, customerId: UUID): Promise<{ template_id: UUID } | undefined> {
		return this.db<RelMonitoringTemplateBusinessRow>(REL_TEMPLATE_BUSINESS)
			.where("business_id", businessId)
			.andWhere("customer_id", customerId)
			.select("template_id")
			.first();
	}

	async getLastRunAtByTemplateId(templateId: UUID): Promise<string | null> {
		const row = await this.db(MONITORING_RUN)
			.where("template_id", templateId)
			.select(this.db.raw("MAX(created_at) AS last_run_at"))
			.first();
		const last = (row as { last_run_at?: string | Date } | undefined)?.last_run_at;
		if (last == null) {
			return null;
		}
		return typeof last === "string" ? last : ((last as Date)?.toISOString?.() ?? null);
	}

	async getBusinessCountByTemplateId(templateId: UUID): Promise<number> {
		const result = await this.db(REL_TEMPLATE_BUSINESS).where("template_id", templateId).count({ count: "*" }).first();
		const n = result?.count;
		if (n == null) {
			return 0;
		}
		return typeof n === "string" ? parseInt(n, 10) : Number(n);
	}
}
