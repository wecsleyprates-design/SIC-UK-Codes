import { worthWebsiteScanningAdapter } from "../worthWebsiteScanningAdapter";
import { FactEngineWithDefaultOverrides } from "#lib/facts";
import {
	getWorthWebsiteScanningService,
	WorthWebsiteScanning
} from "#lib/worthWebsiteScanning/worthWebsiteScanning";
import type { IntegrationProcessFunctionParams } from "../../types";

jest.mock("#lib/facts", () => ({
	allFacts: [],
	FactEngineWithDefaultOverrides: jest.fn(),
	FactRules: {
		factWithHighestConfidence: jest.fn()
	}
}));

jest.mock("#lib/worthWebsiteScanning/worthWebsiteScanning", () => ({
	getWorthWebsiteScanningService: jest.fn(),
	WorthWebsiteScanning: {
		getEnrichedTask: jest.fn()
	}
}));

const mockGetWorthWebsiteScanningService = getWorthWebsiteScanningService as jest.MockedFunction<
	typeof getWorthWebsiteScanningService
>;
const mockGetEnrichedTask = WorthWebsiteScanning.getEnrichedTask as jest.MockedFunction<
	typeof WorthWebsiteScanning.getEnrichedTask
>;

describe("worthWebsiteScanningAdapter", () => {
	const mockBusinessID = "business-123";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getMetadata", () => {
		it("should return metadata with website URL when website fact exists", async () => {
			const mockWebsite = "https://example.com";
			const mockGetResolvedFact = jest.fn().mockReturnValue({ value: mockWebsite });
			const mockApplyRules = jest.fn();

			(FactEngineWithDefaultOverrides as jest.Mock).mockImplementation(() => ({
				applyRules: mockApplyRules,
				getResolvedFact: mockGetResolvedFact
			}));

			const metadata = await worthWebsiteScanningAdapter.getMetadata(mockBusinessID);

			expect(metadata).toEqual({ website: mockWebsite });
			expect(mockApplyRules).toHaveBeenCalled();
			expect(mockGetResolvedFact).toHaveBeenCalledWith("website");
		});

		it("should return undefined when website fact does not exist", async () => {
			const mockGetResolvedFact = jest.fn().mockReturnValue(undefined);
			const mockApplyRules = jest.fn();

			(FactEngineWithDefaultOverrides as jest.Mock).mockImplementation(() => ({
				applyRules: mockApplyRules,
				getResolvedFact: mockGetResolvedFact
			}));

			const metadata = await worthWebsiteScanningAdapter.getMetadata(mockBusinessID);

			expect(metadata).toBeUndefined();
		});

		it("should return undefined when website fact value is null", async () => {
			const mockGetResolvedFact = jest.fn().mockReturnValue({ value: null });
			const mockApplyRules = jest.fn();

			(FactEngineWithDefaultOverrides as jest.Mock).mockImplementation(() => ({
				applyRules: mockApplyRules,
				getResolvedFact: mockGetResolvedFact
			}));

			const metadata = await worthWebsiteScanningAdapter.getMetadata(mockBusinessID);

			expect(metadata).toBeUndefined();
		});

		it("should return undefined when website fact value is empty string", async () => {
			const mockGetResolvedFact = jest.fn().mockReturnValue({ value: "" });
			const mockApplyRules = jest.fn();

			(FactEngineWithDefaultOverrides as jest.Mock).mockImplementation(() => ({
				applyRules: mockApplyRules,
				getResolvedFact: mockGetResolvedFact
			}));

			const metadata = await worthWebsiteScanningAdapter.getMetadata(mockBusinessID);

			expect(metadata).toBeUndefined();
		});
	});

	describe("isValidMetadata", () => {
		it("should return true for valid metadata with non-empty website", () => {
			const metadata = { website: "https://example.com" };
			expect(worthWebsiteScanningAdapter.isValidMetadata?.(metadata)).toBe(true);
		});

		it("should return false for undefined metadata", () => {
			expect(worthWebsiteScanningAdapter.isValidMetadata?.(undefined as any)).toBe(false);
		});

		it("should return false for metadata with empty website string", () => {
			const metadata = { website: "" };
			expect(worthWebsiteScanningAdapter.isValidMetadata?.(metadata)).toBe(false);
		});

		it("should return false for metadata with non-string website", () => {
			const metadata = { website: null as any };
			expect(worthWebsiteScanningAdapter.isValidMetadata?.(metadata)).toBe(false);
		});
	});

	describe("factNames", () => {
		it("should declare website as the only fact dependency", () => {
			expect(worthWebsiteScanningAdapter.factNames).toEqual(["website"]);
		});
	});

	describe("process", () => {
		const mockTaskId = "task-456";
		const mockEnrichedTask = { id: mockTaskId, task_code: "fetch_business_entity_website_details" };
		const mockGetOrCreateTaskForCode = jest.fn().mockResolvedValue(mockTaskId);
		const mockFetchWebsiteDetails = jest.fn().mockResolvedValue({});

		const createProcessParams = (overrides?: Partial<IntegrationProcessFunctionParams>) =>
			({
				business_id: mockBusinessID,
				metadata: { website: "https://example.com" },
				platform: {} as any,
				task_code: "fetch_business_entity_website_details",
				connection_id: "conn-123",
				platform_code: "WORTH_WEBSITE_SCANNING",
				platform_id: 30,
				...overrides
			}) satisfies IntegrationProcessFunctionParams;

		beforeEach(() => {
			mockGetWorthWebsiteScanningService.mockResolvedValue({
				getOrCreateTaskForCode: mockGetOrCreateTaskForCode,
				fetchWebsiteDetails: mockFetchWebsiteDetails
			} as any);
			mockGetEnrichedTask.mockResolvedValue(mockEnrichedTask as any);
		});

		it("should create a task and return the task ID immediately", async () => {
			const params = createProcessParams();

			const result = await worthWebsiteScanningAdapter.process(params);

			expect(mockGetWorthWebsiteScanningService).toHaveBeenCalledWith(mockBusinessID);
			expect(mockGetOrCreateTaskForCode).toHaveBeenCalledWith(
				expect.objectContaining({
					taskCode: "fetch_business_entity_website_details",
					metadata: { website: "https://example.com" }
				})
			);
			expect(result).toEqual([mockTaskId]);
		});

		it("should kick off fetchWebsiteDetails asynchronously", async () => {
			const params = createProcessParams();

			await worthWebsiteScanningAdapter.process(params);

			/** Allow the fire-and-forget promise chain to resolve */
			await new Promise(resolve => setImmediate(resolve));

			expect(mockGetEnrichedTask).toHaveBeenCalledWith(mockTaskId);
			expect(mockFetchWebsiteDetails).toHaveBeenCalledWith(mockEnrichedTask, "https://example.com");
		});

		it("should not block on fetchWebsiteDetails errors", async () => {
			mockFetchWebsiteDetails.mockRejectedValue(new Error("Scan failed"));

			const result = await worthWebsiteScanningAdapter.process(createProcessParams());

			/** Allow the fire-and-forget promise chain to resolve */
			await new Promise(resolve => setImmediate(resolve));

			/** Should still return the task ID despite the async error */
			expect(result).toEqual([mockTaskId]);
		});

		it("should not call fetchWebsiteDetails if task creation fails", async () => {
			mockGetOrCreateTaskForCode.mockRejectedValue(new Error("Task creation failed"));

			await expect(worthWebsiteScanningAdapter.process(createProcessParams())).rejects.toThrow(
				"Task creation failed"
			);

			await new Promise(resolve => setImmediate(resolve));

			expect(mockFetchWebsiteDetails).not.toHaveBeenCalled();
		});

		it("should propagate errors from service creation", async () => {
			mockGetWorthWebsiteScanningService.mockRejectedValue(new Error("Service creation failed"));

			await expect(worthWebsiteScanningAdapter.process(createProcessParams())).rejects.toThrow(
				"Service creation failed"
			);
		});
	});

	describe("checkRunnable", () => {
		it("should have a checkRunnable function that returns true by default", async () => {
			expect(worthWebsiteScanningAdapter.checkRunnable).toBeDefined();
			const result = await worthWebsiteScanningAdapter.checkRunnable({});
			expect(result).toBe(true);
		});
	});
});
