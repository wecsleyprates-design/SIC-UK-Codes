# Consensus Engine Experiment

This experiment side-by-side compares the **Current Pipeline** (`factWithHighestConfidence`) with the **New Consensus Engine** (XGBoost + Discrepancy Detection).

## Structure
- `data/`: Synthetic entity generator (60 entities, 6 archetypes).
- `pipeline/`:
  - `current_pipeline.py`: Simulation of existing logic.
  - `consensus_engine.py`: Proposed XGBoost + Discrepancy Detection logic.
- `features/`: `ConsensusFeatureBuilder` (15 features).
- `training/`: XGBoost training and calibration.
- `output/`: Report generation.

## How to Run
```bash
cd experiments/consensus_engine
python run_experiment.py
```

## Outputs
- `results/comparison_report.md`: Full side-by-side comparison.
- `results/consensus_output.json`: Structured model inputs/outputs.
- `results/current_output.json`: Baseline outputs for comparison.
