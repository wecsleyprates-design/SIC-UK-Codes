# Worth Industry Classification & UK SIC Implementation Report v2

## 1. Integration Partner Industry Code Inventory

Worth's platform integrates with several partners to gather firmographic data, including industry classification codes.

| Partner | Industry Codes Provided | Code System | Authority |
| :--- | :--- | :--- | :--- |
| **Equifax** | `primnaicscode`, `secnaics1-4`, `primsic`, `secsic1-4` | US NAICS 2022, US SIC 1987 | Commercial/File |
| **ZoomInfo** | `zi_c_naics6`, `zi_c_sic4` | US NAICS 2022, US SIC 1987 | Commercial/API |
| **OpenCorporates** | `industry_code_uids` (e.g., `us_naics-541110`, `gb_sic-62012`) | Multi-jurisdiction (NAICS, UK SIC, NACE, etc.) | Government Registry |
| **Trulioo** | `naicsCode`, `sicCode`, `industryName` | US NAICS 2022, Unknown SIC (likely US or UK) | Commercial/API |
| **SERP Scrape** | `businessLegitimacyClassification.naics_code` | US NAICS 2022 (Inferred) | Web Scrape |
| **BusinessDetails** | `naics_code` | US NAICS 2022 (Self-reported) | Customer Submission |
| **AI Enrichment** | `naics_code`, `mcc_code` | US NAICS 2022, MCC (Inferred) | AI Inference |

## 2. Source Classification: File vs. API

| Source | Category | Data Path |
| :--- | :--- | :--- |
| **Equifax** | **File Source** | Ingested via batch files into Redshift; mirrored to RDS `integration_data.request_response`. |
| **ZoomInfo** | **API Source** | Real-time REST API call stored in `integration_data.request_response`. |
| **OpenCorporates** | **API Source** | Real-time REST API call stored in `integration_data.request_response`. |
| **Trulioo** | **API Source** | Real-time REST API call stored in `integration_data.request_response`. |
| **SERP Scrape** | **API Source** | Real-time scraping service stored in `integration_data.request_response`. |
| **BusinessDetails** | **Internal DB** | Stored in `public.data_businesses` (customer submitted). |
| **AI Enrichment** | **API Source** | Async OpenAI API call stored in `integration_data.request_response`. |

## 3. Received Code Analysis: Detailed Breakdown

### 3.1. US NAICS 2022 (6-digit)
The primary standard used across the platform. Supported by all sources for US businesses.

*   **How it is accessed:**
    *   **PostgreSQL (Operational):** The resolved ID is stored in `public.data_businesses.naics_id`, referencing `public.core_naics_code`.
    *   **Redshift (Warehouse):** Standardized in `datascience.customer_files` and `datascience.smb_pr_verification_cs`.
*   **SQL Access Code:**
    ```sql
    -- Get current resolved NAICS for a business (Postgres)
    SELECT db.id, nc.code AS naics_code, nc.label
    FROM public.data_businesses db
    JOIN public.core_naics_code nc ON db.naics_id = nc.id
    WHERE db.id = '<business_uuid>';

    -- Query warehouse for standardized NAICS (Redshift)
    SELECT business_name, primary_naics_code, country
    FROM datascience.customer_files
    WHERE primary_naics_code IS NOT NULL;
    ```

### 3.2. US SIC 1987 (4-digit)
Provided by Equifax (`primsic`) and ZoomInfo (`zi_c_sic4`).

*   **How it is discarded:** The `FactEngine` has no defined fact for `sic_code`. While source getters (like Equifax in `sources.ts`) fetch the entire response blob, the fact definitions in `businessDetails/index.ts` only extract the `naics_code`. Consequently, US SIC codes remain in the `response` JSONB but are never resolved or persisted to dedicated columns.
*   **How to access it:**
    *   **Feature:** `integration_data.extended_attributes` function (specifically for Equifax).
    *   **Table:** `integration_data.request_response` JSONB paths.
*   **SQL Access Code:**
    ```sql
    -- Access via the Extended Attributes feature (Postgres)
    SELECT business_id, primary_sic_code
    FROM integration_data.extended_attributes('<business_uuid>');

    -- Direct extraction from raw integration data (Postgres)
    SELECT
        business_id,
        response->>'primsic' AS equifax_sic,
        response->'firmographic'->>'zi_c_sic4' AS zoominfo_sic
    FROM integration_data.request_response
    WHERE platform_id IN (17, <ZOOMINFO_ID>);
    ```

### 3.3. UK SIC 2007 (5-digit)
Provided by OpenCorporates (prefixed with `gb_sic` in `industry_code_uids`) and Trulioo.

*   **How it is discarded/mislabeled:**
    1.  **Discarded by Filter:** In `businessDetails/index.ts`, the OpenCorporates parser explicitly loops through codes and only matches those containing `us_naics`. `gb_sic` entries are ignored.
    2.  **Mislabeled/Dropped:** Trulioo's `.sicCode` is extracted from raw JSON but never mapped to a fact. If a 4-digit US SIC is returned by Trulioo for a UK business, it might be incorrectly used if the system expects a 5-digit UK SIC.
*   **How to access it:**
    *   **Redshift:** `datascience.open_corporates_standard` contains the raw multi-jurisdiction strings.
    *   **Postgres:** `integration_data.request_response` for OpenCorporates/Trulioo.
*   **SQL Access Code:**
    ```sql
    -- Find UK SIC codes in the warehouse (Redshift)
    SELECT company_name, industry_code_uids
    FROM datascience.open_corporates_standard
    WHERE country_code = 'GB' AND industry_code_uids LIKE '%gb_sic%';

    -- Extract from raw response (Postgres)
    SELECT
        business_id,
        response->'firmographic'->>'industry_code_uids' AS raw_codes
    FROM integration_data.request_response
    WHERE platform_id = (SELECT id FROM integrations.core_integrations_platforms WHERE code = 'opencorporates')
      AND response->'firmographic'->>'industry_code_uids' LIKE '%gb_sic%';
    ```

### 3.4. Canadian NAICS (6-digit)
Provided by OpenCorporates (`ca_naics`).

*   **How it is discarded:** Identical to the UK SIC gap. The OpenCorporates logic in `integration-service` is hardcoded to look for the `us_naics` prefix. Anything starting with `ca_naics` is skipped during the fact resolution loop.
*   **How to access it:**
    *   **Redshift:** `datascience.open_corporates_standard` where `country_code = 'CA'`.
    *   **Postgres:** `integration_data.request_response` searching for `ca_naics` in the `industry_code_uids` field.
*   **SQL Access Code:**
    ```sql
    -- Warehouse lookup for Canadian businesses (Redshift)
    SELECT company_name, industry_code_uids
    FROM datascience.open_corporates_standard
    WHERE country_code = 'CA' AND industry_code_uids LIKE '%ca_naics%';
    ```

### 3.5. MCC (4-digit): Rich Derivation Details
Merchant Category Codes are critical for payment-processor compliance. Worth uses two parallel paths for MCC:

1.  **AI Inference (Direct):** GPT-5 mini is prompted in `aiNaicsEnrichment.ts` to infer a 4-digit MCC from business keywords and website content. This result is stored as the `mcc_code_found` fact.
2.  **NAICS Mapping (Derived):** The platform maintains a relational table `public.rel_naics_mcc` that links every known US NAICS code to a corresponding MCC. When a NAICS code is resolved, the system automatically looks up the mapped MCC ID.
3.  **Selection Logic:** In `businessDetails/index.ts`, the `mcc_code` fact resolver follows a hierarchy:
    *   If AI returned a direct `mcc_code_found`, it **wins** (Weight: 0.1, but often the only direct source).
    *   Otherwise, it uses the mapped value `mcc_code_from_naics`.
*   **Postgres Tables:** `public.core_mcc_code`, `public.rel_naics_mcc`, `public.data_businesses.mcc_id`.

---

## 4. Warehouse Schema Analysis & SQL Queries

For finding UK businesses and their industry codes in the warehouse, the following schemas and tables should be queried.

### 4.1. Finding UK Businesses in OpenCorporates (datascience)
```sql
SELECT
    company_name,
    company_number,
    jurisdiction_code,
    country_code,
    industry_code_uids
FROM datascience.open_corporates_standard
WHERE country_code = 'GB' OR jurisdiction_code = 'gb'
LIMIT 100;
```

### 4.2. Combined Verification Data (datascience)
```sql
SELECT
    business_name,
    primary_naics_code,
    primary_sic_code,
    country
FROM datascience.sm_pr_verification_cs
WHERE country = 'GB'
LIMIT 100;
```

### 4.3. Master Customer Files (datascience)
```sql
SELECT
    business_name,
    primary_naics_code,
    mcc_code,
    country
FROM datascience.customer_files
WHERE country = 'GB'
LIMIT 100;
```

### 4.4. Raw Industry Code Extraction (warehouse)
```sql
SELECT
    company_number,
    industry_code_uids
FROM warehouse.oc_companies_latest
WHERE jurisdiction_code = 'gb' AND industry_code_uids LIKE '%gb_sic%'
LIMIT 100;
```

## 5. Multi-Source Selection Logic

### Current Rule: `factWithHighestConfidence`
1.  Collect all candidate values for a fact (e.g., `naics_code`).
2.  Filter out `null` or empty values.
3.  Select the candidate with the highest **Confidence Score** (0.0 to 1.0).
4.  If confidence scores are within `WEIGHT_THRESHOLD` (0.05), use **Static Weight** as a tiebreaker.

### Proposed logic for UK SIC:
1.  **Prefer Registry Data:** OpenCorporates `gb_sic` codes are sourced directly from Companies House and should have the highest weight (0.9).
2.  **Fallback to AI:** If registry data is missing, use AI Enrichment (0.1 weight) to predict the code.
3.  **Discard Pollution:** Filter Trulioo `sicCode` values to ensure they are 5-digit strings before accepting them as UK SIC.

## 6. AI Enrichment Strategy

### Validation and Improvement:
*   **Contextual Input:** AI receives business name, website content, and address country.
*   **System Prompt:** Instruct AI to return both US NAICS and UK SIC (if country is GB).
*   **Schema Enforcement:** Update Zod schema to include `uk_sic_code`.
*   **Registry Verification:** AI-returned codes are validated against the `core_uk_sic_code` table. If invalid, a fallback is used.
*   **Cleansing:** AI can map legacy registry codes (SIC 1992/2003) to the modern 2007 standard.

## 7. Vendor Deep Dive: Trulioo & OpenCorporates

### Trulioo Code Investigation:
*   **Observation:** Trulioo often returns 4-digit codes for UK businesses labeled as "US Standard Industry Code".
*   **Risk:** Directly using Trulioo's `sicCode` field for UK businesses will result in US SIC codes being stored as UK SIC codes.
*   **Action:** Only accept 5-digit numeric strings from Trulioo as `uk_sic_code` candidates.

### OpenCorporates Code Investigation:
*   **Observation:** OpenCorporates provides a `classification_codes` fact but it's not dedicated.
*   **Action:** Create a specific `uk_sic_code` fact that extracts the `gb_sic` prefix from the `industry_code_uids` string.

## 8. Recommended Selection Algorithm

To resolve industry codes across multiple sources effectively:

1.  **Tier 1: Manual Override.** Always check for human-verified data first.
2.  **Tier 2: Official Registries.** High weight (0.9) for OpenCorporates `gb_sic` or `us_naics`.
3.  **Tier 3: Verified Commercial APIs.** Moderate weight (0.8) for ZoomInfo/Equifax/Trulioo.
4.  **Tier 4: Inferred Data.** Low weight (0.3) for SERP/Scrape.
5.  **Tier 5: AI Prediction.** Lowest weight (0.1) as a gap-filler.

### Logic for Empty/NULL values:
*   If all sources return `NULL`, trigger AI Enrichment.
*   If AI Enrichment also fails, use the "Last Resort" fallback code: `561499` (Administrative & Support Services).

---
**Report prepared for Worth engineering team.**
