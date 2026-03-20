/* Match Integration Service - Business Entity Verification */
import { EVENTS, INTEGRATION_ID, type EventEnum } from "#constants";
import { BusinessDetails, BusinessOwner, getBusinessDetails, logger } from "#helpers/index";
import { BusinessEntityVerificationService as BusinessEntityVerification } from "#api/v1/modules/verification/businessEntityVerification";
import { type TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import type { FactName, Fact } from "#lib/facts/types";
import {
	Secrets,
	MatchTaskMetadata,
	MatchPreviousReview,
	TerminationInquiryRequest,
	TerminationInquiryResponse
} from "./types";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types/db";
import { matchConnection } from "#api/v1/modules/match-pro/matchConnection";
import { FactEngine } from "#lib/facts";
import { isMatchPrebuiltMerchant } from "./typeguards/isMatchPrebuiltMerchant";
import { businessFacts } from "#lib/facts/businessDetails";
import { factWithHighestConfidence } from "#lib/facts/rules";
import { envConfig } from "#configs";
import { normalizePhoneNumber, removeSpecialCharacters } from "#utils/normalizer";
import { normalizeCountryCode } from "#utils/addressUtil";
import { MatchUtil } from "./matchUtil";
import { resolveTargetIcas, prepareBusinessData, executeIcaBatches, aggregateResults } from "./matchExecutor";
import _ from "lodash";

/** Resolved business facts from FactEngine.getResults (Record<FactName, Partial<Fact>>). */
type AllBusinessFacts = Record<FactName, Partial<Fact>>;

/** Merchant info fields used to build termination inquiry (without address/principals). */
type MerchantInfoInput = Omit<
	TerminationInquiryRequest["terminationInquiryRequest"]["merchant"],
	"address" | "principals" | "merchantId" | "subMerchantId" | "countrySubdivisionTaxId" | "searchCriteria"
>;

/** Business address element (from BusinessDetails or facts). */
type BusinessAddressInput = {
	line_1?: string;
	apartment?: string | null;
	city?: string;
	state?: string;
	postal_code?: string;
	country?: string;
	is_primary?: boolean;
};

/**
 * Match Integration Service
 *
 * This class handles business entity verification through the Mastercard Match platform.
 * It extends BusinessEntityVerificationService to provide standardized business verification
 *
 */
export class Match extends BusinessEntityVerification {
	// Required static properties for integration framework
	public static BULK_NAMED_JOB: EventEnum = EVENTS.MATCH_PRO_BULK;
	public readonly MIN_INDEX = 45; // Minimum similarity index threshold
	protected static readonly PLATFORM_ID = INTEGRATION_ID.MATCH;

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
	}

	/**
	 * Task handler mapping for different integration tasks
	 * Maps task codes to their corresponding handler methods
	 */
	taskHandlerMap: TaskHandlerMap = {
		fetch_business_entity_verification: async taskId => {
			const task = await Match.getEnrichedTask<MatchTaskMetadata | null>(taskId);
			const metadata = task.metadata;
			const customerID = metadata && "customerID" in metadata ? metadata.customerID : task.customer_id;

			if (!customerID) {
				await this.updateTask(taskId, { metadata: { status: `Error: There is no customerID in the Match-pro task` } });
				logger.error({ taskId }, "There is no customerID in the Match-pro task");
				return true;
			}

			// Get Customer credentials from Secrets
			const customerKeys: Secrets | null = await matchConnection.getCustomerCredentials(customerID);
			if (!customerKeys?.isActive) {
				await this.updateTask(taskId, {
					metadata: { status: `Match-pro verification is not active for customer: ${customerID}` }
				});
				logger.info({ taskId, customerID }, "Match-pro verification is not active for customer");
				return true;
			}

			// Resolve target ICAs
			const metadataIcas = metadata && "icas" in metadata ? metadata.icas : undefined;
			const { targetIcas, icaObjects, error: icaError } = resolveTargetIcas(metadataIcas, customerKeys);
			if (icaError) {
				await this.updateTask(taskId, { metadata: { status: `Error: ${icaError}` } });
				logger.error({ taskId, customerID, businessId: task.business_id }, icaError);
				return true;
			}
			if (targetIcas.length === 0) {
				await this.updateTask(taskId, { metadata: { status: "Error: No valid ICA found for Match-pro verification" } });
				logger.error({ taskId, businessId: task.business_id }, "No valid ICA found for Match-pro verification");
				return true;
			}

			// Prepare business data and facts
			let prepared: { businessData: BusinessDetails; allBusinessFacts: AllBusinessFacts };
			try {
				const result = await prepareBusinessData(task.business_id as string);
				if ("error" in result) {
					await this.updateTask(taskId, { metadata: { status: `Error: ${result.error}` } });
					logger.error({ taskId, businessId: task.business_id }, result.error);
					return true;
				}
				prepared = result;
			} catch (err) {
				logger.error(
					{ error: err, taskId, businessId: task.business_id },
					"Failed to prepare business data and facts for Match-pro verification"
				);
				await this.updateTask(taskId, {
					metadata: { status: "Error: Failed to prepare business data and facts for Match-pro verification" }
				});
				throw err;
			}

			// Execute ICA batches
			const latestRecord = await MatchUtil.getMatchBusinessResult({ businessID: task.business_id });
			const executionResults = await executeIcaBatches(
				targetIcas,
				task,
				prepared.businessData,
				prepared.allBusinessFacts,
				customerKeys,
				latestRecord
			);

			// Aggregate and persist
			const aggregatedRecord = aggregateResults(executionResults, icaObjects);
			await this.saveRequestResponse(task, aggregatedRecord, customerID);
			await this.updateTask(taskId, { metadata: JSON.stringify(aggregatedRecord) });

			return true;
		}
	};

	/**
	 * Creates the JSON payload for the Mastercard MATCH Inquiry API
	 * from the provided business data object.
	 *
	 * @param {object} task - The current task.
	 * @param {string} ica - ICA identifier to use for the inquiry.
	 * @returns {object} The formatted payload for the Mastercard MATCH Inquiry API.
	 */
	static async createMatchInquiryPayload(
		task: IBusinessIntegrationTaskEnriched<MatchTaskMetadata | null>,
		ica: string,
		businessDataOverride?: { data: BusinessDetails },
		allBusinessFactsOverride?: AllBusinessFacts
	): Promise<TerminationInquiryRequest> {
		/** Use pre-built merchant payload from rerun integrations adapter when available */
		if (isMatchPrebuiltMerchant(task.metadata)) {
			const { merchant } = task.metadata;
			return Match.buildTerminationInquiryPayload(merchant, merchant.principals, merchant.address, ica);
		}

		const businessData = businessDataOverride ?? (await getBusinessDetails(task.business_id));

		let allBusinessFacts: AllBusinessFacts;

		if (allBusinessFactsOverride) {
			allBusinessFacts = allBusinessFactsOverride;
		} else {
			const factEngine = new FactEngine(businessFacts, { business: task.business_id });
			// Apply rules to get the best data from multiple sources
			await factEngine.applyRules(factWithHighestConfidence);
			// Get all resolved facts
			const facts = await this.waitForCompleteFacts(factEngine);
			if (!facts) throw new Error("Failed to get all business facts");

			allBusinessFacts = facts;
		}

		// Validate input
		if (!Match.isValidBusinessData(businessData)) {
			throw new VerificationApiError(
				`Invalid input: The businessData object is missing or does not contain a 'data' key.`
			);
		}

		const data = businessData.data as BusinessDetails;

		// Extract and transform data
		const merchantInfo = Match.extractMerchantInfo(data, allBusinessFacts);
		// Safely extract owners and business_addresses if they exist
		const owners = data.owners ?? [];
		const principals = Match.transformOwnersToPrincipals(owners, allBusinessFacts?.business_phone?.value);

		const businessAddresses = data.business_addresses ?? [];
		const address = Match.extractPrimaryAddress(
			businessAddresses,
			allBusinessFacts.business_addresses_submitted?.value as BusinessAddressInput[]
		);

		// Construct the final payload
		return Match.buildTerminationInquiryPayload(merchantInfo as MerchantInfoInput, principals, address, ica);
	}

	/**
	 * Validates if the business data object has the required structure
	 */
	static isValidBusinessData(businessData: { data?: unknown }): boolean {
		return Boolean(businessData?.data && typeof businessData.data === "object");
	}

	/**
	 * Extracts and transforms merchant information from business data
	 */
	static extractMerchantInfo(data: BusinessDetails, allBusinessFacts: AllBusinessFacts | undefined) {
		const { name, official_website, tin, mobile, mcc_code, business_names } = data;

		let urls: string[] = [];

		if (allBusinessFacts?.website?.value) {
			urls = [allBusinessFacts.website.value];
		} else if (official_website) {
			urls = [official_website];
		} else if (allBusinessFacts?.website?.alternatives?.length) {
			urls = allBusinessFacts.website.alternatives.map(w => w.value);
		}

		return {
			name: removeSpecialCharacters(allBusinessFacts?.business_name?.value || name || ""),
			doingBusinessAsName: removeSpecialCharacters(
				this.getPrimaryBusinessName(business_names, name, allBusinessFacts?.business_name?.value)
			),
			phoneNumber: normalizePhoneNumber(allBusinessFacts?.business_phone?.value || mobile),
			altPhoneNumber: "",
			merchantCategory: this.resolveMccCode(allBusinessFacts, mcc_code),
			nationalTaxId: envConfig.MATCH_ENV === "production" ? tin : "",
			urls
		};
	}

	/**
	 * Gets the primary business name or falls back to the main name
	 */
	static getPrimaryBusinessName(
		businessNames: BusinessDetails["business_names"],
		fallbackName: string,
		factName: string
	): string {
		return businessNames?.find(bn => bn.is_primary)?.name || factName || fallbackName;
	}

	/**
	 * Transforms owners array to the required principals structure
	 */
	static transformOwnersToPrincipals(
		owners: Omit<BusinessOwner, "owner_type" | "ownership_percentage" | "title">[],
		phoneNumber: string | null | undefined
	) {
		return owners.map(owner => ({
			firstName: removeSpecialCharacters(owner.first_name || ""),
			middleInitial: "",
			lastName: removeSpecialCharacters(owner.last_name || ""),
			address: this.buildPrincipalAddress(owner),
			phoneNumber: normalizePhoneNumber(owner.mobile || phoneNumber),
			altPhoneNumber: "",
			email: owner.email || "",
			driversLicense: this.buildDriversLicense(),
			dateOfBirth: owner.date_of_birth || "",
			nationalId: envConfig.MATCH_ENV === "production" && owner.ssn ? owner.ssn : ""
		}));
	}

	/**
	 * Builds the address structure for a principal
	 */
	static buildPrincipalAddress(
		owner: Pick<
			BusinessOwner,
			"address_line_1" | "address_line_2" | "address_city" | "address_state" | "address_postal_code" | "address_country"
		>
	) {
		return {
			addressLineOne: owner.address_line_1 || "",
			addressLineTwo: owner.address_line_2 || "",
			city: owner.address_city || "",
			isOtherCity: "Y",
			countrySubdivision: owner.address_state || "",
			postalCode: owner.address_postal_code || "",
			country: normalizeCountryCode(owner.address_country || "")
		};
	}

	/**
	 * Builds the drivers license structure (empty as data is not available)
	 */
	static buildDriversLicense() {
		return {
			number: "", // Not available
			countrySubdivision: "", // Not available
			country: "" // Not available
		};
	}

	/**
	 * Extracts the primary business address
	 */
	static extractPrimaryAddress(
		businessAddresses: BusinessDetails["business_addresses"],
		factAddresses: BusinessAddressInput[] | undefined
	) {
		const primaryAddress = (businessAddresses?.find(ba => ba.is_primary) || {}) as BusinessAddressInput;
		const primaryAddressFacts = (factAddresses?.find(ba => ba.is_primary) || {}) as BusinessAddressInput;
		const { line_1, apartment, city, state, postal_code, country } = primaryAddress;
		const {
			line_1: line_1Facts,
			apartment: apartmentFacts,
			city: cityFacts,
			state: stateFacts,
			postal_code: postal_codeFacts,
			country: countryFacts
		} = primaryAddressFacts;

		return {
			addressLineOne: line_1Facts || line_1 || "",
			addressLineTwo: apartmentFacts || apartment || "",
			city: cityFacts || city || "",
			isOtherCity: "N",
			countrySubdivision: stateFacts || state || "",
			country: normalizeCountryCode(countryFacts || country || ""),
			postalCode: postal_codeFacts || postal_code || ""
		};
	}

	/**
	 * Get MCC code from Facts response
	 */
	static resolveMccCode(
		facts: Pick<AllBusinessFacts, "mcc_code" | "mcc_code_found" | "mcc_code_from_naics"> | undefined,
		fallback: string | null | undefined
	): string {
		const candidates = [
			facts?.mcc_code?.value,
			facts?.mcc_code_found?.value,
			facts?.mcc_code_from_naics?.value,
			fallback
		];

		const mccCode = candidates.find(code => code != null && /^\d{4}$/.test(String(code))) ?? "";
		return mccCode ? String(mccCode) : "";
	}

	/**
	 * Builds the complete termination inquiry payload
	 */
	static buildTerminationInquiryPayload(
		merchantInfo: MerchantInfoInput,
		principals: TerminationInquiryRequest["terminationInquiryRequest"]["merchant"]["principals"],
		address: TerminationInquiryRequest["terminationInquiryRequest"]["merchant"]["address"],
		ica: string
	) {
		const acquirerId = ica;
		return {
			terminationInquiryRequest: {
				acquirerId,
				merchant: {
					...merchantInfo,
					merchantId: "", // This value is not available in the source JSON
					subMerchantId: "", // This value is not available in the source JSON
					address,
					countrySubdivisionTaxId: "", // Not available
					principals,
					searchCriteria: {
						minPossibleMatchCount: "3" // Default value
					}
				}
			}
		};
	}

	/**
	 * Validate the current vs previous payload
	 * Equals: true
	 * Differents: false
	 */
	static async validatePreviousRequest(
		currentPayload: TerminationInquiryRequest,
		previousMatchReview: MatchPreviousReview
	): Promise<boolean> {
		if (Object.keys(previousMatchReview).length === 0) {
			return false;
		}
		return _.isEqual(currentPayload, { terminationInquiryRequest: previousMatchReview.terminationInquiryRequest });
	}

	/**
	 * Will check every 10 secounds until 2 minutes if Fact got MCC data	 *
	 */
	static async waitForCompleteFacts(factEngine: FactEngine, timeout = 120000, interval = 10000) {
		const start = Date.now();
		let facts: Awaited<ReturnType<typeof factEngine.getResults>> | undefined;

		while (Date.now() - start < timeout) {
			facts = await factEngine.getResults();

			const hasAnyMccCode = ["mcc_code", "mcc_code_found", "mcc_code_from_naics"].some(
				key => facts?.[key]?.value != null
			);

			if (hasAnyMccCode) return facts;

			await new Promise(resolve => setTimeout(resolve, interval));
		}

		return facts;
	}
}
