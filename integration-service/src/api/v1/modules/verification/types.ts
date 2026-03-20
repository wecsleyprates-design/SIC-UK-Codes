import { UUID } from "crypto";
import type { BusinessEntityVerificationService } from "./businessEntityVerification";

export interface MiddeskAddress {
	address_line1: string;
	address_line2?: string;
	city: string;
	state: string;
	postal_code: string;
	full_address?: string;
}

export interface MiddeskPeople {
	name: string;
	first_name?: string;
	middle_name?: string;
	last_name?: string;
	dob?: string;
	ssn?: string;
	address_line1?: string;
	address_line2?: string;
	city?: string;
	state?: string;
	postal_code?: string;
	phone_number?: string;
	email?: string;
	device_session_id?: string;
	document_uuid?: string;
}

// reference: https://docs.middesk.com/reference/create-a-business
export interface MiddeskCreateBusinessPayload {
	name: string;
	tin?: { tin: string };
	website?: { url: string };
	addresses: MiddeskAddress[];
	people?: MiddeskPeople[];
	phone_numbers?: Array<{ phone_number: string }>;
	external_id?: string;
	orders?: Array<{ product: string }>;
	tags?: string[];
	formation?: { formation_state: string; entity_type: string };
	names?: Array<{ name: string; name_type: "dba" | "legal" }>;
	unique_external_id?: string;
	assignee_id?: string;
}

// reference: https://docs.middesk.com/reference/update-a-business
export interface MiddeskUpdateBusinessPayload {
	name?: string;
	tin?: { tin: string };
	website?: { url: string };
	addresses: MiddeskAddress[];
	people?: MiddeskPeople[];
	phone_numbers?: Array<{ phone_number: string }>;
	external_id?: string;
	names?: Array<{ name: string; name_type: "dba" | "legal" }>;
	unique_external_id?: string;
	assignee_id?: string;
}

export type BusinessWebsiteDetailsResponse = {
	creation_date: Date;
	expiration_date: Date;
	pages: PAGES[];
	url?: string | null;
};

export type PAGES = {
	category: string;
	url: string;
	text: string;
	screenshot_url: string;
};

export interface BusinessEntityWebsiteDetails {
	id: UUID;
	business_integration_task_id: UUID;
	business_id: UUID;
	url: string;
	creation_date: string;
	expiration_date: string;
	category: string;
	category_url: string;
	category_text: string;
	category_image_link: string;
	meta: any;
	created_at: string;
	updated_at: string;
}

export interface PeopleResponse {
	id: UUID;
	name: string;
	titles: string[];
	watchlist_results?: WatchlistPersonResult[];
}

export interface WatchlistPersonResult {
	id: string;
	url: string | null;
	type: "watchlist_result";
	list_country: string;
	metadata: {
		abbr: string;
		title: string;
		agency: string;
		agency_abbr: string;
		entity_name: string;
	};
	score: number;
	object: "watchlist_result";
	list_url: string | null;
	addresses: Array<{ full_address: string }>;
	listed_at: string | null;
	categories: string[];
	entity_name: string;
	list_region: string;
	entity_aliases: string[];
	agency_list_url: string | null;
	agency_information_url: string | null;
}

interface MiddeskBusinessData {
	external_id: string | null;
	metadata: any | null;
	id: string | null;
	name: string | null;
	tin: string | null;
	address_line_1: string | null;
	address_line_2: string | null;
	address_city: string | null;
	state: string | null;
	address_country: string | null;
	address_postal_code: string | null;
	mobile: string | null;
	official_website: string | null;
	naics_code: number;
	naics_title: string;
	industry: number;
	dba: string | null;
	year: string;
	is_revenue: number | null;
	is_operatingexpenses: number | null;
	is_netincome: number | null;
	is_cost_of_goods_sold: number | null;
	bs_totalliabilities: number | null;
	bs_totalassets: number | null;
	bs_totalequity: number | null;
	bs_accountspayable: number | null;
	bs_accountsreceivable: number | null;
	bs_cashandcashequivalents: number | null;
	bs_shortterminvestments: number | null;
	bs_totalcurrentassets: number | null;
	bs_totalcurrentliabilities: number | null;
	bs_totalnoncurrentliabilities: number | null;
	is_costofgoodsold: number | null;
	is_grossprofit: number | null;
	is_incometaxexpense: number | null;
	is_interestexpense: number | null;
	number_of_employees: number;
	business_type: string | null;
	sic_code: string | null;
	mcc_code: string | null;
	date_of_observation: string | null;
	lien_count: number | null;
	business_liens_file_date: string | null;
	business_liens_status: string | null;
	business_liens_status_date: string | null;
	bankruptcy_count: number | null;
	business_bankruptcies_file_date: string | null;
	business_bankruptcies_chapter: string | null;
	business_bankruptcies_voluntary: string | null;
	business_bankruptcies_status: string | null;
	business_bankruptcies_status_date: string | null;
	judgement_count: number | null;
	business_judgements_file_date: string | null;
	business_judgements_status: string | null;
	business_judgements_status_date: string | null;
	business_judgements_amount: number | null;
	review_cnt: number | null;
	review_score: number | null;
	runId: string;
}

export interface BulkUpdateMiddeskData {
	case_id: string;
	business_id: string;
	customer_id: string;
	user_id: string;
	created_at: string;
	data: MiddeskBusinessData;
	trigger: string;
}

export type GetBusinessEntityReview = Awaited<ReturnType<BusinessEntityVerificationService["getBusinessEntityReview"]>>;
