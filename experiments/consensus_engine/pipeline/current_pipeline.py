"""
Current Pipeline Simulation
==============================
Python implementation of Worth AI's existing factWithHighestConfidence rule
as defined in integration-service/lib/facts/rules.ts (lines 36-59).

This module faithfully reproduces every flaw documented in the blueprint:
  - Single-winner reduction (discards all but the highest-confidence source)
  - Static context-free weights (from sources.ts constants)
  - WEIGHT_THRESHOLD = 0.05 tie-breaking
  - UK SIC path isolated from NAICS path (no cross-fact reasoning)
  - Secondary SIC codes silently discarded (loop returns first match only)
  - Trulioo US SIC for GB entities passes through unchallenged
  - AI enrichment suppressed when >= 3 sources already returned a value
  - Equifax secondary NAICS fields (secnaics1) not extracted
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

from data.synthetic_entities import SourceSignal, EntityInput, CROSSWALK_US_SIC_TO_NAICS

# ---------------------------------------------------------------------------
# Replicates the constants from integration-service/lib/facts/rules.ts
# ---------------------------------------------------------------------------
WEIGHT_THRESHOLD = 0.05  # Line 9 of rules.ts

SOURCE_STATIC_WEIGHTS = {   # From integration-service/lib/facts/sources.ts
    "opencorporates":  0.9,
    "zoominfo":        0.8,
    "equifax":         0.7,
    "trulioo":         0.8,  # "business" source in sources.ts
    "ai_enrichment":   0.1,  # Penalized to near-irrelevance
}


@dataclass
class FactResolutionStep:
    """One comparison step in the reduce() loop — mirrors the TypeScript logic."""
    step_num: int
    challenger_source: str
    challenger_code: str
    challenger_conf: float
    incumbent_source: str
    incumbent_code: str
    incumbent_conf: float
    conf_diff: float
    outcome: str   # "CHALLENGER_WINS" | "INCUMBENT_WINS" | "WEIGHT_TIEBREAK"
    winner_source: str
    winner_code: str


@dataclass
class CurrentPipelineResult:
    """
    Full output of the current factWithHighestConfidence pipeline for one entity.
    Shows exactly what was selected and what was silently discarded.
    """
    business_id: str
    entity_name: str
    entity_country: str

    # --- naics_code fact resolution ---
    naics_winner_code: Optional[str]
    naics_winner_source: Optional[str]
    naics_winner_conf: float
    naics_candidates_considered: list[SourceSignal]    # All signals that entered the reduce()
    naics_discarded_signals: list[SourceSignal]        # Losers — permanently dropped

    # --- uk_sic_code fact resolution (separate path, isolated from naics) ---
    uk_sic_winner_code: Optional[str]
    uk_sic_winner_source: Optional[str]
    uk_sic_winner_conf: float
    uk_sic_candidates_considered: list[SourceSignal]
    uk_sic_discarded_signals: list[SourceSignal]

    # --- Structural gaps ---
    secondary_codes_discarded: list[SourceSignal]      # is_primary_code=False — never considered
    trulioo_pollution_detected: bool                   # Was US SIC passed for GB entity?
    trulioo_pollution_flagged: bool                    # Did current pipeline catch it? (always False)
    ai_enrichment_suppressed: bool                     # Was AI suppressed due to >= 3 sources?
    equifax_secondary_extracted: bool                  # Were secnaics1/2 extracted? (always False)
    holding_company_code_in_discards: bool             # Was 551112 or 64205 silently dropped?
    aml_flags_generated: int                           # Always 0 in current pipeline

    # --- Reasoning trace ---
    naics_resolution_steps: list[FactResolutionStep]
    uk_sic_resolution_steps: list[FactResolutionStep]

    # --- Final output (what the current system publishes) ---
    final_naics_code: Optional[str]                    # Single string, no confidence
    final_uk_sic_code: Optional[str]                  # Single string, no confidence
    final_mcc_code: Optional[str]                      # Derived from NAICS or hardcoded fallback


HOLDING_COMPANY_CODES = {
    "naics_2022": {"551112", "551114", "551110"},
    "uk_sic_2007": {"64205", "64209", "64301"},
    "us_sic": {"6719"},
}

NAICS_LAST_RESORT = "561499"   # aiNaicsEnrichment.ts line ~30: NAICS_OF_LAST_RESORT


def _effective_confidence(signal: SourceSignal) -> float:
    """
    Mirrors: fact.confidence ?? fact.source?.confidence ?? 0.1
    In the TypeScript, this is the confidence used in the reduce() comparison.
    """
    return signal.confidence if signal.confidence is not None else 0.1


def _static_weight(signal: SourceSignal) -> float:
    return SOURCE_STATIC_WEIGHTS.get(signal.source, 0.5)


def _weighted_fact_selector(challenger: SourceSignal, incumbent: SourceSignal) -> SourceSignal:
    """
    Mirrors weightedFactSelector() — uses static source weights when confidence
    values are within WEIGHT_THRESHOLD of each other.
    """
    cw = _static_weight(challenger)
    iw = _static_weight(incumbent)
    return challenger if cw >= iw else incumbent


def _resolve_fact(
    signals: list[SourceSignal],
    fact_name: str,
) -> tuple[Optional[SourceSignal], list[SourceSignal], list[FactResolutionStep]]:
    """
    Direct Python port of the factWithHighestConfidence reduce() loop.
    Returns: (winner, discarded_signals, resolution_steps)
    """
    if not signals:
        return None, [], []

    steps: list[FactResolutionStep] = []
    discarded: list[SourceSignal] = []
    incumbent: Optional[SourceSignal] = None
    step_num = 0

    for signal in signals:
        # Skip undefined/empty values (mirrors TypeScript guard)
        if not signal.raw_code:
            discarded.append(signal)
            continue

        if incumbent is None:
            incumbent = signal
            continue

        step_num += 1
        c_conf = _effective_confidence(signal)
        i_conf = _effective_confidence(incumbent)
        diff = abs(c_conf - i_conf)

        if diff <= WEIGHT_THRESHOLD:
            # Tie — use static weights
            winner = _weighted_fact_selector(signal, incumbent)
            loser = incumbent if winner is signal else signal
            outcome = "WEIGHT_TIEBREAK"
        elif c_conf > i_conf:
            winner = signal
            loser = incumbent
            outcome = "CHALLENGER_WINS"
        else:
            winner = incumbent
            loser = signal
            outcome = "INCUMBENT_WINS"

        steps.append(FactResolutionStep(
            step_num=step_num,
            challenger_source=signal.source,
            challenger_code=signal.raw_code,
            challenger_conf=c_conf,
            incumbent_source=incumbent.source,
            incumbent_code=incumbent.raw_code,
            incumbent_conf=i_conf,
            conf_diff=round(diff, 3),
            outcome=outcome,
            winner_source=winner.source,
            winner_code=winner.raw_code,
        ))

        discarded.append(loser)
        incumbent = winner

    return incumbent, discarded, steps


def _build_naics_candidates(entity: EntityInput) -> list[SourceSignal]:
    """
    Replicates the naics_code fact definition from businessDetails/index.ts.
    Only primary codes from NAICS-producing sources enter the resolution path.
    OpenCorporates does NOT contribute directly to NAICS (it goes to uk_sic_code path).
    Equifax secondary NAICS (secnaics1) is NOT extracted.
    """
    candidates = []
    for s in entity.sources:
        if not s.is_primary_code:
            continue   # Secondary codes excluded from current pipeline
        if s.source == "opencorporates":
            continue   # OC goes to uk_sic path, not naics path
        if s.taxonomy in ("naics_2022", "us_sic"):
            # Trulioo US SIC enters the NAICS resolution unchallenged
            candidates.append(s)
    return candidates


def _build_uk_sic_candidates(entity: EntityInput) -> list[SourceSignal]:
    """
    Replicates the uk_sic_code path from businessDetails/index.ts:
    - Only OpenCorporates and Trulioo (country==GB) contribute
    - Returns FIRST gb_sic match from OpenCorporates (loop exits on first)
    - AI enrichment weight: 0.1
    """
    candidates = []
    oc_seen = False
    for s in entity.sources:
        if not s.is_primary_code and s.source == "opencorporates":
            continue   # Secondary OC codes discarded — loop exits on first gb_sic match
        if s.source == "opencorporates" and s.taxonomy == "uk_sic_2007":
            if not oc_seen:
                candidates.append(s)
                oc_seen = True   # Only first gb_sic match
        elif s.source == "trulioo" and entity.entity_country == "GB" and s.taxonomy == "uk_sic_2007":
            candidates.append(s)
        elif s.source == "ai_enrichment" and s.taxonomy == "uk_sic_2007":
            candidates.append(s)
    return candidates


def _is_ai_suppressed(primary_signals: list[SourceSignal]) -> bool:
    """
    Mirrors: maximumSources: 3 in AINaicsEnrichment.DEPENDENT_FACTS
    If >= 3 non-AI sources responded, AI enrichment is NOT triggered.
    """
    non_ai = [s for s in primary_signals if s.source != "ai_enrichment"]
    return len(non_ai) >= 3


def _derive_mcc(naics_code: Optional[str]) -> Optional[str]:
    """Simplified MCC derivation from NAICS — mirrors existing MCC resolution."""
    mcc_map = {
        "722511": "5812", "722513": "5812", "722514": "5812", "722515": "5812",
        "445110": "5411", "541512": "7372", "541511": "7372",
        "551112": "6159", "492210": "4215",
    }
    return mcc_map.get(naics_code, None) if naics_code else None


def run_current_pipeline(entity: EntityInput) -> CurrentPipelineResult:
    """
    Simulates the full current pipeline for a single entity.
    """
    secondary_codes = [s for s in entity.sources if not s.is_primary_code]

    # 1. NAICS resolution — all primary signals except OpenCorporates
    naics_candidates = _build_naics_candidates(entity)
    ai_suppressed = _is_ai_suppressed(naics_candidates)
    if ai_suppressed:
        naics_candidates = [s for s in naics_candidates if s.source != "ai_enrichment"]

    naics_winner, naics_discarded, naics_steps = _resolve_fact(naics_candidates, "naics_code")

    # Fallback: if AI would have been triggered but has no NAICS signal, use NAICS_OF_LAST_RESORT
    resolved_naics = naics_winner.raw_code if naics_winner else NAICS_LAST_RESORT

    # 2. UK SIC resolution — separate isolated path
    uk_sic_candidates = _build_uk_sic_candidates(entity)
    uk_sic_winner, uk_sic_discarded, uk_sic_steps = _resolve_fact(uk_sic_candidates, "uk_sic_code")

    # 3. Structural gap checks
    trulioo_pollution = any(
        s.source == "trulioo" and entity.entity_country == "GB"
        and len(s.raw_code) == 4 and s.raw_code.isdigit()
        for s in entity.sources if s.is_primary_code
    )

    all_discarded = naics_discarded + uk_sic_discarded + secondary_codes
    holding_in_discards = any(
        s.raw_code in HOLDING_COMPANY_CODES.get(s.taxonomy, set())
        for s in all_discarded
    )

    return CurrentPipelineResult(
        business_id=entity.business_id,
        entity_name=entity.entity_name,
        entity_country=entity.entity_country,

        naics_winner_code=resolved_naics,
        naics_winner_source=naics_winner.source if naics_winner else "fallback",
        naics_winner_conf=naics_winner.confidence if naics_winner else 0.0,
        naics_candidates_considered=naics_candidates,
        naics_discarded_signals=naics_discarded,

        uk_sic_winner_code=uk_sic_winner.raw_code if uk_sic_winner else None,
        uk_sic_winner_source=uk_sic_winner.source if uk_sic_winner else None,
        uk_sic_winner_conf=uk_sic_winner.confidence if uk_sic_winner else 0.0,
        uk_sic_candidates_considered=uk_sic_candidates,
        uk_sic_discarded_signals=uk_sic_discarded,

        secondary_codes_discarded=secondary_codes,
        trulioo_pollution_detected=trulioo_pollution,
        trulioo_pollution_flagged=False,  # Current pipeline never flags this
        ai_enrichment_suppressed=ai_suppressed,
        equifax_secondary_extracted=False,  # Current pipeline never extracts secnaics1
        holding_company_code_in_discards=holding_in_discards,
        aml_flags_generated=0,  # Current pipeline generates zero AML flags

        naics_resolution_steps=naics_steps,
        uk_sic_resolution_steps=uk_sic_steps,

        final_naics_code=resolved_naics,
        final_uk_sic_code=uk_sic_winner.raw_code if uk_sic_winner else None,
        final_mcc_code=_derive_mcc(resolved_naics),
    )
