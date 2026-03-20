import { FEATURE_FLAGS, INTEGRATION_ID, type EventEnum } from "#constants";
import { AIEnrichment } from "./aiEnrichment";
import { FactEngine } from "#lib/facts/factEngine";
import { allFacts } from "#lib/facts";
import { combineFacts } from "#lib/facts/rules";
import { getOrCreateConnection, platformFactory } from "#helpers/platformHelper";
import { logger } from "#helpers/logger";
import { AddressUtil } from "#utils/addressUtil";
import { getFlagValue } from "#helpers/LaunchDarkly";

import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types/db";
import type OpenAI from "openai";
import type { Knex } from "knex";
import type BullQueue from "#helpers/bull-queue";
import type { DependentTask } from "#api/v1/modules/tasks/types";
import type { EntityMatching } from "#lib/entityMatching/entityMatching";
import type { BusinessAddress } from "#helpers/api";
import type { JobOptions } from "bull";
import type { UUID } from "crypto";
import { FactName } from "#lib/facts/types";
import { getFactKeys } from "#lib/facts/utils";

type Confidence = "HIGH" | "MED" | "LOW" | null;
type AddressComponents = {
	is_physical: boolean;
	line1: string;
	line2: string;
	city: string;
	state: string;
	postal_code: string; // 5 digit US zip code or 6 digit CA postal code
	postal_full: string; // 5 digit+4 digit US zip code or 6 digit CA postal code with the hyphen
	country: "US" | "CA" | string; // ISO 3166-1 alpha-2
	confidence: Confidence;
};
export type AISanitizationResponse = {
	reasoning: string;
	new_names: string[];
	new_addresses: string[];
	new_addresses_components: AddressComponents[];
	is_sole_proprietor: boolean | null;
	sole_proprietor_confidence: Confidence;
	new_address_confidence: Confidence;
	new_name_confidence: Confidence;
	confidence: Confidence;
};

export class AISanitization extends AIEnrichment {
	static readonly PLATFORM_ID = INTEGRATION_ID.AI_SANITIZATION;
	static readonly DEPENDENT_TASKS: Partial<DependentTask> = {
		fetch_business_entity_verification: [
			{ platformId: INTEGRATION_ID.ZOOMINFO, timeoutInSeconds: 60 * 3 },
			{ platformId: INTEGRATION_ID.OPENCORPORATES, timeoutInSeconds: 60 * 3 },
			{ platformId: INTEGRATION_ID.CANADA_OPEN, timeoutInSeconds: 60 * 3 }
		],
		fetch_public_records: [{ platformId: INTEGRATION_ID.EQUIFAX, timeoutInSeconds: 60 * 3 }],
		fetch_business_entity_website_details: [{ platformId: INTEGRATION_ID.SERP_SCRAPE, timeoutInSeconds: 60 * 3 }]
	};
	static readonly DEPENDENT_FACTS = {
		// The facts with minimum source of 0 ensure that we evaluate them and pass them into the prompt anyways
		business_names_submitted: { minimumSources: 1 },
		business_addresses_submitted: { minimumSources: 1 },
		// Setting maximumSources to 1 makes it so if there are any internal platform matches the task gets skipped and essentially becomes a no-op
		internal_platform_matches: { minimumSources: 0, maximumSources: 1 }
	};
	static readonly TASK_TIMEOUT_IN_SECONDS = 60 * 3; // 3 minutes
	declare protected staticRef: typeof AISanitization;

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
		// Pick only the facts in the dependent facts object to resolve
		const filteredFacts = AISanitization.selectFacts(getFactKeys(AISanitization.DEPENDENT_FACTS), allFacts);
		const factEngine = new FactEngine(filteredFacts, { business: dbConnection.business_id });
		factEngine.addRuleOverride(["names", "addresses"], combineFacts);
		super({ dbConnection, db, openaiClient, bullQueue, factEngine });
		this.staticRef = this.constructor as typeof AISanitization;
	}

	protected calculateConfidence(input: Confidence): number {
		switch (input) {
			case "HIGH":
				return 0.2;
			case "MED":
				return 0.15;
			case "LOW":
				return 0.1;
			default:
				return 0;
		}
	}

	/**
	 *
	 * @param taskId
	 * @param jobOpts
	 * 	Enqueues the task if the feature flag is enabled
	 * @deprecated
	 * Remove whole method once feature flag becomes unnecessary (will just called the super method)
	 */
	public async enqueueTask(taskId: UUID, jobOpts?: Partial<JobOptions>): Promise<void> {
		const featureEnabled = await getFlagValue(FEATURE_FLAGS.TIG_50_NAME_ADDR_SANITIZATION);
		if (featureEnabled) {
			await super.enqueueTask(taskId, jobOpts);
		}
	}

	/**
	 * Executes post processing for the AI Sanitization task:
	 * 	Invokes the Entity Matching task if new addresses or names are found
	 * @param enrichedTask - The enriched task
	 * @param response - The response from the AI Sanitization task
	 * @returns void
	 */
	public async executePostProcessing<T, R>(
		enrichedTask: IBusinessIntegrationTaskEnriched<T>,
		response: R
	): Promise<void> {
		const sanitizationResponse = response as AISanitizationResponse;

		// Don't run if nothing new found
		const numFoundItems =
			(sanitizationResponse.new_addresses_components?.length ?? 0) + (sanitizationResponse.new_names?.length ?? 0);
		if (numFoundItems === 0) {
			return;
		}
		const entityMatchingConnection = await getOrCreateConnection(
			this.dbConnection.business_id,
			INTEGRATION_ID.ENTITY_MATCHING
		);
		const entityMatching = platformFactory<EntityMatching>({ dbConnection: entityMatchingConnection });
		const entityMatchingTaskId = await entityMatching.createTaskForCode({
			taskCode: "fetch_business_entity_verification",
			scoreTriggerId: enrichedTask.business_score_trigger_id
		});
		if (entityMatchingTaskId) {
			try {
				await entityMatching.processTask({ taskId: entityMatchingTaskId });
			} catch (error) {
				logger.error(error, `Error invoking Entity Matching task: ${error}`);
			}
		}
	}

	/*
	 * Gets Name & Address Sanitization from OpenAI
	 * @param {Record<string,any>} params - Business details
	 * @returns {Promise<string>} Generated prompt
	 */
	async getPrompt(params: {
		business_names_submitted: string[];
		business_addresses_submitted: BusinessAddress[];
	}): Promise<string> {
		let str = "";
		if (params.business_names_submitted) {
			str += "business names:\n  ";
			str += params.business_names_submitted.join("\n  ");
			str += "\n";
		}
		if (params.business_addresses_submitted) {
			const addresses = params.business_addresses_submitted as BusinessAddress[];
			str += "business addresses:\n  ";
			str += addresses
				.map(address => {
					const baseAddress = `${address.line_1 ?? ""}, ${address.apartment ?? ""}, ${address.city ?? ""}, ${address.state ?? ""}, ${address.postal_code ?? ""} ${address.country ?? ""}`;
					return AddressUtil.normalizeString(baseAddress);
				})
				.join("\n  ");
			str += "\n";
		}

		return `
You are an expert at correcting business names and addresses and inferring if a business is a sole proprietor by the names provided.

      COMMON ADJUSTMENTS TO NAMES:
      SLASHES (/) between words indicate a new set of names, so split them into separate names.
      PARENTHESIS () indicate a new set of names, so split them into separate names.
      If you note a common misspelling in a name, add a correction to the array of names. Do not correct misspellings if it appears to be a person's name.

      COMMON ADJUSTMENTS TO ADDRESSES:
      Convert spelled out numbers to numeric numbers (for example "one" to "1", "one thousand to 1000")
	  Convert spelled out directions to their numeric equivalents (for example "north" to "N", "south" to "S", "east" to "E", "west" to "W")
	  Convert spelled out street names to their abbreviations (for example "street" to "st", "avenue" to "ave", "road" to "rd", "drive" to "dr", "court" to "ct")
      Remove components that are not part of a mailing address (for example, if the business name or a person's nameis part of the address, remove it)
      Remove any non-address components (for example, if the address is part of a larger address, remove the larger address)
      Correct any obvious spelling mistakes in an address
	  Split the address into components: line1, line2, city, state, postal, postal_full, country, is_physical
		line1: The first line of the address
		line2: The second line of the address. Usually contains floor, suite, or office number.
		city: The city of the address
		state: The state of the address
		postal: The postal code of the address. Usually 5 digits for US and 6 digits for CA.
		postal_full: The postal code of the address with the hyphen. Usually 9 digits for US with a hyphenand 6 digits for CA.
		country: The two letter country code of the address. Usually "US" or "CA". Determine by the state or postal code.
		is_physical: Whether the address is a physical address. Usually true for addresses that are not a PO box.

      SOLE PROPRIETORSHIP INFERENCE:
      If the business name is person's name, and the address is a residential address, then the business is likely a sole proprietor.

      Business Details: 
      ${str}
      Determine new business names and addresses that are likely to be correct from the given names and addresses.
      Respond only with new names and addresses determined. Do not consider capitalization differences as changes.
      If unable to determine with a high level of confidence of a sole proprietor, return null.
      Return confidence level of each prediction as HIGH, MED, or LOW based on notes.
      In the absence of any evidence, return empty arrays and LOW confidence.
      The "confidence" field should be the lowest confidence of the new_names, new_addresses, and is_sole_proprietor fields.

      EXAMPLES: 
      provided names: 
        TSA MEELAP, INC. / TNB MEELAP, INC. / CHILI THAI, INC. / MEELAP, INC. / MEELAPWA, INC
      new_names: ["TSA MEELAP, INC.", "TNB MEELAP, INC.", "CHILI THAI, INC.", "MEELAP, INC.", "MEELAPWA, INC."]

      provided names: IBM COMPTER
      new_names: ["IBM COMPUTER"]

      provided address: 
        ONE THOUSAND MAIN STRET, WORCESTER, MA 02190
        MATTS SUBS 200 SOUTH ORANGE AVE SUITE 300, APPLE, NJ 07050
      new_addresses: ["1000 MAIN STREET, WORCESTER, MA 02190", "200 SOUTH ORANGE AVENUE, APPLE, NJ 07050"]
      new_address_components: [{line1: "1000 MAIN STREET", line2: null,city: "Worcester", state: "MA", postal_code: "02190", country: "US", confidence: "HIGH"}, {line1: "200 S ORANGE AVENUE", line2: "SUITE 300", city: "Apple", state: "NJ", postal_code: "07050", country: "US", confidence: "HIGH"}]
      provided names: "JOHN SMITH"
      is_sole_proprietor: true

      Return JSON in this format:
      {
        reasoning: "enter notes about your thought process and determinations"
        new_names: ["name1", "name2"],
        new_name_confidence: "HIGH",
        new_addresses: ["address1", "address2"],
        new_addresses_components: [ {line1:"", line2: "", city: "", state: "", postal_code: "", postal_full: "",country: "", confidence: ""} ]
        new_address_confidence: "HIGH",
        is_sole_proprietor: true|false|null,
        sole_proprietor_confidence: "HIGH"|"MED"|"LOW"|null,
        confidence: "HIGH"|"MED"|"LOW"|null,
      }`;
	}
}
