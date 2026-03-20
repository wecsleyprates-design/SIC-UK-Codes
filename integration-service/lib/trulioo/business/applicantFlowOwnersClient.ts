import { getOwnersUnencrypted, type BusinessOwner } from "#helpers/api";
import type { UUID } from "crypto";

/**
 * Service client adapter for applicant-flow owners lookup.
 * Encapsulates external service access from extraction business logic.
 */
export class ApplicantFlowOwnersClient {
	async getOwnersUnencryptedByBusinessId(businessId: UUID): Promise<BusinessOwner[] | null> {
		return getOwnersUnencrypted(businessId);
	}
}
