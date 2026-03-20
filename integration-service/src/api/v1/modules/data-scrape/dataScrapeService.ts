import { StatusCodes } from "http-status-codes";
import fuzz from "fuzzball";
import { UUID } from "crypto";
import OpenAI from "openai";
import { AddressUtil, createOpenAIWithLogging } from "#utils";
import { zodResponseFormat } from "openai/helpers/zod";
import dedent from "dedent";
import { v4 as uuid } from "uuid";
import { buildInsertQuery } from "#utils/queryBuilder";
import {
	getBusinessDetails,
	getBusinessDetailsForTaxConsent,
	getFlagValue,
	internalGetBusinessNamesAndAddresses,
	sqlQuery,
	sqlTransaction
} from "#helpers";
import { TaskHandlerMap, TaskManager } from "#api/v1/modules/tasks/taskManager";
import { db, producer } from "#helpers/index";
import { IDBConnection } from "#types/db";
import axios, { isAxiosError } from "axios";

import { DataScrapeApiError, DataScrapeApiErrorCodes } from "./dataScrapeApiError";
import { uploadRawIntegrationDataToS3 } from "#common/common";
import {
	ERROR_CODES,
	INTEGRATION_ID,
	DIRECTORIES,
	CONNECTION_STATUS,
	SCORE_TRIGGER,
	kafkaTopics,
	kafkaEvents,
	FEATURE_FLAGS,
	TASK_STATUS
} from "#constants";
import { logger } from "#helpers";
import { envConfig } from "#configs/index";
import { isNonEmptyArray } from "@austinburns/type-guards";
import {
	BusinessLegitimacyClassification,
	SerializedWebsiteData,
	GoogleReview,
	GeneralReviewSynthesis,
	GoogleBusinessMatch,
	GoogleLocalResult,
	serializedWebsiteDataSchema,
	reviewSynthesisSchema,
	businessLegitimacyClassificationSchema
} from "./schema";
import { getAddressWithGeoCode } from "#helpers/address";
import { DataScrapeServiceType } from "./types";
import { GoogleProfile } from "#lib/serp";
import { OPENAI_MODEL_VERSION } from "#lib/aiEnrichment/constants";

const openai = createOpenAIWithLogging(
	{
		apiKey: envConfig.OPEN_AI_KEY,
		maxRetries: 3,
		timeout: 120 * 1000 // 120s
	},
	logger
);

const serpApiKey = envConfig.SERP_API_KEY;
export class DataScrapeService extends TaskManager {
	client: OpenAI;

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
		this.client = createOpenAIWithLogging(
			{
				apiKey: envConfig.OPEN_AI_KEY
			},
			logger
		);
	}

	static FUZZY_MATCH_THRESHOLD = 90;
	static FUZZY_PARTIAL_THRESHOLD = 70;
	static PLATFORM_ID = INTEGRATION_ID.SERP_SCRAPE;

	taskHandlerMap: TaskHandlerMap = {
		fetch_business_entity_website_details: async taskId => await this.executeTask(taskId)
	};

	executeTask = async (taskID: UUID) => {
		try {
			const task = await DataScrapeService.getEnrichedTask(taskID);
			const { business_id: businessId } = task;
			const [{ data: businessDetails }, { names }] = await Promise.all([
				getBusinessDetailsForTaxConsent(businessId),
				internalGetBusinessNamesAndAddresses(businessId)
			]);

			let businessAddress = `${businessDetails.address_line_1}, `;

			if (businessDetails.address_city) {
				businessAddress = businessAddress.concat(`${businessDetails.address_city}, `);
			}
			if (businessDetails.address_state) {
				businessAddress = businessAddress.concat(`${businessDetails.address_state}, `);
			}
			if (businessDetails.address_postal_code) {
				businessAddress = businessAddress.concat(`${businessDetails.address_postal_code}`);
			}

			const businessDbaNames = names?.map(({ name }) => name) || [];

			logger.info(
				`Serp API payload :: ${JSON.stringify(
					{
						businessAddress,
						businessName: businessDetails.business_name,
						businessDbaNames: businessDbaNames,
						businessID: businessId,
						taskID
					},
					null,
					2
				)}`
			);
			const response = await this.searchSerpAPI({
				businessAddress,
				businessName: businessDetails.business_name,
				businessDbaNames: businessDbaNames,
				businessID: businessId,
				taskID,
				includeIndustryAndWebsiteData: task?.trigger_type !== SCORE_TRIGGER.MANUAL_REFRESH
			});

			logger.info(`Serp API Response  :: ${JSON.stringify(response, null, 2)}`);

			await this.updateConnectionStatus(CONNECTION_STATUS.SUCCESS);
			return true;
		} catch (error) {
			// Doesn't throw -- just logs
			DataScrapeApiError.fromError(
				error,
				DataScrapeApiErrorCodes.DS_I0007,
				"Something went wrong when the score refresh tried to execute serp search"
			);
		}
		return false;
	};

	async createConnection({ business_id, options }: { business_id: UUID; options: any }): Promise<IDBConnection> {
		// check if we already have a connection for this business entity and platform id
		let connection = await db<IDBConnection>("integrations.data_connections")
			.select("*")
			.where({
				business_id,
				platform_id: DataScrapeService.PLATFORM_ID
			})
			.orderBy("created_at", "desc")
			.first();

		if (connection) {
			logger.debug("Returning existing connection for SERP");
			this.dbConnection = connection;
			return connection;
		}

		logger.debug(`Creating connection for SERP (${DataScrapeService.PLATFORM_ID}), business_id: ${business_id}`);
		const insertedConnection = await db<IDBConnection>("integrations.data_connections")
			.insert({
				business_id,
				platform_id: DataScrapeService.PLATFORM_ID,
				connection_status: CONNECTION_STATUS.SUCCESS,
				configuration: options
			})
			.onConflict(["business_id", "platform_id"])
			.merge(["connection_status", "configuration"])
			.returning("*");
		logger.info(insertedConnection);

		if (insertedConnection && insertedConnection[0]) {
			logger.debug("returning connection");
			this.dbConnection = insertedConnection[0];
			return insertedConnection[0];
		}

		throw new DataScrapeApiError(DataScrapeApiErrorCodes.DS_C00000);
	}

	async classifyLegitimacy(serializedWebsiteData: SerializedWebsiteData) {
		try {
			const classifiedWebsiteData = await openai.chat.completions.parse({
				messages: [
					{
						role: "system",
						content: dedent`
							You are an AI assistant specialized in analyzing and classifying business legitimacy based on website data.
							Your task is to assess the provided SerializedWebsiteData and determine industry classifications and business legitimacy.
							Focus on the following aspects:

							1. NAICS code: Determine the most appropriate North American Industry Classification System (NAICS) code based on the company's description, industry, and industry vertical.
							2. Secondary NAICS code: If applicable, provide a secondary NAICS code that further classifies the company's activities.
							3. SIC code: Identify the most suitable Standard Industrial Classification (SIC) code for the company.
							4. Secondary SIC code: If relevant, provide a secondary SIC code for additional classification.
							5. Business Legitimacy Confidence: Assess the likelihood that this is a legitimate business based on the available information, and provide a confidence score from 0 to 100.

							When determining codes and assessing legitimacy, consider:
							- The clarity and specificity of the company description
							- The alignment between the stated industry, industry vertical, and relevant tags
							- The specificity of the target audience
							- The overall coherence of the provided information

							Analyze the provided SerializedWebsiteData carefully and extract this information as accurately as possible.
							If certain details are not explicitly stated, use your judgment to infer them based on the available context.
							Your output should be structured and ready for use in the classify-website-data function, including all required fields.
			  `
					},
					{
						role: "user",
						content: dedent`
				Help me classify this website data:
				\`\`\`json
				${JSON.stringify(serializedWebsiteData, null, 2)}
				\`\`\`
			  `
					}
				],
				temperature: 0.1,
				response_format: zodResponseFormat(businessLegitimacyClassificationSchema, "businessLegitimacyClassification"),
				model: OPENAI_MODEL_VERSION,
				stream: false
			});

			return classifiedWebsiteData.choices[0].message.parsed;
		} catch (error) {
			logger.error({ error }, "Error serializing website data");
			throw DataScrapeApiError.fromError(error, DataScrapeApiErrorCodes.DS_I0003, "Unable to classify website data");
		}
	}

	async synthesizeGoogleReviews({
		topGoogleReviews,
		overallRating,
		totalReviews
	}: {
		topGoogleReviews: GoogleReview[];
		overallRating: number;
		totalReviews: number;
	}): Promise<GeneralReviewSynthesis | null> {
		if (!envConfig.OPEN_AI_KEY) {
			throw new DataScrapeApiError(DataScrapeApiErrorCodes.DS_K0000);
		}

		try {
			const synthesizedReviews = await openai.chat.completions.parse({
				messages: [
					{
						role: "system",
						content: dedent`
							You are an AI assistant specialized in analyzing and synthesizing Google reviews for businesses.
							Your task is to extract key insights and summarize the overall sentiment from a set of user reviews.
							Focus on the following aspects:

							1. Worst Review: Identify and summarize the most critical or negative review.
							2. Best Review: Identify and summarize the most positive or praising review.
							3. General Sentiment: Determine the overall sentiment of the reviews, considering all ratings and descriptions.
							  - be sure to take into consideration the [overallRating] and number of [totalReviews]
							4. Relevant Emotions: Extract and list the key emotions expressed by customers in their reviews.
							5. Suggested Focus Area: Based on the reviews, recommend an area where the business could improve or focus its efforts.

							When analyzing the reviews, consider:
							- The rating given by each user (on a scale typically from 1 to 5)
							- The content of the review descriptions
							- The frequency of specific complaints or praises
							- Any patterns or trends in the feedback

							Important:
							- If there are no negative reviews, then the worst review should be an empty string

							Analyze the provided GoogleReview data carefully and synthesize this information as accurately as possible.
							If there are limited reviews, use your best judgment to infer insights based on the available information.
							Your output should be structured and ready for use in the serialize-website-data function, including all required fields.

							overallRating: ${overallRating}
							totalReviews: ${totalReviews}
			  `
					},
					{
						role: "user",
						content: dedent`
				The overall rating is ${overallRating} and the total reviews are ${totalReviews}.
							Help me synthesize google reviews:
				\`\`\`json
				${JSON.stringify(topGoogleReviews, null, 2)}
				\`\`\`
			  `
					}
				],
				response_format: zodResponseFormat(reviewSynthesisSchema, "reviewSynthesis"),
				model: OPENAI_MODEL_VERSION,
				stream: false,
				temperature: 0.1
			});
			return synthesizedReviews.choices[0].message.parsed;
		} catch (error) {
			logger.error(error, `Error synthesizing google reviews: ${JSON.stringify(error)}`);
			throw DataScrapeApiError.fromError(
				error,
				DataScrapeApiErrorCodes.DS_I0004,
				"Unable to synthesize google reviews"
			);
		}
	}

	async serializeWebsite(url: string, googleBusinessMatch: GoogleBusinessMatch | null) {
		if (!envConfig.OPEN_AI_KEY) {
			throw new DataScrapeApiError(DataScrapeApiErrorCodes.DS_K0000);
		}
		try {
			const serializedWebsiteData = await openai.chat.completions.parse({
				messages: [
					{
						role: "system",
						content: dedent`
							You are an AI assistant specialized in analyzing and classifying website data.
							Your task is to extract and organize key information about businesses from scraped website content.
							Focus on the following aspects:

							1. Company Description: Provide a concise yet informative summary of the company's main activities, products, or services.
							2. Target Audience: Identify and describe the primary customer base or market segment the company aims to serve.
							3. Industry: Determine the specific industry or sector in which the company operates.
								- Be as specific as possible, avoiding broad terms like "Technology" or "Software"
								- Examples include fintech, insurtech, healthtech, martech, edutech, etc.
							4. Industry Vertical: Identify the specific industry vertical the company operates in.
							5. Relevant Tags: Generate a list of keywords or phrases that accurately represent the company's core business, products, services, or unique selling points.
							6. Industry Mapped: Map the industry to our internal industry taxonomy.
							  - Our industry taxonomy is as follows:
								- agriculture_forestry_fishing_and_hunting
									- mining_quarrying_and_oil_and_gas_extraction
									- utilities
									- construction
									- manufacturing
									- wholesale_trade
									- retail_trade
									- transportation_and_warehousing
									- information
									- finance_and_insurance
									- real_estate_and_rental_and_leasing
									- professional_scientific_and_technical_services
									- management_of_companies_and_enterprises
									- administrative_and_support_and_waste_management_and_remediation_services
									- educational_services
									- health_care_and_social_assistance
									- arts_entertainment_and_recreation
									- accommodation_and_food_services
									- arts_entertainment_and_recreation
									- public_administration
									- other_services

							Analyze the provided website data carefully and extract this information as accurately as possible.
							If certain details are not explicitly stated, use your judgment to infer them based on context clues.
							Ensure that all required fields (company_description, target_audience, industry, industry_vertical, and relevant_tags) are included in your response.
			  `
					},
					{
						role: "user",
						content: dedent`
						Below is the main information about a website::
				\`\`\`
				${url}
				\`\`\`
				${googleBusinessMatch?.type?.length ? ` these are the categories:: ${googleBusinessMatch.type.join(", ")}` : ""}
				\`\`\`
				${googleBusinessMatch?.title ? ` the title is:: ${googleBusinessMatch?.title}` : ""}
				\`\`\`
				${googleBusinessMatch?.type_ids ? ` the type ids are:: ${googleBusinessMatch?.type_ids.join(",")}` : ""}
			  `
					}
				],
				response_format: zodResponseFormat(serializedWebsiteDataSchema, "serializedWebsiteData"),
				model: OPENAI_MODEL_VERSION,
				stream: false
			});

			return serializedWebsiteData.choices[0].message.parsed;
		} catch (error) {
			logger.error({ error }, "Error serializing website data");
			throw DataScrapeApiError.fromError(error, DataScrapeApiErrorCodes.DS_I0001, "Unable to serialize website data");
		}
	}

	async scrapeGoogleReviews(googleReviewsLink: string): Promise<GoogleReview[]> {
		if (!serpApiKey) {
			throw new DataScrapeApiError(DataScrapeApiErrorCodes.DS_K0001);
		}
		try {
			const modifiedUrl = googleReviewsLink.replace(
				"https://serpapi.com/search.json?",
				`https://serpapi.com/search.json?api_key=${serpApiKey}&`
			);
			const response = await axios.get(modifiedUrl, { timeout: envConfig.SYNCHRONOUS_API_TIMEOUT_SECONDS * 1000 });
			return response.data?.reviews ?? [];
		} catch (error) {
			logger.error({ error }, "Error scraping google reviews");
			// @TODO: ENG-24 Replace SERP -- this is a hacky workaround to make sure we're not just throwing a 400 if SERP times out
			if (isAxiosError(error) && error.code === "ECONNABORTED") {
				logger.warn({ error }, "Google reviews search timed out");
				return [];
			}
			throw DataScrapeApiError.fromError(error, DataScrapeApiErrorCodes.DS_I0002, "Unable to scrape google reviews");
		}
	}

	private buildGoogleMapsSerpQueryInsert(
		serpQueryId: string,
		taskID: string,
		businessID: string,
		businessName: string,
		businessAddress: string,
		url: string,
		businessMatch: GoogleBusinessMatch | GoogleLocalResult | null,
		topLocalResult: GoogleLocalResult | null
	): [string, any[]] {
		const insertSerpQuery = `
			INSERT INTO integration_data.google_maps_serp_queries
			(id, business_integration_task_id, business_id, submitted_business_name, submitted_business_address, serp_query_url, hit_found, title_response, website_response, address_response, raw_business_match, raw_local_match)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`;
		const serpQueryValues = [
			serpQueryId,
			taskID,
			businessID,
			businessName,
			businessAddress,
			url,
			!!businessMatch || !!topLocalResult,
			businessMatch?.title || topLocalResult?.title || null,
			businessMatch?.website || topLocalResult?.website || null,
			businessMatch?.address || topLocalResult?.address || null,
			businessMatch ? JSON.stringify(businessMatch) : null,
			topLocalResult ? JSON.stringify(topLocalResult) : null
		];
		return [insertSerpQuery, serpQueryValues];
	}

	private buildBusinessReviewSynthesisInsert(
		serpQueryId: string,
		reviewSynthesis: GeneralReviewSynthesis,
		overallRating: number,
		totalReviews: number
	): [string, any[]] {
		const insertWebsiteDataQuery = `
			INSERT INTO integration_data.business_review_synthesis
			(id, serp_query_id, worst_review, best_review, general_sentiment, relevant_emotions, suggested_focus_area, overall_rating, total_reviews)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`;
		const websiteDataValues = [
			uuid(),
			serpQueryId,
			reviewSynthesis.worst_review || null,
			reviewSynthesis.best_review || null,
			reviewSynthesis.general_sentiment,
			reviewSynthesis.relevant_emotions,
			reviewSynthesis.suggested_focus_area,
			overallRating,
			totalReviews
		];
		return [insertWebsiteDataQuery, websiteDataValues];
	}

	private buildReviewsInsert(taskID: string, topGoogleReviews: GoogleReview[]): [string, any[]] {
		const reviewsColumns = [
			"id",
			"business_integration_task_id",
			"review_id",
			"star_rating",
			"text",
			"review_datetime",
			"metadata"
		];
		const reviewsValues = topGoogleReviews.map(review => [
			uuid(),
			taskID,
			review.review_id,
			review.rating,
			review.snippet,
			review.iso_date,
			JSON.stringify(review) // Store the raw response in metadata
		]);
		let insertReviewsQuery = buildInsertQuery("integration_data.reviews", reviewsColumns, reviewsValues);
		insertReviewsQuery = insertReviewsQuery.concat(`
				 ON CONFLICT (review_id, business_integration_task_id)
					DO UPDATE
					SET
						star_rating = excluded.star_rating,
						text = excluded.text,
						review_datetime = excluded.review_datetime,
						metadata = excluded.metadata
			`);
		return [insertReviewsQuery, reviewsValues.flat()];
	}

	private buildSerializedWebsiteScrapeInsert(
		serpQueryId: string,
		serializedWebsiteData: SerializedWebsiteData
	): [string, any[]] {
		const insertWebsiteDataQuery = `
			INSERT INTO integration_data.serialized_website_scrapes
			(id, serp_query_id, company_description, target_audience, industry, industry_vertical, relevant_tags)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`;
		const websiteDataValues = [
			uuid(),
			serpQueryId,
			serializedWebsiteData.company_description,
			serializedWebsiteData.target_audience,
			serializedWebsiteData.industry,
			serializedWebsiteData.industry_vertical,
			serializedWebsiteData.relevant_tags
		];
		return [insertWebsiteDataQuery, websiteDataValues];
	}

	private buildInferredBusinessClassificationInsert(
		serpQueryId: string,
		businessLegitimacyClassification: BusinessLegitimacyClassification
	): [string, any[]] {
		const insertClassificationQuery = `
			INSERT INTO integration_data.inferred_business_classifications
			(id, serp_query_id, naics_code, secondary_naics_code, sic_code, secondary_sic_code, legit_business_confidence)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`;
		const classificationValues = [
			uuid(),
			serpQueryId,
			businessLegitimacyClassification.naics_code,
			businessLegitimacyClassification.secondary_naics_code,
			businessLegitimacyClassification.sic_code,
			businessLegitimacyClassification.secondary_sic_code,
			businessLegitimacyClassification.confidence_in_business_legitimacy
		];
		return [insertClassificationQuery, classificationValues];
	}

	private getLocalResultAddressDetails = async (local_results: GoogleLocalResult[]) => {
		try {
			const result = await Promise.all(
				local_results.map(async result => {
					const incorrectAddressRegex = /^[A-Za-z\s]+, [A-Z]{2}(?: \d{5}(?:, USA)?)?$/;
					let addressDetails = {};
					let source: "serp" | "geocoding" = "serp";
					// Trigger reverse geocoding only if the address is missing or incorrect, and GPS coordinates are available.
					if (
						!result.address ||
						(Object.hasOwn(result, "address") &&
							incorrectAddressRegex.test(result.address) &&
							result?.gps_coordinates?.latitude &&
							result?.gps_coordinates?.longitude)
					) {
						const data = await getAddressWithGeoCode(result.gps_coordinates.latitude, result.gps_coordinates.longitude);
						if (data) {
							addressDetails = AddressUtil.stringToParts(data);
							source = "geocoding";
						}
					} else if (result.address) {
						addressDetails = AddressUtil.stringToParts(result.address);
						source = "serp";
					}
					return {
						addressDetails,
						source,
						placeId: result.place_id
					};
				})
			);
			return result;
		} catch (error: any) {
			logger.error(error.message);
		}
	};

	async searchSerpAPI({
		businessID,
		businessName: untrimmedBusinessName,
		businessDbaNames = [],
		businessAddress: untrimmedBusinessAddress,
		persistGoogleReviews = true,
		taskID,
		is_bulk = false,
		includeIndustryAndWebsiteData = true
	}: {
		businessID: UUID;
		businessName: string;
		businessDbaNames?: string[];
		businessAddress: string;
		persistGoogleReviews?: boolean;
		taskID?: UUID;
		is_bulk?: boolean;
		includeIndustryAndWebsiteData?: boolean;
	}) {
		try {
			if (!serpApiKey) {
				throw new DataScrapeApiError(DataScrapeApiErrorCodes.DS_K0001);
			}

			/**
			 * Remove any trailing spaces from the business name and address.
			 */
			const businessName = untrimmedBusinessName.trim();
			const businessAddress = untrimmedBusinessAddress.trim();

			/**
			 * The string to search for.
			 * We use the business name and address to find the business via Google Search.
			 * If there is a business dba name, we can use it in the search to improve the results.
			 * @link https://serpapi.com/maps-local-results#api-parameters-q
			 *
			 * @example
			 *
			 * Input:
			 * - businessName: "Test Business"
			 * - businessAddress: "123 Test St, Test City, TC 12345"
			 * - businessDbaNames: []
			 *
			 * Output:
			 * "Test Business, 123 Test St, Test City, TC 12345"
			 *
			 * @example
			 *
			 * Input:
			 * - businessName: "Test Business"
			 * - businessAddress: "123 Test St, Test City, TC 12345"
			 * - businessDbaNames: ["Test DBA 1"]
			 *
			 * Output:
			 * "Test Business, 123 Test St, Test City, TC 12345 OR Test DBA 1 123 Test St, Test City, TC 12345"
			 *
			 *
			 * Q. Why aren't we using parentheses or AND operators to group the business name / dba name and address?
			 * A. Contrary to popular belief, Google Search does not actually support parentheses or AND operators in the search query.
			 *
			 *    With this knowledge, we create the search string in two different ways (depending on if we have a dba name):
			 *
			 *    1. If we have a dba name, we search for the business name and address as well as the dba name and address, separated by an OR operator.
			 *       This results in a query structured like this: (businessName AND businessAddress) OR (businessDbaName AND businessAddress).
			 *
			 *    2. If we do not have a dba name, we simply search for the business name and address, separated by a comma.
			 * 	  	 This results in a query structured like this: businessName, businessAddress.
			 *
			 *    Refer to this document authored by Dan Russell, a former senior research scientist at Google, for more information on supported search operators:
			 * 	  @link https://docs.google.com/document/d/1ydVaJJeL1EYbWtlfj9TPfBTE5IBADkQfZrQaBZxqXGs/edit?tab=t.0
			 */
			const searchString = businessDbaNames.reduce((acc, businessDbaName) => {
				const dbaName = businessDbaName.trim();

				/** If the dba dbaName is empty or is exactly the same as the business name, skip adding it */
				if (!dbaName || dbaName === businessName) return acc;

				return `${acc} OR ${dbaName}, ${businessAddress}`;
			}, `${businessName}, ${businessAddress}`);
			const q = encodeURIComponent(searchString);
			/**
			 * The decimal latitude and longitude coordinates and zoom level to use for the search.
			 * The current value is a hardcoded GPS coordinate for the center of the United States, zoomed out to a level that shows the entire country (sans Alaska and Hawaii).
			 * The motivation behind using this particular location is to limit the search to the United States.
			 *
			 * PAT-499 TODO: Use the business zip code to get the GPS coordinates and use them in the search for a refined search.
			 * @link https://worth-ai.atlassian.net/browse/PAT-499
			 * @link https://serpapi.com/maps-local-results#api-parameters-ll
			 */
			const ll = "@44.967243,-103.771556,5z";

			const url = `https://serpapi.com/search?api_key=${serpApiKey}&engine=google_maps&type=search&google_domain=google.com&q=${q}&hl=en&ll=${ll}`;

			const response = await axios.get(url, { timeout: envConfig.SYNCHRONOUS_API_TIMEOUT_SECONDS * 1000 });
			const data = response.data;
			const match: GoogleBusinessMatch | null = data?.place_results ?? null;
			const local_results: GoogleLocalResult[] = data?.local_results ?? [];
			const topLocalResult: GoogleLocalResult | null = local_results.length > 0 ? local_results[0] : null;

			let businessMatch: GoogleBusinessMatch | GoogleLocalResult | null = match;

			const serpLogicUpdateFlag: boolean = await getFlagValue(FEATURE_FLAGS.PAT_64_SERP_LOGIC_UPDATE);

			let type: string | null = null;
			if (serpLogicUpdateFlag) {
				type = (businessMatch && businessMatch?.type?.[0]) ?? null;
				if (!businessMatch && is_bulk) {
					if (
						data?.local_results &&
						data.local_results.length > 0 && // check if fuzzy matches returned
						data.local_results[0].type_id && // real businesses return an industry type
						`${data.local_results[0].title}, ${data.local_results[0].address}` === businessAddress // sanity to make sure first fuzzy match is correct
					) {
						businessMatch = local_results[0];
						type = businessMatch.type;
					}
				}
			} else {
				if (is_bulk) {
					businessMatch = match ? match : local_results[0];
				}
			}

			if (!businessMatch && !topLocalResult) {
				logger.info(
					{ searchString },
					`No business match found for businessName: ${businessName} and businessAddress: ${businessAddress}`
				);
				return { businessMatch, local_results, message: "No business match or local results found" };
			}
			if (!businessMatch && local_results.length > 0) {
				if (!taskID) {
					taskID = await this.getOrCreateTaskForCode({
						taskCode: "fetch_business_entity_website_details"
					});
				}
				const enrichedTask = await TaskManager.getEnrichedTask(taskID);
				await TaskManager.saveRawResponseToDB(
					{
						businessMatch: null,
						local_results,
						rawSerpResponse: data
					},
					businessID as UUID,
					enrichedTask,
					INTEGRATION_ID.SERP_SCRAPE,
					"fetch_business_entity_website_details"
				);
				return {
					businessMatch,
					local_results,
					parsedLocalResultAddressDetails: await this.getLocalResultAddressDetails(local_results),
					message: "No business match found, but local results found"
				};
			}

			const businessWebsite = businessMatch?.website ?? topLocalResult?.website ?? null;
			const googleReviewsLink = businessMatch?.reviews_link ?? topLocalResult?.reviews_link ?? null;
			const totalGoogleReviews = businessMatch?.reviews ?? topLocalResult?.reviews ?? null;
			const overallGoogleRating = businessMatch?.rating ?? topLocalResult?.rating ?? null;

			// create task entry
			if (!taskID) {
				taskID = await this.getOrCreateTaskForCode({
					taskCode: "fetch_business_entity_website_details"
				});
			}

			let serializedWebsiteData: SerializedWebsiteData | null = null;
			let businessLegitimacyClassification: BusinessLegitimacyClassification | null = null;

			if (includeIndustryAndWebsiteData) {
				if (businessWebsite) {
					serializedWebsiteData = await this.serializeWebsite(businessWebsite, match);
				}
				logger.info(
					`serializedWebsiteData for businessName: ${businessName} from website: ${businessWebsite} — ${JSON.stringify(serializedWebsiteData, null, 2)}`
				);

				if (serializedWebsiteData) {
					businessLegitimacyClassification = await this.classifyLegitimacy(serializedWebsiteData);
				}
				logger.info(
					`businessLegitimacyClassification for businessName: ${businessName} from website: ${businessWebsite} — ${JSON.stringify(businessLegitimacyClassification, null, 2)}`
				);
			} else {
				logger.info(`Industry and website data are not included. BusinesssName: ${businessName}, ${businessID}`);
			}

			const topGoogleReviews: GoogleReview[] = [];
			if (googleReviewsLink) {
				const googleReviews = await this.scrapeGoogleReviews(googleReviewsLink);
				topGoogleReviews.push(...googleReviews);
			}
			logger.info(
				`topGoogleReviews for businessName: ${businessName} from googleReviewsLink: ${googleReviewsLink} — ${JSON.stringify(topGoogleReviews, null, 2)}`
			);

			let reviewSynthesis: GeneralReviewSynthesis | null = null;
			if (isNonEmptyArray(topGoogleReviews) && overallGoogleRating && totalGoogleReviews) {
				try {
					reviewSynthesis = await this.synthesizeGoogleReviews({
						topGoogleReviews,
						overallRating: overallGoogleRating,
						totalReviews: totalGoogleReviews
					});
				} catch (error) {
					logger.error(error, `Error synthesizing Google reviews for businessName: ${businessName}`);
				}
			}
			logger.info(
				`reviewSynthesis for businessName: ${businessName} from googleReviewsLink: ${googleReviewsLink} — ${JSON.stringify(reviewSynthesis, null, 2)}`
			);

			const serpQueryId = uuid();
			logger.info(`Serp Query Id :: ${serpQueryId}`);

			// 1. Insert into google_maps_serp_queries
			const [serpQuery, serpValues] = this.buildGoogleMapsSerpQueryInsert(
				serpQueryId,
				taskID,
				businessID,
				businessName,
				businessAddress,
				url,
				businessMatch,
				topLocalResult
			);
			logger.info(`Inserting scraped google maps data for businessID: ${businessID}`);
			await sqlTransaction([serpQuery], [serpValues]);

			// 2. Insert into serialized_website_scrapes
			if (includeIndustryAndWebsiteData && serializedWebsiteData) {
				const [websiteDataQuery, websiteDataValues] = this.buildSerializedWebsiteScrapeInsert(
					serpQueryId,
					serializedWebsiteData
				);
				logger.info(`Inserting scraped website data for businessID: ${businessID}`);
				await sqlTransaction([websiteDataQuery], [websiteDataValues]);
			}

			// 3. Insert into reviews
			if (topGoogleReviews && topGoogleReviews.length > 0 && persistGoogleReviews) {
				const [reviewsQuery, reviewsValues] = this.buildReviewsInsert(taskID, topGoogleReviews);
				logger.info(`Inserting scraped reviews for businessID: ${businessID}`);
				await sqlTransaction([reviewsQuery], [reviewsValues]);
			}

			// 4. Insert into inferred_business_classifications
			if (includeIndustryAndWebsiteData && businessLegitimacyClassification) {
				const [classificationQuery, classificationValues] = this.buildInferredBusinessClassificationInsert(
					serpQueryId,
					businessLegitimacyClassification
				);
				logger.info(`Inserting inferred business classification for businessID: ${businessID}`);
				await sqlTransaction([classificationQuery], [classificationValues]);
			}

			// 5. Insert into business_review_synthesis
			if (reviewSynthesis && overallGoogleRating && totalGoogleReviews) {
				const [reviewSynthesisQuery, reviewSynthesisValues] = this.buildBusinessReviewSynthesisInsert(
					serpQueryId,
					reviewSynthesis,
					overallGoogleRating,
					totalGoogleReviews
				);
				logger.info(`Inserting business review synthesis for businessID: ${businessID}`);
				await sqlTransaction([reviewSynthesisQuery], [reviewSynthesisValues]);
			}

			// TEMPORARY: Insert into public_records
			try {
				const website = businessMatch?.website || topLocalResult?.website || null;
				logger.info(`Inserting into public_records for businessID: ${businessID}`);
				await sqlQuery({
					sql: `INSERT INTO integration_data.public_records
				(business_integration_task_id, average_rating, monthly_rating, google_review_count, google_review_percentage, official_website)
				VALUES($1, $2, $3, $4, $5, $6)`,
					values: [taskID, overallGoogleRating, overallGoogleRating, totalGoogleReviews, 1, website]
				});
			} catch (ex) {
				logger.error(`Error inserting into public_records: ${JSON.stringify(ex)}`);
			}

			const searchSerpAPIResponse: any = {
				businessMatch,
				parsedBusinessMatchAddressDetails: {
					addressDetails: AddressUtil.stringToParts(businessMatch?.address ?? ""),
					placeId: businessMatch?.place_id
				},
				local_results,
				parsedLocalResultAddressDetails: await this.getLocalResultAddressDetails(local_results),
				topLocalResult,
				businessWebsite,
				googleReviewsLink,
				totalGoogleReviews,
				overallGoogleRating,
				topGoogleReviews,
				reviewSynthesis
			};

			if (includeIndustryAndWebsiteData) {
				searchSerpAPIResponse.serializedWebsiteData = serializedWebsiteData;
				searchSerpAPIResponse.businessLegitimacyClassification = businessLegitimacyClassification;
			}

			const rawIntegrationDataSerp: any = { ...searchSerpAPIResponse, rawSerpResponse: data };

			if (includeIndustryAndWebsiteData) {
				rawIntegrationDataSerp.rawWebsiteScrapeResponse = serializedWebsiteData;
			}

			await uploadRawIntegrationDataToS3(
				rawIntegrationDataSerp,
				businessID,
				"business_serp_scrape",
				DIRECTORIES.BUSINESS_SERP_SCRAPE,
				"SERP"
			);

			// update the task status to success
			await this.updateTaskStatus(taskID, TASK_STATUS.SUCCESS);
			const enrichedTask = await TaskManager.getEnrichedTask(taskID);
			// Pass the raw response to case-service which can extract needed data like website
			enrichedTask.metadata = {
				...searchSerpAPIResponse.businessMatch,
				website: businessWebsite
			};
			await this.sendTaskCompleteMessage(enrichedTask);
			await TaskManager.saveRawResponseToDB(
				{
					...searchSerpAPIResponse,
					rawSerpResponse: data
				},
				businessID as UUID,
				enrichedTask,
				INTEGRATION_ID.SERP_SCRAPE,
				"fetch_business_entity_website_details"
			);

			// Set industry, naics and mcc code
			let naicsCode = searchSerpAPIResponse?.businessLegitimacyClassification?.naics_code;
			const industryCode = searchSerpAPIResponse?.serializedWebsiteData?.industry_mapped;

			if (!naicsCode) {
				const naics = await this.predictNaicsCode(businessName, type ?? "", businessMatch?.website ?? "");
				const confidence = await this.determineIndustryConfidence(searchString, naics);
				if (confidence && confidence === "HIGH") {
					naicsCode = naics;
				}
			}

			if (naicsCode) {
				const message = {
					business_id: businessID,
					naics_code: naicsCode,
					naics_title: "",
					platform: "serp_scrape",
					industry_code: industryCode
				};
				logger.info(message);
				const payload = {
					topic: kafkaTopics.BUSINESS,
					messages: [
						{
							key: businessID,
							value: {
								event: kafkaEvents.UPDATE_NAICS_CODE,
								...message
							}
						}
					]
				};
				await producer.send(payload);
			}

			return {
				message: "Business entity website details fetched successfully",
				...searchSerpAPIResponse
			};
		} catch (error) {
			logger.error({ error }, "Error searching SerpAPI");
			// @TODO: ENG-24 Replace SERP -- this is a hacky workaround to make sure we're not just throwing a 400 if SERP times out
			if (isAxiosError(error) && error.code === "ECONNABORTED") {
				return {
					message: "We had an issue with the search, please try again later.",
					businessMatch: null,
					parsedBusinessMatchAddressDetails: null,
					local_results: [],
					parsedLocalResultAddressDetails: [],
					topLocalResult: null,
					businessWebsite: null,
					googleReviewsLink: null,
					totalGoogleReviews: null,
					overallGoogleRating: null,
					topGoogleReviews: [],
					reviewSynthesis: null
				};
			}
			throw DataScrapeApiError.fromError(error, DataScrapeApiErrorCodes.DS_I0005);
		}
	}

	/**
	 * Gets NAICS code prediction from OpenAI
	 * @param {string} companyName - Company name
	 * @param {string} businessType - Business type identifier
	 * @param {string} website - Company website
	 * @returns {Promise<string|null>} NAICS code or null if invalid
	 */
	async predictNaicsCode(companyName = "", businessType = "", website = "") {
		try {
			const prompt = `Below will be company details. Please respond only with the approximate 6 digit NAICS 2022 edition code or 000000 if you do not have enough information.
				Business Details: ${companyName} ${businessType} ${website}`;

			const chatCompletion = await this.client.chat.completions.create({
				messages: [{ role: "user", content: prompt }],
				model: OPENAI_MODEL_VERSION
			});

			const response = chatCompletion.choices[0].message.content;
			// Return null if response is 000000 or not a valid NAICS code
			return response && response.match(/^\d{6}$/) ? response : null;
		} catch (error) {
			logger.error({ error }, "Error predicting NAICS code");
			return null;
		}
	}

	/**
	 * Determines confidence level for NAICS code prediction
	 * @param {string} businessDetails - Combined business details
	 * @param {string} naicsCode - Predicted NAICS code
	 * @returns {Promise<number>} Confidence score between 0 and 1
	 */
	async determineIndustryConfidence(businessDetails: string, naicsCode: string | null) {
		try {
			if (!naicsCode || naicsCode.trim() === "") return "";

			const prompt = `Given the following business details and predicted NAICS code, respond with confidence in the prediction.
				Business Details: ${businessDetails}
				Predicted NAICS Code: ${naicsCode}
				
				Only respond with the HIGH, MED, or LOW (e.g., HIGH).
				
				HIGH = NAICS code could be correct, NOTE: most codes will be correct
				MED = NAICS code might be incorrect
				LOW = NAICS code definitely not correct`;

			const chatCompletion = await this.client.chat.completions.create({
				messages: [{ role: "user", content: prompt }],
				model: OPENAI_MODEL_VERSION
			});

			const confidence = chatCompletion.choices[0].message.content;

			return confidence;
		} catch (error) {
			logger.error({ error }, "Error determining industry confidence");
			return 0;
		}
	}

	// --- Utility Functions ---
	private getGoogleSearchLink(title: string): string {
		const cleanedTitle = title.replace(/[^a-zA-Z0-9\s]/g, "").trim();
		return `https://www.google.com/search?q=${encodeURIComponent(cleanedTitle)}`;
	}

	private buildGoogleProfile(entry: any): GoogleProfile {
		const rawAddress = entry?.address || null;
		const enhancedAddress = rawAddress ? AddressUtil.addCountryToAddress(rawAddress) : null;

		return {
			business_name: entry?.title || null,
			address: enhancedAddress,
			phone_number: entry?.phone || null,
			website: entry?.website || null,
			rating: entry?.rating || null,
			reviews: entry?.reviews || null,
			thumbnail: entry?.thumbnail || null,
			gps_coordinates: entry?.gps_coordinates || null,
			google_search_link: entry?.title ? this.getGoogleSearchLink(entry.title) : null
		};
	}

	// --- Main Function ---
	async getLatestSerpResultForBusiness(businessID: UUID): Promise<DataScrapeServiceType.SerpMatchResponse> {
		const response: DataScrapeServiceType.SerpMatchResponse = {
			business_match: "Not Found",
			google_profile: {
				business_name: null,
				address: null,
				phone_number: null,
				website: null,
				rating: null,
				reviews: null,
				thumbnail: null,
				gps_coordinates: {
					latitude: null,
					longitude: null
				},
				google_search_link: null
			},
			address_match: "Not Matched",
			address_similarity_score: 0
		};

		try {
			const latestSerp = await db("integration_data.request_response")
				.select("*")
				.where({ business_id: businessID, platform_id: DataScrapeService.PLATFORM_ID })
				.orderBy("requested_at", "desc")
				.first();

			if (!latestSerp?.response) return response;

			const businessDetailsRes = await getBusinessDetails(businessID);
			const businessData = businessDetailsRes?.data;
			const validBusinessData = businessData && typeof businessData === "object" && !("errorName" in businessData);

			let businessAddress = "";
			if (validBusinessData) {
				businessAddress = [
					businessData.address_line_1,
					businessData.address_city,
					businessData.address_state,
					businessData.address_postal_code
				]
					.filter(Boolean)
					.join(", ");
			}

			const { businessMatch, local_results } = latestSerp.response;

			if (typeof businessMatch === "object" && businessMatch !== null) {
				response.business_match = "Match Found";
				response.google_profile = this.buildGoogleProfile(businessMatch);

				const serpAddress = businessMatch.address;
				let address_similarity_score = 0;
				let address_match = "Not Matched";

				if (serpAddress && businessAddress) {
					address_similarity_score = fuzz.token_set_ratio(businessAddress, serpAddress);

					if (address_similarity_score > DataScrapeService.FUZZY_MATCH_THRESHOLD) {
						address_match = "Match";
					} else if (address_similarity_score > DataScrapeService.FUZZY_PARTIAL_THRESHOLD) {
						address_match = "Partial Match";
					}
				}

				response.address_match = address_match;
				response.address_similarity_score = address_similarity_score;
			} else if (Array.isArray(local_results)) {
				let bestScore = 0;
				let bestLocalResult = null;

				for (const localResult of local_results) {
					if (localResult?.address && businessAddress) {
						const score = fuzz.token_set_ratio(businessAddress, localResult.address);
						if (score > bestScore) {
							bestScore = score;
							bestLocalResult = localResult;
						}
					}
				}

				if (bestScore > DataScrapeService.FUZZY_PARTIAL_THRESHOLD && bestLocalResult) {
					response.business_match = "Potential Match";
					response.address_match = "Partial Match";
					response.google_profile = this.buildGoogleProfile(bestLocalResult);
					response.address_similarity_score = bestScore;
				}
			}

			if (
				response.google_profile?.business_name &&
				validBusinessData &&
				businessData.name &&
				fuzz.token_set_ratio(response.google_profile.business_name, businessData.name) <
					DataScrapeService.FUZZY_MATCH_THRESHOLD
			) {
				response.business_match = "Potential Match";
			}

			return response;
		} catch (error) {
			logger.error(error, "Error fetching latest request_response");
			throw DataScrapeApiError.fromError(error, DataScrapeApiErrorCodes.DS_I0006);
		}
	}
}

export const dataScrapeService = new DataScrapeService();

export const getDataScrapeService = async (businessID: UUID) => {
	const dataScrapeService = new DataScrapeService();
	await dataScrapeService.createConnection({ business_id: businessID, options: {} });
	return dataScrapeService;
};
