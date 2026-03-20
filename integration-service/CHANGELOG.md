## [v0.55.0-hotfix-v1.0](https://github.com/joinworth/integration-service/compare/v0.54.4...v0.55.0-hotfix-v1.0) - 2025-11-19

### 🐛 Bug

**[PAT-951](https://worth-ai.atlassian.net/browse/PAT-951) - [FAST TRACK] Incorrect Structure from API Response**

- 🚜🚀 #LIVE fix: Remove filtering watchlist hits on 360 report #REGULAR (Original PR: [#1920](https://github.com/joinworth/integration-service/pull/1920)) ([#1922](https://github.com/joinworth/integration-service/pull/1922)) 🚂 release/v0.55.0-hotfix-v1

## [v0.54.4](https://github.com/joinworth/integration-service/compare/v0.54.0-fast-v2.0...v0.54.4) - 2025-11-19

### 📖 Story

**[BTTF-151](https://worth-ai.atlassian.net/browse/BTTF-151) - [BE] Update the Schema to support the new configuration**

- 🚜🚀 #LIVE [BE] Update the Schema to support the new configuration #REGULAR (Original PR: [#1849](https://github.com/joinworth/integration-service/pull/1849)) ([#1882](https://github.com/joinworth/integration-service/pull/1882)) 🚂 release/v0.54.0

### 🐛 Bug

**[BEST-161](https://worth-ai.atlassian.net/browse/BEST-161) - Investigate website scan response not matching fact**

- 🚜🚀 #LIVE Fix website parsing errors #REGULAR (Original PR: [#1816](https://github.com/joinworth/integration-service/pull/1816)) ([#1887](https://github.com/joinworth/integration-service/pull/1887)) 🚂 release/v0.54.0

**[BEST-226](https://worth-ai.atlassian.net/browse/BEST-226) - Fact selection is selecting integrations over the manual source provided**

- 🚜🚀 #LIVE Fix Weighted Facts Selection #REGULAR (Original PR: [#1877](https://github.com/joinworth/integration-service/pull/1877)) ([#1880](https://github.com/joinworth/integration-service/pull/1880)) 🚂 release/v0.54.0

**[DOS-930](https://worth-ai.atlassian.net/browse/DOS-930) - IDV Sandbox Not Working in Production**

- 🚜🚀 #LIVE fix PlaidIdv templates in sandbox mode and refactor to use strategyPlatformFactory #REGULAR (Original PR: [#1845](https://github.com/joinworth/integration-service/pull/1845)) ([#1888](https://github.com/joinworth/integration-service/pull/1888)) 🚂 release/v0.54.0

**[PAT-752](https://worth-ai.atlassian.net/browse/PAT-752) - Deposit Accounts Duplicate Existing Bank Accounts**

- 🚜🚀 Hide duplicate deposit bank accounts #LIVE #REGULAR (Original PR: [#1788](https://github.com/joinworth/integration-service/pull/1788)) ([#1881](https://github.com/joinworth/integration-service/pull/1881)) 🚂 release/v0.54.0

**[PAT-793](https://worth-ai.atlassian.net/browse/PAT-793) - [Request More Info] GIACT not triggered after submitting "Request More Info" for Banking and Ownership**

- 🚜🚀 GIACT not triggering on updating manaul bank account #LIVE #REGULAR (Original PR: [#1878](https://github.com/joinworth/integration-service/pull/1878)) ([#1891](https://github.com/joinworth/integration-service/pull/1891)) 🚂 release/v0.54.0

**[PAT-943](https://worth-ai.atlassian.net/browse/PAT-943) - No title available**

- 🚜🚀 #LIVE feat: Adds retry logic for equifax pdf report fetch #REGULAR (Original PR: [#1894](https://github.com/joinworth/integration-service/pull/1894)) ([#1900](https://github.com/joinworth/integration-service/pull/1900)) 🚂 release/v0.54.0

### ✨ Enhancement

**[BEST-186](https://worth-ai.atlassian.net/browse/BEST-186) - [FAST TRACK with PAT-930] Submit additional people to Middesk for watchlist**

- 🚜🚀 Middesk People whitelist verification implementation method-2 #LIVE #REGULAR (Original PR: [#1844](https://github.com/joinworth/integration-service/pull/1844)) ([#1898](https://github.com/joinworth/integration-service/pull/1898)) 🚂 release/v0.54.0

**[PAT-849](https://worth-ai.atlassian.net/browse/PAT-849) - Export Bank Transactions**

- 🚜🚀 #LIVE fix: Export bank transactions with unencrypted account number #REGULAR (Original PR: [#1884](https://github.com/joinworth/integration-service/pull/1884)) ([#1908](https://github.com/joinworth/integration-service/pull/1908)) 🚂 release/v0.54.0
- 🚜🚀 Export Bank Transactions #LIVE #REGULAR (Original PR: [#1875](https://github.com/joinworth/integration-service/pull/1875)) ([#1895](https://github.com/joinworth/integration-service/pull/1895)) 🚂 release/v0.54.0

**[PAT-930](https://worth-ai.atlassian.net/browse/PAT-930) - [FAST TRACK] Leverage Facts for Watchlists**

- 🚜🚀 Leverage facts for watchlists #LIVE #REGULAR (Original PR: [#1893](https://github.com/joinworth/integration-service/pull/1893)) ([#1902](https://github.com/joinworth/integration-service/pull/1902)) 🚂 release/v0.54.0

### 🧪 Spike

**[BEST-164](https://worth-ai.atlassian.net/browse/BEST-164) - Investigate and address long API calls to OpenAI**

- 🚜🚀 #LIVE Investigate and address long API calls to OpenAI #REGULAR (Original PR: [#1815](https://github.com/joinworth/integration-service/pull/1815)) ([#1886](https://github.com/joinworth/integration-service/pull/1886)) 🚂 release/v0.54.0

### 💻 Tech Task

**[BEST-166](https://worth-ai.atlassian.net/browse/BEST-166) - No title available**

- 🚜🚀 & #LIVE handle entityMatching POST issues #REGULAR (Original PR: [#1808](https://github.com/joinworth/integration-service/pull/1808)) ([#1889](https://github.com/joinworth/integration-service/pull/1889)) 🚂 release/v0.54.0

**[BEST-168](https://worth-ai.atlassian.net/browse/BEST-168) - Investigate how we handle Redis connections and optimize for scalability**

- 🚜🚀 #LIVE BullQueue Redis Connection Pooling + QueueManager Routes #REGULAR (Original PR: [#1806](https://github.com/joinworth/integration-service/pull/1806)) ([#1890](https://github.com/joinworth/integration-service/pull/1890)) 🚂 release/v0.54.0

## [v0.54.0-fast-v2.0](https://github.com/joinworth/integration-service/compare/v0.54.1...v0.54.0-fast-v2.0) - 2025-11-14

### 🐛 Bug

**[PAT-943](https://worth-ai.atlassian.net/browse/PAT-943) - No title available**

- 🚜🚀 #LIVE feat: Adds retry logic for equifax pdf report fetch #REGULAR (Original PR: [#1894](https://github.com/joinworth/integration-service/pull/1894)) ([#1901](https://github.com/joinworth/integration-service/pull/1901)) 🚂 release/v0.54.0-fast-v2

### ✨ Enhancement

**[BEST-186](https://worth-ai.atlassian.net/browse/BEST-186) - [FAST TRACK with PAT-930] Submit additional people to Middesk for watchlist**

- 🚜🚀 Middesk People whitelist verification implementation method-2 #LIVE #REGULAR (Original PR: [#1844](https://github.com/joinworth/integration-service/pull/1844)) ([#1899](https://github.com/joinworth/integration-service/pull/1899)) 🚂 release/v0.54.0-fast-v2

**[PAT-930](https://worth-ai.atlassian.net/browse/PAT-930) - [FAST TRACK] Leverage Facts for Watchlists**

- 🚜🚀 Leverage facts for watchlists #LIVE #REGULAR (Original PR: [#1893](https://github.com/joinworth/integration-service/pull/1893)) ([#1903](https://github.com/joinworth/integration-service/pull/1903)) 🚂 release/v0.54.0-fast-v2

## [v0.54.1](https://github.com/joinworth/integration-service/compare/v0.54.0-fast-v1.0...v0.54.1) - 2025-11-11

### 🧰 Task

**[BTTF-20](https://worth-ai.atlassian.net/browse/BTTF-20) - [Trulioo] DB Schema Design**

- 🚜🚩 Trulioo DB ID #FLAG #REGULAR (Original PR: [#1502](https://github.com/joinworth/integration-service/pull/1502)) ([#1864](https://github.com/joinworth/integration-service/pull/1864)) 🚂 release/v0.54.0

**[INFRA-262](https://worth-ai.atlassian.net/browse/INFRA-262) - Add Google Calendar integration for automated release branch selection**

- 🚜🚀 #LIVE Add Google Calendar integration for automated release branch selection #REGULAR (Original PR: [#1851](https://github.com/joinworth/integration-service/pull/1851)) ([#1852](https://github.com/joinworth/integration-service/pull/1852)) 🚂 release/v0.54.0

**[INFRA-265](https://worth-ai.atlassian.net/browse/INFRA-265) - Add service health verification for release branch PRs**

- 🚜🚀 #LIVE Update cherrypick PR merge detection logic #REGULAR (Original PR: [#1869](https://github.com/joinworth/integration-service/pull/1869)) ([#1870](https://github.com/joinworth/integration-service/pull/1870)) 🚂 release/v0.54.0
- 🚜🚀 #LIVE Add workflow status check logic on PR and health check on release branch PRs #REGULAR (Original PR: [#1842](https://github.com/joinworth/integration-service/pull/1842)) ([#1854](https://github.com/joinworth/integration-service/pull/1854)) 🚂 release/v0.54.0

**[INFRA-267](https://worth-ai.atlassian.net/browse/INFRA-267) - Fix budibase deployment tracker issue**

- 🚜🚀 #LIVE Remove environment specification from create_tag job #REGULAR (Original PR: [#1846](https://github.com/joinworth/integration-service/pull/1846)) ([#1853](https://github.com/joinworth/integration-service/pull/1853)) 🚂 release/v0.54.0

### 🐛 Bug

**[BEST-203](https://worth-ai.atlassian.net/browse/BEST-203) - Review data does not appear to be populating to facts**

- 🚜🚀 #LIVE SERP source mapper returning undefined #REGULAR (Original PR: [#1856](https://github.com/joinworth/integration-service/pull/1856)) ([#1857](https://github.com/joinworth/integration-service/pull/1857)) 🚂 release/v0.54.0

**[BTTF-139](https://worth-ai.atlassian.net/browse/BTTF-139) - [MATCH] [BB FIX] 360 - Summary Displays “No Match” While Details Show results**

- 🚜🚀 #LIVE Summary Displays “No Match” While Details Show results #REGULAR (Original PR: [#1823](https://github.com/joinworth/integration-service/pull/1823)) ([#1860](https://github.com/joinworth/integration-service/pull/1860)) 🚂 release/v0.54.0

### 📝 Other

**[PAT-920](https://worth-ai.atlassian.net/browse/PAT-920) - No title available**

- 🚜🚀 #LIVE feat: Makes SERP Google Profile business match value dynamic #REGULAR (Original PR: [#1863](https://github.com/joinworth/integration-service/pull/1863)) ([#1866](https://github.com/joinworth/integration-service/pull/1866)) 🚂 release/v0.54.0

## [v0.54.0-fast-v1.0](https://github.com/joinworth/integration-service/compare/v0.54.0-hotfix-v1.0...v0.54.0-fast-v1.0) - 2025-11-06

### 🐛 Bug

**[PAT-920](https://worth-ai.atlassian.net/browse/PAT-920) - [FAST TRACK] Google Profile Badges Displaying Match on Partial Address Matches**

- 🚜🚀 #LIVE feat: Makes SERP Google Profile business match value dynamic #REGULAR (Original PR: [#1863](https://github.com/joinworth/integration-service/pull/1863)) ([#1865](https://github.com/joinworth/integration-service/pull/1865)) 🚂 release/v0.54.0-fast-v1

## [v0.54.0-hotfix-v1.0](https://github.com/joinworth/integration-service/compare/v0.53.4...v0.54.0-hotfix-v1.0) - 2025-11-04

### 🐛 Bug

**[BEST-203](https://worth-ai.atlassian.net/browse/BEST-203) - Review data does not appear to be populating to facts**

- 🚜🚀 #LIVE SERP source mapper returning undefined #REGULAR (Original PR: [#1856](https://github.com/joinworth/integration-service/pull/1856)) ([#1858](https://github.com/joinworth/integration-service/pull/1858)) 🚂 release/v0.54.0-hotfix-v1

## [v0.53.4](https://github.com/joinworth/integration-service/compare/v0.53.0-fast-v2.0...v0.53.4) - 2025-11-04

### 📖 Story

**[BEST-73](https://worth-ai.atlassian.net/browse/BEST-73) - Update OpenCorporates inactive field interpretation per vendor clarification**

- 🚜🚀 Implement Company Active Status Logic #LIVE #REGULAR (Original PR: [#1782](https://github.com/joinworth/integration-service/pull/1782)) ([#1827](https://github.com/joinworth/integration-service/pull/1827)) 🚂 release/v0.53.0

**[BTTF-42](https://worth-ai.atlassian.net/browse/BTTF-42) - [Trulioo] Enable/Disable Integration Routing**

- 🚜🚀 core_integration_status for trulioo #LIVE #REGULAR (Original PR: [#1681](https://github.com/joinworth/integration-service/pull/1681)) ([#1818](https://github.com/joinworth/integration-service/pull/1818)) 🚂 release/v0.53.0

**[DOS-827](https://worth-ai.atlassian.net/browse/DOS-827) - Sandbox Personal Credit Score Check**

- 🚜🚀 #LIVE equifax strategy pattern #REGULAR (Original PR: [#1783](https://github.com/joinworth/integration-service/pull/1783)) ([#1817](https://github.com/joinworth/integration-service/pull/1817)) 🚂 release/v0.53.0

**[PAT-704](https://worth-ai.atlassian.net/browse/PAT-704) - [FE+BE] Purge - Soft Delete (Archive) Businesses**

- 🚜🚀 #LIVE feat: added validatePurgedBusiness middleware #REGULAR (Original PR: [#1740](https://github.com/joinworth/integration-service/pull/1740)) ([#1819](https://github.com/joinworth/integration-service/pull/1819)) 🚂 release/v0.53.0

### 🧰 Task

**[INFRA-223](https://worth-ai.atlassian.net/browse/INFRA-223) - [RELEASE EXPERIENCE] create new tag from latest tag of input branch**

- 🚜🚀 #LIVE Add branch-specific tag creation rules and validation #REGULAR (Original PR: [#1830](https://github.com/joinworth/integration-service/pull/1830)) ([#1834](https://github.com/joinworth/integration-service/pull/1834)) 🚂 release/v0.53.0

**[INFRA-249](https://worth-ai.atlassian.net/browse/INFRA-249) - Add GitHub Action Job to check image tag existence before building svc image**

- 🚜🚀 #LIVE Add GitHub Action Job to check image tag existence before building docker image #REGULAR (Original PR: [#1833](https://github.com/joinworth/integration-service/pull/1833)) ([#1835](https://github.com/joinworth/integration-service/pull/1835)) 🚂 release/v0.53.0

### 🐛 Bug

**[DOS-869](https://worth-ai.atlassian.net/browse/DOS-869) - IDV Prompting for Document Upload when using Custom Template**

- 🚜🚀 Adds route to return Plaid template data #LIVE #REGULAR (Original PR: [#1789](https://github.com/joinworth/integration-service/pull/1789)) ([#1829](https://github.com/joinworth/integration-service/pull/1829)) 🚂 release/v0.53.0
- 🚜🚀 Fix - Adds route to return Plaid template data #LIVE #REGULAR (Original PR: [#1802](https://github.com/joinworth/integration-service/pull/1802)) ([#1831](https://github.com/joinworth/integration-service/pull/1831)) 🚂 release/v0.53.0
- 🚜🚀 Resolves 'Collect Driver's License' Typo #LIVE #REGULAR (Original PR: [#1812](https://github.com/joinworth/integration-service/pull/1812)) ([#1832](https://github.com/joinworth/integration-service/pull/1832)) 🚂 release/v0.53.0

### ✨ Enhancement

**[DOS-915](https://worth-ai.atlassian.net/browse/DOS-915) - Add DOS-886 to BEST-87 Feature Flag**

- 🚜🚩 Decouple SSN from Risk Score on 360 Report #FLAG #REGULAR (Original PR: [#1810](https://github.com/joinworth/integration-service/pull/1810)) ([#1828](https://github.com/joinworth/integration-service/pull/1828)) 🚂 release/v0.53.0

### 💻 Tech Task

**[BEST-156](https://worth-ai.atlassian.net/browse/BEST-156) - Update csvtojson library**

- 🚜🚀 Update csvtojson library #LIVE #REGULAR (Original PR: [#1805](https://github.com/joinworth/integration-service/pull/1805)) ([#1825](https://github.com/joinworth/integration-service/pull/1825)) 🚂 release/v0.53.0

**[BEST-165](https://worth-ai.atlassian.net/browse/BEST-165) - No title available**

- 🚜🚀 #LIVE https://worth-ai.atlassian.net/browse/ #REGULAR (Original PR: [#1792](https://github.com/joinworth/integration-service/pull/1792)) ([#1814](https://github.com/joinworth/integration-service/pull/1814)) 🚂 release/v0.53.0

**[BEST-204](https://worth-ai.atlassian.net/browse/BEST-204) - Ensure ephemeral workers don't join API**

- 🚜🚀 #LIVE safeguard k8s jobs from starting api #REGULAR (Original PR: [#1839](https://github.com/joinworth/integration-service/pull/1839)) ([#1841](https://github.com/joinworth/integration-service/pull/1841)) 🚂 release/v0.53.0

### 📝 Other

**[BEST-153](https://worth-ai.atlassian.net/browse/BEST-153) - No title available**

- 🚜🚀 Bump form-data and @kubernetes/client-node #LIVE #REGULAR (Original PR: [#1724](https://github.com/joinworth/integration-service/pull/1724)) ([#1820](https://github.com/joinworth/integration-service/pull/1820)) 🚂 release/v0.53.0
- 🚜🚀 Bump axios from 1.11.0 to 1.12.0 #LIVE #REGULAR (Original PR: [#1725](https://github.com/joinworth/integration-service/pull/1725)) ([#1821](https://github.com/joinworth/integration-service/pull/1821)) 🚂 release/v0.53.0
- 🚜🚀 tmp allows arbitrary temporary file / directory write via symbolic link `dir` parameter #LIVE #REGULAR (Original PR: [#1727](https://github.com/joinworth/integration-service/pull/1727)) ([#1822](https://github.com/joinworth/integration-service/pull/1822)) 🚂 release/v0.53.0
- 🚜🚀 Resolved vulnerabilities in this service #LIVE #REGULAR (Original PR: [#1749](https://github.com/joinworth/integration-service/pull/1749)) ([#1824](https://github.com/joinworth/integration-service/pull/1824)) 🚂 release/v0.53.0

- 🚜🚀 HotFix: Trulioo kyb mappings #LIVE #NO_JIRA 🚂 release/v0.53.0 #REGULAR (Original PR: [#1807](https://github.com/joinworth/integration-service/pull/1807)) ([#1826](https://github.com/joinworth/integration-service/pull/1826))

## [v0.53.0-fast-v2.0](https://github.com/joinworth/integration-service/compare/v0.53.2...v0.53.0-fast-v2.0) - 2025-11-03

### 💻 Tech Task

**[BEST-204](https://worth-ai.atlassian.net/browse/BEST-204) - Ensure ephemeral workers don't join API**

- ⚡🚜🚀 #LIVE safeguard k8s jobs from starting api #REGULAR #FAST (Original PR: [#1839](https://github.com/joinworth/integration-service/pull/1839)) ([#1843](https://github.com/joinworth/integration-service/pull/1843)) 🚂 release/v0.53.0-fast-v2

## [v0.53.2](https://github.com/joinworth/integration-service/compare/v0.53.0-fast-v1.0...v0.53.2) - 2025-10-28

### 📖 Story

**[BTTF-136](https://worth-ai.atlassian.net/browse/BTTF-136) - Handle the missing MCC code for Match**

- 🚜🚀 Fix MCC code for Match #LIVE #REGULAR (Original PR: [#1787](https://github.com/joinworth/integration-service/pull/1787)) ([#1793](https://github.com/joinworth/integration-service/pull/1793)) 🚂 release/v0.53.0

**[BTTF-29](https://worth-ai.atlassian.net/browse/BTTF-29) - [Trulioo] API Setup**

- 🚜🚀 Trulioo integration for business verification with automatic person screening #LIVE #REGULAR (Original PR: [#1726](https://github.com/joinworth/integration-service/pull/1726)) ([#1797](https://github.com/joinworth/integration-service/pull/1797)) 🚂 release/v0.53.0

### 🧰 Task

**[BTTF-110](https://worth-ai.atlassian.net/browse/BTTF-110) - [FAST TRACK][MATCH] [BE] Edit Application -Trigger MATCH Validation Automatically Post-Onboarding When Integration is Active**

- 🚜🚀 Trigger match review after update case #LIVE #REGULAR (Original PR: [#1774](https://github.com/joinworth/integration-service/pull/1774)) ([#1794](https://github.com/joinworth/integration-service/pull/1794)) 🚂 release/v0.53.0

### 🐛 Bug

**[PAT-880](https://worth-ai.atlassian.net/browse/PAT-880) - [FAST TRACK] [FLAG] Display IDV Results When PAT-779 Flag is Disabled**

- 🚜🚩 #FLAG fix: Check custom roles feature flag along w/ permission check #REGULAR (Original PR: [#1785](https://github.com/joinworth/integration-service/pull/1785)) ([#1798](https://github.com/joinworth/integration-service/pull/1798)) 🚂 release/v0.53.0

### 💻 Tech Task

**[BEST-163](https://worth-ai.atlassian.net/browse/BEST-163) - No title available**

- 🚜🚀 #LIVE fix website fact parsing #REGULAR (Original PR: [#1756](https://github.com/joinworth/integration-service/pull/1756)) ([#1801](https://github.com/joinworth/integration-service/pull/1801)) 🚂 release/v0.53.0

### 📝 Other

**[BEST-153](https://worth-ai.atlassian.net/browse/BEST-153) - No title available**

- 🚜🚀 Resolved build issue on Staging Environment #LIVE #REGULAR ([#1811](https://github.com/joinworth/integration-service/pull/1811))

- 📝 Update lock file

## [v0.53.0-fast-v1.0](https://github.com/joinworth/integration-service/compare/v0.52.5...v0.53.0-fast-v1.0) - 2025-10-23

### 📖 Story

**[BTTF-136](https://worth-ai.atlassian.net/browse/BTTF-136) - Handle the missing MCC code for Match**

- 🚜🚀 Fix MCC code for Match #LIVE #REGULAR (Original PR: [#1787](https://github.com/joinworth/integration-service/pull/1787)) ([#1796](https://github.com/joinworth/integration-service/pull/1796)) 🚂 release/v0.53.0-fast-v1

### 🧰 Task

**[BTTF-110](https://worth-ai.atlassian.net/browse/BTTF-110) - [FAST TRACK][MATCH] [BE] Edit Application -Trigger MATCH Validation Automatically Post-Onboarding When Integration is Active**

- 🚜🚀 Trigger match review after update case #LIVE #REGULAR (Original PR: [#1774](https://github.com/joinworth/integration-service/pull/1774)) ([#1795](https://github.com/joinworth/integration-service/pull/1795)) 🚂 release/v0.53.0-fast-v1

### 🐛 Bug

**[PAT-880](https://worth-ai.atlassian.net/browse/PAT-880) - [FAST TRACK] [FLAG] Display IDV Results When PAT-779 Flag is Disabled**

- 🚜🚩 #FLAG fix: Check custom roles feature flag along w/ permission check #REGULAR (Original PR: [#1785](https://github.com/joinworth/integration-service/pull/1785)) ([#1799](https://github.com/joinworth/integration-service/pull/1799)) 🚂 release/v0.53.0-fast-v1

## [v0.52.5](https://github.com/joinworth/integration-service/compare/v0.52.0-fast-v2.0...v0.52.5) - 2025-10-22

### 📖 Story

**[BEST-142](https://worth-ai.atlassian.net/browse/BEST-142) - No title available**

- 🚜🚀 DataScrapeAPI Error Codes #LIVE #REGULAR (Original PR: [#1759](https://github.com/joinworth/integration-service/pull/1759)) ([#1780](https://github.com/joinworth/integration-service/pull/1780)) 🚂 release/v0.52.0

**[BTTF-57](https://worth-ai.atlassian.net/browse/BTTF-57) - [MATCH] View Results in 360**

- 🚜🚀 #LIVE [MATCH] View Results in 360 #REGULAR (Original PR: [#1686](https://github.com/joinworth/integration-service/pull/1686)) ([#1747](https://github.com/joinworth/integration-service/pull/1747)) 🚂 release/v0.52.0

**[DOS-829](https://worth-ai.atlassian.net/browse/DOS-829) - Sandbox Identify Verification Response (IDV)**

- 🚜🚩 #FLAG Introduce strategy pattern for Plaid IDV integration to support sandbox and mock modes #REGULAR (Original PR: [#1705](https://github.com/joinworth/integration-service/pull/1705)) ([#1770](https://github.com/joinworth/integration-service/pull/1770)) 🚂 release/v0.52.0

### 🐛 Bug

**[BEST-147](https://worth-ai.atlassian.net/browse/BEST-147) - Warehouse + Integrations | Include confidence scores & originating match_id to `firmographics_event`**

- 🚜🚀 #LIVE Add Match ID and Prediction to Firmographic Event #REGULAR (Original PR: [#1732](https://github.com/joinworth/integration-service/pull/1732)) ([#1761](https://github.com/joinworth/integration-service/pull/1761)) 🚂 release/v0.52.0

**[BTTF-114](https://worth-ai.atlassian.net/browse/BTTF-114) - [BE] - Match Pro tab incorrectly triggers Match call and could incur charge**

- 🚜🚀 Match report from DB #LIVE #REGULAR (Original PR: [#1752](https://github.com/joinworth/integration-service/pull/1752)) ([#1775](https://github.com/joinworth/integration-service/pull/1775)) 🚂 release/v0.52.0

**[BTTF-115](https://worth-ai.atlassian.net/browse/BTTF-115) - [Match 360 Report] Incorrect display of “No Match” when status is “Not Checked”**

- 🚜🚀 Incorrect display of “No Match” #LIVE #REGULAR (Original PR: [#1765](https://github.com/joinworth/integration-service/pull/1765)) ([#1772](https://github.com/joinworth/integration-service/pull/1772)) 🚂 release/v0.52.0

**[DOS-914](https://worth-ai.atlassian.net/browse/DOS-914) - [FAST TRACK] Remove Credit Report Logic for DOS-886**

- 🚜🚀 #LIVE remove settings logic when populating ssn for reports #REGULAR (Original PR: [#1760](https://github.com/joinworth/integration-service/pull/1760)) ([#1769](https://github.com/joinworth/integration-service/pull/1769)) 🚂 release/v0.52.0

### ✨ Enhancement

**[BEST-123](https://worth-ai.atlassian.net/browse/BEST-123) - Add normalization to confidence scores across data sources**

- 🚜🚀 #LIVE Add normalization to confidence scores across data sources #REGULAR (Original PR: [#1748](https://github.com/joinworth/integration-service/pull/1748)) ([#1768](https://github.com/joinworth/integration-service/pull/1768)) 🚂 release/v0.52.0

**[BEST-125](https://worth-ai.atlassian.net/browse/BEST-125) - Add a prompt for MCC AI enrichment**

- 🚜🚀 #LIVE Derive MCC Code & Description from OpenAI #REGULAR (Original PR: [#1764](https://github.com/joinworth/integration-service/pull/1764)) ([#1781](https://github.com/joinworth/integration-service/pull/1781)) 🚂 release/v0.52.0

**[BEST-143](https://worth-ai.atlassian.net/browse/BEST-143) - IDV | Encrypt PII data from Plaid**

- 🚜🚀 Encrypt IDV data and Store data into request_response table #LIVE #REGULAR (Original PR: [#1706](https://github.com/joinworth/integration-service/pull/1706)) ([#1777](https://github.com/joinworth/integration-service/pull/1777)) 🚂 release/v0.52.0

**[BEST-146](https://worth-ai.atlassian.net/browse/BEST-146) - Feature Flag to wire Warehouse Facts API**

- 🚜🚀 Implement Re Calculation Of Fact #LIVE #REGULAR (Original PR: [#1750](https://github.com/joinworth/integration-service/pull/1750)) ([#1779](https://github.com/joinworth/integration-service/pull/1779)) 🚂 release/v0.52.0

**[BEST-65](https://worth-ai.atlassian.net/browse/BEST-65) - [Warehouse Facts API] Create new API, bind API on FE behind FF, test flow e2e (Must)**

- 🚜🚀 Added new API for fact that use warehouse stored data #LIVE #REGULAR (Original PR: [#1731](https://github.com/joinworth/integration-service/pull/1731)) ([#1778](https://github.com/joinworth/integration-service/pull/1778)) 🚂 release/v0.52.0

**[BEST-89](https://worth-ai.atlassian.net/browse/BEST-89) - Update Facts to Support Reviews**

- 🚜🚀 Update Facts to Support Reviews #LIVE #REGULAR (Original PR: [#1754](https://github.com/joinworth/integration-service/pull/1754)) ([#1771](https://github.com/joinworth/integration-service/pull/1771)) 🚂 release/v0.52.0

**[PAT-810](https://worth-ai.atlassian.net/browse/PAT-810) - gAuthenticate - Passing on owners name not Legal Entity**

- 🚜🚀 gAuthenticate - Passing on owners name not Legal Entity #LIVE #REGULAR (Original PR: [#1746](https://github.com/joinworth/integration-service/pull/1746)) ([#1767](https://github.com/joinworth/integration-service/pull/1767)) 🚂 release/v0.52.0

**[PAT-819](https://worth-ai.atlassian.net/browse/PAT-819) - Add fraudIDScanAlertCode to Credit Score Tooltips**

- 🚜🚀 Add fraudIDScanAlertCode to Credit Score Tooltips #LIVE #REGULAR (Original PR: [#1718](https://github.com/joinworth/integration-service/pull/1718)) ([#1766](https://github.com/joinworth/integration-service/pull/1766)) 🚂 release/v0.52.0

### 📝 Other

**[PAT-616](https://worth-ai.atlassian.net/browse/PAT-616) - No title available**

- 🚜🚀 Allowed Admin Routes #LIVE #REGULAR (Original PR: [#1730](https://github.com/joinworth/integration-service/pull/1730)) ([#1776](https://github.com/joinworth/integration-service/pull/1776)) 🚂 release/v0.52.0

## [v0.52.0-fast-v2.0](https://github.com/joinworth/integration-service/compare/v0.52.2...v0.52.0-fast-v2.0) - 2025-10-14

### 🐛 Bug

**[DOS-914](https://worth-ai.atlassian.net/browse/DOS-914) - [FAST TRACK] Remove Credit Report Logic for DOS-886**

- 🚜🚀 #LIVE remove settings logic when populating ssn for reports #REGULAR (Original PR: [#1760](https://github.com/joinworth/integration-service/pull/1760)) ([#1762](https://github.com/joinworth/integration-service/pull/1762)) 🚂 release/v0.52.0-fast-v2

## [v0.51.11](https://github.com/joinworth/integration-service/compare/v0.51.2...v0.51.11) - 2025-10-07

### 📖 Story

**[BEST-107](https://worth-ai.atlassian.net/browse/BEST-107) - Enable Persisted Manual Data Integration into FACTS**

- 🚜🚀 Fact overrides & schemas #LIVE #REGULAR (Original PR: [#1649](https://github.com/joinworth/integration-service/pull/1649)) ([#1688](https://github.com/joinworth/integration-service/pull/1688)) 🚂 release/v0.51.0
- 🚜🚀 fix string being expected as object #LIVE #REGULAR (Original PR: [#1678](https://github.com/joinworth/integration-service/pull/1678)) ([#1689](https://github.com/joinworth/integration-service/pull/1689)) 🚂 release/v0.51.0

**[BTTF-104](https://worth-ai.atlassian.net/browse/BTTF-104) - Improve the country codes and remove special characters from business name**

- 🚜🚀 country codes and special characters #LIVE #REGULAR (Original PR: [#1685](https://github.com/joinworth/integration-service/pull/1685)) ([#1695](https://github.com/joinworth/integration-service/pull/1695)) 🚂 release/v0.51.0

**[BTTF-95](https://worth-ai.atlassian.net/browse/BTTF-95) - [MATCH] Integration Test for negative test case**

- 🚜🚀 Use real payload in Match review #LIVE #REGULAR (Original PR: [#1666](https://github.com/joinworth/integration-service/pull/1666)) ([#1694](https://github.com/joinworth/integration-service/pull/1694)) 🚂 release/v0.51.0

**[DOS-822](https://worth-ai.atlassian.net/browse/DOS-822) - Create & Manage Sandbox Accounts Pt. I**

- 🚜🚀 Customer Sandbox Implementation #LIVE #REGULAR (Original PR: [#1573](https://github.com/joinworth/integration-service/pull/1573)) ([#1696](https://github.com/joinworth/integration-service/pull/1696)) 🚂 release/v0.51.0

**[DOS-874](https://worth-ai.atlassian.net/browse/DOS-874) - Create & Manage Sandbox Accounts Pt. II**

- 🚜🚀 Copy parent customer config to child during sandbox implementation #LIVE #REGULAR (Original PR: [#1610](https://github.com/joinworth/integration-service/pull/1610)) ([#1697](https://github.com/joinworth/integration-service/pull/1697)) 🚂 release/v0.51.0
- 🚜🚀 Fixed schema validation in parent to child copy integration setting scenario #LIVE #REGULAR (Original PR: [#1634](https://github.com/joinworth/integration-service/pull/1634)) ([#1698](https://github.com/joinworth/integration-service/pull/1698)) 🚂 release/v0.51.0
- 🚜🚀 Added fallback logic when customer integration settings not present #LIVE #REGULAR (Original PR: [#1636](https://github.com/joinworth/integration-service/pull/1636)) ([#1699](https://github.com/joinworth/integration-service/pull/1699)) 🚂 release/v0.51.0
- 🚜🚀 Validation improvement and sync API updates #LIVE #REGULAR (Original PR: [#1640](https://github.com/joinworth/integration-service/pull/1640)) ([#1700](https://github.com/joinworth/integration-service/pull/1700)) 🚂 release/v0.51.0
- 🚜🚀 Resolved bug in copy integration setting from parent to child #LIVE #REGULAR (Original PR: [#1654](https://github.com/joinworth/integration-service/pull/1654)) ([#1701](https://github.com/joinworth/integration-service/pull/1701)) 🚂 release/v0.51.0
- 🚜🚀 Resolved issue where new Equifax setting not utilized properly #LIVE #REGULAR (Original PR: [#1668](https://github.com/joinworth/integration-service/pull/1668)) ([#1702](https://github.com/joinworth/integration-service/pull/1702)) 🚂 release/v0.51.0

**[PAT-691](https://worth-ai.atlassian.net/browse/PAT-691) - [FE+BE] Apply Features Permission Set**

- 🚜🚀 #LIVE feat: applying feature permissions #REGULAR (Original PR: [#1655](https://github.com/joinworth/integration-service/pull/1655)) ([#1693](https://github.com/joinworth/integration-service/pull/1693)) 🚂 release/v0.51.0

### 🧰 Task

**[INFRA-226](https://worth-ai.atlassian.net/browse/INFRA-226) - [RELEASE EXPERIENCE] Validate cherry-pick sprint vs release train**

- 🚜🚀 #LIVE Validate release label in cherry-pick action via Google Calendar #REGULAR (Original PR: [#1641](https://github.com/joinworth/integration-service/pull/1641)) ([#1670](https://github.com/joinworth/integration-service/pull/1670)) 🚂 release/v0.51.0
- 🚜🚀 #LIVE Add completion comment on original PR #REGULAR (Original PR: [#1667](https://github.com/joinworth/integration-service/pull/1667)) ([#1672](https://github.com/joinworth/integration-service/pull/1672)) 🚂 release/v0.51.0

**[INFRA-234](https://worth-ai.atlassian.net/browse/INFRA-234) - Action to compare env Keys with doppler configs**

- 🚜🚀 #LIVE Add workflow to compare environment variables with doppler #REGULAR (Original PR: [#1510](https://github.com/joinworth/integration-service/pull/1510)) ([#1669](https://github.com/joinworth/integration-service/pull/1669)) 🚂 release/v0.51.0

### 🐛 Bug

**[BEST-100](https://worth-ai.atlassian.net/browse/BEST-100) - Website does not appear to be returning/sending to website scanner**

- 🚜🚀 #LIVE fix website scanner race condition #REGULAR (Original PR: [#1613](https://github.com/joinworth/integration-service/pull/1613)) ([#1675](https://github.com/joinworth/integration-service/pull/1675)) 🚂 release/v0.51.0

**[BEST-93](https://worth-ai.atlassian.net/browse/BEST-93) - In-house web scanner fetches non-existent pages instead of real site pages**

- 🚜🚀 #LIVE fix website scanner fetching non-existent pages #REGULAR (Original PR: [#1637](https://github.com/joinworth/integration-service/pull/1637)) ([#1674](https://github.com/joinworth/integration-service/pull/1674)) 🚂 release/v0.51.0

**[BTTF-106](https://worth-ai.atlassian.net/browse/BTTF-106) - Fix Match connection status with real ICA number**

- 🚜🚀 Fix match connection status #LIVE #REGULAR (Original PR: [#1703](https://github.com/joinworth/integration-service/pull/1703)) ([#1704](https://github.com/joinworth/integration-service/pull/1704)) 🚂 release/v0.51.0

### ✨ Enhancement

**[BEST-108](https://worth-ai.atlassian.net/browse/BEST-108) - Modify the prompt for NAICS AI enrichment**

- 🚜🚀 Proxy Request & Testing DeferrableTasks #LIVE [Part 1/2] #REGULAR (Original PR: [#1612](https://github.com/joinworth/integration-service/pull/1612)) ([#1658](https://github.com/joinworth/integration-service/pull/1658)) 🚂 release/v0.51.0
- 🚜🚀 OpenAI responses #LIVE [Part 2/2] #REGULAR (Original PR: [#1611](https://github.com/joinworth/integration-service/pull/1611)) ([#1659](https://github.com/joinworth/integration-service/pull/1659)) 🚂 release/v0.51.0

### 📝 Other

**[BEST-71](https://worth-ai.atlassian.net/browse/BEST-71) - No title available**

- 🔥🚀 #LIVE #HOTFIX Remove Another Duplicate Cherry Pick Artifact ([#1722](https://github.com/joinworth/integration-service/pull/1722))
- 🚜🚀 #LIVE Added initial implementation for NPI Reverse lookup #REGULAR (Original PR: [#1608](https://github.com/joinworth/integration-service/pull/1608)) ([#1707](https://github.com/joinworth/integration-service/pull/1707)) 🚂 release/v0.51.0

**[DOS-896](https://worth-ai.atlassian.net/browse/DOS-896) - No title available**

- 🚜🚀 FIX: Handle google review synthesizing failure doesn't leak to the FE and break onboarding #LIVE #REGULAR (Original PR: [#1671](https://github.com/joinworth/integration-service/pull/1671)) ([#1687](https://github.com/joinworth/integration-service/pull/1687)) 🚂 release/v0.51.0
- 🚜🚀 & #LIVE Force all openai schemas that are .optional() to have .nullable() as … #REGULAR (Original PR: [#1662](https://github.com/joinworth/integration-service/pull/1662)) ([#1676](https://github.com/joinworth/integration-service/pull/1676)) 🚂 release/v0.51.0

- 📝 Remove duplicate imports
- 🚜🚀 #LIVE #NO_JIRA Fix issue where invalid URl was being called for matching 🚂 release/v0.51.0 #REGULAR (Original PR: [#1677](https://github.com/joinworth/integration-service/pull/1677)) ([#1713](https://github.com/joinworth/integration-service/pull/1713))
- 🚜🚀 #NO_JIRA #LIVE Fix issue where NPI meta data was incorrect 🚂 release/v0.51.0 #REGULAR (Original PR: [#1679](https://github.com/joinworth/integration-service/pull/1679)) ([#1714](https://github.com/joinworth/integration-service/pull/1714))
- 🚜🚀 #NO_JIRA #LIVE Don't stop Persisting NPI if NPI wasn't in submission 🚂 release/v0.51.0 #REGULAR (Original PR: [#1682](https://github.com/joinworth/integration-service/pull/1682)) ([#1715](https://github.com/joinworth/integration-service/pull/1715))
- 🚜🚀 #LIVE #NO_JIRA Fix Match Message Schema 🚂 release/v0.51.0 #REGULAR (Original PR: [#1683](https://github.com/joinworth/integration-service/pull/1683)) ([#1716](https://github.com/joinworth/integration-service/pull/1716))
- 🚜🚀 #LIVE #NO_JIRA Pass NPI Info From manual Upload 🚂 release/v0.51.0 #REGULAR (Original PR: [#1684](https://github.com/joinworth/integration-service/pull/1684)) ([#1717](https://github.com/joinworth/integration-service/pull/1717))
- 🚜🚀 #NO_JIRA #LIVE fix whitespace 🚂 release/v0.51.0 #REGULAR (Original PR: [#1660](https://github.com/joinworth/integration-service/pull/1660)) ([#1661](https://github.com/joinworth/integration-service/pull/1661))

**[PAT-614](https://worth-ai.atlassian.net/browse/PAT-614) - No title available**

- 🚜🚀 Organize Adverse Media By Business and Owner #LIVE #REGULAR (Original PR: [#1639](https://github.com/joinworth/integration-service/pull/1639)) ([#1690](https://github.com/joinworth/integration-service/pull/1690)) 🚂 release/v0.51.0
- 🚜🚀 organize adverse media by business and owner #LIVE #REGULAR (Original PR: [#1665](https://github.com/joinworth/integration-service/pull/1665)) ([#1691](https://github.com/joinworth/integration-service/pull/1691)) 🚂 release/v0.51.0

## [v0.51.2](https://github.com/joinworth/integration-service/compare/v0.51.0-hotfix-v1.0...v0.51.2) - 2025-09-30

### 📖 Story

**[BTTF-55](https://worth-ai.atlassian.net/browse/BTTF-55) - [MATCH] Submit new businesses to MATCH in onboarding flow**

- 🚜🚩 integrate Match to onboarding flow #FLAG #REGULAR (Original PR: [#1581](https://github.com/joinworth/integration-service/pull/1581)) ([#1630](https://github.com/joinworth/integration-service/pull/1630)) 🚂 release/v0.51.0

**[BTTF-62](https://worth-ai.atlassian.net/browse/BTTF-62) - [MATCH] [BE] View Results Case Management**

- 🚜🚩 [BE] View results case management #FLAG #REGULAR (Original PR: [#1554](https://github.com/joinworth/integration-service/pull/1554)) ([#1622](https://github.com/joinworth/integration-service/pull/1622)) 🚂 release/v0.51.0

**[BTTF-7](https://worth-ai.atlassian.net/browse/BTTF-7) - [MATCH] Secure Credential Management MATCH Integration**

- 🚜🚩 #FLAG Secure Credential Management MATCH Integration #REGULAR (Original PR: [#1492](https://github.com/joinworth/integration-service/pull/1492)) ([#1624](https://github.com/joinworth/integration-service/pull/1624)) 🚂 release/v0.51.0
- 🚜🚀 #LIVE add error handler for AWS exceptions #REGULAR (Original PR: [#1508](https://github.com/joinworth/integration-service/pull/1508)) ([#1626](https://github.com/joinworth/integration-service/pull/1626)) 🚂 release/v0.51.0
- 🚜🚀 #LIVE Introduce normalizeBooleans utility to standardize boolean #REGULAR (Original PR: [#1632](https://github.com/joinworth/integration-service/pull/1632)) ([#1633](https://github.com/joinworth/integration-service/pull/1633)) 🚂 release/v0.51.0

### 🧰 Task

**[BTTF-23](https://worth-ai.atlassian.net/browse/BTTF-23) - [MATCH] [BE] Integrate the AWS Key**

- 🚜🚩 integrate aws secrets and match connection service #FLAG #REGULAR (Original PR: [#1529](https://github.com/joinworth/integration-service/pull/1529)) ([#1620](https://github.com/joinworth/integration-service/pull/1620)) 🚂 release/v0.51.0

**[BTTF-24](https://worth-ai.atlassian.net/browse/BTTF-24) - [MATCH] [BE] Generate Payload**

- 🚜🚩 Generate Mastercard Match Payload #FLAG #REGULAR (Original PR: [#1505](https://github.com/joinworth/integration-service/pull/1505)) ([#1619](https://github.com/joinworth/integration-service/pull/1619)) 🚂 release/v0.51.0

**[BTTF-59](https://worth-ai.atlassian.net/browse/BTTF-59) - [MATCH] [BE] Bulk business review**

- 🚜🚩 bulk business review #FLAG #REGULAR (Original PR: [#1551](https://github.com/joinworth/integration-service/pull/1551)) ([#1621](https://github.com/joinworth/integration-service/pull/1621)) 🚂 release/v0.51.0

### 🐛 Bug

**[DOS-868](https://worth-ai.atlassian.net/browse/DOS-868) - If SSN is not provided, the Plaid IDV request is incorrectly routed to the SSN-required template.**

- 🚜🚀 Use fallback plaid template when no SSN provided #LIVE #REGULAR (Original PR: [#1602](https://github.com/joinworth/integration-service/pull/1602)) ([#1635](https://github.com/joinworth/integration-service/pull/1635)) 🚂 release/v0.51.0

**[PAT-829](https://worth-ai.atlassian.net/browse/PAT-829) - [HOTFIX] Credit Score for Owner 2 Same as Owner 1**

- 🚜🚀 #LIVE fix data mutation issue #REGULAR (Original PR: [#1643](https://github.com/joinworth/integration-service/pull/1643)) ([#1644](https://github.com/joinworth/integration-service/pull/1644)) 🚂 release/v0.51.0
- 🚜🚀 / Handle OWNER_UPDATED_EVENT failing [Part 2] #LIVE (Merge to Main) #REGULAR (Original PR: [#1650](https://github.com/joinworth/integration-service/pull/1650)) ([#1652](https://github.com/joinworth/integration-service/pull/1652)) 🚂 release/v0.51.0

### 🔗 Subtask

**[BTTF-18](https://worth-ai.atlassian.net/browse/BTTF-18) - Create migrate DB and PR for the new integration Match Pro**

- 🚜🚩 Add platform Match Pro #FLAG #REGULAR (Original PR: [#1465](https://github.com/joinworth/integration-service/pull/1465)) ([#1617](https://github.com/joinworth/integration-service/pull/1617)) 🚂 release/v0.51.0

**[BTTF-19](https://worth-ai.atlassian.net/browse/BTTF-19) - Create PR for constants, Handler, Route and Controller**

- 🚜🚩 create integration handler, route, controller, constants for match #FLAG #REGULAR (Original PR: [#1484](https://github.com/joinworth/integration-service/pull/1484)) ([#1618](https://github.com/joinworth/integration-service/pull/1618)) 🚂 release/v0.51.0

**[BTTF-72](https://worth-ai.atlassian.net/browse/BTTF-72) - Create control to CheckConnection in handler**

- 🚜🚩 Improve control for checking MatchConnection in handler #FLAG #REGULAR (Original PR: [#1564](https://github.com/joinworth/integration-service/pull/1564)) ([#1623](https://github.com/joinworth/integration-service/pull/1623)) 🚂 release/v0.51.0

**[BTTF-81](https://worth-ai.atlassian.net/browse/BTTF-81) - Improve Match-pro integration handler for new field `isActive`**

- 🚜🚩 Improve Match integration handler #FLAG #REGULAR (Original PR: [#1600](https://github.com/joinworth/integration-service/pull/1600)) ([#1631](https://github.com/joinworth/integration-service/pull/1631)) 🚂 release/v0.51.0

### 📝 Other

**[BTTF-61](https://worth-ai.atlassian.net/browse/BTTF-61) - No title available**

- 🚜🚀 #LIVE match be create api to extract private key from p 12 or pem file #REGULAR (Original PR: [#1553](https://github.com/joinworth/integration-service/pull/1553)) ([#1627](https://github.com/joinworth/integration-service/pull/1627)) 🚂 release/v0.51.0
- 🚜🚀 #LIVE Refactor MatchConnection #REGULAR (Original PR: [#1561](https://github.com/joinworth/integration-service/pull/1561)) ([#1628](https://github.com/joinworth/integration-service/pull/1628)) 🚂 release/v0.51.0
- 🚜🚀 #LIVE feat: Add 'activated' field to Secrets interface #REGULAR (Original PR: [#1572](https://github.com/joinworth/integration-service/pull/1572)) ([#1629](https://github.com/joinworth/integration-service/pull/1629)) 🚂 release/v0.51.0

- 📝 Fix conflict integration-service ([#1642](https://github.com/joinworth/integration-service/pull/1642))
- 🚜🚀 #NO_JIRA: #LIVE Remove export statement for AWS module from index.ts 🚂 release/v0.51.0 #REGULAR (Original PR: [#1506](https://github.com/joinworth/integration-service/pull/1506)) ([#1625](https://github.com/joinworth/integration-service/pull/1625))

## [v0.51.0-hotfix-v1.0](https://github.com/joinworth/integration-service/compare/v0.50.0-hotfix-v1.0...v0.51.0-hotfix-v1.0) - 2025-09-28

### 🐛 Bug

**[PAT-829](https://worth-ai.atlassian.net/browse/PAT-829) - [HOT FIX] Credit Score for Owner 2 Same as Owner 1**

- 🚜🚀 / Handle OWNER_UPDATED_EVENT failing [Part 2] #LIVE (Merge to Main) #REGULAR (Original PR: [#1650](https://github.com/joinworth/integration-service/pull/1650)) ([#1651](https://github.com/joinworth/integration-service/pull/1651)) 🚂 release/v0.51.0-hotfix-v1.0

## [v0.50.0-hotfix-v1.0](https://github.com/joinworth/integration-service/compare/v0.50.5...v0.50.0-hotfix-v1.0) - 2025-09-26

### 🐛 Bug

**[PAT-829](https://worth-ai.atlassian.net/browse/PAT-829) - [HOT FIX] Credit Score for Owner 2 Same as Owner 1**

- 🚀 #LIVE fix data mutation issue ([#1643](https://github.com/joinworth/integration-service/pull/1643))

## [v0.50.5](https://github.com/joinworth/integration-service/compare/v0.50.0-fast-v2.1...v0.50.5) - 2025-09-23

### 📖 Story

**[DOS-837](https://worth-ai.atlassian.net/browse/DOS-837) - [FE] Support Multi-Template in Customer Admin**

- 🚜🚀 Feat: Support multi esign template selection #LIVE #REGULAR (Original PR: [#1568](https://github.com/joinworth/integration-service/pull/1568)) ([#1586](https://github.com/joinworth/integration-service/pull/1586)) 🚂 release/v0.50.0

**[PAT-804](https://worth-ai.atlassian.net/browse/PAT-804) - [FAST TRACK] Tax OCR Doc Uploads Only Display Last Uploaded File**

- 🚜🚀 #LIVE QA Fixes #REGULAR (Original PR: [#1589](https://github.com/joinworth/integration-service/pull/1589)) ([#1595](https://github.com/joinworth/integration-service/pull/1595)) 🚂 release/v0.50.0
- 🚜🚀 multiple file support #LIVE #REGULAR (Original PR: [#1591](https://github.com/joinworth/integration-service/pull/1591)) ([#1593](https://github.com/joinworth/integration-service/pull/1593)) 🚂 release/v0.50.0
- 🚜🚀 #LIVE fix: audit log post OCR extraction and fetching all uploaded documents #REGULAR (Original PR: [#1585](https://github.com/joinworth/integration-service/pull/1585)) ([#1587](https://github.com/joinworth/integration-service/pull/1587)) 🚂 release/v0.50.0

### 🐛 Bug

**[BEST-113](https://worth-ai.atlassian.net/browse/BEST-113) - [FAST TRACK] Integrations seem to be running multiple times**

- 🚜🚀 #LIVE Handle Duplicate Task Execution #REGULAR (Original PR: [#1560](https://github.com/joinworth/integration-service/pull/1560)) ([#1569](https://github.com/joinworth/integration-service/pull/1569)) 🚂 release/v0.50.0

**[DOS-843](https://worth-ai.atlassian.net/browse/DOS-843) - [FAST TRACK] 360 Reports Intermittently Failing to Generate**

- 🚜🚀 fix address parsing #LIVE #REGULAR (Original PR: [#1566](https://github.com/joinworth/integration-service/pull/1566)) ([#1590](https://github.com/joinworth/integration-service/pull/1590)) 🚂 release/v0.50.0

**[PLAT-12](https://worth-ai.atlassian.net/browse/PLAT-12) - Equifax task does not consistently run**

- 🚜🚀 Fix Equifax task does not consistently run #LIVE #REGULAR (Original PR: [#1380](https://github.com/joinworth/integration-service/pull/1380)) ([#1592](https://github.com/joinworth/integration-service/pull/1592)) 🚂 release/v0.50.0

### ✨ Enhancement

**[BEST-124](https://worth-ai.atlassian.net/browse/BEST-124) - Deprecate Feature Flag WIN_1318_DEPOSIT_ACCOUNT_FEATURE for Deposit Account Setting**

- 🚜🚩 #FLAG Removing WIN_1318_DEPOSIT_ACCOUNT_FEATURE constant #REGULAR (Original PR: [#1577](https://github.com/joinworth/integration-service/pull/1577)) ([#1580](https://github.com/joinworth/integration-service/pull/1580)) 🚂 release/v0.50.0

**[BEST-64](https://worth-ai.atlassian.net/browse/BEST-64) - Consume `firmographics_event` message instead of querying Redshift directly**

- 🚜🚩 #FLAG Consume Firmographics Event for Warehouse Matches #REGULAR (Original PR: [#1534](https://github.com/joinworth/integration-service/pull/1534)) ([#1588](https://github.com/joinworth/integration-service/pull/1588)) 🚂 release/v0.50.0

**[PAT-684](https://worth-ai.atlassian.net/browse/PAT-684) - Deprecate Feature Flag WIN_1218_NO_LOGIN_ONBOARDING for Login with Email & Password**

- 🚜🚀 #LIVE Remove WIN_1218 FF constant #REGULAR (Original PR: [#1559](https://github.com/joinworth/integration-service/pull/1559)) ([#1582](https://github.com/joinworth/integration-service/pull/1582)) 🚂 release/v0.50.0

**[PAT-762](https://worth-ai.atlassian.net/browse/PAT-762) - Failed to Fetch Credit Report for a Business**

- 🚜🚀 #LIVE fix: saving raw response even if does not have score #REGULAR (Original PR: [#1562](https://github.com/joinworth/integration-service/pull/1562)) ([#1583](https://github.com/joinworth/integration-service/pull/1583)) 🚂 release/v0.50.0
- 🚜🚀 #LIVE feat: added error key in response when credit score is null #REGULAR (Original PR: [#1567](https://github.com/joinworth/integration-service/pull/1567)) ([#1584](https://github.com/joinworth/integration-service/pull/1584)) 🚂 release/v0.50.0

**[PAT-807](https://worth-ai.atlassian.net/browse/PAT-807) - [FAST TRACK] Tax OCR Doc Uploads For Multiple Years + Update Tax Notification Emails**

- 🚜🚀 Multiple tax filling Support #LIVE #REGULAR (Original PR: [#1601](https://github.com/joinworth/integration-service/pull/1601)) ([#1605](https://github.com/joinworth/integration-service/pull/1605)) 🚂 release/v0.50.0
- 🚜🚀 #LIVE QA Fixes #REGULAR (Original PR: [#1603](https://github.com/joinworth/integration-service/pull/1603)) ([#1606](https://github.com/joinworth/integration-service/pull/1606)) 🚂 release/v0.50.0
- 🚜🚀 #LIVE fix: file download fix #REGULAR (Original PR: [#1604](https://github.com/joinworth/integration-service/pull/1604)) ([#1607](https://github.com/joinworth/integration-service/pull/1607)) 🚂 release/v0.50.0

### 📝 Other

**[PAT-766](https://worth-ai.atlassian.net/browse/PAT-766) - No title available**

- 🚜🚀 #LIVE feat: Add watchlist_entries to 360 report data #REGULAR (Original PR: [#1565](https://github.com/joinworth/integration-service/pull/1565)) ([#1578](https://github.com/joinworth/integration-service/pull/1578)) 🚂 release/v0.50.0
- 🚜🚀 #LIVE fix: Fix "No Hits" cards not appearing in 360 report #REGULAR (Original PR: [#1576](https://github.com/joinworth/integration-service/pull/1576)) ([#1579](https://github.com/joinworth/integration-service/pull/1579)) 🚂 release/v0.50.0

## [v0.50.0-fast-v2.1](https://github.com/joinworth/integration-service/compare/v0.50.0-fast-v2.0...v0.50.0-fast-v2.1) - 2025-09-18

### 📖 Story

**[PAT-804](https://worth-ai.atlassian.net/browse/PAT-804) - [FAST TRACK] Tax OCR Doc Uploads Only Display Last Uploaded File**

- 🚜🚀 #LIVE fix: audit log post OCR extraction and fetching all uploaded documents #REGULAR (Original PR: [#1585](https://github.com/joinworth/integration-service/pull/1585)) ([#1596](https://github.com/joinworth/integration-service/pull/1596)) 🚂 release/v0.50.0-fast-v2
- 🚜🚀 #LIVE QA Fixes #REGULAR (Original PR: [#1589](https://github.com/joinworth/integration-service/pull/1589)) ([#1597](https://github.com/joinworth/integration-service/pull/1597)) 🚂 release/v0.50.0-fast-v2
- 🚜🚀 multiple file support #LIVE #REGULAR (Original PR: [#1591](https://github.com/joinworth/integration-service/pull/1591)) ([#1594](https://github.com/joinworth/integration-service/pull/1594)) 🚂 release/v0.50.0-fast-v2

## [v0.50.0-fast-v2.0](https://github.com/joinworth/integration-service/compare/v0.50.0...v0.50.0-fast-v2.0) - 2025-09-17

### 🐛 Bug

**[BEST-113](https://worth-ai.atlassian.net/browse/BEST-113) - [FAST TRACK] Integrations seem to be running multiple times**

- 🚜🚀 #LIVE Handle Duplicate Task Execution #REGULAR (Original PR: [#1560](https://github.com/joinworth/integration-service/pull/1560)) ([#1574](https://github.com/joinworth/integration-service/pull/1574)) 🚂 release/v0.50.0-fast-v2

## [v0.50.0](https://github.com/joinworth/integration-service/compare/v0.49.4...v0.50.0) - 2025-09-16

### 💻 Tech Task

**[BEST-81](https://worth-ai.atlassian.net/browse/BEST-81) - Update AI Score Service to Use Kafka Event**

- 🚜🚀 Refactor the score Fact code #LIVE #REGULAR (Original PR: [#1548](https://github.com/joinworth/integration-service/pull/1548)) ([#1557](https://github.com/joinworth/integration-service/pull/1557)) 🚂 release/v0.50.0

## [v0.49.4](https://github.com/joinworth/integration-service/compare/v0.49.3...v0.49.4) - 2025-09-09

### 🐛 Bug

**[PAT-763](https://worth-ai.atlassian.net/browse/PAT-763) - Unable to Download Credit Report**

- 🚜🚩 #FLAG fix: credit bureau reports fix #REGULAR (Original PR: [#1525](https://github.com/joinworth/integration-service/pull/1525)) ([#1537](https://github.com/joinworth/integration-service/pull/1537)) 🚂 release/v0.49.0

**[PAT-791](https://worth-ai.atlassian.net/browse/PAT-791) - OCR Taxes File Upload and Data Insertion into DB**

- 🚜🚀 #LIVE fix: ocr taxes data insertion post extraction #REGULAR (Original PR: [#1536](https://github.com/joinworth/integration-service/pull/1536)) ([#1539](https://github.com/joinworth/integration-service/pull/1539)) 🚂 release/v0.49.0
- 🚜🚀 #LIVE fix: schema update #REGULAR (Original PR: [#1540](https://github.com/joinworth/integration-service/pull/1540)) ([#1541](https://github.com/joinworth/integration-service/pull/1541)) 🚂 release/v0.49.0

### 💻 Tech Task

**[BEST-47](https://worth-ai.atlassian.net/browse/BEST-47) - Implement Fact & Kafka Publishing**

- 🚜🚀 Create Fact For scoring #LIVE #REGULAR (Original PR: [#1524](https://github.com/joinworth/integration-service/pull/1524)) ([#1546](https://github.com/joinworth/integration-service/pull/1546)) 🚂 release/v0.49.0
- 🚜🚀 Score Fact #LIVE #REGULAR (Original PR: [#1535](https://github.com/joinworth/integration-service/pull/1535)) ([#1547](https://github.com/joinworth/integration-service/pull/1547)) 🚂 release/v0.49.0

**[DOS-817](https://worth-ai.atlassian.net/browse/DOS-817) - [Dev Experience] POC + DevEx Video Walkthrough**

- 🚜🚀 Enabled auto-creation of Kafka topics in the local development environment #LIVE #REGULAR (Original PR: [#1494](https://github.com/joinworth/integration-service/pull/1494)) ([#1544](https://github.com/joinworth/integration-service/pull/1544)) 🚂 release/v0.49.0
- 🚜🚀 Resolved build issue #LIVE #REGULAR (Original PR: [#1514](https://github.com/joinworth/integration-service/pull/1514)) ([#1545](https://github.com/joinworth/integration-service/pull/1545)) 🚂 release/v0.49.0

**[FOTC-75](https://worth-ai.atlassian.net/browse/FOTC-75) - Add logging to view full prompts submitted to OpenAI**

- 🚜🚀 #LIVE Logging OpenAI Prompts #REGULAR (Original PR: [#1531](https://github.com/joinworth/integration-service/pull/1531)) ([#1542](https://github.com/joinworth/integration-service/pull/1542)) 🚂 release/v0.49.0

**[FOTC-78](https://worth-ai.atlassian.net/browse/FOTC-78) - [SOC 2] All Else - Fix Integration Service Vulnerabilities**

- 🚜🚀 #LIVE Fix Integration Service Vulnerabilities - Update multer to v2.0.2 #REGULAR (Original PR: [#1530](https://github.com/joinworth/integration-service/pull/1530)) ([#1543](https://github.com/joinworth/integration-service/pull/1543)) 🚂 release/v0.49.0

### 📝 Other

**[PAT-757](https://worth-ai.atlassian.net/browse/PAT-757) - No title available**

- 🚜🚀 Schema Updates #LIVE #REGULAR (Original PR: [#1526](https://github.com/joinworth/integration-service/pull/1526)) ([#1538](https://github.com/joinworth/integration-service/pull/1538)) 🚂 release/v0.49.0

## [v0.49.3](https://github.com/joinworth/integration-service/compare/v0.49.0-fast-v1.0...v0.49.3) - 2025-09-02

### 🧰 Task

**[INFRA-229](https://worth-ai.atlassian.net/browse/INFRA-229) - Use PAT in checkout to allow cherry-pick of workflow files**

- 🚜🚀 #LIVE Use PAT in checkout to allow cherry-pick of workflow files #REGULAR (Original PR: [#1495](https://github.com/joinworth/integration-service/pull/1495)) ([#1523](https://github.com/joinworth/integration-service/pull/1523)) 🚂 release/v0.49.0

**[INFRA-232](https://worth-ai.atlassian.net/browse/INFRA-232) - GHA & Dockerfile updates for types**

- 🚜🚀 #LIVE GHA & Dockerfile updates for types #REGULAR (Original PR: [#1471](https://github.com/joinworth/integration-service/pull/1471)) ([#1504](https://github.com/joinworth/integration-service/pull/1504)) 🚂 release/v0.49.0

### 🐛 Bug

**[BEST-91](https://worth-ai.atlassian.net/browse/BEST-91) - [FAST TRACK] IDV does not appear to be running for non-US/Canadian users**

- 🚜🚀 #LIVE fix sandbox \_\_test #REGULAR (Original PR: [#1527](https://github.com/joinworth/integration-service/pull/1527)) ([#1528](https://github.com/joinworth/integration-service/pull/1528)) 🚂 release/v0.49.0
- 🚜🚀 IDV Sanitization by Country #LIVE #REGULAR (Original PR: [#1501](https://github.com/joinworth/integration-service/pull/1501)) ([#1519](https://github.com/joinworth/integration-service/pull/1519)) 🚂 release/v0.49.0
- 🚜🚩 #FLAG fix build issue #REGULAR (Original PR: [#1507](https://github.com/joinworth/integration-service/pull/1507)) ([#1520](https://github.com/joinworth/integration-service/pull/1520)) 🚂 release/v0.49.0
- 🚜🚩 #FLAG IDV Fixes #REGULAR (Original PR: [#1509](https://github.com/joinworth/integration-service/pull/1509)) ([#1521](https://github.com/joinworth/integration-service/pull/1521)) 🚂 release/v0.49.0

### 💻 Tech Task

**[DOS-734](https://worth-ai.atlassian.net/browse/DOS-734) - [DEV EXPERIENCE] Fix initDeferredTaskWorker process locally**

- 🚜🚀 #LIVE Prevent initDeferredTaskWorker from Crashing integration-service #REGULAR (Original PR: [#1381](https://github.com/joinworth/integration-service/pull/1381)) ([#1512](https://github.com/joinworth/integration-service/pull/1512)) 🚂 release/v0.49.0

### 📝 Other

**[PAT-748](https://worth-ai.atlassian.net/browse/PAT-748) - No title available**

- 🚜🚀 #LIVE fix: Fixes cross-customer token access #REGULAR (Original PR: [#1485](https://github.com/joinworth/integration-service/pull/1485)) ([#1511](https://github.com/joinworth/integration-service/pull/1511)) 🚂 release/v0.49.0

## [v0.49.0-fast-v1.0](https://github.com/joinworth/integration-service/compare/v0.48.5...v0.49.0-fast-v1.0) - 2025-08-28

### 🐛 Bug

**[BEST-91](https://worth-ai.atlassian.net/browse/BEST-91) - [FAST TRACK] IDV does not appear to be running for non-US/Canadian users**

- 🚜🚀 IDV Sanitization by Country #LIVE #REGULAR (Original PR: [#1501](https://github.com/joinworth/integration-service/pull/1501)) ([#1515](https://github.com/joinworth/integration-service/pull/1515)) 🚂 release/v0.49.0-fast-v1
- 🚜🚩 #FLAG fix build issue #REGULAR (Original PR: [#1507](https://github.com/joinworth/integration-service/pull/1507)) ([#1517](https://github.com/joinworth/integration-service/pull/1517)) 🚂 release/v0.49.0-fast-v1
- 🚜🚩 #FLAG IDV Fixes #REGULAR (Original PR: [#1509](https://github.com/joinworth/integration-service/pull/1509)) ([#1518](https://github.com/joinworth/integration-service/pull/1518)) 🚂 release/v0.49.0-fast-v1

## [v0.48.5](https://github.com/joinworth/integration-service/compare/v0.48.0-fast-v2.0...v0.48.5) - 2025-08-26

### 🧰 Task

**[INFRA-221](https://worth-ai.atlassian.net/browse/INFRA-221) - In auto release note - original PR link is not clickable**

- 🚜🚀 #LIVE FIX ORIGINAL PR LINK ISSUE #REGULAR (Original PR: [#1483](https://github.com/joinworth/integration-service/pull/1483)) ([#1491](https://github.com/joinworth/integration-service/pull/1491)) 🚂 release/v0.48.0

**[INFRA-229](https://worth-ai.atlassian.net/browse/INFRA-229) - Use PAT in checkout to allow cherry-pick of workflow files**

- 🚜🚀 #LIVE Use PAT in checkout to allow cherry-pick of workflow files #REGULAR (Original PR: [#1495](https://github.com/joinworth/integration-service/pull/1495)) ([#1496](https://github.com/joinworth/integration-service/pull/1496)) 🚂 release/v0.48.0

### 🐛 Bug

**[BEST-92](https://worth-ai.atlassian.net/browse/BEST-92) - Registry data does not appear to be populating from Open Corporates**

- 🚜🚀 OC Redshift Query Fix #LIVE #REGULAR (Original PR: [#1493](https://github.com/joinworth/integration-service/pull/1493)) ([#1497](https://github.com/joinworth/integration-service/pull/1497)) 🚂 release/v0.48.0

**[DOS-706](https://worth-ai.atlassian.net/browse/DOS-706) - No title available**

- 🚜🚀 fix NPI not found in edit application #LIVE #REGULAR (Original PR: [#1472](https://github.com/joinworth/integration-service/pull/1472)) ([#1487](https://github.com/joinworth/integration-service/pull/1487)) 🚂 release/v0.48.0

### ✨ Enhancement

**[DOS-445](https://worth-ai.atlassian.net/browse/DOS-445) - Return Verdata NPI results**

- 🚜🚀 Added API to return an array of doctors from verdata integration #LIVE #REGULAR (Original PR: [#1415](https://github.com/joinworth/integration-service/pull/1415)) ([#1488](https://github.com/joinworth/integration-service/pull/1488)) 🚂 release/v0.48.0
- 🚜🚀🚩 Wrapped VERDATA doctors API under feature flag #LIVE #FLAG #REGULAR (Original PR: [#1428](https://github.com/joinworth/integration-service/pull/1428)) ([#1489](https://github.com/joinworth/integration-service/pull/1489)) 🚂 release/v0.48.0
- 🚜🚀🚩 Fix ticket number mistake with feature flag #LIVE #FLAG #REGULAR (Original PR: [#1458](https://github.com/joinworth/integration-service/pull/1458)) ([#1490](https://github.com/joinworth/integration-service/pull/1490)) 🚂 release/v0.48.0

**[DOS-793](https://worth-ai.atlassian.net/browse/DOS-793) - Add Google Places Options for Address Verification**

- 🚜🚀 #LIVE feat: support google profile address verification badging #REGULAR (Original PR: [#1481](https://github.com/joinworth/integration-service/pull/1481)) ([#1486](https://github.com/joinworth/integration-service/pull/1486)) 🚂 release/v0.48.0

## [v0.48.0-fast-v2.0](https://github.com/joinworth/integration-service/compare/v0.48.3...v0.48.0-fast-v2.0) - 2025-08-22

### 🐛 Bug

**[BEST-92](https://worth-ai.atlassian.net/browse/BEST-92) - Registry data does not appear to be populating from Open Corporates**

- 🔥🚀 OC Redshift Query Fix #LIVE #HOTFIX (Original PR: [#1493](https://github.com/joinworth/integration-service/pull/1493)) ([#1498](https://github.com/joinworth/integration-service/pull/1498)) 🚂 release/v0.48.0-fast-v2.0

## [v0.48.3](https://github.com/joinworth/integration-service/compare/v0.48.0-fast-v1.3...v0.48.3) - 2025-08-19

### 🧰 Task

**[INFRA-212](https://worth-ai.atlassian.net/browse/INFRA-212) - Add release date in changelogs in release notes action**

- 🚜🚀 #LIVE ADD RELEASE DATE #REGULAR (Original PR: #1447) ([#1460](https://github.com/joinworth/integration-service/pull/1460)) 🚂 release/v0.48.0

### 🐛 Bug

**[BEST-43](https://worth-ai.atlassian.net/browse/BEST-43) - [REPAY] Website creation date and expiration date are missing from case management and 360**

- 🚜🚀 #LIVE fix website scanning bugs #REGULAR (Original PR: #1445) ([#1459](https://github.com/joinworth/integration-service/pull/1459)) 🚂 release/v0.48.0

**[DOS-801](https://worth-ai.atlassian.net/browse/DOS-801) - [FAST TRACK] 360 report field enhancements pt. 2**

- 🚜🚀 #LIVE fix: report enhancements pt. 2 #REGULAR (Original PR: #1449) ([#1453](https://github.com/joinworth/integration-service/pull/1453)) 🚂 release/v0.48.0

**[DOS-810](https://worth-ai.atlassian.net/browse/DOS-810) - [FAST TRACK] Google Profile Website Issue**

- 🚜🚀 #LIVE fix: 360 report and case management UI inconsistencies #REGULAR (Original PR: #1466) ([#1479](https://github.com/joinworth/integration-service/pull/1479)) 🚂 release/v0.48.0

### 🧠 Epic

**[BEST-55](https://worth-ai.atlassian.net/browse/BEST-55) - Platform Stability**

- 🚜🚀 #LIVE Removed Heuristic calls and method #REGULAR (Original PR: #1462) ([#1474](https://github.com/joinworth/integration-service/pull/1474)) 🚂 release/v0.48.0

### ✨ Enhancement

**[BEST-77](https://worth-ai.atlassian.net/browse/BEST-77) - [FAST TRACK] Implement Env Variable + Update Caching from 15 Min to 5 Min**

- 🚜🚀 Fix NaN #LIVE #REGULAR (Original PR: #1464) ([#1468](https://github.com/joinworth/integration-service/pull/1468)) 🚂 release/v0.48.0

**[DOS-784](https://worth-ai.atlassian.net/browse/DOS-784) - 360 Report Generation Issues**

- 🚜🚀 report generation fixes PART 1 #LIVE #REGULAR (Original PR: #1444) ([#1450](https://github.com/joinworth/integration-service/pull/1450)) 🚂 release/v0.48.0

### 📝 Other

**[DOS-738](https://worth-ai.atlassian.net/browse/DOS-738) - No title available**

- 🚜🚀 #LIVE feat: update report handler to use facts #REGULAR (Original PR: #1446) ([#1452](https://github.com/joinworth/integration-service/pull/1452)) 🚂 release/v0.48.0
- 🚜🚀 #LIVE fix: submitted address tweaks for 360 report #REGULAR (Original PR: #1451) ([#1454](https://github.com/joinworth/integration-service/pull/1454)) 🚂 release/v0.48.0

- ⚡🚜🚀 Temporarily comment out log statement #NO_JIRA #LIVE #FAST 🚂 release/v0.48.0 #REGULAR (Original PR: #1473) ([#1476](https://github.com/joinworth/integration-service/pull/1476))

## [v0.48.0-fast-v1.3](https://github.com/joinworth/integration-service/compare/v0.48.0-fast-v1.2...v0.48.0-fast-v1.3) - 2025-08-18

### 📝 Other

- ⚡🚜🚀 Temporarily comment out log statement #NO_JIRA #LIVE #FAST 🚂 release/v0.48.0-fast-v1.2 #REGULAR (Original PR: #1473) ([#1475](https://github.com/joinworth/integration-service/pull/1475))

## [v0.48.0-fast-v1.2](https://github.com/joinworth/integration-service/compare/v0.48.0-fast-v1.0...v0.48.0-fast-v1.2) - 2025-08-15

### ✨ Enhancement

**[BEST-77](https://worth-ai.atlassian.net/browse/BEST-77) - [FAST TRACK] Implement Env Variable + Update Caching from 15 Min to 5 Min**

- 🚜🚀 Fix NaN #LIVE #REGULAR (Original PR: #1464) ([#1467](https://github.com/joinworth/integration-service/pull/1467)) 🚂 release/v0.48.0-fast-v1.1

### 📝 Other

- 📝 Update env.config.js

## [v0.48.0-fast-v1.0](https://github.com/joinworth/integration-service/compare/v0.47.5...v0.48.0-fast-v1.0) - 2025-08-14

### 🐛 Bug

**[DOS-801](https://worth-ai.atlassian.net/browse/DOS-801) - [FAST TRACK] 360 report field enhancements pt. 2**

- ⚡🚀 #LIVE fix: report enhancements pt. 2 #FAST (Original PR: #1449) ([#1456](https://github.com/joinworth/integration-service/pull/1456)) 🚂 release/v0.48.0-fast-v1

### 📝 Other

**[DOS-738](https://worth-ai.atlassian.net/browse/DOS-738) - No title available**

- ⚡🚀 #LIVE feat: update report handler to use facts #FAST (Original PR: #1446) ([#1455](https://github.com/joinworth/integration-service/pull/1455)) 🚂 release/v0.48.0-fast-v1
- ⚡🚀 #LIVE fix: submitted address tweaks for 360 report #FAST (Original PR: #1451) ([#1457](https://github.com/joinworth/integration-service/pull/1457)) 🚂 release/v0.48.0-fast-v1

## [v0.47.5](https://github.com/joinworth/integration-service/compare/v0.47.4...v0.47.5) - 2025-08-12

### 📖 Story

**[BEST-9](https://worth-ai.atlassian.net/browse/BEST-9) - Website - Platform**

- 🚜🚀 AI website data implementation #LIVE #REGULAR (Original PR: #1385) ([#1434](https://github.com/joinworth/integration-service/pull/1434)) 🚂 release/v0.47.0
- 🚜🚀 Add domain and ai website into website data API #LIVE #REGULAR (Original PR: #1409) ([#1435](https://github.com/joinworth/integration-service/pull/1435)) 🚂 release/v0.47.0

### 🐛 Bug

**[BEST-13](https://worth-ai.atlassian.net/browse/BEST-13) - [PLATFORM][Payroc Hypercare] Corporate Officers Section Displays Empty Despite API Returning People Data**

- 🚜🚀 #LIVE adjust sos_filings & people kyb #REGULAR (Original PR: #1416) ([#1443](https://github.com/joinworth/integration-service/pull/1443)) 🚂 release/v0.47.0

**[DOS-749](https://worth-ai.atlassian.net/browse/DOS-749) - Vantage Score Fetching and Display Issues with Equifax Setting**

- 🚜🚀 FIX: Vantage score fetching and display issues #LIVE #REGULAR (Original PR: #1391) ([#1429](https://github.com/joinworth/integration-service/pull/1429)) 🚂 release/v0.47.0
- 🚜🚀 FIX: Vantage score fetching and display issues #LIVE #REGULAR (Original PR: #1397) ([#1430](https://github.com/joinworth/integration-service/pull/1430)) 🚂 release/v0.47.0
- 🚜🚀 FIX: Vantage score fetching and display issues #LIVE #REGULAR (Original PR: #1417) ([#1431](https://github.com/joinworth/integration-service/pull/1431)) 🚂 release/v0.47.0

### ✨ Enhancement

**[DOS-753](https://worth-ai.atlassian.net/browse/DOS-753) - Utilize BJL Facts in 360 Reports**

- 🚜🚀 FEAT: Utilize BJL data from facts #LIVE #REGULAR (Original PR: #1410) ([#1432](https://github.com/joinworth/integration-service/pull/1432)) 🚂 release/v0.47.0
- 🚜🚀 FEAT: Utilize BJL data from facts #LIVE #REGULAR (Original PR: #1418) ([#1433](https://github.com/joinworth/integration-service/pull/1433)) 🚂 release/v0.47.0

**[PAT-603](https://worth-ai.atlassian.net/browse/PAT-603) - [KYB Tab] [BE+FE] Add Facts to New Fields**

- 🚜🚀 #LIVE fix: Fixes some zoominfo source revenue fact issues #REGULAR (Original PR: #1371) ([#1441](https://github.com/joinworth/integration-service/pull/1441)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE fix: Fixes some financial facts issues #REGULAR (Original PR: #1382) ([#1442](https://github.com/joinworth/integration-service/pull/1442)) 🚂 release/v0.47.0

### 💻 Tech Task

**[BEST-40](https://worth-ai.atlassian.net/browse/BEST-40) - Update Extended Endpoint to include OC data**

- 🚜🚀 #LIVE Add officer addresses from open corporates to returned data and facts #REGULAR (Original PR: #1399) ([#1438](https://github.com/joinworth/integration-service/pull/1438)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE Add OC fields to business extended data #REGULAR (Original PR: #1408) ([#1439](https://github.com/joinworth/integration-service/pull/1439)) 🚂 release/v0.47.0

**[PAT-674](https://worth-ai.atlassian.net/browse/PAT-674) - SOC-II Vulnerabilities (Lambdas)**

- 🚜🚀 #LIVE Build(deps): Bump form-data from 2.5.3 to 2.5.5 #REGULAR (Original PR: #1393) ([#1436](https://github.com/joinworth/integration-service/pull/1436)) 🚂 release/v0.47.0
- 🚀 #LIVE Build(deps): Bump form-data from 2.5.5 to 4.0.4 ([#1395](https://github.com/joinworth/integration-service/pull/1395))

### 📝 Other

**[BEST-6](https://worth-ai.atlassian.net/browse/BEST-6) - No title available**

- 🚜🚀 #LIVE Equifax BJL Fixes #REGULAR (Original PR: #1389) ([#1440](https://github.com/joinworth/integration-service/pull/1440)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE More BLJ facts fixes #REGULAR (Original PR: #1398) ([#1427](https://github.com/joinworth/integration-service/pull/1427)) 🚂 release/v0.47.0

**[INFRA-155](https://worth-ai.atlassian.net/browse/INFRA-155) - No title available**

- 🚜🚀 #LIVE Add GitHub Action to generate release notes #REGULAR (Original PR: #1056) ([#1420](https://github.com/joinworth/integration-service/pull/1420)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE ADD CHANGELOG #REGULAR (Original PR: #1413) ([#1421](https://github.com/joinworth/integration-service/pull/1421)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE Update merge PR logic #REGULAR (Original PR: #1422) ([#1423](https://github.com/joinworth/integration-service/pull/1423)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE UPDATE JIRA API LOGIC #REGULAR (Original PR: #1424) ([#1426](https://github.com/joinworth/integration-service/pull/1426)) 🚂 release/v0.47.0

- 📝 Fix: package json
- 📝 Merge branch 'release/v0.47.0' of github.com:joinworth/integration-service into release/v0.47.0

**[PLAT-6](https://worth-ai.atlassian.net/browse/PLAT-6) - No title available**

- 🚜🚀 #LIVE Handle BJL facts #REGULAR (Original PR: #1356) ([#1437](https://github.com/joinworth/integration-service/pull/1437)) 🚂 release/v0.47.0

## [v0.47.4](https://github.com/joinworth/integration-service/compare/v0.47.0-fast-v1.1...v0.47.4) - 2025-08-04

### 🐛 Bug

**[DOS-775](https://worth-ai.atlassian.net/browse/DOS-775) - [FAST TRACK] Update Giact to use Business Address vs. Control Person Address**

- 🚜🚀 #LIVE: GIACT payload now defaults to BusinessEntity over PersonEntity #REGULAR (Original PR: #1405) ([#1411](https://github.com/joinworth/integration-service/pull/1411)) 🚂 release/v0.47.0

### ✨ Enhancement

**[DOS-751](https://worth-ai.atlassian.net/browse/DOS-751) - [BE] Utilize and Surface Google Place Fields from SERP**

- 🚜🚀 Expose SERP response in API and Kafka producer #LIVE #REGULAR (Original PR: #1368) ([#1402](https://github.com/joinworth/integration-service/pull/1402)) 🚂 release/v0.47.0
- 🚜🚀 Fixed Google Profile Data Kafka Producer issue for potential business matches #LIVE #REGULAR (Original PR: #1394) ([#1403](https://github.com/joinworth/integration-service/pull/1403)) 🚂 release/v0.47.0

**[DOS-762](https://worth-ai.atlassian.net/browse/DOS-762) - [FAST TRACK] Empty State Standardization in Worth 360 Report**

- 🚜🚀 #LIVE Standardize empty data for reports #REGULAR (Original PR: #1390) ([#1404](https://github.com/joinworth/integration-service/pull/1404)) 🚂 release/v0.47.0

**[PAT-607](https://worth-ai.atlassian.net/browse/PAT-607) - Support New Banking + Accounting Uploads**

- 🚜🚀 Docs Tab Update #LIVE #REGULAR (Original PR: #1392) ([#1400](https://github.com/joinworth/integration-service/pull/1400)) 🚂 release/v0.47.0

### 📝 Other

**[DOS-747](https://worth-ai.atlassian.net/browse/DOS-747) - No title available**

- 🚜🚀 #LIVE fix: Fixes null corporation fact for zoominfo source #REGULAR (Original PR: #1329) ([#1401](https://github.com/joinworth/integration-service/pull/1401)) 🚂 release/v0.47.0

## [v0.47.0-fast-v1.0](https://github.com//joinworth/integration-service/compare/v0.47.0...v0.47.0-fast-v1.0) - 2025-08-01

### ✨ Enhancement

**[DOS-762](https://worth-ai.atlassian.net/browse/DOS-762) - [FAST TRACK] Empty State Standardization in Worth 360 Report**

- 🚜🚀 #LIVE Standardize empty data for reports #REGULAR (Original PR: [#1390](https://github.com/joinworth/integration-service/pull/1390)) ([#1406](https://github.com/joinworth/integration-service/pull/1406)) 🚂 release/v0.47.0-fast-v1

## [v0.47.0](https://github.com//joinworth/integration-service/compare/v0.46.5...v0.47.0) - 2025-07-29

### ✨ Enhancement

**[PAT-634](https://worth-ai.atlassian.net/browse/PAT-634) - [FAST TRACK] Support UK Businesses in Case Management**

- 🚜🚀 #LIVE fix: facts route adding fallback for CAN/UK #REGULAR (Original PR: [#1369](https://github.com/joinworth/integration-service/pull/1369)) ([#1386](https://github.com/joinworth/integration-service/pull/1386)) 🚂 release/v0.47.0
- 🚜🚀 #LIVE feat: uk country in facts #REGULAR (Original PR: [#1379](https://github.com/joinworth/integration-service/pull/1379)) ([#1387](https://github.com/joinworth/integration-service/pull/1387)) 🚂 release/v0.47.0

## [v0.46.5](https://github.com//joinworth/integration-service/compare/v0.46.0-fast-v2.1...v0.46.5) - 2025-07-28

### 📖 Story

**[DOS-343](https://worth-ai.atlassian.net/browse/DOS-343) - [FE+BE] Enable Document Uploads During Onboarding (Uploads)**

- 🚜🚀 FEAT: Enable documents upload for banking and accounting #LIVE #REGULAR (Original PR: [#1300](https://github.com/joinworth/integration-service/pull/1300)) ([#1360](https://github.com/joinworth/integration-service/pull/1360)) 🚂 release/v0.46.0
- 🚜🚀 FEAT: Enable documents upload for banking accounting #LIVE #REGULAR (Original PR: [#1321](https://github.com/joinworth/integration-service/pull/1321)) ([#1361](https://github.com/joinworth/integration-service/pull/1361)) 🚂 release/v0.46.0
- 🚜🚀 FEAT: Enable documents upload for banking accounting #LIVE #REGULAR (Original PR: [#1324](https://github.com/joinworth/integration-service/pull/1324)) ([#1362](https://github.com/joinworth/integration-service/pull/1362)) 🚂 release/v0.46.0

**[DOS-344](https://worth-ai.atlassian.net/browse/DOS-344) - [FE+BE] Enable Document Uploads During Onboarding (Downloads)**

- 🚜🚀 FEAT: Enable Document Uploads During Onboarding (Downloads) #LIVE #REGULAR (Original PR: [#1335](https://github.com/joinworth/integration-service/pull/1335)) ([#1366](https://github.com/joinworth/integration-service/pull/1366)) 🚂 release/v0.46.0

**[DOS-687](https://worth-ai.atlassian.net/browse/DOS-687) - [Case Details Page] Highlight internally provided fields follow up**

- 🚜🚀 #LIVE fix: populate document file in tax filing response #REGULAR (Original PR: [#1340](https://github.com/joinworth/integration-service/pull/1340)) ([#1365](https://github.com/joinworth/integration-service/pull/1365)) 🚂 release/v0.46.0

**[FOTC-12](https://worth-ai.atlassian.net/browse/FOTC-12) - Endpoint /saml/acs (POST)**

- 🚜🚩 #FLAG feat: Added new sso pool to verify cognito #REGULAR (Original PR: [#1323](https://github.com/joinworth/integration-service/pull/1323)) ([#1354](https://github.com/joinworth/integration-service/pull/1354)) 🚂 release/v0.46.0
- 🚜🚩 #FLAG feat: Added new sso pool to verify cognito #REGULAR (Original PR: [#1342](https://github.com/joinworth/integration-service/pull/1342)) ([#1355](https://github.com/joinworth/integration-service/pull/1355)) 🚂 release/v0.46.0

**[FOTC-53](https://worth-ai.atlassian.net/browse/FOTC-53) - SSO Dedicated Pool revert**

- 🚜🚀🚩 #LIVE fix: Revert "#FLAG feat: Added new sso pool to verify cognito (#13… #REGULAR (Original PR: [#1383](https://github.com/joinworth/integration-service/pull/1383)) ([#1384](https://github.com/joinworth/integration-service/pull/1384)) 🚂 release/v0.46.0

### 🧰 Task

**[INFRA-185](https://worth-ai.atlassian.net/browse/INFRA-185) - Add wait after PR creation in dev/qa pipelines**

- 🚜🚀 #LIVE Add wait after PR creation #REGULAR (Original PR: [#1312](https://github.com/joinworth/integration-service/pull/1312)) ([#1367](https://github.com/joinworth/integration-service/pull/1367)) 🚂 release/v0.46.0

**[INFRA-202](https://worth-ai.atlassian.net/browse/INFRA-202) - No title available**

- 🚜🚀 #LIVE Update PR title action to show error in comment #REGULAR (Original PR: [#1334](https://github.com/joinworth/integration-service/pull/1334)) ([#1339](https://github.com/joinworth/integration-service/pull/1339)) 🚂 release/v0.46.0

### 🐛 Bug

**[DOS-612](https://worth-ai.atlassian.net/browse/DOS-612) - [Taxes Tab] Functionality Incomplete**

- 🚜🚀 Taxes Tab Missing Fields #LIVE #REGULAR (Original PR: [#1278](https://github.com/joinworth/integration-service/pull/1278)) ([#1357](https://github.com/joinworth/integration-service/pull/1357)) 🚂 release/v0.46.0
- 🚜🚀 Missing fields bug fix #LIVE #REGULAR (Original PR: [#1282](https://github.com/joinworth/integration-service/pull/1282)) ([#1358](https://github.com/joinworth/integration-service/pull/1358)) 🚂 release/v0.46.0

**[DOS-669](https://worth-ai.atlassian.net/browse/DOS-669) - [FE+BE][KYC Tab] Send Plaid Full SSN + Add Missing Fields**

- 🚜🚀 send full ssn and add risk behavior fields #LIVE #REGULAR (Original PR: [#1336](https://github.com/joinworth/integration-service/pull/1336)) ([#1347](https://github.com/joinworth/integration-service/pull/1347)) 🚂 release/v0.46.0

**[DOS-698](https://worth-ai.atlassian.net/browse/DOS-698) - Middesk website is not pulling through**

- 🚜🚀 #LIVE Website Scan Cleanup & Middesk Fix #REGULAR (Original PR: [#1283](https://github.com/joinworth/integration-service/pull/1283)) ([#1351](https://github.com/joinworth/integration-service/pull/1351)) 🚂 release/v0.46.0
- 🚜🚩 #FLAG website scan cleanup #REGULAR (Original PR: [#1313](https://github.com/joinworth/integration-service/pull/1313)) ([#1352](https://github.com/joinworth/integration-service/pull/1352)) 🚂 release/v0.46.0
- 🚜🚀 #LIVE Fix serp scrape review db insert #REGULAR (Original PR: [#1337](https://github.com/joinworth/integration-service/pull/1337)) ([#1353](https://github.com/joinworth/integration-service/pull/1353)) 🚂 release/v0.46.0

**[DOS-754](https://worth-ai.atlassian.net/browse/DOS-754) - [BE] Titles attributes in KYB facts causing 404s in Case Management 2.0**

- ⚡🚜🚀 #LIVE #FAST fix: Fix inconsistent facts kyb people response #REGULAR (Original PR: [#1341](https://github.com/joinworth/integration-service/pull/1341)) ([#1345](https://github.com/joinworth/integration-service/pull/1345)) 🚂 release/v0.46.0

### ✨ Enhancement

**[DOS-636](https://worth-ai.atlassian.net/browse/DOS-636) - Add an endpoint for extended data**

- 🚜🚀 #LIVE extended data endpoint #REGULAR (Original PR: [#1346](https://github.com/joinworth/integration-service/pull/1346)) ([#1370](https://github.com/joinworth/integration-service/pull/1370)) 🚂 release/v0.46.0

**[PAT-510](https://worth-ai.atlassian.net/browse/PAT-510) - [FE+BE] Support Manual Banking Information and Verification**

- 🚜🚀 #LIVE Allow Applicants to Add Manual Banking #REGULAR (Original PR: [#1273](https://github.com/joinworth/integration-service/pull/1273)) ([#1359](https://github.com/joinworth/integration-service/pull/1359)) 🚂 release/v0.46.0
- 🚜🚀 FIX: MINOR BUG FIXES #LIVE #REGULAR (Original PR: [#1325](https://github.com/joinworth/integration-service/pull/1325)) ([#1363](https://github.com/joinworth/integration-service/pull/1363)) 🚂 release/v0.46.0
- 🚜🚀 FIX: MINOR BUG FIXES #LIVE #REGULAR (Original PR: [#1343](https://github.com/joinworth/integration-service/pull/1343)) ([#1364](https://github.com/joinworth/integration-service/pull/1364)) 🚂 release/v0.46.0

## [v0.46.0-fast-v2.1](https://github.com//joinworth/integration-service/compare/v0.46.0-fast-v2.0...v0.46.0-fast-v2.1) - 2025-07-25

### 📖 Story

**[DOS-343](https://worth-ai.atlassian.net/browse/DOS-343) - [FE+BE] Enable Document Uploads During Onboarding (Uploads)**

- 🚜🚀 FEAT: Enable documents upload for banking and accounting #LIVE #REGULAR (Original PR: [#1300](https://github.com/joinworth/integration-service/pull/1300)) ([#1373](https://github.com/joinworth/integration-service/pull/1373)) 🚂 release/v0.46.0-fast-v2
- 🚜🚀 FEAT: Enable documents upload for banking accounting #LIVE #REGULAR (Original PR: [#1321](https://github.com/joinworth/integration-service/pull/1321)) ([#1374](https://github.com/joinworth/integration-service/pull/1374)) 🚂 release/v0.46.0-fast-v2
- 🚜🚀 FEAT: Enable documents upload for banking accounting #LIVE #REGULAR (Original PR: [#1324](https://github.com/joinworth/integration-service/pull/1324)) ([#1375](https://github.com/joinworth/integration-service/pull/1375)) 🚂 release/v0.46.0-fast-v2

**[DOS-344](https://worth-ai.atlassian.net/browse/DOS-344) - [FE+BE] Enable Document Uploads During Onboarding (Downloads)**

- 🚜🚀 FEAT: Enable Document Uploads During Onboarding (Downloads) #LIVE #REGULAR (Original PR: [#1335](https://github.com/joinworth/integration-service/pull/1335)) ([#1378](https://github.com/joinworth/integration-service/pull/1378)) 🚂 release/v0.46.0-fast-v2

### ✨ Enhancement

**[PAT-510](https://worth-ai.atlassian.net/browse/PAT-510) - [FE+BE] Support Manual Banking Information and Verification**

- 🚜🚀 #LIVE Allow Applicants to Add Manual Banking #REGULAR (Original PR: [#1273](https://github.com/joinworth/integration-service/pull/1273)) ([#1372](https://github.com/joinworth/integration-service/pull/1372)) 🚂 release/v0.46.0-fast-v2
- 🚜🚀 FIX: MINOR BUG FIXES #LIVE #REGULAR (Original PR: [#1325](https://github.com/joinworth/integration-service/pull/1325)) ([#1376](https://github.com/joinworth/integration-service/pull/1376)) 🚂 release/v0.46.0-fast-v2
- 🚜🚀 FIX: MINOR BUG FIXES #LIVE #REGULAR (Original PR: [#1343](https://github.com/joinworth/integration-service/pull/1343)) ([#1377](https://github.com/joinworth/integration-service/pull/1377)) 🚂 release/v0.46.0-fast-v2

## [v0.46.0-fast-v2.0](https://github.com//joinworth/integration-service/compare/v0.46.2...v0.46.0-fast-v2.0) - 2025-07-23

### 🐛 Bug

**[DOS-754](https://worth-ai.atlassian.net/browse/DOS-754) - [BE] Titles attributes in KYB facts causing 404s in Case Management 2.0**

- ⚡🚜🚀 #LIVE #FAST fix: Fix inconsistent facts kyb people response #REGULAR (Original PR: [#1341](https://github.com/joinworth/integration-service/pull/1341)) ([#1344](https://github.com/joinworth/integration-service/pull/1344)) 🚂 release/v0.46.0-fast-v2

## [v0.46.2](https://github.com//joinworth/integration-service/compare/v0.45.7...v0.46.2) - 2025-07-21

### 🐛 Bug

**[DOS-732](https://worth-ai.atlassian.net/browse/DOS-732) - Unmask TINs in Case Management 2.0 + Facts API Responses**

- ⚡🚀 #LIVE #FAST fix type build error ([#1328](https://github.com/joinworth/integration-service/pull/1328))
- ⚡🚀 #LIVE #FAST update businessLookupHelper.ts to match main ([#1327](https://github.com/joinworth/integration-service/pull/1327))

**[DOS-733](https://worth-ai.atlassian.net/browse/DOS-733) - [HOTFIX] Vantage Score Running While Equifax Feature is Off**

- 🔥🚜🚀 FIX: Vantage score running even when Equifax feature is off #LIVE #HOTFIX #REGULAR (Original PR: [#1322](https://github.com/joinworth/integration-service/pull/1322)) ([#1331](https://github.com/joinworth/integration-service/pull/1331)) 🚂 release/v0.46.0
- 🔥🚜🚀 FIX: Vantage score running even when Equifax feature is off #LIVE #HOTFIX #REGULAR (Original PR: [#1326](https://github.com/joinworth/integration-service/pull/1326)) ([#1332](https://github.com/joinworth/integration-service/pull/1332)) 🚂 release/v0.46.0
- 🔥🚜🚀 FIX: Vantage score running even when Equifax feature is off #LIVE #HOTFIX #REGULAR (Original PR: [#1330](https://github.com/joinworth/integration-service/pull/1330)) ([#1333](https://github.com/joinworth/integration-service/pull/1333)) 🚂 release/v0.46.0

## [v0.45.7](https://github.com//joinworth/integration-service/compare/v0.45.0-fast-v2.1...v0.45.7) - 2025-07-15

### 📖 Story

**[PAT-324](https://worth-ai.atlassian.net/browse/PAT-324) - [FE+BE] Disable Middesk and Verdata Per Customer**

- 🚜🚀 #LIVE disable integrations #REGULAR (Original PR: [#1302](https://github.com/joinworth/integration-service/pull/1302)) ([#1304](https://github.com/joinworth/integration-service/pull/1304)) 🚂 release/v0.45.0

### 🧰 Task

**[INFRA-179](https://worth-ai.atlassian.net/browse/INFRA-179) - Update cherry-pick PR action inclue as hotfix/fast/regular in cherry-pick label**

- 🚜🚀 #LIVE UPDATE CHERRY-PICK ACTION TO INCLUDE AS HOTFIX/FAST/REGULAR IN LABEL #REGULAR (Original PR: [#1289](https://github.com/joinworth/integration-service/pull/1289)) ([#1308](https://github.com/joinworth/integration-service/pull/1308)) 🚂 release/v0.45.0

### 🐛 Bug

**[DOS-626](https://worth-ai.atlassian.net/browse/DOS-626) - [KYB Tab] [BE+FE] Add Facts to Existing Fields**

- 🚜🚀 #LIVE feat: Unmask TIN #REGULAR (Original PR: [#1301](https://github.com/joinworth/integration-service/pull/1301)) ([#1310](https://github.com/joinworth/integration-service/pull/1310)) 🚂 release/v0.45.0

**[DOS-680](https://worth-ai.atlassian.net/browse/DOS-680) - [360 Report] Fix Ownership IDV & Badging Logic on 360 reports**

- 🚜🚀 Resolved incorrect badging and text in 360 report for Ownership IDV #LIVE #REGULAR (Original PR: [#1290](https://github.com/joinworth/integration-service/pull/1290)) ([#1303](https://github.com/joinworth/integration-service/pull/1303)) 🚂 release/v0.45.0

### ✨ Enhancement

**[DOS-636](https://worth-ai.atlassian.net/browse/DOS-636) - Add an endpoint for extended data**

- 🚜🚀 #LIVE extended data endpoint #REGULAR (Original PR: [#1316](https://github.com/joinworth/integration-service/pull/1316)) ([#1317](https://github.com/joinworth/integration-service/pull/1317)) 🚂 release/v0.45.0

### 💻 Tech Task

**[DOS-579](https://worth-ai.atlassian.net/browse/DOS-579) - Handle Score Properly in Task Generation**

- 🚜🚀 SCORE PREPARE TASK FIXING #LIVE #REGULAR (Original PR: [#1263](https://github.com/joinworth/integration-service/pull/1263)) ([#1305](https://github.com/joinworth/integration-service/pull/1305)) 🚂 release/v0.45.0
- 🚜🚀 Revenue Issue Not get in Score generation #LIVE #REGULAR (Original PR: [#1288](https://github.com/joinworth/integration-service/pull/1288)) ([#1306](https://github.com/joinworth/integration-service/pull/1306)) 🚂 release/v0.45.0
- 🚜🚀 Manual Score refresh logic fix and Prepare Integration Data #LIVE #REGULAR (Original PR: [#1293](https://github.com/joinworth/integration-service/pull/1293)) ([#1307](https://github.com/joinworth/integration-service/pull/1307)) 🚂 release/v0.45.0

## [v0.45.0-fast-v2.1](https://github.com//joinworth/integration-service/compare/v0.45.0-fast-v2.0...v0.45.0-fast-v2.1) - 2025-07-15

### ✨ Enhancement

**[DOS-636](https://worth-ai.atlassian.net/browse/DOS-636) - Add an endpoint for extended data**

- 🚜🚀 #LIVE extended data endpoint #REGULAR (Original PR: [#1316](https://github.com/joinworth/integration-service/pull/1316)) ([#1318](https://github.com/joinworth/integration-service/pull/1318)) 🚂 release/v0.45.0-fast-v2

## [v0.45.0-fast-v2.0](https://github.com//joinworth/integration-service/compare/v0.45.0-case-v1.0...v0.45.0-fast-v2.0) - 2025-07-11

### 🐛 Bug

**[DOS-680](https://worth-ai.atlassian.net/browse/DOS-680) - [360 Report] Fix Ownership IDV & Badging Logic on 360 reports**

- 🚜🚀 Resolved incorrect badging and text in 360 report for Ownership IDV #LIVE #REGULAR (Original PR: [#1290](https://github.com/joinworth/integration-service/pull/1290)) ([#1311](https://github.com/joinworth/integration-service/pull/1311)) 🚂 release/v0.45.0-fast-v2

## [v0.45.0-case-v1.0](https://github.com//joinworth/integration-service/compare/v0.45.4...v0.45.0-case-v1.0) - 2025-07-10

### 🐛 Bug

**[DOS-626](https://worth-ai.atlassian.net/browse/DOS-626) - [KYB Tab] [BE+FE] Add Facts to Existing Fields**

- 🚜🚀 #LIVE feat: Unmask TIN #REGULAR (Original PR: [#1301](https://github.com/joinworth/integration-service/pull/1301)) ([#1309](https://github.com/joinworth/integration-service/pull/1309)) 🚂 release/v0.45.0-case-v1

## [v0.45.4](https://github.com//joinworth/integration-service/compare/v0.45.0-fast-v1.0...v0.45.4) - 2025-07-08

### 📖 Story

**[DOS-645](https://worth-ai.atlassian.net/browse/DOS-645) - [FE+BE] Display "Not Verified - IDV Disabled" When IDV Is disabled**

- 🚜🚀 FEAT: Display not verified badge when IDV is not attempted #LIVE #REGULAR (Original PR: [#1264](https://github.com/joinworth/integration-service/pull/1264)) ([#1275](https://github.com/joinworth/integration-service/pull/1275)) 🚂 release/v0.45.0

**[PAT-310](https://worth-ai.atlassian.net/browse/PAT-310) - [BE] [PLACEHOLDER] As a Worth Admin, I should be able to see debug information on tasks and integration data for a business**

- 🚜🚀 #LIVE Add Function to Get Integration Information #REGULAR (Original PR: [#1158](https://github.com/joinworth/integration-service/pull/1158)) ([#1281](https://github.com/joinworth/integration-service/pull/1281)) 🚂 release/v0.45.0

### 🧰 Task

**[INFRA-178](https://worth-ai.atlassian.net/browse/INFRA-178) - Add Pre-commit Hook to Validate .env.example Consistency**

- 🚜🚀 #LIVE Add Pre-commit Hook to Validate .env.example Consistency #REGULAR (Original PR: [#1286](https://github.com/joinworth/integration-service/pull/1286)) ([#1287](https://github.com/joinworth/integration-service/pull/1287)) 🚂 release/v0.45.0

**[SEC-150](https://worth-ai.atlassian.net/browse/SEC-150) - [Vanta] Remediate "High vulnerabilities identified in packages are addressed (GitHub Repo)"**

- 🚜🚀 #LIVE fix multer version vulnerability #REGULAR (Original PR: [#1063](https://github.com/joinworth/integration-service/pull/1063)) ([#1294](https://github.com/joinworth/integration-service/pull/1294)) 🚂 release/v0.45.0

### 🐛 Bug

**[DOS-641](https://worth-ai.atlassian.net/browse/DOS-641) - [BE] TIN Retrieved Without Applicant Input or Confirmation – Accuracy and Review Concern**

- 🚜🚀 Removed Verdata as the source for TIN data in KYB Facts API #LIVE #REGULAR (Original PR: [#1272](https://github.com/joinworth/integration-service/pull/1272)) ([#1295](https://github.com/joinworth/integration-service/pull/1295)) 🚂 release/v0.45.0

**[DOS-642](https://worth-ai.atlassian.net/browse/DOS-642) - [BE] Liens listed as "900" in the public filings tab**

- 🚜🚀 Fix bug storing lien count greater than 99 in DB due to EFX #LIVE #REGULAR (Original PR: [#1261](https://github.com/joinworth/integration-service/pull/1261)) ([#1296](https://github.com/joinworth/integration-service/pull/1296)) 🚂 release/v0.45.0

**[PAT-265](https://worth-ai.atlassian.net/browse/PAT-265) - [BE] Unable to export businesses from Worth Admin**

- 🚜🚀 #LIVE Export-Businesses #REGULAR (Original PR: [#1221](https://github.com/joinworth/integration-service/pull/1221)) ([#1279](https://github.com/joinworth/integration-service/pull/1279)) 🚂 release/v0.45.0
- 🚜🚀 #LIVE Export-Businesses #REGULAR (Original PR: [#1234](https://github.com/joinworth/integration-service/pull/1234)) ([#1280](https://github.com/joinworth/integration-service/pull/1280)) 🚂 release/v0.45.0

**[PAT-496](https://worth-ai.atlassian.net/browse/PAT-496) - [FE+BE] Inviting a Business After Bulk Uploads/Add Business Causing Control Owner Issues**

- 🚜🚀 #LIVE fix: get processing history issue #REGULAR (Original PR: [#1258](https://github.com/joinworth/integration-service/pull/1258)) ([#1277](https://github.com/joinworth/integration-service/pull/1277)) 🚂 release/v0.45.0

**[PAT-524](https://worth-ai.atlassian.net/browse/PAT-524) - [BE] BJL inconsistencies**

- 🚜🚀 #LIVE fix: marking verdata connection as success if not already #REGULAR (Original PR: [#1276](https://github.com/joinworth/integration-service/pull/1276)) ([#1292](https://github.com/joinworth/integration-service/pull/1292)) 🚂 release/v0.45.0

**[PAT-529](https://worth-ai.atlassian.net/browse/PAT-529) - [FE+BE] Audit Trail Issues in Customer Applicant Edit Flow (Found during PAT-492)**

- 🚜🚀 #LIVE fix: Audit Trail Issues in Customer Applicant Edit Flow #REGULAR (Original PR: [#1262](https://github.com/joinworth/integration-service/pull/1262)) ([#1297](https://github.com/joinworth/integration-service/pull/1297)) 🚂 release/v0.45.0
- 🚜🚀 #LIVE fix: Audit Trail Issues in Customer Applicant Edit Flow #REGULAR (Original PR: [#1291](https://github.com/joinworth/integration-service/pull/1291)) ([#1298](https://github.com/joinworth/integration-service/pull/1298)) 🚂 release/v0.45.0

### ✨ Enhancement

**[DOS-636](https://worth-ai.atlassian.net/browse/DOS-636) - Add an endpoint for extended data**

- ⚡🚩 #FLAG Business Extended Data Endpoint #FAST (Original PR: [#1200](https://github.com/joinworth/integration-service/pull/1200)) ([#1285](https://github.com/joinworth/integration-service/pull/1285)) 🚂 release/v0.45.0

### 🧪 Spike

**[PAT-500](https://worth-ai.atlassian.net/browse/PAT-500) - Verdata Research**

- 🚜🚀 #LIVE fix: updated_at trigger for integrations schema #REGULAR (Original PR: [#1265](https://github.com/joinworth/integration-service/pull/1265)) ([#1274](https://github.com/joinworth/integration-service/pull/1274)) 🚂 release/v0.45.0

## [v0.45.0-fast-v1.0](https://github.com//joinworth/integration-service/compare/v0.45.0...v0.45.0-fast-v1.0) - 2025-07-03

### ✨ Enhancement

**[DOS-636](https://worth-ai.atlassian.net/browse/DOS-636) - Add an endpoint for extended data**

- ⚡🚩 #FLAG Business Extended Data Endpoint #FAST (Original PR: [#1200](https://github.com/joinworth/integration-service/pull/1200)) ([#1284](https://github.com/joinworth/integration-service/pull/1284)) 🚂 release/v0.45.0-fast-v1

## [v0.45.0](https://github.com//joinworth/integration-service/compare/v0.44.5...v0.45.0) - 2025-07-02

### 🧰 Task

**[INFRA-165](https://worth-ai.atlassian.net/browse/INFRA-165) - Create Release Branch Action**

- 🚜🚀 #LIVE Create Release Branch Action #REGULAR (Original PR: [#1268](https://github.com/joinworth/integration-service/pull/1268)) ([#1270](https://github.com/joinworth/integration-service/pull/1270)) 🚂 release/v0.45.0

**[INFRA-177](https://worth-ai.atlassian.net/browse/INFRA-177) - Replace forward slashes with hyphens in Docker image tags in deployment pipeline in service repo**

- 🚜🚀 #LIVE Replace forward slashes with hyphens in Docker image tags #REGULAR (Original PR: [#1256](https://github.com/joinworth/integration-service/pull/1256)) ([#1269](https://github.com/joinworth/integration-service/pull/1269)) 🚂 release/v0.45.0

### 🧪 Spike

**[PAT-500](https://worth-ai.atlassian.net/browse/PAT-500) - Verdata Research**

- 🚜🚀 #LIVE fix: setting environment value fix #REGULAR (Original PR: [#1202](https://github.com/joinworth/integration-service/pull/1202)) ([#1271](https://github.com/joinworth/integration-service/pull/1271)) 🚂 release/v0.45.0

## [v0.44.5](https://github.com//joinworth/integration-service/compare/v0.44.4...v0.44.5) - 2025-07-01

### 🐛 Bug

**[PAT-561](https://worth-ai.atlassian.net/browse/PAT-561) - Unable to upload the Tax Business File**

- 🚜🚀 #LIVE Upload-Issue #REGULAR (Original PR: [#1266](https://github.com/joinworth/integration-service/pull/1266)) ([#1267](https://github.com/joinworth/integration-service/pull/1267)) 🚂 release/v0.44.0

## [v0.44.4](https://github.com//joinworth/integration-service/compare/v0.44.0-fast-v2.1...v0.44.4) - 2025-06-27

### 📖 Story

**[DOS-590](https://worth-ai.atlassian.net/browse/DOS-590) - Increase Applicant email invite timeouts to 72 hours globally**

- 🚜🚀 #LIVE feat: increase VERIFY_EMAIL_TOKEN_LIFE_SECONDS to 72 hours #REGULAR (Original PR: [#1125](https://github.com/joinworth/integration-service/pull/1125)) ([#1214](https://github.com/joinworth/integration-service/pull/1214)) 🚂 release/v0.44.0

**[PAT-538](https://worth-ai.atlassian.net/browse/PAT-538) - Re-scoring a case after application edit**

- 🚜🚀 #LIVE feat: rescore case event #REGULAR (Original PR: [#1212](https://github.com/joinworth/integration-service/pull/1212)) ([#1247](https://github.com/joinworth/integration-service/pull/1247)) 🚂 release/v0.44.0

### 🐛 Bug

**[PAT-515](https://worth-ai.atlassian.net/browse/PAT-515) - [BE] Public Records and Adverse Media Show Old Data After Business Update in Customer Application Edit**

- 🚜🚀 #LIVE fix: Public Records and Adverse Media Show Old Data After Business Update in Customer Application Edit #REGULAR (Original PR: [#1180](https://github.com/joinworth/integration-service/pull/1180)) ([#1226](https://github.com/joinworth/integration-service/pull/1226)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE feat: post application edit integrations data handling #REGULAR (Original PR: [#1220](https://github.com/joinworth/integration-service/pull/1220)) ([#1227](https://github.com/joinworth/integration-service/pull/1227)) 🚂 release/v0.44.0

**[PAT-543](https://worth-ai.atlassian.net/browse/PAT-543) - TIN verified in Middesk but not displayed in case management**

- 🚜🚀 Remove verdata raw for TIN #LIVE #REGULAR (Original PR: [#1224](https://github.com/joinworth/integration-service/pull/1224)) ([#1233](https://github.com/joinworth/integration-service/pull/1233)) 🚂 release/v0.44.0

### 🧠 Epic

**[DOS-529](https://worth-ai.atlassian.net/browse/DOS-529) - Middesk Website Replacement**

- 🚜🚀 #LIVE add website scanning integration id #REGULAR (Original PR: [#1051](https://github.com/joinworth/integration-service/pull/1051)) ([#1257](https://github.com/joinworth/integration-service/pull/1257)) 🚂 release/v0.44.0

### ✨ Enhancement

**[DOS-500](https://worth-ai.atlassian.net/browse/DOS-500) - Revise code and perform possible code changes to reduce CPU consumption**

- 🚜🚀 Logger Refactors, Fix for Cognito Errors, AWS Package Updates #LIVE #REGULAR (Original PR: [#1209](https://github.com/joinworth/integration-service/pull/1209)) ([#1260](https://github.com/joinworth/integration-service/pull/1260)) 🚂 release/v0.44.0
- 🚜🚀 Added indexing to the required tables and implemented code improvements. #LIVE #REGULAR (Original PR: [#1145](https://github.com/joinworth/integration-service/pull/1145)) ([#1216](https://github.com/joinworth/integration-service/pull/1216)) 🚂 release/v0.44.0
- 🚜🚀 Fixed the broken migration from the previous PR. #LIVE #REGULAR (Original PR: [#1149](https://github.com/joinworth/integration-service/pull/1149)) ([#1217](https://github.com/joinworth/integration-service/pull/1217)) 🚂 release/v0.44.0
- 🚜🚀 Typescript Improvement #LIVE #REGULAR (Original PR: [#1150](https://github.com/joinworth/integration-service/pull/1150)) ([#1218](https://github.com/joinworth/integration-service/pull/1218)) 🚂 release/v0.44.0

**[DOS-524](https://worth-ai.atlassian.net/browse/DOS-524) - Skip Collecting SSN**

- 🚜🚀 FEAT: SKIP COLLECTING SSN #LIVE #REGULAR (Original PR: [#1215](https://github.com/joinworth/integration-service/pull/1215)) ([#1251](https://github.com/joinworth/integration-service/pull/1251)) 🚂 release/v0.44.0

**[DOS-525](https://worth-ai.atlassian.net/browse/DOS-525) - [FE+BE] As a user, I expect to be able to skip the credit check for an applicant.**

- 🚜🚀 FEAT: Enable customers to skip credit check for owners of specific businesses via flag #LIVE #REGULAR (Original PR: [#1179](https://github.com/joinworth/integration-service/pull/1179)) ([#1249](https://github.com/joinworth/integration-service/pull/1249)) 🚂 release/v0.44.0
- 🚜🚀 FEAT: Enable customers to skip credit check for owners of specific businesses via flag #LIVE #REGULAR (Original PR: [#1198](https://github.com/joinworth/integration-service/pull/1198)) ([#1250](https://github.com/joinworth/integration-service/pull/1250)) 🚂 release/v0.44.0

**[PAT-492](https://worth-ai.atlassian.net/browse/PAT-492) - [FE+BE] Display + Highlight Fields Edited by Customers in Case Management**

- 🚜🚀 #LIVE feat: customer edit #REGULAR (Original PR: [#1168](https://github.com/joinworth/integration-service/pull/1168)) ([#1219](https://github.com/joinworth/integration-service/pull/1219)) 🚂 release/v0.44.0

### 🧪 Spike

**[DOS-521](https://worth-ai.atlassian.net/browse/DOS-521) - Middesk Website Replacement**

- 🚜🚩 #FLAG Middesk Website Scan Replacement #REGULAR (Original PR: [#1153](https://github.com/joinworth/integration-service/pull/1153)) ([#1259](https://github.com/joinworth/integration-service/pull/1259)) 🚂 release/v0.44.0

### 💻 Tech Task

**[DOS-578](https://worth-ai.atlassian.net/browse/DOS-578) - [BE] Maintain Accurate Owner Creation and Deletion State in Integration Service**

- 🚜🚀 Update Task for Owner #LIVE #REGULAR (Original PR: [#1206](https://github.com/joinworth/integration-service/pull/1206)) ([#1252](https://github.com/joinworth/integration-service/pull/1252)) 🚂 release/v0.44.0
- 🚜🚀 owner task replica #LIVE #REGULAR (Original PR: [#1222](https://github.com/joinworth/integration-service/pull/1222)) ([#1254](https://github.com/joinworth/integration-service/pull/1254)) 🚂 release/v0.44.0

**[TIG-50](https://worth-ai.atlassian.net/browse/TIG-50) - Optional AI Name + Address Scrubbing**

- 🚜🚩 AI Sanitization of names & addresses #FLAG #REGULAR (Original PR: [#1201](https://github.com/joinworth/integration-service/pull/1201)) ([#1230](https://github.com/joinworth/integration-service/pull/1230)) 🚂 release/v0.44.0

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: package lock ([#1255](https://github.com/joinworth/integration-service/pull/1255))

**[PAT-469](https://worth-ai.atlassian.net/browse/PAT-469) - No title available**

- 🚜🚀 #LIVE feat: additional bank accounts #REGULAR (Original PR: [#1205](https://github.com/joinworth/integration-service/pull/1205)) ([#1236](https://github.com/joinworth/integration-service/pull/1236)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE feat: additional account update and giact running #REGULAR (Original PR: [#1207](https://github.com/joinworth/integration-service/pull/1207)) ([#1237](https://github.com/joinworth/integration-service/pull/1237)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: query for additional account #REGULAR (Original PR: [#1210](https://github.com/joinworth/integration-service/pull/1210)) ([#1238](https://github.com/joinworth/integration-service/pull/1238)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: response #REGULAR (Original PR: [#1213](https://github.com/joinworth/integration-service/pull/1213)) ([#1239](https://github.com/joinworth/integration-service/pull/1239)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE feat: delete account by id #REGULAR (Original PR: [#1225](https://github.com/joinworth/integration-service/pull/1225)) ([#1240](https://github.com/joinworth/integration-service/pull/1240)) 🚂 release/v0.44.0

## [v0.44.0-fast-v2.1](https://github.com//joinworth/integration-service/compare/v0.44.0-tiger-v2.1...v0.44.0-fast-v2.1) - 2025-06-26

### 📖 Story

**[PAT-538](https://worth-ai.atlassian.net/browse/PAT-538) - Re-scoring a case after application edit**

- 🚜🚀 #LIVE feat: rescore case event #REGULAR (Original PR: [#1212](https://github.com/joinworth/integration-service/pull/1212)) ([#1248](https://github.com/joinworth/integration-service/pull/1248)) 🚂 release/v0.44.0-fast-v2

### 🐛 Bug

**[PAT-515](https://worth-ai.atlassian.net/browse/PAT-515) - [BE] Public Records and Adverse Media Show Old Data After Business Update in Customer Application Edit**

- 🚜🚀 #LIVE fix: Public Records and Adverse Media Show Old Data After Business Update in Customer Application Edit #REGULAR (Original PR: [#1180](https://github.com/joinworth/integration-service/pull/1180)) ([#1229](https://github.com/joinworth/integration-service/pull/1229)) 🚂 release/v0.44.0-fast-v2
- 🚜🚀 #LIVE feat: post application edit integrations data handling #REGULAR (Original PR: [#1220](https://github.com/joinworth/integration-service/pull/1220)) ([#1232](https://github.com/joinworth/integration-service/pull/1232)) 🚂 release/v0.44.0-fast-v2

**[PAT-543](https://worth-ai.atlassian.net/browse/PAT-543) - TIN verified in Middesk but not displayed in case management**

- 🚜🚀 Remove verdata raw for TIN #LIVE #REGULAR (Original PR: [#1224](https://github.com/joinworth/integration-service/pull/1224)) ([#1242](https://github.com/joinworth/integration-service/pull/1242)) 🚂 release/v0.44.0-fast-v2

### 💻 Tech Task

**[TIG-50](https://worth-ai.atlassian.net/browse/TIG-50) - Optional AI Name + Address Scrubbing**

- 🚜🚩 AI Sanitization of names & addresses #FLAG #REGULAR (Original PR: [#1201](https://github.com/joinworth/integration-service/pull/1201)) ([#1241](https://github.com/joinworth/integration-service/pull/1241)) 🚂 release/v0.44.0-fast-v2

### 📝 Other

**[PAT-469](https://worth-ai.atlassian.net/browse/PAT-469) - No title available**

- 🚜🚀 #LIVE feat: additional bank accounts #REGULAR (Original PR: [#1205](https://github.com/joinworth/integration-service/pull/1205)) ([#1235](https://github.com/joinworth/integration-service/pull/1235)) 🚂 release/v0.44.0-fast-v2
- 🚜🚀 #LIVE feat: additional account update and giact running #REGULAR (Original PR: [#1207](https://github.com/joinworth/integration-service/pull/1207)) ([#1243](https://github.com/joinworth/integration-service/pull/1243)) 🚂 release/v0.44.0-fast-v2
- 🚜🚀 #LIVE fix: query for additional account #REGULAR (Original PR: [#1210](https://github.com/joinworth/integration-service/pull/1210)) ([#1244](https://github.com/joinworth/integration-service/pull/1244)) 🚂 release/v0.44.0-fast-v2
- 🚜🚀 #LIVE fix: response #REGULAR (Original PR: [#1213](https://github.com/joinworth/integration-service/pull/1213)) ([#1245](https://github.com/joinworth/integration-service/pull/1245)) 🚂 release/v0.44.0-fast-v2
- 🚜🚀 #LIVE feat: delete account by id #REGULAR (Original PR: [#1225](https://github.com/joinworth/integration-service/pull/1225)) ([#1246](https://github.com/joinworth/integration-service/pull/1246)) 🚂 release/v0.44.0-fast-v2

## [v0.44.0-tiger-v2.1](https://github.com//joinworth/integration-service/compare/v0.44.0-fast-v2.0...v0.44.0-tiger-v2.1) - 2025-06-25

### 🐛 Bug

**[PAT-543](https://worth-ai.atlassian.net/browse/PAT-543) - TIN verified in Middesk but not displayed in case management**

- 🚜🚀 Remove verdata raw for TIN #LIVE #REGULAR (Original PR: [#1224](https://github.com/joinworth/integration-service/pull/1224)) ([#1231](https://github.com/joinworth/integration-service/pull/1231)) 🚂 release/v0.44.0-tiger-v2

### 💻 Tech Task

**[TIG-50](https://worth-ai.atlassian.net/browse/TIG-50) - Optional AI Name + Address Scrubbing**

- 🚜🚩 AI Sanitization of names & addresses #FLAG #REGULAR (Original PR: [#1201](https://github.com/joinworth/integration-service/pull/1201)) ([#1228](https://github.com/joinworth/integration-service/pull/1228)) 🚂 release/v0.44.0-tiger-v2

## [v0.44.0-fast-v2.0](https://github.com//joinworth/integration-service/compare/v0.44.1...v0.44.0-fast-v2.0) - 2025-06-25

### ✨ Enhancement

**[PAT-492](https://worth-ai.atlassian.net/browse/PAT-492) - [FE+BE] Display + Highlight Fields Edited by Customers in Case Management**

- 🚜🚀 #LIVE feat: customer edit #REGULAR (Original PR: [#1168](https://github.com/joinworth/integration-service/pull/1168)) ([#1223](https://github.com/joinworth/integration-service/pull/1223)) 🚂 release/v0.44.0-fast-v2

## [v0.44.1](https://github.com//joinworth/integration-service/compare/v0.43.4...v0.44.1) - 2025-06-24

### 🧰 Task

**[INFRA-170](https://worth-ai.atlassian.net/browse/INFRA-170) - Add wait-Retry logic in dev/qa action before merging**

- 🚜🚀 #LIVE Wait Retry logic in merging #REGULAR (Original PR: [#1159](https://github.com/joinworth/integration-service/pull/1159)) ([#1197](https://github.com/joinworth/integration-service/pull/1197)) 🚂 release/v0.44.0

**[INFRA-172](https://worth-ai.atlassian.net/browse/INFRA-172) - Add validation in in custom tag step in create-tag action**

- 🚜🚀 #LIVE Add validation for custom tag names in Create Tag workflow #REGULAR (Original PR: [#1175](https://github.com/joinworth/integration-service/pull/1175)) ([#1196](https://github.com/joinworth/integration-service/pull/1196)) 🚂 release/v0.44.0

### 🐛 Bug

**[PAT-511](https://worth-ai.atlassian.net/browse/PAT-511) - [FE+BE] NPI Update Creates Duplicate Entries Instead of Updating Existing Value**

- 🚜🚀 #LIVE fix: allow npi update #REGULAR (Original PR: [#1142](https://github.com/joinworth/integration-service/pull/1142)) ([#1193](https://github.com/joinworth/integration-service/pull/1193)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE QA fixes #REGULAR (Original PR: [#1148](https://github.com/joinworth/integration-service/pull/1148)) ([#1194](https://github.com/joinworth/integration-service/pull/1194)) 🚂 release/v0.44.0

**[PAT-514](https://worth-ai.atlassian.net/browse/PAT-514) - [BE] 360 Report Shows Outdated Business Details After Customer Application Edit**

- 🚜🚀 #LIVE fix: Fix Outdated KYC/KYB Data in 360 Report After Customer Application Editt #REGULAR (Original PR: [#1174](https://github.com/joinworth/integration-service/pull/1174)) ([#1184](https://github.com/joinworth/integration-service/pull/1184)) 🚂 release/v0.44.0

**[PAT-521](https://worth-ai.atlassian.net/browse/PAT-521) - Connected integrations logic in progression**

- 🚜🚀 #LIVE fix: Ensure Category Object Initialization Independent of Platform Skip Logic #REGULAR (Original PR: [#1157](https://github.com/joinworth/integration-service/pull/1157)) ([#1195](https://github.com/joinworth/integration-service/pull/1195)) 🚂 release/v0.44.0

### ✨ Enhancement

**[DOS-552](https://worth-ai.atlassian.net/browse/DOS-552) - [FE+BE] Related Accounts Visibility + Download 360 Reports**

- 🚜🚀 Schema updates for fetchReportData #LIVE #REGULAR (Original PR: [#1156](https://github.com/joinworth/integration-service/pull/1156)) ([#1191](https://github.com/joinworth/integration-service/pull/1191)) 🚂 release/v0.44.0

**[PAT-467](https://worth-ai.atlassian.net/browse/PAT-467) - [FE+BE] Enable Customers to Edit Applications via Onboarding**

- 🚜🚀 #LIVE feat: insert customer edit application data #REGULAR (Original PR: [#1103](https://github.com/joinworth/integration-service/pull/1103)) ([#1185](https://github.com/joinworth/integration-service/pull/1185)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE feat: customer edit ocr flow #REGULAR (Original PR: [#1118](https://github.com/joinworth/integration-service/pull/1118)) ([#1186](https://github.com/joinworth/integration-service/pull/1186)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: tax data insertion #REGULAR (Original PR: [#1120](https://github.com/joinworth/integration-service/pull/1120)) ([#1187](https://github.com/joinworth/integration-service/pull/1187)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: object equality checks #REGULAR (Original PR: [#1131](https://github.com/joinworth/integration-service/pull/1131)) ([#1188](https://github.com/joinworth/integration-service/pull/1188)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: customer edits for taxation and processing history #REGULAR (Original PR: [#1146](https://github.com/joinworth/integration-service/pull/1146)) ([#1189](https://github.com/joinworth/integration-service/pull/1189)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: processig history customer edits #REGULAR (Original PR: [#1176](https://github.com/joinworth/integration-service/pull/1176)) ([#1190](https://github.com/joinworth/integration-service/pull/1190)) 🚂 release/v0.44.0

**[PAT-468](https://worth-ai.atlassian.net/browse/PAT-468) - [FE+BE] Display Customer Application Edits in Audit Trail**

- 🚜🚀 #LIVE fix: npi audit trail formatting #REGULAR (Original PR: [#1135](https://github.com/joinworth/integration-service/pull/1135)) ([#1192](https://github.com/joinworth/integration-service/pull/1192)) 🚂 release/v0.44.0

**[PAT-495](https://worth-ai.atlassian.net/browse/PAT-495) - [FE+BE] Allow Customers to Edit Company + Ownership Details**

- 🚜🚀 #LIVE feat: npi application edit #REGULAR (Original PR: [#1112](https://github.com/joinworth/integration-service/pull/1112)) ([#1182](https://github.com/joinworth/integration-service/pull/1182)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE fix: applicant not found error #REGULAR (Original PR: [#1113](https://github.com/joinworth/integration-service/pull/1113)) ([#1183](https://github.com/joinworth/integration-service/pull/1183)) 🚂 release/v0.44.0

### 💻 Tech Task

**[DOS-557](https://worth-ai.atlassian.net/browse/DOS-557) - Implement fallback for Authorization cache to request from auth service in case of cache miss and fill in the cache**

- 🚜🚀 #LIVE Implement Fallback #REGULAR (Original PR: [#1090](https://github.com/joinworth/integration-service/pull/1090)) ([#1199](https://github.com/joinworth/integration-service/pull/1199)) 🚂 release/v0.44.0

**[PAT-502](https://worth-ai.atlassian.net/browse/PAT-502) - Add is_sole_prop property to the KYB facts route**

- 🚜🚀 Add `is_sole_prop` kyb fact #LIVE #REGULAR (Original PR: [#1178](https://github.com/joinworth/integration-service/pull/1178)) ([#1203](https://github.com/joinworth/integration-service/pull/1203)) 🚂 release/v0.44.0
- 🚜🚀 #LIVE types adjustments #REGULAR (Original PR: [#1181](https://github.com/joinworth/integration-service/pull/1181)) ([#1204](https://github.com/joinworth/integration-service/pull/1204)) 🚂 release/v0.44.0

### 📝 Other

**[PAT-518](https://worth-ai.atlassian.net/browse/PAT-518) - No title available**

- 🚜🚀 #LIVE : Giact phone and address omission feature flag #REGULAR (Original PR: [#1154](https://github.com/joinworth/integration-service/pull/1154)) ([#1211](https://github.com/joinworth/integration-service/pull/1211)) 🚂 release/v0.44.0

## [v0.43.4](https://github.com//joinworth/integration-service/compare/v0.43.0-tiger-v2.2...v0.43.4) - 2025-06-16

### 🧰 Task

**[INFRA-164](https://worth-ai.atlassian.net/browse/INFRA-164) - Automate Cherry-pick PR Labeling for Release Train PR**

- 🚜🚀 #LIVE Add automated labeling for cherry-pick release PRs #REGULAR (Original PR: [#1119](https://github.com/joinworth/integration-service/pull/1119)) ([#1121](https://github.com/joinworth/integration-service/pull/1121)) 🚂 release/v0.43.0

**[INFRA-168](https://worth-ai.atlassian.net/browse/INFRA-168) - Auto Deploy QA ENV in all BE svc**

- 🚜🚀 #LIVE AUTO DEPLOY QA ENV #REGULAR (Original PR: [#1151](https://github.com/joinworth/integration-service/pull/1151)) ([#1152](https://github.com/joinworth/integration-service/pull/1152)) 🚂 release/v0.43.0

### 🐛 Bug

**[DOS-633](https://worth-ai.atlassian.net/browse/DOS-633) - Fix revenue validation in score generation and update score config with new platforms**

- 🚜🚀 #LIVE fix s3 location for equifax scoring file #REGULAR (Original PR: [#1160](https://github.com/joinworth/integration-service/pull/1160)) ([#1162](https://github.com/joinworth/integration-service/pull/1162)) 🚂 release/v0.43.0

### ✨ Enhancement

**[DOS-526](https://worth-ai.atlassian.net/browse/DOS-526) - [FE+BE] Additional Fields & Section for Processing History**

- 🚜🚀 FEAT: Additional fields and sections for processing history #LIVE #REGULAR (Original PR: [#1104](https://github.com/joinworth/integration-service/pull/1104)) ([#1140](https://github.com/joinworth/integration-service/pull/1140)) 🚂 release/v0.43.0
- 🚜🚀 FEAT: Additional fields and sections for processing history #LIVE #REGULAR (Original PR: [#1114](https://github.com/joinworth/integration-service/pull/1114)) ([#1141](https://github.com/joinworth/integration-service/pull/1141)) 🚂 release/v0.43.0

**[DOS-549](https://worth-ai.atlassian.net/browse/DOS-549) - [FE+BE] Bulk Uploads with Shared TINs**

- 🚜🚀 Enable Bulk Uploads with Shared TINs #LIVE #REGULAR (Original PR: [#1091](https://github.com/joinworth/integration-service/pull/1091)) ([#1143](https://github.com/joinworth/integration-service/pull/1143)) 🚂 release/v0.43.0

**[PAT-423](https://worth-ai.atlassian.net/browse/PAT-423) - BE | Include DBA in SERP search**

- 🚜🚀 #LIVE feat: Adds all business name to SERP search #REGULAR (Original PR: [#1116](https://github.com/joinworth/integration-service/pull/1116)) ([#1147](https://github.com/joinworth/integration-service/pull/1147)) 🚂 release/v0.43.0

**[PAT-467](https://worth-ai.atlassian.net/browse/PAT-467) - [FE+BE] Enable Customers to Edit Applications via Onboarding**

- 🚜🚀 #LIVE feat: insert customer edit application data #REGULAR (Original PR: [#1103](https://github.com/joinworth/integration-service/pull/1103)) ([#1163](https://github.com/joinworth/integration-service/pull/1163)) 🚂 release/v0.43.0
- 🚜🚀 #LIVE feat: customer edit ocr flow #REGULAR (Original PR: [#1118](https://github.com/joinworth/integration-service/pull/1118)) ([#1164](https://github.com/joinworth/integration-service/pull/1164)) 🚂 release/v0.43.0
- 🚜🚀 #LIVE fix: tax data insertion #REGULAR (Original PR: [#1120](https://github.com/joinworth/integration-service/pull/1120)) ([#1165](https://github.com/joinworth/integration-service/pull/1165)) 🚂 release/v0.43.0
- 🚜🚀 #LIVE fix: object equality checks #REGULAR (Original PR: [#1131](https://github.com/joinworth/integration-service/pull/1131)) ([#1166](https://github.com/joinworth/integration-service/pull/1166)) 🚂 release/v0.43.0
- 🚜🚀 #LIVE fix: customer edits for taxation and processing history #REGULAR (Original PR: [#1146](https://github.com/joinworth/integration-service/pull/1146)) ([#1167](https://github.com/joinworth/integration-service/pull/1167)) 🚂 release/v0.43.0

### 💻 Tech Task

**[DOS-573](https://worth-ai.atlassian.net/browse/DOS-573) - Enabling SSL and devcontainers for the local environment.**

- 🚜🚀 Introduced a dev container & added a separate key in the environment configuration for AWS Athena and Redshift integration. #LIVE #REGULAR (Original PR: [#1093](https://github.com/joinworth/integration-service/pull/1093)) ([#1128](https://github.com/joinworth/integration-service/pull/1128)) 🚂 release/v0.43.0

**[DOS-577](https://worth-ai.atlassian.net/browse/DOS-577) - Ensure Shared Task Execution and Response Attachment for Dual Case Scenarios**

- 🚜🚀 Ensure Shared Task Execution and Response Attachment for Dual Case Scenarios #LIVE #REGULAR (Original PR: [#1129](https://github.com/joinworth/integration-service/pull/1129)) ([#1144](https://github.com/joinworth/integration-service/pull/1144)) 🚂 release/v0.43.0

**[TIG-18](https://worth-ai.atlassian.net/browse/TIG-18) - Automation for Matching Calculation**

- 🚜🚀 #LIVE Automatically calculate facts #REGULAR (Original PR: [#1139](https://github.com/joinworth/integration-service/pull/1139)) ([#1170](https://github.com/joinworth/integration-service/pull/1170)) 🚂 release/v0.43.0

**[TIG-32](https://worth-ai.atlassian.net/browse/TIG-32) - NAICS code - platform**

- 🚜🚀 Handle bullqueue stalled job #LIVE #REGULAR (Original PR: [#1111](https://github.com/joinworth/integration-service/pull/1111)) ([#1124](https://github.com/joinworth/integration-service/pull/1124)) 🚂 release/v0.43.0
- 🚜🚀 fix issue with sandboxed file #LIVE #REGULAR (Original PR: [#1132](https://github.com/joinworth/integration-service/pull/1132)) ([#1134](https://github.com/joinworth/integration-service/pull/1134)) 🚂 release/v0.43.0

**[TIG-46](https://worth-ai.atlassian.net/browse/TIG-46) - Entity Matching - Ingest Federal Corp data from new Warehouse service route**

- 🚜🚀 Add Canada Open entity consumption #LIVE #REGULAR (Original PR: [#1115](https://github.com/joinworth/integration-service/pull/1115)) ([#1173](https://github.com/joinworth/integration-service/pull/1173)) 🚂 release/v0.43.0

**[TIG-48](https://worth-ai.atlassian.net/browse/TIG-48) - Gap Analysis: Equifax**

- 🚜🚀 Correctly handle if no EFX BMA row #LIVE #REGULAR (Original PR: [#1122](https://github.com/joinworth/integration-service/pull/1122)) ([#1127](https://github.com/joinworth/integration-service/pull/1127)) 🚂 release/v0.43.0
- 🚜🚀 #LIVE Fix BMA missing for real #REGULAR (Original PR: [#1136](https://github.com/joinworth/integration-service/pull/1136)) ([#1138](https://github.com/joinworth/integration-service/pull/1138)) 🚂 release/v0.43.0

### 📝 Other

- 📝 Fix: add missing declartion setApplicationEditData in helper file

## [v0.43.0-tiger-v2.2](https://github.com//joinworth/integration-service/compare/v0.43.0-tiger-v2.1...v0.43.0-tiger-v2.2) - 2025-06-16

### 🐛 Bug

**[DOS-633](https://worth-ai.atlassian.net/browse/DOS-633) - Fix revenue validation in score generation and update score config with new platforms**

- 🚜🚀 #LIVE fix s3 location for equifax scoring file #REGULAR (Original PR: [#1160](https://github.com/joinworth/integration-service/pull/1160)) ([#1161](https://github.com/joinworth/integration-service/pull/1161)) 🚂 release/v0.43.0-tiger-v2

### 💻 Tech Task

**[TIG-18](https://worth-ai.atlassian.net/browse/TIG-18) - Automation for Matching Calculation**

- 🚜🚀 #LIVE Automatically calculate facts #REGULAR (Original PR: [#1139](https://github.com/joinworth/integration-service/pull/1139)) ([#1169](https://github.com/joinworth/integration-service/pull/1169)) 🚂 release/v0.43.0-tiger-v2

**[TIG-46](https://worth-ai.atlassian.net/browse/TIG-46) - Entity Matching - Ingest Federal Corp data from new Warehouse service route**

- 🚜🚀 Add Canada Open entity consumption #LIVE #REGULAR (Original PR: [#1115](https://github.com/joinworth/integration-service/pull/1115)) ([#1171](https://github.com/joinworth/integration-service/pull/1171)) 🚂 release/v0.43.0-tiger-v2

## [v0.43.0-tiger-v2.1](https://github.com//joinworth/integration-service/compare/v0.43.0-tiger-v2.0...v0.43.0-tiger-v2.1) - 2025-06-11

### 💻 Tech Task

**[TIG-48](https://worth-ai.atlassian.net/browse/TIG-48) - Gap Analysis: Equifax**

- 🚜🚀 #LIVE Fix BMA missing for real #REGULAR (Original PR: [#1136](https://github.com/joinworth/integration-service/pull/1136)) ([#1137](https://github.com/joinworth/integration-service/pull/1137)) 🚂 release/v0.43.0-tiger-v2

## [v0.43.0-tiger-v2.0](https://github.com//joinworth/integration-service/compare/v0.43.1...v0.43.0-tiger-v2.0) - 2025-06-11

### 💻 Tech Task

**[TIG-32](https://worth-ai.atlassian.net/browse/TIG-32) - NAICS code - platform**

- 🚜🚀 Handle bullqueue stalled job #LIVE #REGULAR (Original PR: [#1111](https://github.com/joinworth/integration-service/pull/1111)) ([#1123](https://github.com/joinworth/integration-service/pull/1123)) 🚂 release/v0.43.0-tiger-v2
- 🚜🚀 fix issue with sandboxed file #LIVE #REGULAR (Original PR: [#1132](https://github.com/joinworth/integration-service/pull/1132)) ([#1133](https://github.com/joinworth/integration-service/pull/1133)) 🚂 release/v0.43.0-tiger-v2

**[TIG-48](https://worth-ai.atlassian.net/browse/TIG-48) - Gap Analysis: Equifax**

- 🚜🚀 Correctly handle if no EFX BMA row #LIVE #REGULAR (Original PR: [#1122](https://github.com/joinworth/integration-service/pull/1122)) ([#1126](https://github.com/joinworth/integration-service/pull/1126)) 🚂 release/v0.43.0-tiger-v2

## [v0.43.1](https://github.com//joinworth/integration-service/compare/v0.43.0-tiger-v1...v0.43.1) - 2025-06-06

### 💻 Tech Task

**[DOS-574](https://worth-ai.atlassian.net/browse/DOS-574) - Fix Duplicate Task Creation During Bulk Upload**

- 🚜🚀 Fix Duplicate Task Creation During Bulk Upload #LIVE #REGULAR (Original PR: [#1095](https://github.com/joinworth/integration-service/pull/1095)) ([#1099](https://github.com/joinworth/integration-service/pull/1099)) 🚂 release/v0.43.0

**[TIG-32](https://worth-ai.atlassian.net/browse/TIG-32) - NAICS code - platform**

- 🚜🚀 #LIVE AI Enrichment Part 1 #REGULAR (Original PR: [#1100](https://github.com/joinworth/integration-service/pull/1100)) ([#1105](https://github.com/joinworth/integration-service/pull/1105)) 🚂 release/v0.43.0
- 🚜🚀 #LIVE Add DeferrableTaskManager class & generateAndExecuteTasksForBusinessRoute | Part 2 #REGULAR (Original PR: [#1101](https://github.com/joinworth/integration-service/pull/1101)) ([#1106](https://github.com/joinworth/integration-service/pull/1106)) 🚂 release/v0.43.0

## [v0.43.0-tiger-v1](https://github.com//joinworth/integration-service/compare/v0.42.7...v0.43.0-tiger-v1) - 2025-06-06

### 💻 Tech Task

**[TIG-32](https://worth-ai.atlassian.net/browse/TIG-32) - NAICS code - platform**

- 🚜🚀 #LIVE AI Enrichment Part 1 #REGULAR (Original PR: [#1100](https://github.com/joinworth/integration-service/pull/1100)) ([#1107](https://github.com/joinworth/integration-service/pull/1107)) 🚂 release/v0.43.0-tiger-v1
- 🚜🚀 #LIVE Add DeferrableTaskManager class & generateAndExecuteTasksForBusinessRoute | Part 2 #REGULAR (Original PR: [#1101](https://github.com/joinworth/integration-service/pull/1101)) ([#1108](https://github.com/joinworth/integration-service/pull/1108)) 🚂 release/v0.43.0-tiger-v1

## [v0.42.7](https://github.com//joinworth/integration-service/compare/v0.42.0-fast-v2.0...v0.42.7) - 2025-06-03

### 📖 Story

**[DOS-518](https://worth-ai.atlassian.net/browse/DOS-518) - [FE+ BE] Worth Admin Settings - IDV - Add a field that allows custom Plaid IDV template ids**

- 🚜🚀 FEAT: ALLOW CUSTOM PLAID IDV TEMPLATE #LIVE #REGULAR (Original PR: [#1002](https://github.com/joinworth/integration-service/pull/1002)) ([#1064](https://github.com/joinworth/integration-service/pull/1064)) 🚂 release/v0.42.0

**[DOS-543](https://worth-ai.atlassian.net/browse/DOS-543) - [BE] Update Auto-Approval Logic to Use Multiple Verification Signals**

- 🚜🚀🚩 Case auto-approval logic update under feature flag #LIVE #FLAG #REGULAR (Original PR: [#1014](https://github.com/joinworth/integration-service/pull/1014)) ([#1086](https://github.com/joinworth/integration-service/pull/1086)) 🚂 release/v0.42.0

**[PAT-374](https://worth-ai.atlassian.net/browse/PAT-374) - API KYB facts - Add status field (or webhook) that signals completion of data gathering.**

- 🚜🚀 #LIVE KYB Status Field #REGULAR (Original PR: [#1003](https://github.com/joinworth/integration-service/pull/1003)) ([#1076](https://github.com/joinworth/integration-service/pull/1076)) 🚂 release/v0.42.0

### 🐛 Bug

**[DOS-581](https://worth-ai.atlassian.net/browse/DOS-581) - Plaid Banking Integration: Add Fallback Logic with `link_session_id`**

- 🚜🚀 Added fallback logic to the Plaid data connection check query to utilize link_session_id. #LIVE #REGULAR (Original PR: [#1096](https://github.com/joinworth/integration-service/pull/1096)) ([#1097](https://github.com/joinworth/integration-service/pull/1097)) 🚂 release/v0.42.0

**[PAT-463](https://worth-ai.atlassian.net/browse/PAT-463) - Fix Invalid Field Results on SoS & Tax Sections**

- 🚜🚀 #LIVE Format Canadian Province #REGULAR (Original PR: [#1024](https://github.com/joinworth/integration-service/pull/1024)) ([#1087](https://github.com/joinworth/integration-service/pull/1087)) 🚂 release/v0.42.0

**[PAT-483](https://worth-ai.atlassian.net/browse/PAT-483) - Accounting data not displayed in Worth or Customer Admin**

- 🚜🚀 #LIVE Accounting Data not Displayed in Worth or Customer Admin #REGULAR (Original PR: [#1057](https://github.com/joinworth/integration-service/pull/1057)) ([#1094](https://github.com/joinworth/integration-service/pull/1094)) 🚂 release/v0.42.0

### ✨ Enhancement

**[DOS-406](https://worth-ai.atlassian.net/browse/DOS-406) - [FE+ BE] Plaid IDV: Fraud Data Not Displaying in Case Management/Add Email Fields**

- 🚜🚀 FEAT: Display email fraud data in case management #LIVE #REGULAR (Original PR: [#1053](https://github.com/joinworth/integration-service/pull/1053)) ([#1065](https://github.com/joinworth/integration-service/pull/1065)) 🚂 release/v0.42.0
- 🚜🚀 FEAT: Display email fraud data in case management #LIVE #REGULAR (Original PR: [#1061](https://github.com/joinworth/integration-service/pull/1061)) ([#1066](https://github.com/joinworth/integration-service/pull/1066)) 🚂 release/v0.42.0

**[PAT-285](https://worth-ai.atlassian.net/browse/PAT-285) - BE | Verdata - Build to webhooks**

- 🚜🚀 #LIVE feat: Verdata - Build to webhooks #REGULAR (Original PR: [#1012](https://github.com/joinworth/integration-service/pull/1012)) ([#1083](https://github.com/joinworth/integration-service/pull/1083)) 🚂 release/v0.42.0
- 🚜🚀 #LIVE feat: Verdata - Build to webhooks #REGULAR (Original PR: [#1071](https://github.com/joinworth/integration-service/pull/1071)) ([#1084](https://github.com/joinworth/integration-service/pull/1084)) 🚂 release/v0.42.0

**[PAT-409](https://worth-ai.atlassian.net/browse/PAT-409) - [FE+BE] Lien Data does not appear to be populating to FE**

- 🚜🚀 #LIVE feat: Populate bankruptcy, judgment, and lien data for business #REGULAR (Original PR: [#1060](https://github.com/joinworth/integration-service/pull/1060)) ([#1081](https://github.com/joinworth/integration-service/pull/1081)) 🚂 release/v0.42.0
- 🚜🚀 #LIVE fix: Allow null values for date fields in PublicRecord type #REGULAR (Original PR: [#1062](https://github.com/joinworth/integration-service/pull/1062)) ([#1082](https://github.com/joinworth/integration-service/pull/1082)) 🚂 release/v0.42.0

### 💻 Tech Task

**[TIG-2](https://worth-ai.atlassian.net/browse/TIG-2) - Implement ML matching logic - EFX**

- 🚜🚩 #FLAG Stub in equifax AI matching #REGULAR (Original PR: [#1052](https://github.com/joinworth/integration-service/pull/1052)) ([#1089](https://github.com/joinworth/integration-service/pull/1089)) 🚂 release/v0.42.0

**[TIG-21](https://worth-ai.atlassian.net/browse/TIG-21) - Address Fact Issues**

- 🚜🚀 #LIVE Fact Fixes #REGULAR (Original PR: [#1006](https://github.com/joinworth/integration-service/pull/1006)) ([#1070](https://github.com/joinworth/integration-service/pull/1070)) 🚂 release/v0.42.0

**[TIG-22](https://worth-ai.atlassian.net/browse/TIG-22) - Fix for Year Established fill rates**

- 🚜🚀 #LIVE fix kyb_submitted fact #REGULAR (Original PR: [#1078](https://github.com/joinworth/integration-service/pull/1078)) ([#1080](https://github.com/joinworth/integration-service/pull/1080)) 🚂 release/v0.42.0

### 📝 Other

**[DOD-145](https://worth-ai.atlassian.net/browse/DOD-145) - No title available**

- 🚜🚀 Score config #LIVE #REGULAR (Original PR: [#1043](https://github.com/joinworth/integration-service/pull/1043)) ([#1085](https://github.com/joinworth/integration-service/pull/1085)) 🚂 release/v0.42.0

**[TIG-31](https://worth-ai.atlassian.net/browse/TIG-31) - No title available**

- 🚜🚀 #LIVE fix: sanitizing deliverable addresses #REGULAR (Original PR: [#1067](https://github.com/joinworth/integration-service/pull/1067)) ([#1072](https://github.com/joinworth/integration-service/pull/1072)) 🚂 release/v0.42.0
- 🚜🚀 #LIVE fix: dba-name passing to verdata only if present #REGULAR (Original PR: [#1068](https://github.com/joinworth/integration-service/pull/1068)) ([#1073](https://github.com/joinworth/integration-service/pull/1073)) 🚂 release/v0.42.0

## [v0.42.0-fast-v2.0](https://github.com//joinworth/integration-service/compare/v0.42.0-tiger-v8...v0.42.0-fast-v2.0) - 2025-05-30

### 🐛 Bug

**[PAT-463](https://worth-ai.atlassian.net/browse/PAT-463) - Fix Invalid Field Results on SoS & Tax Sections**

- 🚜🚀 #LIVE Format Canadian Province #REGULAR (Original PR: [#1024](https://github.com/joinworth/integration-service/pull/1024)) ([#1092](https://github.com/joinworth/integration-service/pull/1092)) 🚂 release/v0.42.0-fast-v2

## [v0.42.0-tiger-v8](https://github.com//joinworth/integration-service/compare/v0.42.0-tiger-v7...v0.42.0-tiger-v8) - 2025-05-29

### 💻 Tech Task

**[TIG-2](https://worth-ai.atlassian.net/browse/TIG-2) - Implement ML matching logic - EFX**

- 🚜🚩 #FLAG Stub in equifax AI matching #REGULAR (Original PR: [#1052](https://github.com/joinworth/integration-service/pull/1052)) ([#1088](https://github.com/joinworth/integration-service/pull/1088)) 🚂 release/v0.42.0-tiger-v2

## [v0.42.0-tiger-v7](https://github.com//joinworth/integration-service/compare/v0.42.0-tiger-v6...v0.42.0-tiger-v7) - 2025-05-28

### 💻 Tech Task

**[TIG-22](https://worth-ai.atlassian.net/browse/TIG-22) - Fix for Year Established fill rates**

- 🚜🚀 #LIVE fix kyb_submitted fact #REGULAR (Original PR: [#1078](https://github.com/joinworth/integration-service/pull/1078)) ([#1079](https://github.com/joinworth/integration-service/pull/1079)) 🚂 release/v0.42.0-tiger-v2

## [v0.42.0-tiger-v6](https://github.com//joinworth/integration-service/compare/v0.42.3...v0.42.0-tiger-v6) - 2025-05-28

### 💻 Tech Task

**[TIG-21](https://worth-ai.atlassian.net/browse/TIG-21) - Address Fact Issues**

- 🚜🚀 #LIVE Fact Fixes #REGULAR (Original PR: [#1006](https://github.com/joinworth/integration-service/pull/1006)) ([#1069](https://github.com/joinworth/integration-service/pull/1069)) 🚂 release/v0.42.0-tiger-v2

### 📝 Other

**[TIG-31](https://worth-ai.atlassian.net/browse/TIG-31) - No title available**

- 🚜🚀 #LIVE fix: dba-name passing to verdata only if present #REGULAR (Original PR: [#1068](https://github.com/joinworth/integration-service/pull/1068)) ([#1074](https://github.com/joinworth/integration-service/pull/1074)) 🚂 release/v0.42.0-tiger-v2
- 🚜🚀 #LIVE fix: sanitizing deliverable addresses #REGULAR (Original PR: [#1067](https://github.com/joinworth/integration-service/pull/1067)) ([#1075](https://github.com/joinworth/integration-service/pull/1075)) 🚂 release/v0.42.0-tiger-v2

## [v0.42.3](https://github.com//joinworth/integration-service/compare/v0.42.0-tiger-v5...v0.42.3) - 2025-05-27

### 🧰 Task

**[INFRA-159](https://worth-ai.atlassian.net/browse/INFRA-159) - Implement time-based cleanup for release branches**

- 🚜🚀 #LIVE Update branch cleanup workflow to use time-based deletion #REGULAR (Original PR: [#995](https://github.com/joinworth/integration-service/pull/995)) ([#1013](https://github.com/joinworth/integration-service/pull/1013)) 🚂 release/v0.42.0

**[INFRA-161](https://worth-ai.atlassian.net/browse/INFRA-161) - Update cherry-pick action**

- 🚜🚀 #LIVE UPDATE CHERRYPICK ACTION #REGULAR (Original PR: [#1049](https://github.com/joinworth/integration-service/pull/1049)) ([#1050](https://github.com/joinworth/integration-service/pull/1050)) 🚂 release/v0.42.0

### 🐛 Bug

**[PAT-460](https://worth-ai.atlassian.net/browse/PAT-460) - Fix Undefined Address Formatting for Canada**

- 🚜🚀 handle possible race condition for connection #LIVE #REGULAR (Original PR: [#998](https://github.com/joinworth/integration-service/pull/998)) ([#999](https://github.com/joinworth/integration-service/pull/999)) 🚂 release/v0.42.0

**[PAT-463](https://worth-ai.atlassian.net/browse/PAT-463) - Fix Invalid Field Results on SoS & Tax Sections**

- 🚜🚀 #LIVE: Stop returning Middesk verification records if Middesk lookup fails #REGULAR (Original PR: [#1005](https://github.com/joinworth/integration-service/pull/1005)) ([#1021](https://github.com/joinworth/integration-service/pull/1021)) 🚂 release/v0.42.0

### ✨ Enhancement

**[PAT-338](https://worth-ai.atlassian.net/browse/PAT-338) - BE | As a user, I expect that any additional DBA names or addresses are submitted to Middesk.**

- 🚜🚀 #LIVE feat: passing dba-names and mailing-addresses into middesk #REGULAR (Original PR: [#938](https://github.com/joinworth/integration-service/pull/938)) ([#1045](https://github.com/joinworth/integration-service/pull/1045)) 🚂 release/v0.42.0

### 💻 Tech Task

**[TIG-13](https://worth-ai.atlassian.net/browse/TIG-13) - Throttle submissions for seller search and detailed search to Verdata**

- 🚜🚀 #LIVE Adjustments to Verdata Queueing #REGULAR (Original PR: [#946](https://github.com/joinworth/integration-service/pull/946)) ([#1009](https://github.com/joinworth/integration-service/pull/1009)) 🚂 release/v0.42.0

**[TIG-28](https://worth-ai.atlassian.net/browse/TIG-28) - Entity Matching | Loosen Schema Validation**

- 🚜🚩 #FLAG Entity Matching - loosen Joi schema #REGULAR (Original PR: [#1038](https://github.com/joinworth/integration-service/pull/1038)) ([#1042](https://github.com/joinworth/integration-service/pull/1042)) 🚂 release/v0.42.0

**[TIG-3](https://worth-ai.atlassian.net/browse/TIG-3) - Implement ML matching logic - ZI**

- 🚜🚩 Add Heuristic Fallback #FLAG #REGULAR (Original PR: [#1015](https://github.com/joinworth/integration-service/pull/1015)) ([#1017](https://github.com/joinworth/integration-service/pull/1017)) 🚂 release/v0.42.0
- 🚜🚩 #FLAG Don't use a match if below configured threshold #REGULAR (Original PR: [#1023](https://github.com/joinworth/integration-service/pull/1023)) ([#1025](https://github.com/joinworth/integration-service/pull/1025)) 🚂 release/v0.42.0
- 🚜🚩 Update businessEntityVerification.ts #FLAG #REGULAR (Original PR: [#1031](https://github.com/joinworth/integration-service/pull/1031)) ([#1034](https://github.com/joinworth/integration-service/pull/1034)) 🚂 release/v0.42.0

**[TIG-4](https://worth-ai.atlassian.net/browse/TIG-4) - Implement ML matching logic - OC**

- 🚜🚩 #FLAG feat: ML matching logic - OC #REGULAR (Original PR: [#1044](https://github.com/joinworth/integration-service/pull/1044)) ([#1046](https://github.com/joinworth/integration-service/pull/1046)) 🚂 release/v0.42.0

### 🛑 Defect

**[PAT-471](https://worth-ai.atlassian.net/browse/PAT-471) - Integrations | Purge causing Kafka timeout**

- 🚜🚀 #LIVE Defer purge to queue #REGULAR (Original PR: [#997](https://github.com/joinworth/integration-service/pull/997)) ([#1004](https://github.com/joinworth/integration-service/pull/1004)) 🚂 release/v0.42.0

### 📝 Other

- 📝 Update businessEntityVerification.ts

**[TIG-31](https://worth-ai.atlassian.net/browse/TIG-31) - No title available**

- 🚜🚀 #LIVE fix: adding logger #REGULAR (Original PR: [#1054](https://github.com/joinworth/integration-service/pull/1054)) ([#1055](https://github.com/joinworth/integration-service/pull/1055)) 🚂 release/v0.42.0

## [v0.42.0-tiger-v5](https://github.com//joinworth/integration-service/compare/v0.42.0-tiger-v4...v0.42.0-tiger-v5) - 2025-05-23

### 💻 Tech Task

**[TIG-13](https://worth-ai.atlassian.net/browse/TIG-13) - Throttle submissions for seller search and detailed search to Verdata**

- 🚜🚀 #LIVE Adjustments to Verdata Queueing #REGULAR (Original PR: [#946](https://github.com/joinworth/integration-service/pull/946)) ([#1035](https://github.com/joinworth/integration-service/pull/1035)) 🚂 release/v0.42.0-tiger-v1

**[TIG-28](https://worth-ai.atlassian.net/browse/TIG-28) - Entity Matching | Loosen Schema Validation**

- 🚜🚩 #FLAG Entity Matching - loosen Joi schema #REGULAR (Original PR: [#1038](https://github.com/joinworth/integration-service/pull/1038)) ([#1040](https://github.com/joinworth/integration-service/pull/1040)) 🚂 release/v0.42.0-tiger-v1

**[TIG-4](https://worth-ai.atlassian.net/browse/TIG-4) - Implement ML matching logic - OC**

- 🚜🚩 #FLAG feat: ML matching logic - OC #REGULAR (Original PR: [#1044](https://github.com/joinworth/integration-service/pull/1044)) ([#1047](https://github.com/joinworth/integration-service/pull/1047)) 🚂 release/v0.42.0-tiger-v1

## [v0.42.0-tiger-v4](https://github.com//joinworth/integration-service/compare/v0.42.0-tiger-v3...v0.42.0-tiger-v4) - 2025-05-23

### 💻 Tech Task

**[TIG-3](https://worth-ai.atlassian.net/browse/TIG-3) - Implement ML matching logic - ZI**

- 🚜🚩 Update businessEntityVerification.ts #FLAG #REGULAR (Original PR: [#1031](https://github.com/joinworth/integration-service/pull/1031)) ([#1032](https://github.com/joinworth/integration-service/pull/1032)) 🚂 release/v0.42.0-tiger-v1

## [v0.42.0-tiger-v3](https://github.com//joinworth/integration-service/compare/v0.42.0-tiger-v2...v0.42.0-tiger-v3) - 2025-05-22

### 📝 Other

- 📝 Update businessEntityVerification.ts

## [v0.42.0-tiger-v2](https://github.com//joinworth/integration-service/compare/v0.42.0-tiger-v1...v0.42.0-tiger-v2) - 2025-05-22

### 💻 Tech Task

**[TIG-3](https://worth-ai.atlassian.net/browse/TIG-3) - Implement ML matching logic - ZI**

- 🚜🚩 #FLAG Don't use a match if below configured threshold #REGULAR (Original PR: [#1023](https://github.com/joinworth/integration-service/pull/1023)) ([#1027](https://github.com/joinworth/integration-service/pull/1027)) 🚂 release/v0.42.0-tiger-v1

## [v0.42.0-tiger-v1](https://github.com//joinworth/integration-service/compare/v0.42.0-canada-v1.0...v0.42.0-tiger-v1) - 2025-05-22

### 🐛 Bug

**[PAT-460](https://worth-ai.atlassian.net/browse/PAT-460) - Fix Undefined Address Formatting for Canada**

- 🚜🚀 handle possible race condition for connection #LIVE #REGULAR (Original PR: [#998](https://github.com/joinworth/integration-service/pull/998)) ([#1000](https://github.com/joinworth/integration-service/pull/1000)) 🚂 release/v0.42.0-tiger-v1

**[PAT-463](https://worth-ai.atlassian.net/browse/PAT-463) - Fix Invalid Field Results on SoS & Tax Sections**

- 🚜🚀 #LIVE: Stop returning Middesk verification records if Middesk lookup fails #REGULAR (Original PR: [#1005](https://github.com/joinworth/integration-service/pull/1005)) ([#1020](https://github.com/joinworth/integration-service/pull/1020)) 🚂 release/v0.42.0-tiger-v1

### 💻 Tech Task

**[TIG-3](https://worth-ai.atlassian.net/browse/TIG-3) - Implement ML matching logic - ZI**

- 🚜🚩 #FLAG Zoominfo entity matching #REGULAR (Original PR: [#996](https://github.com/joinworth/integration-service/pull/996)) ([#1008](https://github.com/joinworth/integration-service/pull/1008)) 🚂 release/v0.42.0-tiger-v1
- 🚜🚩 #FLAG Make sure we send request #REGULAR (Original PR: [#1010](https://github.com/joinworth/integration-service/pull/1010)) ([#1011](https://github.com/joinworth/integration-service/pull/1011)) 🚂 release/v0.42.0-tiger-v1
- 🚜🚩 Add Heuristic Fallback #FLAG #REGULAR (Original PR: [#1015](https://github.com/joinworth/integration-service/pull/1015)) ([#1016](https://github.com/joinworth/integration-service/pull/1016)) 🚂 release/v0.42.0-tiger-v1

### 🛑 Defect

**[PAT-471](https://worth-ai.atlassian.net/browse/PAT-471) - Integrations | Purge causing Kafka timeout**

- 🚜🚀 #LIVE Defer purge to queue #REGULAR (Original PR: [#997](https://github.com/joinworth/integration-service/pull/997)) ([#1022](https://github.com/joinworth/integration-service/pull/1022)) 🚂 release/v0.42.0-tiger-v1

## [v0.42.0-canada-v1.0](https://github.com//joinworth/integration-service/compare/v0.41.11...v0.42.0-canada-v1.0) - 2025-05-21

### 🐛 Bug

**[PAT-460](https://worth-ai.atlassian.net/browse/PAT-460) - Fix Undefined Address Formatting for Canada**

- 🚜🚀 handle possible race condition for connection #LIVE #REGULAR (Original PR: [#998](https://github.com/joinworth/integration-service/pull/998)) ([#1001](https://github.com/joinworth/integration-service/pull/1001)) 🚂 release/v0.42.0-canada-v1

## [v0.41.11](https://github.com//joinworth/integration-service/compare/v0.41.0-canada-v8...v0.41.11) - 2025-05-20

### 📖 Story

**[TIG-15](https://worth-ai.atlassian.net/browse/TIG-15) - KYB/Business Details Facts Adjustments (names, address, phones, review count, naics)**

- 🚜🚀 Adjust more facts #LIVE #REGULAR (Original PR: [#943](https://github.com/joinworth/integration-service/pull/943)) ([#945](https://github.com/joinworth/integration-service/pull/945)) 🚂 release/v0.41.0

### 🐛 Bug

**[DOS-533](https://worth-ai.atlassian.net/browse/DOS-533) - [BE] [Staging][Quick Add – Send Invitation] – case_id is coming as null in the Progression API response.**

- 🚜🚀 Resolved the issue that was preventing deposit account selection. #LIVE #REGULAR (Original PR: [#942](https://github.com/joinworth/integration-service/pull/942)) ([#983](https://github.com/joinworth/integration-service/pull/983)) 🚂 release/v0.41.0

**[PAT-460](https://worth-ai.atlassian.net/browse/PAT-460) - Fix Undefined Address Formatting for Canada**

- 🚜🚀 #LIVE : Extract CAN address components #REGULAR (Original PR: [#988](https://github.com/joinworth/integration-service/pull/988)) ([#990](https://github.com/joinworth/integration-service/pull/990)) 🚂 release/v0.41.0

### ✨ Enhancement

**[DOS-29](https://worth-ai.atlassian.net/browse/DOS-29) - Withhold Calculating Worth Scores in Certain Scenarios**

- 🚜🚀 Send Score Trigger Event on Task Completion with SUCCESS or FAILED Status #LIVE #REGULAR (Original PR: [#903](https://github.com/joinworth/integration-service/pull/903)) ([#940](https://github.com/joinworth/integration-service/pull/940)) 🚂 release/v0.41.0
- 🚜🚀 Move Score logic #LIVE #REGULAR (Original PR: [#927](https://github.com/joinworth/integration-service/pull/927)) ([#941](https://github.com/joinworth/integration-service/pull/941)) 🚂 release/v0.41.0

**[PAT-389](https://worth-ai.atlassian.net/browse/PAT-389) - As a user, I expect that DBA names are submitted to Verdata.**

- 🚜🚀 send alternate names to verdata #LIVE #REGULAR (Original PR: [#919](https://github.com/joinworth/integration-service/pull/919)) ([#939](https://github.com/joinworth/integration-service/pull/939)) 🚂 release/v0.41.0

**[PAT-450](https://worth-ai.atlassian.net/browse/PAT-450) - Update address fields to support Canada (API)**

- 🚜🚀 #LIVE Add query for Canadian businesses #REGULAR (Original PR: [#951](https://github.com/joinworth/integration-service/pull/951)) ([#967](https://github.com/joinworth/integration-service/pull/967)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE: Runs query when "CAN, CA or Canada" used for Country. Adds uppercase to normalization for business name #REGULAR (Original PR: [#973](https://github.com/joinworth/integration-service/pull/973)) ([#977](https://github.com/joinworth/integration-service/pull/977)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE: Updates OC match query to pull accurate addresses #REGULAR (Original PR: [#979](https://github.com/joinworth/integration-service/pull/979)) ([#980](https://github.com/joinworth/integration-service/pull/980)) 🚂 release/v0.41.0

**[PAT-452](https://worth-ai.atlassian.net/browse/PAT-452) - Update IDV to support Canada**

- 🚜🚀 Update IDV to support Canada #LIVE #REGULAR (Original PR: [#949](https://github.com/joinworth/integration-service/pull/949)) ([#964](https://github.com/joinworth/integration-service/pull/964)) 🚂 release/v0.41.0
- 🚜🚀 Add Canada to IDV #LIVE #REGULAR (Original PR: [#966](https://github.com/joinworth/integration-service/pull/966)) ([#970](https://github.com/joinworth/integration-service/pull/970)) 🚂 release/v0.41.0
- 🚜🚀 Allow Canadian phone number #LIVE #REGULAR (Original PR: [#974](https://github.com/joinworth/integration-service/pull/974)) ([#978](https://github.com/joinworth/integration-service/pull/978)) 🚂 release/v0.41.0

### 💻 Tech Task

**[TIG-13](https://worth-ai.atlassian.net/browse/TIG-13) - Throttle submissions for seller search and detailed search to Verdata**

- 🚜🚀 #LIVE Adjustments to Verdata Queueing #REGULAR (Original PR: [#946](https://github.com/joinworth/integration-service/pull/946)) ([#954](https://github.com/joinworth/integration-service/pull/954)) 🚂 release/v0.41.0

**[TIG-14](https://worth-ai.atlassian.net/browse/TIG-14) - Add "found\_" Facts for names+addresses**

- 🚜🚀 #LIVE Kyb found facts #REGULAR (Original PR: [#932](https://github.com/joinworth/integration-service/pull/932)) ([#937](https://github.com/joinworth/integration-service/pull/937)) 🚂 release/v0.41.0

**[TIG-21](https://worth-ai.atlassian.net/browse/TIG-21) - Address Fact Issues**

- 🚜🚀 #LIVE Make sure Facts send when unresolved #REGULAR (Original PR: [#960](https://github.com/joinworth/integration-service/pull/960)) ([#984](https://github.com/joinworth/integration-service/pull/984)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE Revert "#LIVE Prevent null facts from resolving ([#956](https://github.com/joinworth/integration-service/pull/956))" #REGULAR (Original PR: [#961](https://github.com/joinworth/integration-service/pull/961)) ([#993](https://github.com/joinworth/integration-service/pull/993)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE Middesk Fact fixes #REGULAR (Original PR: [#947](https://github.com/joinworth/integration-service/pull/947)) ([#952](https://github.com/joinworth/integration-service/pull/952)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE Prevent null facts from resolving #REGULAR (Original PR: [#956](https://github.com/joinworth/integration-service/pull/956)) ([#957](https://github.com/joinworth/integration-service/pull/957)) 🚂 release/v0.41.0

**[TIG-5](https://worth-ai.atlassian.net/browse/TIG-5) - Confirm EFX, ZI, and OC are matching on DBA names and provided addresses**

- 🚜🚀 #LIVE fix: made previous working query as baseline query #REGULAR (Original PR: [#923](https://github.com/joinworth/integration-service/pull/923)) ([#924](https://github.com/joinworth/integration-service/pull/924)) 🚂 release/v0.41.0
- 🚜🚀 re-add normalization to base address #LIVE #REGULAR (Original PR: [#928](https://github.com/joinworth/integration-service/pull/928)) ([#929](https://github.com/joinworth/integration-service/pull/929)) 🚂 release/v0.41.0

### 📝 Other

**[DOS-548](https://worth-ai.atlassian.net/browse/DOS-548) - No title available**

- 🚜🚀 Incorrect Data Fetching by fetch Public Record API #LIVE #REGULAR (Original PR: [#962](https://github.com/joinworth/integration-service/pull/962)) ([#971](https://github.com/joinworth/integration-service/pull/971)) 🚂 release/v0.41.0

## [v0.41.0-canada-v8](https://github.com//joinworth/integration-service/compare/v0.41.0-canada-v7...v0.41.0-canada-v8) - 2025-05-20

### 🐛 Bug

**[PAT-460](https://worth-ai.atlassian.net/browse/PAT-460) - Fix Undefined Address Formatting for Canada**

- 🚜🚀 #LIVE : Extract CAN address components #REGULAR (Original PR: [#988](https://github.com/joinworth/integration-service/pull/988)) ([#992](https://github.com/joinworth/integration-service/pull/992)) 🚂 release/v0.41.0-canada-v8

### 📝 Other

- 📝 Make sure unresolved are in there

## [v0.41.0-canada-v7](https://github.com//joinworth/integration-service/compare/v0.41.0-canada-v6...v0.41.0-canada-v7) - 2025-05-20

### 🐛 Bug

**[PAT-460](https://worth-ai.atlassian.net/browse/PAT-460) - Fix Undefined Address Formatting for Canada**

- 🚜🚀 #LIVE : Extract CAN address components #REGULAR (Original PR: [#988](https://github.com/joinworth/integration-service/pull/988)) ([#991](https://github.com/joinworth/integration-service/pull/991)) 🚂 release/v0.41.0-canada-v7

## [v0.41.0-canada-v6](https://github.com//joinworth/integration-service/compare/v0.41.0-canada-v5...v0.41.0-canada-v6) - 2025-05-19

### 💻 Tech Task

**[TIG-21](https://worth-ai.atlassian.net/browse/TIG-21) - Address Fact Issues**

- 🚜🚀 Revert "Revert "#LIVE Revert "#LIVE Prevent null facts from resolving ([#956](https://github.com/joinworth/integration-service/pull/956))" #REGULAR (Original PR: [#961](https://github.com/joinworth/integration-service/pull/961)) ([#972](https://github.com/joinworth/integration-service/pull/972))"" 🚂 release/v0.41.0-canada-v1

## [v0.41.0-canada-v5](https://github.com//joinworth/integration-service/compare/v0.41.0-tiger-v6...v0.41.0-canada-v5) - 2025-05-19

### 🐛 Bug

**[PAT-460](https://worth-ai.atlassian.net/browse/PAT-460) - Fix Undefined Address Formatting for Canada**

- 🚀 #LIVE : Extract CAN address components ([#988](https://github.com/joinworth/integration-service/pull/988))

## [v0.41.0-tiger-v6](https://github.com//joinworth/integration-service/compare/v0.41.0-canada-v4...v0.41.0-tiger-v6) - 2025-05-19

### 💻 Tech Task

**[TIG-21](https://worth-ai.atlassian.net/browse/TIG-21) - Address Fact Issues**

- 🚜🚀 Revert "#LIVE Revert "#LIVE Prevent null facts from resolving ([#956](https://github.com/joinworth/integration-service/pull/956))" #REGULAR (Original PR: [#961](https://github.com/joinworth/integration-service/pull/961)) ([#972](https://github.com/joinworth/integration-service/pull/972))" 🚂 release/v0.41.0-canada-v1
- 🚜🚀 #LIVE Make sure Facts send when unresolved #REGULAR (Original PR: [#960](https://github.com/joinworth/integration-service/pull/960)) ([#985](https://github.com/joinworth/integration-service/pull/985)) 🚂 release/v0.41.0-tiger-v6

### 📝 Other

- 📝 Merge branch 'release/v0.41.0-tiger-v6' of https://github.com/joinworth/integration-service into release/v0.41.0-tiger-v6

## [v0.41.0-canada-v4](https://github.com//joinworth/integration-service/compare/v0.41.0-canada-v3...v0.41.0-canada-v4) - 2025-05-18

### ✨ Enhancement

**[PAT-450](https://worth-ai.atlassian.net/browse/PAT-450) - Update address fields to support Canada (API)**

- 🚜🚀 #LIVE: Updates OC match query to pull accurate addresses #REGULAR (Original PR: [#979](https://github.com/joinworth/integration-service/pull/979)) ([#981](https://github.com/joinworth/integration-service/pull/981)) 🚂 release/v0.41.0-canada-v1

## [v0.41.0-canada-v3](https://github.com//joinworth/integration-service/compare/v0.41.0-canada-v2...v0.41.0-canada-v3) - 2025-05-18

### ✨ Enhancement

**[PAT-450](https://worth-ai.atlassian.net/browse/PAT-450) - Update address fields to support Canada (API)**

- 🚜🚀 #LIVE: Runs query when "CAN, CA or Canada" used for Country. Adds uppercase to normalization for business name #REGULAR (Original PR: [#973](https://github.com/joinworth/integration-service/pull/973)) ([#976](https://github.com/joinworth/integration-service/pull/976)) 🚂 release/v0.41.0-canada-v1

**[PAT-452](https://worth-ai.atlassian.net/browse/PAT-452) - Update IDV to support Canada**

- 🚜🚀 Allow Canadian phone number #LIVE #REGULAR (Original PR: [#974](https://github.com/joinworth/integration-service/pull/974)) ([#975](https://github.com/joinworth/integration-service/pull/975)) 🚂 release/v0.41.0-canada-v1

## [v0.41.0-canada-v2](https://github.com//joinworth/integration-service/compare/v0.41.0-canada-v1...v0.41.0-canada-v2) - 2025-05-17

### 💻 Tech Task

**[TIG-21](https://worth-ai.atlassian.net/browse/TIG-21) - Address Fact Issues**

- 🚜🚀 #LIVE Revert "#LIVE Prevent null facts from resolving ([#956](https://github.com/joinworth/integration-service/pull/956))" #REGULAR (Original PR: [#961](https://github.com/joinworth/integration-service/pull/961)) ([#972](https://github.com/joinworth/integration-service/pull/972)) 🚂 release/v0.41.0-canada-v1

## [v0.41.0-canada-v1](https://github.com//joinworth/integration-service/compare/v0.41.0-tiger-v5...v0.41.0-canada-v1) - 2025-05-17

### ✨ Enhancement

**[PAT-450](https://worth-ai.atlassian.net/browse/PAT-450) - Update address fields to support Canada (API)**

- 🚜🚀 #LIVE Add query for Canadian businesses #REGULAR (Original PR: [#951](https://github.com/joinworth/integration-service/pull/951)) ([#965](https://github.com/joinworth/integration-service/pull/965)) 🚂 release/v0.41.0-canada-v1

**[PAT-452](https://worth-ai.atlassian.net/browse/PAT-452) - Update IDV to support Canada**

- 🚜🚀 Update IDV to support Canada #LIVE #REGULAR (Original PR: [#949](https://github.com/joinworth/integration-service/pull/949)) ([#963](https://github.com/joinworth/integration-service/pull/963)) 🚂 release/v0.41.0-canada-v1
- 🚜🚀 Add Canada to IDV #LIVE #REGULAR (Original PR: [#966](https://github.com/joinworth/integration-service/pull/966)) ([#968](https://github.com/joinworth/integration-service/pull/968)) 🚂 release/v0.41.0-canada-v1

### 📝 Other

**[DOS-548](https://worth-ai.atlassian.net/browse/DOS-548) - No title available**

- 🚜🚀 Incorrect Data Fetching by fetch Public Record API #LIVE #REGULAR (Original PR: [#962](https://github.com/joinworth/integration-service/pull/962)) ([#969](https://github.com/joinworth/integration-service/pull/969)) 🚂 release/v0.41.0-canada-v1

## [v0.41.0-tiger-v5](https://github.com//joinworth/integration-service/compare/v0.41.0-tiger-v4...v0.41.0-tiger-v5) - 2025-05-16

### 💻 Tech Task

**[TIG-21](https://worth-ai.atlassian.net/browse/TIG-21) - Address Fact Issues**

- 🚜🚀 #LIVE Middesk Fact fixes #REGULAR (Original PR: [#947](https://github.com/joinworth/integration-service/pull/947)) ([#953](https://github.com/joinworth/integration-service/pull/953)) 🚂 release/v0.41.0-tiger-v5
- 🚜🚀 #LIVE Prevent null facts from resolving #REGULAR (Original PR: [#956](https://github.com/joinworth/integration-service/pull/956)) ([#958](https://github.com/joinworth/integration-service/pull/958)) 🚂 release/v0.41.0-tiger-v5

## [v0.41.0-tiger-v4](https://github.com//joinworth/integration-service/compare/v0.41.0-tiger-v3...v0.41.0-tiger-v4) - 2025-05-15

### 📖 Story

**[TIG-15](https://worth-ai.atlassian.net/browse/TIG-15) - KYB/Business Details Facts Adjustments (names, address, phones, review count, naics)**

- 🚜🚀 Adjust more facts #LIVE #REGULAR (Original PR: [#943](https://github.com/joinworth/integration-service/pull/943)) ([#944](https://github.com/joinworth/integration-service/pull/944)) 🚂 release/v0.41.0-tiger-v4

## [v0.41.0-tiger-v3](https://github.com//joinworth/integration-service/compare/v0.41.0-tiger-v2.1...v0.41.0-tiger-v3) - 2025-05-14

### 💻 Tech Task

**[TIG-14](https://worth-ai.atlassian.net/browse/TIG-14) - Add "found\_" Facts for names+addresses**

- 🚜🚀 #LIVE Kyb found facts #REGULAR (Original PR: [#932](https://github.com/joinworth/integration-service/pull/932)) ([#936](https://github.com/joinworth/integration-service/pull/936)) 🚂 release/v0.41.0-tiger-v3

## [v0.41.0-tiger-v2.1](https://github.com//joinworth/integration-service/compare/v0.41.0-tiger-v2.0...v0.41.0-tiger-v2.1) - 2025-05-14

### 💻 Tech Task

**[TIG-5](https://worth-ai.atlassian.net/browse/TIG-5) - Confirm EFX, ZI, and OC are matching on DBA names and provided addresses**

- 🚜🚀 re-add normalization to base address #LIVE #REGULAR (Original PR: [#928](https://github.com/joinworth/integration-service/pull/928)) ([#930](https://github.com/joinworth/integration-service/pull/930)) 🚂 release/v0.41.0-tiger-v2

## [v0.41.0-tiger-v2.0](https://github.com//joinworth/integration-service/compare/v0.41.5...v0.41.0-tiger-v2.0) - 2025-05-13

### 💻 Tech Task

**[TIG-5](https://worth-ai.atlassian.net/browse/TIG-5) - Confirm EFX, ZI, and OC are matching on DBA names and provided addresses**

- 🚜🚀 #LIVE fix: made previous working query as baseline query #REGULAR (Original PR: [#923](https://github.com/joinworth/integration-service/pull/923)) ([#926](https://github.com/joinworth/integration-service/pull/926)) 🚂 release/v0.41.0-tiger-v2

## [v0.41.5](https://github.com//joinworth/integration-service/compare/v0.41.0-tiger-v1.1...v0.41.5) - 2025-05-12

### 📖 Story

**[PAT-387](https://worth-ai.atlassian.net/browse/PAT-387) - FE + BE | Show Uploaded Documents in New Section of Case View**

- 🚜🚀 #LIVE feat: Add API to fetch Tax, Processing History and Additional documents #REGULAR (Original PR: [#901](https://github.com/joinworth/integration-service/pull/901)) ([#912](https://github.com/joinworth/integration-service/pull/912)) 🚂 release/v0.41.0
- 🚜🚀 #LIVE feat: Add API to fetch Tax, Processing History and Additional documents #REGULAR (Original PR: [#910](https://github.com/joinworth/integration-service/pull/910)) ([#913](https://github.com/joinworth/integration-service/pull/913)) 🚂 release/v0.41.0

**[PAT-404](https://worth-ai.atlassian.net/browse/PAT-404) - Remove encryption from DOB in KYC response.**

- 🚜🚀 HOTFIX #LIVE Call upon new internal route for kyc to return unencrypted DOB #REGULAR (Original PR: [#914](https://github.com/joinworth/integration-service/pull/914)) ([#915](https://github.com/joinworth/integration-service/pull/915)) 🚂 release/v0.41.0

### 🧰 Task

**[INFRA-149](https://worth-ai.atlassian.net/browse/INFRA-149) - Add Custom Tag Support to GitHub Workflow**

- 🚜🚀 #LIVE Add custom tag name support to Create Tag workflow #REGULAR (Original PR: [#904](https://github.com/joinworth/integration-service/pull/904)) ([#906](https://github.com/joinworth/integration-service/pull/906)) 🚂 release/v0.41.0

### 🐛 Bug

**[PAT-401](https://worth-ai.atlassian.net/browse/PAT-401) - Null value in "creation_date" violates NOT NULL constraint in business_entity_website_data**

- 🚜🚀 #LIVE allow creation_date and expiration_date to be nullable #REGULAR (Original PR: [#899](https://github.com/joinworth/integration-service/pull/899)) ([#907](https://github.com/joinworth/integration-service/pull/907)) 🚂 release/v0.41.0

### 💻 Tech Task

**[TIG-1](https://worth-ai.atlassian.net/browse/TIG-1) - Expose match statistics as a /facts endpoint**

- 🚜🚀 Adds match & financials facts #LIVE #REGULAR (Original PR: [#902](https://github.com/joinworth/integration-service/pull/902)) ([#908](https://github.com/joinworth/integration-service/pull/908)) 🚂 release/v0.41.0

**[TIG-5](https://worth-ai.atlassian.net/browse/TIG-5) - Confirm EFX, ZI, and OC are matching on DBA names and provided addresses**

- 🚜🚀 #LIVE feat: passing dba-names and mailing-addresses to EFX Part - 1 #REGULAR (Original PR: [#911](https://github.com/joinworth/integration-service/pull/911)) ([#920](https://github.com/joinworth/integration-service/pull/920)) 🚂 release/v0.41.0

### 🛑 Defect

**[DOS-532](https://worth-ai.atlassian.net/browse/DOS-532) - [Staging] Quick Add - Send Invitation redirects to wrong page despite banking being top in sort order**

- 🚜🚀 Resolved the GIACT bug that was affecting the progression API. #LIVE #REGULAR (Original PR: [#917](https://github.com/joinworth/integration-service/pull/917)) ([#918](https://github.com/joinworth/integration-service/pull/918)) 🚂 release/v0.41.0

## [v0.41.0-tiger-v1.1](https://github.com//joinworth/integration-service/compare/v0.41.0-tiger-v1.0...v0.41.0-tiger-v1.1) - 2025-05-12

### 💻 Tech Task

**[TIG-5](https://worth-ai.atlassian.net/browse/TIG-5) - Confirm EFX, ZI, and OC are matching on DBA names and provided addresses**

- 🚜🚀 #LIVE feat: passing dba-names and mailing-addresses to EFX Part - 1 #REGULAR (Original PR: [#911](https://github.com/joinworth/integration-service/pull/911)) ([#921](https://github.com/joinworth/integration-service/pull/921)) 🚂 release/v0.41.0-tiger-v1

## [v0.41.0-tiger-v1.0](https://github.com//joinworth/integration-service/compare/v0.40.1...v0.41.0-tiger-v1.0) - 2025-05-09

### 💻 Tech Task

**[TIG-1](https://worth-ai.atlassian.net/browse/TIG-1) - Expose match statistics as a /facts endpoint**

- 🚜🚀 Adds match & financials facts #LIVE #REGULAR (Original PR: [#902](https://github.com/joinworth/integration-service/pull/902)) ([#909](https://github.com/joinworth/integration-service/pull/909)) 🚂 release/v0.41.0-tiger-v1

## [v0.40.1](https://github.com//joinworth/integration-service/compare/v0.40.0-fast-v1...v0.40.1) - 2025-04-29

### 🐛 Bug

**[PAT-405](https://worth-ai.atlassian.net/browse/PAT-405) - SOS Filings are showing empty**

- 🚜🚀 correctly concat OC sos filings #LIVE #REGULAR (Original PR: [#897](https://github.com/joinworth/integration-service/pull/897)) ([#898](https://github.com/joinworth/integration-service/pull/898)) 🚂 release/v0.40.0

## [v0.40.0-fast-v1](https://github.com//joinworth/integration-service/compare/v0.40.0...v0.40.0-fast-v1) - 2025-05-02

### 🐛 Bug

**[PAT-405](https://worth-ai.atlassian.net/browse/PAT-405) - SOS Filings are showing empty**

- 🚜🚀 correctly concat OC sos filings #LIVE #REGULAR (Original PR: [#897](https://github.com/joinworth/integration-service/pull/897)) ([#900](https://github.com/joinworth/integration-service/pull/900)) 🚂 release/v0.40.0-fast-v1

## [v0.40.0](https://github.com//joinworth/integration-service/compare/v0.39.0-main...v0.40.0) - 2025-04-24

### 📖 Story

**[PAT-396](https://worth-ai.atlassian.net/browse/PAT-396) - KYC Endpoint Refinements**

- 🚜🚀 #LIVE KYC Endpoint Optimizations #REGULAR (Original PR: [#894](https://github.com/joinworth/integration-service/pull/894)) ([#896](https://github.com/joinworth/integration-service/pull/896)) 🚂 release/v0.40.0

## [v0.39.0-main](https://github.com//joinworth/integration-service/compare/v0.38.7...v0.39.0-main) - 2025-04-18

### 📖 Story

**[DOS-247](https://worth-ai.atlassian.net/browse/DOS-247) - Add NPI number field in onboarding when the setting is enabled**

- 🚀 #LIVE Add NPI Library and Endpoint ([#786](https://github.com/joinworth/integration-service/pull/786))
- 🚀 #LIVE - Update roles on routes ([#797](https://github.com/joinworth/integration-service/pull/797))
- 🚀 #LIVE - Adds NPI matching request to bulk process job ([#801](https://github.com/joinworth/integration-service/pull/801))
- 🚀 #LIVE adds a length check to the npi param ([#804](https://github.com/joinworth/integration-service/pull/804))
- 🚀 #LIVE: Swap call to rely on task execution for npi search ([#816](https://github.com/joinworth/integration-service/pull/816))
- 🚀 #LIVE Stop verifying NPI and accept all submitted requests ([#825](https://github.com/joinworth/integration-service/pull/825))

**[DOS-257](https://worth-ai.atlassian.net/browse/DOS-257) - [BE] Display Bank Account Verification Results on Worth 360 Report**

- 🚀 FEAT: Display bank account verification results on 360 report #LIVE ([#798](https://github.com/joinworth/integration-service/pull/798))

**[DOS-317](https://worth-ai.atlassian.net/browse/DOS-317) - [FE+BE] Add IDV Verification Logic & Statuses to Ownership Pages**

- 🚀 custom idv verification logic implementation #LIVE ([#815](https://github.com/joinworth/integration-service/pull/815))
- 🚀 #LIVE Fix error response code of IDV token API ([#841](https://github.com/joinworth/integration-service/pull/841))

**[DOS-447](https://worth-ai.atlassian.net/browse/DOS-447) - New Template for lightning verify without SSN**

- 🚀 FEAT: NEW TEMPLATE FOR LIGHTNING VERIFICATION WITHOUT SSN #LIVE ([#861](https://github.com/joinworth/integration-service/pull/861))
- 🚀 FIX: LIGHTNING IDV WITHOUT SSN #LIVE ([#869](https://github.com/joinworth/integration-service/pull/869))
- 🚀 FIX: LIGHTNING IDV WITHOUT SSN #LIVE ([#870](https://github.com/joinworth/integration-service/pull/870))

**[PAT-159](https://worth-ai.atlassian.net/browse/PAT-159) - BE | Cases service should not determine when Verdata integration runs and TIN should not be necessary to run a Verdata request**

- 🚀 Public Records as Tasks #LIVE ([#795](https://github.com/joinworth/integration-service/pull/795))

**[PAT-274](https://worth-ai.atlassian.net/browse/PAT-274) - Maintain Historical Accuracy for Cases in Case Management**

- 🚀 #LIVE fix: Maintain Historical Accuracy for Cases in Case Management ([#826](https://github.com/joinworth/integration-service/pull/826))
- 🚀 #LIVE fix: Maintain Historical Accuracy for Cases in Case Management ([#828](https://github.com/joinworth/integration-service/pull/828))
- 🚀 #LIVE fix: Maintain Historical Accuracy for Cases in Case Management ([#835](https://github.com/joinworth/integration-service/pull/835))
- 🚀 #LIVE fix: not marking task as failed if connection is not success ([#863](https://github.com/joinworth/integration-service/pull/863))
- 🚀 #LIVE fix: complex query breakdown into simple one ([#868](https://github.com/joinworth/integration-service/pull/868))
- 🚀 #LIVE feat: Maintain Historical Accuracy for Cases in Case Management ([#867](https://github.com/joinworth/integration-service/pull/867))
- 🚀 #LIVE fix: deposite account data fetching fix ([#876](https://github.com/joinworth/integration-service/pull/876))

**[PAT-326](https://worth-ai.atlassian.net/browse/PAT-326) - API - KYC - Add Ownership Verification end point**

- 🚀 #LIVE feat: fetch kyc for owners ([#837](https://github.com/joinworth/integration-service/pull/837))
- 🚀 #LIVE feat: schema change ([#839](https://github.com/joinworth/integration-service/pull/839))
- 🚀 #LIVE feat: change error code ([#842](https://github.com/joinworth/integration-service/pull/842))

### 🧰 Task

**[INFRA-134](https://worth-ai.atlassian.net/browse/INFRA-134) - Cherry Pick automation action**

- 🚀 #LIVE Cherry Pick Action ([#827](https://github.com/joinworth/integration-service/pull/827))
- 🚀 #LIVE Cherry Pick Action ([#829](https://github.com/joinworth/integration-service/pull/829))
- 🚀 #LIVE Cherry Pick Action ([#834](https://github.com/joinworth/integration-service/pull/834))
- 🚀 #LIVE Update CherryPick action ([#844](https://github.com/joinworth/integration-service/pull/844))

**[INFRA-136](https://worth-ai.atlassian.net/browse/INFRA-136) - Add new tag #REGULAR in pr-title-format action**

- 🚀 #LIVE Update PR title action ([#836](https://github.com/joinworth/integration-service/pull/836))

**[INFRA-137](https://worth-ai.atlassian.net/browse/INFRA-137) - update create tag action for right tag format**

- 🚀 #LIVE Update Create Tag Action ([#838](https://github.com/joinworth/integration-service/pull/838))

**[INFRA-142](https://worth-ai.atlassian.net/browse/INFRA-142) - Modify branch is uptodate with main action step**

- 🚀 #LIVE Update branch up to date check ([#875](https://github.com/joinworth/integration-service/pull/875))

### 🐛 Bug

**[DOS-394](https://worth-ai.atlassian.net/browse/DOS-394) - Middesk website orders are not consistently being ordered**

- 🚀 #LIVE fix: return of website response ([#800](https://github.com/joinworth/integration-service/pull/800))

**[DOS-407](https://worth-ai.atlassian.net/browse/DOS-407) - Worth 360 | Error in Downloading/Endless Report Processing**

- 🚀 Resolved error in fetching public records for the Worth 360 report (Part 1) #LIVE ([#810](https://github.com/joinworth/integration-service/pull/810))

**[DOS-413](https://worth-ai.atlassian.net/browse/DOS-413) - GIACT | Error in task handler when account information not filled**

- 🚀 Fix: GIACT task handler issues #LIVE ([#817](https://github.com/joinworth/integration-service/pull/817))

**[DOS-429](https://worth-ai.atlassian.net/browse/DOS-429) - GIACT | Validation Error**

- 🚀 Update logic for validating wired routing numbers in bulk route. #LIVE ([#819](https://github.com/joinworth/integration-service/pull/819))

**[DOS-435](https://worth-ai.atlassian.net/browse/DOS-435) - Unable to select a deposit account**

- 🚀 Fixed issue preventing the selection of a deposit account. #LIVE ([#824](https://github.com/joinworth/integration-service/pull/824))

**[DOS-457](https://worth-ai.atlassian.net/browse/DOS-457) - [STAGING] Banking/deposits page is not fully loading**

- 🚀 Resolved Banking Loader Issue #LIVE ([#858](https://github.com/joinworth/integration-service/pull/858))

**[DOS-472](https://worth-ai.atlassian.net/browse/DOS-472) - [HOTFIX] GIACT does not appear to be running during bulk upload**

- 🔥🚀 Resolved bulk upload GIACT request invalid request issue #LIVE #HOTFIX ([#891](https://github.com/joinworth/integration-service/pull/891))

**[PAT-250](https://worth-ai.atlassian.net/browse/PAT-250) - [BE] Co-Applicant Section Completion Email Triggering on Every Edit**

- 🚀 #LIVE fix: redis key insertion ([#799](https://github.com/joinworth/integration-service/pull/799))

**[PAT-265](https://worth-ai.atlassian.net/browse/PAT-265) - [BE] Unable to export businesses from Worth Admin**

- 🚀 #LIVE Add Caching Middleware & Facts Calculated Kafka Event ([#818](https://github.com/joinworth/integration-service/pull/818))

**[PAT-311](https://worth-ai.atlassian.net/browse/PAT-311) - Not returning People in front end/API**

- 🚀 #LIVE Update KYB Facts for People ([#822](https://github.com/joinworth/integration-service/pull/822))

**[PAT-331](https://worth-ai.atlassian.net/browse/PAT-331) - API - FACTS KYB - Fix Incorrect address_match Response for KYB Endpoint**

- 🚀 #LIVE Don't ingest invalid addresses from middesk ([#872](https://github.com/joinworth/integration-service/pull/872))

**[PAT-371](https://worth-ai.atlassian.net/browse/PAT-371) - Middesk | Business creation rejected if state is not passed as 2 character uppercase**

- 🚀 #LIVE always send state as upper case ([#862](https://github.com/joinworth/integration-service/pull/862))

### ✨ Enhancement

**[DOS-387](https://worth-ai.atlassian.net/browse/DOS-387) - [BE] Middesk Failed TIN Orders**

- 🚩 #FLAG feat: middesk orders ([#802](https://github.com/joinworth/integration-service/pull/802))
- 🚀 #LIVE fix: website order ([#805](https://github.com/joinworth/integration-service/pull/805))
- 🚀 #LIVE fix: fixes for query ([#808](https://github.com/joinworth/integration-service/pull/808))
- 🚀 #LIVE fix: update query update and added logs ([#809](https://github.com/joinworth/integration-service/pull/809))
- 🚀 #LIVE fix: middesk added uniqueExternalId at all occurances and added logs ([#811](https://github.com/joinworth/integration-service/pull/811))
- 🚀 Fixed Errors Logged In Datadog #LIVE ([#812](https://github.com/joinworth/integration-service/pull/812))

**[DOS-423](https://worth-ai.atlassian.net/browse/DOS-423) - Implement Industry Mismatches Prompt Fix**

- 🚀 implement industry mismatches prompt fix #LIVE ([#823](https://github.com/joinworth/integration-service/pull/823))

**[DOS-440](https://worth-ai.atlassian.net/browse/DOS-440) - Update Giact Response Codes + No Match Labels**

- 🚀 FIX: UPDATE GAICT CODES AND MATCH NO MATCH LABELS #LIVE ([#864](https://github.com/joinworth/integration-service/pull/864))
- 🚀 FIX: UPDATE GAICT CODES AND MATCH NO MATCH LABELS #LIVE ([#874](https://github.com/joinworth/integration-service/pull/874))

**[PAT-30](https://worth-ai.atlassian.net/browse/PAT-30) - [BE] Remove transfers from calculation for income/expenses**

- 🚀 #LIVE exclude transfers from banking aggregate calculations ([#843](https://github.com/joinworth/integration-service/pull/843))

### 💻 Tech Task

**[PAT-343](https://worth-ai.atlassian.net/browse/PAT-343) - Integrate Plop in Backend Services**

- 🚀 #LIVE fix: Update Router in Index and Plopfile ([#860](https://github.com/joinworth/integration-service/pull/860))

### 📝 Other

**[DOS-381](https://worth-ai.atlassian.net/browse/DOS-381) - No title available**

- 🚀 Mock middesk tin timeout #LIVE ([#814](https://github.com/joinworth/integration-service/pull/814))

- 🚀 #NO_JIRA: #LIVE Build(deps): Bump axios from 1.7.4 to 1.8.2 ([#806](https://github.com/joinworth/integration-service/pull/806))
- 🚀 #NO_JIRA #LIVE fix: logs ([#807](https://github.com/joinworth/integration-service/pull/807))
- 🚀 #NO_JIRA #LIVE force there to be a primary address ([#832](https://github.com/joinworth/integration-service/pull/832))
- 🚀 #NO_JIRA #LIVE Plop Integration ([#813](https://github.com/joinworth/integration-service/pull/813))
- 🚀 #NO_JIRA #LIVE Make sure insert.onConflict.returning returns something ([#820](https://github.com/joinworth/integration-service/pull/820))

## [v0.38.7](https://github.com//joinworth/integration-service/compare/v0.38.6...v0.38.7) - 2025-04-18

### 🐛 Bug

**[DOS-472](https://worth-ai.atlassian.net/browse/DOS-472) - [HOTFIX] GIACT does not appear to be running during bulk upload**

- 🔥🚀 Resolved bulk upload GIACT request invalid request issue #LIVE #HOTFIX ([#891](https://github.com/joinworth/integration-service/pull/891))

## [v0.38.6](https://github.com//joinworth/integration-service/compare/v0.38.4...v0.38.6) - 2025-04-04

### 📖 Story

**[DOS-247](https://worth-ai.atlassian.net/browse/DOS-247) - Add NPI number field in onboarding when the setting is enabled**

- 🚜🚀 #LIVE Add NPI Library and Endpoint #REGULAR (Original PR: [#786](https://github.com/joinworth/integration-service/pull/786)) ([#851](https://github.com/joinworth/integration-service/pull/851)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE - Update roles on routes #REGULAR (Original PR: [#797](https://github.com/joinworth/integration-service/pull/797)) ([#852](https://github.com/joinworth/integration-service/pull/852)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE - Adds NPI matching request to bulk process job #REGULAR (Original PR: [#801](https://github.com/joinworth/integration-service/pull/801)) ([#853](https://github.com/joinworth/integration-service/pull/853)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE adds a length check to the npi param #REGULAR (Original PR: [#804](https://github.com/joinworth/integration-service/pull/804)) ([#854](https://github.com/joinworth/integration-service/pull/854)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE: Swap call to rely on task execution for npi search #REGULAR (Original PR: [#816](https://github.com/joinworth/integration-service/pull/816)) ([#855](https://github.com/joinworth/integration-service/pull/855)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE Stop verifying NPI and accept all submitted requests #REGULAR (Original PR: [#825](https://github.com/joinworth/integration-service/pull/825)) ([#856](https://github.com/joinworth/integration-service/pull/856)) 🚂 release/v0.38.0

**[DOS-317](https://worth-ai.atlassian.net/browse/DOS-317) - [FE+BE] Add IDV Verification Logic & Statuses to Ownership Pages**

- 🚜🚀 custom idv verification logic implementation #LIVE #REGULAR (Original PR: [#815](https://github.com/joinworth/integration-service/pull/815)) ([#846](https://github.com/joinworth/integration-service/pull/846)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE Fix error response code of IDV token API #REGULAR (Original PR: [#841](https://github.com/joinworth/integration-service/pull/841)) ([#847](https://github.com/joinworth/integration-service/pull/847)) 🚂 release/v0.38.0

**[PAT-326](https://worth-ai.atlassian.net/browse/PAT-326) - API - KYC - Add Ownership Verification end point**

- 🚜🚀 #LIVE feat: fetch kyc for owners #REGULAR (Original PR: [#837](https://github.com/joinworth/integration-service/pull/837)) ([#848](https://github.com/joinworth/integration-service/pull/848)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE feat: schema change #REGULAR (Original PR: [#839](https://github.com/joinworth/integration-service/pull/839)) ([#849](https://github.com/joinworth/integration-service/pull/849)) 🚂 release/v0.38.0
- 🚜🚀 #LIVE feat: change error code #REGULAR ([#850](https://github.com/joinworth/integration-service/pull/850)) 🚂 release/v0.38.0

### 🐛 Bug

**[DOS-457](https://worth-ai.atlassian.net/browse/DOS-457) - [STAGING] Banking/deposits page is not fully loading**

- 🚜🚀 Resolved Banking Loader Issue #LIVE #REGULAR (Original PR: [#858](https://github.com/joinworth/integration-service/pull/858)) ([#859](https://github.com/joinworth/integration-service/pull/859)) 🚂 release/v0.38.0

### ✨ Enhancement

**[DOS-423](https://worth-ai.atlassian.net/browse/DOS-423) - Implement Industry Mismatches Prompt Fix**

- 🚜🚀 implement industry mismatches prompt fix #LIVE #REGULAR (Original PR: [#823](https://github.com/joinworth/integration-service/pull/823)) ([#845](https://github.com/joinworth/integration-service/pull/845)) 🚂 release/v0.38.0

## [v0.38.4](https://github.com//joinworth/integration-service/compare/v0.38.2...v0.38.4) - 2025-04-02

### 🐛 Bug

**[DOS-413](https://worth-ai.atlassian.net/browse/DOS-413) - GIACT | Error in task handler when account information not filled**

- 🚀 Fix: GIACT task handler issues #LIVE ([#830](https://github.com/joinworth/integration-service/pull/830)) 🚂 release/v0.38.0

**[DOS-429](https://worth-ai.atlassian.net/browse/DOS-429) - GIACT | Validation Error**

- ⚡🚀 Update logic for validating wired routing numbers in bulk route. #LIVE ([#819](https://github.com/joinworth/integration-service/pull/819)) #FAST ([#833](https://github.com/joinworth/integration-service/pull/833))

**[DOS-435](https://worth-ai.atlassian.net/browse/DOS-435) - Unable to select a deposit account**

- 🚜🚀 Fixed issue preventing the selection of a deposit account. #LIVE #REGULAR ([#840](https://github.com/joinworth/integration-service/pull/840)) 🚂 release/v0.38.0

**[PAT-311](https://worth-ai.atlassian.net/browse/PAT-311) - Not returning People in front end/API**

- 🚀 #LIVE Update KYB Facts for People ([#831](https://github.com/joinworth/integration-service/pull/831)) 🚂 release/v0.38.0

## [v0.38.2](https://github.com//joinworth/integration-service/compare/v0.37.5...v0.38.2) - 2025-03-20

### 📖 Story

**[DOS-257](https://worth-ai.atlassian.net/browse/DOS-257) - [BE] Display Bank Account Verification Results on Worth 360 Report**

- 🚀 FEAT: Display bank account verification results on 360 report #LIVE ([#798](https://github.com/joinworth/integration-service/pull/798))

**[PAT-159](https://worth-ai.atlassian.net/browse/PAT-159) - BE | Cases service should not determine when Verdata integration runs and TIN should not be necessary to run a Verdata request**

- 🚀 Public Records as Tasks #LIVE ([#795](https://github.com/joinworth/integration-service/pull/795))

### 🐛 Bug

**[DOS-407](https://worth-ai.atlassian.net/browse/DOS-407) - Worth 360 | Error in Downloading/Endless Report Processing**

- 🚀 Resolved error in fetching public records for the Worth 360 report (Part 1) #LIVE ([#810](https://github.com/joinworth/integration-service/pull/810))

### 📝 Other

- 📝 Fix: remove npi route from router
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump axios from 1.7.4 to 1.8.2 ([#806](https://github.com/joinworth/integration-service/pull/806))

## [v0.37.5](https://github.com//joinworth/integration-service/compare/v0.37.3...v0.37.5) - 2025-03-18

### 📝 Other

**[DOS-381](https://worth-ai.atlassian.net/browse/DOS-381) - No title available**

- 🚀 Mock middesk tin timeout #LIVE ([#814](https://github.com/joinworth/integration-service/pull/814))

## [v0.37.3](https://github.com//joinworth/integration-service/compare/v0.36.3...v0.37.3) - 2025-03-13

### ✨ Enhancement

**[DOS-387](https://worth-ai.atlassian.net/browse/DOS-387) - [BE] Middesk Failed TIN Orders**

- 🚀 #LIVE fix: middesk added uniqueExternalId at all occurances and added logs ([#811](https://github.com/joinworth/integration-service/pull/811))
- 🚀 Fixed Errors Logged In Datadog #LIVE ([#812](https://github.com/joinworth/integration-service/pull/812))
- 🚀 #LIVE fix: update query update and added logs ([#809](https://github.com/joinworth/integration-service/pull/809))
- 🚩 #FLAG feat: middesk orders ([#802](https://github.com/joinworth/integration-service/pull/802))
- 🚀 #LIVE fix: website order ([#805](https://github.com/joinworth/integration-service/pull/805))
- 🚀 #LIVE fix: fixes for query ([#808](https://github.com/joinworth/integration-service/pull/808))

## [v0.36.3](https://github.com//joinworth/integration-service/compare/v0.36.1-HOTFIX...v0.36.3) - 2025-03-06

### 📖 Story

**[DOS-255](https://worth-ai.atlassian.net/browse/DOS-255) - [BE+FE] Display Verification Results on Case Management**

- 🚀 FEAT: Added bank verification result in response #LIVE ([#784](https://github.com/joinworth/integration-service/pull/784))

**[DOS-295](https://worth-ai.atlassian.net/browse/DOS-295) - [BE] Store Plaid IDV statuses and Plaid webhook responses in Database.**

- 🚀 #LIVE FEAT: STORE PLAID IDV WEBHOOK RESPONSE AND STATUSES IN DATABASE ([#787](https://github.com/joinworth/integration-service/pull/787))

**[DOS-346](https://worth-ai.atlassian.net/browse/DOS-346) - [BE] Add support for the `/bulk/process` (and Add Business) route to ingest deposit account information**

- 🚀 Add deposit account support to Bulk Process API (Part 1) #LIVE ([#782](https://github.com/joinworth/integration-service/pull/782))
- 🚀 Add deposit account support to Bulk Process API (Part 2) #LIVE ([#796](https://github.com/joinworth/integration-service/pull/796))

**[PAT-206](https://worth-ai.atlassian.net/browse/PAT-206) - [FE+BE] Show Adverse Media Data in Case Management**

- 🚀 #LIVE feat: get adverse media articles api ([#781](https://github.com/joinworth/integration-service/pull/781))

### 🧰 Task

**[INFRA-123](https://worth-ai.atlassian.net/browse/INFRA-123) - Dev Exp changes in BE and FE repos**

- 🚀 #LIVE Add redis condition for dev exp ([#780](https://github.com/joinworth/integration-service/pull/780))

**[INFRA-125](https://worth-ai.atlassian.net/browse/INFRA-125) - fix: issue where migration script not working locally**

- 🚀 #LIVE Fix - Resolved issue with migration script not working locally and updated Dockerfile.local ([#788](https://github.com/joinworth/integration-service/pull/788))

### 🐛 Bug

**[DOS-394](https://worth-ai.atlassian.net/browse/DOS-394) - Middesk website orders are not consistently being ordered**

- 🚀 #LIVE fix: return of website response ([#800](https://github.com/joinworth/integration-service/pull/800))

**[PAT-250](https://worth-ai.atlassian.net/browse/PAT-250) - [BE] Co-Applicant Section Completion Email Triggering on Every Edit**

- 🚀 #LIVE fix: trigger section completed event once ([#785](https://github.com/joinworth/integration-service/pull/785))
- 🚀 #LIVE fix: redis key naming convention ([#794](https://github.com/joinworth/integration-service/pull/794))
- 🚀 #LIVE fix: redis key insertion ([#799](https://github.com/joinworth/integration-service/pull/799))

**[PAT-267](https://worth-ai.atlassian.net/browse/PAT-267) - [FE+BE][HYPERCARE] Tax Integration**

- 🚀 #LIVE fix: error message ([#792](https://github.com/joinworth/integration-service/pull/792))

### 💻 Tech Task

**[PAT-162](https://worth-ai.atlassian.net/browse/PAT-162) - [BE] Flow Diagram in API-DOCS**

- 🚀 #LIVE fix: adding middlewares on routes ([#791](https://github.com/joinworth/integration-service/pull/791))

### 📝 Other

**[DOS-371](https://worth-ai.atlassian.net/browse/DOS-371) - No title available**

- 🚀 Fixed Formatting for SERP Addresses #LIVE ([#783](https://github.com/joinworth/integration-service/pull/783))

- 🚀 #NO_JIRA #LIVE fix: fixed cannot convert undefined/null to object error ([#790](https://github.com/joinworth/integration-service/pull/790))

## [v0.36.1-HOTFIX](https://github.com//joinworth/integration-service/compare/v0.36.1...v0.36.1-HOTFIX) - 2025-03-06

### 🐛 Bug

**[DOS-394](https://worth-ai.atlassian.net/browse/DOS-394) - Middesk website orders are not consistently being ordered**

- 🚀 #LIVE fix: return of website response ([#800](https://github.com/joinworth/integration-service/pull/800))

## [v0.36.1](https://github.com//joinworth/integration-service/compare/v0.35.3...v0.36.1) - 2025-02-27

### 📖 Story

**[DOS-253](https://worth-ai.atlassian.net/browse/DOS-253) - [BE] Pass Banking Information to GIACT for Verification During Onboarding**

- 🚀 FEAT: GIACT Integration Implementation (Part 2) #LIVE ([#773](https://github.com/joinworth/integration-service/pull/773))
- 🚀 FIX: GIACT RESPONSE CODE MAPPING ISSUE #LIVE ([#778](https://github.com/joinworth/integration-service/pull/778))
- 🚀 FIX: GIACT RESPONSE CODE MAPPING ISSUE #LIVE ([#779](https://github.com/joinworth/integration-service/pull/779))

### 🧰 Task

**[INFRA-123](https://worth-ai.atlassian.net/browse/INFRA-123) - Dev Exp changes in BE and FE repos**

- 🚀 #LIVE Add redis condition for dev exp ([#780](https://github.com/joinworth/integration-service/pull/780))

**[INFRA-125](https://worth-ai.atlassian.net/browse/INFRA-125) - fix: issue where migration script not working locally**

- 🚀 #LIVE Fix - Resolved issue with migration script not working locally and updated Dockerfile.local ([#788](https://github.com/joinworth/integration-service/pull/788))

### 🐛 Bug

**[DOS-349](https://worth-ai.atlassian.net/browse/DOS-349) - [Aurora User] [Hyper Care]"Continue Application" Email Button Redirects to Incorrect**

- 🚀 #LIVE - incorrect email redirect ([#777](https://github.com/joinworth/integration-service/pull/777))

**[PAT-192](https://worth-ai.atlassian.net/browse/PAT-192) - No title available**

- 🚀 #LIVE fix fetch_website_details error logs ([#763](https://github.com/joinworth/integration-service/pull/763))

## [v0.35.3](https://github.com//joinworth/integration-service/compare/v0.35.2...v0.35.3) - 2025-02-20

### 📖 Story

**[DOS-253](https://worth-ai.atlassian.net/browse/DOS-253) - [BE] Pass Banking Information to GIACT for Verification During Onboarding**

- 🚀 GIACT Integration Implementation (Part 1) #LIVE ([#765](https://github.com/joinworth/integration-service/pull/765))
- 🚀 FEAT: GIACT Integration Implementation (Part 2) #LIVE ([#773](https://github.com/joinworth/integration-service/pull/773))
- 🚀 FIX: GIACT RESPONSE CODE MAPPING ISSUE #LIVE ([#778](https://github.com/joinworth/integration-service/pull/778))
- 🚀 FIX: GIACT RESPONSE CODE MAPPING ISSUE #LIVE ([#779](https://github.com/joinworth/integration-service/pull/779))

**[PAT-205](https://worth-ai.atlassian.net/browse/PAT-205) - [BE] Generate and Store Adverse Media Data in DB**

- 🚀 #LIVE feat: adverse media (PART-I SETUP) ([#761](https://github.com/joinworth/integration-service/pull/761))
- 🚀 #LIVE feat: adverse media migration script ([#771](https://github.com/joinworth/integration-service/pull/771))
- 🚀 #LIVE feat: adverse media PART-II ([#764](https://github.com/joinworth/integration-service/pull/764))
- 🚀 #LIVE feat: data fetching from db ([#772](https://github.com/joinworth/integration-service/pull/772))
- 🚀 #LIVE fix: schema update ([#774](https://github.com/joinworth/integration-service/pull/774))
- 🚀 #LIVE fix: migration update ([#776](https://github.com/joinworth/integration-service/pull/776))

### 🐛 Bug

**[DOS-349](https://worth-ai.atlassian.net/browse/DOS-349) - [Aurora User] [Hyper Care]"Continue Application" Email Button Redirects to Incorrect**

- 🚀 #LIVE - incorrect email redirect ([#777](https://github.com/joinworth/integration-service/pull/777))

**[DOS-360](https://worth-ai.atlassian.net/browse/DOS-360) - No title available**

- 🚀 #LIVE Adjust plaid to use getOrCreateConnection ([#769](https://github.com/joinworth/integration-service/pull/769))

**[PAT-141](https://worth-ai.atlassian.net/browse/PAT-141) - BE | Risk Monitoring Toggle Button Issue on Admin Portal**

- 🚀 #LIVE fix: Ensure 'Risk Monitoring' toggle retains its default ON state after customer creation ([#696](https://github.com/joinworth/integration-service/pull/696))

**[PAT-221](https://worth-ai.atlassian.net/browse/PAT-221) - [HYPERCARE] Tax Integration**

- 🚀 #LIVE fix: logic update for connected integrations ([#767](https://github.com/joinworth/integration-service/pull/767))

### 💻 Tech Task

**[PAT-227](https://worth-ai.atlassian.net/browse/PAT-227) - [FE+BE] Shift deposit account handling to backend where possible**

- 🚀 #LIVE fix: deposit account handling ([#757](https://github.com/joinworth/integration-service/pull/757))
- 🚀 #LIVE fix: unique account set identifier ([#766](https://github.com/joinworth/integration-service/pull/766))

### 📝 Other

**[PAT-204](https://worth-ai.atlassian.net/browse/PAT-204) - No title available**

- 🚀 #LIVE feat: Enable/Disable Adverse Media and Risk Alerts for Customers ([#758](https://github.com/joinworth/integration-service/pull/758))
- 🚀 #LIVE feat: Enable/Disable Adverse Media and Risk Alerts for Customers ([#768](https://github.com/joinworth/integration-service/pull/768))

## [v0.35.2](https://github.com//joinworth/integration-service/compare/v0.35.0-HOTFIX...v0.35.2) - 2025-02-13

### 📖 Story

**[PAT-200](https://worth-ai.atlassian.net/browse/PAT-200) - Tax POC Integration**

- 🚀 #LIVE feat: migration for adding new platform as esign in ([#745](https://github.com/joinworth/integration-service/pull/745))
- 🚀 #LIVE feat: session token creation api ([#748](https://github.com/joinworth/integration-service/pull/748))
- 🚀 #LIVE fix: schema update and payload sanity ([#750](https://github.com/joinworth/integration-service/pull/750))
- 🚀 #LIVE FIXES ([#751](https://github.com/joinworth/integration-service/pull/751))

### 🧰 Task

**[INFRA-104](https://worth-ai.atlassian.net/browse/INFRA-104) - Auto approve deploy repo pr in dev**

- 🚀 #LIVE AUTO APPROVE AND MERGE ([#756](https://github.com/joinworth/integration-service/pull/756))

### 🐛 Bug

**[DOS-279](https://worth-ai.atlassian.net/browse/DOS-279) - No title available**

- 🚀 #LIVE - Applicant not found error on prod ([#752](https://github.com/joinworth/integration-service/pull/752))

**[DOS-326](https://worth-ai.atlassian.net/browse/DOS-326) - Business search fails when using single quote.**

- 🚀 #LIVE fix: search for ' in query ([#754](https://github.com/joinworth/integration-service/pull/754))

**[PAT-141](https://worth-ai.atlassian.net/browse/PAT-141) - BE | Risk Monitoring Toggle Button Issue on Admin Portal**

- 🚀 #LIVE fix: Ensure 'Risk Monitoring' toggle retains its default ON state after customer creation ([#696](https://github.com/joinworth/integration-service/pull/696))

**[PAT-221](https://worth-ai.atlassian.net/browse/PAT-221) - [HYPERCARE] Tax Integration**

- 🚀 #LIVE feat: connection based condition handling ([#755](https://github.com/joinworth/integration-service/pull/755))
- 🚀 #LIVE feat: fetching tax consent file from s3 ([#759](https://github.com/joinworth/integration-service/pull/759))
- 🚀 #LIVE fix: logic update for connected integrations ([#767](https://github.com/joinworth/integration-service/pull/767))

### ✨ Enhancement

**[DOS-319](https://worth-ai.atlassian.net/browse/DOS-319) - Issue with updating failed tax verification**

- 🚀 #LIVE reorder middesk on update ([#762](https://github.com/joinworth/integration-service/pull/762))

### 📝 Other

**[AT-200](https://worth-ai.atlassian.net/browse/AT-200) - No title available**

- 🚀 #LIVE feat: esign events consumer ([#749](https://github.com/joinworth/integration-service/pull/749))

- 📝 Merge branch 'release/v0.35.0-HOTFIX' into release/v0.35.1
- 🚀 #NO_JIRA #LIVE fix: build issue ([#753](https://github.com/joinworth/integration-service/pull/753))

**[PAT-204](https://worth-ai.atlassian.net/browse/PAT-204) - No title available**

- 🚀 #LIVE feat: Enable/Disable Adverse Media and Risk Alerts for Customers ([#758](https://github.com/joinworth/integration-service/pull/758))
- 🚀 #LIVE feat: Enable/Disable Adverse Media and Risk Alerts for Customers ([#768](https://github.com/joinworth/integration-service/pull/768))

## [v0.35.0-HOTFIX](https://github.com//joinworth/integration-service/compare/v0.34.4...v0.35.0-HOTFIX) - 2025-02-13

### 📖 Story

**[PAT-200](https://worth-ai.atlassian.net/browse/PAT-200) - Tax POC Integration**

- 🚀 #LIVE feat: session token creation api ([#748](https://github.com/joinworth/integration-service/pull/748))

### 🐛 Bug

**[DOS-360](https://worth-ai.atlassian.net/browse/DOS-360) - No title available**

- 🚀 #LIVE Adjust plaid to use getOrCreateConnection ([#769](https://github.com/joinworth/integration-service/pull/769))

## [v0.34.4](https://github.com//joinworth/integration-service/compare/v0.34.2...v0.34.4) - 2025-02-11

### 📖 Story

**[DOS-191](https://worth-ai.atlassian.net/browse/DOS-191) - As a user, I expect that adding businesses will submit to Middesk for website.**

- 🚀 #LIVE fix: passing website in metadata of a serp task ([#739](https://github.com/joinworth/integration-service/pull/739))

**[DOS-252](https://worth-ai.atlassian.net/browse/DOS-252) - [BE+FE] Enable GIACT Toggle in Banking Tab of Custom Onboarding**

- 🚀 Adding GIACT feature setting for customer (Part 1) #LIVE ([#732](https://github.com/joinworth/integration-service/pull/732))
- 🚀 Adding GIACT feature setting for customer (Part 2) #LIVE ([#742](https://github.com/joinworth/integration-service/pull/742))

### 🧰 Task

**[INFRA-100](https://worth-ai.atlassian.net/browse/INFRA-100) - Add LD test action in svc repo**

- 🚀 #LIVE Add LD TEST JOB ([#733](https://github.com/joinworth/integration-service/pull/733))

**[INFRA-103](https://worth-ai.atlassian.net/browse/INFRA-103) - Add author in BE deploy action title**

- 🚀 #LIVE Add author in title ([#740](https://github.com/joinworth/integration-service/pull/740))

**[INFRA-69](https://worth-ai.atlassian.net/browse/INFRA-69) - Add GitHub Actions Workflow for Automated Tag Creation**

- 🚀 #LIVE Add GitHub Actions Workflow for Automated Tag Creation ([#723](https://github.com/joinworth/integration-service/pull/723))

**[SEC-86](https://worth-ai.atlassian.net/browse/SEC-86) - [Vanta] Remediate "High vulnerabilities identified in packages are addressed (Github Repo)"**

- 🚀 #LIVE Regular Expression Denial of Service (ReDoS) in cross-spawn ([#736](https://github.com/joinworth/integration-service/pull/736))

### 🐛 Bug

**[DOS-279](https://worth-ai.atlassian.net/browse/DOS-279) - No title available**

- 🚀 #LIVE - Applicant not found error on PROD ([#741](https://github.com/joinworth/integration-service/pull/741))
- 🚀 #LIVE - Applicant not found error on prod ([#752](https://github.com/joinworth/integration-service/pull/752))(cherry picked from commit 815004559f546458bb9d15956e71bc58628d4828)

**[DOS-280](https://worth-ai.atlassian.net/browse/DOS-280) - No title available**

- 🚀 #LIVE fix: allow null in line_2 or apartment ([#737](https://github.com/joinworth/integration-service/pull/737))
- 🚀 #LIVE fix: validation schema update for detch_public_records_event ([#734](https://github.com/joinworth/integration-service/pull/734))

**[DOS-282](https://worth-ai.atlassian.net/browse/DOS-282) - OCR is still running when disabled**

- 🚀 FIX: DO NOT RUN OCR WHEN DISABLED #LIVE ([#729](https://github.com/joinworth/integration-service/pull/729))

**[PAT-163](https://worth-ai.atlassian.net/browse/PAT-163) - KYB Facts**

- 🚩 #FLAG Address Fact issues ([#724](https://github.com/joinworth/integration-service/pull/724))

**[PAT-187](https://worth-ai.atlassian.net/browse/PAT-187) - [IMP] Webhooks | Error Customer ID is required on PROD**

- 🚀 #LIVE fix: adding category ([#727](https://github.com/joinworth/integration-service/pull/727))
- 🚀 #LIVE fix: category fix ([#730](https://github.com/joinworth/integration-service/pull/730))

### ✨ Enhancement

**[DOS-319](https://worth-ai.atlassian.net/browse/DOS-319) - Issue with updating failed tax verification**

- 🚀 #LIVE reorder middesk on update ([#762](https://github.com/joinworth/integration-service/pull/762))

### 💻 Tech Task

**[PAT-195](https://worth-ai.atlassian.net/browse/PAT-195) - Remove jina.ai from SERP search/pre-filling logic**

- 🚀 #LIVE Remove Jina lookup ([#738](https://github.com/joinworth/integration-service/pull/738))

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: user token storing ([#744](https://github.com/joinworth/integration-service/pull/744))
- 🚀 #NO_JIRA #LIVE fix: build issue ([#753](https://github.com/joinworth/integration-service/pull/753))
- 🚀 #NO_JIRA #LIVE fix: local facts build issue fix ([#725](https://github.com/joinworth/integration-service/pull/725))
- 🚀 #NO_JIRA #LIVE fix: response update ([#726](https://github.com/joinworth/integration-service/pull/726))
- 🚀 #NO_JIRA #LIVE unify db configs ([#711](https://github.com/joinworth/integration-service/pull/711))
- 🚀 Revert "#NO_JIRA #LIVE unify db configs" ([#728](https://github.com/joinworth/integration-service/pull/728))

## [v0.34.2](https://github.com//joinworth/integration-service/compare/v0.0.164...v0.34.2) - 2025-01-30

### 🧰 Task

**[INFRA-103](https://worth-ai.atlassian.net/browse/INFRA-103) - Add author in BE deploy action title**

- 🚀 #LIVE Add author in title ([#740](https://github.com/joinworth/integration-service/pull/740))

**[SEC-86](https://worth-ai.atlassian.net/browse/SEC-86) - [Vanta] Remediate "High vulnerabilities identified in packages are addressed (Github Repo)"**

- 🚀 #LIVE Regular Expression Denial of Service (ReDoS) in cross-spawn ([#736](https://github.com/joinworth/integration-service/pull/736))

### 🐛 Bug

**[DOS-280](https://worth-ai.atlassian.net/browse/DOS-280) - No title available**

- 🚀 #LIVE fix: validation schema update for detch_public_records_event ([#734](https://github.com/joinworth/integration-service/pull/734))
- 🚀 #LIVE fix: allow null in line_2 or apartment ([#737](https://github.com/joinworth/integration-service/pull/737))

**[PAT-187](https://worth-ai.atlassian.net/browse/PAT-187) - [IMP] Webhooks | Error Customer ID is required on PROD**

- 🚀 #LIVE fix: category fix ([#730](https://github.com/joinworth/integration-service/pull/730))

### 📝 Other

- 📝 Fix: missing type
- 📝 Fix: cherry picked from commit b0b4b5346cee8c2c911ed2570e631c17dc3e63c5
- 📝 Fix: cherry picked from commit 3395ebbde91731ac9e75cb8050aac8c44f44c3e4
- 🚀 #NO_JIRA #LIVE unify db configs ([#711](https://github.com/joinworth/integration-service/pull/711))
- 🚀 Revert "#NO_JIRA #LIVE unify db configs" ([#728](https://github.com/joinworth/integration-service/pull/728))

## [v0.0.164](https://github.com//joinworth/integration-service/compare/v0.0.162...v0.0.164) - 2025-01-27

### 📖 Story

**[DOS-124](https://worth-ai.atlassian.net/browse/DOS-124) - Linking Multiple Accounts of Different Banks**

- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 10 ([#691](https://github.com/joinworth/integration-service/pull/691))

**[PAT-160](https://worth-ai.atlassian.net/browse/PAT-160) - BE | TIN should not be necessary to submit to Middesk**

- 🚀 #LIVE feat: tin is optional for middesk ([#700](https://github.com/joinworth/integration-service/pull/700))

**[PAT-80](https://worth-ai.atlassian.net/browse/PAT-80) - FE + BE | As a Worth Admin or Customer, I should see the KYB tab populated by Facts**

- 🚀 #LIVE get public records fixes ([#690](https://github.com/joinworth/integration-service/pull/690))

**[WIN-1131](https://worth-ai.atlassian.net/browse/WIN-1131) - [BE] Add Financials to PDF Report**

- 📝 Merge branch 'main' of github.com:joinworth/integration-service into feature/

### 🧰 Task

**[INFRA-100](https://worth-ai.atlassian.net/browse/INFRA-100) - Add LD test action in svc repo**

- 🚀 #LIVE Add LD TEST JOB ([#733](https://github.com/joinworth/integration-service/pull/733))

**[INFRA-69](https://worth-ai.atlassian.net/browse/INFRA-69) - Add GitHub Actions Workflow for Automated Tag Creation**

- 🚀 #LIVE Add GitHub Actions Workflow for Automated Tag Creation ([#723](https://github.com/joinworth/integration-service/pull/723))

**[INFRA-91](https://worth-ai.atlassian.net/browse/INFRA-91) - Quarterly hotfix report action**

- 🚀 #LIVE Hotfix Report Action ([#703](https://github.com/joinworth/integration-service/pull/703))

### 🐛 Bug

**[DOS-166](https://worth-ai.atlassian.net/browse/DOS-166) - Incorrect Case Creation During Business Onboarding When BJL Setting is Enabled**

- 🚀 #LIVE fix: don't create risk case for onboarding invite ([#713](https://github.com/joinworth/integration-service/pull/713))
- 🚀 #LIVE Fix: BJL risk alert fixes and code refactor ([#721](https://github.com/joinworth/integration-service/pull/721))

**[DOS-190](https://worth-ai.atlassian.net/browse/DOS-190) - Report Service: "At A Glance" Section Shows Incorrect Averages for VantageScore**

- 🚀 #LIVE - Report Service: "At A Glance" Section Shows Incorrect averages for VantageScore. ([#697](https://github.com/joinworth/integration-service/pull/697))

**[DOS-204](https://worth-ai.atlassian.net/browse/DOS-204) - Google Reviews Overlapping to Next Screen in 360 Reports - Public Records Page**

- 🚀 #LIVE - Google Reviews Overlapping to Next Screen in 360 Reports - Public Records Page ([#705](https://github.com/joinworth/integration-service/pull/705))

**[DOS-258](https://worth-ai.atlassian.net/browse/DOS-258) - [HOTFIX] [BE] Aurora unable to use Plaid Integration (Sandbox) in Production Environment**

- 🔥⚡🚀 Pulling #HOTFIX to main - Aurora unable to use Plaid Integration (Sandbox) in Production Environment #FAST #LIVE ([#708](https://github.com/joinworth/integration-service/pull/708))

**[DOS-282](https://worth-ai.atlassian.net/browse/DOS-282) - OCR is still running when disabled**

- 🚀 FIX: DO NOT RUN OCR WHEN DISABLED #LIVE ([#729](https://github.com/joinworth/integration-service/pull/729))

**[PAT-141](https://worth-ai.atlassian.net/browse/PAT-141) - BE | Risk Monitoring Toggle Button Issue on Admin Portal**

- 🚀 #LIVE fix: Ensure 'Risk Monitoring' toggle retains its default ON state after customer creation ([#699](https://github.com/joinworth/integration-service/pull/699))

**[PAT-187](https://worth-ai.atlassian.net/browse/PAT-187) - [IMP] Webhooks | Error Customer ID is required on PROD**

- 🚀 #LIVE fix: adding category ([#727](https://github.com/joinworth/integration-service/pull/727))
- 🚀 #LIVE fix: category fix ([#730](https://github.com/joinworth/integration-service/pull/730))

### ✨ Enhancement

**[DOS-161](https://worth-ai.atlassian.net/browse/DOS-161) - Update the progression API to include OCR for taxes**

- 🚀 #LIVE Taxes OCR ([#686](https://github.com/joinworth/integration-service/pull/686))
- 🚀 #LIVE Get Tax Filling API Changes ([#689](https://github.com/joinworth/integration-service/pull/689))
- 🚀 #LIVE Manual Tax Filing ([#694](https://github.com/joinworth/integration-service/pull/694))
- 🚀 #LIVE OCR for TAXES ([#698](https://github.com/joinworth/integration-service/pull/698))
- 🚀 #LIVE ([#702](https://github.com/joinworth/integration-service/pull/702))
- 🚀 #LIVE Get API fixes ([#704](https://github.com/joinworth/integration-service/pull/704))
- 🚀 #LIVE fixes typo and refactor of get tax filing API ([#706](https://github.com/joinworth/integration-service/pull/706))
- 🚀 #LIVE fix: period & form_type as nullable as their are not sure in OCR extraction ([#709](https://github.com/joinworth/integration-service/pull/709))
- 🚀 #LIVE fix: tax filing for multiple tasks ([#712](https://github.com/joinworth/integration-service/pull/712))

**[DOS-223](https://worth-ai.atlassian.net/browse/DOS-223) - [BE] Worth 360 | Add Individual Watchlist Details to 360**

- 🚀 Feat: Add Individual Watchlist to 360 Report #LIVE ([#710](https://github.com/joinworth/integration-service/pull/710))

**[DOS-237](https://worth-ai.atlassian.net/browse/DOS-237) - [FE+BE] Update Processing History - Point of Sale Volume**

- 🚀 Update Processing History - POS Volume (Part 1) #LIVE ([#693](https://github.com/joinworth/integration-service/pull/693))
- 🚀 Update Processing History - POS Volume (Part 2) #LIVE ([#695](https://github.com/joinworth/integration-service/pull/695))

**[DOS-38](https://worth-ai.atlassian.net/browse/DOS-38) - Individual Watchlist Details**

- 🚀 #LIVE Adds more Watchlist details to business_people table ([#685](https://github.com/joinworth/integration-service/pull/685))

**[PAT-149](https://worth-ai.atlassian.net/browse/PAT-149) - Send Processing Statements Data via Webhook**

- 🔥🚀 #LIVE processing statements webhook #HOTFIX_PULL_TO_MAIN ([#718](https://github.com/joinworth/integration-service/pull/718))
- 🚀 #LIVE rename column, add s3 link ([#719](https://github.com/joinworth/integration-service/pull/719))

**[PAT-174](https://worth-ai.atlassian.net/browse/PAT-174) - FE + BE | Equifax Vantage Score - Customer Setting**

- 🚀 #LIVE feat: customer setting equifax score ([#714](https://github.com/joinworth/integration-service/pull/714))
- 🚀 #LIVE fix: send error instead of response ([#720](https://github.com/joinworth/integration-service/pull/720))

### 📝 Other

- 🚀 #NO_JIRA: #LIVE Faker Scripts to autofill integrations ([#701](https://github.com/joinworth/integration-service/pull/701))
- 🚀 #NO_JIRA #LIVE fix: removing extra colon and braces ([#707](https://github.com/joinworth/integration-service/pull/707))
- 🚀 #NO_JIRA #LIVE fix: response update ([#726](https://github.com/joinworth/integration-service/pull/726))
- 🚀 #NO_JIRA #LIVE unify db configs ([#711](https://github.com/joinworth/integration-service/pull/711))
- 🚀 Revert "#NO_JIRA #LIVE unify db configs" ([#728](https://github.com/joinworth/integration-service/pull/728))

## [v0.0.162](https://github.com//joinworth/integration-service/compare/v0.0.160...v0.0.162) - 2025-01-24

### ✨ Enhancement

**[DOS-237](https://worth-ai.atlassian.net/browse/DOS-237) - [FE+BE] Update Processing History - Point of Sale Volume**

- 🚀 Update Processing History - POS Volume (Part 1) #LIVE ([#693](https://github.com/joinworth/integration-service/pull/693))
- 🚀 Update Processing History - POS Volume (Part 2) #LIVE ([#695](https://github.com/joinworth/integration-service/pull/695))

**[PAT-149](https://worth-ai.atlassian.net/browse/PAT-149) - Send Processing Statements Data via Webhook**

- 🚀 #LIVE rename column, add s3 link ([#719](https://github.com/joinworth/integration-service/pull/719))

### 📝 Other

- 📝 Fix: cherry pick
- 📝 Fix: cherry pick

## [v0.0.160](https://github.com//joinworth/integration-service/compare/v0.0.159...v0.0.160) - 2025-01-17

### ✨ Enhancement

**[PAT-149](https://worth-ai.atlassian.net/browse/PAT-149) - Send Processing Statements Data via Webhook**

- ⚡🚀 #LIVE processing statements webhook #FAST ([#717](https://github.com/joinworth/integration-service/pull/717))

## [v0.0.159](https://github.com//joinworth/integration-service/compare/v0.0.158...v0.0.159) - 2025-01-15

### 📝 Other

- 📝 Fix: fixed bug related plaid sandbox environment use in production environment

## [v0.0.158](https://github.com//joinworth/integration-service/compare/v0.0.157...v0.0.158) - 2025-01-09

### 📖 Story

**[DOS-124](https://worth-ai.atlassian.net/browse/DOS-124) - Linking Multiple Accounts of Different Banks**

- 🚀 Feat: cherry pick LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 10 ([#691](https://github.com/joinworth/integration-service/pull/691))
- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 1 ([#653](https://github.com/joinworth/integration-service/pull/653))
- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 2 ([#674](https://github.com/joinworth/integration-service/pull/674))
- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 3 ([#675](https://github.com/joinworth/integration-service/pull/675))
- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 4 ([#678](https://github.com/joinworth/integration-service/pull/678))
- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 5 ([#680](https://github.com/joinworth/integration-service/pull/680))
- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 6 ([#681](https://github.com/joinworth/integration-service/pull/681))
- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 7 ([#683](https://github.com/joinworth/integration-service/pull/683))
- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 8 ([#684](https://github.com/joinworth/integration-service/pull/684))
- 🚀 LINKING MULTIPLE ACCOUNTS OF DIFFERENT BANKS #LIVE PART 9 ([#688](https://github.com/joinworth/integration-service/pull/688))

**[DOS-134](https://worth-ai.atlassian.net/browse/DOS-134) - Show Banking Information on Worth 360 Report (Open Accounts)**

- 🚀 FIX: Enhancements to open accounts section 360 report #LIVE ([#677](https://github.com/joinworth/integration-service/pull/677))

**[PAT-80](https://worth-ai.atlassian.net/browse/PAT-80) - FE + BE | As a Worth Admin or Customer, I should see the KYB tab populated by Facts**

- 🚀 #LIVE get public records fixes ([#690](https://github.com/joinworth/integration-service/pull/690))

### 🐛 Bug

**[DOS-156](https://worth-ai.atlassian.net/browse/DOS-156) - On Company Overview: Under Website Review - Data is not populating**

- 🚀 #LIVE - On Company Overview: Under Website Review - Data is not populating ([#676](https://github.com/joinworth/integration-service/pull/676))
- 🚀 #LIVE - On Company Overview: Under Website Review - Data is not populating ([#682](https://github.com/joinworth/integration-service/pull/682))

### ✨ Enhancement

**[DOS-38](https://worth-ai.atlassian.net/browse/DOS-38) - Individual Watchlist Details**

- 🚀 #LIVE Partial Feat: Adds endpoint that returns people-related watchlist results ([#672](https://github.com/joinworth/integration-service/pull/672))
- 🚀 #LIVE Updates fetching logic for the watchlist results ([#673](https://github.com/joinworth/integration-service/pull/673))

### 💻 Tech Task

**[PAT-87](https://worth-ai.atlassian.net/browse/PAT-87) - [WAVE] Backfill OC/ZoomInfo Matches**

- 🚩 DRAFT #FLAG Use "old" python UDF to run similarity index calculation ([#657](https://github.com/joinworth/integration-service/pull/657))

### 📝 Other

- 🚀 #NO_JIRA #LIVE support personal tax data extraction ([#679](https://github.com/joinworth/integration-service/pull/679))
- 🚀 #NO_JIRA #LIVE fix: serp in public records fix ([#687](https://github.com/joinworth/integration-service/pull/687))

## [v0.0.157](https://github.com//joinworth/integration-service/compare/v0.0.156...v0.0.157) - 2025-01-06

### 💻 Tech Task

**[PAT-87](https://worth-ai.atlassian.net/browse/PAT-87) - [WAVE] Backfill OC/ZoomInfo Matches**

- 🚩 DRAFT #FLAG Use "old" python UDF to run similarity index calculation ([#657](https://github.com/joinworth/integration-service/pull/657))

## [v0.0.156](https://github.com//joinworth/integration-service/compare/v0.0.155...v0.0.156) - 2024-12-30

### 💻 Tech Task

**[PAT-150](https://worth-ai.atlassian.net/browse/PAT-150) - Enable testing in production against the Plaid sandbox**

- 🚩 #FLAG feat: plaid dynamic env ([#671](https://github.com/joinworth/integration-service/pull/671))

## [v0.0.155](https://github.com//joinworth/integration-service/compare/v0.0.154...v0.0.155) - 2024-12-26

### 🧰 Task

**[INFRA-88](https://worth-ai.atlassian.net/browse/INFRA-88) - No title available**

- 🚀 #LIVE CORS QA ENV ([#664](https://github.com/joinworth/integration-service/pull/664))

### 🐛 Bug

**[DOS-142](https://worth-ai.atlassian.net/browse/DOS-142) - On Public Records: Show Round Off Percentage Values and Add Reviewer Name**

- 🚀 #LIVE - On Public Records: Show Round Off Percentage Values and Add Reviewer Name ([#665](https://github.com/joinworth/integration-service/pull/665))

### 🧪 Spike

**[PAT-120](https://worth-ai.atlassian.net/browse/PAT-120) - Onboarding API Sequence Diagram**

- 🚀 #LIVE fix: tax status init fix ([#658](https://github.com/joinworth/integration-service/pull/658))

### 💻 Tech Task

**[DOS-171](https://worth-ai.atlassian.net/browse/DOS-171) - Connect OCR statements work with custom onboarding**

- 🚀 Processing history apis #LIVE ([#669](https://github.com/joinworth/integration-service/pull/669))

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: remove stale data ([#667](https://github.com/joinworth/integration-service/pull/667))
- 🚀 #NO_JIRA #LIVE get ocr document uploaded ([#668](https://github.com/joinworth/integration-service/pull/668))
- 🚀 #NO_JIRA #LIVE fix: cannot send error fix ([#670](https://github.com/joinworth/integration-service/pull/670))
- 🚀 #NO_JIRA #LIVE: Fixes 360 Reports Generation for Businesses with More than 2 Cases ([#666](https://github.com/joinworth/integration-service/pull/666))

## [v0.0.154](https://github.com//joinworth/integration-service/compare/v0.0.151...v0.0.154) - 2024-12-20

### 📖 Story

**[DOS-121](https://worth-ai.atlassian.net/browse/DOS-121) - Upgrade Plaid Integration to Support Multi-Item Linking**

- 🚀 UPGRADE PLAID INTEGRATION #LIVE ([#623](https://github.com/joinworth/integration-service/pull/623))

**[DOS-22](https://worth-ai.atlassian.net/browse/DOS-22) - Create Risk Case and Notification Alert for Low-to-High Score (risk) Movement After Score Refresh**

- 🚀 #LIVE feat: add risk config for low to high ([#628](https://github.com/joinworth/integration-service/pull/628))

**[DOS-8](https://worth-ai.atlassian.net/browse/DOS-8) - Integration with Verdata's BJL Data via API: Request and Ingest Data**

- 🚀 #LIVE - integration with verdatas bjl data via api request and ingest data ([#614](https://github.com/joinworth/integration-service/pull/614))

**[PAT-123](https://worth-ai.atlassian.net/browse/PAT-123) - As an admin, I expect to be able to export a csv of a customer's businesses.**

- 🚩 #FLAG: csv file download of all businesses data for a customer ([#660](https://github.com/joinworth/integration-service/pull/660))

**[PAT-14](https://worth-ai.atlassian.net/browse/PAT-14) - [FE+BE] Full Transactions in Case Management**

- 🚀 #LIVE feat: transaction details in case mgmt ([#631](https://github.com/joinworth/integration-service/pull/631))
- 🚀 #LIVE fix: customer access ([#639](https://github.com/joinworth/integration-service/pull/639))
- 🚀 #LIVE feat: send official and institution name ([#644](https://github.com/joinworth/integration-service/pull/644))

**[PAT-15](https://worth-ai.atlassian.net/browse/PAT-15) - [FE +BE] Display full balance sheet and P&L**

- 🚀 #LIVE feat: financials data (balancesheet and P&L statement) ([#611](https://github.com/joinworth/integration-service/pull/611))
- 🚀 #LIVE fix: response formatting ([#622](https://github.com/joinworth/integration-service/pull/622))

**[PAT-2](https://worth-ai.atlassian.net/browse/PAT-2) - [BE] Add support for multiple business names and business addresses**

- 🚀 #LIVE feat: added mailing_address in facts ([#618](https://github.com/joinworth/integration-service/pull/618))

**[PAT-69](https://worth-ai.atlassian.net/browse/PAT-69) - [BE] Send Emails When Sections Are Completed**

- 🚀 #LIVE feat: co-applicants email ([#634](https://github.com/joinworth/integration-service/pull/634))
- 🚀 #LIVE fix: banking deposite account section complete email ([#636](https://github.com/joinworth/integration-service/pull/636))

**[PAT-80](https://worth-ai.atlassian.net/browse/PAT-80) - FE + BE | As a Worth Admin or Customer, I should see the KYB tab populated by Facts**

- 🚀 #LIVE Fix KYB Map for Registrations ([#648](https://github.com/joinworth/integration-service/pull/648))
- 🚀 #LIVE KYB Adjustments ([#652](https://github.com/joinworth/integration-service/pull/652))

### 🧰 Task

**[INFRA-84](https://worth-ai.atlassian.net/browse/INFRA-84) - setup qa env**

- 🚀 #LIVE Setup QA env ([#630](https://github.com/joinworth/integration-service/pull/630))

**[INFRA-85](https://worth-ai.atlassian.net/browse/INFRA-85) - Add username in pr desc for backend pipelines**

- 🚀 #LIVE Add username in pr desc ([#632](https://github.com/joinworth/integration-service/pull/632))

### 🐛 Bug

**[DOS-141](https://worth-ai.atlassian.net/browse/DOS-141) - On Company Overview: Missing data**

- 🚀 #LIVE: Adds missing data for 360 Report ([#647](https://github.com/joinworth/integration-service/pull/647))

**[DOS-142](https://worth-ai.atlassian.net/browse/DOS-142) - On Public Records: Show Round Off Percentage Values and Add Reviewer Name**

- 🚀 #LIVE - On Public Records: Show Round Off Percentage Values and Add Reviewer Name ([#665](https://github.com/joinworth/integration-service/pull/665))
- 🚀 #LIVE - On Public Records: Show Round Off Percentage Values and Add Reviewer Name ([#661](https://github.com/joinworth/integration-service/pull/661))

**[DOS-174](https://worth-ai.atlassian.net/browse/DOS-174) - [FAST TRACK] - Website data not populating inside the Cases/Company tab under "Website Review"**

- ⚡🚀 #LIVE WEBSITE DATA ISSUE RESOLUTION #FAST ([#659](https://github.com/joinworth/integration-service/pull/659))
- ⚡🚀 #LIVE WEBSITE DATA ISSUE RESOLUTION #FAST PART 2 ([#662](https://github.com/joinworth/integration-service/pull/662))

**[PAT-139](https://worth-ai.atlassian.net/browse/PAT-139) - No title available**

- 🚀 #LIVE fix: bank account db insertion fix ([#656](https://github.com/joinworth/integration-service/pull/656))
- 🚀 #LIVE fix: business integration task not found error ([#663](https://github.com/joinworth/integration-service/pull/663))

**[PAT-48](https://worth-ai.atlassian.net/browse/PAT-48) - [BE] Unable to View Public Records/Brand Management Data**

- 🚀 #LIVE - unable to view public records brand management data ([#616](https://github.com/joinworth/integration-service/pull/616))
- 🚀 #LIVE - be unable to view public records brand management data ([#625](https://github.com/joinworth/integration-service/pull/625))

### ✨ Enhancement

**[DOS-35](https://worth-ai.atlassian.net/browse/DOS-35) - Implement Case-Specific Data Retrieval Logic for 360 Report on Download from Case View or Case Listing**

- 🚀 #LIVE - Implement Case-Specific Data Retrieval Logic for 360 Report on Download from Case View or Case Listing ([#637](https://github.com/joinworth/integration-service/pull/637))

**[DOS-37](https://worth-ai.atlassian.net/browse/DOS-37) - [BE] Implement "Synthetic Risk Score" and "Stolen Identity Risk Score" in the PDF 360 Report**

- 🚀 #LIVE: Update Report Fetcher to send Risk Scores ([#633](https://github.com/joinworth/integration-service/pull/633))
- 🚀 #LIVE - transform the caseDate fields to ISO strings ([#651](https://github.com/joinworth/integration-service/pull/651))

**[DOS-88](https://worth-ai.atlassian.net/browse/DOS-88) - Show Key Insights under Executive Summary in 360 Reports**

- 🚀 FEAT: Show Key Insights in 360 report #LIVE ([#641](https://github.com/joinworth/integration-service/pull/641))

**[PAT-124](https://worth-ai.atlassian.net/browse/PAT-124) - Support is corporation public flag**

- 🚩 #FLAG: feat: changes to fetch corporation type in facts api ([#638](https://github.com/joinworth/integration-service/pull/638))

**[PAT-64](https://worth-ai.atlassian.net/browse/PAT-64) - Update the SERP Logic**

- 🚀 #LIVE feat: serp logic update ([#635](https://github.com/joinworth/integration-service/pull/635))

**[PAT-79](https://worth-ai.atlassian.net/browse/PAT-79) - [FE + BE] As a user, I expect to be able to download an Equifax credit report.**

- 🚀 #LIVE feat: equifax credit report ([#640](https://github.com/joinworth/integration-service/pull/640))
- 🚀 #LIVE feat: official name ([#645](https://github.com/joinworth/integration-service/pull/645))
- 🚀 #LIVE fix: fixes for no key found s3 object ([#646](https://github.com/joinworth/integration-service/pull/646))
- 🚀 #LIVE feat: filter by case_id ([#654](https://github.com/joinworth/integration-service/pull/654))

### 💻 Tech Task

**[PAT-87](https://worth-ai.atlassian.net/browse/PAT-87) - [WAVE] Backfill OC/ZoomInfo Matches**

- 🚀 #LIVE Add Bulk OpenCorporates & ZoomInfo enqueue ([#649](https://github.com/joinworth/integration-service/pull/649))

### 📝 Other

- 🚀 #NO_JIRA #LIVE: Fixes 360 Reports Generation for Businesses with More than 2 Cases ([#666](https://github.com/joinworth/integration-service/pull/666))
- 🚀 #NO_JIRA #LIVE fix: remove stale data ([#667](https://github.com/joinworth/integration-service/pull/667))
- 🚀 #NO_JIRA #LIVE fix issue with middesk mapper ([#615](https://github.com/joinworth/integration-service/pull/615))
- 🚀 #NO_JIRA #LIVE updates to Ocr for processing statments ([#608](https://github.com/joinworth/integration-service/pull/608))
- 🚀 #NO_JIRA #LIVE Fix issues with Middesk Website Verification impacting Equifax ([#617](https://github.com/joinworth/integration-service/pull/617))
- 🚀 #NO_JIRA #LIVE - remove average_rating validation because this value can be empty ([#626](https://github.com/joinworth/integration-service/pull/626))
- 🚀 #NO_JIRA #LIVE fix: qa env kafka configs ([#629](https://github.com/joinworth/integration-service/pull/629))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump path-to-regexp and express ([#642](https://github.com/joinworth/integration-service/pull/642))
- 🚀 #NO_JIRA PRODUCTION ERROR LOG FIXES #LIVE ([#643](https://github.com/joinworth/integration-service/pull/643))
- 🚀 #NO_JIRA PRODUCTION ERROR LOG FIXES #LIVE ([#650](https://github.com/joinworth/integration-service/pull/650))
- 🚀 #NO_JIRA #LIVE Update Dockerfile ([#621](https://github.com/joinworth/integration-service/pull/621))
- 🚀 #NO_JIRA #LIVE add support for task workers ([#624](https://github.com/joinworth/integration-service/pull/624))
- 🚀 #NO_JIRA #LIVE ocr route updates ([#655](https://github.com/joinworth/integration-service/pull/655))

## [v0.0.150](https://github.com//joinworth/integration-service/compare/v0.0.149...v0.0.150) - 2024-12-17

### 🐛 Bug

**[DOS-141](https://worth-ai.atlassian.net/browse/DOS-141) - On Company Overview: Missing data**

- 🚀 #LIVE: Adds missing data for 360 Report ([#647](https://github.com/joinworth/integration-service/pull/647))

### ✨ Enhancement

**[DOS-35](https://worth-ai.atlassian.net/browse/DOS-35) - Implement Case-Specific Data Retrieval Logic for 360 Report on Download from Case View or Case Listing**

- 🚀 #LIVE - Implement Case-Specific Data Retrieval Logic for 360 Report on Download from Case View or Case Listing ([#637](https://github.com/joinworth/integration-service/pull/637))

**[DOS-37](https://worth-ai.atlassian.net/browse/DOS-37) - [BE] Implement "Synthetic Risk Score" and "Stolen Identity Risk Score" in the PDF 360 Report**

- 🚀 #LIVE: Update Report Fetcher to send Risk Scores ([#633](https://github.com/joinworth/integration-service/pull/633))
- 🚀 #LIVE - transform the caseDate fields to ISO strings ([#651](https://github.com/joinworth/integration-service/pull/651))

**[DOS-88](https://worth-ai.atlassian.net/browse/DOS-88) - Show Key Insights under Executive Summary in 360 Reports**

- 🚀 FEAT: Show Key Insights in 360 report #LIVE ([#641](https://github.com/joinworth/integration-service/pull/641))

## [v0.0.149](https://github.com//joinworth/integration-service/compare/v0.0.148...v0.0.149) - 2024-12-09

### ✨ Enhancement

**[PAT-124](https://worth-ai.atlassian.net/browse/PAT-124) - Support is corporation public flag**

- 🚩 #FLAG: feat: changes to fetch corporation type in facts api ([#638](https://github.com/joinworth/integration-service/pull/638))

## [v0.0.148](https://github.com//joinworth/integration-service/compare/v0.0.147...v0.0.148) - 2024-12-04

### 📖 Story

**[DOS-121](https://worth-ai.atlassian.net/browse/DOS-121) - Upgrade Plaid Integration to Support Multi-Item Linking**

- 🚀 UPGRADE PLAID INTEGRATION #LIVE ([#623](https://github.com/joinworth/integration-service/pull/623))

**[DOS-22](https://worth-ai.atlassian.net/browse/DOS-22) - Create Risk Case and Notification Alert for Low-to-High Score (risk) Movement After Score Refresh**

- 🚀 #LIVE feat: add risk config for low to high ([#628](https://github.com/joinworth/integration-service/pull/628))

**[DOS-8](https://worth-ai.atlassian.net/browse/DOS-8) - Integration with Verdata's BJL Data via API: Request and Ingest Data**

- 🚀 #LIVE - integration with verdatas bjl data via api request and ingest data ([#614](https://github.com/joinworth/integration-service/pull/614))

**[PAT-15](https://worth-ai.atlassian.net/browse/PAT-15) - [FE +BE] Display full balance sheet and P&L**

- 🚀 #LIVE feat: financials data (balancesheet and P&L statement) ([#611](https://github.com/joinworth/integration-service/pull/611))
- 🚀 #LIVE fix: response formatting ([#622](https://github.com/joinworth/integration-service/pull/622))

**[PAT-2](https://worth-ai.atlassian.net/browse/PAT-2) - [BE] Add support for multiple business names and business addresses**

- 🚀 #LIVE feat: added mailing_address in facts ([#618](https://github.com/joinworth/integration-service/pull/618))

### 🧰 Task

**[INFRA-84](https://worth-ai.atlassian.net/browse/INFRA-84) - setup qa env**

- 🚀 #LIVE Setup QA env ([#630](https://github.com/joinworth/integration-service/pull/630))

### 🐛 Bug

**[PAT-48](https://worth-ai.atlassian.net/browse/PAT-48) - [BE] Unable to View Public Records/Brand Management Data**

- 🚀 #LIVE - unable to view public records brand management data ([#616](https://github.com/joinworth/integration-service/pull/616))
- 🚀 #LIVE - be unable to view public records brand management data ([#625](https://github.com/joinworth/integration-service/pull/625))

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix issue with middesk mapper ([#615](https://github.com/joinworth/integration-service/pull/615))
- 🚀 #NO_JIRA #LIVE updates to Ocr for processing statments ([#608](https://github.com/joinworth/integration-service/pull/608))
- 🚀 #NO_JIRA #LIVE Fix issues with Middesk Website Verification impacting Equifax ([#617](https://github.com/joinworth/integration-service/pull/617))
- 🚀 #NO_JIRA #LIVE - remove average_rating validation because this value can be empty ([#626](https://github.com/joinworth/integration-service/pull/626))
- 🚀 #NO_JIRA #LIVE fix: qa env kafka configs ([#629](https://github.com/joinworth/integration-service/pull/629))

## [v0.0.147](https://github.com//joinworth/integration-service/compare/v0.0.146...v0.0.147) - 2024-11-19

### 📝 Other

**[DOS-84](https://worth-ai.atlassian.net/browse/DOS-84) - No title available**

- 🚩 #FLAG Resubmit to middesk if the business was not already submitted ([#613](https://github.com/joinworth/integration-service/pull/613))

## [v0.0.146](https://github.com//joinworth/integration-service/compare/v0.0.145...v0.0.146) - 2024-11-19

### ✨ Enhancement

**[PAT-76](https://worth-ai.atlassian.net/browse/PAT-76) - Send Account/Routing via Auth via webhook**

- 🚀 #LIVE: trigger business updated after deposit account is set ([#612](https://github.com/joinworth/integration-service/pull/612))

### 📝 Other

**[DOS-84](https://worth-ai.atlassian.net/browse/DOS-84) - No title available**

- 🚀 #LIVE feat: lightning verification ([#607](https://github.com/joinworth/integration-service/pull/607))

## [v0.0.145](https://github.com//joinworth/integration-service/compare/v0.0.142...v0.0.145) - 2024-11-18

### 📖 Story

**[DOS-1](https://worth-ai.atlassian.net/browse/DOS-1) - [BE] Add Tax Filings to PDF Report**

- 🚀 #LIVE feat: tax filing report data ([#590](https://github.com/joinworth/integration-service/pull/590))
- 🚀 tax filling issues #LIVE ([#595](https://github.com/joinworth/integration-service/pull/595))

**[DOS-2](https://worth-ai.atlassian.net/browse/DOS-2) - [BE] Add KYC/KYB to PDF Report**

- 🚀 Report kyc kyb #LIVE ([#581](https://github.com/joinworth/integration-service/pull/581))

**[DOS-3](https://worth-ai.atlassian.net/browse/DOS-3) - [BE] Add Public Records to PDF Report**

- 🚀 Feat: Add Public Records to Pdf Report #LIVE ([#591](https://github.com/joinworth/integration-service/pull/591))
- 🚀 FIX: ADD PUBLIC RECORDS TO PDF REPORT PART 2 #LIVE ([#592](https://github.com/joinworth/integration-service/pull/592))

**[DOS-34](https://worth-ai.atlassian.net/browse/DOS-34) - [BE] Open Accounts charts**

- 🚀 #LIVE - be open accounts charts ([#597](https://github.com/joinworth/integration-service/pull/597))
- 🚀 #LIVE - be open accounts charts ([#601](https://github.com/joinworth/integration-service/pull/601))
- 🚀 #LIVE - [BE] Open Accounts charts ([#585](https://github.com/joinworth/integration-service/pull/585))

**[DOS-4](https://worth-ai.atlassian.net/browse/DOS-4) - [BE] Add Executive Summary to PDF Report**

- 🚀 FEAT: Add Executive Summary to PDF Report #LIVE ([#600](https://github.com/joinworth/integration-service/pull/600))

**[DOS-5](https://worth-ai.atlassian.net/browse/DOS-5) - [BE] Add Financials to PDF Report**

- 🚀 financials report generation #LIVE ([#596](https://github.com/joinworth/integration-service/pull/596))
- 🚀 implement 360 report financials #LIVE ([#594](https://github.com/joinworth/integration-service/pull/594))

**[WIN-1066](https://worth-ai.atlassian.net/browse/WIN-1066) - [FE+BE] Display Download link for Worth 360 Report**

- 🚀 Add case ID for report #LIVE ([#576](https://github.com/joinworth/integration-service/pull/576))

**[WIN-1130](https://worth-ai.atlassian.net/browse/WIN-1130) - Add Open Accounts to PDF Report**

- 🚀 #LIVE - rename top10TrancationsByAmount to top10TransactionsByAmount ([#575](https://github.com/joinworth/integration-service/pull/575))

**[WIN-1201](https://worth-ai.atlassian.net/browse/WIN-1201) - Store and Display Fraud Check data from Plaid**

- 🚀 #LIVE Expose fraud check data in Applicant verification route. ([#565](https://github.com/joinworth/integration-service/pull/565))

### 🧰 Task

**[INFRA-49](https://worth-ai.atlassian.net/browse/INFRA-49) - Add JIRA Ticket Link as Comment and Objective in PR Title**

- 🚀 #LIVE Add JIRA ticket link as a comment and include objective in PR title ([#588](https://github.com/joinworth/integration-service/pull/588))

**[INFRA-8](https://worth-ai.atlassian.net/browse/INFRA-8) - Update GitHub Actions to Use Branch/Tag Naming Convention for Docker ImageTag**

- 🚀 #LIVE Update Docker Image Tagging Convention for Tag-Based Runs ([#589](https://github.com/joinworth/integration-service/pull/589))

### 🐛 Bug

**[DOS-16](https://worth-ai.atlassian.net/browse/DOS-16) - Update Agni to Angi**

- 🚀 update-agni-to-angi #LIVE ([#583](https://github.com/joinworth/integration-service/pull/583))

**[DOS-28](https://worth-ai.atlassian.net/browse/DOS-28) - Insights report is empty unexpectedly**

- 🚀 #LIVE fix: insights report format ([#578](https://github.com/joinworth/integration-service/pull/578))

**[DOS-32](https://worth-ai.atlassian.net/browse/DOS-32) - Cases are showing as auto-approved when score is hidden**

- 🚀 #LIVE: feat: fetch business metadata such as revenue & age ([#579](https://github.com/joinworth/integration-service/pull/579))

**[PAT-53](https://worth-ai.atlassian.net/browse/PAT-53) - [BE + FE] Banking Integration Information Not Visible on Review Screen During Onboarding**

- 🚀 #LIVE fix: banking info on review screen fix ([#605](https://github.com/joinworth/integration-service/pull/605))

### ✨ Enhancement

**[PAT-8](https://worth-ai.atlassian.net/browse/PAT-8) - Enable Industry and NAICS codes to be populated**

- 🚀 #LIVE: naics serp ([#598](https://github.com/joinworth/integration-service/pull/598))

### 🧪 Spike

**[PAT-10](https://worth-ai.atlassian.net/browse/PAT-10) - OpenCorporates+ZoomInfo: How to handle additional business_entity_verification providers in API + FrontEnds**

- 🚀 Poc facts #LIVE ([#599](https://github.com/joinworth/integration-service/pull/599))

### 💻 Tech Task

**[WIN-1449](https://worth-ai.atlassian.net/browse/WIN-1449) - Testing for ZoomInfo**

- 🚩 #FLAG ZoomInfo & OpenCorporates Enhancements ([#574](https://github.com/joinworth/integration-service/pull/574))

### 📝 Other

**[DOS-33](https://worth-ai.atlassian.net/browse/DOS-33) - No title available**

- 🚀 FIX EQUIFAX MATCHING INCORRECT DISTANCE ISSUE #LIVE ([#587](https://github.com/joinworth/integration-service/pull/587))

- 🚀 #NO_JIRA #LIVE fix: unnecessary logs handling ([#609](https://github.com/joinworth/integration-service/pull/609))
- 🚩 #NO_JIRA #FLAG fix: deposit account info get ([#610](https://github.com/joinworth/integration-service/pull/610))
- 🚀 #NO_JIRA #LIVE drop not null constraint on files.uploads display_name ([#602](https://github.com/joinworth/integration-service/pull/602))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump elliptic from 6.5.7 to 6.6.1 ([#604](https://github.com/joinworth/integration-service/pull/604))
- 🚀 #NO_JIRA #LIVE fix: tin decrypt error ([#606](https://github.com/joinworth/integration-service/pull/606))
- 🚀 #NO_JIRA #LIVE Bind "this" for task handler & add try/catch ([#580](https://github.com/joinworth/integration-service/pull/580))
- 🚀 #NO_JIRA #LIVE Make identity_abuse_signals field optional in IDV response ([#593](https://github.com/joinworth/integration-service/pull/593))

**[WIN-1118](https://worth-ai.atlassian.net/browse/WIN-1118) - No title available**

- 🚩 QA #FLAG Race condition with creating/retrieving connection record ([#577](https://github.com/joinworth/integration-service/pull/577))

## [v0.0.142](https://github.com//joinworth/integration-service/compare/v0.0.141...v0.0.142) - 2024-11-06

### 🐛 Bug

**[DOS-28](https://worth-ai.atlassian.net/browse/DOS-28) - Insights report is empty unexpectedly**

- 🚀 #LIVE fix: insights report format ([#578](https://github.com/joinworth/integration-service/pull/578))

**[DOS-32](https://worth-ai.atlassian.net/browse/DOS-32) - Cases are showing as auto-approved when score is hidden**

- 🚀 #LIVE: feat: fetch business metadata such as revenue & age ([#579](https://github.com/joinworth/integration-service/pull/579))

## [v0.0.141](https://github.com//joinworth/integration-service/compare/v0.0.139...v0.0.141) - 2024-10-31

### 📖 Story

**[WIN-1066](https://worth-ai.atlassian.net/browse/WIN-1066) - [FE+BE] Display Download link for Worth 360 Report**

- 🚀 Add case ID for report #LIVE ([#576](https://github.com/joinworth/integration-service/pull/576))

**[WIN-1128](https://worth-ai.atlassian.net/browse/WIN-1128) - Add Company Overview to PDF Report**

- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 1 ([#557](https://github.com/joinworth/integration-service/pull/557))
- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 2 ([#561](https://github.com/joinworth/integration-service/pull/561))

**[WIN-1130](https://worth-ai.atlassian.net/browse/WIN-1130) - Add Open Accounts to PDF Report**

- 🚀 #LIVE - create function to get open account data ([#558](https://github.com/joinworth/integration-service/pull/558))
- 🚀 #LIVE - format date and amount in the queries for Open Accounts ([#570](https://github.com/joinworth/integration-service/pull/570))
- 🚀 #LIVE - rename top10TrancationsByAmount to top10TransactionsByAmount ([#575](https://github.com/joinworth/integration-service/pull/575))

**[WIN-1318](https://worth-ai.atlassian.net/browse/WIN-1318) - Aurora | Routing and Account Number via Auth**

- 🚩 #FLAG feat: aurora deposit account [] ([#535](https://github.com/joinworth/integration-service/pull/535))

**[WIN-1434](https://worth-ai.atlassian.net/browse/WIN-1434) - [FE+BE] Aurora | Enable Deposit Account Selection and Display to Enterprise Customer**

- 🚩 #FLAG feat: set deposit account info ([#549](https://github.com/joinworth/integration-service/pull/549))
- 🚩 #FLAG fix: deposit account info response ([#562](https://github.com/joinworth/integration-service/pull/562))
- 🚩 #FLAG fix: purge bank account ([#563](https://github.com/joinworth/integration-service/pull/563))
- 🚩 #FLAGF fix: empty bank account on banking reconnect ([#564](https://github.com/joinworth/integration-service/pull/564))
- 🚩 #FLAG fix: response format ([#568](https://github.com/joinworth/integration-service/pull/568))

**[WIN-1446](https://worth-ai.atlassian.net/browse/WIN-1446) - [BE] Update the business.updated event to include custom fields, owners, and documents**

- 🚀 #LIVE business updated event ([#567](https://github.com/joinworth/integration-service/pull/567))

### 🧰 Task

**[INFRA-12](https://worth-ai.atlassian.net/browse/INFRA-12) - Implement GitHub Action to Cleanup Release Branches**

- 🚀 #LIVE clean-release-branches ([#449](https://github.com/joinworth/integration-service/pull/449))

**[INFRA-28](https://worth-ai.atlassian.net/browse/INFRA-28) - Cache yq Binary in GitHub Actions Workflow**

- 🚀 #LIVE Update yq step ([#555](https://github.com/joinworth/integration-service/pull/555))

**[INFRA-30](https://worth-ai.atlassian.net/browse/INFRA-30) - Ensure Branch is Up-to-Date with Main Before Build and Deploy**

- 🚀 #LIVE Add check to ensure branch is up-to-date with main before build ([#573](https://github.com/joinworth/integration-service/pull/573))

**[INFRA-35](https://worth-ai.atlassian.net/browse/INFRA-35) - Update CICD pipeline versions to fix actions warning**

- 🚀 #LIVE Fix/image tag update warning ([#550](https://github.com/joinworth/integration-service/pull/550))

### 🐛 Bug

**[WIN-1415](https://worth-ai.atlassian.net/browse/WIN-1415) - Easyflow| After continue from additional info. then again it taking me to let's get started screen**

- 🚀 #LIVE fix: easy flow middesk tin verification ([#542](https://github.com/joinworth/integration-service/pull/542))

**[WIN-1452](https://worth-ai.atlassian.net/browse/WIN-1452) - [BE] SERP is not pulling multiple business matches**

- 🚀 #LIVE HOTFIX-PULL-TO-MAIN fix: putting 0th local match for bulk method only ([#548](https://github.com/joinworth/integration-service/pull/548))

### ✨ Enhancement

**[WIN-1286](https://worth-ai.atlassian.net/browse/WIN-1286) - SERP Delays**

- 🚀 #LIVE remove serp api website and industrious data. ([#529](https://github.com/joinworth/integration-service/pull/529))
- 🚀 #LIVE - SERP Delays ([#551](https://github.com/joinworth/integration-service/pull/551))

**[WIN-1289](https://worth-ai.atlassian.net/browse/WIN-1289) - [FE+BE] Update Risk Alert Trigger Logic for Risk Tiers**

- 🚀 UPDATE RISK ALERTS #LIVE ([#527](https://github.com/joinworth/integration-service/pull/527))

**[WIN-1382](https://worth-ai.atlassian.net/browse/WIN-1382) - [FE+BE] Update Middesk website request**

- 🚀 #LIVE fix: on submit only fetch and not order for website ([#543](https://github.com/joinworth/integration-service/pull/543))
- 🚀 MIDDESK FIX #LIVE ([#546](https://github.com/joinworth/integration-service/pull/546))

### 🧪 Spike

**[WIN-1155](https://worth-ai.atlassian.net/browse/WIN-1155) - ZoomInfo POC Implementation**

- 🚩 #FLAG Zoom info ([#545](https://github.com/joinworth/integration-service/pull/545))

### 💻 Tech Task

**[WIN-1449](https://worth-ai.atlassian.net/browse/WIN-1449) - Testing for ZoomInfo**

- 🚩 #FLAG ZoomInfo & OpenCorporates Enhancements ([#574](https://github.com/joinworth/integration-service/pull/574))

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: construct plaid data based on business-id ([#547](https://github.com/joinworth/integration-service/pull/547))
- 🚀 #NO_JIRA #LIVE fix: website, adding default case ([#560](https://github.com/joinworth/integration-service/pull/560))
- 🚀 #NO_JIRA #LIVE Queue Integrations Business Kafka Events ([#566](https://github.com/joinworth/integration-service/pull/566))
- 🚀 #NO_JIRA #LIVE Fix job ids ([#569](https://github.com/joinworth/integration-service/pull/569))
- 🚀 #NO_JIRA #LIVE fix: authenticate api send webhook event ([#571](https://github.com/joinworth/integration-service/pull/571))
- 🚀 #NO_JIRA #LIVE fix: authenticate api ([#572](https://github.com/joinworth/integration-service/pull/572))

**[WIN-1118](https://worth-ai.atlassian.net/browse/WIN-1118) - No title available**

- 🚀 #LIVE Handle if a db connection already exists ([#544](https://github.com/joinworth/integration-service/pull/544))
- 🚩 QA #FLAG Race condition with creating/retrieving connection record ([#577](https://github.com/joinworth/integration-service/pull/577))

**[WIN-1317](https://worth-ai.atlassian.net/browse/WIN-1317) - No title available**

- 🚀 #LIVE - Include Similarity Index in RDS ([#556](https://github.com/joinworth/integration-service/pull/556))

## [v0.0.139](https://github.com//joinworth/integration-service/compare/v0.0.138...v0.0.139) - 2024-10-25

### 📝 Other

- 🚀 #NO_JIRA #LIVE Fix job ids ([#569](https://github.com/joinworth/integration-service/pull/569))

## [v0.0.138](https://github.com//joinworth/integration-service/compare/v0.0.137...v0.0.138) - 2024-10-24

### 📝 Other

- 🚀 #NO_JIRA #LIVE Queue Integrations Business Kafka Events ([#566](https://github.com/joinworth/integration-service/pull/566))

## [v0.0.137](https://github.com//joinworth/integration-service/compare/v0.0.136...v0.0.137) - 2024-10-24

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: website, adding default case ([#560](https://github.com/joinworth/integration-service/pull/560))

## [v0.0.136](https://github.com//joinworth/integration-service/compare/v0.0.135...v0.0.136) - 2024-10-23

### 🧰 Task

**[INFRA-12](https://worth-ai.atlassian.net/browse/INFRA-12) - Implement GitHub Action to Cleanup Release Branches**

- 🚀 #LIVE clean-release-branches ([#449](https://github.com/joinworth/integration-service/pull/449))

**[INFRA-28](https://worth-ai.atlassian.net/browse/INFRA-28) - Cache yq Binary in GitHub Actions Workflow**

- 🚀 #LIVE Update yq step ([#555](https://github.com/joinworth/integration-service/pull/555))

**[INFRA-35](https://worth-ai.atlassian.net/browse/INFRA-35) - Update CICD pipeline versions to fix actions warning**

- 🚀 #LIVE Fix/image tag update warning ([#550](https://github.com/joinworth/integration-service/pull/550))

### 🐛 Bug

**[WIN-1415](https://worth-ai.atlassian.net/browse/WIN-1415) - Easyflow| After continue from additional info. then again it taking me to let's get started screen**

- 🚀 #LIVE fix: easy flow middesk tin verification ([#542](https://github.com/joinworth/integration-service/pull/542))

**[WIN-1437](https://worth-ai.atlassian.net/browse/WIN-1437) - Production | Middesk Not Running on Most New Customers**

- 🚀 #LIVE fix: Middesk webhook handler ([#536](https://github.com/joinworth/integration-service/pull/536))
- 🚀 #LIVE fix: json response for serp ([#540](https://github.com/joinworth/integration-service/pull/540))

**[WIN-1452](https://worth-ai.atlassian.net/browse/WIN-1452) - [BE] SERP is not pulling multiple business matches**

- 🚀 #LIVE HOTFIX-PULL-TO-MAIN fix: putting 0th local match for bulk method only ([#548](https://github.com/joinworth/integration-service/pull/548))

### ✨ Enhancement

**[WIN-1289](https://worth-ai.atlassian.net/browse/WIN-1289) - [FE+BE] Update Risk Alert Trigger Logic for Risk Tiers**

- 🚀 UPDATE RISK ALERTS #LIVE ([#527](https://github.com/joinworth/integration-service/pull/527))

**[WIN-1382](https://worth-ai.atlassian.net/browse/WIN-1382) - [FE+BE] Update Middesk website request**

- 🚀 #LIVE fix: middesk business id ([#539](https://github.com/joinworth/integration-service/pull/539))
- 🚀 #LIVE fix: on submit only fetch and not order for website ([#543](https://github.com/joinworth/integration-service/pull/543))
- 🚀 MIDDESK FIX #LIVE ([#546](https://github.com/joinworth/integration-service/pull/546))

### 🧪 Spike

**[WIN-1155](https://worth-ai.atlassian.net/browse/WIN-1155) - ZoomInfo POC Implementation**

- 🚩 #FLAG Zoom info ([#545](https://github.com/joinworth/integration-service/pull/545))

### 📝 Other

- 🚀 #NO_JIRA #LIVE fix: dlq fix ([#541](https://github.com/joinworth/integration-service/pull/541))
- 🚀 #NO_JIRA #LIVE fix: construct plaid data based on business-id ([#547](https://github.com/joinworth/integration-service/pull/547))

## [v0.0.135](https://github.com//joinworth/integration-service/compare/v.0.0.153...v0.0.135) - 2024-10-16

### ✨ Enhancement

**[WIN-1382](https://worth-ai.atlassian.net/browse/WIN-1382) - [FE+BE] Update Middesk website request**

- 🚀 #LIVE fix: middesk business id ([#539](https://github.com/joinworth/integration-service/pull/539))
- 🚀 #LIVE fix: on submit only fetch and not order for website ([#543](https://github.com/joinworth/integration-service/pull/543))
- 🚀 MIDDESK FIX #LIVE ([#546](https://github.com/joinworth/integration-service/pull/546))

### 📝 Other

- 📝 Fix: putting 0th local match for bulk method only

## [v.0.0.153](https://github.com//joinworth/integration-service/compare/v0.0.128...v.0.0.153) - 2024-12-19

### 📖 Story

**[DOS-1](https://worth-ai.atlassian.net/browse/DOS-1) - [BE] Add Tax Filings to PDF Report**

- 🚀 #LIVE feat: tax filing report data ([#590](https://github.com/joinworth/integration-service/pull/590))
- 🚀 tax filling issues #LIVE ([#595](https://github.com/joinworth/integration-service/pull/595))

**[DOS-121](https://worth-ai.atlassian.net/browse/DOS-121) - Upgrade Plaid Integration to Support Multi-Item Linking**

- 🚀 UPGRADE PLAID INTEGRATION #LIVE ([#623](https://github.com/joinworth/integration-service/pull/623))

**[DOS-2](https://worth-ai.atlassian.net/browse/DOS-2) - [BE] Add KYC/KYB to PDF Report**

- 🚀 Report kyc kyb #LIVE ([#581](https://github.com/joinworth/integration-service/pull/581))

**[DOS-22](https://worth-ai.atlassian.net/browse/DOS-22) - Create Risk Case and Notification Alert for Low-to-High Score (risk) Movement After Score Refresh**

- 🚀 #LIVE feat: add risk config for low to high ([#628](https://github.com/joinworth/integration-service/pull/628))

**[DOS-3](https://worth-ai.atlassian.net/browse/DOS-3) - [BE] Add Public Records to PDF Report**

- 🚀 Feat: Add Public Records to Pdf Report #LIVE ([#591](https://github.com/joinworth/integration-service/pull/591))
- 🚀 FIX: ADD PUBLIC RECORDS TO PDF REPORT PART 2 #LIVE ([#592](https://github.com/joinworth/integration-service/pull/592))

**[DOS-34](https://worth-ai.atlassian.net/browse/DOS-34) - [BE] Open Accounts charts**

- 🚀 #LIVE - be open accounts charts ([#597](https://github.com/joinworth/integration-service/pull/597))
- 🚀 #LIVE - be open accounts charts ([#601](https://github.com/joinworth/integration-service/pull/601))
- 🚀 #LIVE - [BE] Open Accounts charts ([#585](https://github.com/joinworth/integration-service/pull/585))

**[DOS-4](https://worth-ai.atlassian.net/browse/DOS-4) - [BE] Add Executive Summary to PDF Report**

- 🚀 FEAT: Add Executive Summary to PDF Report #LIVE ([#600](https://github.com/joinworth/integration-service/pull/600))

**[DOS-8](https://worth-ai.atlassian.net/browse/DOS-8) - Integration with Verdata's BJL Data via API: Request and Ingest Data**

- 🚀 #LIVE - integration with verdatas bjl data via api request and ingest data ([#614](https://github.com/joinworth/integration-service/pull/614))

**[PAT-123](https://worth-ai.atlassian.net/browse/PAT-123) - As an admin, I expect to be able to export a csv of a customer's businesses.**

- 🚩 #FLAG: csv file download of all businesses data for a customer ([#660](https://github.com/joinworth/integration-service/pull/660))

**[PAT-14](https://worth-ai.atlassian.net/browse/PAT-14) - [FE+BE] Full Transactions in Case Management**

- 🚀 #LIVE feat: transaction details in case mgmt ([#631](https://github.com/joinworth/integration-service/pull/631))
- 🚀 #LIVE fix: customer access ([#639](https://github.com/joinworth/integration-service/pull/639))
- 🚀 #LIVE feat: send official and institution name ([#644](https://github.com/joinworth/integration-service/pull/644))

**[PAT-15](https://worth-ai.atlassian.net/browse/PAT-15) - [FE +BE] Display full balance sheet and P&L**

- 🚀 #LIVE feat: financials data (balancesheet and P&L statement) ([#611](https://github.com/joinworth/integration-service/pull/611))
- 🚀 #LIVE fix: response formatting ([#622](https://github.com/joinworth/integration-service/pull/622))

**[PAT-2](https://worth-ai.atlassian.net/browse/PAT-2) - [BE] Add support for multiple business names and business addresses**

- 🚀 #LIVE feat: added mailing_address in facts ([#618](https://github.com/joinworth/integration-service/pull/618))

**[PAT-69](https://worth-ai.atlassian.net/browse/PAT-69) - [BE] Send Emails When Sections Are Completed**

- 🚀 #LIVE feat: co-applicants email ([#634](https://github.com/joinworth/integration-service/pull/634))
- 🚀 #LIVE fix: banking deposite account section complete email ([#636](https://github.com/joinworth/integration-service/pull/636))

**[PAT-80](https://worth-ai.atlassian.net/browse/PAT-80) - FE + BE | As a Worth Admin or Customer, I should see the KYB tab populated by Facts**

- 🚀 #LIVE Fix KYB Map for Registrations ([#648](https://github.com/joinworth/integration-service/pull/648))
- 🚀 #LIVE KYB Adjustments ([#652](https://github.com/joinworth/integration-service/pull/652))

**[WIN-1066](https://worth-ai.atlassian.net/browse/WIN-1066) - [FE+BE] Display Download link for Worth 360 Report**

- 🚀 Add case ID for report #LIVE ([#576](https://github.com/joinworth/integration-service/pull/576))

**[WIN-1128](https://worth-ai.atlassian.net/browse/WIN-1128) - Add Company Overview to PDF Report**

- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 1 ([#557](https://github.com/joinworth/integration-service/pull/557))
- 🚀 COMPANY OVERVIEW PDF REPORT #LIVE PART 2 ([#561](https://github.com/joinworth/integration-service/pull/561))

**[WIN-1130](https://worth-ai.atlassian.net/browse/WIN-1130) - Add Open Accounts to PDF Report**

- 🚀 #LIVE - create function to get open account data ([#558](https://github.com/joinworth/integration-service/pull/558))
- 🚀 #LIVE - format date and amount in the queries for Open Accounts ([#570](https://github.com/joinworth/integration-service/pull/570))
- 🚀 #LIVE - rename top10TrancationsByAmount to top10TransactionsByAmount ([#575](https://github.com/joinworth/integration-service/pull/575))

**[WIN-1201](https://worth-ai.atlassian.net/browse/WIN-1201) - Store and Display Fraud Check data from Plaid**

- 🚀 #LIVE Expose fraud check data in Applicant verification route. ([#565](https://github.com/joinworth/integration-service/pull/565))

**[WIN-1223](https://worth-ai.atlassian.net/browse/WIN-1223) - [BE] Send Webhook Events**

- 🚩 #FLAG feat: send webhook events ([#512](https://github.com/joinworth/integration-service/pull/512))
- 🚩 #FLAG feat: integration status for tax-status [] ([#521](https://github.com/joinworth/integration-service/pull/521))

**[WIN-1316](https://worth-ai.atlassian.net/browse/WIN-1316) - Aurora | Bank account Identity via Assets**

- 🚀 #LIVE feat: fuzzy match for plaid ([#532](https://github.com/joinworth/integration-service/pull/532))
- 🚀 #LIVE fix: Match the owners data from plaid with business details from plaid s3 data ([#525](https://github.com/joinworth/integration-service/pull/525))

**[WIN-1318](https://worth-ai.atlassian.net/browse/WIN-1318) - Aurora | Routing and Account Number via Auth**

- 🚩 #FLAG feat: aurora deposit account [] ([#535](https://github.com/joinworth/integration-service/pull/535))

**[WIN-1434](https://worth-ai.atlassian.net/browse/WIN-1434) - [FE+BE] Aurora | Enable Deposit Account Selection and Display to Enterprise Customer**

- 🚩 #FLAG feat: set deposit account info ([#549](https://github.com/joinworth/integration-service/pull/549))
- 🚩 #FLAG fix: deposit account info response ([#562](https://github.com/joinworth/integration-service/pull/562))
- 🚩 #FLAG fix: purge bank account ([#563](https://github.com/joinworth/integration-service/pull/563))
- 🚩 #FLAGF fix: empty bank account on banking reconnect ([#564](https://github.com/joinworth/integration-service/pull/564))
- 🚩 #FLAG fix: response format ([#568](https://github.com/joinworth/integration-service/pull/568))

**[WIN-1446](https://worth-ai.atlassian.net/browse/WIN-1446) - [BE] Update the business.updated event to include custom fields, owners, and documents**

- 🚀 #LIVE business updated event ([#567](https://github.com/joinworth/integration-service/pull/567))

### 🧰 Task

**[INFRA-12](https://worth-ai.atlassian.net/browse/INFRA-12) - Implement GitHub Action to Cleanup Release Branches**

- 🚀 #LIVE clean-release-branches ([#449](https://github.com/joinworth/integration-service/pull/449))

**[INFRA-28](https://worth-ai.atlassian.net/browse/INFRA-28) - Cache yq Binary in GitHub Actions Workflow**

- 🚀 #LIVE Update yq step ([#555](https://github.com/joinworth/integration-service/pull/555))

**[INFRA-30](https://worth-ai.atlassian.net/browse/INFRA-30) - Ensure Branch is Up-to-Date with Main Before Build and Deploy**

- 🚀 #LIVE Add check to ensure branch is up-to-date with main before build ([#573](https://github.com/joinworth/integration-service/pull/573))

**[INFRA-35](https://worth-ai.atlassian.net/browse/INFRA-35) - Update CICD pipeline versions to fix actions warning**

- 🚀 #LIVE Fix/image tag update warning ([#550](https://github.com/joinworth/integration-service/pull/550))

**[INFRA-49](https://worth-ai.atlassian.net/browse/INFRA-49) - Add JIRA Ticket Link as Comment and Objective in PR Title**

- 🚀 #LIVE Add JIRA ticket link as a comment and include objective in PR title ([#588](https://github.com/joinworth/integration-service/pull/588))

**[INFRA-8](https://worth-ai.atlassian.net/browse/INFRA-8) - Update GitHub Actions to Use Branch/Tag Naming Convention for Docker ImageTag**

- 🚀 #LIVE Update Docker Image Tagging Convention for Tag-Based Runs ([#589](https://github.com/joinworth/integration-service/pull/589))

**[INFRA-84](https://worth-ai.atlassian.net/browse/INFRA-84) - setup qa env**

- 🚀 #LIVE Setup QA env ([#630](https://github.com/joinworth/integration-service/pull/630))

**[INFRA-85](https://worth-ai.atlassian.net/browse/INFRA-85) - Add username in pr desc for backend pipelines**

- 🚀 #LIVE Add username in pr desc ([#632](https://github.com/joinworth/integration-service/pull/632))

### 🐛 Bug

**[DOS-141](https://worth-ai.atlassian.net/browse/DOS-141) - On Company Overview: Missing data**

- 🚀 #LIVE: Adds missing data for 360 Report ([#647](https://github.com/joinworth/integration-service/pull/647))

**[DOS-142](https://worth-ai.atlassian.net/browse/DOS-142) - On Public Records: Show Round Off Percentage Values and Add Reviewer Name**

- 🚀 #LIVE - On Public Records: Show Round Off Percentage Values and Add Reviewer Name ([#665](https://github.com/joinworth/integration-service/pull/665))
- 🚀 #LIVE - On Public Records: Show Round Off Percentage Values and Add Reviewer Name ([#661](https://github.com/joinworth/integration-service/pull/661))

**[DOS-16](https://worth-ai.atlassian.net/browse/DOS-16) - Update Agni to Angi**

- 🚀 update-agni-to-angi #LIVE ([#583](https://github.com/joinworth/integration-service/pull/583))

**[DOS-174](https://worth-ai.atlassian.net/browse/DOS-174) - [FAST TRACK] - Website data not populating inside the Cases/Company tab under "Website Review"**

- ⚡🚀 #LIVE WEBSITE DATA ISSUE RESOLUTION #FAST ([#659](https://github.com/joinworth/integration-service/pull/659))
- ⚡🚀 #LIVE WEBSITE DATA ISSUE RESOLUTION #FAST PART 2 ([#662](https://github.com/joinworth/integration-service/pull/662))

**[DOS-28](https://worth-ai.atlassian.net/browse/DOS-28) - Insights report is empty unexpectedly**

- 🚀 #LIVE fix: insights report format ([#578](https://github.com/joinworth/integration-service/pull/578))

**[DOS-32](https://worth-ai.atlassian.net/browse/DOS-32) - Cases are showing as auto-approved when score is hidden**

- 🚀 #LIVE: feat: fetch business metadata such as revenue & age ([#579](https://github.com/joinworth/integration-service/pull/579))

**[PAT-139](https://worth-ai.atlassian.net/browse/PAT-139) - No title available**

- 🚀 #LIVE fix: bank account db insertion fix ([#656](https://github.com/joinworth/integration-service/pull/656))
- 🚀 #LIVE fix: business integration task not found error ([#663](https://github.com/joinworth/integration-service/pull/663))

**[PAT-48](https://worth-ai.atlassian.net/browse/PAT-48) - [BE] Unable to View Public Records/Brand Management Data**

- 🚀 #LIVE - unable to view public records brand management data ([#616](https://github.com/joinworth/integration-service/pull/616))
- 🚀 #LIVE - be unable to view public records brand management data ([#625](https://github.com/joinworth/integration-service/pull/625))

**[PAT-53](https://worth-ai.atlassian.net/browse/PAT-53) - [BE + FE] Banking Integration Information Not Visible on Review Screen During Onboarding**

- 🚀 #LIVE fix: banking info on review screen fix ([#605](https://github.com/joinworth/integration-service/pull/605))

**[WIN-1182](https://worth-ai.atlassian.net/browse/WIN-1182) - Judgement not being reflected in platform**

- 🚀 Verdata fallback to equifax for BJL in public records #LIVE ([#507](https://github.com/joinworth/integration-service/pull/507))
- 🚀 bug fix #LIVE ([#508](https://github.com/joinworth/integration-service/pull/508))

**[WIN-1253](https://worth-ai.atlassian.net/browse/WIN-1253) - Count Mismatch in Total Risk Case Counts Between CRO Dashboard Chart and Case Listing**

- 🚀 #LIVE fix : fixed issue on risk alert data mismatch on dashboard and case grid. ([#511](https://github.com/joinworth/integration-service/pull/511))
- 🚀 #LIVE fix: remove duplicate risk alerts. ([#514](https://github.com/joinworth/integration-service/pull/514))

**[WIN-1276](https://worth-ai.atlassian.net/browse/WIN-1276) - Missing KYB appears to be blocking enrichment**

- 🚀 #LIVE missing kyb appears to be blocking enrichment ([#510](https://github.com/joinworth/integration-service/pull/510))

**[WIN-1325](https://worth-ai.atlassian.net/browse/WIN-1325) - Blank Risk Alert Notifications showing in Bill.com Customer Portal**

- 🚀 #LIVE FIX: blank risk alert notifications ([#523](https://github.com/joinworth/integration-service/pull/523))
- 🚀 #LIVE: FIX: Updated risk alert notification message ([#524](https://github.com/joinworth/integration-service/pull/524))

**[WIN-1377](https://worth-ai.atlassian.net/browse/WIN-1377) - Fix Score Refreshing**

- 🚀 #LIVE fix: pull hotfix to main ([#509](https://github.com/joinworth/integration-service/pull/509))

**[WIN-1394](https://worth-ai.atlassian.net/browse/WIN-1394) - Webhook Events Not Logging and Triggering**

- 🚀 #LIVE feat: disconnect integrations from SMB portal ([#528](https://github.com/joinworth/integration-service/pull/528))

**[WIN-1415](https://worth-ai.atlassian.net/browse/WIN-1415) - Easyflow| After continue from additional info. then again it taking me to let's get started screen**

- 🚀 #LIVE fix: easy flow middesk tin verification ([#542](https://github.com/joinworth/integration-service/pull/542))

**[WIN-1437](https://worth-ai.atlassian.net/browse/WIN-1437) - Production | Middesk Not Running on Most New Customers**

- 🚀 #LIVE fix: Middesk webhook handler ([#536](https://github.com/joinworth/integration-service/pull/536))
- 🚀 #LIVE fix: json response for serp ([#540](https://github.com/joinworth/integration-service/pull/540))

**[WIN-1452](https://worth-ai.atlassian.net/browse/WIN-1452) - [BE] SERP is not pulling multiple business matches**

- 🚀 #LIVE HOTFIX-PULL-TO-MAIN fix: putting 0th local match for bulk method only ([#548](https://github.com/joinworth/integration-service/pull/548))

### 🔗 Subtask

**[WIN-253](https://worth-ai.atlassian.net/browse/WIN-253) - [BE] Get All Standalone cases**

- 🚀 #LIVE : script for remove duplicate records from risk alerts. ([#522](https://github.com/joinworth/integration-service/pull/522))

### ✨ Enhancement

**[DOS-35](https://worth-ai.atlassian.net/browse/DOS-35) - Implement Case-Specific Data Retrieval Logic for 360 Report on Download from Case View or Case Listing**

- 🚀 #LIVE - Implement Case-Specific Data Retrieval Logic for 360 Report on Download from Case View or Case Listing ([#637](https://github.com/joinworth/integration-service/pull/637))

**[DOS-37](https://worth-ai.atlassian.net/browse/DOS-37) - [BE] Implement "Synthetic Risk Score" and "Stolen Identity Risk Score" in the PDF 360 Report**

- 🚀 #LIVE: Update Report Fetcher to send Risk Scores ([#633](https://github.com/joinworth/integration-service/pull/633))
- 🚀 #LIVE - transform the caseDate fields to ISO strings ([#651](https://github.com/joinworth/integration-service/pull/651))

**[DOS-88](https://worth-ai.atlassian.net/browse/DOS-88) - Show Key Insights under Executive Summary in 360 Reports**

- 🚀 FEAT: Show Key Insights in 360 report #LIVE ([#641](https://github.com/joinworth/integration-service/pull/641))

**[PAT-124](https://worth-ai.atlassian.net/browse/PAT-124) - Support is corporation public flag**

- 🚩 #FLAG: feat: changes to fetch corporation type in facts api ([#638](https://github.com/joinworth/integration-service/pull/638))

**[PAT-64](https://worth-ai.atlassian.net/browse/PAT-64) - Update the SERP Logic**

- 🚀 #LIVE feat: serp logic update ([#635](https://github.com/joinworth/integration-service/pull/635))

**[PAT-76](https://worth-ai.atlassian.net/browse/PAT-76) - No title available**

- 🚀 #LIVE: trigger business updated after deposit account is set ([#612](https://github.com/joinworth/integration-service/pull/612))

**[PAT-79](https://worth-ai.atlassian.net/browse/PAT-79) - [FE + BE] As a user, I expect to be able to download an Equifax credit report.**

- 🚀 #LIVE feat: equifax credit report ([#640](https://github.com/joinworth/integration-service/pull/640))
- 🚀 #LIVE feat: official name ([#645](https://github.com/joinworth/integration-service/pull/645))
- 🚀 #LIVE fix: fixes for no key found s3 object ([#646](https://github.com/joinworth/integration-service/pull/646))
- 🚀 #LIVE feat: filter by case_id ([#654](https://github.com/joinworth/integration-service/pull/654))

**[WIN-1278](https://worth-ai.atlassian.net/browse/WIN-1278) - Display SERP reviews in Public Records tab**

- 🚀 #LIVE Display SERP reviews in Public Records tab. ([#517](https://github.com/joinworth/integration-service/pull/517))

**[WIN-1286](https://worth-ai.atlassian.net/browse/WIN-1286) - SERP Delays**

- 🚀 #LIVE remove serp api website and industrious data. ([#529](https://github.com/joinworth/integration-service/pull/529))
- 🚀 #LIVE - SERP Delays ([#551](https://github.com/joinworth/integration-service/pull/551))

**[WIN-1289](https://worth-ai.atlassian.net/browse/WIN-1289) - [FE+BE] Update Risk Alert Trigger Logic for Risk Tiers**

- 🚀 UPDATE RISK ALERTS #LIVE ([#527](https://github.com/joinworth/integration-service/pull/527))

**[WIN-1382](https://worth-ai.atlassian.net/browse/WIN-1382) - [FE+BE] Update Middesk website request**

- 🚀 #LIVE fix: middesk business id ([#539](https://github.com/joinworth/integration-service/pull/539))
- 🚀 #LIVE fix: on submit only fetch and not order for website ([#543](https://github.com/joinworth/integration-service/pull/543))
- 🚀 MIDDESK FIX #LIVE ([#546](https://github.com/joinworth/integration-service/pull/546))
- 🚀 #LIVE: fetch middesk website by creating order ([#526](https://github.com/joinworth/integration-service/pull/526))

### 🧪 Spike

**[PAT-10](https://worth-ai.atlassian.net/browse/PAT-10) - OpenCorporates+ZoomInfo: How to handle additional business_entity_verification providers in API + FrontEnds**

- 🚀 Poc facts #LIVE ([#599](https://github.com/joinworth/integration-service/pull/599))

**[WIN-1155](https://worth-ai.atlassian.net/browse/WIN-1155) - ZoomInfo POC Implementation**

- 🚩 #FLAG Zoom info ([#545](https://github.com/joinworth/integration-service/pull/545))

### 💻 Tech Task

**[PAT-87](https://worth-ai.atlassian.net/browse/PAT-87) - [WAVE] Backfill OC/ZoomInfo Matches**

- 🚀 #LIVE Add Bulk OpenCorporates & ZoomInfo enqueue ([#649](https://github.com/joinworth/integration-service/pull/649))

**[WIN-1288](https://worth-ai.atlassian.net/browse/WIN-1288) - Verdata and SERP data not saved to DB**

- 🚀 SAVE INTEGRATION DATA IN DB BEFORE S3 #LIVE ([#519](https://github.com/joinworth/integration-service/pull/519))

**[WIN-1449](https://worth-ai.atlassian.net/browse/WIN-1449) - Testing for ZoomInfo**

- 🚩 #FLAG ZoomInfo & OpenCorporates Enhancements ([#574](https://github.com/joinworth/integration-service/pull/574))

### 📝 Other

**[DOS-33](https://worth-ai.atlassian.net/browse/DOS-33) - No title available**

- 🚀 FIX EQUIFAX MATCHING INCORRECT DISTANCE ISSUE #LIVE ([#587](https://github.com/joinworth/integration-service/pull/587))

**[DOS-5](https://worth-ai.atlassian.net/browse/DOS-5) - [BE] Add Financials to PDF Report**

- 🚀 financials report generation #LIVE ([#596](https://github.com/joinworth/integration-service/pull/596))
- 🚀 implement 360 report financials #LIVE ([#594](https://github.com/joinworth/integration-service/pull/594))

**[DOS-84](https://worth-ai.atlassian.net/browse/DOS-84) - No title available**

- 🚩 #FLAG Resubmit to middesk if the business was not already submitted ([#613](https://github.com/joinworth/integration-service/pull/613))
- 🚀 #LIVE feat: lightning verification ([#607](https://github.com/joinworth/integration-service/pull/607))

- 🚀 #NO_JIRA #LIVE: Fixes 360 Reports Generation for Businesses with More than 2 Cases ([#666](https://github.com/joinworth/integration-service/pull/666))
- 🚀 #NO_JIRA #LIVE fix issue with middesk mapper ([#615](https://github.com/joinworth/integration-service/pull/615))
- 🚀 #NO_JIRA #LIVE updates to Ocr for processing statments ([#608](https://github.com/joinworth/integration-service/pull/608))
- 🚀 #NO_JIRA #LIVE Fix issues with Middesk Website Verification impacting Equifax ([#617](https://github.com/joinworth/integration-service/pull/617))
- 🚀 #NO_JIRA #LIVE - remove average_rating validation because this value can be empty ([#626](https://github.com/joinworth/integration-service/pull/626))
- 🚀 #NO_JIRA #LIVE fix: qa env kafka configs ([#629](https://github.com/joinworth/integration-service/pull/629))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump path-to-regexp and express ([#642](https://github.com/joinworth/integration-service/pull/642))
- 🚀 #NO_JIRA PRODUCTION ERROR LOG FIXES #LIVE ([#643](https://github.com/joinworth/integration-service/pull/643))
- 🚀 #NO_JIRA PRODUCTION ERROR LOG FIXES #LIVE ([#650](https://github.com/joinworth/integration-service/pull/650))
- 🚀 #NO_JIRA #LIVE Update Dockerfile ([#621](https://github.com/joinworth/integration-service/pull/621))
- 🚀 #NO_JIRA #LIVE add support for task workers ([#624](https://github.com/joinworth/integration-service/pull/624))
- 🚀 #NO_JIRA #LIVE ocr route updates ([#655](https://github.com/joinworth/integration-service/pull/655))
- 🚀 #NO_JIRA #LIVE fix: unnecessary logs handling ([#609](https://github.com/joinworth/integration-service/pull/609))
- 🚩 #NO_JIRA #FLAG fix: deposit account info get ([#610](https://github.com/joinworth/integration-service/pull/610))
- 🚀 #NO_JIRA #LIVE drop not null constraint on files.uploads display_name ([#602](https://github.com/joinworth/integration-service/pull/602))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump elliptic from 6.5.7 to 6.6.1 ([#604](https://github.com/joinworth/integration-service/pull/604))
- 🚀 #NO_JIRA #LIVE fix: tin decrypt error ([#606](https://github.com/joinworth/integration-service/pull/606))
- 🚀 #NO_JIRA #LIVE fix: dlq fix ([#541](https://github.com/joinworth/integration-service/pull/541))
- 🚀 #NO_JIRA #LIVE fix: construct plaid data based on business-id ([#547](https://github.com/joinworth/integration-service/pull/547))
- 🚀 #NO_JIRA #LIVE fix: website, adding default case ([#560](https://github.com/joinworth/integration-service/pull/560))
- 🚀 #NO_JIRA #LIVE Queue Integrations Business Kafka Events ([#566](https://github.com/joinworth/integration-service/pull/566))
- 🚀 #NO_JIRA #LIVE Fix job ids ([#569](https://github.com/joinworth/integration-service/pull/569))
- 🚀 #NO_JIRA #LIVE fix: authenticate api send webhook event ([#571](https://github.com/joinworth/integration-service/pull/571))
- 🚀 #NO_JIRA #LIVE fix: authenticate api ([#572](https://github.com/joinworth/integration-service/pull/572))
- 🚀 #NO_JIRA #LIVE Bind "this" for task handler & add try/catch ([#580](https://github.com/joinworth/integration-service/pull/580))
- 🚀 #NO_JIRA #LIVE Make identity_abuse_signals field optional in IDV response ([#593](https://github.com/joinworth/integration-service/pull/593))
- 🚀 #NO_JIRA: #LIVE Build(deps): Bump cookie, cookie-parser and express ([#533](https://github.com/joinworth/integration-service/pull/533))
- 🚀 #NO_JIRA #LIVE fix: accounting jsonb error ([#530](https://github.com/joinworth/integration-service/pull/530))
- 🚀 #NO_JIRA #LIVE fix: condition update for serp ([#505](https://github.com/joinworth/integration-service/pull/505))
- 🚀 #NO_JIRA# add back unique constraint #LIVE ([#516](https://github.com/joinworth/integration-service/pull/516))
- 🚀 #NO_JIRA #LIVE fix: score calculation on case submit ([#520](https://github.com/joinworth/integration-service/pull/520))
- 🚀 #NO_JIRA feature: ocr statement processing #LIVE ([#515](https://github.com/joinworth/integration-service/pull/515))

**[PAT-8](https://worth-ai.atlassian.net/browse/PAT-8) - No title available**

- 🚀 #LIVE: naics serp ([#598](https://github.com/joinworth/integration-service/pull/598))

**[WIN-1118](https://worth-ai.atlassian.net/browse/WIN-1118) - No title available**

- 🚀 #LIVE Handle if a db connection already exists ([#544](https://github.com/joinworth/integration-service/pull/544))
- 🚩 QA #FLAG Race condition with creating/retrieving connection record ([#577](https://github.com/joinworth/integration-service/pull/577))

**[WIN-1154](https://worth-ai.atlassian.net/browse/WIN-1154) - No title available**

- 🚀 Business entity extension migrations #LIVE ([#488](https://github.com/joinworth/integration-service/pull/488))
- 🚀 OpenCorporates Implementation #LIVE ([#518](https://github.com/joinworth/integration-service/pull/518))

**[WIN-1317](https://worth-ai.atlassian.net/browse/WIN-1317) - No title available**

- 🚀 #LIVE - Include Similarity Index in RDS ([#556](https://github.com/joinworth/integration-service/pull/556))

**[WIN-1423](https://worth-ai.atlassian.net/browse/WIN-1423) - No title available**

- 🚀 #LIVE revenue fallback fix ([#537](https://github.com/joinworth/integration-service/pull/537))
- 🚀 #LIVE feat: revenue fallback ([#534](https://github.com/joinworth/integration-service/pull/534))

## [v0.0.128](https://github.com//joinworth/integration-service/compare/v0.0.126...v0.0.128) - 2024-09-27

### 🧰 Task

**[INFRA-2](https://worth-ai.atlassian.net/browse/INFRA-2) - Enable and stream debug logs in dev environment to datadog without cluttering up pod stdout/stderr logs**

- 📝 Add debug log ([#490](https://github.com/joinworth/integration-service/pull/490))

**[INFRA-36](https://worth-ai.atlassian.net/browse/INFRA-36) - Update PR-TITLE-FORMAT pipeline**

- 🚀 #LIVE Update PR Title workflow ([#503](https://github.com/joinworth/integration-service/pull/503))

### ✨ Enhancement

**[WIN-1279](https://worth-ai.atlassian.net/browse/WIN-1279) - Update the SERP logic to pick up best fuzzy matches for refresh/bulk uploads**

- 📝 fix: serp logic ([#494](https://github.com/joinworth/integration-service/pull/494))

### 💻 Tech Task

**[WIN-1239](https://worth-ai.atlassian.net/browse/WIN-1239) - Verdata (lack of integration) is creating risk alerts**

- 📝 fix: schedule verdata calls ([#487](https://github.com/joinworth/integration-service/pull/487))

**[WIN-1240](https://worth-ai.atlassian.net/browse/WIN-1240) - Rescore Bill with SERP data**

- 📝 adjust to use task correctly ([#491](https://github.com/joinworth/integration-service/pull/491))

### 📝 Other

- 📝 Fix: update funcation params
- 📝 #NO_JIRA# Scoring fix ([#485](https://github.com/joinworth/integration-service/pull/485))
- 📝 #NO_JIRA [Snyk] Security upgrade express from 4.19.2 to 4.21.0 ([#479](https://github.com/joinworth/integration-service/pull/479))
- 📝 #NO_JIRA# fix issue SERP API in manual score refresh. ([#489](https://github.com/joinworth/integration-service/pull/489))
- 📝 Win-1240 | use serp if verdata null ([#492](https://github.com/joinworth/integration-service/pull/492))
- 📝 #NO_JIRA fix: revert double execution of task on score refresh ([#496](https://github.com/joinworth/integration-service/pull/496))
- 📝 #NO_JIRA# Commit messages on interval ([#497](https://github.com/joinworth/integration-service/pull/497))
- 📝 #NO_JIRA: integration dlq bug fixes ([#499](https://github.com/joinworth/integration-service/pull/499))
- 📝 #NO_JIRA# Kafka push to queue ([#498](https://github.com/joinworth/integration-service/pull/498))
- 📝 #NO_JIRA fix: condition update ([#500](https://github.com/joinworth/integration-service/pull/500))
- 📝 #NO_JIRA# Force SERP to not care about Connection Status ([#501](https://github.com/joinworth/integration-service/pull/501))
- 📝 #NO_JIRA: UPDATE PR-TITLE PIPELINE ([#502](https://github.com/joinworth/integration-service/pull/502))
- 🚀 #NO_JIRA REDSHIFT-LOCAL-CONFIGURATION #LIVE ([#504](https://github.com/joinworth/integration-service/pull/504))
- 🚀 #NO_JIRA #LIVE fix: pull hotfix to main ([#506](https://github.com/joinworth/integration-service/pull/506))

**[WIN-1065](https://worth-ai.atlassian.net/browse/WIN-1065) - No title available**

- 📝 Add DB Migrations [Part 1/4] ([#443](https://github.com/joinworth/integration-service/pull/443))

## [v0.0.126](https://github.com//joinworth/integration-service/compare/v0.0.125...v0.0.126) - 2024-09-20

### 📝 Other

- 📝 Fix: cherry pick
- 📝 #NO_JIRA fix: condition update ([#500](https://github.com/joinworth/integration-service/pull/500))

## [v0.0.125](https://github.com//joinworth/integration-service/compare/v0.0.124...v0.0.125) - 2024-09-18

### 📝 Other

- 📝 #NO_JIRA# Commit messages on interval ([#497](https://github.com/joinworth/integration-service/pull/497))

## [v0.0.124](https://github.com//joinworth/integration-service/compare/v0.0.123...v0.0.124) - 2024-09-18

### 📝 Other

- 📝 Fix: cherry picked b04cf1769b3ac586e91e762efe59f34c07f3ab79

## [v0.0.123](https://github.com//joinworth/integration-service/compare/v0.0.122...v0.0.123) - 2024-09-18

### 📝 Other

- 📝 Win-1240 | use serp if verdata null ([#492](https://github.com/joinworth/integration-service/pull/492))
- 📝 Win-1240 | use serp if verdata null ([#492](https://github.com/joinworth/integration-service/pull/492))
- 📝 Add kafka error handler
- 📝 Add error handling

**[WIN-1279](https://worth-ai.atlassian.net/browse/WIN-1279) - Update the SERP logic to pick up best fuzzy matches for refresh/bulk uploads**

- 📝 fix: serp logic ([#494](https://github.com/joinworth/integration-service/pull/494))

## [v0.0.122](https://github.com//joinworth/integration-service/compare/v0.0.121...v0.0.122) - 2024-09-17

### 📝 Other

- 📝 Update public-records.ts
- 📝 Update public-records.ts

## [v0.0.121](https://github.com//joinworth/integration-service/compare/v0.0.120...v0.0.121) - 2024-09-17

### 📝 Other

- 📝 Win-1240 | use serp if verdata null ([#492](https://github.com/joinworth/integration-service/pull/492))

## [v0.0.120](https://github.com//joinworth/integration-service/compare/v0.0.119...v0.0.120) - 2024-09-17

### 💻 Tech Task

**[WIN-1240](https://worth-ai.atlassian.net/browse/WIN-1240) - Rescore Bill with SERP data**

- 📝 adjust to use task correctly ([#491](https://github.com/joinworth/integration-service/pull/491))

## [v0.0.118](https://github.com//joinworth/integration-service/compare/v0.0.117...v0.0.118) - 2024-09-13

### 📖 Story

**[WIN-1214](https://worth-ai.atlassian.net/browse/WIN-1214) - Aurora | Prepopulate Owner**

- 📝 feat: pre populate owner ([#470](https://github.com/joinworth/integration-service/pull/470))
- 📝 feat: putting behind feature flag ([#480](https://github.com/joinworth/integration-service/pull/480))
- 📝 fix: case status checking ([#475](https://github.com/joinworth/integration-service/pull/475))

### 🐛 Bug

**[WIN-1099](https://worth-ai.atlassian.net/browse/WIN-1099) - Plaid | Banking Data Duplicating**

- 📝 Purge connection's transactions when relinking ([#460](https://github.com/joinworth/integration-service/pull/460))
- 📝 Fix Relink ([#473](https://github.com/joinworth/integration-service/pull/473))

**[WIN-1215](https://worth-ai.atlassian.net/browse/WIN-1215) - Formatting of percentages for reviews**

- 📝 formatting percentage ([#472](https://github.com/joinworth/integration-service/pull/472))

**[WIN-1242](https://worth-ai.atlassian.net/browse/WIN-1242) - New lien reported in score refresh - nothing shown in Public Records**

- 📝 Adding entry for risk case in integration svc ([#477](https://github.com/joinworth/integration-service/pull/477))
- 📝 Kafka event name update for case creation ([#483](https://github.com/joinworth/integration-service/pull/483))

### ✨ Enhancement

**[WIN-1164](https://worth-ai.atlassian.net/browse/WIN-1164) - Exclude Integrations from "Integration Broken Notification Alerts" Or "Emails"**

- 📝 risk alert ([#476](https://github.com/joinworth/integration-service/pull/476))

### 💻 Tech Task

**[WIN-1189](https://worth-ai.atlassian.net/browse/WIN-1189) - Enable Risk Monitoring for Bill + Rescore (SERP + enriched ZoomInfo/OC)**

- 📝 Fix the refresh score issue when user run manual refresh score all businesses which have a risk alert was not calculating the score. ([#482](https://github.com/joinworth/integration-service/pull/482))
- 📝 Fix the refresh score issue when user run manual refresh score all businesses which have a risk alert was not calculating the score. ([#482](https://github.com/joinworth/integration-service/pull/482))

### 📝 Other

- 📝 #NO_JIRA fix: hotfix pull to main ([#471](https://github.com/joinworth/integration-service/pull/471))
- 📝 Win 1167 general issue in the view case management ([#474](https://github.com/joinworth/integration-service/pull/474))
- 📝 [Quick Add] During creating business from quick add in response the TIN is going as the null value ([#478](https://github.com/joinworth/integration-service/pull/478))
- 📝 #NO_JIRA feat: pulling data from s3 and pushing onto api ([#484](https://github.com/joinworth/integration-service/pull/484))

## [v0.0.117](https://github.com//joinworth/integration-service/compare/v0.0.116...v0.0.117) - 2024-09-13

### 📖 Story

**[WIN-1214](https://worth-ai.atlassian.net/browse/WIN-1214) - Aurora | Prepopulate Owner**

- 📝 feat: pre populate owner ([#470](https://github.com/joinworth/integration-service/pull/470))
- 📝 feat: putting behind feature flag ([#480](https://github.com/joinworth/integration-service/pull/480))

### 🐛 Bug

**[WIN-1215](https://worth-ai.atlassian.net/browse/WIN-1215) - Formatting of percentages for reviews**

- 📝 formatting percentage ([#472](https://github.com/joinworth/integration-service/pull/472))

### 📝 Other

- 📝 #NO_JIRA feat: pulling data from s3 and pushing onto api ([#484](https://github.com/joinworth/integration-service/pull/484))

## [v0.0.116](https://github.com//joinworth/integration-service/compare/v0.0.108...v0.0.116) - 2024-09-09

### 📖 Story

**[WIN-1000](https://worth-ai.atlassian.net/browse/WIN-1000) - As a user, I expect to be able to use a tool to do a reverse lookup for a business' website.**

- 📝 Serp inetgration ([#413](https://github.com/joinworth/integration-service/pull/413))

**[WIN-1070](https://worth-ai.atlassian.net/browse/WIN-1070) - EFX to TIN match**

- 📝 efx to tin match ([#448](https://github.com/joinworth/integration-service/pull/448))

**[WIN-1097](https://worth-ai.atlassian.net/browse/WIN-1097) - Enable Sender Email and Sender Name Dynamically Based on Enterprise Customer**

- 📝 add email to ses ([#423](https://github.com/joinworth/integration-service/pull/423))

**[WIN-1142](https://worth-ai.atlassian.net/browse/WIN-1142) - Get and store account_payable and account_receivable from rutter api.**

- 📝 [] Get and store account_payable and account_receivable from rutter api. ([#419](https://github.com/joinworth/integration-service/pull/419))

**[WIN-1152](https://worth-ai.atlassian.net/browse/WIN-1152) - As a user, I should be able to easily test the onboarding flow.**

- 📝 Easy onboarding flow ([#453](https://github.com/joinworth/integration-service/pull/453))

### 🧰 Task

**[SEC-75](https://worth-ai.atlassian.net/browse/SEC-75) - [Vanta] Remediate "High vulnerabilities identified in packages are addressed (Github Repo)"**

- 📝 Build(deps): Bump fast-xml-parser, @aws-sdk/client-athena, @aws-sdk/client-cognito-identity-provider and @aws-sdk/client-s3 ([#424](https://github.com/joinworth/integration-service/pull/424))

**[SEC-78](https://worth-ai.atlassian.net/browse/SEC-78) - [Vanta] Remediate "Low vulnerabilities identified in packages are addressed (Github Repo)"**

- 📝 Build(deps): Bump elliptic from 6.5.5 to 6.5.7 ([#421](https://github.com/joinworth/integration-service/pull/421))

### 🐛 Bug

**[WIN-1098](https://worth-ai.atlassian.net/browse/WIN-1098) - Unauthorized Access Issue on Production Customer Portal**

- 📝 fix: validate data permission middleware ([#455](https://github.com/joinworth/integration-service/pull/455))
- 📝 fix: access middleware module ([#458](https://github.com/joinworth/integration-service/pull/458))

**[WIN-1099](https://worth-ai.atlassian.net/browse/WIN-1099) - Plaid | Banking Data Duplicating**

- 📝 Fix Banking Duplication ([#436](https://github.com/joinworth/integration-service/pull/436))

**[WIN-1121](https://worth-ai.atlassian.net/browse/WIN-1121) - Not getting equifax credit score**

- 📝 fix: Bug fixes ([#447](https://github.com/joinworth/integration-service/pull/447))
- 📝 fix: cache issue for Equifax access token ([#440](https://github.com/joinworth/integration-service/pull/440))

**[WIN-1143](https://worth-ai.atlassian.net/browse/WIN-1143) - Update EFX Match Logic to account for Suite and Apt**

- 📝 [] - Update EFX Match Logic to account for Suite and Apt ([#425](https://github.com/joinworth/integration-service/pull/425))

**[WIN-1211](https://worth-ai.atlassian.net/browse/WIN-1211) - Issues with Score Generation for Businesses Added Through Quick Add/Bulk Upload on Score Refresh Cycle**

- 📝 fix: quick add business score ([#461](https://github.com/joinworth/integration-service/pull/461))

**[WIN-1215](https://worth-ai.atlassian.net/browse/WIN-1215) - Formatting of percentages for reviews**

- 📝 fix: formatting of percentages for reviews ([#462](https://github.com/joinworth/integration-service/pull/462))

**[WIN-994](https://worth-ai.atlassian.net/browse/WIN-994) - Receiving Daily Emails for "Connectivity Issue Detected" and "Your Worth Score is Ready!"**

- 📝 fix: daily connectivity email bug due to score refresh ([#417](https://github.com/joinworth/integration-service/pull/417))

### 🧠 Epic

**[WIN-998](https://worth-ai.atlassian.net/browse/WIN-998) - Industry Classification**

- 📝 fix: admin to update risk settings of customer_id ([#450](https://github.com/joinworth/integration-service/pull/450))
- 📝 Admin to update customer risk settings ([#451](https://github.com/joinworth/integration-service/pull/451))

### ✨ Enhancement

**[WIN-1041](https://worth-ai.atlassian.net/browse/WIN-1041) - Risk Alert Enhancements**

- 📝 risk alert enhancement ([#418](https://github.com/joinworth/integration-service/pull/418))
- 📝 Integration broken risk alert message update ([#427](https://github.com/joinworth/integration-service/pull/427))

**[WIN-740](https://worth-ai.atlassian.net/browse/WIN-740) - [BE] Cases Service | add /purge route to handle deleting pre-determined TINs from Platform**

- 📝 Purge business ([#454](https://github.com/joinworth/integration-service/pull/454))

### 💻 Tech Task

**[WIN-1054](https://worth-ai.atlassian.net/browse/WIN-1054) - [ONCE MORE WITH FEELING] V2.2 Model Mapping**

- 📝 fix: athena match upload to s3 ([#441](https://github.com/joinworth/integration-service/pull/441))
- 📝 feat: feature to upload best match data to s3 ([#428](https://github.com/joinworth/integration-service/pull/428))

**[WIN-1160](https://worth-ai.atlassian.net/browse/WIN-1160) - Update cors options for origin to match via regex**

- 📝 fix: regex fix ([#435](https://github.com/joinworth/integration-service/pull/435))

**[WIN-590](https://worth-ai.atlassian.net/browse/WIN-590) - Add customer_id in cognito's authorization token**

- 📝 feat: customer-id in id-token ([#433](https://github.com/joinworth/integration-service/pull/433))

### 📝 Other

- 📝 Fix: throw error
- 📝 #NO_JIRA parse address details form SERP ([#467](https://github.com/joinworth/integration-service/pull/467))
- 📝 #NO_JIRA SERP industry mapping ([#469](https://github.com/joinworth/integration-service/pull/469))
- 📝 #NO_JIRA upload SERP data into S3 ([#466](https://github.com/joinworth/integration-service/pull/466))
- 📝 #NO_JIRA fix: middesk webhook failing ([#468](https://github.com/joinworth/integration-service/pull/468))
- 📝 #NO_JIRA fix: adding logger for middesk ([#465](https://github.com/joinworth/integration-service/pull/465))
- 📝 #NO_JIRA: Build(deps): Bump micromatch and lint-staged ([#463](https://github.com/joinworth/integration-service/pull/463))
- 📝 #NO_JIRA: Build(deps): Bump axios from 1.6.3 to 1.7.4 ([#420](https://github.com/joinworth/integration-service/pull/420))
- 📝 #NO_JIRA# fix: income statement make change in revenue and expenses. ([#445](https://github.com/joinworth/integration-service/pull/445))
- 📝 ##NO_JIRA internal serp route ([#452](https://github.com/joinworth/integration-service/pull/452))
- 📝 #NO_JIRA fix: json parse consumer handler fix ([#456](https://github.com/joinworth/integration-service/pull/456))
- 📝 #NO_JIRA: fix: removing logger ([#439](https://github.com/joinworth/integration-service/pull/439))
- 📝 #NO_JIRA: fix: update rel integration entry for task 5 and platform 11 ([#438](https://github.com/joinworth/integration-service/pull/438))
- 📝 #NO_JIRA fix: correct trigger_type in integration data ready event ([#430](https://github.com/joinworth/integration-service/pull/430))

**[WIN-689](https://worth-ai.atlassian.net/browse/WIN-689) - No title available**

- 📝 get business data according to score id ([#437](https://github.com/joinworth/integration-service/pull/437))

## [v0.0.108](https://github.com//joinworth/integration-service/compare/v0.0.104...v0.0.108) - 2024-08-23

### 💻 Tech Task

**[WIN-1054](https://worth-ai.atlassian.net/browse/WIN-1054) - [ONCE MORE WITH FEELING] V2.2 Model Mapping**

- 📝 fix: athena match upload to s3 ([#441](https://github.com/joinworth/integration-service/pull/441))

### 📝 Other

- 📝 #NO_JIRA: fix: removing logger ([#439](https://github.com/joinworth/integration-service/pull/439))

## [v0.0.104](https://github.com//joinworth/integration-service/compare/v0.0.99...v0.0.104) - 2024-08-23

### 📖 Story

**[WIN-1000](https://worth-ai.atlassian.net/browse/WIN-1000) - As a user, I expect to be able to use a tool to do a reverse lookup for a business' website.**

- 📝 Serp inetgration ([#413](https://github.com/joinworth/integration-service/pull/413))

**[WIN-1016](https://worth-ai.atlassian.net/browse/WIN-1016) - Update matching logic for EFX**

- 📝 update matching logic for efx ([#407](https://github.com/joinworth/integration-service/pull/407))

**[WIN-116](https://worth-ai.atlassian.net/browse/WIN-116) - [BE/FE] Customer/Worth Admin | White Label Settings**

- 📝 - [BE/FE] Customer/Worth Admin | White Label Settings ([#390](https://github.com/joinworth/integration-service/pull/390))
- 📝 - [BE/FE] Customer/Worth Admin | White Label Settings ([#390](https://github.com/joinworth/integration-service/pull/390)) ([#409](https://github.com/joinworth/integration-service/pull/409))
- 📝 - [BE/FE] Customer/Worth Admin | White Label Settings ([#411](https://github.com/joinworth/integration-service/pull/411))

### 🐛 Bug

**[WIN-1035](https://worth-ai.atlassian.net/browse/WIN-1035) - Website does not appear to be passed to Middesk**

- 📝 pass website to middesk ([#406](https://github.com/joinworth/integration-service/pull/406))

### 💻 Tech Task

**[WIN-1054](https://worth-ai.atlassian.net/browse/WIN-1054) - [ONCE MORE WITH FEELING] V2.2 Model Mapping**

- 📝 feat: feature to upload best match data to s3 ([#428](https://github.com/joinworth/integration-service/pull/428))

**[WIN-896](https://worth-ai.atlassian.net/browse/WIN-896) - Setup launchDarkly for feature flags**

- 📝 feat: launchdarkly feature flag integrations ([#412](https://github.com/joinworth/integration-service/pull/412))

### 📝 Other

- 📝 #NO_JIRA# BILL.COM | Update logic for Athena [NEEDS TO GET DEPLOYED MONDAY] ([#415](https://github.com/joinworth/integration-service/pull/415))
- 📝 #NO_JIRA: fix: equifax task query ([#400](https://github.com/joinworth/integration-service/pull/400))
- 📝 #NO_JIRA# add missing column ([#408](https://github.com/joinworth/integration-service/pull/408))
- 📝 #NO_JIRA# LEFT Join to get NAICS info ([#414](https://github.com/joinworth/integration-service/pull/414))

**[WIN-760](https://worth-ai.atlassian.net/browse/WIN-760) - No title available**

- 📝 Revenue calculation for score ([#405](https://github.com/joinworth/integration-service/pull/405))

## [v0.0.99](https://github.com//joinworth/integration-service/compare/v0.0.98...v0.0.99) - 2024-08-08

### 📝 Other

- 📝 #NO_JIRA# add missing column ([#408](https://github.com/joinworth/integration-service/pull/408))
- 📝 #NO_JIRA# LEFT Join to get NAICS info ([#414](https://github.com/joinworth/integration-service/pull/414))

## [v0.0.98](https://github.com//joinworth/integration-service/compare/v0.0.96...v0.0.98) - 2024-08-08

### 📖 Story

**[WIN-1012](https://worth-ai.atlassian.net/browse/WIN-1012) - Enable Relative Score Changes for Risk Alerts**

- 📝 enable relative score changes for risk alerts - Part 1 ([#391](https://github.com/joinworth/integration-service/pull/391))
- 📝 enable relative score changes for risk alerts - Part 2 ([#401](https://github.com/joinworth/integration-service/pull/401))
- 📝 enable relative score changes for risk alerts - Part 3 ([#403](https://github.com/joinworth/integration-service/pull/403))

**[WIN-1016](https://worth-ai.atlassian.net/browse/WIN-1016) - Update matching logic for EFX**

- 📝 update matching logic for efx ([#407](https://github.com/joinworth/integration-service/pull/407))

### 🐛 Bug

**[WIN-1095](https://worth-ai.atlassian.net/browse/WIN-1095) - No title available**

- 📝 fix: bug: added default case ([#399](https://github.com/joinworth/integration-service/pull/399))

### ✨ Enhancement

**[WIN-1040](https://worth-ai.atlassian.net/browse/WIN-1040) - Fix Equifax status transition & Refresh Equifax on monthly basis**

- 📝 Equifax connection status maintain and refresh logic of Equifax credit score ([#392](https://github.com/joinworth/integration-service/pull/392))

### 📝 Other

- 📝 #NO_JIRA# add populate business details route ([#393](https://github.com/joinworth/integration-service/pull/393))
- 📝 #NO_JIRA# remove temporary equifax entanglement in Verdata code ([#389](https://github.com/joinworth/integration-service/pull/389))
- 📝 #NO_JIRA fix: verdata fix ([#402](https://github.com/joinworth/integration-service/pull/402))

## [v0.0.96](https://github.com//joinworth/integration-service/compare/v0.0.93...v0.0.96) - 2024-07-30

### 📖 Story

**[WIN-296](https://worth-ai.atlassian.net/browse/WIN-296) - [BE] Case Activity Log**

- 📝 feat: logic to produce audit logs ([#378](https://github.com/joinworth/integration-service/pull/378))

**[WIN-442](https://worth-ai.atlassian.net/browse/WIN-442) - [FE+BE] Risk Alerts Display to Customer Admin**

- 📝 fix: maintain business_id in risk alerts table ([#371](https://github.com/joinworth/integration-service/pull/371))
- 📝 InternalApi to fetch score_trigger_id of risk alert ([#372](https://github.com/joinworth/integration-service/pull/372))

**[WIN-693](https://worth-ai.atlassian.net/browse/WIN-693) - [FE+BE] Risk Alert Notifications**

- 📝 feat: fetch risk alerts ([#369](https://github.com/joinworth/integration-service/pull/369))
- 📝 fix: risk messages updated ([#370](https://github.com/joinworth/integration-service/pull/370))

**[WIN-921](https://worth-ai.atlassian.net/browse/WIN-921) - [BE] Save Uploaded Business Verification Document (PDF) in S3 Bucket**

- 📝 Server side pdf file support for verification purposes ([#375](https://github.com/joinworth/integration-service/pull/375))

### 🐛 Bug

**[WIN-1025](https://worth-ai.atlassian.net/browse/WIN-1025) - Enriched Verdata file data not displaying in prod**

- 📝 fix: adding bull queue job for business to refetch verdata ([#374](https://github.com/joinworth/integration-service/pull/374))
- 📝 verdata enrichment fixes ([#376](https://github.com/joinworth/integration-service/pull/376))

**[WIN-926](https://worth-ai.atlassian.net/browse/WIN-926) - Business Name Verification is not consistently showing in KYB tab**

- 📝 ([#381](https://github.com/joinworth/integration-service/pull/381))

**[WIN-985](https://worth-ai.atlassian.net/browse/WIN-985) - Unable to View Banking Data for New Business Onboarded**

- 📝 fix: banking data bug ([#377](https://github.com/joinworth/integration-service/pull/377))

### ✨ Enhancement

**[WIN-992](https://worth-ai.atlassian.net/browse/WIN-992) - Pull website from Equifax/Verdata and run in Middesk**

- 📝 feat: fetch website details fallback logic ([#383](https://github.com/joinworth/integration-service/pull/383))

### 💻 Tech Task

**[WIN-1078](https://worth-ai.atlassian.net/browse/WIN-1078) - Add review score and count to Verdata Enrichment Route**

- 📝 Verdata review enrichment ([#387](https://github.com/joinworth/integration-service/pull/387))

**[WIN-1079](https://worth-ai.atlassian.net/browse/WIN-1079) - IntegrationService | When sending a scoring request, make sure there's a dump of the business' data_business table entry in S3**

- 📝 when-sending-a-scoring-request-make-sure-theres-a-dump-of-the-business-data-business-table-entry-in-s-3 ([#386](https://github.com/joinworth/integration-service/pull/386))

### 📝 Other

- 📝 #NO_JIRA# add populate business details route ([#393](https://github.com/joinworth/integration-service/pull/393))
- 📝 #NO_JIRA# remove temporary equifax entanglement in Verdata code ([#389](https://github.com/joinworth/integration-service/pull/389))
- 📝 #NO_JIRA corrected get extracted-verification-uploads ([#380](https://github.com/joinworth/integration-service/pull/380))
- 📝 #NO_JIRA forgot leading forward slash ([#382](https://github.com/joinworth/integration-service/pull/382))
- 📝 #NO_JIRA fix: added loggers for failing banking errors ([#384](https://github.com/joinworth/integration-service/pull/384))
- 📝 #NO_JIRA: Fix verdata worker log ([#388](https://github.com/joinworth/integration-service/pull/388))

## [v0.0.93](https://github.com//joinworth/integration-service/compare/v0.0.92...v0.0.93) - 2024-07-24

### 🐛 Bug

**[WIN-985](https://worth-ai.atlassian.net/browse/WIN-985) - Unable to View Banking Data for New Business Onboarded**

- 📝 fix: banking data bug ([#377](https://github.com/joinworth/integration-service/pull/377))

### 📝 Other

- 📝 Fix: log as text in conn history

## [v0.0.92](https://github.com//joinworth/integration-service/compare/v0.0.91...v0.0.92) - 2024-07-22

### 📝 Other

- 📝 Fix: win-1025 verdata enrichment fixes

## [v0.0.91](https://github.com//joinworth/integration-service/compare/v0.0.90...v0.0.91) - 2024-07-19

### 📝 Other

- 📝 Fix: hotfix body to query in get

## [v0.0.90](https://github.com//joinworth/integration-service/compare/v0.0.89...v0.0.90) - 2024-07-19

### 📝 Other

- 📝 Fix: latest task when case id passed

## [v0.0.89](https://github.com//joinworth/integration-service/compare/v0.0.88...v0.0.89) - 2024-07-19

### 📝 Other

- 📝 Fix: hotfix cannot convert to json

## [v0.0.88](https://github.com//joinworth/integration-service/compare/v0.0.87...v0.0.88) - 2024-07-19

### 📝 Other

- 📝 Fix: bullqueue if no seller found

## [v0.0.87](https://github.com//joinworth/integration-service/compare/v0.0.81...v0.0.87) - 2024-07-18

### 📖 Story

**[WIN-109](https://worth-ai.atlassian.net/browse/WIN-109) - [FE+BE] CRO Dashboard - Risk Alerts**

- 📝 feat: CRO dashboard risk alert reasons chart ([#342](https://github.com/joinworth/integration-service/pull/342))
- 📝 fix: cro dashboard stats ([#355](https://github.com/joinworth/integration-service/pull/355))

**[WIN-440](https://worth-ai.atlassian.net/browse/WIN-440) - [FE+BE] Risk Alerts Generation**

- 📝 feat: migration script for risk alerts ([#313](https://github.com/joinworth/integration-service/pull/313))
- 📝 Generate Risk Alerts ([#349](https://github.com/joinworth/integration-service/pull/349))
- 📝 fix: low risk case on the basis of score should not be created ([#353](https://github.com/joinworth/integration-service/pull/353))
- 📝 fix risk config update messages & credit score diff calculation ([#359](https://github.com/joinworth/integration-service/pull/359))

**[WIN-834](https://worth-ai.atlassian.net/browse/WIN-834) - [FE+BE] As a user, when a company website is provided, I want the information to be passed to Middesk.**

- 📝 feat: middesk website data ([#357](https://github.com/joinworth/integration-service/pull/357))
- 📝 fix: Website data fetch Multiple task creation and Task status ([#364](https://github.com/joinworth/integration-service/pull/364))

### 🐛 Bug

**[WIN-927](https://worth-ai.atlassian.net/browse/WIN-927) - KYB tab not loading for Business**

- 📝 set limit for json parse to 20MB ([#348](https://github.com/joinworth/integration-service/pull/348))

**[WIN-991](https://worth-ai.atlassian.net/browse/WIN-991) - Middesk Website Verification Not Polling for Right BusinessID**

- 📝 Use middesk's business ID when asking for website details ([#365](https://github.com/joinworth/integration-service/pull/365))

**[WIN-993](https://worth-ai.atlassian.net/browse/WIN-993) - Errors while adding/removing banking/accounting integrations from SMB Dashboard**

- 📝 fix: logic update for post application edit ([#366](https://github.com/joinworth/integration-service/pull/366))

### ✨ Enhancement

**[WIN-901](https://worth-ai.atlassian.net/browse/WIN-901) - [FE+BE] - SMB Dashboard - Show Vintage Score Difference from Last Month**

- 📝 Vantage score difference ([#341](https://github.com/joinworth/integration-service/pull/341))

**[WIN-911](https://worth-ai.atlassian.net/browse/WIN-911) - [BILL.COM] Update Company Tab**

- 📝 fetch and serve additional equifax data points ([#356](https://github.com/joinworth/integration-service/pull/356))

**[WIN-925](https://worth-ai.atlassian.net/browse/WIN-925) - [BE]Update Verdata implementation to handle updated Seller Search response**

- 📝 Update Verdata implementation ([#362](https://github.com/joinworth/integration-service/pull/362))

### 💻 Tech Task

**[WIN-766](https://worth-ai.atlassian.net/browse/WIN-766) - Bill.com Customer Access**

- 📝 | Handle bulk update ([#256](https://github.com/joinworth/integration-service/pull/256))

**[WIN-900](https://worth-ai.atlassian.net/browse/WIN-900) - Store inputs when scoring**

- 📝 Persist Equifax & Verdata Runs in DB ([#305](https://github.com/joinworth/integration-service/pull/305))

**[WIN-902](https://worth-ai.atlassian.net/browse/WIN-902) - Create a new connection to the data lake**

- 📝 & | Add HydrateFromWarehouse Decorator & Implementation for Middesk P… ([#326](https://github.com/joinworth/integration-service/pull/326))

**[WIN-966](https://worth-ai.atlassian.net/browse/WIN-966) - Upload raw data from Google Places and Google Business to s3 to be used in scoring**

- 📝 upload raw response from google places & business API to s3 ([#352](https://github.com/joinworth/integration-service/pull/352))

**[WIN-983](https://worth-ai.atlassian.net/browse/WIN-983) - Update the logic for Middesk failed webhooks**

- 📝 fix: added internal route for get-business-entity ([#363](https://github.com/joinworth/integration-service/pull/363))

### 🛑 Defect

**[WIN-918](https://worth-ai.atlassian.net/browse/WIN-918) - [SMB] Insights tab issue-2**

- 📝 skip optionallyAddActionItems ([#354](https://github.com/joinworth/integration-service/pull/354))

### 📝 Other

- 📝 #NO_JIRA fix: verdata 404 ([#373](https://github.com/joinworth/integration-service/pull/373))
- 📝 #NO_JIRA: fix: risk_alert_id in payload to create risk alert case ([#368](https://github.com/joinworth/integration-service/pull/368))
- 📝 #NO_JIRA fix: insert ratings only if they are fetched from google places ([#367](https://github.com/joinworth/integration-service/pull/367))
- 📝 #NO_JIRA insights updates ([#343](https://github.com/joinworth/integration-service/pull/343))
- 📝 (#NO_JIRA) fix: added route for tax-filings based on case-id ([#346](https://github.com/joinworth/integration-service/pull/346))
- 📝 (#NO_JIRA) fix: added business-id in middesk webhook logger ([#347](https://github.com/joinworth/integration-service/pull/347))
- 📝 #NO_JIRA Equifax athena updates ([#340](https://github.com/joinworth/integration-service/pull/340))
- 📝 #NO_JIRA Bull queue visibility ([#344](https://github.com/joinworth/integration-service/pull/344))

**[WIN-909](https://worth-ai.atlassian.net/browse/WIN-909) - No title available**

- 📝 feat: hydrating verdata public records to fetch additional points ([#345](https://github.com/joinworth/integration-service/pull/345))
- 📝 fix: allow customer role ([#350](https://github.com/joinworth/integration-service/pull/350))
- 📝 fetch and serve equifax trade lines data points ([#358](https://github.com/joinworth/integration-service/pull/358))

## [v0.0.81](https://github.com//joinworth/integration-service/compare/v0.0.80...v0.0.81) - 2024-07-05

### ✨ Enhancement

**[WIN-911](https://worth-ai.atlassian.net/browse/WIN-911) - [BILL.COM] Update Company Tab**

- 📝 fetch and serve additional equifax data points ([#356](https://github.com/joinworth/integration-service/pull/356))

### 📝 Other

**[WIN-909](https://worth-ai.atlassian.net/browse/WIN-909) - No title available**

- 📝 fetch and serve equifax trade lines data points ([#358](https://github.com/joinworth/integration-service/pull/358))

## [v0.0.80](https://github.com//joinworth/integration-service/compare/v0.0.78...v0.0.80) - 2024-07-04

### ✨ Enhancement

**[WIN-901](https://worth-ai.atlassian.net/browse/WIN-901) - [FE+BE] - SMB Dashboard - Show Vintage Score Difference from Last Month**

- 📝 Vantage score difference ([#341](https://github.com/joinworth/integration-service/pull/341))

### 💻 Tech Task

**[WIN-900](https://worth-ai.atlassian.net/browse/WIN-900) - Store inputs when scoring**

- 📝 Persist Equifax & Verdata Runs in DB ([#305](https://github.com/joinworth/integration-service/pull/305))

**[WIN-902](https://worth-ai.atlassian.net/browse/WIN-902) - Create a new connection to the data lake**

- 📝 & | Add HydrateFromWarehouse Decorator & Implementation for Middesk P… ([#326](https://github.com/joinworth/integration-service/pull/326))

### 📝 Other

- 📝 #NO_JIRA Equifax athena updates ([#340](https://github.com/joinworth/integration-service/pull/340))

**[WIN-909](https://worth-ai.atlassian.net/browse/WIN-909) - No title available**

- 📝 feat: hydrating verdata public records to fetch additional points ([#345](https://github.com/joinworth/integration-service/pull/345))
- 📝 fix: allow customer role ([#350](https://github.com/joinworth/integration-service/pull/350))

## [v0.0.78](https://github.com//joinworth/integration-service/compare/v0.0.77...v0.0.78) - 2024-07-03

### 📝 Other

- 📝 Set limit for json parse to 20MB

## [v0.0.77](https://github.com//joinworth/integration-service/compare/v0.0.76...v0.0.77) - 2024-07-03

### 📝 Other

- 📝 (#NO_JIRA) fix: added business-id in middesk webhook logger ([#347](https://github.com/joinworth/integration-service/pull/347))

## [v0.0.76](https://github.com//joinworth/integration-service/compare/v0.0.75...v0.0.76) - 2024-07-03

### 📝 Other

- 📝 (#NO_JIRA) fix: added route for tax-filings based on case-id ([#346](https://github.com/joinworth/integration-service/pull/346))

## [v0.0.75](https://github.com//joinworth/integration-service/compare/v0.0.68...v0.0.75) - 2024-07-02

### 📖 Story

**[WIN-531](https://worth-ai.atlassian.net/browse/WIN-531) - [SMB] Insights tab**

- 📝 insights assistant routes ([#283](https://github.com/joinworth/integration-service/pull/283))
- 📝 ability to update is_complete for action items ([#310](https://github.com/joinworth/integration-service/pull/310))

**[WIN-750](https://worth-ai.atlassian.net/browse/WIN-750) - Update email content for score refresh**

- 📝 fix: category naming ([#334](https://github.com/joinworth/integration-service/pull/334))
- 📝 fix: category naming fix ([#332](https://github.com/joinworth/integration-service/pull/332))
- 📝 fix: score refresh query update ([#327](https://github.com/joinworth/integration-service/pull/327))

### 🧰 Task

**[SEC-49](https://worth-ai.atlassian.net/browse/SEC-49) - [Vanta] Remediate "Critical vulnerabilities identified in packages are addressed (Github Repo)" for npm-minimist >= 1.0.0, < 1.2.6/CVE-2021-44906**

- 📝 fix: package updates ([#321](https://github.com/joinworth/integration-service/pull/321))

### 🐛 Bug

**[WIN-856](https://worth-ai.atlassian.net/browse/WIN-856) - [FE + BE] First time connected banking with Citibank and during edit banking switched to other bank but in the integration module, it showed the name of the previously connected bank only.**

- 📝 fix: banking fix ([#335](https://github.com/joinworth/integration-service/pull/335))
- 📝 fix bank change not being reflected ([#318](https://github.com/joinworth/integration-service/pull/318))
- 📝 fix: fetch latest banking institution names ([#324](https://github.com/joinworth/integration-service/pull/324))

**[WIN-865](https://worth-ai.atlassian.net/browse/WIN-865) - [BE + FE] Under Confirmation/Review screen, show bank name instead of Plaid**

- 📝 fix: display banking institution name ([#296](https://github.com/joinworth/integration-service/pull/296))
- 📝 Query update for fetching distinct institution names ([#308](https://github.com/joinworth/integration-service/pull/308))

**[WIN-883](https://worth-ai.atlassian.net/browse/WIN-883) - Balance sheet records are duplicated**

- 📝 Force accounting report to use task ([#336](https://github.com/joinworth/integration-service/pull/336))

**[WIN-884](https://worth-ai.atlassian.net/browse/WIN-884) - After removing all the integration then on dashboard it shouldn't display the score**

- 📝 fix: add new key to indicate latest score generation status ([#311](https://github.com/joinworth/integration-service/pull/311))

**[WIN-895](https://worth-ai.atlassian.net/browse/WIN-895) - Tax Filings Not Displayed in SMB Portal**

- 📝 feat: tax status score refresh ([#316](https://github.com/joinworth/integration-service/pull/316))
- 📝 feat: tax-status post webhook data fetching ([#322](https://github.com/joinworth/integration-service/pull/322))

### ✨ Enhancement

**[WIN-830](https://worth-ai.atlassian.net/browse/WIN-830) - [BE + FE] Default Dashboard and Tabs to month with most recent data**

- 📝 fix: fetch stats data for success connections only ([#338](https://github.com/joinworth/integration-service/pull/338))
- 📝 fix: Default Dashboard and Tabs to month with most recent data ([#330](https://github.com/joinworth/integration-service/pull/330))
- 📝 feat: Default Dashboard and Tabs to month with most recent data ([#323](https://github.com/joinworth/integration-service/pull/323))

**[WIN-871](https://worth-ai.atlassian.net/browse/WIN-871) - Incremental data on Plaid refresh**

- 📝 fix negative daysSince ([#328](https://github.com/joinworth/integration-service/pull/328))
- 📝 plaid incremental refresh ([#312](https://github.com/joinworth/integration-service/pull/312))

**[WIN-877](https://worth-ai.atlassian.net/browse/WIN-877) - [FE +BE] Null state for Taxes**

- 📝 Null state Handling for taxes ([#315](https://github.com/joinworth/integration-service/pull/315))
- 📝 null state for taxes ([#319](https://github.com/joinworth/integration-service/pull/319))
- 📝 Null state for taxes ([#320](https://github.com/joinworth/integration-service/pull/320))
- 📝 Null state for taxes ([#325](https://github.com/joinworth/integration-service/pull/325))

**[WIN-929](https://worth-ai.atlassian.net/browse/WIN-929) - [FE+BE] Taxation charts should be rendered by Years instead of Quaters**

- 📝 feat: taxation charts in yearly manner ([#337](https://github.com/joinworth/integration-service/pull/337))

### 💻 Tech Task

**[WIN-812](https://worth-ai.atlassian.net/browse/WIN-812) - Tech Debt | Testing in Lower Environments**

- 📝 - Tech Debt | Testing in Lower Environments - Fix Issue ([#317](https://github.com/joinworth/integration-service/pull/317))

**[WIN-854](https://worth-ai.atlassian.net/browse/WIN-854) - Update kowl image on all envs so that action to publish message is available**

- 📝 fix: fetch all integrations if required categories not connected (ban… ([#331](https://github.com/joinworth/integration-service/pull/331))

### 📝 Other

- 📝 #NO_JIRA insights updates ([#343](https://github.com/joinworth/integration-service/pull/343))
- 📝 #NO_JIRA add join back in ([#339](https://github.com/joinworth/integration-service/pull/339))
- 📝 Fix: plaid revoke logic reinserting (#NO_JIRA) ([#333](https://github.com/joinworth/integration-service/pull/333))
- 📝 #NO_JIRA fix: update connection query values fixed ([#329](https://github.com/joinworth/integration-service/pull/329))
- 📝 Fix: tax status stats logic and response fix (#NO_JIRA) ([#309](https://github.com/joinworth/integration-service/pull/309))
- 📝 Fix: taxation response key updates (#NO_JIRA) ([#314](https://github.com/joinworth/integration-service/pull/314))

## [v0.0.68](https://github.com//joinworth/integration-service/compare/v0.0.67...v0.0.68) - 2024-06-20

### 🐛 Bug

**[WIN-895](https://worth-ai.atlassian.net/browse/WIN-895) - Tax Filings Not Displayed in SMB Portal**

- 📝 feat: tax-status post webhook data fetching ([#322](https://github.com/joinworth/integration-service/pull/322))

## [v0.0.67](https://github.com//joinworth/integration-service/compare/v0.0.64...v0.0.67) - 2024-06-19

### 🐛 Bug

**[WIN-895](https://worth-ai.atlassian.net/browse/WIN-895) - Tax Filings Not Displayed in SMB Portal**

- 📝 feat: tax status score refresh ([#316](https://github.com/joinworth/integration-service/pull/316))

## [v0.0.64](https://github.com//joinworth/integration-service/compare/v0.0.63...v0.0.64) - 2024-06-18

### 📝 Other

- 📝 Fix: taxation response key updates (#NO_JIRA) ([#314](https://github.com/joinworth/integration-service/pull/314))

## [v0.0.63](https://github.com//joinworth/integration-service/compare/v0.0.60...v0.0.63) - 2024-06-17

### 📖 Story

**[WIN-688](https://worth-ai.atlassian.net/browse/WIN-688) - [FE+BE] SMB Tab - Integration Action Management Actions for Plaid / Banking integration from SMB dashboard**

- 📝 Revoke connection for Plaid/Banking ([#295](https://github.com/joinworth/integration-service/pull/295))
- 📝 Revoke connection for Plaid/Banking ([#301](https://github.com/joinworth/integration-service/pull/301))

**[WIN-697](https://worth-ai.atlassian.net/browse/WIN-697) - [FE+BE] Actions for Tax Status from Integrations Tab**

- 📝 feat: revoke tax-status ([#249](https://github.com/joinworth/integration-service/pull/249))

**[WIN-861](https://worth-ai.atlassian.net/browse/WIN-861) - Case creation while adding/removing integration connection**

- 📝 fix: case creation order for standalone case ([#307](https://github.com/joinworth/integration-service/pull/307))
- 📝 feat: Case creation while adding/removing integration connection ([#290](https://github.com/joinworth/integration-service/pull/290))

### 🐛 Bug

**[WIN-719](https://worth-ai.atlassian.net/browse/WIN-719) - Equifax Credit Score is not being pulled in in production**

- 📝 | adjust payload for equifax ([#251](https://github.com/joinworth/integration-service/pull/251))

**[WIN-827](https://worth-ai.atlassian.net/browse/WIN-827) - [BE] TaxStatus Webhook Failing**

- 📝 fix: webhook bad request ([#281](https://github.com/joinworth/integration-service/pull/281))
- 📝 - Fix: updated code to fix transcript data ([#282](https://github.com/joinworth/integration-service/pull/282))
- 📝 fix: tax status webhook added version ([#291](https://github.com/joinworth/integration-service/pull/291))
- 📝 fix: tax status webhook filing amount ([#299](https://github.com/joinworth/integration-service/pull/299))

### ✨ Enhancement

**[WIN-776](https://worth-ai.atlassian.net/browse/WIN-776) - [BE] SMB Tabs – Account Balance Concerns**

- 📝 Adjust balance logic to not be "Average" ([#289](https://github.com/joinworth/integration-service/pull/289))
- 📝 Fix most recent balances ([#302](https://github.com/joinworth/integration-service/pull/302))
- 📝 Accumulator bug ([#303](https://github.com/joinworth/integration-service/pull/303))

**[WIN-787](https://worth-ai.atlassian.net/browse/WIN-787) - SMB Reputation - Allow Users to Re-authenticate for Business Reviews Retrieval**

- 📝 Allow Users to Re-authenticate for Business Reviews Retrieval ([#258](https://github.com/joinworth/integration-service/pull/258))

**[WIN-814](https://worth-ai.atlassian.net/browse/WIN-814) - [FE+BE] Remove/Revoke Tax Consent**

- 📝 fix: taxstatus revoke update ([#294](https://github.com/joinworth/integration-service/pull/294))
- 📝 fix: payload update for tax status consent init ([#304](https://github.com/joinworth/integration-service/pull/304))

**[WIN-820](https://worth-ai.atlassian.net/browse/WIN-820) - [FE+BE] Allow viewing of Equifax credit score for Customer and Worth Admins**

- 📝 allowed customer to fetch business owners credit score ([#267](https://github.com/joinworth/integration-service/pull/267))

**[WIN-822](https://worth-ai.atlassian.net/browse/WIN-822) - [BE] Score did not generate because of In Progress flag**

- 📝 | Generate score regardless of Accounting task completion state ([#277](https://github.com/joinworth/integration-service/pull/277))

**[WIN-831](https://worth-ai.atlassian.net/browse/WIN-831) - Pull in max amount of data for Plaid Assets Report**

- 📝 Max out number of plaid days to sync ([#293](https://github.com/joinworth/integration-service/pull/293))

**[WIN-848](https://worth-ai.atlassian.net/browse/WIN-848) - Reputation chart is not populating in dashboard**

- 📝 fix: public records for business on SMB & repuatation ratings changes ([#298](https://github.com/joinworth/integration-service/pull/298))
- 📝 Reputation chart changes for google business ([#300](https://github.com/joinworth/integration-service/pull/300))

**[WIN-851](https://worth-ai.atlassian.net/browse/WIN-851) - Show TOTAL Income/Expenses on Transactions tab**

- 📝 - Show TOTAL Income/Expenses on Transactions tab. ([#292](https://github.com/joinworth/integration-service/pull/292))

### 💻 Tech Task

**[WIN-812](https://worth-ai.atlassian.net/browse/WIN-812) - Tech Debt | Testing in Lower Environments**

- 📝 - Tech Debt | Testing in Lower Environments ([#284](https://github.com/joinworth/integration-service/pull/284))

**[WIN-847](https://worth-ai.atlassian.net/browse/WIN-847) - PR title format check github action on all service and webapps repo**

- 📝 PR title format ([#285](https://github.com/joinworth/integration-service/pull/285))

### 📝 Other

- 📝 Fix: tax status stats logic and response fix (#NO_JIRA) ([#309](https://github.com/joinworth/integration-service/pull/309))
- 📝 Fix: response message updated when no reviews fetched from Google Business ([#264](https://github.com/joinworth/integration-service/pull/264))
- 📝 Fix: check update ([#265](https://github.com/joinworth/integration-service/pull/265))
- 📝 Fix: score trigger check from Task manager ([#268](https://github.com/joinworth/integration-service/pull/268))
- 📝 Fix: if connnection is not success returning while executing tasks ([#271](https://github.com/joinworth/integration-service/pull/271))
- 📝 Fix: score refresh ([#272](https://github.com/joinworth/integration-service/pull/272))
- 📝 Fixes: Flow of connection & task status transition ([#269](https://github.com/joinworth/integration-service/pull/269))
- 📝 Fix: Tax Status webhook failing ([#273](https://github.com/joinworth/integration-service/pull/273))
- 📝 Fix: reviews source when place connection failed & no business reviews ([#276](https://github.com/joinworth/integration-service/pull/276))
- 📝 Fix: hotfix pull to main (#NO_JIRA) ([#306](https://github.com/joinworth/integration-service/pull/306))
- 📝 Code Sanity: Removing Temp APIs ([#263](https://github.com/joinworth/integration-service/pull/263))
- 📝 BUG: Fetch large number of reviews from Google Business API ([#261](https://github.com/joinworth/integration-service/pull/261))
- 📝 Fix: query of fetching connection for Public records ([#274](https://github.com/joinworth/integration-service/pull/274))
- 📝 Listed bugs: Integrations API changes and other bugs ([#275](https://github.com/joinworth/integration-service/pull/275))
- 📝 Hotfix: typo in place_id ([#279](https://github.com/joinworth/integration-service/pull/279))
- 📝 #NO_JIRA: ci: repo clean up ([#286](https://github.com/joinworth/integration-service/pull/286))
- 📝 Couple of issues with Equifax Matching ([#280](https://github.com/joinworth/integration-service/pull/280))
- 📝 #NO_JIRA: fix: remove duplicate actions to run test coverage ([#288](https://github.com/joinworth/integration-service/pull/288))

**[WIN-700](https://worth-ai.atlassian.net/browse/WIN-700) - No title available**

- 📝 Feat: Added logic to revoke accounting connection ([#259](https://github.com/joinworth/integration-service/pull/259))

## [v0.0.60](https://github.com//joinworth/integration-service/compare/v0.0.59...v0.0.60) - 2024-06-12

### 📝 Other

- 📝 Fix: hotfix added check for transactions

## [v0.0.59](https://github.com//joinworth/integration-service/compare/v0.0.58...v0.0.59) - 2024-06-12

### 🐛 Bug

**[WIN-827](https://worth-ai.atlassian.net/browse/WIN-827) - [BE] TaxStatus Webhook Failing**

- 📝 fix: tax status webhook filing amount ([#299](https://github.com/joinworth/integration-service/pull/299))

## [v0.0.58](https://github.com//joinworth/integration-service/compare/v0.0.57...v0.0.58) - 2024-06-11

### 🐛 Bug

**[WIN-827](https://worth-ai.atlassian.net/browse/WIN-827) - [BE] TaxStatus Webhook Failing**

- 📝 fix: tax status webhook added version ([#291](https://github.com/joinworth/integration-service/pull/291))

## [v0.0.57](https://github.com//joinworth/integration-service/compare/v0.0.56...v0.0.57) - 2024-06-07

### 🐛 Bug

**[WIN-827](https://worth-ai.atlassian.net/browse/WIN-827) - [BE] TaxStatus Webhook Failing**

- 📝 - Fix: updated code to fix transcript data ([#282](https://github.com/joinworth/integration-service/pull/282))

## [v0.0.56](https://github.com//joinworth/integration-service/compare/v0.0.55...v0.0.56) - 2024-06-03

### 🐛 Bug

**[WIN-827](https://worth-ai.atlassian.net/browse/WIN-827) - [BE] TaxStatus Webhook Failing**

- 📝 fix: webhook bad request ([#281](https://github.com/joinworth/integration-service/pull/281))

## [v0.0.55](https://github.com//joinworth/integration-service/compare/v0.0.54...v0.0.55) - 2024-05-31

### ✨ Enhancement

**[WIN-822](https://worth-ai.atlassian.net/browse/WIN-822) - [BE] Score did not generate because of In Progress flag**

- 📝 | Generate score regardless of Accounting task completion state ([#277](https://github.com/joinworth/integration-service/pull/277))

## [v0.0.54](https://github.com//joinworth/integration-service/compare/v0.0.53...v0.0.54) - 2024-05-31

### 📝 Other

- 📝 Hotfix: typo in place_id ([#278](https://github.com/joinworth/integration-service/pull/278))

## [v0.0.53](https://github.com//joinworth/integration-service/compare/v0.0.52...v0.0.53) - 2024-05-31

### 📝 Other

- 📝 Fix: added type

## [v0.0.52](https://github.com//joinworth/integration-service/compare/v0.0.51...v0.0.52) - 2024-05-31

### 📝 Other

- 📝 Fix: if connnection is not success returning while executing tasks ([#271](https://github.com/joinworth/integration-service/pull/271))
- 📝 Fix: score refresh ([#272](https://github.com/joinworth/integration-service/pull/272))
- 📝 Fixes: Flow of connection & task status transition ([#269](https://github.com/joinworth/integration-service/pull/269))
- 📝 Fix: Tax Status webhook failing ([#273](https://github.com/joinworth/integration-service/pull/273))
- 📝 Fix: reviews source when place connection failed & no business reviews ([#276](https://github.com/joinworth/integration-service/pull/276))
- 📝 Fix: query of fetching connection for Public records ([#274](https://github.com/joinworth/integration-service/pull/274))
- 📝 Listed bugs: Integrations API changes and other bugs ([#275](https://github.com/joinworth/integration-service/pull/275))

## [v0.0.51](https://github.com//joinworth/integration-service/compare/v0.0.50...v0.0.51) - 2024-05-30

### ✨ Enhancement

**[WIN-820](https://worth-ai.atlassian.net/browse/WIN-820) - [FE+BE] Allow viewing of Equifax credit score for Customer and Worth Admins**

- 📝 allowed customer to fetch business owners credit score ([#267](https://github.com/joinworth/integration-service/pull/267))

## [v0.0.50](https://github.com//joinworth/integration-service/compare/v0.0.49...v0.0.50) - 2024-05-29

### 📝 Other

- 📝 Fix: score trigger check from Task manager ([#268](https://github.com/joinworth/integration-service/pull/268))

## [v0.0.49](https://github.com//joinworth/integration-service/compare/v0.0.48...v0.0.49) - 2024-05-28

### 📝 Other

- 📝 Fix: check update ([#265](https://github.com/joinworth/integration-service/pull/265))

## [v0.0.48](https://github.com//joinworth/integration-service/compare/v0.0.45...v0.0.48) - 2024-05-27

### 📖 Story

**[WIN-731](https://worth-ai.atlassian.net/browse/WIN-731) - [FE+BE] As an SMB user, I should only be able to view my own Equifax credit score.**

- 📝 fetch Equifax credit score of a logged in user ([#250](https://github.com/joinworth/integration-service/pull/250))

### 🐛 Bug

**[WIN-719](https://worth-ai.atlassian.net/browse/WIN-719) - Equifax Credit Score is not being pulled in in production**

- 📝 | adjust payload for equifax ([#251](https://github.com/joinworth/integration-service/pull/251))

**[WIN-780](https://worth-ai.atlassian.net/browse/WIN-780) - Tax Status is Failing**

- 📝 TaxStatus Bug fix ([#238](https://github.com/joinworth/integration-service/pull/238))
- 📝 fix: mobile number without country code ([#244](https://github.com/joinworth/integration-service/pull/244))

**[WIN-805](https://worth-ai.atlassian.net/browse/WIN-805) - PlaidIDV | IDV requests stay "pending" when no phone number provided**

- 📝 | use existing function to sanitize phone # ([#239](https://github.com/joinworth/integration-service/pull/239))

### ✨ Enhancement

**[WIN-720](https://worth-ai.atlassian.net/browse/WIN-720) - [BE] Implement Score calculation on Case Submit**

- 📝 feat: score calculation on submission ([#252](https://github.com/joinworth/integration-service/pull/252))

**[WIN-744](https://worth-ai.atlassian.net/browse/WIN-744) - SMB Enhancements for Reputation tab**

- 📝 Sending average ratings & source of ratings ([#236](https://github.com/joinworth/integration-service/pull/236))
- 📝 Revert removed reviews route validation middleware ([#237](https://github.com/joinworth/integration-service/pull/237))

**[WIN-761](https://worth-ai.atlassian.net/browse/WIN-761) - [FE+BE] SMB Dashboard - Implement Dynamic Reputation Chart**

- 📝 Overall average rating ([#248](https://github.com/joinworth/integration-service/pull/248))

**[WIN-767](https://worth-ai.atlassian.net/browse/WIN-767) - Allow Unmasked TIN Viewing for Worth Admin/Customer Admin**

- 📝 TIN UNMASKING ENHANCEMENT ([#242](https://github.com/joinworth/integration-service/pull/242))

**[WIN-775](https://worth-ai.atlassian.net/browse/WIN-775) - [FE+BE] SMB Dashboard – Account Balance section**

- 📝 fix: dashboard and module charts ([#254](https://github.com/joinworth/integration-service/pull/254))
- 📝 fix: delta account balance ([#247](https://github.com/joinworth/integration-service/pull/247))

**[WIN-787](https://worth-ai.atlassian.net/browse/WIN-787) - SMB Reputation - Allow Users to Re-authenticate for Business Reviews Retrieval**

- 📝 Allow Users to Re-authenticate for Business Reviews Retrieval ([#258](https://github.com/joinworth/integration-service/pull/258))

### 📝 Other

- 📝 Fix: response message updated when no reviews fetched from Google Business ([#264](https://github.com/joinworth/integration-service/pull/264))
- 📝 Code Sanity: Removing Temp APIs ([#263](https://github.com/joinworth/integration-service/pull/263))
- 📝 BUG: Fetch large number of reviews from Google Business API ([#261](https://github.com/joinworth/integration-service/pull/261))
- 📝 Fix: Equifax undefined reportDate temp bypass ([#255](https://github.com/joinworth/integration-service/pull/255))
- 📝 Feat: saving public records data to s3 ([#235](https://github.com/joinworth/integration-service/pull/235))
- 📝 Fix: Fetch Public records in integrations ([#245](https://github.com/joinworth/integration-service/pull/245))
- 📝 Handle connection not exist for platform when new platform introduced ([#243](https://github.com/joinworth/integration-service/pull/243))
- 📝 Win 761 reputation chart ([#246](https://github.com/joinworth/integration-service/pull/246))
- 📝 WIN 749: Economics integration implementation ([#229](https://github.com/joinworth/integration-service/pull/229))
- 📝 Feature: deconstruct address fields for Document Extraction Assistant ([#233](https://github.com/joinworth/integration-service/pull/233))

**[WIN-659](https://worth-ai.atlassian.net/browse/WIN-659) - No title available**

- 📝 Add Equifax fetch_public_records handler & route ([#217](https://github.com/joinworth/integration-service/pull/217))

## [v0.0.45](https://github.com//joinworth/integration-service/compare/v0.0.44...v0.0.45) - 2024-05-17

### 🐛 Bug

**[WIN-780](https://worth-ai.atlassian.net/browse/WIN-780) - Tax Status is Failing**

- 📝 fix: mobile number without country code ([#244](https://github.com/joinworth/integration-service/pull/244))

### ✨ Enhancement

**[WIN-767](https://worth-ai.atlassian.net/browse/WIN-767) - Allow Unmasked TIN Viewing for Worth Admin/Customer Admin**

- 📝 TIN UNMASKING ENHANCEMENT ([#242](https://github.com/joinworth/integration-service/pull/242))

## [v0.0.44](https://github.com//joinworth/integration-service/compare/v0.0.40...v0.0.44) - 2024-05-15

### 📝 Other

- 📝 Feat: saving public records data to s3 ([#235](https://github.com/joinworth/integration-service/pull/235))

## [v0.0.40](https://github.com//joinworth/integration-service/compare/v0.0.42...v0.0.40) - 2024-05-14

### 🐛 Bug

**[WIN-780](https://worth-ai.atlassian.net/browse/WIN-780) - Tax Status is Failing**

- 📝 TaxStatus Bug fix ([#238](https://github.com/joinworth/integration-service/pull/238))

### 📝 Other

- 📝 Feature: deconstruct address fields for Document Extraction Assistant ([#233](https://github.com/joinworth/integration-service/pull/233))

## [v0.0.42](https://github.com//joinworth/integration-service/compare/v0.0.41...v0.0.42) - 2024-05-15

### 🐛 Bug

**[WIN-780](https://worth-ai.atlassian.net/browse/WIN-780) - Tax Status is Failing**

- 📝 TaxStatus Bug fix ([#238](https://github.com/joinworth/integration-service/pull/238))

### ✨ Enhancement

**[WIN-744](https://worth-ai.atlassian.net/browse/WIN-744) - SMB Enhancements for Reputation tab**

- 📝 Sending average ratings & source of ratings ([#236](https://github.com/joinworth/integration-service/pull/236))
- 📝 Revert removed reviews route validation middleware ([#237](https://github.com/joinworth/integration-service/pull/237))

## [v0.0.41](https://github.com//joinworth/integration-service/compare/v0.0.35...v0.0.41) - 2024-05-15

### 📖 Story

**[WIN-528](https://worth-ai.atlassian.net/browse/WIN-528) - [FE + BE] [SMB] Reputation tab**

- 📝 Onclick taking consent every time & unit tests ([#234](https://github.com/joinworth/integration-service/pull/234))
- 📝 Fetch reviews from Google Business API ([#223](https://github.com/joinworth/integration-service/pull/223))

**[WIN-711](https://worth-ai.atlassian.net/browse/WIN-711) - SMB Tab – Financials (Income statement/ P&L) Enhancement**

- 📝 feat: Financials Tab Charts ([#225](https://github.com/joinworth/integration-service/pull/225))

**[WIN-712](https://worth-ai.atlassian.net/browse/WIN-712) - SMB Tab – Financials (Balance Sheet – Monthly) Enhancement**

- 📝 feat: Balance sheet charts ([#224](https://github.com/joinworth/integration-service/pull/224))

### 🐛 Bug

**[WIN-585](https://worth-ai.atlassian.net/browse/WIN-585) - [High]Send customer invite to existing business to unique or existing email id and after completed the onboarding process and from customer admin check case detail so their it not displaying the 'worth score & Banking'.**

- 📝 fix: removing existing-case-id field ([#220](https://github.com/joinworth/integration-service/pull/220))

**[WIN-779](https://worth-ai.atlassian.net/browse/WIN-779) - Income and Expenses are Flipped**

- 📝 fix: interchange expense and income values ([#231](https://github.com/joinworth/integration-service/pull/231))
- 📝 feat: reopen PR to fix negative values in charts ([#232](https://github.com/joinworth/integration-service/pull/232))

**[WIN-780](https://worth-ai.atlassian.net/browse/WIN-780) - Tax Status is Failing**

- 📝 TaxStatus Bug fix ([#238](https://github.com/joinworth/integration-service/pull/238))

### ✨ Enhancement

**[WIN-743](https://worth-ai.atlassian.net/browse/WIN-743) - [FE + BE] SMB Enhancements for Accounts and Transactions Tabs**

- 📝 fix: sorting by amount ([#219](https://github.com/joinworth/integration-service/pull/219))

**[WIN-744](https://worth-ai.atlassian.net/browse/WIN-744) - SMB Enhancements for Reputation tab**

- 📝 Sending average ratings & source of ratings ([#236](https://github.com/joinworth/integration-service/pull/236))
- 📝 Revert removed reviews route validation middleware ([#237](https://github.com/joinworth/integration-service/pull/237))

**[WIN-776](https://worth-ai.atlassian.net/browse/WIN-776) - [BE] SMB Tabs – Account Balance Concerns**

- 📝 fix: Balance listing (Fix Part 1) ([#228](https://github.com/joinworth/integration-service/pull/228))

### 📝 Other

- 📝 Fix: rutter connection case update ([#226](https://github.com/joinworth/integration-service/pull/226))
- 📝 WIN 749: Economics integration implementation ([#229](https://github.com/joinworth/integration-service/pull/229))
- 📝 Fix: transaction charts fix ([#227](https://github.com/joinworth/integration-service/pull/227))
- 📝 Fix: Modified logic to upload asset_report to S3 ([#230](https://github.com/joinworth/integration-service/pull/230))
- 📝 Hotfix: added new keys for decryption ([#221](https://github.com/joinworth/integration-service/pull/221)) ([#222](https://github.com/joinworth/integration-service/pull/222))
- 📝 Release/document extraction assistant v0.0.29 ([#216](https://github.com/joinworth/integration-service/pull/216))

## [v0.0.35](https://github.com//joinworth/integration-service/compare/v0.0.34...v0.0.35) - 2024-05-09

### 📝 Other

- 📝 Feat: cherry-pick fix for transactions charts

## [v0.0.34](https://github.com//joinworth/integration-service/compare/v0.0.28...v0.0.34) - 2024-05-07

### 📖 Story

**[WIN-424](https://worth-ai.atlassian.net/browse/WIN-424) - [FE BE] Add Industry from TaxStatus/map in friendly name**

- 📝 Map naics industry details ([#189](https://github.com/joinworth/integration-service/pull/189))

**[WIN-656](https://worth-ai.atlassian.net/browse/WIN-656) - [FE+BE] SMB tabs with Charts (Transaction)**

- 📝 feat: transactions charts api ([#180](https://github.com/joinworth/integration-service/pull/180))

**[WIN-698](https://worth-ai.atlassian.net/browse/WIN-698) - [FE+BE] SMB tabs with Charts (Account Balances)**

- 📝 feat: Account balances charts ([#185](https://github.com/joinworth/integration-service/pull/185))

**[WIN-699](https://worth-ai.atlassian.net/browse/WIN-699) - [FE+BE] SMB tabs with Charts (Taxes)**

- 📝 Taxes charts ([#191](https://github.com/joinworth/integration-service/pull/191))
- 📝 Taxes charts ([#194](https://github.com/joinworth/integration-service/pull/194))

### 🐛 Bug

**[WIN-585](https://worth-ai.atlassian.net/browse/WIN-585) - [High]Send customer invite to existing business to unique or existing email id and after completed the onboarding process and from customer admin check case detail so their it not displaying the 'worth score & Banking'.**

- 📝 fix: removing existing-case-id field ([#220](https://github.com/joinworth/integration-service/pull/220))

**[WIN-726](https://worth-ai.atlassian.net/browse/WIN-726) - Unable to move past company details**

- 📝 fix: middesk unique external id error fix ([#186](https://github.com/joinworth/integration-service/pull/186))

**[WIN-737](https://worth-ai.atlassian.net/browse/WIN-737) - No title available**

- 📝 | Handle Middesk Nullable items ([#203](https://github.com/joinworth/integration-service/pull/203))

### 💻 Tech Task

**[WIN-536](https://worth-ai.atlassian.net/browse/WIN-536) - Encrypt any SSN/TIN stored in our database**

- 📝 fix: masking of tin ([#208](https://github.com/joinworth/integration-service/pull/208))

### 🛑 Defect

**[WIN-724](https://worth-ai.atlassian.net/browse/WIN-724) - [High]Onbaording flow-Send customer invite and complete the onboarding flow so for this two case were generated so in admin for one case showing worth score and for other case it is pending**

- 📝 fix: standalone case score generation ([#188](https://github.com/joinworth/integration-service/pull/188))

### 📝 Other

- 📝 Hotfix: added new keys for decryption ([#221](https://github.com/joinworth/integration-service/pull/221))
- 📝 Fix: adding more logger
- 📝 Fix: added loggers
- 📝 Feature: extract document details ([#190](https://github.com/joinworth/integration-service/pull/190))
- 📝 Feat: Execute integrations tasks on submit ([#193](https://github.com/joinworth/integration-service/pull/193))
- 📝 Feat: Pr coverage report workflow ([#209](https://github.com/joinworth/integration-service/pull/209))
- 📝 Fix: removed parse-xl ([#187](https://github.com/joinworth/integration-service/pull/187))
- 📝 Fix: fetch google reviews in sorted order ([#192](https://github.com/joinworth/integration-service/pull/192))
- 📝 Fix: Avergae transactions charts ([#196](https://github.com/joinworth/integration-service/pull/196))
- 📝 Fix: added code to fix prod issue on middesk api ([#195](https://github.com/joinworth/integration-service/pull/195))
- 📝 Fix: added owner details in internal api ([#210](https://github.com/joinworth/integration-service/pull/210))
- 📝 Fix: query added platform id check ([#218](https://github.com/joinworth/integration-service/pull/218))
- 📝 Build(deps): bump nodemailer from 6.9.6 to 6.9.9 ([#197](https://github.com/joinworth/integration-service/pull/197))
- 📝 Build(deps): bump follow-redirects from 1.15.3 to 1.15.6 ([#198](https://github.com/joinworth/integration-service/pull/198))
- 📝 Build(deps): bump tough-cookie and intuit-oauth ([#199](https://github.com/joinworth/integration-service/pull/199))
- 📝 Build(deps-dev): bump ip from 2.0.0 to 2.0.1 ([#200](https://github.com/joinworth/integration-service/pull/200))
- 📝 Build(deps-dev): bump tar from 6.2.0 to 6.2.1 ([#204](https://github.com/joinworth/integration-service/pull/204))
- 📝 Build(deps): bump axios from 1.6.2 to 1.6.3 ([#202](https://github.com/joinworth/integration-service/pull/202))
- 📝 Build(deps): bump express from 4.18.2 to 4.19.2 ([#205](https://github.com/joinworth/integration-service/pull/205))
- 📝 Plaid & Equifax: better handle failure ([#211](https://github.com/joinworth/integration-service/pull/211))

**[WIN-659](https://worth-ai.atlassian.net/browse/WIN-659) - No title available**

- 📝 Associate `fetch_public_records` with Equifax ([#212](https://github.com/joinworth/integration-service/pull/212))

## [v0.0.28](https://github.com//joinworth/integration-service/compare/v0.0.27...v0.0.28) - 2024-04-26

### 🐛 Bug

**[WIN-737](https://worth-ai.atlassian.net/browse/WIN-737) - No title available**

- 📝 | Handle Middesk Nullable items ([#203](https://github.com/joinworth/integration-service/pull/203))

## [v0.0.27](https://github.com//joinworth/integration-service/compare/v0.0.22...v0.0.27) - 2024-04-23

### 📖 Story

**[WIN-569](https://worth-ai.atlassian.net/browse/WIN-569) - Define Actions for "Under Manual Review" Cases (Invited Cases Only)**

- 📝 temp feat: Logic to send case id that needs to be marked for manual review ([#176](https://github.com/joinworth/integration-service/pull/176))

**[WIN-687](https://worth-ai.atlassian.net/browse/WIN-687) - SMB Reputation tab – Retrieve Initial Reviews During Onboarding using Google Places API**

- 📝 Fetch reviews from Google Places API ([#175](https://github.com/joinworth/integration-service/pull/175))

### 🐛 Bug

**[WIN-654](https://worth-ai.atlassian.net/browse/WIN-654) - Score Refresh Data should be visible in DB**

- 📝 | add + populate junction tables for tracking record->task relationships ([#169](https://github.com/joinworth/integration-service/pull/169))

**[WIN-726](https://worth-ai.atlassian.net/browse/WIN-726) - Unable to move past company details**

- 📝 fix: middesk unique external id error fix ([#186](https://github.com/joinworth/integration-service/pull/186))

### 🛑 Defect

**[WIN-709](https://worth-ai.atlassian.net/browse/WIN-709) - No title available**

- 📝 fix: tax-status state conversion into 2 chars ([#178](https://github.com/joinworth/integration-service/pull/178))

**[WIN-724](https://worth-ai.atlassian.net/browse/WIN-724) - [High]Onbaording flow-Send customer invite and complete the onboarding flow so for this two case were generated so in admin for one case showing worth score and for other case it is pending**

- 📝 fix: standalone case score generation ([#188](https://github.com/joinworth/integration-service/pull/188))

### 📝 Other

- 📝 Hotfix: missing comma in migration script ([#182](https://github.com/joinworth/integration-service/pull/182)) ([#184](https://github.com/joinworth/integration-service/pull/184))
- 📝 Fix: Repeatable jobs processing time with cron config ([#181](https://github.com/joinworth/integration-service/pull/181))
- 📝 Bulk upload fix ([#183](https://github.com/joinworth/integration-service/pull/183))
- 📝 Fix: removing duplicate core_task_id with set ([#174](https://github.com/joinworth/integration-service/pull/174))
- 📝 Win-530 feat: connected integrations listing ([#172](https://github.com/joinworth/integration-service/pull/172))

## [v0.0.22](https://github.com//joinworth/integration-service/compare/v0.0.15...v0.0.22) - 2024-04-17

### 📖 Story

**[WIN-400](https://worth-ai.atlassian.net/browse/WIN-400) - Score refresh implementation**

- 📝 score refresh ([#88](https://github.com/joinworth/integration-service/pull/88))

**[WIN-425](https://worth-ai.atlassian.net/browse/WIN-425) - [BE] Verdata - Seller Submission**

- 📝 & Verdata seller submission ([#127](https://github.com/joinworth/integration-service/pull/127))

**[WIN-494](https://worth-ai.atlassian.net/browse/WIN-494) - Plaid Assets Aggregation**

- 📝 Plaid act as accounting ([#123](https://github.com/joinworth/integration-service/pull/123))

**[WIN-515](https://worth-ai.atlassian.net/browse/WIN-515) - Equifax Testing**

- 📝 update equifax for UAT ([#129](https://github.com/joinworth/integration-service/pull/129))
- 📝 fix issues handling equifax failures ([#135](https://github.com/joinworth/integration-service/pull/135))

**[WIN-524](https://worth-ai.atlassian.net/browse/WIN-524) - [FE + BE] [SMB] Transactions tab**

- 📝 feat: plaid transactions for smb ([#167](https://github.com/joinworth/integration-service/pull/167))

**[WIN-525](https://worth-ai.atlassian.net/browse/WIN-525) - [FE+ BE] [SMB] Account Balances tab**

- 📝 feat: SMB Account Balances ([#168](https://github.com/joinworth/integration-service/pull/168))
- 📝 fix: syntactical fix ([#171](https://github.com/joinworth/integration-service/pull/171))

**[WIN-624](https://worth-ai.atlassian.net/browse/WIN-624) - Pull in Rutter's data during Score refresh cycle**

- 📝 feat: score refresh for rutter ([#150](https://github.com/joinworth/integration-service/pull/150))

**[WIN-625](https://worth-ai.atlassian.net/browse/WIN-625) - Pull In Tax Status's data during Score refresh cycle**

- 📝 feat: tax-status score refresh ([#160](https://github.com/joinworth/integration-service/pull/160))

**[WIN-626](https://worth-ai.atlassian.net/browse/WIN-626) - Add Email handlers when Integration data fetching fails during score refresh**

- 📝 fix: email trigger when integration data fetch fails for score refresh ([#133](https://github.com/joinworth/integration-service/pull/133))

**[WIN-628](https://worth-ai.atlassian.net/browse/WIN-628) - Route for manual integration of data/scoring**

- 📝 INTEGRATION_DATA_UPLOADED event: Save data received to s3 ([#165](https://github.com/joinworth/integration-service/pull/165))

### 🐛 Bug

**[WIN-535](https://worth-ai.atlassian.net/browse/WIN-535) - Verdata not returning expected results**

- 📝 Decimal points in review percentage ([#119](https://github.com/joinworth/integration-service/pull/119))
- 📝 Fix verdata ([#117](https://github.com/joinworth/integration-service/pull/117))

**[WIN-539](https://worth-ai.atlassian.net/browse/WIN-539) - "verdata" referenced in public api response**

- 📝 Remove "verdata" reference in API response ([#114](https://github.com/joinworth/integration-service/pull/114))

### ✨ Enhancement

**[WIN-458](https://worth-ai.atlassian.net/browse/WIN-458) - [FE + BE] Modify progression api to be more robust with the onboarding flow**

- 📝 progression api changes ([#158](https://github.com/joinworth/integration-service/pull/158))

### 💻 Tech Task

**[WIN-635](https://worth-ai.atlassian.net/browse/WIN-635) - Create new job in dev actions for PR merge**

- 📝 chore add new merge job ([#134](https://github.com/joinworth/integration-service/pull/134))
- 📝 chore add new merge job ([#138](https://github.com/joinworth/integration-service/pull/138))
- 📝 -chore-remove-merge-job ([#139](https://github.com/joinworth/integration-service/pull/139))
- 📝 -chore-update-pr-merge-step ([#141](https://github.com/joinworth/integration-service/pull/141))
- 📝 -chore-update-pr-merge ([#142](https://github.com/joinworth/integration-service/pull/142))
- 📝 -update-pr-merge ([#144](https://github.com/joinworth/integration-service/pull/144))
- 📝 Update-pr-merge ([#146](https://github.com/joinworth/integration-service/pull/146))
- 📝 -Update-pr-merge ([#147](https://github.com/joinworth/integration-service/pull/147))
- 📝 -Update-pr-merge ([#148](https://github.com/joinworth/integration-service/pull/148))
- 📝 -update-pr-changes ([#149](https://github.com/joinworth/integration-service/pull/149))
- 📝 update-pr-merge ([#153](https://github.com/joinworth/integration-service/pull/153))
- 📝 -chore-update-pr-merge ([#154](https://github.com/joinworth/integration-service/pull/154))
- 📝 -chore-update-pr-merge ([#155](https://github.com/joinworth/integration-service/pull/155))
- 📝 chore-revert-old-changes ([#162](https://github.com/joinworth/integration-service/pull/162))

### 🛑 Defect

**[WIN-709](https://worth-ai.atlassian.net/browse/WIN-709) - No title available**

- 📝 fix: tax-status state conversion into 2 chars ([#178](https://github.com/joinworth/integration-service/pull/178)) ([#179](https://github.com/joinworth/integration-service/pull/179))

### 📝 Other

- 📝 Add pgvector extension and vector FAQ table ([#170](https://github.com/joinworth/integration-service/pull/170))
- 📝 Feat: Adding FAQChatbot route ([#128](https://github.com/joinworth/integration-service/pull/128))
- 📝 Feat: added logic for tax status tab for 5 years data store and fetch ([#152](https://github.com/joinworth/integration-service/pull/152))
- 📝 Fix: sending case_id in body for tax-status init ([#126](https://github.com/joinworth/integration-service/pull/126))
- 📝 Fix task class ([#156](https://github.com/joinworth/integration-service/pull/156))
- 📝 Fix: tax-status typo used connection status not task-status ([#151](https://github.com/joinworth/integration-service/pull/151))
- 📝 Win 568: Transition to pending decision status after submission of a case ([#125](https://github.com/joinworth/integration-service/pull/125))
- 📝 Fix broken test knex.spec.ts ([#130](https://github.com/joinworth/integration-service/pull/130))
- 📝 TS-ify Role+Auth middlewares ([#132](https://github.com/joinworth/integration-service/pull/132))
- 📝 Fix migrate:down ([#136](https://github.com/joinworth/integration-service/pull/136))
- 📝 Win 635 chore update pr merge ([#143](https://github.com/joinworth/integration-service/pull/143))
- 📝 Win 552: FIX : Update tax tab ([#159](https://github.com/joinworth/integration-service/pull/159))
- 📝 Map cash flow data to expected fields ([#163](https://github.com/joinworth/integration-service/pull/163))
- 📝 Win 641 onboarding revamp changes ([#166](https://github.com/joinworth/integration-service/pull/166))
- 📝 Fix: internal-api route changes ([#124](https://github.com/joinworth/integration-service/pull/124))
- 📝 Feature: add middesk formation date ([#122](https://github.com/joinworth/integration-service/pull/122))
- 📝 Use existing task when possible ([#120](https://github.com/joinworth/integration-service/pull/120))
- 📝 Fix: accounting s3 bucket folder rename to rutter ([#112](https://github.com/joinworth/integration-service/pull/112))
- 📝 Fix: updating array of allowed categories ([#113](https://github.com/joinworth/integration-service/pull/113))
- 📝 Fix: added fix for handling kafka error function ([#115](https://github.com/joinworth/integration-service/pull/115))
- 📝 Fix: pulling hotfixes to main ([#116](https://github.com/joinworth/integration-service/pull/116))
- 📝 Fix: fixed Tax Data issue by adding form type as optional ([#118](https://github.com/joinworth/integration-service/pull/118))
- 📝 Map State name correctly, format zipcode to plaid standards ([#111](https://github.com/joinworth/integration-service/pull/111))

## [v0.0.15](https://github.com//joinworth/integration-service/compare/v0.0.11...v0.0.15) - 2024-03-05

### 📖 Story

**[WIN-269](https://worth-ai.atlassian.net/browse/WIN-269) - Replace Beta Score with V1 Model**

- 📝 FIX ([#105](https://github.com/joinworth/integration-service/pull/105))
- 📝 feat: upload raw data to s3 for AI score generation ([#98](https://github.com/joinworth/integration-service/pull/98))

**[WIN-274](https://worth-ai.atlassian.net/browse/WIN-274) - Plaid IDV Implementation**

- 📝 Plaid IDV [Part 1/X] : Add task to process Plaid IDV enrollment & response ([#80](https://github.com/joinworth/integration-service/pull/80))

**[WIN-344](https://worth-ai.atlassian.net/browse/WIN-344) - Equifax implementation**

- 📝 |- Add equifax [Equifax PR #2] ([#61](https://github.com/joinworth/integration-service/pull/61))

### 🐛 Bug

**[WIN-428](https://worth-ai.atlassian.net/browse/WIN-428) - [High] Re-test TaxStatus with collectTaxRecords = true**

- 📝 TAX-STATUS-INPUT-PAYLOAD-UPDATE ([#94](https://github.com/joinworth/integration-service/pull/94))

### 📝 Other

- 📝 Fix: logging tax-status data and webhook data
- 📝 Fix: standalone case generation while submitting invitation case ([#109](https://github.com/joinworth/integration-service/pull/109))
- 📝 Fix: getPublicRecordsTaskIDQuery on the basis of businessID & caseID ([#110](https://github.com/joinworth/integration-service/pull/110))
- 📝 Update rutter.ts ([#108](https://github.com/joinworth/integration-service/pull/108))
- 📝 Rutter execute on connection success ([#107](https://github.com/joinworth/integration-service/pull/107))
- 📝 Feature: middesk integration ([#52](https://github.com/joinworth/integration-service/pull/52))
- 📝 Feat: Omit verdata no third party data ([#93](https://github.com/joinworth/integration-service/pull/93))
- 📝 Fix: Update routes ([#82](https://github.com/joinworth/integration-service/pull/82))
- 📝 Move equifax to id 17 ([#79](https://github.com/joinworth/integration-service/pull/79))
- 📝 Fix equifax & jest build issue ([#81](https://github.com/joinworth/integration-service/pull/81))
- 📝 Map zod to generic errorMiddleware ([#85](https://github.com/joinworth/integration-service/pull/85))
- 📝 Alias "Rutter" routes to more generic "Accounting" ([#87](https://github.com/joinworth/integration-service/pull/87))
- 📝 Convert api helper file to ts ([#86](https://github.com/joinworth/integration-service/pull/86))
- 📝 Enhanced filtering & aggregation for Accounting Reports, Accounting Objects, & Business Tasks ([#78](https://github.com/joinworth/integration-service/pull/78))
- 📝 FIX: multiple score_triggere_id in Plaid exchange token & refresh API. ([#99](https://github.com/joinworth/integration-service/pull/99))
- 📝 WIN 424 Map NAICS industry friendly name ([#96](https://github.com/joinworth/integration-service/pull/96))
- 📝 Plaid IDV Part 2: Send message on idv completion ([#91](https://github.com/joinworth/integration-service/pull/91))
- 📝 Win 424 tax status fix ([#104](https://github.com/joinworth/integration-service/pull/104))
- 📝 Attempt to process pending tasks on connection creation ([#89](https://github.com/joinworth/integration-service/pull/89))
- 📝 Hotfix pull to main ([#106](https://github.com/joinworth/integration-service/pull/106))
- 📝 Revert spread operator on authorization ([#84](https://github.com/joinworth/integration-service/pull/84))

## [v0.0.11](https://github.com//joinworth/integration-service/compare/v0.0.10...v0.0.11) - 2024-02-29

### 📝 Other

- 📝 Hotfix/cherrypick-enhanced-filtering-accouting ([#103](https://github.com/joinworth/integration-service/pull/103))

## [v0.0.10](https://github.com//joinworth/integration-service/compare/v0.0.4...v0.0.10) - 2024-02-28

### 📖 Story

**[WIN-162](https://worth-ai.atlassian.net/browse/WIN-162) - [FE][BE] TaxStatus Implementation**

- 📝 tax status implementation ([#59](https://github.com/joinworth/integration-service/pull/59))

**[WIN-325](https://worth-ai.atlassian.net/browse/WIN-325) - [BE] Rutter Implementation**

- 📝 add accounting migrations & types [ PR #1] ([#47](https://github.com/joinworth/integration-service/pull/47))
- 📝 | fix: handle the fact that connection records will already exist when … ([#70](https://github.com/joinworth/integration-service/pull/70))

**[WIN-327](https://worth-ai.atlassian.net/browse/WIN-327) - SOC2 Security Items**

- 📝 chore: add-slack release notification workflow-file ([#63](https://github.com/joinworth/integration-service/pull/63))

**[WIN-344](https://worth-ai.atlassian.net/browse/WIN-344) - Equifax implementation**

- 📝 |Add base class & scaffolding elements for Bureau Reporting [Equifax PR #1] ([#58](https://github.com/joinworth/integration-service/pull/58))

### 🐛 Bug

**[WIN-428](https://worth-ai.atlassian.net/browse/WIN-428) - [High] Re-test TaxStatus with collectTaxRecords = true**

- 📝 TAX-STATUS-INPUT-PAYLOAD-UPDATE ([#94](https://github.com/joinworth/integration-service/pull/94))

### ✨ Enhancement

**[WIN-420](https://worth-ai.atlassian.net/browse/WIN-420) - 404 on Verdata should allow the score calculation to continue**

- 📝 | Handle empty response from Verdata ([#73](https://github.com/joinworth/integration-service/pull/73))
- 📝 fix verdata error handling v2 ([#75](https://github.com/joinworth/integration-service/pull/75))

### 💻 Tech Task

**[WIN-422](https://worth-ai.atlassian.net/browse/WIN-422) - Resolve dependabot alert for crypto js**

- 📝 chore(deps): bump crypto-js from 4.1.1 to 4.2.0 ([#71](https://github.com/joinworth/integration-service/pull/71))

### 📝 Other

- 📝 Fix: onSuccess typo
- 📝 Fix: business mobile number
- 📝 Fix: stringfy logger data
- 📝 Fix: add tax status logging ([#97](https://github.com/joinworth/integration-service/pull/97))
- 📝 Feat: Omit verdata no third party data ([#93](https://github.com/joinworth/integration-service/pull/93))
- 📝 Fix: integration-data-ready event check ([#53](https://github.com/joinworth/integration-service/pull/53))
- 📝 Fix: Plaid production hotfixes ([#65](https://github.com/joinworth/integration-service/pull/65))
- 📝 Rutter -- add a Task Manager class [PR #2] ([#54](https://github.com/joinworth/integration-service/pull/54))
- 📝 Rutter: Base Accounting Modules [PR #3] ([#55](https://github.com/joinworth/integration-service/pull/55))
- 📝 Rutter: actual implementation [PR #4] ([#56](https://github.com/joinworth/integration-service/pull/56))
- 📝 Fix issues with rutter routes ([#64](https://github.com/joinworth/integration-service/pull/64))
- 📝 Throw if a business has an existing connection for a platform ([#67](https://github.com/joinworth/integration-service/pull/67))
- 📝 Add get all integrations route ([#68](https://github.com/joinworth/integration-service/pull/68))
- 📝 Fix issues with Rutter integration ([#77](https://github.com/joinworth/integration-service/pull/77))
- 📝 Chore: add PR template Description ([#66](https://github.com/joinworth/integration-service/pull/66))

## [v0.0.4](https://github.com//joinworth/integration-service/compare/v0.0.3...v0.0.4) - 2024-02-03

### 📝 Other

- 📝 Fix: [migrations] remove column length restrictions

## [v0.0.3](https://github.com//joinworth/integration-service/compare/v0.0.2...v0.0.3) - 2024-02-02

### 📝 Other

- 📝 Fix: remove transactions product from plaid

## [v0.0.2](https://github.com//joinworth/integration-service/compare/v0.0.1...v0.0.2) - 2024-02-02

### 📝 Other

- 📝 Fix: remove auth from plaid products
