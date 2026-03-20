import type { PaginationOptions, Stored } from "#types/eggPattern";
import type { UUID } from "crypto";
import { BaseModel } from "./baseModel";
import { Tasks } from "./tasks";
import type { IBusinessIntegrationTask } from "#types/db";

export type RecordType = {
	id: UUID;
	business_id: UUID;
	score_trigger_id: UUID;
	created_at: Date;
};

export class Cases extends BaseModel<RecordType> {
	public static readonly TABLE = "data_cases";
	public static readonly ID_COLUMN = "id";
	public static readonly ERROR_CLASS = Error;
	private static readonly DEFAULT_PAGINATION_OPTIONS: PaginationOptions<RecordType> = { page: 1, orderBy: "created_at", orderDirection: "desc" };

	constructor(record: Stored<RecordType>) {
		super(record);
	}

	async getTasks(paginationOptions: PaginationOptions<IBusinessIntegrationTask> = { page: 1, orderBy: "created_at", orderDirection: "desc" }) {
		if (this.record.score_trigger_id) {
			return Tasks.findByField(
				{
					business_score_trigger_id: this.record.score_trigger_id
				},
				paginationOptions
			);
		}
	}
}
