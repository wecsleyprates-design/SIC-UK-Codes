"""
Consensus Feature Builder
===========================
Constructs the 15-feature input vector for the XGBoost Consensus Engine.
This is the module that transforms raw vendor signals into model-ready features.

Each feature maps directly to a documented signal in the architecture blueprint.
Features are logged per-entity so users can see exactly what XGBoost receives as input.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from data.synthetic_entities import EntityInput, SourceSignal, CROSSWALK_UK_SIC_TO_NAICS

# ---------------------------------------------------------------------------
# Code index maps (integer encoding for XGBoost categorical features)
# ---------------------------------------------------------------------------
ALL_KNOWN_CODES = [
    # UK SIC 2007
    "56101", "56102", "56103", "46390", "10710", "47110", "62020", "62090",
    "64205", "64209", "68209", "70229", "82990", "53202", "47910",
    # NAICS 2022
    "722511", "722513", "722514", "722515", "722310", "424410", "424480",
    "311991", "445291", "492210", "484110", "541512", "541511", "541519",
    "551112", "551114", "531120", "531110", "812990", "561499", "445110",
    # US SIC (4-digit)
    "5812", "5411", "7372", "6719", "6552",
    # MCC
    "5812_mcc", "5411_mcc", "7372_mcc",
    "UNKNOWN",
]
CODE_INDEX = {code: idx for idx, code in enumerate(ALL_KNOWN_CODES)}

def code_to_idx(code: Optional[str]) -> int:
    if code is None:
        return CODE_INDEX["UNKNOWN"]
    return CODE_INDEX.get(code, CODE_INDEX["UNKNOWN"])

# 2-digit NAICS sector groupings (for multi_sector_span)
NAICS_2DIGIT_SECTOR = {
    "722511": "72", "722513": "72", "722514": "72", "722515": "72", "722310": "72",
    "424410": "42", "424480": "42", "424490": "42",
    "311991": "31", "445291": "44",
    "492210": "48", "484110": "48",
    "541512": "54", "541511": "54", "541519": "54",
    "551112": "55", "551114": "55",
    "531120": "53", "531110": "53",
    "812990": "81", "561499": "56",
    "445110": "44",
    # US SIC crosswalk approximations
    "5812": "72", "5411": "44", "7372": "54", "6719": "55",
}

HOLDING_COMPANY_CODES = {"551112", "551114", "551110", "64205", "64209", "64301", "6719"}


@dataclass
class FeatureVector:
    """
    The 15-feature input vector as XGBoost receives it.
    Stored per-entity for full transparency in experiment output.
    """
    business_id: str
    entity_name: str

    # --- Feature Family 1: Source code signals ---
    f01_oc_uk_sic_primary_idx: int       # OpenCorporates primary UK SIC (code index)
    f02_oc_secondary_count: int          # Number of secondary SIC codes at Companies House
    f03_zi_naics_idx: int                # ZoomInfo NAICS code (code index)
    f04_efx_naics_primary_idx: int       # Equifax primary NAICS
    f05_efx_naics_secondary_idx: int     # Equifax secondary NAICS (secnaics1) — UNKNOWN if current pipeline
    f06_tru_sic_raw_idx: int             # Trulioo raw SIC

    # --- Feature Family 2: Source reliability ---
    f07_trulioo_pollution_flag: int      # 1 if 4-digit US SIC for GB entity
    f08_avg_confidence: float            # Mean confidence across all primary sources
    f09_min_staleness_days: int          # Freshest source (days ago)
    f10_max_staleness_days: int          # Stalest source (days ago)

    # --- Feature Family 3: Discrepancy signals ---
    f11_holding_company_signal: int      # 1 if any source returns a holding company code
    f12_multi_sector_span: int           # Count of distinct NAICS 2-digit sectors
    f13_source_agreement_rate: float     # Fraction of source pairs agreeing on 2-digit sector

    # --- Feature Family 4: Entity context ---
    f14_entity_is_gb: int                # 1 if GB entity
    f15_n_sources: int                   # Number of primary sources that responded

    def to_list(self) -> list:
        """Returns ordered feature list for XGBoost input."""
        return [
            self.f01_oc_uk_sic_primary_idx, self.f02_oc_secondary_count,
            self.f03_zi_naics_idx, self.f04_efx_naics_primary_idx,
            self.f05_efx_naics_secondary_idx, self.f06_tru_sic_raw_idx,
            self.f07_trulioo_pollution_flag, self.f08_avg_confidence,
            self.f09_min_staleness_days, self.f10_max_staleness_days,
            self.f11_holding_company_signal, self.f12_multi_sector_span,
            self.f13_source_agreement_rate, self.f14_entity_is_gb,
            self.f15_n_sources,
        ]

    @classmethod
    def feature_names(cls) -> list[str]:
        return [
            "oc_uk_sic_primary_idx", "oc_secondary_count",
            "zi_naics_idx", "efx_naics_primary_idx",
            "efx_naics_secondary_idx", "tru_sic_raw_idx",
            "trulioo_pollution_flag", "avg_confidence",
            "min_staleness_days", "max_staleness_days",
            "holding_company_signal", "multi_sector_span",
            "source_agreement_rate", "entity_is_gb",
            "n_sources",
        ]


class ConsensusFeatureBuilder:
    """Transforms an EntityInput into a FeatureVector for XGBoost input."""

    def build(self, entity: EntityInput) -> FeatureVector:
        primary = [s for s in entity.sources if s.is_primary_code]
        secondary = [s for s in entity.sources if not s.is_primary_code]

        # F01: OpenCorporates primary UK SIC
        oc_primary = next(
            (s for s in primary if s.source == "opencorporates" and s.taxonomy == "uk_sic_2007"), None
        )
        f01 = code_to_idx(oc_primary.raw_code if oc_primary else None)

        # F02: Secondary SIC count at Companies House
        oc_secondary_count = sum(
            1 for s in secondary if s.source == "opencorporates" and s.taxonomy == "uk_sic_2007"
        )

        # F03: ZoomInfo NAICS
        zi = next((s for s in primary if s.source == "zoominfo" and s.taxonomy == "naics_2022"), None)
        f03 = code_to_idx(zi.raw_code if zi else None)

        # F04: Equifax primary NAICS
        efx_primary = next(
            (s for s in primary if s.source == "equifax" and s.taxonomy == "naics_2022"), None
        )
        f04 = code_to_idx(efx_primary.raw_code if efx_primary else None)

        # F05: Equifax secondary NAICS (secnaics1) — extracted by Consensus Engine, not current pipeline
        efx_secondary = next(
            (s for s in secondary if s.source == "equifax" and s.taxonomy == "naics_2022"), None
        )
        f05 = code_to_idx(efx_secondary.raw_code if efx_secondary else None)

        # F06: Trulioo raw SIC
        tru = next((s for s in primary if s.source == "trulioo"), None)
        f06 = code_to_idx(tru.raw_code if tru else None)

        # F07: Trulioo pollution flag (deterministic)
        f07 = int(
            tru is not None
            and entity.entity_country == "GB"
            and tru.raw_code is not None
            and len(tru.raw_code) == 4
            and tru.raw_code.isdigit()
        )

        # F08: Average confidence across all primary sources
        confs = [s.confidence for s in primary if s.confidence]
        f08 = round(sum(confs) / len(confs), 3) if confs else 0.5

        # F09/F10: Staleness range
        days = [s.retrieved_days_ago for s in primary]
        f09 = min(days) if days else 0
        f10 = max(days) if days else 0

        # F11: Holding company signal — any source returns holding company code
        all_codes = [s.raw_code for s in entity.sources]
        f11 = int(any(c in HOLDING_COMPANY_CODES for c in all_codes))

        # F12: Multi-sector span — distinct NAICS 2-digit sectors across all sources
        sectors = set()
        for s in entity.sources:
            sec = NAICS_2DIGIT_SECTOR.get(s.raw_code)
            if sec:
                sectors.add(sec)
        f12 = len(sectors)

        # F13: Source agreement rate
        # For each pair of primary sources, do they share the same 2-digit sector?
        sector_per_source = []
        for s in primary:
            sec = NAICS_2DIGIT_SECTOR.get(s.raw_code)
            if sec:
                sector_per_source.append(sec)
        if len(sector_per_source) < 2:
            f13 = 1.0  # No pairs to disagree
        else:
            agreements = sum(
                1 for i in range(len(sector_per_source))
                for j in range(i + 1, len(sector_per_source))
                if sector_per_source[i] == sector_per_source[j]
            )
            total_pairs = len(sector_per_source) * (len(sector_per_source) - 1) // 2
            f13 = round(agreements / total_pairs, 3)

        # F14: Entity country
        f14 = int(entity.entity_country == "GB")

        # F15: Number of primary sources
        f15 = len(primary)

        return FeatureVector(
            business_id=entity.business_id,
            entity_name=entity.entity_name,
            f01_oc_uk_sic_primary_idx=f01,
            f02_oc_secondary_count=oc_secondary_count,
            f03_zi_naics_idx=f03,
            f04_efx_naics_primary_idx=f04,
            f05_efx_naics_secondary_idx=f05,
            f06_tru_sic_raw_idx=f06,
            f07_trulioo_pollution_flag=f07,
            f08_avg_confidence=f08,
            f09_min_staleness_days=f09,
            f10_max_staleness_days=f10,
            f11_holding_company_signal=f11,
            f12_multi_sector_span=f12,
            f13_source_agreement_rate=f13,
            f14_entity_is_gb=f14,
            f15_n_sources=f15,
        )
