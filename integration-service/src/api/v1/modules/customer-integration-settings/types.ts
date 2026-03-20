import { UUID } from "crypto";

export interface CustomerIntegrationSettingsData {
	customer_id: UUID;
	settings: CustomerIntegrationSettingsSettingsData;
}

/* Legacy incoming payload (backward compatible) */
export interface LegacyCustomerIntegrationSettings {
	isBJLEnabled?: boolean;
	isGiactGverifyEnabled?: boolean;
	isGiactGauthenticateEnabled?: boolean;
	isAdverseMediaEnabled?: boolean;
}
/* New structured per-integration setting */
export type IntegrationStatus = "ACTIVE" | "INACTIVE";
export type IntegrationMode = "SANDBOX" | "PRODUCTION" | "MOCK";
export type IntegrationOptions = "PRODUCTION" | "SANDBOX" | "MOCK" | "DISABLE";
export type IntegrationCode =
	| "BJL"
	| "EQUIFAX"
	| "GVERIFY"
	| "GAUTHENTICATE"
	| "WEBSITE"
	| "NPI"
	| "IDENTITY_VERIFICATION"
	| "ADVERSE_MEDIA";

export interface IntegrationSetting {
	status: IntegrationStatus;
	code: IntegrationCode;
	label: string;
	description: string;
	mode: IntegrationMode;
	options: IntegrationOptions[];
	isEnabled?: boolean;
}

/* New settings map */
export interface CustomerIntegrationSettingsSettingsData {
	bjl?: IntegrationSetting;
	equifax?: IntegrationSetting;
	gverify?: IntegrationSetting;
	gauthenticate?: IntegrationSetting;
	website?: IntegrationSetting;
	npi?: IntegrationSetting;
	identity_verification?: IntegrationSetting;
	adverse_media?: IntegrationSetting;
	payment_processors?: IntegrationSetting;
	processor_orchestration?: IntegrationSetting;
}

export class IntegrationNotEnabledError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "IntegrationNotEnabledError";

		// Required for proper `instanceof` checks when targeting ES5/ES2015
		Object.setPrototypeOf(this, IntegrationNotEnabledError.prototype);
	}
}

