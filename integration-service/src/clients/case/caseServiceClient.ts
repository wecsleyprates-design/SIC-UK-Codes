import axios from "axios";
import type { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { envConfig } from "#configs/index";
import { ERROR_CODES } from "#constants/index";
import { logger } from "#helpers/index";
import { InternalApiError } from "#helpers/api";

/**
 * Structured client for case-service internal API calls.
 *
 * Replaces ad-hoc helper functions in helpers/api.ts with a proper
 * service-client following the three-layer architecture pattern.
 */
export class CaseServiceClient {
	private readonly baseUrl: string;

	constructor() {
		this.baseUrl = envConfig.CASE_BASE_URL ?? "";
	}

	/** Get cases for a business, most-recently-created first */
	async getCasesByBusinessId(businessId: UUID): Promise<CaseStatusDetails[]> {
		const url = `${this.baseUrl}/api/v1/internal/businesses/${businessId}/cases`;
		try {
			const response = await axios.get(url, {
				headers: { "Content-Type": "application/json" }
			});
			const { data } = response.data;
			return data.records as CaseStatusDetails[];
		} catch (error) {
			logger.error({
				message: `CaseServiceClient: Failed to get cases for business ${businessId}`,
				error
			});
			throw new InternalApiError(
				`CaseServiceClient.getCasesByBusinessId: Failed for business ${businessId}`,
				StatusCodes.INTERNAL_SERVER_ERROR,
				ERROR_CODES.UNKNOWN_ERROR
			);
		}
	}
}

export type CaseStatusDetails = {
	id: UUID;
	applicant_id: UUID;
	created_at: string;
	business_name: string;
	status_label: string;
	case_type: number;
	applicant: {
		first_name: string;
		last_name: string;
	};
	status: {
		id: number;
		code: string;
		label: string;
	};
};
