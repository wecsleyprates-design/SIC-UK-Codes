import { UUID } from "crypto";

export interface TaskFilings {
    id: string;
    business_integration_task_id: string;
    business_type: string;
    form: string;
    period: string;
    form_type: string;
    interest: string;
    interest_date: string;
    penalty: string;
    penalty_date: string;
    filed_date: string;
    balance: string;
    tax_period_ending_date: string
    amount_filed: string;
    adjusted_gross_income: string;
    total_income: string;
    irs_balance: string;
    lien_balance: string;
    total_sales: string;
    total_compensation: string;
    total_wages: string;
    cost_of_goods_sold: string;
    version: string;
    metadata?: Record<string, any>;
};

export interface TaxFilingDataFetchParams {
    caseID: string;
};

export interface TaxFilingDataFetchQueryParams {
    force?: boolean;
};

export interface GetTaxStatsParams {
    businessID: string;
};

export interface GetTaxStatsQuery {
    period: string;
};

export interface GetTaxFilingsParams {
    businessID: string;
    formType?: string;
};

export interface GetTaxFilingsQuery {
    caseID?: string;
    score_trigger_id?: string;
};

export interface AddTaxFilingBody { 
    case_id: UUID;
    customer_id: UUID | null; 
    manual?: ManualTaxFiling;
    validation_ocr_document_ids?: UUID[];
}

export type ManualTaxFiling = Partial<AnnualTaxFilingFields & QuarterTaxFillingFields> 
    & { 
        form: string;
        period: string;
        filing_status: string;
        adjusted_gross_income: number;
        total_income: number;
        interest: number;
        interest_date: string;
        penalty: number;
        penalty_date: string;
    };

type AnnualTaxFilingFields = {
    tax_filed_date: string;
    total_sales: number;
    total_compensation: number;
    total_wages: number;
    cost_of_goods_sold: number;
    irs_balance: number;
    irs_liens: number;
}

type QuarterTaxFillingFields = {
    tax_filed_date: string;
    tax_period_end: string;
    amount_filed: number;
    account_balance: number;
    accrued_interest: number;
    accrued_penalty: number;
}

export type OcrTaxFiling = {
    ein: number | string;
    taxYear: number;
    formType: string;
    form: string;
    filingFor: string;
	financials: {
        netIncome: number;
        totalWages: number;
        totalAssets: number;
        grossRevenue: number;
        costOfGoodsSold: number;
        totalLiabilities: number;
        operatingExpenses: number;
    };
    income: {
        totalIncome: number;
        wagesFromW2: number;
        adjustedGrossIncome: number;
        socialSecurityBenefits: number;
    };
	businessInfo: {
        businessName: string;
        businessAddress: string;
        incorporationDate: string;
    };
    deductionsAndTax: {
      totalDeductions: number;
      taxableIncome: number;
      totalTax: number;
      totalPayments: number;
    };
    taxPayerInfo: {
        lastName: string;
        firstName: string;
        filingStatus: string;
        middleInitial: string;
        spouseLastName: string;
        spouseFirstName: string;
        spouseMiddleInitial: string;
    };
    businessType: string;
}

export type TransformedOcrTaxFiling = {
    form_type: string;
    form: string;
    filing_for: string;
    tax_filed_date: string;
    tax_period_ending_date: string;
    period: string;
    filing_status: string;
    adjusted_gross_income: number;
    total_income: number;
    total_sales: number;
    total_compensation: number;
    total_wages: number;
    cost_of_goods_sold: number;
    irs_balance: number | null;
    irs_liens: number | null;
    account_balance: number;
    amount_filed: number;
    business_type: string;
    file_name: string;
}