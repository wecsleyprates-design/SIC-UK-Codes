import { kafkaEvents } from "#constants";
import { db, logger } from "#helpers";
import { validateMessage } from "#middlewares";
import { schema } from "./schema";
import { IntegrationCategoryCompleted } from "./types";

class NotificationEventHandler {
	async handleEvent(message) {
		const payload = JSON.parse(message.value?.toString());
		const event = payload.event || message.key?.toString();
		switch (event) {
			case kafkaEvents.INTEGRATION_CATEGORY_COMPLETE:
				validateMessage(schema.integrationCategoryCompleted, payload);
				await this.handleIntegrationCategoryComplete(payload);
				break;
		}
	}

	async handleIntegrationCategoryComplete(payload: IntegrationCategoryCompleted) {
		try {
			const { business_id, case_id, customer_id, completion_state, category_name } = payload;
			const { tasks_completed, tasks_required, required_tasks, completed_tasks, is_all_complete } = completion_state;

			const values = {
				case_id,
				business_id,
				customer_id: customer_id || null,
				// Only mark complete when category_name is "all"; otherwise force false
				is_complete: category_name === "all" ? is_all_complete || false : false,
				total_tasks: tasks_required || 0,
				completed_tasks: tasks_completed || 0,
				required_tasks_array: JSON.stringify(required_tasks || []),
				completed_tasks_array: JSON.stringify(completed_tasks || [])
			};
			// If category_name is not "all", do NOT overwrite is_complete (preserve prior true).
			if (category_name === "all") {
				await db("data_integration_tasks_progress").insert(values).onConflict("case_id").merge();
			} else {
				await db("data_integration_tasks_progress")
					.insert(values)
					.onConflict("case_id")
					.merge([
						"business_id",
						"customer_id",
						"total_tasks",
						"completed_tasks",
						"required_tasks_array",
						"completed_tasks_array"
					]);
			}
		} catch (error) {
			logger.error({ error }, "Error in handleIntegrationCategoryComplete");
			throw error;
		}
	}
}

export const notificationEventsHandler = new NotificationEventHandler();
