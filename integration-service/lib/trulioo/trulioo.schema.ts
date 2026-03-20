import { z } from "zod";

/**
 * Trulioo webhook URL verification handshake schema
 * Docs: https://developer.trulioo.com/reference/sendevent
 * 
 * Note: Using .passthrough() to allow additional fields in handshake payloads
 */
export const truliooWebhookHandshakeSchema = z.object({
	type: z.literal("URL_VERIFICATION"),
	challenge: z.string(),
	token: z.string().optional() // Token may not always be present
}).passthrough();

/**
 * Trulioo webhook event schema (standard verification events)
 * Docs: https://docs.verification.trulioo.com/sdk/webhook/index.html
 * 
 * This schema handles the standard verification webhook events with:
 * - id, transactionId (required)
 * - clientId, event, error (optional)
 */
export const truliooWebhookEventSchema = z.object({
	// Required fields (core webhook identification)
	id: z.string(),
	transactionId: z.string(),
	
	// Optional fields that may or may not be present
	clientId: z.string().optional(),
	
	// Event object - completely flexible to handle any structure Trulioo sends
	event: z
		.object({
			name: z.string().optional(),
			type: z.string().optional(),
			result: z.string().optional()
		})
		.passthrough() // Allow any additional fields in event object
		.optional(),
	
	// Error object - completely flexible to handle any error structure
	error: z
		.object({
			code: z.union([z.number(), z.string()]).optional(), // Some APIs use string codes
			message: z.string().optional()
		})
		.passthrough() // Allow any additional fields in error object
		.optional()
})
.passthrough(); // Allow any additional fields at root level

/**
 * Trulioo EVENT_CALLBACK webhook schema
 * 
 * This schema handles EVENT_CALLBACK type webhooks that have a different structure:
 * - type: "EVENT_CALLBACK"
 * - id: flow/user identifier
 * - event: contains event details (ts, type, user)
 * - flowId, token, userId, retry, test: additional fields
 * 
 * Example payload from DEV:
 * {
 *   "type": "EVENT_CALLBACK",
 *   "id": "6929ad152d00003b006a83e1",
 *   "event": { "ts": 1764339028, "type": "FLOW_END", "user": "..." },
 *   "flowId": "...",
 *   "token": "...",
 *   "userId": "...",
 *   "retry": 0,
 *   "test": false
 * }
 */
export const truliooEventCallbackSchema = z.object({
	type: z.literal("EVENT_CALLBACK"),
	id: z.string(),
	event: z
		.object({
			ts: z.number().optional(),
			type: z.string().optional(),
			user: z.string().optional()
		})
		.passthrough() // Allow any additional fields in event object
		.optional(),
	flowId: z.string().optional(),
	token: z.string().optional(),
	userId: z.string().optional(),
	retry: z.number().optional(),
	test: z.boolean().optional()
})
.passthrough(); // Allow any additional fields at root level

/**
 * Combined schema that accepts:
 * 1. URL verification handshake
 * 2. Standard verification webhook events
 * 3. EVENT_CALLBACK webhooks
 * 
 * Note: Using .passthrough() to allow additional fields that Trulioo may send
 * but we don't need to validate, ensuring compatibility with future API changes
 * and real webhook payloads that may include undocumented fields.
 */
export const truliooWebhookSchema = z.union([
	truliooWebhookHandshakeSchema,
	truliooWebhookEventSchema,
	truliooEventCallbackSchema
]);

export type TruliooWebhookHandshake = z.infer<typeof truliooWebhookHandshakeSchema>;
export type TruliooWebhookEvent = z.infer<typeof truliooWebhookEventSchema>;
export type TruliooWebhook = z.infer<typeof truliooWebhookSchema>;
