"""
Comparison Report Generator
==============================
Produces the side-by-side comparison of current pipeline vs. Consensus Engine
for all 60 synthetic entities. Writes both a console summary and a
structured markdown report to results/comparison_report.md.
"""

from __future__ import annotations
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dataclasses import asdict
from pipeline.current_pipeline import CurrentPipelineResult
from pipeline.consensus_engine import ConsensusEngineResult
from data.synthetic_entities import EntityInput

SEVERITY_ICONS = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢", "INFO": "⚪"}
YES = "✅"; NO = "❌"; WARN = "⚠️ "


def print_entity_comparison(
    entity: EntityInput,
    current: CurrentPipelineResult,
    consensus: ConsensusEngineResult,
    show_features: bool = True,
    show_shap: bool = True,
) -> str:
    """Formats a detailed side-by-side comparison block for one entity."""
    lines = []
    W = 74
    lines.append("═" * W)
    lines.append(f" ENTITY : {entity.entity_name} ({entity.entity_country})")
    lines.append(f" ID     : {entity.business_id}")
    lines.append(f" ARCH   : {entity.archetype}")
    lines.append(f" TRUTH  : {entity.ground_truth_code} ({entity.ground_truth_taxonomy})")
    lines.append("─" * W)

    # --- Source signals received ---
    lines.append(" INPUTS — Source Signals Received (API calls + Redshift + AI):")
    lines.append(f"   {'Source':<18} {'Channel':<14} {'Taxonomy':<13} {'Code':<7} {'Conf':>5}  {'Stale':>5}d  {'Primary':>7}  Notes")
    lines.append(f"   {'─'*17} {'─'*13} {'─'*12} {'─'*6} {'─'*5}  {'─'*5}   {'─'*7}  {'─'*30}")
    for s in entity.sources:
        primary_marker = YES if s.is_primary_code else f"  {NO} (discarded)"
        lines.append(
            f"   {s.source:<18} {s.data_channel:<14} {s.taxonomy:<13} {s.raw_code:<7} {s.confidence:>5.2f}  "
            f"{s.retrieved_days_ago:>5}   {primary_marker}  {s.notes[:40] if s.notes else ''}"
        )
    lines.append("")

    # --- CURRENT PIPELINE ---
    lines.append("┌─ CURRENT PIPELINE (factWithHighestConfidence) " + "─" * (W - 49) + "┐")

    lines.append(f"│  NAICS Resolution Path (sources.ts weights, WEIGHT_THRESHOLD=0.05)")
    lines.append(f"│  Candidates: {len(current.naics_candidates_considered)} primary sources entered reduce()")
    for step in current.naics_resolution_steps:
        icon = "▶" if step.outcome != "INCUMBENT_WINS" else " "
        lines.append(
            f"│    Step {step.step_num}: {step.challenger_source}({step.challenger_code}, {step.challenger_conf:.2f})"
            f" vs {step.incumbent_source}({step.incumbent_code}, {step.incumbent_conf:.2f})"
            f" → diff={step.conf_diff:.3f} → {step.outcome} {icon}"
        )
    lines.append(f"│")
    lines.append(f"│  {'Output: naics_code':<30} = {current.final_naics_code}")
    lines.append(f"│  {'Output: uk_sic_code':<30} = {current.final_uk_sic_code or 'None'}")
    lines.append(f"│  {'Output: mcc_code':<30} = {current.final_mcc_code or 'None'}")
    lines.append(f"│")
    lines.append(f"│  {'Discarded signals':<30} : {len(current.naics_discarded_signals) + len(current.uk_sic_discarded_signals)}")
    lines.append(f"│  {'Secondary codes discarded':<30} : {len(current.secondary_codes_discarded)}")
    lines.append(f"│  {'Trulioo pollution detected':<30} : {WARN if current.trulioo_pollution_detected else NO}  FLAGGED: {NO} (never flagged)")
    lines.append(f"│  {'Holding company in discards':<30} : {WARN if current.holding_company_code_in_discards else NO}")
    lines.append(f"│  {'AI enrichment suppressed':<30} : {WARN if current.ai_enrichment_suppressed else NO}")
    lines.append(f"│  {'Equifax secondary extracted':<30} : {NO} (secnaics1 always skipped)")
    lines.append(f"│  {'AML flags generated':<30} : {current.aml_flags_generated}  ← always 0")
    lines.append(f"│  {'Requires manual review':<30} : {NO}  (no flag mechanism)")
    lines.append("└" + "─" * (W - 1) + "┘")
    lines.append("")

    # --- XGBOOST MODEL INPUT ---
    if show_features:
        lines.append("┌─ XGBOOST MODEL INPUT (15-Feature Vector) " + "─" * (W - 44) + "┐")
        fv = consensus.feature_vector
        feat_pairs = list(zip(consensus.feature_names, fv.to_list()))
        for i in range(0, len(feat_pairs), 3):
            row = feat_pairs[i:i+3]
            parts = [f"  {n:<30} = {v}" for n, v in row]
            lines.append("│" + "  ".join(p for p in parts))
        lines.append("└" + "─" * (W - 1) + "┘")
        lines.append("")

    # --- XGBOOST MODEL OUTPUT ---
    lines.append("┌─ XGBOOST MODEL OUTPUT (Top-5 Probability Distribution) " + "─" * (W - 58) + "┐")
    lines.append(f"│  {'Rank':<4} {'Class Label':<28} {'Taxonomy':<14} {'Code':<8} {'Probability':>11}")
    lines.append(f"│  {'─'*4} {'─'*27} {'─'*13} {'─'*7} {'─'*11}")
    for c in consensus.top5_classifications:
        marker = " ← top-1" if c.rank == 1 else ""
        lines.append(
            f"│   #{c.rank:<3} {c.class_label:<28} {c.taxonomy:<14} {c.code:<8} {c.consensus_probability:>10.1%}{marker}"
        )
    lines.append(f"│")
    lines.append(f"│  Overall confidence : {consensus.overall_confidence:.1%}")
    lines.append(f"│  Model version      : {consensus.model_version}")

    if show_shap and consensus.shap_contributions:
        lines.append(f"│")
        lines.append(f"│  SHAP Feature Attribution (contribution to top-1 class):")
        sorted_shap = sorted(consensus.shap_contributions.items(), key=lambda x: abs(x[1]), reverse=True)
        for feat, val in sorted_shap[:5]:
            bar = "+" * min(int(abs(val) * 20), 20) if val > 0 else "-" * min(int(abs(val) * 20), 20)
            lines.append(f"│    {feat:<32} {val:+.4f}  {bar}")
    lines.append("└" + "─" * (W - 1) + "┘")
    lines.append("")

    # --- CONSENSUS ENGINE RISK FLAGS ---
    lines.append("┌─ CONSENSUS ENGINE — Risk Flags & AML Signals " + "─" * (W - 49) + "┐")
    if not consensus.risk_flags:
        lines.append(f"│  {YES} No risk flags triggered. Entity classified cleanly.")
    else:
        for f in consensus.risk_flags:
            icon = SEVERITY_ICONS.get(f.severity, "⚪")
            lines.append(f"│  {icon} {f.severity:<9} {f.flag_type}")
            lines.append(f"│             Score: {f.discrepancy_score:.2f}  |  AML Multiplier: {f.aml_risk_multiplier:.1f}×")
            lines.append(f"│             Triggers: {', '.join(f.triggering_sources)}")
    lines.append(f"│")
    lines.append(f"│  Combined AML multiplier     : {consensus.combined_aml_multiplier:.1f}×")
    lines.append(f"│  Requires manual review      : {'YES — BLOCKED' if consensus.requires_manual_review else 'No'}")
    lines.append(f"│  Recommended code            : {consensus.recommended_taxonomy}/{consensus.recommended_code}")
    lines.append(f"│  Recommended label           : {consensus.recommended_label}")
    lines.append("└" + "─" * (W - 1) + "┘")
    lines.append("")

    # --- Δ Summary ---
    current_correct = current.final_naics_code == entity.ground_truth_code or current.final_uk_sic_code == entity.ground_truth_code
    consensus_correct = consensus.recommended_code == entity.ground_truth_code
    lines.append("  Δ COMPARISON SUMMARY")
    lines.append(f"    Current code correct       : {YES if current_correct else NO}")
    lines.append(f"    Consensus code correct     : {YES if consensus_correct else NO}")
    lines.append(f"    AML flags: current={current.aml_flags_generated}  consensus={len([f for f in consensus.risk_flags if f.flag_type != 'AML_ENHANCED_DUE_DILIGENCE_TRIGGERED'])}")
    lines.append(f"    Signals discarded (current): {len(current.naics_discarded_signals) + len(current.secondary_codes_discarded)}")
    lines.append(f"    All signals used (consensus): {YES} — all {len(entity.sources)} signals fed into feature vector")
    lines.append("")

    return "\n".join(lines)


def generate_aggregate_table(
    entities: list[EntityInput],
    current_results: list[CurrentPipelineResult],
    consensus_results: list[ConsensusEngineResult],
) -> str:
    """Generates the aggregate comparison table across all 60 entities."""
    lines = []
    lines.append("\n" + "=" * 120)
    lines.append("AGGREGATE COMPARISON TABLE — ALL 60 ENTITIES")
    lines.append("=" * 120)
    lines.append(
        f"{'Business ID':<35} {'Country':<7} {'Arch':<5} "
        f"{'[CURRENT] naics_code':<22} {'uk_sic':<8} {'AML Flags':<10} "
        f"{'[CONSENSUS] Top-1 Code':<22} {'Prob':>6} {'Flags':>6} {'AML Mult':>9} {'Review?':<8}"
    )
    lines.append("─" * 120)

    by_arch: dict[str, list[tuple]] = {}

    for entity, cur, con in zip(entities, current_results, consensus_results):
        arch_short = entity.archetype[:3].upper()
        non_meta_flags = [f for f in con.risk_flags if f.flag_type != "AML_ENHANCED_DUE_DILIGENCE_TRIGGERED"]
        row = (
            f"{entity.business_id[:34]:<35} {entity.entity_country:<7} {arch_short:<5} "
            f"{cur.final_naics_code or 'None':<22} {cur.final_uk_sic_code or 'None':<8} {cur.aml_flags_generated:<10} "
            f"{con.recommended_code:<22} {con.recommended_probability:>5.1%} {len(non_meta_flags):>6} "
            f"{con.combined_aml_multiplier:>9.1f}  {'YES' if con.requires_manual_review else 'no':<8}"
        )
        lines.append(row)
        by_arch.setdefault(entity.archetype, []).append((entity, cur, con))

    lines.append("─" * 120)

    # Archetype-level summary
    lines.append("\nARCHETYPE SUMMARY")
    lines.append("─" * 90)
    lines.append(f"{'Archetype':<40} {'N':>3}  {'Cur Correct':>12}  {'Con Correct':>12}  {'Avg AML Mult':>14}  {'Reviews':>8}")
    lines.append("─" * 90)
    for arch, rows in by_arch.items():
        n = len(rows)
        cur_correct = sum(
            1 for (e, cur, con) in rows
            if cur.final_naics_code == e.ground_truth_code or cur.final_uk_sic_code == e.ground_truth_code
        )
        con_correct = sum(
            1 for (e, cur, con) in rows
            if con.recommended_code == e.ground_truth_code
        )
        avg_mult = sum(con.combined_aml_multiplier for (_, _, con) in rows) / n
        reviews = sum(1 for (_, _, con) in rows if con.requires_manual_review)
        lines.append(
            f"{arch[:39]:<40} {n:>3}  {cur_correct:>5}/{n:<6}  {con_correct:>5}/{n:<6}  "
            f"{avg_mult:>14.1f}  {reviews:>8}"
        )

    lines.append("─" * 90)
    total = len(entities)
    total_cur_correct = sum(
        1 for e, cur, con in zip(entities, current_results, consensus_results)
        if cur.final_naics_code == e.ground_truth_code or cur.final_uk_sic_code == e.ground_truth_code
    )
    total_con_correct = sum(
        1 for e, cur, con in zip(entities, current_results, consensus_results)
        if con.recommended_code == e.ground_truth_code
    )
    total_cur_aml = sum(cur.aml_flags_generated for cur in current_results)
    total_con_flags = sum(
        len([f for f in con.risk_flags if f.flag_type != "AML_ENHANCED_DUE_DILIGENCE_TRIGGERED"])
        for con in consensus_results
    )
    total_reviews = sum(1 for con in consensus_results if con.requires_manual_review)
    avg_mult = sum(con.combined_aml_multiplier for con in consensus_results) / total

    lines.append(
        f"{'TOTAL':<40} {total:>3}  {total_cur_correct:>5}/{total:<6}  {total_con_correct:>5}/{total:<6}  "
        f"{avg_mult:>14.1f}  {total_reviews:>8}"
    )
    lines.append(f"\n  Current pipeline  — total AML flags generated : {total_cur_aml}")
    lines.append(f"  Consensus engine  — total risk flags (non-meta): {total_con_flags}")
    lines.append(f"  Current pipeline  — entities blocked for review : 0")
    lines.append(f"  Consensus engine  — entities blocked for review : {total_reviews}")
    lines.append("=" * 120)

    return "\n".join(lines)
