import type { OwnerType } from "#constants";

export namespace Business {
	export interface Egg {
		name: string;
		mobile?: string;
		status: Status;
		created_by: string;
		updated_by: string;
		id?: string;
		tin?: string;
		official_website?: string;
		public_website?: string;
		social_account?: string;
		address_line_1?: string;
		address_line_2?: string;
		address_city?: string;
		address_state?: string;
		address_postal_code?: string;
		address_country?: string;
		industry?: number;
		naics_code?: number;
		naics_title?: string;
		naics_id?: number;
		mcc_code?: number;
		mcc_title?: string;
		mcc_id?: number;
		created_at?: string;
		updated_at?: string;
		quick_add?: boolean;
		skip_credit_check?: boolean;
		bypass_ssn?: boolean;
	}
	export interface Record extends Egg {
		id: string;
		created_at: string;
		updated_at: string;
	}

	export interface WithCustomer extends Record {
		customer_id: string;
		external_id: string;
		metadata: any;
		is_monitoring_enabled: boolean;
	}

	export interface WithSubscription extends Record {
		subscription: { status: string; created_at: Date; updated_at: Date };
	}

	export interface WithBusinessNames extends Record {
		business_names: BusinessName[];
	}

	export interface BusinessName {
		name: string;
		is_primary: boolean;
	}
	export interface WithBusinessAddresses extends Record {
		business_addresses: BusinessAddress[];
	}

	export interface BusinessAddress {
		line_1: string;
		apartment?: string | null;
		city: string;
		state: string;
		country: string;
		postal_code: string;
		mobile?: string | null;
		is_primary: boolean;
	}
	export interface WithOwners extends Record {
		owners: Owner[];
	}

	export interface Owner {
		id: string;
		external_id?: string | null;
		title?: {
			id: number;
			title: string;
		} | null;
		first_name: string;
		last_name: string;
		ssn: string | null;
		email: string | null;
		mobile: string | null;
		date_of_birth: string | null;
		address_line_1: string | null;
		address_line_2?: string | null;
		address_apartment?: string | null;
		address_city: string | null;
		address_state: string | null;
		address_postal_code: string | null;
		address_country: string | null;
		ownership_percentage: number;
		owner_type: OwnerType;
		is_owner_beneficiary?: boolean;
	}

	export interface BusinessCountRow {
		month_in_tz: string;
		month: string;
		total_businesses_count: number;
	}

	export interface LatestYeartRow {
		latest_year: number;
	}
	export type BusinessCountResult = {
		rows: BusinessCountRow[];
	};

	export type LatestYearResult = {
		rows: LatestYeartRow[];
	};

	export enum Status {
		"VERIFIED" = "VERIFIED",
		"UNVERIFIED" = "UNVERIFIED"
	}
	export type NaicsAndMccCode = {
		naics_code: number;
		naics_description: string;
		mcc_code: number;
		mcc_description: string;
	};
}
