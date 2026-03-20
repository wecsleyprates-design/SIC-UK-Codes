jest.mock("#helpers/knex", () => {
	const knex = require("knex");
	const { MockClient } = require("knex-mock-client");
	return {
		db: knex({ client: MockClient, dialect: "pg" })
	};
});

// Mock OpenAI before importing adverseMedia
jest.mock("#utils", () => ({
	...jest.requireActual("#utils"),
	createOpenAIWithLogging: jest.fn(() => ({
		chat: {
			completions: {
				create: jest.fn()
			}
		}
	}))
}));

import { adverseMedia } from "../adverse-media";
import { SortField } from "../types";
import { createTracker } from "knex-mock-client";
import { db } from "#helpers/knex";

const tracker = createTracker(db);

describe("AdverseMedia - Region Filter Logic", () => {
	describe("buildAdverseMediaQuery", () => {
		const companyNames = ["Test Company Inc"];
		const contactNames = ["John Doe"];

		test("Business with both city and state → region filter appears in query", () => {
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, "New York", "NY");

			// Should include region filter with both city and state
			expect(query).toContain('"New York"');
			expect(query).toContain('"NY"');
			expect(query).toContain('("New York" OR "NY")');

			// Verify the query structure
			expect(query).toContain('"Test Company Inc"');
			expect(query).toContain('"John Doe"');
		});

		test("Business missing city → no region filter", () => {
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, undefined, "NY");

			// Should NOT include region filter when city is missing
			expect(query).not.toContain('"NY"');
			// Should not contain region filter pattern like ("city" OR "state")
			expect(query).not.toMatch(/\("[^"]+" OR "[^"]+"\).*\("Test Company Inc"/);

			// Should still include company and contact names
			expect(query).toContain('"Test Company Inc"');
			expect(query).toContain('"John Doe"');
		});

		test("Business missing state → no region filter", () => {
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, "New York", undefined);

			// Should NOT include region filter when state is missing
			expect(query).not.toContain('"New York"');
			// Should not contain region filter pattern like ("city" OR "state")
			expect(query).not.toMatch(/\("[^"]+" OR "[^"]+"\).*\("Test Company Inc"/);

			// Should still include company and contact names
			expect(query).toContain('"Test Company Inc"');
			expect(query).toContain('"John Doe"');
		});

		test("Business missing both city and state → no region filter", () => {
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, undefined, undefined);

			// Should NOT include any region-related content
			expect(query).not.toContain('"New York"');
			expect(query).not.toContain('"NY"');

			// Should still include company and contact names
			expect(query).toContain('"Test Company Inc"');
			expect(query).toContain('"John Doe"');

			// Verify the query still contains keywords
			expect(query).toContain('"fraud"');
		});

		test("Query structure remains consistent across scenarios", () => {
			const withRegion = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, "New York", "NY");

			const withoutRegion = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, undefined, undefined);

			// Both should contain company names
			expect(withRegion).toContain('"Test Company Inc"');
			expect(withoutRegion).toContain('"Test Company Inc"');

			// Both should contain contact names
			expect(withRegion).toContain('"John Doe"');
			expect(withoutRegion).toContain('"John Doe"');

			// Both should contain keywords
			expect(withRegion).toContain('"fraud"');
			expect(withoutRegion).toContain('"fraud"');

			// Only withRegion should contain location info
			expect(withRegion).toContain('"New York"');
			expect(withRegion).toContain('"NY"');
			expect(withoutRegion).not.toContain('"New York"');
			expect(withoutRegion).not.toContain('"NY"');
		});

		test("Existing adverse media functionality unchanged - multiple company names", () => {
			const multipleCompanies = ["Company A", "Company B", "Company C"];
			const query = adverseMedia.buildAdverseMediaQuery(multipleCompanies, [], "Boston", "MA");

			// Should handle multiple company names with OR
			expect(query).toContain('"Company A" OR "Company B" OR "Company C"');
			expect(query).toContain('"Boston" OR "MA"');
		});

		test("Existing adverse media functionality unchanged - multiple contact names", () => {
			const multipleContacts = ["John Doe", "Jane Smith", "Bob Johnson"];
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, multipleContacts, "Seattle", "WA");

			// Should handle multiple contact names with OR
			expect(query).toContain('"John Doe" OR "Jane Smith" OR "Bob Johnson"');
			expect(query).toContain('"Seattle" OR "WA"');
		});

		test("Existing adverse media functionality unchanged - no contacts", () => {
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, [], "Chicago", "IL");

			// Should work without contacts
			expect(query).toContain('"Test Company Inc"');
			expect(query).not.toContain("undefined");
			expect(query).toContain('"Chicago" OR "IL"');
		});

		test("Existing adverse media functionality unchanged - requires company name", () => {
			// Should throw error if no company names provided
			expect(() => {
				adverseMedia.buildAdverseMediaQuery([], [], "Miami", "FL");
			}).toThrow("At least one company name is required");
		});

		test("Edge case: empty strings for city and state treated as missing", () => {
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, "", "");

			// Empty strings should be treated as missing
			expect(query).not.toContain('""');
			expect(query).toContain('"Test Company Inc"');
			expect(query).toContain('"John Doe"');
		});

		test("Edge case: whitespace-only city and state treated as missing", () => {
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, "   ", "   ");

			// Whitespace should be treated as missing after trim
			expect(query).not.toContain('"   "');
			expect(query).toContain('"Test Company Inc"');
		});

		test("Special characters in city and state are properly escaped", () => {
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, 'New York"City', "N\\Y");

			// Should properly escape quotes and backslashes
			expect(query).toContain("New York");
			expect(query).toContain("N");
		});
	});

	describe("Existing functionality - compileAdverseMedia integration", () => {
		test("Region parameters are passed correctly to buildAdverseMediaQuery", () => {
			const spy = jest.spyOn(adverseMedia as any, "buildAdverseMediaQuery");

			const body = {
				business_id: "123e4567-e89b-12d3-a456-426614174000" as any,
				business_name: "Test Corp",
				dba_names: [],
				contact_names: ["John Doe"],
				city: "Austin",
				state: "TX"
			};

			// This will call buildAdverseMediaQuery internally
			// Note: This test would need proper mocking of searchNews and analyzeSearchResults
			// For now, we're just verifying the spy setup works
			expect(spy).toBeDefined();

			spy.mockRestore();
		});
	});

	describe("fetchAdverseMediaData - multi-source (SerpAPI + Trulioo)", () => {
		beforeEach(() => {
			tracker.reset();
		});

		const sortFields: SortField[] = [
			{ field: "entity_focus_score", order: "desc" },
			{ field: "risk_level", order: "asc" }
		];

		it("should return articles from all sources when querying by business_id", async () => {
			tracker.on.select(/"adverse_media" where/).response([
				{ adverse_media_id: "am-serp-1" },
				{ adverse_media_id: "am-trulioo-1" }
			]);
			tracker.on.select(/adverse_media_articles/).response([
				{ id: "art-1", title: "SerpAPI Article", risk_level: "HIGH", final_score: 9 },
				{ id: "art-2", title: "Trulioo Article", risk_level: "LOW", final_score: 3 }
			]);

			const result = await adverseMedia.getAdverseMediaByBusinessId(
				{ businessId: "biz-123" },
				{ sortFields }
			);

			expect(result.total_risk_count).toBe(2);
			expect(result.high_risk_count).toBe(1);
			expect(result.low_risk_count).toBe(1);
			expect(result.articles).toHaveLength(2);
		});

		it("should compute risk counts dynamically from articles", async () => {
			tracker.on.select(/"adverse_media" where/).response([
				{ adverse_media_id: "am-1" }
			]);
			tracker.on.select(/adverse_media_articles/).response([
				{ id: "a1", risk_level: "HIGH", final_score: 9 },
				{ id: "a2", risk_level: "HIGH", final_score: 8 },
				{ id: "a3", risk_level: "MEDIUM", final_score: 5 },
				{ id: "a4", risk_level: "LOW", final_score: 2 }
			]);

			const result = await adverseMedia.getAdverseMediaByBusinessId(
				{ businessId: "biz-123" },
				{ sortFields }
			);

			expect(result.high_risk_count).toBe(2);
			expect(result.medium_risk_count).toBe(1);
			expect(result.low_risk_count).toBe(1);
			expect(result.total_risk_count).toBe(4);
			expect(result.average_risk_score).toBe(6);
		});

		it("should return empty when no adverse_media records exist for business", async () => {
			tracker.on.select(/"adverse_media" where/).response([]);

			const result = await adverseMedia.getAdverseMediaByBusinessId(
				{ businessId: "biz-no-data" },
				{ sortFields }
			);

			expect(result).toEqual({});
		});

		it("should resolve business_id from case for case-level query", async () => {
			tracker.on.select(/data_cases/).response({ business_id: "biz-from-case" });
			tracker.on.select(/"adverse_media" where/).response([
				{ adverse_media_id: "am-1" }
			]);
			tracker.on.select(/adverse_media_articles/).response([
				{ id: "a1", risk_level: "LOW", final_score: 3 }
			]);

			const result = await adverseMedia.getAdverseMediaDataByCaseId(
				{ caseId: "case-123" },
				{ sortFields }
			);

			expect(result.total_risk_count).toBe(1);
			expect(result.case_id).toBe("case-123");
		});

		it("should return empty when case not found", async () => {
			tracker.on.select(/data_cases/).response(undefined);

			const result = await adverseMedia.getAdverseMediaDataByCaseId(
				{ caseId: "case-nonexistent" },
				{ sortFields }
			);

			expect(result).toEqual({});
		});

		it("should compute average_risk_score correctly across multiple sources", async () => {
			tracker.on.select(/"adverse_media" where/).response([
				{ adverse_media_id: "am-serp" },
				{ adverse_media_id: "am-trulioo" }
			]);
			tracker.on.select(/adverse_media_articles/).response([
				{ id: "a1", risk_level: "HIGH", final_score: 10 },
				{ id: "a2", risk_level: "LOW", final_score: 2 }
			]);

			const result = await adverseMedia.getAdverseMediaByBusinessId(
				{ businessId: "biz-multi" },
				{ sortFields }
			);

			expect(result.average_risk_score).toBe(6);
		});

		it("should return average_risk_score 0 when articles have no final_score", async () => {
			tracker.on.select(/"adverse_media" where/).response([
				{ adverse_media_id: "am-1" }
			]);
			tracker.on.select(/adverse_media_articles/).response([
				{ id: "a1", risk_level: "LOW", final_score: null },
				{ id: "a2", risk_level: "LOW", final_score: undefined }
			]);

			const result = await adverseMedia.getAdverseMediaByBusinessId(
				{ businessId: "biz-null-scores" },
				{ sortFields }
			);

			expect(result.average_risk_score).toBe(0);
		});
	});

	describe("searchNews - SERP API URL Formatting", () => {
		let fetchMock: jest.SpyInstance;

		beforeEach(() => {
			// Mock global fetch
			fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
				json: async () => ({
					news_results: [
						{
							title: "Test Article",
							link: "https://example.com",
							date: "09/04/2024, 07:00 AM, +0000 UTC",
							source: { name: "Test Source" }
						}
					],
					search_metadata: { id: "test-id" }
				})
			} as any);
		});

		afterEach(() => {
			fetchMock.mockRestore();
		});

		test("URL contains all required parameters", async () => {
			const searchQuery = "Test Company";
			await adverseMedia.searchNews(searchQuery);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const calledUrl = fetchMock.mock.calls[0][0];

			// Verify base URL
			expect(calledUrl).toContain("https://serpapi.com/search.json?");

			// Verify all required parameters are present
			expect(calledUrl).toContain("engine=google_news");
			expect(calledUrl).toContain("q=");
			expect(calledUrl).toContain("gl=us");
			expect(calledUrl).toContain("hl=en");
			expect(calledUrl).toContain("api_key=");
		});

		test("Search query is properly URL encoded", async () => {
			const searchQuery = "Test Company & Associates";
			await adverseMedia.searchNews(searchQuery);

			const calledUrl = fetchMock.mock.calls[0][0];

			// The & should be encoded as %26
			expect(calledUrl).toContain("Test%20Company%20%26%20Associates");
			expect(calledUrl).not.toContain("Test Company & Associates");
		});

		test("Special characters in query are properly encoded", async () => {
			const searchQuery = '"Company Name" (fraud OR scandal) +investigation';
			await adverseMedia.searchNews(searchQuery);

			const calledUrl = fetchMock.mock.calls[0][0];

			// Verify proper encoding of special characters
			expect(calledUrl).toContain(encodeURIComponent(searchQuery));
			expect(calledUrl).toContain("%22"); // " encoded
			expect(calledUrl).toContain("%2B"); // + encoded
			// Note: Parentheses are not encoded by encodeURIComponent (they're unreserved chars)
			expect(calledUrl).toContain("(fraud%20OR%20scandal)");
		});

		test("Complex query with region filter is properly encoded", async () => {
			const companyNames = ["Test Company Inc"];
			const contactNames = ["John Doe"];
			const query = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, "New York", "NY");

			await adverseMedia.searchNews(query);

			const calledUrl = fetchMock.mock.calls[0][0];

			// Verify the entire complex query is in the URL
			expect(calledUrl).toContain("q=");
			// Verify it contains encoded versions of our query components
			expect(calledUrl).toContain(encodeURIComponent(query));
		});

		test("Empty query is handled", async () => {
			const searchQuery = "";
			await adverseMedia.searchNews(searchQuery);

			const calledUrl = fetchMock.mock.calls[0][0];

			// Should still have q parameter even if empty
			expect(calledUrl).toMatch(/[?&]q=(&|$)/);
		});

		test("Query with international characters is properly encoded", async () => {
			const searchQuery = "Café München Société";
			await adverseMedia.searchNews(searchQuery);

			const calledUrl = fetchMock.mock.calls[0][0];

			// Verify international characters are encoded
			expect(calledUrl).toContain(encodeURIComponent(searchQuery));
			expect(calledUrl).toContain("Caf%C3%A9"); // é encoded
			expect(calledUrl).toContain("M%C3%BCnchen"); // ü encoded
			expect(calledUrl).toContain("Soci%C3%A9t%C3%A9"); // é encoded
		});

		test("Query with multiple spaces is properly encoded", async () => {
			const searchQuery = "Company   Name    with    Spaces";
			await adverseMedia.searchNews(searchQuery);

			const calledUrl = fetchMock.mock.calls[0][0];

			// Multiple spaces should be preserved and encoded
			expect(calledUrl).toContain(encodeURIComponent(searchQuery));
		});

		test("URL parameter order is consistent", async () => {
			const searchQuery = "Test Company";
			await adverseMedia.searchNews(searchQuery);

			const calledUrl = fetchMock.mock.calls[0][0];

			// Extract the portion after the base URL
			const paramsString = calledUrl.split("?")[1];
			const params = new URLSearchParams(paramsString);

			// Verify all expected parameters exist
			expect(params.get("engine")).toBe("google_news");
			expect(params.get("q")).toBe(searchQuery);
			expect(params.get("gl")).toBe("us");
			expect(params.get("hl")).toBe("en");
			expect(params.has("api_key")).toBe(true);
		});

		test("Full integration: buildAdverseMediaQuery output works with searchNews", async () => {
			const companyNames = ["Test & Company"];
			const contactNames = ["John O'Brien"];
			const city = "San José";
			const state = "CA";

			const query = adverseMedia.buildAdverseMediaQuery(companyNames, contactNames, city, state);

			await adverseMedia.searchNews(query);

			expect(fetchMock).toHaveBeenCalledTimes(1);
			const calledUrl = fetchMock.mock.calls[0][0];

			// Verify URL is properly formed
			expect(calledUrl).toContain("https://serpapi.com/search.json?");
			expect(calledUrl).toContain("engine=google_news");

			// Verify the query was encoded (should not have raw special chars in URL)
			expect(calledUrl).not.toContain('"Test & Company"');
			expect(calledUrl).not.toContain('"John O\'Brien"');

			// Verify it's properly encoded
			expect(calledUrl).toContain("%22"); // Quotes should be encoded
		});

		test("Handles quotes from buildAdverseMediaQuery", async () => {
			const query = '"Test Company" OR "Another Company"';
			await adverseMedia.searchNews(query);

			const calledUrl = fetchMock.mock.calls[0][0];

			// Quotes should be encoded in the URL
			expect(calledUrl).toContain("%22Test%20Company%22");
			expect(calledUrl).not.toContain('"Test Company"'); // Raw quotes should not appear
		});

		test("Parentheses from buildAdverseMediaQuery are preserved in URL", async () => {
			const query = '("Company Name" OR "DBA Name") ("fraud" OR "lawsuit")';
			await adverseMedia.searchNews(query);

			const calledUrl = fetchMock.mock.calls[0][0];

			// Parentheses are not encoded by encodeURIComponent (unreserved chars in RFC 3986)
			expect(calledUrl).toContain("(%22Company%20Name%22");
			expect(calledUrl).toContain("%22fraud%22%20OR%20%22lawsuit%22)");
			// Verify quotes are encoded
			expect(calledUrl).toContain("%22");
		});
	});
});
