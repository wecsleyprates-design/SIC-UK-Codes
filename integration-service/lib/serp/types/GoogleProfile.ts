import { VALUE_NOT_AVAILABLE } from "#constants";

export interface GoogleProfile {
	business_name: string | null;
	address: string | null;
	phone_number: string | null;
	website: string | null;
	rating: number | null;
	reviews: number | null;
	thumbnail: string | null;
	gps_coordinates: { latitude: number | null; longitude: number | null } | typeof VALUE_NOT_AVAILABLE | null;
	google_search_link: string | null;
}
