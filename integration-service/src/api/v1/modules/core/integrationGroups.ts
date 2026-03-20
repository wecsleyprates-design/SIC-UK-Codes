import { db } from "#helpers/knex";
import { StatusCodes } from "http-status-codes";
import { CoreApiError } from "./error";

const GROUPS_TABLE = "core_integration_groups";
const REL_TABLE = "rel_integration_integration_groups";

/** Single integration item within a group (task + platform from rel_tasks_integrations). */
export interface IntegrationGroupItem {
	integration_task_id: number;
	task_category_id: number | null;
	task_code: string | null;
	task_label: string | null;
	platform_id: number | null;
	platform_code: string | null;
	platform_label: string | null;
}

/** Integration group with its associated integrations. */
export interface IntegrationGroupWithIntegrations {
	id: number;
	name: string;
	integrations: IntegrationGroupItem[];
}

/** Raw row from the groups + integrations query. */
interface IntegrationGroupRow {
	group_id: number;
	group_name: string;
	integration_task_id: number | null;
	task_category_id: number | null;
	task_code: string | null;
	task_label: string | null;
	platform_id: number | null;
	platform_code: string | null;
	platform_label: string | null;
}

export interface CreateGroupInput {
	id: number;
	name: string;
}

export interface UpdateGroupInput {
	name: string;
}

/**
 * Get all integration task records (rel_tasks_integrations with task + platform info).
 * Same shape as each item in a group's integrations array. Internal & Admin only.
 */
export async function getIntegrationTasks(): Promise<IntegrationGroupItem[]> {
	const rows = (await db("rel_tasks_integrations")
		.select(
			"rti.id as integration_task_id",
			"ct.id as task_category_id",
			"ct.code as task_code",
			"ct.label as task_label",
			"cip.id as platform_id",
			"cip.code as platform_code",
			"cip.label as platform_label"
		)
		.from("rel_tasks_integrations as rti")
		.leftJoin("core_tasks as ct", "ct.id", "rti.task_category_id")
		.leftJoin("core_integrations_platforms as cip", "cip.id", "rti.platform_id")
		.orderBy("rti.id")) as IntegrationGroupItem[];

	return rows;
}

/**
 * Get all integration groups with their associated integrations (task + platform info).
 * Used by GET route for Admin, Customer, and Internal.
 */
export async function getGroupsWithIntegrations(
	withIntegrations: boolean
): Promise<IntegrationGroupWithIntegrations[]> {
	const rows = (await db(GROUPS_TABLE)
		.select(
			"g.id as group_id",
			"g.name as group_name",
			"rti.id as integration_task_id",
			"ct.id as task_category_id",
			"ct.code as task_code",
			"ct.label as task_label",
			"cip.id as platform_id",
			"cip.code as platform_code",
			"cip.label as platform_label"
		)
		.from(`${GROUPS_TABLE} as g`)
		.leftJoin(`${REL_TABLE} as r`, "r.integration_group", "g.id")
		.leftJoin("rel_tasks_integrations as rti", "rti.id", "r.integration_task")
		.leftJoin("core_tasks as ct", "ct.id", "rti.task_category_id")
		.leftJoin("core_integrations_platforms as cip", "cip.id", "rti.platform_id")
		.orderBy("g.id")
		.orderBy("rti.id")) as IntegrationGroupRow[];

	const byGroup = new Map<number, IntegrationGroupWithIntegrations>();
	for (const row of rows) {
		const gid = row.group_id;
		if (!byGroup.has(gid)) {
			byGroup.set(gid, { id: gid, name: row.group_name, integrations: [] });
		}
		const group = byGroup.get(gid)!;
		if (withIntegrations && row.integration_task_id != null) {
			group.integrations.push({
				integration_task_id: row.integration_task_id,
				task_category_id: row.task_category_id,
				task_code: row.task_code,
				task_label: row.task_label,
				platform_id: row.platform_id,
				platform_code: row.platform_code,
				platform_label: row.platform_label
			});
		}
	}
	return Array.from(byGroup.values());
}

/**
 * Create a new integration group (Admin only).
 */
export async function createGroup(input: CreateGroupInput): Promise<{ id: number; name: string }> {
	const id = Number(input.id);
	await db(GROUPS_TABLE).insert({ id, name: input.name });
	return { id, name: input.name };
}

/**
 * Update group name (Admin only).
 */
export async function updateGroup(id: number, input: UpdateGroupInput): Promise<{ id: number; name: string }> {
	const numId = Number(id);
	const count = await db(GROUPS_TABLE).where({ id: numId }).update({ name: input.name });
	if (count === 0) throw new CoreApiError("Integration group not found", StatusCodes.NOT_FOUND);
	return { id: numId, name: input.name };
}

/**
 * Delete a group and its associations (Admin only).
 */
export async function deleteGroup(id: number): Promise<{ deleted: number }> {
	const numId = Number(id);
	const count = await db(GROUPS_TABLE).where({ id: numId }).del();
	if (count === 0) throw new Error("Integration group not found");
	return { deleted: numId };
}

/**
 * Add an integration task to a group (Admin only).
 */
export async function addIntegrationToGroup(
	integrationGroup: number,
	integrationTask: number
): Promise<{ integration_group: number; integration_task: number }> {
	const g = Number(integrationGroup);
	const t = Number(integrationTask);
	await db(REL_TABLE).insert({ integration_group: g, integration_task: t });
	return { integration_group: g, integration_task: t };
}

/**
 * Remove an integration task from a group (Admin only).
 */
export async function removeIntegrationFromGroup(
	integrationGroup: number,
	integrationTask: number
): Promise<{ removed: true }> {
	const g = Number(integrationGroup);
	const t = Number(integrationTask);
	const count = await db(REL_TABLE).where({ integration_group: g, integration_task: t }).del();
	if (count === 0) throw new CoreApiError("Association not found", StatusCodes.NOT_FOUND);
	return { removed: true };
}
