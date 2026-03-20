import { CADENCE_VALUES } from "../../constants";

/** Build cadence_days VALUES clause from shared constants (single source of truth). */
const cadenceValuesClause = Object.entries(CADENCE_VALUES)
	.map(([cadence, days]) => `('${cadence}', ${days})`)
	.join(",\n    ");

/**
 * Base SQL for due-for-refresh query (no ORDER BY / LIMIT).
 * Used by MonitoringRunRepository.getDueForRefresh with cursor pagination.
 * Cadence → days comes from CADENCE_VALUES in constants.
 */
export const dueForRefreshBaseSql = `
WITH cadence_days AS (
  SELECT * FROM (VALUES
    ${cadenceValuesClause}
  ) AS t(cadence_text, days)
),
last_run_per_business AS (
  SELECT
    mtb.template_id,
    mtb.customer_id,
    mtb.business_id,
    COALESCE(
      (SELECT MAX(bmr.complete_at)
       FROM monitoring.rel_business_monitoring_run bmr
       WHERE bmr.template_id = mtb.template_id AND bmr.business_id = mtb.business_id),
      mtb.created_at
    ) AS last_run_at
  FROM monitoring.rel_monitoring_template_business mtb
  WHERE mtb.template_id IS NOT NULL
),
template_groups AS (
  SELECT
    t.id AS template_id,
    t.customer_id,
    ig.integration_group,
    ig.cadence,
    COALESCE(cd.days, 30) AS cadence_days
  FROM monitoring.monitoring_templates t
  JOIN monitoring.rel_integration_group_monitoring_template ig ON ig.template_id = t.id
  LEFT JOIN cadence_days cd ON cd.cadence_text = ig.cadence::text
  WHERE t.is_active = true
),
due_businesses AS (
  SELECT
    tg.template_id,
    tg.customer_id,
    tg.integration_group,
    tg.cadence_days,
    lr.business_id,
    lr.last_run_at
  FROM template_groups tg
  JOIN last_run_per_business lr ON lr.template_id = tg.template_id AND lr.customer_id = tg.customer_id
  WHERE lr.last_run_at IS NULL
     OR (CURRENT_TIMESTAMP - lr.last_run_at) >= (tg.cadence_days || ' days')::interval
)
SELECT
  customer_id,
  business_id,
  template_id,
  array_agg(integration_group ORDER BY integration_group) AS due_integration_groups,
  max(last_run_at) AS last_run_at,
  max(
    (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_run_at)) / 86400)::int - cadence_days
  ) AS days_overdue
FROM due_businesses
GROUP BY customer_id, business_id, template_id
`.trim();
