import type { UUID } from "crypto";

export type PublicRecord = {
	id: string;
	business_integration_task_id: string;
	number_of_business_liens: number;
	most_recent_business_lien_filing_date: Date | null;
	most_recent_business_lien_status: string;
	number_of_bankruptcies: number;
	most_recent_bankruptcy_filing_date: Date | null;
	number_of_judgement_fillings: number;
	most_recent_judgement_filling_date: Date | null;
	corporate_filing_business_name: string;
	corporate_filing_filling_date: Date | null;
	corporate_filing_incorporation_state: string;
	corporate_filing_corporation_type: string;
	corporate_filing_resgistration_type: string;
	corporate_filing_secretary_of_state_status: string;
	corporate_filing_secretary_of_state_status_date: Date | null;
	average_rating: number;
	angi_review_count: number;
	angi_review_percentage: number;
	bbb_review_count: number;
	bbb_review_percentage: number;
	google_review_count: number;
	google_review_percentage: number;
	yelp_review_count: number;
	yelp_review_percentage: number;
	healthgrades_review_count: number;
	healthgrades_review_percentage: number;
	vitals_review_count: number;
	vitals_review_percentage: number;
	webmd_review_count: number;
	webmd_review_percentage: number;
	created_at: Date;
	updated_at: Date;
	monthly_rating: number;
	monthly_rating_date: Date | undefined;
	official_website: string;
};

export type FeatureStore = {
	rev_0182: number; //average rating
	rev_0014: number; //angi review count
	rev_0021: number; //bbb review percentage
	rev_0035: number; //google review count
	rev_0042: number; //yelp
	rev_0049: number; //healthgrades
	rev_0056: number; //vitals
	rev_0063: number; //webmd
	rev_0070: number; //angi %
	rev_0077: number; //bbb %
	rev_0091: number; // google %
	rev_0098: number; // yelp %
	rev_0105: number; // healthgrades %
	rev_0112: number; // vitals %
	rev_0119: number; // webmd%
	rev_0176: number; // monthly rating
	rev_0126: number; // all review counts
	archive: string; //Date in YYYY-MM-DD format
	[key: string]: any; //all other keys are in pattern of rev_[number]
};
/**
 * @deprecated
 * New Verdata responses populate the BLJ object instead of ThirdPartyData
 */
type MDYDate = `${number}/${number}/${number}`;
export type ThirdPartyData = {
	/** num of judgements */
	BUS_JUDGEMENT_SUMMARY_001: number;
	/** Most Recent Judgement Filing Date */
	BUS_JUDGEMENT_SUMMARY_002: MDYDate | "";
	/** Most Recent Judgement Status */
	BUS_JUDGEMENT_SUMMARY_003: string;
	/** Most Recent Judgement Status Date */
	BUS_JUDGEMENT_SUMMARY_004: MDYDate | "";
	/** Most Recent Judgement Amount */
	BUS_JUDGEMENT_SUMMARY_005: number;

	/** num of liens */
	BUS_LIENS_SUMMARY_001: number;
	/** most recent lien filing date */
	BUS_LIENS_SUMMARY_002: MDYDate | "";
	/** most recent lien status */
	BUS_LIENS_SUMMARY_003: string;
	/** most recent lien status change date */
	BUS_LIENS_SUMMARY_004: MDYDate | "";

	/** num of bankruptcies */
	BUS_BANKRUPTCY_SUMMARY_001: number;
	/** most recent bankruptcy filing date */
	BUS_BANKRUPTCY_SUMMARY_002: MDYDate | "";
	/** bankruptcy chapter (11|13) */
	BUS_BANKRUPTCY_SUMMARY_003: number;
	/** was bankruptcy voluntary */
	BUS_BANKRUPTCY_SUMMARY_004: Boolean;
	/** most recent bankruptcy status */
	BUS_BANKRUPTCY_SUMMARY_005: string;
	/** most recent bankruptcy status change date */
	BUS_BANKRUPTCY_SUMMARY_006: MDYDate | "";

	/** Corporate Filing Business Name */
	CORP_FILING_001: string;
	/** Corporate Filing Filing Date */
	CORP_FILING_002: MDYDate | "";
	/** Corporate Filing Incorporation State */
	CORP_FILING_003: string;
	/** Corporate Filing Corporation Type */
	CORP_FILING_004: string;
	/** Corporate Filing Registration Type */
	CORP_FILING_005: string;
	/** Corporate Filing Secretary of State Status */
	CORP_FILING_006: string;
	/** Corporate Filing Secretary of State Status Date */
	CORP_FILING_007: MDYDate | "";
};

export type Platforms = "Angi" | "BBB" | "Google" | "Yelp" | "Healthgrades" | "Vitals" | "Webmd" | "BuildZoom";
export type BreakdownReviews = {
	[key in Platforms]: {
		id: UUID;
		lender: string;
		created_at: Date;
		updated_at: Date;
		review_dt: Date;
		name: string;
		location: string;
		rating: number;
		review_text: string;
		mongo_id: string;
		lender_merchant: UUID;
	}[];
};
export type PublicReviews = {
	all_time: BreakdownReviews;
	past_one_months: BreakdownReviews;
	past_three_months: BreakdownReviews;
	past_six_months: BreakdownReviews;
	past_one_year: BreakdownReviews;
	past_two_years: BreakdownReviews;
	past_three_years: BreakdownReviews;
};

export type Seller = {
	name: string;
	name_dba: string;
	address_line_1: string;
	address_line_2: string;
	city: string;
	state: string;
	zip5: string;
	zip4: string;
	dpc: string;
	phone: string;
	fax: string;
	email: string;
	domain_name: string;
	ein: string;
	sic_code: string;
};

export type WorthInternalOrder = {
	business_id: UUID | string;
	name: string;
	address_line_1: string;
	address_line_2?: string;
	city: string;
	state: string;
	zip5: string;
	ein?: string;
	phone?: string;
	name_dba?: string;
	task_id?: UUID | string;
};

export type Search = {
	address_line_1: string;
	address_line_2?: string;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	tin: string | null;
	name: string;
	phone?: string;
	alt_phone?: string;
	ein: ?string;
	email?: string;
	domain_name?: string;
	callback?: string;
};
export type SellerDetailedSearch = Search & {
	legal_entity_name?: string;
};
export type SellerSearch = Search & {
	alt_name?: string;
};

export type SellerSubmission = {
	created_by: string | null;
	inquiry_id?: string | null;
	business_phone: string | null;
	business_name: string;
	business_state: string;
} & (
	| {
			callback?: null | never;
			business_address: string | null;
			business_city: string | null;
			business_zip5: string | null;
	  }
	| {
			callback: string;
			business_address: string;
			business_city: string;
			business_zip5: string;
	  }
);

export type SearchResponse = {
	status: string;
	request_id: UUID;
};

export type DetailedSearchStatus = {
	status: string;
	redirect_url: string | null;
};

export type Record = {
	seller_id: string | UUID;
	request_id: string | UUID;
	dashboard_url: string;
	seller: Seller;
	/**
	 * @deprecated
	 * ThirdPartyData is deprecated inside Verdata -- now referenced in `blj` object
	 */
	ThirdPartyData?: ThirdPartyData[];
	blj: BLJ | BLJ[];

	feature_store: FeatureStore[];
	vRisk?: vRisk[];
	furnished_sources: any[];
	flagged_related_sellers: any[];
	children: any[];
	inquiry_history: any[];
	match_score: {
		score: null | number;
		ein_score: number;
		addr_score: number;
		name_score: number;
		phone_score: number;
		domain_score: number;
	};
	next_best_matches: any[];
	parents: any[];
	principals: Array<{
		dpc: string;
		city: string;
		zip4: string;
		zip5: string;
		email: string;
		phone: string;
		state: string;
		suffix?: string;
		last_name: string;
		first_name: string;
		middle_name?: string;
		principal_id: UUID | string;
		address_line_1: string;
		address_line_2?: string;
		principal_type?: string;
	}>;
	public_sources: any[];
	regulatory_complaint_details: any[];
	related_sellers: any[];
	scorecard_score: any;
	scores: any[];
	secretary_of_state: any;
	public_reviews: PublicReviews;
	siblings: any[];
	doctors: any[];
	third_party_sources: any[];
	total_inquiry_count: number;
};

export type vRisk = {
	curr_score: string;
	prev_score: string;
	updated_at: Date;
	merchant_id: Date;
	curr_score_tier: "green" | "yellow" | "red";
	prev_score_tier: "green" | "yellow" | "red";
	curr_reason_codes: null;
	prev_reason_codes: null;
};

export type RequestHeaders = {
	"Content-Type": "application/json";
	Authorization: string;
	Key: string;
	LenderId: string;
};

export type EnqueuedTask = {
	task_id: UUID;
};

export type BLJ = {
	liens: Array<Lien>;
	judgements: Array<Judgement>;
	bankruptcies: Array<Bankruptcy>;
	summary: {} | Summary;
	corp_filing: Array<{
		name: string;
		filing_date: Date;
		incorporation_state: string;
		corp_type: string;
		entity_type: string;
		status: string;
		status_date: Date;
	}>;
	uccs: any[];
	merchant: any;
	locations: any[];
	principals: any[];
	watchlists: any[];
};

// YMDDate is a string in the format of YYYY-MM-DD (0 padded month & day)
type YMDDate = `${number}-${string}-${string}`;
type NumericString = `${number}`;

type BaseBLJFields = {
	id?: UUID;
	created_at?: Date;
	updated_at?: Date;
	transunion_business?: UUID;
};

export type Summary = {
	id: UUID;
	merchant: UUID;
	created_at: Date;
	updated_at: Date;
	business_token: string | null;
	lender_merchant: UUID;
	lien_debtor_count: number | null;
	lien_holder_count: number | null;
	judgement_debtor_count: number | null;
	judgement_creditor_count: number | null;
	bankruptcy_subject_count: number | null;
	bankruptcy_creditor_count: number | null;
};

export type Lien = BaseBLJFields & {
	status: string | null;
	lien_type: string | null;
	tax_reason: null;
	debtor_city: string | null;
	debtor_name: string | null;
	debtor_zip4: NumericString | null;
	debtor_zip5: NumericString | null;
	filing_city: string | null;
	filing_date: YMDDate | null;
	filing_zip4: NumericString | null;
	filing_zip5: NumericString | null;
	holder_name: string | null;
	lien_amount: number | null;
	status_date: YMDDate | null;
	debtor_addr1: string | null;
	debtor_addr2: string | null;
	debtor_state: string | null;
	filing_addr1: string | null;
	filing_addr2: string | null;
	filing_state: string | null;
	filing_number: string | null;
	received_date: YMDDate | null;
	filing_gov_level: string | null;
	filing_type_desc: string | null;
	filing_office_city: string | null;
	filing_office_name: string | null;
	filing_office_zip4: NumericString | null;
	filing_office_zip5: NumericString | null;
	filing_office_addr1: string | null;
	filing_office_addr2: string | null;
	filing_office_state: null;
	debtor_business_name: string | null;
	debtor_business_token: string | null;
	lien_type_description: string | null;
	filing_number_descriptor: string | null;
	lien_holder_government_level: string | null;
};

export type Judgement = BaseBLJFields & {
	debtor_name: string | null;
	debtor_business_name: string | null;
	debtor_business_token: string | null;
	debtor_addr1: string | null;
	debtor_addr2: string | null;
	debtor_city: string | null;
	debtor_state: string | null;
	debtor_zip5: string | null;
	debtor_zip4: string | null;
	creditor_name: string | null;
	filing_date: YMDDate | null;
	status_date: YMDDate | null;
	status: string | null;
	verification_date: YMDDate | null;
	filing_number: string | null;
	filing_number_descriptor: string | null;
	amount_awarded: number | null;
	judgement_type: string | null;
	received_date: YMDDate | null;
	filing_office_name: string | null;
	filing_office_addr1: string | null;
	filing_office_addr2: string | null;
	filing_office_city: string | null;
	filing_office_state: string | null;
	filing_office_zip5: NumericString | null;
	filing_office_zip4: NumericString | null;
	filing_addr1: string | null;
	filing_addr2: string | null;
	filing_city: string | null;
	filing_state: string | null;
	filing_zip5: NumericString | null;
	filing_zip4: NumericString | null;
};

export type Bankruptcy = BaseBLJFields & {
	event_date: Date | null;
	event_desc: string | null;
	debtor_name: string | null;
	debtor_business_name: string | null;
	debtor_business_token: string | null;
	debtor_addr1: string | null;
	debtor_addr2: string | null;
	debtor_city: string | null;
	debtor_state: string | null;
	debtor_zip5: NumericString | null;
	debtor_zip4: NumericString | null;
	attorney_firm_name: string | null;
	attorney_first_name: string | null;
	attorney_middle_name: string | null;
	attorney_last_name: string | null;
	attorney_suffix: string | null;
	attorney_title: string | null;
	status: string | null;
	filing_number: string | null;
	filing_date: YMDDate | null;
	status_date: YMDDate | null;
	verification_date: YMDDate | null;
	filing_chapter_number: string | null;
	voluntary_filing_flag: string | null;
	judge_report_token: string | null;
	judge_first_name: string | null;
	judge_middle_name: string | null;
	judge_last_name: string | null;
	judge_suffix: string | null;
	judge_title: string | null;
	court_name: string | null;
	court_addr1: string | null;
	court_addr2: string | null;
	court_city: string | null;
	court_state: string | null;
	court_zip5: NumericString | null;
	court_zip4: NumericString | null;
};

type Principals = {};
