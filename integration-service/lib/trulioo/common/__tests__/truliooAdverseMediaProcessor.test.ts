import { processAndPersistTruliooAdverseMedia, extractTitleFromUrl, extractSourceFromUrl } from "../truliooAdverseMediaProcessor";
import type { TruliooWatchlistHit } from "../types";

describe("processAndPersistTruliooAdverseMedia", () => {
	const mockScoreAdverseMedia = jest.fn();
	const mockInsertAdverseMedia = jest.fn();

	const defaultDeps = {
		scoreAdverseMedia: mockScoreAdverseMedia,
		insertAdverseMedia: mockInsertAdverseMedia
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	function createHit(overrides: Partial<TruliooWatchlistHit> = {}): TruliooWatchlistHit {
		return {
			listType: "ADVERSE_MEDIA",
			listName: "Negative News Report",
			confidence: 85,
			matchDetails: "Test Entity",
			url: "https://example.com/news",
			sourceAgencyName: "News Agency",
			...overrides
		};
	}

	describe("filtering", () => {
		it("should only process ADVERSE_MEDIA hits, ignoring PEP/SANCTIONS/OTHER", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listType: "PEP", listName: "PEP List" }),
				createHit({ listType: "SANCTIONS", listName: "OFAC" }),
				createHit({ listType: "ADVERSE_MEDIA", listName: "Bad News" }),
				createHit({ listType: "OTHER", listName: "Other List" })
			];

			mockScoreAdverseMedia.mockResolvedValue({
				keywordsScore: 7,
				negativeSentimentScore: 6,
				entityFocusScore: 8,
				finalScore: 7,
				riskLevel: "MEDIUM",
				description: "Some risk"
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(1);
			expect(mockScoreAdverseMedia).toHaveBeenCalledTimes(1);
			expect(mockScoreAdverseMedia).toHaveBeenCalledWith("Bad News", ["Corp X"], []);
		});

		it("should return 0 when no ADVERSE_MEDIA hits exist", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listType: "PEP", listName: "PEP List" }),
				createHit({ listType: "SANCTIONS", listName: "OFAC" })
			];

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(0);
			expect(mockScoreAdverseMedia).not.toHaveBeenCalled();
			expect(mockInsertAdverseMedia).not.toHaveBeenCalled();
		});

		it("should return 0 for empty watchlist hits", async () => {
			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: [],
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(0);
		});
	});

	describe("scoring", () => {
		it("should score each ADVERSE_MEDIA hit with OpenAI and persist all", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "News Article 1", url: "https://example.com/1" }),
				createHit({ listName: "News Article 2", url: "https://example.com/2" })
			];

			mockScoreAdverseMedia
				.mockResolvedValueOnce({
					keywordsScore: 9,
					negativeSentimentScore: 8,
					entityFocusScore: 10,
					finalScore: 9,
					riskLevel: "HIGH",
					description: "High risk article",
					mediaType: "business"
				})
				.mockResolvedValueOnce({
					keywordsScore: 3,
					negativeSentimentScore: 2,
					entityFocusScore: 4,
					finalScore: 3,
					riskLevel: "LOW",
					description: "Low risk article",
					mediaType: "business"
				});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(2);
			expect(mockScoreAdverseMedia).toHaveBeenCalledTimes(2);
			expect(mockInsertAdverseMedia).toHaveBeenCalledTimes(1);

			const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.articles).toHaveLength(2);
			expect(insertedData.total_risk_count).toBe(2);
			expect(insertedData.high_risk_count).toBe(1);
			expect(insertedData.low_risk_count).toBe(1);
		});

		it("should pass individuals for person-level hits", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "Person in News" })
			];

			mockScoreAdverseMedia.mockResolvedValue({
				keywordsScore: 5,
				negativeSentimentScore: 4,
				entityFocusScore: 6,
				finalScore: 5,
				riskLevel: "MEDIUM",
				description: "Medium risk",
				mediaType: "individual",
				individuals: ["john doe"]
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: ["John Doe"],
				deps: defaultDeps
			});

			expect(mockScoreAdverseMedia).toHaveBeenCalledWith("Person in News", ["Corp X"], ["John Doe"]);
		});

		it("should create duplicate records for multiple individuals returned by OpenAI", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "Two People in News" })
			];

			mockScoreAdverseMedia.mockResolvedValue({
				keywordsScore: 7,
				negativeSentimentScore: 6,
				entityFocusScore: 8,
				finalScore: 7,
				riskLevel: "MEDIUM",
				description: "Medium risk",
				mediaType: "individual",
				individuals: ["john doe", "jane smith"]
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: ["John Doe", "Jane Smith"],
				deps: defaultDeps
			});

			expect(count).toBe(2);
			const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.articles).toHaveLength(2);
			expect(insertedData.articles[0].mediaType).toBe("john doe");
			expect(insertedData.articles[1].mediaType).toBe("jane smith");
		});
	});

	describe("scoring failure handling", () => {
		it("should skip article when OpenAI scoring fails (throws)", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "Failing Article", url: "https://example.com/fail" }),
				createHit({ listName: "Succeeding Article", url: "https://example.com/success" })
			];

			mockScoreAdverseMedia
				.mockRejectedValueOnce(new Error("OpenAI timeout"))
				.mockResolvedValueOnce({
					keywordsScore: 5,
					negativeSentimentScore: 4,
					entityFocusScore: 6,
					finalScore: 5,
					riskLevel: "MEDIUM",
					description: "Some risk"
				});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(1);
			expect(mockInsertAdverseMedia).toHaveBeenCalledTimes(1);
			const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.articles[0].title).toBe("Succeeding Article");
		});

		it("should skip article when scoreAdverseMedia returns undefined", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "Empty Result Article" })
			];

			mockScoreAdverseMedia.mockResolvedValue(undefined);

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(0);
			expect(mockInsertAdverseMedia).not.toHaveBeenCalled();
		});

		it("should not persist anything when all articles fail scoring", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "Article 1" }),
				createHit({ listName: "Article 2" })
			];

			mockScoreAdverseMedia.mockRejectedValue(new Error("OpenAI down"));

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(0);
			expect(mockInsertAdverseMedia).not.toHaveBeenCalled();
		});
	});

	describe("persistence", () => {
		it("should pass correct businessId and taskId to insertAdverseMedia", async () => {
			const hits: TruliooWatchlistHit[] = [createHit()];

			mockScoreAdverseMedia.mockResolvedValue({
				keywordsScore: 5,
				finalScore: 5,
				riskLevel: "MEDIUM",
				description: "test"
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-abc-123",
				taskId: "task-def-456",
				entityNames: ["Corp"],
				individuals: [],
				deps: defaultDeps
			});

			expect(mockInsertAdverseMedia).toHaveBeenCalledWith("biz-abc-123", "task-def-456", expect.any(Object));
		});

		it("should calculate average_risk_score correctly", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "Article 1", url: "https://example.com/article-1" }),
				createHit({ listName: "Article 2", url: "https://example.com/article-2" })
			];

			mockScoreAdverseMedia
				.mockResolvedValueOnce({ finalScore: 8, riskLevel: "HIGH", description: "high" })
				.mockResolvedValueOnce({ finalScore: 4, riskLevel: "LOW", description: "low" });
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp"],
				individuals: [],
				deps: defaultDeps
			});

			const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.average_risk_score).toBe(6);
		});

		it("should use hit url as article link, falling back to generated trulioo:// URI", async () => {
			const hitsWithUrl: TruliooWatchlistHit[] = [
				createHit({ listName: "With URL", url: "https://real-url.com" })
			];
			const hitsNoUrl: TruliooWatchlistHit[] = [
				createHit({ listName: "No URL", url: undefined })
			];

			mockScoreAdverseMedia.mockResolvedValue({
				finalScore: 5,
				riskLevel: "MEDIUM",
				description: "test"
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			await processAndPersistTruliooAdverseMedia({
				watchlistHits: hitsWithUrl,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp"],
				individuals: [],
				deps: defaultDeps
			});

			let insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.articles[0].link).toBe("https://real-url.com");

			jest.clearAllMocks();
			mockScoreAdverseMedia.mockResolvedValue({
				finalScore: 5,
				riskLevel: "MEDIUM",
				description: "test"
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			await processAndPersistTruliooAdverseMedia({
				watchlistHits: hitsNoUrl,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp"],
				individuals: [],
				deps: defaultDeps
			});

			insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.articles[0].link).toMatch(/^trulioo:\/\//);
		});

		it("should not throw when insertAdverseMedia fails", async () => {
			const hits: TruliooWatchlistHit[] = [createHit()];

			mockScoreAdverseMedia.mockResolvedValue({
				finalScore: 5,
				riskLevel: "MEDIUM",
				description: "test"
			});
			mockInsertAdverseMedia.mockRejectedValue(new Error("DB error"));

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(1);
		});
	});

	describe("deduplication", () => {
		it("should deduplicate articles with same (link, mediaType) before persisting", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "Same Story Version A", url: "https://example.com/same-url" }),
				createHit({ listName: "Same Story Version B", url: "https://example.com/same-url" }),
				createHit({ listName: "Different Story", url: "https://example.com/different-url" })
			];

			mockScoreAdverseMedia.mockResolvedValue({
				keywordsScore: 5,
				negativeSentimentScore: 4,
				entityFocusScore: 6,
				finalScore: 5,
				riskLevel: "MEDIUM",
				description: "test",
				mediaType: "business"
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(2);
			const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.articles).toHaveLength(2);
			expect(insertedData.total_risk_count).toBe(2);

			const links = insertedData.articles.map((a: { link: string }) => a.link);
			expect(links).toContain("https://example.com/same-url");
			expect(links).toContain("https://example.com/different-url");
		});

		it("should keep articles with same link but different mediaType", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "Shared Article", url: "https://example.com/shared" })
			];

			mockScoreAdverseMedia.mockResolvedValue({
				keywordsScore: 5,
				negativeSentimentScore: 4,
				entityFocusScore: 6,
				finalScore: 5,
				riskLevel: "MEDIUM",
				description: "test",
				individuals: ["john doe", "jane smith"]
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp X"],
				individuals: ["John Doe", "Jane Smith"],
				deps: defaultDeps
			});

			expect(count).toBe(2);
			const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.articles).toHaveLength(2);
			expect(insertedData.articles[0].mediaType).toBe("john doe");
			expect(insertedData.articles[1].mediaType).toBe("jane smith");
		});

		it("should deduplicate when same individual appears in multiple hits with same URL", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "Article A", url: "https://example.com/dup" }),
				createHit({ listName: "Article B", url: "https://example.com/dup" })
			];

			mockScoreAdverseMedia.mockResolvedValue({
				keywordsScore: 7,
				negativeSentimentScore: 6,
				entityFocusScore: 8,
				finalScore: 7,
				riskLevel: "MEDIUM",
				description: "risk",
				individuals: ["john doe"]
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp"],
				individuals: ["John Doe"],
				deps: defaultDeps
			});

			expect(count).toBe(1);
			const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.articles).toHaveLength(1);
			expect(insertedData.articles[0].link).toBe("https://example.com/dup");
			expect(insertedData.articles[0].mediaType).toBe("john doe");
		});

		it("should correctly compute risk counts after deduplication", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "High Risk", url: "https://example.com/high" }),
				createHit({ listName: "High Risk Dup", url: "https://example.com/high" }),
				createHit({ listName: "Low Risk", url: "https://example.com/low" })
			];

			mockScoreAdverseMedia
				.mockResolvedValueOnce({ finalScore: 9, riskLevel: "HIGH", description: "high", mediaType: "business" })
				.mockResolvedValueOnce({ finalScore: 8, riskLevel: "HIGH", description: "high dup", mediaType: "business" })
				.mockResolvedValueOnce({ finalScore: 2, riskLevel: "LOW", description: "low", mediaType: "business" });
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp"],
				individuals: [],
				deps: defaultDeps
			});

			const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
			expect(insertedData.articles).toHaveLength(2);
			expect(insertedData.total_risk_count).toBe(2);
			expect(insertedData.high_risk_count).toBe(1);
			expect(insertedData.low_risk_count).toBe(1);
			expect(insertedData.average_risk_score).toBe(5.5);
		});
	});

	describe("edge cases", () => {
		it("should skip hits with empty title/listName", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "", matchDetails: "" }),
				createHit({ listName: "Valid Title" })
			];

			mockScoreAdverseMedia.mockResolvedValue({
				finalScore: 5,
				riskLevel: "MEDIUM",
				description: "test"
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			const count = await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp"],
				individuals: [],
				deps: defaultDeps
			});

			expect(count).toBe(1);
			expect(mockScoreAdverseMedia).toHaveBeenCalledTimes(1);
			expect(mockScoreAdverseMedia).toHaveBeenCalledWith("Valid Title", ["Corp"], []);
		});

		it("should use matchDetails as fallback when listName is empty", async () => {
			const hits: TruliooWatchlistHit[] = [
				createHit({ listName: "", matchDetails: "Match Detail Title" })
			];

			mockScoreAdverseMedia.mockResolvedValue({
				finalScore: 5,
				riskLevel: "MEDIUM",
				description: "test"
			});
			mockInsertAdverseMedia.mockResolvedValue(undefined);

			await processAndPersistTruliooAdverseMedia({
				watchlistHits: hits,
				businessId: "biz-123",
				taskId: "task-456",
				entityNames: ["Corp"],
				individuals: [],
				deps: defaultDeps
			});

			expect(mockScoreAdverseMedia).toHaveBeenCalledWith("Match Detail Title", ["Corp"], []);
		});
	});

	describe("URL title/source enrichment", () => {
		describe("extractTitleFromUrl", () => {
			it("should extract readable title from URL slug with hyphens", () => {
				expect(extractTitleFromUrl("https://www.cbsnews.com/news/woman-allegedly-tried-to-fly-with-gift-wrapped-heroin/"))
					.toBe("Woman allegedly tried to fly with gift wrapped heroin");
			});

			it("should strip trailing numeric IDs from slug", () => {
				expect(extractTitleFromUrl("https://www.somersetlive.co.uk/news/somerset-news/somerset-farm-shop-owners-fined-10289060"))
					.toBe("Somerset farm shop owners fined");
			});

			it("should strip .html extension and trailing IDs", () => {
				expect(extractTitleFromUrl("https://www.standard.co.uk/news/world/man-behind-cia-interrogations-quizzed-ahead-of-911-trial-a4341031.html"))
					.toBe("Man behind cia interrogations quizzed ahead of 911 trial");
			});

			it("should return null for short slugs", () => {
				expect(extractTitleFromUrl("https://example.com/news")).toBeNull();
				expect(extractTitleFromUrl("https://example.com/1")).toBeNull();
			});

			it("should return null for URLs with no path", () => {
				expect(extractTitleFromUrl("https://example.com")).toBeNull();
				expect(extractTitleFromUrl("https://example.com/")).toBeNull();
			});

			it("should return null for invalid URLs", () => {
				expect(extractTitleFromUrl("not-a-url")).toBeNull();
				expect(extractTitleFromUrl("")).toBeNull();
			});

			it("should handle underscores in slugs", () => {
				expect(extractTitleFromUrl("https://example.com/some_long_article_title_here"))
					.toBe("Some long article title here");
			});
		});

		describe("extractSourceFromUrl", () => {
			it("should extract domain without www prefix", () => {
				expect(extractSourceFromUrl("https://www.cbsnews.com/some/path")).toBe("cbsnews.com");
			});

			it("should keep domain as-is when no www prefix", () => {
				expect(extractSourceFromUrl("https://patch.com/new-jersey/news")).toBe("patch.com");
			});

			it("should return null for invalid URLs", () => {
				expect(extractSourceFromUrl("not-a-url")).toBeNull();
				expect(extractSourceFromUrl("")).toBeNull();
			});
		});

		describe("integration with processor", () => {
			it("should use URL slug as title when listName is generic 'Adverse Media'", async () => {
				const hits: TruliooWatchlistHit[] = [
					createHit({
						listName: "Adverse Media",
						url: "https://www.cbsnews.com/news/james-mitchell-jailed-for-raping-boy-in-sheerness/"
					})
				];

				mockScoreAdverseMedia.mockResolvedValue({
					finalScore: 9, riskLevel: "HIGH", description: "high risk"
				});
				mockInsertAdverseMedia.mockResolvedValue(undefined);

				await processAndPersistTruliooAdverseMedia({
					watchlistHits: hits,
					businessId: "biz-123",
					taskId: "task-456",
					entityNames: ["Corp X"],
					individuals: [],
					deps: defaultDeps
				});

				expect(mockScoreAdverseMedia).toHaveBeenCalledWith(
					"James mitchell jailed for raping boy in sheerness",
					["Corp X"],
					[]
				);
			});

			it("should fall back to generic title when URL slug is too short", async () => {
				const hits: TruliooWatchlistHit[] = [
					createHit({ listName: "Adverse Media", url: "https://example.com/short" })
				];

				mockScoreAdverseMedia.mockResolvedValue({
					finalScore: 1, riskLevel: "LOW", description: "low"
				});
				mockInsertAdverseMedia.mockResolvedValue(undefined);

				await processAndPersistTruliooAdverseMedia({
					watchlistHits: hits,
					businessId: "biz-123",
					taskId: "task-456",
					entityNames: ["Corp X"],
					individuals: [],
					deps: defaultDeps
				});

				expect(mockScoreAdverseMedia).toHaveBeenCalledWith("Adverse Media", ["Corp X"], []);
			});

			it("should keep descriptive listName even when URL has a good slug", async () => {
				const hits: TruliooWatchlistHit[] = [
					createHit({
						listName: "Specific Descriptive Title",
						url: "https://www.cbsnews.com/news/some-completely-different-article-headline/"
					})
				];

				mockScoreAdverseMedia.mockResolvedValue({
					finalScore: 5, riskLevel: "MEDIUM", description: "medium"
				});
				mockInsertAdverseMedia.mockResolvedValue(undefined);

				await processAndPersistTruliooAdverseMedia({
					watchlistHits: hits,
					businessId: "biz-123",
					taskId: "task-456",
					entityNames: ["Corp X"],
					individuals: [],
					deps: defaultDeps
				});

				expect(mockScoreAdverseMedia).toHaveBeenCalledWith(
					"Specific Descriptive Title",
					["Corp X"],
					[]
				);
			});

			it("should use domain as source when sourceAgencyName is not provided", async () => {
				const hits: TruliooWatchlistHit[] = [
					createHit({
						listName: "Adverse Media",
						url: "https://www.cbsnews.com/news/some-long-article-title-about-crime/",
						sourceAgencyName: undefined
					})
				];

				mockScoreAdverseMedia.mockResolvedValue({
					finalScore: 5, riskLevel: "MEDIUM", description: "test"
				});
				mockInsertAdverseMedia.mockResolvedValue(undefined);

				await processAndPersistTruliooAdverseMedia({
					watchlistHits: hits,
					businessId: "biz-123",
					taskId: "task-456",
					entityNames: ["Corp X"],
					individuals: [],
					deps: defaultDeps
				});

				const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
				expect(insertedData.articles[0].source).toBe("cbsnews.com");
			});

			it("should prefer sourceAgencyName over domain when both available", async () => {
				const hits: TruliooWatchlistHit[] = [
					createHit({
						listName: "Adverse Media",
						url: "https://www.cbsnews.com/news/some-long-article-about-important-events/",
						sourceAgencyName: "Reuters"
					})
				];

				mockScoreAdverseMedia.mockResolvedValue({
					finalScore: 5, riskLevel: "MEDIUM", description: "test"
				});
				mockInsertAdverseMedia.mockResolvedValue(undefined);

				await processAndPersistTruliooAdverseMedia({
					watchlistHits: hits,
					businessId: "biz-123",
					taskId: "task-456",
					entityNames: ["Corp X"],
					individuals: [],
					deps: defaultDeps
				});

				const insertedData = mockInsertAdverseMedia.mock.calls[0][2];
				expect(insertedData.articles[0].source).toBe("Reuters");
			});
		});
	});
});
