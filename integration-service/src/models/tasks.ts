import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import type { IBusinessIntegrationTask, IBusinessIntegrationTaskEnriched } from "#types/db";
import type { Stored } from "#types/eggPattern";
import { BaseModel } from "./baseModel";

export type RecordType<T = any> = IBusinessIntegrationTask<T>;

export class Tasks<T = any> extends BaseModel<IBusinessIntegrationTask<T>> {
	public static readonly TABLE = "data_business_integrations_tasks";
	public static readonly ID_COLUMN = "id";
	public static readonly ERROR_CLASS = Error;

	constructor(record: Stored<RecordType<T>>) {
		super(record);
	}

	public async enrich(): Promise<IBusinessIntegrationTaskEnriched<T> | undefined> {
		const record = this.toApiResponse();
		if (!record.id) {
			return undefined;
		}
		return TaskManager.getEnrichedTask(record.id);
	}
}
