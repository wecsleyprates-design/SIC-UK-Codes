export type BusinessExtendedData = {
  // ===== Core identifiers =====
  business_id: string; // uuid
  requested_at: string; // timestamptz (ISO string)
  
  // ===== Basic business information =====
  business_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  legal_ultimate_number: string | null;
  
  // ===== Company details =====
  employees: number | null;
  corporate_amount: number | null; // bigint
  corporate_amount_type: string | null;
  corporate_amount_precision: string | null;
  max_year_established: string | null;
  min_year_established: string | null;
  
  // ===== NAICS classification =====
  primary_naics_code: string | null;
  primary_naics_sector: string | null;
  primary_naics_subsector: string | null;
  primary_naics_industry_group: string | null;
  primary_naics_industry: string | null;
  secondary_naics_1: string | null;
  secondary_naics_1_sector: string | null;
  secondary_naics_1_subsector: string | null;
  secondary_naics_1_industry_group: string | null;
  secondary_naics_1_industry: string | null;
  secondary_naics_2: string | null;
  secondary_naics_2_sector: string | null;
  secondary_naics_2_subsector: string | null;
  secondary_naics_2_industry_group: string | null;
  secondary_naics_2_industry: string | null;
  secondary_naics_3: string | null;
  secondary_naics_3_sector: string | null;
  secondary_naics_3_subsector: string | null;
  secondary_naics_3_industry_group: string | null;
  secondary_naics_3_industry: string | null;
  secondary_naics_4: string | null;
  secondary_naics_4_sector: string | null;
  secondary_naics_4_subsector: string | null;
  secondary_naics_4_industry_group: string | null;
  secondary_naics_4_industry: string | null;
  
  // ===== SIC codes =====
  primary_sic_code: string | null;
  secondary_sic_1: string | null;
  secondary_sic_2: string | null;
  secondary_sic_3: string | null;
  secondary_sic_4: string | null;
  
  // ===== Geographic information =====
  latitude_avg: number | null; // numeric(10, 6)
  longitude_avg: number | null; // numeric(10, 6)
  latitude_array: string | null;
  longitude_array: string | null;
  
  // ===== Location counts =====
  location_count: number | null;
  location_active_count: number | null;
  location_inactive_count: number | null;
  location_inactive_dt_count: number | null;
  location_inactive_old_count: number | null;
  location_business_count: number | null;
  location_residential_count: number | null;
  location_small_count: number | null;
  location_large_count: number | null;
  location_soho_count: number | null;
  location_unknown_size_count: number | null;
  
  // ===== Entity-type counts =====
  location_corp_count: number | null;
  location_ccorp_count: number | null;
  location_scorp_count: number | null;
  location_llc_count: number | null;
  location_llp_count: number | null;
  location_lllp_count: number | null;
  location_limited_partner_count: number | null;
  location_partner_count: number | null;
  location_individual_sole_count: number | null;
  location_trust_count: number | null;
  location_mutual_count: number | null;
  location_nonprofit_ind_count: number | null;
  location_nonprofit_stat_count: number | null;
  location_gov_count: number | null;
  location_fedgov_count: number | null;
  location_edu_count: number | null;
  location_other_count: number | null;
  location_ids: string | null;
  
  // ===== Credit scores =====
  market_total_score_avg: number | null; // numeric(10,2)
  market_total_score_max: number | null;
  market_total_score_min: number | null;
  market_total_score_array: string | null;
  market_tel_score_avg: number | null;
  market_tel_score_max: number | null;
  market_tel_score_min: number | null;
  market_tel_score_array: string | null;
  credit_score_avg: number | null;
  credit_score_max: number | null;
  credit_score_min: number | null;
  credit_score_array: string | null;
  credit_perc_avg: number | null;
  credit_perc_max: number | null;
  credit_perc_min: number | null;
  credit_perc_array: string | null;
  
  // ===== Failure rates =====
  fail_rate_avg: number | null; // numeric(5, 2)
  fail_rate_array: string | null;
  
  // ===== Public records =====
  bankruptcy_count: number | null;
  bankruptcy_most_recent_age: number | null;
  judgement_count: number | null;
  judgement_most_recent_age: number | null;
  lien_count: number | null;
  lien_most_recent_age: number | null;
  bankrupt_count_credcls: number | null;
  bankrupt_count_failrt: number | null;
  bankrupt_count_field: number | null;
  
  // ===== Equifax BMA 3-month non-financial trades =====
  trade_3m_nfin_trade_count: number | null; // numeric(15,2)
  trade_3m_nfin_trade_total_balance: number | null; // numeric(15,2)
  trade_3m_nfin_worst_payment_status: string | null;
  trade_3m_nfin_past_due_amount: number | null; // numeric(15,2)
  trade_3m_nfin_high_credit_limit: number | null; // numeric(15,2)
  trade_3m_nfin_percent_satisfactory_accounts: number | null; // numeric(15,2)
  
  // ===== Enhanced Business Information =====
  website: string | null;
  name_display: string | null;
  names_other: string | null;
  
  // ===== Enhanced Location Details =====
  street_2: string | null;
  county: string | null;
  country: string | null;
  cbsa_name: string | null;
  verified_address: string | null;
  fax: string | null;
  
  // ===== Enhanced Company Details =====
  currency_code: string | null;
  is_hq: string | null;
  legal_entity_type: string | null;
  is_public: string | null;
  ticker: string | null;
  tickers_alt: string | null;
  ein: string | null;
  location_id: string | null;
  
  // ===== Business Classification =====
  industries: string | null;
  sub_industries: string | null;
  sub_industry_primary: string | null;
  naics2: string | null;
  naics4: string | null;
  naics_top3: string | null;
  naics_top3_confidence_scores: string | null;
  sic2: string | null;
  sic3: string | null;
  sic_top3: string | null;
  sic_top3_confidence_scores: string | null;
  is_b2b: string | null;
  is_b2c: string | null;
  is_fortune_100: string | null;
  is_fortune_500: string | null;
  is_s_and_p_500: string | null;
  is_small_business: string | null;
  tier_grade: string | null;
  
  // ===== Funding & Investment =====
  funding_type: string | null;
  funding_strength: string | null;
  total_funding_amount: string | null;
  latest_funding_amount: string | null;
  latest_funding_date: string | null;
  latest_funding_age: string | null;
  num_funding_rounds: string | null;
  num_of_investors: string | null;
  investor_names: string | null;
  
  // ===== Technology & Digital Presence =====
  tech_ids: string | null;
  keywords: string | null;
  top_keywords: string | null;
  num_keywords: string | null;
  has_mobile_app: string | null;
  domain_rank: string | null;
  url_status: string | null;
  url_last_updated: string | null;
  urls_alt: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  yelp_url: string | null;
  
  // ===== Contact Department Counts =====
  hr_contacts: string | null;
  it_contacts: string | null;
  sales_contacts: string | null;
  finance_contacts: string | null;
  marketing_contacts: string | null;
  c_suite_contacts: string | null;
  legal_contacts: string | null;
  operations_contacts: string | null;
  engineering_contacts: string | null;
  medical_contacts: string | null;
  
  // ===== Growth Metrics =====
  employee_growth_1yr: string | null;
  employee_growth_2yr: string | null;
  percent_employee_growth: string | null;
  percent_revenue_growth: string | null;
  revenue_growth: string | null;
  employee_growth: string | null;
  growth: string | null;
  
  // ===== HQ-Level Fields =====
  company_id: string | null;
  company_name: string | null;
  company_street: string | null;
  company_street_2: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  company_county: string | null;
  company_country: string | null;
  company_cbsa_name: string | null;
  company_latitude: string | null;
  company_longitude: string | null;
  company_phone: string | null;
  company_fax: string | null;
  company_url: string | null;
  company_verified_address: string | null;
  company_employees: string | null;
  company_revenue: string | null;

  // ===== OpenCorporates Top-Level Fields =====
  registry_prediction: number | null;

  // ===== OpenCorporates Match Section =====
  registry_match_zip: string | null;
  registry_match_city: string | null;
  registry_match_state: string | null;
  registry_match_name: string | null;
  registry_match_address: string | null;
  registry_match_company_number: string | null;
  registry_match_jurisdiction_code: string | null;
  registry_match_normalized_name: string | null;
  registry_match_normalized_address: string | null;

  // ===== OpenCorporates Officers Array (Officer 1) =====
  registry_officer_1_name: string | null;
  registry_officer_1_title: string | null;
  registry_officer_1_address_street: string | null;
  registry_officer_1_address_locality: string | null;
  registry_officer_1_address_region: string | null;
  registry_officer_1_address_postal_code: string | null;
  registry_officer_1_address_country: string | null;
  registry_officer_1_address_full: string | null;
  registry_officer_1_first_name: string | null;
  registry_officer_1_last_name: string | null;
  registry_officer_1_status: string | null;
  registry_officer_1_start_date: string | null;
  registry_officer_1_person_uid: string | null;
  registry_officer_1_person_number: string | null;
  registry_officer_1_type: string | null;
  registry_officer_1_source_url: string | null;
  registry_officer_1_retrieved_at: string | null;

  // ===== OpenCorporates Officers Array (Officer 2) =====
  registry_officer_2_name: string | null;
  registry_officer_2_title: string | null;
  registry_officer_2_address_street: string | null;
  registry_officer_2_address_locality: string | null;
  registry_officer_2_address_region: string | null;
  registry_officer_2_address_postal_code: string | null;
  registry_officer_2_address_country: string | null;
  registry_officer_2_address_full: string | null;
  registry_officer_2_first_name: string | null;
  registry_officer_2_last_name: string | null;
  registry_officer_2_status: string | null;
  registry_officer_2_start_date: string | null;
  registry_officer_2_person_uid: string | null;
  registry_officer_2_person_number: string | null;
  registry_officer_2_type: string | null;
  registry_officer_2_source_url: string | null;
  registry_officer_2_retrieved_at: string | null;

  // ===== OpenCorporates Names Array =====
  registry_name_1_name: string | null;
  registry_name_1_source: string | null;
  registry_name_1_normalized: string | null;
  registry_name_1_company_number: string | null;
  registry_name_1_jurisdiction: string | null;

  // ===== OpenCorporates All Matches Array =====
  registry_match_1_prediction: number | null;
  registry_match_1_name: string | null;
  registry_match_1_company_number: string | null;
  registry_match_1_jurisdiction: string | null;
  registry_match_1_address: string | null;

  // ===== OpenCorporates Firmographic Fields =====
  registry_firm_name: string | null;
  registry_firm_company_type: string | null;
  registry_firm_current_status: string | null;
  registry_firm_incorporation_date: string | null;
  registry_firm_jurisdiction_code: string | null;
  registry_firm_registry_url: string | null;
  registry_firm_retrieved_at: string | null;
  registry_firm_company_number: string | null;
  registry_firm_previous_names: string | null;
  registry_firm_dissolution_date: string | null;
  registry_firm_inactive_date: string | null;
  registry_firm_branch: string | null;
  registry_firm_home_company: string | null;
  registry_firm_registered_address: string | null;
};