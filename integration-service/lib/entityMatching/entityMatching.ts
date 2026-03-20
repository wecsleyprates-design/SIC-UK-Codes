import { TaskHandlerMap } from "#api/v1/modules/tasks/taskManager";
import { BusinessEntityVerificationService } from "#api/v1/modules/verification/businessEntityVerification";
import {
	CONNECTION_STATUS,
	FEATURE_FLAGS,
	INTEGRATION_ID,
	TASK_STATUS,
	type IntegrationPlatformId,
	INTEGRATION_TASK
} from "#constants";
import {
	entityMatching,
	getFlagValue,
	getOrCreateConnection,
	logger,
	platformFactory,
	producer,
	type BusinessAddress,
	type EntityMatchingAddress
} from "#helpers";
import { kafkaProducerTopics, kafkaEvents } from "#constants/index";
import type { EntityMatchingIntegrations } from "#messaging/kafka/consumers/handlers/types";
import type { IDBConnection, IBusinessIntegrationTask, IBusinessIntegrationTaskEnriched } from "#types";
import type { UUID } from "crypto";
import type { EntityMatchTask } from "./types";
import type { AISanitizationResponse, AISanitization } from "#lib/aiEnrichment/aiSanitization";
import type { AIEnrichmentRequestResponse } from "#lib/aiEnrichment/types";
import { ManualIntegration } from "#lib/manual/manualIntegration";
import { isIntegrationFactEntityMatchingMetadata } from "#api/v1/modules/core/handlers/rerunIntegrations/adapters/typeguards";

export class EntityMatching extends BusinessEntityVerificationService {
	static readonly SOURCE_TO_PLATFORM_MAP: Record<
		EntityMatchingIntegrations,
		[IntegrationPlatformId, keyof typeof INTEGRATION_TASK]
	> = {
		equifax: [INTEGRATION_ID.EQUIFAX, "fetch_public_records"],
		zoominfo: [INTEGRATION_ID.ZOOMINFO, "fetch_business_entity_verification"],
		open_corporate: [INTEGRATION_ID.OPENCORPORATES, "fetch_business_entity_verification"],
		canada_open: [INTEGRATION_ID.CANADA_OPEN, "fetch_business_entity_verification"],
		npi: [INTEGRATION_ID.NPI, "fetch_business_entity_verification"],
		match: [INTEGRATION_ID.MATCH, "fetch_business_entity_verification"]
	};

	protected static readonly PLATFORM_ID = INTEGRATION_ID.ENTITY_MATCHING;
	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
	}
	taskHandlerMap: TaskHandlerMap = {
		fetch_business_entity_verification: async taskId => {
			logger.debug("fetch EntityMatching");
			return await this.fetchBusinessEntityVerification(taskId);
		}
	};

	/* Type guard to check if the passed task is an EntityMatching task */
	public static isEntityMatchingTask(task: any): task is IBusinessIntegrationTask<EntityMatchTask> {
		return (
			task.metadata && typeof task.metadata === "object" && "match_id" in task.metadata && "prediction" in task.metadata
		);
	}

	/* Determine if Entity Matching is feature enabled 
		When given a platform ID, it will check if the feature flag is enabled for that specific integration */
	static async isEnabled(forPlatformID?: IntegrationPlatformId): Promise<boolean> {
		const isEntityMatchingEnabled = await getFlagValue(FEATURE_FLAGS.TIG_12_ENTITY_MATCHING);
		if (forPlatformID === undefined) {
			return isEntityMatchingEnabled;
		}
		if (!isEntityMatchingEnabled) {
			logger.debug("Entity Matching is disabled.");
			return false;
		}
		// Reverse the map
		const integration = (Object.keys(this.SOURCE_TO_PLATFORM_MAP) as EntityMatchingIntegrations[]).find(
			key => this.SOURCE_TO_PLATFORM_MAP[key]?.[0] === forPlatformID
		);
		if (!integration) {
			return false;
		}
		return this.checkFlagStatus(integration);
	}

	/**
	 * @deprecated This feature flag is temporary and will be removed in the future. Default behavior should be the falsey value of this function
	 * Check if the customer is configured to use a direct query (legacy behavior) or wait for kafka message with match payload
	 * @param customerID - The customer ID
	 * @param defaultValue - The default value if the customer ID is not provided
	 * @returns True if the customer is eligible for a direct query, false otherwise
	 */
	public static isDirectQuery = async (customerID?: UUID, defaultValue: boolean = false) => {
		const filterByCustomer = customerID ? { key: "customer", kind: "customer", customer_id: customerID } : null;
		const isDirectQuery = await getFlagValue(FEATURE_FLAGS.BEST_64_KAFKA_FIRMOGRAPHICS, filterByCustomer, defaultValue);
		return isDirectQuery;
	};

	public static getTaskCode(integration: EntityMatchingIntegrations): keyof typeof INTEGRATION_TASK {
		const defaultTaskCode: keyof typeof INTEGRATION_TASK = "fetch_business_entity_verification";
		return this.SOURCE_TO_PLATFORM_MAP[integration]?.[1] ?? defaultTaskCode;
	}

	private static async checkFlagStatus(integration: EntityMatchingIntegrations): Promise<boolean> {
		const sourceToFlagKeyMap: Record<EntityMatchingIntegrations, string | boolean> = {
			equifax: FEATURE_FLAGS.TIG_2_ML_MATCHING_EFX,
			zoominfo: FEATURE_FLAGS.TIG_3_ML_MATCHING_ZI,
			open_corporate: FEATURE_FLAGS.TIG_4_ML_MATCHING_OC,
			npi: true,
			canada_open: true,
			match: true
		};

		const flagKey = sourceToFlagKeyMap[integration];
		if (!flagKey) {
			logger.debug({ integration }, "Source not declared in key map");
			return false;
		}
		if (typeof flagKey === "boolean") {
			return flagKey;
		}

		const flagValue = await getFlagValue(flagKey);

		if (!flagValue) {
			logger.debug({ integration }, "Feature flag is disabled for integration");
			return false;
		}
		return true;
	}

	async fetchBusinessEntityVerification(taskId: UUID): Promise<boolean> {
		if (!EntityMatching.isEnabled()) {
			logger.debug("Entity Matching feature flag is disabled");
			return false;
		}

		const businessId = this.getDBConnection()?.business_id;
		if (!businessId) {
			return false;
		}

		// mark connection as INITIALIZED
		await this.updateConnectionStatus(CONNECTION_STATUS.INITIALIZED, "Starting Business Entity Verification");
		const task = await EntityMatching.getEnrichedTask(taskId);
		logger.debug({ business_id: businessId, task_id: task.id }, "Fetching Business Entity Verification");

		let names: string[];
		let originalAddresses: Omit<BusinessAddress, "is_primary" | "mobile">[];

		if (isIntegrationFactEntityMatchingMetadata(task.metadata)) {
			logger.debug(
				{ task_id: task.id, business_id: businessId, metadata: task.metadata },
				`Using integration fact entity matching metadata from task`
			);
			names = task.metadata.names;
			originalAddresses = task.metadata.originalAddresses;
		} else {
			logger.debug(
				{ task_id: task.id, business_id: businessId },
				`Fetching unique names and addresses from getUniqueNamesAndAddresses`
			);
			const uniqueNamesAndAddresses = await this.getUniqueNamesAndAddresses(businessId);
			names = uniqueNamesAndAddresses.names;
			originalAddresses = uniqueNamesAndAddresses.originalAddresses;
		}

		const featureEnabled = await getFlagValue(FEATURE_FLAGS.TIG_50_NAME_ADDR_SANITIZATION);
		if (featureEnabled) {
			logger.debug({ businessId, taskId }, "🔍 Name and Address Sanitization feature flag is enabled");
			try {
				const aiSantizationConnection = await getOrCreateConnection(businessId, INTEGRATION_ID.AI_SANITIZATION);
				const aiSantization = platformFactory<AISanitization>({ dbConnection: aiSantizationConnection });
				const requestResponse = await aiSantization.getFromRequestResponse<
					AIEnrichmentRequestResponse<AISanitizationResponse>
				>({ taskCode: "perform_business_enrichment" });
				if (requestResponse) {
					const { response } = requestResponse?.response ?? {};
					if (response.new_names && response.new_names.length > 0) {
						// Add the new names to the names array if they are not already in the array in a case insensitive manner
						response.new_names.forEach(name => {
							if (!names.some(n => n.toLowerCase() === name.toLowerCase())) {
								names.push(name);
							}
						});
					}
					if (response.new_addresses_components && response.new_addresses_components.length > 0) {
						//iterate through new_addresses and convert to BusinessAddress type
						response.new_addresses_components.forEach(address => {
							const addr = {
								line_1: address.line1,
								line_2: address.line2,
								apartment: address.line2,
								city: address.city,
								state: address.state,
								postal_code: address.postal_code,
								country: address.country,
								is_primary: true,
								mobile: null
							};
							originalAddresses.push(addr);
						});
					}
					logger.debug(
						`Enriching match request for businessId: ${businessId} and taskId: ${task.id} with new names: ${response.new_names} and new addresses: ${response.new_addresses_components}`
					);
				}
			} catch (error) {
				logger.error(
					error,
					`Error fetching Business Entity Verification for businessId: ${businessId} and taskId: ${task.id}`
				);
			}
		}
		// Initialize Extra info object to pass to entity matching service
		// Currently only used to populate NPI data if available
		// and other explicit id fields
		let extraInfo: Record<string, any> = {};

		// Use the Manual integration_data_uploaded_event task to populate NPI and other explicit
		// id fields for populating extra_verification in the warehouse service.
		const manualDbConnection = await getOrCreateConnection(businessId, INTEGRATION_ID.MANUAL);
		const manualPlatform: ManualIntegration = platformFactory({ dbConnection: manualDbConnection });
		const manualTaskIds: Array<Pick<IBusinessIntegrationTaskEnriched, "id">> =
			await manualPlatform.getMostRecentTasksByPlatformIdAndTaskCodeTuples([[INTEGRATION_ID.MANUAL, "manual"]]);
		const manualTasks = await ManualIntegration.getEnrichedTasks(manualTaskIds.map(task => task.id));
		if (manualTasks) {
			for (const manualTask of manualTasks) {
				this.setExtraInfo(manualTask, extraInfo);
			}
		}

		// Sanitize addresses to the schema of the entityMatching Service
		const sanitizedAddresses: EntityMatchingAddress[] = originalAddresses.reduce(
			(acc: EntityMatchingAddress[], address) => {
				const streetAddress = `${address.line_1} ${address.apartment ?? ""}`.trim();
				if (streetAddress.length > 0 && address.city && address.postal_code) {
					acc.push({
						address: streetAddress,
						city: address.city,
						state: address.state,
						zip: address.postal_code,
						country: address.country ?? "US"
					});
				} else {
					logger.warn(
						{ address, businessId, taskId, currentlyAccumulatedAddresses: acc },
						"Ignoring incomplete address found in business entity verification request"
					);
				}
				return acc;
			},
			[] as EntityMatchingAddress[]
		);
		const payload = {
			business_id: businessId,
			names,
			addresses: sanitizedAddresses,
			extra: extraInfo
		};

		logger.debug({ business_id: businessId, task_id: task.id, payload }, "Payload for Business Entity Verification");

		const useKafka = await getFlagValue<boolean>(FEATURE_FLAGS.DEVOPS_110_ENTITY_MATCHING_API_TO_KAFKA);
		if (useKafka) {
			await producer.send({
				topic: kafkaProducerTopics.ENTITY_MATCHING_REQUEST,
				messages: [{
					key: businessId,
					value: {
						event: kafkaEvents.ENTITY_MATCHING_REQUEST,
						...payload
					}
				}]
			});
			await this.updateConnectionStatus(CONNECTION_STATUS.SUCCESS, "Business Entity Verification request sent via Kafka");
			await this.updateTask(taskId, { metadata: { status: "pending" }, task_status: TASK_STATUS.INITIALIZED });
		} else {
			const response = await entityMatching(payload);
			await this.updateConnectionStatus(CONNECTION_STATUS.SUCCESS, "Business Entity Verification request sent");
			await this.updateTask(taskId, { metadata: response, task_status: TASK_STATUS.INITIALIZED });
		}
		return true;
	}

	private setExtraInfo(manualTask: IBusinessIntegrationTaskEnriched, extraInfo: Record<string, any>): void {
		// Since there can be multiple manual tasks, we only want to set it one time per business.

		// NPI related fields
		if (manualTask.metadata?.data?.npi_provider_number && extraInfo.npi === undefined) {
			extraInfo.npi = manualTask.metadata?.data?.npi_provider_number;
		}
		if (manualTask.metadata?.data?.npi_first_name && extraInfo.first_name === undefined) {
			extraInfo.first_name = manualTask.metadata?.data?.npi_first_name;
		}
		if (manualTask.metadata?.data?.npi_last_name && extraInfo.last_name === undefined) {
			extraInfo.last_name = manualTask.metadata?.data?.npi_last_name;
		}

		// Explicit Canada Open ids
		if (manualTask.metadata?.data?.canada_business_number && extraInfo.canada_business_number === undefined) {
			extraInfo.canada_open_business_number = manualTask.metadata?.data?.canada_business_number;
		}
		if (manualTask.metadata?.data?.canada_corporate_id && extraInfo.canada_corporate_id === undefined) {
			extraInfo.canada_open_corporate_id = manualTask.metadata?.data?.canada_corporate_id;
		}
	}
}
