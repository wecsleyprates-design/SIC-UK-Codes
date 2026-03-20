import { DLQTOPIC, EVENTS, kafkaEvents, kafkaTopics } from "#constants";
import { validateMessage } from "#middlewares";
import { schema } from "./schema";
import { internalGetCaseByID, logger, producer } from "#helpers";
import { safeJsonParse } from "#utils";
import { MatchUtil } from "#lib/match/matchUtil";
import { kafkaToQueue } from "#messaging";
import { taskQueue } from "#workers/taskHandler";
import { db } from "#helpers/knex";
import type { CompletionEvent } from "#helpers/integrationsCompletionTracker";

export class NotificationEventHandler {
	async handleEvent(message: any) {
		try {
			const payload = JSON.parse(message.value?.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.CASE_UPDATED_AUDIT:
					validateMessage(schema.caseUpdatedAudit, payload);
					await kafkaToQueue(taskQueue, EVENTS.CASE_UPDATED_AUDIT, payload);
					break;
				case kafkaEvents.INTEGRATION_CATEGORY_COMPLETE:
					validateMessage(schema.integrationCategoryComplete, payload);
					await this.handleCategoryCompletion(payload);
					break;
				default:
					break;
			}
		} catch (error) {
			await this.pushToDLQ(error, message);
		}
	}

	async pushToDLQ(error, message) {
		logger.error(error, `Unhandled exception with NotificationEventHandler`);
		const parsedValue = message.value ? safeJsonParse(message.value?.toString()) : message.value;
		const DLQpayload = {
			topic: DLQTOPIC,
			messages: [{ 
				key: message.key?.toString(), 
				value: { 
					event: parsedValue?.event,
					original_event: parsedValue?.event,
					payload: parsedValue,
					kafka_topic: kafkaTopics.NOTIFICATIONS,
					error: safeJsonParse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
				}
			}]
		};
		logger.error(`PUSHING TO DLQ: ${JSON.stringify(DLQpayload)}`);
		await producer.send(DLQpayload);
	}

	async handleApplicationEdit(payload): Promise<void> {
		const { business_id, case_id } = payload;
		const caseDetail = await internalGetCaseByID(case_id);
		const customerID = caseDetail?.customer_id;
		await MatchUtil.runMatchBusiness(customerID, business_id);
	}

	async handleCategoryCompletion(payload: CompletionEvent): Promise<void> {
		const { category_id, business_id, customer_id } = payload;
		// Skip if category_id is "all" - we only track individual category completions
		if (category_id === "all") {
			return;
		}
		try {
			await db("integration_data.data_category_completions_history").insert({
				business_id,
				category_id,
				customer_id: customer_id || null
			});
		} catch (error) {
			throw error;
		}
	}
}

export const notificationEventsHandler = new NotificationEventHandler();
