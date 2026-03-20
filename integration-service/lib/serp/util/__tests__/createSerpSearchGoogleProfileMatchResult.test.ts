import { createSerpSearchGoogleProfileMatchResult } from "../createSerpSearchGoogleProfileMatchResult";
import { SerpSearchGoogleProfileMatchResult } from "../../types/SerpSearchGoogleProfileMatchResult";

describe("createSerpSearchGoogleProfileMatchResult", () => {
	it("should create a default match result with no overrides", () => {
		// Act
		const result = createSerpSearchGoogleProfileMatchResult();

		// Assert
		expect(result).toEqual({
			business_match: "Not Found",
			google_profile: null,
			address_match: "Not Matched",
			address_similarity_score: 0
		});
	});

	it("should apply partial overrides while keeping defaults", () => {
		// Arrange
		const overrides: Partial<SerpSearchGoogleProfileMatchResult> = {
			business_match: "Match Found",
			address_similarity_score: 85
		};

		// Act
		const result = createSerpSearchGoogleProfileMatchResult(overrides);

		// Assert
		expect(result).toEqual({
			business_match: "Match Found",
			google_profile: null,
			address_match: "Not Matched",
			address_similarity_score: 85
		});
	});

	it("should apply complete overrides", () => {
		// Arrange
		const mockGoogleProfile = {
			business_name: "Test Business",
			address: "123 Test St",
			phone_number: "(555) 123-4567",
			website: "https://test.com",
			rating: 4.5,
			reviews: 100,
			thumbnail: "https://test.com/thumb.jpg",
			gps_coordinates: { latitude: 40.7128, longitude: -74.006 },
			google_search_link: "https://google.com/search?test"
		};

		const overrides: SerpSearchGoogleProfileMatchResult = {
			business_match: "Potential Match",
			google_profile: mockGoogleProfile,
			address_match: "Partial Match",
			address_similarity_score: 75
		};

		// Act
		const result = createSerpSearchGoogleProfileMatchResult(overrides);

		// Assert
		expect(result).toEqual(overrides);
	});

	it("should handle null and undefined values in overrides", () => {
		// Arrange
		const overrides: Partial<SerpSearchGoogleProfileMatchResult> = {
			google_profile: null,
			address_similarity_score: null
		};

		// Act
		const result = createSerpSearchGoogleProfileMatchResult(overrides);

		// Assert
		expect(result).toEqual({
			business_match: "Not Found",
			google_profile: null,
			address_match: "Not Matched",
			address_similarity_score: null
		});
	});

	it("should handle empty overrides object", () => {
		// Act
		const result = createSerpSearchGoogleProfileMatchResult({});

		// Assert
		expect(result).toEqual({
			business_match: "Not Found",
			google_profile: null,
			address_match: "Not Matched",
			address_similarity_score: 0
		});
	});
});
