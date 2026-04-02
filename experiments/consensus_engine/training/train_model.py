"""
XGBoost Training Pipeline
===========================
Trains the Consensus Engine model on the synthetic dataset and saves the 
calibrated model artifact. Also generates SHAP explainability values.

Model: XGBClassifier (multi-class, one class per candidate industry code)
Calibration: CalibratedClassifierCV with Platt scaling (sigmoid)
Explainability: SHAP TreeExplainer → per-source attribution

Note: This is a DEMONSTRATION model trained on 60 synthetic records.
The architecture is production-ready; only the training data volume is small.
Production retraining on real warehouse data (T2.3) will use ~1.1M records.
"""

from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pickle
import numpy as np
from typing import Optional

try:
    import xgboost as xgb
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.preprocessing import LabelEncoder
    from sklearn.model_selection import StratifiedKFold
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False

from data.synthetic_entities import generate_dataset, EntityInput
from features.feature_builder import ConsensusFeatureBuilder, FeatureVector, code_to_idx

# ---------------------------------------------------------------------------
# Target label mapping — we predict a "primary code bucket" for the entity
# ---------------------------------------------------------------------------
# Maps ground truth codes → a canonical label for multi-class training
LABEL_NORMALIZATION = {
    # UK SIC → canonical class
    "56101": "food_service_restaurant",
    "56102": "food_service_restaurant",
    "56103": "food_service_restaurant",
    "56210": "food_service_restaurant",
    "46390": "wholesale_food",
    "47110": "retail_grocery",
    "62020": "it_services",
    "62090": "it_services",
    "64205": "holding_company",
    "64209": "holding_company",
    "68209": "real_estate",
    "82990": "business_support",
    # NAICS → canonical class
    "722511": "food_service_restaurant",
    "722513": "food_service_restaurant",
    "722514": "food_service_restaurant",
    "424410": "wholesale_food",
    "424480": "wholesale_food",
    "311991": "food_manufacturing",
    "445291": "retail_grocery",
    "445110": "retail_grocery",
    "492210": "courier_delivery",
    "484110": "courier_delivery",
    "541512": "it_services",
    "541511": "it_services",
    "551112": "holding_company",
    "551114": "holding_company",
    "531120": "real_estate",
    "812990": "personal_services",
    "561499": "business_support",
}

CLASS_LABELS = [
    "food_service_restaurant",
    "wholesale_food",
    "food_manufacturing",
    "retail_grocery",
    "courier_delivery",
    "it_services",
    "holding_company",
    "real_estate",
    "personal_services",
    "business_support",
]



class TrainedModel:
    """
    Wrapper for the trained XGBoost model + supporting artifacts.
    Provides predict() and explain() methods for the experiment pipeline.
    """

    def __init__(self, model, calibrated_model, label_encoder, feature_names, shap_explainer=None):
        self.model = model
        self.calibrated = calibrated_model
        self.le = label_encoder
        self.feature_names = feature_names
        self.shap_explainer = shap_explainer
        self.class_labels = list(label_encoder.classes_)

    def predict_proba_top5(self, fv: FeatureVector) -> list[tuple[str, float]]:
        """Returns Top-5 (class_label, calibrated_probability) sorted descending."""
        X = np.array([fv.to_list()], dtype=float)
        proba = self.calibrated.predict_proba(X)[0]
        pairs = sorted(
            zip(self.class_labels, proba),
            key=lambda x: x[1], reverse=True
        )
        return pairs[:5]

    def shap_contributions(self, fv: FeatureVector) -> Optional[dict[str, float]]:
        """Returns per-feature SHAP contribution for the top predicted class."""
        if self.shap_explainer is None:
            return None
        X = np.array([fv.to_list()], dtype=float)
        try:
            shap_values = self.shap_explainer.shap_values(X)
            # Multi-class: shap_values is a list of arrays (one per class)
            # Take the SHAP values for the top predicted class
            top_class_idx = int(self.calibrated.predict(X)[0])
            if isinstance(shap_values, list):
                sv = shap_values[top_class_idx][0]
            else:
                sv = shap_values[0]
            return {name: round(float(val), 4) for name, val in zip(self.feature_names, sv)}
        except Exception:
            return None

    def save(self, path: str) -> None:
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, path: str) -> "TrainedModel":
        with open(path, "rb") as f:
            return pickle.load(f)


def build_training_data(entities: list[EntityInput]) -> tuple[np.ndarray, np.ndarray, list[str], list[FeatureVector]]:
    """
    Builds feature matrix X and label vector y from the synthetic dataset.
    Returns: X, y_encoded, class_labels_used, feature_vectors
    """
    builder = ConsensusFeatureBuilder()
    feature_vectors = []
    labels = []

    for entity in entities:
        fv = builder.build(entity)
        feature_vectors.append(fv)
        label = LABEL_NORMALIZATION.get(entity.ground_truth_code, "business_support")
        labels.append(label)

    X = np.array([fv.to_list() for fv in feature_vectors], dtype=float)
    le = LabelEncoder()
    # Fit only on labels actually present to ensure contiguous 0..N-1 labels for XGBoost
    y = le.fit_transform(labels)

    return X, y, le, feature_vectors


def train(entities: list[EntityInput], verbose: bool = True) -> TrainedModel:
    """
    Full training pipeline: XGBoost → Platt calibration → SHAP explainer.
    """
    if not HAS_XGBOOST:
        raise ImportError("xgboost and scikit-learn are required. Install with: pip install xgboost scikit-learn")

    X, y, le, feature_vectors = build_training_data(entities)
    n_classes = len(le.classes_)
    feature_names = FeatureVector.feature_names()

    if verbose:
        print(f"\n[TRAINING] XGBoost Consensus Engine (demo model)")
        print(f"  Training samples : {len(X)}")
        print(f"  Features         : {len(feature_names)}")
        print(f"  Classes          : {n_classes} → {list(le.classes_)}")
        print(f"  Feature names    : {feature_names}")

    # --- XGBoost base model ---
    base_model = xgb.XGBClassifier(
        objective="multi:softprob",
        num_class=n_classes,
        n_estimators=150,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="mlogloss",
        random_state=42,
        verbosity=0,
    )
    base_model.fit(X, y)

    # --- Platt scaling calibration ---
    # With small datasets, use cross-val=3 to avoid overfitting calibration
    cv = min(3, min(np.bincount(y)))
    cv = max(cv, 2)
    calibrated = CalibratedClassifierCV(base_model, method="sigmoid", cv=cv)
    calibrated.fit(X, y)

    if verbose:
        train_preds = calibrated.predict(X)
        accuracy = float(np.mean(train_preds == y))
        print(f"  Train accuracy   : {accuracy:.1%} (demo — not for production evaluation)")

    # --- SHAP explainer ---
    shap_explainer = None
    if HAS_SHAP:
        try:
            shap_explainer = shap.TreeExplainer(base_model)
            if verbose:
                print(f"  SHAP explainer   : TreeExplainer loaded ✓")
        except Exception as e:
            if verbose:
                print(f"  SHAP explainer   : Not available ({e})")

    if verbose and not HAS_SHAP:
        print(f"  SHAP explainer   : Not installed (pip install shap for source attribution)")

    return TrainedModel(
        model=base_model,
        calibrated_model=calibrated,
        label_encoder=le,
        feature_names=feature_names,
        shap_explainer=shap_explainer,
    )


# ---------------------------------------------------------------------------
# Map canonical class labels back to representative codes for output
# ---------------------------------------------------------------------------
CLASS_TO_REPRESENTATIVE_CODE = {
    "food_service_restaurant": ("uk_sic_2007", "56101", "Licensed restaurants and cafes"),
    "wholesale_food":           ("naics_2022",  "424410", "General Line Grocery Merchant Wholesalers"),
    "food_manufacturing":       ("naics_2022",  "311991", "Perishable Prepared Food Manufacturing"),
    "retail_grocery":           ("naics_2022",  "445110", "Supermarkets and Other Grocery Retailers"),
    "courier_delivery":         ("naics_2022",  "492210", "Local Messengers and Local Delivery"),
    "it_services":              ("uk_sic_2007", "62020",  "Information technology consultancy activities"),
    "holding_company":          ("naics_2022",  "551112", "Offices of Other Holding Companies"),
    "real_estate":              ("naics_2022",  "531120", "Lessors of Nonresidential Buildings"),
    "personal_services":        ("naics_2022",  "812990", "All Other Personal Services"),
    "business_support":         ("naics_2022",  "561499", "All Other Business Support Services"),
}
