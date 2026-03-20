import axios, { AxiosError } from "axios";
import { isNonEmptyArray, isNonEmptyString } from "@austinburns/type-guards";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { match } from "ts-pattern";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";
import pgvector from "pgvector/knex";

import { ChatMessage, SubmitUserQueryPayload } from "./schema";
import { sqlQuery } from "#helpers/index";
import { FaqChatBotApiError } from "./error";
import { ERROR_CODES } from "#constants";
import { logger } from "#helpers";
import { envConfig } from "#configs/index";
import { OPENAI_MODEL_VERSION } from "#lib/aiEnrichment/constants";

// Instantiate the model
const model = new ChatOpenAI({
	temperature: 0,
	modelName: OPENAI_MODEL_VERSION,
	openAIApiKey: envConfig.OPEN_AI_KEY,
	callbacks: [
		{
			handleLLMEnd(output) {
				if (output?.llmOutput) {
					logger.info(`completionTokens: ${output.llmOutput?.tokenUsage?.completionTokens}`);
					logger.info(`promptTokens: ${output.llmOutput?.tokenUsage?.promptTokens}`);
					logger.info(`totalTokens: ${output.llmOutput?.tokenUsage?.totalTokens}`);
				}
			}
		}
	]
});

interface FAQ {
	id: string;
	question: string;
	answer: string;
	similarity: number;
}

class FaqChatbotService {
	async embedIncomingQuery(input: string) {
		try {
			const response = await axios.post(
				"https://api.openai.com/v1/embeddings",
				{ model: "text-embedding-3-small", input },
				{ headers: { Authorization: `Bearer ${envConfig.OPEN_AI_KEY}` } }
			);

			const embedding = response.data.data[0].embedding as number[];
			return embedding;
		} catch (error: unknown) {
			if (axios.isAxiosError(error)) {
				const typedError = error as AxiosError<{ errors: Array<Record<"message", string>> }>;
				const reportedError = typedError.response?.data ?? null;
				if (isNonEmptyArray(reportedError?.errors)) {
					const errorMsg = reportedError?.errors[0].message ?? "Failure to embed incoming query";
					const errorStatus = typedError.response?.status ?? 500;
					throw new FaqChatBotApiError(errorMsg, errorStatus, ERROR_CODES.INVALID);
				}
			}
			throw error;
		}
	}

	async findRelevantFAQs(embedding: number[], matchCount: number) {
		try {
			const similarityThreshold = 0.01;

			const formattedEmbedding = pgvector.toSql(embedding);

			/**
			 * faq_search is a stored procedure that takes in a query
			 * embedding and returns the most similar blog posts based on cosine similarity.
			 * Cosine similarity measures the similarity between two vectors based
			 * on the cosine of the angle between them. The range of the cosine
			 * similarity is between -1 and 1, where 1 means the two vectors are identical,
			 * 0 means they are orthogonal (i.e., have no similarity), and -1 means they are opposite
			 */
			const getRelevantFaqsQuery = `SELECT * FROM public.faq_search($1, $2, $3)`;

			const result = await sqlQuery({
				sql: getRelevantFaqsQuery,
				values: [formattedEmbedding, similarityThreshold, matchCount]
			});

			// typescript hack to fix the type issue with result.rows being `any`
			const faqs = result.rows.map(row => ({
				id: row[0] as string,
				question: row[1] as string,
				answer: row[2] as string,
				similarity: row[3] as number
			})) as FAQ[];

			return faqs;
		} catch (error: any) {
			throw new FaqChatBotApiError(error?.message ?? "Failure to find relevant FAQs", 500, ERROR_CODES.INVALID);
		}
	}

	async getGenerativeAnswer(context: string, messages: ChatMessage[], additionalContext: string) {
		try {
			const systemPrompt = [
				{
					role: "system",
					content: `Worth AI assistant is a specialized, intelligent underwriting assistant designed to support our users in the financial ecosystem.
          The core competencies of Worth AI include a deep understanding of business models, financial health assessments, and credit risk evaluation.
          Worth AI is diligent, meticulous, and insightful, ensuring a thorough analysis of each user's business to safeguard their interests and those of their customers.
          This assistant is always precise, professional, and supportive, eager to provide detailed and accurate assessments to aid in decision-making.
          With a comprehensive knowledge base in finance and credit underwriting, Worth AI can accurately evaluate nearly any aspect of a business's financial status and potential risks.
          Worth AI plays a pivotal role in maintaining the integrity and safety of our financial ecosystem by facilitating the credit underwriting process.

          START CONTEXT BLOCK
          ${context}
          END OF CONTEXT BLOCK

					${additionalContext}

          Worth AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
          If the context does not provide the answer to question, the Worth AI assistant will say, "I'm sorry, but I don't know the answer to that question".
          Worth AI assistant will not apologize for previous responses, but instead will indicate new information was gained.
          Worth AI assistant will not invent anything that is not drawn directly from the context.
        `
				}
			];

			const formattedMessages = messages.map(message => {
				return match(message)
					.with({ role: "user" }, ({ content }) => new HumanMessage(content))
					.otherwise(() => new AIMessage(message.content));
			});

			const prompt = ChatPromptTemplate.fromMessages([
				new SystemMessage(systemPrompt[0].content),
				...formattedMessages
			]);

			// Format the prompt messages
			const formattedPromptMessages = await prompt.formatMessages({
				context,
				additionalContext: isNonEmptyString(additionalContext)
					? `Take into consideration the additional context of the page description that the user is currently on: ${additionalContext}`
					: ""
			});

			// Get the model response
			const modelResponse = await model.invoke(formattedPromptMessages);

			// Parse the output
			const response = await new StringOutputParser().invoke(modelResponse);

			return response;
		} catch (error: unknown) {
			const errorMsg = "Failure to get generative answer";
			throw new FaqChatBotApiError(errorMsg, 500, ERROR_CODES.INVALID);
		}
	}

	async submitUserQuery({ messages, additionalContext = "" }: SubmitUserQueryPayload) {
		const latestUserInput = messages[messages.length - 1].content;
		logger.info(`latestUserInput: ${latestUserInput}`);
		const input = latestUserInput.replace(/\n/g, " ");
		const embedding = await this.embedIncomingQuery(input);
		const relevantFaqs = await this.findRelevantFAQs(embedding, 2);
		logger.info(`relevant faqs: ${JSON.stringify(relevantFaqs, null, 1)}`);
		const context = relevantFaqs.map(faq => faq.answer).join("\n");
		logger.info(`mapped context: ${context}`);
		const generativeAnswer = await this.getGenerativeAnswer(context, messages, additionalContext ?? "");
		logger.info(`generative answer: ${generativeAnswer}`);
		return generativeAnswer;
	}
}

export const faqChatbotService = new FaqChatbotService();
