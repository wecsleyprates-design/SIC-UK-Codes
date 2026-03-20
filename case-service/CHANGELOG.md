## [v0.59.0-hotfix-v2.0](https://github.com/joinworth/case-service/compare/v0.59.2...v0.59.0-hotfix-v2.0) - 2026-01-21


### 🐛 Bug

**[DOS-1088](https://worth-ai.atlassian.net/browse/DOS-1088) - Edit Application redirects to Thank You page instead of Review Summary (for some onboarded cases)**
  - 🚜🚀 #LIVE fix: fix infinite loader and redirect applicant webapp bugs #REGULAR (Original PR: [#1831](https://github.com/joinworth/case-service/pull/1831)) ([#1832](https://github.com/joinworth/case-service/pull/1832)) 🚂 release/v0.59.0-hotfix-v2



## [v0.59.2](https://github.com/joinworth/case-service/compare/v0.58.2...v0.59.2) - 2026-01-20


### 📖 Story

**[DOS-1003](https://worth-ai.atlassian.net/browse/DOS-1003) - Implement Stripe Embedded RFI Component in Worth Frontend**
  - 🚜🚀 Add RFI onboarding stage as post-submission landing page #LIVE #REGULAR (Original PR: [#1807](https://github.com/joinworth/case-service/pull/1807)) ([#1823](https://github.com/joinworth/case-service/pull/1823)) 🚂 release/v0.59.0


### 💻 Tech Task

**[BEST-280](https://worth-ai.atlassian.net/browse/BEST-280) - Update Adverse Media Prompt**
  - 🚜🚀 send city/state in Kafka events #LIVE #REGULAR (Original PR: [#1806](https://github.com/joinworth/case-service/pull/1806)) ([#1821](https://github.com/joinworth/case-service/pull/1821)) 🚂 release/v0.59.0


### 📝 Other

  - 🚜🚀 #NO_JIRA: fix: cherry-pick issues #LIVE #REGULAR ([#1826](https://github.com/joinworth/case-service/pull/1826))
  - 🚜🚀 #NO_JIRA: fix: build issue #LIVE #REGULAR ([#1825](https://github.com/joinworth/case-service/pull/1825))



## [v0.58.2](https://github.com/joinworth/case-service/compare/v0.58.1...v0.58.2) - 2026-01-13


### ✨ Enhancement

**[DOS-1032](https://worth-ai.atlassian.net/browse/DOS-1032) - Additional Banking Fields**
  - 🚜🚀 Adds additional banking fields for Stipe #LIVE #REGULAR (Original PR: [#1789](https://github.com/joinworth/case-service/pull/1789)) ([#1812](https://github.com/joinworth/case-service/pull/1812)) 🚂 release/v0.58.0



## [v0.58.1](https://github.com/joinworth/case-service/compare/v0.58.0-fast-v1.0...v0.58.1) - 2026-01-07


### 📖 Story

**[BEST-256](https://worth-ai.atlassian.net/browse/BEST-256) - Enhance GET Case Details Response – Missing Details Object**
  - 🚜🚀🚩 Add missing fields #LIVE #FLAG #REGULAR (Original PR: [#1776](https://github.com/joinworth/case-service/pull/1776)) ([#1802](https://github.com/joinworth/case-service/pull/1802)) 🚂 release/v0.58.0

**[PAT-970](https://worth-ai.atlassian.net/browse/PAT-970) - Allow Customer to Define Business-Level Aging Attributes (Override Default Aging Settings)**
  - 🚜🚀 Business Level Aging Updates #LIVE #REGULAR (Original PR: [#1786](https://github.com/joinworth/case-service/pull/1786)) ([#1801](https://github.com/joinworth/case-service/pull/1801)) 🚂 release/v0.58.0
  - 🚜🚀 Cron Updates and Unique Key updates #LIVE #REGULAR (Original PR: [#1788](https://github.com/joinworth/case-service/pull/1788)) ([#1803](https://github.com/joinworth/case-service/pull/1803)) 🚂 release/v0.58.0

**[PAT-999](https://worth-ai.atlassian.net/browse/PAT-999) - [FAST TRACK] [PENTESTING]  IDOR in standalone case endpoint allows cross-tenant case data disclosure**
  - 🚜🚀 Adding new checks to prevent unauthorized case access #LIVE #REGULAR (Original PR: [#1790](https://github.com/joinworth/case-service/pull/1790)) #REGULAR (Original PR: [#1794](https://github.com/joinworth/case-service/pull/1794)) ([#1799](https://github.com/joinworth/case-service/pull/1799)) 🚂 release/v0.58.0-fast-v1


### 🧰 Task

**[INFRA-261](https://worth-ai.atlassian.net/browse/INFRA-261) - Add trace-id tags to datadog logs**
  - 🚜🚀 #LIVE datadog tracing #REGULAR (Original PR: [#1768](https://github.com/joinworth/case-service/pull/1768)) ([#1800](https://github.com/joinworth/case-service/pull/1800)) 🚂 release/v0.58.0


### 🐛 Bug

**[BEST-252](https://worth-ai.atlassian.net/browse/BEST-252) - SSNs are not masked in the DB**
  - 🚜🚀 Encrypt SSN while sending to notification and from logger #LIVE #REGULAR (Original PR: [#1778](https://github.com/joinworth/case-service/pull/1778)) ([#1804](https://github.com/joinworth/case-service/pull/1804)) 🚂 release/v0.58.0



## [v0.58.0-fast-v1.0](https://github.com/joinworth/case-service/compare/v0.57.2...v0.58.0-fast-v1.0) - 2025-12-31


### 📖 Story

**[PAT-999](https://worth-ai.atlassian.net/browse/PAT-999) - [FAST TRACK] [PENTESTING]  IDOR in standalone case endpoint allows cross-tenant case data disclosure**
  - 🚜🚀 Adding new checks to prevent unauthorized case access #LIVE #REGULAR (Original PR: [#1790](https://github.com/joinworth/case-service/pull/1790)) ([#1794](https://github.com/joinworth/case-service/pull/1794)) 🚂 release/v0.58.0-fast-v1



## [v0.57.2](https://github.com/joinworth/case-service/compare/v0.56.3...v0.57.2) - 2025-12-30


### 📖 Story

**[BEST-221](https://worth-ai.atlassian.net/browse/BEST-221) - Allow Customer to Define Business-Level Aging Attributes (Override Default Aging Settings)**
  - 🚜🚀 Update schema into add business end point #LIVE #REGULAR (Original PR: [#1785](https://github.com/joinworth/case-service/pull/1785)) ([#1787](https://github.com/joinworth/case-service/pull/1787)) 🚂 release/v0.57.0
  - 🚜🚀 Enable functionality for Aging config in create or update Business #LIVE #REGULAR (Original PR: [#1733](https://github.com/joinworth/case-service/pull/1733)) ([#1782](https://github.com/joinworth/case-service/pull/1782)) 🚂 release/v0.57.0
  - 🚜🚀 Added Limit on threshold Days #LIVE #REGULAR (Original PR: [#1764](https://github.com/joinworth/case-service/pull/1764)) ([#1783](https://github.com/joinworth/case-service/pull/1783)) 🚂 release/v0.57.0

**[BEST-261](https://worth-ai.atlassian.net/browse/BEST-261) - Include Merchant Profile Object in GET Case Details Endpoint**
  - 🚜🚀 #LIVE Added Merchant Profile To GetCases Route #REGULAR (Original PR: [#1760](https://github.com/joinworth/case-service/pull/1760)) ([#1779](https://github.com/joinworth/case-service/pull/1779)) 🚂 release/v0.57.0


### 🧰 Task

**[INFRA-261](https://worth-ai.atlassian.net/browse/INFRA-261) - Add trace-id tags to datadog logs**
  - 🚜🚀 #LIVE fix kafka message validation for routing #REGULAR (Original PR: [#1771](https://github.com/joinworth/case-service/pull/1771)) ([#1781](https://github.com/joinworth/case-service/pull/1781)) 🚂 release/v0.57.0


### ✨ Enhancement

**[PAT-984](https://worth-ai.atlassian.net/browse/PAT-984) - [FLAG] Customize Aging Thresholds Webhook Messages**
  - 🚜🚀 Customize Aging Message Bug #LIVE #REGULAR (Original PR: [#1777](https://github.com/joinworth/case-service/pull/1777)) ([#1784](https://github.com/joinworth/case-service/pull/1784)) 🚂 release/v0.57.0


### 📝 Other

**[FOTC-121](https://worth-ai.atlassian.net/browse/FOTC-121) - No title available**
  - 🚜🚀 #LIVE Add unified search endpoint for customer businesses #REGULAR (Original PR: [#1750](https://github.com/joinworth/case-service/pull/1750)) ([#1780](https://github.com/joinworth/case-service/pull/1780)) 🚂 release/v0.57.0



## [v0.56.3](https://github.com/joinworth/case-service/compare/v0.56.0...v0.56.3) - 2025-12-16

### 📖 Story

**[DOS-77](https://worth-ai.atlassian.net/browse/DOS-77) - Let's Get Started Page Updates**

- 🚜🚀 update prefill business data and get started stage completion #LIVE #REGULAR (Original PR: [#1684](https://github.com/joinworth/case-service/pull/1684)) ([#1767](https://github.com/joinworth/case-service/pull/1767)) 🚂 release/v0.56.0

### 🧰 Task

**[BTTF-209](https://worth-ai.atlassian.net/browse/BTTF-209) - [BE] Send integration status to progression API**

- 🚜🚀 #LIVE Send integration status to progression API #REGULAR (Original PR: [#1765](https://github.com/joinworth/case-service/pull/1765)) ([#1773](https://github.com/joinworth/case-service/pull/1773)) 🚂 release/v0.56.0
- 🚜🚀 Send integration status to progression API #LIVE #REGULAR (Original PR: [#1763](https://github.com/joinworth/case-service/pull/1763)) ([#1772](https://github.com/joinworth/case-service/pull/1772)) 🚂 release/v0.56.0

### 🐛 Bug

**[PAT-950](https://worth-ai.atlassian.net/browse/PAT-950) - Hide NPI Numbers on International Onboarding**

- 🚜🚀 #LIVE fix: npi setting requirement/visibility #REGULAR (Original PR: [#1762](https://github.com/joinworth/case-service/pull/1762)) ([#1770](https://github.com/joinworth/case-service/pull/1770)) 🚂 release/v0.56.0

### ✨ Enhancement

**[DOS-931](https://worth-ai.atlassian.net/browse/DOS-931) - Update Progression API to Support Navigation to Let's Get Started Page**

- 🚜🚀 allow back navigation to get started #LIVE #REGULAR (Original PR: [#1683](https://github.com/joinworth/case-service/pull/1683)) ([#1766](https://github.com/joinworth/case-service/pull/1766)) 🚂 release/v0.56.0

**[PAT-826](https://worth-ai.atlassian.net/browse/PAT-826) - Add Permission to Assign Cases**

- 🚜🚀 #LIVE feat: case assignment permission #REGULAR (Original PR: [#1743](https://github.com/joinworth/case-service/pull/1743)) ([#1769](https://github.com/joinworth/case-service/pull/1769)) 🚂 release/v0.56.0

## [v0.56.0](https://github.com/joinworth/case-service/compare/v0.56.0-fast-v1.1...v0.56.0) - 2025-12-09

### 📖 Story

**[PAT-952](https://worth-ai.atlassian.net/browse/PAT-952) - [FAST TRACK] Aging Thresholds**

- 🚜🚀 Aging Thresholds #LIVE #REGULAR (Original PR: [#1726](https://github.com/joinworth/case-service/pull/1726)) ([#1744](https://github.com/joinworth/case-service/pull/1744)) 🚂 release/v0.56.0
- 🚜🚀 Cron Job Schedule update for Aging Threshold #LIVE #REGULAR (Original PR: [#1729](https://github.com/joinworth/case-service/pull/1729)) ([#1745](https://github.com/joinworth/case-service/pull/1745)) 🚂 release/v0.56.0
- 🚜🚀 Case Details Sync #LIVE #REGULAR (Original PR: [#1739](https://github.com/joinworth/case-service/pull/1739)) ([#1747](https://github.com/joinworth/case-service/pull/1747)) 🚂 release/v0.56.0

**[PAT-961](https://worth-ai.atlassian.net/browse/PAT-961) - [FAST TRACK] [FLAG] Display When Integrations Are Running in CM**

- 🚜🚀 Integrations Completion #LIVE #REGULAR (Original PR: [#1725](https://github.com/joinworth/case-service/pull/1725)) ([#1755](https://github.com/joinworth/case-service/pull/1755)) 🚂 release/v0.56.0
- 🚜🚀 Missing Unique Constraint Part 2 #LIVE #REGULAR (Original PR: [#1728](https://github.com/joinworth/case-service/pull/1728)) ([#1756](https://github.com/joinworth/case-service/pull/1756)) 🚂 release/v0.56.0
- 🚜🚀 Migration + QA fixes #LIVE #REGULAR (Original PR: [#1731](https://github.com/joinworth/case-service/pull/1731)) ([#1757](https://github.com/joinworth/case-service/pull/1757)) 🚂 release/v0.56.0
- 🚜🚀 Proesssing stuck issue #LIVE #REGULAR (Original PR: [#1748](https://github.com/joinworth/case-service/pull/1748)) ([#1758](https://github.com/joinworth/case-service/pull/1758)) 🚂 release/v0.56.0

### ✨ Enhancement

**[DOS-996](https://worth-ai.atlassian.net/browse/DOS-996) - [FAST TRACK] Update Business Registration Naming and Error Logic**

- 🚜🚀 Implement country-based Tax ID validations (TIN/BRN/CRN) #LIVE #REGULAR (Original PR: [#1727](https://github.com/joinworth/case-service/pull/1727)) ([#1735](https://github.com/joinworth/case-service/pull/1735)) 🚂 release/v0.56.0
- 🚜🚀 Removed Canada BN Validation #LIVE #REGULAR (Original PR: [#1730](https://github.com/joinworth/case-service/pull/1730)) ([#1737](https://github.com/joinworth/case-service/pull/1737)) 🚂 release/v0.56.0

## [v0.56.0-fast-v1.1](https://github.com/joinworth/case-service/compare/v0.56.0-fast-v1.0...v0.56.0-fast-v1.1) - 2025-12-05

### 📖 Story

**[PAT-952](https://worth-ai.atlassian.net/browse/PAT-952) - [FAST TRACK] Aging Thresholds**

- 🚜🚀 Aging Thresholds #LIVE #REGULAR (Original PR: [#1726](https://github.com/joinworth/case-service/pull/1726)) ([#1740](https://github.com/joinworth/case-service/pull/1740)) 🚂 release/v0.56.0-fast-v1
- 🚜🚀 Cron Job Schedule update for Aging Threshold #LIVE #REGULAR (Original PR: [#1729](https://github.com/joinworth/case-service/pull/1729)) ([#1741](https://github.com/joinworth/case-service/pull/1741)) 🚂 release/v0.56.0-fast-v1
- 🚜🚀 Case Details Sync #LIVE #REGULAR (Original PR: [#1739](https://github.com/joinworth/case-service/pull/1739)) ([#1742](https://github.com/joinworth/case-service/pull/1742)) 🚂 release/v0.56.0-fast-v1

## [v0.55.5](https://github.com/joinworth/case-service/compare/v0.55.2...v0.55.5) - 2025-12-03

### 📖 Story

**[BEST-205](https://worth-ai.atlassian.net/browse/BEST-205) - New Webhook – Applicant Reminders**

- 🚜🚀 Applicant reminder Webhook #LIVE #REGULAR (Original PR: [#1706](https://github.com/joinworth/case-service/pull/1706)) ([#1721](https://github.com/joinworth/case-service/pull/1721)) 🚂 release/v0.55.0

**[BEST-206](https://worth-ai.atlassian.net/browse/BEST-206) - Enhance GET Case Details Response – Aging Data Object**

- 🚜🚀 Applicant Aging Data in Case Details #LIVE #REGULAR (Original PR: [#1709](https://github.com/joinworth/case-service/pull/1709)) ([#1720](https://github.com/joinworth/case-service/pull/1720)) 🚂 release/v0.55.0

**[PAT-936](https://worth-ai.atlassian.net/browse/PAT-936) - [FAST TRACK] [FLAG] Reporting & Analytics in Dashboard/Case Management**

- 🚜🚩 Reporting And Analytics #FLAG #REGULAR (Original PR: [#1718](https://github.com/joinworth/case-service/pull/1718)) ([#1724](https://github.com/joinworth/case-service/pull/1724)) 🚂 release/v0.55.0

### 🐛 Bug

**[BTTF-185](https://worth-ai.atlassian.net/browse/BTTF-185) - [BE] Include Trulioo in kafka**

- 🚜🚀 Add internal route for countries#LIVE #REGULAR (Original PR: [#1713](https://github.com/joinworth/case-service/pull/1713)) ([#1715](https://github.com/joinworth/case-service/pull/1715)) 🚂 release/v0.55.0

**[PAT-640](https://worth-ai.atlassian.net/browse/PAT-640) - Hide US Only Features on International Onboarding Flows**

- 🚜🚀 #LIVE fix: ssn required logic #REGULAR (Original PR: [#1686](https://github.com/joinworth/case-service/pull/1686)) ([#1723](https://github.com/joinworth/case-service/pull/1723)) 🚂 release/v0.55.0

### ✨ Enhancement

**[PAT-823](https://worth-ai.atlassian.net/browse/PAT-823) - Add Permission for SSN**

- 🚜🚀 #LIVE feat: ssn data visibility #REGULAR (Original PR: [#1698](https://github.com/joinworth/case-service/pull/1698)) ([#1722](https://github.com/joinworth/case-service/pull/1722)) 🚂 release/v0.55.0

### 💻 Tech Task

**[DOS-978](https://worth-ai.atlassian.net/browse/DOS-978) - Refactor Rate Limiter Middleware to Reuse a Singleton Redis Client (Eliminate Per-Request Connections)**

- 🚜🚀 fix: Refactor rate limiter #LIVE #REGULAR (Original PR: [#1669](https://github.com/joinworth/case-service/pull/1669)) ([#1719](https://github.com/joinworth/case-service/pull/1719)) 🚂 release/v0.55.0

## [v0.55.2](https://github.com/joinworth/case-service/compare/v0.55.0-fast-v1.0...v0.55.2) - 2025-11-25

### 📖 Story

**[PAT-18](https://worth-ai.atlassian.net/browse/PAT-18) - [BE] Implement case events**

- 🚜🚀 #LIVE feat: case.created event and payload update for case.status_updated event #REGULAR (Original PR: [#1667](https://github.com/joinworth/case-service/pull/1667)) ([#1693](https://github.com/joinworth/case-service/pull/1693)) 🚂 release/v0.55.0

### 🐛 Bug

**[DOS-975](https://worth-ai.atlassian.net/browse/DOS-975) - [CUSTOM FIELDS] Customer Access Field Bugs**

- 🚜🚀 Trimmed keys while converting CSV to JSON for custom fields. #LIVE #REGULAR (Original PR: [#1682](https://github.com/joinworth/case-service/pull/1682)) ([#1694](https://github.com/joinworth/case-service/pull/1694)) 🚂 release/v0.55.0

**[PAT-919](https://worth-ai.atlassian.net/browse/PAT-919) - Custom Fields Not Visible in Case 2.0 + Application Not Submittable During Edit Application**

- 🚜🚀 Custom Fields Not Storing #LIVE #REGULAR (Original PR: [#1663](https://github.com/joinworth/case-service/pull/1663)) ([#1695](https://github.com/joinworth/case-service/pull/1695)) 🚂 release/v0.55.0

### ✨ Enhancement

**[DOS-986](https://worth-ai.atlassian.net/browse/DOS-986) - [FAST TRACK] Allow case_id to be passed in request body of send business invite endpoint**

- 🚜🚀 Added case_id in invite business function #LIVE #REGULAR (Original PR: [#1691](https://github.com/joinworth/case-service/pull/1691)) ([#1707](https://github.com/joinworth/case-service/pull/1707)) 🚂 release/v0.55.0

**[DOS-987](https://worth-ai.atlassian.net/browse/DOS-987) - [FAST TRACK] Create Applicants as Owners on Add Business Endpoint**

- 🚜🚀 #LIVE create applicants as owners and return invite link for add business #REGULAR (Original PR: [#1692](https://github.com/joinworth/case-service/pull/1692)) ([#1708](https://github.com/joinworth/case-service/pull/1708)) 🚂 release/v0.55.0

**[PAT-926](https://worth-ai.atlassian.net/browse/PAT-926) - [FAST TRACK] [FLAG] Pause Decisioning Until Application Submission + New Case Statuses**

- 🚜🚀 Part 1 Case Status and Customer Initiated Migrations #LIVE #REGULAR (Original PR: [#1673](https://github.com/joinworth/case-service/pull/1673)) ([#1699](https://github.com/joinworth/case-service/pull/1699)) 🚂 release/v0.55.0
- 🚜🚩 Pause Decisioning #FLAG #REGULAR (Original PR: [#1646](https://github.com/joinworth/case-service/pull/1646)) ([#1700](https://github.com/joinworth/case-service/pull/1700)) 🚂 release/v0.55.0
- 🚜🚩 Regular Invite #FLAG #REGULAR (Original PR: [#1689](https://github.com/joinworth/case-service/pull/1689)) ([#1701](https://github.com/joinworth/case-service/pull/1701)) 🚂 release/v0.55.0

**[PAT-941](https://worth-ai.atlassian.net/browse/PAT-941) - Cache Invalidation for Facts (PAT-902 Follow Up)**

- 🚜🚀 #LIVE feat: invalidate facts api cache #REGULAR (Original PR: [#1662](https://github.com/joinworth/case-service/pull/1662)) ([#1696](https://github.com/joinworth/case-service/pull/1696)) 🚂 release/v0.55.0
- 🚜🚀 #LIVE fix: update naics mcc logic #REGULAR (Original PR: [#1687](https://github.com/joinworth/case-service/pull/1687)) ([#1697](https://github.com/joinworth/case-service/pull/1697)) 🚂 release/v0.55.0

### 💻 Tech Task

**[BEST-116](https://worth-ai.atlassian.net/browse/BEST-116) - BEST-116 Explicit ID Match**

- 🚜🚀 #LIVE Explicit ID Match - Canada Open #REGULAR (Original PR: [#1640](https://github.com/joinworth/case-service/pull/1640)) ([#1690](https://github.com/joinworth/case-service/pull/1690)) 🚂 release/v0.55.0

## [v0.55.0-fast-v1.0](https://github.com/joinworth/case-service/compare/v0.54.6...v0.55.0-fast-v1.0) - 2025-11-21

### ✨ Enhancement

**[PAT-926](https://worth-ai.atlassian.net/browse/PAT-926) - [FAST TRACK] [FLAG] Pause Decisioning Until Application Submission + New Case Statuses**

- 🚜🚀 Part 1 Case Status and Customer Initiated Migrations #LIVE #REGULAR (Original PR: [#1673](https://github.com/joinworth/case-service/pull/1673)) ([#1702](https://github.com/joinworth/case-service/pull/1702)) 🚂 release/v0.55.0-fast-v1
- 🚜🚩 Pause Decisioning #FLAG #REGULAR (Original PR: [#1646](https://github.com/joinworth/case-service/pull/1646)) ([#1703](https://github.com/joinworth/case-service/pull/1703)) 🚂 release/v0.55.0-fast-v1
- 🚜🚩 Regular Invite #FLAG #REGULAR (Original PR: [#1689](https://github.com/joinworth/case-service/pull/1689)) ([#1704](https://github.com/joinworth/case-service/pull/1704)) 🚂 release/v0.55.0-fast-v1

## [v0.54.6](https://github.com/joinworth/case-service/compare/v0.54.0-fast-v2.3...v0.54.6) - 2025-11-19

### 📖 Story

**[FOTC-131](https://worth-ai.atlassian.net/browse/FOTC-131) - [BE] Remove 2 min delay**

- 🚜🚀 #LIVE Revert PR #1595 #REGULAR (Original PR: [#1644](https://github.com/joinworth/case-service/pull/1644)) ([#1659](https://github.com/joinworth/case-service/pull/1659)) 🚂 release/v0.54.0
- 🚜🚩 #FLAG decisioning actions with workflows validation #REGULAR (Original PR: [#1657](https://github.com/joinworth/case-service/pull/1657)) ([#1660](https://github.com/joinworth/case-service/pull/1660)) 🚂 release/v0.54.0

**[PAT-902](https://worth-ai.atlassian.net/browse/PAT-902) - [FE+ BE] Add NAICS/MCC to Onboarding Flow for Customers**

- 🚜🚀 #LIVE feat: naics mcc customer edit #REGULAR (Original PR: [#1624](https://github.com/joinworth/case-service/pull/1624)) ([#1666](https://github.com/joinworth/case-service/pull/1666)) 🚂 release/v0.54.0

### 🐛 Bug

**[DOS-979](https://worth-ai.atlassian.net/browse/DOS-979) - [FAST TRACK] Issue where the TIN field is masked on the Edit Application**

- 🚜🚀 Resolved issue where tin is masked for edit application #LIVE #REGULAR (Original PR: [#1670](https://github.com/joinworth/case-service/pull/1670)) ([#1671](https://github.com/joinworth/case-service/pull/1671)) 🚂 release/v0.54.0

**[PAT-744](https://worth-ai.atlassian.net/browse/PAT-744) - [FE + BE] Case Management Search and Filter Issues**

- 🚜🚀 TIN & DBA Search #LIVE #REGULAR (Original PR: [#1618](https://github.com/joinworth/case-service/pull/1618)) ([#1664](https://github.com/joinworth/case-service/pull/1664)) 🚂 release/v0.54.0
- 🚜🚀 EIN Max Length #LIVE #REGULAR (Original PR: [#1642](https://github.com/joinworth/case-service/pull/1642)) ([#1665](https://github.com/joinworth/case-service/pull/1665)) 🚂 release/v0.54.0

**[PAT-793](https://worth-ai.atlassian.net/browse/PAT-793) - [Request More Info] GIACT not triggered after submitting "Request More Info" for Banking and Ownership**

- 🚜🚀 GIACT not trigggered after submitting request more info #LIVE #REGULAR (Original PR: [#1628](https://github.com/joinworth/case-service/pull/1628)) ([#1668](https://github.com/joinworth/case-service/pull/1668)) 🚂 release/v0.54.0

### ✨ Enhancement

**[DOS-945](https://worth-ai.atlassian.net/browse/DOS-945) - [FAST TRACK] [FLAG] Allow Field Edits on Company Details Page After Middesk is Run**

- 🚜🚀🚩 Grant guest owner editing privileges to feature flag users on company details #FLAG #LIVE #REGULAR (Original PR: [#1638](https://github.com/joinworth/case-service/pull/1638)) ([#1652](https://github.com/joinworth/case-service/pull/1652)) 🚂 release/v0.54.0
- 🚜🚀 TIN masking logic change for feature flag customer #LIVE #REGULAR (Original PR: [#1650](https://github.com/joinworth/case-service/pull/1650)) ([#1653](https://github.com/joinworth/case-service/pull/1653)) 🚂 release/v0.54.0

**[DOS-948](https://worth-ai.atlassian.net/browse/DOS-948) - [FAST TRACK] [FLAG] Track Application Completion**

- ⚡🚜🚩 fix application banking tracking #FAST #FLAG #REGULAR (Original PR: [#1677](https://github.com/joinworth/case-service/pull/1677)) ([#1678](https://github.com/joinworth/case-service/pull/1678)) 🚂 release/v0.54.0
- ⚡🚜🚩 add application completion tracking #FLAG #FAST #REGULAR (Original PR: [#1661](https://github.com/joinworth/case-service/pull/1661)) ([#1674](https://github.com/joinworth/case-service/pull/1674)) 🚂 release/v0.54.0

### 💻 Tech Task

**[FOTC-136](https://worth-ai.atlassian.net/browse/FOTC-136) - Decision implementation in the Case Service**

- 🚜🚀 #LIVE Add decision implementation logic to case service #REGULAR (Original PR: [#1641](https://github.com/joinworth/case-service/pull/1641)) ([#1658](https://github.com/joinworth/case-service/pull/1658)) 🚂 release/v0.54.0

**[PAT-873](https://worth-ai.atlassian.net/browse/PAT-873) - [BE] Track Worth Case Status Changes via Webhooks**

- 🚜🚀 #LIVE feat: case status updated event #REGULAR (Original PR: [#1620](https://github.com/joinworth/case-service/pull/1620)) ([#1656](https://github.com/joinworth/case-service/pull/1656)) 🚂 release/v0.54.0

### 📝 Other

**[DOS-913](https://worth-ai.atlassian.net/browse/DOS-913) - No title available**

- 🚜🚀 #LIVE add endpoint to clone business/case #REGULAR (Original PR: [#1649](https://github.com/joinworth/case-service/pull/1649)) ([#1681](https://github.com/joinworth/case-service/pull/1681)) 🚂 release/v0.54.0

## [v0.54.0-fast-v2.3](https://github.com/joinworth/case-service/compare/v0.54.0-fast-v2.1...v0.54.0-fast-v2.3) - 2025-11-14

### ✨ Enhancement

**[DOS-948](https://worth-ai.atlassian.net/browse/DOS-948) - [FAST TRACK] [FLAG] Track Application Completion**

- ⚡🚜🚩 fix application banking tracking #FAST #FLAG #REGULAR (Original PR: [#1677](https://github.com/joinworth/case-service/pull/1677)) ([#1679](https://github.com/joinworth/case-service/pull/1679)) 🚂 release/v0.54.0-fast-v2
- ⚡🚜🚩 add application completion tracking #FLAG #FAST #REGULAR (Original PR: [#1661](https://github.com/joinworth/case-service/pull/1661)) ([#1675](https://github.com/joinworth/case-service/pull/1675)) 🚂 release/v0.54.0-fast-v2

## [v0.54.0-fast-v2.1](https://github.com/joinworth/case-service/compare/v0.54.0-fast-v2.0...v0.54.0-fast-v2.1) - 2025-11-14

### 🐛 Bug

**[DOS-979](https://worth-ai.atlassian.net/browse/DOS-979) - [FAST TRACK] Issue where the TIN field is masked on the Edit Application**

- 🚜🚀 Resolved issue where tin is masked for edit application #LIVE #REGULAR (Original PR: [#1670](https://github.com/joinworth/case-service/pull/1670)) ([#1672](https://github.com/joinworth/case-service/pull/1672)) 🚂 release/v0.54.0-fast-v2

## [v0.54.1](https://github.com/joinworth/case-service/compare/v0.54.0-fast-v1.0...v0.54.1) - 2025-11-11

### 🧰 Task

**[INFRA-262](https://worth-ai.atlassian.net/browse/INFRA-262) - Add Google Calendar integration for automated release branch selection**

- 🚜🚀 #LIVE Add Google Calendar integration for automated release branch selection #REGULAR (Original PR: [#1623](https://github.com/joinworth/case-service/pull/1623)) ([#1625](https://github.com/joinworth/case-service/pull/1625)) 🚂 release/v0.54.0

**[INFRA-265](https://worth-ai.atlassian.net/browse/INFRA-265) - Add service health verification for release branch PRs**

- 🚜🚀 #LIVE Add workflow status check logic on PR and health check on release branch PRs #REGULAR (Original PR: [#1617](https://github.com/joinworth/case-service/pull/1617)) ([#1627](https://github.com/joinworth/case-service/pull/1627)) 🚂 release/v0.54.0
- 🚜🚀 #LIVE Update cherrypick PR merge detection logic #REGULAR (Original PR: [#1636](https://github.com/joinworth/case-service/pull/1636)) ([#1637](https://github.com/joinworth/case-service/pull/1637)) 🚂 release/v0.54.0

**[INFRA-267](https://worth-ai.atlassian.net/browse/INFRA-267) - Fix budibase deployment tracker issue**

- 🚜🚀 #LIVE Remove environment specification from create_tag job #REGULAR (Original PR: [#1621](https://github.com/joinworth/case-service/pull/1621)) ([#1626](https://github.com/joinworth/case-service/pull/1626)) 🚂 release/v0.54.0

### 🐛 Bug

**[PAT-917](https://worth-ai.atlassian.net/browse/PAT-917) - Daily Risk Alert Generation**

- 🚜🚀 #LIVE fix: score-calculated dlq fix #REGULAR (Original PR: [#1613](https://github.com/joinworth/case-service/pull/1613)) ([#1629](https://github.com/joinworth/case-service/pull/1629)) 🚂 release/v0.54.0

### 📝 Other

**[DOS-939](https://worth-ai.atlassian.net/browse/DOS-939) - No title available**

- 🚜🚀 Allow users to unmark control owner as beneficial owner #LIVE #REGULAR (Original PR: [#1631](https://github.com/joinworth/case-service/pull/1631)) ([#1633](https://github.com/joinworth/case-service/pull/1633)) 🚂 release/v0.54.0

## [v0.54.0-fast-v1.0](https://github.com/joinworth/case-service/compare/v0.53.0...v0.54.0-fast-v1.0) - 2025-11-06

### 🐛 Bug

**[DOS-939](https://worth-ai.atlassian.net/browse/DOS-939) - [FAST TRACK] Ownership % is Blocking Applicants From Moving Forward**

- 🚜🚀 Allow users to unmark control owner as beneficial owner #LIVE #REGULAR (Original PR: [#1631](https://github.com/joinworth/case-service/pull/1631)) ([#1632](https://github.com/joinworth/case-service/pull/1632)) 🚂 release/v0.54.0-fast-v1

## [v0.53.0](https://github.com/joinworth/case-service/compare/v0.52.2...v0.53.0) - 2025-11-04

### 📖 Story

**[BTTF-42](https://worth-ai.atlassian.net/browse/BTTF-42) - [Trulioo] Enable/Disable Integration Routing**

- 🚜🚀 international jurisdiction tables #LIVE #REGULAR (Original PR: [#1552](https://github.com/joinworth/case-service/pull/1552)) ([#1594](https://github.com/joinworth/case-service/pull/1594)) 🚂 release/v0.53.0

**[FOTC-112](https://worth-ai.atlassian.net/browse/FOTC-112) - [BE] Create notify topic (WF-service)**

- 🚜🚩 #FLAG Kafka event (workflows) #REGULAR (Original PR: [#1595](https://github.com/joinworth/case-service/pull/1595)) ([#1606](https://github.com/joinworth/case-service/pull/1606)) 🚂 release/v0.53.0

**[PAT-704](https://worth-ai.atlassian.net/browse/PAT-704) - [FE+BE] Purge - Soft Delete (Archive) Businesses**

- 🚜🚀 #LIVE feat: archive and unarchive business #REGULAR (Original PR: [#1570](https://github.com/joinworth/case-service/pull/1570)) ([#1597](https://github.com/joinworth/case-service/pull/1597)) 🚂 release/v0.53.0
- 🚜🚀 #LIVE Dev Testing Fixes #REGULAR (Original PR: [#1576](https://github.com/joinworth/case-service/pull/1576)) ([#1598](https://github.com/joinworth/case-service/pull/1598)) 🚂 release/v0.53.0
- 🚜🚀 #LIVE Dev Testing Fixes #REGULAR (Original PR: [#1579](https://github.com/joinworth/case-service/pull/1579)) ([#1599](https://github.com/joinworth/case-service/pull/1599)) 🚂 release/v0.53.0
- 🚜🚀 #LIVE Dev fixes #REGULAR (Original PR: [#1581](https://github.com/joinworth/case-service/pull/1581)) ([#1600](https://github.com/joinworth/case-service/pull/1600)) 🚂 release/v0.53.0
- 🚜🚀 #LIVE feat: archived business cases #REGULAR (Original PR: [#1592](https://github.com/joinworth/case-service/pull/1592)) ([#1601](https://github.com/joinworth/case-service/pull/1601)) 🚂 release/v0.53.0
- 🚜🚀 #LIVE fix: some minor fixes #REGULAR (Original PR: [#1596](https://github.com/joinworth/case-service/pull/1596)) ([#1602](https://github.com/joinworth/case-service/pull/1602)) 🚂 release/v0.53.0

### 🧰 Task

**[INFRA-223](https://worth-ai.atlassian.net/browse/INFRA-223) - [RELEASE EXPERIENCE] create new tag from latest tag of input branch**

- 🚜🚀 #LIVE Add branch-specific tag creation rules and validation #REGULAR (Original PR: [#1609](https://github.com/joinworth/case-service/pull/1609)) ([#1612](https://github.com/joinworth/case-service/pull/1612)) 🚂 release/v0.53.0

**[INFRA-249](https://worth-ai.atlassian.net/browse/INFRA-249) - Add GitHub Action Job to check image tag existence before building svc image**

- 🚜🚀 #LIVE Add GitHub Action Job to check image tag existence before building docker image #REGULAR (Original PR: [#1611](https://github.com/joinworth/case-service/pull/1611)) ([#1614](https://github.com/joinworth/case-service/pull/1614)) 🚂 release/v0.53.0

### ✨ Enhancement

**[BEST-194](https://worth-ai.atlassian.net/browse/BEST-194) - Support PATCH with business ID**

- 🚜🚀 PATCH Add Business by Business ID #LIVE #REGULAR (Original PR: [#1593](https://github.com/joinworth/case-service/pull/1593)) ([#1607](https://github.com/joinworth/case-service/pull/1607)) 🚂 release/v0.53.0

**[DOS-915](https://worth-ai.atlassian.net/browse/DOS-915) - Add DOS-886 to BEST-87 Feature Flag**

- 🚜🚩 Decouple SSN from Risk Score on 360 Report #FLAG #REGULAR (Original PR: [#1591](https://github.com/joinworth/case-service/pull/1591)) ([#1608](https://github.com/joinworth/case-service/pull/1608)) 🚂 release/v0.53.0

### 💻 Tech Task

**[DOS-482](https://worth-ai.atlassian.net/browse/DOS-482) - Create a V2 Endpoint for the New Progression API**

- 🚜🚀 add v2 progression endpoint #LIVE #REGULAR (Original PR: [#1588](https://github.com/joinworth/case-service/pull/1588)) ([#1603](https://github.com/joinworth/case-service/pull/1603)) 🚂 release/v0.53.0

### 📝 Other

**[PAT-790](https://worth-ai.atlassian.net/browse/PAT-790) - No title available**

- 🚜🚀 #LIVE feat: Provisions for idempotency for CASE_CREATED events #REGULAR (Original PR: [#1583](https://github.com/joinworth/case-service/pull/1583)) ([#1610](https://github.com/joinworth/case-service/pull/1610)) 🚂 release/v0.53.0

**[PAT-840](https://worth-ai.atlassian.net/browse/PAT-840) - No title available**

- 🚜🚀 fix dependency issue #LIVE #REGULAR (Original PR: [#1577](https://github.com/joinworth/case-service/pull/1577)) ([#1605](https://github.com/joinworth/case-service/pull/1605)) 🚂 release/v0.53.0
- 🚜🚀 axios version #LIVE #REGULAR (Original PR: [#1582](https://github.com/joinworth/case-service/pull/1582)) ([#1604](https://github.com/joinworth/case-service/pull/1604)) 🚂 release/v0.53.0

## [v0.52.2](https://github.com/joinworth/case-service/compare/v0.52.1...v0.52.2) - 2025-10-22

### 📖 Story

**[FOTC-92](https://worth-ai.atlassian.net/browse/FOTC-92) - [Workflows] [BE] Apply actions & call CaseService**

- 🚜🚀 #LIVE Applying New workflow event and refactor (core) #REGULAR (Original PR: [#1580](https://github.com/joinworth/case-service/pull/1580)) ([#1584](https://github.com/joinworth/case-service/pull/1584)) 🚂 release/v0.52.0

### 🐛 Bug

**[DOS-872](https://worth-ai.atlassian.net/browse/DOS-872) - Progression API is breaking for Lightning Verify**

- 🚜🚀 Validate API issue Resolved #LIVE #REGULAR (Original PR: [#1575](https://github.com/joinworth/case-service/pull/1575)) ([#1585](https://github.com/joinworth/case-service/pull/1585)) 🚂 release/v0.52.0

### ✨ Enhancement

**[BEST-146](https://worth-ai.atlassian.net/browse/BEST-146) - Feature Flag to wire Warehouse Facts API**

- 🚜🚀 Implement Kafka event on application edit For Re Calculation Of Fact #LIVE #REGULAR (Original PR: [#1574](https://github.com/joinworth/case-service/pull/1574)) ([#1587](https://github.com/joinworth/case-service/pull/1587)) 🚂 release/v0.52.0

### 📝 Other

**[PAT-616](https://worth-ai.atlassian.net/browse/PAT-616) - No title available**

- 🚜🚀 Allowed Admin Routes #LIVE #REGULAR (Original PR: [#1571](https://github.com/joinworth/case-service/pull/1571)) ([#1586](https://github.com/joinworth/case-service/pull/1586)) 🚂 release/v0.52.0

## [v0.52.1](https://github.com/joinworth/case-service/compare/v0.51.7...v0.52.1) - 2025-10-14

### 📖 Story

**[DOS-895](https://worth-ai.atlassian.net/browse/DOS-895) - Sync Identity Verification Setting Between Integration + Onboarding Settings**

- 🚜🚀 Sync Identity verification #LIVE #REGULAR (Original PR: [#1554](https://github.com/joinworth/case-service/pull/1554)) ([#1572](https://github.com/joinworth/case-service/pull/1572)) 🚂 release/v0.52.0

### 📝 Other

**[PAT-833](https://worth-ai.atlassian.net/browse/PAT-833) - No title available**

- 🚜🚀 #LIVE feat: Sends FETCH_GOOGLE_PROFILE kafka event on business update or create #REGULAR (Original PR: [#1569](https://github.com/joinworth/case-service/pull/1569)) ([#1573](https://github.com/joinworth/case-service/pull/1573)) 🚂 release/v0.52.0

## [v0.51.7](https://github.com/joinworth/case-service/compare/v0.51.0-fast-v2.0...v0.51.7) - 2025-10-07

### 📖 Story

**[DOS-822](https://worth-ai.atlassian.net/browse/DOS-822) - Create & Manage Sandbox Accounts Pt. I**

- 🚜🚀 Customer Sandbox Implementation #LIVE #REGULAR (Original PR: [#1504](https://github.com/joinworth/case-service/pull/1504)) ([#1560](https://github.com/joinworth/case-service/pull/1560)) 🚂 release/v0.51.0

**[DOS-838](https://worth-ai.atlassian.net/browse/DOS-838) - [FE] Support Multi-Template in Onboarding**

- 🚜🚀 Feat: Support Multi Template e-sign during onboarding #LIVE #REGULAR (Original PR: [#1529](https://github.com/joinworth/case-service/pull/1529)) ([#1543](https://github.com/joinworth/case-service/pull/1543)) 🚂 release/v0.51.0

**[DOS-874](https://worth-ai.atlassian.net/browse/DOS-874) - Create & Manage Sandbox Accounts Pt. II**

- 🚜🚀 Copy parent customer config to child during sandbox implementation #LIVE #REGULAR (Original PR: [#1528](https://github.com/joinworth/case-service/pull/1528)) ([#1561](https://github.com/joinworth/case-service/pull/1561)) 🚂 release/v0.51.0
- 🚜🚀 Copy eSign template settings from parent to child customer #LIVE #REGULAR (Original PR: [#1537](https://github.com/joinworth/case-service/pull/1537)) ([#1562](https://github.com/joinworth/case-service/pull/1562)) 🚂 release/v0.51.0
- 🚜🚀 Bug fix in custom field copy from parent to child #LIVE #REGULAR (Original PR: [#1559](https://github.com/joinworth/case-service/pull/1559)) ([#1563](https://github.com/joinworth/case-service/pull/1563)) 🚂 release/v0.51.0

**[PAT-691](https://worth-ai.atlassian.net/browse/PAT-691) - [FE+BE] Apply Features Permission Set**

- 🚜🚀 #LIVE feat: applying feature permissions #REGULAR (Original PR: [#1538](https://github.com/joinworth/case-service/pull/1538)) ([#1556](https://github.com/joinworth/case-service/pull/1556)) 🚂 release/v0.51.0
- 🚜🚩 #FLAG feat: showing PII Data if having permission #REGULAR (Original PR: [#1540](https://github.com/joinworth/case-service/pull/1540)) ([#1557](https://github.com/joinworth/case-service/pull/1557)) 🚂 release/v0.51.0

**[PAT-779](https://worth-ai.atlassian.net/browse/PAT-779) - [FE+BE] Apply Admin Permission Set**

- 🚜🚀 #LIVE feat: permission middleware #REGULAR (Original PR: [#1532](https://github.com/joinworth/case-service/pull/1532)) ([#1555](https://github.com/joinworth/case-service/pull/1555)) 🚂 release/v0.51.0
- 🚜🚩 #FLAG feat: introduce feature flag for custom roles #REGULAR (Original PR: [#1544](https://github.com/joinworth/case-service/pull/1544)) ([#1558](https://github.com/joinworth/case-service/pull/1558)) 🚂 release/v0.51.0

### 🧰 Task

**[INFRA-226](https://worth-ai.atlassian.net/browse/INFRA-226) - [RELEASE EXPERIENCE] Validate cherry-pick sprint vs release train**

- 🚜🚀 #LIVE Validate release label in cherry-pick action via Google Calendar #REGULAR (Original PR: [#1533](https://github.com/joinworth/case-service/pull/1533)) ([#1541](https://github.com/joinworth/case-service/pull/1541)) 🚂 release/v0.51.0
- 🚜🚀 #LIVE Add completion comment on original PR #REGULAR (Original PR: [#1542](https://github.com/joinworth/case-service/pull/1542)) ([#1549](https://github.com/joinworth/case-service/pull/1549)) 🚂 release/v0.51.0

### ✨ Enhancement

**[BEST-87](https://worth-ai.atlassian.net/browse/BEST-87) - Mask/Unmask SSN + Show in API responses**

- 🚜🚀 Block customer If flag OFF #LIVE #REGULAR (Original PR: [#1566](https://github.com/joinworth/case-service/pull/1566)) ([#1567](https://github.com/joinworth/case-service/pull/1567)) 🚂 release/v0.51.0
- 🚜🚀 SSN ENCRYPTION (Add user name into Event) #LIVE #REGULAR (Original PR: [#1547](https://github.com/joinworth/case-service/pull/1547)) ([#1565](https://github.com/joinworth/case-service/pull/1565)) 🚂 release/v0.51.0
- 🚜🚀 SSN Mask/Unmask by Audit log #LIVE #REGULAR (Original PR: [#1536](https://github.com/joinworth/case-service/pull/1536)) ([#1553](https://github.com/joinworth/case-service/pull/1553)) 🚂 release/v0.51.0

**[DOS-741](https://worth-ai.atlassian.net/browse/DOS-741) - Support Date Fields in Custom Fields**

- 🚜🚀 add custom date field #LIVE #REGULAR (Original PR: [#1535](https://github.com/joinworth/case-service/pull/1535)) ([#1551](https://github.com/joinworth/case-service/pull/1551)) 🚂 release/v0.51.0

### 📝 Other

**[BEST-71](https://worth-ai.atlassian.net/browse/BEST-71) - No title available**

- 🚜🚀 #LIVE Allow NPI First+Last Name to be passed to bulk API #REGULAR (Original PR: [#1520](https://github.com/joinworth/case-service/pull/1520)) ([#1564](https://github.com/joinworth/case-service/pull/1564)) 🚂 release/v0.51.0

**[PAT-830](https://worth-ai.atlassian.net/browse/PAT-830) - No title available**

- 🚜🚀 #LIVE fix: Fixes masked tin for businessDetails fact source #REGULAR (Original PR: [#1534](https://github.com/joinworth/case-service/pull/1534)) ([#1546](https://github.com/joinworth/case-service/pull/1546)) 🚂 release/v0.51.0

## [v0.51.0-fast-v2.0](https://github.com/joinworth/case-service/compare/v0.51.0...v0.51.0-fast-v2.0) - 2025-10-01

### 📝 Other

**[PAT-830](https://worth-ai.atlassian.net/browse/PAT-830) - No title available**

- ⚡🚀 #LIVE fix: Fixes masked tin for businessDetails fact source #FAST (Original PR: [#1534](https://github.com/joinworth/case-service/pull/1534)) ([#1548](https://github.com/joinworth/case-service/pull/1548)) 🚂 release/v0.51.0-fast-v2

## [v0.51.0](https://github.com/joinworth/case-service/compare/v0.50.5...v0.51.0) - 2025-09-30

### 🐛 Bug

**[DOS-868](https://worth-ai.atlassian.net/browse/DOS-868) - If SSN is not provided, the Plaid IDV request is incorrectly routed to the SSN-required template.**

- 🚜🚀 FIX: Handle empty date of birth not getting updated #LIVE #REGULAR (Original PR: [#1530](https://github.com/joinworth/case-service/pull/1530)) ([#1531](https://github.com/joinworth/case-service/pull/1531)) 🚂 release/v0.51.0

## [v0.50.5](https://github.com/joinworth/case-service/compare/v0.50.0-fast-v2.0...v0.50.5) - 2025-09-23

### 📖 Story

**[DOS-806](https://worth-ai.atlassian.net/browse/DOS-806) - [FE] Support Multi-Template in Worth Admin**

- 🚜🚀 FEAT: Updated stage config for review stage #LIVE #REGULAR (Original PR: [#1490](https://github.com/joinworth/case-service/pull/1490)) ([#1514](https://github.com/joinworth/case-service/pull/1514)) 🚂 release/v0.50.0

**[DOS-837](https://worth-ai.atlassian.net/browse/DOS-837) - [FE] Support Multi-Template in Customer Admin**

- 🚜🚀 Feat: Support multi esign template selection #LIVE #REGULAR (Original PR: [#1500](https://github.com/joinworth/case-service/pull/1500)) ([#1515](https://github.com/joinworth/case-service/pull/1515)) 🚂 release/v0.50.0

**[DOS-841](https://worth-ai.atlassian.net/browse/DOS-841) - [BE] Update Template Selection BE API to Allow Selecting Multiple Templates**

- 🚜🚀 FEAT: Allow multiple template selection for esign #LIVE #REGULAR (Original PR: [#1473](https://github.com/joinworth/case-service/pull/1473)) ([#1513](https://github.com/joinworth/case-service/pull/1513)) 🚂 release/v0.50.0

### ✨ Enhancement

**[BEST-105](https://worth-ai.atlassian.net/browse/BEST-105) - Support for international phone numbers**

- 🚜🚀 #LIVE allow international phone numbers in bulk & return null owner title vs undefined attribute #REGULAR (Original PR: [#1465](https://github.com/joinworth/case-service/pull/1465)) ([#1517](https://github.com/joinworth/case-service/pull/1517)) 🚂 release/v0.50.0
- 🚜🚀 Don't strip + in `OWNER_UPDATED_EVENT` #LIVE #REGULAR (Original PR: [#1498](https://github.com/joinworth/case-service/pull/1498)) ([#1518](https://github.com/joinworth/case-service/pull/1518)) 🚂 release/v0.50.0

**[PAT-684](https://worth-ai.atlassian.net/browse/PAT-684) - Deprecate Feature Flag WIN_1218_NO_LOGIN_ONBOARDING for Login with Email & Password**

- 🚜🚀 #LIVE Remove WIN_1218 FF constant #REGULAR (Original PR: [#1495](https://github.com/joinworth/case-service/pull/1495)) ([#1512](https://github.com/joinworth/case-service/pull/1512)) 🚂 release/v0.50.0

**[PAT-806](https://worth-ai.atlassian.net/browse/PAT-806) - [FAST TRACK] Post Custom Fields via Add Business API Endpoint (Follow Up)**

- ⚡🚜🚀 AddBusiness Custom Fields Fixes and Updates #FAST #LIVE #REGULAR (Original PR: [#1511](https://github.com/joinworth/case-service/pull/1511)) ([#1525](https://github.com/joinworth/case-service/pull/1525)) 🚂 release/v0.50.0

### 💻 Tech Task

**[DOS-779](https://worth-ai.atlassian.net/browse/DOS-779) - [PT. I] Upgrade Node.js to 22.x LTS in All Microservices & Enforce Usage Across Local Environment**

- 🚜🚀 #LIVE [REVERT VERIFY HEALTH CHECK CHANGES] Updated node version and packages #LIVE #REGULAR (Original PR: [#175](https://github.com/joinworth/case-service/pull/175)) ([#1519](https://github.com/joinworth/case-service/pull/1519)) 🚂 release/v0.50.0
- 🚜🚀 Updated node version and packages #LIVE #REGULAR (Original PR: [#1482](https://github.com/joinworth/case-service/pull/1482)) ([#1516](https://github.com/joinworth/case-service/pull/1516)) 🚂 release/v0.50.0

### 📝 Other

**[BEST-60](https://worth-ai.atlassian.net/browse/BEST-60) - No title available**

- 🚜🚩 Deprecate SMB Cases #FLAG #REGULAR (Original PR: [#1506](https://github.com/joinworth/case-service/pull/1506)) ([#1509](https://github.com/joinworth/case-service/pull/1509)) 🚂 release/v0.50.0

**[BEST-99](https://worth-ai.atlassian.net/browse/BEST-99) - No title available**

- 🚜🚀 New GET Endpoint for Custom Fields using Business ID #LIVE #REGULAR (Original PR: [#1497](https://github.com/joinworth/case-service/pull/1497)) ([#1526](https://github.com/joinworth/case-service/pull/1526)) 🚂 release/v0.50.0

## [v0.50.0-fast-v2.0](https://github.com/joinworth/case-service/compare/v0.50.2...v0.50.0-fast-v2.0) - 2025-09-19

### ✨ Enhancement

**[BEST-105](https://worth-ai.atlassian.net/browse/BEST-105) - Support for international phone numbers**

- 🚜🚀 #LIVE allow international phone numbers in bulk & return null owner title vs undefined attribute #REGULAR (Original PR: [#1465](https://github.com/joinworth/case-service/pull/1465)) ([#1521](https://github.com/joinworth/case-service/pull/1521)) 🚂 release/v0.50.0-fast-v2
- 🚜🚀 Don't strip + in `OWNER_UPDATED_EVENT` #LIVE #REGULAR (Original PR: [#1498](https://github.com/joinworth/case-service/pull/1498)) ([#1522](https://github.com/joinworth/case-service/pull/1522)) 🚂 release/v0.50.0-fast-v2

## [v0.50.2](https://github.com/joinworth/case-service/compare/v0.49.3...v0.50.2) - 2025-09-16

### 📖 Story

**[DOS-847](https://worth-ai.atlassian.net/browse/DOS-847) - Map Wholesale Payments MPA**

- 🚜🚀 #LIVE #REGULAR fix: Modify insertCustomerTemplate to handle conflicts ([#1503](https://github.com/joinworth/case-service/pull/1503))
- 🚜🚀 #LIVE feat: Support for Wholesale MPA fields #REGULAR (Original PR: [#1496](https://github.com/joinworth/case-service/pull/1496)) ([#1501](https://github.com/joinworth/case-service/pull/1501)) 🚂 release/v0.50.0

**[PAT-796](https://worth-ai.atlassian.net/browse/PAT-796) - Post Custom Fields via Add Business API Endpoint**

- 🚜🚀 Fix Onboarding Custom Fields via API Add Business #LIVE #REGULAR (Original PR: [#1489](https://github.com/joinworth/case-service/pull/1489)) ([#1491](https://github.com/joinworth/case-service/pull/1491)) 🚂 release/v0.50.0

### 🧰 Task

**[INFRA-239](https://worth-ai.atlassian.net/browse/INFRA-239) - Implement automated service health verification in CI/CD pipeline**

- 🚜🚀 Actions Issues #LIVE #REGULAR (Original PR: [#1487](https://github.com/joinworth/case-service/pull/1487)) ([#1488](https://github.com/joinworth/case-service/pull/1488)) 🚂 release/v0.50.0

### ✨ Enhancement

**[DOS-791](https://worth-ai.atlassian.net/browse/DOS-791) - Submit with Unverified Owners**

- 🚜🚀 #LIVE feat: new subfield config to allow application submission with unverified owners #REGULAR (Original PR: [#1471](https://github.com/joinworth/case-service/pull/1471)) ([#1492](https://github.com/joinworth/case-service/pull/1492)) 🚂 release/v0.50.0

**[PAT-604](https://worth-ai.atlassian.net/browse/PAT-604) - [FE][KYB Tab] Related Businesses Tab**

- 🚜🚀 #LIVE fix: Fixes GET /related-businesses incorrect total_items and total_pages #REGULAR (Original PR: [#1468](https://github.com/joinworth/case-service/pull/1468)) ([#1494](https://github.com/joinworth/case-service/pull/1494)) 🚂 release/v0.50.0

**[PAT-786](https://worth-ai.atlassian.net/browse/PAT-786) - Display DBA in Case Name**

- 🚜🚀 #LIVE feat: display DBA in case #REGULAR (Original PR: [#1481](https://github.com/joinworth/case-service/pull/1481)) ([#1493](https://github.com/joinworth/case-service/pull/1493)) 🚂 release/v0.50.0

## [v0.49.3](https://github.com/joinworth/case-service/compare/v0.49.1...v0.49.3) - 2025-09-09

### 🧰 Task

**[INFRA-237](https://worth-ai.atlassian.net/browse/INFRA-237) - Standardize test.yaml workflow across all service repos.**

- 🚜🚀 #LIVE Standardize test.yaml workflow across all service repos. #REGULAR (Original PR: [#1474](https://github.com/joinworth/case-service/pull/1474)) ([#1476](https://github.com/joinworth/case-service/pull/1476)) 🚂 release/v0.49.0

### 🐛 Bug

**[DOS-863](https://worth-ai.atlassian.net/browse/DOS-863) - Banking section not shown in New Case View after removing SSN while doing Edit application and updating application (Create Business API flow)**

- 🚜🚀 FIX: SSN stored as empty string #LIVE #REGULAR (Original PR: [#1483](https://github.com/joinworth/case-service/pull/1483)) ([#1484](https://github.com/joinworth/case-service/pull/1484)) 🚂 release/v0.49.0

### ✨ Enhancement

**[BEST-33](https://worth-ai.atlassian.net/browse/BEST-33) - Return external ID in Get Business endpoint**

- 🚜🚀 Return External ID Get Business #LIVE #REGULAR (Original PR: [#1442](https://github.com/joinworth/case-service/pull/1442)) ([#1470](https://github.com/joinworth/case-service/pull/1470)) 🚂 release/v0.49.0

### 💻 Tech Task

**[DOS-817](https://worth-ai.atlassian.net/browse/DOS-817) - [Dev Experience] POC + DevEx Video Walkthrough**

- 🚜🚀 Enabled auto-creation of Kafka topics in the local development environment #LIVE #REGULAR (Original PR: [#1459](https://github.com/joinworth/case-service/pull/1459)) ([#1472](https://github.com/joinworth/case-service/pull/1472)) 🚂 release/v0.49.0

## [v0.49.1](https://github.com/joinworth/case-service/compare/v0.48.5...v0.49.1) - 2025-09-02

### 🧰 Task

**[INFRA-229](https://worth-ai.atlassian.net/browse/INFRA-229) - Use PAT in checkout to allow cherry-pick of workflow files**

- 🚜🚀 #LIVE Use PAT in checkout to allow cherry-pick of workflow files #REGULAR (Original PR: [#1456](https://github.com/joinworth/case-service/pull/1456)) ([#1467](https://github.com/joinworth/case-service/pull/1467)) 🚂 release/v0.49.0

**[INFRA-232](https://worth-ai.atlassian.net/browse/INFRA-232) - GHA & Dockerfile updates for types**

- 🚜🚀 #LIVE GHA & Dockerfile updates for types #REGULAR (Original PR: [#1460](https://github.com/joinworth/case-service/pull/1460)) ([#1462](https://github.com/joinworth/case-service/pull/1462)) 🚂 release/v0.49.0

### 📝 Other

**[DOS-818](https://worth-ai.atlassian.net/browse/DOS-818) - No title available**

- 🚜🚩 add enhanced case status logging to auto-approval process #FLAG #REGULAR (Original PR: [#1443](https://github.com/joinworth/case-service/pull/1443)) ([#1466](https://github.com/joinworth/case-service/pull/1466)) 🚂 release/v0.49.0

**[PAT-748](https://worth-ai.atlassian.net/browse/PAT-748) - No title available**

- 🚜🚀 #LIVE fix: Fixes cross-customer token access #REGULAR (Original PR: [#1435](https://github.com/joinworth/case-service/pull/1435)) ([#1464](https://github.com/joinworth/case-service/pull/1464)) 🚂 release/v0.49.0

## [v0.48.5](https://github.com/joinworth/case-service/compare/v0.48.3...v0.48.5) - 2025-08-26

### 🧰 Task

**[INFRA-221](https://worth-ai.atlassian.net/browse/INFRA-221) - In auto release note - original PR link is not clickable**

- 🚜🚀 #LIVE FIX ORIGINAL PR LINK ISSUE #REGULAR (Original PR: [#1440](https://github.com/joinworth/case-service/pull/1440)) ([#1453](https://github.com/joinworth/case-service/pull/1453)) 🚂 release/v0.48.0

**[INFRA-229](https://worth-ai.atlassian.net/browse/INFRA-229) - Use PAT in checkout to allow cherry-pick of workflow files**

- 🚜🚀 #LIVE Use PAT in checkout to allow cherry-pick of workflow files #REGULAR (Original PR: [#1456](https://github.com/joinworth/case-service/pull/1456)) ([#1457](https://github.com/joinworth/case-service/pull/1457)) 🚂 release/v0.48.0

### 🐛 Bug

**[PAT-633](https://worth-ai.atlassian.net/browse/PAT-633) - [FAST TRACK][Edit Application] Processing History Not Saving During Edit Application**

- 🚜🚀 #LIVE fix: internal api case-id passing #REGULAR (Original PR: [#1455](https://github.com/joinworth/case-service/pull/1455)) ([#1458](https://github.com/joinworth/case-service/pull/1458)) 🚂 release/v0.48.0

**[PAT-726](https://worth-ai.atlassian.net/browse/PAT-726) - Update validateTin to hide PII information between customer instances**

- 🚜🚀 #LIVE Skip TIN Validation #REGULAR (Original PR: [#1422](https://github.com/joinworth/case-service/pull/1422)) ([#1451](https://github.com/joinworth/case-service/pull/1451)) 🚂 release/v0.48.0

### ✨ Enhancement

**[DOS-644](https://worth-ai.atlassian.net/browse/DOS-644) - [FE+BE] Enable Customers to View Their Hidden Fields When Editing Applications**

- 🚜🚀 Enable Customers to View Their Hidden Fields When Editing Applications #LIVE #REGULAR (Original PR: [#1399](https://github.com/joinworth/case-service/pull/1399)) ([#1447](https://github.com/joinworth/case-service/pull/1447)) 🚂 release/v0.48.0
- 🚜🚀 Resolved issue where the Customer Stages API returned a 500 database error (#LIVE) #REGULAR (Original PR: [#1444](https://github.com/joinworth/case-service/pull/1444)) ([#1452](https://github.com/joinworth/case-service/pull/1452)) 🚂 release/v0.48.0

**[PAT-725](https://worth-ai.atlassian.net/browse/PAT-725) - Edit Application Locks for All Users when One User Starts Process**

- 🚜🚀 #LIVE feat: edit application delete lock #REGULAR (Original PR: [#1436](https://github.com/joinworth/case-service/pull/1436)) ([#1448](https://github.com/joinworth/case-service/pull/1448)) 🚂 release/v0.48.0
- 🚀 #LIVE fix: redis expiration time ([#1437](https://github.com/joinworth/case-service/pull/1437))
- 🚜🚀 #LIVE QA fixes #REGULAR (Original PR: [#1438](https://github.com/joinworth/case-service/pull/1438)) ([#1449](https://github.com/joinworth/case-service/pull/1449)) 🚂 release/v0.48.0
- 🚀 #LIVE fix: error message ([#1441](https://github.com/joinworth/case-service/pull/1441)) ([#1450](https://github.com/joinworth/case-service/pull/1450))

### 📝 Other

**[DOS-728](https://worth-ai.atlassian.net/browse/DOS-728) - No title available**

- 🚜🚀 FIX: Audit log changes #LIVE #REGULAR (Original PR: [#1445](https://github.com/joinworth/case-service/pull/1445)) ([#1446](https://github.com/joinworth/case-service/pull/1446)) 🚂 release/v0.48.0

**[DOS-818](https://worth-ai.atlassian.net/browse/DOS-818) - No title available**

- 🚜🚩 add enhanced case status logging to auto-approval process #FLAG #REGULAR (Original PR: [#1443](https://github.com/joinworth/case-service/pull/1443)) ([#1454](https://github.com/joinworth/case-service/pull/1454)) 🚂 release/v0.48.0

## [v0.48.3](https://github.com/joinworth/case-service/compare/v0.48.0-fast-v1.1...v0.48.3) - 2025-08-19

### 🧰 Task

**[INFRA-212](https://worth-ai.atlassian.net/browse/INFRA-212) - Add release date in changelogs in release notes action**

- 🚜🚀 #LIVE ADD RELEASE DATE #REGULAR (Original PR: #1419) ([#1433](https://github.com/joinworth/case-service/pull/1433)) 🚂 release/v0.48.0
- 🚜🚀 #LIVE ADD RELEASE DATE #REGULAR (Original PR: #1419) ([#1434](https://github.com/joinworth/case-service/pull/1434)) 🚂 release/v0.48.0

### 🐛 Bug

**[PAT-520](https://worth-ai.atlassian.net/browse/PAT-520) - [FAST TRACK] PATCH for Add Business end point not saving new updates for all properties.**

- 🚜🚀 Revert "#LIVE TIN Patching Refinements #REGULAR (Original PR: #1411) ([#1427](https://github.com/joinworth/case-service/pull/1427))" 🚂 release/v0.48.0
- 🚀 #LIVE Allow Tin Patching ([#1303](https://github.com/joinworth/case-service/pull/1303))
- 🚀 #LIVE TIN PATCHING Fix ([#1347](https://github.com/joinworth/case-service/pull/1347))
- 🚀 #LIVE TIN Patching Refinements ([#1411](https://github.com/joinworth/case-service/pull/1411))
- 🚜🚀 #LIVE TIN Patching Refinements #REGULAR (Original PR: #1411) ([#1427](https://github.com/joinworth/case-service/pull/1427)) 🚂 release/v0.48.0

**[PAT-630](https://worth-ai.atlassian.net/browse/PAT-630) - Resend invite email format needs to be changed for additional application support**

- 🚜🚀 #LIVE fix: additional application request resend invite email #REGULAR (Original PR: #1400) ([#1431](https://github.com/joinworth/case-service/pull/1431)) 🚂 release/v0.48.0

### 📝 Other

**[DOS-738](https://worth-ai.atlassian.net/browse/DOS-738) - No title available**

- 🚜🚀 #LIVE feat: report handler updates #REGULAR (Original PR: #1415) ([#1429](https://github.com/joinworth/case-service/pull/1429)) 🚂 release/v0.48.0

## [v0.48.0-fast-v1.1](https://github.com/joinworth/case-service/compare/v0.48.0-fast-v1.0...v0.48.0-fast-v1.1) - 2025-08-14

### 📝 Other

**[DOS-738](https://worth-ai.atlassian.net/browse/DOS-738) - No title available**

- ⚡🚀 #LIVE feat: report handler updates #FAST (Original PR: #1415) ([#1430](https://github.com/joinworth/case-service/pull/1430)) 🚂 release/v0.48.0-fast-v1

## [v0.48.0-fast-v1.0](https://github.com/joinworth/case-service/compare/v0.47.12...v0.48.0-fast-v1.0) - 2025-08-13

### 🐛 Bug

**[PAT-520](https://worth-ai.atlassian.net/browse/PAT-520) - [FAST TRACK] PATCH for Add Business end point not saving new updates for all properties.**

- 🚀 #LIVE Allow Tin Patching ([#1303](https://github.com/joinworth/case-service/pull/1303))
- 🚀 #LIVE TIN PATCHING Fix ([#1347](https://github.com/joinworth/case-service/pull/1347))
- 🚀 #LIVE TIN Patching Refinements ([#1411](https://github.com/joinworth/case-service/pull/1411))

## [v0.47.12](https://github.com/joinworth/case-service/compare/v0.47.0-fast-v2.0...v0.47.12) - 2025-08-12

### 📖 Story

**[BEST-53](https://worth-ai.atlassian.net/browse/BEST-53) - [FAST TRACK] Implement Async Business Creation Functionality**

- 🚜🚀 #LIVE async=true for asynchronous onboarding #REGULAR (Original PR: #1412) ([#1416](https://github.com/joinworth/case-service/pull/1416)) 🚂 release/v0.47.0

### 🐛 Bug

**[BEST-51](https://worth-ai.atlassian.net/browse/BEST-51) - [HOTFIX] Fix Kafka event case_status_updated_event going in DLQ**

- 🔥🚜🚀 Update Case status Event send for all cases #HOTFIX #LIVE #REGULAR (Original PR: #1394) ([#1398](https://github.com/joinworth/case-service/pull/1398)) 🚂 release/v0.47.0

**[DOS-726](https://worth-ai.atlassian.net/browse/DOS-726) - Application Edit – Guest Owner Case is getting generated**

- 🚜🚀 Guest Owner case submit Fix for standalone case #LIVE #REGULAR (Original PR: #1404) ([#1405](https://github.com/joinworth/case-service/pull/1405)) 🚂 release/v0.47.0
- 🚜🚀 prevent guest owner case creation on application edit #LIVE #REGULAR (Original PR: #1386) ([#1397](https://github.com/joinworth/case-service/pull/1397)) 🚂 release/v0.47.0

**[DOS-748](https://worth-ai.atlassian.net/browse/DOS-748) - 360 Reports stuck in "Report Processing" for API and Bulk Upload businesses**

- 🚜🚀 add check for tin before decrypt #LIVE #REGULAR (Original PR: #1357) ([#1396](https://github.com/joinworth/case-service/pull/1396)) 🚂 release/v0.47.0

**[PAT-592](https://worth-ai.atlassian.net/browse/PAT-592) - [Stage] Fix Navigation and Status Issues in Additional Application Requests Flow**

- 🚜🚀 #LIVE fix: audit trail and case update conditions #REGULAR (Original PR: #1423) ([#1424](https://github.com/joinworth/case-service/pull/1424)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE trigger integration failed audit event #REGULAR (Original PR: #1366) ([#1401](https://github.com/joinworth/case-service/pull/1401)) 🚂 release/v0.47.0

### ✨ Enhancement

**[PAT-601](https://worth-ai.atlassian.net/browse/PAT-601) - [FAST TRACK] [Overview Tab] Enable Case Reassignment Without Changing Status**

- 🚜🚀 #LIVE feat: Implement case reassignment API #REGULAR (Original PR: #1307) ([#1417](https://github.com/joinworth/case-service/pull/1417)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE QA Fixes #REGULAR (Original PR: #1413) ([#1418](https://github.com/joinworth/case-service/pull/1418)) 🚂 release/v0.47.0

### 💻 Tech Task

**[PAT-674](https://worth-ai.atlassian.net/browse/PAT-674) - SOC-II Vulnerabilities (Lambdas)**

- 🚜🚀 #LIVE Build(deps): Bump form-data from 4.0.0 to 4.0.4 #REGULAR (Original PR: #1343) ([#1403](https://github.com/joinworth/case-service/pull/1403)) 🚂 release/v0.47.0

**[PAT-675](https://worth-ai.atlassian.net/browse/PAT-675) - SOC-II Vulnerabilities (Case-Service)**

- 🚜🚀 #LIVE fix: Build(deps): Bump @babel/helpers from 7.23.9 to 7.28.2 #REGULAR (Original PR: #1344) ([#1406](https://github.com/joinworth/case-service/pull/1406)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: Build(deps): Bump @babel/runtime from 7.23.9 to 7.28.2 #REGULAR (Original PR: #1345) ([#1407](https://github.com/joinworth/case-service/pull/1407)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: Build(deps): Bump multer from 2.0.0 to 2.0.2 #REGULAR (Original PR: #1346) ([#1409](https://github.com/joinworth/case-service/pull/1409)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: Override brace-expansion to 2.0.2 to patch Denial of Service vulnerability #REGULAR (Original PR: #1384) ([#1410](https://github.com/joinworth/case-service/pull/1410)) 🚂 release/v0.47.0

### 📝 Other

**[INFRA-155](https://worth-ai.atlassian.net/browse/INFRA-155) - No title available**

- 🚜🚀 #LIVE Add GitHub Action to generate release notes #REGULAR (Original PR: #1045) ([#1388](https://github.com/joinworth/case-service/pull/1388)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE ADD CHANGELOG #REGULAR (Original PR: #1379) ([#1389](https://github.com/joinworth/case-service/pull/1389)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE Update merge PR logic #REGULAR (Original PR: #1390) ([#1391](https://github.com/joinworth/case-service/pull/1391)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE UPDATE JIRA API LOGIC #REGULAR (Original PR: #1392) ([#1393](https://github.com/joinworth/case-service/pull/1393)) 🚂 release/v0.47.0

## [v0.47.0-fast-v2.0](https://github.com/joinworth/case-service/compare/v0.47.7...v0.47.0-fast-v2.0) - 2025-08-11

### 📖 Story

**[BEST-53](https://worth-ai.atlassian.net/browse/BEST-53) - [FAST TRACK] Implement Async Business Creation Functionality**

- 🚜🚀 #LIVE async=true for asynchronous onboarding #REGULAR (Original PR: #1412) ([#1414](https://github.com/joinworth/case-service/pull/1414)) 🚂 release/v0.47.0-fast-v2

## [v0.47.7](https://github.com/joinworth/case-service/compare/v0.47.0-fast-v1.3...v0.47.7) - 2025-08-05

### 🐛 Bug

**[DOS-765](https://worth-ai.atlassian.net/browse/DOS-765) - [FAST TRACK] Banking Bugs**

- 🚜🚀 FIX: Banking bug fixes #LIVE #REGULAR (Original PR: #1348) ([#1358](https://github.com/joinworth/case-service/pull/1358)) 🚂 release/v0.47.0

**[PAT-696](https://worth-ai.atlassian.net/browse/PAT-696) - [FAST TRACK] Add column for isCorporateEntity**

- 🚜🚀 - #LIVE FAST TRACK Add column for isCorporateEntity #REGULAR (Original PR: #1374) ([#1377](https://github.com/joinworth/case-service/pull/1377)) 🚂 release/v0.47.0

### ✨ Enhancement

**[BEST-23](https://worth-ai.atlassian.net/browse/BEST-23) - [FAST TRACK] Export Cases from Customer Portal**

- 🚜🚀 #LIVE Export Cases Patch #REGULAR (Original PR: #1381) ([#1382](https://github.com/joinworth/case-service/pull/1382)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE feat: customer cases data export #REGULAR (Original PR: #1367) ([#1368](https://github.com/joinworth/case-service/pull/1368)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: pulling back to main #REGULAR (Original PR: #1372) ([#1373](https://github.com/joinworth/case-service/pull/1373)) 🚂 release/v0.47.0

**[DOS-762](https://worth-ai.atlassian.net/browse/DOS-762) - [FAST TRACK] Empty State Standardization in Worth 360 Report**

- 🚜🚀 #LIVE Standardize empty data for reports #REGULAR (Original PR: #1342) ([#1362](https://github.com/joinworth/case-service/pull/1362)) 🚂 release/v0.47.0

**[PAT-451](https://worth-ai.atlassian.net/browse/PAT-451) - Confirm Geography/Geo-Locking in Onboarding**

- 🚜🚀 #LIVE fix: country check in validation #REGULAR (Original PR: #1297) ([#1350](https://github.com/joinworth/case-service/pull/1350)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: normalize country code #REGULAR (Original PR: #1306) ([#1351](https://github.com/joinworth/case-service/pull/1351)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: api schema for address_country #REGULAR (Original PR: #1308) ([#1352](https://github.com/joinworth/case-service/pull/1352)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: country code #REGULAR (Original PR: #1310) ([#1353](https://github.com/joinworth/case-service/pull/1353)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: update owner country #REGULAR (Original PR: #1322) ([#1355](https://github.com/joinworth/case-service/pull/1355)) 🚂 release/v0.47.0

**[PAT-556](https://worth-ai.atlassian.net/browse/PAT-556) - [FE+BE] Update Supported Titles for Owners**

- 🚜🚀 Update supported owner titles #LIVE #REGULAR (Original PR: #1324) ([#1354](https://github.com/joinworth/case-service/pull/1354)) 🚂 release/v0.47.0
- 🚜🚀 Feat: Sort owner titles list #LIVE #REGULAR (Original PR: #1332) ([#1356](https://github.com/joinworth/case-service/pull/1356)) 🚂 release/v0.47.0

**[PAT-590](https://worth-ai.atlassian.net/browse/PAT-590) - [Stage] Prevent Score Calculation While Case Is in "Information Requested" Status**

- 🚜🚀 Case Status changes #LIVE #REGULAR (Original PR: #1375) ([#1376](https://github.com/joinworth/case-service/pull/1376)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE trigger update case status and rescore event #REGULAR (Original PR: #1349) ([#1359](https://github.com/joinworth/case-service/pull/1359)) 🚂 release/v0.47.0

### 📝 Other

- 📝 Fix: build issue
- 🚜🚀 #NO_JIRA #LIVE force lf on package.json 🚂 release/v0.47.0 #REGULAR (Original PR: #1360) ([#1361](https://github.com/joinworth/case-service/pull/1361))

## [v0.47.0-fast-v1.2](https://github.com/joinworth/case-service/compare/v0.47.0-fast-v1.1...v0.47.0-fast-v1.2) - 2025-08-01

### 📝 Other

- 📝 Fix: envconfig

## [v0.47.0-fast-v1.1](https://github.com/joinworth/case-service/compare/v0.47.0-fast-v1.0...v0.47.0-fast-v1.1) - 2025-08-01

### ✨ Enhancement

**[BEST-23](https://worth-ai.atlassian.net/browse/BEST-23) - [FAST TRACK] Export Cases from Customer Portal**

- 🚜🚀 #LIVE feat: customer cases data export #REGULAR (Original PR: [#1367](https://github.comjoinworth/case-service/pull/1367)) ([#1369](https://github.comjoinworth/case-service/pull/1369)) 🚂 release/v0.47.0-fast-v1

## [v0.47.0-fast-v1.0](https://github.com/joinworth/case-service/compare/v0.47.1...v0.47.0-fast-v1.0) - 2025-08-01

### 🐛 Bug

**[DOS-765](https://worth-ai.atlassian.net/browse/DOS-765) - [FAST TRACK] Banking Bugs**

- 🚜🚀 FIX: Banking bug fixes #LIVE #REGULAR (Original PR: [#1348](https://github.comjoinworth/case-service/pull/1348)) ([#1363](https://github.comjoinworth/case-service/pull/1363)) 🚂 release/v0.47.0-fast-v1

### ✨ Enhancement

**[DOS-762](https://worth-ai.atlassian.net/browse/DOS-762) - [FAST TRACK] Empty State Standardization in Worth 360 Report**

- 🚜🚀 #LIVE Standardize empty data for reports #REGULAR (Original PR: [#1342](https://github.comjoinworth/case-service/pull/1342)) ([#1364](https://github.comjoinworth/case-service/pull/1364)) 🚂 release/v0.47.0-fast-v1

## [v0.47.1](https://github.com/joinworth/case-service/compare/v0.46.3...v0.47.1) - 2025-07-29

### ✨ Enhancement

**[PAT-621](https://worth-ai.atlassian.net/browse/PAT-621) - [FAST TRACK] Support Adding UK Businesses**

- 🚜🚀 #LIVE feat: adding support for UK in mobile number #REGULAR (Original PR: [#1301](https://github.comjoinworth/case-service/pull/1301)) ([#1336](https://github.comjoinworth/case-service/pull/1336)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE feat: adding UK vat support #REGULAR (Original PR: [#1321](https://github.comjoinworth/case-service/pull/1321)) ([#1337](https://github.comjoinworth/case-service/pull/1337)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: migration for making state null #REGULAR (Original PR: [#1323](https://github.comjoinworth/case-service/pull/1323)) ([#1338](https://github.comjoinworth/case-service/pull/1338)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: dev fixes #REGULAR (Original PR: [#1325](https://github.comjoinworth/case-service/pull/1325)) ([#1339](https://github.comjoinworth/case-service/pull/1339)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: UK mobile fix #REGULAR (Original PR: [#1326](https://github.comjoinworth/case-service/pull/1326)) ([#1340](https://github.comjoinworth/case-service/pull/1340)) 🚂 release/v0.47.0

**[PAT-634](https://worth-ai.atlassian.net/browse/PAT-634) - [FAST TRACK] Support UK Businesses in Case Management**

- 🚜🚀 #LIVE fix: VAT fixes for UK #REGULAR (Original PR: [#1334](https://github.comjoinworth/case-service/pull/1334)) ([#1341](https://github.comjoinworth/case-service/pull/1341)) 🚂 release/v0.47.0

### 📝 Other

- 📝 Fix: build issue

## [v0.46.3](https://github.com/joinworth/case-service/compare/v0.46.0-fast-v2.0...v0.46.3) - 2025-07-29

### 📖 Story

**[DOS-343](https://worth-ai.atlassian.net/browse/DOS-343) - [FE+BE] Enable Document Uploads During Onboarding (Uploads)**

- 🚜🚀 FEAT: Enable documents upload for banking accounting #LIVE #REGULAR (Original PR: [#1241](https://github.comjoinworth/case-service/pull/1241)) ([#1314](https://github.comjoinworth/case-service/pull/1314)) 🚂 release/v0.46.0
- 🚜🚀 FEAT: Enable documents upload for banking and accounting #LIVE #REGULAR (Original PR: [#1262](https://github.comjoinworth/case-service/pull/1262)) ([#1316](https://github.comjoinworth/case-service/pull/1316)) 🚂 release/v0.46.0

**[FOTC-12](https://worth-ai.atlassian.net/browse/FOTC-12) - Endpoint /saml/acs (POST)**

- 🚜🚩 #FLAG feat: Added new sso pool to verify cognito #REGULAR (Original PR: [#1294](https://github.comjoinworth/case-service/pull/1294)) ([#1311](https://github.comjoinworth/case-service/pull/1311)) 🚂 release/v0.46.0

**[FOTC-53](https://worth-ai.atlassian.net/browse/FOTC-53) - SSO Dedicated Pool revert**

- 🚜🚀🚩 #LIVE fix: Revert "#FLAG feat: Added new sso pool to verify cognito (#12… #REGULAR (Original PR: [#1333](https://github.comjoinworth/case-service/pull/1333)) ([#1335](https://github.comjoinworth/case-service/pull/1335)) 🚂 release/v0.46.0

### 🧰 Task

**[INFRA-185](https://worth-ai.atlassian.net/browse/INFRA-185) - Add wait after PR creation in dev/qa pipelines**

- 🚜🚀 #LIVE Add wait after PR creation #REGULAR (Original PR: [#1280](https://github.comjoinworth/case-service/pull/1280)) ([#1320](https://github.comjoinworth/case-service/pull/1320)) 🚂 release/v0.46.0

**[INFRA-202](https://worth-ai.atlassian.net/browse/INFRA-202) - No title available**

- 🚜🚀 #LIVE Update PR title action to show error in comment #REGULAR (Original PR: [#1302](https://github.comjoinworth/case-service/pull/1302)) ([#1304](https://github.comjoinworth/case-service/pull/1304)) 🚂 release/v0.46.0

### ✨ Enhancement

**[DOS-701](https://worth-ai.atlassian.net/browse/DOS-701) - Allow Customers to Submit Partially Completed Applications**

- 🚜🚀 Allow partial Case submission #LIVE #REGULAR (Original PR: [#1298](https://github.comjoinworth/case-service/pull/1298)) ([#1318](https://github.comjoinworth/case-service/pull/1318)) 🚂 release/v0.46.0

**[PAT-510](https://worth-ai.atlassian.net/browse/PAT-510) - [FE+BE] Support Manual Banking Information and Verification**

- 🚜🚀 & Reorganize Banking page config to match figma #LIVE #REGULAR (Original PR: [#1237](https://github.comjoinworth/case-service/pull/1237)) ([#1313](https://github.comjoinworth/case-service/pull/1313)) 🚂 release/v0.46.0
- 🚜🚀 Progression Changes for Manual Accounts #LIVE #REGULAR (Original PR: [#1263](https://github.comjoinworth/case-service/pull/1263)) ([#1315](https://github.comjoinworth/case-service/pull/1315)) 🚂 release/v0.46.0
- 🚜🚀 FIX: MINOR BUG FIXES #LIVE #REGULAR (Original PR: [#1305](https://github.comjoinworth/case-service/pull/1305)) ([#1317](https://github.comjoinworth/case-service/pull/1317)) 🚂 release/v0.46.0

**[PAT-555](https://worth-ai.atlassian.net/browse/PAT-555) - State Registration Not Required for Sole Props**

- 🚜🚀 #LIVE feat: Update auto-approval logic for sole proprietorship businesses #REGULAR (Original PR: [#1293](https://github.comjoinworth/case-service/pull/1293)) ([#1319](https://github.comjoinworth/case-service/pull/1319)) 🚂 release/v0.46.0

## [v0.46.0-fast-v2.0](https://github.com/joinworth/case-service/compare/v0.46.1...v0.46.0-fast-v2.0) - 2025-07-25

### 📖 Story

**[DOS-343](https://worth-ai.atlassian.net/browse/DOS-343) - [FE+BE] Enable Document Uploads During Onboarding (Uploads)**

- 🚜🚀 FEAT: Enable documents upload for banking accounting #LIVE #REGULAR (Original PR: [#1241](https://github.comjoinworth/case-service/pull/1241)) ([#1328](https://github.comjoinworth/case-service/pull/1328)) 🚂 release/v0.46.0-fast-v2
- 🚜🚀 FEAT: Enable documents upload for banking and accounting #LIVE #REGULAR (Original PR: [#1262](https://github.comjoinworth/case-service/pull/1262)) ([#1330](https://github.comjoinworth/case-service/pull/1330)) 🚂 release/v0.46.0-fast-v2

### ✨ Enhancement

**[PAT-510](https://worth-ai.atlassian.net/browse/PAT-510) - [FE+BE] Support Manual Banking Information and Verification**

- 🚜🚀 & Reorganize Banking page config to match figma #LIVE #REGULAR (Original PR: [#1237](https://github.comjoinworth/case-service/pull/1237)) ([#1327](https://github.comjoinworth/case-service/pull/1327)) 🚂 release/v0.46.0-fast-v2
- 🚜🚀 Progression Changes for Manual Accounts #LIVE #REGULAR (Original PR: [#1263](https://github.comjoinworth/case-service/pull/1263)) ([#1329](https://github.comjoinworth/case-service/pull/1329)) 🚂 release/v0.46.0-fast-v2
- 🚜🚀 FIX: MINOR BUG FIXES #LIVE #REGULAR (Original PR: [#1305](https://github.comjoinworth/case-service/pull/1305)) ([#1331](https://github.comjoinworth/case-service/pull/1331)) 🚂 release/v0.46.0-fast-v2

## [v0.46.1](https://github.com/joinworth/case-service/compare/v0.45.8...v0.46.1) - 2025-07-18

### 🐛 Bug

**[PAT-588](https://worth-ai.atlassian.net/browse/PAT-588) - [FE+BE] Incorrect Country Flag Displayed for Canadian Business in Ownership Screen**

- 🚜🚀 #LIVE fix: address country in progression #REGULAR (Original PR: [#1292](https://github.comjoinworth/case-service/pull/1292)) ([#1299](https://github.comjoinworth/case-service/pull/1299)) 🚂 release/v0.46.0

### ✨ Enhancement

**[PAT-566](https://worth-ai.atlassian.net/browse/PAT-566) - Verdata Research Follow Up - Skip refreshing for businesses that are older than 30 days in lower environments**

- 🚜🚀 #LIVE feat: score refresh enhancements #REGULAR (Original PR: [#1273](https://github.comjoinworth/case-service/pull/1273)) ([#1295](https://github.comjoinworth/case-service/pull/1295)) 🚂 release/v0.46.0
- 🚜🚀 #LIVE fix: adding loggers for score-refresh #REGULAR (Original PR: [#1279](https://github.comjoinworth/case-service/pull/1279)) ([#1296](https://github.comjoinworth/case-service/pull/1296)) 🚂 release/v0.46.0

**[PAT-593](https://worth-ai.atlassian.net/browse/PAT-593) - [FE+BE]Additional Application Request and Invitation mapping**

- 🚜🚀 #LIVE add mapping for invite #REGULAR (Original PR: [#1288](https://github.comjoinworth/case-service/pull/1288)) ([#1300](https://github.comjoinworth/case-service/pull/1300)) 🚂 release/v0.46.0

## [v0.45.8](https://github.com/joinworth/case-service/compare/v0.45.0-case-v1.0...v0.45.8) - 2025-07-15

### 📖 Story

**[PAT-324](https://worth-ai.atlassian.net/browse/PAT-324) - [FE+BE] Disable Middesk and Verdata Per Customer**

- 🚜🚀 #LIVE disable integrations #REGULAR (Original PR: [#1257](https://github.comjoinworth/case-service/pull/1257)) ([#1268](https://github.comjoinworth/case-service/pull/1268)) 🚂 release/v0.45.0

### 🧰 Task

**[INFRA-179](https://worth-ai.atlassian.net/browse/INFRA-179) - Update cherry-pick PR action inclue as hotfix/fast/regular in cherry-pick label**

- 🚜🚀 #LIVE UPDATE CHERRY-PICK ACTION TO INCLUDE AS HOTFIX/FAST/REGULAR IN LABEL #REGULAR (Original PR: [#1249](https://github.comjoinworth/case-service/pull/1249)) ([#1274](https://github.comjoinworth/case-service/pull/1274)) 🚂 release/v0.45.0

### ✨ Enhancement

**[PAT-259](https://worth-ai.atlassian.net/browse/PAT-259) - [FE+BE] Edit Application | Support Canadian BN, Addresses + Phone Numbers in Onboarding**

- 🚜🚀 #LIVE fix: tin validation for canada businesses #REGULAR (Original PR: [#1235](https://github.comjoinworth/case-service/pull/1235)) ([#1269](https://github.comjoinworth/case-service/pull/1269)) 🚂 release/v0.45.0
- 🚜🚀 #LIVE fix: required tin for non us businesses in submit api #REGULAR (Original PR: [#1254](https://github.comjoinworth/case-service/pull/1254)) ([#1270](https://github.comjoinworth/case-service/pull/1270)) 🚂 release/v0.45.0
- 🚜🚀 #LIVE fix: case creation for canada quick add #REGULAR (Original PR: [#1267](https://github.comjoinworth/case-service/pull/1267)) ([#1271](https://github.comjoinworth/case-service/pull/1271)) 🚂 release/v0.45.0

### 💻 Tech Task

**[DOS-579](https://worth-ai.atlassian.net/browse/DOS-579) - Handle Score Properly in Task Generation**

- 🚜🚀 Add Integration data Uploaded logic for both cases #LIVE #REGULAR (Original PR: [#1261](https://github.comjoinworth/case-service/pull/1261)) ([#1272](https://github.comjoinworth/case-service/pull/1272)) 🚂 release/v0.45.0

### 🛑 Defect

**[PAT-587](https://worth-ai.atlassian.net/browse/PAT-587) - [Staging] Invalid String Error After Editing Business Application ( Canadian + US )**

- 🚜🚀 #LIVE fix: empty ssn #REGULAR (Original PR: [#1286](https://github.comjoinworth/case-service/pull/1286)) ([#1287](https://github.comjoinworth/case-service/pull/1287)) 🚂 release/v0.45.0

**[PAT-591](https://worth-ai.atlassian.net/browse/PAT-591) - Processing History Step [Staging issue]Incorrectly Skipped in Quick Add Business Onboarding Flow**

- 🚜🚀 #LIVE fix: processing history stage completion logic #REGULAR (Original PR: [#1289](https://github.comjoinworth/case-service/pull/1289)) ([#1290](https://github.comjoinworth/case-service/pull/1290)) 🚂 release/v0.45.0

### 📝 Other

**[DOS-658](https://worth-ai.atlassian.net/browse/DOS-658) - No title available**

- 🚜🚀 #LIVE update allowed case status transitions #REGULAR (Original PR: [#1264](https://github.comjoinworth/case-service/pull/1264)) ([#1276](https://github.comjoinworth/case-service/pull/1276)) 🚂 release/v0.45.0

**[PAT-432](https://worth-ai.atlassian.net/browse/PAT-432) - No title available**

- 🚜🚀 #LIVE feat: Implement endpoint to verify owner applicant exists for a business #REGULAR (Original PR: [#1255](https://github.comjoinworth/case-service/pull/1255)) ([#1281](https://github.comjoinworth/case-service/pull/1281)) 🚂 release/v0.45.0
- 🚜🚀 #LIVE feat: Display "Request More Info" button for additional case statuses #REGULAR (Original PR: [#1266](https://github.comjoinworth/case-service/pull/1266)) ([#1282](https://github.comjoinworth/case-service/pull/1282)) 🚂 release/v0.45.0
- 🚜🚀 #LIVE fix: Add is_quick_add true to create user as main applicant #REGULAR (Original PR: [#1277](https://github.comjoinworth/case-service/pull/1277)) ([#1283](https://github.comjoinworth/case-service/pull/1283)) 🚂 release/v0.45.0
- 🚜🚀 #LIVE fix: Include case_id in business invitation payload #REGULAR (Original PR: [#1278](https://github.comjoinworth/case-service/pull/1278)) ([#1284](https://github.comjoinworth/case-service/pull/1284)) 🚂 release/v0.45.0

## [v0.45.0-case-v1.0](https://github.com/joinworth/case-service/compare/v0.45.3...v0.45.0-case-v1.0) - 2025-07-10

### 📝 Other

**[DOS-658](https://worth-ai.atlassian.net/browse/DOS-658) - No title available**

- 🚜🚀 #LIVE update allowed case status transitions #REGULAR (Original PR: [#1264](https://github.comjoinworth/case-service/pull/1264)) ([#1275](https://github.comjoinworth/case-service/pull/1275)) 🚂 release/v0.45.0-case-v1

## [v0.45.3](https://github.com/joinworth/case-service/compare/v0.44.7...v0.45.3) - 2025-07-08

### 📖 Story

**[PAT-686](https://worth-ai.atlassian.net/browse/PAT-686) - [Existing Groups and Permissions] [FE] View Groups Tab**

- 🚜🚀 - #LIVE Bulk Process - Allow Empty Strings and Null values for address_line_2 #REGULAR (Original PR: [#1234](https://github.comjoinworth/case-service/pull/1234)) ([#1258](https://github.comjoinworth/case-service/pull/1258)) 🚂 release/v0.45.0

### 🧰 Task

**[INFRA-165](https://worth-ai.atlassian.net/browse/INFRA-165) - Create Release Branch Action**

- 🚜🚀 #LIVE Create Release Branch Action #REGULAR (Original PR: [#1236](https://github.comjoinworth/case-service/pull/1236)) ([#1239](https://github.comjoinworth/case-service/pull/1239)) 🚂 release/v0.45.0

**[INFRA-177](https://worth-ai.atlassian.net/browse/INFRA-177) - Replace forward slashes with hyphens in Docker image tags in deployment pipeline in service repo**

- 🚜🚀 #LIVE Replace forward slashes with hyphens in Docker image tags #REGULAR (Original PR: [#1226](https://github.comjoinworth/case-service/pull/1226)) ([#1238](https://github.comjoinworth/case-service/pull/1238)) 🚂 release/v0.45.0

**[INFRA-178](https://worth-ai.atlassian.net/browse/INFRA-178) - Add Pre-commit Hook to Validate .env.example Consistency**

- 🚜🚀 #LIVE Add Pre-commit Hook to Validate .env.example Consistency #REGULAR (Original PR: [#1247](https://github.comjoinworth/case-service/pull/1247)) ([#1248](https://github.comjoinworth/case-service/pull/1248)) 🚂 release/v0.45.0

**[SEC-150](https://worth-ai.atlassian.net/browse/SEC-150) - [Vanta] Remediate "High vulnerabilities identified in packages are addressed (GitHub Repo)"**

- 🚜🚀 #LIVE Update multer library #REGULAR (Original PR: [#1049](https://github.comjoinworth/case-service/pull/1049)) ([#1256](https://github.comjoinworth/case-service/pull/1256)) 🚂 release/v0.45.0

### 🐛 Bug

**[PAT-496](https://worth-ai.atlassian.net/browse/PAT-496) - [FE+BE] Inviting a Business After Bulk Uploads/Add Business Causing Control Owner Issues**

- 🚜🚀 #LIVE fix prefill ownership data, send invite as main applicant #REGULAR (Original PR: [#1205](https://github.comjoinworth/case-service/pull/1205)) ([#1244](https://github.comjoinworth/case-service/pull/1244)) 🚂 release/v0.45.0
- 🚜🚀 #LIVE resolution of issues with bulk uploaded owners #REGULAR (Original PR: [#1230](https://github.comjoinworth/case-service/pull/1230)) ([#1245](https://github.comjoinworth/case-service/pull/1245)) 🚂 release/v0.45.0

**[PAT-524](https://worth-ai.atlassian.net/browse/PAT-524) - [BE] BJL inconsistencies**

- 🚜🚀 #LIVE fix: kafka message case-id key value fix #REGULAR (Original PR: [#1246](https://github.comjoinworth/case-service/pull/1246)) ([#1251](https://github.comjoinworth/case-service/pull/1251)) 🚂 release/v0.45.0

**[PAT-529](https://worth-ai.atlassian.net/browse/PAT-529) - [FE+BE] Audit Trail Issues in Customer Applicant Edit Flow (Found during PAT-492)**

- 🚜🚀 #LIVE fix: Audit Trail Issues in Customer Applicant Edit Flow #REGULAR (Original PR: [#1233](https://github.comjoinworth/case-service/pull/1233)) ([#1259](https://github.comjoinworth/case-service/pull/1259)) 🚂 release/v0.45.0
- 🚜🚀 #LIVE fix: Audit Trail Issues in Customer Applicant Edit Flow #REGULAR (Original PR: [#1250](https://github.comjoinworth/case-service/pull/1250)) ([#1260](https://github.comjoinworth/case-service/pull/1260)) 🚂 release/v0.45.0

**[PAT-565](https://worth-ai.atlassian.net/browse/PAT-565) - No title available**

- 🚜🚀 - #LIVE Bulk Upload CSV is throwing an error during upload and while sending invitations #REGULAR (Original PR: [#1242](https://github.comjoinworth/case-service/pull/1242)) ([#1253](https://github.comjoinworth/case-service/pull/1253)) 🚂 release/v0.45.0

## [v0.44.7](https://github.com/joinworth/case-service/compare/v0.44.0-fast-v2.2...v0.44.7) - 2025-06-30

### 📖 Story

**[DOS-590](https://worth-ai.atlassian.net/browse/DOS-590) - Increase Applicant email invite timeouts to 72 hours globally**

- 🚜🚀 #LIVE feat: increase VERIFY_EMAIL_TOKEN_LIFE_SECONDS to 72 hours #REGULAR (Original PR: [#1104](https://github.comjoinworth/case-service/pull/1104)) ([#1201](https://github.comjoinworth/case-service/pull/1201)) 🚂 release/v0.44.0

**[PAT-538](https://worth-ai.atlassian.net/browse/PAT-538) - Re-scoring a case after application edit**

- 🚜🚀 #LIVE fix: rescore case after customer edit #REGULAR (Original PR: [#1199](https://github.comjoinworth/case-service/pull/1199)) ([#1216](https://github.comjoinworth/case-service/pull/1216)) 🚂 release/v0.44.0

### 🐛 Bug

**[PAT-515](https://worth-ai.atlassian.net/browse/PAT-515) - [BE] Public Records and Adverse Media Show Old Data After Business Update in Customer Application Edit**

- 🚜🚀 #LIVE fix: Public Records and Adverse Media Show Old Data After Business Update in Customer Application Edit #REGULAR (Original PR: [#1152](https://github.comjoinworth/case-service/pull/1152)) ([#1208](https://github.comjoinworth/case-service/pull/1208)) 🚂 release/v0.44.0

### ✨ Enhancement

**[DOS-524](https://worth-ai.atlassian.net/browse/DOS-524) - Skip Collecting SSN**

- 🚜🚀 FEAT: SKIP COLLECTING SSN #LIVE #REGULAR (Original PR: [#1231](https://github.comjoinworth/case-service/pull/1231)) ([#1232](https://github.comjoinworth/case-service/pull/1232)) 🚂 release/v0.44.0
- 🚜🚀 FEAT: SKIP COLLECTING SSN #LIVE #REGULAR (Original PR: [#1202](https://github.comjoinworth/case-service/pull/1202)) ([#1222](https://github.comjoinworth/case-service/pull/1222)) 🚂 release/v0.44.0

**[DOS-525](https://worth-ai.atlassian.net/browse/DOS-525) - [FE+BE] As a user, I expect to be able to skip the credit check for an applicant.**

- 🚜🚀 FEAT: Enable customers to skip credit check for owners of specific businesses via flag #LIVE #REGULAR (Original PR: [#1154](https://github.comjoinworth/case-service/pull/1154)) ([#1220](https://github.comjoinworth/case-service/pull/1220)) 🚂 release/v0.44.0
- 🚜🚀 FEAT: Enable customers to skip credit check for owners of specific businesses via flag #LIVE #REGULAR (Original PR: [#1158](https://github.comjoinworth/case-service/pull/1158)) ([#1221](https://github.comjoinworth/case-service/pull/1221)) 🚂 release/v0.44.0

**[DOS-665](https://worth-ai.atlassian.net/browse/DOS-665) - Revert Logic from DOS-657**

- 🚜🚀 Revert Logic for DOS_657 #LIVE #REGULAR (Original PR: [#1211](https://github.comjoinworth/case-service/pull/1211)) ([#1218](https://github.comjoinworth/case-service/pull/1218)) 🚂 release/v0.44.0

**[PAT-480](https://worth-ai.atlassian.net/browse/PAT-480) - Improve validation logic for TIN in Bulk Upload/Add Business APIs**

- 🚜🚀 #LIVE Improve validation logic for TIN in Bulk Upload/Add Business APIs #REGULAR (Original PR: [#1117](https://github.comjoinworth/case-service/pull/1117)) ([#1223](https://github.comjoinworth/case-service/pull/1223)) 🚂 release/v0.44.0

**[PAT-492](https://worth-ai.atlassian.net/browse/PAT-492) - [FE+BE] Display + Highlight Fields Edited by Customers in Case Management**

- 🚜🚀 #LIVE feat: get edits api, company and ownership stages edits #REGULAR (Original PR: [#1156](https://github.comjoinworth/case-service/pull/1156)) ([#1203](https://github.comjoinworth/case-service/pull/1203)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix user key missing issue #REGULAR (Original PR: [#1195](https://github.comjoinworth/case-service/pull/1195)) ([#1204](https://github.comjoinworth/case-service/pull/1204)) 🚂 release/v0.44.0

**[PAT-552](https://worth-ai.atlassian.net/browse/PAT-552) - Allow PAT_466_TRIGGERING_APPLICATION_EDIT Flag to Work with Customer ID Only**

- 🚜🚩 #FLAG fix: application edit customer specific FF #REGULAR (Original PR: [#1227](https://github.comjoinworth/case-service/pull/1227)) ([#1228](https://github.comjoinworth/case-service/pull/1228)) 🚂 release/v0.44.0

### 💻 Tech Task

**[DOS-578](https://worth-ai.atlassian.net/browse/DOS-578) - [BE] Maintain Accurate Owner Creation and Deletion State in Integration Service**

- 🚜🚀 Customer id for owner and case submit #LIVE #REGULAR (Original PR: [#1194](https://github.comjoinworth/case-service/pull/1194)) ([#1224](https://github.comjoinworth/case-service/pull/1224)) 🚂 release/v0.44.0

### 📝 Other

**[PAT-469](https://worth-ai.atlassian.net/browse/PAT-469) - No title available**

- 🚜🚀 #LIVE feat: handling additional accounts in progression #REGULAR (Original PR: [#1193](https://github.comjoinworth/case-service/pull/1193)) ([#1212](https://github.comjoinworth/case-service/pull/1212)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: dev fixes #REGULAR (Original PR: [#1196](https://github.comjoinworth/case-service/pull/1196)) ([#1214](https://github.comjoinworth/case-service/pull/1214)) 🚂 release/v0.44.0

## [v0.44.0-fast-v2.2](https://github.com/joinworth/case-service/compare/v0.44.0-fast-v2.1...v0.44.0-fast-v2.2) - 2025-06-30

### ✨ Enhancement

**[PAT-552](https://worth-ai.atlassian.net/browse/PAT-552) - Allow PAT_466_TRIGGERING_APPLICATION_EDIT Flag to Work with Customer ID Only**

- 🚜🚩 #FLAG fix: application edit customer specific FF #REGULAR (Original PR: [#1227](https://github.comjoinworth/case-service/pull/1227)) ([#1229](https://github.comjoinworth/case-service/pull/1229)) 🚂 release/v0.44.0-fast-v2

## [v0.44.0-fast-v2.1](https://github.com/joinworth/case-service/compare/v0.44.0-fast-v2.0...v0.44.0-fast-v2.1) - 2025-06-26

### 📖 Story

**[PAT-538](https://worth-ai.atlassian.net/browse/PAT-538) - Re-scoring a case after application edit**

- 🚜🚀 #LIVE fix: rescore case after customer edit #REGULAR (Original PR: [#1199](https://github.comjoinworth/case-service/pull/1199)) ([#1217](https://github.comjoinworth/case-service/pull/1217)) 🚂 release/v0.44.0-fast-v2

### 🐛 Bug

**[PAT-515](https://worth-ai.atlassian.net/browse/PAT-515) - [BE] Public Records and Adverse Media Show Old Data After Business Update in Customer Application Edit**

- 🚜🚀 #LIVE fix: Public Records and Adverse Media Show Old Data After Business Update in Customer Application Edit #REGULAR (Original PR: [#1152](https://github.comjoinworth/case-service/pull/1152)) ([#1209](https://github.comjoinworth/case-service/pull/1209)) 🚂 release/v0.44.0-fast-v2

### ✨ Enhancement

**[DOS-665](https://worth-ai.atlassian.net/browse/DOS-665) - Revert Logic from DOS-657**

- 🚜🚀 Revert Logic for DOS_657 #LIVE #REGULAR (Original PR: [#1211](https://github.comjoinworth/case-service/pull/1211)) ([#1219](https://github.comjoinworth/case-service/pull/1219)) 🚂 release/v0.44.0-fast-v2

### 📝 Other

**[PAT-469](https://worth-ai.atlassian.net/browse/PAT-469) - No title available**

- 🚜🚀 #LIVE feat: handling additional accounts in progression #REGULAR (Original PR: [#1193](https://github.comjoinworth/case-service/pull/1193)) ([#1213](https://github.comjoinworth/case-service/pull/1213)) 🚂 release/v0.44.0-fast-v2
- 🚜🚀 #LIVE fix: dev fixes #REGULAR (Original PR: [#1196](https://github.comjoinworth/case-service/pull/1196)) ([#1215](https://github.comjoinworth/case-service/pull/1215)) 🚂 release/v0.44.0-fast-v2

## [v0.44.0-fast-v2.0](https://github.com/joinworth/case-service/compare/v0.44.4...v0.44.0-fast-v2.0) - 2025-06-25

### ✨ Enhancement

**[PAT-492](https://worth-ai.atlassian.net/browse/PAT-492) - [FE+BE] Display + Highlight Fields Edited by Customers in Case Management**

- 🚜🚀 #LIVE feat: get edits api, company and ownership stages edits #REGULAR (Original PR: [#1156](https://github.comjoinworth/case-service/pull/1156)) ([#1206](https://github.comjoinworth/case-service/pull/1206)) 🚂 release/v0.44.0-fast-v2
- 🚜🚀 #LIVE fix user key missing issue #REGULAR (Original PR: [#1195](https://github.comjoinworth/case-service/pull/1195)) ([#1207](https://github.comjoinworth/case-service/pull/1207)) 🚂 release/v0.44.0-fast-v2

## [v0.44.4](https://github.com/joinworth/case-service/compare/v0.43.4...v0.44.4) - 2025-06-24

### 🧰 Task

**[INFRA-170](https://worth-ai.atlassian.net/browse/INFRA-170) - Add wait-Retry logic in dev/qa action before merging**

- 🚜🚀 #LIVE Wait Retry logic in merging #REGULAR (Original PR: [#1136](https://github.comjoinworth/case-service/pull/1136)) ([#1182](https://github.comjoinworth/case-service/pull/1182)) 🚂 release/v0.44.0

**[INFRA-172](https://worth-ai.atlassian.net/browse/INFRA-172) - Add validation in in custom tag step in create-tag action**

- 🚜🚀 #LIVE Add validation for custom tag names in Create Tag workflow #REGULAR (Original PR: [#1150](https://github.comjoinworth/case-service/pull/1150)) ([#1181](https://github.comjoinworth/case-service/pull/1181)) 🚂 release/v0.44.0

### 🐛 Bug

**[PAT-512](https://worth-ai.atlassian.net/browse/PAT-512) - [BE] DBA Name Removal Not Supported in Customer Application Edit Review Flow**

- 🚜🚀 #LIVE Support DBA name removal #REGULAR (Original PR: [#1135](https://github.comjoinworth/case-service/pull/1135)) ([#1179](https://github.comjoinworth/case-service/pull/1179)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE dba name deletion fixes #REGULAR (Original PR: [#1153](https://github.comjoinworth/case-service/pull/1153)) ([#1180](https://github.comjoinworth/case-service/pull/1180)) 🚂 release/v0.44.0

**[PAT-513](https://worth-ai.atlassian.net/browse/PAT-513) - [FE+BE] Mailing Address Inserts New Entry Instead of Updating or Removing in Review Screen**

- 🚜🚀 #LIVE fix: update mailing addresses #REGULAR (Original PR: [#1151](https://github.comjoinworth/case-service/pull/1151)) ([#1185](https://github.comjoinworth/case-service/pull/1185)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: mailing address update #REGULAR (Original PR: [#1184](https://github.comjoinworth/case-service/pull/1184)) ([#1186](https://github.comjoinworth/case-service/pull/1186)) 🚂 release/v0.44.0

### ✨ Enhancement

**[DOS-536](https://worth-ai.atlassian.net/browse/DOS-536) - [BE] Update FSA Processing History MPA Mapping**

- 🚜🚀 Update FSA Processing History MPA Mapping #LIVE #REGULAR (Original PR: [#1112](https://github.comjoinworth/case-service/pull/1112)) ([#1189](https://github.comjoinworth/case-service/pull/1189)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: mapping key name #REGULAR (Original PR: [#1128](https://github.comjoinworth/case-service/pull/1128)) ([#1190](https://github.comjoinworth/case-service/pull/1190)) 🚂 release/v0.44.0
- 🚜🚀 Update FSA Processing History MPA Mapping (PART 2) #LIVE #REGULAR (Original PR: [#1157](https://github.comjoinworth/case-service/pull/1157)) ([#1191](https://github.comjoinworth/case-service/pull/1191)) 🚂 release/v0.44.0

**[DOS-552](https://worth-ai.atlassian.net/browse/DOS-552) - [FE+BE] Related Accounts Visibility + Download 360 Reports**

- 🚜🚀 Related Accounts Visibility PART 1 #LIVE #REGULAR (Original PR: [#1072](https://github.comjoinworth/case-service/pull/1072)) ([#1161](https://github.comjoinworth/case-service/pull/1161)) 🚂 release/v0.44.0
- 🚜🚀 Schema updates for fetchReportData #LIVE #REGULAR (Original PR: [#1133](https://github.comjoinworth/case-service/pull/1133)) ([#1173](https://github.comjoinworth/case-service/pull/1173)) 🚂 release/v0.44.0
- 🚜🚀 Customer Access Route updates #LIVE #REGULAR (Original PR: [#1149](https://github.comjoinworth/case-service/pull/1149)) ([#1174](https://github.comjoinworth/case-service/pull/1174)) 🚂 release/v0.44.0

**[DOS-563](https://worth-ai.atlassian.net/browse/DOS-563) - [BE] As a user, I expect to be able to allow more than 4 owners.**

- 🚜🚀 Allow More than 4 owners #LIVE #REGULAR (Original PR: [#1155](https://github.comjoinworth/case-service/pull/1155)) ([#1187](https://github.comjoinworth/case-service/pull/1187)) 🚂 release/v0.44.0

**[PAT-467](https://worth-ai.atlassian.net/browse/PAT-467) - [FE+BE] Enable Customers to Edit Applications via Onboarding**

- 🚜🚀 #LIVE feat: application edit data #REGULAR (Original PR: [#1077](https://github.comjoinworth/case-service/pull/1077)) ([#1163](https://github.comjoinworth/case-service/pull/1163)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE feat: expose edit application routes #REGULAR (Original PR: [#1088](https://github.comjoinworth/case-service/pull/1088)) ([#1164](https://github.comjoinworth/case-service/pull/1164)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: expost routes for application edit #REGULAR (Original PR: [#1089](https://github.comjoinworth/case-service/pull/1089)) ([#1165](https://github.comjoinworth/case-service/pull/1165)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: expost routes for application edit #REGULAR (Original PR: [#1090](https://github.comjoinworth/case-service/pull/1090)) ([#1166](https://github.comjoinworth/case-service/pull/1166)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE feat: customer edit application for custom fields #REGULAR (Original PR: [#1093](https://github.comjoinworth/case-service/pull/1093)) ([#1167](https://github.comjoinworth/case-service/pull/1167)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: user info type error #REGULAR (Original PR: [#1095](https://github.comjoinworth/case-service/pull/1095)) ([#1168](https://github.comjoinworth/case-service/pull/1168)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: update error and status code #REGULAR (Original PR: [#1096](https://github.comjoinworth/case-service/pull/1096)) ([#1169](https://github.comjoinworth/case-service/pull/1169)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: custom field changes #REGULAR (Original PR: [#1103](https://github.comjoinworth/case-service/pull/1103)) ([#1170](https://github.comjoinworth/case-service/pull/1170)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: score refresh #REGULAR (Original PR: [#1116](https://github.comjoinworth/case-service/pull/1116)) ([#1171](https://github.comjoinworth/case-service/pull/1171)) 🚂 release/v0.44.0

**[PAT-468](https://worth-ai.atlassian.net/browse/PAT-468) - [FE+BE] Display Customer Application Edits in Audit Trail**

- 🚜🚀 #LIVE feat: audit trail event producer #REGULAR (Original PR: [#1087](https://github.comjoinworth/case-service/pull/1087)) ([#1178](https://github.comjoinworth/case-service/pull/1178)) 🚂 release/v0.44.0

**[PAT-495](https://worth-ai.atlassian.net/browse/PAT-495) - [FE+BE] Allow Customers to Edit Company + Ownership Details**

- 🚜🚀 #LIVE feat: application edit migration script #REGULAR (Original PR: [#1075](https://github.comjoinworth/case-service/pull/1075)) ([#1159](https://github.comjoinworth/case-service/pull/1159)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE feat: owners application edit #REGULAR (Original PR: [#1085](https://github.comjoinworth/case-service/pull/1085)) ([#1172](https://github.comjoinworth/case-service/pull/1172)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: edit owners fixes #REGULAR (Original PR: [#1086](https://github.comjoinworth/case-service/pull/1086)) ([#1175](https://github.comjoinworth/case-service/pull/1175)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE feat: company-editing for guest owner #REGULAR (Original PR: [#1092](https://github.comjoinworth/case-service/pull/1092)) ([#1176](https://github.comjoinworth/case-service/pull/1176)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: company and owners fix #REGULAR (Original PR: [#1110](https://github.comjoinworth/case-service/pull/1110)) ([#1177](https://github.comjoinworth/case-service/pull/1177)) 🚂 release/v0.44.0

### 💻 Tech Task

**[DOS-557](https://worth-ai.atlassian.net/browse/DOS-557) - Implement fallback for Authorization cache to request from auth service in case of cache miss and fill in the cache**

- 🚜🚀 #LIVE Implement Fallback #REGULAR (Original PR: [#1060](https://github.comjoinworth/case-service/pull/1060)) ([#1183](https://github.comjoinworth/case-service/pull/1183)) 🚂 release/v0.44.0

### 🛑 Defect

**[DOS-617](https://worth-ai.atlassian.net/browse/DOS-617) - Bulk Download 360 Report Skips Ungenerated Reports**

- 🚜🚀 QA Issues Customer Related Businesses #LIVE #REGULAR (Original PR: [#1120](https://github.comjoinworth/case-service/pull/1120)) ([#1162](https://github.comjoinworth/case-service/pull/1162)) 🚂 release/v0.44.0

**[DOS-657](https://worth-ai.atlassian.net/browse/DOS-657) - [BE] Business Saved Without Any Control Owner – Found While Testing DOS-563**

- 🚜🚀 One Control Owner bug #LIVE #REGULAR (Original PR: [#1188](https://github.comjoinworth/case-service/pull/1188)) ([#1197](https://github.comjoinworth/case-service/pull/1197)) 🚂 release/v0.44.0

**[DOS-660](https://worth-ai.atlassian.net/browse/DOS-660) - Owner Record Fails When SSN Not Provided in Payload**

- 🚜🚀 Null Value issue SSN #LIVE #REGULAR (Original PR: [#1198](https://github.comjoinworth/case-service/pull/1198)) ([#1200](https://github.comjoinworth/case-service/pull/1200)) 🚂 release/v0.44.0

## [v0.43.4](https://github.com/joinworth/case-service/compare/v0.43.0-fast-v2.0...v0.43.4) - 2025-06-16

### 🧰 Task

**[INFRA-168](https://worth-ai.atlassian.net/browse/INFRA-168) - Auto Deploy QA ENV in all BE svc**

- 🚜🚀 #LIVE AUTO DEPLOY QA ENV #REGULAR (Original PR: [#1130](https://github.comjoinworth/case-service/pull/1130)) ([#1131](https://github.comjoinworth/case-service/pull/1131)) 🚂 release/v0.43.0

### 🐛 Bug

**[PAT-505](https://worth-ai.atlassian.net/browse/PAT-505) - Add Business endpoint not capturing TIN**

- 🔥🚜🚀 #LIVE #HOTFIX Add Business endpoint not capturing TIN #REGULAR (Original PR: [#1107](https://github.comjoinworth/case-service/pull/1107)) ([#1115](https://github.comjoinworth/case-service/pull/1115)) 🚂 release/v0.43.0

**[PAT-519](https://worth-ai.atlassian.net/browse/PAT-519) - Case svc crashing due to unhandled void promise functions**

- 🚜🚀 #LIVE fix: handle void promise throwing #REGULAR (Original PR: [#1126](https://github.comjoinworth/case-service/pull/1126)) ([#1129](https://github.comjoinworth/case-service/pull/1129)) 🚂 release/v0.43.0

### ✨ Enhancement

**[DOS-526](https://worth-ai.atlassian.net/browse/DOS-526) - [FE+BE] Additional Fields & Section for Processing History**

- 🚜🚀 FEAT: Additional fields and sections for processing history #LIVE #REGULAR (Original PR: [#1084](https://github.comjoinworth/case-service/pull/1084)) ([#1118](https://github.comjoinworth/case-service/pull/1118)) 🚂 release/v0.43.0
- 🚜🚀 FEAT: Additional fields and sections for processing history #LIVE #REGULAR (Original PR: [#1094](https://github.comjoinworth/case-service/pull/1094)) ([#1119](https://github.comjoinworth/case-service/pull/1119)) 🚂 release/v0.43.0

**[DOS-549](https://worth-ai.atlassian.net/browse/DOS-549) - [FE+BE] Bulk Uploads with Shared TINs**

- 🚜🚀 Enable Bulk Uploads with Shared TINs #LIVE #REGULAR (Original PR: [#1064](https://github.comjoinworth/case-service/pull/1064)) ([#1123](https://github.comjoinworth/case-service/pull/1123)) 🚂 release/v0.43.0

### 💻 Tech Task

**[DOS-573](https://worth-ai.atlassian.net/browse/DOS-573) - Enabling SSL and devcontainers for the local environment.**

- 🚜🚀 Introduced a dev container to improve the development experience. #LIVE #REGULAR (Original PR: [#1070](https://github.comjoinworth/case-service/pull/1070)) ([#1109](https://github.comjoinworth/case-service/pull/1109)) 🚂 release/v0.43.0

**[DOS-577](https://worth-ai.atlassian.net/browse/DOS-577) - Ensure Shared Task Execution and Response Attachment for Dual Case Scenarios**

- 🚜🚀 Add case submit Event for all cases #LIVE #REGULAR (Original PR: [#1111](https://github.comjoinworth/case-service/pull/1111)) ([#1124](https://github.comjoinworth/case-service/pull/1124)) 🚂 release/v0.43.0

### 📝 Other

**[DOS-551](https://worth-ai.atlassian.net/browse/DOS-551) - No title available**

- 🚜🚀 SHARED-TIN-ONBOARDING #LIVE #REGULAR (Original PR: [#1074](https://github.comjoinworth/case-service/pull/1074)) ([#1108](https://github.comjoinworth/case-service/pull/1108)) 🚂 release/v0.43.0

**[PAT-466](https://worth-ai.atlassian.net/browse/PAT-466) - No title available**

- 🚜🚩 #FLAG feat: triggering application edit #REGULAR (Original PR: [#1073](https://github.comjoinworth/case-service/pull/1073)) ([#1121](https://github.comjoinworth/case-service/pull/1121)) 🚂 release/v0.43.0
- 🚜🚀 #LIVE feat: retrieving data from token #REGULAR (Original PR: [#1078](https://github.comjoinworth/case-service/pull/1078)) ([#1122](https://github.comjoinworth/case-service/pull/1122)) 🚂 release/v0.43.0

**[PAT-517](https://worth-ai.atlassian.net/browse/PAT-517) - No title available**

- 🚜🚀 #LIVE Add Ownership to Add Business Schema #REGULAR (Original PR: [#1127](https://github.comjoinworth/case-service/pull/1127)) ([#1134](https://github.comjoinworth/case-service/pull/1134)) 🚂 release/v0.43.0

## [v0.43.0-fast-v2.0](https://github.com/joinworth/case-service/compare/v0.43.0-hotfix-v1.0...v0.43.0-fast-v2.0) - 2025-06-16

### 📝 Other

**[PAT-517](https://worth-ai.atlassian.net/browse/PAT-517) - No title available**

- 🚜🚀 #LIVE Add Ownership to Add Business Schema #REGULAR (Original PR: [#1127](https://github.comjoinworth/case-service/pull/1127)) ([#1138](https://github.comjoinworth/case-service/pull/1138)) 🚂 release/v0.43.0-fast-v2

## [v0.43.0-hotfix-v1.0](https://github.com/joinworth/case-service/compare/v0.43.1...v0.43.0-hotfix-v1.0) - 2025-06-11

### 🐛 Bug

**[PAT-505](https://worth-ai.atlassian.net/browse/PAT-505) - Add Business endpoint not capturing TIN**

- 🔥🚜🚀 #LIVE #HOTFIX Add Business endpoint not capturing TIN #REGULAR (Original PR: [#1107](https://github.comjoinworth/case-service/pull/1107)) ([#1114](https://github.comjoinworth/case-service/pull/1114)) 🚂 release/v0.43.0-hotfix-v1

## [v0.43.1](https://github.com/joinworth/case-service/compare/v0.43.0...v0.43.1) - 2025-06-10

### 🧰 Task

**[INFRA-164](https://worth-ai.atlassian.net/browse/INFRA-164) - Automate Cherry-pick PR Labeling for Release Train PR**

- 🚜🚀 #LIVE Add automated labeling for cherry-pick release PRs #REGULAR (Original PR: [#1097](https://github.comjoinworth/case-service/pull/1097)) ([#1099](https://github.comjoinworth/case-service/pull/1099)) 🚂 release/v0.43.0

### ✨ Enhancement

**[PAT-501](https://worth-ai.atlassian.net/browse/PAT-501) - Mapping Update for FSA esign**

- 🚜🚀 #LIVE fix: secondary owner email and control type #REGULAR (Original PR: [#1098](https://github.comjoinworth/case-service/pull/1098)) ([#1100](https://github.comjoinworth/case-service/pull/1100)) 🚂 release/v0.43.0

## [v0.43.0](https://github.com/joinworth/case-service/compare/v0.43.0-fast-v1...v0.43.0) - 2025-06-05

### ✨ Enhancement

**[DOS-528](https://worth-ai.atlassian.net/browse/DOS-528) - [BE] Support NPI in Add Business endpoint**

- 🚜🚀 Added Joi validation to support an optional NPI parameter in the Add Business endpoint. #LIVE #REGULAR (Original PR: [#975](https://github.comjoinworth/case-service/pull/975)) ([#1079](https://github.comjoinworth/case-service/pull/1079)) 🚂 release/v0.43.0

**[PAT-485](https://worth-ai.atlassian.net/browse/PAT-485) - [BE+FE] Show custom fields based on Customer Access column (in CSV) even if not required**

- 🚜🚀 #LIVE fix: custom fields rule formatting #REGULAR (Original PR: [#1076](https://github.comjoinworth/case-service/pull/1076)) ([#1081](https://github.comjoinworth/case-service/pull/1081)) 🚂 release/v0.43.0

### 💻 Tech Task

**[DOS-574](https://worth-ai.atlassian.net/browse/DOS-574) - Fix Duplicate Task Creation During Bulk Upload**

- 🚜🚀 Fix Duplicate Task Creation During Bulk Upload #LIVE #REGULAR (Original PR: [#1071](https://github.comjoinworth/case-service/pull/1071)) ([#1080](https://github.comjoinworth/case-service/pull/1080)) 🚂 release/v0.43.0

## [v0.43.0-fast-v1](https://github.com/joinworth/case-service/compare/v0.42.5...v0.43.0-fast-v1) - 2025-06-05

### ✨ Enhancement

**[PAT-485](https://worth-ai.atlassian.net/browse/PAT-485) - [BE+FE] Show custom fields based on Customer Access column (in CSV) even if not required**

- 🚜🚀 #LIVE fix: custom fields rule formatting #REGULAR (Original PR: [#1076](https://github.comjoinworth/case-service/pull/1076)) ([#1082](https://github.comjoinworth/case-service/pull/1082)) 🚂 release/v0.43.0-fast-v1

## [v0.42.5](https://github.com/joinworth/case-service/compare/v0.42.0-tiger-v2...v0.42.5) - 2025-06-02

### 📖 Story

**[DOS-518](https://worth-ai.atlassian.net/browse/DOS-518) - [FE+ BE] Worth Admin Settings - IDV - Add a field that allows custom Plaid IDV template ids**

- 🚜🚀 FEAT: ALLOW CUSTOM PLAID IDV TEMPLATE #LIVE #REGULAR (Original PR: [#1029](https://github.comjoinworth/case-service/pull/1029)) ([#1050](https://github.comjoinworth/case-service/pull/1050)) 🚂 release/v0.42.0

**[DOS-543](https://worth-ai.atlassian.net/browse/DOS-543) - [BE] Update Auto-Approval Logic to Use Multiple Verification Signals**

- 🚜🚀🚩 Case auto-approval logic update under feature flag #LIVE #FLAG #REGULAR (Original PR: [#1032](https://github.comjoinworth/case-service/pull/1032)) ([#1061](https://github.comjoinworth/case-service/pull/1061)) 🚂 release/v0.42.0

**[PAT-374](https://worth-ai.atlassian.net/browse/PAT-374) - API KYB facts - Add status field (or webhook) that signals completion of data gathering.**

- 🚜🚀 #LIVE KYB Add Completion Status #REGULAR (Original PR: [#1030](https://github.comjoinworth/case-service/pull/1030)) ([#1055](https://github.comjoinworth/case-service/pull/1055)) 🚂 release/v0.42.0
- 🚜🚀 #LIVE Bugfix Delete Error #REGULAR (Original PR: [#1047](https://github.comjoinworth/case-service/pull/1047)) ([#1056](https://github.comjoinworth/case-service/pull/1056)) 🚂 release/v0.42.0

**[PAT-428](https://worth-ai.atlassian.net/browse/PAT-428) - No title available**

- 🚜🚀 Property-specific validation errors when adding business #LIVE #REGULAR (Original PR: [#977](https://github.comjoinworth/case-service/pull/977)) ([#1057](https://github.comjoinworth/case-service/pull/1057)) 🚂 release/v0.42.0

**[PAT-489](https://worth-ai.atlassian.net/browse/PAT-489) - [BE] E-Sign Mapping Update**

- 🚜🚀 #LIVE fix: esign mapping update #REGULAR (Original PR: [#1059](https://github.comjoinworth/case-service/pull/1059)) ([#1068](https://github.comjoinworth/case-service/pull/1068)) 🚂 release/v0.42.0

### 🐛 Bug

**[PAT-459](https://worth-ai.atlassian.net/browse/PAT-459) - No title available**

- 🚜🚀 #LIVE fix: no template found issue #REGULAR (Original PR: [#1015](https://github.comjoinworth/case-service/pull/1015)) ([#1051](https://github.comjoinworth/case-service/pull/1051)) 🚂 release/v0.42.0

### 💻 Tech Task

**[TIG-30](https://worth-ai.atlassian.net/browse/TIG-30) - Update state sanitization**

- 🚜🚀 Sanitize states on input #LIVE #REGULAR (Original PR: [#1038](https://github.comjoinworth/case-service/pull/1038)) #REGULAR (Original PR: [#1046](https://github.comjoinworth/case-service/pull/1046)) ([#1054](https://github.comjoinworth/case-service/pull/1054)) 🚂 release/v0.42.0-tiger-v1

### 📝 Other

**[DOS-546](https://worth-ai.atlassian.net/browse/DOS-546) - No title available**

- 🚜🚩 #FLAG feat: Fixes GET /businesses/customers/:customerID SQL injection vulnerabilities #REGULAR (Original PR: [#1048](https://github.comjoinworth/case-service/pull/1048)) ([#1062](https://github.comjoinworth/case-service/pull/1062)) 🚂 release/v0.42.0
- 🚜🚀 #LIVE fix: Fixes incorrect feature flag from original branch #REGULAR (Original PR: [#1058](https://github.comjoinworth/case-service/pull/1058)) ([#1063](https://github.comjoinworth/case-service/pull/1063)) 🚂 release/v0.42.0

**[PAT-484](https://worth-ai.atlassian.net/browse/PAT-484) - No title available**

- 🚜🚀 #LIVE feat: field mapping fallback #REGULAR (Original PR: [#1065](https://github.comjoinworth/case-service/pull/1065)) ([#1069](https://github.comjoinworth/case-service/pull/1069)) 🚂 release/v0.42.0

## [v0.42.0-tiger-v2](https://github.com/joinworth/case-service/compare/v0.42.3...v0.42.0-tiger-v2) - 2025-05-28

### 💻 Tech Task

**[TIG-30](https://worth-ai.atlassian.net/browse/TIG-30) - Update state sanitization**

- 🚜🚀 Sanitize states on input #LIVE #REGULAR (Original PR: [#1038](https://github.comjoinworth/case-service/pull/1038)) #REGULAR (Original PR: [#1046](https://github.comjoinworth/case-service/pull/1046)) ([#1052](https://github.comjoinworth/case-service/pull/1052)) 🚂 release/v0.42.0-tiger-v1

## [v0.42.3](https://github.com/joinworth/case-service/compare/v0.42.0-fast-v1.0...v0.42.3) - 2025-05-26

### 🧰 Task

**[INFRA-159](https://worth-ai.atlassian.net/browse/INFRA-159) - Implement time-based cleanup for release branches**

- 🚜🚀 #LIVE Update branch cleanup workflow to use time-based deletion #REGULAR (Original PR: [#1022](https://github.comjoinworth/case-service/pull/1022)) ([#1034](https://github.comjoinworth/case-service/pull/1034)) 🚂 release/v0.42.0

**[INFRA-161](https://worth-ai.atlassian.net/browse/INFRA-161) - Update cherry-pick action**

- 🚜🚀 #LIVE UPDATE CHERRYPICK ACTION #REGULAR (Original PR: [#1036](https://github.comjoinworth/case-service/pull/1036)) ([#1037](https://github.comjoinworth/case-service/pull/1037)) 🚂 release/v0.42.0

### 🐛 Bug

**[PAT-460](https://worth-ai.atlassian.net/browse/PAT-460) - Fix Undefined Address Formatting for Canada**

- 🚜🚀 Resolved issue with bulk upload impacting Canadian business cases #LIVE #REGULAR (Original PR: [#1024](https://github.comjoinworth/case-service/pull/1024)) ([#1026](https://github.comjoinworth/case-service/pull/1026)) 🚂 release/v0.42.0

**[PAT-482](https://worth-ai.atlassian.net/browse/PAT-482) - Website found from Serp was not getting passed to Middesk when no website is provided**

- 🚜🚀 #LIVE fix: settling serp promises before middesk submission #REGULAR (Original PR: [#1040](https://github.comjoinworth/case-service/pull/1040)) ([#1041](https://github.comjoinworth/case-service/pull/1041)) 🚂 release/v0.42.0

### ✨ Enhancement

**[PAT-338](https://worth-ai.atlassian.net/browse/PAT-338) - BE | As a user, I expect that any additional DBA names or addresses are submitted to Middesk.**

- 🚜🚀 #LIVE feat: passing dba-names and mailing-addresses into middesk #REGULAR (Original PR: [#989](https://github.comjoinworth/case-service/pull/989)) ([#1035](https://github.comjoinworth/case-service/pull/1035)) 🚂 release/v0.42.0

**[PAT-429](https://worth-ai.atlassian.net/browse/PAT-429) - API: Inconsistent ID usage for querying vs insertion**

- 🚜🚀 #LIVE feat: added external_id filter to Get Customer Businesses endpoint #REGULAR (Original PR: [#1002](https://github.comjoinworth/case-service/pull/1002)) ([#1033](https://github.comjoinworth/case-service/pull/1033)) 🚂 release/v0.42.0

**[PAT-473](https://worth-ai.atlassian.net/browse/PAT-473) - Complete pending updates for eSign service integration and enable final validation**

- 🚜🚀 #LIVE fix: esign template id value #REGULAR (Original PR: [#1031](https://github.comjoinworth/case-service/pull/1031)) ([#1039](https://github.comjoinworth/case-service/pull/1039)) 🚂 release/v0.42.0

## [v0.42.0-fast-v1.0](https://github.com/joinworth/case-service/compare/v0.42.0-canada-v1.0...v0.42.0-fast-v1.0) - 2025-05-26

### 🐛 Bug

**[PAT-482](https://worth-ai.atlassian.net/browse/PAT-482) - Website found from Serp was not getting passed to Middesk when no website is provided**

- 🚜🚀 #LIVE fix: settling serp promises before middesk submission #REGULAR (Original PR: [#1040](https://github.comjoinworth/case-service/pull/1040)) ([#1042](https://github.comjoinworth/case-service/pull/1042)) 🚂 release/v0.42.0-fast-v1

## [v0.42.0-canada-v1.0](https://github.com/joinworth/case-service/compare/v0.41.9...v0.42.0-canada-v1.0) - 2025-05-21

### 🐛 Bug

**[PAT-460](https://worth-ai.atlassian.net/browse/PAT-460) - Fix Undefined Address Formatting for Canada**

- 🚜🚀 Resolved issue with bulk upload impacting Canadian business cases #LIVE #REGULAR (Original PR: [#1024](https://github.comjoinworth/case-service/pull/1024)) ([#1028](https://github.comjoinworth/case-service/pull/1028)) 🚂 release/v0.42.0-canada-v1

## [v0.41.9](https://github.com/joinworth/case-service/compare/v0.41.0-canada-v2...v0.41.9) - 2025-05-20

### 📖 Story

**[PAT-369](https://worth-ai.atlassian.net/browse/PAT-369) - FE+BE | Download a copy of signed agreement - case management**

- 🚜🚀 #LIVE feat: fetching signed docs #REGULAR (Original PR: [#949](https://github.comjoinworth/case-service/pull/949)) ([#985](https://github.comjoinworth/case-service/pull/985)) 🚂 release/v0.41.0

**[PAT-378](https://worth-ai.atlassian.net/browse/PAT-378) - Send template payloads to esign service**

- 🚜🚀 #LIVE feat: send template payload to esign service #REGULAR (Original PR: [#968](https://github.comjoinworth/case-service/pull/968)) ([#1001](https://github.comjoinworth/case-service/pull/1001)) 🚂 release/v0.41.0

### 🐛 Bug

**[DOS-533](https://worth-ai.atlassian.net/browse/DOS-533) - [BE] [Staging][Quick Add – Send Invitation] – case_id is coming as null in the Progression API response.**

- 🚜🚀 Resolved issue where case was not created when using "Quick Add + Submit with an unverified TIN" customer setting #LIVE #REGULAR (Original PR: [#972](https://github.comjoinworth/case-service/pull/972)) ([#1016](https://github.comjoinworth/case-service/pull/1016)) 🚂 release/v0.41.0
- 🚜🚀 Fixed a 503 error occurring in a few specific scenarios. #LIVE #REGULAR (Original PR: [#997](https://github.comjoinworth/case-service/pull/997)) ([#1017](https://github.comjoinworth/case-service/pull/1017)) 🚂 release/v0.41.0

**[PAT-390](https://worth-ai.atlassian.net/browse/PAT-390) - White Label Onboarding Settings not Displaying for Customers**

- 🚜🚀 #LIVE fix: White Label Onboarding not Displaying #REGULAR (Original PR: [#899](https://github.comjoinworth/case-service/pull/899)) ([#994](https://github.comjoinworth/case-service/pull/994)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE fix: White Label Onboarding not Displaying #REGULAR (Original PR: [#945](https://github.comjoinworth/case-service/pull/945)) ([#995](https://github.comjoinworth/case-service/pull/995)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE fix: Customer Settings not Set while Onboarding #REGULAR (Original PR: [#959](https://github.comjoinworth/case-service/pull/959)) ([#996](https://github.comjoinworth/case-service/pull/996)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE fix: Customer Settings not Set while Onboarding #REGULAR (Original PR: [#967](https://github.comjoinworth/case-service/pull/967)) ([#998](https://github.comjoinworth/case-service/pull/998)) 🚂 release/v0.41.0

**[PAT-437](https://worth-ai.atlassian.net/browse/PAT-437) - Leading Zeroes stripped when using Add Business endpoint**

- 🚜🚀 #LIVE Leading Zeroes stripped when using PATCH endpoint #REGULAR (Original PR: [#966](https://github.comjoinworth/case-service/pull/966)) ([#991](https://github.comjoinworth/case-service/pull/991)) 🚂 release/v0.41.0

### ✨ Enhancement

**[DOS-29](https://worth-ai.atlassian.net/browse/DOS-29) - Withhold Calculating Worth Scores in Certain Scenarios**

- 🚜🚀 Send case submit event into score service #LIVE #REGULAR (Original PR: [#952](https://github.comjoinworth/case-service/pull/952)) ([#992](https://github.comjoinworth/case-service/pull/992)) 🚂 release/v0.41.0

**[PAT-450](https://worth-ai.atlassian.net/browse/PAT-450) - Update address fields to support Canada (API)**

- 🚜🚀 #LIVE: Bypass Middesk Failure when Country not supported. Allows Canadian fields to be passed #REGULAR (Original PR: [#978](https://github.comjoinworth/case-service/pull/978)) ([#1008](https://github.comjoinworth/case-service/pull/1008)) 🚂 release/v0.41.0

**[PAT-452](https://worth-ai.atlassian.net/browse/PAT-452) - Update IDV to support Canada**

- 🚜🚀 Update IDV to support Canada #LIVE #REGULAR (Original PR: [#1004](https://github.comjoinworth/case-service/pull/1004)) ([#1006](https://github.comjoinworth/case-service/pull/1006)) 🚂 release/v0.41.0
- 🚜🚀 Allow Canadian phone number #LIVE #REGULAR (Original PR: [#1009](https://github.comjoinworth/case-service/pull/1009)) ([#1011](https://github.comjoinworth/case-service/pull/1011)) 🚂 release/v0.41.0

**[PAT-454](https://worth-ai.atlassian.net/browse/PAT-454) - [Follow up] Send template payloads to esign service - End-to-end eSign testing and final validation from Jacques**

- 🚜🚀 #LIVE fix: docs tab document link for esign #REGULAR (Original PR: [#1023](https://github.comjoinworth/case-service/pull/1023)) ([#1025](https://github.comjoinworth/case-service/pull/1025)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE feat: added documentId #REGULAR (Original PR: [#1014](https://github.comjoinworth/case-service/pull/1014)) ([#1021](https://github.comjoinworth/case-service/pull/1021)) 🚂 release/v0.41.0

### 📝 Other

**[DOS-508](https://worth-ai.atlassian.net/browse/DOS-508) - No title available**

- 🚜🚀 FEAT: Enable settings for emails sent to users #LIVE #REGULAR (Original PR: [#970](https://github.comjoinworth/case-service/pull/970)) ([#979](https://github.comjoinworth/case-service/pull/979)) 🚂 release/v0.41.0

**[PAT-366](https://worth-ai.atlassian.net/browse/PAT-366) - No title available**

- 🚜🚀 #LIVE feat: esign details in progression #REGULAR (Original PR: [#943](https://github.comjoinworth/case-service/pull/943)) ([#999](https://github.comjoinworth/case-service/pull/999)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE feat: progression changes #REGULAR (Original PR: [#969](https://github.comjoinworth/case-service/pull/969)) ([#1000](https://github.comjoinworth/case-service/pull/1000)) 🚂 release/v0.41.0

**[PAT-370](https://worth-ai.atlassian.net/browse/PAT-370) - No title available**

- 🚜🚀 #LIVE fix duplicate field insertion issue #REGULAR (Original PR: [#1012](https://github.comjoinworth/case-service/pull/1012)) ([#1018](https://github.comjoinworth/case-service/pull/1018)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE fix duplicate files issue #REGULAR (Original PR: [#1013](https://github.comjoinworth/case-service/pull/1013)) ([#1019](https://github.comjoinworth/case-service/pull/1019)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE Add customer access column, DB query adjustments, model classes #REGULAR (Original PR: [#912](https://github.comjoinworth/case-service/pull/912)) ([#982](https://github.comjoinworth/case-service/pull/982)) 🚂 release/v0.41.0
- 🚜🚀 Customer Access to Fields & Prefill #LIVE #REGULAR (Original PR: [#902](https://github.comjoinworth/case-service/pull/902)) ([#983](https://github.comjoinworth/case-service/pull/983)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE Add `user` prop to custom fields in Progression API #REGULAR (Original PR: [#910](https://github.comjoinworth/case-service/pull/910)) ([#984](https://github.comjoinworth/case-service/pull/984)) 🚂 release/v0.41.0
- 🚜🚀 Adjust prefill customfields shape & call create custom field values from acceptInvite #LIVE #REGULAR (Original PR: [#942](https://github.comjoinworth/case-service/pull/942)) ([#986](https://github.comjoinworth/case-service/pull/986)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE fix in applicant access logic #REGULAR (Original PR: [#971](https://github.comjoinworth/case-service/pull/971)) ([#987](https://github.comjoinworth/case-service/pull/987)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE fix: aggregated multiple file values #REGULAR (Original PR: [#973](https://github.comjoinworth/case-service/pull/973)) ([#988](https://github.comjoinworth/case-service/pull/988)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE fix: add check for visible fields #REGULAR (Original PR: [#980](https://github.comjoinworth/case-service/pull/980)) ([#990](https://github.comjoinworth/case-service/pull/990)) 🚂 release/v0.41.0

## [v0.41.0-canada-v2](https://github.com/joinworth/case-service/compare/v0.41.0-canada-v1...v0.41.0-canada-v2) - 2025-05-18

### ✨ Enhancement

**[PAT-452](https://worth-ai.atlassian.net/browse/PAT-452) - Update IDV to support Canada**

- 🚜🚀 Allow Canadian phone number #LIVE #REGULAR (Original PR: [#1009](https://github.comjoinworth/case-service/pull/1009)) ([#1010](https://github.comjoinworth/case-service/pull/1010)) 🚂 release/v0.41.0-canada-v1

## [v0.41.0-canada-v1](https://github.com/joinworth/case-service/compare/v0.41.2...v0.41.0-canada-v1) - 2025-05-17

### ✨ Enhancement

**[PAT-450](https://worth-ai.atlassian.net/browse/PAT-450) - Update address fields to support Canada (API)**

- 🚜🚀 #LIVE Bypass Middesk Failure when Country not supported. Allows Canadian fields to be passed #REGULAR (Original PR: [#978](https://github.comjoinworth/case-service/pull/978)) ([#1007](https://github.comjoinworth/case-service/pull/1007)) 🚂 release/v0.41.0-canada-v1

**[PAT-452](https://worth-ai.atlassian.net/browse/PAT-452) - Update IDV to support Canada**

- 🚜🚀 Update IDV to support Canada #LIVE #REGULAR (Original PR: [#1004](https://github.comjoinworth/case-service/pull/1004)) ([#1005](https://github.comjoinworth/case-service/pull/1005)) 🚂 release/v0.41.0-canada-v1

## [v0.41.2](https://github.com/joinworth/case-service/compare/v0.40.4...v0.41.2) - 2025-05-09

### 📖 Story

**[PAT-387](https://worth-ai.atlassian.net/browse/PAT-387) - FE + BE | Show Uploaded Documents in New Section of Case View**

- 🚜🚀 #LIVE feat: Get additional information requests documents API #REGULAR (Original PR: [#944](https://github.comjoinworth/case-service/pull/944)) ([#963](https://github.comjoinworth/case-service/pull/963)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE feat: Get additional information requests documents API #REGULAR (Original PR: [#961](https://github.comjoinworth/case-service/pull/961)) ([#964](https://github.comjoinworth/case-service/pull/964)) 🚂 release/v0.41.0

**[PAT-404](https://worth-ai.atlassian.net/browse/PAT-404) - Remove encryption from DOB in KYC response.**

- 🚜🚀 HOTFIX #LIVE Restore DOB Encryption for getOwners, add new internal route for kyc to return unencrypted DOB #REGULAR (Original PR: [#962](https://github.comjoinworth/case-service/pull/962)) ([#965](https://github.comjoinworth/case-service/pull/965)) 🚂 release/v0.41.0
- 🚜🚀 Remove Customer DOB Encryption #LIVE #REGULAR (Original PR: [#946](https://github.comjoinworth/case-service/pull/946)) ([#951](https://github.comjoinworth/case-service/pull/951)) 🚂 release/v0.41.0

### 🧰 Task

**[INFRA-149](https://worth-ai.atlassian.net/browse/INFRA-149) - Add Custom Tag Support to GitHub Workflow**

- 🚜🚀 #LIVE Add custom tag name support to Create Tag workflow #REGULAR (Original PR: [#953](https://github.comjoinworth/case-service/pull/953)) ([#960](https://github.comjoinworth/case-service/pull/960)) 🚂 release/v0.41.0

### 🐛 Bug

**[DOS-450](https://worth-ai.atlassian.net/browse/DOS-450) - [BE] Businesses submitted with an unverified TIN are not being set to UMR as expected**

- 🚜🚀 UNVERIFIED-TIN-UMR #LIVE #REGULAR (Original PR: [#930](https://github.comjoinworth/case-service/pull/930)) ([#956](https://github.comjoinworth/case-service/pull/956)) 🚂 release/v0.41.0
- 🚜🚀 UNVERIFIED-TIN-UMR (PART 2) #LIVE #REGULAR (Original PR: [#950](https://github.comjoinworth/case-service/pull/950)) ([#957](https://github.comjoinworth/case-service/pull/957)) 🚂 release/v0.41.0

**[DOS-513](https://worth-ai.atlassian.net/browse/DOS-513) - [BE][Prod issue][Quick add]Bulk Onboarding via Aurora/Normal customer: Invite Link Redirects to Accounting Page & Banking Page Fails to Load**

- 🚜🚀 Resolves a bug where the GIACT record appeared in the bank account section of the Progression API response #LIVE #REGULAR (Original PR: [#934](https://github.comjoinworth/case-service/pull/934)) ([#948](https://github.comjoinworth/case-service/pull/948)) 🚂 release/v0.41.0

**[PAT-420](https://worth-ai.atlassian.net/browse/PAT-420) - Fix blank entries and "undefined" values in Invitations for Additional Requests and Co-applicant Invites**

- 🚜🚀 #LIVE fix: Display applicant's name and email in Additional Application Request invitations #REGULAR (Original PR: [#936](https://github.comjoinworth/case-service/pull/936)) ([#947](https://github.comjoinworth/case-service/pull/947)) 🚂 release/v0.41.0

### ✨ Enhancement

**[PAT-412](https://worth-ai.atlassian.net/browse/PAT-412) - Review Esign Custom Fields**

- 🚜🚀 #LIVE fix custom fields response #REGULAR (Original PR: [#955](https://github.comjoinworth/case-service/pull/955)) ([#958](https://github.comjoinworth/case-service/pull/958)) 🚂 release/v0.41.0

## [v0.40.4](https://github.com/joinworth/case-service/compare/v0.40.0...v0.40.4) - 2025-05-05

### 📖 Story

**[DOS-466](https://worth-ai.atlassian.net/browse/DOS-466) - [FE+BE] Enable setting for Login with Email and Password in Onboarding Settings**

- 🚜🚀 FEAT: Enable setting for login with email password #LIVE #REGULAR (Original PR: [#913](https://github.comjoinworth/case-service/pull/913)) ([#921](https://github.comjoinworth/case-service/pull/921)) 🚂 release/v0.40.0

**[PAT-365](https://worth-ai.atlassian.net/browse/PAT-365) - FE+BE | Enable a customer setting for esigning merchant agreements**

- 🚜🚀 #LIVE feat: migrations for esign setting #REGULAR (Original PR: [#905](https://github.comjoinworth/case-service/pull/905)) ([#919](https://github.comjoinworth/case-service/pull/919)) 🚂 release/v0.40.0

**[PAT-367](https://worth-ai.atlassian.net/browse/PAT-367) - FE+BE | Set template IDs**

- 🚜🚀 #LIVE feat: get/add templates for customer #REGULAR (Original PR: [#911](https://github.comjoinworth/case-service/pull/911)) ([#922](https://github.comjoinworth/case-service/pull/922)) 🚂 release/v0.40.0

**[PAT-368](https://worth-ai.atlassian.net/browse/PAT-368) - Worth Admin | Support for custom hidden fields**

- 🚜🚀 #LIVE Add onboarding custom field applicant_access column #REGULAR (Original PR: [#871](https://github.comjoinworth/case-service/pull/871)) ([#920](https://github.comjoinworth/case-service/pull/920)) 🚂 release/v0.40.0

**[PAT-377](https://worth-ai.atlassian.net/browse/PAT-377) - Resolve template values to document**

- 🚜🚀 #LIVE feat: mapping keys and insertion of those into redis #REGULAR (Original PR: [#915](https://github.comjoinworth/case-service/pull/915)) ([#925](https://github.comjoinworth/case-service/pull/925)) 🚂 release/v0.40.0
- 🚜🚀 #LIVE feat: moved mapping data with fields into separate file #REGULAR (Original PR: [#917](https://github.comjoinworth/case-service/pull/917)) ([#926](https://github.comjoinworth/case-service/pull/926)) 🚂 release/v0.40.0

**[PAT-385](https://worth-ai.atlassian.net/browse/PAT-385) - FE+BE | Applicant Upload Document Flow**

- 🚜🚀 #LIVE feat: Additional documents upload API #REGULAR (Original PR: [#898](https://github.comjoinworth/case-service/pull/898)) ([#916](https://github.comjoinworth/case-service/pull/916)) 🚂 release/v0.40.0

**[PAT-386](https://worth-ai.atlassian.net/browse/PAT-386) - FE+BE | Applicant Update Application Flow**

- 🚜🚀 #LIVE fixes #REGULAR (Original PR: [#931](https://github.comjoinworth/case-service/pull/931)) ([#937](https://github.comjoinworth/case-service/pull/937)) 🚂 release/v0.40.0
- 🚜🚀 #LIVE Update Application Applicant Flow #REGULAR (Original PR: [#914](https://github.comjoinworth/case-service/pull/914)) ([#923](https://github.comjoinworth/case-service/pull/923)) 🚂 release/v0.40.0

**[PAT-395](https://worth-ai.atlassian.net/browse/PAT-395) - Bulk Upload - Include field validation responses for both Bulk Upload and Add Business routes**

- 🚜🚀 #LIVE Bulk Upload - Include field validation responses for both Bulk Upload and Add Business routes #REGULAR (Original PR: [#924](https://github.comjoinworth/case-service/pull/924)) ([#940](https://github.comjoinworth/case-service/pull/940)) 🚂 release/v0.40.0

### 🐛 Bug

**[PAT-419](https://worth-ai.atlassian.net/browse/PAT-419) - Co-applicant unable to register from "Request Additional Info" email if not previously signed up**

- 🚜🚀 #LIVE fix: Allow co-applicant to register from 'Request Additional Info' email #REGULAR (Original PR: [#927](https://github.comjoinworth/case-service/pull/927)) ([#938](https://github.comjoinworth/case-service/pull/938)) 🚂 release/v0.40.0
- 🚜🚀 #LIVE fix: Co-applicant invite token data #REGULAR (Original PR: [#935](https://github.comjoinworth/case-service/pull/935)) ([#939](https://github.comjoinworth/case-service/pull/939)) 🚂 release/v0.40.0

**[PAT-420](https://worth-ai.atlassian.net/browse/PAT-420) - Fix blank entries and "undefined" values in Invitations for Additional Requests and Co-applicant Invites**

- 🚜🚀 #LIVE fix: Display applicant's name and email in Additional Application Request invitations #REGULAR (Original PR: [#936](https://github.comjoinworth/case-service/pull/936)) ([#941](https://github.comjoinworth/case-service/pull/941)) 🚂 release/v0.40.0

**[PAT-421](https://worth-ai.atlassian.net/browse/PAT-421) - Notification email issues on Additional Info & Document Requests**

- 🚜🚀 #LIVE fix: all sections completed mail #REGULAR (Original PR: [#929](https://github.comjoinworth/case-service/pull/929)) ([#932](https://github.comjoinworth/case-service/pull/932)) 🚂 release/v0.40.0

**[PAT-422](https://worth-ai.atlassian.net/browse/PAT-422) - Incorrect Case Assignment to Applicant on Additional Information Request**

- 🚜🚀 #LIVE remove case assignment for applicant #REGULAR (Original PR: [#928](https://github.comjoinworth/case-service/pull/928)) ([#933](https://github.comjoinworth/case-service/pull/933)) 🚂 release/v0.40.0

### 📝 Other

- 📝 Fix: import lru cache and role_id

## [v0.40.0](https://github.com/joinworth/case-service/compare/v0.39.0-main...v0.40.0) - 2025-04-24

### 📖 Story

**[PAT-168](https://worth-ai.atlassian.net/browse/PAT-168) - FE+BE | Direct Applicant to Requested Section with Action Buttons for Additional Info**

- 🚜🚀 #LIVE: get additional info request details #REGULAR (Original PR: [#901](https://github.comjoinworth/case-service/pull/901)) ([#908](https://github.comjoinworth/case-service/pull/908)) 🚂 release/v0.40.0
- 🚜🚀 #LIVE fix: alter stage string length #REGULAR (Original PR: [#907](https://github.comjoinworth/case-service/pull/907)) ([#909](https://github.comjoinworth/case-service/pull/909)) 🚂 release/v0.40.0

**[PAT-396](https://worth-ai.atlassian.net/browse/PAT-396) - KYC Endpoint Refinements**

- 🚜🚀 New /internal/titles route #LIVE #REGULAR (Original PR: [#903](https://github.comjoinworth/case-service/pull/903)) ([#906](https://github.comjoinworth/case-service/pull/906)) 🚂 release/v0.40.0

### 🐛 Bug

**[DOS-470](https://worth-ai.atlassian.net/browse/DOS-470) - [BE] Unverified TINs are showing Verified Business Status**

- 🚜🚀 FIX: Unverified TINs are showing Verified Business Status #LIVE #REGULAR (Original PR: [#900](https://github.comjoinworth/case-service/pull/900)) ([#904](https://github.comjoinworth/case-service/pull/904)) 🚂 release/v0.40.0

## [v0.39.0-main](https://github.com/joinworth/case-service/compare/v0.39.2...v0.39.0-main) - 2025-04-16

### 📖 Story

**[DOS-247](https://worth-ai.atlassian.net/browse/DOS-247) - Add NPI number field in onboarding when the setting is enabled**

- 🚀 #LIVE: Add NPI field to bulk create business mapper ([#738](https://github.comjoinworth/case-service/pull/738))
- 🚀 #LIVE: Adds NPI match query to the ValidateBusiness API endpoint ([#770](https://github.comjoinworth/case-service/pull/770))
- 🚀 #LIVE Removes NPI from Validation Service. Updates endpoints and fetching from GetProgression ([#810](https://github.comjoinworth/case-service/pull/810))

**[DOS-297](https://worth-ai.atlassian.net/browse/DOS-297) - [BE] Update Progression API for Plaid IDV steps**

- 🚀 progression changes for idv #LIVE ([#757](https://github.comjoinworth/case-service/pull/757))

**[DOS-317](https://worth-ai.atlassian.net/browse/DOS-317) - [FE+BE] Add IDV Verification Logic & Statuses to Ownership Pages**

- 🚀 custome idv verification logic implementation #LIVE ([#756](https://github.comjoinworth/case-service/pull/756))
- 🚀 Custom IDV #LIVE ([#775](https://github.comjoinworth/case-service/pull/775))

**[DOS-391](https://worth-ai.atlassian.net/browse/DOS-391) - Allow owner onboarding information to be null when bulk uploaded**

- 🚀 FEAT: allow owner onboarding information to be null when bulk uploaded #LIVE ([#853](https://github.comjoinworth/case-service/pull/853))

**[DOS-447](https://worth-ai.atlassian.net/browse/DOS-447) - New Template for lightning verify without SSN**

- 🚀 FIX: NEW TEMPLATE FOR LIGHTNING VERIFICATION WITHOUT SSN #LIVE ([#856](https://github.comjoinworth/case-service/pull/856))

**[PAT-167](https://worth-ai.atlassian.net/browse/PAT-167) - [FE+BE] Send Invite to Applicants for Additional Information with Customizable Email Body**

- 🚀 #LIVE send additional info request ([#759](https://github.comjoinworth/case-service/pull/759))

**[PAT-169](https://worth-ai.atlassian.net/browse/PAT-169) - Receive Notifications for Completed Requests**

- 🚀 #LIVE feat: send info updated notification ([#783](https://github.comjoinworth/case-service/pull/783))

**[PAT-254](https://worth-ai.atlassian.net/browse/PAT-254) - [BE] Request More Info Modal - Additional Pages Section**

- 🚀 #LIVE feat: Add "Section Visibility" Column to Custom Fields CSV ([#742](https://github.comjoinworth/case-service/pull/742))
- 🚀 #LIVE feat: Add "Section Visibility" Column to Custom Fields CSV ([#750](https://github.comjoinworth/case-service/pull/750))

**[PAT-260](https://worth-ai.atlassian.net/browse/PAT-260) - [FE+BE] Monthly Limit for new onboardings**

- 🚀 #LIVE fix: reordering ([#772](https://github.comjoinworth/case-service/pull/772))
- 🚩 #FLAG feat: Monthly Limits ([#777](https://github.comjoinworth/case-service/pull/777))
- 🚀 #LIVE feat: cron job to reset the onboarding counts PART - 2 ([#784](https://github.comjoinworth/case-service/pull/784))
- 🚀 #LIVE feat: inserting null as limit if not already present ([#786](https://github.comjoinworth/case-service/pull/786))
- 🚀 #LIVE fix: merge conflicts issue and unit tests ([#787](https://github.comjoinworth/case-service/pull/787))
- 🚀 #LIVE Dev fixes ([#788](https://github.comjoinworth/case-service/pull/788))
- 🚀 #LIVE feat: adding onboarded business-ids into db ([#798](https://github.comjoinworth/case-service/pull/798))
- 🚀 #LIVE fix: reset onboarded_businesses column data reset fix ([#803](https://github.comjoinworth/case-service/pull/803))

**[PAT-274](https://worth-ai.atlassian.net/browse/PAT-274) - Maintain Historical Accuracy for Cases in Case Management**

- 🚀 #LIVE fix: case creation for invite fix ([#872](https://github.comjoinworth/case-service/pull/872))

**[PAT-334](https://worth-ai.atlassian.net/browse/PAT-334) - [FE+BE] Biller Genie - Allow support for address fields and TIN in `/invite` route**

- 🚀 #LIVE feat: add prefill data support in invite api ([#844](https://github.comjoinworth/case-service/pull/844))
- 🚀 #LIVE fix: prevent access of invitation data for standalone flow ([#854](https://github.comjoinworth/case-service/pull/854))
- 🚀 #LIVE fix: no login flag only allowed for enabled customers ([#874](https://github.comjoinworth/case-service/pull/874))
- 🚀 #LIVE fix: typo error with variable name ([#879](https://github.comjoinworth/case-service/pull/879))

**[PAT-336](https://worth-ai.atlassian.net/browse/PAT-336) - Prevent multiple standalone cases from being generated for the standalone onboarding flow**

- 🚀 #LIVE fix: two standalone case creation in standalone onboarding flow ([#851](https://github.comjoinworth/case-service/pull/851))

### 🧰 Task

**[INFRA-134](https://worth-ai.atlassian.net/browse/INFRA-134) - Cherry Pick automation action**

- 🚀 #LIVE Cherry Pick Action ([#789](https://github.comjoinworth/case-service/pull/789))
- 🚀 #LIVE Cherry Pick Action ([#790](https://github.comjoinworth/case-service/pull/790))
- 🚀 #LIVE Cherry Pick Action ([#791](https://github.comjoinworth/case-service/pull/791))
- 🚀 #LIVE Cherry Pick Action ([#794](https://github.comjoinworth/case-service/pull/794))
- 🚀 #LIVE Update CherryPick action ([#822](https://github.comjoinworth/case-service/pull/822))

**[INFRA-136](https://worth-ai.atlassian.net/browse/INFRA-136) - Add new tag #REGULAR in pr-title-format action**

- 🚀 #LIVE Update PR title action ([#797](https://github.comjoinworth/case-service/pull/797))

**[INFRA-137](https://worth-ai.atlassian.net/browse/INFRA-137) - update create tag action for right tag format**

- 🚀 #LIVE Update Create Tag Action ([#804](https://github.comjoinworth/case-service/pull/804))

**[INFRA-142](https://worth-ai.atlassian.net/browse/INFRA-142) - Modify branch is uptodate with main action step**

- 🚀 #LIVE Update branch up to date check ([#855](https://github.comjoinworth/case-service/pull/855))
- 🚀 #LIVE Update branch up to date check ([#881](https://github.comjoinworth/case-service/pull/881))

### 🐛 Bug

**[DOS-409](https://worth-ai.atlassian.net/browse/DOS-409) - Update Confidentiality Notice**

- 🚀 FIX: Update Confidentiality Notice #LIVE ([#751](https://github.comjoinworth/case-service/pull/751))

**[DOS-429](https://worth-ai.atlassian.net/browse/DOS-429) - GIACT | Validation Error**

- 🚀 Update logic for validating wired routing numbers in bulk route. #LIVE ([#779](https://github.comjoinworth/case-service/pull/779))

**[DOS-435](https://worth-ai.atlassian.net/browse/DOS-435) - Unable to select a deposit account**

- 🚀 Fixed issue preventing the selection of a deposit account. #LIVE ([#806](https://github.comjoinworth/case-service/pull/806))

**[DOS-456](https://worth-ai.atlassian.net/browse/DOS-456) - [STAGING] Ownership fields missing in staging/unable to continue**

- 🚀 FIX: ADD MISSING NPI FIELDS FOR EXISTING CUSTOMER #LIVE ([#845](https://github.comjoinworth/case-service/pull/845))
- 🚀 FIX: STAGES-REORDER-AFTER-COMPANY-ADDITIONAL-INFO-STAGE-REMOVED #LIVE ([#847](https://github.comjoinworth/case-service/pull/847))

**[DOS-471](https://worth-ai.atlassian.net/browse/DOS-471) - TIN-verified applicants redirected to document upload screen when TIN is optional**

- 🚀 FIX: Validate TIN when optional #LIVE ([#873](https://github.comjoinworth/case-service/pull/873))

**[PAT-312](https://worth-ai.atlassian.net/browse/PAT-312) - Fix Customer Token Security and Access Control Issues**

- 🚀 #LIVE fix: added validateDataPermission middleware ([#758](https://github.comjoinworth/case-service/pull/758))

**[PAT-331](https://worth-ai.atlassian.net/browse/PAT-331) - API - FACTS KYB - Fix Incorrect address_match Response for KYB Endpoint**

- 🚀 #LIVE Handle bulk addresses correctly ([#860](https://github.comjoinworth/case-service/pull/860))

**[PAT-356](https://worth-ai.atlassian.net/browse/PAT-356) - No title available**

- 🚀 #LIVE fix: optional stage completion check ([#852](https://github.comjoinworth/case-service/pull/852))

**[PAT-364](https://worth-ai.atlassian.net/browse/PAT-364) - Case created_by user_id being assigned as applicant_id**

- 🚀 #LIVE Make sure case applicant_id is an Applicant (not Admin) ([#859](https://github.comjoinworth/case-service/pull/859))

**[PAT-372](https://worth-ai.atlassian.net/browse/PAT-372) - Bulk Fields Export broken**

- 🚀 #LIVE fix bulk field display ([#870](https://github.comjoinworth/case-service/pull/870))

### ✨ Enhancement

**[DOS-285](https://worth-ai.atlassian.net/browse/DOS-285) - [BE] [REPAY] Add DBA to 360 Report**

- 🚀 feat: add dba name in company summary details #LIVE ([#857](https://github.comjoinworth/case-service/pull/857))

**[DOS-342](https://worth-ai.atlassian.net/browse/DOS-342) - [FE+BE] Remove "Company Additional Info" stage from progression**

- 🚀 Removed company additional information from progression #LIVE ([#782](https://github.comjoinworth/case-service/pull/782))

**[DOS-387](https://worth-ai.atlassian.net/browse/DOS-387) - [BE] Middesk Failed TIN Orders**

- 🚀 #LIVE fix: bulk max retries fixes ([#746](https://github.comjoinworth/case-service/pull/746))

**[DOS-412](https://worth-ai.atlassian.net/browse/DOS-412) - Provide a custom onboarding setting to allow users to submit with an unverified TIN**

- 🚀 FEAT: ALLOW USERS TO SUBMIT UNVERIFIED TIN #LIVE ([#795](https://github.comjoinworth/case-service/pull/795))
- 🚀 FEAT: ALLOW USERS TO SUBMIT UNVERIFIED TIN #LIVE ([#796](https://github.comjoinworth/case-service/pull/796))
- 🚀 FEAT: ALLOW USERS TO SUBMIT UNVERIFIED TIN #LIVE ([#805](https://github.comjoinworth/case-service/pull/805))

**[PAT-226](https://worth-ai.atlassian.net/browse/PAT-226) - [FE+BE] Purging Button in Admin**

- 🚀 #LIVE fix: added customer role to purge route ([#780](https://github.comjoinworth/case-service/pull/780))
- 🚀 #LIVE fix: purge by tin fixes ([#807](https://github.comjoinworth/case-service/pull/807))

**[PAT-315](https://worth-ai.atlassian.net/browse/PAT-315) - BE | Show Removed Pages by Worth Admin Under Additional Pages Section in Request More Info Modal**

- 🚀 #LIVE: include all custom onboarding stages ([#875](https://github.comjoinworth/case-service/pull/875))

**[PAT-323](https://worth-ai.atlassian.net/browse/PAT-323) - BE | Update White Label Email Copy**

- 🚀 #LIVE white label email changes ([#864](https://github.comjoinworth/case-service/pull/864))

**[PAT-337](https://worth-ai.atlassian.net/browse/PAT-337) - [BE] Swagger Implementation for 1 service**

- 🚀 #LIVE fix: duplicate event emission fix ([#865](https://github.comjoinworth/case-service/pull/865))

**[PAT-39](https://worth-ai.atlassian.net/browse/PAT-39) - Enhance Bulk Upload to Include Custom Fields**

- 🚀 #LIVE feat: custom fields data in bulk process ([#781](https://github.comjoinworth/case-service/pull/781))
- 🚀 #LIVE fix: custom fields stage completion ([#799](https://github.comjoinworth/case-service/pull/799))
- 🚀 #LIVE fix: code refactor ([#812](https://github.comjoinworth/case-service/pull/812))

### 💻 Tech Task

**[DOS-458](https://worth-ai.atlassian.net/browse/DOS-458) - Developer Experience Enhancement**

- 🚀 Resolved issue where Redis was not connecting properly in developer experience #LIVE ([#850](https://github.comjoinworth/case-service/pull/850))

**[PAT-248](https://worth-ai.atlassian.net/browse/PAT-248) - [BE] | Kafka DLQ Error Monitoring & Resolution**

- 🚀 #LIVE Handle DLQ Entries ([#736](https://github.comjoinworth/case-service/pull/736))

**[PAT-314](https://worth-ai.atlassian.net/browse/PAT-314) - Add validateDataPermission Middleware for routes where it is required but not added yet**

- 🚀 #LIVE Add validateDataPermission Middleware for routes where it is required but not added yet ([#800](https://github.comjoinworth/case-service/pull/800))
- 🚀 #LIVE Bugfix: removing validateDataPermission from internal routes ([#811](https://github.comjoinworth/case-service/pull/811))

**[PAT-343](https://worth-ai.atlassian.net/browse/PAT-343) - Integrate Plop in Backend Services**

- 🚀 #LIVE fix: Update Router in Index and Plopfile ([#849](https://github.comjoinworth/case-service/pull/849))

### 🛑 Defect

**[PAT-342](https://worth-ai.atlassian.net/browse/PAT-342) - Custom fields navigation issue**

- 🚀 #LIVE fix: back nav issue for custom fields ([#814](https://github.comjoinworth/case-service/pull/814))

**[PAT-345](https://worth-ai.atlassian.net/browse/PAT-345) - Datadog Error - Fix Evaluate Condition for Custom Fields Visibility**

- 🚀 #LIVE fix: condition format ([#819](https://github.comjoinworth/case-service/pull/819))

### 📝 Other

**[DOS-381](https://worth-ai.atlassian.net/browse/DOS-381) - No title available**

- 🚀 #LIVE: Add DB migration for the Allow Unverified TIN Submissions option in Customer Data Config ([#744](https://github.comjoinworth/case-service/pull/744))
- 🚀 #LIVE: Adds migration for updating the core stage with tin submission subfield ([#745](https://github.comjoinworth/case-service/pull/745))
- 🚀 #LIVE allow skipping assertTinValid on business creation ([#749](https://github.comjoinworth/case-service/pull/749))
- 🚀 #LIVE: Share isTinRequired logic ([#753](https://github.comjoinworth/case-service/pull/753))
- 🚀 #LIVE: Make AssertTin Customer Aware ([#755](https://github.comjoinworth/case-service/pull/755))
- 🚀 #LIVE: DB migration - makes npi field hidden by default ([#760](https://github.comjoinworth/case-service/pull/760))
- 🚀 #LIVE Don't always create new cases main lol ([#764](https://github.comjoinworth/case-service/pull/764))
- 🚀 #LIVE fix: making tin null also while making status unverified ([#765](https://github.comjoinworth/case-service/pull/765))
- 🚀 #LIVE fix: progression config based updating required fields ([#766](https://github.comjoinworth/case-service/pull/766))
- 🚀 #LIVE Job to clean up unverified TINs ([#767](https://github.comjoinworth/case-service/pull/767))
- 🚀 #LIVE fix: condition update ([#769](https://github.comjoinworth/case-service/pull/769))

**[DOS-390](https://worth-ai.atlassian.net/browse/DOS-390) - No title available**

- 🚀 #LIVE Ensure only one set of cases exist per business ([#771](https://github.comjoinworth/case-service/pull/771))
- 🚀 #LIVE fix: query values fix ([#820](https://github.comjoinworth/case-service/pull/820))

- 🚀 #NO_JIRA: #LIVE Build(deps): Bump axios from 1.7.4 to 1.8.2 ([#741](https://github.comjoinworth/case-service/pull/741))
- 🚀 #NO_JIRA #LIVE Add optional chain to get owner.title ([#735](https://github.comjoinworth/case-service/pull/735))
- 🚀 #NO_JIRA #LIVE Modify constraints for info request ([#774](https://github.comjoinworth/case-service/pull/774))
- 🚀 #NO_JIRA #LIVE fix issue with no required custom fields ([#776](https://github.comjoinworth/case-service/pull/776))
- 🚀 #NO_JIRA #LIVE fix: error msg ([#778](https://github.comjoinworth/case-service/pull/778))
- 🚀 #NO_JIRA #LIVE fix: navigation issues custom fields ([#809](https://github.comjoinworth/case-service/pull/809))
- 🚀 #NO_JIRA #LIVE Allow admins to send invites on behalf of customers ([#801](https://github.comjoinworth/case-service/pull/801))
- 🚀 #NO_JIRA #LIVE : Adjust mailing address column alternatives for bulk mapper ([#802](https://github.comjoinworth/case-service/pull/802))
- 🚀 #NO_JIRA #LIVE fix: custom fields navigation issue ([#813](https://github.comjoinworth/case-service/pull/813))
- 🚀 #NO_JIRA #LIVE Plop Integration ([#720](https://github.comjoinworth/case-service/pull/720))

**[PAT-224](https://worth-ai.atlassian.net/browse/PAT-224) - No title available**

- 🚀 #LIVE fix: stage completion logic ([#713](https://github.comjoinworth/case-service/pull/713))
- 🚀 #LIVE fix: field ids array check ([#752](https://github.comjoinworth/case-service/pull/752))

## [v0.39.2](https://github.com/joinworth/case-service/compare/v0.38.13...v0.39.2) - 2025-04-10

### 📖 Story

**[PAT-336](https://worth-ai.atlassian.net/browse/PAT-336) - Prevent multiple standalone cases from being generated for the standalone onboarding flow**

- 🚜🚀 #LIVE fix: two standalone case creation in standalone onboarding flow #REGULAR (Original PR: [#851](https://github.comjoinworth/case-service/pull/851)) ([#861](https://github.comjoinworth/case-service/pull/861)) 🚂 release/v0.39.0

### 🐛 Bug

**[PAT-356](https://worth-ai.atlassian.net/browse/PAT-356) - No title available**

- 🚜🚀 #LIVE fix: optional stage completion check #REGULAR (Original PR: [#852](https://github.comjoinworth/case-service/pull/852)) ([#862](https://github.comjoinworth/case-service/pull/862)) 🚂 release/v0.39.0

### 💻 Tech Task

**[PAT-314](https://worth-ai.atlassian.net/browse/PAT-314) - Add validateDataPermission Middleware for routes where it is required but not added yet**

- 🚀 #LIVE Add validateDataPermission Middleware for routes where it is required but not added yet ([#866](https://github.comjoinworth/case-service/pull/866)) 🚂 release/v0.39.0
- 🚜🚀 #LIVE Bugfix: removing validateDataPermission from internal routes #REGULAR ([#867](https://github.comjoinworth/case-service/pull/867)) 🚂 release/v0.39.0

### 🛑 Defect

**[PAT-345](https://worth-ai.atlassian.net/browse/PAT-345) - Datadog Error - Fix Evaluate Condition for Custom Fields Visibility**

- 🚜🚀 #LIVE fix: condition format #REGULAR ([#863](https://github.comjoinworth/case-service/pull/863)) 🚂 release/v0.39.0

## [v0.38.13](https://github.com/joinworth/case-service/compare/v0.38.9...v0.38.13) - 2025-04-04

### 📖 Story

**[DOS-247](https://worth-ai.atlassian.net/browse/DOS-247) - Add NPI number field in onboarding when the setting is enabled**

- 🚜🚀 #LIVE: Add NPI field to bulk create business mapper #REGULAR (Original PR: [#738](https://github.comjoinworth/case-service/pull/738)) ([#841](https://github.comjoinworth/case-service/pull/841)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE: Adds NPI match query to the ValidateBusiness API endpoint #REGULAR (Original PR: [#770](https://github.comjoinworth/case-service/pull/770)) ([#842](https://github.comjoinworth/case-service/pull/842)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE Removes NPI from Validation Service. Updates endpoints and fetching from GetProgression #REGULAR (Original PR: [#810](https://github.comjoinworth/case-service/pull/810)) ([#843](https://github.comjoinworth/case-service/pull/843)) 🚂 release/v0.38.0

**[DOS-317](https://worth-ai.atlassian.net/browse/DOS-317) - [FE+BE] Add IDV Verification Logic & Statuses to Ownership Pages**

- 🚜🚀 custome idv verification logic implementation #LIVE #REGULAR (Original PR: [#756](https://github.comjoinworth/case-service/pull/756)) ([#833](https://github.comjoinworth/case-service/pull/833)) 🚂 release/v0.38.0
- 🚜🚀 Custom IDV #LIVE #REGULAR (Original PR: [#775](https://github.comjoinworth/case-service/pull/775)) ([#835](https://github.comjoinworth/case-service/pull/835)) 🚂 release/v0.38.0

**[PAT-260](https://worth-ai.atlassian.net/browse/PAT-260) - [FE+BE] Monthly Limit for new onboardings**

- 🚜🚀 #LIVE fix: reordering #REGULAR (Original PR: [#772](https://github.comjoinworth/case-service/pull/772)) ([#823](https://github.comjoinworth/case-service/pull/823)) 🚂 release/v0.38.0
- 🚜🚩 #FLAG feat: Monthly Limits #REGULAR (Original PR: [#777](https://github.comjoinworth/case-service/pull/777)) ([#824](https://github.comjoinworth/case-service/pull/824)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE feat: cron job to reset the onboarding counts PART - 2 #REGULAR (Original PR: [#784](https://github.comjoinworth/case-service/pull/784)) ([#825](https://github.comjoinworth/case-service/pull/825)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE feat: inserting null as limit if not already present #REGULAR (Original PR: [#786](https://github.comjoinworth/case-service/pull/786)) ([#826](https://github.comjoinworth/case-service/pull/826)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE fix: merge conflicts issue and unit tests #REGULAR (Original PR: [#787](https://github.comjoinworth/case-service/pull/787)) ([#827](https://github.comjoinworth/case-service/pull/827)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE Dev fixes #REGULAR (Original PR: [#788](https://github.comjoinworth/case-service/pull/788)) ([#828](https://github.comjoinworth/case-service/pull/828)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE feat: adding onboarded business-ids into db #REGULAR (Original PR: [#798](https://github.comjoinworth/case-service/pull/798)) ([#830](https://github.comjoinworth/case-service/pull/830)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE fix: reset onboarded_businesses column data reset fix #REGULAR ([#831](https://github.comjoinworth/case-service/pull/831)) 🚂 release/v0.38.0

### 🐛 Bug

**[DOS-456](https://worth-ai.atlassian.net/browse/DOS-456) - [STAGING] Ownership fields missing in staging/unable to continue**

- 🚜🚀 FIX: STAGES-REORDER-AFTER-COMPANY-ADDITIONAL-INFO-STAGE-REMOVED #LIVE #REGULAR (Original PR: [#847](https://github.comjoinworth/case-service/pull/847)) ([#848](https://github.comjoinworth/case-service/pull/848)) 🚂 release/v0.38.0
- 🚜🚀 FIX: ADD MISSING NPI FIELDS FOR EXISTING CUSTOMER #LIVE #REGULAR (Original PR: [#845](https://github.comjoinworth/case-service/pull/845)) ([#846](https://github.comjoinworth/case-service/pull/846)) 🚂 release/v0.38.0

### ✨ Enhancement

**[DOS-342](https://worth-ai.atlassian.net/browse/DOS-342) - [FE+BE] Remove "Company Additional Info" stage from progression**

- 🚜🚀 Removed company additional information from progression #LIVE #REGULAR (Original PR: [#782](https://github.comjoinworth/case-service/pull/782)) ([#834](https://github.comjoinworth/case-service/pull/834)) 🚂 release/v0.38.0

**[DOS-412](https://worth-ai.atlassian.net/browse/DOS-412) - Provide a custom onboarding setting to allow users to submit with an unverified TIN**

- 🚜🚀 FEAT: ALLOW USERS TO SUBMIT UNVERIFIED TIN #LIVE #REGULAR (Original PR: [#795](https://github.comjoinworth/case-service/pull/795)) ([#838](https://github.comjoinworth/case-service/pull/838)) 🚂 release/v0.38.0
- 🚀 FEAT: ALLOW USERS TO SUBMIT UNVERIFIED TIN #LIVE ([#839](https://github.comjoinworth/case-service/pull/839)) 🚂 release/v0.38.0
- 🚜🚀 FEAT: ALLOW USERS TO SUBMIT UNVERIFIED TIN #LIVE #REGULAR ([#840](https://github.comjoinworth/case-service/pull/840)) 🚂 release/v0.38.0

**[PAT-39](https://worth-ai.atlassian.net/browse/PAT-39) - Enhance Bulk Upload to Include Custom Fields**

- 🚀 #LIVE feat: custom fields data in bulk process ([#829](https://github.comjoinworth/case-service/pull/829)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE fix: custom fields stage completion #REGULAR (Original PR: [#799](https://github.comjoinworth/case-service/pull/799)) ([#832](https://github.comjoinworth/case-service/pull/832)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE fix: code refactor #REGULAR (Original PR: [#812](https://github.comjoinworth/case-service/pull/812)) ([#836](https://github.comjoinworth/case-service/pull/836)) 🚂 release/v0.38.0

### 📝 Other

- 📝 Fix: build issue
- 🚜🚀 #NO_JIRA #LIVE fix: navigation issues custom fields 🚂 release/v0.38.0 #REGULAR ([#837](https://github.comjoinworth/case-service/pull/837))

## [v0.38.9](https://github.com/joinworth/case-service/compare/v0.38.3...v0.38.9) - 2025-04-02

### 🐛 Bug

**[DOS-429](https://worth-ai.atlassian.net/browse/DOS-429) - GIACT | Validation Error**

- ⚡🚀 #FAST Update logic for validating wired routing numbers in bulk route. #LIVE ([#793](https://github.comjoinworth/case-service/pull/793)) 🚂 release/v0.38.0

**[DOS-435](https://worth-ai.atlassian.net/browse/DOS-435) - Unable to select a deposit account**

- ⚡🚜🚀 #FAST: Fixed issue preventing the selection of a deposit account. #LIVE #REGULAR ([#817](https://github.comjoinworth/case-service/pull/817)) 🚂 release/v0.38.0

**[PAT-312](https://worth-ai.atlassian.net/browse/PAT-312) - Fix Customer Token Security and Access Control Issues**

- ⚡🚀 #FAST #LIVE fix: added validateDataPermission middleware ([#792](https://github.comjoinworth/case-service/pull/792)) 🚂 release/v0.38.0

### ✨ Enhancement

**[PAT-226](https://worth-ai.atlassian.net/browse/PAT-226) - [FE+BE] Purging Button in Admin**

- ⚡🚜🚀 #LIVE #FAST fix: purge by tin fixes #REGULAR ([#808](https://github.comjoinworth/case-service/pull/808)) 🚂 release/v0.38.0
- 🚀 #LIVE fix: added customer role to purge route ([#780](https://github.comjoinworth/case-service/pull/780))

### 🛑 Defect

**[PAT-342](https://worth-ai.atlassian.net/browse/PAT-342) - Custom fields navigation issue**

- 🚜🚀 #LIVE #REGULAR (cherry picked from commit 9b0558e2a19898cd22111977c4ec6a251d38d1e3) ([#815](https://github.comjoinworth/case-service/pull/815))
- 🚜🚀 #LIVE fix: back nav issue for custom fields #REGULAR ([#816](https://github.comjoinworth/case-service/pull/816)) 🚂 release/v0.38.0

### 📝 Other

**[DOS-390](https://worth-ai.atlassian.net/browse/DOS-390) - No title available**

- ⚡🚜🚀 #LIVE #FAST fix: query values fix #REGULAR ([#821](https://github.comjoinworth/case-service/pull/821)) 🚂 release/v0.38.0
- ⚡🚀 #LIVE #FAST Ensure only one set of cases exist per business ([#771](https://github.comjoinworth/case-service/pull/771)) ([#818](https://github.comjoinworth/case-service/pull/818))

## [v0.38.3](https://github.com/joinworth/case-service/compare/v0.37.8...v0.38.3) - 2025-03-25

### 📖 Story

**[DOS-246](https://worth-ai.atlassian.net/browse/DOS-246) - Add customer-level setting to enable NPI searches**

- 🚀 #LIVE - Add customer-level setting to enable NPI searches ([#718](https://github.comjoinworth/case-service/pull/718))
- 🚀 #LIVE - Add customer-level setting to enable NPI searches ([#727](https://github.comjoinworth/case-service/pull/727))

**[DOS-250](https://worth-ai.atlassian.net/browse/DOS-250) - Display NPI Information on Case Management Page**

- 🚀 #LIVE - Updated the db migration and resolve conflicts ([#728](https://github.comjoinworth/case-service/pull/728))

**[DOS-297](https://worth-ai.atlassian.net/browse/DOS-297) - [BE] Update Progression API for Plaid IDV steps**

- 🚀 progression changes for idv #LIVE ([#757](https://github.comjoinworth/case-service/pull/757))

**[DOS-346](https://worth-ai.atlassian.net/browse/DOS-346) - [BE] Add support for the `/bulk/process` (and Add Business) route to ingest deposit account information**

- 🚀 Add deposit account support to Bulk Process API (Part 4) #LIVE ([#730](https://github.comjoinworth/case-service/pull/730))

**[PAT-159](https://worth-ai.atlassian.net/browse/PAT-159) - BE | Cases service should not determine when Verdata integration runs and TIN should not be necessary to run a Verdata request**

- 🚀 #LIVE Remove fetch_public_records kafka event ([#725](https://github.comjoinworth/case-service/pull/725))

**[PAT-161](https://worth-ai.atlassian.net/browse/PAT-161) - [FE+BE] | As an Applicant, I should not always be required to enter a TIN**

- 🚀 #LIVE Allow onboarding config to drive TIN requirement ([#729](https://github.comjoinworth/case-service/pull/729))
- 🚀 #LIVE adjust const to let ([#734](https://github.comjoinworth/case-service/pull/734))

**[PAT-167](https://worth-ai.atlassian.net/browse/PAT-167) - [FE+BE] Send Invite to Applicants for Additional Information with Customizable Email Body**

- 🚀 #LIVE send additional info request ([#759](https://github.comjoinworth/case-service/pull/759))

**[PAT-254](https://worth-ai.atlassian.net/browse/PAT-254) - [BE] Request More Info Modal - Additional Pages Section**

- 🚀 #LIVE feat: Add "Section Visibility" Column to Custom Fields CSV ([#742](https://github.comjoinworth/case-service/pull/742))
- 🚀 #LIVE feat: Add "Section Visibility" Column to Custom Fields CSV ([#750](https://github.comjoinworth/case-service/pull/750))

**[PAT-394](https://worth-ai.atlassian.net/browse/PAT-394) - And invitation_id to Send Business Invite route response**

- 🚀 #LIVE fix: logical fix ([#733](https://github.comjoinworth/case-service/pull/733))

### 🐛 Bug

**[DOS-409](https://worth-ai.atlassian.net/browse/DOS-409) - Update Confidentiality Notice**

- 🚀 FIX: Update Confidentiality Notice #LIVE ([#751](https://github.comjoinworth/case-service/pull/751))

**[PAT-250](https://worth-ai.atlassian.net/browse/PAT-250) - [BE] Co-Applicant Section Completion Email Triggering on Every Edit**

- 🚀 #LIVE redis bug fixes ([#731](https://github.comjoinworth/case-service/pull/731))
- 🚀 #LIVE fix: redis check bypass ([#732](https://github.comjoinworth/case-service/pull/732))

**[PAT-284](https://worth-ai.atlassian.net/browse/PAT-284) - [Aurora][Webhook]IDV Data Missing in Business Update Webhook After Adding Beneficial Owner**

- 🚀 #LIVE fix: get owners data logic fix ([#724](https://github.comjoinworth/case-service/pull/724))

### ✨ Enhancement

**[DOS-387](https://worth-ai.atlassian.net/browse/DOS-387) - [BE] Middesk Failed TIN Orders**

- 🚩 #FLAG feat: middesk orders ([#740](https://github.comjoinworth/case-service/pull/740))
- 🚀 #LIVE fix: bulk max retries fixes ([#746](https://github.comjoinworth/case-service/pull/746))

**[DOS-395](https://worth-ai.atlassian.net/browse/DOS-395) - Remove Duplicate NAICS-MCC Mapping Files and Replace with Master List**

- 🚀 Remove-Duplicate-NAICS-MCC-Mapping-Files-and-Replace-with-Master-List #LIVE ([#737](https://github.comjoinworth/case-service/pull/737))
- 🚀 #LIVE remove-mapping-and-update (NAICS and MCC) ([#739](https://github.comjoinworth/case-service/pull/739))

### 💻 Tech Task

**[PAT-248](https://worth-ai.atlassian.net/browse/PAT-248) - [BE] | Kafka DLQ Error Monitoring & Resolution**

- 🚀 #LIVE Handle DLQ Entries ([#736](https://github.comjoinworth/case-service/pull/736))

### 📝 Other

**[DOS-381](https://worth-ai.atlassian.net/browse/DOS-381) - No title available**

- 🚀 #LIVE: Add DB migration for the Allow Unverified TIN Submissions option in Customer Data Config ([#744](https://github.comjoinworth/case-service/pull/744))
- 🚀 #LIVE: Adds migration for updating the core stage with tin submission subfield ([#745](https://github.comjoinworth/case-service/pull/745))
- 🚀 #LIVE allow skipping assertTinValid on business creation ([#749](https://github.comjoinworth/case-service/pull/749))
- 🚀 #LIVE: Share isTinRequired logic ([#753](https://github.comjoinworth/case-service/pull/753))
- 🚀 #LIVE: Make AssertTin Customer Aware ([#755](https://github.comjoinworth/case-service/pull/755))
- 🚀 #LIVE: DB migration - makes npi field hidden by default ([#760](https://github.comjoinworth/case-service/pull/760))
- 🚀 #LIVE Don't always create new cases main lol ([#764](https://github.comjoinworth/case-service/pull/764))
- 🚀 #LIVE fix: making tin null also while making status unverified ([#765](https://github.comjoinworth/case-service/pull/765))
- 🚀 #LIVE fix: progression config based updating required fields ([#766](https://github.comjoinworth/case-service/pull/766))
- 🚀 #LIVE Job to clean up unverified TINs ([#767](https://github.comjoinworth/case-service/pull/767))
- 🚀 #LIVE fix: condition update ([#769](https://github.comjoinworth/case-service/pull/769))

- 🚀 #NO_JIRA #LIVE fix: error msg ([#778](https://github.comjoinworth/case-service/pull/778))
- 🚀 #NO_JIRA #LIVE Modify constraints for info request ([#774](https://github.comjoinworth/case-service/pull/774))
- 🚀 #NO_JIRA #LIVE fix issue with no required custom fields ([#776](https://github.comjoinworth/case-service/pull/776))
- 📝 Fix: empty file change
- 🚀 #NO_JIRA #LIVE Add optional chain to get owner.title ([#735](https://github.comjoinworth/case-service/pull/735))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump axios from 1.7.4 to 1.8.2 ([#741](https://github.comjoinworth/case-service/pull/741))

**[PAT-224](https://worth-ai.atlassian.net/browse/PAT-224) - No title available**

- 🚀 #LIVE fix: stage completion logic ([#713](https://github.comjoinworth/case-service/pull/713))
- 🚀 #LIVE fix: field ids array check ([#752](https://github.comjoinworth/case-service/pull/752))

## [v0.37.8](https://github.com/joinworth/case-service/compare/v0.37.7...v0.37.8) - 2025-03-19

### 📝 Other

**[DOS-381](https://worth-ai.atlassian.net/browse/DOS-381) - No title available**

- 🚀 #LIVE Job to clean up unverified TINs ([#767](https://github.comjoinworth/case-service/pull/767))
- 🚀 #LIVE fix: condition update ([#769](https://github.comjoinworth/case-service/pull/769))

## [v0.37.7](https://github.com/joinworth/case-service/compare/v0.37.1...v0.37.7) - 2025-03-18

### 📖 Story

**[PAT-161](https://worth-ai.atlassian.net/browse/PAT-161) - [FE+BE] | As an Applicant, I should not always be required to enter a TIN**

- 🚀 #LIVE Allow onboarding config to drive TIN requirement ([#729](https://github.comjoinworth/case-service/pull/729))
- 🚀 #LIVE adjust const to let ([#734](https://github.comjoinworth/case-service/pull/734))

### 🐛 Bug

**[PAT-312](https://worth-ai.atlassian.net/browse/PAT-312) - Fix Customer Token Security and Access Control Issues**

- 🚀 #LIVE fix: added validateDataPermission middleware ([#758](https://github.comjoinworth/case-service/pull/758))

### 📝 Other

**[DOS-381](https://worth-ai.atlassian.net/browse/DOS-381) - No title available**

- 🚀 #LIVE fix: progression config based updating required fields ([#766](https://github.comjoinworth/case-service/pull/766))
- 🚀 Cherry pick #LIVE Don't always create new cases main lol
- 🚀 #LIVE fix: making tin null also while making status unverified ([#765](https://github.comjoinworth/case-service/pull/765))
- 🚀 #LIVE: Make AssertTin Customer Aware ([#755](https://github.comjoinworth/case-service/pull/755))
- 🚀 #LIVE: DB migration - makes npi field hidden by default ([#760](https://github.comjoinworth/case-service/pull/760))
- 🚀 #LIVE: Share isTinRequired logic ([#753](https://github.comjoinworth/case-service/pull/753))
- 🚀 #LIVE: Add DB migration for the Allow Unverified TIN Submissions option in Customer Data Config ([#744](https://github.comjoinworth/case-service/pull/744))
- 🚀 #LIVE: Adds migration for updating the core stage with tin submission subfield ([#745](https://github.comjoinworth/case-service/pull/745))
- 🚀 #LIVE allow skipping assertTinValid on business creation ([#749](https://github.comjoinworth/case-service/pull/749))

## [v0.37.1](https://github.com/joinworth/case-service/compare/v0.36.4...v0.37.1) - 2025-03-11

### ✨ Enhancement

**[DOS-387](https://worth-ai.atlassian.net/browse/DOS-387) - [BE] Middesk Failed TIN Orders**

- 🚩 Fix: merge conflict #FLAG feat: middesk orders ([#740](https://github.comjoinworth/case-service/pull/740))
- 🚀 #LIVE fix: bulk max retries fixes ([#746](https://github.comjoinworth/case-service/pull/746))

## [v0.36.4](https://github.com/joinworth/case-service/compare/v0.36.3...v0.36.4) - 2025-03-06

### 📖 Story

**[DOS-246](https://worth-ai.atlassian.net/browse/DOS-246) - Add customer-level setting to enable NPI searches**

- 🚀 #LIVE - Add customer-level setting to enable NPI searches ([#718](https://github.comjoinworth/case-service/pull/718))
- 🚀 #LIVE - Add customer-level setting to enable NPI searches ([#727](https://github.comjoinworth/case-service/pull/727))

**[DOS-346](https://worth-ai.atlassian.net/browse/DOS-346) - [BE] Add support for the `/bulk/process` (and Add Business) route to ingest deposit account information**

- 🚀 Add deposit account support to Bulk Process API (Part 1) #LIVE ([#702](https://github.comjoinworth/case-service/pull/702))
- 🚀 Add deposit account support to Bulk Process API (Part 2) #LIVE ([#722](https://github.comjoinworth/case-service/pull/722))
- 🚀 Add deposit account support to Bulk Process API (Part 3) #LIVE ([#723](https://github.comjoinworth/case-service/pull/723))
- 🚀 Add deposit account support to Bulk Process API (Part 4) #LIVE ([#730](https://github.comjoinworth/case-service/pull/730))

**[PAT-171](https://worth-ai.atlassian.net/browse/PAT-171) - [BE] Allow Status Change to Information Requested/Updated for Auto Approve/Reject**

- 🚀 #LIVE allow case status change ([#704](https://github.comjoinworth/case-service/pull/704))

**[PAT-175](https://worth-ai.atlassian.net/browse/PAT-175) - [FE+BE] Custom Setting - Post Submission Uploads/Edits**

- 🚀 #LIVE feat: Enable / Disable Post-Submission Editing ([#703](https://github.comjoinworth/case-service/pull/703))
- 🚀 #LIVE feat: Enable / Disable Post-Submission Editing ([#706](https://github.comjoinworth/case-service/pull/706))
- 🚀 #LIVE feat: Enable / Disable Post-Submission Editing ([#711](https://github.comjoinworth/case-service/pull/711))
- 🚀 #LIVE fix: Enable / Disable Post-Submission Editing - Restrict post-submission editing to White Label customers ([#717](https://github.comjoinworth/case-service/pull/717))

**[PAT-394](https://worth-ai.atlassian.net/browse/PAT-394) - And invitation_id to Send Business Invite route response**

- 🚀 #LIVE fix: logical fix ([#733](https://github.comjoinworth/case-service/pull/733))

### 🧰 Task

**[INFRA-125](https://worth-ai.atlassian.net/browse/INFRA-125) - fix: issue where migration script not working locally**

- 🚀 #LIVE Fix - Resolved issue with migration script not working locally and updated Dockerfile.local ([#715](https://github.comjoinworth/case-service/pull/715))

### 🐛 Bug

**[PAT-250](https://worth-ai.atlassian.net/browse/PAT-250) - [BE] Co-Applicant Section Completion Email Triggering on Every Edit**

- 🚀 #LIVE fix: purge redis keys on case submit ([#714](https://github.comjoinworth/case-service/pull/714))
- 🚀 #LIVE fix: redis delete keys ([#721](https://github.comjoinworth/case-service/pull/721))
- 🚀 #LIVE redis bug fixes ([#731](https://github.comjoinworth/case-service/pull/731))
- 🚀 #LIVE fix: redis check bypass ([#732](https://github.comjoinworth/case-service/pull/732))

**[PAT-267](https://worth-ai.atlassian.net/browse/PAT-267) - [FE+BE][HYPERCARE] Tax Integration**

- 🚀 #LIVE fix: taxation stage complete logic update ([#716](https://github.comjoinworth/case-service/pull/716))

**[PAT-271](https://worth-ai.atlassian.net/browse/PAT-271) - Do Not Allow Application Submission when Required Custom Fields Are Blank**

- 🚀 #LIVE : check custom fields stages for required fields ([#710](https://github.comjoinworth/case-service/pull/710))

**[PAT-284](https://worth-ai.atlassian.net/browse/PAT-284) - [Aurora][Webhook]IDV Data Missing in Business Update Webhook After Adding Beneficial Owner**

- 🚀 #LIVE fix: get owners data logic fix ([#724](https://github.comjoinworth/case-service/pull/724))

### 💻 Tech Task

**[DOS-334](https://worth-ai.atlassian.net/browse/DOS-334) - [BE] Time to Approval API**

- 🚀 #LIVE Time to approval stats ([#709](https://github.comjoinworth/case-service/pull/709))

**[DOS-335](https://worth-ai.atlassian.net/browse/DOS-335) - [BE] Application Rate API**

- 🚀 Application-Rate-API #LIVE ([#712](https://github.comjoinworth/case-service/pull/712))

**[DOS-336](https://worth-ai.atlassian.net/browse/DOS-336) - [BE] Team Performance API**

- 🚀 Team-Performance-API #LIVE ([#701](https://github.comjoinworth/case-service/pull/701))

**[PAT-162](https://worth-ai.atlassian.net/browse/PAT-162) - [BE] Flow Diagram in API-DOCS**

- 🚀 #LIVE feat: update business ([#708](https://github.comjoinworth/case-service/pull/708))

## [v0.36.3](https://github.com/joinworth/case-service/compare/v0.36.2...v0.36.3) - 2025-03-05

### 📖 Story

**[PAT-394](https://worth-ai.atlassian.net/browse/PAT-394) - And invitation_id to Send Business Invite route response**

- 🚀 #LIVE fix: logical fix ([#733](https://github.comjoinworth/case-service/pull/733))

## [v0.36.2](https://github.com/joinworth/case-service/compare/v0.35.7...v0.36.2) - 2025-03-03

### 📖 Story

**[PAT-171](https://worth-ai.atlassian.net/browse/PAT-171) - [BE] Allow Status Change to Information Requested/Updated for Auto Approve/Reject**

- 🚀 #LIVE allow case status change ([#704](https://github.comjoinworth/case-service/pull/704))

### 🧰 Task

**[INFRA-125](https://worth-ai.atlassian.net/browse/INFRA-125) - fix: issue where migration script not working locally**

- 🚀 #LIVE Fix - Resolved issue with migration script not working locally and updated Dockerfile.local ([#715](https://github.comjoinworth/case-service/pull/715))

### 🐛 Bug

**[PAT-267](https://worth-ai.atlassian.net/browse/PAT-267) - [FE+BE][HYPERCARE] Tax Integration**

- 🚀 #LIVE fix: taxation stage complete logic update ([#716](https://github.comjoinworth/case-service/pull/716))

### 💻 Tech Task

**[DOS-334](https://worth-ai.atlassian.net/browse/DOS-334) - [BE] Time to Approval API**

- 🚀 #LIVE Time to approval stats ([#709](https://github.comjoinworth/case-service/pull/709))

**[DOS-336](https://worth-ai.atlassian.net/browse/DOS-336) - [BE] Team Performance API**

- 🚀 Team-Performance-API #LIVE ([#701](https://github.comjoinworth/case-service/pull/701))

**[PAT-162](https://worth-ai.atlassian.net/browse/PAT-162) - [BE] Flow Diagram in API-DOCS**

- 🚀 #LIVE feat: update business ([#708](https://github.comjoinworth/case-service/pull/708))

## [v0.35.7](https://github.com/joinworth/case-service/compare/v0.35.4-HOTFIX...v0.35.7) - 2025-02-25

### 📖 Story

**[DOS-253](https://worth-ai.atlassian.net/browse/DOS-253) - [BE] Pass Banking Information to GIACT for Verification During Onboarding**

- 🚀 FIX: Updated Internal API for Get Business #LIVE ([#688](https://github.comjoinworth/case-service/pull/688))

**[DOS-256](https://worth-ai.atlassian.net/browse/DOS-256) - [BE] Set Case Status to Manual Review for Negative Results**

- 🚀 #LIVE: Sets Case Status to "Manual Review" Upon Receiving Negative Results ([#682](https://github.comjoinworth/case-service/pull/682))
- 🚀 #LIVE: Set case status to "Under Manual Review" upon receiving negative results (Part 2) ([#696](https://github.comjoinworth/case-service/pull/696))

**[DOS-318](https://worth-ai.atlassian.net/browse/DOS-318) - Worth Admin | Unhide Liveliness Check and Driver’s License options for IDV configuration**

- 🚀 FEAT: Unhide liveliness check and drivers license IDV options #LIVE ([#680](https://github.comjoinworth/case-service/pull/680))

**[DOS-358](https://worth-ai.atlassian.net/browse/DOS-358) - [Aurora] Up TIN check timeout time**

- 🚀 #LIVE Bump tin verification timeout to 40s & add test for timeout working as expected ([#684](https://github.comjoinworth/case-service/pull/684))

**[PAT-205](https://worth-ai.atlassian.net/browse/PAT-205) - [BE] Generate and Store Adverse Media Data in DB**

- 🚀 #LIVE feat: adverse media producer ([#691](https://github.comjoinworth/case-service/pull/691))
- 🚀 #LIVE fix: adverse media for bulk upload/update ([#692](https://github.comjoinworth/case-service/pull/692))

### 🧰 Task

**[INFRA-104](https://worth-ai.atlassian.net/browse/INFRA-104) - Auto approve deploy repo pr in dev**

- 🚀 #LIVE AUTO APPROVE AND MERGE ([#677](https://github.comjoinworth/case-service/pull/677))

**[INFRA-123](https://worth-ai.atlassian.net/browse/INFRA-123) - Dev Exp changes in BE and FE repos**

- 🚀 #LIVE Add dockerfile local ([#698](https://github.comjoinworth/case-service/pull/698))

### 🐛 Bug

**[DOS-324](https://worth-ai.atlassian.net/browse/DOS-324) - Include all stages in the onboarding flow and during process don't skip any stage in this case it directly take user to review screen**

- 🚀 #LIVE onboarding issue resolve ([#674](https://github.comjoinworth/case-service/pull/674))

**[DOS-326](https://worth-ai.atlassian.net/browse/DOS-326) - Business search fails when using single quote.**

- 🚀 #LIVE fix: escape ' in like query ([#675](https://github.comjoinworth/case-service/pull/675))

**[DOS-348](https://worth-ai.atlassian.net/browse/DOS-348) - [Aurora User][Hyper Care] Clicking "Review Application" in Email Prompts for Password Instead of Redirecting to Review Page**

- 🚀 #LIVE: Adds the `no_login` property when final submission email is sent ([#685](https://github.comjoinworth/case-service/pull/685))

**[DOS-349](https://worth-ai.atlassian.net/browse/DOS-349) - [Aurora User] [Hyper Care]"Continue Application" Email Button Redirects to Incorrect**

- 🚀 #LIVE - incorrect email redirect ([#693](https://github.comjoinworth/case-service/pull/693))

**[DOS-374](https://worth-ai.atlassian.net/browse/DOS-374) - Fix issue preventing users from advancing from company details page.**

- 🚀 #LIVE PULLING HOTFIX TO MAIN ([#700](https://github.comjoinworth/case-service/pull/700))

**[DOS-375](https://worth-ai.atlassian.net/browse/DOS-375) - Fix endless TIN verification loop when Kafka times out**

- 🚀 #LIVE Add KafkaToQueue & push integration_data_ready handler to us… ([#689](https://github.comjoinworth/case-service/pull/689))
- 🚀 Resolve endless TIN verification loop on Kafka timeout (Part 2) #LIVE ([#690](https://github.comjoinworth/case-service/pull/690))

**[PAT-221](https://worth-ai.atlassian.net/browse/PAT-221) - [HYPERCARE] Tax Integration**

- 🚀 #LIVE fix: added esign data in progression ([#676](https://github.comjoinworth/case-service/pull/676))

**[PAT-271](https://worth-ai.atlassian.net/browse/PAT-271) - Do Not Allow Application Submission when Required Custom Fields Are Blank**

- 🚀 #LIVE : check custom fields stages for required fields ([#710](https://github.comjoinworth/case-service/pull/710))

### ✨ Enhancement

**[PAT-152](https://worth-ai.atlassian.net/browse/PAT-152) - Skip Sections**

- 🚀 #LIVE skip sections ([#678](https://github.comjoinworth/case-service/pull/678))

**[PAT-241](https://worth-ai.atlassian.net/browse/PAT-241) - [FE+BE] View and Download Multiple Files in Custom Fields Section of Case View**

- 🚀 #LIVE: download multiple files ([#687](https://github.comjoinworth/case-service/pull/687))

### 💻 Tech Task

**[DOS-329](https://worth-ai.atlassian.net/browse/DOS-329) - [BE] Applications Received vs Approved API**

- 🚀 #LIVE Feat: Application Received VS Approved stats ([#686](https://github.comjoinworth/case-service/pull/686))

**[DOS-333](https://worth-ai.atlassian.net/browse/DOS-333) - [BE] Total Applications API**

- 🚀 Total applications API #LIVE ([#681](https://github.comjoinworth/case-service/pull/681))
- 🚀 Total applications PART 2 #LIVE ([#683](https://github.comjoinworth/case-service/pull/683))

## [v0.35.4](https://github.com/joinworth/case-service/compare/v0.35.1...v0.35.4) - 2025-02-18

### 📖 Story

**[DOS-191](https://worth-ai.atlassian.net/browse/DOS-191) - As a user, I expect that adding businesses will submit to Middesk for website.**

- 🚀 #LIVE submit website to middesk received from SERP ([#660](https://github.comjoinworth/case-service/pull/660))

**[DOS-318](https://worth-ai.atlassian.net/browse/DOS-318) - Worth Admin | Unhide Liveliness Check and Driver’s License options for IDV configuration**

- 🚀 FEAT: Unhide liveliness check and drivers license IDV options #LIVE ([#680](https://github.comjoinworth/case-service/pull/680))

**[DOS-358](https://worth-ai.atlassian.net/browse/DOS-358) - [Aurora] Up TIN check timeout time**

- 🚀 #LIVE Bump tin verification timeout to 40s & add test for timeout working as expected ([#684](https://github.comjoinworth/case-service/pull/684))

**[PAT-200](https://worth-ai.atlassian.net/browse/PAT-200) - Tax POC Integration**

- 🚀 #LIVE feat: updating taxes core config migration script ([#667](https://github.comjoinworth/case-service/pull/667))

### 🧰 Task

**[INFRA-104](https://worth-ai.atlassian.net/browse/INFRA-104) - Auto approve deploy repo pr in dev**

- 🚀 #LIVE AUTO APPROVE AND MERGE ([#677](https://github.comjoinworth/case-service/pull/677))

### 🐛 Bug

**[DOS-275](https://worth-ai.atlassian.net/browse/DOS-275) - [Easy flow] During onboarding with easyflow/testmode the flow get break when user proceeded from banking screen**

- 🚀 #LIVE Fix Business Not Verified ([#671](https://github.comjoinworth/case-service/pull/671))

**[DOS-324](https://worth-ai.atlassian.net/browse/DOS-324) - Include all stages in the onboarding flow and during process don't skip any stage in this case it directly take user to review screen**

- 🚀 #LIVE onboarding issue resolve ([#674](https://github.comjoinworth/case-service/pull/674))

**[DOS-326](https://worth-ai.atlassian.net/browse/DOS-326) - Business search fails when using single quote.**

- 🚀 #LIVE fix: escape ' in like query ([#675](https://github.comjoinworth/case-service/pull/675))

**[DOS-375](https://worth-ai.atlassian.net/browse/DOS-375) - Fix endless TIN verification loop when Kafka times out**

- 🚀 #LIVE Add KafkaToQueue & push integration_data_ready handler to us… ([#689](https://github.comjoinworth/case-service/pull/689))
- 🚀 Resolve endless TIN verification loop on Kafka timeout (Part 2) #LIVE ([#690](https://github.comjoinworth/case-service/pull/690))

**[PAT-221](https://worth-ai.atlassian.net/browse/PAT-221) - [HYPERCARE] Tax Integration**

- 🚀 #LIVE fix: added esign data in progression ([#676](https://github.comjoinworth/case-service/pull/676))

### ✨ Enhancement

**[PAT-152](https://worth-ai.atlassian.net/browse/PAT-152) - Skip Sections**

- 🚀 #LIVE skip sections ([#670](https://github.comjoinworth/case-service/pull/670))
- 🚀 #LIVE skip sections ([#672](https://github.comjoinworth/case-service/pull/672))
- 🚀 #LIVE skip sections ([#673](https://github.comjoinworth/case-service/pull/673))
- 🚀 #LIVE skip sections ([#678](https://github.comjoinworth/case-service/pull/678))

## [v0.35.1](https://github.com/joinworth/case-service/compare/v0.34.3...v0.35.1) - 2025-02-13

### 📖 Story

**[DOS-358](https://worth-ai.atlassian.net/browse/DOS-358) - [Aurora] Up TIN check timeout time**

- 🚀 #LIVE Bump tin verification timeout to 40s & add test for timeout working as expected ([#684](https://github.comjoinworth/case-service/pull/684))

## [v0.34.3](https://github.com/joinworth/case-service/compare/v0.34.1...v0.34.3) - 2025-02-10

### 📖 Story

**[DOS-191](https://worth-ai.atlassian.net/browse/DOS-191) - As a user, I expect that adding businesses will submit to Middesk for website.**

- 🚀 #LIVE submit website to middesk received from SERP ([#660](https://github.comjoinworth/case-service/pull/660))

**[DOS-252](https://worth-ai.atlassian.net/browse/DOS-252) - [BE+FE] Enable GIACT Toggle in Banking Tab of Custom Onboarding**

- 🚀 Adding GIACT feature setting for customer (Part 1) #LIVE ([#669](https://github.comjoinworth/case-service/pull/669))

### 🧰 Task

**[INFRA-100](https://worth-ai.atlassian.net/browse/INFRA-100) - Add LD test action in svc repo**

- 🚀 #LIVE CREATE FIND FLAG ACTION ([#657](https://github.comjoinworth/case-service/pull/657))

**[INFRA-103](https://worth-ai.atlassian.net/browse/INFRA-103) - Add author in BE deploy action title**

- 🚀 #LIVE Add author in title ([#663](https://github.comjoinworth/case-service/pull/663))

**[INFRA-69](https://worth-ai.atlassian.net/browse/INFRA-69) - Add GitHub Actions Workflow for Automated Tag Creation**

- 🚀 #LIVE Add GitHub Actions Workflow for Automated Tag Creation ([#647](https://github.comjoinworth/case-service/pull/647))

### 🐛 Bug

**[DOS-275](https://worth-ai.atlassian.net/browse/DOS-275) - [Easy flow] During onboarding with easyflow/testmode the flow get break when user proceeded from banking screen**

- 🚀 #LIVE Fix TIN bypass easyflow ([#666](https://github.comjoinworth/case-service/pull/666))
- 🚀 #LIVE Fix Business Not Verified ([#671](https://github.comjoinworth/case-service/pull/671))

**[DOS-280](https://worth-ai.atlassian.net/browse/DOS-280) - No title available**

- 🚀 #LIVE fix: address_apartment in public records request ([#658](https://github.comjoinworth/case-service/pull/658))

**[PAT-190](https://worth-ai.atlassian.net/browse/PAT-190) - Webhooks | Error fetching webhook data on PROD**

- 🚀 #LIVE fix: data passing issue fix ([#659](https://github.comjoinworth/case-service/pull/659))

**[PAT-212](https://worth-ai.atlassian.net/browse/PAT-212) - No title available**

- 🚀 #LIVE fix: decimal places validation ([#664](https://github.comjoinworth/case-service/pull/664))

### ✨ Enhancement

**[DOS-209](https://worth-ai.atlassian.net/browse/DOS-209) - [FE+BE] [Custom Onboarding] Update Processing History**

- 🚀 FEAT: Update processing history stage config #LIVE ([#662](https://github.comjoinworth/case-service/pull/662))

**[PAT-152](https://worth-ai.atlassian.net/browse/PAT-152) - Skip Sections**

- 🚀 #LIVE skip sections ([#678](https://github.comjoinworth/case-service/pull/678))
- 🚀 #LIVE skip sections ([#670](https://github.comjoinworth/case-service/pull/670))
- 🚀 #LIVE skip sections ([#672](https://github.comjoinworth/case-service/pull/672))
- 🚀 #LIVE skip sections ([#673](https://github.comjoinworth/case-service/pull/673))

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: dlq fix for webhook data fetching ([#661](https://github.comjoinworth/case-service/pull/661))

**[PAT-184](https://worth-ai.atlassian.net/browse/PAT-184) - No title available**

- 🚀 #LIVE feat: multiple file upload ([#665](https://github.comjoinworth/case-service/pull/665))
- 🚀 #LIVE multiple file upload: add default rule ([#668](https://github.comjoinworth/case-service/pull/668))

## [v0.34.1](https://github.com/joinworth/case-service/compare/v0.0.121...v0.34.1) - 2025-01-30

### 🧰 Task

**[INFRA-100](https://worth-ai.atlassian.net/browse/INFRA-100) - Add LD test action in svc repo**

- 🚀 #LIVE CREATE FIND FLAG ACTION ([#657](https://github.comjoinworth/case-service/pull/657))

**[INFRA-103](https://worth-ai.atlassian.net/browse/INFRA-103) - Add author in BE deploy action title**

- 🚀 #LIVE Add author in title ([#663](https://github.comjoinworth/case-service/pull/663))

**[INFRA-69](https://worth-ai.atlassian.net/browse/INFRA-69) - Add GitHub Actions Workflow for Automated Tag Creation**

- 🚀 #LIVE Add GitHub Actions Workflow for Automated Tag Creation ([#647](https://github.comjoinworth/case-service/pull/647))

### 🐛 Bug

**[DOS-280](https://worth-ai.atlassian.net/browse/DOS-280) - No title available**

- 🚀 #LIVE fix: address_apartment in public records request ([#658](https://github.comjoinworth/case-service/pull/658))

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: dlq fix for webhook data fetching ([#661](https://github.comjoinworth/case-service/pull/661))

## [v0.0.121](https://github.com/joinworth/case-service/compare/v0.0.119...v0.0.121) - 2025-01-28

### 📖 Story

**[DOS-124](https://worth-ai.atlassian.net/browse/DOS-124) - Linking Multiple Accounts of Different Banks**

- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 1 ([#618](https://github.comjoinworth/case-service/pull/618))

**[PAT-145](https://worth-ai.atlassian.net/browse/PAT-145) - [Custom Fields] Enhancement to Separate Pages for Custom Field Onboarding Steps**

- 🚀 #LIVE fix: sequence of custom fields in progression ([#626](https://github.comjoinworth/case-service/pull/626))
- 🚀 #LIVE fix: custom field section order ([#627](https://github.comjoinworth/case-service/pull/627))
- 🚀 #LIVE fix: fetch only last template stages ([#630](https://github.comjoinworth/case-service/pull/630))

**[PAT-160](https://worth-ai.atlassian.net/browse/PAT-160) - BE | TIN should not be necessary to submit to Middesk**

- 🚀 #LIVE feat: tin is optional for middesk ([#624](https://github.comjoinworth/case-service/pull/624))
- 🚀 #LIVE fix: easyflow fix ([#633](https://github.comjoinworth/case-service/pull/633))
- 🚀 #LIVE fix: webhook ([#634](https://github.comjoinworth/case-service/pull/634))

### 🧰 Task

**[INFRA-91](https://worth-ai.atlassian.net/browse/INFRA-91) - Quarterly hotfix report action**

- 🚀 #LIVE Hotfix Report Action ([#628](https://github.comjoinworth/case-service/pull/628))
- 🚀 #LIVE Update hotfix-report.yaml ([#629](https://github.comjoinworth/case-service/pull/629))

**[INFRA-98](https://worth-ai.atlassian.net/browse/INFRA-98) - Update docker-compose in all svc**

- 🚀 #LIVE Update docker compose ([#646](https://github.comjoinworth/case-service/pull/646))

### 🐛 Bug

**[DOS-210](https://worth-ai.atlassian.net/browse/DOS-210) - [FE+BE] [Custom Onboarding] Hide/Show Fields**

- 🚀 Custom Onboarding - Hide/Show Fields (Part 1) #LIVE ([#636](https://github.comjoinworth/case-service/pull/636))

**[DOS-221](https://worth-ai.atlassian.net/browse/DOS-221) - [Custom Onboarding] Fix Ownership Field Logic**

- 🔥⚡🚀 add owners api update #HOTFIX #LIVE #FAST ([#622](https://github.comjoinworth/case-service/pull/622))

**[PAT-157](https://worth-ai.atlassian.net/browse/PAT-157) - Email notification not triggered when co-applicant updates custom fields.**

- 🚀 #LIVE fix: custom field section complete email ([#619](https://github.comjoinworth/case-service/pull/619))

**[PAT-187](https://worth-ai.atlassian.net/browse/PAT-187) - [IMP] Webhooks | Error Customer ID is required on PROD**

- 🚀 #LIVE fix: customer-id required bug ([#644](https://github.comjoinworth/case-service/pull/644))
- 🚀 #LIVE fix: adding business-id ([#649](https://github.comjoinworth/case-service/pull/649))
- 🚀 #LIVE fix: schema ([#651](https://github.comjoinworth/case-service/pull/651))
- 🚀 #LIVE fix: payload update ([#654](https://github.comjoinworth/case-service/pull/654))

**[PAT-190](https://worth-ai.atlassian.net/browse/PAT-190) - Webhooks | Error fetching webhook data on PROD**

- 🚀 #LIVE fix: data passing issue fix ([#659](https://github.comjoinworth/case-service/pull/659))

**[PAT-191](https://worth-ai.atlassian.net/browse/PAT-191) - [IMP] Subscriptions | Error Business name is required on PROD**

- 🚀 #LIVE fix: business_name required dlq bug ([#645](https://github.comjoinworth/case-service/pull/645))

**[PAT-216](https://worth-ai.atlassian.net/browse/PAT-216) - [FE+BE] Error on "Accounts Receivable & Accounts Payable Aging Reports" Page When Clicking Continue Without Uploading**

- 🚀 #LIVE fix: Fix error on "Accounts Receivable & Accounts Payable Aging Reports" page when continuing without uploading ([#650](https://github.comjoinworth/case-service/pull/650))
- 🚀 #LIVE fix: Fix error on "Accounts Receivable & Accounts Payable Aging Reports" page when continuing without uploading ([#652](https://github.comjoinworth/case-service/pull/652))
- 🚀 #LIVE fix: Fix error on "Accounts Receivable & Accounts Payable Aging Reports" page when continuing without uploading ([#655](https://github.comjoinworth/case-service/pull/655))

**[PAT-223](https://worth-ai.atlassian.net/browse/PAT-223) - [Aurora CX]There is an issue with the Submit button on the Review and Submit page.**

- 🚀 #LIVE fix: query values fix ([#656](https://github.comjoinworth/case-service/pull/656))

### ✨ Enhancement

**[DOS-161](https://worth-ai.atlassian.net/browse/DOS-161) - Update the progression API to include OCR for taxes**

- 🚀 UPDATE PROGRESSION API FOR OCR #LIVE PART 1 ([#613](https://github.comjoinworth/case-service/pull/613))
- 🚀 #LIVE business taxes stage ([#617](https://github.comjoinworth/case-service/pull/617))

**[DOS-198](https://worth-ai.atlassian.net/browse/DOS-198) - [FE+BE] Customize Beneficial Owner Definition for Fairwinds**

- 🚀 feat: change in owner ship percentage #LIVE ([#625](https://github.comjoinworth/case-service/pull/625))

**[DOS-237](https://worth-ai.atlassian.net/browse/DOS-237) - [FE+BE] Update Processing History - Point of Sale Volume**

- 🚀 Update Processing History - POS Volume (Part 1) #LIVE ([#620](https://github.comjoinworth/case-service/pull/620))
- 🚀 Update Processing History - POS Volume (Part 2) #LIVE ([#621](https://github.comjoinworth/case-service/pull/621))
- 🚀 Update Processing History - POS Volume (Part 3) #LIVE ([#631](https://github.comjoinworth/case-service/pull/631))

**[PAT-149](https://worth-ai.atlassian.net/browse/PAT-149) - Send Processing Statements Data via Webhook**

- 🔥🚀 processing statements webhook #HOTFIX_PULL_TO_MAIN #LIVE ([#640](https://github.comjoinworth/case-service/pull/640))
- 🚀 #LIVE filter processing statements ([#641](https://github.comjoinworth/case-service/pull/641))

**[PAT-174](https://worth-ai.atlassian.net/browse/PAT-174) - FE + BE | Equifax Vantage Score - Customer Setting**

- 🚀 #LIVE feat: equifax credit score customer setting ([#632](https://github.comjoinworth/case-service/pull/632))

**[PAT-40](https://worth-ai.atlassian.net/browse/PAT-40) - FE + BE | Ability to Delete Custom Field CSV for Enterprise Customers**

- 🚀 #LIVE delete custom fields template ([#623](https://github.comjoinworth/case-service/pull/623))

### 🧪 Spike

**[PAT-120](https://worth-ai.atlassian.net/browse/PAT-120) - Onboarding API Sequence Diagram**

- 🚩 #FLAG feat: add business route ([#606](https://github.comjoinworth/case-service/pull/606))

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: error message ([#653](https://github.comjoinworth/case-service/pull/653))

## [v0.0.119](https://github.com/joinworth/case-service/compare/v0.0.116...v0.0.119) - 2025-01-24

### 🐛 Bug

**[PAT-187](https://worth-ai.atlassian.net/browse/PAT-187) - [IMP] Webhooks | Error Customer ID is required on PROD**

- 🚀 #LIVE fix: adding business-id ([#649](https://github.comjoinworth/case-service/pull/649))
- 🚀 #LIVE fix: schema ([#651](https://github.comjoinworth/case-service/pull/651))
- 🚀 #LIVE fix: payload update ([#654](https://github.comjoinworth/case-service/pull/654))
- 🚀 #LIVE fix: customer-id required bug ([#644](https://github.comjoinworth/case-service/pull/644))

**[PAT-223](https://worth-ai.atlassian.net/browse/PAT-223) - [Aurora CX]There is an issue with the Submit button on the Review and Submit page.**

- 🚀 #LIVE fix: query values fix ([#656](https://github.comjoinworth/case-service/pull/656))

### ✨ Enhancement

**[DOS-198](https://worth-ai.atlassian.net/browse/DOS-198) - [FE+BE] Customize Beneficial Owner Definition for Fairwinds**

- 🚀 feat: change in owner ship percentage #LIVE ([#625](https://github.comjoinworth/case-service/pull/625))

**[DOS-237](https://worth-ai.atlassian.net/browse/DOS-237) - [FE+BE] Update Processing History - Point of Sale Volume**

- 🚀 Update Processing History - POS Volume (Part 1) #LIVE ([#620](https://github.comjoinworth/case-service/pull/620))
- 🚀 Update Processing History - POS Volume (Part 2) #LIVE ([#621](https://github.comjoinworth/case-service/pull/621))
- 🚀 Update Processing History - POS Volume (Part 3) #LIVE ([#631](https://github.comjoinworth/case-service/pull/631))

**[PAT-149](https://worth-ai.atlassian.net/browse/PAT-149) - Send Processing Statements Data via Webhook**

- 🚀 #LIVE filter processing statements ([#641](https://github.comjoinworth/case-service/pull/641))

**[PAT-40](https://worth-ai.atlassian.net/browse/PAT-40) - FE + BE | Ability to Delete Custom Field CSV for Enterprise Customers**

- 🚀 #LIVE delete custom fields template ([#623](https://github.comjoinworth/case-service/pull/623))

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: error message ([#653](https://github.comjoinworth/case-service/pull/653))

## [v0.0.116](https://github.com/joinworth/case-service/compare/v0.0.115...v0.0.116) - 2025-01-21

### 📖 Story

**[PAT-160](https://worth-ai.atlassian.net/browse/PAT-160) - BE | TIN should not be necessary to submit to Middesk**

- 🔥🚀 #LIVE fix: webhook error ([#634](https://github.comjoinworth/case-service/pull/634)) #HOTFIX ([#643](https://github.comjoinworth/case-service/pull/643))

## [v0.0.115](https://github.com/joinworth/case-service/compare/v0.0.114...v0.0.115) - 2025-01-17

### ✨ Enhancement

**[PAT-149](https://worth-ai.atlassian.net/browse/PAT-149) - Send Processing Statements Data via Webhook**

- ⚡🚀 processing statements webhook #LIVE #FAST ([#638](https://github.comjoinworth/case-service/pull/638))

## [v0.0.114](https://github.com/joinworth/case-service/compare/v0.0.113...v0.0.114) - 2025-01-14

### 📖 Story

**[DOS-124](https://worth-ai.atlassian.net/browse/DOS-124) - Linking Multiple Accounts of Different Banks**

- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 1 ([#618](https://github.comjoinworth/case-service/pull/618))

**[PAT-145](https://worth-ai.atlassian.net/browse/PAT-145) - [Custom Fields] Enhancement to Separate Pages for Custom Field Onboarding Steps**

- 🚀 #LIVE fix: sequence of custom fields in progression ([#626](https://github.comjoinworth/case-service/pull/626))
- 🚀 #LIVE fix: fetch only last template stages ([#630](https://github.comjoinworth/case-service/pull/630))
- 🚀 #LIVE feat: section name for custom fields ([#611](https://github.comjoinworth/case-service/pull/611))

### 🐛 Bug

**[DOS-109](https://worth-ai.atlassian.net/browse/DOS-109) - Incorrect Screen Redirect Post-Plaid IDV Failure During Onboarding**

- 🚀 #LIVE submit case status ([#612](https://github.comjoinworth/case-service/pull/612))

**[DOS-221](https://worth-ai.atlassian.net/browse/DOS-221) - [Custom Onboarding] Fix Ownership Field Logic**

- 🔥⚡🚀 add owners api update #HOTFIX #LIVE #FAST ([#622](https://github.comjoinworth/case-service/pull/622))

### 🧪 Spike

**[PAT-120](https://worth-ai.atlassian.net/browse/PAT-120) - Onboarding API Sequence Diagram**

- 🚩 #FLAG feat: add business route ([#606](https://github.comjoinworth/case-service/pull/606))

### 📝 Other

- 📝 Fix: section order

## [v0.0.113](https://github.com/joinworth/case-service/compare/v0.0.112...v0.0.113) - 2025-01-14

### 📖 Story

**[PAT-145](https://worth-ai.atlassian.net/browse/PAT-145) - [Custom Fields] Enhancement to Separate Pages for Custom Field Onboarding Steps**

- 🚀 #LIVE fix: sequence of custom fields in progression ([#626](https://github.comjoinworth/case-service/pull/626))
- 🚀 #LIVE fix: fetch only last template stages ([#630](https://github.comjoinworth/case-service/pull/630))

### 📝 Other

- 📝 Fix: section order

## [v0.0.112](https://github.com/joinworth/case-service/compare/v0.0.110...v0.0.112) - 2025-01-13

### 🐛 Bug

**[DOS-221](https://worth-ai.atlassian.net/browse/DOS-221) - [Custom Onboarding] Fix Ownership Field Logic**

- 🔥⚡🚀 add owners api update #HOTFIX #LIVE #FAST ([#622](https://github.comjoinworth/case-service/pull/622))

## [v0.0.110](https://github.com/joinworth/case-service/compare/v0.0.109...v0.0.110) - 2024-12-26

### 📖 Story

**[DOS-135](https://worth-ai.atlassian.net/browse/DOS-135) - Reflect Worth Admin Configurations (for page/fields) to Custom Onboarding flow**

- 🚀 UPDATE PROGRESSION API #LIVE ([#601](https://github.comjoinworth/case-service/pull/601))

### 🧰 Task

**[INFRA-88](https://worth-ai.atlassian.net/browse/INFRA-88) - No title available**

- 🚀 #LIVE CORS QA ENV ([#600](https://github.comjoinworth/case-service/pull/600))

### 🐛 Bug

**[DOS-172](https://worth-ai.atlassian.net/browse/DOS-172) - Public Records not populating**

- 🚀 PUBLIC RECORDS NOT POPULATING #LIVE ([#602](https://github.comjoinworth/case-service/pull/602))

### ✨ Enhancement

**[PAT-44](https://worth-ai.atlassian.net/browse/PAT-44) - [Custom Fields] Separate Pages for Custom Field Onboarding Steps**

- 🚀 #LIVE feat: dynamic stages custom fields ([#586](https://github.comjoinworth/case-service/pull/586))
- 🚀 #LIVE fix: custom fields stage completion logic ([#607](https://github.comjoinworth/case-service/pull/607))
- 🚀 #LIVE fix: stage completion ([#609](https://github.comjoinworth/case-service/pull/609))

### 🧪 Spike

**[PAT-120](https://worth-ai.atlassian.net/browse/PAT-120) - Onboarding API Sequence Diagram**

- 🚀 #LIVE fix: api updation as per requirement ([#603](https://github.comjoinworth/case-service/pull/603))

### 💻 Tech Task

**[DOS-171](https://worth-ai.atlassian.net/browse/DOS-171) - Connect OCR statements work with custom onboarding**

- 🚀 processing history #LIVE ([#604](https://github.comjoinworth/case-service/pull/604))

### 📝 Other

- 🚀 #NO_JIRA: UPDATE DEFAULT STATUS FOR STAGE FIELDS #LIVE ([#605](https://github.comjoinworth/case-service/pull/605))
- 🚀 #NO_JIRA #LIVE fix: schema ([#608](https://github.comjoinworth/case-service/pull/608))
- 🚀 #NO_JIRA #LIVE: add null check in getCaseId ([#610](https://github.comjoinworth/case-service/pull/610))

**[PAT-77](https://worth-ai.atlassian.net/browse/PAT-77) - No title available**

- 🚀 feat: Case Status Issue for Applicant Invitee flow #LIVE ([#599](https://github.comjoinworth/case-service/pull/599))

## [v0.0.109](https://github.com/joinworth/case-service/compare/v0.0.108...v0.0.109) - 2024-12-30

### 📖 Story

**[DOS-135](https://worth-ai.atlassian.net/browse/DOS-135) - Reflect Worth Admin Configurations (for page/fields) to Custom Onboarding flow**

- 🚀 UPDATE PROGRESSION API #LIVE ([#601](https://github.comjoinworth/case-service/pull/601))

### 💻 Tech Task

**[DOS-171](https://worth-ai.atlassian.net/browse/DOS-171) - Connect OCR statements work with custom onboarding**

- 🚀 processing history #LIVE ([#604](https://github.comjoinworth/case-service/pull/604))

### 📝 Other

- 🚀 #NO_JIRA: UPDATE DEFAULT STATUS FOR STAGE FIELDS #LIVE ([#605](https://github.comjoinworth/case-service/pull/605))

## [v0.0.108](https://github.com/joinworth/case-service/compare/v0.0.107...v0.0.108) - 2024-12-18

### 📖 Story

**[DOS-22](https://worth-ai.atlassian.net/browse/DOS-22) - Create Risk Case and Notification Alert for Low-to-High Score (risk) Movement After Score Refresh**

- 🚀 #LIVE feat: add risk alert on low to high score change ([#557](https://github.comjoinworth/case-service/pull/557))

**[DOS-67](https://worth-ai.atlassian.net/browse/DOS-67) - [BE] Configure Onboarding for Enterprise Customers**

- 🚀 Migration And Progression API changes #LIVE ([#537](https://github.comjoinworth/case-service/pull/537))
- 🚀 Fix progression API #LIVE ([#549](https://github.comjoinworth/case-service/pull/549))
- 🚀 fix: progression api #LIVE ([#550](https://github.comjoinworth/case-service/pull/550))
- 🚀 SUBTASK: FEAT: Onboarding page config API #LIVE ([#545](https://github.comjoinworth/case-service/pull/545))
- 🚀 #LIVE issues fix ([#553](https://github.comjoinworth/case-service/pull/553))

**[DOS-98](https://worth-ai.atlassian.net/browse/DOS-98) - Add a custom step for OCR processing statements**

- 🚀 #LIVE feat: change migration file and change default onboarding status ([#570](https://github.comjoinworth/case-service/pull/570))

**[PAT-55](https://worth-ai.atlassian.net/browse/PAT-55) - [FE+BE] Invite Co-Applicant to Onboarding Form with Full Access**

- 🚀 #LIVE feat: invite co applicant ([#533](https://github.comjoinworth/case-service/pull/533))
- 🚀 #LIVE fix: accept invite API for standalone applicant ([#548](https://github.comjoinworth/case-service/pull/548))
- 🚩 #FLAG fix: co applicant feature flag ([#576](https://github.comjoinworth/case-service/pull/576))
- 🚀 #LIVE fix: insert case_id in data_invites table ([#575](https://github.comjoinworth/case-service/pull/575))

**[PAT-57](https://worth-ai.atlassian.net/browse/PAT-57) - [FE + BE] Review and Submit Application with Submission Permissions**

- 🚀 #LIVE feat: review and Submit Application with Submission Permissions ([#558](https://github.comjoinworth/case-service/pull/558))

**[PAT-58](https://worth-ai.atlassian.net/browse/PAT-58) - [FE+BE] Manage Invitee and Link Expiry**

- 🚀 #LIVE Manage Invitee and Link Expiry ([#573](https://github.comjoinworth/case-service/pull/573))
- 🚀 Manage Invitee and Link Expiry #LIVE ([#578](https://github.comjoinworth/case-service/pull/578))
- 🚀 #LIVE Invitee and invitee expiry ([#582](https://github.comjoinworth/case-service/pull/582))
- 🚀 #LIVE fix: query ([#584](https://github.comjoinworth/case-service/pull/584))
- 🚀 #LIVE feat: putting behind feature flag ([#588](https://github.comjoinworth/case-service/pull/588))
- 🚀 Manage Invitee and Link Expiry - BUG FIXES #LIVE ([#589](https://github.comjoinworth/case-service/pull/589))
- 🚩 #FLAG fix: revoked status fix ([#590](https://github.comjoinworth/case-service/pull/590))
- 🚩 Manage Invitee and Link Expiry - BUG FIX #FLAG ([#593](https://github.comjoinworth/case-service/pull/593))
- 🚀 Rate-Limiter #LIVE ([#580](https://github.comjoinworth/case-service/pull/580))
- 🚩 Manage Invitee and Link Expiry - BUG FIX #FLAG ([#597](https://github.comjoinworth/case-service/pull/597))
- 🚩 Revert token config co applicant invite email token life seconds #FLAG ([#598](https://github.comjoinworth/case-service/pull/598))

**[PAT-69](https://worth-ai.atlassian.net/browse/PAT-69) - [BE] Send Emails When Sections Are Completed**

- 🚀 #LIVE feat: co-applicants email ([#567](https://github.comjoinworth/case-service/pull/567))
- 🚀 #LIVE fix: fixed the kafka event for section_completed event ([#572](https://github.comjoinworth/case-service/pull/572))

### 🧰 Task

**[INFRA-84](https://worth-ai.atlassian.net/browse/INFRA-84) - setup qa env**

- 🚀 #LIVE Setup QA env ([#561](https://github.comjoinworth/case-service/pull/561))

**[INFRA-85](https://worth-ai.atlassian.net/browse/INFRA-85) - Add username in pr desc for backend pipelines**

- 🚀 #LIVE Add username in pr desc ([#565](https://github.comjoinworth/case-service/pull/565))

### 🐛 Bug

**[DOS-90](https://worth-ai.atlassian.net/browse/DOS-90) - Document Upload issues / Duplicate Cases Created**

- 🚀 #LIVE fix: case creation side effects only after middesk verification ([#556](https://github.comjoinworth/case-service/pull/556))
- 🚀 #LIVE fix: case creation side effects only after middesk verification Part 2 ([#568](https://github.comjoinworth/case-service/pull/568))
- 🚀 #LIVE fix: 2 cases were created (for customer invitee) which are visible under Customer portal ([#581](https://github.comjoinworth/case-service/pull/581))

**[DOS-91](https://worth-ai.atlassian.net/browse/DOS-91) - Unable to purge records when custom fields are filled**

- 🚀 #LIVE fix: fk delete rule updated ([#563](https://github.comjoinworth/case-service/pull/563))

**[DOS-94](https://worth-ai.atlassian.net/browse/DOS-94) - Income Displayed as Negative in Income vs. Expenses Chart**

- 🚀 FIXED NEGATIVE VALUE FROM INCOME CHART 360 REPORT #LIVE ([#583](https://github.comjoinworth/case-service/pull/583))

**[PAT-106](https://worth-ai.atlassian.net/browse/PAT-106) - DBA and Legal Name don't appear to be set properly**

- 🚀 #LIVE fix: duplicate business name ([#554](https://github.comjoinworth/case-service/pull/554))

**[PAT-137](https://worth-ai.atlassian.net/browse/PAT-137) - Business addresses are only being sent in webhook if mailing address is filled**

- 🚀 #LIVE fix: business address insertion fix ([#595](https://github.comjoinworth/case-service/pull/595))

**[PAT-51](https://worth-ai.atlassian.net/browse/PAT-51) - Unable to progress in onboarding with feature flag for business matching enabled**

- 🚩 enforce ownership #FLAG ([#531](https://github.comjoinworth/case-service/pull/531))
- 🚩 #FLAG : Fix owner_email & owner_id response ([#544](https://github.comjoinworth/case-service/pull/544))

### ✨ Enhancement

**[DOS-163](https://worth-ai.atlassian.net/browse/DOS-163) - Feature flag to bypass IDV**

- 🚩 #FLAG feat: bypass ownership for aurora ([#585](https://github.comjoinworth/case-service/pull/585))

**[PAT-124](https://worth-ai.atlassian.net/browse/PAT-124) - Support is corporation public flag**

- 🚩 #FLAG: feat: add corporation type in business updated event payload ([#574](https://github.comjoinworth/case-service/pull/574))

**[PAT-38](https://worth-ai.atlassian.net/browse/PAT-38) - [FE +BE] [Custom Fields] Field Descriptions Not Displayed in Production**

- 🚀 #LIVE implement custom field description ([#541](https://github.comjoinworth/case-service/pull/541))

**[PAT-97](https://worth-ai.atlassian.net/browse/PAT-97) - Include entity type and business formation date in webhook for business.updated**

- 🚩 #FLAG : formation date, entity type ([#547](https://github.comjoinworth/case-service/pull/547))

### 💻 Tech Task

**[DOS-117](https://worth-ai.atlassian.net/browse/DOS-117) - Update Lightning Verify copy for emails**

- 🚀 #LIVE fix: instant mail for lightning ([#552](https://github.comjoinworth/case-service/pull/552))

### 📝 Other

**[DOS-84](https://worth-ai.atlassian.net/browse/DOS-84) - No title available**

- 🚀 #LIVE: hotfixes for multiple case creation validate fail ([#539](https://github.comjoinworth/case-service/pull/539))

- 🚀 #NO_JIRA #LIVE fix: transaction fix ([#536](https://github.comjoinworth/case-service/pull/536))
- 🚀 #NO_JIRA #LIVE ZoomInfo/OC - Handle missing entries in business_names or business_addresses ([#538](https://github.comjoinworth/case-service/pull/538))
- 🚀 #NO_JIRA #LIVE fix: invitation status typo ([#540](https://github.comjoinworth/case-service/pull/540))
- 🚀 #NO_JIRA #LIVE fix: mailing address and facts issue fix ([#543](https://github.comjoinworth/case-service/pull/543))
- 🚀 #NO_JIRA #LIVE fix: break statement missing ([#555](https://github.comjoinworth/case-service/pull/555))
- 🚀 #NO_JIRA #LIVE feat: qa-env-kafka-configs ([#560](https://github.comjoinworth/case-service/pull/560))
- 🚀 #NO_JIRA #LIVE feat: kafka dlq topic ([#562](https://github.comjoinworth/case-service/pull/562))
- 🚀 #NO_JIRA #LIVE feat: resend invitation for lightning ([#566](https://github.comjoinworth/case-service/pull/566))
- 🚀 #NO_JIRA #LIVE fix: var declaration from const to let ([#571](https://github.comjoinworth/case-service/pull/571))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump cross-spawn from 7.0.3 to 7.0.6 ([#569](https://github.comjoinworth/case-service/pull/569))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump path-to-regexp and express ([#577](https://github.comjoinworth/case-service/pull/577))

**[PAT-77](https://worth-ai.atlassian.net/browse/PAT-77) - No title available**

- 🚀 feat: [Custom Fields] Update Boolean Field #LIVE ([#596](https://github.comjoinworth/case-service/pull/596))

## [v0.0.107](https://github.com/joinworth/case-service/compare/v0.0.106...v0.0.107) - 2024-12-13

### 🐛 Bug

**[PAT-137](https://worth-ai.atlassian.net/browse/PAT-137) - Business addresses are only being sent in webhook if mailing address is filled**

- 🚀 #LIVE fix: business address insertion fix ([#595](https://github.comjoinworth/case-service/pull/595))

## [v0.0.106](https://github.com/joinworth/case-service/compare/v0.0.105...v0.0.106) - 2024-12-11

### ✨ Enhancement

**[DOS-163](https://worth-ai.atlassian.net/browse/DOS-163) - Feature flag to bypass IDV**

- 🚩 #FLAG feat: bypass ownership for aurora ([#585](https://github.comjoinworth/case-service/pull/585))

## [v0.0.105](https://github.com/joinworth/case-service/compare/v0.0.104...v0.0.105) - 2024-12-10

### 🐛 Bug

**[DOS-90](https://worth-ai.atlassian.net/browse/DOS-90) - Document Upload issues / Duplicate Cases Created**

- 📝 Fix: cherry pick part-1 5dc15c1b1980775b2781eafbdbebda48ade44a74
- 🚀 #LIVE fix: case creation side effects only after middesk verification Part 2 ([#568](https://github.comjoinworth/case-service/pull/568))

## [v0.0.104](https://github.com/joinworth/case-service/compare/v0.0.103...v0.0.104) - 2024-12-09

### 📝 Other

- 📝 Fix: dos-90 cherry pick de9ab7769a474a75a215d34e5886cbbbfdc33b9d

## [v0.0.103](https://github.com/joinworth/case-service/compare/v0.0.102...v0.0.103) - 2024-12-09

### ✨ Enhancement

**[PAT-124](https://worth-ai.atlassian.net/browse/PAT-124) - Support is corporation public flag**

- 📝 Feat: cherry-pick

## [v0.0.102](https://github.com/joinworth/case-service/compare/v0.0.99...v0.0.102) - 2024-12-06

### 📖 Story

**[DOS-22](https://worth-ai.atlassian.net/browse/DOS-22) - Create Risk Case and Notification Alert for Low-to-High Score (risk) Movement After Score Refresh**

- 🚀 #LIVE feat: add risk alert on low to high score change ([#557](https://github.comjoinworth/case-service/pull/557))

**[DOS-67](https://worth-ai.atlassian.net/browse/DOS-67) - [BE] Configure Onboarding for Enterprise Customers**

- 🚀 Migration And Progression API changes #LIVE ([#537](https://github.comjoinworth/case-service/pull/537))
- 🚀 Fix progression API #LIVE ([#549](https://github.comjoinworth/case-service/pull/549))
- 🚀 fix: progression api #LIVE ([#550](https://github.comjoinworth/case-service/pull/550))
- 🚀 SUBTASK: FEAT: Onboarding page config API #LIVE ([#545](https://github.comjoinworth/case-service/pull/545))
- 🚀 #LIVE issues fix ([#553](https://github.comjoinworth/case-service/pull/553))

**[PAT-55](https://worth-ai.atlassian.net/browse/PAT-55) - [FE+BE] Invite Co-Applicant to Onboarding Form with Full Access**

- 🚀 #LIVE fix: insert case_id in data_invites table ([#575](https://github.comjoinworth/case-service/pull/575))
- 🚀 Fix: cherry pic #LIVE feat: invite co applicant ([#533](https://github.comjoinworth/case-service/pull/533))
- 🚀 #LIVE fix: accept invite API for standalone applicant ([#548](https://github.comjoinworth/case-service/pull/548))

### 🧰 Task

**[INFRA-84](https://worth-ai.atlassian.net/browse/INFRA-84) - setup qa env**

- 🚀 #LIVE Setup QA env ([#561](https://github.comjoinworth/case-service/pull/561))

### 🐛 Bug

**[PAT-51](https://worth-ai.atlassian.net/browse/PAT-51) - Unable to progress in onboarding with feature flag for business matching enabled**

- 🚩 #FLAG : Fix owner_email & owner_id response ([#544](https://github.comjoinworth/case-service/pull/544))

### ✨ Enhancement

**[PAT-38](https://worth-ai.atlassian.net/browse/PAT-38) - [FE +BE] [Custom Fields] Field Descriptions Not Displayed in Production**

- 🚀 #LIVE implement custom field description ([#541](https://github.comjoinworth/case-service/pull/541))

**[PAT-97](https://worth-ai.atlassian.net/browse/PAT-97) - Include entity type and business formation date in webhook for business.updated**

- 🚩 #FLAG : formation date, entity type ([#547](https://github.comjoinworth/case-service/pull/547))

### 📝 Other

**[DOS-84](https://worth-ai.atlassian.net/browse/DOS-84) - No title available**

- 🚀 Fix: cherry pick #LIVE: hotfixes for multiple case creation validate fail ([#539](https://github.comjoinworth/case-service/pull/539))

- 📝 Fix: co applicant feature flag ([#576](https://github.comjoinworth/case-service/pull/576))
- 🚀 #NO_JIRA #LIVE feat: kafka dlq topic ([#562](https://github.comjoinworth/case-service/pull/562))
- 📝 Fix: resolved merge conflicts
- 🚀 #NO_JIRA #LIVE fix: transaction fix ([#536](https://github.comjoinworth/case-service/pull/536))
- 🚀 #NO_JIRA #LIVE ZoomInfo/OC - Handle missing entries in business_names or business_addresses ([#538](https://github.comjoinworth/case-service/pull/538))
- 🚀 #NO_JIRA #LIVE fix: invitation status typo ([#540](https://github.comjoinworth/case-service/pull/540))
- 🚀 #NO_JIRA #LIVE fix: mailing address and facts issue fix ([#543](https://github.comjoinworth/case-service/pull/543))
- 🚀 #NO_JIRA #LIVE fix: break statement missing ([#555](https://github.comjoinworth/case-service/pull/555))
- 🚀 #NO_JIRA #LIVE feat: qa-env-kafka-configs ([#560](https://github.comjoinworth/case-service/pull/560))

## [v0.0.99](https://github.com/joinworth/case-service/compare/v0.0.98...v0.0.99) - 2024-12-02

### 📝 Other

- 🚀 #NO_JIRA #LIVE feat: resend invitation for lightning ([#566](https://github.comjoinworth/case-service/pull/566))

## [v0.0.98](https://github.com/joinworth/case-service/compare/v0.0.97...v0.0.98) - 2024-12-02

### 🐛 Bug

**[PAT-106](https://worth-ai.atlassian.net/browse/PAT-106) - DBA and Legal Name don't appear to be set properly**

- 🚀 #LIVE fix: duplicate business name ([#554](https://github.comjoinworth/case-service/pull/554))

## [v0.0.97](https://github.com/joinworth/case-service/compare/v0.0.96...v0.0.97) - 2024-11-26

### 📝 Other

- 📝 Feat: cherry pick pat-97
- 📝 Feat: cherry pick pat-97

## [v0.0.96](https://github.com/joinworth/case-service/compare/v0.0.95...v0.0.96) - 2024-11-25

### 📝 Other

**[DOS-84](https://worth-ai.atlassian.net/browse/DOS-84) - No title available**

- 🔥🚀 #LIVE #HOTFIX fix: multiple case creation on lightning verification validation fail ([#535](https://github.comjoinworth/case-service/pull/535))

- 📝 Fix: standalone flow

## [v0.0.95](https://github.com/joinworth/case-service/compare/v0.0.93...v0.0.95) - 2024-11-19

### 📝 Other

- 📝 Fix: invitation completed error
- 📝 Fix: invitation status to complete

## [v0.0.93](https://github.com/joinworth/case-service/compare/v0.0.92...v0.0.93) - 2024-11-19

### 📝 Other

- 📝 Fix: middesk submission
- 📝 Fix: info logger added

## [v0.0.92](https://github.com/joinworth/case-service/compare/v0.0.91...v0.0.92) - 2024-11-19

### 📝 Other

- 📝 Fix: case after validate business

## [v0.0.91](https://github.com/joinworth/case-service/compare/v0.0.90...v0.0.91) - 2024-11-19

### 📝 Other

**[DOS-84](https://worth-ai.atlassian.net/browse/DOS-84) - No title available**

- 🚀 #LIVE: create new case for lightning verification ([#534](https://github.comjoinworth/case-service/pull/534))

## [v0.0.90](https://github.com/joinworth/case-service/compare/v0.0.89...v0.0.90) - 2024-11-19

### 🐛 Bug

**[DOS-50](https://worth-ai.atlassian.net/browse/DOS-50) - Incorrect Applicant Name and Email in Company Details of 360 Report PDF**

- 🚀 FIX: Incorrect applicant name and email in company details of 360 report #LIVE ([#526](https://github.comjoinworth/case-service/pull/526))

**[PAT-17](https://worth-ai.atlassian.net/browse/PAT-17) - Aurora | Invite any user and resend that same invite again and after hit the invite URL it shouldn't redirect me to login screen**

- 🚩 #FLAG fix: no login onboarding (resend invite) ([#525](https://github.comjoinworth/case-service/pull/525))

### ✨ Enhancement

**[PAT-74](https://worth-ai.atlassian.net/browse/PAT-74) - Include applicant info on business and onboarding webhook payloads**

- 🚩 #FLAG : business applicants ([#527](https://github.comjoinworth/case-service/pull/527))
- 🚀 #LIVE: business applicants ([#530](https://github.comjoinworth/case-service/pull/530))

**[PAT-76](https://worth-ai.atlassian.net/browse/PAT-76) - Send Account/Routing via Auth via webhook**

- 🚀 #LIVE: business event payload to include deposit account ([#532](https://github.comjoinworth/case-service/pull/532))

### 📝 Other

**[DOS-84](https://worth-ai.atlassian.net/browse/DOS-84) - No title available**

- 🚩 #FLAG feat: lightning verification ([#528](https://github.comjoinworth/case-service/pull/528))

- 🚀 #NO_JIRA #LIVE fix: race condition of events ([#524](https://github.comjoinworth/case-service/pull/524))
- 🚀 #NO_JIRA #LIVE fix: bulk middesk fix ([#529](https://github.comjoinworth/case-service/pull/529))

## [v0.0.89](https://github.com/joinworth/case-service/compare/v0.0.88...v0.0.89) - 2024-11-13

### 🐛 Bug

**[PAT-51](https://worth-ai.atlassian.net/browse/PAT-51) - Unable to progress in onboarding with feature flag for business matching enabled**

- 🚩 #FLAG Business invite link fix ([#511](https://github.comjoinworth/case-service/pull/511))
- 🚩 #FLAG Turn update with on conflict into an insert on conflict ([#512](https://github.comjoinworth/case-service/pull/512))
- 🚩 Handle businessID mutating #FLAG ([#515](https://github.comjoinworth/case-service/pull/515))
- 🚩 #FLAG Handle the invited applicant not being flagged as "owner" ([#521](https://github.comjoinworth/case-service/pull/521))

**[PAT-52](https://worth-ai.atlassian.net/browse/PAT-52) - [BE] Error Encrypting EIN**

- 🚀 #LIVE fix: ein encryption error ([#519](https://github.comjoinworth/case-service/pull/519))

**[PAT-70](https://worth-ai.atlassian.net/browse/PAT-70) - Unable to Validate TIN On Company Details Page on Staging Envo for Easyflow**

- 🚀 #LIVE fix: easyflow ein null bug fix ([#520](https://github.comjoinworth/case-service/pull/520))

### ✨ Enhancement

**[PAT-8](https://worth-ai.atlassian.net/browse/PAT-8) - Enable Industry and NAICS codes to be populated**

- 🚀 #LIVE: naics industry priority ([#513](https://github.comjoinworth/case-service/pull/513))
- 🚀 #LIVE: naics industry priority ([#514](https://github.comjoinworth/case-service/pull/514))
- 🚀 #LIVE naics industry priority ([#517](https://github.comjoinworth/case-service/pull/517))
- 🚀 #LIVE: naics industry priority ([#518](https://github.comjoinworth/case-service/pull/518))

### 🧪 Spike

**[PAT-10](https://worth-ai.atlassian.net/browse/PAT-10) - OpenCorporates+ZoomInfo: How to handle additional business_entity_verification providers in API + FrontEnds**

- 🚀 Facts POC #LIVE ([#516](https://github.comjoinworth/case-service/pull/516))

## [v0.0.88](https://github.com/joinworth/case-service/compare/v0.0.86...v0.0.88) - 2024-11-13

### 🐛 Bug

**[PAT-52](https://worth-ai.atlassian.net/browse/PAT-52) - [BE] Error Encrypting EIN**

- 🚀 #LIVE fix: ein encryption error ([#519](https://github.comjoinworth/case-service/pull/519))

### 📝 Other

- 📝 Fix: hotfix: null ein passing fix

## [v0.0.86](https://github.com/joinworth/case-service/compare/0.37.3...v0.0.86) - 2024-11-06

## [0.37.3](https://github.com/joinworth/case-service/compare/v0.0.83...0.37.3) - 2025-03-14

### 📖 Story

**[DOS-124](https://worth-ai.atlassian.net/browse/DOS-124) - Linking Multiple Accounts of Different Banks**

- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 1 ([#618](https://github.comjoinworth/case-service/pull/618))

**[DOS-135](https://worth-ai.atlassian.net/browse/DOS-135) - Reflect Worth Admin Configurations (for page/fields) to Custom Onboarding flow**

- 🚀 UPDATE PROGRESSION API #LIVE ([#601](https://github.comjoinworth/case-service/pull/601))

**[DOS-191](https://worth-ai.atlassian.net/browse/DOS-191) - As a user, I expect that adding businesses will submit to Middesk for website.**

- 🚀 #LIVE submit website to middesk received from SERP ([#660](https://github.comjoinworth/case-service/pull/660))

**[DOS-22](https://worth-ai.atlassian.net/browse/DOS-22) - Create Risk Case and Notification Alert for Low-to-High Score (risk) Movement After Score Refresh**

- 🚀 #LIVE feat: add risk alert on low to high score change ([#557](https://github.comjoinworth/case-service/pull/557))

**[DOS-246](https://worth-ai.atlassian.net/browse/DOS-246) - Add customer-level setting to enable NPI searches**

- 🚀 #LIVE - Add customer-level setting to enable NPI searches ([#718](https://github.comjoinworth/case-service/pull/718))
- 🚀 #LIVE - Add customer-level setting to enable NPI searches ([#727](https://github.comjoinworth/case-service/pull/727))

**[DOS-252](https://worth-ai.atlassian.net/browse/DOS-252) - [BE+FE] Enable GIACT Toggle in Banking Tab of Custom Onboarding**

- 🚀 Adding GIACT feature setting for customer (Part 1) #LIVE ([#669](https://github.comjoinworth/case-service/pull/669))

**[DOS-253](https://worth-ai.atlassian.net/browse/DOS-253) - [BE] Pass Banking Information to GIACT for Verification During Onboarding**

- 🚀 FIX: Updated Internal API for Get Business #LIVE ([#688](https://github.comjoinworth/case-service/pull/688))

**[DOS-256](https://worth-ai.atlassian.net/browse/DOS-256) - [BE] Set Case Status to Manual Review for Negative Results**

- 🚀 #LIVE: Sets Case Status to "Manual Review" Upon Receiving Negative Results ([#682](https://github.comjoinworth/case-service/pull/682))
- 🚀 #LIVE: Set case status to "Under Manual Review" upon receiving negative results (Part 2) ([#696](https://github.comjoinworth/case-service/pull/696))

**[DOS-318](https://worth-ai.atlassian.net/browse/DOS-318) - Worth Admin | Unhide Liveliness Check and Driver’s License options for IDV configuration**

- 🚀 FEAT: Unhide liveliness check and drivers license IDV options #LIVE ([#680](https://github.comjoinworth/case-service/pull/680))

**[DOS-346](https://worth-ai.atlassian.net/browse/DOS-346) - [BE] Add support for the `/bulk/process` (and Add Business) route to ingest deposit account information**

- 🚀 Add deposit account support to Bulk Process API (Part 1) #LIVE ([#702](https://github.comjoinworth/case-service/pull/702))
- 🚀 Add deposit account support to Bulk Process API (Part 2) #LIVE ([#722](https://github.comjoinworth/case-service/pull/722))
- 🚀 Add deposit account support to Bulk Process API (Part 3) #LIVE ([#723](https://github.comjoinworth/case-service/pull/723))
- 🚀 Add deposit account support to Bulk Process API (Part 4) #LIVE ([#730](https://github.comjoinworth/case-service/pull/730))

**[DOS-358](https://worth-ai.atlassian.net/browse/DOS-358) - No title available**

- 🚀 #LIVE Bump tin verification timeout to 40s & add test for timeout working as expected ([#684](https://github.comjoinworth/case-service/pull/684))

**[DOS-67](https://worth-ai.atlassian.net/browse/DOS-67) - [BE] Configure Onboarding for Enterprise Customers**

- 🚀 Migration And Progression API changes #LIVE ([#537](https://github.comjoinworth/case-service/pull/537))
- 🚀 Fix progression API #LIVE ([#549](https://github.comjoinworth/case-service/pull/549))
- 🚀 fix: progression api #LIVE ([#550](https://github.comjoinworth/case-service/pull/550))
- 🚀 SUBTASK: FEAT: Onboarding page config API #LIVE ([#545](https://github.comjoinworth/case-service/pull/545))
- 🚀 #LIVE issues fix ([#553](https://github.comjoinworth/case-service/pull/553))

**[DOS-98](https://worth-ai.atlassian.net/browse/DOS-98) - Add a custom step for OCR processing statements**

- 🚀 #LIVE feat: change migration file and change default onboarding status ([#570](https://github.comjoinworth/case-service/pull/570))

**[PAT-145](https://worth-ai.atlassian.net/browse/PAT-145) - [Custom Fields] Enhancement to Separate Pages for Custom Field Onboarding Steps**

- 🚀 #LIVE feat: section name for custom fields ([#611](https://github.comjoinworth/case-service/pull/611))
- 🚀 #LIVE fix: sequence of custom fields in progression ([#626](https://github.comjoinworth/case-service/pull/626))
- 🚀 #LIVE fix: custom field section order ([#627](https://github.comjoinworth/case-service/pull/627))
- 🚀 #LIVE fix: fetch only last template stages ([#630](https://github.comjoinworth/case-service/pull/630))

**[PAT-160](https://worth-ai.atlassian.net/browse/PAT-160) - BE | TIN should not be necessary to submit to Middesk**

- 🚀 #LIVE feat: tin is optional for middesk ([#624](https://github.comjoinworth/case-service/pull/624))
- 🚀 #LIVE fix: easyflow fix ([#633](https://github.comjoinworth/case-service/pull/633))
- 🚀 #LIVE fix: webhook ([#634](https://github.comjoinworth/case-service/pull/634))

**[PAT-161](https://worth-ai.atlassian.net/browse/PAT-161) - [FE+BE] | As an Applicant, I should not always be required to enter a TIN**

- 🚀 #LIVE Allow onboarding config to drive TIN requirement ([#729](https://github.comjoinworth/case-service/pull/729))
- 🚀 #LIVE adjust const to let ([#734](https://github.comjoinworth/case-service/pull/734))

**[PAT-171](https://worth-ai.atlassian.net/browse/PAT-171) - [BE] Allow Status Change to Information Requested/Updated for Auto Approve/Reject**

- 🚀 #LIVE allow case status change ([#704](https://github.comjoinworth/case-service/pull/704))

**[PAT-175](https://worth-ai.atlassian.net/browse/PAT-175) - [FE+BE] Custom Setting - Post Submission Uploads/Edits**

- 🚀 #LIVE feat: Enable / Disable Post-Submission Editing ([#703](https://github.comjoinworth/case-service/pull/703))
- 🚀 #LIVE feat: Enable / Disable Post-Submission Editing ([#706](https://github.comjoinworth/case-service/pull/706))
- 🚀 #LIVE feat: Enable / Disable Post-Submission Editing ([#711](https://github.comjoinworth/case-service/pull/711))
- 🚀 #LIVE fix: Enable / Disable Post-Submission Editing - Restrict post-submission editing to White Label customers ([#717](https://github.comjoinworth/case-service/pull/717))

**[PAT-200](https://worth-ai.atlassian.net/browse/PAT-200) - Tax POC Integration**

- 🚀 #LIVE feat: updating taxes core config migration script ([#667](https://github.comjoinworth/case-service/pull/667))

**[PAT-205](https://worth-ai.atlassian.net/browse/PAT-205) - [BE] Generate and Store Adverse Media Data in DB**

- 🚀 #LIVE feat: adverse media producer ([#691](https://github.comjoinworth/case-service/pull/691))
- 🚀 #LIVE fix: adverse media for bulk upload/update ([#692](https://github.comjoinworth/case-service/pull/692))

**[PAT-394](https://worth-ai.atlassian.net/browse/PAT-394) - And invitation_id to Send Business Invite route response**

- 🚀 #LIVE fix: logical fix ([#733](https://github.comjoinworth/case-service/pull/733))

**[PAT-55](https://worth-ai.atlassian.net/browse/PAT-55) - [FE+BE] Invite Co-Applicant to Onboarding Form with Full Access**

- 🚀 #LIVE feat: invite co applicant ([#533](https://github.comjoinworth/case-service/pull/533))
- 🚀 #LIVE fix: accept invite API for standalone applicant ([#548](https://github.comjoinworth/case-service/pull/548))
- 🚩 #FLAG fix: co applicant feature flag ([#576](https://github.comjoinworth/case-service/pull/576))
- 🚀 #LIVE fix: insert case_id in data_invites table ([#575](https://github.comjoinworth/case-service/pull/575))

**[PAT-57](https://worth-ai.atlassian.net/browse/PAT-57) - [FE + BE] Review and Submit Application with Submission Permissions**

- 🚀 #LIVE feat: review and Submit Application with Submission Permissions ([#558](https://github.comjoinworth/case-service/pull/558))

**[PAT-58](https://worth-ai.atlassian.net/browse/PAT-58) - [FE+BE] Manage Invitee and Link Expiry**

- 🚀 #LIVE Manage Invitee and Link Expiry ([#573](https://github.comjoinworth/case-service/pull/573))
- 🚀 Manage Invitee and Link Expiry #LIVE ([#578](https://github.comjoinworth/case-service/pull/578))
- 🚀 #LIVE Invitee and invitee expiry ([#582](https://github.comjoinworth/case-service/pull/582))
- 🚀 #LIVE fix: query ([#584](https://github.comjoinworth/case-service/pull/584))
- 🚀 #LIVE feat: putting behind feature flag ([#588](https://github.comjoinworth/case-service/pull/588))
- 🚀 Manage Invitee and Link Expiry - BUG FIXES #LIVE ([#589](https://github.comjoinworth/case-service/pull/589))
- 🚩 #FLAG fix: revoked status fix ([#590](https://github.comjoinworth/case-service/pull/590))
- 🚩 Manage Invitee and Link Expiry - BUG FIX #FLAG ([#593](https://github.comjoinworth/case-service/pull/593))
- 🚀 Rate-Limiter #LIVE ([#580](https://github.comjoinworth/case-service/pull/580))
- 🚩 Manage Invitee and Link Expiry - BUG FIX #FLAG ([#597](https://github.comjoinworth/case-service/pull/597))
- 🚩 Revert token config co applicant invite email token life seconds #FLAG ([#598](https://github.comjoinworth/case-service/pull/598))

**[PAT-69](https://worth-ai.atlassian.net/browse/PAT-69) - [BE] Send Emails When Sections Are Completed**

- 🚀 #LIVE feat: co-applicants email ([#567](https://github.comjoinworth/case-service/pull/567))
- 🚀 #LIVE fix: fixed the kafka event for section_completed event ([#572](https://github.comjoinworth/case-service/pull/572))

**[WIN-1066](https://worth-ai.atlassian.net/browse/WIN-1066) - [FE+BE] Display Download link for Worth 360 Report**

- 🚀 Feat: Internal API to get case status #LIVE ([#499](https://github.comjoinworth/case-service/pull/499))
- 🚀 FIX: UPDATED DATABASE QUERY TO GET CASE STATUS #LIVE ([#501](https://github.comjoinworth/case-service/pull/501))
- 🚀 get report status In case listing #LIVE ([#500](https://github.comjoinworth/case-service/pull/500))
- 🚀 Report with case ID #LIVE ([#502](https://github.comjoinworth/case-service/pull/502))
- 🚀 add report status in business case listing API #LIVE ([#503](https://github.comjoinworth/case-service/pull/503))

**[WIN-1128](https://worth-ai.atlassian.net/browse/WIN-1128) - Add Company Overview to PDF Report**

- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 1 ([#477](https://github.comjoinworth/case-service/pull/477))
- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 2 ([#480](https://github.comjoinworth/case-service/pull/480))
- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 3 ([#481](https://github.comjoinworth/case-service/pull/481))
- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 4 ([#482](https://github.comjoinworth/case-service/pull/482))
- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 5 ([#497](https://github.comjoinworth/case-service/pull/497))
- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 6 ([#498](https://github.comjoinworth/case-service/pull/498))

**[WIN-1198](https://worth-ai.atlassian.net/browse/WIN-1198) - Aurora | Support NAICS to MCC mapping**

- 🚀 #LIVE NAISC MCC MAPPING ([#431](https://github.comjoinworth/case-service/pull/431))

**[WIN-1223](https://worth-ai.atlassian.net/browse/WIN-1223) - [BE] Send Webhook Events**

- 🚩 #FLAG feat: sending event ([#432](https://github.comjoinworth/case-service/pull/432))
- 🚩 #FLAG fix: payload sanity and invite expired event [] ([#439](https://github.comjoinworth/case-service/pull/439))
- 🚩 #FLAG fix ([#441](https://github.comjoinworth/case-service/pull/441))
- 🚩 #FLAG fix: added missing required fields ([#443](https://github.comjoinworth/case-service/pull/443))

**[WIN-1263](https://worth-ai.atlassian.net/browse/WIN-1263) - Aurora | Move accounting to the last integration**

- 🚩 MOVE ACCOUNTING TO SECOND LAST FOR AURORA #FLAG ([#426](https://github.comjoinworth/case-service/pull/426))

**[WIN-1318](https://worth-ai.atlassian.net/browse/WIN-1318) - Aurora | Routing and Account Number via Auth**

- 🚩 #FLAG feat: deposit account for aurora's businesses ([#458](https://github.comjoinworth/case-service/pull/458))
- 🚩 #FLAG fix: skipped banking stage in progression ([#460](https://github.comjoinworth/case-service/pull/460))

**[WIN-1380](https://worth-ai.atlassian.net/browse/WIN-1380) - Aurora | Add Invite Link in Response of Invite Business API for Aurora**

- 🚩 #FLAG feat: Invite business returning invitation_url ([#436](https://github.comjoinworth/case-service/pull/436))
- 🚩 #FLAG fix: no login condition ([#444](https://github.comjoinworth/case-service/pull/444))

**[WIN-1434](https://worth-ai.atlassian.net/browse/WIN-1434) - [FE+BE] Aurora | Enable Deposit Account Selection and Display to Enterprise Customer**

- 🚩 #FLAG feat: send deposit account info in progression ([#469](https://github.comjoinworth/case-service/pull/469))
- 🚩 #FLAG fix: is stage completed for banking ([#485](https://github.comjoinworth/case-service/pull/485))

**[WIN-1438](https://worth-ai.atlassian.net/browse/WIN-1438) - [BE] Implement progressive trigger of business.updated event**

- 🚀 #LIVE feat: subsequent business.updated webhook event ([#465](https://github.comjoinworth/case-service/pull/465))
- 🚀 #LIVE QA FIXES ([#475](https://github.comjoinworth/case-service/pull/475))

**[WIN-1440](https://worth-ai.atlassian.net/browse/WIN-1440) - Implement business.updated event upon onboarding completion**

- 🚀 #LIVE feat: business updated webhook event after completion of onboarding ([#457](https://github.comjoinworth/case-service/pull/457))
- 🚀 #LIVE fix: business updated webhook event for bulk businesses ([#459](https://github.comjoinworth/case-service/pull/459))

**[WIN-1446](https://worth-ai.atlassian.net/browse/WIN-1446) - [BE] Update the business.updated event to include custom fields, owners, and documents**

- 🚀 #LIVE business updated event ([#487](https://github.comjoinworth/case-service/pull/487))
- 🚀 #LIVE business updated event ([#489](https://github.comjoinworth/case-service/pull/489))
- 🚀 #LIVE business updated event ([#494](https://github.comjoinworth/case-service/pull/494))

### 🧰 Task

**[INFRA-100](https://worth-ai.atlassian.net/browse/INFRA-100) - Add LD test action in svc repo**

- 🚀 #LIVE CREATE FIND FLAG ACTION ([#657](https://github.comjoinworth/case-service/pull/657))

**[INFRA-103](https://worth-ai.atlassian.net/browse/INFRA-103) - Add author in BE deploy action title**

- 🚀 #LIVE Add author in title ([#663](https://github.comjoinworth/case-service/pull/663))

**[INFRA-104](https://worth-ai.atlassian.net/browse/INFRA-104) - Auto approve deploy repo pr in dev**

- 🚀 #LIVE AUTO APPROVE AND MERGE ([#677](https://github.comjoinworth/case-service/pull/677))

**[INFRA-12](https://worth-ai.atlassian.net/browse/INFRA-12) - Implement GitHub Action to Cleanup Release Branches**

- 🚀 #LIVE clean-release-branches ([#369](https://github.comjoinworth/case-service/pull/369))

**[INFRA-123](https://worth-ai.atlassian.net/browse/INFRA-123) - Dev Exp changes in BE and FE repos**

- 🚀 #LIVE Add dockerfile local ([#698](https://github.comjoinworth/case-service/pull/698))

**[INFRA-125](https://worth-ai.atlassian.net/browse/INFRA-125) - fix: issue where migration script not working locally**

- 🚀 #LIVE Fix - Resolved issue with migration script not working locally and updated Dockerfile.local ([#715](https://github.comjoinworth/case-service/pull/715))

**[INFRA-28](https://worth-ai.atlassian.net/browse/INFRA-28) - Cache yq Binary in GitHub Actions Workflow**

- 🚀 #LIVE Update yq step ([#476](https://github.comjoinworth/case-service/pull/476))

**[INFRA-30](https://worth-ai.atlassian.net/browse/INFRA-30) - Ensure Branch is Up-to-Date with Main Before Build and Deploy**

- 🚀 #LIVE Add check to ensure branch is up-to-date with main before build ([#496](https://github.comjoinworth/case-service/pull/496))

**[INFRA-35](https://worth-ai.atlassian.net/browse/INFRA-35) - Update CICD pipeline versions to fix actions warning**

- 🚀 #LIVE Fix/image tag update warning ([#471](https://github.comjoinworth/case-service/pull/471))

**[INFRA-49](https://worth-ai.atlassian.net/browse/INFRA-49) - Add JIRA Ticket Link as Comment and Objective in PR Title**

- 🚀 #LIVE Add JIRA ticket link as a comment and include objective in PR title ([#508](https://github.comjoinworth/case-service/pull/508))

**[INFRA-69](https://worth-ai.atlassian.net/browse/INFRA-69) - Add GitHub Actions Workflow for Automated Tag Creation**

- 🚀 #LIVE Add GitHub Actions Workflow for Automated Tag Creation ([#647](https://github.comjoinworth/case-service/pull/647))

**[INFRA-8](https://worth-ai.atlassian.net/browse/INFRA-8) - Update GitHub Actions to Use Branch/Tag Naming Convention for Docker ImageTag**

- 🚀 #LIVE Update Docker Image Tagging Convention for Tag-Based Runs ([#509](https://github.comjoinworth/case-service/pull/509))

**[INFRA-84](https://worth-ai.atlassian.net/browse/INFRA-84) - setup qa env**

- 🚀 #LIVE Setup QA env ([#561](https://github.comjoinworth/case-service/pull/561))

**[INFRA-85](https://worth-ai.atlassian.net/browse/INFRA-85) - Add username in pr desc for backend pipelines**

- 🚀 #LIVE Add username in pr desc ([#565](https://github.comjoinworth/case-service/pull/565))

**[INFRA-88](https://worth-ai.atlassian.net/browse/INFRA-88) - No title available**

- 🚀 #LIVE CORS QA ENV ([#600](https://github.comjoinworth/case-service/pull/600))

**[INFRA-91](https://worth-ai.atlassian.net/browse/INFRA-91) - Quarterly hotfix report action**

- 🚀 #LIVE Hotfix Report Action ([#628](https://github.comjoinworth/case-service/pull/628))
- 🚀 #LIVE Update hotfix-report.yaml ([#629](https://github.comjoinworth/case-service/pull/629))

**[INFRA-98](https://worth-ai.atlassian.net/browse/INFRA-98) - Update docker-compose in all svc**

- 🚀 #LIVE Update docker compose ([#646](https://github.comjoinworth/case-service/pull/646))

### 🐛 Bug

**[DOS-109](https://worth-ai.atlassian.net/browse/DOS-109) - Incorrect Screen Redirect Post-Plaid IDV Failure During Onboarding**

- 🚀 #LIVE submit case status ([#612](https://github.comjoinworth/case-service/pull/612))

**[DOS-172](https://worth-ai.atlassian.net/browse/DOS-172) - Public Records not populating**

- 🚀 PUBLIC RECORDS NOT POPULATING #LIVE ([#602](https://github.comjoinworth/case-service/pull/602))

**[DOS-210](https://worth-ai.atlassian.net/browse/DOS-210) - [FE+BE] [Custom Onboarding] Hide/Show Fields**

- 🚀 Custom Onboarding - Hide/Show Fields (Part 1) #LIVE ([#636](https://github.comjoinworth/case-service/pull/636))

**[DOS-221](https://worth-ai.atlassian.net/browse/DOS-221) - [Custom Onboarding] Fix Ownership Field Logic**

- 🔥⚡🚀 add owners api update #HOTFIX #LIVE #FAST ([#622](https://github.comjoinworth/case-service/pull/622))

**[DOS-275](https://worth-ai.atlassian.net/browse/DOS-275) - [Easy flow] During onboarding with easyflow/testmode the flow get break when user proceeded from banking screen**

- 🚀 #LIVE Fix TIN bypass easyflow ([#666](https://github.comjoinworth/case-service/pull/666))
- 🚀 #LIVE Fix Business Not Verified ([#671](https://github.comjoinworth/case-service/pull/671))

**[DOS-280](https://worth-ai.atlassian.net/browse/DOS-280) - No title available**

- 🚀 #LIVE fix: address_apartment in public records request ([#658](https://github.comjoinworth/case-service/pull/658))

**[DOS-32](https://worth-ai.atlassian.net/browse/DOS-32) - Cases are showing as auto-approved when score is hidden**

- 🚀 #LIVE: business metadata for determining status on FE ([#506](https://github.comjoinworth/case-service/pull/506))

**[DOS-324](https://worth-ai.atlassian.net/browse/DOS-324) - Include all stages in the onboarding flow and during process don't skip any stage in this case it directly take user to review screen**

- 🚀 #LIVE onboarding issue resolve ([#674](https://github.comjoinworth/case-service/pull/674))

**[DOS-326](https://worth-ai.atlassian.net/browse/DOS-326) - Business search fails when using single quote.**

- 🚀 #LIVE fix: escape ' in like query ([#675](https://github.comjoinworth/case-service/pull/675))

**[DOS-348](https://worth-ai.atlassian.net/browse/DOS-348) - [Aurora User][Hyper Care] Clicking "Review Application" in Email Prompts for Password Instead of Redirecting to Review Page**

- 🚀 #LIVE: Adds the `no_login` property when final submission email is sent ([#685](https://github.comjoinworth/case-service/pull/685))

**[DOS-349](https://worth-ai.atlassian.net/browse/DOS-349) - [Aurora User] [Hyper Care]"Continue Application" Email Button Redirects to Incorrect**

- 🚀 #LIVE - incorrect email redirect ([#693](https://github.comjoinworth/case-service/pull/693))

**[DOS-374](https://worth-ai.atlassian.net/browse/DOS-374) - Fix issue preventing users from advancing from company details page.**

- 🚀 #LIVE PULLING HOTFIX TO MAIN ([#700](https://github.comjoinworth/case-service/pull/700))

**[DOS-375](https://worth-ai.atlassian.net/browse/DOS-375) - Fix endless TIN verification loop when Kafka times out**

- 🚀 #LIVE Add KafkaToQueue & push integration_data_ready handler to us… ([#689](https://github.comjoinworth/case-service/pull/689))
- 🚀 Resolve endless TIN verification loop on Kafka timeout (Part 2) #LIVE ([#690](https://github.comjoinworth/case-service/pull/690))

**[DOS-50](https://worth-ai.atlassian.net/browse/DOS-50) - Incorrect Applicant Name and Email in Company Details of 360 Report PDF**

- 🚀 FIX: Incorrect applicant name and email in company details of 360 report #LIVE ([#526](https://github.comjoinworth/case-service/pull/526))

**[DOS-90](https://worth-ai.atlassian.net/browse/DOS-90) - Document Upload issues / Duplicate Cases Created**

- 🚀 #LIVE fix: case creation side effects only after middesk verification ([#556](https://github.comjoinworth/case-service/pull/556))
- 🚀 #LIVE fix: case creation side effects only after middesk verification Part 2 ([#568](https://github.comjoinworth/case-service/pull/568))
- 🚀 #LIVE fix: 2 cases were created (for customer invitee) which are visible under Customer portal ([#581](https://github.comjoinworth/case-service/pull/581))

**[DOS-91](https://worth-ai.atlassian.net/browse/DOS-91) - Unable to purge records when custom fields are filled**

- 🚀 #LIVE fix: fk delete rule updated ([#563](https://github.comjoinworth/case-service/pull/563))

**[DOS-94](https://worth-ai.atlassian.net/browse/DOS-94) - Income Displayed as Negative in Income vs. Expenses Chart**

- 🚀 FIXED NEGATIVE VALUE FROM INCOME CHART 360 REPORT #LIVE ([#583](https://github.comjoinworth/case-service/pull/583))

**[PAT-106](https://worth-ai.atlassian.net/browse/PAT-106) - DBA and Legal Name don't appear to be set properly**

- 🚀 #LIVE fix: duplicate business name ([#554](https://github.comjoinworth/case-service/pull/554))

**[PAT-137](https://worth-ai.atlassian.net/browse/PAT-137) - Business addresses are only being sent in webhook if mailing address is filled**

- 🚀 #LIVE fix: business address insertion fix ([#595](https://github.comjoinworth/case-service/pull/595))

**[PAT-157](https://worth-ai.atlassian.net/browse/PAT-157) - Email notification not triggered when co-applicant updates custom fields.**

- 🚀 #LIVE fix: custom field section complete email ([#619](https://github.comjoinworth/case-service/pull/619))

**[PAT-17](https://worth-ai.atlassian.net/browse/PAT-17) - Aurora | Invite any user and resend that same invite again and after hit the invite URL it shouldn't redirect me to login screen**

- 🚩 #FLAG fix: no login onboarding (resend invite) ([#525](https://github.comjoinworth/case-service/pull/525))

**[PAT-187](https://worth-ai.atlassian.net/browse/PAT-187) - [IMP] Webhooks | Error Customer ID is required on PROD**

- 🚀 #LIVE fix: customer-id required bug ([#644](https://github.comjoinworth/case-service/pull/644))
- 🚀 #LIVE fix: adding business-id ([#649](https://github.comjoinworth/case-service/pull/649))
- 🚀 #LIVE fix: schema ([#651](https://github.comjoinworth/case-service/pull/651))
- 🚀 #LIVE fix: payload update ([#654](https://github.comjoinworth/case-service/pull/654))

**[PAT-190](https://worth-ai.atlassian.net/browse/PAT-190) - Webhooks | Error fetching webhook data on PROD**

- 🚀 #LIVE fix: data passing issue fix ([#659](https://github.comjoinworth/case-service/pull/659))

**[PAT-191](https://worth-ai.atlassian.net/browse/PAT-191) - [IMP] Subscriptions | Error Business name is required on PROD**

- 🚀 #LIVE fix: business_name required dlq bug ([#645](https://github.comjoinworth/case-service/pull/645))

**[PAT-212](https://worth-ai.atlassian.net/browse/PAT-212) - No title available**

- 🚀 #LIVE fix: decimal places validation ([#664](https://github.comjoinworth/case-service/pull/664))

**[PAT-216](https://worth-ai.atlassian.net/browse/PAT-216) - [FE+BE] Error on "Accounts Receivable & Accounts Payable Aging Reports" Page When Clicking Continue Without Uploading**

- 🚀 #LIVE fix: Fix error on "Accounts Receivable & Accounts Payable Aging Reports" page when continuing without uploading ([#650](https://github.comjoinworth/case-service/pull/650))
- 🚀 #LIVE fix: Fix error on "Accounts Receivable & Accounts Payable Aging Reports" page when continuing without uploading ([#652](https://github.comjoinworth/case-service/pull/652))
- 🚀 #LIVE fix: Fix error on "Accounts Receivable & Accounts Payable Aging Reports" page when continuing without uploading ([#655](https://github.comjoinworth/case-service/pull/655))

**[PAT-221](https://worth-ai.atlassian.net/browse/PAT-221) - [HYPERCARE] Tax Integration**

- 🚀 #LIVE fix: added esign data in progression ([#676](https://github.comjoinworth/case-service/pull/676))

**[PAT-223](https://worth-ai.atlassian.net/browse/PAT-223) - [Aurora CX]There is an issue with the Submit button on the Review and Submit page.**

- 🚀 #LIVE fix: query values fix ([#656](https://github.comjoinworth/case-service/pull/656))

**[PAT-250](https://worth-ai.atlassian.net/browse/PAT-250) - [BE] Co-Applicant Section Completion Email Triggering on Every Edit**

- 🚀 #LIVE fix: purge redis keys on case submit ([#714](https://github.comjoinworth/case-service/pull/714))
- 🚀 #LIVE fix: redis delete keys ([#721](https://github.comjoinworth/case-service/pull/721))
- 🚀 #LIVE redis bug fixes ([#731](https://github.comjoinworth/case-service/pull/731))
- 🚀 #LIVE fix: redis check bypass ([#732](https://github.comjoinworth/case-service/pull/732))

**[PAT-267](https://worth-ai.atlassian.net/browse/PAT-267) - [FE+BE][HYPERCARE] Tax Integration**

- 🚀 #LIVE fix: taxation stage complete logic update ([#716](https://github.comjoinworth/case-service/pull/716))

**[PAT-271](https://worth-ai.atlassian.net/browse/PAT-271) - Do Not Allow Application Submission when Required Custom Fields Are Blank**

- 🚀 #LIVE : check custom fields stages for required fields ([#710](https://github.comjoinworth/case-service/pull/710))

**[PAT-284](https://worth-ai.atlassian.net/browse/PAT-284) - [Aurora][Webhook]IDV Data Missing in Business Update Webhook After Adding Beneficial Owner**

- 🚀 #LIVE fix: get owners data logic fix ([#724](https://github.comjoinworth/case-service/pull/724))

**[PAT-52](https://worth-ai.atlassian.net/browse/PAT-52) - [BE] Error Encrypting EIN**

- 🚀 #LIVE fix: ein encryption error ([#519](https://github.comjoinworth/case-service/pull/519))

**[PAT-70](https://worth-ai.atlassian.net/browse/PAT-70) - Unable to Validate TIN On Company Details Page on Staging Envo for Easyflow**

- 🚀 #LIVE fix: easyflow ein null bug fix ([#520](https://github.comjoinworth/case-service/pull/520))

**[WIN-1241](https://worth-ai.atlassian.net/browse/WIN-1241) - Risk monitoring appears to be enabled/creating alerts for Bill**

- 🚩 update risk monitoring for business rel to customer when it risk monitoring permission updated #FLAG ([#430](https://github.comjoinworth/case-service/pull/430))

**[WIN-1250](https://worth-ai.atlassian.net/browse/WIN-1250) - Inconsistent Business Total Counts in CRO Dashboard for Bill.com Customer**

- 🚀 #LIVE fix: inconsistent total business count ([#435](https://github.comjoinworth/case-service/pull/435))

**[WIN-1253](https://worth-ai.atlassian.net/browse/WIN-1253) - Count Mismatch in Total Risk Case Counts Between CRO Dashboard Chart and Case Listing**

- 🚀 #LIVE fix: remove duplicate risk alerts. ([#434](https://github.comjoinworth/case-service/pull/434))

**[WIN-1310](https://worth-ai.atlassian.net/browse/WIN-1310) - Inconsistent Risk Alert Case Status and Notifications Across Environments**

- 🚀 #LIVE : fix issue remove risk alert count and notification when case status is Dismissed ([#484](https://github.comjoinworth/case-service/pull/484))

**[WIN-1359](https://worth-ai.atlassian.net/browse/WIN-1359) - [HYPERCARE] Aurora**

- 🚀 #LIVE fix: get only score generated business counts in portfolio chart in dashboard. ([#452](https://github.comjoinworth/case-service/pull/452))

**[WIN-1394](https://worth-ai.atlassian.net/browse/WIN-1394) - Webhook Events Not Logging and Triggering**

- 🚀 #LIVE fix: added one internal route ([#446](https://github.comjoinworth/case-service/pull/446))

**[WIN-1427](https://worth-ai.atlassian.net/browse/WIN-1427) - Inaccurate Dashboard Counts**

- 🚀 #LIVE fix: query update for average & range score stats ([#449](https://github.comjoinworth/case-service/pull/449))

**[WIN-1435](https://worth-ai.atlassian.net/browse/WIN-1435) - Purging Businesses Does Not Appear to be working**

- 🚀 #LIVE fix: drop duplicate foreign keys ([#491](https://github.comjoinworth/case-service/pull/491))

**[WIN-1441](https://worth-ai.atlassian.net/browse/WIN-1441) - Unable to progress past custom fields**

- 🚀 #LIVE - Unable to progress past custom fields ([#461](https://github.comjoinworth/case-service/pull/461))

**[WIN-1445](https://worth-ai.atlassian.net/browse/WIN-1445) - [BE] NAICS/MCC codes are not populating**

- 🚀 #LIVE: naics code fix ([#468](https://github.comjoinworth/case-service/pull/468))
- 🚀 #LIVE: naics code fix for existing businesses ([#472](https://github.comjoinworth/case-service/pull/472))
- 🚀 #LIVE HOTFIX-PULL-TO-MAIN: naics code fix ([#474](https://github.comjoinworth/case-service/pull/474))
- 🚀 #LIVE fix: website schema update ([#478](https://github.comjoinworth/case-service/pull/478))

**[WIN-1452](https://worth-ai.atlassian.net/browse/WIN-1452) - [BE] SERP is not pulling multiple business matches**

- 🚀 #LIVE fix: serp bulk payload update ([#464](https://github.comjoinworth/case-service/pull/464))

**[WIN-1487](https://worth-ai.atlassian.net/browse/WIN-1487) - MCC work broke NAICS manual creation**

- 🚀 #LIVE Fix providing NAICS information directly ([#490](https://github.comjoinworth/case-service/pull/490))

**[WIN-856](https://worth-ai.atlassian.net/browse/WIN-856) - [FE + BE] First time connected banking with Citibank and during edit banking switched to other bank but in the integration module, it showed the name of the previously connected bank only.**

- 🚀 #LIVE score refresh on Demand ([#462](https://github.comjoinworth/case-service/pull/462))

### ✨ Enhancement

**[DOS-161](https://worth-ai.atlassian.net/browse/DOS-161) - Update the progression API to include OCR for taxes**

- 🚀 UPDATE PROGRESSION API FOR OCR #LIVE PART 1 ([#613](https://github.comjoinworth/case-service/pull/613))
- 🚀 #LIVE business taxes stage ([#617](https://github.comjoinworth/case-service/pull/617))

**[DOS-163](https://worth-ai.atlassian.net/browse/DOS-163) - Feature flag to bypass IDV**

- 🚩 #FLAG feat: bypass ownership for aurora ([#585](https://github.comjoinworth/case-service/pull/585))

**[DOS-198](https://worth-ai.atlassian.net/browse/DOS-198) - [FE+BE] Customize Beneficial Owner Definition for Fairwinds**

- 🚀 feat: change in owner ship percentage #LIVE ([#625](https://github.comjoinworth/case-service/pull/625))

**[DOS-209](https://worth-ai.atlassian.net/browse/DOS-209) - [FE+BE] [Custom Onboarding] Update Processing History**

- 🚀 FEAT: Update processing history stage config #LIVE ([#662](https://github.comjoinworth/case-service/pull/662))

**[DOS-237](https://worth-ai.atlassian.net/browse/DOS-237) - [FE+BE] Update Processing History - Point of Sale Volume**

- 🚀 Update Processing History - POS Volume (Part 1) #LIVE ([#620](https://github.comjoinworth/case-service/pull/620))
- 🚀 Update Processing History - POS Volume (Part 2) #LIVE ([#621](https://github.comjoinworth/case-service/pull/621))
- 🚀 Update Processing History - POS Volume (Part 3) #LIVE ([#631](https://github.comjoinworth/case-service/pull/631))

**[DOS-387](https://worth-ai.atlassian.net/browse/DOS-387) - [BE] Middesk Failed TIN Orders**

- 🚩 Fix: merge conflict #FLAG feat: middesk orders ([#740](https://github.comjoinworth/case-service/pull/740))
- 🚀 #LIVE fix: bulk max retries fixes ([#746](https://github.comjoinworth/case-service/pull/746))

**[PAT-124](https://worth-ai.atlassian.net/browse/PAT-124) - Support is corporation public flag**

- 🚩 #FLAG: feat: add corporation type in business updated event payload ([#574](https://github.comjoinworth/case-service/pull/574))

**[PAT-149](https://worth-ai.atlassian.net/browse/PAT-149) - Send Processing Statements Data via Webhook**

- 🔥🚀 processing statements webhook #HOTFIX_PULL_TO_MAIN #LIVE ([#640](https://github.comjoinworth/case-service/pull/640))
- 🚀 #LIVE filter processing statements ([#641](https://github.comjoinworth/case-service/pull/641))

**[PAT-152](https://worth-ai.atlassian.net/browse/PAT-152) - Skip Sections**

- 🚀 #LIVE skip sections ([#670](https://github.comjoinworth/case-service/pull/670))
- 🚀 #LIVE skip sections ([#672](https://github.comjoinworth/case-service/pull/672))
- 🚀 #LIVE skip sections ([#673](https://github.comjoinworth/case-service/pull/673))
- 🚀 #LIVE skip sections ([#678](https://github.comjoinworth/case-service/pull/678))

**[PAT-174](https://worth-ai.atlassian.net/browse/PAT-174) - FE + BE | Equifax Vantage Score - Customer Setting**

- 🚀 #LIVE feat: equifax credit score customer setting ([#632](https://github.comjoinworth/case-service/pull/632))

**[PAT-38](https://worth-ai.atlassian.net/browse/PAT-38) - [FE +BE] [Custom Fields] Field Descriptions Not Displayed in Production**

- 🚀 #LIVE implement custom field description ([#541](https://github.comjoinworth/case-service/pull/541))

**[PAT-40](https://worth-ai.atlassian.net/browse/PAT-40) - FE + BE | Ability to Delete Custom Field CSV for Enterprise Customers**

- 🚀 #LIVE delete custom fields template ([#623](https://github.comjoinworth/case-service/pull/623))

**[PAT-44](https://worth-ai.atlassian.net/browse/PAT-44) - [Custom Fields] Separate Pages for Custom Field Onboarding Steps**

- 🚀 #LIVE feat: dynamic stages custom fields ([#586](https://github.comjoinworth/case-service/pull/586))
- 🚀 #LIVE fix: custom fields stage completion logic ([#607](https://github.comjoinworth/case-service/pull/607))
- 🚀 #LIVE fix: stage completion ([#609](https://github.comjoinworth/case-service/pull/609))

**[PAT-74](https://worth-ai.atlassian.net/browse/PAT-74) - Include applicant info on business and onboarding webhook payloads**

- 🚩 #FLAG : business applicants ([#527](https://github.comjoinworth/case-service/pull/527))
- 🚀 #LIVE: business applicants ([#530](https://github.comjoinworth/case-service/pull/530))

**[PAT-76](https://worth-ai.atlassian.net/browse/PAT-76) - Send Account/Routing via Auth via webhook**

- 🚀 #LIVE: business event payload to include deposit account ([#532](https://github.comjoinworth/case-service/pull/532))

**[PAT-8](https://worth-ai.atlassian.net/browse/PAT-8) - Enable Industry and NAICS codes to be populated**

- 🚀 #LIVE: naics industry priority ([#513](https://github.comjoinworth/case-service/pull/513))
- 🚀 #LIVE: naics industry priority ([#514](https://github.comjoinworth/case-service/pull/514))
- 🚀 #LIVE naics industry priority ([#517](https://github.comjoinworth/case-service/pull/517))
- 🚀 #LIVE: naics industry priority ([#518](https://github.comjoinworth/case-service/pull/518))

**[PAT-9](https://worth-ai.atlassian.net/browse/PAT-9) - Unmask TIN and ownership info in webhook**

- 🚀 #LIVE - feat: mask tin/ssn in logs ([#505](https://github.comjoinworth/case-service/pull/505))

**[PAT-97](https://worth-ai.atlassian.net/browse/PAT-97) - Include entity type and business formation date in webhook for business.updated**

- 🚩 #FLAG : formation date, entity type ([#547](https://github.comjoinworth/case-service/pull/547))

**[WIN-1289](https://worth-ai.atlassian.net/browse/WIN-1289) - [FE+BE] Update Risk Alert Trigger Logic for Risk Tiers**

- 🚀 UPDATE RISK ALERTS #LIVE ([#454](https://github.comjoinworth/case-service/pull/454))
- 🚀 UPDATE RISK ALERTS #LIVE PART 2 ([#463](https://github.comjoinworth/case-service/pull/463))
- 🚀 UPDATE RISK ALERTS #LIVE PART 3 ([#470](https://github.comjoinworth/case-service/pull/470))

**[WIN-1329](https://worth-ai.atlassian.net/browse/WIN-1329) - Enable updating of DBA**

- 🚀 #LIVE update dba and on bulk update ([#433](https://github.comjoinworth/case-service/pull/433))
- 🚀 #LIVE fix No fields to update error condition ([#437](https://github.comjoinworth/case-service/pull/437))

**[WIN-1426](https://worth-ai.atlassian.net/browse/WIN-1426) - OCR Easyflow**

- 🚀 #LIVE fix: returing customer-id ([#453](https://github.comjoinworth/case-service/pull/453))

**[WIN-1479](https://worth-ai.atlassian.net/browse/WIN-1479) - Update MCC/NAICS Mapping File**

- 🚀 Add NAICS and MCC code in core tables #LIVE ([#486](https://github.comjoinworth/case-service/pull/486))

### 🧪 Spike

**[PAT-10](https://worth-ai.atlassian.net/browse/PAT-10) - OpenCorporates+ZoomInfo: How to handle additional business_entity_verification providers in API + FrontEnds**

- 🚀 Facts POC #LIVE ([#516](https://github.comjoinworth/case-service/pull/516))

**[PAT-120](https://worth-ai.atlassian.net/browse/PAT-120) - Onboarding API Sequence Diagram**

- 🚩 #FLAG feat: add business route ([#606](https://github.comjoinworth/case-service/pull/606))
- 🚀 #LIVE fix: api updation as per requirement ([#603](https://github.comjoinworth/case-service/pull/603))

### 💻 Tech Task

**[DOS-117](https://worth-ai.atlassian.net/browse/DOS-117) - Update Lightning Verify copy for emails**

- 🚀 #LIVE fix: instant mail for lightning ([#552](https://github.comjoinworth/case-service/pull/552))

**[DOS-171](https://worth-ai.atlassian.net/browse/DOS-171) - No title available**

- 🚀 processing history #LIVE ([#604](https://github.comjoinworth/case-service/pull/604))

**[DOS-329](https://worth-ai.atlassian.net/browse/DOS-329) - [BE] Applications Received vs Approved API**

- 🚀 #LIVE Feat: Application Received VS Approved stats ([#686](https://github.comjoinworth/case-service/pull/686))

**[DOS-333](https://worth-ai.atlassian.net/browse/DOS-333) - [BE] Total Applications API**

- 🚀 Total applications API #LIVE ([#681](https://github.comjoinworth/case-service/pull/681))
- 🚀 Total applications PART 2 #LIVE ([#683](https://github.comjoinworth/case-service/pull/683))

**[DOS-334](https://worth-ai.atlassian.net/browse/DOS-334) - [BE] Time to Approval API**

- 🚀 #LIVE Time to approval stats ([#709](https://github.comjoinworth/case-service/pull/709))

**[DOS-335](https://worth-ai.atlassian.net/browse/DOS-335) - [BE] Application Rate API**

- 🚀 Application-Rate-API #LIVE ([#712](https://github.comjoinworth/case-service/pull/712))

**[DOS-336](https://worth-ai.atlassian.net/browse/DOS-336) - [BE] Team Performance API**

- 🚀 Team-Performance-API #LIVE ([#701](https://github.comjoinworth/case-service/pull/701))

**[PAT-162](https://worth-ai.atlassian.net/browse/PAT-162) - [BE] Flow Diagram in API-DOCS**

- 🚀 #LIVE feat: update business ([#708](https://github.comjoinworth/case-service/pull/708))

### 🛑 Defect

**[WIN-1460](https://worth-ai.atlassian.net/browse/WIN-1460) - "Worth Score Pending" Shown in Chart After Manual Score Refresh and Case Creation**

- 🚀 #LIVE remove risk alert status under manual review ([#479](https://github.comjoinworth/case-service/pull/479))

### 📝 Other

**[DOS-381](https://worth-ai.atlassian.net/browse/DOS-381) - No title available**

- 🚀 #LIVE: Share isTinRequired logic ([#753](https://github.comjoinworth/case-service/pull/753))
- 🚀 #LIVE: Add DB migration for the Allow Unverified TIN Submissions option in Customer Data Config ([#744](https://github.comjoinworth/case-service/pull/744))
- 🚀 #LIVE: Adds migration for updating the core stage with tin submission subfield ([#745](https://github.comjoinworth/case-service/pull/745))
- 🚀 #LIVE allow skipping assertTinValid on business creation ([#749](https://github.comjoinworth/case-service/pull/749))

**[DOS-84](https://worth-ai.atlassian.net/browse/DOS-84) - No title available**

- 🚀 #LIVE: hotfixes for multiple case creation validate fail ([#539](https://github.comjoinworth/case-service/pull/539))
- 🚀 #LIVE: create new case for lightning verification ([#534](https://github.comjoinworth/case-service/pull/534))
- 🚩 #FLAG feat: lightning verification ([#528](https://github.comjoinworth/case-service/pull/528))

- 🚀 #NO_JIRA #LIVE fix: dlq fix for webhook data fetching ([#661](https://github.comjoinworth/case-service/pull/661))
- 🚀 #NO_JIRA #LIVE fix: error message ([#653](https://github.comjoinworth/case-service/pull/653))
- 🚀 #NO_JIRA: UPDATE DEFAULT STATUS FOR STAGE FIELDS #LIVE ([#605](https://github.comjoinworth/case-service/pull/605))
- 🚀 #NO_JIRA #LIVE fix: schema ([#608](https://github.comjoinworth/case-service/pull/608))
- 🚀 #NO_JIRA #LIVE: add null check in getCaseId ([#610](https://github.comjoinworth/case-service/pull/610))
- 🚀 #NO_JIRA #LIVE fix: transaction fix ([#536](https://github.comjoinworth/case-service/pull/536))
- 🚀 #NO_JIRA #LIVE ZoomInfo/OC - Handle missing entries in business_names or business_addresses ([#538](https://github.comjoinworth/case-service/pull/538))
- 🚀 #NO_JIRA #LIVE fix: invitation status typo ([#540](https://github.comjoinworth/case-service/pull/540))
- 🚀 #NO_JIRA #LIVE fix: mailing address and facts issue fix ([#543](https://github.comjoinworth/case-service/pull/543))
- 🚀 #NO_JIRA #LIVE fix: break statement missing ([#555](https://github.comjoinworth/case-service/pull/555))
- 🚀 #NO_JIRA #LIVE feat: qa-env-kafka-configs ([#560](https://github.comjoinworth/case-service/pull/560))
- 🚀 #NO_JIRA #LIVE feat: kafka dlq topic ([#562](https://github.comjoinworth/case-service/pull/562))
- 🚀 #NO_JIRA #LIVE feat: resend invitation for lightning ([#566](https://github.comjoinworth/case-service/pull/566))
- 🚀 #NO_JIRA #LIVE fix: var declaration from const to let ([#571](https://github.comjoinworth/case-service/pull/571))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump cross-spawn from 7.0.3 to 7.0.6 ([#569](https://github.comjoinworth/case-service/pull/569))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump path-to-regexp and express ([#577](https://github.comjoinworth/case-service/pull/577))
- 🚀 #NO_JIRA #LIVE fix: race condition of events ([#524](https://github.comjoinworth/case-service/pull/524))
- 🚀 #NO_JIRA #LIVE fix: bulk middesk fix ([#529](https://github.comjoinworth/case-service/pull/529))
- 🚀 #NO_JIRA #LIVE Update case-management.ts ([#504](https://github.comjoinworth/case-service/pull/504))
- 🚀 #NO_JIRA: #LIVE chore(deps): bump cookie, cookie-parser and express ([#456](https://github.comjoinworth/case-service/pull/456))
- 🚀 #NO_JIRA #LIVE Update businesses.ts ([#483](https://github.comjoinworth/case-service/pull/483))
- 🚀 #NO_JIRA #LIVE fix: ein encrypt fix ([#488](https://github.comjoinworth/case-service/pull/488))
- 🚀 #NO_JIRA #LIVE fix: custom fields data files ([#495](https://github.comjoinworth/case-service/pull/495))

**[PAT-184](https://worth-ai.atlassian.net/browse/PAT-184) - No title available**

- 🚀 #LIVE feat: multiple file upload ([#665](https://github.comjoinworth/case-service/pull/665))
- 🚀 #LIVE multiple file upload: add default rule ([#668](https://github.comjoinworth/case-service/pull/668))

**[PAT-241](https://worth-ai.atlassian.net/browse/PAT-241) - No title available**

- 🚀 #LIVE: download multiple files ([#687](https://github.comjoinworth/case-service/pull/687))

**[PAT-51](https://worth-ai.atlassian.net/browse/PAT-51) - No title available**

- 🚩 enforce ownership #FLAG ([#531](https://github.comjoinworth/case-service/pull/531))
- 🚩 #FLAG : Fix owner_email & owner_id response ([#544](https://github.comjoinworth/case-service/pull/544))
- 🚩 #FLAG Business invite link fix ([#511](https://github.comjoinworth/case-service/pull/511))
- 🚩 #FLAG Turn update with on conflict into an insert on conflict ([#512](https://github.comjoinworth/case-service/pull/512))
- 🚩 Handle businessID mutating #FLAG ([#515](https://github.comjoinworth/case-service/pull/515))
- 🚩 #FLAG Handle the invited applicant not being flagged as "owner" ([#521](https://github.comjoinworth/case-service/pull/521))

**[PAT-77](https://worth-ai.atlassian.net/browse/PAT-77) - No title available**

- 🚀 feat: Case Status Issue for Applicant Invitee flow #LIVE ([#599](https://github.comjoinworth/case-service/pull/599))
- 🚀 feat: [Custom Fields] Update Boolean Field #LIVE ([#596](https://github.comjoinworth/case-service/pull/596))

**[WIN-1118](https://worth-ai.atlassian.net/browse/WIN-1118) - No title available**

- 🚩 Link Businesses that are the Same #FLAG ([#409](https://github.comjoinworth/case-service/pull/409))
- 🚩 Link Businesses that are the Same #FLAG PART 2 ([#438](https://github.comjoinworth/case-service/pull/438))
- 🚩 handle quick add correctly #FLAG ([#442](https://github.comjoinworth/case-service/pull/442))
- 🚩 QA Fixes for Merge #FLAG ([#447](https://github.comjoinworth/case-service/pull/447))
- 🚩 QA Fixes #FLAG ([#466](https://github.comjoinworth/case-service/pull/466))

**[WIN-1154](https://worth-ai.atlassian.net/browse/WIN-1154) - No title available**

- 🚀 Add internal route to get business names & addresses #LIVE ([#440](https://github.comjoinworth/case-service/pull/440))

**[WIN-853](https://worth-ai.atlassian.net/browse/WIN-853) - No title available**

- 🚀 Score Refresh On Demand Functionality #LIVE ([#448](https://github.comjoinworth/case-service/pull/448))
- 🚀 #LIVE scores refresh on demand ([#467](https://github.comjoinworth/case-service/pull/467))

## [v0.0.83](https://github.com/joinworth/case-service/compare/v0.0.82...v0.0.83) - 2024-10-27

### 📝 Other

- 📝 Fix: drop duplicate foreign keys

## [v0.0.82](https://github.com/joinworth/case-service/compare/v0.0.81...v0.0.82) - 2024-10-24

### 🧰 Task

**[INFRA-28](https://worth-ai.atlassian.net/browse/INFRA-28) - Cache yq Binary in GitHub Actions Workflow**

- 🚀 #LIVE Update yq step ([#476](https://github.comjoinworth/case-service/pull/476))

### 🐛 Bug

**[WIN-1359](https://worth-ai.atlassian.net/browse/WIN-1359) - [HYPERCARE] Aurora**

- 🚀 #LIVE fix: get only score generated business counts in portfolio chart in dashboard. ([#452](https://github.comjoinworth/case-service/pull/452))

**[WIN-1445](https://worth-ai.atlassian.net/browse/WIN-1445) - [BE] NAICS/MCC codes are not populating**

- 🚀 #LIVE fix: website schema update ([#478](https://github.comjoinworth/case-service/pull/478))

### 📝 Other

- 🚀 #NO_JIRA #LIVE Update businesses.ts ([#483](https://github.comjoinworth/case-service/pull/483))

## [v0.0.81](https://github.com/joinworth/case-service/compare/v0.0.77...v0.0.81) - 2024-10-24

### 📖 Story

**[WIN-1438](https://worth-ai.atlassian.net/browse/WIN-1438) - [BE] Implement progressive trigger of business.updated event**

- 🚀 #LIVE feat: subsequent business.updated webhook event ([#465](https://github.comjoinworth/case-service/pull/465))
- 🚀 #LIVE QA FIXES ([#475](https://github.comjoinworth/case-service/pull/475))

### 🧰 Task

**[INFRA-12](https://worth-ai.atlassian.net/browse/INFRA-12) - Implement GitHub Action to Cleanup Release Branches**

- 🚀 #LIVE clean-release-branches ([#369](https://github.comjoinworth/case-service/pull/369))

**[INFRA-28](https://worth-ai.atlassian.net/browse/INFRA-28) - Cache yq Binary in GitHub Actions Workflow**

- 🚀 #LIVE Update yq step ([#476](https://github.comjoinworth/case-service/pull/476))

**[INFRA-35](https://worth-ai.atlassian.net/browse/INFRA-35) - Update CICD pipeline versions to fix actions warning**

- 🚀 #LIVE Fix/image tag update warning ([#471](https://github.comjoinworth/case-service/pull/471))

### 🐛 Bug

**[WIN-1253](https://worth-ai.atlassian.net/browse/WIN-1253) - Count Mismatch in Total Risk Case Counts Between CRO Dashboard Chart and Case Listing**

- 🚀 #LIVE fix: remove duplicate risk alerts. ([#434](https://github.comjoinworth/case-service/pull/434))

**[WIN-1359](https://worth-ai.atlassian.net/browse/WIN-1359) - [HYPERCARE] Aurora**

- 🚀 #LIVE fix: get only score generated business counts in portfolio chart in dashboard. ([#452](https://github.comjoinworth/case-service/pull/452))

**[WIN-1445](https://worth-ai.atlassian.net/browse/WIN-1445) - [BE] NAICS/MCC codes are not populating**

- 🚀 #LIVE: naics code fix for existing businesses ([#472](https://github.comjoinworth/case-service/pull/472))
- 🚀 #LIVE fix: website schema update ([#478](https://github.comjoinworth/case-service/pull/478))

**[WIN-856](https://worth-ai.atlassian.net/browse/WIN-856) - [FE + BE] First time connected banking with Citibank and during edit banking switched to other bank but in the integration module, it showed the name of the previously connected bank only.**

- 🚀 #LIVE score refresh on Demand ([#462](https://github.comjoinworth/case-service/pull/462))

### ✨ Enhancement

**[WIN-1289](https://worth-ai.atlassian.net/browse/WIN-1289) - [FE+BE] Update Risk Alert Trigger Logic for Risk Tiers**

- 🚀 UPDATE RISK ALERTS #LIVE ([#454](https://github.comjoinworth/case-service/pull/454))
- 🚀 UPDATE RISK ALERTS #LIVE PART 2 ([#463](https://github.comjoinworth/case-service/pull/463))
- 🚀 UPDATE RISK ALERTS #LIVE PART 3 ([#470](https://github.comjoinworth/case-service/pull/470))

### 📝 Other

- 🚀 #NO_JIRA #LIVE Update businesses.ts ([#483](https://github.comjoinworth/case-service/pull/483))
- 🚀 #NO_JIRA: #LIVE chore(deps): bump cookie, cookie-parser and express ([#456](https://github.comjoinworth/case-service/pull/456))

**[WIN-1154](https://worth-ai.atlassian.net/browse/WIN-1154) - No title available**

- 🚀 Add internal route to get business names & addresses #LIVE ([#440](https://github.comjoinworth/case-service/pull/440))

**[WIN-853](https://worth-ai.atlassian.net/browse/WIN-853) - No title available**

- 🚀 Score Refresh On Demand Functionality #LIVE ([#448](https://github.comjoinworth/case-service/pull/448))
- 🚀 #LIVE scores refresh on demand ([#467](https://github.comjoinworth/case-service/pull/467))

## [v0.0.77](https://github.com/joinworth/case-service/compare/v0.0.76...v0.0.77) - 2024-10-18

### 🐛 Bug

**[WIN-1445](https://worth-ai.atlassian.net/browse/WIN-1445) - [BE] NAICS/MCC codes are not populating**

- 🚀 #LIVE - fix: add null checks ([#473](https://github.comjoinworth/case-service/pull/473))

## [v0.0.76](https://github.com/joinworth/case-service/compare/v0.0.75...v0.0.76) - 2024-10-18

### 📝 Other

- 📝 Fix: naics,mcc code mapping
- 📝 Fix: naics,mcc code mapping

## [v0.0.75](https://github.com/joinworth/case-service/compare/v0.0.74...v0.0.75) - 2024-10-17

### 🐛 Bug

**[WIN-1441](https://worth-ai.atlassian.net/browse/WIN-1441) - Unable to progress past custom fields**

- 🚀 #LIVE - Unable to progress past custom fields ([#461](https://github.comjoinworth/case-service/pull/461))

## [v0.0.74](https://github.com/joinworth/case-service/compare/v0.0.73...v0.0.74) - 2024-10-16

### 📝 Other

- 📝 Fix: serp bulk payload

## [v0.0.73](https://github.com/joinworth/case-service/compare/v0.0.72...v0.0.73) - 2024-10-15

### ✨ Enhancement

**[WIN-1426](https://worth-ai.atlassian.net/browse/WIN-1426) - OCR Easyflow**

- 🚀 #LIVE fix: returing customer-id ([#453](https://github.comjoinworth/case-service/pull/453))

## [v0.0.72](https://github.com/joinworth/case-service/compare/v0.0.70...v0.0.72) - 2024-10-11

### 📖 Story

**[WIN-1440](https://worth-ai.atlassian.net/browse/WIN-1440) - Implement business.updated event upon onboarding completion**

- 🚀 #LIVE feat: business updated webhook event after completion of onboarding ([#457](https://github.comjoinworth/case-service/pull/457)) (cherry picked from commit eec24729263d61b0c876faddb757272de8734276)
- 🚀 #LIVE fix: business updated webhook event for bulk businesses ([#459](https://github.comjoinworth/case-service/pull/459)) (cherry picked from commit d3a23477536542c58d094c73759320b17bbbff7e)

### 📝 Other

- 📝 Fix: wrong imports

## [v0.0.70](https://github.com/joinworth/case-service/compare/v0.0.69...v0.0.70) - 2024-10-08

### 🐛 Bug

**[WIN-1427](https://worth-ai.atlassian.net/browse/WIN-1427) - Inaccurate Dashboard Counts**

- 📝 Fix: cherry pick f46cc1226ad2008cdb6bd0a361d132ff4d46426d

## [v0.0.69](https://github.com/joinworth/case-service/compare/v0.0.68...v0.0.69) - 2024-10-08

### 🐛 Bug

**[WIN-1394](https://worth-ai.atlassian.net/browse/WIN-1394) - Webhook Events Not Logging and Triggering**

- 🚀 #LIVE fix: added one internal route ([#446](https://github.comjoinworth/case-service/pull/446))

## [v0.0.68](https://github.com/joinworth/case-service/compare/v0.0.65...v0.0.68) - 2024-10-04

### 📖 Story

**[WIN-1198](https://worth-ai.atlassian.net/browse/WIN-1198) - Aurora | Support NAICS to MCC mapping**

- 🚀 Fix: cherry-pick #LIVE NAISC MCC MAPPING ([#431](https://github.comjoinworth/case-service/pull/431))

**[WIN-1223](https://worth-ai.atlassian.net/browse/WIN-1223) - [BE] Send Webhook Events**

- 🚩 Fix: cherry-pick #FLAG feat: sending event ([#432](https://github.comjoinworth/case-service/pull/432))
- 🚩 #FLAG fix: payload sanity and invite expired event [] ([#439](https://github.comjoinworth/case-service/pull/439))
- 🚩 #FLAG fix ([#441](https://github.comjoinworth/case-service/pull/441))
- 🚩 #FLAG fix: added missing required fields ([#443](https://github.comjoinworth/case-service/pull/443))

**[WIN-1263](https://worth-ai.atlassian.net/browse/WIN-1263) - Aurora | Move accounting to the last integration**

- 🚩 MOVE ACCOUNTING TO SECOND LAST FOR AURORA #FLAG ([#426](https://github.comjoinworth/case-service/pull/426))

**[WIN-1380](https://worth-ai.atlassian.net/browse/WIN-1380) - Aurora | Add Invite Link in Response of Invite Business API for Aurora**

- 🚩 #FLAG feat: Invite business returning invitation_url ([#436](https://github.comjoinworth/case-service/pull/436))
- 🚩 #FLAG fix: no login condition ([#444](https://github.comjoinworth/case-service/pull/444))

### 🐛 Bug

**[WIN-1241](https://worth-ai.atlassian.net/browse/WIN-1241) - Risk monitoring appears to be enabled/creating alerts for Bill**

- 🚩 update risk monitoring for business rel to customer when it risk monitoring permission updated #FLAG ([#430](https://github.comjoinworth/case-service/pull/430))

### ✨ Enhancement

**[WIN-1329](https://worth-ai.atlassian.net/browse/WIN-1329) - Enable updating of DBA**

- 🚀 Fix: cherry-pick #LIVE update dba and on bulk update ([#433](https://github.comjoinworth/case-service/pull/433))
- 🚀 #LIVE fix No fields to update error condition ([#437](https://github.comjoinworth/case-service/pull/437))

### 📝 Other

- 📝 Fix: cherry-pic missing code

## [v0.0.65](https://github.com/joinworth/case-service/compare/v0.0.63...v0.0.65) - 2024-10-01

### 📖 Story

**[WIN-1214](https://worth-ai.atlassian.net/browse/WIN-1214) - Aurora | Prepopulate Owner**

- 📝 fix: maintaining case statuses ([#401](https://github.comjoinworth/case-service/pull/401))
- 📝 fix: query params ([#403](https://github.comjoinworth/case-service/pull/403))

**[WIN-1218](https://worth-ai.atlassian.net/browse/WIN-1218) - Aurora | No Login onboarding implementation**

- 📝 NO LOGIN ONBOARDING ([#393](https://github.comjoinworth/case-service/pull/393))

**[WIN-1219](https://worth-ai.atlassian.net/browse/WIN-1219) - Aurora | Custom Fields | Checkboxes**

- 📝 feat: implement checkbox input type in custom fields ([#392](https://github.comjoinworth/case-service/pull/392))
- 📝 feat: implement dynamic checkbox feature in custom fields ([#397](https://github.comjoinworth/case-service/pull/397))
- 📝 add rule for sum and equal ([#413](https://github.comjoinworth/case-service/pull/413))

**[WIN-1247](https://worth-ai.atlassian.net/browse/WIN-1247) - Aurora | Make Fields Required**

- 🚀 MAKE FIELDS REQUIRED #LIVE ([#419](https://github.comjoinworth/case-service/pull/419))

### 🧰 Task

**[INFRA-2](https://worth-ai.atlassian.net/browse/INFRA-2) - Enable and stream debug logs in dev environment to datadog without cluttering up pod stdout/stderr logs**

- 📝 Add debug log ([#414](https://github.comjoinworth/case-service/pull/414))

### 🐛 Bug

**[WIN-1242](https://worth-ai.atlassian.net/browse/WIN-1242) - New lien reported in score refresh - nothing shown in Public Records**

- 📝 Add entry for risk case in integration svc ([#399](https://github.comjoinworth/case-service/pull/399))

**[WIN-1243](https://worth-ai.atlassian.net/browse/WIN-1243) - [Quick Add] During creating business from quick add in response the TIN is going as the null value**

- 📝 fix: existing tin going null ([#406](https://github.comjoinworth/case-service/pull/406))
- 📝 fix: condition logic update ([#410](https://github.comjoinworth/case-service/pull/410))

**[WIN-1258](https://worth-ai.atlassian.net/browse/WIN-1258) - Incorrect Case Status Showing**

- 📝 case status fix ([#407](https://github.comjoinworth/case-service/pull/407))

**[WIN-1259](https://worth-ai.atlassian.net/browse/WIN-1259) - DBA Not Reflected on Company Profile Screen After Validation**

- 📝 fix DBA name issue ([#418](https://github.comjoinworth/case-service/pull/418))
- 🚀 #LIVE fix: Quick add feature issue fix. ([#424](https://github.comjoinworth/case-service/pull/424))

**[WIN-1282](https://worth-ai.atlassian.net/browse/WIN-1282) - Aurora | Conditional Values Not Displaying on Summary Screen**

- 🚀 #LIVE : Add rules in custom fields data on case view service. ([#427](https://github.comjoinworth/case-service/pull/427))

**[WIN-1298](https://worth-ai.atlassian.net/browse/WIN-1298) - Middesk did not run on any of the Wave uploads**

- 🚀 MIDDESK VERIFICATION FIX #LIVE ([#428](https://github.comjoinworth/case-service/pull/428))

**[WIN-1299](https://worth-ai.atlassian.net/browse/WIN-1299) - DBA did not load in when manually uploaded**

- 🚀 #LIVE DBA Name fixes ([#429](https://github.comjoinworth/case-service/pull/429))
- 🚀 #LIVE Fix mapper key name DBA ([#425](https://github.comjoinworth/case-service/pull/425))

### ✨ Enhancement

**[WIN-1192](https://worth-ai.atlassian.net/browse/WIN-1192) - Aurora Only Changes | Custom Fields | Conditional Logic**

- 📝 conditional logic ([#395](https://github.comjoinworth/case-service/pull/395))
- 📝 fix: custom fields data ([#398](https://github.comjoinworth/case-service/pull/398))
- 📝 issue fixes ([#417](https://github.comjoinworth/case-service/pull/417))

**[WIN-1213](https://worth-ai.atlassian.net/browse/WIN-1213) - Aurora | Custom Fields | Numerical Fields**

- 📝 Custom fields - add decimal field ([#390](https://github.comjoinworth/case-service/pull/390))
- 📝 decimal field ([#394](https://github.comjoinworth/case-service/pull/394))

**[WIN-1329](https://worth-ai.atlassian.net/browse/WIN-1329) - Enable updating of DBA**

- 🚀 #LIVE fix No fields to update error condition ([#437](https://github.comjoinworth/case-service/pull/437))

### 💻 Tech Task

**[WIN-1189](https://worth-ai.atlassian.net/browse/WIN-1189) - Enable Risk Monitoring for Bill + Rescore (SERP + enriched ZoomInfo/OC)**

- 📝 Fix the refresh score issue when user run manual refresh score all businesses which have a risk alert was not calculating the score. ([#405](https://github.comjoinworth/case-service/pull/405))

### 📝 Other

- 📝 Fix: dba merge issue
- 📝 Win 1167 general issue in the view case management ([#396](https://github.comjoinworth/case-service/pull/396))
- 📝 Win 1243 quick add during creating business from quick add in response the tin is going as the null value 2 ([#404](https://github.comjoinworth/case-service/pull/404))
- 📝 #NO_JIRA [Snyk] Security upgrade express from 4.19.2 to 4.21.0 ([#400](https://github.comjoinworth/case-service/pull/400))
- 📝 #NO_JIRA fix: reverting unnecessary changes ([#411](https://github.comjoinworth/case-service/pull/411))
- 📝 #NO_JIRA fix: reverted merged changes ([#415](https://github.comjoinworth/case-service/pull/415))
- 📝 #NO_JIRA: fix: typo in subscription refresh ([#416](https://github.comjoinworth/case-service/pull/416))
- 📝 #NO_JIRA: UPDATE PR-TITLE PIPELINE ([#421](https://github.comjoinworth/case-service/pull/421))
- 🚀 #NO_JIRA: #LIVE Update PR Title workflow ([#422](https://github.comjoinworth/case-service/pull/422))

**[WIN-1065](https://worth-ai.atlassian.net/browse/WIN-1065) - No title available**

- 📝 Add internal bulk import ([#356](https://github.comjoinworth/case-service/pull/356))

## [v0.0.63](https://github.com/joinworth/case-service/compare/v0.0.60...v0.0.63) - 2024-09-25

### 🐛 Bug

**[WIN-1299](https://worth-ai.atlassian.net/browse/WIN-1299) - DBA did not load in when manually uploaded**

- 🚀 #LIVE Fix mapper key name DBA ([#425](https://github.comjoinworth/case-service/pull/425))

### 📝 Other

- 📝 Fix: cherry picked f95891fdfcd6929e40799959c5ce9e2e95cc94fb
- 📝 Fix: cherry-pick ead2324de8fc412725c766f9b5bedf17efc5c05b

## [v0.0.60](https://github.com/joinworth/case-service/compare/v0.0.59...v0.0.60) - 2024-09-18

### 📝 Other

- 📝 Fix: cherry pick d66dd22c6c1167af2fbec80a8cbb068db24a0015

## [v0.0.59](https://github.com/joinworth/case-service/compare/v0.0.57...v0.0.59) - 2024-09-13

### 📖 Story

**[WIN-759](https://worth-ai.atlassian.net/browse/WIN-759) - [BE] Weekly Updating of Scoring**

- 📝 WEELY UPDATING OF SCORING ([#385](https://github.comjoinworth/case-service/pull/385))

### ✨ Enhancement

**[WIN-1216](https://worth-ai.atlassian.net/browse/WIN-1216) - [FE+BE] Display Custom Fields in Case View in the Same Order as CSV File**

- 📝 feat: implement step name in custom fields on case view ([#381](https://github.comjoinworth/case-service/pull/381))
- 📝 fix: add uploaded document position. ([#386](https://github.comjoinworth/case-service/pull/386))
- 📝 fix : customer id not get case conduction. ([#389](https://github.comjoinworth/case-service/pull/389))

**[WIN-740](https://worth-ai.atlassian.net/browse/WIN-740) - [BE] Cases Service | add /purge route to handle deleting pre-determined TINs from Platform**

- 📝 purge business ([#375](https://github.comjoinworth/case-service/pull/375))

### 💻 Tech Task

**[WIN-1189](https://worth-ai.atlassian.net/browse/WIN-1189) - Enable Risk Monitoring for Bill + Rescore (SERP + enriched ZoomInfo/OC)**

- 📝 Fix the refresh score issue when user run manual refresh score all businesses which have a risk alert was not calculating the score. ([#405](https://github.comjoinworth/case-service/pull/405))

### 📝 Other

- 📝 Win 1243 quick add during creating business from quick add in response the tin is going as the null value 2 ([#404](https://github.comjoinworth/case-service/pull/404))
- 📝 #NO_JIRA fix: serp import error ([#384](https://github.comjoinworth/case-service/pull/384))
- 📝 #NO_JIRA fix: removed extra param from api call ([#387](https://github.comjoinworth/case-service/pull/387))
- 📝 #NO_JIRA fix: pull hotfix to main ([#391](https://github.comjoinworth/case-service/pull/391))

## [v0.0.57](https://github.com/joinworth/case-service/compare/v0.0.56...v0.0.57) - 2024-09-06

### 📝 Other

- 📝 Feat: cherry picked from commit 72f5db9ed4f10bdb672c5293204b3ebc7c311c85
- 📝 Fix: typo
- 📝 Fix: undefined applicants
- 📝 Fix: updated customer id of aurora

## [v0.0.56](https://github.com/joinworth/case-service/compare/v0.0.55...v0.0.56) - 2024-09-04

### 📖 Story

**[WIN-1140](https://worth-ai.atlassian.net/browse/WIN-1140) - Add SERP API data to the schedule for score refreshing**

- 📝 adding serp integration for bulk process ([#374](https://github.comjoinworth/case-service/pull/374))

**[WIN-1152](https://worth-ai.atlassian.net/browse/WIN-1152) - As a user, I should be able to easily test the onboarding flow.**

- 📝 feat: Easy onboarding flow ([#373](https://github.comjoinworth/case-service/pull/373))

**[WIN-1178](https://worth-ai.atlassian.net/browse/WIN-1178) - [FE+BE]CLONE - Add support for multiple business names and business addresses**

- 📝 feat: Add support for multiple business names and business addresses [PART 1] ([#367](https://github.comjoinworth/case-service/pull/367))
- 📝 feat: addition of business names and addresses in bulk upload/quick add [Part 2] ([#379](https://github.comjoinworth/case-service/pull/379))

**[WIN-988](https://worth-ai.atlassian.net/browse/WIN-988) - Worth Admin | Enable Editing of Customer Settings Post-Creation**

- 📝 feat: fetch sample custom fields template from s3 ([#370](https://github.comjoinworth/case-service/pull/370))

### 🐛 Bug

**[WIN-1098](https://worth-ai.atlassian.net/browse/WIN-1098) - Unauthorized Access Issue on Production Customer Portal**

- 📝 feat: customer access middleware ([#365](https://github.comjoinworth/case-service/pull/365))
- 📝 fix: response status code ([#376](https://github.comjoinworth/case-service/pull/376))
- 📝 fix: add missing import ([#377](https://github.comjoinworth/case-service/pull/377))
- 📝 fix: update error status code ([#378](https://github.comjoinworth/case-service/pull/378))
- 📝 fix: redis insert for bulk process ([#382](https://github.comjoinworth/case-service/pull/382))

**[WIN-1120](https://worth-ai.atlassian.net/browse/WIN-1120) - Issue in Quick add feature**

- 📝 FIX: default risk monitoring enable quick add businessess ([#364](https://github.comjoinworth/case-service/pull/364))

**[WIN-1206](https://worth-ai.atlassian.net/browse/WIN-1206) - [Custom FIelds ]Character Limit Issue for "Products Sold/Services Provided" Field in Aurora CSV**

- 📝 fix: remove character limit for field value column ([#371](https://github.comjoinworth/case-service/pull/371))

### ✨ Enhancement

**[WIN-1149](https://worth-ai.atlassian.net/browse/WIN-1149) - [FE/BE] Steps Not Creating New Pages for Custom Fields**

- 📝 feat: implement step name in custom fields in backend side. ([#362](https://github.comjoinworth/case-service/pull/362))
- 📝 fix: change in get custom fields api in backend. ([#366](https://github.comjoinworth/case-service/pull/366))

**[WIN-740](https://worth-ai.atlassian.net/browse/WIN-740) - [BE] Cases Service | add /purge route to handle deleting pre-determined TINs from Platform**

- 📝 purge business ([#375](https://github.comjoinworth/case-service/pull/375))

### 📝 Other

- 📝 #NO_JIRA fix: unit tests ([#380](https://github.comjoinworth/case-service/pull/380))
- 📝 #NO_JIRA# fix: serializable map import ([#383](https://github.comjoinworth/case-service/pull/383))
- 📝 #NO_JIRA fix: serp import error ([#384](https://github.comjoinworth/case-service/pull/384))

**[WIN-689](https://worth-ai.atlassian.net/browse/WIN-689) - No title available**

- 📝 add owner details in get business data API ([#368](https://github.comjoinworth/case-service/pull/368))

## [v0.0.55](https://github.com/joinworth/case-service/compare/v0.0.54...v0.0.55) - 2024-08-30

### ✨ Enhancement

**[WIN-1149](https://worth-ai.atlassian.net/browse/WIN-1149) - [FE/BE] Steps Not Creating New Pages for Custom Fields**

- 📝 feat: implement step name in custom fields in backend side. ([#362](https://github.comjoinworth/case-service/pull/362))
- 📝 fix: change in get custom fields api in backend. ([#366](https://github.comjoinworth/case-service/pull/366))

## [v0.0.54](https://github.com/joinworth/case-service/compare/v0.0.49...v0.0.54) - 2024-08-30

### 📖 Story

**[WIN-1011](https://worth-ai.atlassian.net/browse/WIN-1011) - As a user, I expect to be able to send a customer invite email via the bulk import process.**

- 📝 feat: bulk send invite based on flag ([#323](https://github.comjoinworth/case-service/pull/323))

**[WIN-1012](https://worth-ai.atlassian.net/browse/WIN-1012) - Enable Relative Score Changes for Risk Alerts**

- 📝 feat: ENABLE RELATIVE SCORE CHANGES FOR RISK ALERTS ([#322](https://github.comjoinworth/case-service/pull/322))
- 📝 enable relative score changes for risk alerts ([#331](https://github.comjoinworth/case-service/pull/331))

**[WIN-1017](https://worth-ai.atlassian.net/browse/WIN-1017) - Quick Add - Business Inquiry**

- 📝 feat: added customer admin to route permission and made dba column required ([#336](https://github.comjoinworth/case-service/pull/336))
- 📝 feat: added customer admin to route permission and made dba column required Part - 2 ([#342](https://github.comjoinworth/case-service/pull/342))

**[WIN-296](https://worth-ai.atlassian.net/browse/WIN-296) - [BE] Case Activity Log**

- 📝 feat: logic to produce audit logs PART 2 ([#305](https://github.comjoinworth/case-service/pull/305))

**[WIN-442](https://worth-ai.atlassian.net/browse/WIN-442) - [FE+BE] Risk Alerts Display to Customer Admin**

- 📝 fix: risk alerts data in cases response ([#312](https://github.comjoinworth/case-service/pull/312))

**[WIN-873](https://worth-ai.atlassian.net/browse/WIN-873) - Send Email Notification When a Case is Assigned to a User**

- 📝 send email when case assigned to user ([#319](https://github.comjoinworth/case-service/pull/319))

**[WIN-943](https://worth-ai.atlassian.net/browse/WIN-943) - [FE+BE] Worth Admin Uploads Custom Fields CSV**

- 📝 admin uploads custom fields ([#299](https://github.comjoinworth/case-service/pull/299))
- 📝 admin uploads custom fields ([#315](https://github.comjoinworth/case-service/pull/315))
- 📝 admin uploads custom fields ([#326](https://github.comjoinworth/case-service/pull/326))

**[WIN-944](https://worth-ai.atlassian.net/browse/WIN-944) - [FE+BE] Applicant Onboarding Flow with Custom Fields**

- 📝 feat: applicant onboarding flow custom fields ([#295](https://github.comjoinworth/case-service/pull/295))
- 📝 fix: custom fields get progression ([#314](https://github.comjoinworth/case-service/pull/314))
- 📝 fix: custom fields add or update ([#316](https://github.comjoinworth/case-service/pull/316))
- 📝 fix: custom fields data fetch ([#340](https://github.comjoinworth/case-service/pull/340))

**[WIN-946](https://worth-ai.atlassian.net/browse/WIN-946) - Display Custom fields under Case management**

- 📝 get custom fields for case ([#329](https://github.comjoinworth/case-service/pull/329))
- 📝 feat: update code for property ([#343](https://github.comjoinworth/case-service/pull/343))

### 🐛 Bug

**[WIN-1035](https://worth-ai.atlassian.net/browse/WIN-1035) - Website does not appear to be passed to Middesk**

- 📝 pass website to middesk in bulk import ([#335](https://github.comjoinworth/case-service/pull/335))

**[WIN-1075](https://worth-ai.atlassian.net/browse/WIN-1075) - Worth Admin Uploads Custom Fields CSV Issues**

- 📝 update validation for custom fields upload ([#332](https://github.comjoinworth/case-service/pull/332))
- 📝 update validation for custom fields upload ([#339](https://github.comjoinworth/case-service/pull/339))
- 📝 update the db migration scripts ([#341](https://github.comjoinworth/case-service/pull/341))

**[WIN-1087](https://worth-ai.atlassian.net/browse/WIN-1087) - BulkUpdateMapper : Business TINs cannot be updated accurately**

- 📝 BulkUpdateMapper -- Block TIN Updates ([#324](https://github.comjoinworth/case-service/pull/324))

**[WIN-1094](https://worth-ai.atlassian.net/browse/WIN-1094) - Score calculated consumer failing in Case Svc**

- 📝 fix: score calculated consumer bug fix ([#327](https://github.comjoinworth/case-service/pull/327))

**[WIN-1095](https://worth-ai.atlassian.net/browse/WIN-1095) - No title available**

- 📝 fix: updated condition ([#333](https://github.comjoinworth/case-service/pull/333))
- 📝 fix: risk case not generating bug ([#334](https://github.comjoinworth/case-service/pull/334))

**[WIN-1104](https://worth-ai.atlassian.net/browse/WIN-1104) - Case Activity log -Getting duplicate enteries in activity log**

- 📝 fix: display only invited cases in Case Activity log on customer portal. ([#348](https://github.comjoinworth/case-service/pull/348))

**[WIN-1166](https://worth-ai.atlassian.net/browse/WIN-1166) - Issue in expiry time and resend invite of customer invitation mail**

- 📝 token expiry for applicant ([#361](https://github.comjoinworth/case-service/pull/361))

**[WIN-1206](https://worth-ai.atlassian.net/browse/WIN-1206) - [Custom FIelds ]Character Limit Issue for "Products Sold/Services Provided" Field in Aurora CSV**

- 📝 fix: remove character limit for field value column ([#371](https://github.comjoinworth/case-service/pull/371))

**[WIN-872](https://worth-ai.atlassian.net/browse/WIN-872) - No title available**

- 📝 fix: update case status API modified to work correctly for archive status modification ([#349](https://github.comjoinworth/case-service/pull/349))

**[WIN-994](https://worth-ai.atlassian.net/browse/WIN-994) - Receiving Daily Emails for "Connectivity Issue Detected" and "Your Worth Score is Ready!"**

- 📝 fix: daily connectivity email bug due to score refresh ([#345](https://github.comjoinworth/case-service/pull/345))
- 📝 fix: daily connectivity email bug due to score refresh PART - 2 ([#355](https://github.comjoinworth/case-service/pull/355))

### 🔗 Subtask

**[WIN-1081](https://worth-ai.atlassian.net/browse/WIN-1081) - Refresh Equifax credit score on monthly refresh cycle**

- 📝 Internal API to get business owners ([#325](https://github.comjoinworth/case-service/pull/325))

### ✨ Enhancement

**[WIN-1041](https://worth-ai.atlassian.net/browse/WIN-1041) - Risk Alert Enhancements**

- 📝 risk alert enhancement ([#351](https://github.comjoinworth/case-service/pull/351))

**[WIN-992](https://worth-ai.atlassian.net/browse/WIN-992) - Pull website from Equifax/Verdata and run in Middesk**

- 📝 feat: website fallback logic ([#309](https://github.comjoinworth/case-service/pull/309))
- 📝 fix: schema and null check ([#310](https://github.comjoinworth/case-service/pull/310))

### 💻 Tech Task

**[WIN-1052](https://worth-ai.atlassian.net/browse/WIN-1052) - Wave Access Prep**

- 📝 handle nullable case_id in score generated handler ([#304](https://github.comjoinworth/case-service/pull/304))

**[WIN-1078](https://worth-ai.atlassian.net/browse/WIN-1078) - Add review score and count to Verdata Enrichment Route**

- 📝 | Add review count & average review score to upload mapper ([#318](https://github.comjoinworth/case-service/pull/318))

**[WIN-1160](https://worth-ai.atlassian.net/browse/WIN-1160) - Update cors options for origin to match via regex**

- 📝 fix: cors origin regex fix ([#359](https://github.comjoinworth/case-service/pull/359))

**[WIN-590](https://worth-ai.atlassian.net/browse/WIN-590) - Add customer_id in cognito's authorization token**

- 📝 feat: customer-id in id-token ([#358](https://github.comjoinworth/case-service/pull/358))

**[WIN-896](https://worth-ai.atlassian.net/browse/WIN-896) - Setup launchDarkly for feature flags**

- 📝 LaunchDarkly feature flag implementation ([#338](https://github.comjoinworth/case-service/pull/338))

### 📝 Other

- 📝 Ci: repo clean up ([#346](https://github.comjoinworth/case-service/pull/346))
- 📝 #NO_JIRA# Fix Case tests ([#308](https://github.comjoinworth/case-service/pull/308))
- 📝 #NO_JIRA# Run tests action when merging to main ([#306](https://github.comjoinworth/case-service/pull/306))
- 📝 #NO_JIRA# Hotfix unhandled exception ([#320](https://github.comjoinworth/case-service/pull/320))
- 📝 #NO_JIRA# refactor: remove console logs from test files ([#321](https://github.comjoinworth/case-service/pull/321))
- 📝 #NO_JIRA# style: business name spell fix ([#337](https://github.comjoinworth/case-service/pull/337))
- 📝 #NO_JIRA: fix: reverted temp feature flags ([#344](https://github.comjoinworth/case-service/pull/344))

**[WIN-1034](https://worth-ai.atlassian.net/browse/WIN-1034) - No title available**

- 📝 | allow naics_code & naics_title to be updated in bulk context ([#317](https://github.comjoinworth/case-service/pull/317))

## [v0.0.49](https://github.com/joinworth/case-service/compare/v0.0.48...v0.0.49) - 2024-08-05

### 📖 Story

**[WIN-1012](https://worth-ai.atlassian.net/browse/WIN-1012) - Enable Relative Score Changes for Risk Alerts**

- 📝 feat: ENABLE RELATIVE SCORE CHANGES FOR RISK ALERTS ([#322](https://github.comjoinworth/case-service/pull/322))
- 📝 enable relative score changes for risk alerts ([#331](https://github.comjoinworth/case-service/pull/331))

### 🐛 Bug

**[WIN-1095](https://worth-ai.atlassian.net/browse/WIN-1095) - No title available**

- 📝 fix: updated condition ([#333](https://github.comjoinworth/case-service/pull/333))
- 📝 fix: risk case not generating bug ([#334](https://github.comjoinworth/case-service/pull/334))

### 🔗 Subtask

**[WIN-1081](https://worth-ai.atlassian.net/browse/WIN-1081) - Refresh Equifax credit score on monthly refresh cycle**

- 📝 Internal API to get business owners ([#325](https://github.comjoinworth/case-service/pull/325))

### 📝 Other

- 📝 Update README.md
- 📝 #NO_JIRA# Hotfix unhandled exception ([#320](https://github.comjoinworth/case-service/pull/320))
- 📝 Chore: cherry-pick 323 2fc026db47d83dee621e915d9b325b03a09107fd

## [v0.0.48](https://github.com/joinworth/case-service/compare/v0.0.47...v0.0.48) - 2024-07-30

### 🐛 Bug

**[WIN-1087](https://worth-ai.atlassian.net/browse/WIN-1087) - BulkUpdateMapper : Business TINs cannot be updated accurately**

- 📝 BulkUpdateMapper -- Block TIN Updates ([#324](https://github.comjoinworth/case-service/pull/324))

**[WIN-1094](https://worth-ai.atlassian.net/browse/WIN-1094) - Score calculated consumer failing in Case Svc**

- 📝 fix: score calculated consumer bug fix ([#327](https://github.comjoinworth/case-service/pull/327))

### 💻 Tech Task

**[WIN-1078](https://worth-ai.atlassian.net/browse/WIN-1078) - Add review score and count to Verdata Enrichment Route**

- 📝 | Add review count & average review score to upload mapper ([#318](https://github.comjoinworth/case-service/pull/318))

## [v0.0.47](https://github.com/joinworth/case-service/compare/v0.0.46...v0.0.47) - 2024-07-25

### 📖 Story

**[WIN-873](https://worth-ai.atlassian.net/browse/WIN-873) - Send Email Notification When a Case is Assigned to a User**

- 📝 send email when case assigned to user ([#319](https://github.comjoinworth/case-service/pull/319))

## [v0.0.46](https://github.com/joinworth/case-service/compare/v0.0.45...v0.0.46) - 2024-07-25

### 📖 Story

**[WIN-296](https://worth-ai.atlassian.net/browse/WIN-296) - [BE] Case Activity Log**

- 📝 feat: producer logic to emit audit log event PART 1 ([#298](https://github.comjoinworth/case-service/pull/298))
- 📝 feat: logic to produce audit logs PART 2 ([#305](https://github.comjoinworth/case-service/pull/305))

**[WIN-441](https://worth-ai.atlassian.net/browse/WIN-441) - [FE+BE] Risk Alert Status Management**

- 📝 risk alert status management ([#285](https://github.comjoinworth/case-service/pull/285))
- 📝 fix: maintain score trigger with risk cases ([#286](https://github.comjoinworth/case-service/pull/286))
- 📝 risk alert status management updated ([#287](https://github.comjoinworth/case-service/pull/287))
- 📝 risk alert status management ([#303](https://github.comjoinworth/case-service/pull/303))

**[WIN-442](https://worth-ai.atlassian.net/browse/WIN-442) - [FE+BE] Risk Alerts Display to Customer Admin**

- 📝 feat: risk alert customer admin ([#296](https://github.comjoinworth/case-service/pull/296))
- 📝 fix: risk alerts data in cases response ([#312](https://github.comjoinworth/case-service/pull/312))

**[WIN-693](https://worth-ai.atlassian.net/browse/WIN-693) - [FE+BE] Risk Alert Notifications**

- 📝 feat: get all risk cases for business respective of a customer ([#284](https://github.comjoinworth/case-service/pull/284))

**[WIN-873](https://worth-ai.atlassian.net/browse/WIN-873) - Send Email Notification When a Case is Assigned to a User**

- 📝 feat: feature to send mail when case is assigned to user ([#278](https://github.comjoinworth/case-service/pull/278))

### ✨ Enhancement

**[WIN-992](https://worth-ai.atlassian.net/browse/WIN-992) - Pull website from Equifax/Verdata and run in Middesk**

- 📝 feat: website fallback logic ([#309](https://github.comjoinworth/case-service/pull/309))
- 📝 fix: schema and null check ([#310](https://github.comjoinworth/case-service/pull/310))

### 💻 Tech Task

**[WIN-1052](https://worth-ai.atlassian.net/browse/WIN-1052) - Wave Access Prep**

- 📝 handle nullable case_id in score generated handler ([#304](https://github.comjoinworth/case-service/pull/304))

### 📝 Other

- 📝 #NO_JIRA hotfix: score update on score refresh ([#290](https://github.comjoinworth/case-service/pull/290))
- 📝 #NO_JIRA: fix: Kafka error logging ([#293](https://github.comjoinworth/case-service/pull/293))
- 📝 #NO_JIRA fix: removing unimportant logs ([#294](https://github.comjoinworth/case-service/pull/294))
- 📝 #NO_JIRA: fix: sql query typo ([#300](https://github.comjoinworth/case-service/pull/300))
- 📝 #NO_JIRA feat: added business_id to audit trail table and event handlers ([#301](https://github.comjoinworth/case-service/pull/301))
- 📝 #NO_JIRA fix: sql values typo ([#302](https://github.comjoinworth/case-service/pull/302))
- 📝 #NO_JIRA# Fix Case tests ([#308](https://github.comjoinworth/case-service/pull/308))
- 📝 #NO_JIRA# Run tests action when merging to main ([#306](https://github.comjoinworth/case-service/pull/306))

**[WIN-1034](https://worth-ai.atlassian.net/browse/WIN-1034) - No title available**

- 📝 | allow naics_code & naics_title to be updated in bulk context ([#317](https://github.comjoinworth/case-service/pull/317))

## [v0.0.45](https://github.com/joinworth/case-service/compare/v0.0.44...v0.0.45) - 2024-07-23

### 💻 Tech Task

**[WIN-1052](https://worth-ai.atlassian.net/browse/WIN-1052) - Wave Access Prep**

- 📝 handle nullable case_id in score generated handler ([#304](https://github.comjoinworth/case-service/pull/304))

## [v0.0.44](https://github.com/joinworth/case-service/compare/v0.0.43...v0.0.44) - 2024-07-18

### 📝 Other

- 📝 Fix: removing unnecessary logs

## [v0.0.43](https://github.com/joinworth/case-service/compare/v0.0.41...v0.0.43) - 2024-07-16

### 📝 Other

- 📝 Revert: remove score_trigger_if from riskAlertPayload
- 📝 Fix: score update on score refresh

## [v0.0.41](https://github.com/joinworth/case-service/compare/v0.0.35...v0.0.41) - 2024-07-16

### 📖 Story

**[WIN-440](https://worth-ai.atlassian.net/browse/WIN-440) - [FE+BE] Risk Alerts Generation**

- 📝 fix : create risk alert when score refresh in application edit & manual refresh also ([#283](https://github.comjoinworth/case-service/pull/283))
- 📝 Risks Alert cases ([#253](https://github.comjoinworth/case-service/pull/253))

**[WIN-834](https://worth-ai.atlassian.net/browse/WIN-834) - [FE+BE] As a user, when a company website is provided, I want the information to be passed to Middesk.**

- 📝 fix: schema and payload update ([#279](https://github.comjoinworth/case-service/pull/279))
- 📝 fix: schema fix ([#282](https://github.comjoinworth/case-service/pull/282))
- 📝 fix: triggering kafka event for middesk website data gathering ([#268](https://github.comjoinworth/case-service/pull/268))

**[WIN-869](https://worth-ai.atlassian.net/browse/WIN-869) - Risk Monitoring – Worth Admin Setting Intended Functionality**

- 📝 Risk Monitoring intended functionality ([#276](https://github.comjoinworth/case-service/pull/276))

**[WIN-908](https://worth-ai.atlassian.net/browse/WIN-908) - [BE+FE]CRO Dashboard – Industry Exposure**

- 📝 CRO Dashboard Industry exposure ([#266](https://github.comjoinworth/case-service/pull/266))

### ✨ Enhancement

**[WIN-982](https://worth-ai.atlassian.net/browse/WIN-982) - Allow each integration lookup to run independently**

- 📝 Separate verdata logic from middesk ([#270](https://github.comjoinworth/case-service/pull/270))

### 💻 Tech Task

**[WIN-924](https://worth-ai.atlassian.net/browse/WIN-924) - Update bulk import records**

- 📝 | Bulk customer update ([#218](https://github.comjoinworth/case-service/pull/218))
- 📝 Bulk customer update fixes ([#280](https://github.comjoinworth/case-service/pull/280))

**[WIN-954](https://worth-ai.atlassian.net/browse/WIN-954) - Retrigger Middesk webhook for Bill.com businesses**

- 📝 Write back TIN to business record ([#281](https://github.comjoinworth/case-service/pull/281))
- 📝 feat: added routes to update customers business details ([#269](https://github.comjoinworth/case-service/pull/269))
- 📝 fix: converted uuid to string ([#272](https://github.comjoinworth/case-service/pull/272))

**[WIN-983](https://worth-ai.atlassian.net/browse/WIN-983) - Update the logic for Middesk failed webhooks**

- 📝 feat: business verified consumer ([#273](https://github.comjoinworth/case-service/pull/273))

### 📝 Other

- 📝 Fix: score updation on refresh ([#288](https://github.comjoinworth/case-service/pull/288))
- 📝 #NO_JIRA# Update Industry on Equifax Match ([#274](https://github.comjoinworth/case-service/pull/274))
- 📝 #NO_JIRA# fix type issues ([#275](https://github.comjoinworth/case-service/pull/275))

## [v0.0.35](https://github.com/joinworth/case-service/compare/v0.0.33...v0.0.35) - 2024-07-08

### 📖 Story

**[WIN-439](https://worth-ai.atlassian.net/browse/WIN-439) - [FE + BE] Risk Monitoring – Customer Admin**

- 📝 feat: customer admin risk monitoring ([#238](https://github.comjoinworth/case-service/pull/238))

**[WIN-691](https://worth-ai.atlassian.net/browse/WIN-691) - [FE+BE] Update Case Status and Assign Case from Customer Admin Portal**

- 📝 feat: update and assign case ([#237](https://github.comjoinworth/case-service/pull/237))
- 📝 fix: added created_at in applicant object ([#241](https://github.comjoinworth/case-service/pull/241))
- 📝 fix: reordered the case statuses the are allowed to be updated ([#244](https://github.comjoinworth/case-service/pull/244))
- 📝 fix: updated REJECTED case status to MANUALLY_REJECTED ([#245](https://github.comjoinworth/case-service/pull/245))

**[WIN-802](https://worth-ai.atlassian.net/browse/WIN-802) - [FE+BE] CRO Dashboard – Average Worth Score**

- 📝 CRO-Dashboard-Average-Worth-Score ([#262](https://github.comjoinworth/case-service/pull/262))

**[WIN-861](https://worth-ai.atlassian.net/browse/WIN-861) - Case creation while adding/removing integration connection**

- 📝 feat: Case creation while adding/removing integration connection ([#248](https://github.comjoinworth/case-service/pull/248))
- 📝 fix: case creation order for standalone case ([#250](https://github.comjoinworth/case-service/pull/250))

**[WIN-870](https://worth-ai.atlassian.net/browse/WIN-870) - Risk Monitoring – Customer Admin | Applicant Settings Intended Functionality**

- 📝 fix: internal api response updates ([#254](https://github.comjoinworth/case-service/pull/254))

**[WIN-904](https://worth-ai.atlassian.net/browse/WIN-904) - CRO Dashboard – Case Approval Status**

- 📝 feat: api to fetch case decision stats ([#260](https://github.comjoinworth/case-service/pull/260))

**[WIN-905](https://worth-ai.atlassian.net/browse/WIN-905) - CRO Dashboard – Cases in Progress**

- 📝 feat: api to fetch in progress case decision stats ([#261](https://github.comjoinworth/case-service/pull/261))

**[WIN-906](https://worth-ai.atlassian.net/browse/WIN-906) - CRO Dashboard – Count of Businesses**

- 📝 feat: api to fetch business score range stats ([#263](https://github.comjoinworth/case-service/pull/263))

**[WIN-907](https://worth-ai.atlassian.net/browse/WIN-907) - CRO Dashboard – Portfolio Level Score Over Time**

- 📝 feat: api to fetch customer portfolio stats ([#264](https://github.comjoinworth/case-service/pull/264))

### 🐛 Bug

**[WIN-794](https://worth-ai.atlassian.net/browse/WIN-794) - HYPERCARE - Verified TIN unable to progress**

- 📝 fix: inconsistent businesses with VERIFIED TIN entries ([#216](https://github.comjoinworth/case-service/pull/216))

**[WIN-856](https://worth-ai.atlassian.net/browse/WIN-856) - [FE + BE] First time connected banking with Citibank and during edit banking switched to other bank but in the integration module, it showed the name of the previously connected bank only.**

- 📝 fetch latest task details for plaid ([#256](https://github.comjoinworth/case-service/pull/256))

**[WIN-859](https://worth-ai.atlassian.net/browse/WIN-859) - [FE + BE] Customer invite --Start the onboarding through customer invite and after submitted only, case status should be marked as pending**

- 📝 fix: invitation not linked with business ([#255](https://github.comjoinworth/case-service/pull/255))

**[WIN-865](https://worth-ai.atlassian.net/browse/WIN-865) - [BE + FE] Under Confirmation/Review screen, show bank name instead of Plaid**

- 📝 fix: Bank name in progression API for Banking ([#251](https://github.comjoinworth/case-service/pull/251))

**[WIN-895](https://worth-ai.atlassian.net/browse/WIN-895) - Tax Filings Not Displayed in SMB Portal**

- 📝 fix: internal routes ([#258](https://github.comjoinworth/case-service/pull/258))

### 💻 Tech Task

**[WIN-847](https://worth-ai.atlassian.net/browse/WIN-847) - PR title format check github action on all service and webapps repo**

- 📝 PR title format ([#240](https://github.comjoinworth/case-service/pull/240))

**[WIN-954](https://worth-ai.atlassian.net/browse/WIN-954) - Retrigger Middesk webhook for Bill.com businesses**

- 📝 feat: added routes to update customers business details ([#269](https://github.comjoinworth/case-service/pull/269))
- 📝 fix: converted uuid to string ([#272](https://github.comjoinworth/case-service/pull/272))

### 📝 Other

- 📝 Fix: subscription broken unit test ([#239](https://github.comjoinworth/case-service/pull/239))
- 📝 Fix: Progression api for newly onboarded applicants (#NO_JIRA) ([#246](https://github.comjoinworth/case-service/pull/246))
- 📝 Fix: Revert local changes (#NO_JIRA) ([#247](https://github.comjoinworth/case-service/pull/247))
- 📝 Fix: updating test workflow (#NO_JIRA) ([#259](https://github.comjoinworth/case-service/pull/259))
- 📝 #NO_JIRA: ci: repo clean up ([#242](https://github.comjoinworth/case-service/pull/242))
- 📝 #NO_JIRA fix: added business name in payload for resend invitation ([#249](https://github.comjoinworth/case-service/pull/249))
- 📝 #NO_JIRA: fix: remove duplicate actions to run test coverage ([#243](https://github.comjoinworth/case-service/pull/243))

## [v0.0.33](https://github.com/joinworth/case-service/compare/v0.0.31...v0.0.33) - 2024-06-13

### 📖 Story

**[WIN-691](https://worth-ai.atlassian.net/browse/WIN-691) - [FE+BE] Update Case Status and Assign Case from Customer Admin Portal**

- 📝 feat: update and assign case ([#237](https://github.comjoinworth/case-service/pull/237))
- 📝 fix: added created_at in applicant object ([#241](https://github.comjoinworth/case-service/pull/241))
- 📝 fix: reordered the case statuses the are allowed to be updated ([#244](https://github.comjoinworth/case-service/pull/244))
- 📝 fix: updated REJECTED case status to MANUALLY_REJECTED ([#245](https://github.comjoinworth/case-service/pull/245))

**[WIN-861](https://worth-ai.atlassian.net/browse/WIN-861) - Case creation while adding/removing integration connection**

- 📝 fix: case creation order for standalone case ([#250](https://github.comjoinworth/case-service/pull/250))
- 📝 feat: Case creation while adding/removing integration connection ([#248](https://github.comjoinworth/case-service/pull/248))

### 🐛 Bug

**[WIN-794](https://worth-ai.atlassian.net/browse/WIN-794) - HYPERCARE - Verified TIN unable to progress**

- 📝 fix: inconsistent businesses with VERIFIED TIN entries ([#216](https://github.comjoinworth/case-service/pull/216))

### 💻 Tech Task

**[WIN-847](https://worth-ai.atlassian.net/browse/WIN-847) - PR title format check github action on all service and webapps repo**

- 📝 PR title format ([#240](https://github.comjoinworth/case-service/pull/240))

### 📝 Other

- 📝 Fix: subscription broken unit test ([#239](https://github.comjoinworth/case-service/pull/239))
- 📝 Fix: Revert local changes (#NO_JIRA) ([#247](https://github.comjoinworth/case-service/pull/247))
- 📝 #NO_JIRA: ci: repo clean up ([#242](https://github.comjoinworth/case-service/pull/242))
- 📝 #NO_JIRA fix: added business name in payload for resend invitation ([#249](https://github.comjoinworth/case-service/pull/249))
- 📝 #NO_JIRA: fix: remove duplicate actions to run test coverage ([#243](https://github.comjoinworth/case-service/pull/243))

## [v0.0.31](https://github.com/joinworth/case-service/compare/v0.0.27...v0.0.31) - 2024-06-07

### 📖 Story

**[WIN-627](https://worth-ai.atlassian.net/browse/WIN-627) - Implement API to manually trigger a Score Refresh**

- 📝 Implement API to manually trigger a Score Refresh ([#226](https://github.comjoinworth/case-service/pull/226))

**[WIN-825](https://worth-ai.atlassian.net/browse/WIN-825) - [BE] Stripe - Capture subscription intention in Stripe when Business and Cases are created**

- 📝 feat: stripe data capture event after business validation ([#232](https://github.comjoinworth/case-service/pull/232))

### 📝 Other

- 📝 Fix: Progression api for newly onboarded applicants (#NO_JIRA) ([#246](https://github.comjoinworth/case-service/pull/246))
- 📝 Fix: subscription fix ([#236](https://github.comjoinworth/case-service/pull/236))
- 📝 Fix: edge case error handling for progression current stage ([#233](https://github.comjoinworth/case-service/pull/233))
- 📝 Fix: internal api for fetching customer_ids of a business ([#225](https://github.comjoinworth/case-service/pull/225))
- 📝 Fix: Tax status progression logic ([#228](https://github.comjoinworth/case-service/pull/228))
- 📝 Fix: tax status progression update ([#229](https://github.comjoinworth/case-service/pull/229))
- 📝 Fix: add null object check ([#230](https://github.comjoinworth/case-service/pull/230))
- 📝 Fix: Irs status in progression api ([#231](https://github.comjoinworth/case-service/pull/231))
- 📝 Win 687 google places reviews ([#227](https://github.comjoinworth/case-service/pull/227))

## [v0.0.27](https://github.com/joinworth/case-service/compare/v0.0.23...v0.0.27) - 2024-05-30

### 🐛 Bug

**[WIN-801](https://worth-ai.atlassian.net/browse/WIN-801) - HYPERCARE - Cannot read properties of undefined (reading existing_business_found)**

- 📝 -fix: added ternary operator to handle undefined condition ([#217](https://github.comjoinworth/case-service/pull/217))

**[WIN-807](https://worth-ai.atlassian.net/browse/WIN-807) - HYPERCARE - Subscription not active on platform while showing active on stripe**

- 📝 Handle stripe webhook event wrong order ([#214](https://github.comjoinworth/case-service/pull/214))

**[WIN-810](https://worth-ai.atlassian.net/browse/WIN-810) - No title available**

- 📝 BUG FIX ([#213](https://github.comjoinworth/case-service/pull/213))

**[WIN-817](https://worth-ai.atlassian.net/browse/WIN-817) - HYPERCARE - Customer.subscription.updated Stripe webhook failed**

- 📝 SUBSCRIPTION CODE REFACTOR ([#223](https://github.comjoinworth/case-service/pull/223))

### ✨ Enhancement

**[WIN-720](https://worth-ai.atlassian.net/browse/WIN-720) - [BE] Implement Score calculation on Case Submit**

- 📝 feat: score calculation on submission ([#212](https://github.comjoinworth/case-service/pull/212))

**[WIN-781](https://worth-ai.atlassian.net/browse/WIN-781) - [FE+BE] Onboarding | Add the Ability to Skip to Accounting Integration**

- 📝 feat: Update onboarding stages order api ([#219](https://github.comjoinworth/case-service/pull/219))

### 💻 Tech Task

**[WIN-766](https://worth-ai.atlassian.net/browse/WIN-766) - Bill.com Customer Access**

- 📝 | allow getting businesses by TIN (internal or admin), external_id+cust… ([#221](https://github.comjoinworth/case-service/pull/221))

### 📝 Other

- 📝 Fix: internal api for fetching customer_ids of a business ([#225](https://github.comjoinworth/case-service/pull/225))
- 📝 Fix: subscription fixes ([#224](https://github.comjoinworth/case-service/pull/224))
- 📝 Code Sanity: Removing Temp APIs ([#222](https://github.comjoinworth/case-service/pull/222))

## [v0.0.23](https://github.com/joinworth/case-service/compare/v0.0.18...v0.0.23) - 2024-05-22

### 📖 Story

**[WIN-690](https://worth-ai.atlassian.net/browse/WIN-690) - [FE+BE] SMB Dashboard - Subscription Management**

- 📝 Subscription ([#200](https://github.comjoinworth/case-service/pull/200))
- 📝 already subscribed error message updated ([#205](https://github.comjoinworth/case-service/pull/205))
- 📝 Update plan session ([#206](https://github.comjoinworth/case-service/pull/206))

**[WIN-747](https://worth-ai.atlassian.net/browse/WIN-747) - SMB | Updates to business profile**

- 📝 fix: SMB profile section SSN masking ([#198](https://github.comjoinworth/case-service/pull/198))

### 🐛 Bug

**[WIN-585](https://worth-ai.atlassian.net/browse/WIN-585) - [High]Send customer invite to existing business to unique or existing email id and after completed the onboarding process and from customer admin check case detail so their it not displaying the 'worth score & Banking'.**

- 📝 fix: removing existing-case-id field ([#199](https://github.comjoinworth/case-service/pull/199))

**[WIN-734](https://worth-ai.atlassian.net/browse/WIN-734) - [Logs][case-service] Cannot read properties of undefined (reading 'id')**

- 📝 LOGS FIX ([#201](https://github.comjoinworth/case-service/pull/201))

**[WIN-739](https://worth-ai.atlassian.net/browse/WIN-739) - [Logs][case-service]: Error: Cannot read properties of undefined reading customer_id**

- 📝 LOGS FIX ([#202](https://github.comjoinworth/case-service/pull/202))

**[WIN-780](https://worth-ai.atlassian.net/browse/WIN-780) - Tax Status is Failing**

- 📝 feat: business mobile no consistency ([#208](https://github.comjoinworth/case-service/pull/208))

**[WIN-807](https://worth-ai.atlassian.net/browse/WIN-807) - HYPERCARE - Subscription not active on platform while showing active on stripe**

- 📝 Handle stripe webhook event wrong order ([#214](https://github.comjoinworth/case-service/pull/214))

### ✨ Enhancement

**[WIN-767](https://worth-ai.atlassian.net/browse/WIN-767) - Allow Unmasked TIN Viewing for Worth Admin/Customer Admin**

- 📝 TIN UNMASKING ENHANCEMENT ([#207](https://github.comjoinworth/case-service/pull/207))

### 🛑 Defect

**[WIN-756](https://worth-ai.atlassian.net/browse/WIN-756) - Recheck plaid IDV status on Owner details update**

- 📝 fix: string comparison typo fix ([#204](https://github.comjoinworth/case-service/pull/204))

### 📝 Other

- 📝 Fix: internal route decrypting only when data not null ([#209](https://github.comjoinworth/case-service/pull/209))
- 📝 Fix: subscription update_at trigger ([#210](https://github.comjoinworth/case-service/pull/210))
- 📝 Fix: added extra metadata in subscription checkout session ([#211](https://github.comjoinworth/case-service/pull/211))
- 📝 Feat: Core APIs for Onboarding Stages ([#203](https://github.comjoinworth/case-service/pull/203))

## [v0.0.18](https://github.com/joinworth/case-service/compare/v0.0.14...v0.0.18) - 2024-05-07

### 📖 Story

**[WIN-573](https://worth-ai.atlassian.net/browse/WIN-573) - [FE] Implement Plaid IDV validation for SSN**

- 📝 feat: plaid idv progression api changes ([#194](https://github.comjoinworth/case-service/pull/194))

**[WIN-674](https://worth-ai.atlassian.net/browse/WIN-674) - [FE+BE]Industry dropdown**

- 📝 Business Industry ([#170](https://github.comjoinworth/case-service/pull/170))

### 🐛 Bug

**[WIN-585](https://worth-ai.atlassian.net/browse/WIN-585) - [High]Send customer invite to existing business to unique or existing email id and after completed the onboarding process and from customer admin check case detail so their it not displaying the 'worth score & Banking'.**

- 📝 fix: removing existing-case-id field ([#199](https://github.comjoinworth/case-service/pull/199))

**[WIN-726](https://worth-ai.atlassian.net/browse/WIN-726) - Unable to move past company details**

- 📝 fix: error message of internal apis updated ([#173](https://github.comjoinworth/case-service/pull/173))
- 📝 middesk error handling ([#177](https://github.comjoinworth/case-service/pull/177))

**[WIN-732](https://worth-ai.atlassian.net/browse/WIN-732) - Middesk | Failing TIN validation still "Verifies" a business**

- 📝 | fail verification on TIN rejection from Middesk ([#179](https://github.comjoinworth/case-service/pull/179))

**[WIN-734](https://worth-ai.atlassian.net/browse/WIN-734) - [Logs][case-service] Cannot read properties of undefined (reading 'id')**

- 📝 LOGS FIX ([#201](https://github.comjoinworth/case-service/pull/201))

**[WIN-739](https://worth-ai.atlassian.net/browse/WIN-739) - [Logs][case-service]: Error: Cannot read properties of undefined reading customer_id**

- 📝 LOGS FIX ([#202](https://github.comjoinworth/case-service/pull/202))

### ✨ Enhancement

**[WIN-720](https://worth-ai.atlassian.net/browse/WIN-720) - [BE] Implement Score calculation on Case Submit**

- 📝 fix: tax-status stage [progression api fix] ([#180](https://github.comjoinworth/case-service/pull/180))

### 💻 Tech Task

**[WIN-536](https://worth-ai.atlassian.net/browse/WIN-536) - Encrypt any SSN/TIN stored in our database**

- 📝 Encrypt TIN-SSN ([#169](https://github.comjoinworth/case-service/pull/169))
- 📝 fix: reverting ssn masking for a case ([#195](https://github.comjoinworth/case-service/pull/195))

### 🛑 Defect

**[WIN-723](https://worth-ai.atlassian.net/browse/WIN-723) - [High]Onbaording flow- Send customer invite and start the onboarding but on company detail enter existing TIN and after completing the approval process start the onbaording flow again with that same TIN then check that invite record in customer portal**

- 📝 Case creation when another applicants are being invited to existing business ([#181](https://github.comjoinworth/case-service/pull/181))

**[WIN-724](https://worth-ai.atlassian.net/browse/WIN-724) - [High]Onbaording flow-Send customer invite and complete the onboarding flow so for this two case were generated so in admin for one case showing worth score and for other case it is pending**

- 📝 fix: standalone case trigger fix ([#174](https://github.comjoinworth/case-service/pull/174))

### 📝 Other

- 📝 Feat: accept business invite ([#178](https://github.comjoinworth/case-service/pull/178))
- 📝 Feat: add Pr coverage report workflow ([#188](https://github.comjoinworth/case-service/pull/188))
- 📝 Fix: package json
- 📝 Fix: pending unit tests ([#196](https://github.comjoinworth/case-service/pull/196))
- 📝 Fix: ssn decryption for owners api ([#197](https://github.comjoinworth/case-service/pull/197))
- 📝 Merge branch 'main' of github.com:joinworth/case-service
- 📝 Bug fixes: Bulk Business Upload ([#176](https://github.comjoinworth/case-service/pull/176))
- 📝 Fix to bulk upload: Support CSV Files & Strings & Fix Business Map ([#172](https://github.comjoinworth/case-service/pull/172))

## [v0.0.14](https://github.com/joinworth/case-service/compare/v0.0.11...v0.0.14) - 2024-04-23

### 🐛 Bug

**[WIN-726](https://worth-ai.atlassian.net/browse/WIN-726) - Unable to move past company details**

- 📝 fix: error message of internal apis updated ([#173](https://github.comjoinworth/case-service/pull/173))

### 🛑 Defect

**[WIN-724](https://worth-ai.atlassian.net/browse/WIN-724) - [High]Onbaording flow-Send customer invite and complete the onboarding flow so for this two case were generated so in admin for one case showing worth score and for other case it is pending**

- 📝 fix: standalone case trigger fix ([#174](https://github.comjoinworth/case-service/pull/174))

## [v0.0.11](https://github.com/joinworth/case-service/compare/v0.0.7...v0.0.11) - 2024-04-22

### 📖 Story

**[WIN-346](https://worth-ai.atlassian.net/browse/WIN-346) - [BE] Subroles should be created for applicants of business**

- 📝 Remove entries from rel_business_applicants ([#144](https://github.comjoinworth/case-service/pull/144))

**[WIN-368](https://worth-ai.atlassian.net/browse/WIN-368) - [FE][BE] List all invitations on applicant portal**

- 📝 feat: get applicant invites ([#140](https://github.comjoinworth/case-service/pull/140))

**[WIN-400](https://worth-ai.atlassian.net/browse/WIN-400) - Score refresh implementation**

- 📝 score refresh ([#100](https://github.comjoinworth/case-service/pull/100))

**[WIN-567](https://worth-ai.atlassian.net/browse/WIN-567) - Define AI Scoring Statuses for customer invited businesses.**

- 📝 feat: Case status update changes ([#160](https://github.comjoinworth/case-service/pull/160))
- 📝 fix: case status update fix ([#163](https://github.comjoinworth/case-service/pull/163))

**[WIN-569](https://worth-ai.atlassian.net/browse/WIN-569) - Define Actions for "Under Manual Review" Cases (Invited Cases Only)**

- 📝 temp feat: mark cases for manual review ([#165](https://github.comjoinworth/case-service/pull/165))
- 📝 Mark for manual review ([#167](https://github.comjoinworth/case-service/pull/167))

**[WIN-571](https://worth-ai.atlassian.net/browse/WIN-571) - [BE] Implement Pending Decision to Under Manual Review Transition for Invited Cases [CRON]**

- 📝 Case status update ([#154](https://github.comjoinworth/case-service/pull/154))

**[WIN-572](https://worth-ai.atlassian.net/browse/WIN-572) - [FE + BE] ARCHIVING A CASE (Invited Cases only) [CRON + MANUAL]**

- 📝 Case status transition config ([#171](https://github.comjoinworth/case-service/pull/171))

**[WIN-628](https://worth-ai.atlassian.net/browse/WIN-628) - Route for manual integration of data/scoring**

- 📝 Add support for fuzzy match data mapper | Part 1 ([#145](https://github.comjoinworth/case-service/pull/145))
- 📝 Add bulk business mapper | Part 2 ([#149](https://github.comjoinworth/case-service/pull/149))

**[WIN-631](https://worth-ai.atlassian.net/browse/WIN-631) - Handle Old Scoring Data: Migrate Old scores to Case service**

- 📝 feat: migrating old scores data into case svc ([#139](https://github.comjoinworth/case-service/pull/139))

### 🐛 Bug

**[WIN-486](https://worth-ai.atlassian.net/browse/WIN-486) - [Low] Customer invite --During sending invitation enter existing email id i.e. of customer/user or admin then proceed to onboarding flow in this case, flow is getting stuck**

- 📝 fix: checking if email exists or not ([#137](https://github.comjoinworth/case-service/pull/137))

**[WIN-513](https://worth-ai.atlassian.net/browse/WIN-513) - [High]Send an invitation to the existing business but with a unique email ID, then start the onboarding process and after completed the process, for this case worth score is not being generated.**

- 📝 DEFECT-FIX ([#135](https://github.comjoinworth/case-service/pull/135))

**[WIN-566](https://worth-ai.atlassian.net/browse/WIN-566) - IDV Failure -> Set Case to Manual Review**

- 📝 Fix setting case to manual review ([#132](https://github.comjoinworth/case-service/pull/132))

**[WIN-615](https://worth-ai.atlassian.net/browse/WIN-615) - Send invite to customer or user and once their invitation expired just do resend invite again but if user instead of clicking new email link just click on previous email which is expired so for this thier status shouldn't get changed**

- 📝 Automatically update the invitation status to EXPIRE when link expires ([#141](https://github.comjoinworth/case-service/pull/141))

### ✨ Enhancement

**[WIN-458](https://worth-ai.atlassian.net/browse/WIN-458) - [FE + BE] Modify progression api to be more robust with the onboarding flow**

- 📝 Progression API ([#146](https://github.comjoinworth/case-service/pull/146))

### 💻 Tech Task

**[WIN-641](https://worth-ai.atlassian.net/browse/WIN-641) - [BE] Onboarding flow revamp changes**

- 📝 onboarding revamp changes ([#147](https://github.comjoinworth/case-service/pull/147))

### 🛑 Defect

**[WIN-666](https://worth-ai.atlassian.net/browse/WIN-666) - UI Issues -Onboarding Revamp Flow**

- 📝 fix delete business owner ([#156](https://github.comjoinworth/case-service/pull/156))

**[WIN-684](https://worth-ai.atlassian.net/browse/WIN-684) - Send invite to new business but to existing applicant and start the onboarding flow till tax consent and click on company switcher then logout from there then again login from that same applicant.**

- 📝 fix: creating standalone case after validating tin ([#162](https://github.comjoinworth/case-service/pull/162))

### 📝 Other

- 📝 Fix test
- 📝 Support CSV Files & Strings & Fix Business Map
- 📝 Only create one case
- 📝 Feat: unit tests ([#161](https://github.comjoinworth/case-service/pull/161))
- 📝 WIn-653: Add more mappings ([#164](https://github.comjoinworth/case-service/pull/164))
- 📝 Fix: add case id in fetch public record request ([#151](https://github.comjoinworth/case-service/pull/151))
- 📝 Fix: add logic to update skippable step ([#152](https://github.comjoinworth/case-service/pull/152))
- 📝 Fix: progression additional-info fix ([#158](https://github.comjoinworth/case-service/pull/158))
- 📝 Fix: verify business ([#159](https://github.comjoinworth/case-service/pull/159))
- 📝 Win 568: Transition to pending decision status after submission of a case ([#134](https://github.comjoinworth/case-service/pull/134))
- 📝 Fix: progression case submitted ([#157](https://github.comjoinworth/case-service/pull/157))
- 📝 Fix: stripe webhook ([#130](https://github.comjoinworth/case-service/pull/130))
- 📝 Fix: sending case status in response while starting application ([#129](https://github.comjoinworth/case-service/pull/129))
- 📝 Fix: validate role middleware ([#133](https://github.comjoinworth/case-service/pull/133))

## [v0.0.7](https://github.com/joinworth/case-service/compare/v0.0.3...v0.0.7) - 2024-03-08

### 📖 Story

**[WIN-309](https://worth-ai.atlassian.net/browse/WIN-309) - [BE] [Applicant] Beneficial Owner**

- 📝 Beneficial owner ([#88](https://github.comjoinworth/case-service/pull/88))

**[WIN-362](https://worth-ai.atlassian.net/browse/WIN-362) - [BE] Send new invitation on customer admin**

- 📝 feat: send invite ([#89](https://github.comjoinworth/case-service/pull/89))

**[WIN-363](https://worth-ai.atlassian.net/browse/WIN-363) - [BE] List all invitation of a business on customer admin**

- 📝 GET-ALL-BUSINESS-INVITES ([#103](https://github.comjoinworth/case-service/pull/103))
- 📝 RESEND INVITATION API ([#114](https://github.comjoinworth/case-service/pull/114))

**[WIN-400](https://worth-ai.atlassian.net/browse/WIN-400) - Score refresh implementation**

- 📝 Internal business Subscriptions API ([#93](https://github.comjoinworth/case-service/pull/93))

**[WIN-460](https://worth-ai.atlassian.net/browse/WIN-460) - [FE][BE] - Customer / Worth Admin - Show Type Column and Filter under Business Details and Case View Screen.**

- 📝 CASE TYPE ([#106](https://github.comjoinworth/case-service/pull/106))
- 📝 Removed REFRESH case type & default ONBOARDING when insert case ([#111](https://github.comjoinworth/case-service/pull/111))

**[WIN-464](https://worth-ai.atlassian.net/browse/WIN-464) - [BE] Invitation Detail Api**

- 📝 INVITATION-DETAILS ([#104](https://github.comjoinworth/case-service/pull/104))

**[WIN-480](https://worth-ai.atlassian.net/browse/WIN-480) - [BE] Create subroles for business and it's users**

- 📝 feat: Business Users and TIN access ([#110](https://github.comjoinworth/case-service/pull/110))

### 🐛 Bug

**[WIN-419](https://worth-ai.atlassian.net/browse/WIN-419) - On applicant app during entering email address it should appears to be case sensitive means allowing to signup with same email id**

- 📝 EMAIL-CASE-SENSITIVITY ([#107](https://github.comjoinworth/case-service/pull/107))

**[WIN-479](https://worth-ai.atlassian.net/browse/WIN-479) - Worth Admin -Come to business module there is showing the wrong onboarding data and time(check with different timezone too)**

- 📝 format of dates when using json_build_object ([#109](https://github.comjoinworth/case-service/pull/109))

### 🧪 Spike

**[WIN-248](https://worth-ai.atlassian.net/browse/WIN-248) - Plaid IDV**

- 📝 | Add INTEGRATION_DATA_READY topic handler & handle fetch_identity_verification response ([#101](https://github.comjoinworth/case-service/pull/101))

### 🛑 Defect

**[WIN-509](https://worth-ai.atlassian.net/browse/WIN-509) - No title available**

- 📝 allow applicant to subscribe multiple businesses ([#118](https://github.comjoinworth/case-service/pull/118))

### 📝 Other

- 📝 Hotfix: stripe webhook ([#130](https://github.comjoinworth/case-service/pull/130)) ([#131](https://github.comjoinworth/case-service/pull/131))
- 📝 Fix: under manual review case status while submitting case ([#127](https://github.comjoinworth/case-service/pull/127))
- 📝 Fix: Case response consistency ([#128](https://github.comjoinworth/case-service/pull/128))
- 📝 Fix: standalone case generation kafka payload update ([#123](https://github.comjoinworth/case-service/pull/123))
- 📝 Fix: customers listing of all business ([#124](https://github.comjoinworth/case-service/pull/124))
- 📝 Fix: business mobile no schema update ([#126](https://github.comjoinworth/case-service/pull/126))
- 📝 Fix IDV to set case to manual review on failure ([#122](https://github.comjoinworth/case-service/pull/122))
- 📝 Send case_id to integration service in public record kafka event ([#125](https://github.comjoinworth/case-service/pull/125))
- 📝 Fix: edge case schema validation ([#92](https://github.comjoinworth/case-service/pull/92))
- 📝 Fix: get business by id response ([#98](https://github.comjoinworth/case-service/pull/98))
- 📝 Fix: invite flow revert new commits ([#102](https://github.comjoinworth/case-service/pull/102))
- 📝 Fix tests ([#105](https://github.comjoinworth/case-service/pull/105))
- 📝 Fix: check for applicant linkage with business ([#113](https://github.comjoinworth/case-service/pull/113))
- 📝 Fix: applicant not related to business check in subscriptions ([#116](https://github.comjoinworth/case-service/pull/116))
- 📝 Fix: API for fetching only customer invited cases of a business on customer portal ([#119](https://github.comjoinworth/case-service/pull/119))
- 📝 Fix: wrap uuids with single quotes in sql query in getCasesByBussinessID API ([#120](https://github.comjoinworth/case-service/pull/120))
- 📝 Fix: added kafka consumer for handling naics codes ([#115](https://github.comjoinworth/case-service/pull/115))
- 📝 Fix: applicant id to kafka from subscription metadata ([#121](https://github.comjoinworth/case-service/pull/121))
- 📝 Add Typescript Support ([#85](https://github.comjoinworth/case-service/pull/85))
- 📝 Add missing param ([#91](https://github.comjoinworth/case-service/pull/91))
- 📝 Add Get Owners Route ([#74](https://github.comjoinworth/case-service/pull/74))
- 📝 Fix sunscriptions code ([#75](https://github.comjoinworth/case-service/pull/75))
- 📝 BUG-FIXES ([#117](https://github.comjoinworth/case-service/pull/117))

**[WIIN-326](https://worth-ai.atlassian.net/browse/WIIN-326) - No title available**

- 📝 feat: send invite applicant flow ([#90](https://github.comjoinworth/case-service/pull/90))