import type { UUID } from "crypto";

export interface SellerSearchJobBody {
	business_id: UUID;
	connection_id: UUID;
	business_task_id: UUID;
	type: "DELAY_SEARCH" | "RETRY_SEARCH";
}

export interface SellerNotFoundJobBody {
	name?: string;
	name_dba?: string;
	address_line_1?: string;
	city?: string;
	state?: string;
	zip5?: string;
	ein?: string;
	case_id?: string | UUID;
	business_id: UUID;
	connection_id: UUID;
	business_task_id: UUID;
	customer_id?: UUID;
}

export interface JobTask {
	id: string;
	type: string;
	payload: any;
	customerId?: string;
	businessId?: string;
	taskId?: string; // Optional task ID for status tracking
	priority?: string; // Job priority
}

export interface JobConfig {
	jobType: string;
	payload?: any;
	customerId?: string;
	businessId?: string;
	requestId?: string;
	taskId?: string;
	priority?: string;
}

export const JOB_STATUS = {
	PENDING: "pending",
	RUNNING: "running", 
	COMPLETED: "completed",
	FAILED: "failed",
	CANCELLED: "cancelled"
} as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];