import { z } from "zod";

/** Direct match of the business name and address in Google Maps */
export interface GoogleBusinessMatch {
	title: string;
	place_id: string;
	data_id: string;
	data_cid: string;
	reviews_link: string;
	photos_link: string;
	gps_coordinates: {
		latitude: number;
		longitude: number;
	};
	place_id_search: string;
	provider_id: string;
	thumbnail: string;
	rating: number;
	reviews: number;
	price: string;
	unclaimed_listing?: boolean;
	type: string[];
	type_ids: string[];
	menu?: {
		link: string;
		source: string;
	};
	service_options: {
		no_contact_delivery?: boolean;
		delivery: boolean;
		takeout: boolean;
		dine_in: boolean;
	};
	extensions?: { dining_options: any[] }[];
	address: string;
	website: string;
	phone: string;
	open_state: string;
	plus_code: string;
	images: {
		title: string;
		thumbnail: string;
	}[];
	questions_and_answers?: { question: any; answer: any; total_answers: number }[];
	user_reviews: {
		summary: any[];
		most_relevant: any[];
	};
	rating_summary: {
		stars: number;
		amount: number;
	}[];
	people_also_search_for?: { search_term: string; local_results: any[] }[];
	web_results_link: string;
	serpapi_web_results_link: string;
}

/** A local result from Google Maps, not a direct match of the business name and address */
export interface GoogleLocalResult {
	position: number;
	title: string;
	place_id: string;
	data_id: string;
	data_cid: string;
	reviews_link: string;
	photos_link: string;
	gps_coordinates: {
		latitude: number;
		longitude: number;
	};
	place_id_search: string;
	provider_id: string;
	rating: number;
	reviews: number;
	price: string;
	type: string;
	types: string[];
	type_id: string;
	type_ids: string[];
	address: string;
	open_state: string;
	hours: string;
	operating_hours: {
		[day: string]: string;
	};
	phone: string;
	website: string;
	service_options: {
		dine_in: boolean;
		takeout: boolean;
		delivery: boolean;
	};
	order_online: string;
	thumbnail: string;
}

export interface GoogleReview {
	link: string;
	rating: number;
	date: string;
	iso_date: string;
	iso_date_of_last_edit: string;
	images: string[];
	source: string;
	review_id: string;
	user: {
		name: string;
		link: string;
		contributor_id: string;
		thumbnail: string;
		reviews: number;
		photos: number;
	};
	snippet: string;
	extracted_snippet: {
		original: string;
	};
	details: {
		service: number;
		meal_type: string;
		food: number;
		atmosphere: number;
	};
	likes: number;
	response?: {
		date: string;
		iso_date: string;
		iso_date_of_last_edit: string;
		snippet: string;
		extracted_snippet: {
			original: string;
		};
	};
}

export const businessLegitimacyClassificationSchema = z.object({
	naics_code: z.number(),
	secondary_naics_code: z.number(),
	sic_code: z.number(),
	secondary_sic_code: z.number(),
	confidence_in_business_legitimacy: z.number()
});

export type BusinessLegitimacyClassification = z.infer<typeof businessLegitimacyClassificationSchema>;

export const serializedWebsiteDataSchema = z.object({
	company_description: z.string().describe("A description of the company"),
	target_audience: z.string().describe("The target audience of the company"),
	industry: z.string().describe("The industry of the company"),
	industry_vertical: z.string().describe("The industry vertical of the company"),
	industry_mapped: z.string().describe("The industry mapped to our internal industry taxonomy"),
	relevant_tags: z.array(z.string()).describe("The relevant tags of the company")
});

export type SerializedWebsiteData = z.infer<typeof serializedWebsiteDataSchema>;

export const reviewSynthesisSchema = z.object({
	worst_review: z.string().optional().nullable(),
	best_review: z.string().optional().nullable(),
	general_sentiment: z.string(),
	relevant_emotions: z.array(z.string()),
	suggested_focus_area: z.string()
});

export type GeneralReviewSynthesis = z.infer<typeof reviewSynthesisSchema>;

export type SerpScrapeResponseSchema = {
	businessMatch: GoogleBusinessMatch | null;
	local_results: GoogleLocalResult[];
	topLocalResult: GoogleLocalResult | null;
	businessWebsite: string | null;
	rawSerpResponse: any;
	reviewSynthesis: GeneralReviewSynthesis | null;
	topGoogleReviews: GoogleReview[];
	googleReviewsLink: string | null;
	totalGoogleReviews: number | null;
	overallGoogleRating: number | null;
	serializedWebsiteData: SerializedWebsiteData | null;
	parsedLocalResultAddressDetails: any;
	businessLegitimacyClassification: BusinessLegitimacyClassification | null;
};

export const schema = {
	dataScrape: z.object({
		body: z.object({
			businessName: z.string(),
			businessDbaName: z.string().optional(),
			businessAddress: z.string(),
			persistGoogleReviews: z.boolean().optional(),
			is_bulk: z.boolean().optional()
		}),
		params: z.object({
			businessID: z.string().uuid()
		})
	}),
	getSerpResult: z.object({
		params: z.object({
			businessID: z.string().uuid()
		})
	}),
	getGoogleProfile: z.object({
		params: z.object({
			businessID: z.string().uuid()
		})
	}),
	searchGoogleProfile: z.object({
		params: z.object({
			businessID: z.string().uuid()
		}),
		body: z.object({}).optional()
	})
};
