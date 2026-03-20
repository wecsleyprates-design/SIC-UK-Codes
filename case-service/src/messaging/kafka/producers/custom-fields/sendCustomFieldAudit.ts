import { kafkaTopics, kafkaEvents } from "#constants";
import { producer } from "#helpers";
import { CustomFieldUpdateEventsParams } from "./sendCustomFieldUpdateEvents";

interface CustomFieldAuditParams {
	businessId: string;
	caseId: string;
	userName: string;
	customerId?: string;
	/**
	 * The user ID of the user who initiated the custom field update.
	 * This can be an applicant ID, guest owner ID, or other user ID.
	 */
	userId?: string;
	editedFields: CustomFieldUpdateEventsParams["editedFields"];
}

/**
 * Sends a Kafka audit event to track custom field changes.
 * This event is consumed by the notifications service to log field modifications.
 */
export const sendCustomFieldAudit = async (params: CustomFieldAuditParams): Promise<void> => {
	const { businessId, caseId, customerId, userId, userName, editedFields } = params;

	await producer.send({
		topic: kafkaTopics.NOTIFICATIONS,
		messages: [
			{
				key: businessId,
				value: {
					event: kafkaEvents.CUSTOM_FIELDS_UPDATED_AUDIT,
					case_id: caseId,
					business_id: businessId,
					customer_id: customerId,
					user_id: userId,
					user_name: userName,
					data: editedFields.map(field => ({
						field_label: field.field_label,
						old_value: field.old_value,
						new_value: field.new_value
					}))
				}
			}
		]
	});
};
