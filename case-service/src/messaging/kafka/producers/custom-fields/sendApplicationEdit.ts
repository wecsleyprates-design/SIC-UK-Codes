import { UUID } from "crypto";
import { applicationEdit } from "../../../../api/v1/modules/application-edits/application-edit";
import { CustomFieldUpdateEventsParams } from "./sendCustomFieldUpdateEvents";

interface ApplicationEditParams extends Pick<CustomFieldUpdateEventsParams, 'businessId' | 'caseId' | 'editedFields'> {
	userName: string;
	customerId: string;
	userId: string;
}

/**
 * Tracks custom field changes as application edits for guest owner users.
 * This creates an audit trail of applicant-initiated field changes.
 */
export const sendApplicationEdit = async (params: ApplicationEditParams): Promise<void> => {
	const { businessId, caseId, customerId, userId, userName, editedFields } = params;

	await applicationEdit.editApplication(
		{ businessID: businessId as UUID },
		{
			case_id: caseId as UUID,
			customer_id: customerId as UUID,
			stage_name: "custom_fields",
			user_name: userName,
			created_by: userId as UUID,
			data: editedFields.map(field => ({
				field_name: field.field_code,
				old_value: field.old_value,
				new_value: field.new_value
			}))
		}
	);
};
