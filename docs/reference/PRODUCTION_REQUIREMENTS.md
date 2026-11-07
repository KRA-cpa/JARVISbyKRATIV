# JarvisByERP Production Requirements

**Date**: September 17, 2025 (production host move noted 8 November 2026)
**Version**: 1.1
**Status**: Current Production Stack Documentation

## Runtime Environment Requirements

### **Node.js Runtime**
- **Current Version**: Node.js v22.14.0
- **Minimum Required**: Node.js v18.0.0 or higher
- **Package Manager**: npm v10.9.2
- **Deployment Platform**: Vercel (React SPA deployment) - **moving (user, 8 Nov 2026):** production → Google Cloud Run `asia-southeast1` behind Firebase Hosting (`daloy.blueknight.xyz`), Vercel keeps previews; see *Deployment Platform* below

### **Browser Support**
**Production Targets:**
- Chrome/Edge: >0.2% market share
- Firefox: >0.2% market share
- Safari: >0.2% market share
- **Excluded**: Opera Mini (not dead, not op_mini all)

**Development Targets:**
- Last 1 Chrome version
- Last 1 Firefox version
- Last 1 Safari version

## Core Dependencies (Production)

### **React Framework**
```json
{
  "react": "^19.1.0",
  "react-dom": "^19.1.0",
  "react-router-dom": "^7.9.1",
  "react-scripts": "5.0.1"
}
```

### **Authentication & Backend**
```json
{
  "firebase": "^11.9.0",
  "@firebase/analytics": "^0.10.16",
  "jose": "^5.9.6"
}
```
- **`jose`** *(added 30 Oct 2026, AppScript v9.4)*: used only by the Vercel function `api/appscript-proxy.js` (never bundled into the React app) to verify the Firebase ID token against Google's securetoken JWKS before forwarding to Apps Script (compliance F6). v5 runs on Node 18+ (Vercel's Node runtime) in both ESM and CJS.
- **`express` + `jose` in the Cloud Run image** *(8 Nov 2026, no new packages)*: `server/app.js` (Express 5) serves the same `api/_lib/proxyCore.js` handler and the React build on Cloud Run. The image installs only these two from `server/package.json` (exact versions **5.1.0 / 5.9.6**, kept equal to the root `package.json` - change both together). Test: `node scripts/test-cloudrun-server.js` (13).

### **UI Framework & Styling**
```json
{
  "tailwindcss": "^3.4.17",
  "@mui/material": "^7.1.1",
  "@mui/icons-material": "^7.1.1",
  "@emotion/react": "^11.14.0",
  "@emotion/styled": "^11.14.0"
}
```

### **Utilities & Performance**
```json
{
  "date-fns": "^4.1.0",
  "web-vitals": "^2.1.4"
}
```

### **Testing Framework**
```json
{
  "@testing-library/dom": "^10.4.0",
  "@testing-library/jest-dom": "^6.6.3",
  "@testing-library/react": "^16.3.0",
  "@testing-library/user-event": "^13.5.0"
}
```

### **Jest Configuration (react-router-dom v7 under CRA Jest 27)** *(added 19 Oct 2026)*
CRA 5 runs Jest 27, whose resolver ignores package `exports`. react-router-dom 7.9.1's `"main"` points to
`dist/main.js`, which the package doesn't ship, and its `dist/index.js` requires `react-router/dom`
(an `exports`-only subpath). Without the mapping below, every suite that imports `src/utils/testUtils.js`
fails with `Cannot find module 'react-router-dom'`. Mapping in `package.json`:
```json
"jest": {
  "moduleNameMapper": {
    "^react-router-dom$": "<rootDir>/node_modules/react-router-dom/dist/index.js",
    "^react-router/dom$": "<rootDir>/node_modules/react-router/dist/development/dom-export.js"
  }
}
```
`src/setupTests.js` also polyfills `TextEncoder` / `TextDecoder` (from Node's `util`), which react-router v7
uses and jsdom (Jest 27) doesn't provide. Re-check both when react-router or react-scripts is upgraded.

### **Contract and Offline Checks** *(added 19 Oct 2026)*
```bash
npm run check:api-contract   # every makeRequest action has a doGet/doPost route in the newest AppScript file
npm run check:code-rules     # (30 Oct 2026) self-test + compliance A14-A18/A20/F3/F4 static checks; known gaps may only shrink
node scripts/test-proxy-auth.js   # (30 Oct 2026) proxy token verification x AUTH_MODE (compliance F6)
node appscript_files/tools/ROUTES_AND_APPROVALS_TEST_v9.0.js appscript_files/APPSCRIPT_v<latest>.txt
node appscript_files/tools/CODE_REVIEW_FIXES_TEST_v8.3.js appscript_files/APPSCRIPT_v<latest>.txt
```

## Development Dependencies

### **CSS Processing**
```json
{
  "autoprefixer": "^10.4.21",
  "postcss": "^8.5.4"
}
```

## CSS Framework Configuration

### **Tailwind CSS Setup**
- **Version**: 3.4.17
- **Configuration**: Custom theme with primary color palette (blue spectrum)
- **Content Sources**: `./src/**/*.{js,jsx,ts,tsx}`, `./public/index.html`
- **Custom Animations**: `spin-slow`, `pulse-slow`
- **Font Stack**: System fonts prioritizing Apple/Windows native fonts

### **Custom Theme Extensions**
- **Primary Colors**: Blue palette (50-900 shades)
- **Font Family**: System font stack for optimal performance
- **Animations**: Slow-motion variants for subtle UI feedback

## Build Configuration

### **React Scripts Configuration**
- **Build Tool**: Create React App v5.0.1
- **Bundler**: Webpack (included in react-scripts)
- **Babel**: Included in react-scripts
- **ESLint**: react-app, react-app/jest configurations

### **Build Commands**
```bash
npm start      # Development server (localhost:3000)
npm run build  # Production build (optimized bundle)
npm run build:ci  # Same build with CI=true, as Vercel runs it: any ESLint warning fails. Run before pushing
npm test       # Test runner
npm run eject  # Eject from CRA (not recommended)
```

## External Service Dependencies

### **Google Services (Proof of Concept Architecture)**
- **Firebase Authentication**: Google Sign-In only
- **Google Sheets Database**: ⚠️ **PROOF OF CONCEPT** - 15+ sheet tabs as database tables
- **Google Apps Script API**: ⚠️ **PROOF OF CONCEPT** - RESTful web app providing backend API
- **Database Tables**: companies, roles, tickets, ticket_types, users, workflow_steps, custom_fields, dropdown_lists, dropdown_options, ticket_history, ticket_action_logs, admin_action_logs, sequence_counters

### **⚠️ PROOF OF CONCEPT DATABASE NOTICE**
**Current Implementation**: Google Sheets + Apps Script Web App
- **Purpose**: Serverless proof of concept for workflow orchestration system
- **Production Suitability**: Not recommended for production scale
- **Migration Path**: Future migration to traditional database (PostgreSQL, MySQL, etc.) planned
- **Data Structure**: 15+ Google Sheets tabs representing normalized database tables
- **API Layer**: Google Apps Script providing RESTful endpoints with JSON responses

### **Deployment Platform**
- **Primary**: Vercel (static React deployment)
- **CDN**: Vercel Edge Network
- **Environment Variables**: Configured via Vercel dashboard
- **Production move (user, 8 Nov 2026 - servers must be in Asia; cheapest all-Asia option, `docs/planning/CHECK_HostingPricing_20261108.md`):** production → **Google Cloud Run `asia-southeast1` (Singapore)**, service `daloy` (`server/app.js`, `Dockerfile`, `scripts/deploy-cloudrun.sh`), behind **Firebase Hosting** (`firebase.json`: static build + `/api/**` rewrite to Cloud Run) at **`daloy.blueknight.xyz`**; secrets `PROXY_SECRET` / `APPS_SCRIPT_URL` in Secret Manager; same proxy env otherwise. **Vercel keeps the previews** (Hobby - the user accepts the commercial-use risk) and the old production `/api/appscript-proxy`. Limits: Firebase Hosting 60 s per request; only the `__session` cookie reaches Cloud Run. Steps: `docs/guides/GUIDE_Deploy_CloudRun_FirebaseHosting.md`
- **Proxy env (from AppScript v9.4)**: `APPS_SCRIPT_URL` (the web app exec URL), `PROXY_SECRET` (same value as the Apps Script Script Property), `AUTH_MODE` (`off` | `warn` | `enforce`), `FIREBASE_PROJECT_ID`. Without `APPS_SCRIPT_URL` the proxy falls back to the deployment URL in the file

## Architecture Requirements

### **SPA Architecture**
- **Type**: Single Page Application (React)
- **Routing**: Client-side routing with React Router v7
- **State Management**: React Context + Local State
- **API Communication**: Fetch API to Google Apps Script

### **Security Requirements**
- **Authentication**: Firebase Auth (Google OAuth only)
- **API Security**: the Vercel proxy verifies the Firebase ID token (`Authorization: Bearer`) and forwards the uid with a shared secret; Apps Script (v9.4+) checks the secret and takes the acting user from it (`AUTH_MODE` warn → enforce). Compliance A15 / F2 / F6
- **Environment Variables**: Sensitive config via `.env` files
- **CSP**: Content Security Policy via Vercel headers

## Performance Requirements

### **Bundle Optimization**
- **Code Splitting**: React.lazy() for route-based splitting
- **Tree Shaking**: Automatic via Webpack
- **Image Optimization**: Vercel automatic optimization
- **Caching**: Browser caching + Vercel CDN

### **Runtime Performance**
- **Web Vitals**: Monitored via web-vitals package
- **Loading States**: Implemented across all async operations
- **Error Boundaries**: React error boundary components
- **Mobile Optimization**: Responsive design with Tailwind breakpoints

## Update Requirements Clause

### **🔄 DESIGN REQUIREMENT UPDATES**

**When design requirements change and necessitate different modules:**

1. **Assessment Phase**:
   - Review new design requirements against current stack
   - Identify gaps in current dependencies
   - Evaluate compatibility with existing architecture

2. **Documentation Updates Required**:
   - Update this `docs/reference/PRODUCTION_REQUIREMENTS.md` with new dependencies
   - Update `package.json` with new modules and versions
   - Update `docs/reference/DEVELOPMENT_PLAN.md` with architectural changes
   - Update `docs/reference/DEPENDENCY_MAPPING.md` if component relationships change

3. **Implementation Process**:
   - Follow superthink audit methodology for dependency changes
   - Conduct dependency impact analysis before implementation
   - Update all relevant documentation before code changes
   - Verify build and deployment compatibility

4. **Validation Requirements**:
   - Test production build with new dependencies
   - Verify browser compatibility remains intact
   - Confirm Vercel deployment compatibility
   - Update version numbers and compatibility matrices

**🚨 CRITICAL RULE**: No production dependency changes without updating this document first.

---

## 🛡️ API DEVELOPMENT SAFEGUARDS (September 25, 2025)

**Based on comprehensive dropdown creation analysis - See DROPDOWN_CREATION_ISSUE_DEBRIEF.md**

### **🚨 MANDATORY PATTERN CONSISTENCY REQUIREMENTS**

#### **1. API ENDPOINT PATTERN STANDARDIZATION**
- **Golden Rule**: "If a simple pattern works elsewhere, use the same simple pattern everywhere"
- **Standard Pattern**: `const dataObject = data.payload || { prop1: data.prop1, prop2: data.prop2 }`
- **Prohibited Patterns**: Complex if/else validation with multiple execution paths
- **Implementation**: All new API endpoints must follow proven simple pattern

#### **2. PRE-DEVELOPMENT REQUIREMENTS**
**Before Any New API Endpoint Development:**
- [ ] **Pattern Analysis**: Review existing working endpoints (company creation, role management)
- [ ] **Consistency Verification**: Ensure new pattern matches established successful patterns
- [ ] **Complexity Assessment**: Reject multi-strategy validation approaches
- [ ] **Frontend Compatibility**: Test with actual frontend payload structures

#### **3. EXPERIMENTAL CODE MANAGEMENT**
- **Debugging vs Production**: Never add complex validation as debugging measure in production code
- **Pattern Proven**: Use only patterns proven successful in working endpoints
- **Rollback Ready**: Maintain clean version archives for rapid rollback to working patterns
- **Architecture Preference**: Simple, consistent patterns over sophisticated validation

#### **4. DEPLOYMENT VERIFICATION PROTOCOLS**
- **Version Synchronization**: All version references must match (pingAPI, headers, mock responses)
- **Critical Function Testing**: Test core operations immediately after deployment
- **Health Monitoring**: Verify APIConnectionStatus shows correct version and functionality
- **Change Documentation**: Record deployment history with precise timestamps

### **⚠️ LEARNED PATTERNS: NEVER IMPLEMENT**

#### **❌ Complex Multi-Strategy Validation (FAILED PATTERN)**
```javascript
// NEVER IMPLEMENT - This pattern failed in production
let dataObject;
if (data.prop1 && data.prop2) {
  dataObject = { prop1: data.prop1, prop2: data.prop2 };
} else if (data.payload) {
  dataObject = data.payload;
} else {
  throw new Error('Invalid request structure');
}
```

**Why This Failed:**
- Multiple execution paths created unpredictable behavior
- Frontend payload structure didn't match validation conditions
- Complex debugging logic became the actual problem
- Strategy conflicts produced different data structure expectations

### **✅ MANDATORY PATTERNS: ALWAYS IMPLEMENT**

#### **✅ Simple Standardized Pattern (PROVEN SUCCESS)**
```javascript
// ALWAYS USE - This pattern succeeds consistently
const dataObject = data.payload || {
  prop1: data.prop1,
  prop2: data.prop2 || 'defaultValue',
  prop3: data.prop3 || null,
  prop4: data.prop4 || []
};
```

**Why This Succeeds:**
- Single assignment, single execution path
- Compatible with both payload and flat structures
- Comprehensive fallback values prevent undefined errors
- Pattern consistency with proven working endpoints

### **📋 MANDATORY DEVELOPMENT CHECKLIST**

**Before API Endpoint Implementation:**
- [ ] **Reference Pattern**: Identify which working endpoint pattern to copy
- [ ] **Pattern Documentation**: Record why this pattern was chosen
- [ ] **Frontend Testing**: Verify with actual frontend payload structure
- [ ] **Fallback Values**: Include explicit fallback for all optional fields
- [ ] **Single Path**: Ensure only one execution path through the logic

**Before Deployment:**
- [ ] **Version Consistency**: Update all version references to match
- [ ] **Critical Testing**: Test core functionality with APIConnectionStatus
- [ ] **Archive Previous**: Save working version with timestamp
- [ ] **Health Verification**: Confirm connection status and functionality
- [ ] **Documentation Update**: Record changes in deployment history

### **🔍 PATTERN ANALYSIS REQUIREMENTS**

**For All New Development:**
1. **Working Pattern Identification**: Find similar successful endpoint implementation
2. **Consistency Analysis**: Verify new approach matches proven patterns
3. **Complexity Rejection**: Choose simple over sophisticated validation
4. **Frontend Compatibility**: Test with actual payload structures
5. **Documentation**: Record pattern decisions for future consistency

**References for Pattern Verification:**
- **Company Creation Pattern** (working): Simple payload handling
- **Role Management Pattern** (working): Consistent fallback structure
- **User Creation Pattern** (working): Single execution path

### **📊 TECHNICAL DEBT PREVENTION**

**Architecture Standards:**
- **Pattern Reuse**: Copy working patterns rather than inventing new validation
- **Debug Separation**: Keep debugging infrastructure separate from production logic
- **Version Management**: Maintain synchronized version references
- **Silent Failure Prevention**: Explicit logging for all payload processing

**Quality Assurance:**
- **Comprehensive Logging**: All operations must have success/failure logging
- **Error Boundaries**: Try-catch with meaningful error messages
- **Success Validation**: Always verify data was written to backend storage
- **Real-time Testing**: Use APIConnectionStatus for deployment verification

## Version Compatibility Matrix

| Component | Current Version | Minimum Required | Last Updated |
|-----------|----------------|------------------|--------------|
| Node.js | v22.14.0 | v18.0.0 | Sept 2025 |
| npm | v10.9.2 | v8.0.0 | Sept 2025 |
| React | v19.1.0 | v18.0.0 | Sept 2025 |
| Tailwind CSS | v3.4.17 | v3.0.0 | Sept 2025 |
| Firebase | v11.9.0 | v10.0.0 | Sept 2025 |
| Material-UI | v7.1.1 | v6.0.0 | Sept 2025 |

---

## 🚨 DROPDOWN CREATION LESSONS INTEGRATION

**Critical Historical Context (September 22-25, 2025):**
- **6-Phase Evolution**: From handler-based → simple → enhanced → complex failure → resolution → standardization
- **Root Cause**: Experimental complex validation during debugging became the actual problem
- **Resolution Method**: Return to proven simple pattern used in working endpoints
- **Technical Impact**: 2.5-hour production failure from pattern inconsistency

**Documentation References:**
- **DROPDOWN_CREATION_ISSUE_DEBRIEF.md**: Complete 48-hour analysis and lessons learned
- **APPSCRIPT_VERSION_EVOLUTION_ANALYSIS.md**: Technical deep-dive of 6-phase evolution
- **COMPREHENSIVE_DEPLOYMENT_HISTORY.md**: Deployment timeline with resolution methodology
- **DEPLOYMENT_CONTEXT_ANALYSIS.md**: Version analysis and pattern consistency findings

**Application to All Development:**
- Pattern consistency more valuable than complex validation
- Simple, single-path execution more reliable than multi-strategy approaches
- Copy working patterns rather than reinventing validation logic
- Separate debug infrastructure from production code paths

---

**Last Updated**: September 25, 2025 - Added API development safeguards
**Next Review**: Before any major feature development or deployment
**Maintainer**: Development Team
**Documentation Status**: ✅ Current and Complete with Dropdown Lessons Integrated