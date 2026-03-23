# Worth's Industry Classification Pipeline — Complete Technical Report

**Date:** March 23, 2026  
**Branch:** `cursor/worth-s-industry-classification-2cd0`  
**Scope:** Integration-Service, Case-Service, Warehouse-Service

---

## SECTION 0 — EXECUTIVE SUMMARY

Industry classification is the process of assigning a standardized code (such as NAICS or SIC) to a business entity that describes the economic sector in which it primarily operates. For Know-Your-Business (KYB) and risk underwriting, an accurate industry code is one of the most important inputs: it drives risk scoring (certain industries carry higher default or fraud rates), it gates eligibility for credit products (some lenders never touch cannabis, firearms, or cryptocurrency businesses), it feeds MCC-level payment-processor compliance, and it controls which regulatory frameworks apply to a customer (e.g., FinCEN requirements differ for money-service businesses). Worth's platform currently collects industry codes from **six live operational sources** — Equifax (batch/file), ZoomInfo (API), OpenCorporates (API), Trulioo (API), SERP scrape (API), and customer-submitted `businessDetails` — plus a **seventh AI-based fallback** (GPT-5 mini) that runs when too few sources respond. The codes returned include US NAICS 2022 (6-digit), US SIC 1987 (4-digit from Equifax and ZoomInfo), UK SIC 2007 (5-digit from OpenCorporates and Trulioo), and Canadian NAICS (6-digit from OpenCorporates). The platform's PostgreSQL schema stores 1,035 NAICS codes (US) and 125 MCC codes with a join mapping between them; there is **no storage column** for UK SIC 2007, Canadian NAICS, or US SIC 1987. The fact engine correctly resolves and persists a US NAICS code and a derived MCC for US-based businesses. However, for the approximately **all non-US businesses** (particularly UK entities), the pipeline has four sequential gaps that silently discard available UK SIC data before it can reach the database; this means every UK business either receives an inappropriate US NAICS code or has `naics_id = NULL`. The top priority improvement is to add a `core_uk_sic_code` reference table, a `uk_sic_id` column on `data_businesses`, and wire the two existing UK SIC data sources (OpenCorporates `classification_codes` fact and Trulioo's `.sicCode` field) into a new `uk_sic_code` fact — all of which can be done using data **already in the database** with zero new API calls.

---

## SECTION 1 — ALL INTEGRATION SOURCES: COMPLETE INVENTORY

### 1.1 Source: Equifax (File/Batch — Warehouse)

| Attribute | Value |
|---|---|
| Source name | `equifax` |
| Type | Batch / file ingest (offline warehouse pipeline) |
| Platform ID | `17` (hardcoded in `extended_attributes` SQL function and getter) |
| Source-level weight | `0.7` |
| Category | `publicRecords` |

**Fields returned for industry:**
- `primnaicscode` — Primary NAICS code (6-digit string)
- `primnaics_sector`, `primnaics_subsector`, `primnaics_industry_group`, `primnaics_industry` — hierarchical labels
- `secnaics1`–`secnaics4` (each with `_sector`, `_subsector`, `_industry_group`, `_industry`) — up to 4 secondary NAICS
- `primsic` — Primary SIC 1987 code (4-digit)
- `secsic1`–`secsic4` — up to 4 secondary SIC codes

**Code type:** US NAICS (primary and secondary hierarchy) + US SIC 1987 (primary and secondary)

**Where it reads from:** `integration_data.request_response` WHERE `platform_id = 17` AND `request_type = 'fetch_public_records'` AND `response->>'efx_id' IS NOT NULL`.

```typescript
// integration-service/lib/facts/sources.ts  lines 311–353
equifax: {
    category: "publicRecords",
    platformId: INTEGRATION_ID.EQUIFAX,
    scope: "business",
    weight: 0.7, // Equifax has a low weight because it relies upon manual files being ingested at some unknown cadence
    getter: async function (businessID: any) {
        const queryResult = await db("integration_data.request_response")
            .join(
                "integrations.data_business_integrations_tasks",
                "request_response.request_id",
                "data_business_integrations_tasks.id"
            )
            .select(
                "data_business_integrations_tasks.metadata",
                "request_response.response",
                "request_response.requested_at"
            )
            .where({ business_id: businessID, platform_id: INTEGRATION_ID.EQUIFAX, request_type: "fetch_public_records" })
            .andWhereRaw("response->>'efx_id' is not null")
            .orderBy("requested_at", "DESC")
            .limit(1)
            .first();
        // ...confidence computed from metadata.match.prediction or match.index
        const response = { ...queryResult.metadata?.result, ...queryResult.response };
        return response;
    }
}
```

**Mapping to `naics_code` fact:**

```typescript
// integration-service/lib/facts/businessDetails/index.ts  line 279
naics_code: [
    { source: sources.equifax, path: "primnaicscode" },
    // ...other sources
]
```

**USED or SILENTLY DROPPED:**
- `primnaicscode` → **USED** (mapped to `naics_code` fact via `path: "primnaicscode"`)
- `primsic`, `secsic1`–`secsic4` → ⚠️ **SILENTLY DROPPED** (present in model and extended_attributes function but no fact is defined for them)
- `primnaics_sector`, all secondary NAICS → ⚠️ **SILENTLY DROPPED** (available in `extended_attributes` SQL function but not consumed by any TypeScript fact)

**Why weight 0.7?** The comment in `sources.ts` line 315 explains it explicitly: *"Equifax has a low weight because it relies upon manual files being ingested at some unknown cadence."* This is a file-based batch integration — data may be days or weeks old. A live API returning real-time data should outcompete it. The 0.7 weight reflects acknowledged staleness risk.

---

### 1.2 Source: ZoomInfo (Live API)

| Attribute | Value |
|---|---|
| Source name | `zoominfo` |
| Type | Live API |
| Platform ID | `INTEGRATION_ID.ZOOMINFO` |
| Source-level weight | `0.8` |
| Category | `kyb` |

**Fields returned for industry:**
- `firmographic.zi_c_naics6` — 6-digit US NAICS code
- `firmographic.zi_c_sic4` — 4-digit US SIC code (available in the raw response but **no fact defined for it**)

**Code type:** US NAICS 2022 (6-digit primary)

**Where it reads from:** `integration_data.request_response` WHERE `platform_id = INTEGRATION_ID.ZOOMINFO`, latest record by `requested_at`.

```typescript
// integration-service/lib/facts/sources.ts  lines 277–293
zoominfo: {
    category: "kyb",
    platformId: INTEGRATION_ID.ZOOMINFO,
    scope: "business",
    weight: 0.8,
    getter: async function (businessID: any) {
        const [response, index, updatedAt] = await getFromRequestResponse<ZoomInfoResponse>(businessID, {
            platform_id: INTEGRATION_ID.ZOOMINFO
        });
        if (!response) return;
        this.confidence = index ?? undefined;
        this.updatedAt = updatedAt ?? undefined;
        return response?.firmographic && response;
    }
}
```

**Mapping to `naics_code` fact:**

```typescript
// integration-service/lib/facts/businessDetails/index.ts  line 280
{ source: sources.zoominfo, path: "firmographic.zi_c_naics6" },
```

**USED or SILENTLY DROPPED:**
- `zi_c_naics6` → **USED** (mapped to `naics_code` fact)
- `zi_c_sic4` → ⚠️ **SILENTLY DROPPED** (no fact definition, no path mapping)

**Why weight 0.8?** ZoomInfo is a high-quality, frequently-updated firmographic database with strong US coverage. It is a live API so freshness is guaranteed on each call. The 0.8 weight places it second behind `opencorporates` (0.9), reflecting its strong but not authoritative status.

---

### 1.3 Source: OpenCorporates (Live API)

| Attribute | Value |
|---|---|
| Source name | `opencorporates` |
| Type | Live API |
| Platform ID | `INTEGRATION_ID.OPENCORPORATES` |
| Source-level weight | `0.9` |
| Category | `kyb` |

**Fields returned for industry:**
- `firmographic.industry_code_uids` — pipe-delimited string of `<scheme>-<code>` pairs (e.g., `"us_naics-541110|uk_sic-62012|ca_naics-541110"`)

**Code types:** US NAICS, UK SIC 2007, CA NAICS — all packed into a single pipe-delimited field.

**Where it reads from:** `integration_data.request_response` WHERE `platform_id = INTEGRATION_ID.OPENCORPORATES`, latest record by `requested_at`.

```typescript
// integration-service/lib/facts/sources.ts  lines 294–310
opencorporates: {
    category: "kyb",
    platformId: INTEGRATION_ID.OPENCORPORATES,
    weight: 0.9,
    scope: "business",
    getter: async function (businessID: any) {
        const [response, confidence, updatedAt] = await getFromRequestResponse<OpenCorporateResponse>(businessID, {
            platform_id: INTEGRATION_ID.OPENCORPORATES
        });
        if (!response) return;
        this.confidence = confidence ?? undefined;
        this.updatedAt = updatedAt ?? undefined;
        return response?.firmographic && response;
    }
}
```

**Mapping to `naics_code` fact (US only):**

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 282–298
{
    source: sources.opencorporates,
    fn: (_, oc: OpenCorporateResponse) => {
        if (!oc.firmographic?.industry_code_uids) return Promise.resolve(undefined);
        for (const industryCodeUid of oc.firmographic.industry_code_uids.split("|") ?? []) {
            const [codeName, industryCode] = industryCodeUid.split("-", 2);
            if (
                codeName?.includes("us_naics") &&    // ← only us_naics passes
                industryCode &&
                isFinite(parseInt(industryCode)) &&
                industryCode.toString().length === 6
            ) {
                return Promise.resolve(industryCode);
            }
        }
        return Promise.resolve(undefined);
    }
},
```

**`classification_codes` fact (all jurisdictions — but unused downstream):**

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 323–344
classification_codes: [
    {
        description: "Industry classification codes for all jurisdictions",
        source: sources.opencorporates,
        fn: (_, oc: OpenCorporateResponse) => {
            let out: Record<string, string> | undefined;
            if (oc.firmographic?.industry_code_uids) {
                const industryCodeUids = oc.firmographic?.industry_code_uids.split("|") ?? [];
                for (const industryCodeUid of industryCodeUids) {
                    const [codeName, industryCode] = industryCodeUid.split("-", 2);
                    if (codeName && industryCode && !out?.[codeName]) {
                        out = out ?? {};
                        out[codeName] = industryCode;
                    }
                }
            }
            return Promise.resolve(out);
        }
    }
],
```

**USED or SILENTLY DROPPED:**
- `us_naics` entries → **USED** (mapped to `naics_code` fact)
- `uk_sic` entries → ⚠️ **SILENTLY DROPPED** at the `naics_code` resolver (loop only matches `us_naics`); captured in `classification_codes` fact as `{"uk_sic": "62012"}` but `classification_codes` has **no downstream consumer**
- `ca_naics` entries → ⚠️ **SILENTLY DROPPED** from `naics_code` resolver; captured in `classification_codes` but unused

**Why weight 0.9?** OpenCorporates draws directly from official government company registries, making it the most authoritative source for registered business data. It has strong UK and EU coverage, justifying its position as the top-weighted live API source.

---

### 1.4 Source: Trulioo / "business" (Live API)

| Attribute | Value |
|---|---|
| Source name | `business` |
| Type | Live API |
| Platform ID | `INTEGRATION_ID.TRULIOO` |
| Source-level weight | `0.8` (comment says "High weight for UK/Canada businesses") |
| Category | `kyb` |

**Fields returned for industry:**
- `clientData.standardizedIndustries[].naicsCode` — 6-digit US NAICS (used)
- `clientData.standardizedIndustries[].sicCode` — UK SIC code (⚠️ **ignored**)
- `clientData.standardizedIndustries[].industryName` — text label (used for `industry` fact)

**Code types:** US NAICS, UK SIC (both present in the same object array)

**Where it reads from:** `integration_data.request_response` WHERE `platform_id = INTEGRATION_ID.TRULIOO` AND `request_type = 'fetch_business_entity_verification'`, latest by `requested_at`.

```typescript
// integration-service/lib/facts/sources.ts  lines 802–808
business: {
    category: "kyb",
    scope: "business",
    platformId: INTEGRATION_ID.TRULIOO,
    weight: 0.8, // High weight for UK/Canada businesses
    getter: async function (businessID: UUID) {
        const [response, _, updatedAt] = await getFromRequestResponse(businessID, {
            platform_id: INTEGRATION_ID.TRULIOO,
            request_type: "fetch_business_entity_verification"
        });
        // ... confidence calculation, addressSources, reviewTasks
    }
}
```

**Mapping to `naics_code` fact (NAICS only, `.sicCode` not read):**

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 300–309
{
    source: sources.business,
    weight: 0.7,
    fn: async (_, truliooResponse: any): Promise<string | undefined> => {
        if (!truliooResponse?.clientData) return undefined;
        return extractStandardizedIndustriesFromTruliooResponse(truliooResponse.clientData)?.find(
            (i: any) => i.naicsCode && /^\d{6}$/.test(i.naicsCode)
        )?.naicsCode;    // ← reads .naicsCode; .sicCode is NEVER READ
    }
},
```

**USED or SILENTLY DROPPED:**
- `.naicsCode` → **USED** (mapped to `naics_code` fact)
- `.sicCode` → ⚠️ **SILENTLY DROPPED** (same object, adjacent field, never accessed)
- `.industryName` → **USED** (mapped to `industry` fact)

**Why weight 0.8?** Trulioo is the primary verification vendor for UK and Canadian businesses. The `truliooPreferredRule` in `rules.ts` exists specifically to give Trulioo precedence for GB/CA businesses. This weight is justified for jurisdiction-specific data quality.

---

### 1.5 Source: SERP Scrape (Live API)

| Attribute | Value |
|---|---|
| Source name | `serp` |
| Type | Live API / web scrape |
| Platform ID | `INTEGRATION_ID.SERP_SCRAPE` |
| Source-level weight | Not set at source level; fact-level weight = `0.3` for NAICS |
| Category | `publicRecords` |

**Fields returned for industry:**
- `businessLegitimacyClassification.naics_code` — 6-digit US NAICS (inferred from web scrape)

**Code type:** US NAICS only (inferred, not officially registered)

**Where it reads from:** `integration_data.request_response` WHERE `platform_id = INTEGRATION_ID.SERP_SCRAPE`, latest by `requested_at`. The getter also runs a confidence score against the submitted business.

```typescript
// integration-service/lib/facts/sources.ts  lines 530–574
serp: {
    platformId: INTEGRATION_ID.SERP_SCRAPE,
    category: "publicRecords",
    scope: "business",
    getter: async function (businessID: any) {
        const [response, _, updatedAt] = await getFromRequestResponse<SerpScrapeResponseSchema>(businessID, {
            platform_id: INTEGRATION_ID.SERP_SCRAPE
        });
        // ...confidence scoring via confidenceScore()
        return response.businessMatch && response;
    }
},
```

**Mapping to `naics_code` fact:**

```typescript
// integration-service/lib/facts/businessDetails/index.ts  line 299
{ source: sources.serp, weight: 0.3, path: "businessLegitimacyClassification.naics_code" },
```

**USED or SILENTLY DROPPED:** `businessLegitimacyClassification.naics_code` → **USED** (but with low weight 0.3, reflecting lower reliability of web-scraped classification)

**Why weight 0.3?** SERP/web scraping infers NAICS from public web search results — it is a heuristic, not a registered filing. A low weight of 0.3 correctly prioritizes official government-registry data over inferred data. This source should only win when no other source has a value.

---

### 1.6 Source: businessDetails (Customer-Submitted)

| Attribute | Value |
|---|---|
| Source name | `businessDetails` |
| Type | Customer submission (internal DB lookup) |
| Platform ID | `0` (internal, not a vendor) |
| Source-level weight | `10` (highest static weight of all sources) |
| Confidence | `1` (hardcoded) |
| Category | `business` |

**Fields returned for industry:**
- `naics_code` — whatever the customer typed or submitted via the API (constrained to 6-digit regex by Zod schema)
- `industry` — free-text industry name label

**Code type:** Nominally US NAICS 6-digit (validated by Zod `z.string().regex(/^\d{6}$/)`)

**Where it reads from:** Internal `businessLookupHelper({ businessID, tinBehavior: TIN_BEHAVIOR.PLAIN })` — an internal case-service API call, not `request_response`.

```typescript
// integration-service/lib/facts/sources.ts  lines 145–160
businessDetails: {
    category: "business",
    scope: "business",
    confidence: 1,
    weight: 10,
    platformId: 0,
    getter: async function (businessID: any) {
        const business = await businessLookupHelper({ businessID, tinBehavior: TIN_BEHAVIOR.PLAIN });
        const businessRecord = business?.[0];
        if (!businessRecord) return;
        this.updatedAt = businessRecord.updated_at ?? undefined;
        return businessRecord;
    }
},
```

**Mapping to `naics_code` fact:**

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 311–316
{
    source: sources.businessDetails,
    path: "naics_code",
    weight: 0.2,
    schema: z.string().regex(/^\d{6}$/)  // ← constrain NAICS to a 6-digit numeric string
},
```

**USED or SILENTLY DROPPED:** `naics_code` → **USED** (but note: the **fact-level** weight is overridden to `0.2`, not the source-level `10`). This is a critical distinction: the source-level weight of `10` applies to facts that do NOT override weight at the fact level (like `business_name: path: "name"`). For `naics_code`, the customer-submitted value is deliberately down-weighted to 0.2 because customers may self-report incorrect codes.

**Why fact-level weight 0.2?** Customer self-reporting of NAICS codes is unreliable — businesses often pick the wrong code, use an old edition, or leave it blank. The 0.2 weight ensures that any vendor-verified code overrides a customer self-report.

---

### 1.7 Source: AI NAICS Enrichment (GPT Fallback)

| Attribute | Value |
|---|---|
| Source name | `AINaicsEnrichment` |
| Type | AI/LLM inference (OpenAI GPT-5 mini) |
| Platform ID | `INTEGRATION_ID.AI_NAICS_ENRICHMENT` |
| Source-level weight | Not explicitly set (inherits undefined → defaults to `1` in rules, but fact-level `0.1`) |
| Category | `business` |

**Fields returned for industry:**
- `response.naics_code` — 6-digit US NAICS inferred by GPT
- `response.mcc_code` — 4-digit MCC inferred by GPT
- `response.naics_description`, `response.mcc_description`, `response.reasoning`, `response.confidence` (HIGH/MED/LOW)

**Code type:** US NAICS 2022 and MCC only (AI is not prompted for UK SIC or any other jurisdiction)

**Where it reads from:** `integration_data.request_response` WHERE `platform_id = INTEGRATION_ID.AI_NAICS_ENRICHMENT` AND `request_type = 'perform_business_enrichment'`, using `response.confidence` as the confidence getter.

```typescript
// integration-service/lib/facts/sources.ts  lines 115–129
AINaicsEnrichment: {
    category: "business",
    scope: "business",
    platformId: INTEGRATION_ID.AI_NAICS_ENRICHMENT,
    getter: async function (businessID: any) {
        const [response, confidence, updatedAt] = await getFromRequestResponse<AINaicsEnrichmentResponse>(
            businessID,
            { platform_id: INTEGRATION_ID.AI_NAICS_ENRICHMENT, request_type: "perform_business_enrichment" },
            { confidence: response => response?.confidence }
        );
        this.confidence = confidence ?? undefined;
        this.updatedAt = updatedAt ?? undefined;
        return response;
    }
}
```

**Mapping to `naics_code` fact:**

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 318–321
{
    source: sources.AINaicsEnrichment,
    path: "response.naics_code",
    weight: 0.1
},
```

**USED or SILENTLY DROPPED:**
- `response.naics_code` → **USED** (weight 0.1 — lowest priority)
- `response.mcc_code` → **USED** (mapped to `mcc_code_found` fact at line 351–358)
- No `uk_sic_code` field exists in the Zod schema → ⚠️ **Structurally impossible to return UK SIC**

---

## SECTION 2 — DATABASE SCHEMAS: COMPLETE DOCUMENTATION

### 2A. `integration_data.request_response` (integration-service PostgreSQL)

**Full CREATE TABLE DDL:**

```sql
-- integration-service/db/migrations/migrate/sqls/20240111180938-add-rutter-accounting-tables-up.sql  lines 227–278
CREATE TABLE IF NOT EXISTS integration_data.request_response
(
    request_id UUID NOT NULL DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL,
    platform_id integer NOT NULL,
    external_id character varying(100) COLLATE pg_catalog."default",
    request_type character varying COLLATE pg_catalog."default",
    requested_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    connection_id uuid NOT NULL,
    response jsonb,
    request_received timestamp with time zone,
    org_id uuid,
    request_code character varying COLLATE pg_catalog."default",
    idempotency_key uuid,
    async_key uuid,
    status integer,
    CONSTRAINT request_response_pkey PRIMARY KEY (request_id),
    CONSTRAINT fk_connection FOREIGN KEY (business_id, platform_id)
    REFERENCES integrations.data_connections (business_id, platform_id) MATCH SIMPLE
    ON UPDATE RESTRICT
    ON DELETE CASCADE
);

COMMENT ON TABLE integration_data.request_response
    IS 'temporary table to store raw responses from 3rd party system';
```

**Column-by-column explanation:**

| Column | Type | Purpose |
|---|---|---|
| `request_id` | UUID (PK) | Surrogate primary key; auto-generated via `gen_random_uuid()` |
| `business_id` | UUID NOT NULL | Foreign-key link to the business being looked up |
| `platform_id` | INTEGER NOT NULL | **Vendor discriminator** — tells you which integration wrote this row (Equifax=17, ZoomInfo=varies, etc.) |
| `external_id` | VARCHAR(100) | The vendor's own identifier for this record (optional) |
| `request_type` | VARCHAR | Semantic label for the type of API call (e.g., `fetch_public_records`, `fetch_business_entity_verification`, `perform_business_enrichment`) |
| `requested_at` | TIMESTAMPTZ | When the request was initiated; used for `ORDER BY requested_at DESC LIMIT 1` to get the latest record |
| `connection_id` | UUID NOT NULL | FK to `integrations.data_connections` — which configured integration instance triggered this |
| `response` | JSONB | **The raw vendor payload** — every vendor writes its own JSON structure here; schema varies completely by `platform_id` |
| `request_received` | TIMESTAMPTZ | When the response was received back (may differ from `requested_at` for async calls) |
| `org_id` | UUID | The customer organization (tenant) that owns this data; used for multi-tenant `manual` overrides |
| `request_code` | VARCHAR | Optional vendor status/error code |
| `idempotency_key` | UUID | Prevents double-processing of the same API call |
| `async_key` | UUID | Tracks async job execution for long-running tasks |
| `status` | INTEGER | HTTP-style status code from the vendor |

**The `platform_id` column** is the critical discriminator. Without it, you cannot tell whether a given `response` JSONB blob contains Equifax public-records data, ZoomInfo firmographics, or OpenAI enrichment results. Each vendor has a completely different JSON shape inside `response`. The fact engine always filters by `platform_id` first.

**The 4 Performance Indexes:**

```sql
-- Lines 255–277 of the same migration file

-- Index 1: async workflow lookup
CREATE INDEX IF NOT EXISTS ix_async_key
    ON integration_data.request_response USING btree (async_key ASC NULLS LAST);
-- Purpose: Fast lookup of pending async tasks by their job key

-- Index 2: idempotency guard
CREATE INDEX IF NOT EXISTS ix_idempotency_key
    ON integration_data.request_response USING btree (idempotency_key ASC NULLS LAST);
-- Purpose: Prevent duplicate API calls from creating duplicate rows

-- Index 3: most-recent-record-per-vendor (THE critical performance index)
CREATE INDEX IF NOT EXISTS ix_request_most_recent
    ON integration_data.request_response USING btree
    (business_id ASC NULLS LAST, request_type COLLATE pg_catalog."default" ASC NULLS LAST,
     request_received DESC NULLS FIRST);
-- Purpose: Covers the most frequent query pattern:
--   WHERE business_id = $1 AND platform_id = $2 ORDER BY requested_at DESC LIMIT 1
-- Note: request_received (not requested_at) is DESC because received is when
--       the response arrived, which is what "latest" means for freshness

-- Index 4: connection lookup
CREATE INDEX IF NOT EXISTS ix_request_response_connection_id
    ON integration_data.request_response USING btree (connection_id ASC NULLS LAST)
    WITH (deduplicate_items=True);
-- Purpose: Cascade-delete cleanup when a connection is removed
```

**On "temporary table":** The comment says *"temporary table to store raw responses from 3rd party system."* In practice, this is NOT a PostgreSQL `TEMPORARY TABLE` (which would be session-scoped). The word "temporary" means the table was originally intended as a staging area before data was normalized into proper relational columns. In practice, the team never built those normalized destination tables — so `request_response` evolved into the permanent, production-critical store for all vendor data. Every fact engine query reads from it.

**Sample query — latest OpenCorporates response for a business:**

```sql
-- Retrieve the most recent OpenCorporates response for a given business
-- Replace <business_uuid> with the actual business ID
-- Replace <OPENCORPORATES_PLATFORM_ID> with the actual integer from core_integrations_platforms
SELECT
    request_id,
    platform_id,
    request_type,
    requested_at,
    response
FROM integration_data.request_response
WHERE business_id = '<business_uuid>'
  AND platform_id = <OPENCORPORATES_PLATFORM_ID>  -- [VALIDATE: query core_integrations_platforms]
ORDER BY requested_at DESC
LIMIT 1;
```

---

### 2B. `core_naics_code` (case-service PostgreSQL)

**Full CREATE TABLE DDL:**

```sql
-- case-service/db/migrations/migrate/sqls/20240925091810-add-naics-mcc-code-tables-up.sql  lines 9–15
CREATE TABLE public.core_naics_code (
    id int GENERATED ALWAYS AS IDENTITY NOT NULL,
    code int NOT NULL,
    label varchar NOT NULL,
    CONSTRAINT core_naics_code_pk PRIMARY KEY (id),
    CONSTRAINT core_naics_code_unique UNIQUE (code)
);
```

**Seeded with 1,035 rows** from the 2022 US NAICS standard (lines 24–1,035 of the same file).

**Column explanation:**
- `id`: Surrogate integer primary key, generated automatically. This is what `data_businesses.naics_id` references. Used in JOINs for efficiency.
- `code`: The actual 6-digit NAICS business code (e.g., 541110). This is the `UNIQUE` business identifier. When the AI or fact engine produces a NAICS code string, it is resolved to `core_naics_code.id` by looking up `WHERE code = <value>`.
- `label`: Human-readable sector description (e.g., `'Offices of Lawyers'`). These are sector-level labels in many cases, not always the full 6-digit description.

**The `id` vs `code` distinction is critical:** `data_businesses.naics_id` stores the surrogate `id`, NOT the `code`. This means to display a NAICS code to a user, you always need a JOIN:

```sql
SELECT db.id, nc.code AS naics_code, nc.label AS naics_description
FROM public.data_businesses db
JOIN public.core_naics_code nc ON db.naics_id = nc.id;
```

**3 example rows (from seed data):**

| id | code | label |
|---|---|---|
| 1 | 111110 | Soybean Farming |
| 818 | 541110 | Professional, Scientific, and Technical Services |
| 838 | 561499 | Administrative and Support Services |

---

### 2C. `core_mcc_code` (case-service PostgreSQL)

**Full CREATE TABLE DDL:**

```sql
-- case-service/db/migrations/migrate/sqls/20240925091810-add-naics-mcc-code-tables-up.sql  lines 1–7
CREATE TABLE public.core_mcc_code (
    id int GENERATED ALWAYS AS IDENTITY NOT NULL,
    code int NOT NULL,
    label varchar NOT NULL,
    CONSTRAINT core_mcc_code_pk PRIMARY KEY (id),
    CONSTRAINT core_mcc_code_unique UNIQUE (code)
);
```

**Seeded with 125 rows** (lines 1,037–1,125 of the same migration).

**3 example rows:**

| id | code | label |
|---|---|---|
| 1 | 1111 | Agricultural Services |
| 48 | 7392 | Consulting Services |
| 91 | 8062 | Hospitals |

**What MCC is and why it matters:** Merchant Category Codes (MCC) are 4-digit codes defined by ISO 18245 and used universally by card networks (Visa, Mastercard, Amex) and payment processors to classify the type of business a merchant operates. MCC drives: (1) interchange rates — some merchant categories get preferential rates; (2) compliance — financial institutions must screen for high-risk MCCs (gambling, firearms, adult content) under BSA/AML rules; (3) rewards programs — cardholders earn category-specific rewards based on merchant MCC; (4) spending limits — corporate cards can restrict purchases to certain MCCs. For Worth, MCC links the KYB classification to the payment-processing compliance requirements that lenders and card program managers care about.

---

### 2D. `rel_naics_mcc` (case-service PostgreSQL)

**Full CREATE TABLE DDL:**

```sql
-- case-service/db/migrations/migrate/sqls/20240925091810-add-naics-mcc-code-tables-up.sql  lines 17–22
CREATE TABLE public.rel_naics_mcc (
    naics_id int NULL,
    mcc_id int NULL,
    CONSTRAINT rel_naics_mcc_core_naics_code_fk FOREIGN KEY (naics_id) REFERENCES public.core_naics_code(id),
    CONSTRAINT rel_naics_mcc_core_mcc_code_fk FOREIGN KEY (mcc_id) REFERENCES public.core_mcc_code(id)
);
```

**Why a mapping table?** NAICS (1,035 codes) and MCC (125 codes) operate at different levels of granularity. Many NAICS codes map to the same MCC. Rather than storing a `mcc_code` column directly on `core_naics_code` (which would force a 1:1 mapping), a join table allows many NAICS codes to map to the same MCC and, if needed in future, allows one NAICS to map to multiple MCCs. The table is seeded with 1,012 rows mapping each of the 1,035 NAICS codes to one of the 125 MCCs (lines 1,127–2,135 of the migration file). Note: some NAICS IDs (96–99) appear to have no mapping in the seed data — ⚠️ this should be validated.

**How a NAICS code resolves to an MCC via JOIN:**

```sql
-- Resolve a NAICS code to its MCC code for a given business
SELECT
    db.id AS business_id,
    nc.code AS naics_code,
    nc.label AS naics_label,
    mc.code AS mcc_code,
    mc.label AS mcc_label
FROM public.data_businesses db
JOIN public.core_naics_code nc ON db.naics_id = nc.id
JOIN public.rel_naics_mcc rnm ON rnm.naics_id = nc.id
JOIN public.core_mcc_code mc ON rnm.mcc_id = mc.id
WHERE db.id = '<business_uuid>';
```

In the TypeScript fact engine, this lookup is done via the `internalGetNaicsCode()` helper:

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 359–375
mcc_code_from_naics: [{
    dependencies: ["naics_code"],
    source: sources.calculated,
    fn: async (engine: FactEngine): Promise<number | undefined> => {
        const fact = engine.getResolvedFact("naics_code");
        if (fact?.value) {
            const naicsInfo = await internalGetNaicsCode(fact.value);
            if (naicsInfo) {
                return naicsInfo?.find(naics => !!naics.mcc_code)?.mcc_code;
            }
        }
    }
}],
```

---

### 2E. `data_businesses` — industry columns only (case-service PostgreSQL)

**ALTER TABLE statements that added `naics_id` and `mcc_id`:**

```sql
-- case-service/db/migrations/migrate/sqls/20240926041144-add-naics-mcc-code-data-business-up.sql  lines 1–5
--- In future may be get mcc id instant of naics id So we will save both
ALTER TABLE public.data_businesses ADD mcc_id int NULL;
ALTER TABLE public.data_businesses ADD naics_id int NULL;
ALTER TABLE public.data_businesses ADD CONSTRAINT data_businesses_core_mcc_code_fk
    FOREIGN KEY (mcc_id) REFERENCES public.core_mcc_code(id);
ALTER TABLE public.data_businesses ADD CONSTRAINT data_businesses_core_naics_code_fk
    FOREIGN KEY (naics_id) REFERENCES public.core_naics_code(id);
```

**Backfill migration — `naics_id` from old `naics_code` column:**

```sql
-- Lines 7–16 of the same migration
UPDATE data_businesses
SET naics_id = core_naics_code.id
FROM core_naics_code
WHERE data_businesses.naics_code = core_naics_code.code;

UPDATE data_businesses
SET  mcc_id = rel_naics_mcc.mcc_id
FROM rel_naics_mcc
WHERE data_businesses.naics_id = rel_naics_mcc.naics_id;

ALTER TABLE public.data_businesses DROP COLUMN naics_title;
ALTER TABLE public.data_businesses DROP COLUMN naics_code;
```

The old `naics_code` (integer, raw code) and `naics_title` (text) columns were replaced by the normalized FK references. Any business that had a `naics_code` value was linked to the reference table; any business with no code or a code not found in `core_naics_code` was left with `naics_id = NULL`.

**⚠️ CONFIRMED GAP: `uk_sic_id` does NOT exist.** There is no `ALTER TABLE data_businesses ADD uk_sic_id ...` in any of the migration files. There is no `core_uk_sic_code` table. There is no FK constraint for UK SIC anywhere in the codebase. UK businesses cannot have their SIC code persisted regardless of what any source returns.

---

### 2F. `rel_business_industry_naics` (case-service PostgreSQL)

**Full CREATE TABLE DDL:**

```sql
-- case-service/db/migrations/migrate/sqls/20241111105459-naics-industry-platform-up.sql  lines 1–10
CREATE TABLE "public"."rel_business_industry_naics" (
    "business_id" uuid NOT NULL,
    "platform" VARCHAR(255) NOT NULL,
    "industry_id" INT NULL,
    "naics_id" INT NULL,
    CONSTRAINT "fk_business_id" FOREIGN KEY ("business_id")
        REFERENCES "public"."data_businesses" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "fk_industry_id" FOREIGN KEY ("industry_id")
        REFERENCES "public"."core_business_industries" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "fk_naics_id" FOREIGN KEY ("naics_id")
        REFERENCES "public"."core_naics_code" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "unique_business_id_platform" UNIQUE("business_id", "platform")
);
```

**What "platform" means here:** This is NOT `platform_id` (an integer vendor ID from `core_integrations_platforms`). Here "platform" is a VARCHAR label representing which data source/vendor provided the industry classification for this business. The intent is to record per-source industry data — e.g., one row for `"equifax"`, one row for `"zoominfo"` — preserving each vendor's view without clobbering others. This is distinct from `data_businesses.naics_id` which holds the single resolved winner.

**Why does a business need a per-platform industry record?** The single `naics_id` on `data_businesses` holds the resolved winner from the fact engine. But underwriters and analysts may want to see what each source thinks the industry is, for audit purposes or when sources disagree. `rel_business_industry_naics` preserves all source opinions before resolution.

**The UNIQUE constraint on `(business_id, platform)`** enforces that each business has at most one industry record per platform. If ZoomInfo updates its classification, the existing row for `(business_id, 'zoominfo')` is upserted — there is no accumulation of historical vendor opinions per platform.

---

### 2G. `integration_data.extended_attributes` Function (integration-service PostgreSQL)

**Full CREATE FUNCTION DDL:**

```sql
-- integration-service/db/migrations/migrate/sqls/20250619161600-business-extended-data-up.sql  lines 1–256
CREATE OR REPLACE FUNCTION integration_data.extended_attributes (
        p_business_id uuid
    ) RETURNS TABLE (
        business_id uuid,
        requested_at timestamptz,
        business_name text,
        address text,
        city text,
        state text,
        zip_code text,
        legal_ultimate_number text,
        employees integer,
        corporate_amount bigint,
        -- ...
        -- ===== NAICS classification =====
        primary_naics_code text,
        primary_naics_sector text,
        primary_naics_subsector text,
        primary_naics_industry_group text,
        primary_naics_industry text,
        secondary_naics_1 text,
        secondary_naics_1_sector text,
        secondary_naics_1_subsector text,
        secondary_naics_1_industry_group text,
        secondary_naics_1_industry text,
        -- ... secondary_naics_2 through secondary_naics_4 (same pattern)
        -- ===== SIC codes =====
        primary_sic_code text,
        secondary_sic_1 text,
        secondary_sic_2 text,
        secondary_sic_3 text,
        secondary_sic_4 text,
        -- ...
    ) AS $$
SELECT r.business_id,
    r.requested_at,
    r.response->>'legultnameall',
    -- ...
    r.response->>'primnaicscode',
    r.response->>'primnaics_sector',
    r.response->>'primnaics_subsector',
    r.response->>'primnaics_industry_group',
    r.response->>'primnaics_industry',
    r.response->>'secnaics1',
    r.response->>'secnaics1_sector',
    -- ... all secondary NAICS
    r.response->>'primsic',
    r.response->>'secsic1',
    r.response->>'secsic2',
    r.response->>'secsic3',
    r.response->>'secsic4',
    -- ...
FROM integration_data.request_response r
WHERE r.platform_id = 17   -- Equifax constant
    AND r.business_id = p_business_id
    AND r.request_type = 'fetch_public_records'
    AND r.response->'efx_id' IS NOT NULL
ORDER BY r.requested_at DESC
LIMIT 1;
$$ LANGUAGE sql STABLE;
```

**Industry-related output columns (all extracted from the `response` JSONB column):**

| Output Column | JSONB Path | Description |
|---|---|---|
| `primary_naics_code` | `response->>'primnaicscode'` | Primary 6-digit NAICS code |
| `primary_naics_sector` | `response->>'primnaics_sector'` | 2-digit sector label |
| `primary_naics_subsector` | `response->>'primnaics_subsector'` | 3-digit subsector label |
| `primary_naics_industry_group` | `response->>'primnaics_industry_group'` | 4-digit industry group label |
| `primary_naics_industry` | `response->>'primnaics_industry'` | 5-digit industry label |
| `secondary_naics_1` | `response->>'secnaics1'` | Secondary NAICS #1 code |
| `secondary_naics_1_sector` | `response->>'secnaics1_sector'` | ... with full hierarchy |
| *(secnaics2 through secnaics4 — same pattern)* | | |
| `primary_sic_code` | `response->>'primsic'` | Primary US SIC 1987 code |
| `secondary_sic_1` through `secondary_sic_4` | `response->>'secsic1'` … `'secsic4'` | Secondary SIC codes |

**Equifax provides a HIERARCHY of NAICS** (sector → subsector → industry group → industry → 6-digit code), not just a single code. This is significantly richer data than any other source. The `extended_attributes` function exposes all 25 NAICS columns. However, the TypeScript fact engine at `sources.ts:279` only consumes `primnaicscode`. All hierarchy fields are accessible via this SQL function (useful for analytics/reporting) but are not wired into the fact resolution pipeline.

**Equifax provides US SIC 1987 codes** (`primsic`, `secsic1`–`secsic4`). These are the Standard Industrial Classification codes from the 1987 US revision — a different system from UK SIC 2007. The `extended_attributes` function exposes them. But there is no TypeScript fact for US SIC codes, no reference table, and no column on `data_businesses` to store them.

⚠️ **Despite this rich data being available, the fact engine only uses `primnaicscode`. The 24 remaining industry-related columns from Equifax (secondary NAICS hierarchy, SIC codes) are accessible via SQL but have no downstream consumer in the TypeScript fact pipeline.**

---

## SECTION 3 — THE FACT ENGINE: HOW A WINNER IS CHOSEN

### 3A. What is a "fact"?

A **fact** is a single derived data point — for example, `naics_code` — that is computed by aggregating data from multiple sources and applying a rule to select one winner. The fact engine exists because multiple vendors may return different values for the same attribute (ZoomInfo says NAICS 541110, Equifax says NAICS 541512, the customer submitted 541519). A deterministic algorithm must produce a single answer that downstream systems (scoring, storage, reporting) can rely on.

Each fact definition in `businessDetails/index.ts` is a list of **candidates** — one per source — each with a `source`, a way to extract the value (`path` or `fn`), and an optional `weight`. The fact engine collects all candidate values, computes a `confidence` for each (how well the vendor matched the business identity), and then applies one of the four rules to select the winner.

### 3B. Step-by-Step Resolution Flow for `naics_code`

**Step 1: Getter queries `integration_data.request_response`**

```typescript
// integration-service/lib/facts/sources.ts  lines 42–84
const getFromRequestResponse = async <T>(
    businessID: string,
    params: { platform_id?: IntegrationPlatformId | IntegrationPlatformId[]; request_type?: string; org_id?: string },
    getters?: Partial<RequestResponseGetters>
): Promise<[T, ReturnType<ConfidenceGetter>, ReturnType<UpdatedAtGetter>]> => {
    const query = db("integration_data.request_response")
        .select("response", "requested_at", "request_received")
        .where({ business_id: businessID })
        .orderBy("requested_at", "DESC")
        .limit(1)
        .first();
    // ... adds WHERE clauses for platform_id, request_type
    const queryResponse = await query;
    const confidence = confidenceGetter(queryResponse?.response);
    const updatedAt = updatedAtGetter(queryResponse);
    return [queryResponse?.response, confidence, updatedAt];
};
```

**Step 2: `fn()` or `path` maps raw JSON to candidate value**

For Equifax (simple path):
```typescript
// integration-service/lib/facts/businessDetails/index.ts  line 279
{ source: sources.equifax, path: "primnaicscode" }
// → reads response["primnaicscode"] directly
```

For OpenCorporates (function with parsing logic):
```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 282–298
{
    source: sources.opencorporates,
    fn: (_, oc: OpenCorporateResponse) => {
        for (const industryCodeUid of oc.firmographic.industry_code_uids.split("|")) {
            const [codeName, industryCode] = industryCodeUid.split("-", 2);
            if (codeName?.includes("us_naics") && industryCode?.length === 6) {
                return Promise.resolve(industryCode);
            }
        }
        return Promise.resolve(undefined);
    }
}
```

**Step 3: A Rule picks the single winner**

The fact engine collects all candidates that returned a non-undefined value, then applies the configured rule. For `naics_code`, this is `factWithHighestConfidence` (the default for most facts).

**Step 4: Winner stored in `data_businesses.naics_id`**

After the fact engine resolves `naics_code`, the application looks up `core_naics_code WHERE code = <resolved_value>` to get the surrogate `id`, then calls the case-service API to update `data_businesses SET naics_id = <id>`. The MCC is derived in parallel via `mcc_code_from_naics` → `internalGetNaicsCode()` → `rel_naics_mcc` JOIN → `data_businesses.mcc_id`.

---

### 3C. The 4 Rules — Complete Documentation

#### Rule 1: `manualOverride`

```typescript
// integration-service/lib/facts/rules.ts  lines 112–126
export const manualOverride: Rule = {
    name: "manualOverride",
    description: "Override the fact with a manually provided value",
    fn: (engine, factName: FactName): Fact | undefined => {
        const manualEntry = engine.getManualSource()?.rawResponse?.[factName];
        if (manualEntry) {
            return {
                name: factName,
                source: sources.manual,
                value: manualEntry.value,
                override: manualEntry ?? null
            } as Fact;
        }
    }
};
```

**What it does:** Before any vendor data is considered, the engine checks whether an underwriter has manually set a value for this fact. The manual entry is stored in `integration_data.request_response` with `platform_id = INTEGRATION_ID.MANUAL` and `request_type = 'fact_override'`, keyed by `org_id` (the customer organization). If a manual entry exists, it is returned immediately — no other rules run for this fact.

**Why:** Human expert judgment must always override automated data. An underwriter who has verified a business's industry through direct conversation should not be second-guessed by an API.

---

#### Rule 2: `factWithHighestWeight`

```typescript
// integration-service/lib/facts/rules.ts  lines 11–34
export const factWithHighestWeight: Rule = {
    name: "factWithHighestWeight",
    description: "Get the fact with the highest weight",
    fn: (_, _factName: FactName, input: Fact[]): Fact | undefined => {
        return input.reduce(
            (acc, fact) => {
                if (fact.value === undefined) return acc;
                if (!acc) return fact;
                const leftWeight = fact.weight ?? fact.source?.weight ?? 1;
                const rightWeight = acc.weight ?? acc.source?.weight ?? 1;
                if (leftWeight > rightWeight) return fact;
                return acc;
            },
            undefined as Fact | undefined
        );
    }
};
```

**What it does:** Picks the candidate with the highest weight. Weight is resolved in priority order: fact-level override → source-level weight → default (`1`). This is deterministic and predictable.

**Why:** For facts where confidence scoring is unavailable or unreliable, a static ranking by source quality produces a stable, auditable outcome. Weight is assigned by engineers based on known source reliability.

---

#### Rule 3: `factWithHighestConfidence`

```typescript
// integration-service/lib/facts/rules.ts  lines 36–58
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
                    return weightedFactSelector(fact, acc);  // tie-break by weight
                } else if (factConfidence > accConfidence) {
                    return fact;
                }
                return acc;
            },
            undefined as Fact | undefined
        );
    }
};

// WEIGHT_THRESHOLD = 0.05 (line 9)
```

**What it does:** Picks the candidate with the highest confidence score (a dynamic 0–1 value computed per-vendor per-business from name/address/EIN matching). If two candidates' confidence scores are within 5% of each other (`WEIGHT_THRESHOLD = 0.05`), weight is used as a tiebreaker via `weightedFactSelector`.

**Why this is more sophisticated than `factWithHighestWeight`:** Confidence reflects how well the vendor actually matched the specific business — a ZoomInfo record with a 95% name+address match should beat an Equifax record with a 40% match, even if Equifax has a higher base weight. This dynamic quality signal makes the resolution more accurate.

---

#### Rule 4: `truliooPreferredRule`

```typescript
// integration-service/lib/facts/rules.ts  lines 136–165
export const truliooPreferredRule: Rule = {
    name: "truliooPreferred",
    description: "Prefer Trulioo data for UK/Canada businesses",
    fn: (engine, factName: FactName, facts: Fact[]): Fact | undefined => {
        const businessCountry = engine.getResolvedFact("primary_address")?.value?.country;
        const isUKCanada = businessCountry === "GB" || businessCountry === "CA";

        if (isUKCanada) {
            const truliooFact = facts.find(fact =>
                fact.source?.name === "business" ||
                fact.source?.name === "person"
            );
            if (truliooFact) return truliooFact;
        }

        // Fall back to highest confidence
        return facts.reduce((acc, fact) => {
            if (!acc) return fact;
            const factConfidence = fact.confidence ?? fact.source?.confidence ?? 0;
            const accConfidence = acc.confidence ?? acc.source?.confidence ?? 0;
            return factConfidence > accConfidence ? fact : acc;
        });
    }
};
```

**What it does:** Reads the resolved `primary_address` fact (which must be resolved before this rule runs). If the business country is `GB` (United Kingdom) or `CA` (Canada), it explicitly prefers any fact whose source is `"business"` or `"person"` (i.e., Trulioo). For all other countries, it falls back to highest confidence.

**Why Trulioo is better for UK/Canada:** Trulioo is integrated with Companies House (UK) and the Canadian business registries. It is the primary verification vendor for those jurisdictions — it has superior name/address matching, verified incorporation data, and structured industry codes from official national sources. OpenCorporates may have broader global coverage but Trulioo has deeper, more recent data for GB/CA.

**⚠️ Critical gap:** This rule exists and fires correctly for UK businesses when resolving `naics_code` — but `naics_code` is a US standard code. A UK business getting a US NAICS code via Trulioo is technically incorrect. The rule was built to prefer Trulioo's output for UK businesses, but the fact it operates on (`naics_code`) is the wrong artifact. The rule has **nothing to hook into** for `uk_sic_code` because that fact does not exist.

---

### 3D. Weight Table for `naics_code`

| Source | Fact-level weight | Source-level weight | Effective weight | Wins when |
|---|---|---|---|---|
| `equifax` | (not set) | 0.7 | **0.7** | Equifax match confidence > other sources AND no manual override |
| `zoominfo` | (not set) | 0.8 | **0.8** | ZoomInfo confidence > Equifax/others; ties broken at 0.8 |
| `opencorporates` | (not set) | 0.9 | **0.9** | OpenCorporates confidence > all live API sources |
| `business` (Trulioo) | 0.7 (fact-level) | 0.8 | **0.7** | For GB/CA: always preferred if `truliooPreferredRule` is active; else falls behind opencorporates |
| `serp` | 0.3 (fact-level) | (not set) | **0.3** | Only when no other source has a value |
| `businessDetails` | 0.2 (fact-level) | 10 | **0.2** | Customer-submitted code, only if no vendor has data |
| `AINaicsEnrichment` | 0.1 (fact-level) | (not set) | **0.1** | Last resort, only when ≤3 sources exist AND weight favors it |

Note: The `manualOverride` rule runs first and bypasses this entire table if set.

---

## SECTION 4 — WHAT CODES DO WE GET TODAY? COMPLETE CODE TYPE INVENTORY

### 4A. US NAICS 2022 (6-digit)

- **Which sources provide it:** Equifax (`primnaicscode`), ZoomInfo (`zi_c_naics6`), OpenCorporates (`us_naics-XXXXXX`), Trulioo (`.naicsCode`), SERP (`businessLegitimacyClassification.naics_code`), businessDetails (`naics_code`), AI enrichment (`response.naics_code`)
- **Format:** Integer as string, 6 digits, e.g., `"541110"`
- **Is it stored?** YES — `data_businesses.naics_id` → `core_naics_code.id` (surrogate FK)
- **Is it used in scoring?** YES — it is the primary industry input for the AI NAICS enrichment trigger and downstream risk scoring
- **Coverage:** High for US businesses (6 sources). UK businesses receive a US NAICS code if one is found, which may be semantically incorrect.

---

### 4B. US SIC 1987 (4-digit)

- **Which sources provide it:** Equifax (`primsic`, `secsic1`–`secsic4`), ZoomInfo (`firmographic.zi_c_sic4` — available in raw API response)
- **Format:** 4-digit integer string, e.g., `"7372"`
- **Is it stored?** ⚠️ **NO** — no `core_us_sic_code` reference table, no column on `data_businesses`
- **Is it used?** ⚠️ **NO** — not wired to any fact definition in `businessDetails/index.ts`
- **Gap summary:** 4 SIC fields available from Equifax alone (`primsic`, `secsic1`–`secsic4`) plus `zi_c_sic4` from ZoomInfo; none are consumed. The `extended_attributes` SQL function exposes them for ad-hoc SQL queries only.

---

### 4C. UK SIC 2007 (5-digit)

- **Which sources provide it:**
  - OpenCorporates: returns `uk_sic-XXXXX` in `industry_code_uids` (e.g., `"uk_sic-62012"`)
  - Trulioo: returns `.sicCode` field in `standardizedIndustries` array for GB businesses
- **Format:** 5-character string (numeric with possible leading zero), e.g., `"62012"`
- **Is it stored?** ⚠️ **NO** — no `core_uk_sic_code` reference table, no `uk_sic_id` column on `data_businesses`
- **Is it used?** ⚠️ **NO** — the `classification_codes` fact captures it from OpenCorporates but has no downstream consumer; Trulioo's `.sicCode` is never read at all
- **Gap summary:** The data flows in from two sources, is partially captured in the `classification_codes` fact object, but is never persisted to the database. Every UK business has `uk_sic_id = NULL` (column does not exist).

---

### 4D. Canadian NAICS (6-digit)

- **Which sources provide it:** OpenCorporates (`ca_naics-XXXXXX` in `industry_code_uids`)
- **Format:** 6-digit string
- **Is it stored in DB?** ⚠️ **NO** — no separate CA NAICS column; it would be forced into `naics_id` (US NAICS reference table)
- **Gap:** Same pattern as UK SIC. The `classification_codes` fact captures `{"ca_naics": "541110"}` but nothing reads from `classification_codes`. CA businesses are also mislabeled with US NAICS if OpenCorporates does not return a `us_naics` entry.

---

### 4E. MCC — Merchant Category Code (4-digit)

- **Derived from:** NAICS → `rel_naics_mcc` JOIN (automatic, calculated fact `mcc_code_from_naics`)
- **Also from:** AI enrichment `response.mcc_code` directly (captured in `mcc_code_found` fact)
- **Stored:** YES — `data_businesses.mcc_id` → `core_mcc_code.id`
- **The `mcc_code` fact** combines both sources (lines 376–388 of `businessDetails/index.ts`): it prefers the directly-found AI MCC (`mcc_code_found`) over the NAICS-derived MCC (`mcc_code_from_naics`).

**Why MCC matters:** See Section 2C. Any business assigned an incorrect NAICS (e.g., a UK retailer classified under a US NAICS for farming because no better source was available) will propagate that error into an incorrect MCC, which then flows to payment-processor compliance and risk scoring.

---

### 4F. AI-Inferred NAICS

- **GPT-5 mini** infers from business name, DBA, and website content
- Validated against `core_naics_code` — if the returned code does not exist in the table, it is replaced with the fallback `561499`
- **Fallback:** `561499` ("Administrative and Support Services") — chosen as the most generic non-descriptive code
- **Zod response schema** (the contract for what GPT is allowed to return):

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 22–35
const naicsEnrichmentResponseSchema = z.object({
    reasoning: z.string(),
    naics_code: z.string(),
    naics_description: z.string(),
    mcc_code: z.string(),
    mcc_description: z.string(),
    confidence: z.enum(["HIGH", "MED", "LOW"]),
    previous_naics_code: z.string(),
    previous_mcc_code: z.string(),
    website_url_parsed: z.string().nullable(),
    website_summary: z.string().nullable(),
    tools_used: z.array(z.string()),
    tools_summary: z.string().nullable()
});
```

⚠️ **No `uk_sic_code` field in this schema.** Zod in strict mode strips unknown keys silently. Even if the GPT prompt were updated to ask for UK SIC codes, the result would be discarded unless `uk_sic_code` is added to this schema.

---

## SECTION 5 — THE 4 SILENT DROPS: WHERE UK SIC GETS LOST

### Gap 1: OpenCorporates `naics_code` Resolver — Only Matches `us_naics`

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 283–297
fn: (_, oc: OpenCorporateResponse) => {
    if (!oc.firmographic?.industry_code_uids) return Promise.resolve(undefined);
    for (const industryCodeUid of oc.firmographic.industry_code_uids.split("|") ?? []) {
        const [codeName, industryCode] = industryCodeUid.split("-", 2);
        if (
            codeName?.includes("us_naics") &&  // ← THIS IS THE DROP
            industryCode &&
            isFinite(parseInt(industryCode)) &&
            industryCode.toString().length === 6
        ) {
            return Promise.resolve(industryCode);
        }
    }
    return Promise.resolve(undefined);
}
```

**What happens:** When OpenCorporates returns `"us_naics-541110|uk_sic-62012|ca_naics-541110"`, the loop iterates over all three. When it reaches `"uk_sic-62012"`, the check `codeName?.includes("us_naics")` evaluates to `false` (the string is `"uk_sic"`, not `"us_naics"`). The loop continues and returns `undefined` for the `naics_code` fact. The UK SIC code is discarded.

**Fix:** Add a parallel `uk_sic_code` fact with its own `fn` that matches `codeName?.includes("uk_sic")`. The existing `classification_codes` fact (line 327) already does the correct multi-code parsing — the fix is to create a `uk_sic_code` fact that reads `classification_codes.uk_sic`.

---

### Gap 2: Trulioo `.sicCode` Is Never Read

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 300–309
{
    source: sources.business,
    weight: 0.7,
    fn: async (_, truliooResponse: any): Promise<string | undefined> => {
        if (!truliooResponse?.clientData) return undefined;
        return extractStandardizedIndustriesFromTruliooResponse(truliooResponse.clientData)?.find(
            (i: any) => i.naicsCode && /^\d{6}$/.test(i.naicsCode)
        )?.naicsCode;   // ← reads .naicsCode; .sicCode is in the same object but never touched
    }
},
```

**What happens:** The `extractStandardizedIndustriesFromTruliooResponse()` function returns an array of industry objects. Each object contains both `naicsCode` and `sicCode`. The `.find()` call searches for `i.naicsCode` that matches a 6-digit regex. The `.sicCode` field (e.g., `"62012"`) is present in the same matched object but `.naicsCode` is extracted and `.sicCode` is ignored.

**Fix:** Add a parallel `uk_sic_code` source entry using `sources.business` that reads `.sicCode` from the same `standardizedIndustries` array, gated on `businessCountry === "GB"`.

---

### Gap 3: AI Zod Schema Has No `uk_sic_code` Field

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 22–35
const naicsEnrichmentResponseSchema = z.object({
    reasoning: z.string(),
    naics_code: z.string(),
    naics_description: z.string(),
    mcc_code: z.string(),
    mcc_description: z.string(),
    confidence: z.enum(["HIGH", "MED", "LOW"]),
    previous_naics_code: z.string(),
    previous_mcc_code: z.string(),
    website_url_parsed: z.string().nullable(),
    website_summary: z.string().nullable(),
    tools_used: z.array(z.string()),
    tools_summary: z.string().nullable()
    // ← NO uk_sic_code field
});
```

**What happens:** Zod's `z.object()` by default strips unknown keys when parsing. If GPT were prompted to return `uk_sic_code: "62012"` and did so, Zod would silently drop the field during schema validation. The stored `AINaicsEnrichmentResponse` object would have no `uk_sic_code` key.

**Fix:** Add `uk_sic_code: z.string().optional()` and `uk_sic_description: z.string().optional()` to the Zod schema, and update the AI system prompt to request UK SIC 2007 codes when the business country is GB.

---

### Gap 4: No DB Column for `uk_sic_id` in `data_businesses`

```sql
-- case-service/db/migrations/migrate/sqls/20240926041144-add-naics-mcc-code-data-business-up.sql
ALTER TABLE public.data_businesses ADD mcc_id int NULL;
ALTER TABLE public.data_businesses ADD naics_id int NULL;
-- ← No uk_sic_id column has ever been added
```

**What happens:** Even if Gaps 1, 2, and 3 were fixed and the fact engine correctly resolved a UK SIC code — there is no column to store it in. The resolved value would be computed, stored temporarily in the fact engine's in-memory state, but then dropped when the system tries to persist it to the database because the target column does not exist.

**Fix:** Run a migration to add `core_uk_sic_code` reference table (with ~600 UK SIC 2007 codes seeded from Companies House classification) and add `uk_sic_id INT NULL REFERENCES core_uk_sic_code(id)` to `data_businesses`. This is the prerequisite for all other fixes.

---

## SECTION 6 — THE AI ENRICHMENT LAYER: FULL DOCUMENTATION

### 6A. When Does the AI Run? (Exact Trigger Conditions)

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 51–61
static readonly DEPENDENT_FACTS: AINaicsEnrichmentDependentFacts = {
    website: { minimumSources: 1 },          // Must have a website
    website_found: { minimumSources: 1 },    // Must have a discovered website
    business_name: { minimumSources: 1 },    // Must have a business name
    dba: { minimumSources: 0 },              // Optional — pass if available
    // If >= 3 sources already have NAICS, skip AI to save OpenAI credits
    naics_code: { maximumSources: 3, minimumSources: 1, ignoreSources: ["AINaicsEnrichment"] },
    mcc_code: { maximumSources: 3, minimumSources: 1, ignoreSources: ["AINaicsEnrichment"] },
    corporation: { minimumSources: 0 }       // Optional — pass if available
};
```

**Trigger conditions (all must be true):**
1. `website` fact has **at least 1** source — the AI needs a URL to parse
2. `business_name` fact has **at least 1** source — the AI needs a name to reason about
3. `naics_code` fact has **between 1 and 3** sources (exclusive of AI itself) — at least some signal exists, but coverage isn't saturated
4. `mcc_code` fact has **between 1 and 3** sources (exclusive of AI itself)

**Why these conditions?** If 0 sources have a NAICS code, there is no prior signal to reason about — the AI would be guessing blind from a name alone (unreliable). If 4+ sources already agree (or disagree in a resolved way), the AI adds no value and would waste OpenAI API credits. The window of 1–3 sources is where the AI adds the most signal.

---

### 6B. The Full AI Prompt

**System prompt (lines 100–109):**

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 100–109
const systemPrompt = `You are a helpful assistant that determines:
1) 6 digit North American Industry Classification System (NAICS) codes as of the 2022 edition. Do not use earlier editions only the 2022 edition.
2) The canonical description of the NAICS Code from the 2022 edition.
3) The 4 digit Merchant Category Code (MCC)
4) The canonical description of the MCC Code.
Infer this information from industry info and business names. If a website URL is available, parse the website for the information.
If a company already has NAICS or MCC information, correct it if it doesn't match the business details.
Return a JSON object with fields reasoning, naics_code, naics_description, mcc_code, mcc_description, confidence (HIGH|MED|LOW), previous_naics_code, previous_mcc_code.
If there is no evidence at all, return naics_code ${this.NAICS_OF_LAST_RESORT} and mcc_code 5614 as a last resort.`;
```

**User prompt (lines 170–174):**

```typescript
const userPrompt = `START DATA RESEARCH MODE\n\nIMPORTANT: Only use NAICS codes from the 2022 edition!\n
Business Details: ${Object.entries(params)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`)
    .join(" | ")}`;
```

**What the AI is asked for:** US NAICS 2022 (6-digit), US MCC (4-digit), descriptions, confidence.
**What it is NOT asked for:** Country of business, UK SIC 2007, CA NAICS, any other jurisdiction-specific code.

**Limitation for non-US businesses:** The prompt is entirely US-centric. A UK business verified through Trulioo would have its UK SIC code ignored, and the AI would return a US NAICS code. For UK businesses, a US NAICS code is a category mismatch (UK SIC and US NAICS use different industrial boundaries).

---

### 6C. The Complete Zod Response Schema

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 22–35
const naicsEnrichmentResponseSchema = z.object({
    reasoning: z.string(),            // GPT's chain-of-thought explanation
    naics_code: z.string(),           // 6-digit US NAICS 2022 code
    naics_description: z.string(),    // Canonical NAICS description text
    mcc_code: z.string(),             // 4-digit MCC code
    mcc_description: z.string(),      // MCC description text
    confidence: z.enum(["HIGH", "MED", "LOW"]),  // GPT self-assessed confidence
    previous_naics_code: z.string(),  // The NAICS code that was set before this run
    previous_mcc_code: z.string(),    // The MCC code that was set before this run
    website_url_parsed: z.string().nullable(),   // The URL that was actually parsed
    website_summary: z.string().nullable(),      // Summary of what was found at the URL
    tools_used: z.array(z.string()),             // Which OpenAI tools were invoked
    tools_summary: z.string().nullable()         // Summary of tool usage
});
```

**What Zod does:** Zod is a TypeScript-first schema validation library. When the OpenAI API response is parsed against `naicsEnrichmentResponseSchema`, Zod validates each field type and strips any keys not defined in the schema. This is a safety contract — it prevents unexpected fields from polluting the stored response.

⚠️ **No `uk_sic_code` field means any AI-returned UK SIC is discarded.** If the GPT model were changed to return `uk_sic_code: "62012"` in its JSON response, Zod would strip it. The TypeScript type `AINaicsEnrichmentResponse` would not have a `uk_sic_code` key. The stored JSONB would not contain it.

---

### 6D. Post-Processing Validation

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 217–234
protected override async executePostProcessing<T, R>(
    enrichedTask: IBusinessIntegrationTaskEnriched<T>,
    response: R & AINaicsEnrichmentResponse
): Promise<void> {
    if (response?.naics_code) {
        try {
            const naicsInfo = await internalGetNaicsCode(response.naics_code);
            if (!naicsInfo?.[0]?.naics_label) {
                // Code doesn't exist in our reference table → replace with fallback
                await this.removeNaicsCode(enrichedTask.id, response);
                await this.sendTaskCompleteMessage(enrichedTask.id);
            }
        } catch (error) {
            logger.error(error, `Error getting naics info for ${response.naics_code}`);
        }
    }
}
```

**The `removeNaicsCode` method** (lines 187–207) replaces the invalid code with `this.NAICS_OF_LAST_RESORT = "561499"` and updates the stored `request_response` record in place. This prevents hallucinated NAICS codes from entering the system. The fallback `561499` ("Administrative and Support Services") is used because it is the most generic code that does not imply a specific high-risk industry.

---

### 6E. How AI Interacts with the Weight System

- **AI source weight:** `0.1` (lowest of all sources — set as `path: "response.naics_code", weight: 0.1` at line 319)
- **AI only runs if:** fewer than 3 other sources already have a value (so the AI result competes against at most 3 existing candidates)
- **AI can be overridden by:** any human `manualOverride`, or any vendor source with confidence > AI's confidence score
- **AI confidence:** stored as the GPT's self-assessed confidence enum (`"HIGH"`, `"MED"`, `"LOW"`) — the getter maps this to a numeric value: `response.confidence` (the enum string is stored and compared)

---

## SECTION 7 — SQL ANALYSIS QUERIES (COPY-PASTE READY)

### Query 1: Current NAICS Coverage for All Businesses

```sql
-- What this measures: How many businesses have a resolved NAICS code vs. NULL?
-- Why we need it: Baseline coverage metric before any changes.
-- What the result tells us: The overall effectiveness of the classification pipeline.
SELECT
    COUNT(*)                                              AS total_businesses,
    COUNT(naics_id)                                       AS has_naics,
    COUNT(*) - COUNT(naics_id)                            AS missing_naics,
    ROUND(100.0 * COUNT(naics_id) / NULLIF(COUNT(*), 0), 1) AS pct_with_naics
FROM public.data_businesses;
```

---

### Query 2: UK Businesses — Do They Have NAICS (Possibly Wrong)?

```sql
-- What this measures: For GB-address businesses, how many have a naics_id?
-- Why we need it: UK businesses with naics_id likely have a US NAICS code (wrong taxonomy).
-- What the result tells us: The scope of the UK classification problem.
-- [VALIDATE: confirm column name for country — may be address_country or a joined table]
SELECT
    COUNT(*)                                              AS total_uk_businesses,
    COUNT(naics_id)                                       AS has_naics,
    COUNT(*) - COUNT(naics_id)                            AS missing_naics,
    ROUND(100.0 * COUNT(naics_id) / NULLIF(COUNT(*), 0), 1) AS pct_with_naics
FROM public.data_businesses
WHERE address_country = 'GB';  -- [VALIDATE: confirm column name]
```

---

### Query 3: OpenCorporates Coverage — How Many UK Businesses Have `uk_sic` in Raw Response?

```sql
-- What this measures: If we fixed Gap 1 today, how many UK businesses would immediately get uk_sic?
-- Why we need it: Quantify the Phase 0 opportunity — data already in DB.
-- What the result tells us: Whether OpenCorporates is a viable uk_sic source for our UK portfolio.
SELECT
    COUNT(*)                                                              AS total_oc_uk_records,
    COUNT(*) FILTER (WHERE response::text LIKE '%uk_sic%')               AS has_uk_sic_in_response,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE response::text LIKE '%uk_sic%')
            / NULLIF(COUNT(*), 0),
        1
    )                                                                     AS pct_with_uk_sic
FROM integration_data.request_response rr
JOIN public.data_businesses db ON rr.business_id = db.id
WHERE rr.platform_id = (
    SELECT id FROM integrations.core_integrations_platforms WHERE code = 'opencorporates'
)   -- [VALIDATE: confirm platform code string]
AND db.address_country = 'GB';  -- [VALIDATE: confirm column name]
```

---

### Query 4: Trulioo — How Many GB Business Records Contain `sicCode`?

```sql
-- What this measures: How many Trulioo responses for UK businesses include a sicCode field?
-- Why we need it: Quantify the Phase 1 opportunity from Gap 2 (Trulioo sicCode is never read).
-- What the result tells us: Trulioo coverage of UK SIC for our UK portfolio.
SELECT
    COUNT(*)                                                              AS total_trulioo_uk_records,
    COUNT(*) FILTER (
        WHERE response::jsonb #>> '{clientData,standardizedIndustries,0,sicCode}' IS NOT NULL
    )                                                                     AS has_sic_code,
    ROUND(
        100.0 * COUNT(*) FILTER (
            WHERE response::jsonb #>> '{clientData,standardizedIndustries,0,sicCode}' IS NOT NULL
        ) / NULLIF(COUNT(*), 0),
        1
    )                                                                     AS pct_with_sic_code
FROM integration_data.request_response rr
JOIN public.data_businesses db ON rr.business_id = db.id
WHERE rr.platform_id = (
    SELECT id FROM integrations.core_integrations_platforms WHERE code = 'trulioo'
)   -- [VALIDATE: confirm platform code]
AND rr.request_type = 'fetch_business_entity_verification'
AND db.address_country = 'GB';
```

---

### Query 5: `classification_codes` Fact — How Many Businesses Have `uk_sic` Stored?

```sql
-- What this measures: Whether the classification_codes fact is being computed and stored,
--                     and whether uk_sic appears in it.
-- Why we need it: The classification_codes fact is computed but has no downstream consumer.
--                 This tells us how much work is already done.
-- [NOTE: classification_codes is stored in integration_data.request_response
--  but the exact request_type value used to store resolved facts needs validation]
-- [VALIDATE: confirm the request_type value used for stored facts — may be 'resolved_fact'
--  or the facts may not be persisted at all if the fact engine is purely in-memory]
SELECT
    COUNT(*) FILTER (WHERE response::text LIKE '%uk_sic%')   AS has_uk_sic_in_classification_codes,
    COUNT(*)                                                   AS total
FROM integration_data.request_response
WHERE request_type = 'classification_codes';  -- [VALIDATE: confirm or discover actual value]
```

---

### Query 6: Equifax — SIC Data Availability

```sql
-- What this measures: How many Equifax records contain a primsic value?
-- Why we need it: US SIC is available from Equifax but never consumed — quantify the loss.
-- What the result tells us: How many businesses could get US SIC codes if a fact were added.
SELECT
    COUNT(*)                                                                        AS total_equifax_records,
    COUNT(*) FILTER (
        WHERE response->>'primsic' IS NOT NULL AND response->>'primsic' != ''
    )                                                                               AS has_sic,
    COUNT(*) FILTER (
        WHERE response->>'primnaicscode' IS NOT NULL AND response->>'primnaicscode' != ''
    )                                                                               AS has_naics
FROM integration_data.request_response
WHERE platform_id = 17;  -- Equifax platform_id confirmed from extended_attributes function
```

---

### Query 7: NAICS Code Distribution — Top 20 Most Common Industries

```sql
-- What this measures: Which NAICS codes are most prevalent in the business portfolio?
-- Why we need it: Reveals portfolio concentration risk and validates classification quality.
-- What the result tells us: If 561499 (AI fallback) appears in top 5, coverage is poor.
SELECT
    nc.code                                                         AS naics_code,
    nc.label                                                        AS naics_description,
    COUNT(db.id)                                                    AS business_count,
    ROUND(100.0 * COUNT(db.id) / SUM(COUNT(db.id)) OVER (), 2)     AS pct_of_portfolio
FROM public.data_businesses db
JOIN public.core_naics_code nc ON db.naics_id = nc.id
GROUP BY nc.code, nc.label
ORDER BY business_count DESC
LIMIT 20;
```

---

### Query 8: NAICS → MCC Mapping — Which MCCs Are Most Common?

```sql
-- What this measures: Distribution of Merchant Category Codes in the portfolio.
-- Why we need it: MCC distribution drives compliance risk profile for the customer.
-- What the result tells us: Which merchant categories dominate, and whether 9999 (undefined) is high.
SELECT
    mc.code                       AS mcc_code,
    mc.label                      AS mcc_description,
    COUNT(db.id)                  AS business_count
FROM public.data_businesses db
JOIN public.core_mcc_code mc ON db.mcc_id = mc.id
GROUP BY mc.code, mc.label
ORDER BY business_count DESC
LIMIT 20;
```

---

### Query 9: Businesses with Fallback NAICS 561499 — AI Last Resort Usage

```sql
-- What this measures: How many businesses got the AI fallback code (561499)?
-- Why we need it: A high count of 561499 indicates the pipeline has poor coverage.
-- What the result tells us: Proportion of businesses where no source could determine an industry.
SELECT
    nc.code                                                AS naics_code,
    nc.label                                               AS naics_label,
    COUNT(db.id)                                           AS count,
    ROUND(100.0 * COUNT(db.id) / (SELECT COUNT(*) FROM public.data_businesses WHERE naics_id IS NOT NULL), 2)
                                                           AS pct_of_classified_businesses,
    'AI fallback / unknown industry code'                  AS note
FROM public.data_businesses db
JOIN public.core_naics_code nc ON db.naics_id = nc.id
WHERE nc.code = 561499
GROUP BY nc.code, nc.label;
```

---

## SECTION 8 — PHASED IMPROVEMENT PLAN

### PHASE 0 — MEASURE (Before Writing Any Code)

**What:** Run all 9 SQL queries from Section 7 against the production database.

**Why first:** You cannot set success metrics or justify work without knowing the baseline. The queries answer: What % of UK businesses already have `uk_sic` in raw `request_response` data? How many businesses are classified with the AI fallback 561499? How many UK businesses have a Trulioo record with `sicCode`?

**Decision gates:**
- If Query 3 shows >50% of UK businesses have `uk_sic` in OpenCorporates responses → proceed to Phase 1 immediately
- If Query 3 shows <10% → OpenCorporates may not return UK SIC for our UK customer base → evaluate whether Trulioo (Query 4) compensates before committing to Phase 1

**Deliverable:** Coverage report with percentages for each source and each code type. Store as a dashboard or shared document.

---

### PHASE 1 — UNLOCK UK SIC WITHOUT AI (Low Risk, High Impact)

**Files to change:**

1. **New migration in case-service:**
   ```sql
   -- Create reference table for UK SIC 2007 codes
   CREATE TABLE public.core_uk_sic_code (
       id INT GENERATED ALWAYS AS IDENTITY NOT NULL,
       code VARCHAR(10) NOT NULL,   -- 5-char code, may have leading zeros
       label VARCHAR(500) NOT NULL,
       CONSTRAINT core_uk_sic_code_pk PRIMARY KEY (id),
       CONSTRAINT core_uk_sic_code_unique UNIQUE (code)
   );
   -- Seed with ~731 UK SIC 2007 codes from Companies House classification
   -- (source: https://resources.companieshouse.gov.uk/sic/)

   -- Add storage column to data_businesses
   ALTER TABLE public.data_businesses ADD COLUMN uk_sic_id INT NULL;
   ALTER TABLE public.data_businesses ADD CONSTRAINT data_businesses_core_uk_sic_code_fk
       FOREIGN KEY (uk_sic_id) REFERENCES public.core_uk_sic_code(id);
   ```

2. **`integration-service/lib/facts/businessDetails/index.ts`** — Add `uk_sic_code` fact:
   ```typescript
   uk_sic_code: [
       {
           source: sources.opencorporates,
           // Read from the classification_codes.uk_sic value already computed
           dependencies: ["classification_codes"],
           fn: async (engine: FactEngine): Promise<string | undefined> => {
               const codes = engine.getResolvedFact("classification_codes")?.value;
               return codes?.uk_sic;
           }
       },
       {
           source: sources.business,
           weight: 0.8,
           fn: async (_, truliooResponse: any): Promise<string | undefined> => {
               if (!truliooResponse?.clientData) return undefined;
               const country = engine.getResolvedFact("primary_address")?.value?.country;
               if (country !== "GB") return undefined;
               return extractStandardizedIndustriesFromTruliooResponse(truliooResponse.clientData)
                   ?.find((i: any) => i.sicCode)
                   ?.sicCode;
           }
       }
   ],
   ```

3. **Rules:** Use `truliooPreferredRule` for `uk_sic_code` resolution (already exists in `rules.ts`).

4. **Tests to add:**
   - Unit test: OpenCorporates `classification_codes.uk_sic` is correctly populated when `industry_code_uids` contains a `uk_sic-` entry
   - Unit test: Trulioo `sicCode` is correctly extracted for a GB business
   - Unit test: `truliooPreferredRule` selects Trulioo's uk_sic over OpenCorporates when both present for GB business
   - Integration test: A UK business end-to-end flow produces a non-null `uk_sic_id` in `data_businesses`

**Success metric:** >X% of UK businesses (as measured in Phase 0) have a non-null `uk_sic_id` after the fact engine is re-run. X should be set based on the Phase 0 baseline — if Phase 0 showed 70% of UK businesses have `uk_sic` in raw data, target >65% post-Phase-1 (allowing for some businesses with no OpenCorporates or Trulioo record).

**Why first:** Uses data already in the database. Zero new API calls. Zero new vendor costs. Highest ROI per hour of engineering effort.

---

### PHASE 2 — EXTEND AI FOR UK SIC (Only if Phase 1 Coverage < 70%)

**Files to change:**

1. **`integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts`:**
   - Add `uk_sic_code: z.string().optional()` and `uk_sic_description: z.string().optional()` to `naicsEnrichmentResponseSchema`
   - Update system prompt to include: *"If the business is in the United Kingdom (GB), also determine the UK SIC 2007 5-digit code (Standard Industrial Classification). Return it as uk_sic_code."*
   - Add post-processing validation: if `uk_sic_code` returned, validate against `core_uk_sic_code` table
   - Update `DEPENDENT_FACTS` to include `uk_sic_code: { maximumSources: 3, minimumSources: 1 }`

2. **`integration-service/lib/facts/businessDetails/index.ts`:**
   - Add `uk_sic_code` source entry for `AINaicsEnrichment`:
     ```typescript
     { source: sources.AINaicsEnrichment, path: "response.uk_sic_code", weight: 0.1 }
     ```

**Why second:** AI adds cost per call. It should only run when Phase 1 (free, zero-cost data extraction) has significant gaps.

---

### PHASE 3 — GENERALIZE TO OTHER COUNTRIES

Apply the same Phase 1 pattern to:
- `ca_naics_code` → Canadian NAICS (6-digit from OpenCorporates `classification_codes.ca_naics`)
- `au_anzsic_code` → Australian ANZSIC (check if OpenCorporates returns `au_anzsic-` codes)
- `de_wz_code` → Germany WZ (check if OpenCorporates returns `de_wz-` codes)

Each requires: a new reference table seeded from the national standard, a new column on `data_businesses`, and a new fact definition reading from `classification_codes.<code_scheme>`.

**Why third:** Once the UK SIC pattern is proven in Phase 1 and tested in Phase 2, cloning it for other jurisdictions is low-risk boilerplate work. Proving the pattern first reduces implementation risk.

---

### PHASE 4 — SCORING INTEGRATION

- Add `UK_SIC_CODE` as a score input in `manual-score-service`
- Update per-customer score configurations to use `uk_sic_code` for GB businesses
- Add `uk_sic_id` to any high-risk industry screening lists (equivalent of NAICS-based risk flags for UK industries)

**Why fourth:** Data quality and storage must be proven before scoring is changed. A bad `uk_sic_code` driving a wrong risk score is worse than no `uk_sic_code` at all.

---

### PHASE 5 — REPORTING AND ANALYTICS

- Update Worth 360 UI reports to display `uk_sic_code` for UK businesses alongside the US NAICS
- Update warehouse-service SQL views to include `uk_sic` columns
- Add `uk_sic_code` to the `extended_attributes` SQL function alongside the existing NAICS/SIC columns
- Add `uk_sic` to the `JudgementsLiens` Python model in `warehouse-service/datapooler/models/integrations/equifax/judgements_liens.py` if a UK SIC source is added to the warehouse pipeline

**Why last:** Reporting is only valuable after the data is clean, stored, and validated by scoring. Exposing data to underwriters before it is trusted creates confusion.

---

## SECTION 9 — ARCHITECTURAL DIAGRAM (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  EXTERNAL VENDOR APIs / FILE INGESTS                                            │
│                                                                                 │
│  [Equifax Batch]  [ZoomInfo API]  [OpenCorporates API]  [Trulioo API]           │
│  [SERP Scrape]    [Customer Form]   [OpenAI GPT-5 mini]                         │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │ Raw JSON responses written here
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  integration_data.request_response (PostgreSQL JSONB)                           │
│  ─────────────────────────────────────────────────────                          │
│  platform_id  │  request_type               │  response (JSONB blob)            │
│  ────────────────────────────────────────────────────────────────────           │
│  17 (Equifax) │ fetch_public_records        │ {primnaicscode, primsic, ...}     │
│  ZI_ID        │ (default)                   │ {firmographic.zi_c_naics6, ...}  │
│  OC_ID        │ (default)                   │ {firmographic.industry_code_uids}│
│  TR_ID        │ fetch_business_entity_verif │ {clientData.standardizedIndustries│
│  SERP_ID      │ (default)                   │ {businessLegitimacyClassification}│
│  0 (internal) │ fact_override               │ {naics_code: {value: ...}}        │
│  AI_ID        │ perform_business_enrichment │ {response.naics_code, mcc_code}   │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │ sources.ts getter() queries by (business_id, platform_id)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FACT ENGINE (TypeScript — integration-service)                                 │
│  sources.ts + businessDetails/index.ts                                          │
│                                                                                 │
│  For each fact (e.g., naics_code), each source's getter() runs:                 │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ Equifax        │  │ ZoomInfo       │  │ OpenCorporates │  │ Trulioo      │  │
│  │ path:"primnaics│  │ path:"zi_c_naics│  │ fn():parse     │  │ fn():find    │  │
│  │ code"          │  │ 6"             │  │ us_naics-*     │  │ .naicsCode   │  │
│  │ confidence:0.4 │  │ confidence:0.8 │  │ confidence:0.7 │  │ confidence:0.9│  │
│  │ weight: 0.7    │  │ weight: 0.8    │  │ weight: 0.9    │  │ weight: 0.7  │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  └──────────────┘  │
│                                                                                 │
│  ⚠️  uk_sic: OpenCorporates fn() SKIPS uk_sic-* entries (checks us_naics only) │
│  ⚠️  uk_sic: Trulioo fn() reads .naicsCode only, .sicCode is NEVER ACCESSED    │
│                                                                                 │
│  classification_codes fact: CORRECTLY parses {uk_sic: "62012"} from OC         │
│  ⚠️  BUT: no downstream fact reads from classification_codes.uk_sic             │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │ Multiple candidates collected
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  RULES ENGINE (rules.ts)                                                        │
│                                                                                 │
│  1. manualOverride → if underwriter set value, return it (ALWAYS WINS)          │
│  2. factWithHighestWeight → pick source with highest static weight               │
│  3. factWithHighestConfidence → pick source with best name/address match         │
│     (uses weight as tiebreaker when confidence diff ≤ 0.05)                     │
│  4. truliooPreferredRule → for GB/CA businesses, prefer Trulioo source           │
│     ⚠️ Rule exists but naics_code is wrong fact for UK; uk_sic_code fact absent │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │ One resolved winner per fact
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CASE-SERVICE API                                                               │
│  Receives resolved fact values; persists to PostgreSQL                          │
└──────────────────────────────┬──────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  CASE-SERVICE PostgreSQL                                                        │
│                                                                                 │
│  data_businesses                                                                │
│  ├── naics_id → core_naics_code (1,035 US NAICS 2022 codes)   ✅ WORKS          │
│  │   └── via rel_naics_mcc → mcc_id → core_mcc_code           ✅ WORKS          │
│  ├── mcc_id → core_mcc_code (125 MCC codes)                   ✅ WORKS          │
│  └── uk_sic_id → core_uk_sic_code                             ⚠️ DOES NOT EXIST │
│                                                                                 │
│  rel_business_industry_naics (per-platform industry record)   ✅ EXISTS          │
└─────────────────────────────────────────────────────────────────────────────────┘

KEY:
  ✅ = Working as designed
  ⚠️ = Gap / silent drop / missing component

WHERE uk_sic SHOULD FLOW (but currently does NOT):
  OpenCorporates response → classification_codes fact → uk_sic_code fact → uk_sic_id column
  Trulioo response → .sicCode field → uk_sic_code fact → uk_sic_id column
  AI prompt → uk_sic_code in schema → uk_sic_code fact → uk_sic_id column
```

---

## SECTION 10 — OPEN QUESTIONS & ASSUMPTIONS

### 10.1 OpenCorporates Platform ID

**Assumption:** The report uses `INTEGRATION_ID.OPENCORPORATES` symbolically. The actual integer value is not visible in the files read.

**How to validate:** `SELECT id, code, label FROM integrations.core_integrations_platforms WHERE code LIKE '%opencorporates%';`

**What changes if wrong:** Query 3 (Section 7) uses the wrong `platform_id` and returns incorrect counts. The fact engine would also be affected if `INTEGRATION_ID.OPENCORPORATES` is misconfigured, though this is unlikely since OpenCorporates data is clearly flowing.

---

### 10.2 Trulioo Platform ID

**Assumption:** `INTEGRATION_ID.TRULIOO` maps to the same platform ID used to store `fetch_business_entity_verification` responses.

**How to validate:** `SELECT id, code, label FROM integrations.core_integrations_platforms WHERE code LIKE '%trulioo%';`

**What changes if wrong:** Query 4 (Section 7) and the `business` source getter would query the wrong rows.

---

### 10.3 `classification_codes` Fact Storage

**Assumption:** The `classification_codes` fact is computed by the fact engine at run time. It is unclear whether this fact is persisted to `integration_data.request_response` (with some `request_type` like `'classification_codes'`) or exists only in-memory during fact resolution.

**How to validate:** `SELECT DISTINCT request_type FROM integration_data.request_response LIMIT 50;` — check whether any row with `request_type = 'classification_codes'` or similar exists.

**What changes if wrong:** If `classification_codes` is not persisted, then the Phase 1 fix (reading `engine.getResolvedFact("classification_codes")`) is still correct because the engine resolves it from OpenCorporates data at runtime. However, Query 5 (Section 7) would always return 0, and re-running the fact engine would be required to backfill `uk_sic_id` for existing businesses.

---

### 10.4 `address_country` Column Name on `data_businesses`

**Assumption:** The country column on `data_businesses` is named `address_country` based on field references in `businessDetails/index.ts` (e.g., `businessDetails.address_country` at line 453).

**How to validate:** `SELECT column_name FROM information_schema.columns WHERE table_name = 'data_businesses' AND column_name LIKE '%country%';`

**What changes if wrong:** Queries 2, 3, 4 (Section 7) and the `truliooPreferredRule` country check would be incorrect.

---

### 10.5 Equifax Platform ID = 17

**Assumption confirmed:** The `extended_attributes` SQL function hard-codes `WHERE r.platform_id = 17` (line 251 of the migration file). The TypeScript getter also uses `INTEGRATION_ID.EQUIFAX` which should resolve to 17. This is consistent.

**How to validate:** `SELECT id, code, label FROM integrations.core_integrations_platforms WHERE id = 17;`

---

### 10.6 `rel_naics_mcc` Coverage Completeness

**Assumption:** The seed data in `20240925091810-add-naics-mcc-code-tables-up.sql` maps all 1,035 NAICS codes to an MCC. The seed runs from `(naics_id 1, mcc_id 1)` to `(naics_id 1012, mcc_id 84)`. NAICS IDs 1013–1035 (the last 23 codes in the seed) are not visible in the mapping data provided.

**How to validate:** `SELECT COUNT(*) FROM core_naics_code nc LEFT JOIN rel_naics_mcc rnm ON nc.id = rnm.naics_id WHERE rnm.naics_id IS NULL;` — should return 0 if all NAICS codes are mapped.

**What changes if wrong:** Businesses classified under those unmapped NAICS codes would have `mcc_id = NULL` even when `naics_id` is set.

---

### 10.7 Trulioo `standardizedIndustries[].sicCode` — Confirmed Structure

**Assumption:** The `sicCode` field is present at `clientData.standardizedIndustries[n].sicCode` for GB businesses. The `extractStandardizedIndustriesFromTruliooResponse()` function is imported at line 24 of `businessDetails/index.ts` and used. The type is not shown in the files read.

**How to validate:** Query 4 (Section 7) — if `#>> '{clientData,standardizedIndustries,0,sicCode}'` returns results, the path is correct. Also: `SELECT response->'clientData'->'standardizedIndustries'->0 FROM integration_data.request_response WHERE platform_id = <trulioo_id> AND response->'clientData'->'standardizedIndustries' IS NOT NULL LIMIT 5;` — inspect the actual JSON structure.

---

### 10.8 `mcc_code_found` Fact — AI MCC vs. NAICS-Derived MCC

**Assumption:** When the AI returns both a `naics_code` and a `mcc_code`, the `mcc_code` takes precedence in `mcc_code` fact resolution (line 383–386: `foundMcc?.value ?? inferredMcc?.value`). This means for businesses where the AI ran, the AI's MCC judgment is used rather than the NAICS→MCC join.

**How to validate:** Check whether the AI's direct MCC is typically more accurate than the NAICS-derived MCC for a sample of businesses.

**What changes if wrong:** If AI MCCs are less accurate than NAICS-derived MCCs (e.g., because the AI uses an older MCC standard), the preference order should be reversed.

---

### 10.9 `gpt-5-mini` Model Availability

**Assumption:** The model identifier `"gpt-5-mini"` (line 48: `protected static readonly MODEL: ResponsesModel = "gpt-5-mini"`) is a valid OpenAI model. As of March 2026, this is a plausible model name.

**How to validate:** Check OpenAI's model list. If the model name is incorrect, the AI enrichment task would silently fail with an API error.

---

### 10.10 `DEFAULT_FACT_WEIGHT` Value

**Assumption:** The constant `DEFAULT_FACT_WEIGHT` is imported in `rules.ts` line 4 from `./factEngine`. The actual value is not in the files read. Based on the weight table (Section 3D), it is likely `1`.

**How to validate:** Read `integration-service/lib/facts/factEngine.ts` and search for `export const DEFAULT_FACT_WEIGHT`.

**What changes if wrong:** The `weightedFactSelector` function in `rules.ts` (lines 61–75) uses `DEFAULT_FACT_WEIGHT` as a sentinel to decide whether to use the source-level weight vs. the fact-level weight. If the value is not `1`, tiebreaker behavior would differ from the table in Section 3D.

---

*End of Report*

**Files analyzed:**
- `integration-service/lib/facts/sources.ts` (1,245 lines)
- `integration-service/lib/facts/businessDetails/index.ts` (545 lines)
- `integration-service/lib/facts/rules.ts` (308 lines)
- `integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts` (235 lines)
- `integration-service/db/migrations/migrate/sqls/20240111180938-add-rutter-accounting-tables-up.sql` (310 lines)
- `integration-service/db/migrations/migrate/sqls/20250619161600-business-extended-data-up.sql` (257 lines)
- `case-service/db/migrations/migrate/sqls/20240925091810-add-naics-mcc-code-tables-up.sql` (2,135 lines)
- `case-service/db/migrations/migrate/sqls/20240926041144-add-naics-mcc-code-data-business-up.sql` (19 lines)
- `case-service/db/migrations/migrate/sqls/20241111105459-naics-industry-platform-up.sql` (10 lines)
- `warehouse-service/datapooler/models/integrations/equifax/judgements_liens.py` (263 lines)
