# RESOLUTION CHECKLIST - MANDATORY REFERENCE

**Document Type:** 🚨 **MANDATORY REFERENCE FOR ALL ERROR RESOLUTION**
**Version:** 1.3
**Date:** September 25, 2025 (v1.1: October 18, 2026 — code review compliance checks added; v1.2: October 19, 2026 — API contract checks; v1.3: October 30, 2026 — cache, actor, read budget, UTC, counterpart checks)
**Status:** ENFORCED - Must be consulted before any error resolution
**Companion:** `docs/guides/GUIDE_CodeReview_Compliance.md` — rules A1–A20 / F1–F6 / S1–S9 behind the ⚖️ checks below

---

## 🚨 **FUNDAMENTAL RESOLUTION RULE - ALWAYS APPLY FIRST**

### **THE BASIC RULE - MANDATORY FOR ALL ERROR RESOLUTION:**

**1. SIMPLEST FIRST RESOLUTION STRATEGY:**
- ✅ **1st Resolution Attempt**: ALWAYS use the simplest possible solution
- ✅ **Complexity Gate**: Only add complexity if issue is CLEARLY APPARENT in simple approach
- ✅ **Pattern Priority**: Use proven working patterns before inventing new approaches

**2. SYSTEMATIC DOMAIN CHECKING:**
Check each technical domain independently with specific rules:
- ✅ **Frontend Domain**: 8 specific checks required
- ✅ **API Domain**: 7 specific checks required
- ✅ **AppScript Domain**: 13 specific checks required
- ✅ **Google Sheet Schema Domain**: 7 specific checks required

**3. ENFORCEMENT**: All resolution steps must follow this fundamental principle

---

## 📋 **MANDATORY RESOLUTION CHECKLIST**

### **STEP 1: IMMEDIATE ASSESSMENT (Required Before Any Action)**

**Basic Rule Application:**
- [ ] **SIMPLEST APPROACH IDENTIFIED**: What is the most basic solution possible?
- [ ] **WORKING PATTERN FOUND**: Is there a similar issue that was resolved successfully?
- [ ] **DOMAIN ISOLATED**: Which specific domain(s) have the issue?

### **STEP 2: COMPREHENSIVE DOMAIN-SPECIFIC ANALYSIS**

#### **🎨 FRONTEND DOMAIN CHECK (8 Required Checks)**

**Component Architecture:**
- [ ] **Pattern Consistency**: Does component follow same structure as similar working components?
- [ ] **Import Dependencies**: Are all imports following 7-layer dependency hierarchy?
- [ ] **Hook Usage**: Are React hooks (useState, useEffect, useCallback) using same patterns as successful components?

**Data Flow & State:**
- [ ] **State Management**: Is component state structure consistent with working implementations?
- [ ] **Props Handling**: Are props being processed same way as similar successful components?
- [ ] **Event Handlers**: Are event handling patterns copied from working components?

**Error & Loading States:**
- [ ] **Error Boundaries**: Does component have same error handling as working components?
- [ ] **Loading States**: Are loading patterns consistent with successful implementations?

**Specific Frontend Tests:**
- Can component render in isolation?
- Do props match expected structure?
- Are error states handled gracefully?

**⚖️ Counterpart rules (F1–F6):**
- [ ] **Server owns the rule (F1)**: is the value (SLA status, escalation, permission) computed by the backend, or re-derived in the browser? A browser copy drifts and fires per open tab
- [ ] **Time display (F3)**: off by 8 hours? Look for `getTime() + 8 * 60 * 60 * 1000` (`toPhilippineTime`) - show with `Intl` and `timeZone: 'Asia/Manila'`
- [ ] **Real save (F4)**: "saved" but gone after reload? Look for `setTimeout` promises / `TODO: Replace with actual API call` (`npm run check:code-rules`)
- [ ] **Stale after write (F5)**: the write succeeded but the list shows old data - is the entity cache invalidated after the write?

#### **🔌 API DOMAIN CHECK (10 Required Checks)**

**Endpoint Structure:**
- [ ] **URL Pattern**: Does endpoint follow same URL structure as working endpoints?
- [ ] **HTTP Method**: Is HTTP method (GET/POST) consistent with similar successful endpoints?
- [ ] **Payload Structure**: Does request payload match format of working endpoints?

**Data Processing:**
- [ ] **Payload Handling**: Is `data.payload || { prop1: data.prop1 }` pattern used like successful endpoints?
- [ ] **Response Format**: Does response structure match working API responses?
- [ ] **Error Handling**: Are try-catch patterns identical to successful endpoints?

**Integration Testing:**
- [ ] **Direct API Test**: Can endpoint be called directly with simple payload?

**⚖️ Contract (A12 / A13):**
- [ ] **Route exists**: `npm run check:api-contract` - is the action routed in `doGet` (if it is in `readActions`) or `routePostAction` of the newest AppScript file? An empty list or "no data" can be an unrouted action (before v9.0 they answered without `status: 'error'`)
- [ ] **Handler defined**: the case calls a function that exists (the check flags `undefined-function`)
- [ ] **No `action` key**: the payload has no key named `action` - it would replace the route name in the flat POST body
- [ ] **Identity (A15 / F2 / F6)**: "Only admins can …" for an admin, or the wrong user in history? Check the proxy log line (uid), `AUTH_MODE`, and that the handler uses `actorId(...)`, not a payload `user_id`

**Specific API Tests:**
- Does endpoint respond to ping/health check?
- Can simple test payload be processed successfully?
- Are error responses formatted consistently?

#### **⚙️ APPSCRIPT DOMAIN CHECK (13 Required Checks)**

**Function Structure:**
- [ ] **Function Pattern**: Does function follow same structure as working AppScript functions?
- [ ] **Parameter Processing**: Are parameters handled same way as successful functions?
- [ ] **Business Logic Flow**: Is logic flow consistent with working operations?

**Data Operations:**
- [ ] **Sheet Access**: Are Google Sheets accessed same way as working functions?
- [ ] **Data Writing**: Is data written to sheets using same pattern as successful operations?
- [ ] **Data Reading**: Are sheet reads following same pattern as working functions?

**Error & Logging:**
- [ ] **Error Logging**: Are Logger.log patterns consistent with working functions?
- [ ] **Success Validation**: Is success/failure validation same as working operations?
- [ ] **Version Consistency**: Are version references (pingAPI, headers) synchronized?

**⚖️ Code Review Compliance (v1.1 — `docs/guides/GUIDE_CodeReview_Compliance.md`):**
- [ ] **Header-Driven Writes (A1/A2)**: Rows built with `rowFromRecord(headers, record)`; tabs created with `ensureTableSheet()`; no new positional arrays or hard-coded header lists
- [ ] **Write Lock (A5)**: Writes run under `withScriptLock()` (automatic for `doPost` writes); no direct `LockService` calls
- [ ] **Error Responses (A6/A7/A8)**: `{status:'error'}` results go through `createHandlerResponse()`; request keys match `src/api/googleSheet.js`; ids compared with `String()`
- [ ] **Non-Destructive (A4)**: Nothing reachable from `doPost`/`doGet` clears or deletes a tab; init/seed functions are idempotent
- [ ] **Stale read in one request (A14)**: a value written earlier in the same request reads back old? The write is missing `invalidateTable(...)`; run the offline suite with the stale-cache detector. Quick test: Script Property `CACHE_ENABLED=false` - if the bug disappears, it's an invalidation
- [ ] **Slow action (A16)**: reads inside a loop / per-item helper calls? `npm run check:code-rules` and the read-count assertions
- [ ] **Times 8 hours off / wrong day (A17)**: a `+8h` shift, `getDay()` in the script time zone, or a row written before `TS_UTC_SINCE`
- [ ] **Duplicate ids (A18)**: an id from `getLastRow()` or `max(id)+1`
- [ ] **Code change "does nothing" (A20)**: a second function with the same name later in the file wins

**Specific AppScript Tests:**
- Can function execute independently in Apps Script editor?
- Does function write test data to sheets successfully?
- Are all Logger.log statements appearing in execution log?
- Does the offline test pass? `node appscript_files/tools/CODE_REVIEW_FIXES_TEST_v8.3.js <latest APPSCRIPT file>`

#### **📊 GOOGLE SHEET SCHEMA DOMAIN CHECK (7 Required Checks)**

**Schema Structure:**
- [ ] **Column Count**: Does sheet have correct number of columns for data structure?
- [ ] **Column Names**: Do column headers match model definitions exactly?
- [ ] **Data Types**: Are column data types consistent with API expectations?

**Data Integrity:**
- [ ] **Schema Migration**: Have recent schema changes been applied correctly?
- [ ] **Sample Data**: Does existing data match expected column structure?
- [ ] **Foreign Keys**: Are relationship columns (IDs) consistent across related sheets?
- [ ] **⚖️ TABLE_SCHEMAS Match (A2/A3)**: Does `rebuildAllTables()` (dry run) report `OK` for the table? New columns that filters depend on have a `COLUMN_DEFAULTS` entry?

**Specific Schema Tests:**
- Can sample data be written directly to sheet?
- Do column headers match `TABLE_SCHEMAS` in the latest `appscript_files/APPSCRIPT_v*.txt`?
- Are all required columns present?

### **STEP 3: DOMAIN-SPECIFIC SIMPLE SOLUTIONS**

#### **Frontend Simple Solutions:**
- [ ] **Copy Working Component**: Found similar working component to copy pattern from
- [ ] **Use Established Hooks**: Using same hooks pattern as successful components
- [ ] **Match Prop Structure**: Props match structure of working similar components

#### **API Simple Solutions:**
- [ ] **Copy Working Endpoint**: Found similar working endpoint to copy pattern from
- [ ] **Use Standard Pattern**: Using `data.payload || { prop: data.prop }` pattern
- [ ] **Match Response Format**: Response structure matches working endpoints

#### **AppScript Simple Solutions:**
- [ ] **Copy Working Function**: Found similar working function to copy pattern from
- [ ] **Use Standard Flow**: Using same business logic flow as successful operations
- [ ] **Match Error Handling**: Error handling copied from working functions

#### **Schema Simple Solutions:**
- [ ] **Copy Working Schema**: Found similar working sheet structure to copy from
- [ ] **Use Standard Columns**: Column structure matches working sheet definitions
- [ ] **Match Data Types**: Data types consistent with working implementations

### **STEP 4: COMPLEXITY GATE (Only If Simple Domain-Specific Approach Failed)**

**Domain-Specific Complexity Justification:**
- [ ] **Frontend Complexity**: Simple component patterns clearly inadequate for this specific use case
- [ ] **API Complexity**: Standard payload pattern cannot handle this specific data structure
- [ ] **AppScript Complexity**: Standard business logic insufficient for this specific operation
- [ ] **Schema Complexity**: Standard column structure cannot support this specific data requirement

### **STEP 5: RESOLUTION VERIFICATION WITH DOMAIN VALIDATION**

**Domain-Specific Success Validation:**
- [ ] **Frontend Success**: Component renders and functions correctly in all states
- [ ] **API Success**: Endpoint processes requests and returns correct responses
- [ ] **AppScript Success**: Function executes successfully and logs confirm operations
- [ ] **Schema Success**: Data is written and read correctly from sheet structure

---

## 🎯 **DOMAIN-SPECIFIC WORKING PATTERNS (Reference Library)**

### **✅ Frontend Working Patterns:**
- **AdminCompanyManager.js**: Company CRUD with form validation
- **AdminRoleManager.js**: Role management with permission handling
- **UserContext.js**: Authentication state management
- **useAPI.js**: Data fetching hooks with error handling

### **✅ API Working Patterns:**
- **Company Creation**: `data.payload || { name: data.name, code: data.code }`
- **Role Management**: Simple payload with comprehensive fallbacks
- **User Operations**: Standard authentication pattern

### **✅ AppScript Working Patterns:**
- **createCompany()**: Standard business object creation
- **createRole()**: Standard entity creation with validation
- **doPost() → routePostAction()**: Request routing; writes locked via `withScriptLock()` (v8.3)
- **setCustomFieldValue()**: Header-driven upsert keyed by entity + category + field
- **createCustomFieldValue() / updateCustomFieldValue()**: `rowFromRecord(headers, record)` create/update (v8.3)
- **ensureTableSheet()**: Idempotent tab creation from `TABLE_SCHEMAS` (v8.3)
- **createHandlerResponse()**: Maps `{status:'error'}` handler results to `success:false` (v8.3)

### **✅ Schema Working Patterns:**
- **Source of truth**: `TABLE_SCHEMAS` in the latest `appscript_files/APPSCRIPT_v*.txt` (expected column counts: deploy guide §4)
- **companies**: 15 columns with code locking + audit fields
- **roles**: 5 columns (as written by createRole())
- **user_profiles**: 19 columns, keyed by Firebase `user_id`

---

## 🚨 **ENFORCEMENT WITH DOMAIN SPECIFICITY**

### **MANDATORY DOMAIN CHECKS:**
- **ALL 8 Frontend checks** must be completed for frontend issues
- **ALL 7 API checks** must be completed for API issues
- **ALL 13 AppScript checks** must be completed for AppScript issues
- **ALL 7 Schema checks** must be completed for schema issues
- **Script issues** (`scripts/`): follow rules S1–S9 in `docs/guides/GUIDE_CodeReview_Compliance.md`

### **CROSS-DOMAIN ISSUES:**
If issue spans multiple domains, ALL relevant domain checks must be completed independently

### **DOCUMENTATION REQUIREMENT:**
Must document which working pattern from each domain was used as reference

---

## ✅ **QUICK DOMAIN REFERENCE**

**Frontend Issues:** Check component patterns, state management, props, error handling
**API Issues:** Check endpoint structure, payload handling, response format, error patterns
**AppScript Issues:** Check function patterns, sheet operations, logging, business logic
**Schema Issues:** Check column structure, data types, relationships, migration status

**Remember:** Each domain has specific successful patterns to copy from. Always start with the simplest working pattern from the relevant domain.

---

**Document Status:** 🚨 MANDATORY REFERENCE
**Last Updated:** October 18, 2026 (v1.1 — code review compliance checks)
**Enforcement:** REQUIRED for all development error resolution