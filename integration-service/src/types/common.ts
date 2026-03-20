import { UUID } from "crypto";

export interface UserInfo {
	user_id: UUID | string;
	email: string;
	role: {
		id: number;
		code: string;
	};
	given_name: string;
	family_name: string;
	customer_id?: UUID | string;
	is_guest_owner?: boolean;
	issued_for?: {
		customer_id: UUID | string;
		first_name: string;
		last_name: string;
		user_id: UUID | string;
	} | null;
	subrole_id?: UUID | string;
}

interface ILocals {
	user: UserInfo;
}

export type TResponseLocals = {
	locals: ILocals;
};

export type TResponseFlagValue = {
	featureFlagValue?: boolean | string | number | Record<string, any>;
};

export interface IFlagConfig {
	contextBy: string;
	defaultValue?: boolean;
}

export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;
