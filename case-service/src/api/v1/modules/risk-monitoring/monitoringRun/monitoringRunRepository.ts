import type { UUID } from "crypto";
import type { Knex } from "knex";
import { ERROR_CODES } from "#constants/index";
import { StatusCodes } from "http-status-codes";
import type {
	MonitoringRunRow,
	RelBusinessMonitoringRunRow,
	MonitoringRunStatus,
	DueForRefreshCursor,
	DueForRefreshPage,
	DueForRefreshRow
} from "../riskMonitoringTypes";
import { RiskMonitoringApiError } from "../riskMonitoringApiError";
import { dueForRefreshBaseSql } from "./queries/due-for-refresh";

const SCHEMA = "monitoring";
const MONITORING_RUN = `${SCHEMA}.monitoring_run`;
const REL_BUSINESS_MONITORING_RUN = `${SCHEMA}.rel_business_monitoring_run`;

function parseMetadata(row: RelBusinessMonitoringRunRow): RelBusinessMonitoringRunRow {
	return typeof row.metadata === "string"
		? { ...row, metadata: JSON.parse(row.metadata) as Record<string, unknown> }
		: row;
}

export class MonitoringRunRepository {
	private readonly db: Knex;

	constructor(db: Knex) {
		this.db = db;
	}

	async createRun(customerId: UUID, templateId: UUID): Promise<MonitoringRunRow> {
		const rows = await this.db<MonitoringRunRow>(MONITORING_RUN)
			.insert({ customer_id: customerId, template_id: templateId })
			.returning("*");
		const run = rows[0];
		if (!run) {
			throw new RiskMonitoringApiError(
				"Failed to create monitoring run",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		return run;
	}

	async getRunById(runId: string): Promise<MonitoringRunRow | undefined> {
		return this.db<MonitoringRunRow>(MONITORING_RUN).where("id", runId).first();
	}

	async addBusinessToRun(
		runId: UUID,
		businessId: UUID,
		templateId: UUID,
		options: {
			metadata?: Record<string, unknown>;
			score_trigger_id?: UUID | null;
			start_at?: Date | string | null;
			status?: MonitoringRunStatus;
		} = {}
	): Promise<RelBusinessMonitoringRunRow> {
		const { metadata = {}, score_trigger_id = null, start_at = null, status = "PENDING" } = options;
		const startAtVal = start_at == null ? null : start_at instanceof Date ? start_at.toISOString() : start_at;
		const rows = await this.db<RelBusinessMonitoringRunRow>(REL_BUSINESS_MONITORING_RUN)
			.insert({
				run_id: runId,
				business_id: businessId,
				template_id: templateId,
				metadata: this.db.raw("?::jsonb", [JSON.stringify(metadata)]),
				score_trigger_id,
				start_at: startAtVal,
				status
			} as Record<string, unknown>)
			.onConflict(["run_id", "business_id"])
			.merge({
				metadata: this.db.raw("EXCLUDED.metadata"),
				score_trigger_id: this.db.raw("EXCLUDED.score_trigger_id"),
				start_at: this.db.raw("EXCLUDED.start_at"),
				status: this.db.raw("EXCLUDED.status")
			})
			.returning("*");
		const row = rows[0];
		if (!row) {
			throw new RiskMonitoringApiError(
				"Failed to add business to run",
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
		return parseMetadata(row);
	}

	async updateBusinessRun(
		runId: UUID,
		businessId: UUID,
		data: Partial<
			Pick<RelBusinessMonitoringRunRow, "start_at" | "complete_at" | "status" | "score_trigger_id" | "metadata">
		>
	): Promise<RelBusinessMonitoringRunRow | undefined> {
		const payload: Record<string, unknown> = { ...data };
		if (payload.metadata != null && typeof payload.metadata === "object") {
			payload.metadata = JSON.stringify(payload.metadata);
		}
		const rows = await this.db<RelBusinessMonitoringRunRow>(REL_BUSINESS_MONITORING_RUN)
			.where("run_id", runId)
			.andWhere("business_id", businessId)
			.update(payload)
			.returning("*");
		const row = rows[0];
		return row ? parseMetadata(row) : undefined;
	}

	async getBusinessRunsByRunId(runId: UUID): Promise<RelBusinessMonitoringRunRow[]> {
		const rows = await this.db<RelBusinessMonitoringRunRow>(REL_BUSINESS_MONITORING_RUN)
			.where("run_id", runId)
			.select("*");
		return rows.map(parseMetadata);
	}

	/**
	 * List businesses due for a refresh (per template), with cursor-based pagination.
	 * Order: days_overdue DESC, business_id ASC, template_id ASC.
	 * Use next_cursor from the previous page to fetch the next page; limit controls page size.
	 */
	async getDueForRefresh(options: {
		limit?: number;
		cursor?: DueForRefreshCursor | null;
		customerId?: UUID | null;
	}): Promise<DueForRefreshPage> {
		const { limit = 100, cursor = null, customerId: filterCustomerId = null } = options;

		// Wrap as subquery so we can apply cursor WHERE and ORDER BY + LIMIT
		const orderClause = "ORDER BY due.days_overdue DESC, due.business_id ASC, due.template_id ASC";
		const limitClause = "LIMIT ?";
		const bindings: (number | string)[] = [];

		let whereClause = "";
		if (filterCustomerId != null) {
			whereClause = "WHERE due.customer_id = ?";
			bindings.push(filterCustomerId);
		}
		if (cursor != null) {
			// Rows "after" cursor in (days_overdue DESC, business_id ASC, template_id ASC):
			// (d < c.d) OR (d = c.d AND b > c.b) OR (d = c.d AND b = c.b AND t > c.t)
			const cursorCond =
				"(due.days_overdue < ?) OR (due.days_overdue = ? AND due.business_id > ?) OR (due.days_overdue = ? AND due.business_id = ? AND due.template_id > ?)";
			const cursorWhere = `(${cursorCond})`;
			whereClause = whereClause ? `${whereClause} AND ${cursorWhere}` : `WHERE ${cursorWhere}`;
			bindings.push(
				cursor.days_overdue,
				cursor.days_overdue,
				cursor.business_id,
				cursor.days_overdue,
				cursor.business_id,
				cursor.template_id
			);
		}
		bindings.push(limit + 1); // fetch one extra to know if there's a next page

		const sql = `SELECT due.* FROM (${dueForRefreshBaseSql}) AS due ${whereClause} ${orderClause} ${limitClause}`;
		const result = await this.db.raw(sql, bindings);
		const rows: DueForRefreshRow[] = (result as { rows: DueForRefreshRow[] }).rows ?? [];

		// Normalize array column (pg driver usually returns array for array_agg; fallback for string)
		const normalized = rows.map(row => ({
			...row,
			due_integration_groups: Array.isArray(row.due_integration_groups)
				? row.due_integration_groups
				: typeof row.due_integration_groups === "string"
					? (row.due_integration_groups as string)
							.replace(/^\{|\}$/g, "")
							.split(",")
							.map(s => s.trim())
					: []
		}));

		const hasMore = normalized.length > limit;
		const pageRows = hasMore ? normalized.slice(0, limit) : normalized;
		const last = pageRows[pageRows.length - 1];
		const nextCursor: DueForRefreshCursor | null =
			hasMore && last != null
				? {
						days_overdue: last.days_overdue,
						business_id: last.business_id,
						template_id: last.template_id
					}
				: null;

		return { rows: pageRows, nextCursor };
	}
}
