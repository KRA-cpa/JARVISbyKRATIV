# SLA Implementation Documentation

**Date**: September 27, 2025 - 🚀 **USER/ROLE SYSTEM INTEGRATION UPDATE**
**Version**: 2.1
**Status**: Phase 5 Complete + Universal Entity SLA Integration Ready

## 🚨 MANDATORY SLA RESOLUTION RULE

### FUNDAMENTAL RESOLUTION PRINCIPLE FOR ALL SLA ISSUES:

**1. SIMPLEST FIRST APPROACH:**
- **1st Resolution**: Always use simplest SLA solution (copy working SLA implementation)
- **Complexity Gate**: Only add SLA complexity if simple calculation clearly inadequate
- **Pattern Priority**: Use proven working SLA patterns from successful implementations

**2. SLA DOMAIN INTEGRATION WITH SYSTEM DOMAINS:**
- **Frontend SLA**: Use working SLA widget patterns from SLAWidgets.js
- **API SLA**: Use working SLA hooks from useAPI.js (useSLAStatus, useWorkflowStepSLA)
- **AppScript SLA**: Use working SLA calculation functions from backend
- **Schema SLA**: Use working step_slas table structure and relationships
- **🚀 NEW: Universal Entity SLA**: SLA calculations work for tickets, user profiles, and roles using same tables/fields with entity_category

**3. SLA WORKING PATTERNS:**
- **Reference**: slaCalculator.js (proven UTC+8 calculations)
- **Reference**: SLAWidgets.js (working dashboard components)
- **Reference**: AdminWorkflowBuilder.js (working SLA configuration)

**BEFORE ANY SLA CHANGES**: Apply Fundamental Resolution Rule from RESOLUTION_CHECKLIST.md

---

## Overview

This document tracks the implementation of Service Level Agreement (SLA) functionality for the JarvisByERP Ticketing & Workflow Orchestration System.

## Implementation Progress

### ✅ Phase 1: SLA Calculator Foundation (COMPLETED)

**File Created**: `src/utils/slaCalculator.js`

**Core Features Implemented:**
- SLA due date calculations with Philippine timezone (UTC+8) support
- Weekend exclusion logic for business days only
- Business hours support (8 AM - 5 PM configurable)
- SLA status determination: "On Time", "Due Today", "Overdue", "No SLA"
- Human-readable duration formatting
- Date formatting utilities for Philippine timezone

**Key Functions:**
- `calculateSLADueDate(startDate, duration, unit, excludeWeekends, businessHoursOnly)`
- `getSLAStatus(dueDate, currentDate)` - Returns status object with urgency levels
- `updateTicketDueDate(ticket, newStep, transitionTime)` - For workflow transitions
- `formatDatePhilippine(date)` - Timezone-aware date formatting

**Business Rules Implemented:**
- Hours-based SLA: Supports business hours and weekend exclusions
- Days-based SLA: Automatic weekend skipping when configured
- Urgency levels: 0=No SLA, 1=On Time, 2=Due Today, 3=Overdue
- Color coding: Gray/Green/Yellow/Red for status indicators

**Dependencies:**
- ✅ `date-fns: ^4.1.0` (timezone, calculations, formatting)
- ✅ `date-fns-tz` (Philippine timezone support)

### ✅ Phase 2: API Integration (COMPLETED)

**Files Updated:**
- `src/hooks/useAPI.js` - Added 5 SLA-specific hooks:
  - `useSLAStatus(ticketId)` - Real-time SLA status for individual tickets
  - `useWorkflowStepSLA(stepId)` - SLA configuration for workflow steps
  - `useTicketDueDates(ticketTypeId)` - Due date tracking for ticket types
  - `useSLAOverdueTickets()` - System-wide overdue ticket monitoring
  - `useSLADueTodayTickets()` - Today's due tickets for dashboard alerts

**Integration Features:**
- Client-side SLA calculations for performance
- Real-time status updates (30-60 second intervals)
- Caching strategies for optimal performance
- Dynamic imports to reduce bundle size

### ✅ Phase 3: Admin Configuration (COMPLETED)

**Files Created:**
- `src/components/admin/AdminWorkflowBuilder.js` - Complete workflow step configuration with SLA settings

**Admin Features Implemented:**
- Ticket type selection and workflow step management
- SLA duration and unit configuration (hours/days)
- Weekend exclusion settings for business days only
- Step types: Approval, Task, External integration
- Approver role assignments with any/all logic
- Step ordering and status configuration
- Real-time SLA display in step listings

### ✅ Phase 4: Dashboard Integration (COMPLETED)

**Files Updated:**
- `src/components/tickets/TicketDashboard.js` - SLA status badges and filtering
- `src/components/tickets/TicketDetail.js` - Detailed SLA information display

**Dashboard Features:**
- Color-coded SLA status badges: 🟢 On Time, 🟡 Due Today, 🔴 Overdue, ⚫ No SLA
- SLA status filtering in ticket dashboard
- Real-time SLA calculations with Philippine timezone support
- Due date display with business rules indication
- Step SLA configuration visibility in ticket details

### ✅ Phase 5: Advanced SLA Features (COMPLETED)

**Files Created:**
- `src/components/shared/SLAWidgets.js` - Comprehensive SLA dashboard widgets
- `src/components/shared/ConfirmationModal.js` - Modal dialog system for user interactions

**Files Updated:**
- `src/pages/DashboardPage.js` - Complete SLA dashboard integration with modal system
- `src/components/admin/AdminWorkflowBuilder.js` - Enhanced with SLA testing and validation

**Advanced Features Implemented:**
- **SLA Dashboard Widgets**: Overdue tickets, due today tickets, performance summary cards
- **Detailed SLA Metrics**: Compliance percentage, average overdue time, action alerts
- **Modal Dialog System**: Replaced all browser alerts with accessible modal dialogs
- **SLA Simulation**: Test SLA configurations with validation and error handling
- **Real-time Monitoring**: Auto-refreshing SLA status with 30-60 second intervals
- **Error Resilience**: Comprehensive error handling with user-friendly messages
- **Performance Analytics**: SLA compliance tracking and trend indicators

### ✅ Phase 5.2: SLA Escalation — server-side (AppScript v9.5, 30 Oct 2026)

> **Correction:** the escalation work marked "Phase 6 COMPLETED" before v9.5 was a browser-only mock - hard-coded rules (`DEFAULT_ESCALATION_RULES`), `setTimeout` "saves", an engine running in every open dashboard, nothing stored, and the +8 h shift applied again (`toPhilippineTime`). It is replaced as below. Plan: `docs/planning/PLAN_SLAEscalation_20261030.md` v1.1.

- **Rules** (`sla_escalation_rules`): levels per company + ticket type + step (blank step = every step; a step rule wins at the same level). Trigger `percent_elapsed` / `before_due` / `after_due` with a value and unit (minutes, hours, days, business hours, business days). `escalation_action`: `notify` or `escalate_role`. Recipients: current approvers, requester, roles, email addresses.
- **Run** (`runSLAEscalations`): a 15-minute Apps Script trigger. One read per tab, `tryLock` skip when busy, at most 200 notices per run. Each level fires **once per visit** of a step (`sla_escalation_events`, key ticket + step + visit + rule); a return or reopen starts a new visit. Several levels due at once → one notice per person for the highest.
- **escalate_role**: holders of the role may approve / reject / return the step for that visit; their approval completes an `all` step (history `APPROVED` with `field_changes.escalated`); the ticket shows in their approval inbox.
- **Notifications** (`notifications`): the header bell (`useNotifications`), the dashboard's SLA Monitoring card, ticket → History → SLA escalations. Email: per ticket type `sla_email` (default / on / off) + global `SLA_EMAIL_DEFAULT`, and the user's `email_notifications`; one digest per address per run; skipped below a quota reserve of 10.
- **Due dates (decision D4)**: a live company SLA rule whose `step_name` matches the step wins over the step SLA (`stepDueDateFor`), with business hours, business days (0 = Sunday ... 6 = Saturday) and `company_holidays` when it excludes holidays. `calculateSLADueDate` now skips **Manila** weekends.
- **Time (compliance A17)**: stored in real UTC; Manila only through `Utilities.formatDate(…, 'Asia/Manila', …)` and `phDay`. The frontend shows times with `Intl` (F3). `src/utils/slaCalculator.js` still uses `toPhilippineTime` for the SLA widgets - known gap (`scripts/code-rules-known-gaps.txt`, F3), to be fixed next.
- **Admin**: Admin → SLA Escalations (Rules, Holidays incl. Philippine holidays per year, Email). Editor: `installSLAEscalationTrigger()`, `runSLAEscalationsDryRun()`, `migrateCompanyEscalationsToRules()` / `…Apply()`.

## Technical Specifications

### SLA Data Structure

**Workflow Step SLA Configuration:**
```javascript
{
  sla_duration: 24,           // Number: 1, 2, 8, 24, etc.
  sla_unit: 'hours',          // String: 'hours' or 'days'
  exclude_weekends: true,     // Boolean: Skip Sat/Sun
  business_hours_only: false  // Boolean: 8 AM - 5 PM only
}
```

**SLA Status Object:**
```javascript
{
  type: 'due_today',         // 'no_sla', 'on_time', 'due_today', 'overdue'
  label: 'Due in 4 hours',   // Human-readable description
  color: 'yellow',           // UI color: 'gray', 'green', 'yellow', 'red'
  urgency: 2,                // Priority level: 0-3
  isOverdue: false,          // Boolean flags for quick checks
  isDueToday: true,
  hoursUntilDue: 4           // Additional time information
}
```

### Database Schema Integration

**Existing Schema Support:**
- ✅ `step_slas` table: `step_id`, `duration`, `unit`, `exclude_weekends`
- ✅ `tickets.step_due_date` field for storing calculated due dates
- ✅ Backend API supports SLA parameters in workflow step creation

**Required API Enhancements:**
- `calculateStepDueDate` endpoint for real-time calculations
- `getSLAStatus` endpoint for dashboard status checks
- Workflow transition hooks to update due dates

## Business Rules Documentation

### Philippine Timezone (UTC+8)
- All SLA calculations use Asia/Manila timezone
- Business hours: 8:00 AM to 5:00 PM
- Weekend exclusions: Saturday and Sunday

### SLA Calculation Logic

**Hours-Based SLA:**
- Simple hours: Add duration directly to start time
- Business hours: Only count 8 AM - 5 PM weekdays
- Weekend exclusion: Skip to next Monday if due falls on weekend

**Days-Based SLA:**
- Calendar days: Include all days in calculation
- Business days: Exclude weekends from count
- Due time: Maintains original time of day

### Status Determination

**SLA Status Rules:**
1. **No SLA**: Step has no `sla_duration` configured
2. **On Time**: Due date is more than 1 day in future
3. **Due Today**: Due date falls within current Philippine day
4. **Overdue**: Current time has passed due date

## Usage Examples

### Basic SLA Calculation
```javascript
import { calculateSLADueDate, getSLAStatus } from '../utils/slaCalculator';

// Calculate due date for 24-hour SLA starting now
const dueDate = calculateSLADueDate(new Date(), 24, 'hours', true);

// Get current status
const status = getSLAStatus(dueDate);
console.log(status.label); // "Due in 1 day"
```

### Workflow Integration
```javascript
import SLACalculator from '../utils/slaCalculator';

// When ticket moves to new step
const newDueDate = SLACalculator.updateTicketDueDate(
  currentTicket,
  newWorkflowStep,
  new Date()
);
```

### UI Display
```javascript
import { getSLAStatus, formatDatePhilippine } from '../utils/slaCalculator';

// Get status for display
const slaStatus = getSLAStatus(ticket.step_due_date);

return (
  <span className={`badge badge-${slaStatus.color}`}>
    {slaStatus.label}
  </span>
);
```

## Integration Points

### API Layer (`src/api/googleSheet.js`)
- ✅ `WorkflowStepsAPI` supports SLA parameters
- 🚧 Need SLA calculation endpoints
- 🚧 Need workflow transition hooks

### Hooks Layer (`src/hooks/useAPI.js`)
- 🚧 `useSLAStatus(ticketId)` hook needed
- 🚧 `useWorkflowStepSLA(stepId)` hook needed
- 🚧 `useTicketDueDates(ticketTypeId)` hook needed

### Component Layer
- 🚧 Admin workflow builder components
- 🚧 Dashboard SLA status displays
- 🚧 Ticket detail SLA information

## Testing Strategy

### Unit Tests Required
- SLA calculation accuracy (various scenarios)
- Timezone handling (Philippine time)
- Weekend exclusion logic
- Business hours calculations
- Status determination logic

### Integration Tests Required
- API endpoint responses
- Workflow step transitions
- Database due date updates
- UI component rendering

## Performance Considerations

### Caching Strategy
- SLA configurations cached per workflow step
- Due date calculations cached until step changes
- Status calculations performed client-side for responsiveness

### Optimization Opportunities
- Batch SLA status calculations for dashboard
- Precompute due dates for active tickets
- Use memoization for expensive calculations

## Future Enhancements

### ✅ Phase 6: SLA Escalation and Automation (COMPLETED)

**Files Created:**
- `src/utils/slaEscalation.js` - Complete SLA escalation engine with rule processing
- `src/components/admin/AdminSLAEscalationManager.js` - Admin interface for escalation rules
- `src/components/shared/SLANotificationSystem.js` - Real-time notification monitoring

**Files Updated:**
- `src/hooks/useAPI.js` - Added escalation hooks: `useSLAEscalationRules`, `useSLAEscalationMutations`, `useSLANotificationMonitor`

**Escalation Features Implemented:**
- **Escalation Rules Engine**: Configurable triggers (percentage, hours before/overdue, due today)
- **Multiple Action Types**: Notifications, reassignments, step escalations, auto-approvals, manager alerts
- **Real-time Monitoring**: Background SLA monitoring with 5-minute check intervals
- **Rule Configuration UI**: Complete admin interface for creating/editing/testing escalation rules
- **Notification System**: Toast notifications with priority levels (critical, high, medium, low)
- **Validation & Testing**: Rule validation and simulation capabilities
- **Default Templates**: Pre-configured escalation rules for common scenarios

### Phase 7: Enterprise Features
- Custom business hours per company
- Holiday exclusions (Philippine holidays)
- Multiple timezone support
- Complex approval chains with individual SLAs
- SLA inheritance and cascading rules
- Integration with external calendar systems

## Maintenance Notes

### Version History
- **v1.0** (Sept 20, 2025): Initial SLA calculator implementation
- **Future**: API integration, UI components, advanced features

### Breaking Changes
- None yet - initial implementation

### Dependencies
- Requires `date-fns` and `date-fns-tz` packages
- Philippine timezone data must be available
- Backend API must support SLA parameters

---

**Next Implementation Session**: Add SLA hooks to `useAPI.js` and integrate with workflow transitions.