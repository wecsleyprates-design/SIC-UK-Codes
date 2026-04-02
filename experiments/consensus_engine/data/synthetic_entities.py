"""
Synthetic Entity Dataset Generator
===================================
Simulates how Worth AI receives industry classification data from multiple sources:

DATA FLOW SIMULATED:
  1. Integration-Service triggers a business match request (API call in)
  2. FactEngine fans out to vendor APIs:
     - OpenCorporates API → Companies House registry data (GB entities)
     - ZoomInfo API       → Firmographic enrichment
     - Equifax API        → Bureau data (public records + NAICS)
     - Trulioo API        → KYB verification (may have US SIC pollution for GB)
  3. AI Enrichment task → LLM web scrape + NAICS inference
  4. Warehouse/Redshift → Cached prior fact values + staleness metadata

Each SourceSignal row represents one vendor API response for one fact type.
The EntityInput aggregates all signals for a single business entity.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Constants & Reference Lists
# ---------------------------------------------------------------------------

ALL_JURISDICTIONS = [
    "us_mo", "do", "us_co", "li", "us_nd", "us_va", "us_sd", "ae_az", "us_vt", "th", "us_ks", "gg", "ro", "aw", "re", "za", "us_mt", "us_ct", "hr", "us_sc", "pr", "us_ma", "is", "cy", "je", "tj", "mm", "se", "in", "bz", "my", "ca_nu", "gr", "us_ut", "no", "us_il", "pl", "us_ny", "hk", "ca_ns", "gl", "us_nv", "gb", "us_oh", "ca_pe", "us_ar", "us_ri", "ua", "us_wi", "mt", "us_ak", "ch", "ug", "vu", "md", "us_wy", "us_nc", "tn", "us_ca", "us_de", "gp", "us_mi", "to", "us_dc", "cw", "al", "au", "us_wa", "lv", "ca", "us_nm", "us_ky", "dk", "ir", "ca_qc", "ca_bc", "mu", "us_tx", "us_ne", "mx", "bb", "lu", "us_az", "me", "us_pa", "rw", "us_al", "us_nj", "bo", "us_mn", "us_id", "us_la", "nl", "us_nh", "us_or", "es", "pm", "gi", "ie", "tz"
]


# ---------------------------------------------------------------------------
# Core data structures (mirrors integration-service fact store schema)
# ---------------------------------------------------------------------------

@dataclass
class SourceSignal:
    """
    One vendor response for one industry classification fact.
    Mirrors the raw data stored in the fact store before any rule is applied.

    Redshift table equivalent:
        integration.fact_signals (business_id, source, taxonomy, raw_code,
                                   confidence, static_weight, retrieved_at_days_ago,
                                   is_primary_code, notes)
    """
    source: str                   # "opencorporates" | "zoominfo" | "equifax" | "trulioo" | "ai_enrichment"
    data_channel: str             # "api_call" | "redshift_cache" | "ai_web_scrape" | "webhook"
    taxonomy: str                 # "uk_sic_2007" | "naics_2022" | "us_sic" | "mcc"
    raw_code: str                 # Exact code as returned by vendor
    raw_label: str                # Human-readable label from vendor
    confidence: float             # Vendor's own match confidence [0.0, 1.0]
    static_weight: float          # From sources.ts (hardcoded constant, context-blind)
    retrieved_days_ago: int       # Staleness: how many days since this was fetched
    is_primary_code: bool = True  # False for secondary SIC codes (currently discarded)
    notes: str = ""               # e.g. "4-digit US SIC for GB entity"


@dataclass
class EntityInput:
    """
    All vendor signals for a single business entity, as they arrive
    at the FactEngine after all API calls + Redshift reads complete.
    """
    business_id: str
    entity_name: str
    entity_country: str           # ISO 3166-1 alpha-2
    entity_age_years: float
    revenue_band: str             # "<1M" | "1M-10M" | "10M-100M" | ">100M"
    has_group_structure: bool     # Known subsidiary or parent entity
    sources: list[SourceSignal]
    ground_truth_code: str        # Label for training (from CH filing / underwriter override)
    ground_truth_taxonomy: str    # "uk_sic_2007" | "naics_2022"
    archetype: str                # For experiment reporting
    archetype_description: str


# ---------------------------------------------------------------------------
# Code reference libraries (realistic codes + labels)
# ---------------------------------------------------------------------------
UK_SIC_LABELS = {
    "56101": "Licensed restaurants and cafes",
    "56102": "Unlicensed restaurants and cafes",
    "56103": "Take-away food shops and mobile food stands",
    "56210": "Event catering activities",
    "46390": "Non-specialised wholesale of food, beverages and tobacco",
    "10710": "Manufacture of bread; manufacture of fresh pastry goods and cakes",
    "47110": "Retail sale in non-specialised stores with food, beverages or tobacco predominating",
    "62020": "Information technology consultancy activities",
    "62090": "Other information technology and computer service activities",
    "64205": "Activities of financial holding companies",
    "64209": "Other activities of holding companies n.e.c.",
    "68209": "Other letting and operating of own or leased real estate",
    "70229": "Management consultancy activities other than financial management",
    "74909": "Other professional, scientific and technical activities n.e.c.",
    "82990": "Other business support service activities n.e.c.",
    "53202": "Other postal and courier activities",
    "49410": "Freight transport by road",
    "47910": "Retail sale via mail order houses or via Internet",
}

NAICS_LABELS = {
    "722511": "Full-Service Restaurants",
    "722513": "Limited-Service Restaurants",
    "722514": "Cafeterias, Grill Buffets, and Buffets",
    "722515": "Snack and Nonalcoholic Beverage Bars",
    "722310": "Food Service Contractors",
    "424410": "General Line Grocery Merchant Wholesalers",
    "424480": "Fresh Fruit and Vegetable Merchant Wholesalers",
    "311991": "Perishable Prepared Food Manufacturing",
    "445291": "Baked Goods Stores",
    "492210": "Local Messengers and Local Delivery",
    "484110": "General Freight Trucking, Local",
    "541512": "Computer Systems Design Services",
    "541511": "Custom Computer Programming Services",
    "541519": "Other Computer Related Services",
    "551112": "Offices of Other Holding Companies",
    "551114": "Corporate, Subsidiary, and Regional Managing Offices",
    "531120": "Lessors of Nonresidential Buildings",
    "531110": "Lessors of Residential Buildings and Dwellings",
    "812990": "All Other Personal Services",
    "561499": "All Other Business Support Services",   # AI fallback (current NAICS_OF_LAST_RESORT)
}

US_SIC_LABELS = {
    "5812": "Eating Places",
    "5411": "Grocery Stores",
    "7372": "Prepackaged Software",
    "6719": "Offices of Holding Companies, NEC",
    "6552": "Land Subdividers and Developers (No Cemeteries)",
}

MCC_LABELS = {
    "5812": "Eating Places, Restaurants",
    "5411": "Grocery Stores, Supermarkets",
    "7372": "Computer Programming, Data Processing",
    "4215": "Courier Services - Air or Ground",
    "5999": "Miscellaneous and Specialty Retail Stores",
}


# ---------------------------------------------------------------------------
# Crosswalk table (probabilistic NAICS ↔ UK SIC)
# Used by current pipeline to resolve naics_code from uk_sic_code path
# ---------------------------------------------------------------------------
CROSSWALK_UK_SIC_TO_NAICS: dict[str, dict[str, float]] = {
    "56101": {"722511": 0.88, "722513": 0.09, "722515": 0.03},
    "56102": {"722513": 0.79, "722514": 0.15, "722515": 0.06},
    "56103": {"722513": 0.65, "722515": 0.25, "722514": 0.10},
    "46390": {"424410": 0.74, "424480": 0.18, "424490": 0.08},
    "10710": {"311991": 0.71, "445291": 0.21, "311813": 0.08},
    "62090": {"541519": 0.68, "541512": 0.22, "541511": 0.10},
    "62020": {"541512": 0.81, "541519": 0.12, "541511": 0.07},
    "64205": {"551112": 0.71, "551114": 0.22, "523999": 0.07},
    "64209": {"551114": 0.60, "551112": 0.30, "523999": 0.10},
    "68209": {"531120": 0.82, "531110": 0.12, "531190": 0.06},
    "47110": {"445110": 0.64, "452319": 0.22, "445291": 0.14},
    "53202": {"492210": 0.78, "484110": 0.14, "492110": 0.08},
    "82990": {"561499": 0.70, "812990": 0.20, "561110": 0.10},
}

CROSSWALK_US_SIC_TO_NAICS: dict[str, dict[str, float]] = {
    "5812": {"722511": 0.41, "722513": 0.31, "722514": 0.19, "445291": 0.09},
    "5411": {"445110": 0.72, "445291": 0.20, "452319": 0.08},
    "7372": {"511210": 0.62, "541511": 0.25, "541519": 0.13},
    "6719": {"551112": 0.78, "551114": 0.15, "523999": 0.07},
}


# ---------------------------------------------------------------------------
# Entity generator — 6 archetypes × 10 entities = 60 total
# ---------------------------------------------------------------------------

random.seed(42)


def _jitter(base: float, spread: float = 0.08) -> float:
    return round(max(0.1, min(0.99, base + random.uniform(-spread, spread))), 2)


def _days(base: int, spread: int = 15) -> int:
    return max(0, base + random.randint(-spread, spread))


def generate_dataset() -> list[EntityInput]:
    entities: list[EntityInput] = []

    # ------------------------------------------------------------------
    # ARCHETYPE 1: Stable US restaurant — all sources agree, clean data
    # ------------------------------------------------------------------
    for i in range(10):
        entities.append(EntityInput(
            business_id=f"biz_us_restaurant_{i:03d}",
            entity_name=f"Mario's Kitchen #{i + 1}",
            entity_country="US",
            entity_age_years=round(random.uniform(3, 15), 1),
            revenue_band=random.choice(["<1M", "1M-10M"]),
            has_group_structure=False,
            ground_truth_code="722511",
            ground_truth_taxonomy="naics_2022",
            archetype="A1_stable_us_restaurant",
            archetype_description="Stable US restaurant — all sources agree. Current pipeline works correctly.",
            sources=[
                SourceSignal(
                    source="zoominfo", data_channel="api_call",
                    taxonomy="naics_2022", raw_code="722511",
                    raw_label=NAICS_LABELS["722511"],
                    confidence=_jitter(0.79), static_weight=0.8,
                    retrieved_days_ago=_days(7),
                ),
                SourceSignal(
                    source="equifax", data_channel="redshift_cache",
                    taxonomy="naics_2022", raw_code="722511",
                    raw_label=NAICS_LABELS["722511"],
                    confidence=_jitter(0.72), static_weight=0.7,
                    retrieved_days_ago=_days(45),
                ),
                SourceSignal(
                    source="trulioo", data_channel="api_call",
                    taxonomy="us_sic", raw_code="5812",
                    raw_label=US_SIC_LABELS["5812"],
                    confidence=_jitter(0.68), static_weight=0.8,
                    retrieved_days_ago=_days(3),
                    notes="US SIC — crosswalks to NAICS 722511",
                ),
                SourceSignal(
                    source="ai_enrichment", data_channel="ai_web_scrape",
                    taxonomy="naics_2022", raw_code="722511",
                    raw_label=NAICS_LABELS["722511"],
                    confidence=_jitter(0.62, 0.12), static_weight=0.1,
                    retrieved_days_ago=_days(1),
                    notes="LLM web scrape confirms restaurant",
                ),
            ],
        ))

    # ------------------------------------------------------------------
    # ARCHETYPE 2: UK restaurant — clean, Companies House matches web
    # ------------------------------------------------------------------
    for i in range(10):
        entities.append(EntityInput(
            business_id=f"biz_uk_restaurant_clean_{i:03d}",
            entity_name=f"The Ploughman's Arms #{i + 1} Ltd",
            entity_country="GB",
            entity_age_years=round(random.uniform(2, 20), 1),
            revenue_band=random.choice(["<1M", "1M-10M"]),
            has_group_structure=False,
            ground_truth_code="56101",
            ground_truth_taxonomy="uk_sic_2007",
            archetype="A2_uk_restaurant_clean",
            archetype_description="UK restaurant — clean data, Companies House confirms. Current pipeline mostly works.",
            sources=[
                SourceSignal(
                    source="opencorporates", data_channel="api_call",
                    taxonomy="uk_sic_2007", raw_code="56101",
                    raw_label=UK_SIC_LABELS["56101"],
                    confidence=_jitter(0.92), static_weight=0.9,
                    retrieved_days_ago=_days(2),
                    notes="Companies House ground truth via OpenCorporates API",
                ),
                SourceSignal(
                    source="zoominfo", data_channel="api_call",
                    taxonomy="naics_2022", raw_code="722511",
                    raw_label=NAICS_LABELS["722511"],
                    confidence=_jitter(0.74), static_weight=0.8,
                    retrieved_days_ago=_days(14),
                ),
                SourceSignal(
                    source="equifax", data_channel="redshift_cache",
                    taxonomy="naics_2022", raw_code="722511",
                    raw_label=NAICS_LABELS["722511"],
                    confidence=_jitter(0.66), static_weight=0.7,
                    retrieved_days_ago=_days(30),
                ),
                SourceSignal(
                    source="trulioo", data_channel="api_call",
                    taxonomy="us_sic", raw_code="5812",
                    raw_label=US_SIC_LABELS["5812"],
                    confidence=_jitter(0.65), static_weight=0.8,
                    retrieved_days_ago=_days(2),
                    notes="4-digit US SIC for GB entity — POLLUTION (undetected by current pipeline)",
                ),
                SourceSignal(
                    source="ai_enrichment", data_channel="ai_web_scrape",
                    taxonomy="naics_2022", raw_code="722511",
                    raw_label=NAICS_LABELS["722511"],
                    confidence=_jitter(0.70, 0.12), static_weight=0.1,
                    retrieved_days_ago=_days(1),
                ),
            ],
        ))

    # ------------------------------------------------------------------
    # ARCHETYPE 3: UK entity with Trulioo pollution — US SIC for GB entity
    # ------------------------------------------------------------------
    for i in range(10):
        entities.append(EntityInput(
            business_id=f"biz_uk_trulioo_pollution_{i:03d}",
            entity_name=f"Singh & Sons Retailers #{i + 1} Ltd",
            entity_country="GB",
            entity_age_years=round(random.uniform(5, 25), 1),
            revenue_band=random.choice(["1M-10M", "10M-100M"]),
            has_group_structure=False,
            ground_truth_code="47110",
            ground_truth_taxonomy="uk_sic_2007",
            archetype="A3_trulioo_pollution",
            archetype_description="UK grocery retail — Trulioo sends US SIC 5411 instead of UK SIC. Current pipeline passes it through unchallenged.",
            sources=[
                SourceSignal(
                    source="opencorporates", data_channel="api_call",
                    taxonomy="uk_sic_2007", raw_code="47110",
                    raw_label=UK_SIC_LABELS["47110"],
                    confidence=_jitter(0.88), static_weight=0.9,
                    retrieved_days_ago=_days(3),
                    notes="Companies House ground truth",
                ),
                SourceSignal(
                    source="trulioo", data_channel="api_call",
                    taxonomy="us_sic", raw_code="5411",
                    raw_label=US_SIC_LABELS["5411"],
                    confidence=_jitter(0.71), static_weight=0.8,
                    retrieved_days_ago=_days(2),
                    notes="4-digit US SIC 5411 (Grocery Stores) for GB entity — POLLUTION",
                ),
                SourceSignal(
                    source="zoominfo", data_channel="api_call",
                    taxonomy="naics_2022", raw_code="445110",
                    raw_label="Supermarkets and Other Grocery Retailers",
                    confidence=_jitter(0.69), static_weight=0.8,
                    retrieved_days_ago=_days(20),
                ),
                SourceSignal(
                    source="ai_enrichment", data_channel="ai_web_scrape",
                    taxonomy="naics_2022", raw_code="445110",
                    raw_label="Supermarkets and Other Grocery Retailers",
                    confidence=_jitter(0.75, 0.12), static_weight=0.1,
                    retrieved_days_ago=_days(1),
                ),
            ],
        ))

    # ------------------------------------------------------------------
    # ARCHETYPE 4: Joe's Pizza — AML core pattern (restaurant + holding company)
    # ------------------------------------------------------------------
    for i in range(10):
        entities.append(EntityInput(
            business_id=f"biz_joes_pizza_{i:03d}",
            entity_name=f"{'Joes Pizza' if i == 0 else f'Bella Notte Foods #{i}'} Ltd",
            entity_country="GB",
            entity_age_years=round(random.uniform(2, 8), 1),
            revenue_band=random.choice(["<1M", "1M-10M"]),
            has_group_structure=random.choice([True, True, False]),
            ground_truth_code="56101",
            ground_truth_taxonomy="uk_sic_2007",
            archetype="A4_restaurant_holding_aml",
            archetype_description=(
                "UK restaurant with holding company signal from Equifax + sector pivot to wholesale/delivery. "
                "Current pipeline: silently discards the holding company code. "
                "Consensus Engine: triggers CRITICAL AML_EDD flag."
            ),
            sources=[
                SourceSignal(
                    source="opencorporates", data_channel="api_call",
                    taxonomy="uk_sic_2007", raw_code="56101",
                    raw_label=UK_SIC_LABELS["56101"],
                    confidence=_jitter(0.91), static_weight=0.9,
                    retrieved_days_ago=_days(4),
                    notes="Primary SIC from Companies House",
                ),
                # Secondary SIC at Companies House — CURRENTLY DISCARDED by current pipeline
                SourceSignal(
                    source="opencorporates", data_channel="api_call",
                    taxonomy="uk_sic_2007", raw_code="64205",
                    raw_label=UK_SIC_LABELS["64205"],
                    confidence=_jitter(0.91), static_weight=0.9,
                    retrieved_days_ago=_days(4),
                    is_primary_code=False,
                    notes="Secondary SIC from Companies House — DISCARDED by current pipeline (loop returns first match only)",
                ),
                SourceSignal(
                    source="zoominfo", data_channel="api_call",
                    taxonomy="naics_2022", raw_code="722511",
                    raw_label=NAICS_LABELS["722511"],
                    confidence=_jitter(0.76), static_weight=0.8,
                    retrieved_days_ago=_days(42),
                ),
                SourceSignal(
                    source="equifax", data_channel="redshift_cache",
                    taxonomy="naics_2022", raw_code="551112",
                    raw_label=NAICS_LABELS["551112"],
                    confidence=_jitter(0.65), static_weight=0.7,
                    retrieved_days_ago=_days(380),
                    notes="Equifax public records — stale (380 days). Holding company signal.",
                ),
                # Equifax secondary — CURRENTLY DISCARDED
                SourceSignal(
                    source="equifax", data_channel="redshift_cache",
                    taxonomy="naics_2022", raw_code="722511",
                    raw_label=NAICS_LABELS["722511"],
                    confidence=_jitter(0.65), static_weight=0.7,
                    retrieved_days_ago=_days(380),
                    is_primary_code=False,
                    notes="Equifax secnaics1 — DISCARDED by current pipeline (secondary field not extracted)",
                ),
                SourceSignal(
                    source="trulioo", data_channel="api_call",
                    taxonomy="us_sic", raw_code="5812",
                    raw_label=US_SIC_LABELS["5812"],
                    confidence=_jitter(0.68), static_weight=0.8,
                    retrieved_days_ago=_days(3),
                    notes="4-digit US SIC for GB entity — POLLUTION",
                ),
                SourceSignal(
                    source="ai_enrichment", data_channel="ai_web_scrape",
                    taxonomy="naics_2022", raw_code="424410",
                    raw_label=NAICS_LABELS["424410"],
                    confidence=_jitter(0.79, 0.12), static_weight=0.1,
                    retrieved_days_ago=_days(1),
                    notes="LLM: web content describes B2B frozen food distribution",
                ),
                SourceSignal(
                    source="ai_enrichment", data_channel="ai_web_scrape",
                    taxonomy="naics_2022", raw_code="492210",
                    raw_label=NAICS_LABELS["492210"],
                    confidence=_jitter(0.61, 0.12), static_weight=0.1,
                    retrieved_days_ago=_days(1),
                    is_primary_code=False,
                    notes="LLM: web content also describes app-based delivery platform",
                ),
            ],
        ))

    # ------------------------------------------------------------------
    # ARCHETYPE 5: Shell company — holding company registration + consumer web
    # ------------------------------------------------------------------
    for i in range(10):
        entities.append(EntityInput(
            business_id=f"biz_shell_holding_{i:03d}",
            entity_name=f"Meridian Capital Holdings #{i + 1} Ltd",
            entity_country="GB",
            entity_age_years=round(random.uniform(1, 5), 1),
            revenue_band=random.choice(["1M-10M", "10M-100M"]),
            has_group_structure=True,
            ground_truth_code="64205",
            ground_truth_taxonomy="uk_sic_2007",
            archetype="A5_shell_holding_company",
            archetype_description=(
                "Shell company: registered as holding company at CH but web scrape shows consumer retail. "
                "Current pipeline: ZoomInfo retail signal wins, holding company risk missed. "
                "Consensus Engine: HOLDING_COMPANY_DISCREPANCY + SECTOR_CONFLICT flags triggered."
            ),
            sources=[
                SourceSignal(
                    source="opencorporates", data_channel="api_call",
                    taxonomy="uk_sic_2007", raw_code="64205",
                    raw_label=UK_SIC_LABELS["64205"],
                    confidence=_jitter(0.89), static_weight=0.9,
                    retrieved_days_ago=_days(5),
                    notes="Companies House: holding company registration",
                ),
                SourceSignal(
                    source="opencorporates", data_channel="api_call",
                    taxonomy="uk_sic_2007", raw_code="47910",
                    raw_label=UK_SIC_LABELS["47910"],
                    confidence=_jitter(0.89), static_weight=0.9,
                    retrieved_days_ago=_days(5),
                    is_primary_code=False,
                    notes="Secondary SIC: retail — DISCARDED by current pipeline",
                ),
                SourceSignal(
                    source="zoominfo", data_channel="api_call",
                    taxonomy="naics_2022", raw_code="812990",
                    raw_label=NAICS_LABELS["812990"],
                    confidence=_jitter(0.72), static_weight=0.8,
                    retrieved_days_ago=_days(10),
                    notes="ZoomInfo shows personal services — likely inferred from consumer web presence",
                ),
                SourceSignal(
                    source="equifax", data_channel="redshift_cache",
                    taxonomy="naics_2022", raw_code="551112",
                    raw_label=NAICS_LABELS["551112"],
                    confidence=_jitter(0.77), static_weight=0.7,
                    retrieved_days_ago=_days(60),
                    notes="Equifax confirms holding company classification",
                ),
                SourceSignal(
                    source="trulioo", data_channel="api_call",
                    taxonomy="us_sic", raw_code="6719",
                    raw_label=US_SIC_LABELS["6719"],
                    confidence=_jitter(0.63), static_weight=0.8,
                    retrieved_days_ago=_days(4),
                    notes="Trulioo: US SIC 6719 (Holding Companies) — crosswalks to NAICS 551112",
                ),
                SourceSignal(
                    source="ai_enrichment", data_channel="ai_web_scrape",
                    taxonomy="naics_2022", raw_code="812990",
                    raw_label=NAICS_LABELS["812990"],
                    confidence=_jitter(0.58, 0.15), static_weight=0.1,
                    retrieved_days_ago=_days(1),
                    notes="LLM: consumer-facing retail website found — inconsistent with holding structure",
                ),
            ],
        ))

    # ------------------------------------------------------------------
    # ARCHETYPE 6: Sector pivot — tech company, Equifax stale data shows old sector
    # ------------------------------------------------------------------
    for i in range(10):
        entities.append(EntityInput(
            business_id=f"biz_sector_pivot_{i:03d}",
            entity_name=f"Nexus Tech Solutions #{i + 1} Ltd",
            entity_country="GB",
            entity_age_years=round(random.uniform(3, 10), 1),
            revenue_band=random.choice(["1M-10M", "10M-100M"]),
            has_group_structure=random.choice([True, False]),
            ground_truth_code="62020",
            ground_truth_taxonomy="uk_sic_2007",
            archetype="A6_sector_pivot_tech",
            archetype_description=(
                "Tech consultancy — pivoted from food/hospitality to IT. Equifax data is 18+ months stale "
                "and still shows restaurant code. Current pipeline: Equifax stale data may pollute output. "
                "Consensus Engine: SECTOR_PIVOT_UNCONFIRMED flag + temporal staleness correction."
            ),
            sources=[
                SourceSignal(
                    source="opencorporates", data_channel="api_call",
                    taxonomy="uk_sic_2007", raw_code="62020",
                    raw_label=UK_SIC_LABELS["62020"],
                    confidence=_jitter(0.91), static_weight=0.9,
                    retrieved_days_ago=_days(3),
                    notes="Companies House: updated to IT consultancy 14 months ago",
                ),
                SourceSignal(
                    source="zoominfo", data_channel="api_call",
                    taxonomy="naics_2022", raw_code="541512",
                    raw_label=NAICS_LABELS["541512"],
                    confidence=_jitter(0.75), static_weight=0.8,
                    retrieved_days_ago=_days(8),
                    notes="ZoomInfo: event-driven update captured the pivot",
                ),
                SourceSignal(
                    source="equifax", data_channel="redshift_cache",
                    taxonomy="naics_2022", raw_code="722511",
                    raw_label=NAICS_LABELS["722511"],
                    confidence=_jitter(0.64), static_weight=0.7,
                    retrieved_days_ago=_days(550),
                    notes="STALE: Equifax last refreshed 550 days ago — still shows old restaurant classification",
                ),
                SourceSignal(
                    source="trulioo", data_channel="api_call",
                    taxonomy="us_sic", raw_code="7372",
                    raw_label=US_SIC_LABELS["7372"],
                    confidence=_jitter(0.69), static_weight=0.8,
                    retrieved_days_ago=_days(3),
                    notes="Trulioo: softare/tech — 4-digit US SIC for GB entity (detection needed)",
                ),
                SourceSignal(
                    source="ai_enrichment", data_channel="ai_web_scrape",
                    taxonomy="naics_2022", raw_code="541512",
                    raw_label=NAICS_LABELS["541512"],
                    confidence=_jitter(0.82, 0.10), static_weight=0.1,
                    retrieved_days_ago=_days(1),
                    notes="LLM: website confirms IT consultancy with recent case studies",
                ),
            ],
        ))

    return entities


if __name__ == "__main__":
    dataset = generate_dataset()
    print(f"Generated {len(dataset)} synthetic entities across 6 archetypes")
    by_arch = {}
    for e in dataset:
        by_arch.setdefault(e.archetype, []).append(e)
    for arch, ents in by_arch.items():
        print(f"  {arch}: {len(ents)} entities")
    print(f"\nSample: {dataset[30].entity_name} | {dataset[30].entity_country}")
    print(f"  Sources: {len(dataset[30].sources)}")
    for s in dataset[30].sources:
        print(f"    [{s.data_channel}] {s.source}: {s.taxonomy}/{s.raw_code} (conf={s.confidence}, weight={s.static_weight}, {s.retrieved_days_ago}d ago)")
