CREATE OR REPLACE PROCEDURE public.sp_worth_score_auditing_refresh(cursor_name refcursor)
    LANGUAGE plpgsql
AS
$$
BEGIN
    DROP TABLE IF EXISTS warehouse.worth_score_input_audit;

    CREATE TEMPORARY TABLE loaded_scores AS
    SELECT
        *,
        TO_DATE(CAST(partition_0 AS VARCHAR) || '-' || CAST(partition_1 AS VARCHAR) || '-' ||
                CAST(partition_2 AS VARCHAR),
                'YYYY-MM-DD') AS score_date
    FROM awsdatacatalog."aws-data-exchange"."scores_ai_dataplatform_v1";

    CREATE TABLE warehouse.worth_score_input_audit DISTSTYLE EVEN SORTKEY (score_date) AS
    WITH
        src AS (SELECT
                    score_date,
                    model_metadata.model_input_raw AS mir
                FROM loaded_scores
        )
    SELECT
        score_date,
        COUNT(*)                                                                  AS rows_per_day,
        AVG(CASE WHEN mir.state IS NOT NULL THEN 1.0 ELSE 0 END) * 100            AS fill_state,
        AVG(CASE WHEN mir.bus_struct IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_bus_struct,
        AVG(CASE WHEN mir.city IS NOT NULL THEN 1.0 ELSE 0 END) * 100             AS fill_city,
        AVG(CASE WHEN mir.age_bankruptcy IS NOT NULL THEN 1.0 ELSE 0 END) * 100   AS fill_age_bankruptcy,
        AVG(CASE WHEN mir.age_judgment IS NOT NULL THEN 1.0 ELSE 0 END) * 100     AS fill_age_judgment,
        AVG(CASE WHEN mir.age_lien IS NOT NULL THEN 1.0 ELSE 0 END) * 100         AS fill_age_lien,
        AVG(CASE WHEN mir.age_business IS NOT NULL THEN 1.0 ELSE 0 END) * 100     AS fill_age_business,
        AVG(CASE WHEN mir.count_bankruptcy IS NOT NULL THEN 1.0 ELSE 0 END) * 100 AS fill_count_bankruptcy,
        AVG(CASE WHEN mir.count_judgment IS NOT NULL THEN 1.0 ELSE 0 END) * 100   AS fill_count_judgment,
        AVG(CASE WHEN mir.count_lien IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_count_lien,
        AVG(CASE WHEN mir.count_employees IS NOT NULL THEN 1.0 ELSE 0 END) * 100  AS fill_count_employees,
        AVG(CASE WHEN mir.count_reviews IS NOT NULL THEN 1.0 ELSE 0 END) * 100    AS fill_count_reviews,
        AVG(CASE WHEN mir.score_reviews IS NOT NULL THEN 1.0 ELSE 0 END) * 100    AS fill_score_reviews,
        AVG(CASE WHEN mir.indicator_government IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_indicator_government,
        AVG(CASE WHEN mir.indicator_federal_government IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_indicator_federal_government,
        AVG(CASE WHEN mir.indicator_education IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_indicator_education,
        AVG(CASE WHEN mir.indicator_public IS NOT NULL THEN 1.0 ELSE 0 END) * 100 AS fill_indicator_public,
        AVG(CASE WHEN mir.naics6 IS NOT NULL THEN 1.0 ELSE 0 END) * 100           AS fill_naics6,
        AVG(CASE WHEN mir.primsic IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_primsic,
        AVG(CASE WHEN mir.revenue IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_revenue,
        AVG(CASE WHEN mir.is_cost_of_goods_sold IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_is_cost_of_goods_sold,
        AVG(CASE WHEN mir.is_operating_expense IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_is_operating_expense,
        AVG(CASE WHEN mir.is_net_income IS NOT NULL THEN 1.0 ELSE 0 END) * 100    AS fill_is_net_income,
        AVG(CASE WHEN mir.is_gross_profit IS NOT NULL THEN 1.0 ELSE 0 END) * 100  AS fill_is_gross_profit,
        AVG(CASE WHEN mir.bs_accounts_receivable IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_bs_accounts_receivable,
        AVG(CASE WHEN mir.bs_accounts_payable IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_bs_accounts_payable,
        AVG(CASE WHEN mir.bs_total_assets IS NOT NULL THEN 1.0 ELSE 0 END) * 100  AS fill_bs_total_assets,
        AVG(CASE WHEN mir.bs_total_debt IS NOT NULL THEN 1.0 ELSE 0 END) * 100    AS fill_bs_total_debt,
        AVG(CASE WHEN mir.bs_total_equity IS NOT NULL THEN 1.0 ELSE 0 END) * 100  AS fill_bs_total_equity,
        AVG(CASE WHEN mir.bs_total_liabilities_and_equity IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_bs_total_liabilities_and_equity,
        AVG(CASE WHEN mir.bs_total_liabilities IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_bs_total_liabilities,
        AVG(CASE WHEN mir.cf_capex IS NOT NULL THEN 1.0 ELSE 0 END) * 100         AS fill_cf_capex,
        AVG(CASE WHEN mir.cf_cash_at_end_of_period IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_cf_cash_at_end_of_period,
        AVG(CASE WHEN mir.cf_operating_cash_flow IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_cf_operating_cash_flow,
        AVG(CASE WHEN mir.flag_equity_negative IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_flag_equity_negative,
        AVG(CASE WHEN mir.flag_total_liabilities_over_assets IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_flag_total_liabilities_over_assets,
        AVG(CASE WHEN mir.flag_net_income_negative IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_flag_net_income_negative,
        AVG(CASE WHEN mir.ratio_accounts_payable_cash IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_accounts_payable_cash,
        AVG(CASE WHEN mir.ratio_total_liabilities_cash IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_total_liabilities_cash,
        AVG(CASE WHEN mir.ratio_total_liabilities_assets IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_total_liabilities_assets,
        AVG(CASE WHEN mir.ratio_return_on_equity IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_return_on_equity,
        AVG(CASE WHEN mir.ratio_return_on_assets IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_return_on_assets,
        AVG(CASE WHEN mir.ratio_net_income_ratio IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_net_income_ratio,
        AVG(CASE WHEN mir.ratio_income_quality_ratio IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_income_quality_ratio,
        AVG(CASE WHEN mir.ratio_gross_margin IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_gross_margin,
        AVG(CASE WHEN mir.ratio_equity_multiplier IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_equity_multiplier,
        AVG(CASE WHEN mir.ratio_debt_to_equity IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_debt_to_equity,
        AVG(CASE WHEN mir.ratio_operating_margin IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_operating_margin,
        AVG(CASE WHEN mir.ratio_cash_ratio IS NOT NULL THEN 1.0 ELSE 0 END) * 100 AS fill_ratio_cash_ratio,
        AVG(CASE WHEN mir.ratio_accounts_recievable_cash IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_ratio_accounts_recievable_cash,
        AVG(CASE WHEN mir.gdp_pch IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_gdp_pch,
        AVG(CASE WHEN mir.gdp_pc1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_gdp_pc1,
        AVG(CASE WHEN mir.t10y2y IS NOT NULL THEN 1.0 ELSE 0 END) * 100           AS fill_t10y2y,
        AVG(CASE WHEN mir.t10y2y_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_t10y2y_chg,
        AVG(CASE WHEN mir.t10y2y_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_t10y2y_ch1,
        AVG(CASE WHEN mir.t10y IS NOT NULL THEN 1.0 ELSE 0 END) * 100             AS fill_t10y,
        AVG(CASE WHEN mir.t10y_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100         AS fill_t10y_chg,
        AVG(CASE WHEN mir.t10y_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100         AS fill_t10y_ch1,
        AVG(CASE WHEN mir.t2y IS NOT NULL THEN 1.0 ELSE 0 END) * 100              AS fill_t2y,
        AVG(CASE WHEN mir.t2y_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_t2y_chg,
        AVG(CASE WHEN mir.t2y_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_t2y_ch1,
        AVG(CASE WHEN mir.brent_pch IS NOT NULL THEN 1.0 ELSE 0 END) * 100        AS fill_brent_pch,
        AVG(CASE WHEN mir.brent_pc1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100        AS fill_brent_pc1,
        AVG(CASE WHEN mir.wtispot_pch IS NOT NULL THEN 1.0 ELSE 0 END) * 100      AS fill_wtispot_pch,
        AVG(CASE WHEN mir.wtispot_pc1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100      AS fill_wtispot_pc1,
        AVG(CASE WHEN mir.vix IS NOT NULL THEN 1.0 ELSE 0 END) * 100              AS fill_vix,
        AVG(CASE WHEN mir.vix_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_vix_chg,
        AVG(CASE WHEN mir.vix_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_vix_ch1,
        AVG(CASE WHEN mir.csentiment IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_csentiment,
        AVG(CASE WHEN mir.csentiment_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100   AS fill_csentiment_chg,
        AVG(CASE WHEN mir.csentiment_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100   AS fill_csentiment_ch1,
        AVG(CASE WHEN mir.dolindx IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_dolindx,
        AVG(CASE WHEN mir.dolindx_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100      AS fill_dolindx_chg,
        AVG(CASE WHEN mir.dolindx_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100      AS fill_dolindx_ch1,
        AVG(CASE WHEN mir.unemp IS NOT NULL THEN 1.0 ELSE 0 END) * 100            AS fill_unemp,
        AVG(CASE WHEN mir.unemp_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100        AS fill_unemp_chg,
        AVG(CASE WHEN mir.unemp_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100        AS fill_unemp_ch1,
        AVG(CASE WHEN mir.cpi IS NOT NULL THEN 1.0 ELSE 0 END) * 100              AS fill_cpi,
        AVG(CASE WHEN mir.cpi_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_cpi_chg,
        AVG(CASE WHEN mir.cpi_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_cpi_ch1,
        AVG(CASE WHEN mir.cpicore IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_cpicore,
        AVG(CASE WHEN mir.cpicore_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100      AS fill_cpicore_chg,
        AVG(CASE WHEN mir.cpicore_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100      AS fill_cpicore_ch1,
        AVG(CASE WHEN mir.ccdelinq IS NOT NULL THEN 1.0 ELSE 0 END) * 100         AS fill_ccdelinq,
        AVG(CASE WHEN mir.ccdelinq_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100     AS fill_ccdelinq_chg,
        AVG(CASE WHEN mir.ccdelinq_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100     AS fill_ccdelinq_ch1,
        AVG(CASE WHEN mir.cloandelinq IS NOT NULL THEN 1.0 ELSE 0 END) * 100      AS fill_cloandelinq,
        AVG(CASE WHEN mir.cloandelinq_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100  AS fill_cloandelinq_chg,
        AVG(CASE WHEN mir.cloandelinq_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100  AS fill_cloandelinq_ch1,
        AVG(CASE WHEN mir.busloandelinq IS NOT NULL THEN 1.0 ELSE 0 END) * 100    AS fill_busloandelinq,
        AVG(CASE WHEN mir.busloandelinq_chg IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_busloandelinq_chg,
        AVG(CASE WHEN mir.busloandelinq_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) *
        100                                                                       AS fill_busloandelinq_ch1,
        AVG(CASE WHEN mir.wagegrowth IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_wagegrowth,
        AVG(CASE WHEN mir.wagegrowth_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100   AS fill_wagegrowth_chg,
        AVG(CASE WHEN mir.usdeur IS NOT NULL THEN 1.0 ELSE 0 END) * 100           AS fill_usdeur,
        AVG(CASE WHEN mir.usdeur_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_usdeur_chg,
        AVG(CASE WHEN mir.usdeur_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_usdeur_ch1,
        AVG(CASE WHEN mir.usdpeso IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_usdpeso,
        AVG(CASE WHEN mir.usdpeso_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100      AS fill_usdpeso_chg,
        AVG(CASE WHEN mir.usdpeso_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100      AS fill_usdpeso_ch1,
        AVG(CASE WHEN mir.usdcan IS NOT NULL THEN 1.0 ELSE 0 END) * 100           AS fill_usdcan,
        AVG(CASE WHEN mir.usdcan_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_usdcan_chg,
        AVG(CASE WHEN mir.usdcan_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100       AS fill_usdcan_ch1,
        AVG(CASE WHEN mir.ppi_chg IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_ppi_chg,
        AVG(CASE WHEN mir.ppi_ch1 IS NOT NULL THEN 1.0 ELSE 0 END) * 100          AS fill_ppi_ch1
    FROM src
    GROUP BY
        score_date
    ORDER BY
        score_date;

    ANALYSE warehouse.worth_score_input_audit;
    GRANT ALL ON TABLE warehouse.worth_score_input_audit TO GROUP worth_ds;

    -- latest row
    OPEN cursor_name FOR SELECT * FROM warehouse.worth_score_input_audit ORDER BY score_date DESC LIMIT 1;

END
$$;
