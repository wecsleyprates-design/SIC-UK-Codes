import type { UUID } from "crypto";

export type ManualBankingTask = {
	created_at: Date;
	created_by: UUID;
};
