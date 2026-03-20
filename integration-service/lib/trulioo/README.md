# Trulioo Integration

Complete Trulioo integration for **Business Entity Verification (KYB)** and **Person Screening (PSC)** for UK and Canada customers, providing an alternative to the US-only Middesk solution.

## 🚀 How It Works (Business Perspective)

### **The Middesk Pattern**

The **Middesk pattern** is how our existing US business verification works - and we're following the same approach for Trulioo! Here's the magic:

- **One API call** → Business verification + Person screening happens automatically
- **No separate endpoints** → Everything happens in a single flow
- **Automatic UBO extraction** → We find directors/UBOs from business data
- **Automatic person screening** → We screen them against watchlists (PEP, SANCTIONS, etc.)
- **Same user experience** → Whether you use Middesk (US) or Trulioo (UK/Canada), it works the same way

**Why this matters:** Users get a consistent experience across all countries, and developers only need to call one endpoint! 🚀

## 🎯 What This Integration Does

### **Business Verification (KYB - Know Your Business)**

- Verifies business entities using Trulioo's KYB flow
- **Automatically extracts and screens UBOs/Directors** during business verification (following Middesk pattern)
- Single API call handles both business and person verification
- Stores verification results in Case Management system
- Prevents duplicate business verifications

### **Person Screening (PSC - Person of Significant Control)**

- Screens individuals against watchlists (PEP, SANCTIONS, ADVERSE_MEDIA)
- **Automatically triggered during business verification** (no separate endpoint needed)
- Stores screening results in Case Management "People" tab
- Follows the same pattern as Middesk for consistency

### **Country-Based Routing**

- **UK/Canada businesses** → Trulioo (this integration)
- **US businesses** → Middesk (existing solution)
- **Other countries** → Default handling

## 📡 API Usage

### **Business Verification Endpoint**

- `POST /verification/businesses/:businessID/kyb-verification` - Trigger KYB verification with automatic UBO/Director screening

**Parameters:**

- `businessID` (path parameter) - UUID string of the business to verify

**Example:**

```http
POST /verification/businesses/326694f3-c231-44d4-9fd6-8050c7bc66be/kyb-verification
```

**Complete Flow:**

1. API Request → Verification Controller receives KYB request
2. Business Verification → KYB flow processes business data
3. UBO Extraction → Automatically extracts UBOs/Directors from business response
4. Person Screening → Automatically screens extracted persons using PSC flow
5. Results Storage → Both business and person data stored in database
6. Case Management Display → Frontend fetches data via API and displays in People tab

**Key Points:**

- **Single Call Pattern:** Business verification automatically handles UBO/Director screening (like Middesk)
- All endpoints are trigger-only for asynchronous processing
- Results will be delivered via webhook in future implementation
- No separate person screening endpoint needed - handled automatically during business verification

## 🏗️ Technical Architecture

### **System Architecture**

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           TRULIOO INTEGRATION ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API LAYER     │───▶│ COMMON LAYER    │───▶│ BUSINESS FLOW   │
│                 │    │                 │    │                 │
│ • Controller    │    │ • TruliooBase   │    │ • KYB Processor │
│ • Routes        │    │ • HTTP Client   │    │ • Results       │
│ • Schema        │    │ • Token Manager │    │   Storage       │
│ • Error Handler │    │ • Error Handler │    │ • UBO Extractor │
└─────────────────┘    │ • Retry Logic   │    │   (Auto Screen) │
                       └─────────────────┘    │ • Task Handler  │
                                │             └─────────────────┘
                                │                      │
                                ▼                      │
                       ┌─────────────────┐             │
                       │  PERSON FLOW    │             │
                       │ (Auto-triggered)│             │
                       │                 │             │
                       │ • Inquiry       │             │
                       │   Manager       │             │
                       │ • Verification  │             │
                       │   Processor     │             │
                       │ • Screening     │             │
                       │   Processor     │             │
                       │ • Data Storage  │             │
                       │ • Task Handler  │             │
                       └─────────────────┘             │
                                │                      │
                    ┌───────────┴──────────────────────┴───────────┐
                    ▼                                              ▼
        ┌─────────────────┐                            ┌─────────────────┐
        │ EXTERNAL APIS   │                            │ CASE MANAGEMENT │
        │                 │                            │   (FRONTEND)    │
        │ • Trulioo API   │                            │                 │
        │   (UK/Canada)   │                            │ • People Tab    │
        │ • OAuth Auth    │                            │ • Results       │
        │ • KYB/PSC Flows │                            │   Display       │
        └─────────────────┘                            │ • Status        │
                    │                                  │   Tracking      │
                    ▼                                  │ • Business      │
        ┌─────────────────┐                            │   Details       │
        │ DATABASE LAYER  │                            └─────────────────┘
        │                 │                                      ▲
        │ • Business      │                                      │
        │   Entity Verif  │                                      │
        │ • Business      │                                      │
        │   Entity People │                                      │
        │ • Request/      │                                      │
        │   Response Log  │                                      │
        │ • Data          │                                      │
        │   Integrations  │                                      │
        └─────────────────┘                                      │
                    ▲                                            │
                    │                                            │
                    └────────────────────────────────────────────┘
```

### **Key Features**

✅ Business Entity Verification (KYB) for UK/Canada
✅ Person Screening (PSC) with Watchlist Checks  
✅ UBO/Director Extraction & Screening
✅ Error Handling & Retry Logic
✅ Database Integration with Case Management
✅ Backward Compatibility with Middesk
✅ Comprehensive Testing (167 tests, 100% pass rate)

### **Component Flow**

```text
API Layer → Common Layer → Business Flow → Person Flow → Database Layer → Case Management
    │           │              │             │              │                │
    │           │              │             │              │                │
    ▼           ▼              ▼             ▼              ▼                ▼
Controller  TruliooBase   KYB Processor  Inquiry Mgr   Business Entity   People Tab
Routes      HTTP Client   Results Store  Verification   People Table     Results
Schema      Token Mgr     UBO Extractor  Screening      Request/Response  Status
Error Hdlr  Error Hdlr    Task Handler   Data Storage   Data Integrations Tracking
            Retry Logic   (Auto Screen)  Task Handler
```

## 📁 Directory Structure

```text
trulioo/
├── common/                 # Common utilities and base classes
│   ├── truliooBase.ts      # Base class with shared functionality
│   ├── truliooHttpClient.ts        # HTTP client with timeout handling
│   ├── truliooTokenManager.ts      # OAuth token management
│   ├── truliooErrorHandler.ts      # Error handling and recovery
│   ├── truliooRetryManager.ts      # Retry logic with exponential backoff
│   ├── types.ts            # Common type definitions
│   └── __tests__/          # Common utilities tests (6 test files)
├── business/               # Business verification modules
│   ├── truliooBusiness.ts  # Business verification implementation
│   ├── truliooBusinessKYBProcessor.ts      # KYB flow processing
│   ├── truliooBusinessTaskHandler.ts       # Task management
│   ├── truliooBusinessResultsStorage.ts    # Results storage
│   ├── truliooUBOExtractor.ts             # UBO/Director extraction
│   ├── types.ts            # Business module interfaces
│   └── __tests__/          # Business module tests (4 test files)
├── person/                 # Person verification modules
│   ├── truliooPerson.ts    # Person verification implementation
│   ├── truliooPersonInquiryManager.ts      # Inquiry management
│   ├── truliooPersonVerificationProcessor.ts  # Verification processing
│   ├── truliooPersonScreeningProcessor.ts     # Screening results processing
│   ├── truliooPersonDataStorage.ts            # Person data storage
│   ├── truliooPersonTaskHandler.ts            # Person task management
│   ├── types.ts            # Person module interfaces
│   └── __tests__/          # Person module tests (4 test files)
├── utils/                  # Utility functions and factory
│   └── truliooFactory.ts   # Factory for creating business/person instances
├── index.ts                # Main entry point
└── README.md               # This documentation file
```

## 🧪 Testing

### **Test Coverage:**

- Comprehensive coverage of all components
- Mock-based testing for external dependencies
- Error scenario testing

### **Running Tests:**

```bash
# Run all Trulioo tests
npm test -- --testPathPatterns=trulioo

# Run specific module tests
npm test -- --testPathPatterns=trulioo/business
npm test -- --testPathPatterns=trulioo/person
npm test -- --testPathPatterns=trulioo/common
```

## 🔧 Configuration

### **Environment Variables:**

```bash
# Trulioo API Configuration
TRULIOO_API_URL=https://api.globaldatacompany.com
TRULIOO_CLIENT_ID=your_client_id
TRULIOO_CLIENT_SECRET=your_client_secret

# Flow Configuration
TRULIOO_KYB_FLOWID=kyb-flow
TRULIOO_PSC_FLOWID=psc-screening-flow

# Timeout Configuration
TRULIOO_HTTP_TIMEOUT=30000
```

## 🚨 Error Handling

### **Error Types:**

- **Network Errors:** Connection timeouts, DNS failures
- **Authentication Errors:** Invalid credentials, expired tokens
- **API Errors:** Trulioo API errors, rate limiting
- **Data Errors:** Invalid input data, missing required fields

### **Error Recovery:**

- **Error Handling:** Comprehensive error categorization and recovery
- **Retry Logic:** Exponential backoff for transient errors
- **Fallback Responses:** Graceful degradation when Trulioo unavailable
- **Controlled Failures:** Proper error propagation without system crashes

## 📈 Monitoring & Logging

### **Key Metrics:**

- API response times and success rates
- Token refresh frequency and failures
- Database operation success rates

### **Logging:**

- **Info:** Normal operation flow
- **Warn:** Recoverable issues and warnings
- **Error:** Failures and error conditions
- **Debug:** Detailed operation information

## 🔄 Integration Points

### **System Integration:**

- **API Endpoints:** Integrated into `/api/v1/verification/` module
- **Case Management:** Results displayed in "People" tab with status tracking and watchlist hits
- **Database:** Uses existing `integration_data` tables with Trulioo-specific data
- **Middesk Compatibility:** Maintains existing US business flow patterns
- **Task Management:** Integrates with existing task handler system
- **Error Handling:** Follows existing error handling patterns

## 🛡️ Security

- **OAuth 2.0** authentication with Trulioo
- **Token management** with expiration and refresh handling
- **Data encryption** in database with secure storage
- **Audit trails** via request/response logging
- **PII compliance** and secure HTTP communication (HTTPS)

## 🚀 Developer Guide

### **Quick Start:**

1. **Understand the Flow:** `Business Verification (KYB) → UBO Extraction → Person Screening (PSC)`
2. **Key Files:** Start with `common/truliooBase.ts`, then `utils/truliooFactory.ts`
3. **Testing:** Run `npm test -- --testPathPatterns=trulioo`
4. **Database:** Review existing Middesk integration for compatibility

### **Common Patterns:**

- **Factory Pattern:** Use `TruliooFactory` to create instances
- **Error Handling:** Always use controlled errors with proper logging
- **Database Operations:** Use conflict resolution for duplicate prevention
- **Testing:** Mock external dependencies, test error scenarios

## 📚 Additional Resources

- **Trulioo API Documentation:** [Trulioo Developer Portal](https://developer.trulioo.com/)
- **Error Handling Patterns:** [Error Handling Best Practices](https://martinfowler.com/articles/replaceThrowWithNotification.html)
- **Database Schema:** See `integration_data` schema documentation
- **Existing Middesk Integration:** Reference for compatibility patterns

---

**This integration provides a robust, scalable solution for both Business Entity Verification (KYB) and Person Screening (PSC) with comprehensive error handling, monitoring, and testing coverage.** 🚀✨
