-- Drop the existing function first
DROP FUNCTION IF EXISTS integration_data.extended_attributes(uuid);

-- Create the function with the adjusted structure
CREATE OR REPLACE FUNCTION integration_data.extended_attributes (
        p_business_id uuid -- ← pass the business_id you need
    ) RETURNS TABLE (
        -- ===== Core identifiers =====
        business_id uuid,
        requested_at timestamptz,
        -- ===== Basic business information =====
        business_name text,
        address text,
        city text,
        state text,
        zip_code text,
        legal_ultimate_number text,
        -- ===== Company details =====
        employees integer,
        corporate_amount bigint,
        corporate_amount_type text,
        corporate_amount_precision text,
        max_year_established text,
        min_year_established text,
        -- ===== NAICS classification =====
        primary_naics_code text,
        primary_naics_sector text,
        primary_naics_subsector text,
        primary_naics_industry_group text,
        primary_naics_industry text,
        secondary_naics_1 text,
        secondary_naics_1_sector text,
        secondary_naics_1_subsector text,
        secondary_naics_1_industry_group text,
        secondary_naics_1_industry text,
        secondary_naics_2 text,
        secondary_naics_2_sector text,
        secondary_naics_2_subsector text,
        secondary_naics_2_industry_group text,
        secondary_naics_2_industry text,
        secondary_naics_3 text,
        secondary_naics_3_sector text,
        secondary_naics_3_subsector text,
        secondary_naics_3_industry_group text,
        secondary_naics_3_industry text,
        secondary_naics_4 text,
        secondary_naics_4_sector text,
        secondary_naics_4_subsector text,
        secondary_naics_4_industry_group text,
        secondary_naics_4_industry text,
        -- ===== SIC codes =====
        primary_sic_code text,
        secondary_sic_1 text,
        secondary_sic_2 text,
        secondary_sic_3 text,
        secondary_sic_4 text,
        -- ===== Geographic information =====
        latitude_avg numeric(10, 6),
        longitude_avg numeric(10, 6),
        latitude_array text,
        longitude_array text,
        -- ===== Location counts =====
        location_count integer,
        location_active_count integer,
        location_inactive_count integer,
        location_inactive_dt_count integer,
        location_inactive_old_count integer,
        location_business_count integer,
        location_residential_count integer,
        location_small_count integer,
        location_large_count integer,
        location_soho_count integer,
        location_unknown_size_count integer,
        -- ===== Entity-type counts =====
        location_corp_count integer,
        location_ccorp_count integer,
        location_scorp_count integer,
        location_llc_count integer,
        location_llp_count integer,
        location_lllp_count integer,
        location_limited_partner_count integer,
        location_partner_count integer,
        location_individual_sole_count integer,
        location_trust_count integer,
        location_mutual_count integer,
        location_nonprofit_ind_count integer,
        location_nonprofit_stat_count integer,
        location_gov_count integer,
        location_fedgov_count integer,
        location_edu_count integer,
        location_other_count integer,
        location_ids text,
        -- ===== Credit scores =====
        market_total_score_avg numeric(10,2),
        market_total_score_max integer,
        market_total_score_min integer,
        market_total_score_array text,
        market_tel_score_avg integer,
        market_tel_score_max integer,
        market_tel_score_min integer,
        market_tel_score_array text,
        credit_score_avg integer,
        credit_score_max integer,
        credit_score_min integer,
        credit_score_array text,
        credit_perc_avg integer,
        credit_perc_max integer,
        credit_perc_min integer,
        credit_perc_array text,
        -- ===== Failure rates =====
        fail_rate_avg numeric(5, 2),
        fail_rate_array text,
        -- ===== Public records =====
        bankruptcy_count integer,
        bankruptcy_most_recent_age integer,
        judgement_count integer,
        judgement_most_recent_age integer,
        lien_count integer,
        lien_most_recent_age integer,
        bankrupt_count_credcls integer,
        bankrupt_count_failrt integer,
        bankrupt_count_field integer,
        -- ===== Equifax BMA 3-month non-financial trades =====
        trade_3m_nfin_trade_count numeric(15,2),
        trade_3m_nfin_trade_total_balance numeric(15,2),
        trade_3m_nfin_worst_payment_status text,
        trade_3m_nfin_past_due_amount numeric(15,2),
        trade_3m_nfin_high_credit_limit numeric(15,2),
        trade_3m_nfin_percent_satisfactory_accounts numeric(15,2),

        -- ===== Enhanced Business Information =====
        website text,
        name_display text,
        names_other text,

        -- ===== Enhanced Location Details =====
        street_2 text,
        county text,
        country text,
        cbsa_name text,
        verified_address text,
        fax text,

        -- ===== Enhanced Company Details =====
        currency_code text,
        is_hq text,
        legal_entity_type text,
        is_public text,
        ticker text,
        tickers_alt text,
        ein text,
        location_id text,

        -- ===== Business Classification =====
        industries text,
        sub_industries text,
        sub_industry_primary text,
        naics2 text,
        naics4 text,
        naics_top3 text,
        naics_top3_confidence_scores text,
        sic2 text,
        sic3 text,
        sic_top3 text,
        sic_top3_confidence_scores text,
        is_b2b text,
        is_b2c text,
        is_fortune_100 text,
        is_fortune_500 text,
        is_s_and_p_500 text,
        is_small_business text,
        tier_grade text,

        -- ===== Funding & Investment =====
        funding_type text,
        funding_strength text,
        total_funding_amount text,
        latest_funding_amount text,
        latest_funding_date text,
        latest_funding_age text,
        num_funding_rounds text,
        num_of_investors text,
        investor_names text,

        -- ===== Technology & Digital Presence =====
        tech_ids text,
        keywords text,
        top_keywords text,
        num_keywords text,
        has_mobile_app text,
        domain_rank text,
        url_status text,
        url_last_updated text,
        urls_alt text,
        linkedin_url text,
        facebook_url text,
        twitter_url text,
        yelp_url text,

        -- ===== Contact Department Counts =====
        hr_contacts text,
        it_contacts text,
        sales_contacts text,
        finance_contacts text,
        marketing_contacts text,
        c_suite_contacts text,
        legal_contacts text,
        operations_contacts text,
        engineering_contacts text,
        medical_contacts text,

        -- ===== Growth Metrics =====
        employee_growth_1yr text,
        employee_growth_2yr text,
        percent_employee_growth text,
        percent_revenue_growth text,
        revenue_growth text,
        employee_growth text,
        growth text,

        -- ===== HQ-Level Fields =====
        company_id text,
        company_name text,
        company_street text,
        company_street_2 text,
        company_city text,
        company_state text,
        company_zip text,
        company_county text,
        company_country text,
        company_cbsa_name text,
        company_latitude text,
        company_longitude text,
        company_phone text,
        company_fax text,
        company_url text,
        company_verified_address text,
        company_employees text,
        company_revenue text
    ) AS $$
WITH equifax_data AS (
    SELECT business_id,
           requested_at as equifax_requested_at,
           response
    FROM integration_data.request_response r
    WHERE r.platform_id = 17 
      AND r.business_id = p_business_id
      AND r.request_type = 'fetch_public_records'
      AND r.response->'efx_id' IS NOT NULL
    ORDER BY r.requested_at DESC
    LIMIT 1
),
zoominfo_data AS (
    SELECT business_id,
           requested_at as zoominfo_requested_at,
           response
    FROM integration_data.request_response r
    WHERE r.platform_id = 24 
      AND r.business_id = p_business_id
      AND r.request_type = 'fetch_business_entity_verification'
      AND r.response->'match' IS NOT NULL
    ORDER BY r.requested_at DESC
    LIMIT 1
)
SELECT 
    COALESCE(e.business_id, z.business_id),
    COALESCE(e.equifax_requested_at, z.zoominfo_requested_at),

    -- ===== Basic business information (COALESCED) =====
    COALESCE(z.response->'firmographic'->>'zi_c_name', e.response->>'legultnameall'),
    COALESCE(z.response->'firmographic'->>'zi_c_street', e.response->>'address_string'),
    COALESCE(z.response->'firmographic'->>'zi_c_city', e.response->>'legultcityall'),
    COALESCE(z.response->'firmographic'->>'zi_c_state', e.response->>'legultstateall'),
    COALESCE(z.response->'firmographic'->>'zi_c_zip', e.response->>'efx_legultzipcodeall'),
    e.response->>'legultnumall',

    -- ===== Company details (COALESCED with validation) =====
    COALESCE(
        CASE WHEN z.response->'firmographic'->>'zi_c_employees' ~ '^[0-9]+$' 
             THEN (z.response->'firmographic'->>'zi_c_employees')::integer 
             ELSE NULL END,
        CASE WHEN e.response->>'corpemployees' ~ '^[0-9]+$' 
             THEN (e.response->>'corpemployees')::integer 
             ELSE NULL END
    ),
    COALESCE(
        CASE WHEN z.response->'firmographic'->>'zi_c_revenue' ~ '^[0-9]+$' 
             THEN (z.response->'firmographic'->>'zi_c_revenue')::bigint 
             ELSE NULL END,
        CASE WHEN e.response->>'corpamount' ~ '^[0-9]+$' 
             THEN (e.response->>'corpamount')::bigint 
             ELSE NULL END
    ),
    e.response->>'corpamount_type',
    e.response->>'corpamount_prec',
    COALESCE(z.response->'firmographic'->>'zi_c_year_founded', e.response->>'max_year_est'),
    COALESCE(z.response->'firmographic'->>'zi_c_year_founded', e.response->>'min_year_est'),

    -- ===== NAICS classification (COALESCED primary, Equifax secondary) =====
    COALESCE(z.response->'firmographic'->>'zi_c_naics6', e.response->>'primnaicscode'),
    e.response->>'primnaics_sector',
    e.response->>'primnaics_subsector',
    e.response->>'primnaics_industry_group',
    -- Primary Industry (using NAICS descriptions as fallback)
    COALESCE(
        z.response->'firmographic'->>'zi_c_industry_primary',
        e.response->>'primnaics_industry'
    ) as industry_primary,    
    e.response->>'secnaics1',
    e.response->>'secnaics1_sector',
    e.response->>'secnaics1_subsector',
    e.response->>'secnaics1_industry_group',
    e.response->>'secnaics1_industry',
    e.response->>'secnaics2',
    e.response->>'secnaics2_sector',
    e.response->>'secnaics2_subsector',
    e.response->>'secnaics2_industry_group',
    e.response->>'secnaics2_industry',
    e.response->>'secnaics3',
    e.response->>'secnaics3_sector',
    e.response->>'secnaics3_subsector',
    e.response->>'secnaics3_industry_group',
    e.response->>'secnaics3_industry',
    e.response->>'secnaics4',
    e.response->>'secnaics4_sector',
    e.response->>'secnaics4_subsector',
    e.response->>'secnaics4_industry_group',
    e.response->>'secnaics4_industry',

    -- ===== SIC codes (COALESCED primary, Equifax secondary) =====
    COALESCE(z.response->'firmographic'->>'zi_c_sic4', e.response->>'primsic'),
    e.response->>'secsic1',
    e.response->>'secsic2',
    e.response->>'secsic3',
    e.response->>'secsic4',

    -- Latitude
    COALESCE(
        CASE 
            WHEN z.response->'firmographic'->>'zi_c_latitude' ~ '^-?[0-9]+\.?[0-9]*$'
            THEN (z.response->'firmographic'->>'zi_c_latitude')::numeric(10, 6)
            ELSE NULL 
        END,
        CASE 
            WHEN e.response->>'location_latitude_avg' ~ '^-?[0-9]+\.?[0-9]*$' 
            THEN (e.response->>'location_latitude_avg')::numeric(10, 6) 
            ELSE NULL 
        END
    ) as latitude,

    -- Longitude
    COALESCE(
        CASE 
            WHEN z.response->'firmographic'->>'zi_c_longitude' ~ '^-?[0-9]+\.?[0-9]*$'
            THEN (z.response->'firmographic'->>'zi_c_longitude')::numeric(10, 6)
            ELSE NULL 
        END,
        CASE 
            WHEN e.response->>'location_longitude_avg' ~ '^-?[0-9]+\.?[0-9]*$' 
            THEN (e.response->>'location_longitude_avg')::numeric(10, 6) 
            ELSE NULL 
        END
    ) as longitude,

    e.response->>'lat_array',
    e.response->>'lon_array',

    -- ===== Location counts (with validation) =====
    COALESCE(
        CASE 
            WHEN e.response->>'location_cnt' ~ '^[0-9]+$' 
            THEN (e.response->>'location_cnt')::integer 
            ELSE NULL 
        END,
        CASE 
            WHEN z.response->'firmographic'->>'zi_c_num_locations' ~ '^[0-9]+$'
            THEN (z.response->'firmographic'->>'zi_c_num_locations')::integer
            ELSE NULL 
        END
    ) as location_count,    
    CASE WHEN e.response->>'location_active_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_active_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_inactive_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_inactive_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_inactivedt_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_inactivedt_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_inactiveold_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_inactiveold_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_biz_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_biz_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_res_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_res_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_small_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_small_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_large_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_large_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_soho_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_soho_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_unknown_size_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_unknown_size_cnt')::integer 
         ELSE NULL END,

    -- ===== Entity-type counts (with validation) =====
    CASE WHEN e.response->>'location_corp_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_corp_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_ccorp_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_ccorp_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_scorp_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_scorp_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_llc_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_llc_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_llp_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_llp_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_lllp_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_lllp_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_limpartner_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_limpartner_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_partner_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_partner_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_indsole_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_indsole_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_trust_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_trust_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_mutual_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_mutual_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_nonprofitind_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_nonprofitind_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_nonprofitstat_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_nonprofitstat_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_gov_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_gov_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_fedgov_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_fedgov_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_edu_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_edu_cnt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'location_other_cnt' ~ '^[0-9]+$' 
         THEN (e.response->>'location_other_cnt')::integer 
         ELSE NULL END,
    e.response->>'location_ids',

    -- ===== Credit scores (with validation) =====
    CASE WHEN e.response->>'mkt_totalscore_avg' ~ '^[0-9]+\.?[0-9]*$' 
         THEN (e.response->>'mkt_totalscore_avg')::numeric(10,2) 
         ELSE NULL END,
    CASE WHEN e.response->>'mkt_totalscore_max' ~ '^[0-9]+$' 
         THEN (e.response->>'mkt_totalscore_max')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'mkt_totalscore_min' ~ '^[0-9]+$' 
         THEN (e.response->>'mkt_totalscore_min')::integer 
         ELSE NULL END,
    e.response->>'mkt_totalscore_array',
    CASE WHEN e.response->>'mkt_telscore_avg' ~ '^[0-9]+$' 
         THEN (e.response->>'mkt_telscore_avg')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'mkt_telscore_max' ~ '^[0-9]+$' 
         THEN (e.response->>'mkt_telscore_max')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'mkt_telscore_min' ~ '^[0-9]+$' 
         THEN (e.response->>'mkt_telscore_min')::integer 
         ELSE NULL END,
    e.response->>'mkt_telscore_array',
    CASE WHEN e.response->>'creditscore_avg' ~ '^[0-9]+$' 
         THEN (e.response->>'creditscore_avg')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'creditscore_max' ~ '^[0-9]+$' 
         THEN (e.response->>'creditscore_max')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'creditscore_min' ~ '^[0-9]+$' 
         THEN (e.response->>'creditscore_min')::integer 
         ELSE NULL END,
    e.response->>'creditscore_array',
    CASE WHEN e.response->>'creditperc_avg' ~ '^[0-9]+$' 
         THEN (e.response->>'creditperc_avg')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'creditperc_max' ~ '^[0-9]+$' 
         THEN (e.response->>'creditperc_max')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'creditperc_min' ~ '^[0-9]+$' 
         THEN (e.response->>'creditperc_min')::integer 
         ELSE NULL END,
    e.response->>'creditperc_array',

    -- ===== Failure rates (with validation) =====
    CASE WHEN e.response->>'failrate_avg' ~ '^[0-9]+\.?[0-9]*$' 
         THEN (e.response->>'failrate_avg')::numeric(5, 2) 
         ELSE NULL END,
    e.response->>'failrate_array',

    -- ===== Public records (with validation) =====
    CASE WHEN e.response->>'bankruptcy_count' ~ '^[0-9]+$' 
         THEN (e.response->>'bankruptcy_count')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'bankruptcy_most_recent_age' ~ '^[0-9]+$' 
         THEN (e.response->>'bankruptcy_most_recent_age')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'judgement_count' ~ '^[0-9]+$' 
         THEN (e.response->>'judgement_count')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'judgement_most_recent_age' ~ '^[0-9]+$' 
         THEN (e.response->>'judgement_most_recent_age')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'lien_count' ~ '^[0-9]+$' 
         THEN (e.response->>'lien_count')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'lien_most_recent_age' ~ '^[0-9]+$' 
         THEN (e.response->>'lien_most_recent_age')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'bankrupt_cnt_credcls' ~ '^[0-9]+$' 
         THEN (e.response->>'bankrupt_cnt_credcls')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'bankrupt_cnt_failrt' ~ '^[0-9]+$' 
         THEN (e.response->>'bankrupt_cnt_failrt')::integer 
         ELSE NULL END,
    CASE WHEN e.response->>'bankrupt_cnt_field' ~ '^[0-9]+$' 
         THEN (e.response->>'bankrupt_cnt_field')::integer 
         ELSE NULL END,

    -- ===== Equifax BMA 3M - NON-FINANCIAL TRADE RECORDS (with validation) =====
    CASE WHEN e.response->>'efxbma_3m_nfin_tr_count' ~ '^[0-9]+\.?[0-9]*$' 
         THEN (e.response->>'efxbma_3m_nfin_tr_count')::numeric(15,2) 
         ELSE NULL END,
    CASE WHEN e.response->>'efxbma_3m_nfin_tr_total_bal' ~ '^[0-9]+\.?[0-9]*$' 
         THEN (e.response->>'efxbma_3m_nfin_tr_total_bal')::numeric(15,2) 
         ELSE NULL END,
    e.response->>'efxbma_3m_nfin_worst_payment_status',
    CASE WHEN e.response->>'efxbma_3m_nfin_past_due_amount' ~ '^[0-9]+\.?[0-9]*$' 
         THEN (e.response->>'efxbma_3m_nfin_past_due_amount')::numeric(15,2) 
         ELSE NULL END,
    CASE WHEN e.response->>'efxbma_3m_nfin_high_credit_lim' ~ '^[0-9]+\.?[0-9]*$' 
         THEN (e.response->>'efxbma_3m_nfin_high_credit_lim')::numeric(15,2) 
         ELSE NULL END,
    CASE WHEN e.response->>'efxbma_3m_nfin_per_satisfactory_acc' ~ '^[0-9]+\.?[0-9]*$' 
         THEN (e.response->>'efxbma_3m_nfin_per_satisfactory_acc')::numeric(15,2) 
         ELSE NULL END,

    -- ===== Enhanced Business Information =====
    z.response->'firmographic'->>'zi_c_url',
    z.response->'firmographic'->>'zi_c_name_display',
    z.response->'firmographic'->>'zi_c_names_other',

    -- ===== Enhanced Location Details =====
    z.response->'firmographic'->>'zi_c_street_2',
    z.response->'firmographic'->>'zi_c_county',
    z.response->'firmographic'->>'zi_c_country',
    z.response->'firmographic'->>'zi_c_cbsa_name',
    z.response->'firmographic'->>'zi_c_verified_address',
    z.response->'firmographic'->>'zi_c_fax',

    -- ===== Enhanced Company Details =====
    z.response->'firmographic'->>'zi_c_currency_code',
    z.response->'firmographic'->>'zi_c_is_hq',
    z.response->'firmographic'->>'zi_c_legal_entity_type',
    z.response->'firmographic'->>'zi_c_is_public',
    z.response->'firmographic'->>'zi_c_ticker',
    z.response->'firmographic'->>'zi_c_tickers_alt',
    z.response->'firmographic'->>'zi_c_ein',
    z.response->'firmographic'->>'zi_c_location_id',

    -- ===== Business Classification =====
    z.response->'firmographic'->>'zi_c_industries',
    z.response->'firmographic'->>'zi_c_sub_industries',
    z.response->'firmographic'->>'zi_c_sub_industry_primary',
    z.response->'firmographic'->>'zi_c_naics2',
    z.response->'firmographic'->>'zi_c_naics4',
    z.response->'firmographic'->>'zi_c_naics_top3',
    z.response->'firmographic'->>'zi_c_naics_top3_confidence_scores',
    z.response->'firmographic'->>'zi_c_sic2',
    z.response->'firmographic'->>'zi_c_sic3',
    z.response->'firmographic'->>'zi_c_sic_top3',
    z.response->'firmographic'->>'zi_c_sic_top3_confidence_scores',
    z.response->'firmographic'->>'zi_c_is_b2b',
    z.response->'firmographic'->>'zi_c_is_b2c',
    z.response->'firmographic'->>'zi_c_is_fortune_100',
    z.response->'firmographic'->>'zi_c_is_fortune_500',
    z.response->'firmographic'->>'zi_c_is_s_and_p_500',
    z.response->'firmographic'->>'zi_c_is_small_business',
    z.response->'firmographic'->>'zi_c_tier_grade',

    -- ===== Funding & Investment =====
    z.response->'firmographic'->>'zi_c_funding_type',
    z.response->'firmographic'->>'zi_c_funding_strength',
    z.response->'firmographic'->>'zi_c_total_funding_amount',
    z.response->'firmographic'->>'zi_c_latest_funding_amount',
    z.response->'firmographic'->>'zi_c_latest_funding_date',
    z.response->'firmographic'->>'zi_c_latest_funding_age',
    z.response->'firmographic'->>'zi_c_num_funding_rounds',
    z.response->'firmographic'->>'zi_c_num_of_investors',
    z.response->'firmographic'->>'zi_c_investor_names',

    -- ===== Technology & Digital Presence =====
    z.response->'firmographic'->>'zi_c_tech_ids',
    z.response->'firmographic'->>'zi_c_keywords',
    z.response->'firmographic'->>'zi_c_top_keywords',
    z.response->'firmographic'->>'zi_c_num_keywords',
    z.response->'firmographic'->>'zi_c_has_mobile_app',
    z.response->'firmographic'->>'zi_c_domain_rank',
    z.response->'firmographic'->>'zi_c_url_status',
    z.response->'firmographic'->>'zi_c_url_last_updated',
    z.response->'firmographic'->>'zi_c_urls_alt',
    z.response->'firmographic'->>'zi_c_linkedin_url',
    z.response->'firmographic'->>'zi_c_facebook_url',
    z.response->'firmographic'->>'zi_c_twitter_url',
    z.response->'firmographic'->>'zi_c_yelp_url',

    -- ===== Contact Department Counts =====
    z.response->'firmographic'->>'zi_c_hr_contacts',
    z.response->'firmographic'->>'zi_c_it_contacts',
    z.response->'firmographic'->>'zi_c_sales_contacts',
    z.response->'firmographic'->>'zi_c_finance_contacts',
    z.response->'firmographic'->>'zi_c_marketing_contacts',
    z.response->'firmographic'->>'zi_c_c_suite_contacts',
    z.response->'firmographic'->>'zi_c_legal_contacts',
    z.response->'firmographic'->>'zi_c_operations_contacts',
    z.response->'firmographic'->>'zi_c_engineering_contacts',
    z.response->'firmographic'->>'zi_c_medical_contacts',

    -- ===== Growth Metrics =====
    z.response->'firmographic'->>'zi_c_employee_growth_1yr',
    z.response->'firmographic'->>'zi_c_employee_growth_2yr',
    z.response->'firmographic'->>'zi_es_percent_employee_growth',
    z.response->'firmographic'->>'zi_es_percent_revenue_growth',
    z.response->'firmographic'->>'zi_es_revenue_growth',
    z.response->'firmographic'->>'zi_es_employee_growth',
    z.response->'firmographic'->>'zi_es_growth',

    -- ===== HQ-Level Fields =====
    z.response->'firmographic'->>'zi_c_company_id',
    z.response->'firmographic'->>'zi_c_company_name',
    z.response->'firmographic'->>'zi_c_company_street',
    z.response->'firmographic'->>'zi_c_company_street_2',
    z.response->'firmographic'->>'zi_c_company_city',
    z.response->'firmographic'->>'zi_c_company_state',
    z.response->'firmographic'->>'zi_c_company_zip',
    z.response->'firmographic'->>'zi_c_company_county',
    z.response->'firmographic'->>'zi_c_company_country',
    z.response->'firmographic'->>'zi_c_company_cbsa_name',
    z.response->'firmographic'->>'zi_c_company_latitude',
    z.response->'firmographic'->>'zi_c_company_longitude',
    z.response->'firmographic'->>'zi_c_company_phone',
    z.response->'firmographic'->>'zi_c_company_fax',
    z.response->'firmographic'->>'zi_c_company_url',
    z.response->'firmographic'->>'zi_c_company_verified_address',
    z.response->'firmographic'->>'zi_c_company_employees',
    z.response->'firmographic'->>'zi_c_company_revenue'

FROM equifax_data e
FULL OUTER JOIN zoominfo_data z ON e.business_id = z.business_id;

$$ LANGUAGE sql STABLE;