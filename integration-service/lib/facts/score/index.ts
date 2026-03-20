import { sources } from "../sources";
import { simpleFactToFacts, type Fact, type SimpleFact } from "../types";
import { sanitizeNumericString } from "#utils/sanitizeNumericString";
import type { FactEngine } from "..";
import type { EquifaxCombined } from "#lib/equifax/types";
import type { ZoomInfoResponse } from "#lib/zoominfo/types";
import type { ReportResponse } from "#api/v1/modules/accounting/types";
import type { OpenCorporateResponse } from "#lib/opencorporates/types";
import dayjs from "dayjs";
import { GetBusinessEntityReview } from "#api/v1/modules/verification/types";
import { isNumericString } from "#utils";
import currency from "currency.js";


// Helper function to calculate last one year date using 366 days (Python logic)
const getLastOneYearDate = (): Date => {
	const lastOneYearDate = new Date();
	lastOneYearDate.setDate(lastOneYearDate.getDate() - 366);
	return lastOneYearDate;
};

const aggregateAnnualResults = (accounting: any, field: string): number | null => {
    if (!Array.isArray(accounting)) return null;
    
    const lastOneYearDate = getLastOneYearDate();
    const lastOneYearStatements = accounting.filter((statement: any) => {
        const startDate = new Date(statement.start_date);
        return startDate >= lastOneYearDate;
    });
    
    if (lastOneYearStatements.length === 0) return null;
    
    return lastOneYearStatements.reduce((sum: number, statement: any) => {
        return sum + (statement[field] ? parseFloat(statement[field]) : 0);
    }, 0);
};
const getLatestBalanceField = (accounting: any, field: string): number | null => {
    if (!Array.isArray(accounting)) return null;
    
    const mostRecent = accounting.sort((a, b) => 
        new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
    )[0];
    
    return mostRecent?.[field] ? parseFloat(mostRecent[field]) : null;
};

const aggregateFieldSum = (accounting: any, field: string): number | null => {
    if (!Array.isArray(accounting)) return null;
    return accounting.reduce((sum: number, statement: any) => {
        return sum + (statement[field] ? parseFloat(statement[field]) : 0);
    }, 0);
};


const simpleScoringFacts: SimpleFact = {

	primsic: {
		description: "Primary sic code",
		equifax: async (_, efx: EquifaxCombined): Promise<string | null> => {
			return efx?.primsic;
		}
	},
	
	// Business Structure - Use existing facts where possible
	bus_struct: {
		description: "Business entity type/structure",
		middesk: async (_, middesk: GetBusinessEntityReview) => {
			return middesk?.registrations?.[0]?.entity_type?.toLowerCase() || null;
		},
		opencorporates: async (_, oc: OpenCorporateResponse) => {
			const companyType = oc?.firmographic?.company_type?.toLowerCase();
			if (!companyType) return;
			if (["llc", "limited liability company", "limited liability corporation", "l.l.c."].some(type => companyType.includes(type))) return "llc";
			else if (["corporation", "inc", "incorporated"].some(type => companyType.includes(type))) return "corporation";
			else if (["llp", "limited liability partnership"].some(type => companyType.includes(type))) return "llp";
			else if (["lp", "limited partnership"].some(type => companyType.includes(type))) return "lp";
			else if (["partnership"].some(type => companyType.includes(type))) return "partnership";
			else if (["sole proprietorship", "sole proprietor", "entreprise individuelle"].some(type => companyType.includes(type))) return "sole_prop";
			return companyType;
		}
	},

	// Government/Public Indicators
	indicator_government: {
		description: "Government entity indicator",
		equifax: async (_, efx: EquifaxCombined): Promise<number | null> => {
			const govCount = Number(efx.location_gov_cnt);
			return !isNaN(govCount) ? (govCount > 0 ? 1 : 0) : null;
		}
	},
	indicator_federal_government: {
		description: "Federal government entity indicator",
		equifax: async (_, efx: EquifaxCombined): Promise<number | null> => {
			const fedGovCount = Number(efx.location_fedgov_cnt);
			return !isNaN(fedGovCount) ? (fedGovCount > 0 ? 1 : 0) : null;
		}
	},
	indicator_education: {
		description: "Education entity indicator",
		equifax: async (_, efx: EquifaxCombined): Promise<number | null> => {
			const eduCount = Number(efx.location_edu_cnt);
			return !isNaN(eduCount) ? (eduCount > 0 ? 1 : 0) : null;
		}
	},

	// Income Statement Data - These don't exist in other facts
	// Revenue Is already available in the financial fact But we have partial data of accounting in DB thats why we get from S3 here
	is_total_revenue: {
		description: "Total revenue",
		accountingIncomeStatementsS3: async (_, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			const sum = aggregateAnnualResults(accounting, "total_income");
			// For scoring, treat $0 revenue from accounting as invalid or null (likely missing or incomplete data)
			// Returning null allows the fact engine to fall back to alternative sources (ZoomInfo, Equifax)
			// with higher-quality estimated revenue data rather than using misleading zero values
			return sum !== 0 ? sum : null;
		},
		equifax: async (_, equifax: any): Promise<number | null> => {
			const corpAmount = equifax?.scoring_model?.corpamount;
			return typeof corpAmount === "number" ? corpAmount : null;
		},
		manual: "is_revenue",
		zoominfo: async (_, zoominfo: ZoomInfoResponse): Promise<number | undefined> => {
			const revenue = zoominfo?.firmographic?.zi_c_company_revenue;

			if (typeof revenue === "number" || isNumericString(revenue)) {
				return currency(revenue).multiply(1000).value;
			}

			return undefined;
		}
	},
	is_operating_expense: {
		description: "Operating expenses",
		accountingIncomeStatementsS3: async (_, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter
			return aggregateAnnualResults(accounting, "total_expenses");
		}
	},
	is_gross_profit: {
		description: "Gross profit",
		accountingIncomeStatementsS3: async (_, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return aggregateAnnualResults(accounting, "gross_profit");
		}
	},
	is_cost_of_goods_sold: {
		description: "Cost of goods sold",
		accountingIncomeStatementsS3: async (_, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return aggregateAnnualResults(accounting, "total_cost_of_goods_sold");
		}
	},
	is_net_income: {
		description: "Net income",
		accountingIncomeStatementsS3: async (_, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return aggregateAnnualResults(accounting, "net_income");
		}
	},

	// Balance Sheet Data - These don't exist in other facts
	bs_accounts_receivable: {
		description: "Accounts receivable",
		accountingAccountReceivableS3: async (business_id: any, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return aggregateFieldSum(accounting, "balance");
		},
		manual: "bs_accounts_receivable"
	},
	bs_accounts_payable: {
		description: "Accounts payable",
		accountingAccountPayableS3: async (business_id: any, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return aggregateFieldSum(accounting, "balance");
		},
		manual: "bs_accounts_payable"
	},
	bs_total_assets: {
		description: "Total assets",
		accountingBalanceSheetsS3: async (_, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return getLatestBalanceField(accounting, "total_assets");
		},
		manual: "bs_total_assets"
	},
	bs_total_debt: {
		description: "Total debt",
		accountingBalanceSheetsS3: async (_, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return getLatestBalanceField(accounting, "total_liabilities");
		},
		manual: "bs_total_debt"
	},
	bs_total_equity: {
		description: "Total equity",
		accountingBalanceSheetsS3: async (_, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return getLatestBalanceField(accounting, "total_equity");
		},
		manual: "bs_total_equity"
	},	
	bs_total_liabilities: {
		description: "Total liabilities",
		accountingBalanceSheetsS3: async (_, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return getLatestBalanceField(accounting, "total_liabilities");
		},
		manual: "bs_total_liabilities"
	},

	// Cash Flow Data - These don't exist in other facts
	cf_capex: {
		description: "Capital expenditures",
		accountingCashFlowsS3: async (business_id: any, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return aggregateAnnualResults(accounting, "total_investing");
		},
		manual: "cf_capex"
	},
	cf_cash_at_end_of_period: {
		description: "Cash at end of period",
		accountingCashFlowsS3: async (business_id: any, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return getLatestBalanceField(accounting, "ending_balance");
		},
		manual: "cf_cash_at_end_of_period"
	},
	cf_operating_cash_flow: {
		description: "Operating cash flow",
		accountingCashFlowsS3: async (business_id: any, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return aggregateAnnualResults(accounting, "total_operating");
		},
		manual: "cf_operating_cash_flow"
	},
	cf_financing_cash_flow: {
		description: "Financing cash flow",
		accountingCashFlowsS3: async (business_id: any, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return aggregateAnnualResults(accounting, "total_financing");
		},
		manual: "cf_financing_cash_flow"
	},
	cf_net_cash_flow: {
		description: "Net cash flow",
		accountingCashFlowsS3: async (business_id: any, accounting: any): Promise<number | null> => {
			// Handle S3 data format from Rutter/Plaid
			return aggregateAnnualResults(accounting, "net_flow");
		},
		manual: "cf_net_cash_flow"
	},

	// Financial Flags
	flag_equity_negative: {
		description: "Flag for negative equity",
		calculated: {
			dependencies: ["bs_total_equity"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const equity = engine.getResolvedFact("bs_total_equity")?.value;
				return equity != null ? (equity < 0 ? 1 : 0) : null;
			}
		}
	},
	flag_total_liabilities_over_assets: {
		description: "Flag for liabilities over assets",
		calculated: {
			dependencies: ["bs_total_liabilities", "bs_total_assets"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const liabilities = engine.getResolvedFact("bs_total_liabilities")?.value;
				const assets = engine.getResolvedFact("bs_total_assets")?.value;
				if (liabilities != null && assets != null && assets !== 0) {
					return liabilities > assets ? 1 : 0;
				}
				return null;
			}
		}
	},
	flag_net_income_negative: {
		description: "Flag for negative net income",
		calculated: {
			dependencies: ["is_net_income"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const netIncome = engine.getResolvedFact("is_net_income")?.value;
				return netIncome != null ? (netIncome < 0 ? 1 : 0) : null;
			}
		}
	},

	// Financial Ratios
	ratio_accounts_payable_cash: {
		description: "Accounts payable to cash ratio",
		calculated: {
			dependencies: ["bs_accounts_payable", "cf_cash_at_end_of_period"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const accountsPayable = engine.getResolvedFact("bs_accounts_payable")?.value;
				const cash = engine.getResolvedFact("cf_cash_at_end_of_period")?.value;
				if (accountsPayable != null && cash != null && cash !== 0) {
					return accountsPayable / cash;
				}
				return null;
			}
		}
	},
	ratio_current_assets_liabilities: {
		description: "Current ratio (current assets / current liabilities)",
		calculated: {
			dependencies: ["bs_total_assets", "bs_total_liabilities"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const assets = engine.getResolvedFact("bs_total_assets")?.value;
				const liabilities = engine.getResolvedFact("bs_total_liabilities")?.value;
				if (assets != null && liabilities != null && liabilities !== 0) {
					return assets / liabilities;
				}
				return null;
			}
		}
	},
	ratio_debt_to_equity: {
		description: "Debt to equity ratio",
		calculated: {
			dependencies: ["bs_total_liabilities", "bs_total_equity"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const liabilities = engine.getResolvedFact("bs_total_liabilities")?.value;
				const equity = engine.getResolvedFact("bs_total_equity")?.value;
				if (liabilities != null && equity != null && equity !== 0) {
					return liabilities / equity;
				}
				return null;
			}
		}
	},
	ratio_gross_margin: {
		description: "Gross margin (gross profit / revenue)",
		calculated: {
			dependencies: ["is_gross_profit", "is_total_revenue"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const grossProfit = engine.getResolvedFact("is_gross_profit")?.value;
				const revenue = engine.getResolvedFact("is_total_revenue")?.value;
				if (grossProfit != null && revenue != null && revenue !== 0) {
					return grossProfit / revenue;
				}
				return null;
			}
		}
	},
	ratio_net_margin: {
		description: "Net margin (net income / revenue)",
		calculated: {
			dependencies: ["is_net_income", "is_total_revenue"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const netIncome = engine.getResolvedFact("is_net_income")?.value;
				const revenue = engine.getResolvedFact("is_total_revenue")?.value;
				if (netIncome != null && revenue != null && revenue !== 0) {
					return netIncome / revenue;
				}
				return null;
			}
		}
	},
	ratio_return_on_equity: {
		description: "Return on equity ratio",
		calculated: {
			dependencies: ["is_net_income", "bs_total_equity"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const netIncome = engine.getResolvedFact("is_net_income")?.value;
				const equity = engine.getResolvedFact("bs_total_equity")?.value;
				if (netIncome != null && equity != null && equity !== 0) {
					return netIncome / equity;
				}
				return null;
			}
		}
	},
	ratio_return_on_assets: {
		description: "Return on assets ratio",
		calculated: {
			dependencies: ["is_net_income", "bs_total_assets"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const netIncome = engine.getResolvedFact("is_net_income")?.value;
				const assets = engine.getResolvedFact("bs_total_assets")?.value;
				if (netIncome != null && assets !== null && assets !== 0) {
					return netIncome / assets;
				}
				return null;
			}
		}
	},
	ratio_net_income_ratio: {
		description: "Net income to revenue ratio",
		calculated: {
			dependencies: ["is_net_income", "is_total_revenue"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const netIncome = engine.getResolvedFact("is_net_income")?.value;
				const revenue = engine.getResolvedFact("is_total_revenue")?.value;
				if (netIncome != null && revenue != null && revenue !== 0) {
					return netIncome / revenue;
				}
				return null;
			}
		}
	},
	ratio_income_quality_ratio: {
		description: "Income quality ratio (operating cash flow to net income)",
		calculated: {
			dependencies: ["cf_operating_cash_flow", "is_net_income"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const operatingCashFlow = engine.getResolvedFact("cf_operating_cash_flow")?.value;
				const netIncome = engine.getResolvedFact("is_net_income")?.value;
				if (operatingCashFlow != null && netIncome != null && netIncome !== 0) {
					return operatingCashFlow / netIncome;
				}
				return null;
			}
		}
	},
	ratio_equity_multiplier: {
		description: "Equity multiplier ratio",
		calculated: {
			dependencies: ["bs_total_assets", "bs_total_equity"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const assets = engine.getResolvedFact("bs_total_assets")?.value;
				const equity = engine.getResolvedFact("bs_total_equity")?.value;
				if (assets != null && equity != null && equity !== 0) {
					return assets / equity;
				}
				return null;
			}
		}
	},

	// Required calculated field for scoring
	bs_total_liabilities_and_equity: {
		description: "Total liabilities and equity",
		calculated: {
			dependencies: ["bs_total_liabilities", "bs_total_equity"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const liabilities = engine.getResolvedFact("bs_total_liabilities")?.value;
				const equity = engine.getResolvedFact("bs_total_equity")?.value;
				if (liabilities != null && equity != null) {
					return liabilities + equity;
				}
				return null;
			}
		}
	},

	// Additional required ratio facts for scoring
	ratio_operating_margin: {
		description: "Operating margin ratio",
		calculated: {
			dependencies: ["is_operating_expense", "is_total_revenue"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const operatingExpense = engine.getResolvedFact("is_operating_expense")?.value;
				const revenue = engine.getResolvedFact("is_total_revenue")?.value;
				if (operatingExpense != null && revenue != null && revenue !== 0) {
					return (revenue - operatingExpense) / revenue;
				}
				return null;
			}
		}
	},
	ratio_cash_ratio: {
		description: "Cash ratio",
		calculated: {
			dependencies: ["cf_cash_at_end_of_period", "bs_total_liabilities"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const cash = engine.getResolvedFact("cf_cash_at_end_of_period")?.value;
				const liabilities = engine.getResolvedFact("bs_total_liabilities")?.value;
				if (cash != null && liabilities != null && liabilities !== 0) {
					return cash / liabilities;
				}
				return null;
			}
		}
	},
	ratio_accounts_receivable_cash: {
		description: "Accounts receivable to cash ratio",
		calculated: {
			dependencies: ["bs_accounts_receivable", "cf_cash_at_end_of_period"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const accountsReceivable = engine.getResolvedFact("bs_accounts_receivable")?.value;
				const cash = engine.getResolvedFact("cf_cash_at_end_of_period")?.value;
				if (accountsReceivable != null && cash != null && cash !== 0) {
					return accountsReceivable / cash;
				}
				return null;
			}
		}
	},
	ratio_total_liabilities_cash: {
		description: "Total liabilities to cash ratio",
		calculated: {
			dependencies: ["bs_total_liabilities", "cf_cash_at_end_of_period"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const liabilities = engine.getResolvedFact("bs_total_liabilities")?.value;
				const cash = engine.getResolvedFact("cf_cash_at_end_of_period")?.value;
				if (liabilities != null && cash != null && cash !== 0) {
					return liabilities / cash;
				}
				return null;
			}
		}
	},
	ratio_total_liabilities_assets: {
		description: "Total liabilities to assets ratio",
		calculated: {
			dependencies: ["bs_total_liabilities", "bs_total_assets"],
			fn: async (engine: FactEngine): Promise<number | null> => {
				const liabilities = engine.getResolvedFact("bs_total_liabilities")?.value;
				const assets = engine.getResolvedFact("bs_total_assets")?.value;
				if (liabilities != null && assets != null && assets !== 0) {
					return liabilities / assets;
				}
				return null;
			}
		}
	}
};

export const scoringFacts: Fact[] = simpleFactToFacts(simpleScoringFacts, sources);
