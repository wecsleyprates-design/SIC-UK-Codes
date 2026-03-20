import { z } from "zod";

const messageSchema = z.object({
	role: z.enum(["user", "system", "function", "assistant"]),
	content: z.string()
});

export type ChatMessage = z.infer<typeof messageSchema>;

export const submitUserQueryPayloadSchema = z.object({
	messages: z.array(messageSchema).nonempty(),
	additionalContext: z.string().optional().nullable()
});

export type SubmitUserQueryPayload = z.infer<typeof submitUserQueryPayloadSchema>;

export const schema = {
	submitUserQuery: z.object({
		body: submitUserQueryPayloadSchema
	})
};
