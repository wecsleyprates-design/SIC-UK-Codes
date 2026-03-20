// imports here if needed

import IBanking from "#api/v1/modules/banking/types";
import { BJLStatus } from "#lib/facts/bjl/types";
import type { Fact, FactName, FactSource } from "#lib/facts/types";
import { GoogleProfile } from "#lib/serp";
import { AdverseMediaResponse } from "#api/v1/modules/adverse-media/types";
import { UUID } from "crypto";

// TODO: This is not final payload interface may change as code progresses
export interface I360Report {
	report_id?: UUID;
	business_id: UUID;
	case_id?: UUID;
	score_trigger_id?: UUID;
	customer_id?: UUID;
}

export interface Top10BankAccountOperationByAmount {
	date: string;
	description: string;
	amount: number;
}

export interface SpendingCategory {
	category: string;
	amount: number;
}

export interface BankAccountBalanceChartData {
	labels: string[];
	data: number[];
	currentBalance: string;
}

export interface IncomeVsExpensesChartData {
	incomes: number[];
	expenses: number[];
	month_year: string;
}

export interface DepositsChartData {
	category: string;
	deposits: number[];
	index: number;
	period: string;
}

export interface OpenAccounts {
	top10TransactionsByAmount: Top10BankAccountOperationByAmount[];
	top10RefundByAmount: Top10BankAccountOperationByAmount[];
	spendingByCategory: SpendingCategory[];
	bankAccountBalanceChartData: BankAccountBalanceChartData | null;
	incomeVsExpensesChartData: IncomeVsExpensesChartData | null;
	depositsChartData: DepositsChartData[];
	bankAccounts: BankAccountReportData[];
	creditCards: BankAccountReportData[];
}

export interface ICompanyOverviewResponse {
	details_and_industry: {
		company_details: {
			business_age: number;
		};
	};
}

export type AdverseMediaReport = AdverseMediaResponse | Record<string, never>;

export interface PublicRecordsResponse {
	complaints: {
		total_complaints: string;
		cfpb_complaints: string;
		ftc_complaints: string;
		answered_resolved_status: string;
		resolved_resolved_status: string;
		unanswered_resolved_status: string;
		unresolved_resolved_status: string;
		other_resolved_status: string;
	};
	judgements: {
		number_of_judgement_fillings: number | null;
		most_recent_judgement_filling_date: Date | null;
		most_recent_status: BJLStatus;
		most_recent_amount: number | null;
		total_judgement_amount: number | null;
	};
	bankruptcies: {
		number_of_bankruptcies: number | null;
		most_recent_bankruptcy_filing_date: Date | null;
		most_recent_status: BJLStatus;
	};
	liens: {
		number_of_business_liens: number | null;
		most_recent_business_lien_filing_date: Date | null;
		most_recent_status: BJLStatus;
		most_recent_amount: number | null;
		total_open_lien_amount: number | null;
	};
	platform_reviews: any[];
	average_rating: number | null;
	review_statistics: {
		review_count: number;
		count_of_total_reviewers_all_time: number;
		count_of_0_or_1_star_ratings_all_time: number;
		count_of_2_star_ratings_all_time: number;
		count_of_3_star_ratings_all_time: number;
		count_of_4_star_ratings_all_time: number;
		count_of_5_star_ratings_all_time: number;
		percentage_of_0_or_1_star_ratings_all_time: number;
		percentage_of_2_star_ratings_all_time: number;
		percentage_of_3_star_ratings_all_time: number;
		percentage_of_4_star_ratings_all_time: number;
		percentage_of_5_star_ratings_all_time: number;
	};
	most_relevant_reviews: any[];
	google_profile?: GoogleProfile & {
		business_match?: string;
		address_match?: string | null;
	};
	adverse_media: AdverseMediaReport;
}

export interface BankAccountReportData {
	id: UUID;
	bank_account: string;
	mask: string;
	bank_name: string;
	balance_current: string;
	balance_limit: string;
	type: string;
	official_name: string;
	match: boolean;
	institution_name: string;
	verification_result: IBanking.BankAccountVerificationRecord | null;
	ach_account_id?: UUID;
}

export interface ITaxFiling {
	year: number;
	month?: number;
	total_sales: number;
	total_compensation: number;
	total_wages: number;
	cost_of_goods_sold: number;
	total_irs_balance: number;
	total_lien_balance: number;
	total_amount_filed: number;
	total_penalty: number;
	total_interest: number;
	source_form: number;
	tax_period_ending_date: Date;
	filed_date: Date;
	interest_date: Date;
	penalty_date: Date;
}

export interface IncomeStatement {
	year: string;
	total_revenue: number;
	net_income: string;
	total_expenses: string;
	total_depreciation: string;
	total_cost_of_goods_sold: string;
	start_period: string;
	end_period: string;
}

export interface ExecutiveSummaryRevenue {
	year: string;
	total_revenue: number;
	total_expenses: number;
	quarter: number;
}

export interface BalanceSheet {
	total_assets: number;
	total_equity: number;
	total_liabilities: number;
	currency: string;
	start_date: string;
	end_date: string;
}

export interface Financials {
	incomeStatement: IncomeStatement[];
	balanceSheet: BalanceSheet[];
}

export interface KeyInsightsResponse {
	reportBreakDown?: {
		impactOfCompanyProfileScore?: string;
		impactOfFinancialTrendsScore?: string;
		impactOfPublicRecordsScore?: string;
		impactOfWorthScore: string;
		impactOfBaseScore?: string;
		impactOfLiquidityScore?: string;
		actionItemsForCompanyProfile?: string[];
		actionItemsForFinancialTrends?: string[];
		actionItemsForPublicRecords?: string[];
		actionItemsForWorthScore?: string[];
		actionItemsForBaseScore?: string[];
		actionItemsForLiquidity?: string[];
	};
	summary: string;
	suggestedQuestions?: string[];
}

export interface FactCompleteMessage {
	key: string;
	payload: {
		scope: FactSource["scope"];
		id: string;
		data: Record<FactName, Partial<Fact>>;
		calculated_at: Date;
		event: string;
	};
}

export enum EntityMatchingIntegrationsEnum {
	equifax = "equifax",
	zoominfo = "zoominfo",
	open_corporate = "open_corporate",
	canada_open = "canada_open",
	npi = "npi",
	match = "match"
}

export type EntityMatchingIntegrations = keyof typeof EntityMatchingIntegrationsEnum;
