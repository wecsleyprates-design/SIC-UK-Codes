import { SerpSearchResponse } from "./SerpSearchResponse";

export interface SerpSearchResponseWithKnowledgeGraph extends SerpSearchResponse {
	search_information: {
		query_displayed: string;
		total_results: number;
		time_taken_displayed: number;
		organic_results_state: string;
	};
	knowledge_graph: {
		title: string;
		type: string;
		entity_type: string;
		kgmid: string;
		knowledge_graph_search_link: string;
		serpapi_knowledge_graph_search_link: string;
		place_id: string;
		website?: string;
		reviews?: string;
		local_map?: {
			image: string;
			link: string;
		};
		rating?: number;
		review_count?: number;
		located_in?: string;
		located_in_links?: { text: string; link: string }[];
		address?: string;
		address_links?: { text: string; link: string }[];
		phone?: string;
		merchant_description?: string;
		user_reviews?: {
			summary: string;
			link: string;
			user: {
				name: string;
				link: string;
				thumbnail: string;
			};
		}[];
		permanently_closed?: boolean;
		people_also_search_for?: {
			name: string;
			extensions?: string[];
			place_id: string;
			link: string;
			serpapi_link: string;
			image: string;
		}[];
	};
	related_questions?: {
		question: string;
		type: string;
		snippet?: string;
		title?: string;
		link?: string;
		displayed_link?: string;
		source_logo?: string;
		serpapi_link?: string;
		text_blocks?: {
			type: string;
			snippet?: string;
			list?: {
				title: string;
				link?: string;
				snippet: string;
			}[];
		}[];
		references?: {
			title: string;
			link: string;
			snippet: string;
			source: string;
			index: number;
		}[];
	}[];
	organic_results?: {
		position: number;
		title: string;
		link: string;
		redirect_link?: string;
		displayed_link: string;
		favicon?: string;
		snippet: string;
		snippet_highlighted_words?: string[];
		source?: string;
		rich_snippet?: {
			top: {
				detected_extensions?: Record<string, string | number>;
				extensions?: string[];
			};
		};
	}[];
}
