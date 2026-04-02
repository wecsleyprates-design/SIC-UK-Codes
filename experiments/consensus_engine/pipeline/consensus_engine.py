"""
Consensus Engine Pipeline
============================
Applies the XGBoost model + discrepancy detection to produce a full
ConsensusEngineResult for each entity — the proposed replacement for
factWithHighestConfidence.
"""

from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dataclasses import dataclass, field
from typing import Optional

from data.synthetic_entities import EntityInput
from features.feature_builder import ConsensusFeatureBuilder, FeatureVector
from training.train_model import TrainedModel, CLASS_TO_REPRESENTATIVE_CODE


# ---------------------------------------------------------------------------
# Output schema — mirrors types.ts ConsensusEngineResult
# ---------------------------------------------------------------------------

@dataclass
class RiskFlag:
    flag_type: str
    severity: str          # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
    description: str
    triggering_sources: list[str]
    discrepancy_score: float
    recommended_action: str
    aml_risk_multiplier: float


@dataclass
class ClassificationEntry:
    rank: int
    class_label: str
    taxonomy: str
    code: str
    label: str
    consensus_probability: float
    top_shap_feature: Optional[str]    # Highest absolute SHAP feature for this entity
    top_shap_value: Optional[float]


@dataclass
class ConsensusEngineResult:
    business_id: str
    entity_name: str
    entity_country: str
    model_version: str

    # --- XGBoost model input (what the model received) ---
    feature_vector: FeatureVector
    feature_names: list[str]

    # --- XGBoost model outputs ---
    top5_classifications: list[ClassificationEntry]
    shap_contributions: Optional[dict[str, float]]

    # --- Discrepancy detection outputs ---
    risk_flags: list[RiskFlag]
    combined_aml_multiplier: float

    # --- Summary ---
    overall_confidence: float
    requires_manual_review: bool
    recommended_code: str
    recommended_taxonomy: str
    recommended_label: str
    recommended_probability: float


# ---------------------------------------------------------------------------
# Discrepancy detector — rule-based (can be replaced by trained binary classifiers)
# ---------------------------------------------------------------------------

HOLDING_COMPANY_CODES = {"551112", "551114", "551110", "64205", "64209", "64301", "6719"}
FOOD_SERVICE_CODES    = {"56101", "56102", "56103", "722511", "722513", "722514", "722515", "5812"}
TECH_CODES            = {"62020", "62090", "541512", "541511", "541519", "7372"}


def _detect_risk_flags(entity: EntityInput, fv: FeatureVector) -> list[RiskFlag]:
    flags: list[RiskFlag] = []

    # --- FLAG 1: Trulioo Pollution ---
    if fv.f07_trulioo_pollution_flag:
        tru_sources = [s for s in entity.sources if s.source == "trulioo"]
        flags.append(RiskFlag(
            flag_type="TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY",
            severity="LOW",
            description=(
                f"Trulioo returned a 4-digit US SIC code for a GB-registered entity "
                f"({tru_sources[0].raw_code if tru_sources else 'N/A'}). "
                "UK SIC 2007 requires 5 digits. Signal down-weighted; flagged for data quality monitoring."
            ),
            triggering_sources=["trulioo"],
            discrepancy_score=1.0,
            recommended_action="Log for Trulioo source quality monitoring. No immediate underwriting action.",
            aml_risk_multiplier=1.2,
        ))

    # --- FLAG 2: Holding company signal ---
    if fv.f11_holding_company_signal:
        holding_sources = [
            s.source for s in entity.sources
            if s.raw_code in HOLDING_COMPANY_CODES
        ]
        # Is there also a food service / consumer signal?
        has_consumer_signal = any(
            s.raw_code in FOOD_SERVICE_CODES for s in entity.sources
        )
        if has_consumer_signal:
            flags.append(RiskFlag(
                flag_type="HOLDING_COMPANY_DISCREPANCY",
                severity="HIGH",
                description=(
                    "A holding company code (NAICS 551112 / UK SIC 64205 family) is present alongside "
                    "active consumer-facing industry signals. Pattern consistent with a shell or layering structure."
                ),
                triggering_sources=list(set(holding_sources)),
                discrepancy_score=round(0.7 + fv.f02_oc_secondary_count * 0.05, 2),
                recommended_action=(
                    "Trigger UBO verification workflow. Cross-reference Companies House PSC register. "
                    "Do not approve until beneficial ownership chain is resolved."
                ),
                aml_risk_multiplier=3.1,
            ))

    # --- FLAG 3: Registry vs. Web discrepancy ---
    registry_sources = {s.source for s in entity.sources if s.source in ("opencorporates", "equifax")}
    web_sources      = {s.source for s in entity.sources if s.source in ("ai_enrichment", "zoominfo")}
    registry_codes   = {s.raw_code for s in entity.sources if s.source in ("opencorporates", "equifax") and s.is_primary_code}
    web_codes        = {s.raw_code for s in entity.sources if s.source in ("ai_enrichment", "zoominfo") and s.is_primary_code}
    registry_sectors = {_code_sector(c) for c in registry_codes} - {None}
    web_sectors      = {_code_sector(c) for c in web_codes} - {None}

    if registry_sectors and web_sectors and not registry_sectors.intersection(web_sectors):
        flags.append(RiskFlag(
            flag_type="SECTOR_CONFLICT_REGISTRY_VS_WEB",
            severity="HIGH",
            description=(
                f"Registry sources ({', '.join(registry_sources)}) and web/firmographic sources "
                f"({', '.join(web_sources)}) return codes from different economic sectors. "
                f"Registry sectors: {registry_sectors}. Web sectors: {web_sectors}."
            ),
            triggering_sources=list(registry_sources | web_sources),
            discrepancy_score=round(1.0 - fv.f13_source_agreement_rate, 2),
            recommended_action=(
                "Escalate to Enhanced Due Diligence. Request beneficial ownership documentation. "
                "Verify operating entity relationship to any identified holding structure."
            ),
            aml_risk_multiplier=2.5,
        ))

    # --- FLAG 4: Sector pivot (stale data) ---
    if fv.f10_max_staleness_days > 270 and fv.f13_source_agreement_rate < 0.6:
        stale_sources = [
            s.source for s in entity.sources
            if s.retrieved_days_ago > 270 and s.is_primary_code
        ]
        flags.append(RiskFlag(
            flag_type="SECTOR_PIVOT_UNCONFIRMED",
            severity="MEDIUM",
            description=(
                f"Oldest source data is {fv.f10_max_staleness_days} days old. "
                "Combined with low source agreement rate, this suggests a potential unconfirmed sector pivot. "
                "Registry filings may not reflect current operations."
            ),
            triggering_sources=list(set(stale_sources)),
            discrepancy_score=round(min(fv.f10_max_staleness_days / 730, 1.0), 2),
            recommended_action=(
                "Request updated business information. Verify whether business model changes "
                "are reflected in Companies House SIC filings."
            ),
            aml_risk_multiplier=1.8,
        ))

    # --- FLAG 5: Multi-sector span anomaly ---
    if fv.f12_multi_sector_span >= 3:
        flags.append(RiskFlag(
            flag_type="MULTI_SECTOR_SPAN_ANOMALY",
            severity="MEDIUM",
            description=(
                f"Sources collectively span {fv.f12_multi_sector_span} distinct NAICS 2-digit sectors. "
                "High sector span indicates either legitimate multi-sector operations or a complex "
                "corporate structure requiring clarification."
            ),
            triggering_sources=[s.source for s in entity.sources if s.is_primary_code],
            discrepancy_score=min(fv.f12_multi_sector_span / 5.0, 1.0),
            recommended_action=(
                "Request explanation of multi-sector operations. "
                "Verify each business line is reflected in Companies House SIC registrations."
            ),
            aml_risk_multiplier=1.5,
        ))

    # --- FLAG 6: AML EDD triggered (combined) ---
    combined = sum(f.aml_risk_multiplier for f in flags)
    high_critical = [f for f in flags if f.severity in ("HIGH", "CRITICAL")]
    if combined > 5.0 or len(high_critical) >= 2:
        flags.append(RiskFlag(
            flag_type="AML_ENHANCED_DUE_DILIGENCE_TRIGGERED",
            severity="CRITICAL",
            description=(
                f"Combined AML risk multiplier: {combined:.1f}×. "
                f"{len(high_critical)} HIGH/CRITICAL flags triggered simultaneously. "
                "Entity crosses automated EDD threshold."
            ),
            triggering_sources=list({s for f in flags for s in f.triggering_sources}),
            discrepancy_score=min(combined / 10.0, 1.0),
            recommended_action=(
                "Block automated approval. Route to Senior Compliance Analyst. "
                "Collect: audited accounts, UBO declaration, source of funds declaration."
            ),
            aml_risk_multiplier=combined,
        ))

    return flags


def _code_sector(code: str) -> Optional[str]:
    """Returns the high-level sector category for a given code."""
    from training.train_model import LABEL_NORMALIZATION
    return LABEL_NORMALIZATION.get(code)


# ---------------------------------------------------------------------------
# Main consensus engine scoring function
# ---------------------------------------------------------------------------

def run_consensus_engine(entity: EntityInput, model: TrainedModel) -> ConsensusEngineResult:
    """
    Full Consensus Engine pipeline for one entity.
    Returns the complete ConsensusEngineResult with model I/O and risk flags.
    """
    builder = ConsensusFeatureBuilder()
    fv = builder.build(entity)

    # XGBoost inference
    top5_raw = model.predict_proba_top5(fv)
    shap_vals = model.shap_contributions(fv)

    # Build top-5 classification entries
    top5 = []
    for rank, (class_label, prob) in enumerate(top5_raw, 1):
        taxonomy, code, label = CLASS_TO_REPRESENTATIVE_CODE.get(
            class_label, ("naics_2022", "561499", "All Other Business Support Services")
        )
        top_shap_feat = None
        top_shap_val = None
        if shap_vals:
            top_shap_feat = max(shap_vals, key=lambda k: abs(shap_vals[k]))
            top_shap_val = shap_vals[top_shap_feat]

        top5.append(ClassificationEntry(
            rank=rank,
            class_label=class_label,
            taxonomy=taxonomy,
            code=code,
            label=label,
            consensus_probability=round(prob, 4),
            top_shap_feature=top_shap_feat if rank == 1 else None,
            top_shap_value=round(top_shap_val, 4) if (top_shap_val and rank == 1) else None,
        ))

    # Discrepancy detection
    risk_flags = _detect_risk_flags(entity, fv)
    combined_multiplier = sum(
        f.aml_risk_multiplier for f in risk_flags
        if f.flag_type != "AML_ENHANCED_DUE_DILIGENCE_TRIGGERED"
    )

    top1 = top5[0]
    requires_review = any(f.severity in ("HIGH", "CRITICAL") for f in risk_flags)

    return ConsensusEngineResult(
        business_id=entity.business_id,
        entity_name=entity.entity_name,
        entity_country=entity.entity_country,
        model_version="consensus-engine-v0.1-demo",
        feature_vector=fv,
        feature_names=FeatureVector.feature_names(),
        top5_classifications=top5,
        shap_contributions=shap_vals,
        risk_flags=risk_flags,
        combined_aml_multiplier=round(combined_multiplier, 2),
        overall_confidence=round(top1.consensus_probability, 3),
        requires_manual_review=requires_review,
        recommended_code=top1.code,
        recommended_taxonomy=top1.taxonomy,
        recommended_label=top1.label,
        recommended_probability=top1.consensus_probability,
    )
