import { sendCustomFieldAudit } from "./sendCustomFieldAudit";
import { sendApplicationEdit } from "./sendApplicationEdit";
import { sendSectionCompleted } from "./sendSectionCompleted";
import { WEBHOOK_EVENTS } from "#constants";
import { sendEventToGatherWebhookData } from "#common";
import { UUID } from "crypto";
import { resolveApplicantIdForAudit } from "#helpers";

export interface CustomFieldUpdateEventsParams {
	businessId: string;
	customerId: string;
	caseId: string;
	editedFields: { field_id: string; field_code: string; field_label: string; old_value: string | null; new_value: string }[];
	userInfo: {
		user_id: string;
		is_guest_owner?: boolean;
		issued_for?: { user_id: string; first_name?: string; last_name?: string };
	};
	cachedApplicationEditInvite?: { applicantID: string | UUID } | null;
}

/**
 * Orchestrator function that triggers all Kafka events after custom fields are updated.
 * Coordinates webhook notifications, audit logging, application edit tracking, and section completion events.
 */
export const sendCustomFieldUpdateEvents = async (params: CustomFieldUpdateEventsParams): Promise<void> => {
	const { businessId, customerId, caseId, editedFields, userInfo, cachedApplicationEditInvite } = params;
	const userId = resolveApplicantIdForAudit({ userInfo, cachedApplicationEditInvite });
	const userName = `${userInfo?.issued_for?.first_name ?? ""} ${userInfo?.issued_for?.last_name ?? ""}`.trim();

	const eventPromises: Promise<void>[] = [
		/** Send webhook event for business update */
		sendEventToGatherWebhookData([WEBHOOK_EVENTS.BUSINESS_UPDATED], { business_id: businessId }),
		/** Send audit event for custom field changes */
		sendCustomFieldAudit({ businessId, caseId, userId, userName, editedFields })
	];

	// Only send application-edit event for guest owners when we have changes and a resolved applicant
	// (userId can be undefined when resolveApplicantIdForAudit has no issued_for; sendApplicationEdit requires a string)
	if (userInfo?.is_guest_owner && editedFields.length > 0 && userId !== undefined) {
		eventPromises.push(sendApplicationEdit({ businessId, caseId, customerId, userId, userName, editedFields }));
	} else if (userInfo && !userInfo.is_guest_owner && userInfo.user_id) {
		/** Trigger section completed event for non-guest owner changes */
		eventPromises.push(sendSectionCompleted({ businessId, caseId, editedFields, userId: userInfo.user_id }));
	}

	await Promise.all(eventPromises);
};
