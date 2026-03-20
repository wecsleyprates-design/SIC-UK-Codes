import type { ReportResponse } from "#api/v1/modules/accounting/types";
import type { IEquifaxJudgementsLiens } from "#lib/equifax/types";
import type { ZoomInfoResponse } from "#lib/zoominfo/types";
import { isNumericString } from "#utils";
import type { FactEngine } from "../factEngine";
import { sources, type SourceName } from "../sources";
import { simpleFactToFacts, type Fact, type SimpleFact } from "../types";
import currency from "currency.js";

const simpleFacts: SimpleFact = {
	revenue: {
		accountingIncomeStatements: async (_, accountingIncomeStatements: ReportResponse) => extractFromAccountingIncomeStatements(accountingIncomeStatements, "total_revenue"),
		// Equifax gives us the revenue in thousands so we need to multiply by 1000
		equifax: async (_, equifax: IEquifaxJudgementsLiens) => equifax?.scoring_model?.corpamount && equifax.scoring_model.corpamount * 1000,
		manual: "is_revenue",
		zoominfo: async (_, zoominfo: ZoomInfoResponse) => {
			const revenue = zoominfo?.firmographic?.zi_c_company_revenue;

			if (typeof revenue === "number" || isNumericString(revenue)) {
				// Zoominfo also gives us the revenue in thousands, so we need to multiply by 1000
				return currency(revenue).multiply(1000).value;
			}

			return undefined;
		}
	},
	revenue_confidence: {
		calculated: {
			dependencies: ["revenue"],
			fn: calculateRevenueConfidence
		}
	},
	net_income: {
		accountingIncomeStatements: async (_, accountingIncomeStatements: ReportResponse) => extractFromAccountingIncomeStatements(accountingIncomeStatements, "net_income")
	},
	revenue_equally_weighted_average: {
		calculated: {
			dependencies: ["revenue"],
			fn: calculatedEquallyWeightedAverage
		}
	}
};

function getMostRecentIncomeStatement(accountingIncomeStatements: ReportResponse): Record<string, any> {
	const reportValues = Object.values(accountingIncomeStatements.accounting_incomestatement as Record<string, any>);
	return reportValues.sort((a, b) => new Date(b.end_period).getTime() - new Date(a.end_period).getTime())[0];
}

async function calculateRevenueConfidence(engine: FactEngine) {
	const revenueFact = engine.getResolvedFact("revenue");
	if (revenueFact?.value && typeof revenueFact.value === "number") {
		// Zoominfo has their own confidence metric for revenue
		if ((revenueFact.source?.name as SourceName) === "zoominfo" && sources.zoominfo?.rawResponse?.firmographic?.zi_c_company_revenue_confidence) {
			return sources.zoominfo.rawResponse.firmographic.zi_c_company_revenue_confidence;
		}
		// Otherwise use the confidence from the revenue fact
		return revenueFact.confidence ?? revenueFact.source?.confidence;
	}
}

export async function extractFromAccountingIncomeStatements(statment: ReportResponse, path: string) {
	if (statment.accounting_incomestatement) {
		const mostRecentIncomeStatement = getMostRecentIncomeStatement(statment);
		if (mostRecentIncomeStatement?.[path] === null || mostRecentIncomeStatement?.[path] === undefined) return null;
		return currency(mostRecentIncomeStatement[path]).value;
	}

	return null;
}

async function calculatedEquallyWeightedAverage(engine: FactEngine) {
	const revenueFact = engine.getResolvedFact("revenue");
	if (revenueFact?.value && typeof revenueFact.value === "number") {
		const revenueValue = revenueFact.value;
		// Get alternative revenue sources
		if (revenueValue !== undefined && revenueFact.alternatives && revenueFact.alternatives.length > 0) {
			let revenueSources = 1;
			const totalRevenue = revenueFact.alternatives.reduce((acc, alternative) => {
				if (alternative.source === revenueFact.source) {
					return acc;
				}
				if (alternative.value && typeof alternative.value === "number") {
					acc = currency(acc).add(alternative.value).value;
					revenueSources++;
				}
				return acc;
			}, revenueValue);
			return currency(totalRevenue).divide(revenueSources).value;
		} else if (revenueFact.alternatives === undefined) {
			return currency(revenueValue).value;
		}
	}
}

// Add a copy of the "revenue" fact as "revenue_all_sources"
simpleFacts.revenue_all_sources = {
	...simpleFacts.revenue
};
export const financialFacts: readonly Fact[] = simpleFactToFacts(simpleFacts, sources);
