import { INTEGRATION_ID } from "#constants";
import { AIEnrichment } from "./aiEnrichment";
import { FactEngine } from "#lib/facts/factEngine";
import { kybFacts } from "#lib/facts/kyb";
import { businessFacts } from "#lib/facts/businessDetails";
import { logger } from "#helpers/logger";
import { envConfig } from "#configs/index";
import axios from "axios";

import type { IDBConnection } from "#types/db";
import type OpenAI from "openai";
import type { Knex } from "knex";
import type BullQueue from "#helpers/bull-queue";
import type { SourceName } from "#lib/facts/sources";
import { FactName } from "#lib/facts/types";
import { getFactKeys } from "#lib/facts/utils";

export type AIWebsiteEnrichmentResponse = {
	company_website: {
		name: string;
		url: string;
		is_business_website: boolean;
		is_business_review_site: boolean;
		is_business_registry: boolean;
		is_background_check: boolean;
		is_inventory_listing: boolean;
		company_domain: string;
	};
	search_results: any;
	confidence: "HIGH" | "MED" | "LOW";
	reasoning: string;
};

export class AIWebsiteEnrichment extends AIEnrichment {
	static readonly PLATFORM_ID = INTEGRATION_ID.AI_WEBSITE_ENRICHMENT;
	static readonly DEPENDENT_FACTS = {
		// Required facts for website search
		business_name: { minimumSources: 1 },
		state: { minimumSources: 1 },
		city: { minimumSources: 1 },
		// If we already have enough website sources, don't run
		website: { maximumSources: 2, minimumSources: 0, ignoreSources: ["AIWebsiteEnrichment"] as SourceName[] }
	};
	static readonly TASK_TIMEOUT_IN_SECONDS = 60 * 5; // 5 minutes
	declare protected staticRef: typeof AIWebsiteEnrichment;

	constructor({
		dbConnection,
		db,
		openaiClient,
		bullQueue
	}: {
		dbConnection: IDBConnection;
		db: Knex;
		openaiClient: OpenAI;
		bullQueue: BullQueue;
	}) {
		// Combine the fact definitions from kyb and businessDetails
		const allFacts = [...kybFacts, ...businessFacts];
		// Pick only the facts in the dependent facts object to resolve
		const filteredFacts = AIWebsiteEnrichment.selectFacts(getFactKeys(AIWebsiteEnrichment.DEPENDENT_FACTS), allFacts);
		const factEngine = new FactEngine(filteredFacts, { business: dbConnection.business_id });
		super({ dbConnection, db, openaiClient, bullQueue, factEngine });
		this.staticRef = this.constructor as typeof AIWebsiteEnrichment;
	}

	/**
	 * Compile website URLs from company name
	 */
	public async compileCompanyWebsites(businessInfo: {
		business_name: string;
		city?: string;
		state?: string;
		dba?: string;
	}): Promise<any> {
		let companyWebsites: Array<{ name: string; url: string; raw_search_result: any }> = [];
		let searchPromises: Promise<any | null>[] = [];
		const searchQueries: string[] = [];

		const isGovernment = this.getGovernmentKeywords().some(keyword =>
			businessInfo.business_name.toLowerCase().includes(keyword)
		);

		const searchString = isGovernment
			? `${businessInfo.business_name} ${businessInfo.state}`
			: `${businessInfo.business_name} ${businessInfo.city} ${businessInfo.state}`;

		// METHOD 1: city and state lookup
		if (businessInfo.city && businessInfo.state) {
			searchQueries.push(searchString);
			searchPromises.push(this.searchGoogle(searchString).then(results => results?.[0]));
		}

		// METHOD 2: exact name lookup
		if (businessInfo.business_name) {
			const exactNameQuery = `"${businessInfo.business_name}"`;
			searchQueries.push(exactNameQuery);
			searchPromises.push(this.searchGoogle(exactNameQuery).then(results => results?.[0]));
		}

		// Wait for all searches to complete in parallel
		const searchResults = await Promise.all(searchPromises);

		// use ai to clean first result
		if (searchResults.length > 0) {
			return searchResults[0];
		}
		return null;
	}

	/**
	 * Gets a combined prompt that does both search result analysis and website confidence evaluation
	 * @param {Record<string,any>} params - Business details
	 * @returns {Promise<string>} Combined prompt to feed to OpenAI
	 */
	async getPrompt(params: Record<string, any>): Promise<string> {
		// First compile websites from search with AI processing
		const searchResults = await this.compileCompanyWebsites({
			business_name: params.business_name,
			city: params.city,
			state: params.state
		});

		return `START DATA RESEARCH MODE

            We are attempting to extract information from this search result.
            ${JSON.stringify(searchResults)}

            Free background, public records check website set is_background_check to true i.e. peekyou, instant checkmate, white pages, simple contacts.
            Inventory pages related to a sku code like a book result or inventory item set is_inventory_listing to true.
            Government or secretary of state website and business search profile aggregators (bbb, sba, business directory, npi, mapquest, edgar, bankruptcy, liens) set is_business_registry to true.
            Official business website or business social media (not personal) then set is_business_website to true, otherwise set to false for irrelevant websites such as wikipedia or community sites.
            Business review sites like yelp (profile not search), google places, facebook, tripadvisor then set is_business_review_site to true.
            Extrapolate full company_name when is_business_review_site or is_business_website is true.
            Extrapolate the company domain only when is_business_website is true.
			If a valid URL cannot be found set "url" to null

            FILTERING LOGIC:
            - Only include websites where is_business_registry === false
            - Only include websites that have a valid company_url
            - Exclude business registries, government databases, and directory listings

            CONFIDENCE ASSESSMENT:
            Evaluate overall quality and assign confidence level:
            - HIGH: Multiple relevant business websites found with strong name/domain matches, not business registries
            - MED: Some relevant websites found but with moderate confidence in matches
            - LOW: Few or questionable website matches found, or mostly business registries

            Return JSON in this format:
            {
            "company_website": 
                {
                "name": "Company Name",
                "url": "https://example.com",
                "is_business_website": true,
                "is_business_review_site": false,
                "is_business_registry": false,
                "is_background_check": false,
                "is_inventory_listing": false,
                "company_domain": "example.com"
                },
            "search_results": ${JSON.stringify(searchResults)},
            "confidence": "HIGH",
            "reasoning": "Explanation of confidence level and website quality assessment"
            }`;
	}

	/**
	 * Gets the list of government entity keywords for identification
	 * @private
	 * @returns {string[]} Array of government keywords
	 */
	private getGovernmentKeywords(): string[] {
		return ["city of", "county", "state of", "town of", "township"];
	}

	/**
	 * Searches google search engine using SERP API
	 * @param {string} searchQuery - The search query string
	 * @returns {Promise<Object[]|null>} A promise that resolves with search results if found, or null if error
	 */
	private async searchGoogle(searchQuery: string): Promise<any[] | null> {
		try {
			const serpApiKey = envConfig.SERP_API_KEY;
			if (!serpApiKey) {
				logger.warn("SERP API key not configured, skipping Google search");
				return null;
			}

			const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}+%2Dfiletype%3Apdf+%2Dfiletype%3Adoc&gl=us&hl=en&api_key=${serpApiKey}`;

			const response = await axios.get(url, { timeout: envConfig.SYNCHRONOUS_API_TIMEOUT_SECONDS * 1000 });
			const data = response.data;

			return data.organic_results || [];
		} catch (error) {
			logger.error({ error }, "Error searching Google via SERP API");
			return null;
		}
	}
}
