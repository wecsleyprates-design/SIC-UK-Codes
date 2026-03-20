/**
 * Utility functions to handle connection management
 */
import { envConfig } from "#configs";
import {
	CONNECTION_STATUS,
	ConnectionStatus,
	INTEGRATION_ID,
	IntegrationPlatform,
	IntegrationPlatformId,
	Strategy
} from "#constants/integrations.constant";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import BullQueue from "./bull-queue";
import { createOpenAIWithLogging } from "#utils";

import type { IDBConnection } from "#types/db";
import type { UUID } from "crypto";
import type { IntegrationMode } from "#api/v1/modules/customer-integration-settings/types";

export const getPlatformFromId = (platformId: number): IntegrationPlatform => {
	for (const platformName in INTEGRATION_ID) {
		if (INTEGRATION_ID[platformName] === platformId) {
			return platformName as IntegrationPlatform;
		}
	}
	throw new Error(`Platform does not exist for id ${platformId}`);
};

/**
 * Factory function to create a platform instance
 *
 * Note that this is using inline require statements to import the platform classes, this is intentional to avoid possible circular dependency issues
 * @param {IDBConnection} dbConnection - The database connection
 * @param {IntegrationPlatformId} platformId - The platform ID
 * @param {IntegrationPlatform} platform - The platform
 * @param {string} authorization - The authorization
 * @returns {T} The platform instance
 */
export const platformFactory = <T = any>({
	dbConnection,
	platformId,
	platform,
	authorization,
	strategyMode
}: {
	dbConnection?: IDBConnection;
	platformId?: IntegrationPlatformId;
	platform?: IntegrationPlatform;
	authorization?: string;
	strategyMode?: IntegrationMode;
}): T => {
	if (dbConnection) {
		platformId = dbConnection.platform_id;
		const platforms = Object.fromEntries(
			Object.entries(INTEGRATION_ID).map(([key, value]) => [value as IntegrationPlatformId, key as IntegrationPlatform])
		);
		platform = platforms[platformId];
	} else if (platform) {
		platformId = INTEGRATION_ID[platform];
	}
	if (!platformId || !platform) {
		throw new Error("Must specify a dbConnection, platformId, or platform");
	}

	if (platformId == INTEGRATION_ID.RUTTER_QUICKBOOKS) {
		const Quickbooks = require("#lib/rutter/platforms/quickbooks");
		if (dbConnection?.configuration && dbConnection.configuration?.connection?.access_token) {
			return new Quickbooks(dbConnection);
		}
		throw new Error("Quickbooks connection not initialized");
	} else if (platformId == INTEGRATION_ID.RUTTER_XERO) {
		if (dbConnection?.configuration && dbConnection.configuration?.connection?.access_token) {
			const Xero = require("#lib/rutter/platforms/xero");
			return new Xero(dbConnection);
		}
		throw new Error("Xero connection not initialized");
	} else if (platformId == INTEGRATION_ID.RUTTER_FRESHBOOKS) {
		if (dbConnection?.configuration && dbConnection.configuration?.connection?.access_token) {
			const Freshbooks = require("#lib/rutter/platforms/freshbooks");
			return new Freshbooks(dbConnection);
		}
		throw new Error("Freshbooks connection not initialized");
	} else if (platform && platform.startsWith("RUTTER_")) {
		logger.warn(`Class does not exist for rutter platform ${platform} - using Rutter base class`);
		if (dbConnection?.configuration && dbConnection.configuration?.connection?.access_token) {
			const { Rutter } = require("#lib/rutter/rutter");
			return new Rutter(dbConnection);
		}
		throw new Error("Rutter connection not initialized");
	} else if (platformId == INTEGRATION_ID.EQUIFAX) {
		// This is deprecated. strategyPlatformFactory should be used instead.
		if (dbConnection) {
			const { Equifax } = require("#lib/equifax/equifax");
			const platform = new Equifax(dbConnection);
			return platform;
		}
	} else if (platformId == INTEGRATION_ID.PLAID_IDV) {
		// This is deprecated. strategyPlatformFactory should be used instead.
		if (!dbConnection?.configuration?.template_id) {
			throw new Error("IDV configuration not set against db connection");
		}
		const { PlaidIdv } = require("#lib/plaid/plaidIdv");
		return new PlaidIdv(dbConnection);
	} else if (platformId == INTEGRATION_ID.SERP_SCRAPE) {
		const { DataScrapeService } = require("#api/v1/modules/data-scrape/dataScrapeService");
		return new DataScrapeService(dbConnection);
	} else if (platformId == INTEGRATION_ID.OPENCORPORATES) {
		const { OpenCorporates } = require("#lib/opencorporates/opencorporates");
		return new OpenCorporates(dbConnection);
	} else if (platformId == INTEGRATION_ID.ZOOMINFO) {
		const { ZoomInfo } = require("#lib/zoominfo/zoominfo");
		return new ZoomInfo(dbConnection);
	} else if (platformId == INTEGRATION_ID.GOOGLE_PLACES_REVIEWS) {
		const { GoogleReviews } = require("#lib/google/googleReviews");
		return new GoogleReviews(dbConnection);
	} else if (platformId == INTEGRATION_ID.VERDATA) {
		const { Verdata } = require("#lib/verdata/verdata");
		return new Verdata(dbConnection);
	} else if (platformId == INTEGRATION_ID.GIACT) {
		const { GIACT } = require("#lib/giact/giact");
		return new GIACT(dbConnection, strategyMode);
	} else if (platformId == INTEGRATION_ID.NPI) {
		const { NPI } = require("#lib/npi/npi");
		return new NPI(dbConnection);
	} else if (platformId == INTEGRATION_ID.ENTITY_MATCHING) {
		const { EntityMatching } = require("#lib/entityMatching/entityMatching");
		return new EntityMatching(dbConnection);
	} else if (platformId == INTEGRATION_ID.AI_NAICS_ENRICHMENT) {
		const { AINaicsEnrichment } = require("#lib/aiEnrichment/aiNaicsEnrichment");
		const openaiClient = createOpenAIWithLogging(
			{
				apiKey: envConfig.OPEN_AI_KEY
			},
			logger
		);
		const bullQueue = new BullQueue(AINaicsEnrichment.getQueueName(), AINaicsEnrichment.getQueueOptions());
		return new AINaicsEnrichment({ dbConnection, db, openaiClient, bullQueue });
	} else if (platformId == INTEGRATION_ID.AI_WEBSITE_ENRICHMENT) {
		const { AIWebsiteEnrichment } = require("#lib/aiEnrichment/aiWebsiteEnrichment");
		const openaiClient = createOpenAIWithLogging(
			{
				apiKey: envConfig.OPEN_AI_KEY
			},
			logger
		);
		const bullQueue = new BullQueue(AIWebsiteEnrichment.getQueueName(), AIWebsiteEnrichment.getQueueOptions());
		return new AIWebsiteEnrichment({ dbConnection, db, openaiClient, bullQueue });
	} else if (platformId == INTEGRATION_ID.CANADA_OPEN) {
		const { CanadaOpen } = require("#lib/canadaOpen/canadaOpen");
		return new CanadaOpen(dbConnection);
	} else if (platformId === INTEGRATION_ID.AI_SANITIZATION) {
		const { AISanitization } = require("#lib/aiEnrichment/aiSanitization");
		const openaiClient = createOpenAIWithLogging(
			{
				apiKey: envConfig.OPEN_AI_KEY
			},
			logger
		);
		const bullQueue = new BullQueue(AISanitization.getQueueName(), AISanitization.getQueueOptions());
		return new AISanitization({ dbConnection, db, openaiClient, bullQueue });
	} else if (platformId == INTEGRATION_ID.MANUAL) {
		const { ManualIntegration } = require("#lib/manual/manualIntegration");
		return new ManualIntegration(dbConnection);
	} else if (platformId == INTEGRATION_ID.MANUAL_BANKING) {
		const { ManualBanking } = require("#lib/manual/manualBanking");
		return new ManualBanking(dbConnection);
	} else if (platformId == INTEGRATION_ID.MANUAL_ACCOUNTING) {
		const { ManualAccounting } = require("#lib/manual/manualAccounting");
		return new ManualAccounting(dbConnection);
	} else if (platformId == INTEGRATION_ID.MATCH) {
		const { Match } = require("#lib/match/match");
		return new Match(dbConnection);
	} else if (platformId == INTEGRATION_ID.WORTH_WEBSITE_SCANNING) {
		const { WorthWebsiteScanning } = require("#lib/worthWebsiteScanning/worthWebsiteScanning");
		const bullQueue = new BullQueue(WorthWebsiteScanning.getQueueName(), WorthWebsiteScanning.getQueueOptions());
		return new WorthWebsiteScanning({ dbConnection, db, bullQueue });
	} else if (platformId == INTEGRATION_ID.SERP_GOOGLE_PROFILE) {
		const { SerpGoogleProfile } = require("#lib/serp/serpGoogleProfile");
		return new SerpGoogleProfile(dbConnection);
	} else if (platformId == INTEGRATION_ID.TRULIOO) {
		if (!dbConnection?.business_id) {
			throw new Error("Trulioo requires a valid database connection with business_id");
		}
		const { TruliooBusiness } = require("#lib/trulioo/business/truliooBusiness");
		return new TruliooBusiness(dbConnection.business_id, dbConnection);
	} else if (platformId == INTEGRATION_ID.TRULIOO_PSC) {
		const { TruliooPSCScreening } = require("#lib/trulioo/business/truliooPSCScreening");
		const bullQueue = new BullQueue(TruliooPSCScreening.getQueueName(), TruliooPSCScreening.getQueueOptions());
		return new TruliooPSCScreening({ dbConnection, db, bullQueue });
	} else if (platformId == INTEGRATION_ID.KYX) {
		const { KYX } = require("#lib/kyx/kyx");
		return new KYX(dbConnection);
	} else if (platformId == INTEGRATION_ID.MIDDESK) {
		const { BusinessEntityVerificationService } = require("#api/v1/modules/verification/businessEntityVerification");
		return new BusinessEntityVerificationService(dbConnection);
	} else if (platformId == INTEGRATION_ID.BASELAYER) {
		// TODO: implement BaselayerVerificationService and return it here when Baselayer API is integrated
		throw new Error("Baselayer platform not yet implemented - implement BaselayerVerificationService and wire in platformHelper");
	}
	logger.error(`platformFactory does not have a handler for platform ${platform} with id ${platformId}`);
	throw new Error("Couldn't determine appropriate platform");
};
export const getConnectionByTaskId = async (taskId: UUID): Promise<IDBConnection | null> => {
	return await db("integrations.data_connections")
		.select("data_connections.*")
		.join(
			"integrations.data_business_integrations_tasks",
			"data_business_integrations_tasks.connection_id",
			"data_connections.id"
		)
		.where("data_business_integrations_tasks.id", taskId)
		.limit(1)
		.first();
};
export const getConnectionById = async (connection_id: string): Promise<IDBConnection> => {
	return await db("integrations.data_connections").where({ id: connection_id }).limit(1).first();
};

export const getConnectionsForBusiness = async (business_id: UUID): Promise<IDBConnection[]> => {
	return await db("integrations.data_connections").where("business_id", business_id);
};

/**
 * @deprecated  This function is prone to race conditions.
 * Use getOrCreateConnection instead to avoid race conditions
 * UNLESS you do not want to initialize the connection if one does not exist
 * @param business_id
 * @param platform_id
 * @returns
 */
export const getConnectionForBusinessAndPlatform = async (
	business_id: UUID,
	platform_id: IntegrationPlatformId
): Promise<IDBConnection> => {
	const connection = await db("integrations.data_connections").where({ business_id, platform_id }).limit(1).first();
	if (connection && connection.id) {
		return connection;
	}
	throw new Error("Connection does not exist for business_id and platform_id");
};

export const linkConnectionToBusiness = async (connection_id: string, business_id: UUID) => {
	return await db("integrations.data_connections")
		.update({ business_id, updated_at: db.raw("now()") })
		.where("id", connection_id)
		.returning("*");
};

/**
 * Get or create a connection for a business and platform
 * 	Attempts to insert, but ignores if the connection already exists and then returns the connection for the business+platform combination
 * @param businessID - The business ID
 * @param platformID - The platform ID
 * @param params - The parameters for the connection used to create the connection (no impact if the connection already exists)
 * @param attemptsLeft - The number of attempts left to create the connection - defaults to 1
 * @returns The connection
 * @throws Error if the connection cannot be created or selected
 */
export const getOrCreateConnection = async (
	businessID: UUID,
	platformID: IntegrationPlatformId,
	params: Partial<Pick<IDBConnection, "connection_status" | "configuration">> = {},
	attemptsLeft: number = 1
): Promise<IDBConnection> => {
	const SLEEP_DURATION_MS = 500;

	const defaultParams: typeof params = { connection_status: CONNECTION_STATUS.CREATED, configuration: {} };
	const mergedParams = { ...defaultParams, ...params };
	let connection: IDBConnection[] = [];

	await db.transaction(async trx => {
		// Attempt to insert, but ignore if it already exists
		const insertResult = await trx<IDBConnection>("integrations.data_connections")
			.insert({ ...mergedParams, business_id: businessID, platform_id: platformID })
			.onConflict(["business_id", "platform_id"])
			.ignore()
			.returning("*");

		// Only insert history if the insert actually happened (insertResult has rows)
		if (insertResult?.[0]?.id) {
			void trx("integrations.data_connections_history")
				.insert({ connection_id: insertResult[0].id, connection_status: mergedParams.connection_status })
				.catch(err => {
					logger.error(err, `Could not write row for connection_history ${insertResult[0].id}`);
				});
		}

		// Get the connection (whether it was just inserted or already existed)
		connection = await trx<IDBConnection>("integrations.data_connections")
			.select("*")
			.where({ business_id: businessID, platform_id: platformID })
			.limit(1);
	});

	if (connection?.[0]?.id) {
		return connection[0];
	}
	if (attemptsLeft > 0) {
		await sleep(SLEEP_DURATION_MS);
		return getOrCreateConnection(businessID, platformID, params, attemptsLeft - 1);
	}
	throw new Error(`Error creating connection for business_id: ${businessID} and platform_id: ${platformID}`);
};

export const updateConnectionByConnectionId = async (
	connection_id: UUID,
	connection_status: ConnectionStatus,
	configuration?: Record<string, any>,
	strategy?: Strategy
): Promise<IDBConnection> => {
	// update connection and connection history
	let connection: IDBConnection[] = [];

	connection = await db.transaction(async trx => {
		// Update data_connections table
		const updateData: Partial<IDBConnection> = {
			connection_status,
			...(configuration && { configuration }),
			...(strategy && { strategy })
		};
		connection = await trx<IDBConnection>("integrations.data_connections")
			.update(updateData)
			.where("id", connection_id)
			.returning("*");

		// Insert into data_connections_history table
		const historyLog: Partial<IDBConnection> = {};
		if (configuration) historyLog.configuration = configuration;
		if (strategy) historyLog.strategy = strategy;

		await trx("integrations.data_connections_history").insert({
			connection_id,
			connection_status,
			...(Object.keys(historyLog).length > 0 && { log: historyLog })
		});

		return connection;
	});
	if (connection && connection.length) {
		return connection[0];
	}
	throw new Error(`Error updating connection with id: ${connection_id}`);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
