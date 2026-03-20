import { kafkaEvents } from "#constants/index";
import { sqlQuery } from "#helpers/index";
import { validateMessage } from "#middlewares/index";
import { schema } from "./schema";

class UserEventsHandler {
	async handleEvent(message) {
		try {
			const payload = JSON.parse(message.value.toString());
			const event = payload.event || message.key?.toString();
			switch (event) {
				case kafkaEvents.CUSTOMER_CREATED:
					validateMessage(schema.customerCreated, payload);
					await this.setCustomerScoreConfig(payload);
					break;

				default:
					break;
			}
		} catch (error) {
			throw error;
		}
	}

	async setCustomerScoreConfig({ customer_id: customerID }) {
		try {
			// check if customer already has a score configuration
			const getCustomerScoreConfigQuery = `SELECT * FROM score_decision_matrix WHERE customer_id = $1`;
			const customerScoreConfig = await sqlQuery({ sql: getCustomerScoreConfigQuery, values: [customerID] });

			if (customerScoreConfig.length) {
				return { message: "Score configuration already exists" };
			}

			const insertCustomerScoreConfigQuery = `INSERT INTO score_decision_matrix (customer_id, range_start, range_end, risk_level, decision)
			SELECT $1 AS customer_id, range_start, range_end, risk_level, decision FROM score_decision_matrix WHERE customer_id IS NULL RETURNING *`;

			const response = await sqlQuery({ sql: insertCustomerScoreConfigQuery, values: [customerID] });

			return response;
		} catch (error) {
			throw error;
		}
	}
}

export const userEventsHandler = new UserEventsHandler();
