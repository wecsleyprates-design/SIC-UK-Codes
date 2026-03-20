// imports here if needed
import { type UUID } from "crypto";

// TODO: This is not final payload interface may change as code progresses
export interface I360Report {
    report_id: UUID;
	business_id: UUID;
	case_id: UUID;
	score_trigger_id: UUID;
	customer_id: UUID;
}