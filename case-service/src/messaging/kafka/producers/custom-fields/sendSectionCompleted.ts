import { UUID } from "crypto";
import { sqlQuery, redis } from "#helpers";
import { triggerSectionCompletedKafkaEventWithRedis } from "#common";
import { CustomFieldUpdateEventsParams } from "./sendCustomFieldUpdateEvents";
import { logger } from "#helpers";

interface SectionCompletedParams extends Pick<CustomFieldUpdateEventsParams, "businessId" | "caseId" | "editedFields"> {
	userId: string;
}

/**
 * Triggers a section completed Kafka event for a custom field update.
 * This notifies downstream services when a custom field section is completed.
 */
export const sendSectionCompleted = async (params: SectionCompletedParams): Promise<void> => {
	const { businessId, caseId, editedFields, userId } = params;

	/** The section name will be the same for any field id, so we can just use the first field id */
	const fieldId = editedFields?.[0]?.field_id;
	const fieldCode = editedFields?.[0]?.field_code;
	if (!fieldId) {
		logger.error(`sendSectionCompleted: caseId: ${caseId}, businessId: ${businessId}, Field ${fieldCode} id not found`);
		return;
	}

	/** Get section name for the custom field and customer id for the case */
	const sql = `
		SELECT dcf.section_name, dc.customer_id
		FROM onboarding_schema.data_business_custom_fields dbcf
		INNER JOIN onboarding_schema.data_custom_fields dcf ON dcf.id = dbcf.field_id
		INNER JOIN data_cases dc ON dc.id = dbcf.case_id
		LEFT JOIN data_businesses db ON db.id = dbcf.business_id
		WHERE dbcf.field_id = $1 AND db.is_deleted = false
		LIMIT 1;
	`;
	const values = [fieldId];

	const { rows } = await sqlQuery<{ section_name: string; customer_id: UUID }>({ sql, values });
	const sectionName = rows?.[0]?.section_name;
	const customerId = rows?.[0]?.customer_id;

	if (!sectionName) {
		logger.error(
			`sendSectionCompleted: caseId: ${caseId}, businessId: ${businessId}, Field ${fieldCode} section name not found. Cannot send section completed event.`
		);
		return;
	}

	if (!customerId) {
		logger.error(`sendSectionCompleted: caseId: ${caseId}, businessId: ${businessId}, Customer ID not found. Cannot send section completed event.`);
		return;
	}
	
	await triggerSectionCompletedKafkaEventWithRedis(
		businessId as UUID,
		sectionName,
		userId as UUID,
		customerId,
		redis
	);
};
