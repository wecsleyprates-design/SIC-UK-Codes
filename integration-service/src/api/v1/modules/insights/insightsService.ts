import { createOpenAIWithLogging } from "#utils"
import type { ChatCompletionCreateParams } from "openai/resources/chat";

import { CaseIdParams, InsightsReportResponse, SubmitUserQueryPayload, ActionItem, ActionItemIdParams } from "./schema";
import { InsightsApiError } from "./error";
import { ERROR_CODES } from "#constants";
import { getCaseDetails, logger } from "#helpers";
import { envConfig } from "#configs/index";
import { StatusCodes } from "http-status-codes";
import { isNonEmptyArray, isNotNil } from "@austinburns/type-guards";
import { sqlQuery } from "#helpers/index";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { isNonEmptyString } from "@austinburns/type-guards";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { match } from "ts-pattern";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import { OPENAI_MODEL_VERSION } from "#lib/aiEnrichment/constants";

const openai = createOpenAIWithLogging({
		apiKey: envConfig.OPEN_AI_KEY,
		maxRetries: 3,
		timeout: 120 * 1000 // 120s
	},
	logger
);

// Extend dayjs with the utc plugin
dayjs.extend(utc);

const functions: ChatCompletionCreateParams.Function[] = [
	{
		name: "generate_insights_report",
		description: "Generates insights report",
		parameters: {
			type: "object",
			properties: {
				reportBreakDown: {
					type: "object",
					description: "JSON object containing all the scores and action items for the report",
					properties: {
						impactOfCompanyProfileScore: { type: "string", nullable: false },
						actionItemsForCompanyProfile: { type: "array", items: { type: "string" }, nullable: false },
						impactOfFinancialTrendsScore: { type: "string", nullable: false },
						actionItemsForFinancialTrends: { type: "array", items: { type: "string" }, nullable: false },
						impactOfPublicRecordsScore: { type: "string", nullable: false },
						actionItemsForPublicRecords: { type: "array", items: { type: "string" }, nullable: false },
						impactOfWorthScore: { type: "string", nullable: false },
						actionItemsForWorthScore: { type: "array", items: { type: "string" }, nullable: false }
					}
				},
				summary: { type: "string", description: "A brief summary of the report. The summary should provide a high level overview of the business's health based on the scores and action items." },
				suggestedQuestions: { type: "array", items: { type: "string" }, description: "An array of suggested questions the user should ask based on the report breakdown and summary." }
			},
			required: ["reportBreakDown", "summary", "suggestedQuestions"]
		}
	}
];

// Instantiate the model
const model = new ChatOpenAI({
	temperature: 0,
	modelName: OPENAI_MODEL_VERSION,
	openAIApiKey: envConfig.OPEN_AI_KEY,
	callbacks: [
		{
			handleLLMEnd(output) {
				if (output?.llmOutput) {
					logger.info(`insights assistant completionTokens: ${output.llmOutput?.tokenUsage?.completionTokens}`);
					logger.info(`insights assistant promptTokens: ${output.llmOutput?.tokenUsage?.promptTokens}`);
					logger.info(`insights assistant totalTokens: ${output.llmOutput?.tokenUsage?.totalTokens}`);
				}
			}
		}
	]
});

class InsightsService {
	getSuggestedActionItems(insightsReport: InsightsReportResponse) {
		const extractedActionItems: string[] = [];
		if (isNonEmptyArray(insightsReport.reportBreakDown.actionItemsForCompanyProfile)) {
			const actionItemsForCompanyProfile = insightsReport.reportBreakDown.actionItemsForCompanyProfile;
			logger.info(`extracted ${actionItemsForCompanyProfile.length} items from actionItemsForCompanyProfile: ${JSON.stringify(actionItemsForCompanyProfile)}`);
			extractedActionItems.push(...actionItemsForCompanyProfile);
		}
		if (isNonEmptyArray(insightsReport.reportBreakDown.actionItemsForFinancialTrends)) {
			const actionItemsForFinancialTrends = insightsReport.reportBreakDown.actionItemsForFinancialTrends;
			logger.info(`extracted ${actionItemsForFinancialTrends.length} items from actionItemsForFinancialTrends: ${JSON.stringify(actionItemsForFinancialTrends)}`);
			extractedActionItems.push(...actionItemsForFinancialTrends);
		}
		if (isNonEmptyArray(insightsReport.reportBreakDown.actionItemsForPublicRecords)) {
			const actionItemsForPublicRecords = insightsReport.reportBreakDown.actionItemsForPublicRecords;
			logger.info(`extracted ${actionItemsForPublicRecords.length} items from actionItemsForPublicRecords: ${JSON.stringify(actionItemsForPublicRecords)}`);
			extractedActionItems.push(...actionItemsForPublicRecords);
		}
		if (isNonEmptyArray(insightsReport.reportBreakDown.actionItemsForWorth)) {
			const actionItemsForWorth = insightsReport.reportBreakDown.actionItemsForWorth;
			logger.info(`extracted ${actionItemsForWorth.length} items from actionItemsForWorth: ${JSON.stringify(actionItemsForWorth)}`);
			extractedActionItems.push(...actionItemsForWorth);
		}
		logger.info(`extracted ${extractedActionItems.length} suggested action items from insightsReport: ${JSON.stringify(extractedActionItems, null, 1)}`);
		return extractedActionItems;
	}

	async optionallyAddActionItemsToDatabase(suggestedActionItems: string[], caseId: string) {
		try {
			const getActionItems = `SELECT * FROM integration_data.insights_action_items WHERE external_id = $1`;
			const result = await sqlQuery({ sql: getActionItems, values: [caseId] });
			logger.info(`${result.rows.length} Action items found for case id a.k.a. external_id: ${caseId}`);
			let existingActionItems: string[] = [];
			if (isNonEmptyArray(result.rows)) {
				const rowsFromDatabase = result.rows as unknown as ActionItem[];
				const actionItemsFromDatabase = rowsFromDatabase.map(row => row.action_item);
				logger.info(`existing action items: ${JSON.stringify(actionItemsFromDatabase, null, 1)}`);
				existingActionItems = actionItemsFromDatabase;
			}

			const response = await openai.chat.completions.create({
				model: OPENAI_MODEL_VERSION,
				// model: "gpt-3.5-turbo",
				stream: false,
				functions: [
					{
						name: "identify_unique_action_items",
						description: "Identify a list of unique action items that are not already in the database",
						parameters: {
							type: "object",
							properties: { uniqueActionItems: { type: "array", items: { type: "string" }, description: "A list of unique action items that are not already in the database" } },
							required: ["uniqueActionItems"]
						}
					}
				],
				messages: [
					{
						role: "system",
						content: `
						### Mission:
						Provided with a list of [existingActionItems] and a list of [suggestedActionItems],
						identify unique action items that are not already present in the [existingActionItems] list.
						It's okay if there's some slight differences in the action items.

						For example:
						- Asking the user to connect their account is not the same as asking them to work on their social reputation.
						- Telling the user to expand market presense is not the same as telling them to monitor their cashflow status.

						You will identify [uniqueActionItems]

						Take your time to compare each entry

						### Incoming Data
						Here's the existing action items:
						[existingActionItems]:
						"""
						${JSON.stringify(existingActionItems, null, 1)}
						"""

						Here's the new suggested action items:
						[suggestedActionItems]:
						"""
						${JSON.stringify(suggestedActionItems, null, 1)}
						"""

						### Output
						Here's the list of unique action items you've identified:
						[uniqueActionItems]:
						`
					},
					{ role: "user", content: "help me identify unique action items" }
				]
			});

			const parsedResponse = response?.choices[0]?.message?.function_call?.arguments ? JSON.parse(response?.choices[0]?.message?.function_call?.arguments) : { uniqueActionItems: [] };
			const uniqueActionItems = parsedResponse.uniqueActionItems as string[];
			logger.info(`unique action items: ${JSON.stringify(uniqueActionItems, null, 1)}`);
			if (isNonEmptyArray(uniqueActionItems)) {
				logger.info(`adding ${uniqueActionItems.length} unique action items to database for case id a.k.a. external_id: ${caseId}`);
				// Construct the bulk insert query
				const values = uniqueActionItems.map((_, index) => `($1, $${index + 2})`).join(", ");
				const sql = `INSERT INTO integration_data.insights_action_items (external_id, action_item) VALUES ${values}`;
				const params = [caseId, ...uniqueActionItems];

				await sqlQuery({ sql, values: params });
			}
		} catch (error: any) {
			throw new InsightsApiError(`optionallyAddActionItemsToDatabase: ${error?.message ?? "Failure to get dedupe and add action items"}`, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async getActionItems({ caseId }: CaseIdParams) {
		try {
			const getActionItems = `SELECT * FROM integration_data.insights_action_items WHERE external_id = $1`;
			const result = await sqlQuery({ sql: getActionItems, values: [caseId] });
			logger.info(`retreiving ${result.rows.length} action items for case id a.k.a. external_id: ${caseId}`);
			return result.rows;
		} catch (error: any) {
			throw new InsightsApiError(`getActionItems: ${error?.message ?? "Failure to get action items"}`, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async updateActionItem({ actionItemId }: ActionItemIdParams, { isCompleted }: { isCompleted: boolean }) {
		try {
			const updateActionItem = `UPDATE integration_data.insights_action_items SET is_complete = $1, updated_at = NOW() AT TIME ZONE 'UTC' WHERE id = $2`;
			logger.info(`updating action item with id: ${actionItemId} —> is_complete: ${isCompleted}`);
			await sqlQuery({ sql: updateActionItem, values: [isCompleted, actionItemId] });
		} catch (error: any) {
			throw new InsightsApiError(`updateActionItem: ${error?.message ?? "Failure to update action item"}`, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async deleteActionItems({ caseId }: CaseIdParams, { actionItemIds }: { actionItemIds: string[] }) {
		try {
			const deleteActionItems = `DELETE FROM integration_data.insights_action_items WHERE external_id = $1 AND id = ANY($2)`;
			logger.info(`deleting action items with ids: ${actionItemIds.map(id => `${id}`).join(", ")} for case id a.k.a. external_id: ${caseId}`);
			await sqlQuery({ sql: deleteActionItems, values: [caseId, actionItemIds] });
		} catch (error: any) {
			throw new InsightsApiError(`deleteActionItems: ${error?.message ?? "Failure to delete action items"}`, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async createActionItem({ caseId }: CaseIdParams, { actionItem }: { actionItem: string }) {
		try {
			const createActionItem = `INSERT INTO integration_data.insights_action_items (external_id, action_item) VALUES ($1, $2) RETURNING *`;
			logger.info(`creating action item: (${actionItem}) —> for case id a.k.a. external_id: ${caseId}`);
			const result = await sqlQuery({ sql: createActionItem, values: [caseId, actionItem] });
			logger.info(`created action item: ${JSON.stringify(result, null, 1)}`);
			return result.rows[0];
		} catch (error: any) {
			throw new InsightsApiError(`createActionItem: ${error?.message ?? "Failure to create action item"}`, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async ensureReportStructure(reportData) {
		const defaultStructure = {
			summary: "",
			reportBreakDown: {
				impactOfWorthScore: "",
				actionItemsForWorthScore: [],
				impactOfPublicRecordsScore: "",
				actionItemsForPublicRecords: [],
				impactOfCompanyProfileScore: "",
				actionItemsForCompanyProfile: [],
				impactOfFinancialTrendsScore: "",
				actionItemsForFinancialTrends: []
			},
			suggestedQuestions: []
		};

		const keysToMove = [
			"impactOfWorthScore",
			"actionItemsForWorthScore",
			"impactOfPublicRecordsScore",
			"actionItemsForPublicRecords",
			"impactOfCompanyProfileScore",
			"actionItemsForCompanyProfile",
			"impactOfFinancialTrendsScore",
			"actionItemsForFinancialTrends"
		];

		// Ensure reportBreakDown exists in reportData
		const reportBreakDown = reportData.reportBreakDown || {};

		// Move keys if they exist outside of reportBreakDown
		keysToMove.forEach(key => {
			if (key in reportData) {
				reportBreakDown[key] = reportData[key];
				delete reportData[key];
			}
		});

		// Merge with defaultStructure to fill any remaining missing properties
		const normalizedReport = { ...defaultStructure, ...reportData, reportBreakDown: { ...defaultStructure.reportBreakDown, ...reportBreakDown } };
		return normalizedReport;
	}

	async getInsightsReport({ caseId }: CaseIdParams, authorization: string) {
		try {
			logger.info(`incoming case id for generating insights report: ${caseId}`);

			const getMostRecentReport = `SELECT * FROM integration_data.insights_report WHERE external_id = $1 ORDER BY created_at DESC LIMIT 1`;

			const result = await sqlQuery({ sql: getMostRecentReport, values: [caseId] });

			if (isNonEmptyArray(result.rows)) {
				const mostRecentReport = result.rows[0] as unknown as { report_data: InsightsReportResponse; created_at: string };
				const reportTime = dayjs(mostRecentReport.created_at).utc();
				logger.info(`reportTime: ${reportTime}`);
				const currentTime = dayjs().utc();
				logger.info(`currentTime: ${currentTime}`);
				const timeDifference = currentTime.diff(reportTime, "weeks");

				// if the mostRecentReport is less than 1 week old, return it
				if (timeDifference < 1) {
					logger.info(`found most recent report for case id a.k.a. external_id: ${caseId}`);
					logger.info(`most recent report: ${JSON.stringify(mostRecentReport, null, 1)}`);
					return mostRecentReport.report_data;
				} else {
					logger.info(`No recent report found for case id a.k.a. external_id: ${caseId}`);
				}
			}

			const { data: caseData } = await getCaseDetails(caseId, authorization);

			const response = await openai.chat.completions.create({
				model: OPENAI_MODEL_VERSION,
				// model: "gpt-3.5-turbo",
				stream: false,
				functions,
				messages: [
					{
						role: "system",
						content: `You are an expert generating insights reports for a business.

						### Mission
						- help the user understand the impact of the Company Profile on the business
						- suggest action items for the Company Profile
						- help the user understand the impact of the Financial Trends on the business
						- suggest action items for the Financial Trends
						- help the user understand the impact of the Public Records on the business
						- suggest action items for the Public Records
						- help the user understand the impact of the Worth score on the business
						- suggest action items for the Worth score
						- suggest questions the user should ask

						### Rules
						- Use the category definitions below to understand the impact and action items for each category.
							- When explaining relative impact, we want to explain things in terms that are easier for a non-technical person to understand.
						- Use the Category Definitions and Impact below to understand the impact of each category on the business.
						- Because the category scores are no longer confined to a positive percentage weight but a straight sum, they can be positive or negative.
							- Positive will always push the score up, and negative down.
						- We've move away from the weighted value out of 100% as the driver of these category breakdowns.
							- It's more on the raw value itself like, for example:
								- “Public Records pushed up your Worth Score by 47 points, a substantial positive impact”
						- Use the available [case_data] to inform the impact signifance and action items of each category.
						- Make sure that explanation for impact is clear and understandable.
							- It shouldn't be more than 2 to 3 sentences long.
						- Make sure that the action items are clear and understandable.
							- It shouldn't be more than 1 sentence and make sure it's concise and actionable.
							- Not everything will require an action item and that's okay.
							- Where action items are applicable, keep them fairly generic.
							- For each impact category, we don't need more than 2 or 3 action items.

						### Incoming Case Data
						[case_data]:
						"""
						${JSON.stringify(caseData, null, 1)}
						"""

						#### Category Definitions and Impact
						Company Profile
						• Definition: Evaluates key attributes such as industry type, geographical location, and business scale.
						• Impact: Can positively or negatively impact the overall Worth Score based on these factors.

						Financial Trends
						• Definition: Analyzes changes in the company's financial performance and broader economic trends.
						• Impact: Positive trends can add points to the overall score, while negative trends may subtract points.

						Public Records
						• Definition: Encompasses publicly available information about the business, including social reviews, legal judgments, bankruptcies, and liens.
						• Impact: Favorable public records can boost the overall score, while unfavorable records may decrease it.

						Worth Score
						• Definition: The overall weighted score that aggregates impacts from all categories to reflect the business's overall financial health and stability.

						#### Explanation:
						• Score Impact: Each category can potentially increase the overall score from the base score up to a maximum of 850. However, it's important to note:
							- It's unlikely for a single category to cause the entire increase from the base score to 850.
							- The impact of each category is not linear and can vary significantly.
							- Some categories, particularly Financial Trends, may have no impact on the overall score due to their non-linear nature.
						• Positive Impact: Categories that add points to the overall score indicate areas where the business is performing well. These strengths contribute to the business's financial health and stability.
						• Negative Impact: Categories that subtract points from the overall score highlight areas that may need attention or improvement. Addressing these areas can potentially enhance the business's overall financial profile.
						• No Impact: A category showing no impact (0 points) doesn't necessarily indicate a problem or missing data. It simply means this category neither positively nor negatively affected the overall score in this assessment.
						• Continuous Improvement: Regardless of the current score, there's always potential for improvement across all categories. Regular monitoring and strategic actions can help optimize the business's financial health over time.

						#### Suggested questions
						• Based on this report, what are four relevant questions the user should ask?
							- Each question should be relevant to the business and the report.
							- For now let's avoid asking questions that are too specific or too broad.
							- For example:
								- "Which specific reviews are negatively impacting my business?"
					`
					},
					{ role: "user", content: "help me generate insights report so that I can understand my overall business health." }
				]
			});

			let parsedResponse = response?.choices[0]?.message?.function_call?.arguments ? JSON.parse(response?.choices[0]?.message?.function_call?.arguments) : null;
			parsedResponse = await this.ensureReportStructure(parsedResponse);
			logger.info(`generated insights report response: ${JSON.stringify(parsedResponse)}`);

			if (isNotNil(parsedResponse)) {
				// store the report in the database
				const insertInsightsReportQuery = `INSERT INTO integration_data.insights_report (external_id, report_data, created_at) VALUES ($1, $2, $3)`;
				await sqlQuery({ sql: insertInsightsReportQuery, values: [caseId, JSON.stringify(parsedResponse), new Date().toUTCString()] });
				logger.info(`stored insights report for external_id: ${caseId}`);

				const insightsReport = parsedResponse as InsightsReportResponse;

				const suggestedActionItems = this.getSuggestedActionItems(insightsReport);
				logger.info(`suggested action items: ${JSON.stringify(suggestedActionItems, null, 1)}`);
				await this.optionallyAddActionItemsToDatabase(suggestedActionItems, caseId);
				return insightsReport;
			}

			throw new InsightsApiError("Failure to generate insights report", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		} catch (error: any) {
			throw new InsightsApiError(error?.message ?? "Failure to generate insights report", StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async getGenerativeAnswer({ messages, reportSummary, additionalContext = "", ...payload }: SubmitUserQueryPayload) {
		try {
			const systemPrompt = [
				{
					role: "system",
					content: `You are an expert helping users understand their business.
					More specifically, you are an expert helping users understand impact of their score as it relates to their business insights.

					### Report Breakdown
					The report breakdown will consist of the following:
					- impact of the Company Profile on the business
					- action items for the Company Profile
					- impact of the Financial Trends on the business
					- action items for the Financial Trends
					- impact of the Public Records on the business
					- action items for the Public Records
					- impact of the Worth score on the business
					- action items for the Worth score

					Some of these impact categories and actions items are optional and may not be present in the report breakdown.
					However, you're still able to help field any questions the user may have about the report and any corresponding categories or action items.

					### Mission
					- Help the user understand the health of their business as it relates to their business insights.
					- Help guide them with clear action items
					- Keep your responses clear and understandable.
					- Keep your responses concise and actionable.


					### (Optional) Additional Context:
					${additionalContext}

					### REMINDER
					- If a user ask you anything unrelated to the business insights, you should not answer it.
						- You should only answer questions related to the business insights.
						- Simply respond with something like "I'm sorry, I can only answer questions related to your bussiness's Worth insights report."
					- Any areas where the scores are considered "poor" relative to the benchmarks should be messaged with great care.
						- We should rarely use the term "poor" here within responses. A better substitue would be something like "high risk" or "below average".
						- Be clear about the impact of the score and what constitutes a "poor" score, while still encouraging the business on how it can improve.
					- No Impact: A category showing no impact (0 points) doesn't necessarily indicate a problem or missing data.
					  - It simply means this category neither positively nor negatively affected the overall score in this assessment.
					- Because the category scores are no longer confined to a positive percentage weight but a straight sum, they can be positive or negative.
						- Positive will always push the score up, and negative down.

					[business insights] =
					#### Category Definitions and Impact
					Company Profile
					• Definition: Evaluates key attributes such as industry type, geographical location, and business scale.
					• Impact: Can positively or negatively impact the overall Worth Score based on these factors.

					Financial Trends
					• Definition: Analyzes changes in the company's financial performance and broader economic trends.
					• Impact: Positive trends can add points to the overall score, while negative trends may subtract points.

					Public Records
					• Definition: Encompasses publicly available information about the business, including social reviews, legal judgments, bankruptcies, and liens.
					• Impact: Favorable public records can boost the overall score, while unfavorable records may decrease it.

					Worth Score
					• Definition: The overall weighted score that aggregates impacts from all categories to reflect the business's overall financial health and stability.

					#### Explanation:
					• Score Impact: Each category can potentially increase the overall score from the base score up to a maximum of 850. However, it's important to note:
						- It's unlikely for a single category to cause the entire increase from the base score to 850.
						- The impact of each category is not linear and can vary significantly.
						- Some categories, particularly Financial Trends, may have no impact on the overall score due to their non-linear nature.
					• Positive Impact: Categories that add points to the overall score indicate areas where the business is performing well. These strengths contribute to the business's financial health and stability.
					• Negative Impact: Categories that subtract points from the overall score highlight areas that may need attention or improvement. Addressing these areas can potentially enhance the business's overall financial profile.
					• No Impact: A category showing no impact (0 points) doesn't necessarily indicate a problem or missing data. It simply means this category neither positively nor negatively affected the overall score in this assessment.
					• Continuous Improvement: Regardless of the current score, there's always potential for improvement across all categories. Regular monitoring and strategic actions can help optimize the business's financial health over time.

					#### Report summary:
					${reportSummary}

					### Report Breakdown:
					${JSON.stringify(payload, null, 1)}
        `
				}
			];

			const formattedMessages = messages.map(message => {
				return match(message)
					.with({ role: "user" }, ({ content }) => new HumanMessage(content))
					.otherwise(() => new AIMessage(message.content));
			});

			const prompt = ChatPromptTemplate.fromMessages([new SystemMessage(systemPrompt[0].content), ...formattedMessages]);

			// Format the prompt messages
			const formattedPromptMessages = await prompt.formatMessages({
				reportSummary,
				additionalContext: isNonEmptyString(additionalContext) ? `Take into consideration the additional context provided: ${additionalContext}` : ""
			});

			// Get the model response
			const modelResponse = await model.invoke(formattedPromptMessages);

			// Parse the output
			const response = await new StringOutputParser().invoke(modelResponse);

			return response;
		} catch (error: any) {
			const errorMsg = "getGenerativeAnswer: Failure to get generative answer";
			throw new InsightsApiError(error?.message ?? errorMsg, StatusCodes.INTERNAL_SERVER_ERROR, ERROR_CODES.INVALID);
		}
	}

	async submitUserQuery({ messages, ...payload }: SubmitUserQueryPayload) {
		const latestUserInput = messages[messages.length - 1].content;
		logger.info(`insights assistant latestUserInput: ${latestUserInput}`);
		const generativeAnswer = await this.getGenerativeAnswer({ messages, ...payload });
		logger.info(`insights assistant generative answer: ${generativeAnswer}`);
		return generativeAnswer;
	}
}

export const insightsService = new InsightsService();
