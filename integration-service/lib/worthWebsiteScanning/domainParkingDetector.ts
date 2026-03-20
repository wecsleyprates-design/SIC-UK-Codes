import type { WhoisData } from "./types";

interface ParkingAnalysis {
	isLikelyParked: boolean;
	confidence: number;
	indicators: string[];
}

export class DomainParkingDetector {
	private static readonly PARKING_KEYWORDS = [
		"domain for sale",
		"buy this domain",
		"parked free",
		"coming soon",
		"under construction",
		"page not found",
		"related searches",
		"premium domain",
		"domain marketplace",
		"expired domain",
		"domain auction",
		"this domain may be for sale",
		"inquire about this domain",
		"domain parking",
		"contact us to buy this domain",
		"contact us about this domain",
		"make an offer on this domain",
		"monetize your domain",
		"monetize this domain",
	];

	private static readonly PARKING_NAME_SERVER_PATTERNS = [
		/parklogic/i,
		/sedo/i,
		/parkingcrew/i,
		/afternic/i,
		/bodis/i,
		/above\.com/i,
		/namecheap/i,
		/dan\.com/i,
		/fabulous/i,
		/domainactive/i,
		/undeveloped\.com/i
	];

	private static readonly PARKING_REGISTRAR_PATTERNS = [
		/dot holding/i,
		/fabulous/i,
		/namecheap/i,
		/sedo/i
	];

	private static readonly PARKED_SCORE = 5;

	static analyzeParking(whoisData: WhoisData, htmlContent?: string): ParkingAnalysis {
		let score = 0;
		const indicators: string[] = [];

		// WHOIS-based indicators (weaker signals)
		score += this.analyzeWhoisData(whoisData, indicators);

		// HTTP content indicators (stronger signals)
		if (htmlContent) {
			score += this.analyzeHttpContent(htmlContent, indicators);
		}

		const confidence = Math.min(score / 10, 1); // Normalize to 0-1
		const isLikelyParked = score >= DomainParkingDetector.PARKED_SCORE;

		return {
			isLikelyParked,
			confidence,
			indicators
		};
	}

	private static analyzeWhoisData(whoisData: WhoisData, indicators: string[]): number {
		let score = 0;

		if (
			whoisData.nameServers &&
			whoisData.nameServers.some(ns =>
				DomainParkingDetector.PARKING_NAME_SERVER_PATTERNS.some(pattern => pattern.test(ns))
			)
		) {
			score += 3;
			indicators.push("Nameserver matches known parking provider");
		}

		if (
			whoisData.registrar &&
			DomainParkingDetector.PARKING_REGISTRAR_PATTERNS.some(pattern => pattern.test(whoisData.registrar))
		) {
			score += 2;
			indicators.push("Registrar matches known parking registrar");
		}

		if (
			whoisData.domainStatus &&
			whoisData.domainStatus.some(status =>
			["client delete prohibited", "client transfer prohibited", "client update prohibited"].includes(
				status.toLowerCase()
			)
			)
		) {
			score += 1;
			indicators.push("Has lock statuses (client delete/transfer/update prohibited)");
		}

		// Very new domain with long expiration (speculation indicator)
		const creationDate = new Date(whoisData.creationDate);
		const expirationDate = new Date(whoisData.expirationDate);
		const now = new Date();

		const domainAgeMonths = (now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
		const yearsUntilExpiration = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365);

		if (domainAgeMonths < 6 && yearsUntilExpiration > 5) {
			score += 1;
			indicators.push("New domain with long-term registration (speculation pattern)");
		}

		return score;
	}

	private static analyzeHttpContent(htmlContent: string, indicators: string[]): number {
		let score = 0;
		const content = htmlContent.toLowerCase();

		// Direct parking keywords
		const foundKeywords = DomainParkingDetector.PARKING_KEYWORDS.filter(keyword => content.includes(keyword.toLowerCase()));

		if (foundKeywords.length > 0) {
			score += foundKeywords.length * 2;
			indicators.push(`Found parking keywords: ${foundKeywords.join(", ")}`);
		}

		// High advertisement density
		const adCount = (content.match(/advertisement|google_ads|adsystem/g) || []).length;
		if (adCount > 5) {
			score += 2;
			indicators.push(`High ad density: ${adCount} ad-related elements`);
		}

		// Excessive iframes (common in parking pages)
		const iframeCount = (content.match(/<iframe/g) || []).length;
		if (iframeCount > 5) {
			score += 1;
			indicators.push(`Many iframes: ${iframeCount} (typical of ad-heavy parking pages)`);
		}

		// Very short content with mostly ads/links
		const textContent = content.replace(/<[^>]*>/g, "").trim();
		if (textContent.length < 500 && (adCount > 0 || iframeCount > 0)) {
			score += 1;
			indicators.push("Minimal content with ads (parking pattern)");
		}

		// Meta tags indicating parking
		const metaTags = content.match(/<meta[^>]*>/g) || [];
		const parkingMeta = metaTags.some(tag => DomainParkingDetector.PARKING_KEYWORDS.some(keyword => tag.toLowerCase().includes(keyword)));

		if (parkingMeta) {
			score += 1;
			indicators.push("Meta tags suggest parking");
		}

		return score;
	}

	static isParked(whoisData: WhoisData, htmlContent?: string): boolean {
		return DomainParkingDetector.analyzeParking(whoisData, htmlContent).isLikelyParked;
	}
}
