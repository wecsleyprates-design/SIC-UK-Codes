import { mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult } from "../mapSerpSearchResponseWithKnowledgeGraphToGoogleProfileMatchResult";
import { SerpSearchResponseWithKnowledgeGraph, SerpSearchResponseWithPlaceResults } from "../../types";
import { MATCH_THRESHOLD } from "../../constants/match.constant";
import { BUSINESS_MATCH } from "../../constants";
import { ADDRESS_MATCH } from "../../constants";

// Mock fuzzball
jest.mock("fuzzball", () => ({
	token_set_ratio: jest.fn()
}));

import fuzz from "fuzzball";

// Mock constants
const mockFuzzTokenSetRatio = fuzz.token_set_ratio as jest.MockedFunction<typeof fuzz.token_set_ratio>;

describe("mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult", () => {
	// Factory functions for mock data
	const createMockBusinessAddress = (overrides: string = ""): string => {
		return overrides || "123 Main St, Anytown, NY, 12345";
	};

	const createMockSerpResponseWithKnowledgeGraph = (
		overrides: Partial<Pick<SerpSearchResponseWithKnowledgeGraph, "search_metadata" | "knowledge_graph">> = {}
	): Pick<SerpSearchResponseWithKnowledgeGraph, "search_metadata" | "knowledge_graph"> => ({
		search_metadata: {
			id: "search-123",
			status: "Success",
			json_endpoint: "https://serpapi.com/searches/search-123.json",
			pixel_position_endpoint: "https://serpapi.com/searches/search-123/pixel.json",
			created_at: "2023-01-01T00:00:00.000Z",
			processed_at: "2023-01-01T00:00:01.000Z",
			google_url: "https://google.com/search?test",
			raw_html_file: "https://www.googleapis.com/download/storage/v1/b/serpapi-searches/o/search-123",
			total_time_taken: 1.5
		},
		knowledge_graph: {
			title: "Test Business Inc",
			type: "Business",
			entity_type: "Company",
			kgmid: "/g/1234567890",
			knowledge_graph_search_link: "https://www.google.com/search?kgmid=/g/1234567890",
			serpapi_knowledge_graph_search_link: "https://serpapi.com/search.json?kgmid=/g/1234567890",
			place_id: "place123",
			address: "123 Main Street, Anytown, NY 12345",
			phone: "(555) 123-4567",
			website: "https://testbusiness.com",
			rating: 4.5,
			review_count: 100
		},
		...overrides
	});

	const createMockSerpResponseWithPlaceResults = (
		overrides: Partial<Pick<SerpSearchResponseWithPlaceResults, "search_metadata" | "place_results">> = {}
	): Pick<SerpSearchResponseWithPlaceResults, "search_metadata" | "place_results"> => ({
		search_metadata: {
			id: "search-456",
			status: "Success",
			json_endpoint: "https://serpapi.com/searches/search-456.json",
			pixel_position_endpoint: "https://serpapi.com/searches/search-456/pixel.json",
			created_at: "2023-01-01T00:00:00.000Z",
			processed_at: "2023-01-01T00:00:01.000Z",
			google_url: "https://google.com/maps/place/test",
			raw_html_file: "https://www.googleapis.com/download/storage/v1/b/serpapi-searches/o/search-456",
			total_time_taken: 1.2
		},
		place_results: {
			title: "Test Business Inc",
			place_id: "place123",
			data_id: "data123",
			data_cid: "cid123",
			reviews_link: "https://google.com/reviews",
			photos_link: "https://google.com/photos",
			gps_coordinates: { latitude: 40.7128, longitude: -74.006 },
			place_id_search: "place123",
			provider_id: "provider123",
			thumbnail: "https://test.com/thumbnail.jpg",
			serpapi_thumbnail: "https://serpapi.com/thumbnail.jpg",
			rating_summary: [
				{ stars: 5, amount: 50 },
				{ stars: 4, amount: 30 }
			],
			rating: 4.5,
			reviews: 100,
			type: ["establishment", "point_of_interest"],
			type_ids: ["establishment", "point_of_interest"],
			extensions: [{ service_options: ["delivery", "takeout"] }],
			unsupported_extensions: [{}],
			service_options: { onsite_services: true, online_appointments: false },
			address: "123 Main Street, Anytown, NY 12345",
			website: "https://testbusiness.com",
			phone: "(555) 123-4567",
			open_state: "Open",
			plus_code: "87G8Q23M+MF",
			serpapi_posts_link: "https://serpapi.com/posts",
			images: [
				{
					title: "Interior",
					thumbnail: "https://test.com/image1.jpg",
					serpapi_thumbnail: "https://serpapi.com/image1.jpg"
				}
			],
			user_reviews: {
				summary: [{ snippet: "Great service!" }],
				most_relevant: [
					{
						username: "John Doe",
						rating: 5,
						contributor_id: "user123",
						description: "Excellent!",
						link: "https://review-link",
						date: "2023-01-01"
					}
				]
			},
			people_also_search_for: [
				{
					search_term: "similar business",
					local_results: [
						{
							position: 1,
							title: "Similar Business",
							data_id: "similar123",
							data_cid: "sim123",
							reviews_link: "https://reviews",
							photos_link: "https://photos",
							gps_coordinates: { latitude: 40.7, longitude: -74 },
							place_id_search: "sim_place",
							rating: 4,
							reviews: 50,
							thumbnail: "https://sim.jpg",
							type: ["business"]
						}
					]
				}
			],
			web_results_link: "https://google.com/web",
			serpapi_web_results_link: "https://serpapi.com/web"
		},
		...overrides
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should return default match result when knowledge graph is missing", () => {
		// Arrange
		const mockBusinessAddress = createMockBusinessAddress();
		const mockSerpResponse = createMockSerpResponseWithKnowledgeGraph();
		const mockPlaceResponse = createMockSerpResponseWithPlaceResults();

		const serpResponseWithoutKnowledgeGraph = {
			...mockSerpResponse,
			knowledge_graph: null as any // Using as any to test null case
		};

		// Act
		const result = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			serpResponseWithoutKnowledgeGraph,
			mockPlaceResponse,
			mockBusinessAddress
		);

		// Assert
		expect(result).toEqual({
			business_match: BUSINESS_MATCH.NOT_FOUND,
			google_profile: null,
			address_match: ADDRESS_MATCH.NOT_MATCHED,
			address_similarity_score: 0
		});
	});

	it("should return full match when address similarity score exceeds full match threshold", () => {
		// Arrange
		const mockBusinessAddress = createMockBusinessAddress();
		const mockSerpResponse = createMockSerpResponseWithKnowledgeGraph();
		const mockPlaceResponse = createMockSerpResponseWithPlaceResults();

		mockFuzzTokenSetRatio.mockReturnValue(95);

		// Act
		const result = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			mockSerpResponse,
			mockPlaceResponse,
			mockBusinessAddress
		);

		// Assert
		expect(result).toEqual({
			business_match: BUSINESS_MATCH.MATCH_FOUND,
			address_match: ADDRESS_MATCH.MATCH,
			address_similarity_score: 95,
			google_profile: {
				business_name: "Test Business Inc",
				address: "123 Main Street, Anytown, NY 12345",
				phone_number: "(555) 123-4567",
				website: "https://testbusiness.com",
				rating: 4.5,
				reviews: 100,
				thumbnail: "https://test.com/thumbnail.jpg",
				gps_coordinates: { latitude: 40.7128, longitude: -74.006 },
				google_search_link: "https://google.com/search?test"
			}
		});
		expect(mockFuzzTokenSetRatio).toHaveBeenCalledWith(
			"123 Main St, Anytown, NY, 12345",
			"123 Main Street, Anytown, NY 12345"
		);
	});

	it("should return potential match and partial match when address similarity score is between thresholds", () => {
		// Arrange
		const mockBusinessAddress = createMockBusinessAddress();
		const mockSerpResponse = createMockSerpResponseWithKnowledgeGraph();
		const mockPlaceResponse = createMockSerpResponseWithPlaceResults();

		mockFuzzTokenSetRatio.mockReturnValue(75);

		// Act
		const result = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			mockSerpResponse,
			mockPlaceResponse,
			mockBusinessAddress
		);

		// Assert
		expect(result.business_match).toBe(BUSINESS_MATCH.POTENTIAL_MATCH);
		expect(result.address_match).toBe(ADDRESS_MATCH.PARTIAL_MATCH);
		expect(result.address_similarity_score).toBe(75);
	});

	it("should return no match when address similarity score is below partial match threshold", () => {
		// Arrange
		const mockBusinessAddress = createMockBusinessAddress();
		const mockSerpResponse = createMockSerpResponseWithKnowledgeGraph();
		const mockPlaceResponse = createMockSerpResponseWithPlaceResults();

		mockFuzzTokenSetRatio.mockReturnValue(50);

		// Act
		const result = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			mockSerpResponse,
			mockPlaceResponse,
			mockBusinessAddress
		);

		// Assert
		expect(result.business_match).toBe(BUSINESS_MATCH.POTENTIAL_MATCH);
		expect(result.address_match).toBe(ADDRESS_MATCH.NOT_MATCHED);
		expect(result.address_similarity_score).toBe(50);
	});

	it("should handle missing place results", () => {
		// Arrange
		const mockBusinessAddress = createMockBusinessAddress();
		const mockSerpResponse = createMockSerpResponseWithKnowledgeGraph();

		mockFuzzTokenSetRatio.mockReturnValue(95);

		// Act
		const result = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(mockSerpResponse, null, mockBusinessAddress);

		// Assert
		expect(result.google_profile!.thumbnail).toBeNull();
		expect(result.google_profile!.gps_coordinates).toBeNull();
		expect(result.business_match).toBe(BUSINESS_MATCH.MATCH_FOUND);
	});

	it("should handle missing knowledge graph address", () => {
		// Arrange
		const mockBusinessAddress = createMockBusinessAddress();
		const mockSerpResponse = createMockSerpResponseWithKnowledgeGraph();
		const mockPlaceResponse = createMockSerpResponseWithPlaceResults();

		const serpResponseWithoutAddress = {
			...mockSerpResponse,
			knowledge_graph: {
				...mockSerpResponse.knowledge_graph!,
				address: undefined // Use undefined instead of null for optional field
			}
		};

		// Act
		const result = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			serpResponseWithoutAddress,
			mockPlaceResponse,
			mockBusinessAddress
		);

		// Assert
		expect(result.business_match).toBe(BUSINESS_MATCH.POTENTIAL_MATCH);
		expect(result.address_match).toBe(ADDRESS_MATCH.NOT_MATCHED);
		expect(result.address_similarity_score).toBe(0);
		expect(fuzz.token_set_ratio).not.toHaveBeenCalled();
	});

	it("should handle business with missing address components", () => {
		// Arrange
		const mockSerpResponse = createMockSerpResponseWithKnowledgeGraph();
		const mockPlaceResponse = createMockSerpResponseWithPlaceResults();

		const partialBusinessAddress = "123 Main St";
		mockFuzzTokenSetRatio.mockReturnValue(80);

		// Act
		const result = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			mockSerpResponse,
			mockPlaceResponse,
			partialBusinessAddress
		);

		// Assert
		expect(mockFuzzTokenSetRatio).toHaveBeenCalledWith("123 Main St", "123 Main Street, Anytown, NY 12345");
		expect(result.business_match).toBe(BUSINESS_MATCH.POTENTIAL_MATCH);
	});

	it("should handle null and undefined values in knowledge graph", () => {
		// Arrange
		const mockBusinessAddress = createMockBusinessAddress();
		const mockSerpResponse = createMockSerpResponseWithKnowledgeGraph();
		const mockPlaceResponse = createMockSerpResponseWithPlaceResults();

		const minimalKnowledgeGraph = {
			...mockSerpResponse,
			knowledge_graph: {
				title: "Test Business",
				type: "Business",
				entity_type: "Company",
				kgmid: "/g/1234567890",
				knowledge_graph_search_link: "https://www.google.com/search?kgmid=/g/1234567890",
				serpapi_knowledge_graph_search_link: "https://serpapi.com/search.json?kgmid=/g/1234567890",
				place_id: "place123",
				address: undefined,
				phone: undefined,
				website: undefined,
				rating: undefined,
				review_count: undefined
			}
		};

		// Act
		const result = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			minimalKnowledgeGraph,
			mockPlaceResponse,
			mockBusinessAddress
		);

		// Assert
		expect(result.google_profile).toEqual({
			business_name: "Test Business",
			address: null,
			phone_number: null,
			website: null,
			rating: null,
			reviews: null,
			thumbnail: "https://test.com/thumbnail.jpg",
			gps_coordinates: { latitude: 40.7128, longitude: -74.006 },
			google_search_link: "https://google.com/search?test"
		});
		expect(result.business_match).toBe(BUSINESS_MATCH.POTENTIAL_MATCH);
		expect(result.address_match).toBe(ADDRESS_MATCH.NOT_MATCHED);
		expect(result.address_similarity_score).toBe(0);
	});

	it("should use correct match thresholds", () => {
		// Arrange
		const mockBusinessAddress = createMockBusinessAddress();
		const mockSerpResponse = createMockSerpResponseWithKnowledgeGraph();
		const mockPlaceResponse = createMockSerpResponseWithPlaceResults();

		// Test full match threshold
		mockFuzzTokenSetRatio.mockReturnValue(MATCH_THRESHOLD.FULL_MATCH + 1);

		const resultFullMatch = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			mockSerpResponse,
			mockPlaceResponse,
			mockBusinessAddress
		);

		expect(resultFullMatch.address_match).toBe(ADDRESS_MATCH.MATCH);
		expect(resultFullMatch.business_match).toBe(BUSINESS_MATCH.MATCH_FOUND);

		// Test partial match threshold
		mockFuzzTokenSetRatio.mockReturnValue(MATCH_THRESHOLD.PARTIAL_MATCH + 1);

		const resultPartialMatch = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			mockSerpResponse,
			mockPlaceResponse,
			mockBusinessAddress
		);

		expect(resultPartialMatch.address_match).toBe(ADDRESS_MATCH.PARTIAL_MATCH);
		expect(resultPartialMatch.business_match).toBe(BUSINESS_MATCH.POTENTIAL_MATCH);

		// Test below partial match threshold
		mockFuzzTokenSetRatio.mockReturnValue(MATCH_THRESHOLD.PARTIAL_MATCH - 1);

		const resultNoMatch = mapSerpSearchAndMapsResponsesToGoogleProfileMatchResult(
			mockSerpResponse,
			mockPlaceResponse,
			mockBusinessAddress
		);

		expect(resultNoMatch.address_match).toBe(ADDRESS_MATCH.NOT_MATCHED);
		expect(resultNoMatch.business_match).toBe(BUSINESS_MATCH.POTENTIAL_MATCH);
	});
});
