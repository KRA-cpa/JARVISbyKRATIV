# JarvisByERP Dependency Mapping

**Date**: September 28, 2025 - 🏷️ **TICKET TAGS & COLLABORATION SYSTEM UPDATE** (latest section: November 10, 2026 — Dashboard A, compact ticket filters, footer layout)
**Purpose**: Map all component dependencies, imports, and exports to prevent circular dependencies and ensure proper architecture with ticket tags and collaboration system integration

### **🔬 PROOF OF CONCEPT BACKEND ARCHITECTURE**
**Database**: Google Sheets + Apps Script Web App (15+ normalized tables)
**API Layer**: RESTful endpoints via Google Apps Script
**Production Note**: Not suitable for high-volume production use - migration to traditional database planned

## 🚀 Universal Entity System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  🌟 UNIVERSAL ENTITY LAYER                  │
├─────────────────────────────────────────────────────────────┤
│  📊 Tickets | 👤 User Profiles | 🔐 Roles | ⚡ Workflows    │
│  ALL use same custom_fields infrastructure with entity_category │
├─────────────────────────────────────────────────────────────┤
│                     Application Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Pages (5) → Components (23) → Shared Components (11)      │
│  🔄 ENHANCED: AdminPage + tabs for entity types            │
│  🔄 ENHANCED: AdminCustomFieldBuilder + entityCategory     │
│  🏷️ NEW: Tag components + collaboration system             │
├─────────────────────────────────────────────────────────────┤
│                     Business Logic Layer                    │
├─────────────────────────────────────────────────────────────┤
│  Hooks (3) → Utils (7) → API Layer (2)                     │
│  🔄 ENHANCED: useAPI hooks + entityCategory parameters     │
│  🔄 ENHANCED: API functions + entityCategory support       │
├─────────────────────────────────────────────────────────────┤
│                     Infrastructure Layer                    │
├─────────────────────────────────────────────────────────────┤
│  Config (3) → Context (1) → Firebase/Google Sheets         │
│  🔄 ENHANCED: Google Sheets + entity_category columns      │
└─────────────────────────────────────────────────────────────┘
```

### **🎯 REVOLUTIONARY CHANGE: Zero New Components**
Instead of creating new components, existing components are enhanced with:
- **entityCategory parameter** (tickets, user_profile, role)
- **Dynamic UI text** based on entity type
- **Same component logic** works for all entity types

## Core Dependencies Map

### **1. Infrastructure Layer (Foundation)**

#### `src/config/firebase.js`
- **Exports**: `auth`
- **Dependencies**: Firebase SDK
- **Used by**: UserContext, LoginPage, Header
- **Status**: ✅ No issues

#### `src/config/apiConfig.js`
- **Exports**: `apiConfig`, `getAPIHealthStatus`, `checkAPIConnection`
- **Dependencies**: None
- **Used by**: API classes, APIConnectionStatus
- **Status**: 🔍 Needs audit

#### `src/config/development.js`
- **Exports**: `DEV_CONFIG`, `MOCK_USER`
- **Dependencies**: None
- **Used by**: UserContext, API classes
- **Status**: 🔍 Needs audit

### **2. Context Layer**

#### `src/contexts/UserContext.js`
- **Exports**: `UserProvider`, `useUser`, `withAuth`, `withAdminAuth`
- **Dependencies**:
  - Firebase: `auth`
  - API: `API.Users`, `API.System`
  - Config: `DEV_CONFIG`, `MOCK_USER`
- **Used by**: App.js, all pages, protected components
- **Status**: 🔧 Syntax error fixed, needs dependency audit

### **3. API Layer**

#### `src/api/googleSheet.js`
- **Exports**: `API`, `companyAPI`, `roleAPI`, `dropdownAPI`, `ticketAPI`
- **Dependencies**:
  - Config: `apiConfig`
  - Utils: `cache`, `workflowEngine`
- **Used by**: All hooks, components
- **Status**: 🔧 Cache reference issues fixed

#### `src/api/models.js` ✅ AUDITED
- **Exports**: Data models, validation schemas, TypeScript-style JSDoc definitions
- **Dependencies**: None
- **Used by**: API classes, forms
- **Status**: ✅ Excellent TypeScript-style definitions with validation utilities

### **4. Utility Layer**

#### `src/utils/rbac.js` ✅ AUDITED
- **Exports**: RBAC constants, permission functions
- **Dependencies**: None
- **Used by**: UserContext, RBACSettings, protected components
- **Status**: ✅ Excellent code quality, comprehensive implementation

#### `src/utils/workflowEngine.js` ✅ AUDITED
- **Exports**: Workflow processing functions
- **Dependencies**: API classes
- **Used by**: Ticket components, API layer
- **Status**: ✅ Excellent architecture, multi-step approval logic

#### `src/utils/conditionalWorkflows.js` ✅ AUDITED
- **Exports**: Conditional routing logic
- **Dependencies**: Workflow engine
- **Used by**: ConditionalWorkflowBuilder
- **Status**: ✅ Sophisticated implementation, field-based branching

#### `src/utils/` (Other utilities) ✅ ALL AUDITED
- `approvalRouter.js` → ✅ Complex workflow progression logic
- `chainedTickets.js` → ✅ Automated follow-up ticket creation
- `externalAppIntegration.js` → ✅ Manual task-based workflow pausing
- `ticketNumber.js` → ✅ Well-structured ticket numbering utilities

### **5. Hooks Layer**

#### `src/hooks/useAPI.js`
- **Exports**: 25+ API hooks including `useAPIData`, `useUsers`, `useUser`, `useTicketTypes`
- **Dependencies**:
  - API: `API` classes
  - React: `useState`, `useEffect`, `useCallback`
- **Used by**: All data-driven components
- **Status**: ✅ Fixed missing `useAPIData` function and `useUsers` hook - compilation errors resolved

#### `src/hooks/useWorkflowRouter.js` ✅ AUDITED
- **Exports**: Workflow routing logic
- **Dependencies**: Utils, API
- **Used by**: Workflow components
- **Status**: ✅ Complex workflow routing implementation, no issues found

### **6. Shared Components Layer**

#### `src/components/shared/Icons.js`
- **Exports**: `Icons` object with 40+ SVG components
- **Dependencies**: React
- **Used by**: All UI components
- **Status**: ✅ Complete icon library

#### `src/components/shared/Toast.js`
- **Exports**: `Toast`, `useToast`
- **Dependencies**: Icons, React hooks
- **Used by**: All interactive components
- **Status**: ✅ No issues

#### Other Shared Components:
- `Header.js` → Navigation, user menu
- `LoadingScreen.js` → Loading states
- `ErrorBoundary.js` → Error handling
- `LiveClock.js` → Philippine time display

#### Phase 11.0 Tag & Collaboration Components:
- `TagInput.js` → ✅ Advanced tag input with autocomplete and smart features
- `TagSearchFilter.js` → ✅ Multi-tag filtering with AND/OR/NOT operators

### **7. Feature Components Layer**

#### Admin Components (8) ✅ PHASE 8.5 COMPLETE
- **Core Admin (6)**: AdminCompanyManager, AdminDropdownManager, AdminRoleManager, APIConnectionStatus, ConditionalWorkflowBuilder, RBACSettings
- **Phase 8.5 New (2)**: AdminTicketTypeManager, AdminCustomFieldManager
- **Dependencies**: useAPI hooks, shared components, Icons, Toast notifications
- **Export**: React components for complete admin functionality
- **Status**: ✅ All admin management components implemented

#### Ticket Components (6) ✅ AUDITED + PHASE 11.0 ENHANCED
- **Core Components (4)**:
  - `TicketDashboard.js`: Advanced ticket list with filtering
  - `TicketDetail.js`: Complete ticket view with workflow
  - `TicketForm.js`: Dynamic ticket creation/editing
  - `WorkflowStep.js`: Workflow step management UI
- **Phase 11.0 Components (2)**:
  - `TicketTagManager.js` ✅ Tag management interface for ticket details
  - `TicketCollaborationManager.js` ✅ Secure sharing workflow interface
- **Dependencies**: useAPI hooks, workflow utils, shared components, tag components
- **Export**: Core ticketing functionality + tag/collaboration features
- **Previous Issues Fixed**: 8 non-existent icon references resolved across core components
- **Status**: ✅ Core components audited, Phase 11.0 components coded and ready

#### Page Components (4) ✅ AUDITED
- **Dependencies**: All lower layers (contexts, hooks, components, utils)
- **Export**: Main application pages and route handlers
- **Issues Found**: 2 non-existent Icons.Loading references in DashboardPage.js
- **Fixes Applied**:
  - `AdminPage.js`: ✅ No issues found
  - `DashboardPage.js`: 2 Icons.Loading → CSS spinners
  - `LoginPage.js`: ✅ No issues found
  - `UnauthorizedPage.js`: ✅ Already reviewed, no issues
- **Status**: ✅ All issues resolved

## Dependency Issues Identified

### **Critical Issues Fixed:**
1. ✅ Missing `useAPIData` function, `useUsers` hook, and `useTicketTypes` export in useAPI.js
2. ✅ Incorrect cache references in API classes
3. ✅ Non-existent icon references (19 fixes total)
4. ✅ Syntax error in UserContext.js useCallback
5. ✅ **Phase 8.5**: Missing admin components (AdminTicketTypeManager, AdminCustomFieldManager) implemented
6. ✅ **API Integration**: Real Google Apps Script URL configured for live testing

### **Potential Issues to Investigate:**

#### **Circular Dependencies Risk:**
- Utils ↔ API ↔ Hooks potential circular imports
- Components importing utils that import API that import hooks

#### **Missing Dependencies:**
- useEffect dependency arrays
- useCallback dependency arrays
- Prop validation

#### **Unused Dependencies:**
- Imported modules not used
- Dead code in utility functions

## Recommended Dependency Architecture

### **Strict Layering:**
```
Pages
  ↓ (can import)
Components
  ↓ (can import)
Hooks
  ↓ (can import)
Utils
  ↓ (can import)
API
  ↓ (can import)
Config
```

### **Rules:**
1. **No upward imports** - Lower layers cannot import higher layers
2. **Shared components** can only import Icons, basic utilities
3. **Hooks** should be pure data fetching, no business logic
4. **Utils** contain pure functions, no React dependencies
5. **API** layer is purely data access, no UI concerns

---

## 🚀 UNIVERSAL ENTITY SYSTEM DEPENDENCIES (September 27, 2025)

### **🔄 ENHANCED COMPONENT DEPENDENCIES**

#### **AdminCustomFieldBuilder.js (Universal Enhanced)**
- **NEW Props**: `entityCategory`, `entityTypeName`
- **Enhanced Exports**: Works for tickets, user_profiles, roles
- **Dependencies**: Same existing dependencies + entityCategory parameter
- **Used by**: AdminPage (all entity tabs), future EntityTypeManager
- **Status**: ✅ Ready for enhancement

#### **useAPI.js Hooks (Enhanced with entityCategory)**
- **Enhanced Hooks**:
  - `useCustomFields(entityTypeId, entityCategory='ticket')`
  - `useCustomFieldValues(entityId, entityCategory='ticket')`
  - `useSetCustomFieldValue()` with entityCategory support
- **Backward Compatibility**: ✅ All existing calls work unchanged
- **Dependencies**: Same existing + entityCategory parameter passing
- **Status**: ✅ Ready for enhancement

#### **googleSheet.js API Functions (Enhanced)**
- **Enhanced Functions**:
  - `getCustomFields(entityTypeId, entityCategory='ticket')`
  - `createCustomField(entityTypeId, fieldData, entityCategory='ticket')`
  - `setCustomFieldValue(entityId, fieldId, value, entityCategory='ticket')`
- **Backward Compatibility**: ✅ All existing ticket calls work unchanged
- **Dependencies**: Enhanced Google Sheets access with entity_category column
- **Status**: ✅ Ready for enhancement

#### **AdminPage.js (Tab Enhancement)**
- **NEW Tabs**: User Profiles, Roles (reusing existing components)
- **Enhanced Navigation**: Tab-based entity type switching
- **Dependencies**: Same existing + enhanced AdminCustomFieldBuilder
- **Component Reuse**: ✅ Zero new components needed
- **Status**: ✅ Ready for tab addition

### **🔌 PHASE 10.0 ADMIN WIRING (October 18, 2026)**

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `src/App.js` | App | `AdminRoleTypeCreatePage`, **`AdminUserProfileTypeCreatePage`** | — |
| `src/pages/AdminPage.js` | Page | **`useSearchParams`** (react-router-dom), `AdminUserProfileTypeList`, `AdminRoleTypeList` | `/admin` route |
| `src/pages/AdminUserProfileTypeCreatePage.js` | Page | **`useParams`**, `useUserProfileTypeMutations`, `useCompanies`, `API` (`UserProfileTypes.getById`) | `/admin/user-profile-types/create`, **`/admin/user-profile-types/:id/edit`** |
| `src/pages/AdminRoleTypeCreatePage.js` | Page | **`useParams`**, `useRoleTypeMutations`, `useCompanies`, `API` (`RoleTypes.getById`) | `/admin/role-types/create`, **`/admin/role-types/:id/edit`** |
| `src/components/admin/AdminUserProfileTypeList.js` / `AdminRoleTypeList.js` | Component | unchanged | `AdminPage` sub-tabs `user-profile-types` / `role-types` |
| `src/api/googleSheet.js` | API | **`unwrapHandlerResult()`** (module-private) used by `UserProfileTypesAPI` / `RoleTypesAPI` | hooks in `useAPI.js` |

- **`?tab=`**: `AdminPage` accepts a tab id or a sub-tab id. A sub-tab id also selects its parent tab (`user-profile-types` → `users`, `role-types` → `roles`).
- **Response shape**: Phase 10.0 handlers return `{status, data, message}`, and doGet / `createHandlerResponse` wrap that in `{success, data}`. `unwrapHandlerResult()` returns the inner `data` and throws on an inner `status: 'error'`. Mock data (no outer wrapper) passes through.
- **Reads**: `getUserProfileTypes` / `getRoleTypes` are in `makeRequest`'s `readActions` (GET). doPost has no case for them.
- **`getById`**: AppScript has no single-record route, so `getById` filters `getAll(null, true)` (v9.0: inactive included, so a deactivated type can be edited).

### **🔌 PHASE 2/3 ROLES & APPROVALS + API CONTRACT (October 19, 2026 — AppScript v9.0)**

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `src/components/admin/DateBasedRoleAssignmentManager.js` | Component (new) | `Icons`, `useToast`, **`useUserRoleAssignments`**, `useRoles`, `useCompanies`, `useTicketTypes`, `API` (`Users.assignRole` / `updateRoleAssignment` / `deleteRoleAssignment`) | `AdminUserList` (Roles button) |
| `src/components/admin/UserGeneralRoleSelector.js` | Component (new) | React only (exports `GeneralRoleBadge`, `filterUsersByGeneralRole`, `GENERAL_ROLES`) | `AdminUserList` |
| `src/components/admin/AdminUserList.js` | Component | **`DateBasedRoleAssignmentManager`**, **`UserGeneralRoleSelector`**; dropped `useRoles` / `useCompanies` / `useUserProfileTypes` / `useNavigate` (dead dialog, missing `/admin/users/:id/edit` route, non-existent `Icons.Trash`) | `AdminPage` users tab |
| `src/components/tickets/WorkflowStep.js` | Component | **`useApprovalEligibility`** (replaces `useCanUserApprove`); dropped `useAutoWorkflowRouter` — the backend moves the ticket | `TicketDetail` |
| `src/hooks/useAPI.js` | Hooks | new **`useApprovalEligibility`**, **`useUserRoleAssignments`**, **`useUserGeneralRole`**; `useUserProfileTypes` / `useRoleTypes(companyId, includeInactive)`; `useAPIData` refetches when its key changes | components above |
| `src/api/googleSheet.js` | API | `makeRequest` throws on `success: false` and on a payload key `action`; `readActions` + `getCompany`, `getDropdownOptions`, `getUserPreferences`; new `StepApprovals.getApprovalEligibility`, `Users.updateRoleAssignment` / `deleteRoleAssignment` / `getExpiringAssignments` / `getGeneralRole`; `submitApproval` sends `decision`; `normalizeIsActive()` (module-private) | hooks |
| `src/config/apiConfig.js` | Config | `API_ENDPOINTS` cut to the 3 names used inside the file (it never was a route list) | `apiConfig.js` only |

- **Contract rule (compliance A12)**: every `makeRequest('<action>')` needs a `case` in the newest AppScript file — in `doGet` if the action is in `readActions`, else in `routePostAction`. `npm run check:api-contract` checks it; `scripts/api-contract-known-gaps.txt` may only shrink (v9.3: no action left without a route).
- **Response shape (v9.0 routes)**: `createDataResponse` unwraps the handler's `{status, data}`, so `response.data` is the records. Phase 10.0 routes still use `createHandlerResponse` + `unwrapHandlerResult()`.
- **User id**: Firebase / dev users carry `uid` (no `id`); components use `user?.uid || user?.id`.
- **Not used any more by WorkflowStep**: `useAutoWorkflowRouter` / `src/utils/approvalRouter.js` (client-side routing duplicated what `submitStepApproval` now does server-side; kept for other callers).

### **🎫 CORE TICKET LOOP + WORKFLOW ADMIN (October 19, 2026 — AppScript v9.1)**

Until v9.1 nothing imported the ticket components or `AdminWorkflowBuilder`; `npm run check:api-contract` now reports any component `src/index.js` can't reach (`unmounted-component`).

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `src/pages/TicketsPage.js` | Page (new) | `useUser`, `Header`, `Footer`, **`TicketDashboard`** | `App.js` route `/tickets` (ProtectedRoute) |
| `src/components/tickets/TicketDashboard.js` | Component | **`TicketForm`**, **`TicketDetail`**, **`useTicketsForApproval`**, `API.StepApprovals.submitApproval` (bulk), `useTickets` / `useCompanies` / `useTicketTypes` | `TicketsPage` |
| `src/components/tickets/TicketForm.js` | Component | **`useCustomFields(ticketTypeId)`**, **`useDropdownOptions`**, **`DateRangeInput`**, `ticketAPI.create` / `update` / `getNextTicketNumber`; dropped `processTicketWorkflow` (backend starts the workflow) | `TicketDashboard` (modal) |
| `src/components/tickets/TicketDetail.js` | Component | **`useTicketHistory`**, **`useTicketMutations`** (cancel / reopen with userId), **`useCommentRequirements`**, `getSLAStatus` (utils), `WorkflowStep` | `TicketDashboard` |
| `src/components/tickets/WorkflowStep.js` | Component | **`useCommentRequirements`**; `useWorkflowSteps(ticketTypeId, companyId)`; `can_act` for reject / return | `TicketDetail` |
| `src/components/admin/AdminWorkflowBuilder.js` | Component | **`useCompanies`**, **`WorkflowCopyDialog`**; `API.WorkflowSteps.setStepApprovers` / `createDefaultForCompany` | `AdminPage` tab **Workflows** |
| `src/components/admin/WorkflowCopyDialog.js` | Component | `useCompanies`, `useTicketTypes`, `API.WorkflowSteps.copyFromCompany`; reports counts via `onSuccess(message)` | `AdminWorkflowBuilder`, `BulkOperationsManager` (unmounted) |
| `src/components/admin/CrossCompanyTicketLinker.js` | Component | `API.TicketLinks` (all routed in v9.1) | `AdminPage` tab **Ticket Links** |
| `src/components/admin/AdminCompanyManager.js` | Component | **`useUser`**, `companyAPI.unlock(id, reason, userId)` | `AdminPage` companies tab |
| `src/pages/DashboardPage.js` | Page | **`useTicketsForApproval`**, **`useNavigate`** (placeholders → `/tickets`) | `App.js` `/dashboard` |
| `src/components/shared/Header.js` | Shared | nav link **Tickets** → `/tickets` | pages |
| `src/components/shared/Icons.js` | Shared | new `Copy`, `ArrowRight`; `Icons.Trash` (never existed) → `Icons.Delete` in 5 files | all |
| `src/hooks/useAPI.js` | Hooks | new **`useTicketHistory`**, **`useTicketsForApproval`**, **`useCommentRequirements`**; `useCustomFields(id)` loads one type's fields; removed dead `useUser` / `useTicketDueDates` | components above |
| `src/api/googleSheet.js` | API | 9 v9.1 reads in `readActions`; `Tickets.getHistory` / `getForApproval`; `TicketTypes.getCommentRequirements` / `saveCommentRequirements`; `Companies.unlock(id, reason, userId)`; cache cleared after every write (R-02); `submitApproval` uses the module cache (R-01) | hooks |

- **Still unmounted** (backend or feature not ready, listed in `scripts/api-contract-known-gaps.txt`): `BulkOperationsManager` (+ its dialogs), `CompanySLAManager`, `ConfigurationExportImportDialog` (v9.2 routes), `ConditionalWorkflowBuilder` (no condition evaluator), tags / collaboration (Phase 11), `AdminSLAEscalationManager`, `RBACSettings`, superseded `AdminTicketTypeManager` / `AdminCustomFieldManager`, and shared `APITestPanel`, `ActionCommentModal`, `InfiniteLoopMonitor`, `SLANotificationSystem`, `SLAWidgets` (hidden), `UserPreferencesPanel`.
- **Permissions**: the ticket screens gate approve / reject on the backend's eligibility (`getTicketsForApproval`, `canUserApprove`), not on `hasPermission('canApproveTickets')`, which only knows fixed role names (manager, approver, ...).

### **🧭 WORKFLOW LOGIC, REPORTS, TAGS & SHARING (October 19, 2026 — AppScript v9.2 + v9.3)**

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `src/pages/ReportsPage.js` | Page (new) | `useUser`, `Header`, `Footer`, **`TicketReport`** | `App.js` route `/reports` (ProtectedRoute) |
| `src/components/tickets/TicketReport.js` | Component (new) | `useTicketTypes`, `useCompanies`, `useTickets`, `API.Reports.getData`, **`downloadCSV`** (utils), `TicketDetail` | `ReportsPage` |
| `src/utils/csvExport.js` | Util (new) | - (RFC 4180 + formula-injection guard) | `TicketReport` |
| `src/components/admin/ConditionalWorkflowBuilder.js` | Component (rewritten) | **`useCustomFields`**, **`useStepConditions`**, `CONDITION_OPERATORS` (utils), `API.WorkflowSteps.saveConditions` | `AdminWorkflowBuilder` (Routing button per step) |
| `src/components/admin/AdminReportConfigManager.js` | Component (new) | `useTicketTypes`, `useCompanies`, **`useReportConfig`**, `API.Reports.saveConfig` | `AdminPage` tab **Reports** |
| `src/components/admin/AdminAuditLogViewer.js` | Component (new) | `API.AuditLogs.getAdminLogs` | `AdminPage` tab **Audit Log** |
| `src/components/admin/AdminSystemBackup.js` | Component (new) | **`APITestPanel`**, **`ConfigurationExportImportDialog`**, `API.System.createConfigurationBackup` | `AdminPage` tab **System & Backup** |
| `src/components/admin/CompanySLAManager.js` | Component (now mounted) | `API.SLA` company rules (routed in v9.3) | `AdminPage` tab **SLA Rules** |
| `src/components/admin/ConfigurationExportImportDialog.js` | Component (now mounted) | **`useUser`**; import = dry-run preview, then apply | `AdminSystemBackup` |
| `src/components/admin/AdminDropdownManager.js` | Component | `dropdownAPI.updateCompanyAssignments` (was a "not implemented" message); filter by `availability` | `AdminPage` dropdowns tab |
| `src/components/admin/AdminTicketTypeList.js` | Component | **`useUser`**, `API.TicketTypes.setFeatures` (Tags / Sharing pills) | `AdminPage` ticket types tab |
| `src/components/tickets/TicketTagManager.js` | Component (rewritten, now mounted) | **`TagInput`**, `API.Tags` (was `fetch('/api/...')` + mock data) | `TicketDetail` tab **Tags** |
| `src/components/tickets/TicketCollaborationManager.js` | Component (rewritten, now mounted) | `useUsers`, `useCompanies`, `API.Sharing` | `TicketDetail` tab **Sharing** |
| `src/components/shared/TagInput.js`, `TagSearchFilter.js` | Shared (now mounted) | `Icons` | `TicketTagManager`, `TicketDashboard` |
| `src/components/shared/SLAWidgets.js`, `SLANotificationSystem.js` | Shared (now mounted) | SLA hooks (open tickets only) | `DashboardPage` |
| `src/components/shared/UserPreferencesPanel.js` | Shared (now mounted) | `API.Users.getPreferences` / `updatePreferences` with `uid` | `ProfilePage` |
| `src/components/tickets/TicketDashboard.js` | Component | **`TagSearchFilter`**, **`useTags`**, **`useSharedTickets`**, `useSearchParams` (`?sla=`, `?show=`); chained parent/child rows | `TicketsPage` |
| `src/components/tickets/TicketDetail.js` | Component | **`TicketTagManager`**, **`TicketCollaborationManager`**, **`useTicketActionLogs`** (admin system log) | `TicketDashboard`, `TicketReport` |
| `src/hooks/useAPI.js` | Hooks | new **`useStepConditions`**, **`useReportConfig`**, **`useTicketActionLogs`**, **`useUserPreferences`**, **`useTags`**, **`useSharedTickets`**; SLA hooks skip closed tickets | components above |
| `src/api/googleSheet.js` | API | v9.2 + v9.3 reads in `readActions`; new **`API.Reports`**, **`API.AuditLogs`**, **`API.Tags`**, **`API.Sharing`**; `WorkflowSteps.getConditions` / `saveConditions`; `TicketTypes.setFeatures`; `System.runTest` = read-only health check | hooks |

- **Still unmounted** (`scripts/api-contract-known-gaps.txt`, 9 + 2 icons): `BulkOperationsManager` + `BulkRoleAssignmentDialog` / `BulkWorkflowDialog`, `AdminSLAEscalationManager`, `RBACSettings`, superseded `AdminTicketTypeManager` / `AdminCustomFieldManager`, `ActionCommentModal`, `InfiniteLoopMonitor`.

### **⏱️ PROXY AUTH, DASHBOARD CALL, SLA ESCALATION (October 30, 2026 — AppScript v9.4 + v9.5)**

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `api/_lib/proxyCore.js` | Vercel helper (new, not a function: `_` folder) | **`jose`** (`createRemoteJWKSet`, `jwtVerify`); identity adapters (`firebase`) | `api/appscript-proxy.js`, `scripts/test-proxy-auth.js` |
| `api/appscript-proxy.js` | Vercel function (rewritten) | `./_lib/proxyCore` (env: `APPS_SCRIPT_URL`, `PROXY_SECRET`, `AUTH_MODE`, `FIREBASE_PROJECT_ID`) | the frontend base URL (`apiConfig`) |
| `src/api/googleSheet.js` | API | **`auth`** (`config/firebase`) for the ID token header; in-flight read dedupe + 10 s read cache, cache cleared on writes; v9.4 / v9.5 reads in `readActions`; **`API.Tickets.getDashboard`**, `API.SLA` escalation rules / events / test / run / holidays / settings, new **`API.Notifications`** | hooks |
| `src/hooks/useAPI.js` | Hooks | new **`useDashboard`**, **`useSLAEscalationEvents`**, **`useNotifications`**, **`useCompanyHolidays`**, **`useSLANotificationSettings`**; `useSLAEscalationRules` / `useSLAEscalationMutations` call the API (were mocks); `useSLANotificationMonitor` removed (browser engine) | components below |
| `src/utils/slaEscalation.js` | Util (rewritten) | - (constants, labels, `validateEscalationRule`, `describeRule`; the engine is removed - compliance F1) | `AdminSLAEscalationManager` |
| `src/components/admin/AdminSLAEscalationManager.js` | Component (rewritten, **now mounted**) | `useUser`, `useCompanies`, `useTicketTypes`, `useRoles`, `useWorkflowSteps`, **SLA hooks above**, `API.SLA`, `slaEscalation` utils | `AdminPage` tab **SLA Escalations** |
| `src/components/admin/CompanySLAManager.js` | Component | escalation tab now points to SLA Escalations | `AdminPage` tab **SLA Rules** |
| `src/components/shared/Header.js` | Shared | **`useNotifications`** (the bell; the `notifications` prop is gone) | every page |
| `src/components/shared/SLANotificationSystem.js` | Shared (rewritten) | `useTickets`, **`useNotifications`**, `getSLAStatus` (no engine) | `DashboardPage` |
| `src/pages/DashboardPage.js` | Page | **`useDashboard`** replaces `useCompanies` / `useTicketTypes` / `useTicketsForApproval`; mock notifications removed | `App.js` |
| `src/pages/AdminPage.js` | Page | **`AdminSLAEscalationManager`** tab; mock notifications removed | `App.js` |
| `src/components/tickets/TicketDetail.js` | Component | **`useSLAEscalationEvents`** (History → SLA escalations) | `TicketDashboard`, `TicketReport` |
| `src/components/tickets/TicketDashboard.js` | Component | `?ticket=<id>` opens that ticket (bell links) | `TicketsPage` |

- **Unmounted now**: 8 components + 2 icons (`AdminSLAEscalationManager` mounted in v9.5).

### **🧹 DASHBOARD A, COMPACT TICKET FILTERS, FOOTER LAYOUT (November 10, 2026 — frontend only, no AppScript change)**

From the Cloud Run test-site review (`docs/planning/HANDOFF_UIFixes_ProdMove_20261109.md`). The file inventory shrinks by 2.

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `src/pages/DashboardPage.js` | Page (rewritten) | `useDashboard` (counts + approval inbox), **`useTicketList`** (one 10-ticket page, replaces `useTickets`), **`useNotifications`** (shared with the header bell via the read cache), `LiveClock`, `DEV_CONFIG.DASHBOARD_CARDS`; no `useToast` / `useInformation` / SLA widgets any more | `App.js` route `/dashboard` |
| `src/components/shared/TagSearchFilter.js` | Shared component | unchanged imports; new **`compact`** prop (inline row: tag input + chips, ANY / ALL with 2+ tags, Exclude per suggestion, `Saved` menu); full mode unchanged | `TicketDashboard` (compact, inside "More filters") |
| `src/components/tickets/TicketDashboard.js` | Component | unchanged imports; one toolbar (search · Status · SLA · More filters · Clear), slim sort line; Clear also clears tags (remount by `key`) | `TicketsPage` |
| `src/components/tickets/TicketReport.js` | Component | unchanged; criteria grid `lg:grid-cols-6`, date pair spans 2 | `ReportsPage` |
| `src/pages/{Admin,Dashboard,Plans,Profile,Reports,Tickets}Page.js` | Pages | unchanged imports; `min-h-screen flex flex-col` + `flex-1` content, so the footer sits at the bottom (Profile's footer moved out of the content box) | `App.js` |
| `src/hooks/useAPI.js` | Hooks | **removed** `useSLAOverdueTickets`, `useSLADueTodayTickets` (browser-side SLA lists; compliance F1) | - |
| ~~`src/components/shared/SLAWidgets.js`~~ | **Deleted** | - | was `DashboardPage` only |
| ~~`src/components/shared/SLANotificationSystem.js`~~ | **Deleted** | - | was `DashboardPage` only |

Rows further down that list `SLAWidgets` / `SLANotificationSystem` as users of `useNotifications`, `slaCalculator` or `getAll({ status: 'open' })` are history; those files no longer exist.

### **💳 PLANS PER COMPANY - PUBLIC CATALOGUE PAGE (November 1, 2026 — AppScript v10.2 P1)**

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `src/config/plans.js` | Config (new, leaf) | - (plan names / taglines, feature labels by area, limit labels, state labels, **`PLAN_CATALOG_COPY`**, `formatPlanLimit`; display copy only - the server's `PLAN_CATALOG` decides, F1; `check:api-contract` fails on a "plan-copy" difference with `PLAN_FEATURE_TIERS` / `PLAN_LIMITS`) | `PlanCatalog` |
| `src/api/googleSheet.js` | API | new **`Plans`** (`getCatalog` → `getPlanCatalog`, `getCompanyPlan(companyId, { includeUsage, all })`); both in the GET read list | hooks |
| `src/hooks/useAPI.js` | Hooks | new **`usePlanCatalog`**, **`useCompanyPlans`** (for the P5 Plan & usage / Platform screens; the public page doesn't call them) | - (P5) |
| `src/config/pricing.js` | Config (new, leaf) | - (`SHOW_PRICES` = false: the price display switch, 8 Nov 2026; while false `plansProposed.js` / `promo.js` leave the price figures out of the build and the founding banner shows the % saving only) - `config/plansProposed` also has `PROPOSED_PLANS_LIVE` = true (production shows the 4-plan line-up) | `config/plansProposed`, `config/promo`, `PlanCatalog`, `PromoBanner` |
| `src/components/plans/PlanCatalog.js` | Component (new, mounted) | `Icons`, `react-router-dom` `Link`, **`config/plans`** - static, **no API call** | `PlansPage` |
| `src/components/shared/PublicHeader.js` | Shared component (mounted) | `useUser` (isAuthenticated, loading), `useLocation` (active link, closes the phone menu), `Icons`, **`config/site`** (`PUBLIC_NAV`: How it works, Plans, Contact, Privacy) - no API call; inline nav from md up, a menu button on phones | `HomePage`, `HowItWorksPage`, `ContactPage`, `PlansPage`, `PrivacyPage` (signed out) |
| `src/config/site.js` | Config (new, leaf) | - (`PUBLIC_NAV`, `HOW_IT_WORKS_PATH` / `_LABEL`, `HOW_IT_WORKS` copy (live v10.2 features only), `CONTACT` + `contactMailto`; reads `REACT_APP_CONTACT_EMAIL` at build time) | `PublicHeader`, `HowItWorksPage`, `ContactPage`, `App.js` (route path) |
| `src/pages/HowItWorksPage.js` | Page (new) | `useUser`, `Header` / **`PublicHeader`**, `Footer`, `Icons`, **`config/site`** - static, no API call | `App.js` routes `/how-it-works` and `/features` (`OpenRoute`) |
| `src/pages/ContactPage.js` | Page (new) | `useUser`, `Header` / **`PublicHeader`**, `Footer`, `Icons`, **`config/site`** - static, no API call; mailto links to `REACT_APP_CONTACT_EMAIL` (hidden while unset) + the DPO address | `App.js` route `/contact` (`OpenRoute`) |
| `src/config/legal/privacy.js` | Config (new, leaf) | - (`PRIVACY_POLICY`: status draft / published, the proposed draft text with `[[open decision]]` markers, the production placeholder; source `docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md`) | `PrivacyPage` |
| `src/pages/PrivacyPage.js` | Page (new) | `useUser`, `Header` / **`PublicHeader`**, `Footer`, **`config/legal/privacy`** - static, no API call; draft text on previews / local dev and `/privacy/draft` (noindex), production `/privacy` = placeholder + link to the draft | `App.js` routes `/privacy` and `/privacy/draft` (`OpenRoute`) |
| `src/components/shared/Footer.js` | Shared component | `react-router-dom` `Link` - **Privacy Policy** link to `/privacy` on every page | every page |
| `src/pages/HomePage.js` | Page (new, placeholder) | **`PublicHeader`**, `Footer`, `Icons`, **`config/plans`** (plan names), **`assets/hero/daloy-hero-light.svg` / `-dark.svg`** (CSS-only animation from `docs/design/ticketflow-hero/`, swapped with `dark:` classes; reduced motion = final frame) - static, no API call; links to `/plans` and `/login` | `App.js` `SmartRedirect` on `/` for visitors (signed in → `/dashboard`); placeholder for `docs/planning/PLAN_PlatformWebsite_20261101.md` W1 |
| `src/pages/PlansPage.js` | Page (new) | `useUser`, `Header` (signed in) / **`PublicHeader`** (signed out), `Footer`, **`PlanCatalog`** | `App.js` route `/plans` - **`OpenRoute`** (public: no sign-in, no redirect) |
| `src/components/shared/Header.js` | Shared component | nav link **Plans** (desktop + mobile, `Icons.Shield`) | every page |

### **🌏 COUNTRY CALENDARS, COMPANY TIME ZONES, DISPLAY ZONE (November 1, 2026 — AppScript v10.1)**

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `src/config/timeZones.js` | Config (new) | - (`DEFAULT_ZONE` - the only `'Asia/Manila'` in src/, `DEFAULT_COUNTRY`) | `dateTime.js`, `googleSheet.js` (mock defaults), `CompanyRegionSettings` |
| `src/utils/dateTime.js` | Util (new, leaf) | **`config/timeZones`** (`formatInZone`, `formatDateTime`, `formatDateOnly`, `formatTimeOnly`, `dayInZone`, `zoneParts`, `wallClockIn` / `fromWallClock`, `zoneOffsetMinutes`, `zoneLabel`, `listTimeZones`, `get` / `setDisplayZone`) | every date display (F3 v3); `UserContext` imports it like `utils/sessionGuard` (a leaf with no app imports - the one context → util exception) |
| `src/utils/slaCalculator.js` | Util (fixed) | **`dateTime`** (the +8 h `toPhilippineTime` is gone; day math on the zone's wall clock; `formatSLADate`) | `AdminWorkflowBuilder`, `TicketDetail`, `SLANotificationSystem`, `useAPI` |
| `src/contexts/UserContext.js` | Context | **`dateTime`** (new `effectiveZone(companyId, fallbackZone)`, `companyZone`, `setDisplayTimezone`, `displayTimezone` from the profile; keeps `setDisplayZone` on the current company) | every component through `useUser` |
| `src/api/googleSheet.js` | API | **`config/timeZones`**; new **`CountryCalendars`** (`getAll`, `getHolidays`, `save`, `importHolidays`, `addBuiltInHolidays`), **`Companies.setRegion`**; `SLA.addPhilippineHolidays` removed (the country calendar has it) | hooks below |
| `src/hooks/useAPI.js` | Hooks | new **`useCountryCalendars`**, **`useCountryHolidays`**, **`useCompanyRegion`** | components below |
| `src/components/admin/AdminCountryCalendars.js` | Component (new, mounted) | **`useCountryCalendars`**, **`useCountryHolidays`**, `dateTime` | `AdminPage` tab **Country Calendars** |
| `src/components/admin/CompanyRegionSettings.js` | Component (new, mounted) | **`useCountryCalendars`**, **`useCompanyRegion`**, `dateTime`, `config/timeZones` | `AdminCompanyManager` (📅 Region) |
| `src/components/shared/DisplayTimeZoneSelect.js` | Shared component (new, mounted) | `dateTime` | `ProfilePage` (Preferences), `UserPreferencesPanel` |
| `src/components/admin/AdminSLAEscalationManager.js` | Component | Holidays panel: country days + *We work* / *Add day off* (`overrides_country`) | `AdminPage` |
| `src/components/shared/LiveClock.js` | Shared component | **`dateTime`** (display zone + its label; the +8 h shift is gone) | `Header`, `DashboardPage` |
| 20 components / pages (Header, SLANotificationSystem, TicketDashboard, TicketDetail, TicketReport, TicketLinksManager, TicketCollaborationManager, WorkflowStep, DashboardPage, ProfilePage, AdminAuditLogViewer, AdminCompanyManager, AdminUserInvites, AdminRoleTypeList, AdminUserProfileTypeList, DateBasedRoleAssignmentManager, CompanySLAManager, ConfigurationExportImportDialog, APIConnectionStatus, APITestPanel, InfiniteLoopMonitor) + `utils/externalAppIntegration` | - | **`dateTime`** instead of `toLocale*String()` / a fixed Manila `Intl` | - |

### **🔒 TICKET ACCESS, PAGING, RESTRICTED, NOTIFICATIONS (November 1, 2026 — AppScript v10.0)**

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `src/config/labels.js` | Config (new) | - (`RESTRICTED_LABEL`, `RESTRICTED_MASK`, `RESTRICTED_TICKET_MESSAGE`, `RESTRICTED_MODES`, `RESTRICTED_ADMIN_ACCESS`, `isRestrictedStub`) | components below |
| `src/api/googleSheet.js` | API | `Tickets.getPage` / `getAll` (page walk, capped), **`Tickets.reveal`**, **`Tickets.setRestricted`**, `TicketTypes.getCreatable`, `setFeatures` + visibility / Restricted, `CustomFields.create` + `is_confidential`, `Notifications.getAll` + cursor; `getCreatableTicketTypes` in `readActions` | hooks, components |
| `src/hooks/useAPI.js` | Hooks | new **`useTicketList`** (pages + Load more), **`useTicketLookup`**, **`useTicketTypeChoices`**; SLA hooks read open tickets only | components below |
| `src/components/tickets/TicketDashboard.js` | Component | **`useTicketList`**, **`useTicketLookup`**, **`labels`** (server search / filters, Load more, stub rows) | `TicketsPage` |
| `src/components/tickets/TicketForm.js` | Component | **`useTicketTypeChoices`**, **`labels`** (creatable types only, Restricted tick) | `TicketDashboard` |
| `src/components/tickets/TicketDetail.js` | Component | **`API`**, **`labels`** (stub screen + admin reveal, Restricted badge + admin switch, no Sharing on Restricted) | `TicketDashboard`, `TicketReport` |
| `src/components/tickets/TicketReport.js` | Component | **`useTicketLookup`** (no full ticket list), 90-day / truncated notes | `/reports` |
| `src/components/admin/AdminTicketTypeList.js` | Component | **`labels`** (Visibility chip, Restricted mode + admin access) | `AdminPage` → Ticket Types |
| `src/pages/AdminTicketTypeCreatePage.js` | Page | visibility select | `App.js` |
| `src/pages/AdminCustomFieldCreatePage.js` | Page | **`labels`** (Restricted field switch) | `App.js` |
| `src/pages/DashboardPage.js` | Page | **`labels`** (stub rows) | `App.js` |
| `src/components/shared/SLANotificationSystem.js`, `src/utils/approvalRouter.js` | Component / Util | open tickets only (`getAll({ status: 'open' })`) | `DashboardPage` |

### **🔐 ADMIN CHECKS, INVITES, LINKS, COMPANY EMAIL, SESSIONS (October 31, 2026 — AppScript v9.6)**

| File | Layer | Imports (new in bold) | Used by |
|---|---|---|---|
| `api/_lib/proxyCore.js` | Vercel helper | forwards **`_auth_email`** (Google-verified only), 12-hour cap (env **`MAX_SESSION_HOURS`**), 401 codes | `api/appscript-proxy.js` |
| `src/api/googleSheet.js` | API | exports **`AUTH_EVENT`**, **`SIGN_OUT_CODES`**; 401 / 403 keep `{ code }` (no retry); new **`API.Invites`**, **`API.CompanyEmail`**, **`API.Attachments`**; v9.6 reads in `readActions` | hooks, `UserContext` |
| `src/hooks/useAPI.js` | Hooks | new **`useUserInvites`**, **`useCompanyEmailSettings`**, **`useTicketAttachments`** (shared `useWriteRunner`) | components below |
| `src/utils/sessionGuard.js` | Util (new) | - (idle limit, shared last-activity in localStorage, one-time notice in sessionStorage) | `UserContext`, `LoginPage` |
| `src/contexts/UserContext.js` | Context | **`AUTH_EVENT` / `SIGN_OUT_CODES`**, **`sessionGuard`**; idle sign-out; no mock Admin outside `DISABLE_AUTH` | everything |
| `src/pages/LoginPage.js` | Page | **`takeSessionNotice`** | `App.js` |
| `src/components/admin/AdminUserInvites.js` | Component (new, mounted) | `useCompanies`, `useRoles`, **`useUserInvites`** | `AdminUserList` (Invite) |
| `src/components/admin/AdminUserList.js` | Component | **`AdminUserInvites`** | `AdminPage` → Users |
| `src/components/admin/CompanyEmailSettings.js` | Component (new, mounted) | **`useCompanyEmailSettings`** | `AdminCompanyManager` (🔔 Email) |
| `src/components/admin/AdminCompanyManager.js` | Component | **`CompanyEmailSettings`** | `AdminPage` → Companies |
| `src/components/tickets/TicketLinksManager.js` | Component (new, mounted) | **`useTicketAttachments`** (fetched only while the tab is open - F5) | `TicketDetail` (Links tab) |
| `src/components/tickets/TicketDetail.js` | Component | **`TicketLinksManager`**; link history labels | `TicketDashboard`, `TicketReport` |

- **Unmounted now**: unchanged (8 components + 2 icons); the 3 new components are mounted in the batch that adds them.

### **📊 DEPENDENCY IMPACT ANALYSIS**

#### **Zero Breaking Changes**
- All existing component imports work unchanged
- All existing hook calls work unchanged
- All existing API calls work unchanged
- Backward compatibility maintained 100%

#### **Enhanced Capabilities**
- Same components work for multiple entity types
- Same hooks support all entity categories
- Same API functions handle all entities
- Same validation and UI logic reused

## 🏷️ PHASE 11.0 TICKET TAGS & COLLABORATION DEPENDENCIES (September 28, 2025)

### **📋 NEW COMPONENT DEPENDENCY ANALYSIS**

#### **TagInput.js (Shared Component)**
- **Dependencies**:
  - React hooks: `useState`, `useEffect`, `useCallback`, `useRef`
  - Shared components: `Icons`
  - API hooks: `useTicketTags()`, `useTagCategories()`
  - Utils: Tag validation, autocomplete logic
- **Exports**: `TagInput` component with advanced autocomplete
- **Used by**: TicketForm, TicketTagManager, tag-enabled forms
- **Features**: Smart suggestions, hierarchy support, validation
- **Status**: ✅ Coded and ready for integration

#### **TagSearchFilter.js (Shared Component)**
- **Dependencies**:
  - React hooks: `useState`, `useEffect`, `useCallback`
  - Shared components: `Icons`, `Toast`
  - API hooks: `useTicketTags()`, `useTagSearch()`
  - Utils: Query builder logic, filter operators
- **Exports**: `TagSearchFilter` component with visual query builder
- **Used by**: TicketDashboard, search interfaces, reporting components
- **Features**: AND/OR/NOT operators, saved filters, visual query building
- **Status**: ✅ Coded and ready for integration

#### **TicketTagManager.js (Ticket Component)**
- **Dependencies**:
  - React hooks: `useState`, `useEffect`, `useCallback`
  - Shared components: `TagInput`, `Icons`, `Toast`
  - API hooks: `useTicketTags()`, `useTagAssignments()`, `useTagStatistics()`
  - Utils: Tag assignment logic, permission validation
- **Exports**: `TicketTagManager` component for ticket detail integration
- **Used by**: TicketDetail page, ticket management interfaces
- **Features**: Tag assignment, hierarchy management, usage analytics
- **Status**: ✅ Coded and ready for integration

#### **TicketCollaborationManager.js (Ticket Component)**
- **Dependencies**:
  - React hooks: `useState`, `useEffect`, `useCallback`
  - Shared components: `Icons`, `Toast`, `ActionCommentModal`
  - API hooks: `useCollaborations()`, `useCollaborationRequests()`, `useUsers()`
  - Utils: Permission validation, notification logic, security checks
- **Exports**: `TicketCollaborationManager` component for secure sharing
- **Used by**: TicketDetail page, collaboration interfaces
- **Features**: Share requests, permission levels, access control, audit trail
- **Status**: ✅ Coded and ready for integration

### **🔗 API INTEGRATION DEPENDENCIES**

#### **Enhanced API Hooks (Phase 11.0 Extensions)**
- **New Hooks Required**:
  - `useTicketTags(filters)` - Tag management with hierarchy
  - `useTagCategories()` - Tag organization system
  - `useTagAssignments(ticketId)` - Ticket-tag relationships
  - `useTagStatistics()` - Usage analytics and trending
  - `useCollaborations(ticketId)` - Ticket sharing management
  - `useCollaborationRequests()` - Share request workflow
  - `useTagSearch(query)` - Advanced tag-based search
- **Dependencies**: Enhanced googleSheet.js API with tag/collaboration endpoints
- **Status**: 🟡 Design complete, API integration pending

#### **Enhanced Backend Functions (25+ Functions)**
- **Tag Management Functions** (8):
  - `createTicketTag()`, `updateTicketTag()`, `deleteTicketTag()`
  - `getTagHierarchy()`, `getTagStatistics()`, `validateTagPermissions()`
  - `assignTagToTicket()`, `unassignTagFromTicket()`
- **Collaboration Functions** (12):
  - `createCollaborationRequest()`, `approveCollaborationRequest()`
  - `shareTicketWithUser()`, `revokeTicketAccess()`
  - `getSharedTickets()`, `getCollaborationHistory()`
  - `validateCollaborationPermissions()`, etc.
- **Search & Analytics Functions** (8):
  - `searchTicketsByTags()`, `getTagUsageStatistics()`
  - `getCollaborationAnalytics()`, `generateTagReports()`
- **Status**: 🟡 All functions designed in TICKET_TAGS_COLLABORATION_APPSCRIPT.txt

### **📊 DATABASE SCHEMA DEPENDENCIES**

#### **New Tables Required (8 Tables)**
- **ticket_tags**: Tag definitions with hierarchy and categories
- **ticket_tag_assignments**: Tag-to-ticket relationships
- **tag_categories**: Tag organization system
- **tag_usage_statistics**: Analytics and trending data
- **ticket_collaborations**: Sharing configuration
- **collaboration_requests**: Share request workflow
- **collaboration_notifications**: Real-time notifications
- **shared_ticket_access_logs**: Comprehensive audit trail

#### **Schema Integration Requirements**
- **Column Structure**: All tables use | delimited columns format
- **Audit Fields**: Complete audit trail (created_at, created_by, updated_at, updated_by, etc.)
- **Security Fields**: Permission levels, access control, deactivation tracking
- **Status**: ✅ Complete schema documented in DATABASE_SCHEMA_UPDATES.txt

### **🔄 COMPONENT INTEGRATION FLOW**

#### **Phase 11.0 Component Integration Chain**
```
TicketDetail.js
    ↓ imports and uses
TicketTagManager.js + TicketCollaborationManager.js
    ↓ both import and use
TagInput.js + TagSearchFilter.js
    ↓ all components use
Enhanced API Hooks (useTicketTags, useCollaborations, etc.)
    ↓ hooks call
Enhanced googleSheet.js API functions
    ↓ API functions interact with
8 New Database Tables in Google Sheets
```

#### **Dependency Safety Analysis**
- **No Circular Dependencies**: Tag components are lower-level than ticket components
- **Clear Layer Separation**: Shared components → Ticket components → Pages
- **API Isolation**: All backend integration through hooks layer
- **Error Boundaries**: Each component handles errors independently
- **Status**: ✅ Architecture follows established dependency patterns

### **📋 INTEGRATION CHECKLIST**

#### **Backend Integration Requirements**
- [ ] **Integrate 25+ functions** from TICKET_TAGS_COLLABORATION_APPSCRIPT.txt into main APPSCRIPT.txt
- [ ] **Create 8 new database tables** in Google Sheets with proper column structure
- [ ] **Test API endpoints** with actual frontend payload structures
- [ ] **Verify permission system** integration with existing RBAC

#### **Frontend Integration Requirements**
- [ ] **Add API hooks** to useAPI.js for tag and collaboration operations
- [ ] **Integrate TagInput** into TicketForm for tag assignment during creation
- [ ] **Integrate TicketTagManager** into TicketDetail for post-creation tag management
- [ ] **Integrate TicketCollaborationManager** into TicketDetail for sharing workflow
- [ ] **Add TagSearchFilter** to TicketDashboard for advanced filtering

#### **Testing Requirements**
- [ ] **Component Testing**: Verify all 4 components render and function correctly
- [ ] **Integration Testing**: Test complete tag assignment and collaboration workflow
- [ ] **API Testing**: Verify all backend functions work with frontend components
- [ ] **Security Testing**: Validate permission controls and access restrictions

**Status**: 🟡 **DESIGN COMPLETE, INTEGRATION PENDING** - All components coded, dependencies mapped, ready for backend integration

---

## 🛡️ ARCHITECTURAL SAFEGUARDS (September 25, 2025)

**Based on dropdown creation analysis - See DROPDOWN_CREATION_ISSUE_DEBRIEF.md**

### **🚨 PATTERN CONSISTENCY ARCHITECTURE REQUIREMENTS**

#### **1. API LAYER PATTERN STANDARDIZATION**
- **Golden Rule**: "Use proven patterns from working implementations"
- **Standard Pattern**: All API endpoints must follow simple payload pattern
- **Reference Implementations**: Company creation, role management (proven working)
- **Prohibited**: Multi-strategy validation patterns with complex conditional logic

#### **2. COMPONENT ARCHITECTURAL SAFEGUARDS**

**Before Adding New API-Connected Components:**
- [ ] **Pattern Analysis**: Review existing working components for similar functionality
- [ ] **Dependency Verification**: Ensure new component follows established layer hierarchy
- [ ] **Payload Compatibility**: Verify frontend-backend payload structure consistency
- [ ] **Error Handling**: Implement proven error handling patterns from working components

**Component Pattern Requirements:**
```javascript
// ✅ PROVEN PATTERN - Use in all new components
const { data, loading, error, create } = useAPIHook();

// ✅ PROVEN ERROR HANDLING - Copy from working components
const handleSubmit = async (formData) => {
  try {
    const result = await create(formData);
    showToast('success', 'Operation completed successfully');
  } catch (error) {
    showToast('error', error.message);
  }
};
```

#### **3. HOOK LAYER SAFEGUARDS**

**Custom Hook Pattern Requirements:**
- **Single Responsibility**: Each hook handles one specific data type or operation
- **Consistent Error Handling**: All hooks return `{ data, loading, error }` structure
- **Caching Strategy**: Follow established caching patterns from working hooks
- **Pattern Reuse**: Copy successful patterns from `useCompanies`, `useRoles`

**Before Creating New Hooks:**
- [ ] **Existing Hook Review**: Check if similar functionality already exists
- [ ] **Pattern Consistency**: Use same structure as proven working hooks
- [ ] **Error Boundaries**: Implement same error handling as successful hooks
- [ ] **Testing Strategy**: Follow testing patterns from working implementations

#### **4. UTILS LAYER PATTERN ENFORCEMENT**

**Business Logic Pattern Requirements:**
- **Pure Functions**: No React dependencies, no side effects
- **Single Execution Path**: Avoid complex conditional logic chains
- **Comprehensive Testing**: All util functions must have clear success/failure cases
- **Pattern Consistency**: Follow established patterns from `ticketNumber.js`, `rbac.js`

#### **5. TECHNICAL DEBT PREVENTION**

**Architecture Standards:**
- **Pattern Recognition**: Always identify similar working implementation before starting
- **Complexity Rejection**: Choose simple, proven patterns over sophisticated validation
- **Documentation**: Record why specific patterns were chosen for future consistency
- **Version Control**: Maintain clean history showing pattern evolution

**Development Process Safeguards:**
1. **Pre-Development Analysis**: Identify working pattern to copy
2. **Implementation Verification**: Test with actual data structures
3. **Pattern Documentation**: Record pattern decisions
4. **Integration Testing**: Verify with existing working components

### **📋 ARCHITECTURAL CHECKLIST**

**Before Component Development:**
- [ ] **Reference Implementation**: Identify working component with similar functionality
- [ ] **Pattern Documentation**: Record which working pattern is being used
- [ ] **Dependency Verification**: Confirm component follows layer hierarchy
- [ ] **Payload Testing**: Verify frontend-backend data structure compatibility

**Before API Integration:**
- [ ] **Working Pattern**: Identify successful API endpoint pattern to copy
- [ ] **Error Handling**: Use same error handling as proven working endpoints
- [ ] **Testing Strategy**: Test with actual frontend payload structures
- [ ] **Documentation**: Record pattern decisions for future reference

### **🔍 DROPDOWN LESSONS FOR ARCHITECTURE**

**Key Architectural Lessons:**
1. **Pattern Consistency**: Copy working patterns rather than inventing new validation
2. **Simple Execution**: Single-path execution more reliable than multi-strategy approaches
3. **Frontend Compatibility**: Always test with actual frontend data structures
4. **Documentation**: Record pattern decisions to prevent future inconsistencies
5. **Technical Domain Separation**: API layer vs business logic vs UI layer issues

**Architecture Pattern History:**
- **Phase 0**: Handler-based pattern with utilities (working)
- **Phase 1-2**: Simple pattern across components (working)
- **Phase 3**: Complex validation experiment (failed)
- **Phase 4**: Return to simple pattern (successful)
- **Phase 5**: Systematic standardization (architectural success)

**Application to All Development:**
- Use proven architectural patterns from working implementations
- Maintain separation of concerns between layers
- Keep debugging infrastructure separate from production architecture
- Document architectural decisions for consistency

## Completed Architecture Analysis

✅ **All 49 files audited and dependency mapped** (43 original + 2 Phase 8.5 components + 4 Phase 11.0 components)

### Next Optimization Steps

1. **Identify circular dependencies** using tools or manual analysis
2. **Refactor violations** of the layered architecture
3. **Create dependency injection** for complex interdependencies
4. **Add ESLint rules** to prevent future violations
5. **Update development plan** with dependency documentation references

## Tools for Dependency Analysis

```bash
# Analyze imports/exports
npx madge --circular src/
npx dependency-cruiser src/

# Check for unused dependencies
npx depcheck

# ESLint dependency rules
npm install eslint-plugin-import
```

---

## 🎯 ARCHITECTURAL SUCCESS PATTERNS

**Reference Working Implementations:**
- **Company Management**: AdminCompanyManager.js + companyAPI pattern
- **Role Management**: AdminRoleManager.js + roleAPI pattern
- **User Authentication**: UserContext.js + Firebase integration
- **Data Fetching**: useAPI.js hook patterns
- **Error Handling**: Toast notification system

**Pattern Application Strategy:**
1. **Identify Similar Working Implementation**: Find component/hook/util with similar functionality
2. **Copy Proven Pattern**: Use same architectural approach
3. **Adapt for Specific Needs**: Modify data structures but keep same pattern
4. **Test with Real Data**: Verify with actual frontend-backend integration
5. **Document Pattern Choice**: Record why this pattern was selected

**Architecture Documentation References:**
- **DROPDOWN_CREATION_ISSUE_DEBRIEF.md**: Complete analysis of pattern consistency importance
- **APPSCRIPT_VERSION_EVOLUTION_ANALYSIS.md**: Technical deep-dive of architectural evolution
- **DEVELOPMENT_PLAN.md**: Integration with development process safeguards

---

**Status**: ✅ COMPLETE - Full dependency mapping with Phase 11.0 tag & collaboration system integration
**Last Updated**: October 18, 2026 - Phase 10.0 admin wiring (type create/edit routes, `?tab=`, API response unwrap); previously September 28, 2025 - Phase 11.0 component dependencies
**Next Update**: Backend integration and testing documentation