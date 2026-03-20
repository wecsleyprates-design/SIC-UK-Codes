// @ts-nocheck
import { getVerdataStatisticsValue, getVerdataRatingValue } from "../index";
import type * as VerdataType from "#lib/verdata/types";

// Helper function to create a minimal mock Verdata record
const createMockVerdata = (featureStore: any[]): Partial<VerdataType.Record> => ({
	seller: {
		name: "Test Seller",
		name_dba: "Test DBA",
		address_line_1: "123 Test St",
		address_line_2: "",
		city: "Test City",
		state: "TS",
		zip5: "12345",
		zip4: "1234",
		dpc: "12345",
		phone: "123-456-7890",
		fax: "",
		email: "test@test.com",
		domain_name: "test.com",
		ein: "12-3456789",
		sic_code: "1234"
	},
	feature_store: featureStore
});

// Helper function to create a mock Verdata record with public reviews
const createMockVerdataWithReviews = (publicReviews: Record<string, any[]>): Partial<VerdataType.Record> => ({
	seller: {
		name: "Test Seller",
		name_dba: "Test DBA",
		address_line_1: "123 Test St",
		address_line_2: "",
		city: "Test City",
		state: "TS",
		zip5: "12345",
		zip4: "1234",
		dpc: "12345",
		phone: "123-456-7890",
		fax: "",
		email: "test@test.com",
		domain_name: "test.com",
		ein: "12-3456789",
		sic_code: "1234"
	},
	public_reviews: {
		all_time: publicReviews
	}
});

describe("getVerdataStatisticsValue", () => {
	describe("successful cases", () => {
		it("should return the correct value when key exists in feature_store", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: 150 },
				{ compl_a_0014: 5 },
				{ rev_0175: 2.5 }
			]);

			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161");
			expect(result).toBeCloseTo(150, 2);
		});

		it("should return the correct value for different keys", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: 150 },
				{ compl_a_0014: 5 },
				{ rev_0175: 2 }
			]);

			const result1 = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "compl_a_0014");
			const result2 = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0175");
			
			expect(result1).toBeCloseTo(5, 2);
			expect(result2).toBeCloseTo(2, 2);
		});

		it("should return the correct value when key is in the last element of feature_store", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: 150 },
				{ compl_a_0014: 5 },
				{ rev_0175: 2 },
				{ rev_0189: 3 }
			]);

			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0189");
			expect(result).toBeCloseTo(3, 2);
		});

		it("should handle decimal values correctly with proper rounding", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: 150.123456789 }
			]);

			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161");
			expect(result).toBeCloseTo(150.12, 2);
		});

		it("should handle zero values", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: 0 },
				{ compl_a_0014: 0.0 }
			]);

			const result1 = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161");
			const result2 = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "compl_a_0014");
			
			expect(result1).toBeCloseTo(0, 2);
			expect(result2).toBeCloseTo(0, 2);
		});

		it("should handle negative values", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: -5.678 }
			]);

			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161");
			expect(result).toBeCloseTo(-5.68, 2);
		});
	});

	describe("edge cases", () => {
		it("should return undefined when verdata is null", () => {
			const result = getVerdataStatisticsValue(null as any, "rev_0161");
			expect(result).toBeUndefined();
		});

		it("should return undefined when verdata is undefined", () => {
			const result = getVerdataStatisticsValue(undefined as any, "rev_0161");
			expect(result).toBeUndefined();
		});

		it("should return undefined when seller is missing", () => {
			const mockVerdata = {
				feature_store: [{ rev_0161: 150 }]
			} as any;

			const result = getVerdataStatisticsValue(mockVerdata, "rev_0161");
			expect(result).toBeUndefined();
		});

		it("should return undefined when seller is null", () => {
			const mockVerdata = {
				seller: null,
				feature_store: [{ rev_0161: 150 }]
			} as any;

			const result = getVerdataStatisticsValue(mockVerdata, "rev_0161");
			expect(result).toBeUndefined();
		});

		it("should return undefined when feature_store is missing", () => {
			const mockVerdata = {
				seller: { name: "Test Seller" }
			} as any;

			const result = getVerdataStatisticsValue(mockVerdata, "rev_0161");
			expect(result).toBeUndefined();
		});

		it("should return undefined when feature_store is null", () => {
			const mockVerdata = {
				seller: { name: "Test Seller" },
				feature_store: null
			} as any;

			const result = getVerdataStatisticsValue(mockVerdata, "rev_0161");
			expect(result).toBeUndefined();
		});

		it("should return undefined when feature_store is empty array", () => {
			const mockVerdata = createMockVerdata([]);

			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161");
			expect(result).toBeUndefined();
		});

		it("should return undefined when key does not exist in any feature_store element", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: 150 },
				{ compl_a_0014: 5 }
			]);

			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "non_existent_key");
			expect(result).toBeUndefined();
		});

		it("should return undefined when key exists but value is null", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: null }
			]);

			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161");
			expect(result).toBeUndefined();
		});

		it("should return undefined when key exists but value is undefined", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: undefined }
			]);

			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161");
			expect(result).toBeUndefined();
		});

		it("should handle empty string key", () => {
			const mockVerdata = createMockVerdata([
				{ "": 150 }
			]);

			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "");
			expect(result).toBeCloseTo(150, 2);
		});
	});

	describe("real-world scenarios", () => {
		it("should work with typical review statistics data", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: 1250 }, // count_of_total_reviewers_all_time
				{ compl_a_0014: 12 }, // count_of_complaints_all_time
				{ compl_a_0119: 16.8 }, // percentage_of_complaints_containing_alert_words_all_time (16.8%)
				{ compl_a_0217: 8 }, // count_of_answers_resolved_all_time
				{ compl_a_0245: 7 }, // count_of_resolved_resolved_all_time
				{ compl_a_0273: 3 }, // count_of_unresolved_resolved_all_time
				{ compl_a_0287: 2 }, // count_of_other_resolved_all_time
				{ rev_0175: 1 }, // min_rating_allsources
				{ rev_0189: 3 }, // median_rating_allsources
				{ rev_0196: 5 } // max_rating_allsources
			]);

			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161")).toBeCloseTo(1250, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "compl_a_0014")).toBeCloseTo(12, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "compl_a_0119")).toBeCloseTo(16.8, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "compl_a_0217")).toBeCloseTo(8, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "compl_a_0245")).toBeCloseTo(7, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "compl_a_0273")).toBeCloseTo(3, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "compl_a_0287")).toBeCloseTo(2, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0175")).toBeCloseTo(1, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0189")).toBeCloseTo(3, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0196")).toBeCloseTo(5, 2);
		});

		it("should handle mixed data types in feature_store", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: 150, other_field: "string_value" },
				{ compl_a_0014: 5, boolean_field: true },
				{ rev_0175: 2, null_field: null }
			]);

			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161")).toBeCloseTo(150, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "compl_a_0014")).toBeCloseTo(5, 2);
			expect(getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0175")).toBeCloseTo(2, 2);
		});

		it("should handle duplicate keys in different feature_store elements", () => {
			const mockVerdata = createMockVerdata([
				{ rev_0161: 150 },
				{ rev_0161: 200 }, // duplicate key
				{ rev_0161: 100 }  // another duplicate
			]);

			// Should return the first occurrence
			const result = getVerdataStatisticsValue(mockVerdata as VerdataType.Record, "rev_0161");
			expect(result).toBeCloseTo(150, 2);
		});
	});
});

describe("getVerdataRatingValue", () => {
	describe("successful cases", () => {
		it("should calculate average rating correctly for single review", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [{ rating: 4.5 }]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(4.5, 2);
		});

		it("should calculate average rating correctly for multiple reviews", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: 4.0 },
					{ rating: 5.0 },
					{ rating: 3.0 }
				]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(4.0, 2); // (4.0 + 5.0 + 3.0) / 3 = 4.0
		});

		it("should calculate average rating correctly for different platforms", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: 4.5 },
					{ rating: 3.5 }
				],
				"Yelp": [
					{ rating: 5.0 },
					{ rating: 4.0 },
					{ rating: 4.5 }
				]
			});

			const googleResult = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			const yelpResult = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Yelp");
			
			expect(googleResult).toBeCloseTo(4.0, 2); // (4.5 + 3.5) / 2 = 4.0
			expect(yelpResult).toBeCloseTo(4.5, 2); // (5.0 + 4.0 + 4.5) / 3 = 4.5
		});

		it("should handle reviews with missing rating fields", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: 4.0 },
					{}, // missing rating
					{ rating: 5.0 },
					{ rating: null } // null rating
				]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(2.25, 2); // (4.0 + 0 + 5.0 + 0) / 4 = 2.25, but function treats missing/null as 0
		});

		it("should handle decimal ratings correctly", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: 4.2 },
					{ rating: 3.7 },
					{ rating: 4.8 }
				]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(4.23, 2); // (4.2 + 3.7 + 4.8) / 3 = 4.233...
		});

		it("should handle zero ratings", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: 0 },
					{ rating: 0 },
					{ rating: 0 }
				]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(0, 2);
		});

		it("should handle negative ratings", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: -1 },
					{ rating: -2 },
					{ rating: -3 }
				]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(-2, 2); // (-1 + -2 + -3) / 3 = -2
		});

		it("should handle mixed positive and negative ratings", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: 5.0 },
					{ rating: -1.0 },
					{ rating: 3.0 }
				]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(2.33, 2); // (5.0 + -1.0 + 3.0) / 3 = 2.333...
		});
	});

	describe("edge cases", () => {
		it("should return undefined when verdata is null", () => {
			const result = getVerdataRatingValue(null as any, "Google");
			expect(result).toBeUndefined();
		});

		it("should return undefined when verdata is undefined", () => {
			const result = getVerdataRatingValue(undefined as any, "Google");
			expect(result).toBeUndefined();
		});

		it("should return undefined when public_reviews is missing", () => {
			const mockVerdata = {
				seller: { name: "Test Seller" }
			} as any;

			const result = getVerdataRatingValue(mockVerdata, "Google");
			expect(result).toBeUndefined();
		});

		it("should return undefined when public_reviews is null", () => {
			const mockVerdata = {
				seller: { name: "Test Seller" },
				public_reviews: null
			} as any;

			const result = getVerdataRatingValue(mockVerdata, "Google");
			expect(result).toBeUndefined();
		});

		it("should return undefined when all_time is missing", () => {
			const mockVerdata = {
				seller: { name: "Test Seller" },
				public_reviews: {}
			} as any;

			const result = getVerdataRatingValue(mockVerdata, "Google");
			expect(result).toBeUndefined();
		});

		it("should return undefined when all_time is null", () => {
			const mockVerdata = {
				seller: { name: "Test Seller" },
				public_reviews: { all_time: null }
			} as any;

			const result = getVerdataRatingValue(mockVerdata, "Google");
			expect(result).toBeUndefined();
		});

		it("should return undefined when platform key does not exist", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [{ rating: 4.5 }],
				"Yelp": [{ rating: 3.0 }]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Facebook");
			expect(result).toBeUndefined();
		});

		it("should return undefined when platform exists but has no reviews", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [{ rating: 4.5 }],
				"Yelp": [] // empty array
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Yelp");
			expect(result).toBeUndefined();
		});

		it("should return undefined when platform exists but reviews array is null", () => {
			const mockVerdata = {
				seller: { name: "Test Seller" },
				public_reviews: {
					all_time: {
						"Google": [{ rating: 4.5 }],
						"Yelp": null
					}
				}
			} as any;

			const result = getVerdataRatingValue(mockVerdata, "Yelp");
			expect(result).toBeUndefined();
		});

		it("should handle empty string platform key", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"": [{ rating: 4.5 }]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "");
			expect(result).toBeCloseTo(4.5, 2);
		});

		it("should handle reviews with undefined rating", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: undefined },
					{ rating: 4.0 }
				]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(2.0, 2); // (0 + 4.0) / 2 = 2.0
		});
	});

	describe("real-world scenarios", () => {
		it("should work with typical Google reviews data", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: 5.0, review_text: "Great service!" },
					{ rating: 4.0, review_text: "Good experience" },
					{ rating: 3.0, review_text: "Average" },
					{ rating: 5.0, review_text: "Excellent!" },
					{ rating: 2.0, review_text: "Could be better" }
				]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(3.8, 2); // (5.0 + 4.0 + 3.0 + 5.0 + 2.0) / 5 = 3.8
		});

		it("should work with multiple platforms", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ rating: 4.5 },
					{ rating: 3.5 },
					{ rating: 5.0 }
				],
				"Yelp": [
					{ rating: 4.0 },
					{ rating: 4.5 }
				],
				"BBB": [
					{ rating: 3.0 },
					{ rating: 4.0 },
					{ rating: 3.5 },
					{ rating: 4.5 }
				]
			});

			expect(getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google")).toBeCloseTo(4.33, 2);
			expect(getVerdataRatingValue(mockVerdata as VerdataType.Record, "Yelp")).toBeCloseTo(4.25, 2);
			expect(getVerdataRatingValue(mockVerdata as VerdataType.Record, "BBB")).toBeCloseTo(3.75, 2);
		});

		it("should handle large number of reviews", () => {
			const reviews = Array.from({ length: 100 }, (_, i) => ({ rating: (i % 5) + 1 }));
			const mockVerdata = createMockVerdataWithReviews({
				"Google": reviews
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(3.0, 2); // Average of 1,2,3,4,5 repeating = 3.0
		});

		it("should handle reviews with additional metadata", () => {
			const mockVerdata = createMockVerdataWithReviews({
				"Google": [
					{ 
						rating: 4.5, 
						review_text: "Great service!",
						date: "2023-01-01",
						author: "John Doe"
					},
					{ 
						rating: 3.0, 
						review_text: "Average experience",
						date: "2023-01-02",
						author: "Jane Smith"
					}
				]
			});

			const result = getVerdataRatingValue(mockVerdata as VerdataType.Record, "Google");
			expect(result).toBeCloseTo(3.75, 2); // (4.5 + 3.0) / 2 = 3.75
		});
	});
});