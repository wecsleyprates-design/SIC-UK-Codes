import { SerpSearchResponse } from "./SerpSearchResponse";

export interface SerpSearchResponseWithPlaceResults extends SerpSearchResponse {
	place_results: {
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
		serpapi_thumbnail: string;
		rating_summary: {
			stars: number;
			amount: number;
		}[];
		rating: number;
		reviews: number;
		type: string[];
		type_ids: string[];
		extensions: {
			service_options?: string[];
			accessibility?: string[];
		}[];
		unsupported_extensions: {
			service_options?: string[];
		}[];
		service_options: {
			onsite_services: boolean;
			online_appointments: boolean;
		};
		address: string;
		website: string;
		phone: string;
		open_state: string;
		plus_code: string;
		serpapi_posts_link: string;
		images: {
			title: string;
			thumbnail: string;
			serpapi_thumbnail: string;
		}[];
		user_reviews: {
			summary: {
				snippet: string;
			}[];
			most_relevant: {
				username: string;
				rating: number;
				contributor_id: string;
				description: string;
				link: string;
				date: string;
			}[];
		};
		people_also_search_for: {
			search_term: string;
			local_results: {
				position: number;
				title: string;
				data_id: string;
				data_cid: string;
				reviews_link: string;
				photos_link: string;
				gps_coordinates: {
					latitude: number;
					longitude: number;
				};
				place_id_search: string;
				rating: number;
				reviews: number;
				thumbnail: string;
				type: string[];
			}[];
		}[];
		web_results_link: string;
		serpapi_web_results_link: string;
	};
}
