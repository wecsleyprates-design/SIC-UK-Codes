# Consensus Engine Experiment — Comparison Report

```
══════════════════════════════════════════════════════════════════════════
 ENTITY : Joes Pizza Ltd (GB)
 ID     : biz_joes_pizza_000
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.99      0   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.84      0     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.76     31   ✅  
   equifax            redshift_cache naics_2022    551112   0.72    393   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.58    372     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.66      0   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.78      3   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.66      5     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.72) vs zoominfo(722511, 0.76) → diff=0.040 → WEIGHT_TIEBREAK ▶
│    Step 2: trulioo(5812, 0.66) vs zoominfo(722511, 0.76) → diff=0.100 → INCUMBENT_WINS  
│
│  Output: naics_code             = 722511
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = 5812
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.782    min_staleness_days             = 0
│  max_staleness_days             = 393    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         85.9% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.8%
│   #3   holding_company              naics_2022     551112         4.7%
│   #4   retail_grocery               naics_2022     445110         4.6%
│
│  Overall confidence : 85.8%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.54  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Bella Notte Foods #1 Ltd (GB)
 ID     : biz_joes_pizza_001
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.96      0   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.98      0     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.83     31   ✅  
   equifax            redshift_cache naics_2022    551112   0.61    393   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.59    382     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.62      0   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.82      8   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.57      7     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.61) vs zoominfo(722511, 0.83) → diff=0.220 → INCUMBENT_WINS  
│    Step 2: trulioo(5812, 0.62) vs zoominfo(722511, 0.83) → diff=0.210 → INCUMBENT_WINS  
│
│  Output: naics_code             = 722511
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = 5812
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.768    min_staleness_days             = 0
│  max_staleness_days             = 393    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         85.9% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.8%
│   #3   holding_company              naics_2022     551112         4.7%
│   #4   retail_grocery               naics_2022     445110         4.6%
│
│  Overall confidence : 85.8%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.54  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Bella Notte Foods #2 Ltd (GB)
 ID     : biz_joes_pizza_002
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.91     17   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.98      0     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.69     40   ✅  
   equifax            redshift_cache naics_2022    551112   0.70    366   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.57    389     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.62      0   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.71      0   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.62      0     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.70) vs zoominfo(722511, 0.69) → diff=0.010 → WEIGHT_TIEBREAK ▶
│    Step 2: trulioo(5812, 0.62) vs zoominfo(722511, 0.69) → diff=0.070 → INCUMBENT_WINS  
│
│  Output: naics_code             = 722511
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = 5812
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.726    min_staleness_days             = 0
│  max_staleness_days             = 366    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         86.3% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.7%
│   #3   retail_grocery               naics_2022     445110         4.5%
│   #4   holding_company              naics_2022     551112         4.4%
│
│  Overall confidence : 86.3%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.50  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Bella Notte Foods #3 Ltd (GB)
 ID     : biz_joes_pizza_003
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.98     11   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.97      6     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.69     38   ✅  
   equifax            redshift_cache naics_2022    551112   0.66    369   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.64    366     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.65     16   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.89     13   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.50      0     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.66) vs zoominfo(722511, 0.69) → diff=0.030 → WEIGHT_TIEBREAK ▶
│    Step 2: trulioo(5812, 0.65) vs zoominfo(722511, 0.69) → diff=0.040 → WEIGHT_TIEBREAK ▶
│
│  Output: naics_code             = 5812
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = None
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.774    min_staleness_days             = 11
│  max_staleness_days             = 369    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         85.9% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.8%
│   #3   holding_company              naics_2022     551112         4.7%
│   #4   retail_grocery               naics_2022     445110         4.6%
│
│  Overall confidence : 85.9%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.51  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Bella Notte Foods #4 Ltd (GB)
 ID     : biz_joes_pizza_004
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.85     13   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.92     16     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.75     46   ✅  
   equifax            redshift_cache naics_2022    551112   0.69    394   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.72    392     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.63     13   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.86     14   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.59      0     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.69) vs zoominfo(722511, 0.75) → diff=0.060 → INCUMBENT_WINS  
│    Step 2: trulioo(5812, 0.63) vs zoominfo(722511, 0.75) → diff=0.120 → INCUMBENT_WINS  
│
│  Output: naics_code             = 722511
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = 5812
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.756    min_staleness_days             = 13
│  max_staleness_days             = 394    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         85.8% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.9%
│   #3   holding_company              naics_2022     551112         4.7%
│   #4   retail_grocery               naics_2022     445110         4.6%
│
│  Overall confidence : 85.8%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.54  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Bella Notte Foods #5 Ltd (GB)
 ID     : biz_joes_pizza_005
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.96     16   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.95      0     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.72     52   ✅  
   equifax            redshift_cache naics_2022    551112   0.68    377   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.71    392     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.68      0   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.87      0   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.57     12     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.68) vs zoominfo(722511, 0.72) → diff=0.040 → WEIGHT_TIEBREAK ▶
│    Step 2: trulioo(5812, 0.68) vs zoominfo(722511, 0.72) → diff=0.040 → WEIGHT_TIEBREAK ▶
│
│  Output: naics_code             = 5812
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = None
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.782    min_staleness_days             = 0
│  max_staleness_days             = 377    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         85.9% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.8%
│   #3   holding_company              naics_2022     551112         4.7%
│   #4   retail_grocery               naics_2022     445110         4.6%
│
│  Overall confidence : 85.9%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.52  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Bella Notte Foods #6 Ltd (GB)
 ID     : biz_joes_pizza_006
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.83      0   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.89      0     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.82     57   ✅  
   equifax            redshift_cache naics_2022    551112   0.69    376   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.67    377     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.71     14   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.80     16   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.50     14     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.69) vs zoominfo(722511, 0.82) → diff=0.130 → INCUMBENT_WINS  
│    Step 2: trulioo(5812, 0.71) vs zoominfo(722511, 0.82) → diff=0.110 → INCUMBENT_WINS  
│
│  Output: naics_code             = 722511
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = 5812
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.77    min_staleness_days             = 0
│  max_staleness_days             = 376    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         85.9% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.8%
│   #3   holding_company              naics_2022     551112         4.7%
│   #4   retail_grocery               naics_2022     445110         4.6%
│
│  Overall confidence : 85.9%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.52  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Bella Notte Foods #7 Ltd (GB)
 ID     : biz_joes_pizza_007
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.98      0   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.84      8     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.75     50   ✅  
   equifax            redshift_cache naics_2022    551112   0.70    378   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.67    381     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.62     16   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.81      0   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.50      0     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.70) vs zoominfo(722511, 0.75) → diff=0.050 → INCUMBENT_WINS  
│    Step 2: trulioo(5812, 0.62) vs zoominfo(722511, 0.75) → diff=0.130 → INCUMBENT_WINS  
│
│  Output: naics_code             = 722511
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = 5812
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.772    min_staleness_days             = 0
│  max_staleness_days             = 378    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         85.9% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.8%
│   #3   holding_company              naics_2022     551112         4.7%
│   #4   retail_grocery               naics_2022     445110         4.6%
│
│  Overall confidence : 85.9%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.52  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Bella Notte Foods #8 Ltd (GB)
 ID     : biz_joes_pizza_008
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.90     19   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.94      0     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.78     48   ✅  
   equifax            redshift_cache naics_2022    551112   0.71    388   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.71    381     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.65      1   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.75      8   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.56      0     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.71) vs zoominfo(722511, 0.78) → diff=0.070 → INCUMBENT_WINS  
│    Step 2: trulioo(5812, 0.65) vs zoominfo(722511, 0.78) → diff=0.130 → INCUMBENT_WINS  
│
│  Output: naics_code             = 722511
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = 5812
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.758    min_staleness_days             = 1
│  max_staleness_days             = 388    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         85.9% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.8%
│   #3   holding_company              naics_2022     551112         4.7%
│   #4   retail_grocery               naics_2022     445110         4.6%
│
│  Overall confidence : 85.9%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.53  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Bella Notte Foods #9 Ltd (GB)
 ID     : biz_joes_pizza_009
 ARCH   : A4_restaurant_holding_aml
 TRUTH  : 56101 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   56101    0.95      0   ✅  Primary SIC from Companies House
   opencorporates     api_call       uk_sic_2007   64205    0.93      0     ❌ (discarded)  Secondary SIC from Companies House — DIS
   zoominfo           api_call       naics_2022    722511   0.74     53   ✅  
   equifax            redshift_cache naics_2022    551112   0.57    374   ✅  Equifax public records — stale (380 days
   equifax            redshift_cache naics_2022    722511   0.60    390     ❌ (discarded)  Equifax secnaics1 — DISCARDED by current
   trulioo            api_call       us_sic        5812     0.69      8   ✅  4-digit US SIC for GB entity — POLLUTION
   ai_enrichment      ai_web_scrape  naics_2022    424410   0.75      0   ✅  LLM: web content describes B2B frozen fo
   ai_enrichment      ai_web_scrape  naics_2022    492210   0.60      0     ❌ (discarded)  LLM: web content also describes app-base

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.57) vs zoominfo(722511, 0.74) → diff=0.170 → INCUMBENT_WINS  
│    Step 2: trulioo(5812, 0.69) vs zoominfo(722511, 0.74) → diff=0.050 → INCUMBENT_WINS  
│
│  Output: naics_code             = 722511
│  Output: uk_sic_code            = 56101
│  Output: mcc_code               = 5812
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 3
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 0    oc_secondary_count             = 1    zi_naics_idx                   = 15
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 15    tru_sic_raw_idx                = 36
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.74    min_staleness_days             = 0
│  max_staleness_days             = 374    holding_company_signal         = 1    multi_sector_span              = 4
│  source_agreement_rate          = 0.167    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   food_service_restaurant      uk_sic_2007    56101         86.0% ← top-1
│   #2   it_services                  uk_sic_2007    62020          4.8%
│   #3   holding_company              naics_2022     551112         4.7%
│   #4   retail_grocery               naics_2022     445110         4.6%
│
│  Overall confidence : 86.0%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      HOLDING_COMPANY_DISCREPANCY
│             Score: 0.75  |  AML Multiplier: 3.1×
│             Triggers: equifax, opencorporates
│  🟡 MEDIUM    SECTOR_PIVOT_UNCONFIRMED
│             Score: 0.51  |  AML Multiplier: 1.8×
│             Triggers: equifax
│  🟡 MEDIUM    MULTI_SECTOR_SPAN_ANOMALY
│             Score: 0.80  |  AML Multiplier: 1.5×
│             Triggers: opencorporates, zoominfo, equifax, trulioo, ai_enrichment
│  🔴 CRITICAL  AML_ENHANCED_DUE_DILIGENCE_TRIGGERED
│             Score: 0.76  |  AML Multiplier: 7.6×
│             Triggers: trulioo, opencorporates, ai_enrichment, zoominfo, equifax
│
│  Combined AML multiplier     : 7.6×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : uk_sic_2007/56101
│  Recommended label           : Licensed restaurants and cafes
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ✅
    AML flags: current=0  consensus=4
    Signals discarded (current): 5
    All signals used (consensus): ✅ — all 8 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #1 Ltd (GB)
 ID     : biz_shell_holding_000
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.92      0   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.89     10     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.74      0   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.82     69   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.59      0   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.50      0   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.82) vs zoominfo(812990, 0.74) → diff=0.080 → CHALLENGER_WINS ▶
│    Step 2: trulioo(6719, 0.59) vs equifax(551112, 0.82) → diff=0.230 → INCUMBENT_WINS  
│
│  Output: naics_code             = 551112
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = 6159
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.714    min_staleness_days             = 0
│  max_staleness_days             = 69    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.6% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         15.5%
│   #3   it_services                  uk_sic_2007    62020          7.1%
│   #4   retail_grocery               naics_2022     445110         6.7%
│
│  Overall confidence : 70.6%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #2 Ltd (GB)
 ID     : biz_shell_holding_001
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.85      5   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.91     14     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.65      8   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.83     63   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.58     11   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.55      0   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.83) vs zoominfo(812990, 0.65) → diff=0.180 → CHALLENGER_WINS ▶
│    Step 2: trulioo(6719, 0.58) vs equifax(551112, 0.83) → diff=0.250 → INCUMBENT_WINS  
│
│  Output: naics_code             = 551112
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = 6159
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.692    min_staleness_days             = 0
│  max_staleness_days             = 63    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.7% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         15.5%
│   #3   it_services                  uk_sic_2007    62020          7.1%
│   #4   retail_grocery               naics_2022     445110         6.7%
│
│  Overall confidence : 70.7%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #3 Ltd (GB)
 ID     : biz_shell_holding_002
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.95     17   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.93      0     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.76      2   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.72     75   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.66      3   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.45      0   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.72) vs zoominfo(812990, 0.76) → diff=0.040 → WEIGHT_TIEBREAK ▶
│    Step 2: trulioo(6719, 0.66) vs zoominfo(812990, 0.76) → diff=0.100 → INCUMBENT_WINS  
│
│  Output: naics_code             = 812990
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = None
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.708    min_staleness_days             = 0
│  max_staleness_days             = 75    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.3% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         15.5%
│   #3   it_services                  uk_sic_2007    62020          7.4%
│   #4   retail_grocery               naics_2022     445110         6.8%
│
│  Overall confidence : 70.3%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #4 Ltd (GB)
 ID     : biz_shell_holding_003
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.88     15   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.88      6     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.80     14   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.74     69   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.69      8   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.67     14   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.74) vs zoominfo(812990, 0.80) → diff=0.060 → INCUMBENT_WINS  
│    Step 2: trulioo(6719, 0.69) vs zoominfo(812990, 0.80) → diff=0.110 → INCUMBENT_WINS  
│
│  Output: naics_code             = 812990
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = None
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.756    min_staleness_days             = 8
│  max_staleness_days             = 69    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.9% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         14.8%
│   #3   it_services                  uk_sic_2007    62020          7.4%
│   #4   retail_grocery               naics_2022     445110         6.9%
│
│  Overall confidence : 70.9%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #5 Ltd (GB)
 ID     : biz_shell_holding_004
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.95     13   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.95      4     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.68      2   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.82     53   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.67      5   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.58      0   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.82) vs zoominfo(812990, 0.68) → diff=0.140 → CHALLENGER_WINS ▶
│    Step 2: trulioo(6719, 0.67) vs equifax(551112, 0.82) → diff=0.150 → INCUMBENT_WINS  
│
│  Output: naics_code             = 551112
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = 6159
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.74    min_staleness_days             = 0
│  max_staleness_days             = 53    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.5% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         15.6%
│   #3   it_services                  uk_sic_2007    62020          7.1%
│   #4   retail_grocery               naics_2022     445110         6.8%
│
│  Overall confidence : 70.5%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #6 Ltd (GB)
 ID     : biz_shell_holding_005
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.92      0   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.85      0     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.78      0   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.71     52   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.61      0   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.64      0   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.71) vs zoominfo(812990, 0.78) → diff=0.070 → INCUMBENT_WINS  
│    Step 2: trulioo(6719, 0.61) vs zoominfo(812990, 0.78) → diff=0.170 → INCUMBENT_WINS  
│
│  Output: naics_code             = 812990
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = None
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.732    min_staleness_days             = 0
│  max_staleness_days             = 52    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.5% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         15.6%
│   #3   it_services                  uk_sic_2007    62020          7.1%
│   #4   retail_grocery               naics_2022     445110         6.8%
│
│  Overall confidence : 70.5%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #7 Ltd (GB)
 ID     : biz_shell_holding_006
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.90      3   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.82     16     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.71     23   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.81     75   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.66     16   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.69      4   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.81) vs zoominfo(812990, 0.71) → diff=0.100 → CHALLENGER_WINS ▶
│    Step 2: trulioo(6719, 0.66) vs equifax(551112, 0.81) → diff=0.150 → INCUMBENT_WINS  
│
│  Output: naics_code             = 551112
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = 6159
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.754    min_staleness_days             = 3
│  max_staleness_days             = 75    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.5% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         14.9%
│   #3   it_services                  uk_sic_2007    62020          7.7%
│   #4   retail_grocery               naics_2022     445110         6.9%
│
│  Overall confidence : 70.5%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #8 Ltd (GB)
 ID     : biz_shell_holding_007
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.96      0   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.93     17     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.78     21   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.76     68   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.67     14   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.61      0   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.76) vs zoominfo(812990, 0.78) → diff=0.020 → WEIGHT_TIEBREAK ▶
│    Step 2: trulioo(6719, 0.67) vs zoominfo(812990, 0.78) → diff=0.110 → INCUMBENT_WINS  
│
│  Output: naics_code             = 812990
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = None
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.756    min_staleness_days             = 0
│  max_staleness_days             = 68    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.9% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         14.8%
│   #3   it_services                  uk_sic_2007    62020          7.4%
│   #4   retail_grocery               naics_2022     445110         6.9%
│
│  Overall confidence : 70.9%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #9 Ltd (GB)
 ID     : biz_shell_holding_008
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.88      0   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.87     11     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.75      7   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.81     71   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.62      0   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.72      3   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.81) vs zoominfo(812990, 0.75) → diff=0.060 → CHALLENGER_WINS ▶
│    Step 2: trulioo(6719, 0.62) vs equifax(551112, 0.81) → diff=0.190 → INCUMBENT_WINS  
│
│  Output: naics_code             = 551112
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = 6159
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.756    min_staleness_days             = 0
│  max_staleness_days             = 71    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.8% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         14.9%
│   #3   it_services                  uk_sic_2007    62020          7.5%
│   #4   retail_grocery               naics_2022     445110         6.9%
│
│  Overall confidence : 70.8%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector


══════════════════════════════════════════════════════════════════════════
 ENTITY : Meridian Capital Holdings #10 Ltd (GB)
 ID     : biz_shell_holding_009
 ARCH   : A5_shell_holding_company
 TRUTH  : 64205 (uk_sic_2007)
──────────────────────────────────────────────────────────────────────────
 INPUTS — Source Signals Received (API calls + Redshift + AI):
   Source             Channel        Taxonomy      Code     Conf  Staled  Primary  Notes
   ───────────────── ───────────── ──────────── ────── ─────  ─────   ───────  ──────────────────────────────
   opencorporates     api_call       uk_sic_2007   64205    0.90     11   ✅  Companies House: holding company registr
   opencorporates     api_call       uk_sic_2007   47910    0.81     10     ❌ (discarded)  Secondary SIC: retail — DISCARDED by cur
   zoominfo           api_call       naics_2022    812990   0.71     22   ✅  ZoomInfo shows personal services — likel
   equifax            redshift_cache naics_2022    551112   0.76     46   ✅  Equifax confirms holding company classif
   trulioo            api_call       us_sic        6719     0.59      0   ✅  Trulioo: US SIC 6719 (Holding Companies)
   ai_enrichment      ai_web_scrape  naics_2022    812990   0.49      0   ✅  LLM: consumer-facing retail website foun

┌─ CURRENT PIPELINE (factWithHighestConfidence) ─────────────────────────┐
│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)
│  Candidates: 3 primary sources entered reduce()
│    Step 1: equifax(551112, 0.76) vs zoominfo(812990, 0.71) → diff=0.050 → CHALLENGER_WINS ▶
│    Step 2: trulioo(6719, 0.59) vs equifax(551112, 0.76) → diff=0.170 → INCUMBENT_WINS  
│
│  Output: naics_code             = 551112
│  Output: uk_sic_code            = 64205
│  Output: mcc_code               = 6159
│
│  Discarded signals              : 2
│  Secondary codes discarded      : 1
│  Trulioo pollution detected     : ⚠️   FLAGGED: ❌ (never flagged)
│  Holding company in discards    : ⚠️ 
│  AI enrichment suppressed       : ⚠️ 
│  Equifax secondary extracted    : ❌ (secnaics1 always skipped)
│  AML flags generated            : 0  ← always 0
│  Requires manual review         : ❌  (no flag mechanism)
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL INPUT (15-Feature Vector) ──────────────────────────────┐
│  oc_uk_sic_primary_idx          = 8    oc_secondary_count             = 1    zi_naics_idx                   = 33
│  efx_naics_primary_idx          = 29    efx_naics_secondary_idx        = 44    tru_sic_raw_idx                = 39
│  trulioo_pollution_flag         = 1    avg_confidence                 = 0.69    min_staleness_days             = 0
│  max_staleness_days             = 46    holding_company_signal         = 1    multi_sector_span              = 2
│  source_agreement_rate          = 0.333    entity_is_gb                   = 1    n_sources                      = 5
└─────────────────────────────────────────────────────────────────────────┘

┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) ────────────────┐
│  Rank Class Label                  Taxonomy       Code     Probability
│  ──── ─────────────────────────── ───────────── ─────── ───────────
│   #1   holding_company              naics_2022     551112        70.5% ← top-1
│   #2   food_service_restaurant      uk_sic_2007    56101         15.7%
│   #3   it_services                  uk_sic_2007    62020          7.1%
│   #4   retail_grocery               naics_2022     445110         6.7%
│
│  Overall confidence : 70.5%
│  Model version      : consensus-engine-v0.1-demo
└─────────────────────────────────────────────────────────────────────────┘

┌─ CONSENSUS ENGINE — Risk Flags & AML Signals ─────────────────────────┐
│  🟢 LOW       TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY
│             Score: 1.00  |  AML Multiplier: 1.2×
│             Triggers: trulioo
│  🟠 HIGH      SECTOR_CONFLICT_REGISTRY_VS_WEB
│             Score: 0.67  |  AML Multiplier: 2.5×
│             Triggers: zoominfo, equifax, ai_enrichment, opencorporates
│
│  Combined AML multiplier     : 3.7×
│  Requires manual review      : YES — BLOCKED
│  Recommended code            : naics_2022/551112
│  Recommended label           : Offices of Other Holding Companies
└─────────────────────────────────────────────────────────────────────────┘

  Δ COMPARISON SUMMARY
    Current code correct       : ✅
    Consensus code correct     : ❌
    AML flags: current=0  consensus=2
    Signals discarded (current): 3
    All signals used (consensus): ✅ — all 6 signals fed into feature vector



========================================================================================================================
AGGREGATE COMPARISON TABLE — ALL 60 ENTITIES
========================================================================================================================
Business ID                         Country Arch  [CURRENT] naics_code   uk_sic   AML Flags  [CONSENSUS] Top-1 Code   Prob  Flags  AML Mult Review? 
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
biz_us_restaurant_000               US      A1_   722511                 None     0          56101                  80.7%      0       0.0  no      
biz_us_restaurant_001               US      A1_   722511                 None     0          56101                  80.7%      0       0.0  no      
biz_us_restaurant_002               US      A1_   722511                 None     0          56101                  80.8%      0       0.0  no      
biz_us_restaurant_003               US      A1_   722511                 None     0          56101                  80.9%      0       0.0  no      
biz_us_restaurant_004               US      A1_   722511                 None     0          56101                  80.7%      0       0.0  no      
biz_us_restaurant_005               US      A1_   722511                 None     0          56101                  80.7%      0       0.0  no      
biz_us_restaurant_006               US      A1_   722511                 None     0          56101                  80.9%      0       0.0  no      
biz_us_restaurant_007               US      A1_   722511                 None     0          56101                  80.9%      0       0.0  no      
biz_us_restaurant_008               US      A1_   722511                 None     0          56101                  80.8%      0       0.0  no      
biz_us_restaurant_009               US      A1_   722511                 None     0          56101                  80.9%      0       0.0  no      
biz_uk_restaurant_clean_000         GB      A2_   722511                 56101    0          56101                  87.6%      1       1.2  no      
biz_uk_restaurant_clean_001         GB      A2_   722511                 56101    0          56101                  87.6%      1       1.2  no      
biz_uk_restaurant_clean_002         GB      A2_   722511                 56101    0          56101                  87.5%      1       1.2  no      
biz_uk_restaurant_clean_003         GB      A2_   722511                 56101    0          56101                  87.6%      1       1.2  no      
biz_uk_restaurant_clean_004         GB      A2_   722511                 56101    0          56101                  87.5%      1       1.2  no      
biz_uk_restaurant_clean_005         GB      A2_   722511                 56101    0          56101                  87.6%      1       1.2  no      
biz_uk_restaurant_clean_006         GB      A2_   722511                 56101    0          56101                  87.6%      1       1.2  no      
biz_uk_restaurant_clean_007         GB      A2_   722511                 56101    0          56101                  87.6%      1       1.2  no      
biz_uk_restaurant_clean_008         GB      A2_   5812                   56101    0          56101                  87.6%      1       1.2  no      
biz_uk_restaurant_clean_009         GB      A2_   722511                 56101    0          56101                  87.6%      1       1.2  no      
biz_uk_trulioo_pollution_000        GB      A3_   5411                   47110    0          445110                 78.9%      1       1.2  no      
biz_uk_trulioo_pollution_001        GB      A3_   445110                 47110    0          445110                 79.4%      1       1.2  no      
biz_uk_trulioo_pollution_002        GB      A3_   445110                 47110    0          445110                 79.2%      1       1.2  no      
biz_uk_trulioo_pollution_003        GB      A3_   445110                 47110    0          445110                 79.4%      1       1.2  no      
biz_uk_trulioo_pollution_004        GB      A3_   445110                 47110    0          445110                 79.0%      1       1.2  no      
biz_uk_trulioo_pollution_005        GB      A3_   5411                   47110    0          445110                 79.4%      1       1.2  no      
biz_uk_trulioo_pollution_006        GB      A3_   445110                 47110    0          445110                 78.8%      1       1.2  no      
biz_uk_trulioo_pollution_007        GB      A3_   445110                 47110    0          445110                 79.0%      1       1.2  no      
biz_uk_trulioo_pollution_008        GB      A3_   445110                 47110    0          445110                 79.6%      1       1.2  no      
biz_uk_trulioo_pollution_009        GB      A3_   445110                 47110    0          445110                 79.7%      1       1.2  no      
biz_joes_pizza_000                  GB      A4_   722511                 56101    0          56101                  85.9%      4       7.6  YES     
biz_joes_pizza_001                  GB      A4_   722511                 56101    0          56101                  85.9%      4       7.6  YES     
biz_joes_pizza_002                  GB      A4_   722511                 56101    0          56101                  86.3%      4       7.6  YES     
biz_joes_pizza_003                  GB      A4_   5812                   56101    0          56101                  85.9%      4       7.6  YES     
biz_joes_pizza_004                  GB      A4_   722511                 56101    0          56101                  85.8%      4       7.6  YES     
biz_joes_pizza_005                  GB      A4_   5812                   56101    0          56101                  85.9%      4       7.6  YES     
biz_joes_pizza_006                  GB      A4_   722511                 56101    0          56101                  85.9%      4       7.6  YES     
biz_joes_pizza_007                  GB      A4_   722511                 56101    0          56101                  85.9%      4       7.6  YES     
biz_joes_pizza_008                  GB      A4_   722511                 56101    0          56101                  85.9%      4       7.6  YES     
biz_joes_pizza_009                  GB      A4_   722511                 56101    0          56101                  86.0%      4       7.6  YES     
biz_shell_holding_000               GB      A5_   551112                 64205    0          551112                 70.6%      2       3.7  YES     
biz_shell_holding_001               GB      A5_   551112                 64205    0          551112                 70.7%      2       3.7  YES     
biz_shell_holding_002               GB      A5_   812990                 64205    0          551112                 70.3%      2       3.7  YES     
biz_shell_holding_003               GB      A5_   812990                 64205    0          551112                 70.9%      2       3.7  YES     
biz_shell_holding_004               GB      A5_   551112                 64205    0          551112                 70.5%      2       3.7  YES     
biz_shell_holding_005               GB      A5_   812990                 64205    0          551112                 70.5%      2       3.7  YES     
biz_shell_holding_006               GB      A5_   551112                 64205    0          551112                 70.5%      2       3.7  YES     
biz_shell_holding_007               GB      A5_   812990                 64205    0          551112                 70.9%      2       3.7  YES     
biz_shell_holding_008               GB      A5_   551112                 64205    0          551112                 70.8%      2       3.7  YES     
biz_shell_holding_009               GB      A5_   551112                 64205    0          551112                 70.5%      2       3.7  YES     
biz_sector_pivot_000                GB      A6_   7372                   62020    0          62020                  66.9%      2       3.0  no      
biz_sector_pivot_001                GB      A6_   541512                 62020    0          62020                  79.7%      2       3.0  no      
biz_sector_pivot_002                GB      A6_   7372                   62020    0          62020                  80.9%      2       3.0  no      
biz_sector_pivot_003                GB      A6_   7372                   62020    0          62020                  80.9%      2       3.0  no      
biz_sector_pivot_004                GB      A6_   541512                 62020    0          62020                  80.9%      2       3.0  no      
biz_sector_pivot_005                GB      A6_   7372                   62020    0          62020                  80.9%      2       3.0  no      
biz_sector_pivot_006                GB      A6_   541512                 62020    0          62020                  80.9%      2       3.0  no      
biz_sector_pivot_007                GB      A6_   7372                   62020    0          62020                  79.7%      2       3.0  no      
biz_sector_pivot_008                GB      A6_   7372                   62020    0          62020                  80.1%      2       3.0  no      
biz_sector_pivot_009                GB      A6_   541512                 62020    0          62020                  80.9%      2       3.0  no      
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

ARCHETYPE SUMMARY
──────────────────────────────────────────────────────────────────────────────────────────
Archetype                                  N   Cur Correct   Con Correct    Avg AML Mult   Reviews
──────────────────────────────────────────────────────────────────────────────────────────
A1_stable_us_restaurant                   10     10/10          0/10                 0.0         0
A2_uk_restaurant_clean                    10     10/10         10/10                 1.2         0
A3_trulioo_pollution                      10     10/10          0/10                 1.2         0
A4_restaurant_holding_aml                 10     10/10         10/10                 7.6        10
A5_shell_holding_company                  10     10/10          0/10                 3.7        10
A6_sector_pivot_tech                      10     10/10         10/10                 3.0         0
──────────────────────────────────────────────────────────────────────────────────────────
TOTAL                                     60     60/60         30/60                 2.8        20

  Current pipeline  — total AML flags generated : 0
  Consensus engine  — total risk flags (non-meta): 100
  Current pipeline  — entities blocked for review : 0
  Consensus engine  — entities blocked for review : 20
========================================================================================================================
```
