import { DeferrableTaskManager } from "#api/v1/modules/tasks/deferrableTaskManager";
import {
	CONNECTION_STATUS,
	FEATURE_FLAGS,
	INTEGRATION_ID,
	INTEGRATION_TASK,
	kafkaEvents,
	kafkaTopics,
	QUEUES,
	TASK_STATUS,
	EVENTS,
	DIRECTORIES
} from "#constants";
import { db, getBusinessCustomers, getBusinessDetails, getFlagValue, logger, producer, sqlQuery } from "#helpers";
import {
	IBusinessIntegrationTask,
	IBusinessIntegrationTaskEnriched,
	IDBConnection,
	IRequestResponse,
	TDateISO
} from "#types";
import type { UUID } from "crypto";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import crypto from "crypto";
import playwright from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { simplifiedFullEnrichment } from "./fullEnrichment.js";
import type { WebsiteScanRequest, WebsiteScanResponse, WebsiteScanPage, CompanyEnrichmentData } from "./types";
import { envConfig } from "#configs";
import naics from "naicsjs";
import { DomainParkingDetector } from "./domainParkingDetector";
import { WebsitePageCategorizer } from "./websitePageCategorizer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import { FactEngine } from "#lib/facts/factEngine";
import { kybFacts } from "#lib/facts/kyb";
import { businessFacts } from "#lib/facts/businessDetails";
import type { Knex } from "knex";
import type BullQueue from "#helpers/bull-queue";
import type { Job } from "bull";
import type { EnqueuedJob } from "#lib/aiEnrichment/types";
import { uploadRawIntegrationDataToS3 } from "#common";
import { buildInsertQuery } from "#utils";
import { jobManager } from "../../src/jobs/jobManager";
import { JOB_STATUS } from "../../src/workers/types";
import { DependentTask } from "#api/v1/modules/tasks/types";
import { getFactKeys } from "#lib/facts/utils";
import { Fact } from "#lib/facts/types/types.js";

export class WorthWebsiteScanning extends DeferrableTaskManager {
	protected static readonly PLATFORM_ID = INTEGRATION_ID.WORTH_WEBSITE_SCANNING;
	protected static readonly QUEUE_NAME = QUEUES.WEBSITE_SCANNING;
	protected static readonly QUEUE_EVENT = EVENTS.FETCH_WORTH_BUSINESS_WEBSITE_DETAILS;
	protected static readonly QUEUE_WORKER_SANDBOX_PATH = "sandboxed/deferrableTaskWorker.ts";
	protected static readonly TASK_TIMEOUT_IN_SECONDS = 60 * 5; // 5 minutes
	protected static readonly MAX_ADDITIONAL_SCREENSHOT_URLS = 10;
	protected static readonly JOB_MAX_WAIT_TIME = 15 * 60 * 1000; // 15 minutes
	protected static readonly JOB_POLL_INTERVAL = 5000; // 5 seconds

	static readonly DEPENDENT_FACTS = {
		website: { minimumSources: 1 }
	};
	static readonly DEPENDENT_TASKS: Partial<DependentTask> = {
		fetch_business_entity_verification: [
			{ platformId: INTEGRATION_ID.ZOOMINFO, timeoutInSeconds: 60 * 3 },
			{ platformId: INTEGRATION_ID.OPENCORPORATES, timeoutInSeconds: 60 * 3 },
			{ platformId: INTEGRATION_ID.CANADA_OPEN, timeoutInSeconds: 60 * 3 }
		],
		fetch_public_records: [{ platformId: INTEGRATION_ID.EQUIFAX, timeoutInSeconds: 60 * 3 }],
		fetch_business_entity_website_details: [{ platformId: INTEGRATION_ID.SERP_SCRAPE, timeoutInSeconds: 60 * 3 }]
	};
	constructor({
		dbConnection,
		db,
		bullQueue,
		factEngine
	}: {
		dbConnection: IDBConnection;
		db: Knex;
		bullQueue: BullQueue;
		factEngine?: FactEngine;
	}) {
		const allFacts = [...kybFacts, ...businessFacts];

		const filteredFacts = WorthWebsiteScanning.selectFacts(getFactKeys(WorthWebsiteScanning.DEPENDENT_FACTS), allFacts);
		const factEngineInstance = factEngine || new FactEngine(filteredFacts, { business: dbConnection.business_id });
		super({ dbConnection, db, bullQueue, factEngine: factEngineInstance });
	}

	protected async executeDeferrableTask(task: IBusinessIntegrationTask, job: Job<EnqueuedJob>): Promise<boolean> {
		const businessId = this.dbConnection.business_id;

		let websiteUrl = task.metadata?.website;
		if (!websiteUrl) {
			websiteUrl = await this.getBusinessWebsiteUrl();
		}

		try {
			logger.info(`Starting website scan job for business ${businessId} and task ${task.id}`);

			const job = await jobManager.runJob({
				jobType: "WEBSITE_SCAN",
				payload: {
					websiteUrl
				},
				businessId,
				taskId: task?.id
			});

			if (!job) {
				throw new Error(`Failed to create website scan job for business ${businessId} and task ${task.id}`);
			}

			const finalStatus = await jobManager.monitorJob(job.jobId, {
				maxWaitTime: WorthWebsiteScanning.JOB_MAX_WAIT_TIME,
				pollInterval: WorthWebsiteScanning.JOB_POLL_INTERVAL,
				onStatusUpdate: status => {
					// logger.info(`Website scan progress: ${status}`);
				}
			});

			// Check if the job failed
			// TODO: Log the Exception Details DO NOT SWALLOW THE ERROR.
			if (finalStatus === JOB_STATUS.FAILED) {
				logger.error(`Website scan job failed for business ${businessId} and task ${task.id}`);
				return false;
			}

			logger.info(`Website scan completed for business ${businessId}`);
			return true;
		} catch (error) {
			logger.error({ error }, `Business Website Scanning ${businessId} Task ${task.id} failed`);
			return false;
		}
	}

	static async createConnection({ business_id, options }: { business_id: UUID; options: any }): Promise<IDBConnection> {
		// check if we already have a connection for this business entity and platform id
		let connection = await db<IDBConnection>("integrations.data_connections")
			.select("*")
			.where({ business_id, platform_id: this.PLATFORM_ID })
			.orderBy("created_at", "desc")
			.first();

		if (connection) return connection;

		logger.info(`Creating connection for worth website scanning, business_id: ${business_id}`);
		const insertedConnection = await db<IDBConnection>("integrations.data_connections")
			.insert({
				business_id,
				platform_id: this.PLATFORM_ID,
				connection_status: CONNECTION_STATUS.CREATED,
				configuration: options
			})
			.onConflict(["business_id", "platform_id"])
			.merge({ updated_at: new Date().toISOString() as TDateISO })
			.returning("*");
		logger.debug(insertedConnection);

		if (insertedConnection && insertedConnection[0]) return insertedConnection[0];

		logger.error(`businessId=${business_id} Could not create or retrieve connection for worth website scanning,`);
		throw new Error("Could not initialize connection", connection);
	}

	static async isEnabled(businessId: UUID | string): Promise<boolean> {
		const getBusinessCustomersResponse = await getBusinessCustomers(businessId);
		const customerIds = getBusinessCustomersResponse.customer_ids;
		if (!customerIds || customerIds.length === 0) return false;
		return await getFlagValue(FEATURE_FLAGS.DOS_541_INHOUSE_WEBSITE_SCAN, {
			key: "customer",
			kind: "customer",
			customer_id: customerIds[0]
		});
	}

	async scanBusinessWebsite(businessUrl?: string): Promise<WebsiteScanResponse> {
		const businessId = this.dbConnection.business_id;

		if (!envConfig.SERP_API_KEY || !envConfig.OPEN_AI_KEY) {
			logger.error("Missing required environment variables:");
			logger.error("   SERP_API_KEY and OPEN_AI_KEY must be set in .env file");
			throw new Error("[scanBusinessWebsite] - Missing required environment variables");
		}

		const businessDetails = await getBusinessDetails(businessId);
		if (businessDetails.status !== "success") {
			logger.error(`[scanBusinessWebsite] - Could not get business details for: ${businessId}`);
			throw new Error(`[scanBusinessWebsite] - Could not get business details for: ${businessId}`);
		}

		const websiteUrl = businessUrl || (await this.getBusinessWebsiteUrl());

		const businessData = {
			id: businessId,
			company_name: businessDetails.data.name,
			company_address: businessDetails.data.address_line_1,
			company_city: businessDetails.data.address_city,
			company_state: businessDetails.data.address_state,
			company_postalcode: businessDetails.data.address_postal_code,
			email: "",
			website_url: websiteUrl,
			phone_number: businessDetails.data.mobile,
			primary_naics_code: "",
			contact_name: ""
		};

		try {
			// whois-rdap is dynamically imported since it is an ES module and we need to use it in a CommonJS context
			const whoisModule = await new Function('return import("@cleandns/whois-rdap")')();
			const whois = whoisModule.whois;
			// Prepare dependencies for injection
			const dependencies = {
				fs,
				csv,
				path,
				crypto,
				playwright,
				playwrightExtra: chromium,
				StealthPlugin,
				whois,
				naics,
				S3Client,
				PutObjectCommand
			};

			logger.info(`[scanBusinessWebsite] - Processing business for website scan: ${businessData.company_name}`);

			const enrichedData: CompanyEnrichmentData = await simplifiedFullEnrichment(
				dependencies,
				businessData,
				WorthWebsiteScanning.MAX_ADDITIONAL_SCREENSHOT_URLS
			);

			logger.info(`[scanBusinessWebsite] - Website scan completed successfully for business: ${businessData.company_name}. Processing time: ${enrichedData.metadata.processingTimeSeconds}s`);

			const websiteDetails: WebsiteScanResponse = WorthWebsiteScanning.convert(enrichedData);

			const isOnline = await WorthWebsiteScanning._isWebsiteOnline(websiteDetails.url);
			websiteDetails.status = isOnline ? "online" : "offline";

			return websiteDetails;
		} catch (error: any) {
			logger.error(error, `[scanBusinessWebsite] - Worth website scan failed for ${businessUrl}: ${error.message}`);
			throw new Error(`[scanBusinessWebsite] - Worth website scan failed for ${businessUrl}: ${error.message}`);
		}
	}

	async submitBusinessEntityWebsiteScanRequest({ caseId, websiteUrl }: WebsiteScanRequest) {
		const businessId = this.dbConnection.business_id;

		await producer.send({
			topic: kafkaTopics.BUSINESS,
			messages: [
				{
					key: businessId,
					value: {
						event: kafkaEvents.FETCH_WORTH_BUSINESS_WEBSITE_DETAILS,
						business_id: businessId,
						website: websiteUrl,
						case_id: caseId
					}
				}
			]
		});

		logger.info(
			"[submitBusinessEntityWebsiteScanRequest] - Task created and message sent to Kafka for website scanning"
		);
	}

	async createBusinessEntityWebsiteScanRequestTask({ scoreTriggerId, websiteUrl }: WebsiteScanRequest) {
		const businessId = this.dbConnection.business_id;
		let website = websiteUrl || (await this.getBusinessWebsiteUrl());

		const taskId = await this.getOrCreateTaskForCode({
			taskCode: "fetch_business_entity_website_details",
			reference_id: businessId,
			metadata: {
				website,
				timeout: this.getTaskTimeout(),
				maxAttempts: this.getMaxAttempts(),
				attempts: 0
			},
			scoreTriggerId: scoreTriggerId as UUID
		});

		logger.info(`[createBusinessEntityWebsiteScanRequestTask] - Task ID: ${taskId}`);
		return taskId;
	}

	async saveWebsiteDetails(taskId: string, websiteDetails: WebsiteScanResponse): Promise<void> {
		if (!websiteDetails) return;

		const businessID = this.dbConnection.business_id;

		const enrichedTask = await WorthWebsiteScanning.getEnrichedTask(taskId as UUID);

		await Promise.all([
			this.saveRequestResponse(enrichedTask, websiteDetails),
			this.insertBusinessEntityWebsiteDetails(websiteDetails, enrichedTask),
			uploadRawIntegrationDataToS3(
				websiteDetails,
				businessID,
				"website_data",
				DIRECTORIES.BUSINESS_ENTITY_VERIFICATION,
				"WEBSITE_SCANNING"
			)
		]);
	}

	async insertBusinessEntityWebsiteDetails(
		websiteResponse: WebsiteScanResponse,
		task: IBusinessIntegrationTask
	): Promise<void> {
		const businessID = this.dbConnection.business_id;

		try {
			logger.info(`Website scan task: ${businessID} ${JSON.stringify(task)}`);
			if (!task) {
				throw new Error(`Task not found for given business: ${businessID}`);
			}
			const { url } = websiteResponse;
			if (!url) {
				logger.error(`insertBusinessEntityWebsiteDetails: No website URL found for businessID: ${businessID}`);
				throw new Error(`No website URL found for businessID: ${businessID}`);
			}

			const creation_date = websiteResponse.domain?.creation_date;
			const expiration_date = websiteResponse.domain?.expiration_date;

			const columns = [
				"business_integration_task_id",
				"business_id",
				"url",
				"creation_date",
				"expiration_date",
				"category",
				"category_url",
				"category_text",
				"category_image_link",
				"meta"
			];

			const rows = websiteResponse?.pages?.map(page => {
				// Make sure the text is not greater than 512 characters
				let pageText = page?.text || "...";
				if (pageText.length > 512) pageText = pageText.substring(0, 509) + "...";
				return [
					task.id,
					businessID,
					url,
					creation_date,
					expiration_date,
					page.category,
					page.url,
					pageText,
					page?.screenshot_url || "",
					websiteResponse
				];
			});

			if (rows && rows.length > 0) {
				let query = buildInsertQuery("integration_data.business_entity_website_data", columns, rows);
				query += ` ON CONFLICT (business_integration_task_id, category, category_url) DO UPDATE
				SET url = EXCLUDED.url,
				creation_date = EXCLUDED.creation_date,
				expiration_date = EXCLUDED.expiration_date,
				category_text = EXCLUDED.category_text,
				category_image_link = EXCLUDED.category_image_link,
				meta = EXCLUDED.meta `;

				await sqlQuery({ sql: query, values: rows.flat() });
				logger.info(`Website details inserted for businessID: ${businessID}`);
			}
		} catch (error: any) {
			logger.error({ error }, `Website insertion failed: ${businessID}`);
			throw error;
		}
	}

	async getWebsiteFact(): Promise<Fact<string> | undefined> {
		if (!this.factEngine) return undefined;
		const facts = await this.getFacts(["website"]);
		return facts.website;
	}

	async getBusinessWebsiteUrl(): Promise<string | undefined> {
		const fact = await this.getWebsiteFact();
		return fact?.value;
	}

	async fetchWebsiteDetails(task: IBusinessIntegrationTaskEnriched, websiteUrl?: string) {
		const websiteDetails = await this.scanBusinessWebsite(websiteUrl);

		await this.saveWebsiteDetails(task.id, websiteDetails);

		return websiteDetails;
	}

	async getBusinessWebsiteScanResponse() {
		const RESPONSE_MESSAGES = {
			NOT_FETCHED_YET: "Website data has not been fetched yet",
			URL_HAS_CHANGED: "Website URL has changed since last scan",
			NO_WEBSITE_SCAN_TASK_FOUND: "No website scan task found"
		};

		try {
			const websiteFact = await this.getWebsiteFact();
			const websiteFactUrl = websiteFact?.value;
			const createEmptyResponse = (message: string) => ({ data: { pages: [], url: websiteFactUrl }, message });

			/**
			 * If the website fact value is empty
			 * and the source platform id is the manual platform id,
			 * then someone has intentionally cleared the website fact value.
			 */
			const hasIntentionallyClearedWebsiteFactValue =
				!websiteFactUrl && websiteFact?.source?.platformId === INTEGRATION_ID.MANUAL;

			/**
			 * If the website fact value has been intentionally cleared, short-circuit
			 * and return the response without trying to fetch the website scan response.
			 */
			if (hasIntentionallyClearedWebsiteFactValue) return createEmptyResponse(RESPONSE_MESSAGES.NOT_FETCHED_YET);

			/** Fetch the website scan response */
			const websiteScanResponse: IRequestResponse<WebsiteScanResponse> | null = await this.getFromRequestResponse({});

			/** No response found */
			if (!websiteScanResponse?.response) return createEmptyResponse(RESPONSE_MESSAGES.NOT_FETCHED_YET);

			/**
			 * Response found - return it if either:
			 * - No website fact URL is set (no URL constraint), OR
			 * - The scanned URL matches the website fact URL
			 */
			if (!websiteFactUrl || websiteScanResponse.response.url === websiteFactUrl)
				return { data: websiteScanResponse.response };

			/** Response found but URL doesn't match the expected URL */
			return createEmptyResponse(RESPONSE_MESSAGES.URL_HAS_CHANGED);
		} catch (error: any) {
			throw new Error(`[getBusinessWebsiteScanResponse] - Failed to get business website details: ${error.message}`);
		}
	}

	static convert(data: CompanyEnrichmentData): WebsiteScanResponse {
		// Generate pages from main website and additional screenshots
		const pages: WebsiteScanPage[] = [];

		const mainPageUrl =
			data.original.website_url || data.serpApi?.website || data.websiteDiscovery.discoveredWebsite || "";

		if (data.webScraping.mainWebsite && data.webScraping.totalScreenshots > 0) {
			pages.push({
				category: "Home",
				url: mainPageUrl,
				text: data.webScraping.mainWebsite.websiteTitleScraped || data.serpApi?.title || data.original.company_name,
				screenshot_url: data.webScraping.mainWebsite.homepageFoldPath,
				html_content_url: data.webScraping.mainWebsite.htmlContentPath
			});
		}

		data.webScraping.additionalScreenshots.forEach(websitePage => {
			if (websitePage.url === mainPageUrl) return; // Skip main page if already added
			pages.push({
				category: WebsitePageCategorizer.getPrimaryCategory(websitePage),
				url: websitePage.url,
				text: websitePage.textContent,
				screenshot_url: websitePage.homepageFoldPath,
				html_content_url: websitePage.htmlContentPath
			});
		});

		// Check if business name matches (simple comparison)
		const businessNameMatch =
			data.serpApi?.title?.toLowerCase().includes(data.original.company_name.toLowerCase()) ||
			data.original.dba?.toLowerCase().includes(data.original.company_name.toLowerCase()) ||
			false;

		const url = data.original.website_url || data.serpApi?.website || data.websiteDiscovery.discoveredWebsite || "";

		return {
			object: "website",
			id: data.original.id,
			business_id: data.original.id,
			url: url,
			status: "",
			title: data.webScraping.mainWebsite?.websiteTitleScraped || data.serpApi?.title || data.original.company_name,
			description: data.webScraping.mainWebsite?.websiteMetaDescription || "",
			domain: {
				domain: data.whois.domain,
				creation_date: data.whois.creationDate,
				expiration_date: data.whois.expirationDate,
				registrar: {
					organization: "", // Not available in source data
					name: data.whois.registrar,
					url: "" // Not available in source data
				}
			},
			parked: DomainParkingDetector.isParked(data.whois, data.webScraping.mainWebsite.htmlContent),
			business_name_match: businessNameMatch,
			pages: pages
		};
	}

	static async _isWebsiteOnline(url: string): Promise<boolean> {
		if (!url) return false;

		try {
			if (!url.startsWith("http://") && !url.startsWith("https://")) {
				url = `https://${url}`;
			}

			await axios.head(url, {
				timeout: 5000, // Abort if the request takes longer than 5 seconds
				validateStatus: () => true, // Don't throw on any status code
				maxRedirects: 5
			});
			return true;
		} catch (error) {
			// websites starting with http can timeout or throw CORS errors even when they are valid, so retry with https if that happens
			if (url.startsWith("http://")) {
				logger.info(`[WorthWebsiteScanning] - Retrying with https for URL: ${url}`);
				return await WorthWebsiteScanning._isWebsiteOnline(url.replace("http://", "https://"));
			}
			logger.error(error, `[WorthWebsiteScanning] - Website online error for URL: ${url}`);
			return false;
		}
	}
}

export const getWorthWebsiteScanningService = async (businessID: UUID) => {
	const connection = await WorthWebsiteScanning.createConnection({ business_id: businessID, options: {} });
	const { db } = await import("#helpers/knex");
	const BullQueue = (await import("#helpers/bull-queue")).default;
	const bullQueue = new BullQueue(WorthWebsiteScanning.getQueueName(), WorthWebsiteScanning.getQueueOptions());

	return new WorthWebsiteScanning({ dbConnection: connection, db, bullQueue });
};

// Helper function to get the worth website scan response
export const getWorthWebsiteScanResponse = async (businessId: string | UUID) => {
	try {
		const websiteScanService = await getWorthWebsiteScanningService(businessId as UUID);
		return await websiteScanService.getBusinessWebsiteScanResponse();
	} catch (error: any) {
		logger.error({ error }, "[getWorthWebsiteScanResponse] - Error getting business website details");
		throw new Error(`[getWorthWebsiteScanResponse] - Error getting business website details: ${error?.message}`);
	}
};

export const createTaskAndFetchWebsiteData = async (businessId: UUID, websiteUrl: string, caseId: UUID) => {
	try {
		// Check if scan for this URL has already been requested
		const existingTask = await WorthWebsiteScanning.getLatestTaskForBusiness(
			businessId,
			INTEGRATION_ID.WORTH_WEBSITE_SCANNING,
			"fetch_business_entity_website_details",
			false,
			"",
			caseId
		);
		if (
			existingTask &&
			existingTask.task_status === TASK_STATUS.IN_PROGRESS &&
			existingTask.metadata?.website === websiteUrl
		) {
			logger.info(
				`[createTaskAndFetchWebsiteData] - Website details fetch already in progress for business ID: ${businessId}, URL: ${websiteUrl}`
			);
			return;
		}

		if (
			existingTask &&
			existingTask.task_status === TASK_STATUS.SUCCESS &&
			existingTask.metadata?.website === websiteUrl
		) {
			logger.info(
				`[createTaskAndFetchWebsiteData] - Website details fetch already completed for business ID: ${businessId}, URL: ${websiteUrl}`
			);
			return;
		}

		const websiteScanService = await getWorthWebsiteScanningService(businessId);
		const taskId = await websiteScanService.createBusinessEntityWebsiteScanRequestTask({
			websiteUrl: websiteUrl
		});

		await websiteScanService.processTask({ taskId });
		logger.info(
			`[createTaskAndFetchWebsiteData] - Website scan task enqueued for business ID: ${businessId}, URL: ${websiteUrl}`
		);
	} catch (error) {
		// Don't throw an error if submit fails, just log it
		logger.error({ error }, "[createTaskAndFetchWebsiteData] - Error submitting business for worth website scan");
	}
};
