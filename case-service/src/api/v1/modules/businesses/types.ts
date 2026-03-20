import type { UUID } from "crypto";

export interface InvitationResponse {
	data?: any[];
	message: string;
}

export interface CaseDetails {
	id: string;
	applicant_id: string;
	customer_id?: string;
	status: number;
	business_id: string;
	case_type: number;
	assignee?: string;
	assigner?: string;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
}

export interface CustomerDetailsByBusinessID {
	business_id: string;
	customer_id: string;
	created_at: Date;
	created_by: string;
	is_monitoring_enabled: boolean;
	external_id?: any;
	metadata?: any;
}

export interface CustomFields {
	label: string;
	field: string;
	value?: any;
}

export interface RedisCaseCache {
	body: {
		businessID: UUID;
		userID: UUID;
		inviteID: UUID;
		customerID: UUID | null;
		placeID: string;
	};
	userInfo: any;
}

export interface GetCustomerBusinessesRequestParams {
	customerID: string;
}

export interface GetCustomerBusinessesRequestQuery {
	pagination?: `${boolean}`;
	items_per_page?: number;
	page?: number;
	sort?: {
		"data_businesses.name"?: "ASC" | "DESC";
		"data_businesses.created_at"?: "ASC" | "DESC";
	};
	filter?: {
		"data_businesses.status"?: ["VERIFIED", "UNVERIFIED"];
		"rel_business_customer_monitoring.is_monitoring_enabled"?: `${boolean}`;
	};
	search?: {
		"data_businesses.id"?: string;
		"data_businesses.name"?: string;
		"data_businesses.id::text"?: string;
	};
	search_filter?: {
		"data_businesses.id"?: string;
		external_id?: string;
	};
	filter_date?: { "data_businesses.created_at"?: string | string[] };
}

export interface GetCustomerBusinessesResponse {
	records: {
		id: string;
		name: string;
		tin: string;
		status: string;
		naics_code?: string;
		naics_title?: string;
		mcc_code?: string;
		mcc_title?: string;
		customer_id?: string;
		is_monitoring_enabled?: boolean;
		external_id?: string;
	}[];
	total_pages: number;
	total_items: number;
}

export interface UpdateBusinessEntityData {
	name: string;
	dba_names?: string[] | undefined;
	tin?: string | undefined;
	addresses: {
		address_line_1: string | undefined;
		address_line_2: string | undefined;
		address_postal_code: string | undefined;
		address_city: string | undefined;
		address_state: string | undefined;
	}[];
	official_website: string | undefined;
}


export interface ProcessingHistoryData {
	id: string;
	case_id: string;
	ocr_document_id: string | null;
	american_express_data: TransactionData;
	card_data: TransactionData;
	point_of_sale_data: PointOfSaleData;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	general_data: GeneralData;
	seasonal_data: SeasonalData;
	file_name: string | null;
	file_path: string | null;
	file?: {
		fileName?: any;
		signedRequest?: string;
		url?: string;
	};
}

type TransactionData = {
	annual_volume?: number | string;
	desired_limit?: number | string;
	monthly_volume?: number | string;
	high_ticket_size?: number | string;
	average_ticket_size?: number | string;
};

type PointOfSaleData = {
	e_commerce?: number | string;
	typed_cards?: number | string;
	swiped_cards?: number | string;
	mail_telephone?: number | string;
};

type GeneralData = {
	annual_volume?: number | string;
	desired_limit?: number | string;
	monthly_volume?: number | string;
	high_ticket_size?: number | string;
	average_ticket_size?: number | string;
	explanation_of_high_ticket?: number | string;
	monthly_occurrence_of_high_ticket?: number | string;
};

type SeasonalData = {
	high_volume_months?: number | string;
	explanation_of_high_volume_months?: number | string;
	is_seasonal_business?: boolean | string;
};

export interface AccountingStatementData {
	id: string;
	file_name: string;
	file_path: string;
}

export interface GetPurgedBusinessesRequestQuery {
	customerID?: UUID | null | "";
	pagination?: `${boolean}`;
	items_per_page?: number;
	page?: number;
	sort?: {
		"data_businesses.name"?: "ASC" | "DESC";
		"data_businesses.created_at"?: "ASC" | "DESC";
	};
	search?: {
		"data_businesses.id"?: string;
		"data_businesses.name"?: string;
		"data_businesses.id::text"?: string;
	};
	search_filter?: {
		"data_businesses.id"?: string;
		external_id?: string;
	};
	filter_date?: { "data_businesses.created_at"?: string | string[] };
}

export interface GetPurgedBusinessesResponse {
	records: {
		id: string;
		business_id: string;
		name: string;
		tin: string;
		customer_id?: string;
		deleted_at: Date;
		deleted_by: string;
	}[];
	total_pages: number;
	total_items: number;
}

export interface AgingConfig {
	thresholds: { low?: number; medium?: number; high?: number };
	custom_messages: {
		low?: string;
		medium?: string;
		high?: string;
	};
}

// Search Customer Businesses Types
export interface SearchCustomerBusinessesRequestParams {
	customerID: string;
}

export interface SearchCustomerBusinessesRequestQuery {
	query?: string;
	limit?: number;
}

export interface SearchBusinessResult {
	id: string;
	business_id: string;
	name: string;
	location: string;
	case_id?: string;
}

export interface SearchCustomerBusinessesResponse {
	records: SearchBusinessResult[];
	total: number;
}
