/** Helpers for Cases */

import { SCORE_TRIGGER } from "#constants";
import { db } from "#helpers/knex";
import type { BusinessScoreTrigger } from "#types";
import type { UUID } from "crypto";
type Case = {
	id: UUID | string;
	business_id: UUID;
	score_trigger_id: UUID;
	created_at: Date;
};

/**
 * Get a case by its id
 * @param caseId
 * @returns Case --- throws if not found
 */
export const getCase = async (caseId: UUID | string): Promise<Case> => {
	const theCase = await db<Case>("public.data_cases").select("*").where({ id: caseId }).first();
	if (theCase) {
		return theCase;
	}
	throw new Error(`Case ${caseId} not found`);
};

/**
 * Get a case's created_at date
 * @param caseId
 * @returns -- throws if not found
 */
export const getCaseCreatedAt = async (caseId: UUID | string): Promise<Date> => {
	const theCase = await getCase(caseId);
	return theCase.created_at;
};

export const getOnboardingCaseByBusinessId = async (businessId: UUID, customerID?: UUID): Promise<Case> => {
	const theCase = await db<Case>("public.data_cases")
		.join("integrations.business_score_triggers", "business_score_triggers.id", "data_cases.score_trigger_id")
		.select("data_cases.*")
		.where({
			"data_cases.business_id": businessId,
			"business_score_triggers.trigger_type": SCORE_TRIGGER.ONBOARDING_INVITE,
			...(customerID && { "business_score_triggers.customer_id": customerID })
		})
		.orderBy("data_cases.created_at", "desc")
		.first();
	if (theCase) {
		return theCase;
	}
	throw new Error(`Onboarding case for business ${businessId} not found`);
};
