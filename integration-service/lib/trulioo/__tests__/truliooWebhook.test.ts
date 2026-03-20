import { truliooWebhookEventSchema } from "../trulioo.schema";

describe("Trulioo Webhook Schema", () => {
	it.each([
		["valid payload with all fields", { id: "webhook-123", transactionId: "txn-456", clientId: "business-789", event: { name: "done", type: "step", result: "completed" } }],
		["payload with error field", { id: "webhook-123", transactionId: "txn-456", clientId: "business-789", event: { name: "create", type: "transaction", result: "created" }, error: { code: 1101, message: "Error" } }],
		["payload without optional clientId", { id: "webhook-123", transactionId: "txn-456", event: { name: "decision", type: "transaction", result: "accepted" } }]
	])("should validate %s", (_description, payload) => {
		expect(truliooWebhookEventSchema.safeParse(payload).success).toBe(true);
	});

	it("should reject invalid payload (missing required fields)", () => {
		const invalidPayload = { id: "webhook-123", event: { name: "done" } };
		expect(truliooWebhookEventSchema.safeParse(invalidPayload).success).toBe(false);
	});
});
