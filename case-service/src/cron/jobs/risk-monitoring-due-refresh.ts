/**
 * Cron: get businesses due for monitoring refresh, create run rows, and enqueue each run
 * for processing (Bull queue + optional Kafka event).
 *
 * Flow:
 * 1. Get eligible businesses via due-for-refresh query (cursor-paginated).
 * 2. Group by (customer_id, template_id).
 * 3. For each group: create monitoring_run, add businesses to run, enqueue run.
 */
import type { UUID } from "crypto";
import { db } from "#helpers";
import { BullQueue } from "#helpers/bullQueue";
import { logger } from "#helpers/logger";
import { QUEUES, QUEUE_EVENTS } from "#constants";
import { getRiskMonitoringContainer } from "../../api/v1/modules/risk-monitoring/container";
import type {
	DueForRefreshRow,
	MonitoringRunQueueEvent
} from "../../api/v1/modules/risk-monitoring/riskMonitoringTypes";

const PAGE_LIMIT = 500;
const MAX_PAGES = 500;

function groupByCustomerAndTemplate(rows: DueForRefreshRow[]): Map<string, DueForRefreshRow[]> {
	const key = (r: DueForRefreshRow) => `${r.customer_id}:${r.template_id}`;
	const map = new Map<string, DueForRefreshRow[]>();
	for (const row of rows) {
		const k = key(row);
		const list = map.get(k) ?? [];
		list.push(row);
		map.set(k, list);
	}
	return map;
}

export const riskMonitoringDueRefresh = async (customerId: UUID | null = null): Promise<void> => {
	logger.info("risk-monitoring-due-refresh: starting");

	const container = getRiskMonitoringContainer(db);
	const runRepo = container.runRepository;
	const monitoringRunQueue = new BullQueue(QUEUES.MONITORING_RUN);

	const allRows: DueForRefreshRow[] = [];
	let cursor: { days_overdue: number; business_id: UUID; template_id: UUID } | null = null;
	let pages = 0;

	// TODO: Get eligible customers using feature enablement checks

	// 1) Get eligible businesses (paginated)
	do {
		const page = await runRepo.getDueForRefresh({
			limit: PAGE_LIMIT,
			cursor,
			customerId
		});
		allRows.push(...page.rows);
		cursor = page.nextCursor;
		pages++;
		if (pages >= MAX_PAGES) {
			logger.warn(`risk-monitoring-due-refresh: capped at ${MAX_PAGES} pages (${allRows.length} rows)`);
			break;
		}
	} while (cursor != null);

	if (allRows.length === 0) {
		logger.info("risk-monitoring-due-refresh: no due businesses, exiting");
		return;
	}

	logger.info({ count: allRows.length }, "risk-monitoring-due-refresh: due businesses fetched");

	// 2) Group by (customer_id, template_id)
	const groups = groupByCustomerAndTemplate(allRows);
	const eligibleCustomerIds = new Set<string>();
	groups.forEach((_, key) => {
		const [customerId] = key.split(":");
		eligibleCustomerIds.add(customerId);
	});
	logger.info(
		{ customerCount: eligibleCustomerIds.size, runGroupCount: groups.size },
		"risk-monitoring-due-refresh: eligible customers and run groups"
	);

	// 3) Init run row per group and 4) Enqueue run
	let runsCreated = 0;
	let enqueued = 0;
	const failedRuns: { customerId: UUID; templateId: UUID; businessId: UUID; error: unknown }[] = [];

	for (const [customerTemplateKey, rows] of groups) {
		const [customerId, templateId] = customerTemplateKey.split(":") as [UUID, UUID];
		try {
			const run = await runRepo.createRun(customerId, templateId);
			for (const row of rows) {
				const businessIdempotencyKey = `${run.id}:${row.business_id}`;
				const integrationGroups = row.due_integration_groups.map(Number);
				await runRepo.addBusinessToRun(run.id, row.business_id, templateId, {
					metadata: { due_integration_groups: integrationGroups },
					status: "PENDING"
				});
				await monitoringRunQueue.addJob<MonitoringRunQueueEvent>(
					QUEUE_EVENTS.MONITORING_RUN_CREATED,
					{
						idempotency_key: businessIdempotencyKey,
						run_id: run.id,
						customer_id: customerId,
						business_id: row.business_id,
						integration_groups: integrationGroups,
						created_at: run.created_at
					},
					{ jobId: businessIdempotencyKey }
				);
			}
			runsCreated++;
			enqueued += rows.length;
		} catch (err: unknown) {
			failedRuns.push({ customerId, templateId, businessId: rows[0].business_id, error: err });
		}
	}

	if (failedRuns.length > 0) {
		logger.error({ failedRuns }, "risk-monitoring-due-refresh: failed to create runs or enqueue");
	}
	logger.info({ runsCreated, enqueued }, "risk-monitoring-due-refresh: completed");
};
