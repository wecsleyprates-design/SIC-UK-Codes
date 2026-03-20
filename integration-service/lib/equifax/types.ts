import type { EntityMatchTask } from "#lib/entityMatching/types";
import { IBureauCreditScore, IBusinessIntegrationTaskEnriched } from "#types/db";
import { Owner } from "#types/worthApi";
import type { EquifaxBMARaw, EquifaxUSRaw } from "./redshiftTypes";

export interface ErrorCodeMapping {
	title: string;
	description: string;
}

export interface HitCodeData {
	code: string;
	description: string;
}

export interface FraudAlertData {
	code: string;
	description: string;
}

export interface EquifaxErrorData {
	hitCode?: HitCodeData;
	fraudAlerts?: FraudAlertData[];
}

export interface TransformedEquifaxError {
	title: string;
	description: string;
}

export interface IOAuthResponse {
	access_token: string;
	token_type: "Bearer";
	expires_in: number;
	issued_at: number;
	scope: "https://api.equifax.com/business/oneview/consumer-credit/v1";
}

export interface IEquifaxJudgementsLiens {
	business_id: string;
	report_date: Date;
	task_id?: string;
	report?: IEquifaxJudgementsLiensReport;
	scoring_model?: IEquifaxAIScoreModel;
	matches?: {
		score: number;
		data: any;
	};
	stats?: {
		aggregateCost: number;
		aggregateQueryTime: number;
	};
}

export type EquifaxCombined = IEquifaxAIScoreModel & EquifaxUSRaw & EquifaxBMARaw;

export interface IEquifaxAIScoreModel {
	legultnameall: string;
	legultnumall: string;
	legultstateall: string;
	legultcityall: string;
	efx_legultzipcodeall: string;
	address_string: string;
	extract_month: string;
	location_cnt: bigint;
	location_ids: number[];
	location_active_cnt: bigint;
	location_inactive_cnt: bigint;
	location_inactiveold_cnt: bigint;
	location_inactivedt_cnt: bigint;
	deadmon_array: string;
	lat_array: string;
	lon_array: string;
	location_latitude_avg: number;
	location_longitude_avg: number;
	location_soho_cnt: bigint;
	location_biz_cnt: bigint;
	location_res_cnt: bigint;
	location_small_cnt: bigint;
	location_large_cnt: bigint;
	location_unknown_size_cnt: bigint;
	location_gov_cnt: bigint;
	location_fedgov_cnt: bigint;
	location_nonprofitind_cnt: bigint;
	location_edu_cnt: bigint;
	min_year_est: string;
	max_year_est: string;
	year_est_array: string;
	location_indsole_cnt: bigint;
	location_partner_cnt: bigint;
	location_limpartner_cnt: bigint;
	location_corp_cnt: bigint;
	location_scorp_cnt: bigint;
	location_llc_cnt: bigint;
	location_llp_cnt: bigint;
	location_other_cnt: bigint;
	location_ccorp_cnt: bigint;
	location_nonprofitstat_cnt: bigint;
	location_mutual_cnt: bigint;
	location_trust_cnt: bigint;
	location_lllp_cnt: bigint;
	bankrupt_cnt_failrt: bigint;
	bankrupt_cnt_credcls: bigint;
	bankrupt_cnt_field: bigint;
	failrate_avg: number;
	failrate_array: string;
	corpemployees: number;
	corpamount: number;
	corpamount_type: string;
	corpamount_prec: string;
	creditscore_avg: number;
	creditscore_max: number;
	creditscore_min: number;
	creditscore_array: string;
	creditperc_avg: number;
	creditperc_max: number;
	creditperc_min: number;
	creditperc_array: string;
	mkt_telscore_avg: number;
	mkt_telscore_max: number;
	mkt_telscore_min: number;
	mkt_telscore_array: string;
	mkt_totalscore_avg: number;
	mkt_totalscore_max: number;
	mkt_totalscore_min: number;
	mkt_totalscore_array: string;
	primsic: string;
	secsic1: string;
	secsic2: string | null;
	secsic3: string | null;
	secsic4: string | null;
	primnaicscode: string;
	secnaics1: string;
	secnaics2: string;
	secnaics3: string | null;
	secnaics4: string | null;
	months_since_update: bigint;
}

export interface IEquifaxJudgementsLiensReport {
	efx_id: number;
	efxbma_pubrec_age_bkp: number;
	efxbma_pubrec_age_judg: number;
	efxbma_pubrec_age_lien: number;
	efxbma_pubrec_age_pr: number;
	efxbma_pubrec_bkp_ind: number;
	efxbma_pubrec_judg_ind: number;
	efxbma_pubrec_lien_ind: number;
	efxbma_pubrec_lien_judg_ind: number;
	efxbma_pubrec_max_liab_rep_judg: number;
	efxbma_pubrec_max_liab_rep_lien: number;
	efxbma_pubrec_status_fi: number;
	efxbma_pubrec_status_fi_ju: number;
	efxbma_pubrec_status_ju: number;
	efxbma_pubrec_sum_lien_all_judg: number;
	efxbma_pubrec_total_cur_liab_judg: number;
	efxbma_pubrec_total_cur_liab_judg_all: number;
	efxbma_pubrec_total_cur_liab_lien: number;
	efxbma_pubrec_total_cur_liab_lien_all: number;
	efxbma_pubrec_total_cur_liab_lien_judg: number;
	efxbma_pubrec_total_judg: number;
	efxbma_pubrec_total_lien: number;
	efxbma_pubrec_total_lien_judg: number;
	efxbma_1m_ind_1c_past_due_count: null | any;
	efxbma_1m_ind_1pc_past_due_count: null | any;
	efxbma_1m_ind_2c_past_due_count: number;
	efxbma_1m_ind_2pc_past_due_count: number;
	efxbma_1m_ind_3c_past_due_count: number;
	efxbma_1m_ind_3pc_past_due_count: number;
	efxbma_1m_ind_4pc_past_due_count: number;
	efxbma_1m_ind_tr_count: number;
	efxbma_1m_ind_tr_total_bal: number;
	efxbma_1m_ind_worst_payment_status: number;
	efxbma_1m_nfin_1c_past_due_count: number;
	efxbma_1m_nfin_1pc_past_due_count: number;
	efxbma_1m_nfin_2c_past_due_count: number;
	efxbma_1m_nfin_2pc_past_due_count: number;
	efxbma_1m_nfin_3c_past_due_count: number;
	efxbma_1m_nfin_3pc_past_due_count: number;
	efxbma_1m_nfin_4pc_past_due_count: number;
	efxbma_1m_nfin_chargeoff_tr_count: number;
	efxbma_1m_nfin_closed_acc_count: number;
	efxbma_1m_nfin_curr_credit_lim: number;
	efxbma_1m_nfin_open_acc_count: number;
	efxbma_1m_nfin_orig_credit_lim: number;
	efxbma_1m_nfin_past_due_amount: number;
	efxbma_1m_nfin_payment_index: number;
	efxbma_1m_nfin_per_satisfactory_acc: null | any;
	efxbma_1m_nfin_satisfactory_tr_count: number;
	efxbma_1m_nfin_total_chargeoff_amt: number;
	efxbma_1m_nfin_total_util: null | any;
	efxbma_1m_nfin_tr_count: number;
	efxbma_1m_nfin_tr_total_bal: number;
	efxbma_1m_nfin_worst_payment_status: number;
	efxbma_1m_serv_tr_count: number;
	efxbma_1m_serv_tr_total_bal: number;
	efxbma_1m_tel_1c_past_due_count: number;
	efxbma_1m_tel_1pc_past_due_count: number;
	efxbma_1m_tel_2c_past_due_count: number;
	efxbma_1m_tel_2pc_past_due_count: number;
	efxbma_1m_tel_3c_past_due_count: number;
	efxbma_1m_tel_3pc_past_due_count: number;
	efxbma_1m_tel_4pc_past_due_count: number;
	efxbma_1m_tel_tr_count: number;
	efxbma_1m_tel_tr_total_bal: number;
	efxbma_1m_tel_worst_payment_status: number;
	efxbma_1m_util_1c_past_due_count: number;
	efxbma_1m_util_1pc_past_due_count: number;
	efxbma_1m_util_2c_past_due_count: number;
	efxbma_1m_util_2pc_past_due_count: number;
	efxbma_1m_util_3c_past_due_count: number;
	efxbma_1m_util_3pc_past_due_count: number;
	efxbma_1m_util_4pc_past_due_count: number;
	efxbma_1m_util_tr_count: number;
	efxbma_1m_util_tr_total_bal: number;
	efxbma_1m_util_worst_payment_status: number;
	efxbma_3m_ind_1c_past_due_count: number;
	efxbma_3m_ind_1pc_past_due_count: number;
	efxbma_3m_ind_2c_past_due_count: number;
	efxbma_3m_ind_2pc_past_due_count: number;
	efxbma_3m_ind_3c_past_due_count: number;
	efxbma_3m_ind_3pc_past_due_count: number;
	efxbma_3m_ind_4pc_past_due_count: number;
	efxbma_3m_ind_tr_count: number;
	efxbma_3m_ind_tr_high_bal: number;
	efxbma_3m_ind_tr_wb_count: number;
	efxbma_3m_ind_worst_payment_status: number;
	efxbma_3m_nfin_1c_past_due_amount: number;
	efxbma_3m_nfin_1c_past_due_count: number;
	efxbma_3m_nfin_1pc_past_due_count: number;
	efxbma_3m_nfin_2c_past_due_amount: number;
	efxbma_3m_nfin_2c_past_due_count: number;
	efxbma_3m_nfin_2pc_past_due_count: number;
	efxbma_3m_nfin_3c_past_due_amount: number;
	efxbma_3m_nfin_3c_past_due_count: number;
	efxbma_3m_nfin_3pc_past_due_count: number;
	efxbma_3m_nfin_4pc_past_due_amount: number;
	efxbma_3m_nfin_4pc_past_due_count: number;
	efxbma_3m_nfin_chargeoff_tr_count: number;
	efxbma_3m_nfin_high_credit_lim: number;
	efxbma_3m_nfin_new_acc_count: number;
	efxbma_3m_nfin_orig_credit_lim: number;
	efxbma_3m_nfin_past_due_amount: number;
	efxbma_3m_nfin_per_4pc_pd_to_totbal: null | any;
	efxbma_3m_nfin_per_coff_to_tot_acc: null | any;
	efxbma_3m_nfin_per_pd_to_totbal: null | any;
	efxbma_3m_nfin_per_satisfactory_acc: null | any;
	efxbma_3m_nfin_ratio_num_nondel_to_acc: null | any;
	efxbma_3m_nfin_satisfactory_tr_count: number;
	efxbma_3m_nfin_total_chargeoff_amt: number;
	efxbma_3m_nfin_total_util: null | any;
	efxbma_3m_nfin_tr_count: number;
	efxbma_3m_nfin_tr_high_bal: number;
	efxbma_3m_nfin_tr_wb_count: number;
	efxbma_3m_nfin_worst_payment_status: number;
	efxbma_3m_serv_past_due_amount: number;
	efxbma_3m_serv_tr_count: number;
	efxbma_3m_serv_tr_high_bal: number;
	efxbma_3m_serv_tr_wb_count: number;
	efxbma_3m_tel_1c_past_due_count: number;
	efxbma_3m_tel_1pc_past_due_count: number;
	efxbma_3m_tel_2c_past_due_count: number;
	efxbma_3m_tel_2pc_past_due_count: number;
	efxbma_3m_tel_3c_past_due_count: number;
	efxbma_3m_tel_3pc_past_due_count: number;
	efxbma_3m_tel_4pc_past_due_count: number;
	efxbma_3m_tel_tr_count: number;
	efxbma_3m_tel_tr_high_bal: number;
	efxbma_3m_tel_tr_wb_count: number;
	efxbma_3m_tel_worst_payment_status: number;
	efxbma_3m_util_1c_past_due_count: number;
	efxbma_3m_util_1pc_past_due_count: number;
	efxbma_3m_util_2c_past_due_count: number;
	efxbma_3m_util_2pc_past_due_count: number;
	efxbma_3m_util_3c_past_due_count: number;
	efxbma_3m_util_3pc_past_due_count: number;
	efxbma_3m_util_4pc_past_due_count: number;
	efxbma_3m_util_tr_count: number;
	efxbma_3m_util_tr_high_bal: number;
	efxbma_3m_util_tr_wb_count: number;
	efxbma_3m_util_worst_payment_status: number;
	partition_0?: string;
	partition_1?: string;
	yr: string;
	mon: string;
}

export interface IEquifaxCreditSummary {
	efx_id: number;
	efxbma_pubrec_age_bkp: number;
	efxbma_pubrec_age_judg: number;
	efxbma_pubrec_age_lien: number;
	efxbma_pubrec_age_pr: number;
	efxbma_pubrec_bkp_ind: number;
	efxbma_pubrec_judg_ind: number;
	efxbma_pubrec_lien_ind: number;
	efxbma_pubrec_lien_judg_ind: number;
	efxbma_pubrec_max_liab_rep_judg: number;
	efxbma_pubrec_max_liab_rep_lien: number;
	efxbma_pubrec_status_fi: number;
	efxbma_pubrec_status_fi_ju: number;
	efxbma_pubrec_status_ju: number;
	efxbma_pubrec_sum_lien_all_judg: number;
	efxbma_pubrec_total_cur_liab_judg: number;
	efxbma_pubrec_total_cur_liab_judg_all: number;
	efxbma_pubrec_total_cur_liab_lien: number;
	efxbma_pubrec_total_cur_liab_lien_all: number;
	efxbma_pubrec_total_cur_liab_lien_judg: number;
	efxbma_pubrec_total_judg: number;
	efxbma_pubrec_total_lien: number;
	efxbma_pubrec_total_lien_judg: number;
	efxbma_1m_ind_1c_past_due_count: number;
	efxbma_1m_ind_1pc_past_due_count: number;
	efxbma_1m_ind_2c_past_due_count: number;
	efxbma_1m_ind_2pc_past_due_count: number;
	efxbma_1m_ind_3c_past_due_count: number;
	efxbma_1m_ind_3pc_past_due_count: number;
	efxbma_1m_ind_4pc_past_due_count: number;
	efxbma_1m_ind_tr_count: number;
	efxbma_1m_ind_tr_total_bal: number;
	efxbma_1m_ind_worst_payment_status: number;
	efxbma_1m_nfin_1c_past_due_count: number;
	efxbma_1m_nfin_1pc_past_due_count: number;
	efxbma_1m_nfin_2c_past_due_count: number;
	efxbma_1m_nfin_2pc_past_due_count: number;
	efxbma_1m_nfin_3c_past_due_count: number;
	efxbma_1m_nfin_3pc_past_due_count: number;
	efxbma_1m_nfin_4pc_past_due_count: number;
	efxbma_1m_nfin_chargeoff_tr_count: number;
	efxbma_1m_nfin_closed_acc_count: number;
	efxbma_1m_nfin_curr_credit_lim: number;
	efxbma_1m_nfin_open_acc_count: number;
	efxbma_1m_nfin_orig_credit_lim: number;
	efxbma_1m_nfin_past_due_amount: number;
	efxbma_1m_nfin_payment_index: number;
	efxbma_1m_nfin_per_satisfactory_acc: number;
	efxbma_1m_nfin_satisfactory_tr_count: number;
	efxbma_1m_nfin_total_chargeoff_amt: number;
	efxbma_1m_nfin_total_util: number;
	efxbma_1m_nfin_tr_count: number;
	efxbma_1m_nfin_tr_total_bal: number;
	efxbma_1m_nfin_worst_payment_status: number;
	efxbma_1m_serv_tr_count: number;
	efxbma_1m_serv_tr_total_bal: number;
	efxbma_1m_tel_1c_past_due_count: number;
	efxbma_1m_tel_1pc_past_due_count: number;
	efxbma_1m_tel_2c_past_due_count: number;
	efxbma_1m_tel_2pc_past_due_count: number;
	efxbma_1m_tel_3c_past_due_count: number;
	efxbma_1m_tel_3pc_past_due_count: number;
	efxbma_1m_tel_4pc_past_due_count: number;
	efxbma_1m_tel_tr_count: number;
	efxbma_1m_tel_tr_total_bal: number;
	efxbma_1m_tel_worst_payment_status: number;
	efxbma_1m_util_1c_past_due_count: number;
	efxbma_1m_util_1pc_past_due_count: number;
	efxbma_1m_util_2c_past_due_count: number;
	efxbma_1m_util_2pc_past_due_count: number;
	efxbma_1m_util_3c_past_due_count: number;
	efxbma_1m_util_3pc_past_due_count: number;
	efxbma_1m_util_4pc_past_due_count: number;
	efxbma_1m_util_tr_count: number;
	efxbma_1m_util_tr_total_bal: number;
	efxbma_1m_util_worst_payment_status: number;
	efxbma_3m_ind_1c_past_due_count: number;
	efxbma_3m_ind_1pc_past_due_count: number;
	efxbma_3m_ind_2c_past_due_count: number;
	efxbma_3m_ind_2pc_past_due_count: number;
	efxbma_3m_ind_3c_past_due_count: number;
	efxbma_3m_ind_3pc_past_due_count: number;
	efxbma_3m_ind_4pc_past_due_count: number;
	efxbma_3m_ind_tr_count: number;
	efxbma_3m_ind_tr_high_bal: number;
	efxbma_3m_ind_tr_wb_count: number;
	efxbma_3m_ind_worst_payment_status: number;
	efxbma_3m_nfin_1c_past_due_amount: number;
	efxbma_3m_nfin_1c_past_due_count: number;
	efxbma_3m_nfin_1pc_past_due_count: number;
	efxbma_3m_nfin_2c_past_due_amount: number;
	efxbma_3m_nfin_2c_past_due_count: number;
	efxbma_3m_nfin_2pc_past_due_count: number;
	efxbma_3m_nfin_3c_past_due_amount: number;
	efxbma_3m_nfin_3c_past_due_count: number;
	efxbma_3m_nfin_3pc_past_due_count: number;
	efxbma_3m_nfin_4pc_past_due_amount: number;
	efxbma_3m_nfin_4pc_past_due_count: number;
	efxbma_3m_nfin_chargeoff_tr_count: number;
	efxbma_3m_nfin_high_credit_lim: number;
	efxbma_3m_nfin_new_acc_count: number;
	efxbma_3m_nfin_orig_credit_lim: number;
	efxbma_3m_nfin_past_due_amount: number;
	efxbma_3m_nfin_per_4pc_pd_to_totbal: number;
	efxbma_3m_nfin_per_coff_to_tot_acc: number;
	efxbma_3m_nfin_per_pd_to_totbal: number;
	efxbma_3m_nfin_per_satisfactory_acc: number;
	efxbma_3m_nfin_ratio_num_nondel_to_acc: number;
	efxbma_3m_nfin_satisfactory_tr_count: number;
	efxbma_3m_nfin_total_chargeoff_amt: number;
	efxbma_3m_nfin_total_util: number;
	efxbma_3m_nfin_tr_count: number;
	efxbma_3m_nfin_tr_high_bal: number;
	efxbma_3m_nfin_tr_wb_count: number;
	efxbma_3m_nfin_worst_payment_status: number;
	efxbma_3m_serv_past_due_amount: number;
	efxbma_3m_serv_tr_count: number;
	efxbma_3m_serv_tr_high_bal: number;
	efxbma_3m_serv_tr_wb_count: number;
	efxbma_3m_tel_1c_past_due_count: number;
	efxbma_3m_tel_1pc_past_due_count: number;
	efxbma_3m_tel_2c_past_due_count: number;
	efxbma_3m_tel_2pc_past_due_count: number;
	efxbma_3m_tel_3c_past_due_count: number;
	efxbma_3m_tel_3pc_past_due_count: number;
	efxbma_3m_tel_4pc_past_due_count: number;
	efxbma_3m_tel_tr_count: number;
	efxbma_3m_tel_tr_high_bal: number;
	efxbma_3m_tel_tr_wb_count: number;
	efxbma_3m_tel_worst_payment_status: number;
	efxbma_3m_util_1c_past_due_count: number;
	efxbma_3m_util_1pc_past_due_count: number;
	efxbma_3m_util_2c_past_due_count: number;
	efxbma_3m_util_2pc_past_due_count: number;
	efxbma_3m_util_3c_past_due_count: number;
	efxbma_3m_util_3pc_past_due_count: number;
	efxbma_3m_util_4pc_past_due_count: number;
	efxbma_3m_util_tr_count: number;
	efxbma_3m_util_tr_high_bal: number;
	efxbma_3m_util_tr_wb_count: number;
	efxbma_3m_util_worst_payment_status: number;
	efxbma_24m_nfin_tr_count: number;
	efxbma_24m_nfin_tr_high_bal: number;
	efxbma_24m_nfin_orig_credit_lim: number;
	efxbma_24m_nfin_high_credit_lim: number;
	efxbma_24m_nfin_4pc_past_due_count: number;
	efxbma_24m_nfin_total_chargeoff_amt: number;
	efxbma_24m_nfin_per_satisfactory_acc: number;
	efxbma_24m_nfin_worst_payment_status: number;
	yr: string;
	mon: string;
}

export type EquifaxEntityMatchTask = EntityMatchTask<IEquifaxJudgementsLiens>;

export type EquifaxFetchOwnerScoreTask = IBusinessIntegrationTaskEnriched & {
	meta: {
		owner: Owner;
		[key: string]: any;
	};
};

export type EquifaxBureauCreditScore = IBureauCreditScore & {
	meta: {
		pdfLink: string;
		chosenModel: Model;
		owner: Owner;
		rawResponse: ICreditReportResponse;
		[key: string]: any;
	};
};

interface CreditReportRequestModel {
	identifier: string | number;
	modelField?: string[];
}
type CreditReportRequestAddress = {
	identifier: "current" | "previous";
	houseNumber?: string | number;
	streetName?: string;
	streetType?: string;
	city?: string;
	state?: string;
	zip?: string;
};
type CreditReportRequestName = {
	identifier: "current" | "previous";
	firstName: string;
	lastName: string;
};
type CreditReportRequestSocial = {
	identifier: "current" | "previous";
	number: number | string;
};

export interface ICreditReportRequest {
	consumers: {
		name?: CreditReportRequestName[];
		socialNum?: CreditReportRequestSocial[];
		addresses?: CreditReportRequestAddress[];
	};
	customerReferenceidentifier: string;
	customerConfiguration: {
		equifaxUSConsumerCreditReport: {
			pdfComboIndicator: "Y" | "N";
			memberNumber: string;
			securityCode: string;
			customerCode: string;
			multipleReportIndicator: string | number;
			models?: CreditReportRequestModel[];
			ECOAInquiryType: "Individual";
			productCodes: string[];
			optionalFeatureCode: string[];
			fileSelectionLevel: string;
			rawReportRequired: boolean;
			codeDescriptionRequired: boolean;
			endUserInformation: {
				endUsersName: string;
				permissiblePurposeCode: string; //numeric string 01, 02, 03, etc
			};
		};
		equifaxUSConsumerTwnRequest?: any;
		equifaxUSConsumerDataxInquiryRequest?: any;
	};
}

export interface ICreditReportResponse {
	status: string;
	consumers: Consumers;
	links: Link[];
}

export interface Consumers {
	equifaxUSConsumerCreditReport: EquifaxUSConsumerCreditReport[];
	twnSelectReport: TwnSelectReport[];
	dataxReport: DataxReport[];
}

export interface DataxReport {
	identifier: string;
	dataxCreditReportResponse: DataxCreditReportResponse;
}

export interface DataxCreditReportResponse {
	transaction: Transaction;
	craInquirySegment: CraInquirySegment;
	globalDecision: GlobalDecision;
}

export interface CraInquirySegment {
	craResponse: CraResponse;
	customDecision: CustomDecision;
}

export interface CraResponse {
	version: number;
	transactionID: number;
	inquiryID: number;
	inquiryDateTime: Date;
	consumer: Consumer;
	report: Report;
}

export interface Consumer {
	id: number;
	name: Name;
	ssn: number;
	dob: Date;
	license: License;
	address: ConsumerAddress;
	employer: ConsumerEmployer;
	phoneHome: number;
	phoneCell: number;
	phoneWork: number;
	phoneExt: number;
	email: string;
	ipAddress: string;
	bankAccount: BankAccount;
	requestedLoanAmount: number;
}

export interface ConsumerAddress {
	name: string;
	street1: string;
	street2: null;
	city: string;
	state: string;
	zip: number;
	housingStatus: null;
}

export interface BankAccount {
	name: string;
	account: number;
	abanumber: number;
}

export interface ConsumerEmployer {
	name: string;
	street1: null;
	street2: null;
	city: null;
	state: null;
	zip: number;
	payPeriod: string;
	nextPayDate: Date;
	monthlyIncome: number;
	directDeposit: boolean;
}

export interface License {
	state: string;
	number: number;
}

export interface Name {
	first: string;
	middle: string;
	last: string;
}

export interface Report {
	consumerSummarySegment: ConsumerSummarySegment;
	inquirySegment: Segment;
	tradelineDetailSegment: Segment;
}

export interface ConsumerSummarySegment {
	indicators: Indicators;
	uniqueIdentifiersSummary: { [key: string]: AchDebitAttempts };
	consumerAlertsDisputesFreezes: ConsumerAlertsDisputesFreezes;
	account: Account;
	allTransactionsSummary: AllTransactionsSummary;
}

export interface Account {
	lastAccountTransactionStatus: null;
	lastAccountTransactionDate: null;
}

export interface AllTransactionsSummary {
	vendorInquiries: AchDebitAttempts;
	uniqueMemberInquiries: AchDebitAttempts;
	applicationInquiries: AchDebitAttempts;
	dailyInquiries: AchDebitAttempts;
	chargeoffs: AchDebitAttempts;
	totalChargeOffs: AchDebitAttempts;
	predictedChargeoffs: AchDebitAttempts;
	activeTradelines: AchDebitAttempts;
	activeTradelinesComputed: AchDebitAttempts;
	openedTradelines: AchDebitAttempts;
	achReturns: AchDebitAttempts;
	nsfReturns: AchDebitAttempts;
	nonNsfReturns: AchDebitAttempts;
	achDebitAttempts: AchDebitAttempts;
	firstPaymentReturns: AchDebitAttempts;
	paymentsCompleted: AchDebitAttempts;
	paymentsReturned: AchDebitAttempts;
	currentTradelines: number;
	currentTradelinesComputed: number;
	totalTradelines: number;
	totalUniqueMemberTradelines: number;
	maximumOpenTradelines: number;
	totalCurrentPrincipal: number;
	maximumTradelinePrincipal: number;
	maximumTotalPrincipal: number;
	maximumTradelinePrincipalPaidOff: number;
	maximumTotalPrincipalPaidOff: number;
	firstPaymentDefaults: number;
	firstPaymentFatals: number;
	lastPaymentDate: null;
	lastPaymentDisposition: null;
	lastPaymentType: null;
	lastPaymentAmount: number;
	lastPaymentReturnReason: null;
	secondLastPaymentDate: null;
	secondLastPaymentDisposition: null;
	secondLastPaymentType: null;
	secondLastPaymentAmount: number;
	secondLastPaymentReturnReason: null;
	thirdLastPaymentDate: null;
	thirdLastPaymentDisposition: null;
	thirdLastPaymentType: null;
	thirdLastPaymentAmount: number;
	thirdLastPaymentReturnReason: null;
	lastThreePayments: string;
	totalRecoveries: number;
	totalPaidOffs: number;
	tradelinesByInquiringMember: number;
	lastTradelineStatusByInquiringMember: null;
	daysSinceLastTradeline: number;
	daysSinceLastAch: number;
	daysSinceLastFatalReturn: number;
	totalAchDebitAttempts: number;
	lastReturnDate: null;
	lastReturnReason: null;
	lastReturnMessage: null;
	daysSinceLastReturn: number;
	lastInquiryDate: null;
	timeSinceLastInquiry: TimeSinceLastInquiry;
	lastTradelineDate: null;
	lastChargeOffDate: null;
}

export interface AchDebitAttempts {
	daysSince: number | null;
	total: Total[];
}

export interface Total {
	days: number;
	text: number;
	years: number;
}

export interface TimeSinceLastInquiry {
	years: number;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

export interface ConsumerAlertsDisputesFreezes {
	activeDuty: string;
	activeDutyExp: null;
	initialFraud: string;
	extendedFraud: string;
	fraudExpiration: null;
	freeze: string;
	freezeDate: null;
	softInquiryFreeze: string;
	softInquiryFreezeExpiration: null;
	dispute: string;
	disputeContents: null;
}

export interface Indicators {
	indicatorSummary: IndicatorSummary;
}

export interface IndicatorSummary {
	count: number;
	indicator: Indicator[];
}

export interface Indicator {
	count: number;
	code: string;
	message: string;
}

export interface Segment {
	count: number;
}

export interface CustomDecision {
	result: string;
	bucket: string;
}

export interface GlobalDecision {
	result: string;
	craBucket: string;
}

export interface Transaction {
	generationTime: number;
	codeVersion: string;
	requestVersion: number;
	transactionId: number;
	trackHash: string;
	trackId: string;
}

export interface EquifaxUSConsumerCreditReport {
	identifier: string;
	customerReferenceNumber: string;
	customerNumber: string;
	consumerReferralCode: number;
	multipleReportIndicator: number;
	ECOAInquiryType: string;
	hitCode: HitCode;
	fileSinceDate: string;
	lastActivityDate: string;
	reportDate: string;
	subjectName: SubjectName;
	subjectSocialNum: number;
	birthDate: string;
	nameMatchFlags: NameMatchFlags;
	addressDiscrepancyIndicator: string;
	fraudSocialNumAlertCode: FraudVictimIndicator[];
	fraudIDScanAlertCodes: FraudIDScanAlertCode[];
	fraudVictimIndicator: FraudVictimIndicator;
	addresses: AddressElement[];
	alertContacts: AlertContact[];
	trades: Trade[];
	inquiries: Inquiry[];
	models: Model[];
	OFACAlerts: OFACAlert[];
	consumerReferralLocation: ConsumerReferralLocation;
	alternateDataSources: AlternateDataSources;
}

export interface OFACAlert {
	revisedLegalVerbiageIndicator: number;
	memberFirmCode: string;
	cdcTransactionDate: string;
	cdcTransactionTime: number;
	transactionType: string;
	cdcResponseCode: string;
	legalVerbiage: string;
	dataSegmentRegulated: string;
}

export interface AddressElement {
	addressType: string;
	houseNumber: number;
	streetName: string;
	streetType: string;
	cityName: string;
	stateAbbreviation: string;
	zipCode: number;
	sourceOfAddress: FraudVictimIndicator;
	dateFirstReported: string;
	dateLastReported: string;
	addressLine1: string;
	rentOwnBuy?: string;
}

export interface FraudVictimIndicator {
	code: string;
	description: string;
}

export interface AlertContact {
	alertType: FraudVictimIndicator;
	dateReported: string;
	effectiveDate: string;
	telephoneNumbers: TelephoneNumberElement[];
}

export interface TelephoneNumberElement {
	telephoneNumberType: FraudVictimIndicator;
	telephoneNumber: number;
}

export interface AlternateDataSources {
	militaryLendingCoveredBorrower: MilitaryLendingCoveredBorrower;
}

export interface MilitaryLendingCoveredBorrower {
	regulatedIdentifier: string;
	disclaimer: string;
	coveredBorrowerStatus: string;
	referralContactNumber: string;
}

export interface ConsumerReferralLocation {
	bureauCode: number;
	bureauName: string;
	address: ConsumerReferralLocationAddress;
	telephoneNumber: ConsumerReferralLocationTelephoneNumber;
}

export interface ConsumerReferralLocationAddress {
	cityName: string;
	stateAbbreviation: string;
	zipCode: number;
}

export interface ConsumerReferralLocationTelephoneNumber {
	telephoneNumber: number;
}

export interface FraudIDScanAlertCode {
	code: AutomatedUpdateIndicator | number;
	description?: string;
}

export enum AutomatedUpdateIndicator {
	AutomatedUpdateIndicator = "/",
	Empty = "*",
	L = "L",
	Purple = " "
}

export interface HitCode {
	code: number;
	description: string;
}

export interface Inquiry {
	type: string;
	industryCode: string;
	inquiryDate: string;
	customerNumber: string;
	customerName: string;
}

export interface Model {
	type: string;
	modelNumber: string;
	score?: number;
	reasons?: ScoreNumberOrMarketMaxIndustryCode[];
	scoreNumberOrMarketMaxIndustryCode?: ScoreNumberOrMarketMaxIndustryCode;
	riskBasedPricingOrModel?: RiskBasedPricingOrModel;
}

export interface ScoreNumberOrMarketMaxIndustryCode {
	code: number;
}

export interface RiskBasedPricingOrModel {
	percentage: number;
	lowRange: number;
	highRange: number;
}

export interface NameMatchFlags {
	firstNameMatchFlag: string;
	lastNameMatchFlag: string;
	middleNameMatchFlag: string;
}

export interface SubjectName {
	firstName: string;
	lastName: string;
	middleName: string;
}

export interface Trade {
	customerNumber: string;
	automatedUpdateIndicator: AutomatedUpdateIndicator;
	monthsReviewed: number;
	accountDesignator: FraudVictimIndicator | null;
	accountNumber: number;
	thirtyDayCounter?: number;
	sixtyDayCounter?: number;
	ninetyDayCounter?: number;
	previousHighRate1?: number;
	previousHighDate1?: string;
	previousHighRate2?: number;
	previousHighDate2?: string;
	previousHighRate3?: number;
	previousHighDate3?: string;
	"24MonthPaymentHistory"?: FraudIDScanAlertCode[];
	customerName: string;
	dateReported: string;
	dateOpened: string;
	rate: HitCode;
	narrativeCodes: FraudVictimIndicator[];
	rawNarrativeCodes: string[];
	accountTypeCode: HitCode;
	lastPaymentDate: string;
	dateMajorDelinquencyFirstReported?: string;
	termsFrequencyCode: FraudVictimIndicator | null;
	code: string;
	description: string;
	activityDesignatorCode?: FraudVictimIndicator;
	paymentHistory1to24: FraudIDScanAlertCode[];
	lastActivityDate: string;
	highCredit?: number;
	portfolioTypeCode?: FraudVictimIndicator;
	actualPaymentAmount?: number;
	scheduledPaymentAmount?: number;
	termsDurationCode?: FraudVictimIndicator;
}

export interface TwnSelectReport {
	identifier: string;
	twnSelect: TwnSelect;
}

export interface TwnSelect {
	signOn: SignOn;
	transactionId: string;
	statusCode: number;
	statusSeverity: string;
	masterServerTransactionId: number;
	transactionPurposeCode: string;
	transactionPurposeMessage: string;
	twnSelectResponses: TwnSelectResponse[];
}

export interface SignOn {
	statusCode: number;
	statusSeverity: string;
}

export interface TwnSelectResponse {
	dateOfTransaction: Date;
	baseCompensation: BaseCompensation | null;
	annualCompensation: AnnualCompensation[] | null;
	employer: TwnSelectResponseEmployer;
	employee: Employee;
	benefits: Benefits | null;
	compensationAdjustmentLastDate?: Date;
	compensationAdjustmentLastAmountIncrease?: number;
	compensationAdjustmentNextDate?: Date;
	compensationAdjustmentNextAmountIncrease?: number;
	completenessOfTheData?: string;
	serverAssignedId?: number;
	isDemoTransaction?: string[];
	projectedIncome?: number;
	payFrequency?: PayFrequency;
	rateOfPayPerPayPeriod?: number;
	averageHoursWorkedPerPayPeriod?: number;
	payPeriodFrequency?: PayFrequency;
}

export interface AnnualCompensation {
	yearCalendar: number;
	yearToDateBase: number;
	yearToDateOvertime: number;
	yearToDateCommission: number;
	yearToDateBonus: number;
	yearToDateOther: number;
	yearToDateTotal: number;
}

export interface BaseCompensation {
	payFrequency: PayFrequency;
	rateOfPayPerPayPeriod: number;
	averageHoursWorkedPerPayPeriod: number;
	payPeriodFrequency: PayFrequency;
}

export interface PayFrequency {
	code: number;
	message: string;
}

export interface Benefits {
	completenessOfTheData: string;
	serverAssignedId: number;
	isDemoTransaction: string[];
	projectedIncome: number;
}

export interface Employee {
	ssn: number;
	firstName: string;
	middleName: string;
	lastName: string;
	positionTitle: string;
	divisionCode: string;
	statusDataCode: number;
	statusDataMessage: string;
	dateInformationEffective: Date;
	dateOfTheMostRecentHire: Date;
	originalHireDate: Date;
	totalLengthOfServiceInMonths: number;
	dateEmploymentTerminated?: Date;
	reasonForTermination?: string;
}

export interface TwnSelectResponseEmployer {
	code: number;
	namePart1: string;
	addressLine1: string;
	city: string;
	stateOrProvince: string;
	postalCode: number;
	itemizedDisclaimers?: ItemizedDisclaimer[];
}

export interface ItemizedDisclaimer {
	disclaimerType?: string;
	disclaimerText?: string;
}

export interface Link {
	identifier: string;
	type: string;
	href: string;
}
