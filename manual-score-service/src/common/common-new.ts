import { FEATURE_FLAGS, kafkaEvents, kafkaTopics } from "#constants/index";
import { producer, getFlagValue } from "#helpers/index";

interface SendWebhookMessagePayload {
	event_code: string;
	customer_id: string;
	data: object;
}

export const sendWebhookEvent = async (customerID: string, event: string, data: object) => {
	const sendWebhookEventFlag = await getFlagValue(FEATURE_FLAGS.WIN_1223_SEND_WEBHOOK_EVENTS);

	if (sendWebhookEventFlag) {
		const message: SendWebhookMessagePayload = {
			event_code: event,
			customer_id: customerID,
			data
		};

		await producer.send({
			topic: kafkaTopics.WEBHOOKS,
			messages: [{
				key: customerID,
				value: {
					event: kafkaEvents.SEND_WEBHOOK,
					...message
				}
			}]
		});
	}
};
