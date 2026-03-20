### Verdata security webhook testing 

> Note: For this integration to work, please be sure that CONFIG_VERDATA_CALLBACK_SECRET and CONFIG_VERDATA_SIGNATURE_MAX_AGE_SECONDS are set up in doppler.

#### Test 1: ✅ Valid Request (200 OK)

**Step 1:** Find a real task_id from your database:
```bash
cd backend/integration-service
```

Grab the file "find-verdata-task.js" from the attached files in the ticket: https://worth-ai.atlassian.net/browse/PAT-1000. Stand on the directory you've this script and run:

```bash
node ./find-verdata-task.js
```

**Step 2:** Generate a valid signature with real IDs:
```bash
node -e "
const crypto = require('crypto');
const secret = 'your-secret';
const businessId = 'YOUR_REAL_BUSINESS_ID';
const taskId = 'YOUR_REAL_TASK_ID';
const ts = Math.floor(Date.now() / 1000);
const sig = crypto.createHmac('sha256', secret).update(businessId + ':' + taskId + ':' + ts).digest('hex');
console.log('URL: {{integration_url_v1}}/verdata/webhook?business_id=' + businessId + '&task_id=' + taskId + '&ts=' + ts + '&sig=' + sig);
"
```

**Step 3:** Copy the generated URL into Postman.

**Body:**
```json
{
  "seller_id": "test-seller-123",
  "request_id": "test-request-456"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "data": null,
  "message": "Successfully handle Verdata Webhook"
}
```
**Expected Status:** `200 OK`

---

#### Test 2: ❌ Missing Signature (401 MISSING_SIGNATURE)

**Method:** POST  
**URL:**
```
{{integration_url_v1}}/verdata/webhook?business_id=1e3a2bdd-f569-430e-85c0-0f065c41ae8a&task_id=b7124d87-bfec-46c1-92b3-0d40a4a8636c
```

**Body:**
```json
{"seller_id": "test-123"}
```

**Expected Response:**
```json
{
  "status": "error",
  "error": "MISSING_SIGNATURE",
  "message": "Webhook signature verification failed"
}
```
**Expected Status:** `401 Unauthorized`

---

#### Test 3: ❌ Missing Timestamp (401 MISSING_SIGNATURE)

**Method:** POST  
**URL:**
```
{{integration_url_v1}}/verdata/webhook?business_id=1e3a2bdd-f569-430e-85c0-0f065c41ae8a&task_id=b7124d87-bfec-46c1-92b3-0d40a4a8636c&sig=somesignature
```

**Body:**
```json
{"seller_id": "test-123"}
```

**Expected Response:**
```json
{
  "status": "error",
  "error": "MISSING_SIGNATURE",
  "message": "Webhook signature verification failed"
}
```
**Expected Status:** `401 Unauthorized`

---

#### Test 4: ❌ Invalid Signature (403 SIGNATURE_MISMATCH)

**Step 1:** Get current timestamp by running in terminal:
```bash
date +%s
```

**Step 2:** Use the timestamp in URL (replace `CURRENT_TS` with the value from step 1):

**Method:** POST  
**URL:**
```
{{integration_url_v1}}/verdata/webhook?business_id=1e3a2bdd-f569-430e-85c0-0f065c41ae8a&task_id=b7124d87-bfec-46c1-92b3-0d40a4a8636c&ts=CURRENT_TS&sig=0000000000000000000000000000000000000000000000000000000000000000
```

**Body:**
```json
{"seller_id": "test-123"}
```

**Expected Response:**
```json
{
  "status": "error",
  "error": "SIGNATURE_MISMATCH",
  "message": "Webhook signature verification failed"
}
```
**Expected Status:** `403 Forbidden`

---

#### Test 5: ❌ Expired Signature (403 SIGNATURE_EXPIRED)

**Step 1:** Generate an expired signature by running:
```bash
cd backend/integration-service
node -e "
const crypto = require('crypto');
const secret = 'local-dev-secret-a3f8c2d1e4b5a6c7d8e9f0a1b2c3d4e5';
const businessId = '1e3a2bdd-f569-430e-85c0-0f065c41ae8a';
const taskId = 'b7124d87-bfec-46c1-92b3-0d40a4a8636c';
const ts = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
const sig = crypto.createHmac('sha256', secret).update(businessId + ':' + taskId + ':' + ts).digest('hex');
console.log('URL: {{integration_url_v1}}/verdata/webhook?business_id=' + businessId + '&task_id=' + taskId + '&ts=' + ts + '&sig=' + sig);
"
```

**Step 2:** Copy the generated URL into Postman.

**Body:**
```json
{"seller_id": "test-123"}
```

**Expected Response:**
```json
{
  "status": "error",
  "error": "SIGNATURE_EXPIRED",
  "message": "Webhook signature verification failed"
}
```
**Expected Status:** `403 Forbidden`

---

#### Test 6: ❌ Missing Business ID (403 INVALID_SIGNATURE)

**Step 1:** Get current timestamp: `date +%s`

**Method:** POST  
**URL (replace `CURRENT_TS`):**
```
{{integration_url_v1}}/verdata/webhook?task_id=b7124d87-bfec-46c1-92b3-0d40a4a8636c&ts=CURRENT_TS&sig=somesignature
```

**Body:**
```json
{"seller_id": "test-123"}
```

**Expected Response:**
```json
{
  "status": "error",
  "error": "INVALID_SIGNATURE",
  "message": "Webhook signature verification failed"
}
```
**Expected Status:** `403 Forbidden`

---

#### Test 7: ❌ Invalid Task ID Format (400 INVALID_TASK_ID)

**Step 1:** Generate a valid signature for the invalid task_id:
```bash
cd backend/integration-service
node -e "
const crypto = require('crypto');
const secret = 'local-dev-secret-a3f8c2d1e4b5a6c7d8e9f0a1b2c3d4e5';
const businessId = '1e3a2bdd-f569-430e-85c0-0f065c41ae8a';
const taskId = 'not-a-valid-uuid';
const ts = Math.floor(Date.now() / 1000);
const sig = crypto.createHmac('sha256', secret).update(businessId + ':' + taskId + ':' + ts).digest('hex');
console.log('URL: {{integration_url_v1}}/verdata/webhook?business_id=' + businessId + '&task_id=' + taskId + '&ts=' + ts + '&sig=' + sig);
"
```

**Step 2:** Copy the generated URL into Postman.

**Body:**
```json
{"seller_id": "test-123"}
```

**Expected Response:**
```json
{
  "status": "error",
  "error": "INVALID_TASK_ID",
  "message": "Task validation failed"
}
```
**Expected Status:** `400 Bad Request`

---

#### Test 8: ❌ Non-existent Task ID (400 TASK_NOT_FOUND)

**Step 1:** Generate a valid signature for a non-existent UUID:
```bash
cd backend/integration-service
node -e "
const crypto = require('crypto');
const secret = 'local-dev-secret-a3f8c2d1e4b5a6c7d8e9f0a1b2c3d4e5';
const businessId = '1e3a2bdd-f569-430e-85c0-0f065c41ae8a';
const taskId = '00000000-0000-0000-0000-000000000000';
const ts = Math.floor(Date.now() / 1000);
const sig = crypto.createHmac('sha256', secret).update(businessId + ':' + taskId + ':' + ts).digest('hex');
console.log('URL: {{integration_url_v1}}/verdata/webhook?business_id=' + businessId + '&task_id=' + taskId + '&ts=' + ts + '&sig=' + sig);
"
```

**Step 2:** Copy the generated URL into Postman.

**Body:**
```json
{"seller_id": "test-123"}
```

**Expected Response:**
```json
{
  "status": "error",
  "error": "TASK_NOT_FOUND",
  "message": "Task validation failed"
}
```
**Expected Status:** `400 Bad Request`

---
