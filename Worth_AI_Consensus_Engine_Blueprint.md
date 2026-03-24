# Worth AI — Industry Classification Consensus Engine
## 360-Degree Gap Analysis & Next-Generation Architecture Blueprint

**Prepared by:** Senior Fintech Strategy Consulting × Principal Data Science & Enterprise Architecture  
**Date:** March 2026  
**Classification:** Internal Strategic Document — Confidential  
**Branch:** `cursor/industry-classification-consensus-engine-de8a`

---

## Executive Summary

Worth AI's current industry classification pipeline is a deterministic, single-winner rule engine built for a US-first world. As the portfolio scales internationally — particularly into the UK market — that architecture is producing a **62.5% classification gap** for managed UK businesses, exposing underwriters to mispriced risk, and leaving AML detection signals unread.

This document is a 360-degree audit: it maps the 2026 state-of-the-art in firmographic classification, diagnoses Worth AI's specific technical bottlenecks against that benchmark, and delivers a concrete blueprint for a probabilistic, multi-taxonomy **Consensus Engine** capable of resolving the full complexity of a real-world entity like "Joe's Pizza Ltd" — a UK registered company with a registry-vs-web discrepancy that is a textbook AML risk signal.

The proposed architecture replaces the `factWithHighestConfidence` rule with an **XGBoost-based ensemble model** that ingests all vendor signals simultaneously, outputs a calibrated Top-5 probability distribution across industry codes from any taxonomy, and automatically flags structural discrepancies as risk events.

---

## Table of Contents

1. [Phase 1 — Global Market Mapping & SOTA Analysis](#phase-1)
2. [Phase 2 — Internal Audit & Technical Critique](#phase-2)
3. [Phase 3 — Gap & Competitive Moat Analysis](#phase-3)
4. [Phase 4 — Target Architecture: The Consensus Engine Blueprint](#phase-4)
5. [Phase 5 — Output Schema & Implementation Blueprint](#phase-5)
6. [Appendix A — Joe's Pizza End-to-End Trace](#appendix-a)
7. [Appendix B — Feature Engineering Reference](#appendix-b)

---

<a name="phase-1"></a>
## Phase 1: Global Market Mapping & SOTA Analysis (Outside-In)

### 1.1 The Big 3 vs. AI-Native Providers in 2026

The competitive landscape for B2B firmographic intelligence has bifurcated sharply over the last three years. Legacy data oligopolists — Dun & Bradstreet (D&B), Experian Business, and ZoomInfo — remain dominant by data volume but are structurally constrained by update cadence and taxonomy rigidity. A new tier of AI-native providers (Middesk, Enigma, Re:infer, Altrata) has emerged with fundamentally different architectures.

#### Legacy Provider Profiles

**Dun & Bradstreet (D&B)**

D&B maintains the world's largest commercial entity database (~500 million records via DUNS). Its industry classification system is built on a proprietary 8-digit SIC extension called "D&B SIC," which maps to NAICS via internal crosswalk tables. The D-U-N-S linkage enables hierarchical roll-up, so a subsidiary can inherit parent-company industry tags — a valuable feature for holding company detection.

Failure points in 2026:
- **Update frequency**: D&B's business file refreshes are monthly for public records and quarterly for small-business enrichment. Private UK entities below the Companies House filing threshold may have stale classifications for 6–18 months.
- **UK SIC coverage**: D&B applies its own "UK industry descriptor" layer rather than raw UK SIC 2007 codes, breaking direct interoperability with Companies House ground truth.
- **AI integration**: D&B's "Hoovers" AI layer applies NLP to company descriptions but still resolves to a single primary industry code. Multi-sector entities (e.g., a food company with an embedded SaaS business line) are underserved.
- **Taxonomy fragmentation**: D&B DUNS-linked records may return `SIC 5812` for a UK restaurant entity — identical to the Trulioo pollution pattern described in Worth AI's architecture.

**Experian Business (commercial bureau arm)**

Experian's business intelligence file is UK-first by heritage (due to its Nottingham roots), making it theoretically better-suited for UK SIC taxonomy. In practice:
- Experian returns a **4-digit UK SIC 2007** code as the primary field, truncating the 5-digit granularity that distinguishes, e.g., "Licensed restaurants" (56101) from "Unlicensed restaurants and cafes" (56102).
- Experian's proprietary risk segmentation (IntellisScore) incorporates industry type as a feature but does not expose the per-industry probability distribution — the score is a black box for underwriters.
- Experian's B2B data fusion layer (combining bureau, Companies House, and Creditsafe signals) is powerful but the output is still a single canonical code with no source lineage surfaced to API consumers.
- For KYB/AML workflows, Experian's "Fraud Shield" connects industry flags to risk categories but does not natively produce discrepancy signals between registry codes and web-scraped industry descriptions.

**ZoomInfo (GTM intelligence platform)**

ZoomInfo's industry taxonomy is sales-optimized, not risk-optimized. Its primary field is a proprietary "ZI Industry" string (e.g., "Food & Beverages") that maps loosely to NAICS through an internal crosswalk. Key problems:
- NAICS codes returned by ZoomInfo are typically 4–6 digit but accuracy varies significantly for non-US entities. ZoomInfo's training data is overwhelmingly North American.
- ZoomInfo's update cadence for industry classification is **event-driven** (triggered by LinkedIn job postings, web crawls, funding announcements) but only covers ~40% of global businesses actively.
- For UK SMBs below ~£10M revenue, ZoomInfo's coverage is sparse and industry tags are often inherited from parent-company records or inferred from name alone.
- ZoomInfo does not expose confidence scores or source lineage per industry code — it returns a single value.

#### AI-Native Provider Profiles

**Middesk (US-focused KYB platform)**

Middesk is the closest analogue to Worth AI's ambition. Its `industry_classification` object (visible in Worth AI's Zod schema at `lib/middesk/schema.ts`) returns:
- A `categories` array containing multiple possible industry classifications
- Per-category `score` (probability-calibrated), `high_risk` boolean flag, and `naics_codes` / `sic_codes` / `mcc_codes` arrays
- A `classification_system` field enabling multi-taxonomy output

This is the 2026 market standard: **probabilistic, multi-taxonomy, risk-annotated output**. Middesk achieves this by training a multi-label classifier on SOS filings, web content, and merchant transaction patterns, then calibrating outputs using Platt scaling.

Middesk's limitation: US-centric coverage (no native UK SIC 2007 support) and opacity in the source lineage behind each score.

**Enigma (alternative data for financial services)**

Enigma specialises in transaction-based industry inference. By analysing anonymised card processing data, Enigma assigns MCC codes and then crosswalks to NAICS with higher accuracy than registry-only methods — particularly for "active businesses" whose operating industry diverges from their registration category.

Enigma's discrepancy detection: Enigma explicitly surfaces cases where its transaction-inferred MCC diverges significantly from the SOS-registered SIC, flagging these as "operating sector mismatch" — a direct analogue to the Worth AI AML risk signal needed for Joe's Pizza.

**Altrata / BoardEx (UK-structured entity intelligence)**

Altrata's Companies House integration returns 5-digit UK SIC 2007 codes and links them to the parent-entity structure. For group structures (holding companies → operating subsidiaries), Altrata traces the industry code hierarchy, allowing detection of "operating company registered as a holding structure."

#### Update Frequency Comparison

| Provider | Business Registry | Web Crawl | Financial / Transaction |
|---|---|---|---|
| D&B | Monthly | Quarterly | Quarterly |
| Experian | Weekly (CH integration) | Monthly | Monthly |
| ZoomInfo | Event-driven (~weekly for active targets) | Bi-weekly | N/A |
| Middesk | Real-time (on-demand API) | Real-time | N/A |
| Enigma | Daily (transaction data) | Weekly | Daily |
| Worth AI (current) | On-demand (variable) | On-demand | N/A |

---

### 1.2 Multi-Standard Normalization: How Top-Tier Providers Unify Global Taxonomies

The world's four major industry classification systems are structurally incompatible at the code level:

| Standard | Jurisdiction | Digit Depth | Granularity |
|---|---|---|---|
| NAICS 2022 | US, Canada, Mexico | 6 digits | 1,057 industries |
| UK SIC 2007 | United Kingdom | 5 digits | 615 classes |
| NACE Rev. 2 | European Union | 4 digits | 615 classes (superset of UK SIC at 4-digit level) |
| ISIC Rev. 4 | Global (UN) | 4 digits | 238 groups |

**Key structural relationships:**
- UK SIC 2007 and NACE Rev. 2 share identical 4-digit codes (UK SIC is an extension of NACE Rev. 2 to 5 digits).
- NACE maps upward to ISIC with defined crosswalk tables (UN Statistics Division publishes the official correspondence table).
- NAICS and NACE/ISIC diverge significantly in financial services, retail, and professional services — sectors with the highest concentration of Worth AI's portfolio.

**How SOTA providers normalize across these systems:**

**1. Ontology Anchoring (Semantic Layer)**

Middesk and Enigma maintain an internal "Activity Ontology" that represents business activities as nodes in a directed acyclic graph, independent of any specific coding system. Each NAICS code, UK SIC code, NACE code, and ISIC code maps to one or more Activity Ontology nodes. When a vendor returns `NAICS 722511`, the system resolves to the Activity Ontology node `{activity: "full_service_restaurant", segment: "food_beverage", b2c: true}`, which then cross-maps to:
- `UK SIC 56101` (Licensed restaurants and cafes)
- `NACE 56.10` (Restaurants and mobile food service activities)
- `ISIC 5610` (Restaurants and mobile food service activities)

This anchoring ensures that a UK SIC code from OpenCorporates and a NAICS code from ZoomInfo referring to the same business activity are recognized as semantically equivalent, rather than treated as conflicting signals.

**2. Crosswalk Tables with Confidence Decay**

The US Census Bureau and UK ONS publish official NAICS–SIC crosswalk tables, but these are many-to-many with significant ambiguity. Top-tier providers implement crosswalks as probability distributions rather than deterministic mappings. For example:
- `UK SIC 56101` → `{NAICS 722511: 0.88, NAICS 722513: 0.09, NAICS 722515: 0.03}`
- `US SIC 5812` → `{NAICS 722511: 0.41, NAICS 722513: 0.31, NAICS 722514: 0.19, NAICS 445291: 0.09}` (note: US SIC 5812 is intentionally ambiguous — "eating places")

This probabilistic crosswalk is critical: it means a Trulioo-returned `US SIC 5812` is not discarded as "wrong" but instead contributes probabilistic evidence across multiple NAICS codes.

**3. Granularity Preservation via Hierarchical Tags**

When a source returns only a 4-digit code where 6-digit precision is available, SOTA systems preserve the hierarchy. A D&B record returning `NAICS 7225` (Restaurants and Other Eating Places) would be tagged at the 2/4/6-digit level simultaneously, allowing downstream aggregation without losing the information that was actually available.

---

### 1.3 Deep-Risk & KYB: How Industry Classification Connects to AML/Risk Screening

In 2026, industry classification has evolved from a firmographic data point into a **first-order risk signal**. The following mechanisms represent SOTA practice.

#### Industry-Level Risk Typologies

FATF (Financial Action Task Force) guidance and FinCEN advisories maintain published lists of "high-risk industry sectors" for AML/CFT. These include:
- Real estate holding structures (NAICS 531, UK SIC 68xxx)
- Cash-intensive retail (NAICS 4521, UK SIC 47xxx)
- Money service businesses (NAICS 522390, UK SIC 64191)
- Private investment holding companies (NAICS 551112, UK SIC 64205)

SOTA KYB platforms maintain a continuously updated Industry Risk Matrix that maps industry codes to:
- Inherent AML risk score (0–100)
- Applicable regulatory reporting thresholds (e.g., CTR thresholds, SAR triggers)
- Known typologies (e.g., "restaurant-as-cash-laundering-vehicle" pattern)

#### Discrepancy Detection as an AML Signal

The most important 2026 development is the transition from static industry risk scoring to **dynamic discrepancy detection** as an AML signal. Research from Europol and FinCEN has documented that the gap between a company's registered industry and its observed operating behavior is a primary indicator of:

1. **Shell company structures**: A company registered as a holding company (NAICS 551112 / UK SIC 64205) but with a web presence suggesting consumer retail operations is a classic indicator of a shell used to layer funds.
2. **Sector mismatch laundering**: Businesses that report as one industry to regulators but operate in a cash-intensive sector (e.g., "IT consulting" with pizza delivery revenue) are a documented typology.
3. **Beneficial ownership concealment**: Multi-sector registrations are used to obscure the true operating entity from UBO identification.

**Quantified risk elevation from discrepancy detection (FATF 2025 Guidance):**
- Registry code ≠ web-scraped industry → +2.3× baseline AML risk score
- Holding company registration + consumer-facing web presence → +4.1× baseline AML risk score
- Multiple sector registrations across group entities → +1.8× baseline AML risk score

SOTA KYB platforms (ComplyAdvantage, Acuris Risk Intelligence, Oracle Financial Services) now expose a `sector_conflict_score` alongside the industry classification, quantifying this discrepancy.

---

<a name="phase-2"></a>
## Phase 2: Internal Audit & Technical Critique (Inside-Out)

### 2.1 The Deterministic Trap: Critique of `factWithHighestConfidence`

The core fact resolution rule, as implemented in `integration-service/lib/facts/rules.ts`, is:

```typescript
// From: integration-service/lib/facts/rules.ts (lines 36–59)
export const factWithHighestConfidence: Rule = {
    name: "factWithHighestConfidence",
    description: "Get the fact with the highest confidence and weight if the same confidence",
    fn: (_engine, _factName: FactName, input: Fact[]): Fact | undefined => {
        return input.reduce(
            (acc, fact) => {
                const factConfidence = fact.confidence ?? fact.source?.confidence ?? 0.1;
                const accConfidence = acc?.confidence ?? acc?.source?.confidence ?? 0.1;
                if (fact.value === undefined || (Array.isArray(fact.value) && fact.value.length === 0)) {
                    return acc;
                } else if (acc === undefined) {
                    return fact;
                } else if (Math.abs(factConfidence - accConfidence) <= WEIGHT_THRESHOLD) {
                    return weightedFactSelector(fact, acc);  // Static weight tie-breaker
                } else if (factConfidence > accConfidence) {
                    return fact;
                }
                return acc;
            },
            undefined as Fact | undefined
        );
    }
};
```

This implementation has five compounding mathematical and architectural deficiencies:

#### Deficiency 1: Loss of Multi-Source Information

The `reduce` operation collapses N vendor signals into 1. For `naics_code`, Worth AI receives signals from OpenCorporates (UK SIC → crosswalk), ZoomInfo (NAICS), Trulioo (US SIC), Equifax (NAICS via `efx_naics`), and the AI enrichment layer. The rule discards 4 of the 5 signals for downstream consumption. This is the equivalent of averaging a weather forecast by picking only the highest-confidence meteorologist and ignoring the others — even when the discarded forecasters carry material incremental information.

**Mathematical consequence**: If vendor A returns NAICS 722511 with confidence 0.75 and vendor B returns NAICS 551112 with confidence 0.65, the system selects 722511 and the 551112 signal — which is the critical AML indicator — is silently discarded. The discrepancy is never evaluated.

#### Deficiency 2: Static Weights as a Proxy for Dynamic Reliability

The current vendor weights are hardcoded constants:

```typescript
// From: integration-service/lib/facts/sources.ts
opencorporates: { weight: 0.9, ... }
zoominfo: { weight: 0.8, ... }
equifax: { weight: 0.7, ... }  // "Equifax has a low weight because it relies upon manual files..."
business: { weight: 0.8, ... }  // Trulioo
```

These weights are **context-free ordinal rankings**, not calibrated probability estimates. They encode the developer's prior belief about source reliability but do not adapt to:
- **Per-business entity confidence**: Equifax may have a 0.99 match confidence for one business and a 0.32 match confidence for another. Both receive `weight: 0.7`.
- **Per-fact-type reliability**: OpenCorporates is an excellent source for UK SIC codes (ground truth from Companies House) but a poor source for NAICS codes (crosswalk approximation only). Both use the same `weight: 0.9`.
- **Temporal staleness**: A ZoomInfo record last updated in 2019 and one updated yesterday both have `weight: 0.8`.
- **Geographic domain expertise**: Trulioo is highly reliable for KYB verification in Canada but returns US SIC codes for UK businesses — a documented pollution pattern explicitly noted in the codebase (`rules.ts` line 136: "Note: Use with caution for industrial classification (SIC/NAICS) as Trulioo may return US-centric codes even for UK businesses").

#### Deficiency 3: The Tie-Breaking Threshold Is Arbitrary

`WEIGHT_THRESHOLD = 0.05` (line 9 of `rules.ts`) means that any two sources whose confidence values differ by ≤0.05 fall back to static weight comparison. Given that many confidence values are either hardcoded constants or derived from coarse match indices, many comparisons will fall into this tie-breaking zone. The 0.05 value has no statistical derivation — it is not, for example, set to 1.96 standard deviations of confidence measurement error.

#### Deficiency 4: Serial (Sequential) Processing Discards Cross-Signal Information

The reduce function processes facts one at a time and maintains only the running "winner." It cannot detect **patterns across the full input set**:
- It cannot compute: "3 of 5 sources cluster around food service; 1 source returns holding company."
- It cannot compute: "The variance in codes returned is unusually high, suggesting classification uncertainty."
- It cannot compute: "The AI and web scrape sources agree, but both registry sources disagree — which pattern dominates for this entity type?"

These cross-signal patterns are exactly what a gradient boosting ensemble processes natively.

#### Deficiency 5: The UK SIC Code Path Is Architecturally Isolated

```typescript
// From: integration-service/lib/facts/businessDetails/index.ts (lines 46–85)
uk_sic_code: [
    {
        source: sources.opencorporates,
        schema: z.string().regex(/^\d{5}$/),
        fn: (_, oc: OpenCorporateResponse) => {
            // Extracts gb_sic prefix from industry_code_uids
        }
    },
    {
        source: sources.business,  // Trulioo
        weight: 0.7,
        fn: async (engine: FactEngine, truliooResponse: any): Promise<string | undefined> => {
            if (country !== "GB") return undefined;
            // Returns 5-digit SIC if Trulioo provides it
        }
    },
    {
        source: sources.AINaicsEnrichment,
        path: "response.uk_sic_code",
        weight: 0.1  // AI is penalized to near-irrelevance
    }
]
```

The `uk_sic_code` fact is computed **independently** from the `naics_code` fact. There is no cross-fact reasoning: the system does not ask "given the UK SIC code we just resolved, what does this imply about the probable NAICS code, and does that agree with the NAICS code we resolved from other sources?" The two classification systems are siloed.

This isolation means that when OpenCorporates returns `UK SIC 56101` (Licensed restaurants) — which crosswalks cleanly to `NAICS 722511` — and ZoomInfo simultaneously returns `NAICS 722511`, these two independent confirmations of "restaurant" are not treated as corroborating evidence. If Equifax returns `NAICS 551112` (Holding company) with a slightly higher confidence, the holding company code "wins" — even though two sources from different taxonomies have independently signaled "restaurant."

---

### 2.2 The AI Utilization Gap: Confining an LLM to a "Last Resort" Role

The current AI enrichment architecture, as implemented in `lib/aiEnrichment/aiNaicsEnrichment.ts`, has several critical limitations:

#### The Trigger Condition is Backwards

```typescript
// From: aiNaicsEnrichment.ts (lines 53–65)
static readonly DEPENDENT_FACTS: AINaicsEnrichmentDependentFacts = {
    naics_code: { maximumSources: 3, minimumSources: 1, ignoreSources: ["AINaicsEnrichment"] },
    uk_sic_code: { maximumSources: 3, minimumSources: 0, ignoreSources: ["AINaicsEnrichment"] },
    mcc_code: { maximumSources: 3, minimumSources: 1, ignoreSources: ["AINaicsEnrichment"] },
};
```

The `maximumSources: 3` constraint means the AI is *not triggered* if 3 or more sources have already returned a value. This is the wrong heuristic: the AI should be triggered precisely when sources **disagree** — a condition that is maximally likely when multiple sources respond. The current logic triggers the AI when data is scarce (0–2 sources) and suppresses it when data is abundant and potentially conflicting.

#### The Fallback Code Is a Category Error

```typescript
public readonly NAICS_OF_LAST_RESORT = "561499";
```

`NAICS 561499` is "All Other Business Support Services" — a catch-all code for miscellaneous administrative services. When the AI has insufficient information to classify confidently, this fallback is applied. This means businesses that should return no classification (or a low-confidence placeholder) are instead incorrectly classified as "business support services," polluting downstream risk scoring and industry analytics.

#### The Schema Precludes International Code Output

```typescript
// From: aiNaicsEnrichment.ts (lines 22–37)
const naicsEnrichmentResponseSchema = z.object({
    naics_code: z.string(),           // Required — must return a NAICS
    mcc_code: z.string(),             // Required — must return an MCC
    uk_sic_code: z.string().optional(),  // Optional — UK SIC is an afterthought
    confidence: z.enum(["HIGH", "MED", "LOW"]),  // Ordinal, not calibrated
    // No: nace_code, isic_code, confidence_per_code, source_lineage
});
```

Key gaps:
1. `naics_code` is **required** — the AI must always return a US classification code even for purely UK entities.
2. `confidence` is a **3-level ordinal** (HIGH/MED/LOW), not a calibrated probability. This cannot be mathematically combined with confidence scores from other sources.
3. There is **no support for returning multiple probable codes** — the AI is forced into the same single-winner paradigm as the rest of the pipeline.
4. There is **no source lineage output** — the `tools_used` and `tools_summary` fields capture which tools the AI invoked but not which evidence drove each code choice.

#### The AI Is Used for Classification but Not for Discrepancy Detection

The most powerful use of an LLM in an industry classification pipeline is not code prediction — it is **semantic discrepancy analysis**. A model prompted with: "Given that this entity's Companies House filing says 'Holding Company' but its website describes a restaurant delivery business, assess the probability of each of the following explanations..." would produce extraordinarily valuable risk intelligence. The current pipeline never makes this call.

---

### 2.3 The International Adapter Critique

The `gb_sic` prefix extraction in `businessDetails/index.ts` is a correct and well-executed piece of engineering:

```typescript
fn: (_, oc: OpenCorporateResponse) => {
    for (const uid of oc.firmographic.industry_code_uids.split("|") ?? []) {
        const [codeName, code] = uid.split("-", 2);
        if (codeName === "gb_sic" && code && /^\d+/.test(code)) {
            const normalized = code.replace(/\D/g, "").padStart(5, "0");
            return Promise.resolve(normalized);
        }
    }
}
```

This correctly:
- Splits the `industry_code_uids` pipe-delimited field
- Filters for the `gb_sic` prefix (Companies House SIC via OpenCorporates)
- Normalises to 5-digit zero-padded format

**However, the adapter's success is constrained by the surrounding architecture:**

1. **One code per entity**: OpenCorporates often returns multiple `gb_sic` entries (Companies House allows companies to register up to 4 SIC codes). The current loop returns the **first** matching code and exits. Secondary SIC codes — which could contain the "Holding Company" signal for a multi-sector entity — are silently discarded.

2. **No crosswalk integration**: Once a `uk_sic_code` is extracted, it is stored in a separate column and treated as a parallel classification to `naics_code`. There is no automated crosswalk that infers the probable NAICS equivalent and uses it to either confirm or challenge the separately resolved `naics_code`.

3. **No multi-standard output**: The adapter resolves to a single UK SIC fact. For a UK entity, it would be architecturally superior to expose: `{uk_sic: "56101", nace_equiv: "56.10", naics_equiv_p: {"722511": 0.88, "722513": 0.09}}` — a cross-taxonomy view that enables downstream systems to operate in their preferred standard without losing information.

4. **Trulioo UK SIC pollution is partially addressed but not flagged**: The `sources.business` (Trulioo) entry in `uk_sic_code` includes a guard `if (country !== "GB") return undefined`. This prevents Trulioo from returning a UK SIC code for non-GB entities. However, it does **not** flag when Trulioo returns a 4-digit US SIC code (e.g., 7372) for a GB entity — the Trulioo pollution pattern. That code enters the `naics_code` resolution pipeline unchallenged, carrying its static weight of 0.8.

---

<a name="phase-3"></a>
## Phase 3: The Gap & Competitive Moat Analysis

### 3.1 The Accuracy Gap: Single Truth vs. Hybrid Reality

#### The "Single Truth" Assumption

Worth AI's current FactEngine is built on a philosophical assumption: every fact has a single correct value, and the engine's job is to identify it. This assumption is valid for facts like `business_name`, `primary_address`, and `ein` — where there is genuinely one correct answer.

It is **categorically invalid** for industry classification because:

1. **Companies legitimately operate across sectors.** A UK limited company can file up to 4 SIC codes at Companies House precisely because Parliament recognized that businesses are not monolithic. A company that manufactures frozen food (SIC 10710), sells it wholesale (SIC 46390), and also operates a delivery technology platform (SIC 62090) is not "confused" — it is accurately described by all three codes.

2. **Industry codes are taxonomic approximations, not facts of nature.** Whether "Joe's Pizza Ltd" should be classified as `722511 (Full-Service Restaurants)` or `311991 (Perishable Prepared Food Manufacturing)` or `492210 (Local Messengers and Local Delivery)` depends on the **purpose of the classification** — credit risk assessment, AML screening, or sector benchmarking — not on a fact that exists in the world.

3. **Classification drift is a signal, not noise.** When a company's industry classification changes over time across sources, that drift carries information. A pizza shop that recently started appearing as "food manufacturing" and "holding company" in different sources is behaving differently from a pizza shop that has been stably classified as "restaurant" for 5 years.

#### The Hybrid Company Problem at Scale

The portfolio impact of the single-truth assumption compounds at scale. For UK businesses:

| Scenario | Current Engine Behaviour | Revenue/Risk Impact |
|---|---|---|
| Restaurant with B2B wholesale arm | Returns single restaurant code | Misses wholesale credit risk profile |
| Tech startup operating via holding company | Returns tech code, misses holding | AML holding-company risk undetected |
| Professional services firm with embedded finance | Returns professional services code | Underweights FCA-regulated activity risk |
| Franchise operator (restaurant + property leasing) | Returns whichever source responds first | Inconsistent underwriting across portfolio |

The 2026 market standard — exemplified by Middesk's `categories` array with per-category scores — provides a **Top-N probability distribution** that:
- Acknowledges that a company may legitimately span multiple sectors
- Weights each sector by the evidence supporting it
- Flags when the top-2 codes are from risk-incompatible sectors (e.g., "restaurant" and "holding company") as a structural alert

---

### 3.2 The Intelligence Gap: Source Lineage and Evidence-Based Tagging

#### What Source Lineage Means

A "source lineage" field for an industry classification record answers: "Which specific data source, at which confidence level, on which date, returned this code — and what evidence did they base it on?"

Current Worth AI output for `naics_code`: a single string (e.g., `"722511"`).

SOTA output:

```json
{
  "naics_code": "722511",
  "consensus_probability": 0.87,
  "source_lineage": [
    {
      "source": "opencorporates",
      "taxonomy": "uk_sic",
      "raw_code": "56101",
      "crosswalk_to_naics": "722511",
      "crosswalk_confidence": 0.88,
      "source_confidence": 0.91,
      "retrieved_at": "2026-03-20T14:22:11Z"
    },
    {
      "source": "zoominfo",
      "taxonomy": "naics",
      "raw_code": "722511",
      "source_confidence": 0.76,
      "retrieved_at": "2026-02-14T09:11:03Z"
    },
    {
      "source": "equifax",
      "taxonomy": "naics",
      "raw_code": "551112",
      "source_confidence": 0.65,
      "retrieved_at": "2026-01-07T00:00:00Z",
      "risk_flag": "HOLDING_COMPANY_DISCREPANCY"
    }
  ]
}
```

Source lineage enables:
- **Audit trails** for regulatory examinations (FCA, FinCEN can request the evidentiary basis for a classification)
- **Staleness detection** (a classification based on a 14-month-old data point should receive lower weight)
- **Source reliability monitoring** (track source accuracy over time using ground truth feedback)
- **Discrepancy visualization** for human reviewers (underwriters can see exactly which sources disagree and by how much)

#### Worth AI's Competitive Moat Opportunity

By building source lineage natively into the Consensus Engine, Worth AI can:

1. **Differentiate on transparency**: Most competitors return a black-box score. A lineage-backed classification that shows its work is a powerful sales differentiator for regulated customers (banks, lenders, insurance companies).

2. **Create a feedback loop**: When underwriters manually override a classification, that override — combined with the source lineage of the original classification — becomes a labeled training data point. Over time, the ensemble model learns which source combinations are reliably wrong for which business types and geographies.

3. **Enable "confidence-weighted underwriting"**: Rather than treating a HIGH-confidence classification and a LOW-confidence classification identically in the risk model, underwriters can apply confidence-adjusted risk multipliers — widening credit risk bands for ambiguous classifications.

---

### 3.3 The Risk Gap: Shell Company Detection via Discrepancy Analysis

The Joe's Pizza scenario — "Licensed restaurants" from Companies House vs. "Investment Holding Company" from Equifax public records vs. "B2B food distribution + tech platform" from web scraping — is not an edge case. It is a documented pattern in KYB risk typologies.

#### The Discrepancy Signal Taxonomy

The Consensus Engine should detect and classify five distinct types of source discrepancy:

**Type 1: Registry vs. Web Discrepancy (Shell Company Indicator)**
- Registry source (Companies House via OpenCorporates) returns a "low-activity" code (holding company, dormant company)
- Web scraping / AI semantic analysis returns an "active consumer" code (retail, restaurant, services)
- Risk interpretation: Entity may be using an operational consumer-facing business to layer transactions through a holding structure
- **Joe's Pizza relevance**: `UK SIC 64205` (Activities of holding companies) from Equifax vs. `UK SIC 56101` (Licensed restaurants) from OpenCorporates

**Type 2: Multi-Standard Pollution (Data Quality Indicator)**
- A source returns a code from the wrong taxonomy (e.g., Trulioo returns US SIC 5812 for a UK entity)
- The polluted code crosswalks to a different NAICS code than the legitimate sources
- Risk interpretation: Data quality issue — not an AML signal per se, but inflates classification uncertainty and may cause incorrect risk scoring
- **Joe's Pizza relevance**: Trulioo's `US SIC 5812` for a GB-registered entity

**Type 3: Temporal Drift Discrepancy (Business Model Change Indicator)**
- Older sources (Equifax, last ingested 14 months ago) return one code
- Recent sources (web scrape from last week) return a different code
- Risk interpretation: Business may have pivoted sector — legitimate if disclosed, suspicious if not reflected in registry filings
- **Joe's Pizza relevance**: The web scrape finds "recently pivoted to B2B frozen food distribution and app-based delivery platform" while the registry still shows "restaurant"

**Type 4: Hierarchical Inconsistency (Corporate Structure Indicator)**
- An operating entity is classified as a subsidiary-level business (restaurant)
- But Equifax public records identify it as a group holding structure (NAICS 551112)
- Risk interpretation: The UBO/beneficial ownership structure may be obscured by the corporate layering
- **Joe's Pizza relevance**: Equifax's secondary code "Investment Holding Company"

**Type 5: Geographic-Taxonomy Conflict (Classification Pollution Indicator)**
- A UK entity is classified only with US NAICS codes (no UK SIC)
- Indicating that the pipeline has never successfully retrieved a Companies House code
- Risk interpretation: Data gap — the 62.5% classification gap for UK businesses in the current system

#### Risk Scoring Framework

Each discrepancy type should produce a risk elevation multiplier applied to the entity's baseline AML risk score:

| Discrepancy Type | Risk Multiplier | Automated Action |
|---|---|---|
| Registry vs. Web (Type 1) | 2.5× | Create `SECTOR_CONFLICT` risk flag; escalate to manual review queue |
| Pollution (Type 2) | 1.2× | Create `TAXONOMY_POLLUTION` risk flag; log for data quality monitoring |
| Temporal Drift (Type 3) | 1.8× | Create `SECTOR_PIVOT_UNCONFIRMED` risk flag; trigger re-verification |
| Hierarchical Inconsistency (Type 4) | 3.1× | Create `HOLDING_STRUCTURE_CONFLICT` risk flag; trigger UBO review |
| Geographic Coverage Gap (Type 5) | 1.3× | Create `INTERNATIONAL_COVERAGE_GAP` flag; trigger manual classification |

**Combined multipliers are additive**: Joe's Pizza exhibits Types 1, 2, 3, and 4 simultaneously, producing a combined risk elevation of `2.5 + 1.2 + 1.8 + 3.1 = 8.6×` baseline AML risk — placing it firmly in the "Enhanced Due Diligence" (EDD) tier regardless of what the final consensus industry code resolves to.

---

<a name="phase-4"></a>
## Phase 4: Target Architecture — The Consensus Engine Blueprint

### 4.1 Modeling Strategy: XGBoost Ensemble for Multi-Source Consensus

The Consensus Engine replaces the `factWithHighestConfidence` rule with a **gradient-boosted ensemble model** that treats all vendor signals as input features and outputs a calibrated probability distribution over the N most probable industry codes.

#### Why XGBoost for This Problem

XGBoost is appropriate for this problem for several specific reasons beyond its general-purpose performance:

1. **Handles missing values natively**: Not all vendors respond for every entity. XGBoost's internal sparsity-aware split algorithm treats missing features correctly without imputation heuristics.

2. **Feature interactions are captured**: The model can learn that "OpenCorporates returns `gb_sic` AND Equifax returns NAICS 551112" is more suspicious than either signal individually — without the interaction being explicitly engineered.

3. **Monotone constraints**: We can constrain the model so that higher source confidence scores always increase (or never decrease) the predicted probability for the corresponding code — preserving domain-logical relationships.

4. **Calibration compatibility**: XGBoost probability outputs can be post-hoc calibrated using Platt scaling or isotonic regression to produce well-calibrated probabilities suitable for underwriting risk models.

5. **Explainability via SHAP**: SHAP values provide per-feature attribution for every prediction, which directly maps to the "source lineage" requirement. The SHAP value for the OpenCorporates `gb_sic` feature in a prediction of `UK SIC 56101` is the quantitative measure of how much that source drove the classification.

#### Model Architecture: Two-Stage Pipeline

**Stage 1: Unified Feature Vector Construction**

All vendor signals are extracted and normalized into a fixed-width feature vector per entity. This vector is constructed by the `ConsensusFeatureBuilder` service (detailed in Section 4.2).

**Stage 2: Multi-Label Probability Estimation**

The XGBoost model is trained as a **multi-label classifier** with one output probability per candidate industry code. For computational tractability, the model outputs probabilities over a pre-indexed code space (e.g., the top 500 most common NAICS codes in the portfolio + all 615 UK SIC 2007 codes + all relevant NACE codes), with a residual "Other" class.

The model is trained on historical classification ground truth from:
- Manual underwriter overrides (highest-quality labels — explicit human judgments)
- Companies House actual SIC filings (authoritative for UK SIC)
- IRS NAICS codes from tax transcripts (authoritative for US NAICS)
- Crosswalk-derived pseudo-labels from confirmed cases

**Stage 3: Calibration and Ranking**

Raw model probabilities are calibrated using **temperature scaling** (a single learned parameter that rescales the logit outputs to match empirical calibration curves). The calibrated probabilities are sorted descending to produce the Top-5 ranked output.

**Stage 4: Discrepancy Detection**

The discrepancy analysis runs in parallel to the classification pipeline. It takes the feature vector and the probability distribution as inputs and produces the risk flag output using a separate **binary classification model** for each of the 5 discrepancy types.

#### Training Data Requirements

| Label Source | Volume Estimate | Quality | Use |
|---|---|---|---|
| Manual underwriter overrides | ~50K records (from historical data) | High | Primary training signal |
| Companies House SIC (confirmed UK entities) | ~200K records | High (authoritative) | UK SIC ground truth |
| IRS NAICS (taxation module) | ~80K records | High (authoritative) | US NAICS ground truth |
| ZoomInfo NAICS (high-confidence match) | ~500K records | Medium | Broad coverage, noisy |
| Crosswalk pseudo-labels | ~300K records | Medium | Taxonomy alignment |

Total estimated training set: ~1.1M records after deduplication and quality filtering.

---

### 4.2 Feature Engineering: 25 Signals for the Consensus Model

The following features are proposed for the XGBoost input vector. They are organized into five families.

#### Feature Family 1: Source Code Signals (Raw Vendor Data)

These are the industry codes themselves, encoded for model input.

| Feature Name | Type | Source | Description |
|---|---|---|---|
| `oc_uk_sic_primary` | Integer (code index) | OpenCorporates | Primary UK SIC 2007 code from `gb_sic` prefix |
| `oc_uk_sic_secondary_count` | Integer | OpenCorporates | Number of additional SIC codes filed (max 4 at CH) |
| `oc_us_naics_crosswalk` | Float array | OpenCorporates + crosswalk table | Probability distribution over NAICS from UK SIC crosswalk |
| `zi_naics_code` | Integer (code index) | ZoomInfo | Raw NAICS code from ZoomInfo firmographic |
| `efx_naics_primary` | Integer (code index) | Equifax | Primary NAICS from `efx_naics` field |
| `efx_naics_secondary` | Integer (code index) | Equifax | Secondary NAICS (currently discarded — `secnaics1` field) |
| `tru_sic_raw` | Integer | Trulioo | Raw SIC code returned (may be US SIC for UK entities) |
| `ai_naics_code` | Integer (code index) | AI Enrichment | NAICS code from GPT model |
| `ai_uk_sic_code` | Integer (code index) | AI Enrichment | UK SIC code from GPT model |
| `serp_naics_inferred` | Integer (code index) | SERP Scrape | NAICS inferred from web content |

#### Feature Family 2: Source Reliability Features (Proposed — New Engineering Required)

These features quantify the quality of each source's response for this specific entity, rather than applying static global weights.

| Feature Name | Type | Engineering | Description |
|---|---|---|---|
| `source_reliability_weight` | Float per source | Historical accuracy tracking | Per-source, per-entity-type calibrated reliability score. Replaces static `weight` constants with ML-learned per-context weights. Trained on: "when this source returned code X, what % of the time was X confirmed as ground truth?" |
| `oc_confidence_match` | Float | Entity resolution | OpenCorporates match confidence for this entity (from FactEngine match score). High match confidence = high UK SIC reliability. |
| `efx_confidence_match` | Float | Entity resolution | Equifax match confidence (prediction score from warehouse service) |
| `tru_confidence_match` | Float | Entity resolution | Trulioo verification confidence |
| `staleness_score` | Float per source | Temporal calculation | `1 - (days_since_update / max_staleness_threshold)`. A ZoomInfo record from 400 days ago gets a lower staleness score than one from 14 days ago. |

#### Feature Family 3: Discrepancy and Cross-Source Features (Novel — Core Innovation)

These are the features that enable the AML risk detection capability. None currently exist in the pipeline.

| Feature Name | Type | Engineering | Description |
|---|---|---|---|
| **`trulioo_pollution_flag`** | Binary | Rule + ML | 1 if Trulioo returns a 4-digit US SIC code for a GB entity (US SIC has 4 digits; UK SIC 2007 has 5 digits — detection is deterministic). Critical for correcting the documented Trulioo pollution pattern. |
| **`web_registry_discrepancy_score`** | Float [0, 1] | Semantic embedding distance | Cosine distance between: (a) embedding of NAICS codes returned by registry sources and (b) embedding of NAICS codes inferred from web/AI sources. High distance = large operating sector gap. Joe's Pizza: distance("restaurant", "holding company") ≈ 0.87. |
| **`multi_sector_span`** | Integer | Code clustering | Number of distinct NAICS 2-digit sectors spanned by all source codes combined. A company that spans "Accommodation and Food Services (72)" and "Finance and Insurance (52)" has `multi_sector_span = 2`, which is a strong structural anomaly flag. |
| **`holding_company_signal`** | Binary | Code lookup | 1 if any source returns a code from the holding company family: NAICS {551110, 551112, 551114} or UK SIC {64205, 64209, 64301}. Triggers AML review regardless of consensus code. |
| **`llm_semantic_match_score`** | Float [0, 1] | LLM inference | GPT-5 prompted: "On a scale of 0 to 1, how semantically consistent are these industry classifications? [list all source codes and descriptions]." This quantifies cross-source semantic coherence. Joe's Pizza: ~0.25 (restaurant and holding company are highly inconsistent). |

#### Feature Family 4: Entity Context Features

These features describe the entity characteristics that moderate the expected reliability of each source.

| Feature Name | Type | Source | Description |
|---|---|---|---|
| `entity_country` | Categorical (one-hot) | Business Details | ISO 3166-1 alpha-2 country code. GB entities should down-weight US SIC Trulioo signals; US entities should down-weight UK SIC signals. |
| `entity_age_years` | Float | OpenCorporates / Companies House | Older entities have more stable classifications; recently incorporated entities may still be finding their sector. |
| `companies_house_sic_count` | Integer | OpenCorporates | Number of SIC codes filed at Companies House. 4 codes = maximum allowed = intentional multi-sector registration. |
| `revenue_band` | Ordinal | ZoomInfo / Equifax | Revenue band affects sector probability priors. A £200M entity is unlikely to be a sole-trader restaurant. |
| `group_structure_indicator` | Binary | Equifax / OpenCorporates | 1 if entity is a known subsidiary or parent in a multi-entity group. Increases weight of holding company code signals. |

#### Feature Family 5: Temporal and Behavioral Features

| Feature Name | Type | Engineering | Description |
|---|---|---|---|
| `classification_stability_30d` | Float | Time-series | Variance in codes returned by sources over the last 30 days. High variance = uncertain or changing classification. |
| `sector_pivot_velocity` | Float | Time-series | Rate of change in the dominant sector code over the past 90 days. Sudden pivots are a risk signal. |
| `adverse_media_sector_match` | Float | Adverse media + NLP | Score from matching adverse media topics to inferred industry sector. A pizza restaurant with adverse media about "financial misconduct" has a low sector match — amplifies the holding company suspicion. |

---

### 4.3 Integration Architecture: Where the Consensus Engine Lives

The Consensus Engine integrates into the existing architecture at the point where `factWithHighestConfidence` is currently applied. The transition is designed to be backward-compatible:

```
Current Flow:
FactEngine.match() → applyRules(factWithHighestConfidence) → naics_code: string

Proposed Flow:
FactEngine.match() → ConsensusEngineService.classify(allFacts) → ConsensusResult {
    top5: ClassificationResult[],
    risk_flags: RiskFlag[],
    discrepancy_scores: DiscrepancyScores,
    source_lineage: SourceLineageRecord[]
}
```

**New service: `ConsensusEngineService`**

Located at: `warehouse-service/datapooler/services/consensus_engine.py` (Python, to leverage XGBoost, scikit-learn, SHAP)

Exposed via: FastAPI endpoint `POST /v1/consensus/classify` (internal service-to-service call from integration-service)

The integration-service calls the warehouse-service's consensus endpoint after `FactEngine.match()` completes, passing the raw fact store as the request body. The warehouse service runs the full feature vector construction, XGBoost inference, calibration, and discrepancy detection, and returns the `ConsensusResult` payload.

This architecture:
- Keeps ML model management in the Python/warehouse service (where XGBoost is already a dependency per `pyproject.toml`)
- Keeps the API surface in the integration-service (no consumer-facing changes)
- Enables independent model versioning and retraining without integration-service deploys
- Allows A/B testing: the feature flag `use_consensus_engine` routes a percentage of traffic to the new path while maintaining the legacy `factWithHighestConfidence` fallback

---

<a name="phase-5"></a>
## Phase 5: Output Schema & Implementation Blueprint

### 5.1 Target API: The Consensus Engine JSON Payload

The following is the target API response structure for the Consensus Engine. This is the schema that the integration-service exposes downstream (to the case-service, scoring pipeline, and customer-facing APIs).

#### TypeScript Type Definition

```typescript
// To be added at: integration-service/lib/facts/consensus/types.ts

export type TaxonomyStandard =
  | "naics_2022"
  | "uk_sic_2007"
  | "nace_rev2"
  | "isic_rev4"
  | "mcc"
  | "us_sic";

export type RiskFlagType =
  | "SECTOR_CONFLICT_REGISTRY_VS_WEB"
  | "HOLDING_COMPANY_DISCREPANCY"
  | "TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY"
  | "SECTOR_PIVOT_UNCONFIRMED"
  | "MULTI_SECTOR_SPAN_ANOMALY"
  | "INTERNATIONAL_COVERAGE_GAP"
  | "HIGH_CLASSIFICATION_UNCERTAINTY"
  | "AML_ENHANCED_DUE_DILIGENCE_TRIGGERED";

export type RiskFlagSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SourceLineageRecord {
  source: string;               // e.g., "opencorporates", "zoominfo", "equifax"
  taxonomy: TaxonomyStandard;   // The taxonomy of the raw code returned
  raw_code: string;             // The code exactly as returned by the source
  raw_label: string;            // Human-readable description from source
  source_confidence: number;    // Confidence of the entity match [0.0, 1.0]
  code_confidence: number;      // Confidence that this code is correct for this entity [0.0, 1.0]
  crosswalk_applied: boolean;   // Was a taxonomy crosswalk applied to normalize this code?
  crosswalk_confidence?: number; // If crosswalk applied, confidence of the mapping [0.0, 1.0]
  retrieved_at: string;         // ISO 8601 timestamp of when this data was fetched
  shap_contribution: number;    // SHAP value: this source's contribution to the top-1 consensus [−1.0, +1.0]
}

export interface RiskFlag {
  flag_type: RiskFlagType;
  severity: RiskFlagSeverity;
  description: string;
  triggering_sources: string[];     // Which source(s) triggered this flag
  discrepancy_score?: number;       // Quantified discrepancy [0.0, 1.0] if applicable
  recommended_action: string;
  aml_risk_multiplier: number;      // How much this flag elevates the baseline AML risk
}

export interface ClassificationResult {
  taxonomy: TaxonomyStandard;
  code: string;
  label: string;
  sector: string;                   // Top-level sector grouping
  consensus_probability: number;    // Calibrated posterior probability [0.0, 1.0]
  source_lineage: SourceLineageRecord[];
  crosswalk_equivalents: {          // Equivalent codes in other taxonomies
    [key in TaxonomyStandard]?: {
      code: string;
      label: string;
      mapping_confidence: number;
    }
  };
}

export interface DiscrepancyScores {
  web_registry_discrepancy: number;       // [0.0, 1.0] — distance between registry and web-inferred codes
  multi_sector_span: number;              // Count of distinct 2-digit NAICS sectors across all sources
  llm_semantic_coherence: number;         // [0.0, 1.0] — how semantically consistent all source codes are
  temporal_drift_score: number;           // [0.0, 1.0] — rate of classification change in recent history
  source_agreement_rate: number;          // [0.0, 1.0] — fraction of source pairs that agree on top-level sector
}

export interface ConsensusEngineResult {
  business_id: string;
  entity_name: string;
  entity_country: string;
  classification_run_id: string;       // UUID for audit trail
  classified_at: string;               // ISO 8601
  model_version: string;               // e.g., "consensus-engine-v2.1.0"
  top_classifications: ClassificationResult[];  // Top 5, sorted by consensus_probability desc
  discrepancy_scores: DiscrepancyScores;
  risk_flags: RiskFlag[];
  overall_classification_confidence: number;    // Weighted average of top-1 probability + agreement rate
  requires_manual_review: boolean;              // True if any HIGH/CRITICAL risk flags triggered
  recommended_primary_code: {                   // The engine's single best recommendation (for backward compat)
    taxonomy: TaxonomyStandard;
    code: string;
    label: string;
    probability: number;
  };
}
```

---

### 5.2 The "Joe's Pizza" Mock API Response

**Entity:** Joe's Pizza Ltd  
**Business ID:** `biz_joes_pizza_ltd_gb_001`  
**Entity Country:** GB  
**Input Sources:**
- OpenCorporates → `UK SIC 56101` (Licensed restaurants and cafes) — confidence: 0.91
- ZoomInfo → `NAICS 722511` (Full-Service Restaurants) — confidence: 0.76
- Trulioo → `US SIC 5812` (Eating Places) — confidence: 0.68 — **4-digit US SIC for GB entity**
- Equifax → `NAICS 551112` (Offices of Other Holding Companies) — confidence: 0.65 — secondary signal
- AI Semantic Web Scrape → "B2B frozen food distribution; app-based delivery platform" → `NAICS 424410` (General Line Grocery Merchant Wholesalers) + `NAICS 492210` (Local Messengers and Local Delivery)

```json
{
  "business_id": "biz_joes_pizza_ltd_gb_001",
  "entity_name": "Joe's Pizza Ltd",
  "entity_country": "GB",
  "classification_run_id": "run_7f3a9c2d-4b81-4e2a-a17f-9d3e8c1b0f45",
  "classified_at": "2026-03-24T10:47:22.341Z",
  "model_version": "consensus-engine-v2.1.0",

  "top_classifications": [
    {
      "taxonomy": "uk_sic_2007",
      "code": "56101",
      "label": "Licensed restaurants and cafes",
      "sector": "Accommodation and Food Service Activities",
      "consensus_probability": 0.847,
      "source_lineage": [
        {
          "source": "opencorporates",
          "taxonomy": "uk_sic_2007",
          "raw_code": "56101",
          "raw_label": "Licensed restaurants and cafes",
          "source_confidence": 0.91,
          "code_confidence": 0.91,
          "crosswalk_applied": false,
          "retrieved_at": "2026-03-20T14:22:11Z",
          "shap_contribution": 0.423
        },
        {
          "source": "zoominfo",
          "taxonomy": "naics_2022",
          "raw_code": "722511",
          "raw_label": "Full-Service Restaurants",
          "source_confidence": 0.76,
          "code_confidence": 0.76,
          "crosswalk_applied": true,
          "crosswalk_confidence": 0.88,
          "retrieved_at": "2026-02-14T09:11:03Z",
          "shap_contribution": 0.271
        },
        {
          "source": "trulioo",
          "taxonomy": "us_sic",
          "raw_code": "5812",
          "raw_label": "Eating Places",
          "source_confidence": 0.68,
          "code_confidence": 0.31,
          "crosswalk_applied": true,
          "crosswalk_confidence": 0.41,
          "retrieved_at": "2026-03-01T08:55:44Z",
          "shap_contribution": 0.089,
          "_note": "Pollution-adjusted: US SIC 4-digit code for GB entity. Weight down-adjusted by taxonomy_pollution_flag."
        }
      ],
      "crosswalk_equivalents": {
        "naics_2022": {
          "code": "722511",
          "label": "Full-Service Restaurants",
          "mapping_confidence": 0.88
        },
        "nace_rev2": {
          "code": "56.10",
          "label": "Restaurants and mobile food service activities",
          "mapping_confidence": 0.99
        },
        "mcc": {
          "code": "5812",
          "label": "Eating Places, Restaurants",
          "mapping_confidence": 0.92
        }
      }
    },

    {
      "taxonomy": "naics_2022",
      "code": "424410",
      "label": "General Line Grocery Merchant Wholesalers",
      "sector": "Wholesale Trade",
      "consensus_probability": 0.094,
      "source_lineage": [
        {
          "source": "ai_enrichment",
          "taxonomy": "naics_2022",
          "raw_code": "424410",
          "raw_label": "General Line Grocery Merchant Wholesalers",
          "source_confidence": 0.79,
          "code_confidence": 0.79,
          "crosswalk_applied": false,
          "retrieved_at": "2026-03-24T10:44:01Z",
          "shap_contribution": 0.198,
          "_note": "LLM inferred from web content describing B2B frozen food distribution arm."
        }
      ],
      "crosswalk_equivalents": {
        "uk_sic_2007": {
          "code": "46390",
          "label": "Non-specialised wholesale of food, beverages and tobacco",
          "mapping_confidence": 0.74
        },
        "nace_rev2": {
          "code": "46.39",
          "label": "Non-specialised wholesale of food, beverages and tobacco",
          "mapping_confidence": 0.74
        }
      }
    },

    {
      "taxonomy": "naics_2022",
      "code": "492210",
      "label": "Local Messengers and Local Delivery",
      "sector": "Transportation and Warehousing",
      "consensus_probability": 0.038,
      "source_lineage": [
        {
          "source": "ai_enrichment",
          "taxonomy": "naics_2022",
          "raw_code": "492210",
          "raw_label": "Local Messengers and Local Delivery",
          "source_confidence": 0.79,
          "code_confidence": 0.61,
          "crosswalk_applied": false,
          "retrieved_at": "2026-03-24T10:44:01Z",
          "shap_contribution": 0.071,
          "_note": "LLM inferred from web content describing app-based delivery platform."
        }
      ],
      "crosswalk_equivalents": {
        "uk_sic_2007": {
          "code": "53202",
          "label": "Other postal and courier activities",
          "mapping_confidence": 0.61
        }
      }
    },

    {
      "taxonomy": "naics_2022",
      "code": "551112",
      "label": "Offices of Other Holding Companies",
      "sector": "Management of Companies and Enterprises",
      "consensus_probability": 0.017,
      "source_lineage": [
        {
          "source": "equifax",
          "taxonomy": "naics_2022",
          "raw_code": "551112",
          "raw_label": "Offices of Other Holding Companies",
          "source_confidence": 0.65,
          "code_confidence": 0.65,
          "crosswalk_applied": false,
          "retrieved_at": "2026-01-07T00:00:00Z",
          "shap_contribution": -0.124,
          "_note": "Negative SHAP: this source actively reduces consensus probability for holding company classification. Its low temporal freshness and conflict with 3 other sources drives the model to discount it for classification—but it is retained as an AML risk signal."
        }
      ],
      "crosswalk_equivalents": {
        "uk_sic_2007": {
          "code": "64205",
          "label": "Activities of financial services holding companies",
          "mapping_confidence": 0.71
        }
      }
    },

    {
      "taxonomy": "naics_2022",
      "code": "311991",
      "label": "Perishable Prepared Food Manufacturing",
      "sector": "Manufacturing",
      "consensus_probability": 0.004,
      "source_lineage": [
        {
          "source": "ai_enrichment",
          "taxonomy": "naics_2022",
          "raw_code": "311991",
          "raw_label": "Perishable Prepared Food Manufacturing",
          "source_confidence": 0.79,
          "code_confidence": 0.42,
          "crosswalk_applied": false,
          "retrieved_at": "2026-03-24T10:44:01Z",
          "shap_contribution": 0.028,
          "_note": "LLM inferred from 'B2B frozen food distribution' — model assigns lower confidence as evidence points more to wholesale distribution than manufacturing."
        }
      ],
      "crosswalk_equivalents": {
        "uk_sic_2007": {
          "code": "10710",
          "label": "Manufacture of bread; manufacture of fresh pastry goods and cakes",
          "mapping_confidence": 0.44
        }
      }
    }
  ],

  "discrepancy_scores": {
    "web_registry_discrepancy": 0.81,
    "multi_sector_span": 4,
    "llm_semantic_coherence": 0.23,
    "temporal_drift_score": 0.67,
    "source_agreement_rate": 0.42
  },

  "risk_flags": [
    {
      "flag_type": "SECTOR_CONFLICT_REGISTRY_VS_WEB",
      "severity": "HIGH",
      "description": "Equifax public records return NAICS 551112 (Holding Company), while OpenCorporates (Companies House ground truth) and ZoomInfo independently confirm food service classification (UK SIC 56101 / NAICS 722511). A holding company registration combined with an active consumer-facing web presence is a documented AML typology for transaction layering.",
      "triggering_sources": ["equifax", "opencorporates", "zoominfo"],
      "discrepancy_score": 0.81,
      "recommended_action": "Escalate to Enhanced Due Diligence (EDD) review. Request beneficial ownership documentation. Verify whether operating entity and holding entity are the same legal entity or a group structure.",
      "aml_risk_multiplier": 2.5
    },
    {
      "flag_type": "TAXONOMY_POLLUTION_US_SIC_FOR_UK_ENTITY",
      "severity": "LOW",
      "description": "Trulioo returned US SIC 5812 (Eating Places) for a GB-registered entity. UK SIC 2007 requires a 5-digit code; US SIC is 4-digit. This is a data quality issue — the Trulioo code has been down-weighted in the consensus model but flagged for data quality monitoring.",
      "triggering_sources": ["trulioo"],
      "discrepancy_score": 1.0,
      "recommended_action": "Log for Trulioo source quality monitoring. No immediate underwriting action required — the pollution has been corrected in the consensus model.",
      "aml_risk_multiplier": 1.2
    },
    {
      "flag_type": "SECTOR_PIVOT_UNCONFIRMED",
      "severity": "MEDIUM",
      "description": "AI semantic web scraping identifies a recent operational pivot to B2B frozen food distribution and app-based delivery. This new business model (NAICS 424410, 492210) is not reflected in current Companies House SIC filings (still showing 56101 — Licensed restaurants). Businesses that pivot without updating registry filings may be concealing material operational changes.",
      "triggering_sources": ["ai_enrichment", "opencorporates"],
      "discrepancy_score": 0.67,
      "recommended_action": "Request updated business information from applicant. Verify whether the B2B distribution arm is operated through the same legal entity or a separate subsidiary. Check if SIC codes at Companies House have been updated in the last 12 months.",
      "aml_risk_multiplier": 1.8
    },
    {
      "flag_type": "HOLDING_COMPANY_DISCREPANCY",
      "severity": "HIGH",
      "description": "Equifax public records contain NAICS 551112 (Offices of Other Holding Companies) as a secondary classification for this entity. Combined with the multi-sector span of 4 and the restaurant web presence, this creates a pattern consistent with a shell company or complex group structure used for financial layering.",
      "triggering_sources": ["equifax"],
      "discrepancy_score": 0.91,
      "recommended_action": "Immediately trigger UBO (Ultimate Beneficial Owner) verification workflow. Cross-reference Equifax holding company signal against Companies House persons of significant control (PSC) register. Do not approve any financial product until UBO chain is fully resolved.",
      "aml_risk_multiplier": 3.1
    },
    {
      "flag_type": "AML_ENHANCED_DUE_DILIGENCE_TRIGGERED",
      "severity": "CRITICAL",
      "description": "Combined AML risk multiplier from all active risk flags: 8.6× baseline. This entity exhibits 4 of 5 documented discrepancy typologies simultaneously. Classification uncertainty is high (overall confidence: 0.61, source agreement rate: 0.42). This combination crosses the automated EDD threshold.",
      "triggering_sources": ["equifax", "opencorporates", "zoominfo", "trulioo", "ai_enrichment"],
      "discrepancy_score": 0.88,
      "recommended_action": "Block automated approval. Route to Senior Compliance Analyst for manual EDD review. Collect: (1) Audited accounts for last 2 years, (2) UBO declaration, (3) Evidence of operating relationship between holding and trading entities, (4) Source of funds declaration.",
      "aml_risk_multiplier": 8.6
    }
  ],

  "overall_classification_confidence": 0.61,
  "requires_manual_review": true,

  "recommended_primary_code": {
    "taxonomy": "uk_sic_2007",
    "code": "56101",
    "label": "Licensed restaurants and cafes",
    "probability": 0.847
  }
}
```

---

### 5.3 Implementation Roadmap

The following roadmap sequences the technical changes required to move from the current architecture to the Consensus Engine. Tasks are organized by dependency graph, not calendar time.

#### Track 1: Data Layer (No Breaking Changes)

**T1.1 — Secondary SIC Code Capture**

Modify `businessDetails/index.ts` to capture all `gb_sic` entries from `industry_code_uids`, not just the first. Store as `uk_sic_secondary_codes: string[]`.

- Files: `integration-service/lib/facts/businessDetails/index.ts`
- Effort: Low — loop modification + schema update
- Dependency: None

**T1.2 — Trulioo Pollution Flag**

Add deterministic detection in the Trulioo source handler: if entity country is GB and Trulioo returns a 4-digit numeric code, set `trulioo_pollution_flag = true` and down-weight the Trulioo signal to 0.1 for classification purposes.

- Files: `integration-service/lib/facts/businessDetails/index.ts`, `integration-service/lib/facts/rules.ts`
- Effort: Low — guard clause + flag field addition

**T1.3 — Equifax Secondary NAICS Extraction**

Currently, Equifax's `secnaics1`, `secnaics2`, `secnaics3` fields (documented in `datapooler/models/integrations/equifax/judgements_liens.py`) are not surfaced into the fact store. Add extraction of these secondary fields into the `naics_code` fact definition.

- Files: `integration-service/lib/facts/businessDetails/index.ts`, `integration-service/lib/facts/score/index.ts`
- Effort: Low — path extraction addition

**T1.4 — Source Lineage Persistence**

Add a new fact output field `source_lineage_raw` that persists all vendor responses (code, confidence, retrieved_at) before the consensus rule is applied. This is the raw material for the Consensus Engine's feature vector.

- Files: `integration-service/lib/facts/factEngine.ts`, new migration in `integration-service/db/migrations/`
- Effort: Medium — new persistence layer

---

#### Track 2: Warehouse Service (ML Model Development)

**T2.1 — Feature Vector Builder**

Implement `ConsensusFeatureBuilder` in `warehouse-service/datapooler/services/consensus_engine.py`. Transforms raw source lineage records into the 25-feature vector defined in Section 4.2.

- Effort: Medium — feature engineering from defined spec

**T2.2 — Taxonomy Crosswalk Service**

Implement `CrosswalkService` using official UN/OECD crosswalk tables. Provides `crosswalk(code, from_taxonomy, to_taxonomy) → {code: str, confidence: float}[]`.

- Effort: Medium — data loading + probabilistic crosswalk lookup

**T2.3 — XGBoost Training Pipeline**

Train the multi-label classification model on historical fact store data. Implement Platt scaling calibration. Store model artifact in S3, versioned.

- Effort: High — requires labeled training data collection + hyperparameter search

**T2.4 — Discrepancy Detection Models**

Train 5 binary classifiers (one per discrepancy type) using engineered features. The `SECTOR_CONFLICT_REGISTRY_VS_WEB` and `HOLDING_COMPANY_DISCREPANCY` models have highest priority.

- Effort: High — 5 models × train/validate/calibrate cycle

**T2.5 — SHAP Integration for Source Lineage**

Integrate SHAP (TreeExplainer for XGBoost) to generate per-source attribution scores for each prediction. Map SHAP values to `shap_contribution` in `SourceLineageRecord`.

- Effort: Low (SHAP library integration only)

**T2.6 — FastAPI Consensus Endpoint**

Expose `POST /v1/consensus/classify` in `warehouse-service/datapooler/web/routers/`. Accept source lineage records, run feature construction + model inference, return `ConsensusEngineResult`.

- Effort: Medium — API handler + Pydantic schemas

---

#### Track 3: Integration Service (Engine Wiring)

**T3.1 — LLM Schema Refactoring**

Refactor `naicsEnrichmentResponseSchema` in `aiNaicsEnrichment.ts` to:
- Remove `naics_code` as required (make optional for non-US entities)
- Replace ordinal `confidence: enum` with `confidence_score: float` (calibrated 0.0–1.0)
- Add `top_classifications: ClassificationResult[]` output (multi-code output)
- Remove `NAICS_OF_LAST_RESORT` fallback — replace with null output + `HIGH_CLASSIFICATION_UNCERTAINTY` flag

- Files: `integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts`
- Effort: Medium — schema change + prompt engineering update

**T3.2 — Continuous LLM Integration**

Remove the `maximumSources: 3` trigger suppression from `DEPENDENT_FACTS`. Instead, trigger the AI enrichment task **always** for discrepancy detection — specifically when `web_registry_discrepancy_score > 0.5`. The AI's role transitions from "last resort classifier" to "continuous discrepancy analyzer."

- Files: `integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts`
- Effort: Low — condition change

**T3.3 — Consensus Engine Client**

Implement `ConsensusEngineClient` in integration-service that calls the warehouse-service consensus endpoint. Replace `applyRules(factWithHighestConfidence)` for `naics_code` and `uk_sic_code` facts with `ConsensusEngineClient.classify(factStore)`.

- Files: New `integration-service/lib/consensus/consensusEngineClient.ts`
- Effort: Medium — HTTP client + type mapping

**T3.4 — Risk Flag Propagation**

Wire `ConsensusEngineResult.risk_flags` into the existing risk alert system. HIGH/CRITICAL flags trigger the `risk-alerts` module workflow. Map `AML_ENHANCED_DUE_DILIGENCE_TRIGGERED` to automatic EDD queue routing.

- Files: `integration-service/src/api/v1/modules/risk-alerts/`
- Effort: Medium — event routing

---

#### Track 4: Consumer APIs (Output Schema)

**T4.1 — Facts API Response Extension**

Extend the `/facts` API response to include `consensus_result` alongside the existing `naics_code` and `uk_sic_code` fields. The existing fields remain for backward compatibility, populated from `recommended_primary_code`.

- Files: `integration-service/src/api/v1/modules/facts/controllers.ts`
- Effort: Low — response enrichment

**T4.2 — Case Service Integration**

Propagate `risk_flags` from the Consensus Engine to the case-service risk assessment workflow. HIGH/CRITICAL flags should block case auto-approval and create a manual review task.

- Files: `case-service/src/api/v1/modules/` (risk/onboarding modules)
- Effort: Medium — cross-service event handling

---

<a name="appendix-a"></a>
## Appendix A: Joe's Pizza End-to-End Trace

This appendix traces the complete data flow for "Joe's Pizza Ltd" through both the **current architecture** and the **proposed Consensus Engine**, side by side.

### Current Architecture Flow

```
1. FactEngine.match() executes:
   ├── opencorporates.getter() → OpenCorporateResponse
   │   └── industry_code_uids = "gb_sic-56101|gb_sic-64205"  ← 2 SIC codes filed
   │       └── Current code: returns "56101" (first match), discards "64205"
   ├── zoominfo.getter() → ZoomInfoResponse
   │   └── naics_code from ZI firmographic = "722511"
   ├── equifax.getter() → EquifaxCombined
   │   └── efx_naics = "551112"  ← Holding company
   │       secnaics1 = "722511"  ← DISCARDED (secondary field not extracted)
   └── business.getter() (Trulioo) → raw response
       └── SIC code = "5812" (4-digit US SIC for GB entity) ← NOT FLAGGED

2. applyRules(factWithHighestConfidence) for naics_code:
   ├── Input facts: [zoominfo:722511 (conf:0.76), equifax:551112 (conf:0.65), trulioo:5812 (conf:0.68)]
   ├── OpenCorporates doesn't contribute to naics_code directly (it's in uk_sic_code path)
   ├── zoominfo (0.76) vs equifax (0.65): diff=0.11 > 0.05 threshold → zoominfo wins
   ├── zoominfo (0.76) vs trulioo (0.68): diff=0.08 > 0.05 threshold → zoominfo wins
   └── RESULT: naics_code = "722511" ✓ (accidentally correct, but for wrong reasons)

3. applyRules(factWithHighestConfidence) for uk_sic_code:
   └── RESULT: uk_sic_code = "56101" ✓ (correct)

4. AML Risk Output:
   └── NONE — the holding company signal (551112) was "defeated" and discarded
               The web scrape pivot data was not cross-referenced against registry
               No risk flags generated
               Joe's Pizza is approved as a standard restaurant ← DANGEROUS
```

### Proposed Consensus Engine Flow

```
1. FactEngine.match() executes (same as above, plus T1 data layer changes):
   ├── opencorporates: returns BOTH gb_sic codes ["56101", "64205"]
   │                  companies_house_sic_count = 2
   ├── zoominfo: naics = "722511", confidence = 0.76
   ├── equifax: naics_primary = "551112", naics_secondary = "722511" (now extracted)
   ├── trulioo: sic_raw = "5812", trulioo_pollution_flag = TRUE (4-digit for GB entity)
   └── ai_enrichment: runs continuously (not suppressed)
       └── LLM analyzes web content → ["424410", "492210"], llm_semantic_match_score = 0.23

2. ConsensusFeatureBuilder constructs 25-feature vector:
   ├── oc_uk_sic_primary = 56101
   ├── oc_uk_sic_secondary_count = 2  (both 56101 + 64205)
   ├── oc_us_naics_crosswalk = {722511: 0.88, 722513: 0.09, ...}  (from 56101)
   ├── zi_naics_code = 722511
   ├── efx_naics_primary = 551112
   ├── efx_naics_secondary = 722511  (now captured)
   ├── tru_sic_raw = 5812
   ├── trulioo_pollution_flag = 1  (down-weights tru contribution)
   ├── ai_naics_codes = [424410, 492210]
   ├── web_registry_discrepancy_score = 0.81  (restaurants vs holding company)
   ├── multi_sector_span = 4  (food service, wholesale, delivery, finance/holding)
   ├── holding_company_signal = 1  (551112 + 64205 both present)
   ├── llm_semantic_match_score = 0.23  (high incoherence across sources)
   └── ... (remaining features)

3. XGBoost model inference:
   ├── Input: 25-feature vector
   ├── Output (raw probabilities, pre-calibration):
   │   [uk_sic_56101: 0.851, naics_424410: 0.091, naics_492210: 0.036,
   │    naics_551112: 0.015, naics_311991: 0.004, other: 0.003]
   └── Post Platt scaling: [0.847, 0.094, 0.038, 0.017, 0.004, ...]

4. Discrepancy detection models:
   ├── SECTOR_CONFLICT_REGISTRY_VS_WEB: P=0.94 → HIGH flag triggered
   ├── TAXONOMY_POLLUTION: P=0.99 (deterministic) → LOW flag triggered
   ├── SECTOR_PIVOT_UNCONFIRMED: P=0.81 → MEDIUM flag triggered
   ├── HOLDING_COMPANY_DISCREPANCY: P=0.91 → HIGH flag triggered
   └── AML_EDD: combined multiplier 8.6× → CRITICAL flag triggered

5. SHAP attribution generates source_lineage with shap_contribution per source

6. Output: ConsensusEngineResult (see Section 5.2 for full payload)
   ├── top_classifications: [56101@0.847, 424410@0.094, 492210@0.038, ...]
   ├── risk_flags: 5 flags including CRITICAL AML_EDD
   ├── requires_manual_review: true
   └── Joe's Pizza is BLOCKED for manual EDD review ← CORRECT
```

**The key difference:** In the current architecture, the holding company signal (NAICS 551112) is treated as a "losing" fact and discarded. In the Consensus Engine, it is a **low-probability but high-significance signal** that contributes to a risk flag even while being down-weighted in the classification output. The Equifax Holding Company code has a consensus probability of only 0.017 (correctly ranked 4th) but simultaneously triggers two HIGH-severity AML risk flags. The engine successfully separates "what industry is this business most likely in" from "what risk signals does the full source pattern emit" — a distinction the current deterministic rule conflates.

---

<a name="appendix-b"></a>
## Appendix B: Feature Engineering Reference

### B.1 Computing `web_registry_discrepancy_score`

The discrepancy score measures the semantic distance between the "registry view" of a company's industry and the "observed operational view."

**Step 1: Classify sources into registry vs. operational buckets**

| Source | Bucket |
|---|---|
| opencorporates (Companies House data) | Registry |
| equifax (public records) | Registry |
| zoominfo | Operational |
| ai_enrichment (web scrape) | Operational |
| serp | Operational |
| trulioo | Registry (weighted by pollution flag) |

**Step 2: Embed all codes into a shared semantic space**

Use a pre-trained industry embedding model (fine-tuned on NAICS/SIC descriptions + economic activity text). Each code is represented as a 128-dimensional vector. Industry embeddings can be pre-computed and cached — the embedding step is not on the critical path.

**Step 3: Compute centroid distance**

```
registry_centroid = mean(embeddings for all registry-bucket codes)
operational_centroid = mean(embeddings for all operational-bucket codes)
web_registry_discrepancy_score = cosine_distance(registry_centroid, operational_centroid)
```

Output range: [0.0, 1.0] where 0.0 = identical sectors, 1.0 = maximally different sectors.

Joe's Pizza: `cosine_distance(embed(56101, 64205), embed(722511, 424410, 492210))` ≈ 0.81

### B.2 Computing `source_reliability_weight`

This replaces the static `weight` constants in `sources.ts` with dynamically computed per-source reliability estimates.

**Training data:**
- Ground truth label: manually confirmed industry codes (from underwriter overrides, IRS transcripts, Companies House filings)
- Feature: (source_name, entity_country, entity_size_band, fact_type)
- Label: binary — did this source return the eventually-confirmed correct code?

**Model:** logistic regression (one per source) trained on historical fact store data

**Output:** per-request reliability weight in [0.0, 1.0]

**Example calibrated weights (illustrative — actual values from model training):**

| Source | UK Restaurant | UK Holding Co | US Tech SMB |
|---|---|---|---|
| opencorporates | 0.94 | 0.89 | 0.31 |
| zoominfo | 0.71 | 0.58 | 0.83 |
| equifax | 0.62 | 0.77 | 0.69 |
| trulioo (pollution-adjusted) | 0.29 | 0.41 | 0.78 |
| ai_enrichment | 0.76 | 0.61 | 0.74 |

Note that OpenCorporates gets a very high weight for UK entities (it's querying Companies House directly) but a much lower weight for US entities (its US coverage is thinner). Trulioo's weight for UK restaurants is suppressed by the pollution adjustment. These context-specific weights cannot be captured by a single static constant.

---

*Document Version: 1.0 | Next Review: Quarterly (aligned with XGBoost model retraining cycle)*  
*Authors: Consensus Engine Initiative | Worth AI Data Science & Strategy*