export type StrategyConfig = {
	baseUrl: string;
	tenantName: string;
	clientId: string;
	clientSecret: string;
};

export interface KYXVerificationOptions {
	clientReference?: string;
	checks?: string[];
	testMode?: boolean;
	plan?: boolean;
	userConsent?: boolean;
}

export interface KYXUserBody {
	firstName?: string;
	middleName?: string;
	lastName?: string;
	ssn?: string;
	dob?: string;
	email?: string;
	address1?: string;
	address2?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
	phoneNumber?: string;
	options?: KYXVerificationOptions;
}

export interface KYXVerificationRequest {
	clientReference?: string;
	checks: string[];
	country: string;
	userConsent: boolean;
	testMode?: boolean;
	plan?: boolean;
	[key: string]: any;
}
export interface KYXVerificationResponse {
  txId: string
  timestamp: string
  prefillExpress?: Prefill
  prefill?: Prefill
}

export interface Prefill {
  status: string
  details: Details
  reasonCodes: string[]
  reasons: Reason[]
  attributes: Attributes
  sources: Source2[]
}

export interface Details {
  person: Person | null
  phone: Phone | null
  emails: any[] | null
  addresses: Address[] | null
  additionalProfiles: any
}

export interface Person {
  firstName: string
  middleName: string
  lastName: string
  fullName: string
  dob: string
  ssn: string
}

export interface Phone {
  activityScore: number
  phoneNumber: string
  type: string
  carrier: string
}

export interface Address {
  address1: string
  address2: string
  city: string
  state: string
  county: string
  postalCode: string
  zip4: string
  country: string
}

export interface Reason {
  code: string
  message: string
}

export interface Attributes {
  phoneNumber: PhoneNumber
}

export interface PhoneNumber {
  status: string
  sourceId: string
  sources: Source[]
}

export interface Source {
  sourceId: string
  status: string
}

export interface Source2 {
  sourceId: string
  id: string
  matchCode: string
  matchCriteria: string[]
}