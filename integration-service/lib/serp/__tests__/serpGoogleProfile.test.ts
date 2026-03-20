import { SerpGoogleProfile } from "../serpGoogleProfile";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { logger } from "#helpers/logger";
import { internalGetBusinessNamesAndAddresses } from "#helpers";
import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import type { UUID } from "crypto";
import type { IBusinessIntegrationTaskEnriched } from "#types/db";
import { SerpGoogleProfileMissingDataError } from "../errors";

// Mock all external dependencies
jest.mock("#api/v1/modules/tasks/taskManager");
jest.mock("#helpers/logger");
jest.mock("#helpers", () => ({
	internalGetBusinessNamesAndAddresses: jest.fn()
}));
jest.mock("../util/searchSerpWithGoogleEngine");
jest.mock("../util/searchSerpWithGoogleMapsEngine");
jest.mock("../util/mapSerpSearchResponseWithKnowledgeGraphToGoogleProfileMatchResult");
jest.mock("../typeguards/isSerpSearchResponseWithKnowledgeGraph");
jest.mock("../typeguards/isSerpSearchResponseWithPlaceResults");

import { searchSerpWithGoogleEngine } from "../util/searchSerpWithGoogleEngine";
import { searchSerpWithGoogleMapsEngine } from "../util/searchSerpWithGoogleMapsEngine";
import { mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult } from "../util/mapSerpSearchResponseWithKnowledgeGraphToGoogleProfileMatchResult";
import { isSerpSearchResponseWithKnowledgeGraph } from "../typeguards/isSerpSearchResponseWithKnowledgeGraph";
import { isSerpSearchResponseWithPlaceResults } from "../typeguards/isSerpSearchResponseWithPlaceResults";

// Mock constants
const mockTaskManagerGetEnrichedTask = TaskManager.getEnrichedTask as jest.MockedFunction<
	typeof TaskManager.getEnrichedTask
>;
const mockTaskManagerSaveRawResponseToDB = TaskManager.saveRawResponseToDB as jest.MockedFunction<
	typeof TaskManager.saveRawResponseToDB
>;
const mockInternalGetBusinessNamesAndAddresses = internalGetBusinessNamesAndAddresses as jest.MockedFunction<
	typeof internalGetBusinessNamesAndAddresses
>;
const mockSearchSerpWithGoogleEngine = searchSerpWithGoogleEngine as jest.MockedFunction<
	typeof searchSerpWithGoogleEngine
>;
const mockSearchSerpWithGoogleMapsEngine = searchSerpWithGoogleMapsEngine as jest.MockedFunction<
	typeof searchSerpWithGoogleMapsEngine
>;
const mockMapSerpSearchAndMapsResponsesToGoogleProfileMatchResult =
	mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult as jest.MockedFunction<
		typeof mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult
	>;
const mockIsSerpSearchResponseWithKnowledgeGraph = isSerpSearchResponseWithKnowledgeGraph as jest.MockedFunction<
	typeof isSerpSearchResponseWithKnowledgeGraph
>;
const mockIsSerpSearchResponseWithPlaceResults = isSerpSearchResponseWithPlaceResults as jest.MockedFunction<
	typeof isSerpSearchResponseWithPlaceResults
>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe("SerpGoogleProfile", () => {
	let serpGoogleProfile: SerpGoogleProfile;
	const mockTaskID: UUID = "task-123" as UUID;
	const mockBusinessID: UUID = "business-456" as UUID;

	const createMockTask = (mockTaskID: UUID, mockBusinessID: UUID): IBusinessIntegrationTaskEnriched<unknown> => {
		return {
			id: mockTaskID,
			business_id: mockBusinessID,
			task_code: "fetch_google_profile"
		} as IBusinessIntegrationTaskEnriched<unknown>;
	};

	const createMockNames = () => [
		{ name: "Legal Business Name", is_primary: true },
		{ name: "DBA Business Name", is_primary: false }
	];

	const createMockAddresses = () => [
		{
			line_1: "123 Main St",
			apartment: null,
			city: "Anytown",
			state: "NY",
			country: "US",
			postal_code: "12345",
			mobile: null,
			is_primary: true
		}
	];

	const createMockSerpResponse = () => ({
		knowledge_graph: {
			title: "Test Business",
			address: "123 Main St, Anytown, NY 12345",
			phone: "(555) 123-4567",
			website: "https://test.com",
			rating: 4.5,
			review_count: 100,
			place_id: "place123"
		},
		search_metadata: {
			google_url: "https://google.com/search?test"
		}
	});

	const createMockMapsResponse = () => ({
		place_results: {
			thumbnail: "https://test.com/thumb.jpg",
			gps_coordinates: { latitude: 40.7128, longitude: -74.006 }
		},
		search_metadata: {
			google_url: "https://google.com/maps/test"
		}
	});

	const createMockGoogleProfileMatchResult = () => ({
		business_match: "Match Found" as const,
		google_profile: {
			business_name: "Test Business",
			address: "123 Main St, Anytown, NY 12345",
			phone_number: "(555) 123-4567",
			website: "https://test.com",
			rating: 4.5,
			reviews: 100,
			thumbnail: "https://test.com/thumb.jpg",
			gps_coordinates: { latitude: 40.7128, longitude: -74.006 },
			google_search_link: "https://google.com/search?test"
		},
		address_match: "Match" as const,
		address_similarity_score: 95
	});

	beforeEach(() => {
		jest.clearAllMocks();
		serpGoogleProfile = new SerpGoogleProfile();

		// Setup default mocks
		const mockTask = createMockTask(mockTaskID, mockBusinessID);
		mockTaskManagerGetEnrichedTask.mockResolvedValue(mockTask);
		mockInternalGetBusinessNamesAndAddresses.mockResolvedValue({
			businessID: mockBusinessID,
			names: createMockNames(),
			addresses: createMockAddresses()
		});
		mockSearchSerpWithGoogleEngine.mockResolvedValue(createMockSerpResponse());
		mockSearchSerpWithGoogleMapsEngine.mockResolvedValue(createMockMapsResponse());
		mockIsSerpSearchResponseWithKnowledgeGraph.mockReturnValue(true);
		mockIsSerpSearchResponseWithPlaceResults.mockReturnValue(true);
		mockMapSerpSearchAndMapsResponsesToGoogleProfileMatchResult.mockReturnValue(createMockGoogleProfileMatchResult());

		// Mock TaskManager instance methods
		serpGoogleProfile.updateTaskStatus = jest.fn();
		mockTaskManagerSaveRawResponseToDB.mockResolvedValue({
			business_id: mockBusinessID,
			platform_id: null,
			request_type: "fetch_google_profile",
			response: {},
			request_received: "2023-01-01T00:00:00Z"
		} as any);
	});

	describe("fetchGoogleProfile", () => {
		it("should successfully fetch and process google profile", async () => {
			/** Arrange */
			const mockTask = createMockTask(mockTaskID, mockBusinessID);

			/** Act */
			const result = await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(result).toBe(true);
			expect(TaskManager.getEnrichedTask).toHaveBeenCalledWith(mockTaskID);
			expect(serpGoogleProfile.updateTaskStatus).toHaveBeenCalledWith(mockTaskID, TASK_STATUS.IN_PROGRESS);
			expect(internalGetBusinessNamesAndAddresses).toHaveBeenCalledWith(mockBusinessID);
			expect(searchSerpWithGoogleEngine).toHaveBeenCalledWith(
				"DBA Business Name",
				"123 Main St, Anytown, NY, 12345, US"
			);
			expect(searchSerpWithGoogleMapsEngine).toHaveBeenCalledWith("place123");
			expect(mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult).toHaveBeenCalledWith(
				createMockSerpResponse(),
				createMockMapsResponse(),
				"123 Main St, Anytown, NY, 12345, US"
			);
			expect(TaskManager.saveRawResponseToDB).toHaveBeenCalledWith(
				{
					google_profile_match_result: createMockGoogleProfileMatchResult(),
					knowledge_graph: createMockSerpResponse().knowledge_graph,
					place_results: createMockMapsResponse().place_results,
					rawSerpResponses: [createMockSerpResponse(), createMockMapsResponse()]
				},
				mockBusinessID,
				mockTask,
				INTEGRATION_ID.SERP_GOOGLE_PROFILE,
				"fetch_google_profile"
			);
			expect(serpGoogleProfile.updateTaskStatus).toHaveBeenCalledWith(mockTaskID, TASK_STATUS.SUCCESS);
		});

		it("should use legal name when DBA name is not available", async () => {
			/** Arrange */
			mockInternalGetBusinessNamesAndAddresses.mockResolvedValue({
				businessID: mockBusinessID,
				names: [{ name: "Legal Business Name Only", is_primary: true }],
				addresses: createMockAddresses()
			});

			/** Act */
			const result = await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(result).toBe(true);
			expect(searchSerpWithGoogleEngine).toHaveBeenCalledWith(
				"Legal Business Name Only",
				"123 Main St, Anytown, NY, 12345, US"
			);
		});

		it("should handle postal codes longer than 5 digits", async () => {
			/** Arrange */
			const addressWithLongPostalCode = [
				{
					...createMockAddresses()[0],
					postal_code: "123456789"
				}
			];
			mockInternalGetBusinessNamesAndAddresses.mockResolvedValue({
				businessID: mockBusinessID,
				names: createMockNames(),
				addresses: addressWithLongPostalCode
			});

			/** Act */
			await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(searchSerpWithGoogleEngine).toHaveBeenCalledWith(
				"DBA Business Name",
				"123 Main St, Anytown, NY, 12345, US"
			);
		});

		it("should use non-primary address when primary is not available", async () => {
			/** Arrange */
			const nonPrimaryAddress = [
				{
					...createMockAddresses()[0],
					is_primary: false
				}
			];
			mockInternalGetBusinessNamesAndAddresses.mockResolvedValue({
				businessID: mockBusinessID,
				names: createMockNames(),
				addresses: nonPrimaryAddress
			});

			/** Act */
			await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(searchSerpWithGoogleEngine).toHaveBeenCalledWith(
				"DBA Business Name",
				"123 Main St, Anytown, NY, 12345, US"
			);
		});

		it("should return false and update task status to failed when no business names found", async () => {
			/** Arrange */
			mockInternalGetBusinessNamesAndAddresses.mockResolvedValue({
				businessID: mockBusinessID,
				names: [],
				addresses: createMockAddresses()
			});

			/** Act */
			const result = await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(result).toBe(false);
			expect(serpGoogleProfile.updateTaskStatus).toHaveBeenCalledWith(mockTaskID, TASK_STATUS.IN_PROGRESS);
			expect(serpGoogleProfile.updateTaskStatus).toHaveBeenCalledWith(
				mockTaskID,
				TASK_STATUS.FAILED,
				expect.any(SerpGoogleProfileMissingDataError)
			);
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					error: expect.objectContaining({
						message: expect.stringContaining("business dba or legal name was not found")
					})
				}),
				"fetchGoogleProfile - Error"
			);
		});

		it("should return false and update task status to failed when no addresses found", async () => {
			/** Arrange */
			mockInternalGetBusinessNamesAndAddresses.mockResolvedValue({
				businessID: mockBusinessID,
				names: createMockNames(),
				addresses: []
			});

			/** Act */
			const result = await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(result).toBe(false);
			expect(serpGoogleProfile.updateTaskStatus).toHaveBeenCalledWith(
				mockTaskID,
				TASK_STATUS.FAILED,
				expect.any(SerpGoogleProfileMissingDataError)
			);
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					error: expect.objectContaining({
						message: expect.stringContaining("business address was not found")
					})
				}),
				"fetchGoogleProfile - Error"
			);
		});

		it("should return false and log when SERP response does not contain knowledge graph", async () => {
			/** Arrange */
			mockIsSerpSearchResponseWithKnowledgeGraph.mockReturnValue(false);

			/** Act */
			const result = await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(result).toBe(false);
			expect(mockLogger.info).toHaveBeenCalledWith(
				expect.stringContaining(
					"Aborting task task-123 with code fetch_google_profile for business business-456 because the SERP response did not match the expected shape"
				)
			);
		});

		it("should handle missing place results from maps response", async () => {
			/** Arrange */
			const mockTask = createMockTask(mockTaskID, mockBusinessID);
			mockIsSerpSearchResponseWithPlaceResults.mockReturnValue(false);

			/** Act */
			const result = await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(result).toBe(true);
			expect(mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult).toHaveBeenCalledWith(
				createMockSerpResponse(),
				null,
				"123 Main St, Anytown, NY, 12345, US"
			);
			expect(TaskManager.saveRawResponseToDB).toHaveBeenCalledWith(
				expect.objectContaining({
					place_results: null,
					rawSerpResponses: [createMockSerpResponse()]
				}),
				mockBusinessID,
				mockTask,
				INTEGRATION_ID.SERP_GOOGLE_PROFILE,
				"fetch_google_profile"
			);
		});

		it("should handle errors and update task status to failed", async () => {
			/** Arrange */
			const error = new Error("Test error");
			mockSearchSerpWithGoogleEngine.mockRejectedValue(error);

			/** Act */
			const result = await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(result).toBe(false);
			expect(serpGoogleProfile.updateTaskStatus).toHaveBeenCalledWith(mockTaskID, TASK_STATUS.FAILED, error);
			expect(mockLogger.error).toHaveBeenCalledWith({ error }, "fetchGoogleProfile - Error");
		});

		it("should handle non-Error objects in catch block", async () => {
			/** Arrange */
			const errorString = "String error";
			mockSearchSerpWithGoogleEngine.mockRejectedValue(errorString);

			/** Act */
			const result = await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(result).toBe(false);
			expect(serpGoogleProfile.updateTaskStatus).toHaveBeenCalledWith(
				mockTaskID,
				TASK_STATUS.FAILED,
				expect.any(Error)
			);
			expect(mockLogger.error).toHaveBeenCalledWith(
				expect.objectContaining({ error: errorString }),
				"fetchGoogleProfile - Error"
			);
		});

		it("should handle null postal code gracefully", async () => {
			/** Arrange */
			const addressWithNullPostalCode = [
				{
					...createMockAddresses()[0],
					postal_code: "" // Use empty string instead of null for postal_code
				}
			];
			mockInternalGetBusinessNamesAndAddresses.mockResolvedValue({
				businessID: mockBusinessID,
				names: createMockNames(),
				addresses: addressWithNullPostalCode
			});

			/** Act */
			await serpGoogleProfile.fetchGoogleProfile(mockTaskID);

			/** Assert */
			expect(searchSerpWithGoogleEngine).toHaveBeenCalledWith("DBA Business Name", "123 Main St, Anytown, NY, US");
		});
	});

	describe("class properties", () => {
		it("should have correct PLATFORM_ID", () => {
			/** Assert */
			expect(serpGoogleProfile["PLATFORM_ID"]).toBe(INTEGRATION_ID.SERP_GOOGLE_PROFILE);
		});

		it("should have correct task handler mapping", () => {
			/** Assert */
			expect(serpGoogleProfile["taskHandlerMap"]).toHaveProperty("fetch_google_profile");
			expect(typeof serpGoogleProfile["taskHandlerMap"]["fetch_google_profile"]).toBe("function");
		});
	});
});
