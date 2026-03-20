import { z } from "zod";

const insightsReportSchema = z.object({
	impactOfCompanyProfileScore: z.string().describe("The impact of the company profile on the business"),
	actionItemsForCompanyProfile: z.array(z.string()).describe("The action items for the company profile"),
	impactOfFinancialTrendsScore: z.string().describe("The impact of the financial trends on the business"),
	actionItemsForFinancialTrends: z.array(z.string()).describe("The action items for the financial trends"),
	impactOfLiquidityScore: z.string().describe("The impact of the liquidity on the business"),
	actionItemsForLiquidity: z.array(z.string()).describe("The action items for the liquidity"),
	impactOfPublicRecordsScore: z.string().describe("The impact of the public records on the business"),
	actionItemsForPublicRecords: z.array(z.string()).describe("The action items for the public records"),
	impactOfBaseScore: z.string().describe("The impact of the base on the business"),
	actionItemsForBase: z.array(z.string()).describe("The action items for the base score"),
	impactOfWorthScore: z.string().describe("The impact of the worth score on the business"),
	actionItemsForWorth: z.array(z.string()).describe("The action items for the worth score")
});

const insightsReportResponseSchema = z.object({
	reportBreakDown: insightsReportSchema,
	summary: z.string(),
	// questions that the user should ask
	suggestedQuestions: z.array(z.string())
});

export type InsightsReportResponse = z.infer<typeof insightsReportResponseSchema>;

const caseIdParams = z.object({
	caseId: z
		.string({
			required_error: "Case ID is required"
		})
		.uuid()
});

export type CaseIdParams = z.infer<typeof caseIdParams>;

const actionItemIdParams = z.object({
	actionItemId: z
		.string({
			required_error: "Action Item ID is required"
		})
		.uuid()
});

export type ActionItemIdParams = z.infer<typeof actionItemIdParams>;

const actionItemSchema = z.object({
	id: z.string().uuid(),
	external_id: z.string().uuid(),
	action_item: z.string(),
	is_complete: z.boolean(),
	created_at: z.string().datetime(),
	updated_at: z.string().datetime()
});

export type ActionItem = z.infer<typeof actionItemSchema>;

const messageSchema = z.object({
	role: z.enum(["user", "system", "function", "assistant"]),
	content: z.string()
});

export type ChatMessage = z.infer<typeof messageSchema>;

export const submitUserQueryPayloadSchema = z.object({
	messages: z.array(messageSchema).nonempty(),
	reportSummary: z.string().optional(),
	additionalContext: z.string().optional(),
	impactOfCompanyProfileScore: z.string().optional(),
	actionItemsForCompanyProfile: z.array(z.string()).optional(),
	impactOfFinancialTrendsScore: z.string().optional(),
	actionItemsForFinancialTrends: z.array(z.string()).optional(),
	impactOfLiquidityScore: z.string().optional(),
	actionItemsForLiquidity: z.array(z.string()).optional(),
	impactOfPublicRecordsScore: z.string().optional(),
	actionItemsForPublicRecords: z.array(z.string()).optional(),
	impactOfBaseScore: z.string().optional(),
	actionItemsForBase: z.array(z.string()).optional(),
	impactOfWorthScore: z.string().optional(),
	actionItemsForWorth: z.array(z.string()).optional()
});

export type SubmitUserQueryPayload = z.infer<typeof submitUserQueryPayloadSchema>;

export const schema = {
	getInsightsReport: z.object({
		params: caseIdParams
	}),
	submitUserQuery: z.object({
		body: submitUserQueryPayloadSchema
	}),
	getActionItems: z.object({
		params: caseIdParams
	}),
	updateActionItem: z.object({
		params: actionItemIdParams,
		body: z.object({
			isCompleted: z.boolean()
		})
	}),
	deleteActionItems: z.object({
		params: caseIdParams,
		body: z.object({
			actionItemIds: z.array(z.string())
		})
	}),
	createActionItem: z.object({
		params: caseIdParams,
		body: z.object({
			actionItem: z.string()
		})
	})
};
