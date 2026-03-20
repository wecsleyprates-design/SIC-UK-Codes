import type { UUID } from "crypto";

export interface WebsiteScanRequest {
	caseId?: UUID | string;
	scoreTriggerId?: UUID | string;
	websiteUrl?: string;
}

export interface WebsiteScanResponse {
	object: "website";
	id: UUID | string;
	business_id: UUID | string;
	url: string;
	status: string;
	title: string;
	description: string;
	domain: WebsiteScanDomain;
	parked: boolean;
	business_name_match: boolean;
	pages: Array<WebsiteScanPage>;
}

export interface WebsiteScanPage {
	category: string;
	url: string;
	text: string;
	screenshot_url: string;
	html_content_url: string;
}

export interface WebsiteScanDomain {
	domain: string;
	creation_date: string;
	expiration_date: string;
	registrar: {
		organization: string;
		name: string;
		url: string;
	};
}

interface OriginalCompanyData {
	id: string;
	company_name: string;
	dba: string;
	company_address: string;
	company_city: string;
	company_state: string;
	company_postalcode: string;
	email: string;
	website_url: string;
	phone_number: string;
	primary_naics_code: string;
	contact_name: string;
}

interface SerpApiData {
	title: string;
	address: string;
	city: string;
	state: string;
	postal: string;
	phone: string;
	website: string;
	type: string;
	status: string;
	latitude: number;
	longitude: number;
	rating: number;
	reviews: number;
	naics: string;
	industry: string;
	industryConfidence: string;
}

interface WebsiteDiscoveryData {
	companyDba: string;
	discoveredWebsite: string;
}

export interface WhoisData {
	domain: string;
	found: boolean;
	registrar: string;
	creationDate: string;
	expirationDate: string;
	updatedDate: string;
	domainAgeDays: number;
	nameServers: string[];
	domainStatus: string[];
}

export interface WebsitePageData {
	url: string;
	index: number;
	homepageFullPath: string;
	homepageFoldPath: string;
	htmlContentPath: string;
	htmlContent: string;
	textContent: string;
	websiteTitleScraped: string;
	websiteMetaDescription: string;
	success: boolean;
	errorMessage: string;
	timestamp: string;
}

interface WebScrapingData {
	mainWebsite: WebsitePageData;
	additionalScreenshots: WebsitePageData[];
	totalScreenshots: number;
	urlsParsed: number;
	overallSuccess: boolean;
}

interface MetadataInfo {
	processedAt: string;
	processingTimeSeconds: number;
	enrichmentSteps: string[];
}

export interface CompanyEnrichmentData {
	original: OriginalCompanyData;
	serpApi: SerpApiData;
	websiteDiscovery: WebsiteDiscoveryData;
	whois: WhoisData;
	webScraping: WebScrapingData;
	metadata: MetadataInfo;
}
