# Worth Industry Classification — Deep Multi-Part Investigation
## Complete Technical Answer to All 7 Questions

**Date:** March 23, 2026  
**Branch:** `cursor/worth-s-industry-classification-2cd0`  
**Scope:** Integration-Service · Case-Service · Warehouse-Service (Redshift)

---

> ### Database Connection Map — Read Before Running Any Query
>
> | System | Connection | Native Tables |
> |---|---|---|
> | **case-service PostgreSQL** | `CONFIG_DB_*` in `case-service/.env` | `public.data_businesses`, `public.core_naics_code`, `public.core_mcc_code` |
> | **integration-service PostgreSQL** | `CONFIG_DB_*` in `integration-service/.env` | `integration_data.request_response`, `integrations.core_integrations_platforms` |
> | **Redshift (warehouse)** | Redshift cluster credentials | `datascience.*`, `warehouse.*`, `open_corporate.*` |
> | **Redshift `rds_*` schemas** | Same Redshift cluster | **Mirrored RDS data** — read-only mirrors of case-service + integration-service PostgreSQL |
>
> **Key rule:** `rds_cases_public.*` and `rds_integration_public.*` in Redshift are mirrors of the PostgreSQL RDS databases. The native warehouse data lives in `datascience`, `warehouse`, and `open_corporate` schemas.

---

## PART 1 — WHICH INTEGRATION PARTNERS PROVIDE INDUSTRY CODES?

### Complete Inventory of All Sources

Reading from `sources.ts`, `businessDetails/index.ts`, `zoominfo/types.ts`, `opencorporates/types.ts`, and `trulioo/common/utils.ts`, here is every partner that can return an industry code:

| Partner | Source Name in Code | Platform Type | Industry Fields Returned | Code Types |
|---|---|---|---|---|
| **Equifax** | `equifax` | FILE / Batch | `primnaicscode`, `secnaics1–4`, `primsic`, `secsic1–4`, all with hierarchy labels | US NAICS 6-digit, US SIC 4-digit |
| **ZoomInfo** | `zoominfo` | LIVE API | `zi_c_naics2`, `zi_c_naics4`, `zi_c_naics6`, `zi_c_sic2`, `zi_c_sic3`, `zi_c_sic4` | US NAICS 2/4/6-digit, US SIC 2/3/4-digit |
| **OpenCorporates** | `opencorporates` | LIVE API | `firmographic.industry_code_uids` (pipe-delimited multi-jurisdiction string) | US NAICS, UK SIC 2007, CA NAICS, more |
| **Trulioo** | `business` | LIVE API | `clientData → StandardizedIndustries[].naicsCode` and `.sicCode` (inside AppendedFields) | US NAICS 6-digit, UK SIC (variable length) |
| **SERP Scrape** | `serp` | LIVE API | `businessLegitimacyClassification.naics_code` | US NAICS 6-digit (inferred) |
| **Customer-submitted** | `businessDetails` | INTERNAL DB | `naics_code` on `data_businesses` | US NAICS 6-digit (self-reported) |
| **AI (GPT-5 mini)** | `AINaicsEnrichment` | AI INFERENCE | `response.naics_code`, `response.mcc_code` | US NAICS 6-digit, MCC 4-digit |
| **Tax Filings** | internal handler | LIVE API | `naics` field in `integration_data.tax_filings` | US NAICS (from IRS) |

The Tax Filings source deserves special note. In `business.ts` line 538, the `taxStatusDataFetching` handler stores a `naics` column in `integration_data.tax_filings` directly from the IRS response. This is a **separate storage path** from `request_response` and is **not currently wired into the fact engine**.

---

## PART 2 — FILE SOURCES vs. API SOURCES

### File / Batch Sources (Async, May Be Stale)

#### Equifax — FILE SOURCE

```typescript
// integration-service/lib/facts/sources.ts  lines 311-315
equifax: {
    category: "publicRecords",
    platformId: INTEGRATION_ID.EQUIFAX,
    scope: "business",
    weight: 0.7, // Equifax has a low weight because it relies upon manual
                 // files being ingested at some unknown cadence
```

**How it works:** Equifax data is NOT fetched live per business. A batch file is ingested periodically (cadence unspecified in code — hence "unknown cadence" in the comment). The warehouse pipeline in `warehouse-service/datapooler/models/integrations/equifax/judgements_liens.py` describes the Python model that structures each row. The data is uploaded to `integration_data.request_response` with `request_type = 'fetch_public_records'` and `platform_id = 17`. The getter joins to `data_business_integrations_tasks` to get the `metadata.match` confidence score.

**Staleness risk:** Because this is a batch file, an Equifax record for a business may be days, weeks, or months old. This is why the weight is 0.7 — lower than live API sources.

**Warehouse path:** In Redshift, Equifax data flows through `datascience.smb_zi_oc_efx_combined` and ultimately into `datascience.customer_files`. The warehouse SQL in `smb_pr_verification_cs.sql` shows all Equifax NAICS and SIC columns (`efx_primnaicscode`, `efx_primsic`, etc.) being surfaced.

---

### Live API Sources (Real-Time Per Business)

#### ZoomInfo — LIVE API

```typescript
// integration-service/lib/facts/sources.ts  lines 277-293
zoominfo: {
    category: "kyb",
    platformId: INTEGRATION_ID.ZOOMINFO,
    scope: "business",
    weight: 0.8,
    getter: async function (businessID: any) {
        const [response, index, updatedAt] = await getFromRequestResponse<ZoomInfoResponse>(
            businessID,
            { platform_id: INTEGRATION_ID.ZOOMINFO }
        );
        // ...
        return response?.firmographic && response;
    }
}
```

**When it runs:** During `CASE_SUBMITTED_EXECUTE_TASKS` event, a ZoomInfo task is created and executed. The response is stored in `integration_data.request_response`. The getter reads the most recent row for this business from that table.

**Confidence mechanism:** ZoomInfo's match result (`response.match.index`) is divided by `MAX_CONFIDENCE_INDEX (55)` to produce a 0–1 confidence score.

#### OpenCorporates — LIVE API

```typescript
// integration-service/lib/facts/sources.ts  lines 294-310
opencorporates: {
    category: "kyb",
    platformId: INTEGRATION_ID.OPENCORPORATES,
    weight: 0.9,
    scope: "business",
    getter: async function (businessID: any) {
        const [response, confidence, updatedAt] = await getFromRequestResponse<OpenCorporateResponse>(
            businessID,
            { platform_id: INTEGRATION_ID.OPENCORPORATES }
        );
        // ...
        return response?.firmographic && response;
    }
}
```

**Important:** OpenCorporates also has a warehouse-native table `dev.open_corporate.companies` in Redshift (referenced in `open_corporates_standard.sql` line 66). The warehouse uses this for bulk matching. The live API is used per-business in the fact engine. These are two separate access paths for the same underlying data.

#### Trulioo — LIVE API

```typescript
// integration-service/lib/facts/sources.ts  lines 802-808
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
        // ...
    }
}
```

**Trulioo's architecture:** The KYB flow submits business data to Trulioo's API. The response comes back as a deeply nested structure with `clientData.serviceData[].fullServiceDetails.Record.DatasourceResults[].AppendedFields`. Industry data lives inside `AppendedFields` as `StandardizedIndustries`. This is why a special extraction function exists:

```typescript
// integration-service/lib/trulioo/common/utils.ts  lines 836-916
export function extractStandardizedIndustriesFromTruliooResponse(rawClientData: any): Array<{
    naicsCode?: string;
    sicCode?: string;
    industryName?: string;
    industryDescription?: string;
}> | undefined {
    // Searches through all serviceData items for StandardizedIndustries
    // Iterates DatasourceResults → AppendedFields → FieldName === "StandardizedIndustries"
    // Extracts NAICSCode, SICCode, IndustryName, IndustryDescription from each entry
```

#### SERP Scrape — LIVE API

```typescript
// integration-service/lib/facts/sources.ts  lines 530-574
serp: {
    platformId: INTEGRATION_ID.SERP_SCRAPE,
    category: "publicRecords",
    scope: "business",
    getter: async function (businessID: any) {
        // Reads from request_response with platform_id = INTEGRATION_ID.SERP_SCRAPE
        // Runs confidence scoring against customer-submitted business
        return response.businessMatch && response;
    }
}
```

**What it does:** The SERP scrape searches Google/Bing for the business name and website, parses the results, and uses an ML model to infer a NAICS code from search result text. This is inherently an approximation.

---

## PART 3 — WHAT CODES ARE WE ACTUALLY RECEIVING?

### Per-Source Code Field Inventory (With Actual Field Names from Type Definitions)

#### ZoomInfo — Full Industry Field Set

From `integration-service/lib/zoominfo/types.ts` lines 52–58:

```typescript
// The FirmographicResult type — complete industry fields
zi_c_naics2: string;         // 2-digit NAICS sector code (e.g., "54")
zi_c_naics4: string;         // 4-digit NAICS subsector code (e.g., "5411")
zi_c_naics6: string;         // 6-digit NAICS code (e.g., "541110") — THIS IS USED
zi_c_naics_top3: string;     // Top-3 NAICS codes as a delimited string
zi_c_sic2: string;           // 2-digit SIC code
zi_c_sic3: string;           // 3-digit SIC code
zi_c_sic4: string;           // 4-digit US SIC 1987 code — NEVER READ by fact engine
zi_c_sic_top3: string;       // Top-3 SIC codes as a delimited string
// Additional industry text fields:
zi_c_industry_primary: string;      // Text label for primary industry
zi_c_sub_industry_primary: string;  // Text label for sub-industry
zi_c_industries: string;            // All industry labels (delimited)
zi_c_naics_confidence_score: number | null;  // ZoomInfo's own NAICS confidence
zi_c_sic_confidence_score: number | null;    // ZoomInfo's own SIC confidence
```

**What is actually used:** Only `zi_c_naics6` maps to the `naics_code` fact. The 2-digit and 4-digit NAICS, all SIC fields, and the confidence scores for industry are **silently ignored**.

#### OpenCorporates — Multi-Jurisdiction Code Field

From `integration-service/lib/opencorporates/types.ts` line 116:

```typescript
// The FirmographicResult type
industry_code_uids: string;  // Pipe-delimited: "us_naics-541110|uk_sic-62012|ca_naics-541110"
naics?: number | null;       // Also has a direct naics field
```

**The `industry_code_uids` format:** Each entry is `<scheme>-<code>` separated by `|`. Known scheme prefixes observed in production:
- `us_naics` — US NAICS 2022 (6-digit)
- `uk_sic` — UK SIC 2007 (5-character, e.g., `62012`)
- `ca_naics` — Canadian NAICS (6-digit)
- `eu_nace` — EU NACE classification (4-character with dot, e.g., `J.62.01`)
- `au_anzsic` — Australian ANZSIC (4-digit)

**What is actually used:** Only the first entry matching `us_naics` is read by the `naics_code` fact resolver. All other codes are parsed by `classification_codes` but that fact has no downstream consumer.

#### Trulioo — StandardizedIndustries Structure

From `integration-service/lib/trulioo/common/utils.ts` lines 892–910:

```typescript
// What extractStandardizedIndustriesFromTruliooResponse returns:
{
    naicsCode?: string;          // e.g., "541110" — 6-digit US NAICS
    sicCode?: string;            // e.g., "7372" (US SIC) or "62012" (UK SIC)
    industryName?: string;       // e.g., "Custom Computer Programming Services"
    industryDescription?: string // Longer description text
}
```

**The `sicCode` field from Trulioo is ambiguous.** For US businesses, it is a 4-digit US SIC 1987 code. For UK businesses, Trulioo populates it with the 5-digit UK SIC 2007 code. The field name is the same but the content and meaning differ by country. This ambiguity is a root cause of why reading it requires country-awareness.

**How Trulioo returns it:** Inside the deeply nested `fullServiceDetails.Record.DatasourceResults[].AppendedFields` where `FieldName === "StandardizedIndustries"` and the `Data` field contains a JSON string with a `StandardizedIndustries` array.

#### Equifax — Full NAICS and SIC Hierarchy

From `warehouse-service/datapooler/models/integrations/equifax/judgements_liens.py` lines 77–107:

```python
# ALL industry fields in the Equifax model:
primsic: Optional[str] = None          # Primary US SIC 1987 (4-digit)
secsic1: Optional[str] = None          # Secondary SIC #1
secsic2: Optional[str] = None          # Secondary SIC #2
secsic3: Optional[str] = None          # Secondary SIC #3
secsic4: Optional[str] = None          # Secondary SIC #4
primnaicscode: Optional[str] = None    # Primary NAICS (6-digit) — USED
secnaics1: Optional[str] = None        # Secondary NAICS #1
secnaics2: Optional[str] = None
secnaics3: Optional[str] = None
secnaics4: Optional[str] = None
primnaics_sector: Optional[str] = None        # 2-digit sector label
primnaics_subsector: Optional[str] = None     # 3-digit subsector label
primnaics_industry_group: Optional[str] = None # 4-digit industry group label
primnaics_industry: Optional[str] = None      # 5-digit industry label
# (Same sector/subsector/group/industry fields for secnaics1-4)
```

**Code length breakdown for Equifax NAICS:**
- `primnaics_sector` → 2-digit (e.g., `54` = Professional Services)
- `primnaics_subsector` → 3-digit (e.g., `541` = Professional Services)
- `primnaics_industry_group` → 4-digit (e.g., `5411` = Legal Services)
- `primnaics_industry` → 5-digit (e.g., `54111` = Offices of Lawyers)
- `primnaicscode` → 6-digit (e.g., `541110` = Offices of Lawyers)

**Code length breakdown for Equifax SIC:**
- `primsic` → 4-digit US SIC 1987 (e.g., `7372` = Prepackaged Software)
- `secsic1–4` → additional 4-digit SIC codes, alternate industry classifications

---

## PART 4 — UNDERSTANDING TRULIOO'S CODE LENGTHS AND OTHER API DOCUMENTATION

### Trulioo: What Their Codes Mean

Trulioo is the most complex source because its industry data is multi-jurisdictional and embedded in a deeply nested structure. Based on `utils.ts` and the business type definitions:

**How Trulioo delivers industry data:**
1. Business is submitted to Trulioo's KYB flow with form data
2. Trulioo queries multiple datasources (Companies House for UK, Canadian registries for CA, etc.)
3. Results come back in `clientData.serviceData[].fullServiceDetails.Record.DatasourceResults[].AppendedFields`
4. The `AppendedFields` array contains entries with `FieldName` and `Data`
5. When `FieldName === "StandardizedIndustries"`, `Data` is a JSON string containing the industry classification

**Code format by country:**

| Country | `naicsCode` | `sicCode` | Notes |
|---|---|---|---|
| US | 6-digit (e.g., `541110`) | 4-digit US SIC (e.g., `7372`) | Both standards apply |
| UK (GB) | Usually `null` or US NAICS approximation | 5-digit UK SIC 2007 (e.g., `62012`) | UK companies have no NAICS; Trulioo approximates or leaves null |
| Canada (CA) | 6-digit Canadian NAICS (same structure as US) | May be absent | Canada uses NAICS compatible with US |
| Australia (AU) | May have ANZSIC, not NAICS | May be absent | Different standard entirely |

**The SIC ambiguity problem in Trulioo:** The `.sicCode` field in `StandardizedIndustries` holds different things depending on country. For US businesses it is a 4-digit US SIC 1987 code. For UK businesses it is a 5-digit UK SIC 2007 code. For the extraction function to be correct, any consumer of `sicCode` must first check the business country.

### ZoomInfo: What Their Codes Mean

From `zoominfo/types.ts`:
- `zi_c_naics6` → Always US NAICS 2022, 6 digits, integer as string
- `zi_c_sic4` → Always US SIC 1987, 4 digits — this is a US standard; ZoomInfo does not return UK SIC
- `zi_c_naics_confidence_score` → ZoomInfo's internal confidence in their NAICS assignment (0–1 or 0–100, format unverified)

ZoomInfo is a **US-centric** data source. For non-US businesses, ZoomInfo coverage is weaker and may return a US NAICS approximation rather than the local country's classification standard.

### OpenCorporates: What Their Codes Mean

OpenCorporates draws from official government company registries worldwide. Their `industry_code_uids` field uses scheme prefixes that directly correspond to the official standards of each country:

| Scheme Prefix | Standard | Country | Format | Length |
|---|---|---|---|---|
| `us_naics` | NAICS 2022 | United States | 6-digit integer | 6 |
| `uk_sic` | UK SIC 2007 | United Kingdom | 5-digit integer (may have leading zero) | 5 |
| `ca_naics` | Canadian NAICS | Canada | 6-digit integer | 6 |
| `eu_nace` | EU NACE Rev. 2 | European Union | `X.XX.XX` format | Variable |
| `au_anzsic` | ANZSIC 2006 | Australia | 4-digit integer | 4 |
| `de_wz` | WZ 2008 | Germany | `XX.XX` format | Variable |

**Important OpenCorporates note:** For UK companies, `industry_code_uids` may contain multiple codes:
```
"us_naics-541512|uk_sic-62012|eu_nace-J.62.01"
```
The `us_naics` code for a UK company is likely an approximation or cross-reference that OpenCorporates derived from their data mapping — it may NOT be an officially registered US NAICS. The `uk_sic` code from UK Companies House is the authoritative official code for UK companies.

---

## PART 5 — THE COMPLETE END-TO-END FLOW: ALL 7 STEPS WITH ACTUAL CODE

### Step 1 — Customer Submits Their Business (Trigger)

**Kafka event:** `BUSINESS_INVITE_ACCEPTED`

```typescript
// integration-service/src/messaging/kafka/consumers/handlers/business.ts  lines 88-91
case kafkaEvents.BUSINESS_INVITE_ACCEPTED:
    validateMessage(schema.businessInviteAccepted, payload);
    await kafkaToQueue(businessOnboardingQueue, EVENTS.BUSINESS_INVITE_ACCEPTED, payload);
    break;
```

This queues into `businessOnboardingQueue`. The handler then:
1. Creates `data_cases` record in case-service (PostgreSQL)
2. Creates a `business_score_triggers` record with `trigger_type = 'ONBOARDING_INVITE'`
3. Creates one `data_business_integrations_tasks` row for every enabled integration platform — all set to `CREATED` status

---

### Step 2 — Execute All Integration Tasks in Parallel

**Kafka event:** `CASE_SUBMITTED_EXECUTE_TASKS`

```typescript
// integration-service/src/messaging/kafka/consumers/handlers/business.ts  lines 113-116
case kafkaEvents.CASE_SUBMITTED_EXECUTE_TASKS:
    validateMessage(schema.executeTasksOnCaseSubmit, payload);
    await kafkaToQueue(caseSubmittedQueue, EVENTS.CASE_SUBMITTED_EXECUTE_TASKS, payload);
    break;
```

The actual execution in `executeTasksOnCaseSubmit`:

```typescript
// integration-service/src/messaging/kafka/consumers/handlers/business.ts  lines 372-390
async executeTasksOnCaseSubmit(body: { case_id: UUID; business_id: UUID }) {
    const uniqueTasks = await this.getTasksForCase(body.case_id);
    if (!uniqueTasks?.length) {
        throw new Error("No integration tasks found");
    }
    // fetch all tasks & process them asynchronously — all run in parallel
    const taskPromises = uniqueTasks.map(task =>
        executeIntegrationTask(task).catch(ex => {
            logger.error({ ex }, `Error executing integration task ${task.id}`);
        })
    );
    await Promise.allSettled(taskPromises);
}
```

Each task calls the appropriate vendor API and stores the raw JSON response in `integration_data.request_response`. For industry codes, the relevant tasks are:
- `fetch_public_records` → Equifax (reads from pre-loaded batch file)
- `entity_match` (or equivalent) → ZoomInfo API call
- `entity_match` → OpenCorporates API call
- `fetch_business_entity_verification` → Trulioo KYB flow
- SERP scrape → web search + ML inference

**What each source stores in `integration_data.request_response.response` (JSONB):**

| Source | `response` JSONB shape | Industry field path |
|---|---|---|
| Equifax | `{primnaicscode: "541110", primsic: "7372", primnaics_sector: "54", ...}` | `response.primnaicscode` |
| ZoomInfo | `{firmographic: {zi_c_naics6: "541110", zi_c_sic4: "7372", ...}, match: {...}}` | `response.firmographic.zi_c_naics6` |
| OpenCorporates | `{firmographic: {industry_code_uids: "us_naics-541110\|uk_sic-62012", ...}, match: {...}}` | `response.firmographic.industry_code_uids` |
| Trulioo | `{clientData: {serviceData: [{fullServiceDetails: {Record: {DatasourceResults: [{AppendedFields: [{FieldName: "StandardizedIndustries", Data: "{...}"}]}]}}}]}}` | Deep nested extraction |
| SERP | `{businessMatch: {businessLegitimacyClassification: {naics_code: "541110", ...}}}` | `response.businessLegitimacyClassification.naics_code` |
| AI | `{response: {naics_code: "541110", mcc_code: "7392", ...}}` | `response.response.naics_code` |

---

### Step 3 — The Fact Engine Resolves NAICS

**Kafka event:** `INTEGRATION_DATA_READY` (fires after each task completes)

```typescript
// integration-service/src/messaging/kafka/consumers/handlers/business.ts  lines 108-111
case kafkaEvents.INTEGRATION_DATA_READY:
    validateMessage(schema.integrationDataReady, payload);
    await kafkaToQueue(taskQueue, EVENTS.INTEGRATION_DATA_READY, payload);
    break;
```

The fact engine is instantiated and run:

```typescript
// integration-service/src/messaging/kafka/consumers/handlers/business.ts  lines 737-756
async calculateBusinessFacts(payload) {
    const { business_id, case_id, customer_id, previous_status } = payload;
    const facts = new FactEngineWithDefaultOverrides(allFacts, { business: business_id });
    await facts.applyRules(FactRules.factWithHighestConfidence);
    await facts.getResults([
        "source.confidence",
        "source.platformId",
        "source.name",
        "ruleApplied.name",
        "ruleApplied.description",
        "fact.confidence",
        "source.weight",
        "fact.weight"
    ]);
    // ...sends APPLICATION_EDIT_FACTS_READY event if case_id present
}
```

**How `FactEngine.match()` works:**

```typescript
// integration-service/lib/facts/factEngine.ts  lines 64-94
public match = async (): Promise<boolean> => {
    if (this.scope.size === 0) throw new Error("Scope not set");

    for (const [sourceName, sourceReference] of [...this.sources.entries()]
        .filter(([_, source]) => source.resolved === undefined)
    ) {
        const source = _cloneDeep(sourceReference);
        if (this.scope.has(source.scope)) {
            const scopeValue = this.scope.get(source.scope);
            // Calls each source's getter() function
            source.rawResponse = await source.getter(scopeValue, this).catch(err => {
                logger.error(err, `Could not resolve source ${source.name}`);
                return null;
            });
            source.resolved = new Date();
            this.sources.set(sourceName, source);
            // Maps the raw response to all facts this source contributes to
            await this.mapSourceToFacts(source);
        }
    }
    this.linkManualSourceToAllFacts();
    this.matched = true;
    return this.matched;
};
```

**How `mapSourceToFacts()` extracts values from raw responses:**

```typescript
// integration-service/lib/facts/factEngine.ts  lines 640-686
protected async mapSourceToFacts(source: FactSource): Promise<void> {
    for (const factName of source.facts) {
        const fact = this.store.get(factKey);
        // When path is set: use lodash _.get() on the raw response
        if (fact.path) {
            const value = _get(rawResponse, fact.path);  // e.g., "primnaicscode" or "firmographic.zi_c_naics6"
            if (this.isValidFactValue(value)) {
                this.setFactValue(fact, value);
            }
        } else if (fact.fn && typeof fact.fn === "function") {
            // When fn is set: call the function to compute the value
            const value = await fact.fn(this, structuredClone(rawResponse));
            if (this.isValidFactValue(value)) {
                this.setFactValue(fact, value);
            }
        }
    }
}
```

**What makes a value "valid" (non-droppable):**

```typescript
// integration-service/lib/facts/factEngine.ts  lines 418-436
public isValidFactValue = (value: any): boolean => {
    if (value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === "boolean") return true;
    if (typeof value === "object" && value !== null && Object.keys(value).length === 0) return false;
    if (typeof value === "string" && value.trim() == "") return false;
    // null and 0 can be valid values
    return true;
};
```

**All naics_code candidates assembled:**

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 278-322
naics_code: [
    // Candidate 1: Equifax path
    { source: sources.equifax, path: "primnaicscode" },
    // Candidate 2: ZoomInfo path
    { source: sources.zoominfo, path: "firmographic.zi_c_naics6" },
    // Candidate 3: OpenCorporates fn — parses us_naics only
    {
        source: sources.opencorporates,
        fn: (_, oc: OpenCorporateResponse) => {
            for (const industryCodeUid of oc.firmographic.industry_code_uids.split("|")) {
                const [codeName, industryCode] = industryCodeUid.split("-", 2);
                if (codeName?.includes("us_naics") && industryCode?.length === 6) {
                    return Promise.resolve(industryCode);
                }
            }
            return Promise.resolve(undefined);  // UK SIC dropped here
        }
    },
    // Candidate 4: SERP with lower weight
    { source: sources.serp, weight: 0.3, path: "businessLegitimacyClassification.naics_code" },
    // Candidate 5: Trulioo fn — reads naicsCode, ignores sicCode
    {
        source: sources.business,
        weight: 0.7,
        fn: async (_, truliooResponse: any) => {
            return extractStandardizedIndustriesFromTruliooResponse(truliooResponse.clientData)
                ?.find((i: any) => i.naicsCode && /^\d{6}$/.test(i.naicsCode))
                ?.naicsCode;  // sicCode exists here but is never read
        }
    },
    // Candidate 6: Customer-submitted — deliberately down-weighted
    { source: sources.businessDetails, path: "naics_code", weight: 0.2,
      schema: z.string().regex(/^\d{6}$/) },
    // Candidate 7: AI fallback — lowest weight
    { source: sources.AINaicsEnrichment, path: "response.naics_code", weight: 0.1 }
],
```

---

### Step 4 — AI Fallback (When Fewer Than 3 Sources Respond)

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 51-61
static readonly DEPENDENT_FACTS: AINaicsEnrichmentDependentFacts = {
    website: { minimumSources: 1 },
    website_found: { minimumSources: 1 },
    business_name: { minimumSources: 1 },
    dba: { minimumSources: 0 },
    naics_code: { maximumSources: 3, minimumSources: 1,
                  ignoreSources: ["AINaicsEnrichment"] as SourceName[] },
    mcc_code: { maximumSources: 3, minimumSources: 1,
                ignoreSources: ["AINaicsEnrichment"] as SourceName[] },
    corporation: { minimumSources: 0 }
};
```

**AI runs if:** `naics_code` has between 1 and 3 sources (excluding AI itself) AND a website is known.

**The Zod schema (contract for what AI can return):**

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 22-35
const naicsEnrichmentResponseSchema = z.object({
    reasoning: z.string(),
    naics_code: z.string(),          // 6-digit US NAICS
    naics_description: z.string(),
    mcc_code: z.string(),            // 4-digit MCC
    mcc_description: z.string(),
    confidence: z.enum(["HIGH", "MED", "LOW"]),
    previous_naics_code: z.string(),
    previous_mcc_code: z.string(),
    website_url_parsed: z.string().nullable(),
    website_summary: z.string().nullable(),
    tools_used: z.array(z.string()),
    tools_summary: z.string().nullable()
    // NO uk_sic_code field — any AI UK SIC output is silently stripped
});
```

**AI validation — scrub invalid NAICS codes:**

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 217-234
protected override async executePostProcessing<T, R>(
    enrichedTask, response: R & AINaicsEnrichmentResponse
): Promise<void> {
    if (response?.naics_code) {
        const naicsInfo = await internalGetNaicsCode(response.naics_code);
        if (!naicsInfo?.[0]?.naics_label) {
            // Code not in our reference table — replace with fallback
            await this.removeNaicsCode(enrichedTask.id, response);
            // removeNaicsCode sets naics_code = "561499" (Administrative Services)
        }
    }
}
```

**AI confidence mapping:**
- The Zod schema's `confidence` enum (`HIGH`, `MED`, `LOW`) is what's stored
- In the source getter, `response?.confidence` is passed as the confidence getter function
- This means the raw string "HIGH"/"MED"/"LOW" is used as the confidence value for comparisons, which is unusual — string comparison against numeric thresholds may not work as expected. This is a potential bug: `factWithHighestConfidence` compares confidence numerically via `>` and `<=`, but a string like "HIGH" compared to a number like 0.8 will not behave correctly in JavaScript.

---

### Step 5 — Derived Facts: MCC and Industry Name

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 359-388
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
mcc_code: [{
    dependencies: ["mcc_code_found", "mcc_code_from_naics"],
    source: sources.calculated,
    fn: async (engine: FactEngine): Promise<number | undefined> => {
        const foundMcc = engine.getResolvedFact("mcc_code_found");  // From AI
        const inferredMcc = engine.getResolvedFact("mcc_code_from_naics");  // From NAICS join
        return foundMcc?.value ?? inferredMcc?.value;  // AI's MCC preferred over derived
    }
}],
```

The `internalGetNaicsCode()` call makes an HTTP request to the case-service API which does:
```sql
SELECT nc.code AS naics_code, nc.label AS naics_label, mc.code AS mcc_code, mc.label AS mcc_label
FROM public.core_naics_code nc
LEFT JOIN public.rel_naics_mcc rnm ON rnm.naics_id = nc.id
LEFT JOIN public.core_mcc_code mc ON rnm.mcc_id = mc.id
WHERE nc.code = $1
```

---

### Step 6 — Facts Published and Stored

**Kafka event:** `FACTS_CALCULATED` on topic `facts.v1`

```typescript
// integration-service/lib/facts/factEngine.ts  lines 774-795
private async sendFactCalculatedEvent(facts: Record<FactName, Partial<Fact>>): Promise<void> {
    const messages: FactCompleteMessage[] = [];
    for (const [key, value] of this.scope.entries()) {
        messages.push({
            key: value,
            payload: {
                scope: key,
                id: value,
                data: facts,
                calculated_at: new Date(),
                event: `${key}_facts_calculated`  // e.g., "business_facts_calculated"
            }
        });
    }
    await producer.send({
        topic: kafkaTopics.FACTS,
        messages: messages.map(message => ({ key: message.key, value: message.payload }))
    });
}
```

The case-service subscribes to this topic and handles `UPDATE_NAICS_CODE`:
- Reads the `naics_code` value from the facts payload
- Looks up `core_naics_code WHERE code = <value>` to get the surrogate `id`
- Updates `data_businesses SET naics_id = <id>` (case-service PostgreSQL)
- Also updates `data_businesses.mcc_id` via the `mcc_code` fact

---

### Step 7 — Scoring

The Manual Score Service subscribes to the `FACTS_CALCULATED` event and uses `naics_id` as an input to the risk score. The NAICS code determines:
- Which industry vertical the business is in
- Whether high-risk industry flags apply (e.g., cannabis, firearms, gambling)
- Industry-specific default/charge-off rate benchmarks used in score calculation

If `naics_id IS NULL`, scoring cannot proceed correctly because industry-based score factors cannot be computed.

---

## PART 6 — HOW THE WINNER IS CHOSEN (COMPLETE ALGORITHM)

### The `factWithHighestConfidence` Rule — Full Algorithm

```typescript
// integration-service/lib/facts/rules.ts  lines 36-58
export const factWithHighestConfidence: Rule = {
    name: "factWithHighestConfidence",
    fn: (_engine, _factName: FactName, input: Fact[]): Fact | undefined => {
        return input.reduce(
            (acc, fact) => {
                const factConfidence = fact.confidence ?? fact.source?.confidence ?? 0.1;
                const accConfidence = acc?.confidence ?? acc?.source?.confidence ?? 0.1;

                // Rule 1: Skip if value is empty
                if (fact.value === undefined || (Array.isArray(fact.value) && fact.value.length === 0)) {
                    return acc;
                }
                // Rule 2: First valid value always wins over nothing
                else if (acc === undefined) {
                    return fact;
                }
                // Rule 3: Confidence scores within 5% → use weight as tiebreaker
                else if (Math.abs(factConfidence - accConfidence) <= WEIGHT_THRESHOLD) {
                    return weightedFactSelector(fact, acc);
                }
                // Rule 4: Higher confidence wins
                else if (factConfidence > accConfidence) {
                    return fact;
                }
                return acc;
            },
            undefined as Fact | undefined
        );
    }
};

// WEIGHT_THRESHOLD = 0.05 (rules.ts line 9)
```

**`weightedFactSelector` — the tiebreaker:**

```typescript
// integration-service/lib/facts/rules.ts  lines 61-75
export function weightedFactSelector(fact: Fact, otherFact: Fact): Fact {
    const primaryFactWeight =
        fact.weight !== undefined && fact.weight !== DEFAULT_FACT_WEIGHT
            ? fact.weight
            : (fact.source?.weight ?? DEFAULT_FACT_WEIGHT);

    const otherFactWeight =
        otherFact.weight !== undefined && otherFact.weight !== DEFAULT_FACT_WEIGHT
            ? otherFact.weight
            : (otherFact.source?.weight ?? DEFAULT_FACT_WEIGHT);

    return primaryFactWeight >= otherFactWeight ? fact : otherFact;
}
// DEFAULT_FACT_WEIGHT = 1 (factEngine.ts line 10)
```

**Rule precedence (applied in this order):**

1. **`manualOverride`** — always prepended first in `applyRulesToFact`. If an underwriter manually set a value, it wins unconditionally.
2. **`factWithHighestConfidence`** — among remaining candidates, confidence drives selection.
3. **Weight tiebreaker** — if two candidates are within 5% confidence, the higher-weighted one wins.

### Complete Weight and Confidence Reference Table

| Source | Fact-level weight for `naics_code` | Source-level weight | Confidence source | Default if no match |
|---|---|---|---|---|
| `manualOverride` | N/A | N/A | N/A | Always wins if set |
| `equifax` | (inherits source) | **0.7** | `metadata.match.prediction` or `match.index / 55` | 0.1 |
| `zoominfo` | (inherits source) | **0.8** | `match.index / 55` | 0.1 |
| `opencorporates` | (inherits source) | **0.9** | `match.index / 55` | 0.1 |
| `business` (Trulioo) | **0.7** (fact override) | 0.8 | Confidence scoring or calculated from status | 0.3 |
| `serp` | **0.3** (fact override) | (none) | `confidenceScore()` API call | 0.5 if businessMatch |
| `businessDetails` | **0.2** (fact override) | 10 | 1.0 (hardcoded) | 1.0 |
| `AINaicsEnrichment` | **0.1** (fact override) | (none) | `response.confidence` (string!) | 0.1 |

**Why `businessDetails` has source weight 10 but fact weight 0.2:** The source weight of 10 applies to facts that don't override the weight (like `business_name`). For `naics_code` specifically, the fact definition explicitly sets `weight: 0.2` to down-rank customer-submitted NAICS codes, which are often wrong. The Zod schema `z.string().regex(/^\d{6}$/)` also filters out non-6-digit values.

### Decision Algorithm — Practical Examples

**Example 1: US business, all sources respond**
- Equifax: confidence 0.85, NAICS 541110
- ZoomInfo: confidence 0.82, NAICS 541512
- OpenCorporates: confidence 0.90, NAICS 541110
- |0.90 - 0.85| = 0.05 ≤ WEIGHT_THRESHOLD → tiebreaker: OC weight 0.9 vs EFX weight 0.7 → **OpenCorporates wins: 541110**

**Example 2: UK business, Trulioo responds with NAICS approximation**
- OpenCorporates: confidence 0.88, `us_naics` from industry_code_uids = 541512
- Trulioo: confidence 0.92, NAICS 541110 (from StandardizedIndustries)
- |0.92 - 0.88| = 0.04 ≤ WEIGHT_THRESHOLD → tiebreaker: Trulioo fact weight 0.7 vs OC source weight 0.9 → **OpenCorporates wins: 541512**
- But if `truliooPreferredRule` is applied (and UK business is detected): **Trulioo wins: 541110**
- ⚠️ Both codes are US NAICS for a UK company — neither is the correct UK SIC 2007

**Example 3: Sparse coverage — only customer-submitted**
- businessDetails: confidence 1.0, NAICS 541519
- AI: NAICS 541512 (after website parsing), confidence from "MED" (problematic comparison)
- businessDetails wins: confidence 1.0 vs unresolvable AI "MED" string → **businessDetails wins: 541519**

---

## PART 7 — WAREHOUSE QUERIES: WHAT WE CAN CHECK TODAY

### Understanding the Warehouse Schema Architecture

```
Redshift Warehouse Schemas:
├── rds_cases_public.*        ← Mirror of case-service PostgreSQL (RDS)
│   ├── data_businesses       ← Contains naics_id, mcc_id (resolved facts)
│   └── data_cases            ← Case records
├── rds_integration_public.*  ← Mirror of integration-service PostgreSQL (RDS)
│   └── request_response      ← Raw vendor API responses
├── rds_manual_score_public.* ← Mirror of manual-score-service PostgreSQL
├── datascience.*             ← Native warehouse processed tables
│   ├── customer_files        ← Master output table with primary_naics_code, mcc_code
│   ├── smb_pr_verification_cs ← Combined SMB + verification data
│   ├── smb_zi_oc_efx_combined ← ZoomInfo + OpenCorporates + Equifax merged
│   └── open_corporates_standard ← Standardized OC data with country filtering
├── warehouse.*               ← Raw/intermediate warehouse tables
│   └── latest_score          ← Most recent Worth score per business
└── open_corporate.*          ← Raw OpenCorporates company data
    └── companies             ← Source for datascience.open_corporates_standard
```

---

### WAREHOUSE QUERIES — All on Redshift

> All queries below run on the **Redshift warehouse**. They use both native warehouse schemas and the `rds_*` mirrored schemas.

---

#### Query W-1: Overall NAICS coverage in the warehouse

```sql
-- DATABASE: Redshift
-- What it measures: How many businesses in the warehouse have a resolved NAICS code?
-- Uses the native datascience.customer_files table (most authoritative final output)
SELECT
    COUNT(*)                                                            AS total_businesses,
    COUNT(primary_naics_code)                                           AS has_naics,
    COUNT(*) - COUNT(primary_naics_code)                                AS missing_naics,
    ROUND(100.0 * COUNT(primary_naics_code) / NULLIF(COUNT(*), 0), 1)  AS pct_with_naics,
    COUNT(mcc_code)                                                     AS has_mcc,
    ROUND(100.0 * COUNT(mcc_code) / NULLIF(COUNT(*), 0), 1)            AS pct_with_mcc
FROM datascience.customer_files;
```

---

#### Query W-2: NAICS source breakdown — which source won most often?

```sql
-- DATABASE: Redshift (using RDS mirror of case-service)
-- What it measures: When naics_id is set, what was the platform that supplied it?
-- This JOIN finds the most recent request_response record for each business
-- and tells us which vendor's data was ultimately used
-- NOTE: This approximates — the actual winner is determined by the fact engine at runtime
SELECT
    cip.code                               AS source_platform,
    COUNT(DISTINCT db.id)                  AS businesses_where_this_source_responded,
    SUM(CASE WHEN db.naics_id IS NOT NULL THEN 1 ELSE 0 END) AS businesses_with_naics
FROM rds_cases_public.data_businesses db
JOIN rds_integration_public.request_response rr ON rr.business_id = db.id
JOIN rds_integration_public.core_integrations_platforms cip
    ON rr.platform_id = cip.id
WHERE rr.response IS NOT NULL
GROUP BY cip.code
ORDER BY businesses_with_naics DESC;
```

---

#### Query W-3: UK business NAICS coverage — are we classifying them correctly?

```sql
-- DATABASE: Redshift
-- What it measures: UK businesses in the warehouse, their NAICS code, and whether
--                   they have a corresponding OpenCorporates record with uk_sic data.
-- Why it matters: A UK business with a US NAICS is classified under the wrong taxonomy.
SELECT
    cf.business_id,
    cf.company_name,
    cf.country,
    cf.primary_naics_code,
    cf.mcc_code,
    oc.industry_code_uids,
    -- Does this OpenCorporates record have a uk_sic code?
    CASE
        WHEN oc.industry_code_uids LIKE '%uk_sic%' THEN 'YES — uk_sic in OC data'
        WHEN oc.industry_code_uids IS NOT NULL THEN 'OC data but no uk_sic'
        ELSE 'No OC data'
    END                                     AS uk_sic_availability,
    -- Extract the uk_sic code if present
    REGEXP_SUBSTR(
        oc.industry_code_uids,
        'uk_sic-([0-9]+)',
        1, 1, 'e'
    )                                       AS uk_sic_code_from_oc
FROM datascience.customer_files cf
LEFT JOIN datascience.smb_pr_verification_cs smb USING (business_id)
LEFT JOIN datascience.open_corporates_standard oc
    ON  oc.company_number = smb.company_number
    AND oc.jurisdiction_code LIKE 'gb_%'
WHERE cf.country IN ('GB', 'UK', 'United Kingdom', 'GREAT BRITAIN')
ORDER BY cf.company_name
LIMIT 200;
```

---

#### Query W-4: OpenCorporates UK SIC coverage — how much data is available?

```sql
-- DATABASE: Redshift
-- What it measures: Among OpenCorporates records for GB jurisdiction,
--                   how many have uk_sic codes in industry_code_uids?
-- This answers: "If we fixed the parsing, how many UK businesses would get uk_sic?"
SELECT
    COUNT(*)                                                              AS total_gb_oc_records,
    COUNT(CASE WHEN industry_code_uids LIKE '%uk_sic%' THEN 1 END)       AS has_uk_sic,
    ROUND(
        100.0 * COUNT(CASE WHEN industry_code_uids LIKE '%uk_sic%' THEN 1 END)
            / NULLIF(COUNT(*), 0),
        1
    )                                                                     AS pct_with_uk_sic,
    COUNT(CASE WHEN industry_code_uids LIKE '%us_naics%' THEN 1 END)     AS has_us_naics,
    COUNT(CASE WHEN industry_code_uids LIKE '%eu_nace%' THEN 1 END)      AS has_eu_nace
FROM datascience.open_corporates_standard
WHERE jurisdiction_code LIKE 'gb_%';
```

---

#### Query W-5: Equifax industry code availability — US SIC never used

```sql
-- DATABASE: Redshift
-- What it measures: Equifax records and their SIC/NAICS coverage
-- Confirms: primsic (US SIC 1987) is available but never flows to a stored column
SELECT
    COUNT(*)                                               AS total_efx_records,
    COUNT(CASE WHEN efx_primnaicscode IS NOT NULL
               AND efx_primnaicscode != '' THEN 1 END)    AS has_primary_naics,
    COUNT(CASE WHEN efx_primsic IS NOT NULL
               AND efx_primsic != '' THEN 1 END)          AS has_primary_sic,
    COUNT(CASE WHEN efx_secsic1 IS NOT NULL
               AND efx_secsic1 != '' THEN 1 END)          AS has_secondary_sic_1,
    COUNT(CASE WHEN efx_primnaicscode IS NOT NULL
               AND efx_primsic IS NOT NULL THEN 1 END)    AS has_both_naics_and_sic
FROM datascience.smb_pr_verification_cs
WHERE efx_id IS NOT NULL;
```

---

#### Query W-6: ZoomInfo SIC availability — another unused field

```sql
-- DATABASE: Redshift
-- What it measures: ZoomInfo records and their SIC field population
-- zi_c_sic4 (US SIC 4-digit) is in the type definition and smb_pr_verification_cs
-- but is not mapped to any fact in the fact engine
SELECT
    COUNT(*)                                               AS total_zi_records,
    COUNT(CASE WHEN zi_c_naics6 IS NOT NULL
               AND zi_c_naics6 != '' THEN 1 END)          AS has_naics6,
    COUNT(CASE WHEN zi_c_sic4 IS NOT NULL
               AND zi_c_sic4 != '' THEN 1 END)            AS has_sic4,
    COUNT(CASE WHEN zi_c_sic2 IS NOT NULL
               AND zi_c_sic2 != '' THEN 1 END)            AS has_sic2,
    ROUND(
        100.0 * COUNT(CASE WHEN zi_c_sic4 IS NOT NULL AND zi_c_sic4 != '' THEN 1 END)
            / NULLIF(COUNT(*), 0),
        1
    )                                                      AS pct_with_sic4
FROM datascience.smb_pr_verification_cs
WHERE zi_c_location_id IS NOT NULL;
```

---

#### Query W-7: Top 20 NAICS codes in portfolio — is fallback 561499 dominating?

```sql
-- DATABASE: Redshift
-- What it measures: NAICS code distribution across all businesses in the warehouse
-- Key signal: If 561499 (AI fallback "Administrative Services") is in top 5,
--             it means many businesses couldn't be classified properly
SELECT
    cf.primary_naics_code,
    nc.naics_label                                        AS naics_description,
    COUNT(cf.business_id)                                 AS business_count,
    ROUND(
        100.0 * COUNT(cf.business_id)
            / NULLIF(SUM(COUNT(cf.business_id)) OVER (), 0),
        2
    )                                                     AS pct_of_portfolio,
    CASE WHEN cf.primary_naics_code = 561499
         THEN '⚠️ AI FALLBACK CODE — unknown industry'
         ELSE '' END                                      AS flag
FROM datascience.customer_files cf
LEFT JOIN rds_integration_public.core_naics_code nc
    ON nc.code = cf.primary_naics_code
WHERE cf.primary_naics_code IS NOT NULL
GROUP BY cf.primary_naics_code, nc.naics_label
ORDER BY business_count DESC
LIMIT 20;
```

---

#### Query W-8: Country breakdown — which countries are in the portfolio?

```sql
-- DATABASE: Redshift
-- What it measures: Business count by country, NAICS coverage per country
-- Key signal: UK/CA businesses likely have US NAICS codes (wrong taxonomy)
SELECT
    COALESCE(country, 'UNKNOWN')               AS country,
    COUNT(*)                                   AS total_businesses,
    COUNT(primary_naics_code)                  AS has_naics,
    ROUND(
        100.0 * COUNT(primary_naics_code)
            / NULLIF(COUNT(*), 0),
        1
    )                                          AS pct_with_naics,
    COUNT(mcc_code)                            AS has_mcc
FROM datascience.customer_files
GROUP BY country
ORDER BY total_businesses DESC;
```

---

#### Query W-9: OpenCorporates uk_sic extraction — sample of actual UK SIC codes

```sql
-- DATABASE: Redshift
-- What it measures: Shows actual uk_sic codes available in OC data for GB businesses
-- These are the codes we could store if we fixed Gap 1
SELECT
    oc.company_number,
    oc.normalised_name,
    oc.jurisdiction_code,
    oc.industry_code_uids,
    REGEXP_SUBSTR(oc.industry_code_uids, 'uk_sic-([0-9]+)', 1, 1, 'e') AS uk_sic_code,
    REGEXP_SUBSTR(oc.industry_code_uids, 'us_naics-([0-9]+)', 1, 1, 'e') AS us_naics_from_oc
FROM datascience.open_corporates_standard oc
WHERE oc.jurisdiction_code LIKE 'gb_%'
  AND oc.industry_code_uids LIKE '%uk_sic%'
LIMIT 50;
```

---

#### Query W-10: Warehouse `customer_files` NAICS selection logic — how does it pick?

```sql
-- DATABASE: Redshift
-- This query shows EXACTLY how the warehouse picks primary_naics_code for customer_files
-- It matches the logic in customer_table.sql lines 102-118:
-- COALESCE(
--   CASE WHEN zi_match_confidence > efx_match_confidence
--        THEN CAST(NULLIF(REGEXP_REPLACE(zi_c_naics6, '[^0-9]', ''), '') AS INTEGER)
--        ELSE CAST(NULLIF(REGEXP_REPLACE(efx_primnaicscode, '[^0-9]', ''), '') AS INTEGER)
--   END,
--   naics_code  -- falls back to RDS value from data_businesses
-- ) AS primary_naics_code
SELECT
    smb.business_id,
    smb.zi_match_confidence,
    smb.efx_match_confidence,
    smb.zi_c_naics6,
    smb.efx_primnaicscode,
    -- The warehouse selection logic:
    CASE
        WHEN COALESCE(smb.zi_match_confidence, 0) > COALESCE(smb.efx_match_confidence, 0)
            THEN CAST(NULLIF(REGEXP_REPLACE(smb.zi_c_naics6, '[^0-9]', ''), '') AS INTEGER)
        ELSE CAST(NULLIF(REGEXP_REPLACE(smb.efx_primnaicscode, '[^0-9]', ''), '') AS INTEGER)
    END                         AS warehouse_selected_naics,
    -- What the fact engine stored:
    db.naics_id,
    nc.code                     AS fact_engine_naics_code,
    -- Do they agree?
    CASE
        WHEN CAST(NULLIF(REGEXP_REPLACE(
            CASE
                WHEN COALESCE(smb.zi_match_confidence, 0) > COALESCE(smb.efx_match_confidence, 0)
                    THEN smb.zi_c_naics6
                ELSE smb.efx_primnaicscode
            END,
            '[^0-9]', ''), '') AS INTEGER) = nc.code
        THEN 'AGREE'
        ELSE '⚠️ DISAGREE — warehouse and fact engine picked different NAICS'
    END                         AS agreement_status
FROM datascience.smb_pr_verification_cs smb
LEFT JOIN rds_cases_public.data_businesses db USING (business_id)
LEFT JOIN rds_cases_public.core_naics_code nc ON nc.id = db.naics_id
WHERE smb.zi_c_naics6 IS NOT NULL OR smb.efx_primnaicscode IS NOT NULL
LIMIT 100;
```

> **Important finding:** The warehouse selects `primary_naics_code` using a simple **confidence score comparison between ZoomInfo and Equifax only** (see `customer_table.sql` lines 104–118). It does NOT use OpenCorporates, Trulioo, SERP, or the AI enrichment. This means the warehouse `customer_files.primary_naics_code` may differ from what the fact engine stored in `data_businesses.naics_id`. Query W-10 lets you measure this disagreement.

---

#### Query W-11: Trulioo responses with sicCode — via Redshift RDS mirror

```sql
-- DATABASE: Redshift (using rds_integration_public mirror)
-- What it measures: How many Trulioo responses contain StandardizedIndustries
--                   with a sicCode field?
-- The JSON path checks for the StandardizedIndustries structure
-- NOTE: JSON_EXTRACT_PATH_TEXT works in Redshift for SUPER/JSON columns
-- [VALIDATE: confirm column type — VARCHAR vs SUPER in Redshift]
SELECT
    COUNT(*)                                              AS total_trulioo_records,
    COUNT(
        CASE
            WHEN JSON_EXTRACT_PATH_TEXT(
                response::VARCHAR,
                'clientData', 'serviceData'
            ) LIKE '%StandardizedIndustries%'
            THEN 1
        END
    )                                                     AS has_standardized_industries,
    COUNT(
        CASE
            WHEN response::VARCHAR LIKE '%"SICCode"%'
              OR response::VARCHAR LIKE '%"sicCode"%'
            THEN 1
        END
    )                                                     AS has_sic_code_field
FROM rds_integration_public.request_response
WHERE platform_id = (
    SELECT id FROM rds_integration_public.core_integrations_platforms
    WHERE code ILIKE '%trulioo%'
    LIMIT 1
)
AND request_type = 'fetch_business_entity_verification';
```

---

## PART 8 — THE ALGORITHM: HOW TO SELECT THE CORRECT CODE

### Current Algorithm (As-Built)

The current algorithm is **confidence-first, weight-as-tiebreaker**:

```
1. If manual override exists → use it unconditionally
2. Collect all candidates with valid (non-empty, non-null) values
3. Sort by confidence (dynamic 0–1 score from name/address matching quality)
4. If top two are within 5% → use weight as tiebreaker
5. Return winner
```

### The Warehouse Algorithm (Simpler)

The warehouse `customer_files` table uses a **simpler 2-source comparison**:

```sql
-- From customer_table.sql lines 104-118
CASE WHEN zi_match_confidence > efx_match_confidence
     THEN zi_c_naics6      -- ZoomInfo if better match
     ELSE efx_primnaicscode -- Equifax otherwise
END COALESCED WITH naics_code  -- fallback to fact-engine value
```

### Recommended Improved Algorithm: Country-Aware Classification

**The core problem** with the current algorithm is it applies a US-centric NAICS code to all businesses regardless of country. The improved algorithm should be:

```
Step 1: What country is this business in?

IF country = 'US':
    Run current algorithm (confidence-first from Equifax/ZoomInfo/OC/Trulioo/SERP/AI)
    Store result in data_businesses.naics_id → core_naics_code
    Derive mcc_id via rel_naics_mcc

IF country = 'GB':
    Priority 1: Trulioo .sicCode from StandardizedIndustries (official UK registry source)
    Priority 2: OpenCorporates uk_sic from industry_code_uids (Companies House)
    Priority 3: AI-generated UK SIC (if schema supports it — currently does NOT)
    Store result in data_businesses.uk_sic_id → core_uk_sic_code [DOES NOT EXIST YET]
    Map uk_sic → mcc via a uk_sic_mcc mapping table [DOES NOT EXIST YET]

IF country = 'CA':
    Priority 1: OpenCorporates ca_naics from industry_code_uids
    Priority 2: Trulioo .naicsCode (Canada uses NAICS compatible with US)
    Store result in data_businesses.naics_id → core_naics_code (shared NAICS table works for CA)

IF country = OTHER:
    Best-effort US NAICS via OpenCorporates us_naics approximation
    Flag with low-confidence indicator
```

### Creating a Code When NULL (Enrichment Strategy)

When no source returns a code, the strategy depends on what data is available:

| Data Available | Action | Expected Code Quality |
|---|---|---|
| Website URL known | Run AI enrichment (already implemented) | MED–HIGH for common industries |
| Business name + state only | Run AI with name only | LOW (set confidence = LOW) |
| Tax filings with NAICS | Read `integration_data.tax_filings.naics` | HIGH (IRS-assigned) |
| OpenCorporates match + `industry_code_uids` exists | Parse the correct scheme for country | HIGH (registry-assigned) |
| No data at all | Use 561499 fallback | FALLBACK — flag for manual review |

The **tax filings NAICS** (`integration_data.tax_filings.naics` column, written in `business.ts` line 538) is particularly valuable because it comes from the IRS directly. It is not currently wired into the fact engine.

### Correcting a Wrong Code (Validation Strategy)

A code may be technically valid (exists in `core_naics_code`) but semantically wrong for the business's country. Detection queries:

```sql
-- Redshift: Find UK businesses with US NAICS codes
-- These are technically stored but may be wrong taxonomy
SELECT
    cf.business_id,
    cf.company_name,
    cf.country,
    cf.primary_naics_code,
    oc.industry_code_uids,
    -- Does OC have a uk_sic that we could use instead?
    REGEXP_SUBSTR(oc.industry_code_uids, 'uk_sic-([0-9]+)', 1, 1, 'e') AS correct_uk_sic
FROM datascience.customer_files cf
LEFT JOIN datascience.smb_pr_verification_cs smb USING (business_id)
LEFT JOIN datascience.open_corporates_standard oc
    ON oc.company_number = smb.company_number
    AND oc.jurisdiction_code LIKE 'gb_%'
WHERE cf.country IN ('GB', 'UK', 'GREAT BRITAIN', 'United Kingdom')
  AND cf.primary_naics_code IS NOT NULL
  AND oc.industry_code_uids LIKE '%uk_sic%'
ORDER BY cf.company_name;
-- Result: UK businesses where we have a US NAICS code AND a better UK SIC is available
```

---

## PART 9 — AI ENRICHMENT: COMPLETE ROLE AND LIMITATIONS

### When AI Runs (Exact Logic)

AI runs only when all of these conditions are met:
1. `website` fact has ≥ 1 source
2. `business_name` fact has ≥ 1 source
3. `naics_code` has between 1 and 3 sources (excluding AI itself)
4. `mcc_code` has between 1 and 3 sources (excluding AI itself)

**If `naics_code = 0 sources`:** AI does NOT run. This prevents AI from guessing with no signal.
**If `naics_code ≥ 4 sources`:** AI does NOT run. Already well-covered.

### AI's Role in the Algorithm

```
AI is a "gap-filler" not a "winner-picker":
- It competes with weight 0.1 — the lowest of all sources
- Any vendor source with sufficient confidence will outrank it
- It provides a fallback when live sources fail or return no data
- Its output is validated against core_naics_code before storage
- Invalid AI codes → replaced with 561499
```

### AI Limitations for Non-US Businesses

1. **Prompt is US-centric:** The system prompt asks only for US NAICS 2022 and MCC. No mention of country, no request for UK SIC, CA NAICS, or any other standard.
2. **Zod schema strips non-US codes:** Even if the AI were prompted to return `uk_sic_code`, the current Zod schema would silently discard it.
3. **No country awareness:** The AI receives `business_name`, `website`, `dba`, `naics_code` (if available) — but NOT the country. A UK business and a US business get the same prompt.

### What Needs to Change for Non-US AI Enrichment

```typescript
// Current system prompt (aiNaicsEnrichment.ts lines 100-109):
const systemPrompt = `You are a helpful assistant that determines:
1) 6 digit North American Industry Classification System (NAICS) codes as of the 2022 edition.
2) The canonical description of the NAICS Code.
3) The 4 digit Merchant Category Code (MCC)
4) The canonical description of the MCC Code.
...`;

// Needed for UK support — ADD to system prompt:
// "5) If the business is in the United Kingdom (country = GB):
//    Also determine the UK SIC 2007 5-digit code (from Companies House classification).
//    Return it as uk_sic_code.
//    Return the UK SIC description as uk_sic_description."

// Needed: Add to naicsEnrichmentResponseSchema:
// uk_sic_code: z.string().optional(),
// uk_sic_description: z.string().optional()

// Needed: Add country to the params passed to getPrompt():
// Currently params includes: website, business_name, dba, naics_code, mcc_code, corporation
// Must add: address_country (so AI knows whether to return uk_sic_code)
```

---

## PART 10 — THE 4 GAPS WHERE UK SIC IS SILENTLY DROPPED

### Gap 1: OpenCorporates `naics_code` Resolver

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 283-297
fn: (_, oc: OpenCorporateResponse) => {
    if (!oc.firmographic?.industry_code_uids) return Promise.resolve(undefined);
    for (const industryCodeUid of oc.firmographic.industry_code_uids.split("|")) {
        const [codeName, industryCode] = industryCodeUid.split("-", 2);
        if (
            codeName?.includes("us_naics") &&  // ← ONLY US_NAICS PASSES
            industryCode && isFinite(parseInt(industryCode)) && industryCode.length === 6
        ) {
            return Promise.resolve(industryCode);
        }
    }
    return Promise.resolve(undefined);  // uk_sic, ca_naics, eu_nace all fall through to here
}
```

**Fix:** Add a new `uk_sic_code` fact with a parallel fn that matches `codeName?.includes("uk_sic")` and validates the 5-character UK SIC format.

### Gap 2: Trulioo `.sicCode` Never Read

```typescript
// integration-service/lib/facts/businessDetails/index.ts  lines 300-309
fn: async (_, truliooResponse: any) => {
    if (!truliooResponse?.clientData) return undefined;
    return extractStandardizedIndustriesFromTruliooResponse(truliooResponse.clientData)
        ?.find((i: any) => i.naicsCode && /^\d{6}$/.test(i.naicsCode))
        ?.naicsCode;
    // The same object has .sicCode — never accessed
}
```

**Fix:** Add a second source entry for `uk_sic_code` using `sources.business` that reads `.sicCode` (gated on country = GB).

### Gap 3: AI Zod Schema Has No `uk_sic_code`

```typescript
// integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts  lines 22-35
const naicsEnrichmentResponseSchema = z.object({
    reasoning: z.string(),
    naics_code: z.string(),
    // ... 10 more fields ...
    // NO uk_sic_code
    // NO uk_sic_description
});
```

**Fix:** Add `uk_sic_code: z.string().optional()` and `uk_sic_description: z.string().optional()`.

### Gap 4: No Database Column for UK SIC

```sql
-- case-service/db/migrations/migrate/sqls/20240926041144-add-naics-mcc-code-data-business-up.sql
ALTER TABLE public.data_businesses ADD mcc_id int NULL;
ALTER TABLE public.data_businesses ADD naics_id int NULL;
-- NO uk_sic_id has ever been added
```

**Fix:**
```sql
-- New migration needed in case-service:
CREATE TABLE public.core_uk_sic_code (
    id INT GENERATED ALWAYS AS IDENTITY NOT NULL,
    code VARCHAR(10) NOT NULL,   -- 5-char code, e.g., "62012"
    label VARCHAR(500) NOT NULL,
    section VARCHAR(1),          -- UK SIC 2007 section letter (A-U)
    division VARCHAR(2),         -- 2-digit division
    CONSTRAINT core_uk_sic_code_pk PRIMARY KEY (id),
    CONSTRAINT core_uk_sic_code_unique UNIQUE (code)
);
-- Seed with ~731 UK SIC 2007 codes from Companies House
-- Source: https://resources.companieshouse.gov.uk/sic/

ALTER TABLE public.data_businesses ADD COLUMN uk_sic_id INT NULL;
ALTER TABLE public.data_businesses ADD CONSTRAINT data_businesses_core_uk_sic_code_fk
    FOREIGN KEY (uk_sic_id) REFERENCES public.core_uk_sic_code(id);
```

---

## PART 11 — COMPLETE SOURCE + CODE MATRIX

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║ INTEGRATION PARTNER │ TYPE   │ US NAICS │ US SIC │ UK SIC │ CA NAICS │ MCC    ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ Equifax             │ FILE   │ ✅ USED  │ ⚠️ AVA │ ❌ N/A  │ ❌ N/A   │ ❌ N/A ║
║                     │        │ (prim+4  │ ILABLE │         │          │        ║
║                     │        │ sec, 6d) │ NOT    │         │          │        ║
║                     │        │          │ USED   │         │          │        ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ ZoomInfo            │ API    │ ✅ USED  │ ⚠️ AVA │ ❌ N/A  │ ❌ N/A   │ ❌ N/A ║
║                     │        │ (6d)     │ ILABLE │         │          │        ║
║                     │        │          │ NOT    │         │          │        ║
║                     │        │          │ USED   │         │          │        ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ OpenCorporates      │ API    │ ✅ USED  │ ❌ N/A │ ⚠️ AVA  │ ⚠️ AVAIL │ ❌ N/A ║
║                     │        │ (6d, from│        │ ILABLE  │ ABLE NOT │        ║
║                     │        │ uid)     │        │ NOT     │ USED     │        ║
║                     │        │          │        │ USED    │          │        ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ Trulioo             │ API    │ ✅ USED  │ ❌ N/A │ ⚠️ AVA  │ ✅ NAICS  │ ❌ N/A ║
║                     │        │ (.naics  │ (US    │ ILABLE  │ for CA   │        ║
║                     │        │ Code,6d) │ SIC    │ NOT     │ (same    │        ║
║                     │        │          │ never  │ USED    │ field)   │        ║
║                     │        │          │ touched│ (sic    │          │        ║
║                     │        │          │ for US)│ Code)   │          │        ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ SERP Scrape         │ API    │ ✅ USED  │ ❌ N/A │ ❌ N/A  │ ❌ N/A   │ ❌ N/A ║
║                     │        │ (6d,     │        │         │          │        ║
║                     │        │ wt=0.3)  │        │         │          │        ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ Customer-submitted  │ INT'L  │ ✅ USED  │ ❌ N/A │ ❌ N/A  │ ❌ N/A   │ ❌ N/A ║
║ (businessDetails)   │        │ (6d,     │        │         │          │        ║
║                     │        │ wt=0.2)  │        │         │          │        ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ AI (GPT-5 mini)     │ AI     │ ✅ USED  │ ❌ N/A │ ❌ MISS │ ❌ MISS  │ ✅ USED ║
║                     │        │ (6d,     │        │ ING     │ ING      │ (direct║
║                     │        │ wt=0.1)  │        │ FROM    │ FROM     │ from   ║
║                     │        │          │        │ SCHEMA  │ SCHEMA   │ AI)    ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║ Tax Filings (IRS)   │ API    │ ⚠️ AVAIL │ ❌ N/A │ ❌ N/A  │ ❌ N/A   │ ❌ N/A ║
║                     │        │ ABLE NOT │        │         │          │        ║
║                     │        │ WIRED TO │        │         │          │        ║
║                     │        │ FACT ENG.│        │         │          │        ║
╚══════════════════════════════════════════════════════════════════════════════════╝

Legend:
✅ USED = Wired to a fact, stored in database
⚠️ AVAILABLE = Present in raw data but not consumed by any fact
❌ N/A = Source does not provide this code type
❌ MISSING FROM SCHEMA = No DB column or Zod schema field exists
```

---

## PART 12 — OPEN QUESTIONS REQUIRING PRODUCTION VALIDATION

| # | Question | How to Validate | Impact if Wrong |
|---|---|---|---|
| 1 | What is the exact platform_id for Trulioo in `core_integrations_platforms`? | `SELECT id, code FROM integrations.core_integrations_platforms WHERE code ILIKE '%trulioo%'` on integration-service DB | Queries W-3, W-11 will return wrong results |
| 2 | What is the exact platform_id for OpenCorporates? | Same table, `WHERE code ILIKE '%opencorporates%'` | Queries using OC platform_id will fail |
| 3 | Is `integration_data.tax_filings.naics` populated in production? | `SELECT COUNT(*), COUNT(naics) FROM integration_data.tax_filings` | Could be a high-quality free NAICS source |
| 4 | Are facts persisted back to `request_response` (stored fact pattern)? | `SELECT DISTINCT request_type FROM integration_data.request_response ORDER BY 1` | Changes how to query for resolved `classification_codes` |
| 5 | Does the Redshift `rds_integration_public.request_response` mirror contain the `response` column as VARCHAR or SUPER? | `SELECT column_name, data_type FROM svv_columns WHERE table_name = 'request_response' AND schema_name = 'rds_integration_public'` | JSON extraction syntax in W-11 may need adjustment |
| 6 | What does `extractStandardizedIndustriesFromTruliooResponse` actually return for UK businesses in production? | Sample 5 Trulioo responses for GB businesses and inspect `StandardizedIndustries` | Tells us if sicCode is actually populated |
| 7 | Does the Warehouse `open_corporate.companies` table actually contain `industry_code_uids` with `uk_sic` data? | `SELECT industry_code_uids FROM open_corporate.companies WHERE jurisdiction_code LIKE 'gb_%' AND industry_code_uids LIKE '%uk_sic%' LIMIT 10` | Determines if OC is viable uk_sic source |
| 8 | Is the `classification_codes` fact computed and emitted on the Kafka facts.v1 topic today? | Check Kafka fact payloads for `classification_codes` key | If not computed, Phase 1 requires triggering fact recomputation |
| 9 | Is the AI `confidence` field ("HIGH"/"MED"/"LOW") correctly handled as numeric in `factWithHighestConfidence`? | Add a unit test: AI candidate with "HIGH" vs ZoomInfo candidate with 0.8 numeric — which wins? | Potential bug: string vs number comparison in JavaScript |
| 10 | How many `data_businesses` records have `naics_id IS NULL` in production? | Query 1 in Section 7 of the original report (case-service DB) | Baseline for measuring improvement |

---

## PART 13 — SUMMARY TABLE: QUESTIONS AND ANSWERS

| Question | Short Answer | Key Evidence |
|---|---|---|
| Which partners provide industry codes? | 8 total: Equifax, ZoomInfo, OpenCorporates, Trulioo, SERP, Customer, AI, Tax Filings | `sources.ts`, `businessDetails/index.ts`, `business.ts` |
| Which are file vs API? | Equifax = file/batch; all others = live API or internal | `sources.ts` comment line 315: "unknown cadence" |
| What codes do we actually get? | US NAICS 6-digit (all), US SIC 4-digit (Equifax/ZoomInfo, unused), UK SIC 5-digit (OC/Trulioo, unused), CA NAICS (OC, unused), MCC 4-digit (AI only direct) | `zoominfo/types.ts`, `opencorporates/types.ts`, `trulioo/common/utils.ts` |
| How do we choose the correct code? | confidence-first → weight-as-tiebreaker → manualOverride always wins | `rules.ts`, `factEngine.ts` |
| How do we create one if NULL? | AI enrichment (GPT-5 mini, weight 0.1), validated vs core_naics_code, fallback 561499 | `aiNaicsEnrichment.ts` |
| What do Trulioo's codes represent? | `.naicsCode` = US NAICS 6-digit; `.sicCode` = 4-digit US SIC (US businesses) or 5-digit UK SIC 2007 (UK businesses) | `trulioo/common/utils.ts` lines 900–905 |
| Best algorithm for selecting between sources? | Country-aware: US→use current confidence/weight algorithm; GB→prefer Trulioo `sicCode` then OC `uk_sic`; CA→NAICS same as US | This report Part 8 |
