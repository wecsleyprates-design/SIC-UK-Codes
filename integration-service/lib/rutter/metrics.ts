/** Define all Metrics we can use */

const rawAccountingMetrics = [
	{ type: "accounting", display_name: "EBITDA", name: "ebitda", formula: "Net Income + D & A + Interest" },
	{ type: "accounting", display_name: "EBITDA Margin", name: "ebitda_margin", formula: "EBITDA / Total Income" },
	{ type: "accounting", display_name: "Net Operating Income", name: "net_operating_income", formula: "Lifted from Income Statement" },
	{ type: "accounting", display_name: "Depreciation Expense", name: "depreciation_expense", formula: "Sum of accounts with “depreciation” in name" },
	{ type: "accounting", display_name: "Amortization Expense", name: "amortization_expense", formula: "Sum of accounts with “Amortization” in name" },
	{ type: "accounting", display_name: "Interest Expense", name: "interest_expense", formula: "Sum of accounts with “interest” in name" },
	{ type: "accounting", display_name: "Gross Profit Margin", name: "gross_profit_margin", formula: "(Total Income - Total Cost of Goods Sold) / (Total Income)" },
	{ type: "accounting", display_name: "Total Income", name: "total_income", formula: "Lifted from income statement" },
	{ type: "accounting", display_name: "Cost of Goods Sold", name: "cost_of_goods_sold", formula: "Lifted from income statement" },
	{ type: "accounting", display_name: "Net Income", name: "net_income", formula: "Lifted from income statement" },
	{ type: "accounting", display_name: "Current Ratio", name: "current_ratio", formula: "Current Assets / Current Liabilities" },
	{ type: "accounting", display_name: "Working Capital", name: "working_capital", formula: "Current Assets - Current Liabilities" },
	{ type: "accounting", display_name: "Current Liabilities", name: "current_liabilities", formula: "Lifted from Balance Sheet" },
	{ type: "accounting", display_name: "Current Assets", name: "current_assets", formula: "Lifted from Balance Sheets" },
	{ type: "accounting", display_name: "Quick Ratio", name: "quick_ratio", formula: "(Current Assets - Total Inventory - Total Prepaid Expenses) / (Current Liabilities - Total Unearned Revenue)" },
	{ type: "accounting", display_name: "Inventory", name: "inventory", formula: "Sum of asset accounts with “Inventory” in name" },
	{ type: "accounting", display_name: "Unearned Revenues", name: "unearned_revenues", formula: "Sum of Liability Accounts with “Unearned Revenue” in name" },
	{ type: "accounting", display_name: "Prepaid Expenses", name: "prepaid_expenses", formula: "Sum of asset accounts with “Prepaid” in name" },
	{
		type: "accounting",
		display_name: "Enterprise Free Cash Flow",
		name: "enterprise_free_cash_flow",
		formula: "Net Income + Change in working Capital + Capex + interest expense * (1 - tax rate) + D&A"
	},
	{ type: "accounting", display_name: "Change in working Capital", name: "change_in_working_capital", formula: "Working capital of current period - working capital of prior period" },
	{ type: "accounting", display_name: "Capex", name: "capital_expenditure", formula: "Total Investing Activity from Cash flow Statement" },
	{ type: "accounting", display_name: "Debt Service Coverage Ratio", name: "debt_service_coverage_ratio", formula: "Enterprise Free Cash Flow / Total Debt Service" },
	{ type: "accounting", display_name: "Debt Service", name: "debt_service", formula: "Interest Paid from income statement + Rental Expense + Principal Paid" }
] as const;

const rawCommerceMetrics = [
	{ type: "commerce", display_name: "Total Revenue", name: "total_orders", formula: "Sum of all order totals in a month" },
	{ type: "commerce", display_name: "Total Orders", name: "total_orders", formula: "Count of all orders in a month" },
	{ type: "commerce", display_name: "Active Customers", name: "active_customers", formula: "Count of all distinct customers who placed an order in a month" },
	{ type: "commerce", display_name: "Refund Rate", name: "refund_rate", formula: "Sum of all refunded orders in a month / Sum of all orders in a month" }
] as const;

interface IMetrics {
	display_name: string;
	name: string;
	formula: string;
	type: "commerce" | "accounting";
}
export type AccountingMetricNames = (typeof rawAccountingMetrics)[number]["name"];
export type CommerceMetricNames = (typeof rawCommerceMetrics)[number]["name"];
export type MetricNames = AccountingMetricNames | CommerceMetricNames;
export const accountingMetrics: IMetrics[] = rawAccountingMetrics as unknown as IMetrics[];
export const commerceMetrics: IMetrics[] = rawCommerceMetrics as unknown as IMetrics[];
export const metrics: IMetrics[] = [...accountingMetrics, ...commerceMetrics];
