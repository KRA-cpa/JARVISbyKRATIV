<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: PLAN_Attachments_ClientDrive_20261109.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 9 November 2026 UTC+8 (Philippine Standard Time) | Modified: 9 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Ticket attachments uploaded into the client's own Google Workspace Drive (Shared Drive): connection options, on / off per organization and company, folder layout, file-name rules, attachment rules per ticket type, upload / download flows, legal | Status: Approved design (session 61523343), not built - unified migration plan Phase 4 step 4.7
REVISION HISTORY:
- v1.0.0 | 9 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (user: "plan attachments on google drive (client's google workspace acct)"; decisions D-A1 to D-A7 from the same session)
===============================================================================
-->

# PLAN — Attachments in the client's Google Workspace Drive

**Where it sits:** `docs/planning/PLAN_Migration_Unified_20261108.md` decision **D11**, schema reserved in step **0.7**,
built in Phase 4 step **4.7** (after the write cutover; Apps Script stays frozen, D6).

## §0 Today (from the code, 9 Nov 2026)
- **No upload anywhere.** Attachments are links only: `src/components/tickets/TicketLinksManager.js` (header: "no upload,
  no Drive permission"), Apps Script `addTicketAttachmentLink` (`APPSCRIPT_v10.2_20261101_0710.txt` :17451), https
  links only to Script Property `LINK_ALLOWED_HOSTS` (default `docs.google.com,drive.google.com`, :16857).
- `ticket_attachments` already has `file_name`, `file_url`, `file_size`, `file_type` (`'link'`), `link_status` +
  the broken-link report columns (§4.13 of `PLAN_FeatureGaps_Volume_20261031.md`).
- The **`file` custom field type** is a placeholder: `src/components/tickets/TicketForm.js:359` says "File upload isn't
  available yet"; file fields are left out of the payload and can't be required.
- **`require_attachment_on_create`** is saved on ticket types but **never checked** (`createTicket` ignores it).
- Sign-in asks Google for **no Drive permission** (`src/contexts/UserContext.js:387`, no `addScope`).
- The proxy and the Cloud Run server take **4.5 MB of JSON** per request (`server/app.js:23`); Firebase Hosting cuts a
  request at 60 s.
- The only Drive write today is `createConfigurationBackup` (`DriveApp.createFile` into the script owner's Drive).
- The bridge contract (`PLAN_ServerCore_OrgSheetBridge_20261101.md` §4) has no file actions ("Nothing else").

## §1 Decisions (user, 9 Nov 2026)
| # | Decision |
|---|---|
| D-A1 | **Two ways to connect**, chosen in admin settings: **option 1** - the client's admin signs in once with a **role account** and picks a Shared Drive folder (Daloy gets only `drive.file`); **option 2** - the client adds a **Daloy service account** as a member of its Shared Drive |
| D-A2 | **Daloy checks, then serves:** a file opens only through Daloy after the ticket rules (visibility, Restricted). Files are **not** shared in Drive with users |
| D-A3 | **No Workspace → links only.** Platform object storage (unified step 0.4) is **deferred** until a customer asks. Sheet-bridge organizations use the same Drive connection; the bridge stays unchanged |
| D-A4 | **Built in Phase 4 on the new server**, after the write cutover. Apps Script stays frozen (dedicated instances keep links) |
| D-A5 | **Turned on per organization and per company**, off by default (§2) |
| D-A6 | **Ticket type in the folder path** (§5) |
| D-A7 | **Several attachments per ticket type, set up in ticket type creation** - named slots, required / optional, counts, formats (§7) |
| Also | File-name length and special-character limits (user) → §6 |

## §2 On / off and settings (D-A5)
Two levels, **both off by default**:

| Level | Screen | Settings |
|---|---|---|
| Organization | Organization settings → **Files** | `drive_attachments_enabled` (on / off); `drive_mode` = `role_account` (option 1) \| `service_account` (option 2); the organization's **default connection**, shared by its companies |
| Company | Company settings → **Files** | `drive_setting` = `inherit` (default - follow the organization) \| `on_own_connection` (own option 1 / 2 connection, e.g. another Workspace or Shared Drive) \| `off` |

- **Effective rule:** a company can upload only if organization **on** AND company **not `off`** AND the plan has
  `drive_attachments` AND the effective connection is **`ok`**. One server helper, `driveSettingsFor(companyId)`, decides
  it for every upload / download action - **1 query** (organization + company + connection joined).
- Off → the Upload button is hidden; "Add link" stays. Switching off later blocks **new** uploads; existing files still
  download (they show `missing` only if the connection itself is disconnected).
- **Who may change it:** organization admins (organization level); company admins (company level, only while the
  organization is on); platform admins both. Every change writes an `admin_action_logs` row.
- **Screens:** on / off, the option 1 / option 2 picker with the set-up steps for each, Connect, **Test connection**
  (create + delete a probe file), Reconnect, Disconnect, status + item count. The company screen shows the same panel
  when *Own connection* is chosen.
- **Before organizations ship (Phase 5 O2+):** each company is its own organization of one (D9 default organization), so
  only the company screen shows.

## §3 The two connection options (D-A1)
| | **Option 1 - role-account OAuth** | **Option 2 - service-account member** |
|---|---|---|
| Client set-up | admin signs in as a **role account** (e.g. `daloy@client.com`), consents, picks the target folder in a Shared Drive with the Google **Picker** (Shared Drives enabled) | admin adds `daloy-org-<id>@jarvisbyerp.iam.gserviceaccount.com` to the Shared Drive as **Content manager**, then clicks Test |
| Google permission | `drive.file` only - Daloy sees only files it created or the folder picked; a **non-sensitive** scope (brand verification, no restricted-scope security assessment) | Shared Drive membership; no OAuth consent |
| Credential | refresh token, **encrypted** (AES-256-GCM; key in Secret Manager `daloy-drive-token-key`), in `drive_connections.token_ciphertext` | **no keys ever created** - the Cloud Run identity mints short tokens with IAM `generateAccessToken` (Service Account Token Creator on each per-organization service account) |
| Isolation | one token per connection | **one service account per organization** |
| What breaks it | role account suspended / password reset policy / token revoked → status `broken`, admins alerted | the member removed → `broken` |
| Client admin must allow | Daloy's OAuth client marked **Trusted** (onboarding guide §1.1 already asks) | Shared Drive setting **"allow people outside the organization"** - often blocked; then use option 1 |
| Quotas | none extra | ~100 service accounts per project by default - ask Google for more as customers grow |

Both options use the **same upload / download code**, because the server always opens the Drive session (§8).

## §4 Data model (Postgres; reserved in the Phase 0.7 first schema - no later migration)
- `organizations` + `drive_attachments_enabled` (bool, default false), `drive_mode`, `drive_connection_id`.
- `companies` + `drive_setting` (`inherit` | `on_own_connection` | `off`, default `inherit`), `drive_connection_id`.
- **`drive_connections`**: `id`, `organization_id`, `company_id` (null = organization level), `kind`
  (`oauth_role_account` | `service_account`), `connected_email`, `token_ciphertext` (option 1), `service_account_email`
  (option 2), `roots` (`jsonb` list of `{shared_drive_id, root_folder_id, item_count, active}` - §5 roll-over),
  `status` (`ok` | `broken` | `disconnected`), `last_checked_at`, audit columns.
- **`ticket_attachments`** + `storage` (`link` | `drive`), `slot_id` (null = Other), `drive_connection_id`,
  `root_folder_id`, `drive_file_id`, `display_name`, `drive_name` (§6), `md5`, `upload_status`
  (`pending` | `ok` | `missing` | `removed`); keeps `file_size`, `file_type`, `file_url` (links), the link-report columns.
  The data load (0.8) maps today's `file_name` → `display_name`, `storage='link'`.
- **`ticket_type_attachment_rules`**: `ticket_type_id`, `allow_attachments`, `max_files`, `max_mb`, `accepted_formats`.
- **`ticket_type_attachment_slots`**: `id`, `ticket_type_id`, `label`, `required_on_create`, `allow_multiple`,
  `max_files`, `accepted_formats`, `sort_order`, audit + soft-delete columns.
- **`workflow_step_required_slots`**: `step_id`, `slot_id`, `company_id`.
- Indexes: `ticket_attachments (ticket_id, upload_status)`, `(upload_status, created_at)` for the clean-up job.

## §5 Folder layout (D-A6)
```
<Shared Drive root>/
  <COMPANYCODE>/                      e.g. MYCO
    <TYPECODE>/                       e.g. PR
      <YYYY>/                         e.g. 2026
        <ticket_number>/              e.g. MYCO-PR-2026-00000123
          Invoice - acme_inv_552.pdf
          Quotation - q1.pdf
          Other - photo.jpg
    _removed/<ticket_number>/         soft-removed files (Daloy never deletes)
```
- **Derived from the ticket number, never from live settings.** Company, type and year are read from
  `COMPANYCODE-TYPECODE-YEAR-SEQUENCE`, so a ticket's folder never moves: the company code locks after the first ticket,
  a later ticket-type code change affects only new tickets, the year is the company's calendar year at create time.
- **Codes, not names** - renaming "Purchase Request" leaves no stale folder; each folder's Drive description holds the
  full name for people browsing.
- **Year level** keeps any folder to a few thousand children (the Drive web UI stays fast), lets the client archive / set
  retention per year, and lets auditors find a ticket by type and year.
- **One folder per ticket**, created **at the first upload only** (tickets without files use no Drive items): an auditor
  can be sent one folder; a ticket's files are one list call.
- **No slot sub-folders** - the slot label prefixes the file name (§6) to save Drive items.
- **Drive limit: a Shared Drive holds at most 400,000 items** (files + folders; verify in S1). The connection keeps a
  running `item_count` and warns admins at **80 %**. **Roll-over:** the admin adds a new root (new Shared Drive) to the
  connection; new tickets go there; older files stay readable because each attachment row stores its
  `drive_connection_id` + `root_folder_id`.
- Drive `appProperties`: files carry `daloy_attachment_id`, `daloy_ticket_id`, `daloy_ticket_type_id`, `daloy_slot_id`;
  folders carry `daloy_ticket_id`.

## §6 File-name rules (length and special characters)
Drive accepts almost any name, but people download files, sync them with Drive for desktop on Windows / macOS and export
them in reports. Each file keeps **two names**:
- **`display_name`** - the original, cleaned for display (rules 1–3), **≤ 200 characters** (today's link-name cap,
  `linkInputError`). Shown in Daloy.
- **`drive_name`** - a safe name for Drive and the user's computer (all rules), made once at `startAttachmentUpload`,
  never changed.

One server function, **`safeFileName(original, slotLabel, mime)`** in `server/lib/fileNames.js`, with unit tests; the
browser runs the same rules for a preview only - the server's result counts.

1. **Unicode:** NFC; drop control characters U+0000–U+001F, U+007F–U+009F.
2. **Spoofing:** drop bidi overrides / isolates U+202A–U+202E, U+2066–U+2069, zero-width U+200B–U+200D, U+FEFF and other
   invisible characters (otherwise `invoice‮fdp.exe` shows as `invoiceexe.pdf`).
3. **Whitespace:** runs (tab, NBSP included) → one space; trim.
4. **Windows-forbidden** `\ / : * ? " < > |` → `_`; trim trailing dots and spaces; drop a leading dot (hidden file).
5. **Windows-reserved names** `CON PRN AUX NUL COM1–9 LPT1–9` (any case, with or without extension) → `_` prefix.
6. **Extension:** the **last** extension, lower-cased, must be in the type's / slot's accepted formats **and** match the
   declared MIME - `invoice.pdf.exe` is judged as `.exe` and refused. No extension → added from the MIME. At
   `finishAttachmentUpload` the server reads the first 4 KB (Drive `Range`) and checks the **magic bytes** (PDF `%PDF`,
   PNG, JPEG, ZIP-based Office, …); a mismatch → file moved to `_removed`, upload refused.
7. **Length:** `drive_name` = `<Slot> - <stem>.<ext>`, **≤ 120 characters**; slot labels ≤ 40 (enforced in set-up); a long
   stem is cut **in the middle** with `…` (start and end stay readable); the extension is never cut. Path budget: Shared
   Drive name + `MYCO/PR/2026/MYCO-PR-2026-00000123/` (~36) + 120 ≈ 200 - under Windows `MAX_PATH` 260 for Drive for
   desktop sync, **if** the Shared Drive name is ≤ 40 characters (the connect screen checks and warns).
8. **Clashes:** compared **case-insensitively** (Windows / macOS sync are) → `… (2).pdf`, `… (3).pdf`.
9. **Empty after cleaning** → `file.<ext>`.
10. **Folder names:** company / type codes and ticket numbers should already be `[A-Z0-9-]` - **check in S2**; if not, they
    go through rules 1–5 too.
11. **Slot labels:** rules 1–5 on save, ≤ 40 characters, unique per ticket type (case-insensitive).
12. **Where the name is used:**
    - download header `Content-Disposition: attachment; filename="<ASCII fallback>"; filename*=UTF-8''<percent-encoded>`
      (RFC 6266 / 5987), CR / LF / `"` removed first (no header injection);
    - emails and notifications: HTML-escaped;
    - CSV / report export: a name starting with `= + - @`, tab or CR gets a `'` prefix (no formula injection).

## §7 Attachment rules per ticket type (D-A7; set up when creating / editing a ticket type)
A new **Attachments** section on `AdminTicketTypeCreatePage` / `AdminTicketTypeManager` replaces the lone "Require
attachment on creation" checkbox:
- **Allow attachments** (on / off), **max files per ticket** (default 10, ≤ plan cap), **max file size** (≤ the tier's
  `attachment_max_mb`), **accepted formats** (a subset of the platform allow-list, §11).
- **Slots** - named kinds such as "Invoice", "Quotation", "Signed form", each with: label; required at create (yes / no);
  allow multiple (yes / no) + max files in the slot; accepted formats (optional, narrower than the type's); sort order.
- **"Other"** - always allowed while attachments are on, for files that fit no slot.
- **Step requirements** - the workflow step editor (per company; workflows are per company) can mark slots *"required
  before this step can be approved"*.
- **Links count.** A Drive / Docs link can fill a slot - companies without Drive uploads can meet the rules, and §7 is
  useful before Drive is on (it can ship first, S6).
- **Checked on the server**, at create (required slots) and at approve (step-required slots); the error names the
  missing slots. Slots belong to the (shared) ticket type; only step requirements are per company.
- **Carried over:** `require_attachment_on_create = true` → *at least one file or link in any slot at create* when the
  data moves to Postgres.
- **The `file` custom field type** becomes a shortcut that creates a one-file slot - one mechanism, not two.

## §8 Upload flow (browser → Google direct; the 4.5 MB / 60 s limits don't apply)
1. **`startAttachmentUpload { ticket_id, slot_id?, file_name, size, mime }`**
   - `driveSettingsFor` (§2) must allow it;
   - who: the `canManageTicketLinks` rule (requester, current approver, admin; closed ticket → admin only);
   - the ticket type's rules (§7): attachments on, the slot exists and has room, format, size, max files per ticket;
     plan limits; the platform MIME allow-list;
   - `safeFileName` (§6); create the ticket folder if missing (§5);
   - open a Drive **resumable upload session** (`uploadType=resumable`, `supportsAllDrives=true`, the app's `Origin`,
     `appProperties`), write a `pending` row, return `{ upload_id, session_uri }`.
   - Query budget: ≤ 6 (settings, ticket + permission, rules + slot counts, insert) - one transaction for the row.
2. **The browser PUTs the bytes** to `session_uri` in 8 MB chunks and resumes after a failure.
3. **`finishAttachmentUpload { upload_id, drive_file_id }`** - read the Drive metadata: parent = the ticket folder, size,
   MIME, `appProperties.daloy_attachment_id` = this row; magic bytes (§6 rule 6). Only then the row → `ok`, plus a
   ticket history + action log entry and the item count + 1.
4. **Clean-up** - a Cloud Scheduler job removes `pending` rows older than 24 h and their Drive files; safe to re-run (A19).
- **On the create form**, files go up right after the ticket is created (the folder needs the ticket number); if a
  required slot fails, the user is told to retry - the ticket is not lost.

## §9 Download flow (D-A2)
- **`getAttachmentDownload { attachment_id }`** - session + `canViewTicket === 'full'` + the Restricted rules → a
  **5-minute signed link** (HMAC over user + attachment + expiry) to the Cloud Run **`run.app`** URL (skips the Firebase
  Hosting 60 s cut on big files).
- **`GET /files/:token`** streams from Drive (`alt=media`, `supportsAllDrives`) with `Content-Disposition: attachment`
  (§6 rule 12), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: no-store`.
- Drive 404 / 403 → the row becomes **`missing`** and the existing broken-link notice goes to the uploader and the
  requester (v9.6 bell).
- Native Google Docs / Sheets stay **links** (they have no raw bytes to stream).

## §10 Remove
Soft delete in Daloy (`upload_status = 'removed'`, history entry). The Drive file moves to
`<root>/<COMPANYCODE>/_removed/<ticket_number>/` and Daloy **never deletes** it - retention is the client's call.
Removing a file from a required slot is refused while the ticket is at or past the point where the slot is required.

## §11 Limits and the plan catalogue
- `drive_attachments` on **every tier** (the client pays for the storage).
- Proposed **`attachment_max_mb`**: Basic 10 · Advanced 25 · Enterprise 100 (`PLAN_PlanTiers_Subscriptions_20261031.md` §2).
- Platform MIME allow-list: PDF, PNG / JPEG / GIF / WebP / HEIC, Word / Excel / PowerPoint (OOXML + legacy), CSV, TXT.
  Executables, scripts, archives and HTML / SVG are blocked.
- **Malware:** Daloy runs no scanner of its own. Google Drive scans files under its size limit and refuses flagged files on
  download unless `acknowledgeAbuse` is set - **Daloy never sets it** (verify in S1). Known gap, listed in Risks.

## §12 Frontend
- `TicketLinksManager` → **Attachments**: grouped by slot (required ones marked), **Upload file** beside **Add link**,
  progress + retry, `missing` / reported states.
- `TicketForm`: the type's slots with upload or link per slot (§8 last point).
- Ticket type create / edit: the **Attachments** section (§7); workflow step editor: *required slots before approval*.
- Organization + Company **Files** settings screens (§2).
- The `file` custom field = a one-file slot (§7).
- `API.Attachments` gains `startUpload`, `finishUpload`, `getDownload`; settings / connection methods under the company /
  organization APIs; `npm run check:api-contract` + `check:code-rules` entries come with the `/api/rpc` handlers.

## §13 The other storage options (unified plan §2)
- **Sheet-bridge organizations:** the same server-side Drive connection; attachment rows go through the storage adapter;
  the bridge contract is unchanged.
- **Dedicated Apps Script instances** (frozen): links only.
- **No Workspace:** links only (D-A3).

## §14 Legal (drafts in unified step 0.10, published in 3.1)
- **Privacy Policy:** what Google data Daloy uses and why (file metadata + the files it uploads; the role account's email),
  plus Google's **"Limited Use"** statement required by the Google API Services User Data Policy.
- **DPA:** files are stored in the **customer's own Google Workspace**; Google is the customer's own provider, not Daloy's
  sub-processor; Daloy passes file bytes through Cloud Run Singapore on download and **stores none**; the Asia rule (D1)
  does not apply - the customer's choice, worded like the Sheets option.
- **Terms:** on disconnect or offboarding the files stay with the customer; Daloy is not responsible for files changed or
  deleted in Drive outside Daloy.
- `PLAN_PrivacyPolicy_DPA_20261101.md` data table row "Attachment links" → "Attachments" (v1.2.0).

## §15 Cost
No storage cost for Daloy. Downloads leave Cloud Run as egress (price **UNVERIFIED**, `CHECK_HostingPricing_20261108.md`
§6 / unified 0.2). Secret Manager (one key) and the one extra Scheduler job: negligible (the clean-up can share the nightly
job to stay within the 3 free jobs).

## §16 Build steps (unified Phase 4 step 4.7; owner, gate)
| Step | Owner | What | Gate |
|---|---|---|---|
| **S1 spike** | Claude + You (a test Workspace / Shared Drive) | browser CORS on the resumable session URI; `drive.file` + Picker writing into a Shared Drive folder; service-account impersonation into a Shared Drive; the 400k limit and the `acknowledgeAbuse` behaviour | all work - or this doc is updated first |
| S2 | Claude | schema use, `drive_connections` handlers, `driveSettingsFor`, check the code / number character set (§6 rule 10) | handler tests pass |
| S3 | Claude → You test | organization + company **Files** screens (on / off, option 1 / 2, connect, test, reconnect, disconnect) | both options connect on the test Workspace |
| S4 | Claude | upload / finish / clean-up + `safeFileName` with unit tests for every §6 rule (RTLO, `CON.pdf`, `a.pdf.exe`, a 300-character name, emoji, case clashes, `=cmd` in CSV, CR / LF in the header) | tests pass; a 50 MB file uploads on a phone connection with one resume |
| S5 | Claude | download + `missing` handling | Restricted ticket file refused to an outsider; link expires after 5 min |
| S6 | Claude | attachment rules + slots per ticket type, step requirements, checks at create / approve, `file` field as a slot, the old flag carried over (works for links before Drive is on - may ship first) | rules enforced on the server |
| S7 | Claude drafts, You approve | legal text (§14), onboarding guide §7 | approved |
| S8 | Claude | server tests (`scripts/test-cloudrun-server.js` style, fake Drive), `Claude.md` non-functional targets | p95 / query budgets met |

## §17 Risks
- Refresh-token loss when the role account changes (option 1) → status `broken`, alerts, Reconnect.
- Outside members blocked by the client's Workspace policy (option 2) → use option 1.
- The client deletes / moves files in Drive → `missing` + notice.
- Service-account quota per project (option 2).
- No Daloy-side malware scan (§11).
- Large downloads cost egress (§15).
- Drive for desktop paths over 260 characters if the Shared Drive name is long (§6 rule 7).
