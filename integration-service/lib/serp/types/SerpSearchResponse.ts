export interface SerpSearchResponse {
	search_metadata: {
		id: string;
		status: string;
		json_endpoint: string;
		pixel_position_endpoint: string;
		created_at: string;
		processed_at: string;
		google_url: string;
		raw_html_file: string;
		total_time_taken: number;
	};
	search_parameters: {
		engine?: string;
		q?: string;
		google_domain?: string;
		device?: string;
		type?: string;
		hl?: string;
		place_id?: string;
	};
}
