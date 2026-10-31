<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_Testing_SwitchRoles.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 31 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Give yourself admin access and test the app as different roles alone (no testers), with the deployed v9.6 flow - no extra code | Status: Active (temporary setup until real testers exist)
REVISION HISTORY:
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (cloud session 017zmKf7): admin access, placeholder admin, switching roles on your own account, clean-up
===============================================================================
-->

# GUIDE — Admin access and testing by switching roles

> **Needs:** AppScript v9.6 live (`?action=ping` → `9.6.0`) and the **JARVIS Admin** menu v1.1 (`ADMIN_Tools_v1.1_20261031_1526.txt`, deploy guide §0a).
> **Idea:** you always sign in with Google as yourself; the server checks the roles *your* uid holds right now. To test as a manager, a finance approver or a plain requester, you give yourself that role, test, then take it away. This is the real v9.6 permission flow - nothing is faked.

---

## §1 Give yourself admin (once)

1. **Your uid.** Firebase console → your project → **Authentication → Users** → the row with your Google email → copy **User UID**.
   (If you could already sign in to the app, JARVIS Admin → **4. Users & access → Recent sign-ins** shows it too.)
2. **Make yourself admin.** Google Sheet → **JARVIS Admin → 4. Users & access → Make a user admin** → paste the uid → company code (blank = the first company) → **Yes**.
   - It uses the first active role whose name contains "admin", or creates **System Admin** when there is none.
3. **Your profile row** (so you appear in Admin → Users and can open your own Roles). In the Sheet, tab `user_profiles`, add one row:

   | user_id | display_name | email | status | is_active |
   |---|---|---|---|---|
   | *your uid* | *your name* | *your Google email* | `active` | `TRUE` |

   Leave the other columns blank.
4. **Check.** JARVIS Admin → **Status** → `Admins: 1 (<your uid>)`. In the app: sign out, sign in → the **Admin** menu shows.

## §2 Placeholder admin (keeps the doors shut while you test as a non-admin)

While **no** admin assignment is in force, v9.6 opens the *bootstrap*: every signed-in user may use admin actions, and the sign-in allow-list is skipped. So if you end your own admin role to test as a normal user, the server would still let admin actions through - the test would lie.

Fix, once: **JARVIS Admin → Make a user admin** with the uid **`placeholder_admin`**. No Google account can ever have that uid, so nobody can sign in as it; it only keeps one admin assignment in force. Status then shows `Admins: 2`.

## §3 Switch roles on your own account

1. App → **Admin → Users** → your row → **Roles**.
2. **Assign role**: the role (e.g. *Manager*), the company, optionally one ticket type, type **Temporary** with an end date (today or tomorrow - it ends by itself), notes `TEST`. Save.
3. **Reload the app** (Ctrl+F5) so the screens pick up the new roles. The server uses them at once.
4. Test (see §5). Then **Roles → Remove** the `TEST` assignment, or let it expire.

Several roles can be held at the same time (e.g. requester + manager to walk one ticket through two steps). v9.6 lets the requester approve their own ticket, so one person can drive a ticket from creation to completion.

## §4 Test as a non-admin

Admin powers hide permission gaps: an admin can cancel / reopen any ticket, manage links on any ticket, see every report row and the audit log. To see what a normal user sees:

1. Make sure §2 is done (placeholder admin in force).
2. **Admin → Users → your row → Roles → Remove** your admin assignment. Keep a `TEST` role you want to test.
3. Reload → the Admin menu is gone; admin actions answer *"Only admins can …"*.
4. **Back to admin:** Google Sheet → **JARVIS Admin → Make a user admin** → your uid. (Admin → Users isn't reachable while you aren't admin - the Sheet menu is the way back.)

## §5 What to check per role

| As | Try | Expected |
|---|---|---|
| Requester only | create a ticket; add a link on it; cancel it | all allowed |
| Requester only | open Admin, approve the ticket | no Admin menu; not an approver of the step |
| Approver of the step (e.g. Manager) | approve / return / reject; add or fix a link | allowed while the ticket is at that step |
| Approver of a later step | approve the ticket at an earlier step | not allowed |
| Anyone in the company | **Report broken** on a link | allowed; the requester and the person who added it get a bell |
| Admin | invite a user; company email + test email; audit log | allowed |
| A Google account with no profile (private window) | sign in | *"Your account isn't set up yet. Ask your administrator for an invite."* |

## §6 Clean up (when real testers arrive)

1. Remove every `TEST` role assignment (Admin → Users → Roles).
2. Make at least one **real** second admin (JARVIS Admin → Make a user admin with their uid, or invite them with the admin role).
3. Only then end `placeholder_admin`: Sheet tab `user_role_assignments` → its row → `is_active` = `FALSE`, `deleted_at` = today. (Ending it while you are the only other admin is fine too; ending it when it is the *only* admin opens the bootstrap again.)

## §7 Limits

- One person at a time: you can't see the requester's and the approver's screens side by side. For that, use a second free Gmail account and **Admin → Users → Invite** it - the real onboarding flow.
- Records you create while holding a test role name **you** (requester, approver, history). Fine for testing; delete the test tickets' data or keep them clearly titled ("TEST - …").
