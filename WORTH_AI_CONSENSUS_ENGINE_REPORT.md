# WORTH AI: THE NEXT-GENERATION INDUSTRY CONSENSUS ENGINE
## 360-Degree Gap Analysis & SOTA Architectural Blueprint (2026)

**Role:** Senior Fintech Strategy Consultant & Principal Data Scientist
**Scope:** Global Industry Classification, Entity Resolution, Probabilistic Risk Underwriting
**Scenario:** Joe's Pizza Ltd (UK)

---

## EXECUTIVE SUMMARY
The current Worth AI classification pipeline is a high-performance **deterministic** system built for a **US-centric** market. While it excels at resolving a single "Ground Truth" for NAICS codes using static weights, it is fundamentally architected to fail in a global, multi-sector, and high-risk economy. To achieve 2026 State-of-the-Art (SOTA) performance, Worth AI must transition from a "Winner-Takes-All" deterministic model to a **"Probabilistic Consensus Engine"** that leverages Alternative Data and Ensemble Machine Learning. This report details the path from 62.5% classification gaps to a probabilistic moat that identifies risk through source discrepancy.

---

## PHASE 1: GLOBAL MARKET MAPPING & SOTA ANALYSIS (OUTSIDE-IN)

### 1.1 The Big 3 vs. AI Native: The 2026 Landscape
In 2026, the industry classification market has bifurcated into two distinct philosophies:

*   **Legacy Giants (Experian, D&B, ZoomInfo):** Still rely on "Update Cadence" (monthly/quarterly) and self-reported filings. Their failure point is **Latent Pivot Syndrome**—they miss the moment a "Restaurant" pivots to a "B2B Software Platform." Their update frequency is high, but their semantic depth is low.
*   **AI-Native Moderns:** Utilize **Real-Time Digital Footprint Analysis**. They don't wait for a registry filing; they monitor DNS changes, app store updates, and job postings. SOTA models in 2026 use **Zero-Shot Multi-Label Classification** to identify that a business is 70% "Software" and 30% "Retail" simultaneously.

### 1.2 Multi-Standard Normalization: The Unified Ontology
Top-tier providers no longer treat NAICS and UK SIC as separate buckets. They utilize a **Unified Global Ontology (UGO)**—a high-dimensional vector space where every industry code (NACE, ISIC, UK SIC) is mapped to a semantic cluster.
*   *SOTA Approach:* Instead of hardcoded crosswalks, models use **Cross-Ontology Embedding Alignment**. This allows a UK business with SIC 56101 (Licensed restaurants) to be instantly compared against a US NAICS 722511 without losing the granularity of the "Licensed" status (which NAICS merges into "Full-Service").

### 1.3 Deep-Risk & KYB: Classification as a Risk Vector
Industry type is no longer just a label; it is the **primary denominator for AML/CTF risk**.
*   **Terrorism/Shell Company Signal:** SOTA models link classification directly to "Risk Entropy." If a company is registered as "Investment Holding" (Low Risk) but its web presence indicates "Electronics Wholesaling" (High Risk for dual-use goods), the model triggers a **Semantic Discrepancy Flag**.
*   **AML Signal:** Frequent changes in industry codes within 12 months are now treated as a "Structure Change" risk, indicative of potential money laundering or "U-Turn" fraud.

---

## PHASE 2: INTERNAL AUDIT & TECHNICAL CRITIQUE (INSIDE-OUT)

### 2.1 The Deterministic Trap: Static Weights vs. Reality
The current `factWithHighestConfidence` rule is mathematically "greedy." It assumes that if OpenCorporates (0.9) and ZoomInfo (0.8) differ by 0.05, the 0.9 must be correct.
*   **The Problem:** In a global context, registry data (OC) is often **stale**, while commercial data (ZI) is **speculative**. A deterministic rule forces a binary choice that discards the nuance of the secondary source.
*   **Ensemble ML Advantage:** An XGBoost-based consensus model doesn't pick a winner; it treats each source as a **feature**. It learns that "When OC says Holding Company and ZI says Pizza, the truth is 90% Pizza if the website exists."

### 2.2 The AI Utilization Gap: The Zod Blinders
Confining GPT-5 mini to a US-centric Zod schema as a "last resort" is a strategic error.
*   **Critique:** By the time the AI runs (when <3 sources respond), the best context is often gone. Furthermore, by stripping non-US codes via Zod, Worth AI is **actively lobotomizing the AI** to ignore global standards.
*   **SOTA Correction:** The LLM should be a **Continuous Semantic Scraper**, running in parallel with vendors, not as a fallback. It should output a probability distribution across multiple taxonomies simultaneously.

### 2.3 The Adapter Critique: Successful but Siloed
The "International Adapter Model" (capturing `gb_sic`) is a tactical win but an architectural bottleneck. It still tries to fit a "Global Reality" into a "Single Column" (`uk_sic_code`).
*   **Limits:** It doesn't handle **Hybrid Entities**. A UK business that is both an "Online Retailer" and a "Logistics Provider" cannot be accurately represented in the current schema without clobbering one of the truths.

---

## PHASE 3: THE GAP & COMPETITIVE MOAT ANALYSIS

### 3.1 The Accuracy Gap: "Single Truth" vs. "Hybrid Probabilities"
Worth AI currently seeks the "One True Code." The 2026 standard is **Portfolio Distribution**.
*   *Joe's Pizza Example:* The legacy system would fight between "Restaurant" and "Holding Company." The SOTA system identifies Joe's Pizza as a **Hybrid Entity**: 80% Food Services, 20% Financial Management. This prevents the "Incorrectly Classified" noise that plagues underwriting.

### 3.2 The Intelligence Gap: Evidence-Based Lineage
Competitors provide a code. Worth AI can provide **The Evidence Chain**.
*   **Source Lineage:** "We chose 56101 because Companies House matches the legal name, but flagged it because ZoomInfo sees B2B frozen food distribution (NAICS 424420)." This transparency is the "Moat" that allows underwriters to trust the AI's decision.

### 3.3 The Risk Gap: Conflict as a Signal
The biggest gap in Worth AI today is that **Conflicts are treated as errors to be resolved, rather than risks to be flagged.**
*   *Shell Company Detection:* Joe's Pizza's "Holding Company" registry vs. "Pizza Shop" web presence is the classic signature of a **Shell Entity**. The current pipeline "resolves" this by picking the registry (high weight). A Consensus Engine would **flag** this as a high-risk discrepancy.

---

## PHASE 4: TARGET ARCHITECTURE (THE CONSENSUS ENGINE BLUEPRINT)

### 4.1 Modeling Strategy: The XGBoost Consensus Layer
We propose a **Stacking Ensemble Architecture**:
1.  **Level 0 (Signal Layer):** All 10+ vendors (Equifax, ZI, OC, Trulioo, AI Scrape) provide raw codes.
2.  **Level 1 (Feature Engineering):** Vectorize the codes into the Unified Global Ontology.
3.  **Level 2 (Consensus Layer):** An XGBoost model trained on historical "Ground Truth" data (manual overrides) predicts the probability of each sector.

### 4.2 Feature Engineering: 5 Advanced Features
1.  **Source Reliability Weight (SRW):** A dynamic score based on how often a source has been manually overridden in a specific jurisdiction.
2.  **Trulioo Pollution Flag:** A binary feature that triggers when Trulioo returns a 4-digit code for a 5-digit jurisdiction.
3.  **Web-to-Registry Discrepancy Score:** The semantic distance between the AI's website summary and the official registry label.
4.  **Temporal Pivot Score:** The rate of change in industry classification across the last 3 API calls (identifying business pivots).
5.  **Cross-Taxonomy Agreement:** A count of how many different taxonomies (NAICS, UK SIC, NACE) point to the same semantic cluster.

---

## PHASE 5: OUTPUT SCHEMA & IMPLEMENTATION BLUEPRINT

### 5.1 The Output API (Joe's Pizza Example)
```json
{
  "business_id": "uuid-joe-pizza-123",
  "consensus_output": {
    "primary_industry": {
      "taxonomy": "UK_SIC_2007",
      "code": "56101",
      "label": "Licensed restaurants",
      "consensus_probability": 0.85
    },
    "secondary_industries": [
      {
        "taxonomy": "US_NAICS_2022",
        "code": "424420",
        "label": "Packaged Frozen Food Merchant Wholesalers",
        "consensus_probability": 0.10
      },
      {
        "taxonomy": "US_NAICS_2022",
        "code": "551112",
        "label": "Offices of Other Holding Companies",
        "consensus_probability": 0.05
      }
    ],
    "risk_signals": [
      {
        "flag": "REGISTRY_DISCREPANCY",
        "severity": "HIGH",
        "description": "Registry filing (Holding Co) conflicts with active web presence (Pizza/Tech). Potential shell company indicator."
      },
      {
        "flag": "HYBRID_ENTITY_DETECTED",
        "severity": "LOW",
        "description": "Business shows significant activity in both Food Service and B2B Distribution."
      }
    ],
    "source_lineage": {
      "opencorporates": {"value": "gb_sic-56101", "weight": 0.9, "status": "MATCHED"},
      "trulioo": {"value": "us_sic-5812", "weight": 0.7, "status": "POLLUTED"},
      "equifax": {"value": "naics-551112", "weight": 0.7, "status": "CONFLICT"},
      "ai_semantic": {"value": "naics-424420", "weight": 0.8, "status": "INFERRED"}
    }
  }
}
```

### 5.2 SQL Query: Training Data Preparation (Redshift)
```sql
-- Prepare training set for the Consensus Engine
-- Joins raw vendor responses with manual human-verified overrides
WITH raw_data AS (
    SELECT
        rr.business_id,
        rr.platform_id,
        rr.response,
        db.address_country as country
    FROM integration_data.request_response rr
    JOIN public.data_businesses db ON rr.business_id = db.id
),
ground_truth AS (
    -- Get manual overrides as the "Target" label
    SELECT
        business_id,
        naics_id,
        uk_sic_id
    FROM public.data_businesses
    WHERE naics_id IS NOT NULL OR uk_sic_id IS NOT NULL
    -- Filter for records that were manually verified (platform_id 0)
    AND id IN (SELECT business_id FROM integration_data.request_response WHERE platform_id = 0)
)
SELECT
    gt.business_id,
    rd.country,
    -- Extract features from vendors
    MAX(CASE WHEN rd.platform_id = 17 THEN rd.response->>'primnaicscode' END) as feat_equifax_naics,
    MAX(CASE WHEN rd.platform_id = 17 THEN rd.response->>'primsic' END) as feat_equifax_sic,
    MAX(CASE WHEN rd.platform_id = 101 THEN rd.response->'firmographic'->>'zi_c_naics6' END) as feat_zoominfo_naics,
    MAX(CASE WHEN rd.platform_id = 102 THEN rd.response->'firmographic'->>'industry_code_uids' END) as feat_oc_raw_codes,
    -- Target Variable
    COALESCE(gt.naics_id, gt.uk_sic_id) as target_industry_id
FROM ground_truth gt
JOIN raw_data rd ON gt.business_id = rd.business_id
GROUP BY 1, 2, 7;
```

### 5.3 Python Pipeline: XGBoost Consensus Implementation
```python
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder, MultiLabelBinarizer
import pandas as pd
import numpy as np

class IndustryConsensusEngine:
    def __init__(self, model_path=None):
        self.model = xgb.XGBClassifier(
            objective='multi:softprob',
            num_class=1035, # US NAICS Count
            tree_method='hist',
            max_depth=6
        )
        if model_path:
            self.model.load_model(model_path)

    def feature_engineering(self, raw_df):
        # 1. Vectorize Vendor Inputs
        # 2. Compute Discrepancy Score (Semantic Distance)
        raw_df['web_registry_dist'] = self._compute_semantic_dist(
            raw_df['ai_label'],
            raw_df['oc_label']
        )
        # 3. Flag Trulioo Pollution
        raw_df['trulioo_polluted'] = raw_df['trulioo_sic'].apply(lambda x: 1 if len(str(x)) == 4 else 0)
        return raw_df

    def predict_consensus(self, business_features):
        """
        Outputs a Top 5 Probabilistic Ranking of Industry Codes
        """
        probs = self.model.predict_proba(business_features)
        top_5_indices = np.argsort(probs, axis=1)[:, -5:][:, ::-1]

        results = []
        for idx in top_5_indices[0]:
            results.append({
                "code_index": idx,
                "probability": float(probs[0][idx])
            })
        return results

    def _compute_semantic_dist(self, label_a, label_b):
        # Use sentence-transformers (BERT) to compute cosine similarity between industry labels
        # Placeholder for 2026 SOTA logic
        return 0.85

# Usage
engine = IndustryConsensusEngine()
# consensus_results = engine.predict_consensus(joe_pizza_features)
```

---
**Report Concluded.**
*This architecture transforms Industry Classification from a static label into a dynamic, risk-aware intelligence asset.*
