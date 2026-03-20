import { WorthWebsiteScanning, getWorthWebsiteScanningService } from "../worthWebsiteScanning";
import { INTEGRATION_ID } from "#constants";
import { createTracker } from "knex-mock-client";
import { db } from "#helpers/knex";
import type { IDBConnection } from "#types";
import type { UUID } from "crypto";
import type { Knex } from "knex";
import type BullQueue from "#helpers/bull-queue";

// Mock dependencies
jest.mock("bull");

jest.mock("#helpers/logger", () => ({
	logger: {
		debug: jest.fn(),
		error: jest.fn(),
		info: jest.fn(),
		warn: jest.fn()
	}
}));

jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

jest.mock("#lib/facts", () => ({
	allFacts: [{ name: "website" }]
}));

jest.mock("#lib/facts/rules", () => ({
	combineFacts: jest.fn()
}));

jest.mock("#common", () => ({
	uploadRawIntegrationDataToS3: jest.fn()
}));

describe("WorthWebsiteScanning", () => {
	let worthWebsiteScanning: WorthWebsiteScanning;
	let mockDbConnection: IDBConnection;
	let mockDb: Knex;
	let mockBullQueue: BullQueue;
	let tracker: any;

	const businessID: UUID = "00000000-0000-0000-0000-000000000001";
	const connectionID: UUID = "00000000-0000-0000-0000-000000000002";
	const taskID: UUID = "00000000-0000-0000-0000-000000000003";

	beforeEach(() => {
		tracker = createTracker(db);

		// Set up mock database tables
		tracker.on.select("integration_data.request_response").response([]);
		tracker.on.select("integrations.data_connections").response([]);

		mockDbConnection = {
			id: connectionID,
			business_id: businessID,
			platform_id: INTEGRATION_ID.WORTH_WEBSITE_SCANNING,
			connection_type: "worth_website_scanning",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			configuration: {},
			connection_status: "SUCCESS"
		} as IDBConnection;

		mockDb = db;

		mockBullQueue = {
			addJob: jest.fn().mockResolvedValue({ id: "123" }),
			queue: { name: "website-scanning" },
			getDelay: jest.fn(),
			isSandboxedJob: jest.fn()
		} as unknown as BullQueue;

		worthWebsiteScanning = new WorthWebsiteScanning({
			dbConnection: mockDbConnection,
			db: mockDb,
			bullQueue: mockBullQueue
		});

		// Mock static methods
		(WorthWebsiteScanning as any).getEnrichedTask = jest.fn();
		(WorthWebsiteScanning as any).selectFacts = jest.fn().mockReturnValue([]);
		worthWebsiteScanning.updateTaskStatus = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("Static Properties", () => {
		it("should have correct platform ID", () => {
			expect((WorthWebsiteScanning as any).PLATFORM_ID).toBe(INTEGRATION_ID.WORTH_WEBSITE_SCANNING);
		});

		it("should have correct queue name", () => {
			expect((WorthWebsiteScanning as any).QUEUE_NAME).toBe("website-scanning");
		});

		it("should have correct queue event", () => {
			expect((WorthWebsiteScanning as any).QUEUE_EVENT).toBe("fetch-worth-business-website-details");
		});

		it("should have correct fact dependencies", () => {
			expect(WorthWebsiteScanning.DEPENDENT_FACTS).toEqual({
				website: { minimumSources: 1 }
			});
		});

		it("should have correct task timeout", () => {
			expect((WorthWebsiteScanning as any).TASK_TIMEOUT_IN_SECONDS).toBe(60 * 5); // 5 minutes
		});
	});

	describe("Constructor", () => {
		it("should create instance with valid parameters", () => {
			const instance = new WorthWebsiteScanning({
				dbConnection: mockDbConnection,
				db: mockDb,
				bullQueue: mockBullQueue
			});

			expect(instance).toBeInstanceOf(WorthWebsiteScanning);
		});

		it("should create instance with fact engine", () => {
			const mockFactEngine = {
				getAllResolvedFacts: jest.fn(),
				getFactValues: jest.fn(),
				applyRules: jest.fn()
			};

			const instance = new WorthWebsiteScanning({
				dbConnection: mockDbConnection,
				db: mockDb,
				bullQueue: mockBullQueue,
				factEngine: mockFactEngine as any
			});

			expect(instance).toBeInstanceOf(WorthWebsiteScanning);
		});
	});

	describe("getBusinessWebsiteUrl", () => {
		it("should return undefined when factEngine is not available", async () => {
			const instanceWithoutFactEngine = new WorthWebsiteScanning({
				dbConnection: mockDbConnection,
				db: mockDb,
				bullQueue: mockBullQueue
			});

			const result = await instanceWithoutFactEngine.getBusinessWebsiteUrl();
			expect(result).toBeUndefined();
		});

		it("should return website URL from facts when available", async () => {
			// Mock the getFacts method to return a website URL
			const mockGetFacts = jest.fn().mockResolvedValue({ website: { value: "https://example.com" } });
			(worthWebsiteScanning as any).getFacts = mockGetFacts;

			const result = await worthWebsiteScanning.getBusinessWebsiteUrl();
			expect(result).toBe("https://example.com");
			expect(mockGetFacts).toHaveBeenCalledWith(["website"]);
		});

		it("should return undefined when website fact is not found", async () => {
			const mockGetFactValues = jest.fn().mockResolvedValue({});
			(worthWebsiteScanning as any).getFactValues = mockGetFactValues;

			const result = await worthWebsiteScanning.getBusinessWebsiteUrl();
			expect(result).toBeUndefined();
		});
	});

	describe("createBusinessEntityWebsiteScanRequestTask", () => {
		it("should create task with website URL from parameter", async () => {
			const mockGetOrCreateTaskForCode = jest.fn().mockResolvedValue(taskID);
			(worthWebsiteScanning as any).getOrCreateTaskForCode = mockGetOrCreateTaskForCode;

			const result = await worthWebsiteScanning.createBusinessEntityWebsiteScanRequestTask({
				websiteUrl: "https://custom-url.com"
			});

			expect(result).toBe(taskID);
			expect(mockGetOrCreateTaskForCode).toHaveBeenCalledWith({
				taskCode: "fetch_business_entity_website_details",
				reference_id: businessID,
				metadata: {
					website: "https://custom-url.com",
					timeout: expect.any(Number),
					maxAttempts: expect.any(Number),
					attempts: 0
				},
				scoreTriggerId: undefined
			});
		});

		it("should create task with website URL from facts when not provided", async () => {
			const mockGetOrCreateTaskForCode = jest.fn().mockResolvedValue(taskID);
			(worthWebsiteScanning as any).getOrCreateTaskForCode = mockGetOrCreateTaskForCode;

			const mockGetBusinessWebsiteUrl = jest.fn().mockResolvedValue("https://fact-url.com");
			worthWebsiteScanning.getBusinessWebsiteUrl = mockGetBusinessWebsiteUrl;

			const result = await worthWebsiteScanning.createBusinessEntityWebsiteScanRequestTask({});

			expect(result).toBe(taskID);
			expect(mockGetOrCreateTaskForCode).toHaveBeenCalledWith({
				taskCode: "fetch_business_entity_website_details",
				reference_id: businessID,
				metadata: {
					website: "https://fact-url.com",
					timeout: expect.any(Number),
					maxAttempts: expect.any(Number),
					attempts: 0
				},
				scoreTriggerId: undefined
			});
		});
	});

	describe("getBusinessWebsiteScanResponse", () => {
		it("should return scan response when URL matches current website fact", async () => {
			/** Arrange */
			const mockScanResponse = {
				response: {
					url: "https://example.com",
					pages: [{ category: "Home", url: "https://example.com", text: "Welcome" }],
					status: "online"
				}
			};

			const mockGetFromRequestResponse = jest.fn().mockResolvedValue(mockScanResponse);
			const mockGetWebsiteFact = jest.fn().mockResolvedValue({ value: "https://example.com" });

			worthWebsiteScanning.getFromRequestResponse = mockGetFromRequestResponse;
			worthWebsiteScanning.getWebsiteFact = mockGetWebsiteFact;

			/** Act */
			const result = await worthWebsiteScanning.getBusinessWebsiteScanResponse();

			/** Assert */
			expect(result).toEqual({ data: mockScanResponse.response });
			expect(mockGetFromRequestResponse).toHaveBeenCalledWith({});
		});

		it("should return scan response when no current URL in facts", async () => {
			/** Arrange */
			const mockScanResponse = {
				response: {
					url: "https://example.com",
					pages: [{ category: "Home", url: "https://example.com", text: "Welcome" }],
					status: "online"
				}
			};

			const mockGetFromRequestResponse = jest.fn().mockResolvedValue(mockScanResponse);
			const mockGetWebsiteFact = jest.fn().mockResolvedValue(undefined);

			worthWebsiteScanning.getFromRequestResponse = mockGetFromRequestResponse;
			worthWebsiteScanning.getWebsiteFact = mockGetWebsiteFact;

			/** Act */
			const result = await worthWebsiteScanning.getBusinessWebsiteScanResponse();

			/** Assert */
			expect(result).toEqual({ data: mockScanResponse.response });
		});

		it("should return an empty response with message when URL has changed", async () => {
			/** Arrange */
			const mockScanResponse = {
				response: {
					url: "https://old-url.com",
					pages: [{ category: "Home", url: "https://old-url.com", text: "Welcome" }],
					status: "online"
				}
			};

			const mockGetFromRequestResponse = jest.fn().mockResolvedValue(mockScanResponse);
			const mockGetWebsiteFact = jest.fn().mockResolvedValue({ value: "https://new-url.com" });

			worthWebsiteScanning.getFromRequestResponse = mockGetFromRequestResponse;
			worthWebsiteScanning.getWebsiteFact = mockGetWebsiteFact;

			/** Act */
			const result = await worthWebsiteScanning.getBusinessWebsiteScanResponse();

			/** Assert */
			expect(result).toEqual({
				data: {
					pages: [],
					url: "https://new-url.com"
				},
				message: "Website URL has changed since last scan"
			});
		});

		it("should return an empty response with message when no scan data exists", async () => {
			/** Arrange */
			const mockGetFromRequestResponse = jest.fn().mockResolvedValue(null);
			const mockGetWebsiteFact = jest.fn().mockResolvedValue({ value: "https://example.com" });

			worthWebsiteScanning.getFromRequestResponse = mockGetFromRequestResponse;
			worthWebsiteScanning.getWebsiteFact = mockGetWebsiteFact;

			/** Act */
			const result = await worthWebsiteScanning.getBusinessWebsiteScanResponse();

			/** Assert */
			expect(result).toEqual({
				data: {
					pages: [],
					url: "https://example.com"
				},
				message: "Website data has not been fetched yet"
			});
		});

		it("should throw an error when getFromRequestResponse fails", async () => {
			/** Arrange */
			const mockGetFromRequestResponse = jest.fn().mockRejectedValue(new Error("Database error"));
			const mockGetWebsiteFact = jest.fn().mockResolvedValue({ value: "https://example.com" });

			worthWebsiteScanning.getFromRequestResponse = mockGetFromRequestResponse;
			worthWebsiteScanning.getWebsiteFact = mockGetWebsiteFact;

			await expect(worthWebsiteScanning.getBusinessWebsiteScanResponse()).rejects.toThrow(
				"[getBusinessWebsiteScanResponse] - Failed to get business website details: Database error"
			);
		});

		it("should return an empty response with corresponding message when website fact value has been intentionally cleared", async () => {
			/** Arrange */
			const mockScanResponse = {
				response: {
					url: "https://example.com",
					pages: [{ category: "Home", url: "https://example.com", text: "Welcome" }],
					status: "online"
				}
			};

			const mockGetFromRequestResponse = jest.fn().mockResolvedValue(mockScanResponse);
			const mockGetWebsiteFact = jest.fn().mockResolvedValue({ value: null, source: { platformId: INTEGRATION_ID.MANUAL } });

			worthWebsiteScanning.getFromRequestResponse = mockGetFromRequestResponse;
			worthWebsiteScanning.getWebsiteFact = mockGetWebsiteFact;

			/** Act */
			const result = await worthWebsiteScanning.getBusinessWebsiteScanResponse();

			/** Assert */
			expect(result).toEqual({ data: { pages: [], url: null }, message: "Website data has not been fetched yet" });
			expect(mockGetFromRequestResponse).not.toHaveBeenCalled();
		});
	});
});

describe("Helper Functions", () => {
	const businessID: UUID = "00000000-0000-0000-0000-000000000001";
	const connectionID: UUID = "00000000-0000-0000-0000-000000000002";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getWorthWebsiteScanningService", () => {
		it("should create and return WorthWebsiteScanning service", async () => {
			const mockConnection = {
				id: connectionID,
				business_id: businessID,
				platform_id: INTEGRATION_ID.WORTH_WEBSITE_SCANNING,
				connection_status: "SUCCESS" as const,
				configuration: {},
				created_at: new Date().toISOString() as any,
				updated_at: new Date().toISOString() as any
			} as IDBConnection;

			jest.spyOn(WorthWebsiteScanning, "createConnection").mockResolvedValue(mockConnection);

			const service = await getWorthWebsiteScanningService(businessID);

			expect(service).toBeInstanceOf(WorthWebsiteScanning);
			expect(WorthWebsiteScanning.createConnection).toHaveBeenCalledWith({
				business_id: businessID,
				options: {}
			});
		});
	});
});
