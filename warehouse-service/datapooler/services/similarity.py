"""
ML-Powered Similarity Scoring for Entity Matching.

Implements feature engineering and XGBoost-based prediction for determining
whether two business entities represent the same real-world business.

Feature Types:
1. **Perfect Match Features**: Binary flags for exact attribute matches
   - Postal code, city, street number, full address

2. **Jaccard Similarity**: Text similarity using character n-grams (k=1,2,3,4)
   - Business name, street name, short name
   - Word-level Jaccard for business names

3. **Distance Features**: Numeric distance calculations
   - Street number distance
   - Street block matching (same hundred-block)

Model: XGBoost classifier trained on labeled match/non-match pairs
Output: Probability score (0-1) that entities match
"""

import logging
from typing import Any, Self, Sequence

import polars as pl
from pydantic import BaseModel, Field
from xgboost import XGBClassifier

from datapooler import config
from datapooler.models import businesses
from datapooler.services.extra_verification import (
    ExtraVerificationInfo,
    ExtraVerificationService,
)


class SimilarityResult(BaseModel):
    """Result of similarity prediction for a business pair."""

    integration_business: dict[str, Any]
    prediction: float
    extra_verification: ExtraVerificationInfo = Field(default_factory=ExtraVerificationInfo)

    @classmethod
    def with_extra_verification(
        cls,
        worth_business: businesses.WorthBusiness,
        integration_business: businesses.IntegrationBusiness | businesses.WorthBusiness,
        prediction: float,
    ) -> Self:
        """
        Create a SimilarityResult instance with extra verification info.


        This method allows for a clean loop in the SimilarityModelService.predict method.
        """
        extra_verification = ExtraVerificationService(worth_business, integration_business).verify()

        return cls(
            integration_business=integration_business.model_dump(
                mode="json", exclude=businesses.EXCLUDE_FIELDS
            ),
            prediction=prediction,
            extra_verification=extra_verification,
        )


# Default distance when street number is missing or cannot be calculated
FALLBACK_DISTANCE_NUMBER = 99999

# Attributes that support exact binary matching
PERFECT_MATCH_ATTRIBUTES = (
    "normalized_zip",
    "city",
    "street_number",
    "address",
)

# Attributes that use Jaccard similarity with character n-grams
# Format: {attribute: (unnormalized_prefix, normalized_prefix)}
JACCARD_SIMILARITY_ATTRIBUTES = {
    "business_name": ("similarity_jaccard", "sim_norm_jac"),
    "street_name": ("similarity_street_name", "sim_norm_street_name"),
    "short_name": ("similarity_short_name", "sim_norm_short_name"),
}

# Complete feature set used by the XGBoost model (35 features total)
SIMILARITY_FEATURES = [
    "match_normalized_zip",
    "match_city",
    "match_street_number",
    "match_street_block",
    "distance_street_number",
    "match_address",
    "match_short_name",
    "similarity_street_name_k1",
    "similarity_street_name_k2",
    "similarity_street_name_k3",
    "similarity_street_name_k4",
    "similarity_jaccard_k1",
    "similarity_jaccard_k2",
    "similarity_jaccard_k3",
    "similarity_jaccard_k4",
    "similarity_jaccard_word",
    "similarity_short_name_k1",
    "similarity_short_name_k2",
    "similarity_short_name_k3",
    "similarity_short_name_k4",
    "sim_norm_street_name_k1",
    "sim_norm_street_name_k2",
    "sim_norm_street_name_k3",
    "sim_norm_street_name_k4",
    "sim_norm_jac_k1",
    "sim_norm_jac_k2",
    "sim_norm_jac_k3",
    "sim_norm_jac_k4",
    "sim_norm_jac_word",
    "sim_norm_short_name_k1",
    "sim_norm_short_name_k2",
    "sim_norm_short_name_k3",
    "sim_norm_short_name_k4",
]


class SimilarityFeatureService:
    """
    Feature engineering service for entity matching.

    Computes similarity features for all potential business pairs:
    - Perfect match flags (zip, city, street number, address)
    - Street block matching
    - Jaccard similarity for names (k=1,2,3,4 character n-grams)
    - Street number distance

    Features are computed using Polars for performance on large datasets.
    """

    def __init__(
        self, c_businesses: businesses.ComparisonBusiness | businesses.SimpleComparisonBusiness
    ):
        self.businesses = c_businesses
        self.potential_matches = c_businesses.potential_matches()
        self.features: pl.DataFrame

        self._logger = logging.getLogger(__name__ + "." + self.__class__.__name__)

        self._been_set: bool = False

    def pairs(
        self,
    ) -> Sequence[
        tuple[businesses.WorthBusiness, businesses.IntegrationBusiness | businesses.WorthBusiness]
    ]:
        return self.potential_matches.keys()

    def _set_perfect_match(
        self,
        worth_business: businesses.WorthBusiness,
        integration_business: businesses.IntegrationBusiness,
    ) -> None:

        perfect_matches = {
            f"match_{attr}": getattr(worth_business, attr) == getattr(integration_business, attr)
            for attr in PERFECT_MATCH_ATTRIBUTES
        }

        self.potential_matches[(worth_business, integration_business)].update(perfect_matches)

    def _set_block_matches(
        self,
        worth_business: businesses.WorthBusiness,
        integration_business: businesses.IntegrationBusiness,
    ) -> None:

        # if the street number is missing, set to False
        if not worth_business.street_number or not integration_business.street_number:
            self.potential_matches[(worth_business, integration_business)][
                "match_street_block"
            ] = False
            return

        try:
            self.potential_matches[(worth_business, integration_business)]["match_street_block"] = (
                int(worth_business.street_number) // 100
                == int(integration_business.street_number) // 100
            )
        except Exception:
            self._logger.exception(
                f"Failed to calculate block match for {worth_business} and {integration_business}",
            )

            self.potential_matches[(worth_business, integration_business)][
                "match_street_block"
            ] = False

    def _set_short_name_match(
        self,
        worth_business: businesses.WorthBusiness,
        integration_business: businesses.IntegrationBusiness,
    ) -> None:
        try:
            if len(worth_business.short_name) == 0 or len(integration_business.short_name) == 0:
                self.potential_matches[(worth_business, integration_business)][
                    "match_short_name"
                ] = False
                return

            self.potential_matches[(worth_business, integration_business)]["match_short_name"] = (
                worth_business.short_name in integration_business.short_name
                or integration_business.short_name in worth_business.short_name
            )

        except Exception:
            self._logger.exception(
                f"Failed to calculate short name match for {worth_business} and {integration_business}",  # noqa
            )
            self.potential_matches[(worth_business, integration_business)][
                "match_short_name"
            ] = False

    def _set_numerical_distance(
        self,
        worth_business: businesses.WorthBusiness,
        integration_business: businesses.IntegrationBusiness,
    ) -> None:
        try:
            if worth_business.street_number is None or integration_business.street_number is None:
                self.potential_matches[(worth_business, integration_business)][
                    "distance_street_number"
                ] = FALLBACK_DISTANCE_NUMBER
                return

            self.potential_matches[(worth_business, integration_business)][
                "distance_street_number"
            ] = abs(int(worth_business.street_number) - int(integration_business.street_number))

        except Exception:
            self._logger.exception(
                f"Failed to calculate numerical distance for {worth_business} and {integration_business}",  # noqa
            )
            self.potential_matches[(worth_business, integration_business)][
                "distance_street_number"
            ] = FALLBACK_DISTANCE_NUMBER

    def _set_jac_similarity(
        self,
        worth_business: businesses.WorthBusiness,
        integration_business: businesses.IntegrationBusiness,
    ) -> list[float]:
        """
        Given input sets calculates the jaccard similarity as:
        the number of elements in common / total number of unique elements.

        Also calculates how much of the smallest set is captured in the intersection.
        """
        for attr, (sim_name, norm_name) in JACCARD_SIMILARITY_ATTRIBUTES.items():
            worth_shingle = getattr(worth_business, f"{attr}_shingles")
            integraion_shingle = getattr(integration_business, f"{attr}_shingles")

            # Special case for business name, where we also generate by_word.
            if attr == "business_name":
                sim, norm = self.calculate_jac_similarity(
                    worth_shingle["by_word"], integraion_shingle["by_word"]
                )
                self.potential_matches[(worth_business, integration_business)][
                    f"{sim_name}_word"
                ] = sim
                self.potential_matches[(worth_business, integration_business)][
                    f"{norm_name}_word"
                ] = norm

            # Calculate similarity for k=1, 2, 3, 4.
            for k in range(1, 5):
                similarities, normalized = self.calculate_jac_similarity(
                    worth_shingle[f"k{k}"], integraion_shingle[f"k{k}"]
                )
                self.potential_matches[(worth_business, integration_business)][
                    f"{sim_name}_k{k}"
                ] = similarities
                self.potential_matches[(worth_business, integration_business)][
                    f"{norm_name}_k{k}"
                ] = normalized

        return similarities, normalized

    def calculate_jac_similarity(
        self, worth_set: set[str], integration_set: set[str]
    ) -> tuple[float, float]:
        """
        Given input sets calculates the jaccard similarity as:
        the number of elements in common / total number of unique elements.

        Also calculates how much of the smallest set is captured in the intersection.
        """
        if "" in worth_set or "" in integration_set:
            return 0.0, 0.0

        similarities = (
            1.0
            * len(worth_set.intersection(integration_set))
            / len(worth_set.union(integration_set))
        )
        normalized = (
            1.0
            * len(worth_set.intersection(integration_set))
            / min(len(worth_set), len(integration_set))
        )

        return similarities, normalized

    def set_features(self) -> Self:

        # This method is mutatable to potential_matches

        if self._been_set:
            return self

        for worth_business, integration_business in self.potential_matches.keys():
            self._set_perfect_match(worth_business, integration_business)
            self._set_block_matches(worth_business, integration_business)
            self._set_short_name_match(worth_business, integration_business)
            self._set_numerical_distance(worth_business, integration_business)
            self._set_jac_similarity(worth_business, integration_business)

        self.features = pl.DataFrame([*self.potential_matches.values()]).select(SIMILARITY_FEATURES)

        self._been_set = True

        return self

    @property
    def no_candidates(self) -> bool:
        return len(self.potential_matches.keys()) == 0


class SimilarityModelService:
    def __init__(self, model_override: XGBClassifier = None):
        self._logger = logging.getLogger(__name__ + "." + self.__class__.__name__)
        self._model = model_override or XGBClassifier()
        self._load_model()

    def _load_model(self) -> XGBClassifier:
        if config.similarity_model_path is None:
            raise ValueError("No similarity model path provided!")

        self._model.load_model(config.similarity_model_path)

    def predict(
        self,
        pairs: Sequence[tuple[businesses.WorthBusiness, businesses.IntegrationBusiness]],
        features: pl.DataFrame,
    ) -> list[SimilarityResult]:
        return [
            SimilarityResult.with_extra_verification(
                worth_business, integration_business, prediction
            )
            for (worth_business, integration_business), prediction in zip(
                pairs, self._model.predict_proba(features[SIMILARITY_FEATURES])[:, 1]
            )
        ]

    def predict_one(
        self,
        worth_business: businesses.WorthBusiness,
        other: businesses.IntegrationBusiness | businesses.WorthBusiness,
    ) -> SimilarityResult:
        simple_c_business = businesses.SimpleComparisonBusiness(worth=worth_business, other=other)

        feature_service = SimilarityFeatureService(simple_c_business).set_features()

        return SimilarityResult.with_extra_verification(
            worth_business,
            other,
            self._model.predict_proba(feature_service.features[SIMILARITY_FEATURES])[0, 1],
        )
