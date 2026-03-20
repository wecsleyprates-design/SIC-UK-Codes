import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { envConfig } from "#configs";
import {
	CustomerIntegrationsEnum,
	ERROR_CODES,
	INTEGRATION_ENABLE_STATUS,
	INTEGRATION_ID,
	kafkaEvents,
	kafkaTopics,
	TASK_STATUS
} from "#constants";
import { db, logger, producer } from "#helpers";
import { OPENAI_MODEL_VERSION } from "#lib/aiEnrichment/constants";
import { IBusinessIntegrationTask } from "#types";
import { createOpenAIWithLogging } from "#utils";
import { getShortBusinessName } from "#utils/index";
import { UUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import OpenAI from "openai";
import { AdverseMediaApiError } from "./error";
import { AdverseMediaResponse, AnalyzeSearchResultsResponse, FetchAdverseMediaReportsBody, SortField } from "./types";

const serpApiKey = envConfig.SERP_API_KEY;

class AdverseMedia extends TaskManager {
	client: OpenAI;

	constructor() {
		super();
		this.client = createOpenAIWithLogging(
			{
				apiKey: envConfig.OPEN_AI_KEY
			},
			logger
		);
	}

	async fetchAdverseMediaData(
		identifier: string,
		isBusiness: boolean = true,
		sortFields: SortField[]
	): Promise<AdverseMediaResponse> {
		try {
			const businessId = isBusiness
				? identifier
				: await this.resolveBusinessIdFromCase(identifier);

			if (!businessId) {
				return {} as AdverseMediaResponse;
			}

			// Query by business_id to capture all sources (SerpAPI, Trulioo, future providers)
			const adverseMediaRecords = await db("integration_data.adverse_media")
				.select("id as adverse_media_id")
				.where("business_id", businessId);

			if (adverseMediaRecords.length === 0) {
				return {} as AdverseMediaResponse;
			}

			const adverseMediaIds = adverseMediaRecords.map(record => record.adverse_media_id);

			const articles = await db("integration_data.adverse_media_articles")
				.select(
					"id",
					"title",
					"link",
					"date",
					"source",
					"entity_focus_score",
					"final_score",
					"risk_level",
					"risk_description",
					"media_type",
					"created_at"
				)
				.whereIn("adverse_media_id", adverseMediaIds)
				.modify(queryBuilder => {
					sortFields.forEach(sortField => {
						if (sortField.field === "risk_level") {
							queryBuilder.orderByRaw(
								`CASE WHEN risk_level = 'HIGH' THEN 1 WHEN risk_level = 'MEDIUM' THEN 2 WHEN risk_level = 'LOW' THEN 3 END ${sortField.order === "desc" ? "DESC" : "ASC"}`
							);
						} else {
							queryBuilder.orderBy(sortField.field, sortField.order);
						}
					});
				});

			const highRiskCount = articles.filter(a => a.risk_level === "HIGH").length;
			const mediumRiskCount = articles.filter(a => a.risk_level === "MEDIUM").length;
			const lowRiskCount = articles.filter(a => a.risk_level === "LOW").length;
			const averageRiskScore = articles.length > 0
				? Number((articles.reduce((sum, a) => sum + (a.final_score || 0), 0) / articles.length).toFixed(2))
				: 0;

			return {
				id: adverseMediaRecords[0].adverse_media_id,
				[isBusiness ? "business_id" : "case_id"]: identifier,
				total_risk_count: articles.length,
				high_risk_count: highRiskCount,
				medium_risk_count: mediumRiskCount,
				low_risk_count: lowRiskCount,
				average_risk_score: averageRiskScore,
				articles
			};
		} catch (error) {
			throw error;
		}
	}

	private async resolveBusinessIdFromCase(caseId: string): Promise<string | null> {
		const caseData = await db("public.data_cases")
			.select("business_id")
			.where({ id: caseId })
			.first();
		return caseData?.business_id ?? null;
	}

	// Unified functions for both routes
	async getAdverseMediaByBusinessId(
		params: { businessId: string },
		query: { sortFields: SortField[] }
	): Promise<AdverseMediaResponse> {
		return this.fetchAdverseMediaData(params.businessId, true, query.sortFields);
	}

	async getAdverseMediaDataByCaseId(
		params: { caseId: string },
		query: { sortFields: SortField[] }
	): Promise<AdverseMediaResponse> {
		return this.fetchAdverseMediaData(params.caseId, false, query.sortFields);
	}

	async debugAdverseMedia(body: any) {
		// this will send kafka event to fetch adverse media
	const payload = {
		topic: kafkaTopics.BUSINESS,
		messages: [
			{
				key: body.business_id,
				value: {
					event: kafkaEvents.FETCH_ADVERSE_MEDIA_REPORT,
					...body
				}
			}
			]
		};

		await producer.send(payload);
	}

	async fetchAdverseMedia(body: FetchAdverseMediaReportsBody): Promise<AdverseMediaResponse> {
		try {
			const adverseMedia = await this.compileAdverseMedia(body);
			return adverseMedia;
		} catch (error) {
			throw error;
		}
	}

	async insertAdverseMedia(businessId: UUID, taskId: UUID, data: AdverseMediaResponse): Promise<void> {
		try {
			await db.transaction(async trx => {
				const inserted = await trx("integration_data.adverse_media")
					.insert({
						business_id: businessId,
						business_integration_task_id: taskId,
						total_risk_count: data.total_risk_count,
						high_risk_count: data.high_risk_count,
						medium_risk_count: data.medium_risk_count,
						low_risk_count: data.low_risk_count,
						average_risk_score: data.average_risk_score,
						meta: data
					})
					.onConflict(["business_id", "business_integration_task_id"])
					.ignore()
					.returning("*");

				if (!inserted || !inserted[0]) {
					return;
				}

				// Update existing records with NULL media_type OR different media_type
				for (const article of data.articles) {
					await trx("integration_data.adverse_media_articles")
						.where("link", article.link)
						.andWhere("business_id", businessId)
						.where("media_type", "!=", article.mediaType)
						.update({
							media_type: article.mediaType
						});
				}

				// Batch insert new records
				const articleInserts = data.articles.map(article => ({
					adverse_media_id: inserted[0].id,
					business_id: businessId,
					title: article.title,
					link: article.link,
					date: article.date,
					source: article.source,
					keywords_score: article.keywordsScore,
					negative_sentiment_score: article.negativeSentimentScore,
					entity_focus_score: article.entityFocusScore,
					final_score: article.finalScore,
					risk_level: article.riskLevel,
					risk_description: article.riskDescription,
					media_type: article.mediaType
				}));

				if (articleInserts.length > 0) {
					await trx("integration_data.adverse_media_articles")
						.insert(articleInserts)
						.onConflict(["link", "business_id", "media_type"])
						.merge();
				}
			});
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Scores adverse media titles for risk assessment
	 * @param {string} title - The adverse media title to analyze
	 * @param {string[]} entityNames - Array of business entity names
	 * @param {string[]} individuals - Array of related individual names
	 * @returns {Promise<Object>} Risk assessment scores and details
	 */
	async scoreAdverseMedia(title: string, entityNames: string[] = [], individuals: string[] = []) {
		try {
			const prompt = `Analyze this adverse media title for risk: "${title}"
				Business entity names: ${JSON.stringify(entityNames)}
				Individual names: ${JSON.stringify(individuals)}
				
				Score the title (1-10) for:
				1. Keywords (HIGH 8-10: fraud/arrested/convicted/corruption/lawsuit/investigation/bankruptcy/violation, MED 5-7: audit/review/criticism, LOW 1-4: no related keywords)
				2. Negative sentiment (tone and urgency)
				3. Entity focus (direct mention of business entity/industry vs potentially unrelated common names)
				
				Determine media type and individuals:
				- If the adverse media is about a company, corporation, business entity, or business-related activities (corporate fraud, business scandals, company violations, etc.), set mediaType to "business" and individuals to []
				- If the adverse media is about specific individuals from the provided list, set mediaType to "individual" and individuals to an array of all the specific individual names mentioned (return names in lowercase for consistency)
				- If the adverse media mentions individuals but no specific individual from the provided list is mentioned, set mediaType to "business" and individuals to [] (default to business when individual is not specifically identified)
				
				Examples:
				- "Company X charged with fraud" → mediaType: "business", individuals: []
				- "CEO John Smith arrested for embezzlement" → mediaType: "individual", individuals: ["john smith"] (if John Smith is in the provided list)
				- "Tech startup under investigation" → mediaType: "business", individuals: []
				- "Athlete fails drug test" → mediaType: "business", individuals: [] (no specific athlete name mentioned, default to business)
				- "Bank fined for regulatory violations" → mediaType: "business", individuals: []
				- "Executive resigns amid scandal" → mediaType: "business", individuals: [] (no specific executive name mentioned, default to business)
				- "John Smith arrested for fraud" → mediaType: "individual", individuals: ["john smith"] (if John Smith is in the provided list)
				- "Jane Doe and John Smith arrested" → mediaType: "individual", individuals: ["jane doe", "john smith"] (if both are in the provided list)
				
				Return JSON matching this example format:
				{
				"keywordsScore": 9,
				"negativeSentimentScore": 8,
				"entityFocusScore": 10,
				"finalScore": 9,
				"riskLevel": "HIGH",
				"description": "Significant adverse risk. Direct mention of fraud involving entity.",
				"mediaType": "business",
				"individuals": []
				}`;

			const chatCompletion = await this.client.chat.completions.create({
				messages: [{ role: "user", content: prompt }],
				model: OPENAI_MODEL_VERSION,
				temperature: 0.1,
				response_format: { type: "json_object" }
			});

			const content = chatCompletion.choices[0].message.content;
			if (content) {
				return JSON.parse(content);
			}
			return;
		} catch (error: any) {
			logger.error(`Error scoring adverse media: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Searches for news articles using SerpAPI's Google News engine
	 * @param {string} searchQuery - The search query string
	 * @returns {Promise<Object|null>} A promise that resolves with news results if found, or null if error
	 */
	async searchNews(searchQuery: string): Promise<Object | null> {
		logger.debug({"query": searchQuery},`Searching Adverse Media with query: ${searchQuery}`);

		try {
			const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(searchQuery)}&gl=us&hl=en&api_key=${serpApiKey}`;
			logger.debug({"url": url}, `Adverse Media SerpAPI request URL: ${url}`);

			const response = await fetch(url);
			const data = await response.json();

			if (data?.error) {
				logger.error(`Error in SerpAPI news search: ${JSON.stringify(data)}`);
				throw new AdverseMediaApiError(
					`Error in SerpAPI news search: ${data.error}`,
					StatusCodes.INTERNAL_SERVER_ERROR,
					ERROR_CODES.UNKNOWN_ERROR
				);
			}

			if (data?.news_results) {
				// Convert date strings to Date objects
				const processedResults = data.news_results.map(article => ({
					...article,
					// Parse date string and convert to Date object
					// Input format example: "09/04/2024, 07:00 AM, +0000 UTC"
					date: new Date(article.date.split(", +0000 UTC")[0])
				}));

				return {
					news_results: processedResults,
					search_metadata: data.search_metadata
				};
			}
			return null;
		} catch (error: any) {
			logger.error(`Error in SerpAPI news search: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Gets the list of adverse media keywords for searching
	 * @private
	 * @returns {string[]} Array of adverse media keywords
	 */
	getAdverseMediaKeywords() {
		return [
			// High Risk Terms
			"fraud",
			"lawsuit",
			"bankruptcy",
			"scandal",
			"investigation",
			"penalty",
			"violation",
			"criminal",
			"arrest",
			"conviction"
			// Add more keywords as needed
		];
	}
	private sanitizeForGooglePhrase(value: string): string {
		if (!value) return value;

		// Normalize + remove control chars + collapse whitespace
		const cleaned = value
			.normalize("NFKC")
			.replace(/[\u0000-\u001F\u007F]/g, " ")
			.replace(/\s+/g, " ")
			.trim();

		// Inside Google quotes, escape only what matters
		return cleaned.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	}

	private q(value: string): string {
		const v = this.sanitizeForGooglePhrase(value);
		return v ? `"${v}"` : "";
	}

	/**
	 * Constructs the search query for adverse media
	 * @private
	 * @param {string|string[]} companyNames - Core company name(s)
	 * @param {string|string[]} [contactNames] - Optional contact name(s)
	 * @param {string} [city] - Optional city for region filtering
	 * @param {string} [state] - Optional state for region filtering
	 * @returns {string} Formatted search query
	 * @throws {Error} If companyNames is empty or null
	 */
	buildAdverseMediaQuery(companyNames: string[], contactNames: string[] = [], city?: string, state?: string): string {
		const companies = (Array.isArray(companyNames) ? companyNames : [companyNames]).map(v => v?.trim()).filter(Boolean);

		if (!companies.length) {
			throw new Error("At least one company name is required");
		}

		const contacts = (Array.isArray(contactNames) ? contactNames : [contactNames]).map(v => v?.trim()).filter(Boolean);

		// Google wants OR, not |
		const companyQuery = companies.map(n => this.q(n)).join(" OR ");
		const contactQuery = contacts.map(n => this.q(n)).join(" OR ");

		// Region is optional; Google treats spaces as AND
		const regionQuery = city && state ? `(${this.q(city)} OR ${this.q(state)})` : "";

		// Entity group
		const entityQuery = contacts.length ? `(${companyQuery} OR ${contactQuery})` : `(${companyQuery})`;

		// Keywords: quote them so special chars don’t turn into operators
		const keywordsQuery = this.getAdverseMediaKeywords()
			.map(k => this.q(k))
			.filter(Boolean)
			.join(" OR ");

		// Final: [region] [entity] ([keywords]) => AND via spaces
		return [regionQuery, entityQuery, `(${keywordsQuery})`].filter(Boolean).join(" ");
	}

	/**
	 * Compiles adverse media data for a single company
	 * @private
	 * @param {Object} result - Company data record
	 * @returns {Promise<Object>} Analyzed adverse media results
	 */
	async compileAdverseMedia(body: FetchAdverseMediaReportsBody): Promise<AnalyzeSearchResultsResponse> {
		const companyNames: string[] = [];

		// Get short name of business name
		const coreName = getShortBusinessName(body.business_name);
		companyNames.push(coreName, body.business_name);

		// push dba names and its shortned name to companyNames
		if (body.dba_names) {
			for (const dbaName of body.dba_names) {
				companyNames.push(getShortBusinessName(dbaName), dbaName);
			}
		}

		const individuals = body.contact_names && Array.isArray(body.contact_names) ? body.contact_names : [];

		// Build a query to search for adverse media
		// Use both the core name and the exact company name
		const searchString = this.buildAdverseMediaQuery(companyNames, individuals, body.city, body.state);

		// Perform adverse media search
		const searchResults = await this.searchNews(searchString);

		// Analyze search results using OpenAI
		const results = await this.analyzeSearchResults(searchResults, coreName, individuals);
		return results;
	}

	/**
	 * Analyzes search results for adverse media
	 * @private
	 * @param {Object} searchResults - Results from SerpAPI news search
	 * @param {string} companyName - Name of the company being searched
	 * @param {string[]} individuals - Array of related individual names
	 * @returns {Object} Analyzed adverse media data with risk scores
	 */
	async analyzeSearchResults(
		searchResults: any | null,
		companyName: string,
		individuals: string[] = []
	): Promise<AnalyzeSearchResultsResponse> {
		const newsResults = searchResults?.news_results || [];

		// Score each article and combine with original data
		const scoredResults = await Promise.all(
			newsResults.map(async result => {
				const riskScore = await this.scoreAdverseMedia(result.title, [companyName], individuals);

				const baseArticleScore = {
					title: result.title || "",
					link: result.link || "",
					date: result.date || "",
					source: result.source.name || "",
					// Add risk assessment scores
					keywordsScore: riskScore?.keywordsScore || 0,
					negativeSentimentScore: riskScore?.negativeSentimentScore || 0,
					entityFocusScore: riskScore?.entityFocusScore || 0,
					finalScore: riskScore?.finalScore || 0,
					riskLevel: riskScore?.riskLevel || "LOW",
					riskDescription: riskScore?.description || "",
					mediaType: riskScore?.mediaType || "business"
				};

				// If there are multiple individuals mentioned, create duplicate records for each
				const individualsList = riskScore?.individuals || [];
				if (individualsList.length > 0) {
					return individualsList.map(individualName => ({
						...baseArticleScore,
						mediaType: individualName.toLowerCase() // Override mediaType with the lowercase individual name
					}));
				}

				// Return single record for business or individual without specific names
				return [baseArticleScore];
			})
		);

		// Flatten the array of arrays into a single array
		const flattenedScoredResults = scoredResults.flat();

		return {
			found: flattenedScoredResults.length > 0,
			count: flattenedScoredResults.length,
			// Add detailed results with scores
			articles: flattenedScoredResults,
			// Add summary statistics
			total_risk_count: flattenedScoredResults.length,
			high_risk_count: flattenedScoredResults.filter(r => r.riskLevel === "HIGH").length,
			medium_risk_count: flattenedScoredResults.filter(r => r.riskLevel === "MEDIUM").length,
			low_risk_count: flattenedScoredResults.filter(r => r.riskLevel === "LOW").length,
			average_risk_score:
				flattenedScoredResults.length > 0
					? Number(
							(
								flattenedScoredResults.reduce((sum, r) => sum + r.finalScore, 0) / flattenedScoredResults.length
							).toFixed(2)
						)
					: 0
		};
	}

	async customerSettingsForIntegration(customerId: UUID, integration: CustomerIntegrationsEnum): Promise<boolean> {
		const customerSettings = await db("public.data_customer_integration_settings")
			.select("settings")
			.where("customer_id", customerId)
			.first();
		logger.debug(`customerSettings: ${JSON.stringify(customerSettings)}`);

		if (!customerSettings || !customerSettings.settings) {
			return false;
		}

		const setting = customerSettings.settings[integration];
		if (setting && typeof setting === "object") {
			return setting.status === INTEGRATION_ENABLE_STATUS.ACTIVE;
		}

		return false;
	}

	async getAdverseMediaTask(businessId: UUID, caseId?: UUID): Promise<IBusinessIntegrationTask> {
		const taskQuery = db("integrations.data_business_integrations_tasks")
			.select("integrations.data_business_integrations_tasks.*")
			.leftJoin(
				"integrations.data_connections",
				"integrations.data_connections.id",
				"integrations.data_business_integrations_tasks.connection_id"
			);

		if (caseId) {
			taskQuery
				.leftJoin(
					"integrations.business_score_triggers",
					"integrations.business_score_triggers.id",
					"integrations.data_business_integrations_tasks.business_score_trigger_id"
				)
				.leftJoin("public.data_cases", "public.data_cases.score_trigger_id", "integrations.business_score_triggers.id");
		}

		taskQuery
			.where("integrations.data_connections.business_id", businessId)
			.andWhere("integrations.data_connections.platform_id", INTEGRATION_ID.ADVERSE_MEDIA);

		if (caseId) {
			taskQuery.andWhere("public.data_cases.id", caseId);
		}

		taskQuery.orderBy("integrations.data_business_integrations_tasks.created_at", "desc");

		const task = await taskQuery.first();
		return task;
	}

	async processAdverseMedia(body: FetchAdverseMediaReportsBody, task: IBusinessIntegrationTask): Promise<void> {
		const adverseMediaData = await adverseMedia.fetchAdverseMedia(body);

		await adverseMedia.insertAdverseMedia(body.business_id, task.id, adverseMediaData);
	}

	async processAdverseMediaAndHandleTasks(
		body: FetchAdverseMediaReportsBody,
		task: IBusinessIntegrationTask
	): Promise<void> {
		try {
			// task as INITIALIZED
			await db("integrations.data_business_integrations_tasks")
				.where("id", task.id)
				.update({ task_status: TASK_STATUS.IN_PROGRESS });

			// process adverse media
			await this.processAdverseMedia(body, task);

			// mark task as SUCCESS
			await db("integrations.data_business_integrations_tasks")
				.where("id", task.id)
				.update({ task_status: TASK_STATUS.SUCCESS });
		} catch (error: any) {
			// mark connection and task as FAILED
			const task = await adverseMedia.getAdverseMediaTask(body.business_id, body.case_id);
			await db("integrations.data_business_integrations_tasks")
				.where("id", task.id)
				.update({ task_status: TASK_STATUS.FAILED, metadata: { err: error.message } });

			throw error;
		}
	}

	async deleteAdverseMedia(taskId: UUID): Promise<void> {
		try {
			const adverseMediaRecord = await db("integration_data.adverse_media")
				.select("id as adverse_media_id")
				.where("business_integration_task_id", taskId);

			if (adverseMediaRecord.length === 0) {
				return;
			}

			// delete the adverse media for this task as we want to replace it
			await db("integration_data.adverse_media").where({ business_integration_task_id: taskId }).del();
		} catch (error) {
			throw error;
		}
	}
}

export const adverseMedia = new AdverseMedia();
