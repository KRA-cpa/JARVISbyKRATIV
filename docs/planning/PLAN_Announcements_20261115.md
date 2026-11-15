<!--
===============================================================================
JARVIS / DALOY by KRAtiv — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_Announcements_20261115.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 15 November 2026 UTC+8 (Philippine Standard Time) | Modified: 15 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Announcements to signed-in users - KRAtiv's maintenance / outage notices (A1, built) and a customer organization's own announcements (A2, server, plan feature) and the platform console (A3) | Status: A1 built (session 461f9ea9); A2 / A3 not built
REVISION HISTORY:
- v1.0.0 | 15 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 461f9ea9). User: "add user broadcast modal - for currently logged in users - or what is better if we announce maintenance or company needs to announce downtime", "for enterprise only?", "plan first", "modal forces user attention - but gets [in the way] if user is mid activity". Plan approved as proposed
===============================================================================
-->

# PLAN — Announcements to signed-in users

## Context
Two senders, one need: tell people who are **already signed in** (open tabs) about planned maintenance or downtime.
- **KRAtiv:** maintenance windows and outages - needed for the migration's write cutover (`PLAN_Migration_Unified`
  2.1 "announce the maintenance window", 2.2 "the app shows a maintenance banner").
- **A customer organization's admin → its own users:** "our ERP is down Friday", "approvals paused until 3 pm".

Security notices (`src/config/notices.js`) are baked into the app bundle: an open tab sees a new one only after a
reload. Announcements must reach open tabs, so they are read from outside the bundle.

## §1 Decisions (defaults, approved 15 Nov 2026)
1. **Banner at once + modal at a safe moment.** The banner never interrupts. The modal ("OK, got it" to close) opens
   only when the user is not mid-activity: no text field / select / editable area has focus, no API request is
   running, no element says it holds unsaved input (`data-unsaved="true"`). It opens at the first of: page load, a
   route change, the tab becoming visible, 30 seconds idle.
2. **Which get a modal:** maintenance and outage, once per stage per user - `notice` (announced), `soon` (15 minutes
   before: "save your work"), `live` (a read-only maintenance window in progress). A later stage's "got it" covers
   the earlier ones. Information: banner only.
3. **KRAtiv's announcements: every plan** (our service, not a sellable feature).
4. **An organization's announcements: Advanced** (`announcements`: one company-wide banner at a time, start / end)
   **and Enterprise** (`announcements_targeting`: by role / ticket type, scheduled, email copy, "require
   acknowledgement" → the same safe-moment modal). Basic: none. Veto → Enterprise only = one line in the catalogue.
5. The banner can be hidden until a maintenance window starts; in progress it comes back and stays.

## §2 A1 - KRAtiv's announcements (built 15 Nov 2026)
- **Source:** `public/announcements.json` on Firebase Hosting, served `no-cache` (`firebase.json`). The app re-reads
  it every 5 minutes and when the tab becomes visible (`src/hooks/useAnnouncements.js`); a failed read keeps the
  last list. It works while Cloud Run / Apps Script is down.
- **Publish:** edit the file, `firebase deploy --only hosting --project krativ-daloy` (no Cloud Run deploy) - deploy
  guide §I. Remove the entry (or let `endsAt` pass) to end it.
- **The file is public:** texts never name a customer; an entry for some organizations lists opaque company ids.
- **Entry:** `{ id, kind: maintenance | outage | info, title, message, startsAt, endsAt (null = until removed),
  showFrom (default startsAt − 3 days for maintenance, else startsAt), companyIds ([] = everyone), link (default
  /status), readOnly }` - times ISO **with an offset**; an entry that can't be read is skipped.
- **Where:** every signed-in page (`AnnouncementBanner` in `App.js` `WithNotices`, above the security notices);
  `/status` (entries for everyone); the sign-in page (entries for everyone, 15 minutes before and during).
- **Code:** `src/config/announcements.js` (rules), `src/hooks/useAnnouncements.js`, `src/hooks/useSafeMoment.js`
  (+ `requestsInFlight` in `src/api/googleSheet.js`), `src/components/shared/AnnouncementBanner.js`
  (+ `AnnouncementLines`), `AnnouncementModal.js`. Tests `src/config/announcements.test.js`,
  `src/hooks/useSafeMoment.test.js`. Previews show two samples (maintenance in 20 minutes, one information line).

Example entry (the maintenance window of migration step 2.2):
```json
{ "id": "MAINT-2026-12-01", "kind": "maintenance", "title": "Daloy moves to new servers in Singapore",
  "message": "Daloy will be read-only during the move. You can still view tickets.",
  "startsAt": "2026-12-01T21:00:00+08:00", "endsAt": "2026-12-01T23:00:00+08:00", "readOnly": true, "companyIds": [] }
```

## §3 A2 - an organization's announcements (migration Phase 4, server)
- Table `announcements`: id, company_id, kind, title, message, starts_at, ends_at, audience (JSON: roles / ticket
  types, Enterprise), require_ack, email_copy, created_by, ended_at, audit columns.
- Handlers on `/api/rpc`: `listMyAnnouncements` (the caller's companies and audience, active only; ≤ 2 queries,
  index `(company_id, ends_at)`), `saveAnnouncement`, `endAnnouncement` (company admin; gate `announcements` /
  `announcements_targeting`; admin audit row). Acknowledgements in `announcement_acks` (uid, announcement, stage, at)
  when `require_ack` - the admin sees who acknowledged.
- Admin → Announcements; `useAnnouncements` merges the server list with the file (same 5-minute read, one cheap query).
- Apps Script stays frozen: nothing here goes to Apps Script.

## §4 A3 - Platform manager (PM1, M9 "Health, incidents & announcements" - `PLAN_PlatformManager_20261106.md` v2.0.0)
KRAtiv edits its announcements on `/platform` (stored in the platform store, reason + audit row); the server writes
`announcements.json` or serves the same list; the file stays the break-glass while the server is down.

## §5 Checks
- Tests: phases at the edges, company scope, invalid entries skipped, hide-until-start, one modal per stage per user;
  `isBusy` (typing / request running / unsaved input → no modal).
- Preview: the samples on any signed-in page, `/status`, `/login`; the modal opens after load or 30 s idle, not while
  typing in a field.
