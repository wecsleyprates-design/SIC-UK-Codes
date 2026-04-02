"""
Consensus Engine Experiment — Main Entry Point
=================================================
Run with:   python run_experiment.py
            python run_experiment.py --verbose         (show all 60 entity traces)
            python run_experiment.py --archetype A4    (filter to one archetype)

Produces:
  results/comparison_report.md    — Full side-by-side markdown report
  results/current_output.json     — Structured current pipeline outputs
  results/consensus_output.json   — Structured consensus engine outputs
  results/features_table.json     — XGBoost feature vectors (model inputs)
"""

from __future__ import annotations
import argparse, json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))

from data.synthetic_entities import generate_dataset
from pipeline.current_pipeline import run_current_pipeline
from pipeline.consensus_engine import run_consensus_engine
from training.train_model import train, build_training_data, CLASS_TO_REPRESENTATIVE_CODE
from features.feature_builder import ConsensusFeatureBuilder
from output.report import print_entity_comparison, generate_aggregate_table


def build_current_output_record(entity, result) -> dict:
    return {
        "business_id": result.business_id,
        "entity_name": result.entity_name,
        "entity_country": result.entity_country,
        "archetype": entity.archetype,
        "PIPELINE_OUTPUT": {
            "naics_code": result.final_naics_code,
            "uk_sic_code": result.final_uk_sic_code,
            "mcc_code": result.final_mcc_code,
            "aml_flags_generated": result.aml_flags_generated,
            "requires_manual_review": False,
        },
        "WHAT_WAS_DISCARDED": {
            "secondary_codes_lost": [
                {"source": s.source, "code": s.raw_code, "label": s.raw_label}
                for s in result.secondary_codes_discarded
            ],
            "naics_losers": [
                {"source": s.source, "code": s.raw_code, "conf": s.confidence}
                for s in result.naics_discarded_signals
            ],
            "trulioo_pollution_passed_unchallenged": result.trulioo_pollution_detected,
            "equifax_secondary_naics_extracted": result.equifax_secondary_extracted,
            "ai_enrichment_suppressed": result.ai_enrichment_suppressed,
            "holding_company_signal_in_discards": result.holding_company_code_in_discards,
        },
        "RESOLUTION_TRACE": [
            {
                "step": s.step_num,
                "challenger": f"{s.challenger_source}:{s.challenger_code} ({s.challenger_conf:.2f})",
                "incumbent":  f"{s.incumbent_source}:{s.incumbent_code} ({s.incumbent_conf:.2f})",
                "conf_diff": s.conf_diff,
                "outcome": s.outcome,
            }
            for s in result.naics_resolution_steps
        ],
    }


def build_consensus_output_record(entity, feature_vector, result) -> dict:
    return {
        "business_id": result.business_id,
        "entity_name": result.entity_name,
        "entity_country": result.entity_country,
        "archetype": entity.archetype,
        "MODEL_INPUT_FEATURES": dict(zip(result.feature_names, feature_vector.to_list())),
        "MODEL_OUTPUT_TOP5": [
            {
                "rank": c.rank,
                "class_label": c.class_label,
                "taxonomy": c.taxonomy,
                "code": c.code,
                "label": c.label,
                "probability": c.consensus_probability,
            }
            for c in result.top5_classifications
        ],
        "SHAP_ATTRIBUTION": result.shap_contributions,
        "RISK_FLAGS": [
            {
                "flag_type": f.flag_type,
                "severity": f.severity,
                "description": f.description,
                "triggering_sources": f.triggering_sources,
                "discrepancy_score": f.discrepancy_score,
                "aml_risk_multiplier": f.aml_risk_multiplier,
                "recommended_action": f.recommended_action,
            }
            for f in result.risk_flags
        ],
        "PIPELINE_OUTPUT": {
            "recommended_taxonomy": result.recommended_taxonomy,
            "recommended_code": result.recommended_code,
            "recommended_label": result.recommended_label,
            "recommended_probability": result.recommended_probability,
            "overall_confidence": result.overall_confidence,
            "combined_aml_multiplier": result.combined_aml_multiplier,
            "requires_manual_review": result.requires_manual_review,
            "model_version": result.model_version,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Consensus Engine Experiment")
    parser.add_argument("--verbose", action="store_true", help="Show all 60 entity traces")
    parser.add_argument("--archetype", default=None, help="Filter to archetype prefix (e.g. A4)")
    parser.add_argument("--no-shap", action="store_true", help="Skip SHAP (faster)")
    args = parser.parse_args()

    os.makedirs("results", exist_ok=True)

    print("\n" + "═" * 74)
    print("  WORTH AI — CONSENSUS ENGINE EXPERIMENT")
    print("  Current Pipeline vs. XGBoost Consensus Engine")
    print("═" * 74)

    # -----------------------------------------------------------------------
    # 1. Generate dataset
    # -----------------------------------------------------------------------
    print("\n[1/5] Generating synthetic dataset...")
    dataset = generate_dataset()
    print(f"  ✓ {len(dataset)} entities across 6 archetypes")

    if args.archetype:
        dataset = [e for e in dataset if args.archetype.lower() in e.archetype.lower()]
        print(f"  → Filtered to {len(dataset)} entities matching archetype '{args.archetype}'")

    # -----------------------------------------------------------------------
    # 2. Run current pipeline on all entities
    # -----------------------------------------------------------------------
    print("\n[2/5] Running CURRENT PIPELINE (factWithHighestConfidence)...")
    t0 = time.time()
    current_results = [run_current_pipeline(e) for e in dataset]
    print(f"  ✓ {len(current_results)} entities processed in {time.time()-t0:.2f}s")
    aml_total = sum(r.aml_flags_generated for r in current_results)
    holding_missed = sum(1 for r in current_results if r.holding_company_code_in_discards)
    pollution_missed = sum(1 for r in current_results if r.trulioo_pollution_detected)
    print(f"  → AML flags generated       : {aml_total}  (always 0)")
    print(f"  → Holding company signals missed : {holding_missed}")
    print(f"  → Trulioo pollution undetected   : {pollution_missed}")

    # -----------------------------------------------------------------------
    # 3. Train XGBoost model
    # -----------------------------------------------------------------------
    print("\n[3/5] Training XGBoost Consensus Engine model...")
    model = train(generate_dataset(), verbose=True)  # Always train on full dataset
    print(f"  ✓ Model trained successfully")

    # -----------------------------------------------------------------------
    # 4. Run Consensus Engine on all entities
    # -----------------------------------------------------------------------
    print("\n[4/5] Running CONSENSUS ENGINE (XGBoost + Discrepancy Detection)...")
    t0 = time.time()
    consensus_results = [run_consensus_engine(e, model) for e in dataset]
    print(f"  ✓ {len(consensus_results)} entities processed in {time.time()-t0:.2f}s")
    reviews_needed = sum(1 for r in consensus_results if r.requires_manual_review)
    total_flags = sum(
        len([f for f in r.risk_flags if f.flag_type != "AML_ENHANCED_DUE_DILIGENCE_TRIGGERED"])
        for r in consensus_results
    )
    print(f"  → Total risk flags generated  : {total_flags}")
    print(f"  → Entities blocked for review : {reviews_needed}")

    # -----------------------------------------------------------------------
    # 5. Generate comparison report
    # -----------------------------------------------------------------------
    print("\n[5/5] Generating comparison report...")
    builder = ConsensusFeatureBuilder()

    current_json = []
    consensus_json = []
    features_json = []
    report_lines = []

    show_entity_detail = args.verbose or args.archetype is not None
    archetypes_to_show_full = {"A4_restaurant_holding_aml", "A5_shell_holding_company"}

    for entity, cur, con in zip(dataset, current_results, consensus_results):
        fv = builder.build(entity)
        current_json.append(build_current_output_record(entity, cur))
        consensus_json.append(build_consensus_output_record(entity, fv, con))
        features_json.append({
            "business_id": entity.business_id,
            "archetype": entity.archetype,
            **dict(zip(fv.feature_names(), fv.to_list()))
        })

        # Show detailed trace for: all if --verbose, filtered if --archetype, AML archetypes always
        if show_entity_detail or entity.archetype in archetypes_to_show_full:
            block = print_entity_comparison(
                entity, cur, con,
                show_features=True,
                show_shap=not args.no_shap,
            )
            report_lines.append(block)
            print(block)

    # Aggregate table (always shown)
    agg = generate_aggregate_table(dataset, current_results, consensus_results)
    report_lines.append(agg)
    print(agg)

    # -----------------------------------------------------------------------
    # Write output files
    # -----------------------------------------------------------------------
    with open("results/current_output.json", "w") as f:
        json.dump(current_json, f, indent=2)

    with open("results/consensus_output.json", "w") as f:
        json.dump(consensus_json, f, indent=2)

    with open("results/features_table.json", "w") as f:
        json.dump(features_json, f, indent=2)

    with open("results/comparison_report.md", "w") as f:
        f.write("# Consensus Engine Experiment — Comparison Report\n\n")
        f.write("```\n")
        f.write("\n\n".join(report_lines))
        f.write("\n```\n")

    print("\n" + "═" * 74)
    print("  EXPERIMENT COMPLETE")
    print(f"  results/current_output.json     — current pipeline outputs")
    print(f"  results/consensus_output.json   — consensus engine outputs (model I/O)")
    print(f"  results/features_table.json     — XGBoost feature vectors (model inputs)")
    print(f"  results/comparison_report.md    — full comparison report")
    print("═" * 74 + "\n")


if __name__ == "__main__":
    main()
