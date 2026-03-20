import { WebsitePageData } from "./types";

interface CategoryResult {
	category: string;
	confidence: number;
	keywords: string[];
}

export class WebsitePageCategorizer {
	private static CATEGORIES = {
		Product: {
			keywords: ["products", "catalog", "shop", "store", "inventory", "items", "gift"],
			urlPatterns: [/\/products/, /\/catalog/, /\/shop/, /\/store/, /\/inventory/, /\/gift/],
			contentKeywords: ["buy", "purchase", "price", "add to cart", "product", "item"],
			weight: 9
		},

		Service: {
			keywords: ["services", "solutions", "offerings", "what we do", "order", "platform"],
			urlPatterns: [/\/services/, /\/solutions/, /\/offerings/, /\/what-we-do/, /\/order/, /\/platform/],
			contentKeywords: ["service", "solution", "consultation", "professional", "expertise", "platform"],
			weight: 9
		},

		About: {
			keywords: ["about", "company", "story", "history", "mission", "vision", "team", "who we are"],
			urlPatterns: [/\/about/, /\/company/, /\/story/, /\/history/, /\/mission/, /\/team/],
			contentKeywords: ["founded", "established", "our story", "our mission", "our team", "leadership"],
			weight: 8
		},

		Contact: {
			keywords: ["contact", "reach", "get in touch", "find us", "locations", "address", "phone"],
			urlPatterns: [/\/contact/, /\/reach/, /\/locations/, /\/find-us/, /\/store-locator/],
			contentKeywords: ["phone", "email", "address", "location", "hours", "contact us"],
			weight: 8
		},

		"Privacy/Legal": {
			keywords: ["privacy", "policy", "policies", "terms", "legal", "cookies"],
			urlPatterns: [/\/privacy/, /\/policy/, /\/policies/, /\/terms/, /\/legal/, /\/cookies/],
			contentKeywords: ["privacy policy", "terms of service", "legal", "cookies", "data protection"],
			weight: 8
		},

		Shopping: {
			keywords: ["shop", "store", "cart", "checkout", "buy", "purchase"],
			urlPatterns: [/\/shop/, /\/store/, /\/cart/, /\/checkout/, /\/buy/],
			contentKeywords: ["add to cart", "checkout", "payment", "shipping", "order"],
			weight: 6
		},

		Support: {
			keywords: ["support", "help", "faq", "customer service", "assistance"],
			urlPatterns: [/\/support/, /\/help/, /\/faq/, /\/customer-service/],
			contentKeywords: ["help", "support", "frequently asked", "customer service", "troubleshoot"],
			weight: 6
		},

		Blog: {
			keywords: ["blog", "news", "articles", "insights", "updates"],
			urlPatterns: [/\/blog/, /\/news/, /\/articles/, /\/insights/, /\/updates/],
			contentKeywords: ["posted", "published", "read more", "article", "blog post"],
			weight: 5
		},

		Careers: {
			keywords: ["careers", "jobs", "employment", "hiring", "work with us"],
			urlPatterns: [/\/careers/, /\/jobs/, /\/employment/, /\/hiring/],
			contentKeywords: ["career", "job", "apply", "employment", "hiring", "position"],
			weight: 5
		},

		Account: {
			keywords: ["account", "login", "signin", "register", "profile", "dashboard"],
			urlPatterns: [/\/account/, /\/login/, /\/signin/, /\/register/, /\/profile/, /\/dashboard/],
			contentKeywords: ["sign in", "log in", "register", "account", "profile", "dashboard"],
			weight: 6
		},

		Reviews: {
			keywords: ["reviews", "testimonials", "feedback", "ratings"],
			urlPatterns: [/\/reviews/, /\/testimonials/, /\/feedback/, /\/ratings/],
			contentKeywords: ["review", "testimonial", "rating", "feedback", "customer says"],
			weight: 4
		},

		Portfolio: {
			keywords: ["portfolio", "gallery", "showcase", "work", "projects"],
			urlPatterns: [/\/portfolio/, /\/gallery/, /\/showcase/, /\/work/, /\/projects/],
			contentKeywords: ["portfolio", "gallery", "project", "showcase", "our work"],
			weight: 5
		},

		Pricing: {
			keywords: ["pricing", "plans", "cost", "packages", "rates"],
			urlPatterns: [/\/pricing/, /\/plans/, /\/cost/, /\/packages/, /\/rates/],
			contentKeywords: ["price", "cost", "plan", "package", "rate", "subscription"],
			weight: 6
		}
	};

	static categorize(pageData: WebsitePageData): CategoryResult[] {
		const results: CategoryResult[] = [];
		const url = pageData.url.toLowerCase();
		const title = pageData.websiteTitleScraped.toLowerCase();
		const description = pageData.websiteMetaDescription.toLowerCase();
		// const content = pageData.text_content.toLowerCase();

		for (const [categoryName, category] of Object.entries(WebsitePageCategorizer.CATEGORIES)) {
			let score = 0;
			const matchedKeywords: string[] = [];

			// Check URL patterns (highest weight)
			for (const pattern of category.urlPatterns) {
				if (pattern.test(url)) {
					score += category.weight * 2;
					matchedKeywords.push("url_pattern");
					break;
				}
			}

			// Check URL keywords
			for (const keyword of category.keywords) {
				if (url.includes(keyword)) {
					score += category.weight * 1.5;
					matchedKeywords.push(`url:${keyword}`);
				}
			}

			// Check title keywords
			for (const keyword of category.keywords) {
				if (title.includes(keyword)) {
					score += category.weight * 1.2;
					matchedKeywords.push(`title:${keyword}`);
				}
			}

			// Check meta description keywords
			for (const keyword of category.keywords) {
				if (description.includes(keyword)) {
					score += category.weight;
					matchedKeywords.push(`meta:${keyword}`);
				}
			}

			// Check content keywords
			// Commenting this out for now, as it may lead to false positives due to how we're currently grabbing content from a webpage.
			// for (const keyword of category.contentKeywords) {
			//     if (content.includes(keyword)) {
			//         score += category.weight * 0.8;
			//         matchedKeywords.push(`content:${keyword}`);
			//     }
			// }

			// Calculate confidence (normalize to 0-100)
			const confidence = Math.min(100, (score / (category.weight * 3)) * 100);

			if (confidence > 10) {
				// Only include results with reasonable confidence
				results.push({
					category: categoryName,
					confidence: Math.round(confidence),
					keywords: matchedKeywords
				});
			}
		}

		// Sort by confidence (highest first)
		return results.sort((a, b) => b.confidence - a.confidence);
	}

	static getPrimaryCategory(pageData: WebsitePageData): string {
		const results = WebsitePageCategorizer.categorize(pageData);
		return results.length > 0 ? results[0].category : "";
	}
}
