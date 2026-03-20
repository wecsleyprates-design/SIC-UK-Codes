import type { TruliooWatchlistHit } from "./types";
import type { AdverseMediaResponse } from "#api/v1/modules/adverse-media/types";
import { logger } from "#helpers/logger";
import type { UUID } from "crypto";

interface ScoredArticle {
	title: string;
	link: string;
	date: string;
	source: string;
	keywordsScore: number;
	negativeSentimentScore: number;
	entityFocusScore: number;
	finalScore: number;
	riskLevel: "LOW" | "MEDIUM" | "HIGH";
	riskDescription: string;
	mediaType: string;
}

interface TruliooAdverseMediaProcessorDeps {
	scoreAdverseMedia: (title: string, entityNames: string[], individuals: string[]) => Promise<{
		keywordsScore?: number;
		negativeSentimentScore?: number;
		entityFocusScore?: number;
		finalScore?: number;
		riskLevel?: string;
		description?: string;
		mediaType?: string;
		individuals?: string[];
	} | undefined>;
	insertAdverseMedia: (businessId: UUID, taskId: UUID, data: AdverseMediaResponse) => Promise<void>;
}

/**
 * Derives a human-readable title from a URL slug.
 * Trulioo ADVERSE_MEDIA hits only provide generic listName ("Adverse Media"),
 * but the URL slug often contains the real article headline.
 *
 * Returns null when the slug is too short or the URL is unparseable.
 */
export function extractTitleFromUrl(url: string): string | null {
	try {
		const parsed = new URL(url);
		const segments = parsed.pathname.split("/").filter(Boolean);
		if (segments.length === 0) return null;
		let slug = segments[segments.length - 1];
		slug = slug.replace(/\.\w+$/, "");
		slug = slug.replace(/-[a-z]?\d{5,}$/, "");
		slug = slug.replace(/[-_]/g, " ").trim();
		if (slug.length < 10) return null;
		return slug.charAt(0).toUpperCase() + slug.slice(1);
	} catch {
		return null;
	}
}

/**
 * Extracts a clean domain name from a URL to use as article source.
 * e.g. "https://www.cbsnews.com/..." -> "cbsnews.com"
 */
export function extractSourceFromUrl(url: string): string | null {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}

/**
 * Extracts ADVERSE_MEDIA hits from Trulioo watchlist results, scores each with OpenAI,
 * and persists them into the adverse_media / adverse_media_articles tables.
 *
 * If scoring fails for a specific article, that article is skipped (not persisted)
 * following the same pattern as the SerpAPI adverse media flow.
 */
export async function processAndPersistTruliooAdverseMedia(params: {
	watchlistHits: TruliooWatchlistHit[];
	businessId: string;
	taskId: string;
	entityNames: string[];
	individuals: string[];
	deps: TruliooAdverseMediaProcessorDeps;
}): Promise<number> {
	const { watchlistHits, businessId, taskId, entityNames, individuals, deps } = params;

	const adverseMediaHits = watchlistHits.filter(
		hit => (hit.listType ?? "").toUpperCase() === "ADVERSE_MEDIA"
	);

	if (adverseMediaHits.length === 0) {
		return 0;
	}

	logger.info({
		businessId,
		taskId,
		adverseMediaCount: adverseMediaHits.length
	}, "Processing Trulioo adverse media hits for scoring and persistence");

	const scoredArticles: ScoredArticle[] = [];

	for (const hit of adverseMediaHits) {
		const rawTitle = hit.listName || hit.matchDetails || "";
		if (!rawTitle) {
			logger.warn({ businessId, listType: hit.listType }, "Skipping adverse media hit with no title/listName");
			continue;
		}

		const urlTitle = hit.url ? extractTitleFromUrl(hit.url) : null;
		const isGenericTitle = rawTitle.toLowerCase() === "adverse media";
		const title = (isGenericTitle && urlTitle) ? urlTitle : rawTitle;

		try {
			const riskScore = await deps.scoreAdverseMedia(title, entityNames, individuals);

			if (!riskScore) {
				logger.warn({ title }, "OpenAI scoring returned empty result, skipping article");
				continue;
			}

			const article: ScoredArticle = {
				title,
				link: hit.url || `trulioo://${hit.listType}/${hit.listName || "unknown"}`,
				date: new Date().toISOString(),
				source: hit.sourceAgencyName || (hit.url ? extractSourceFromUrl(hit.url) : null) || "Trulioo Watchlist",
				keywordsScore: riskScore.keywordsScore || 0,
				negativeSentimentScore: riskScore.negativeSentimentScore || 0,
				entityFocusScore: riskScore.entityFocusScore || 0,
				finalScore: riskScore.finalScore || 0,
				riskLevel: (riskScore.riskLevel as "LOW" | "MEDIUM" | "HIGH") || "LOW",
				riskDescription: riskScore.description || "",
				mediaType: riskScore.mediaType || "business"
			};

			const individualsList = riskScore.individuals || [];
			if (individualsList.length > 0) {
				for (const individualName of individualsList) {
					scoredArticles.push({ ...article, mediaType: individualName.toLowerCase() });
				}
			} else {
				scoredArticles.push(article);
			}
		} catch (error) {
			logger.error({ err: error, title }, "OpenAI scoring failed for adverse media article, skipping");
		}
	}

	if (scoredArticles.length === 0) {
		logger.info({ businessId }, "No adverse media articles scored successfully, nothing to persist");
		return 0;
	}

	// Deduplicate by (link, mediaType) to match the DB UNIQUE constraint on (link, business_id, media_type).
	// PostgreSQL rejects batch INSERTs with ON CONFLICT DO UPDATE when the same conflict target appears twice.
	const seen = new Set<string>();
	const uniqueArticles = scoredArticles.filter(article => {
		const key = `${article.link}::${article.mediaType}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	if (uniqueArticles.length < scoredArticles.length) {
		logger.info({
			businessId,
			before: scoredArticles.length,
			after: uniqueArticles.length
		}, "Deduplicated adverse media articles by (link, mediaType)");
	}

	const adverseMediaData: AdverseMediaResponse = {
		articles: uniqueArticles as AdverseMediaResponse["articles"],
		total_risk_count: uniqueArticles.length,
		high_risk_count: uniqueArticles.filter(a => a.riskLevel === "HIGH").length,
		medium_risk_count: uniqueArticles.filter(a => a.riskLevel === "MEDIUM").length,
		low_risk_count: uniqueArticles.filter(a => a.riskLevel === "LOW").length,
		average_risk_score: uniqueArticles.length > 0
			? Number((uniqueArticles.reduce((sum, a) => sum + a.finalScore, 0) / uniqueArticles.length).toFixed(2))
			: 0
	};

	try {
		await deps.insertAdverseMedia(businessId as UUID, taskId as UUID, adverseMediaData);
		logger.info({
			businessId,
			taskId,
			articlesCount: uniqueArticles.length
		}, "Trulioo adverse media articles scored and persisted successfully");
	} catch (error) {
		logger.error({ err: error, businessId }, "Failed to persist Trulioo adverse media articles");
	}

	return uniqueArticles.length;
}
