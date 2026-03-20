import { UUID } from "crypto";
import { TDateISO } from "./datetime";
/* Types to describe Worth's API responses */
type EncryptedString = string;
interface Base<T = any> {
	status: string;
	message: string;
	data: T;
	[key: string]: any;
}
export type Owner = {
	id: UUID;
	title: number | null;
	first_name: string | null;
	last_name: string | null;
	ssn?: EncryptedString | null;
	email?: string | null;
	mobile?: number | string | null;
	date_of_birth: EncryptedString | null; //encrypted
	address_apartment?: string | null;
	address_line_1?: string | null;
	address_line_2?: string | null;
	address_city?: string | null;
	address_state?: string | null;
	address_postal_code?: string | null;
	address_country: string | null;
	created_at: TDateISO;
	created_by: UUID;
	updated_at: TDateISO;
	updated_by: UUID;
	last_four_of_ssn?: string | number | undefined;
	year_of_birth?: number | undefined;
};
// With the information that's in the owner rel table
export type OwnerWithRel = Owner & {
	owner_type: "CONTROL" | "BENEFICIARY";
	ownership_percentage: number;
};
export interface OwnerResponse extends Base {
	data: Owner[];
}

/**
 * An interface representing the response.data property of the GET /internal/businesses/:businessID endpoint.
 */
export interface GetInternalBusinessResponseData {
	id: string;
	name: string;
	tin: string;
	address_line_1: string;
	address_line_2: string | null;
	address_city: string;
	address_state: string;
	address_postal_code: string;
	address_country: string;
	created_at: string;
	created_by: string;
	updated_at: string;
	updated_by: string;
	mobile: string;
	official_website: string;
	public_website: string | null;
	social_account: string | null;
	status: string;
	industry: {
		id: number;
		name: string;
		code: string;
		sector_code: string;
		created_at: string;
		updated_at: string;
	};
	mcc_id: number | null;
	naics_id: number | null;
	naics_code: string | null;
	naics_title: string | null;
	mcc_code: string | null;
	mcc_title: string | null;
	is_monitoring_enabled: boolean | null;
	subscription: {
		status: string | null;
		created_at: string | null;
		updated_at: string | null;
	};
	business_names: Array<{
		name: string;
		is_primary: boolean;
	}>;
	business_addresses: Array<{
		line_1: string;
		apartment: string | null;
		city: string;
		state: string;
		country: string;
		postal_code: string;
		mobile: string;
		is_primary: boolean;
	}>;
}

/**
 * An interface representing the response from the GET /internal/businesses/:businessID endpoint.
 */
export interface GetInternalBusinessResponse extends Base<GetInternalBusinessResponseData> {}
