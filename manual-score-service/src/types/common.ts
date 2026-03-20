export interface UserInfo {
	user_id: string;
	email: string;
	role: {
		id: number;
		code: string;
	};
	given_name: string;
	family_name: string;
}

interface ILocals {
	user: UserInfo;
}

export interface TResponseLocals {
	locals: ILocals;
}

export interface TResponseFlagValue {
	featureFlagValue?: boolean | string | number | Record<string, any>;
}

export interface IFlagConfig {
	contextBy: string;
	defaultValue?: boolean;
}

// Use Types for Score Config
export interface PlatformEntry {
	name: string;
	required?: boolean;
}

export interface CategoryEntry {
	required?: boolean;
	minPlatforms?: number;
	platforms: PlatformEntry[];
}

export type MetaCondition =
	| {
			type: string;
			name: string;
			valueType: string;
			operator: string;
			value: string | number | boolean | null;
			required?: boolean;
	  }
	| {
			type: string;
			conditions: MetaCondition[];
	  };

export interface ValidationConfig {
	categories: Record<string, CategoryEntry>;
	metaCondition?: MetaCondition;
}
