import { TDateISO } from "#types";
import { UUID } from "crypto";

export interface SortField {
	field: 'entity_focus_score' | 'final_score' | 'risk_level' | 'date';
	order: 'asc' | 'desc';
}

export interface getAdverseMediaByBusinessIdParams {
	businessId: UUID;
	sortFields: SortField[];
}

export interface getAdverseMediaByCaseIdParams {
	caseId: UUID;
	sortFields: SortField[];
}

export interface FetchAdverseMediaReportsBody {
	customer_id: UUID;
	business_id: UUID;
	business_name: string;
	dba_names?: string[];
	case_id?: UUID;
	contact_names?: string[];
	city?: string;
	state?: string;
}

export interface AdverseMediaResponse {
	id?: UUID;
	case_id?: UUID;
	identifier?: string;
	found?: boolean;
	count?: number;
	articles: Array<AdverseMediaResponseArticle>;
	total_risk_count: number;
	high_risk_count: number;
	medium_risk_count: number;
	low_risk_count: number;
	average_risk_score: number;
}

interface AdverseMediaResponseArticle {
	id: UUID;
	title: string;
	link: string;
	date: string;
	source: string;
	keywordsScore: number;
	negativeSentimentScore: number;
	entityFocusScore: number;
	finalScore: number;
	riskLevel: "LOW" | "MEDIUM" | "HIGH";
	riskDescription: string;
	mediaType: "business" | string; // "business" or specific individual name
	created_at?: TDateISO;
}

export interface AnalyzeSearchResultsResponse {
	found: boolean;
	count: number;
	articles: Array<AdverseMediaResponseArticle>;
	total_risk_count: number;
	high_risk_count: number;
	medium_risk_count: number;
	low_risk_count: number;
	average_risk_score: number;
}
