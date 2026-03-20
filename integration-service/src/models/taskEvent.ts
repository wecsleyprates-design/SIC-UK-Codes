import { BaseModel } from "./baseModel";
import { db } from "#helpers/knex";
import type { IBusinessIntegrationTaskEvent } from "#types/db";
import type { Stored } from "#types/eggPattern";
import type { UUID } from "crypto";
import { type TaskStatus } from "#constants";

export type RecordType<T = any> = IBusinessIntegrationTaskEvent<T>;

export class TaskEvent<T = any> extends BaseModel<IBusinessIntegrationTaskEvent<T>> {
	public static readonly TABLE = "business_integrations_tasks_events";
	public static readonly ID_COLUMN = "id";
	public static readonly ERROR_CLASS: ErrorConstructor = Error;

	constructor(record: Stored<RecordType<T>>) {
		super(record);
	}

	/**
	 * Return the most recent events for a task
	 * @param taskID
	 * @param taskStatuses?: Optional TaskStatuses to filter by
	 * @returns
	 */
	static async getEventsForTask<T = any>(taskID: UUID, taskStatuses?: TaskStatus[]) {
		try {
			const query = db<IBusinessIntegrationTaskEvent<T>>(this.TABLE).where("business_integration_task_id", taskID).orderBy("created_at", "desc");
			if (taskStatuses) {
				query.whereIn("task_status", taskStatuses);
			}
			const records = await query;
			if (records) {
				return records.map(record => new this(record as Stored<RecordType<T>>)); // Use "this" to create a new instance
			}
			throw new this.ERROR_CLASS(`No events found for task ${taskID}`); // bubbles down to catch
		} catch (ex) {
			throw new this.ERROR_CLASS(ex instanceof Error ? ex.message : `Could not find record for task ${taskID}`);
		}
	}
}
