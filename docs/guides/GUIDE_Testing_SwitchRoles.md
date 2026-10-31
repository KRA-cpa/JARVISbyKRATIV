<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: GUIDE_Testing_SwitchRoles.md | Author: Kenneth R. Advento | Version: 1.1.0
Created: 31 October 2026 UTC+8 (Philippine Standard Time) | Modified: 31 October 2026 UTC+8 (Philippine Standard Time)
Purpose: Give yourself admin access and test the app as different roles alone (no testers), with the deployed v9.6 flow - no extra code | Status: Active (temporary setup until real testers exist)
REVISION HISTORY:
- v1.0.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (cloud session 017zmKf7): admin access, placeholder admin, switching roles on your own account, clean-up
- v1.1.0 | 31 October 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Every step is a menu item now: JARVIS Admin v1.2 "5. Testing (temporary)"; manual Sheet steps kept as a fallback
===============================================================================
-->

# GUIDE — Admin access and testing by switching roles

> **Needs:** AppScript v9.6 live (`?action=ping` → `9.6.0`) and the **JARVIS Admin** menu **v1.2**: Apps Script editor → the `admin` script file → paste `appscript_files/ADMIN_Tools_v1.2_20261031_1609.txt` over it → Save → reload the Sheet. No web-app redeploy: the menu runs in the Sheet, and the main v9.6 file is unchanged.
> **Idea:** you always sign in with Google as yourself; the server checks the roles *your* uid holds right now. To test as a manager, a finance approver or a plain requester, you give yourself that role, test, then take it away. This is the real v9.6 permission flow - nothing is faked.
> Everything below is in **JARVIS Admin → 5. Testing (temporary)**. Every item that writes shows what it will do and asks first.

---

## §1 Give yourself admin (once) - **Set up my admin access...**

1. Have your **uid** ready: Firebase console → your project → **Authentication → Users** → the row with your Google email → **User UID**. (Or **4. Users & access → Recent sign-ins**, if you could already sign in.)
2. **5. Testing → Set up my admin access...** → paste the uid → (company code if you have several) → your *Name, email* → **Yes**. It:
   - remembers your uid (Script Property `TEST_MY_UID`), so the other items don't ask again,
   - gives you the admin role (the first admin-named role, or a new **System Admin**),
   - adds your `user_profiles` row, so you show in **Admin → Users**,
   - adds the **placeholder admin** (§2).
3. In the app: sign out, sign in → the **Admin** menu shows. **My roles now** shows `Admin access: yes`.

## §2 Why the placeholder admin

While **no** admin assignment is in force, v9.6 opens the *bootstrap*: every signed-in user may use admin actions and the sign-in allow-list is skipped. If you dropped your own admin role to test as a normal user, the server would still let admin actions through - the test would lie. The uid `placeholder_admin` keeps one admin assignment in force; no Google account can have that uid, so nobody can sign in as it.

## §3 Switch roles

| To | Menu item | Then |
|---|---|---|
| Hold a role for a while | **Give me a test role...** → role name → company → optional `<ticket type code>, <days>` (blank = every type, 1 day) | Reload the app (Ctrl+F5) |
| See what you hold | **My roles now** (`[TEST]` marks test roles) | - |
| Drop the test roles | **Remove my test roles...** (your real roles stay) | Reload |
| Test as a normal user | **Test as non-admin (remove my admin role)...** - refused while the placeholder admin is missing | Reload: no Admin menu, admin actions say *"Only admins can …"* |
| Get admin back | **Restore my admin role** (the app can't do it while you aren't admin) | Reload |

Test roles are temporary assignments whose notes start with `TEST`; a 1-day role ends at midnight Manila by itself. You can hold several at once (e.g. requester + manager to walk one ticket through two steps); v9.6 lets the requester approve their own ticket, so one person can drive a ticket from creation to completion. The server sees role changes at once (the 10-minute sign-in cache is cleared for you); the screens see them after a reload.

## §4 What to check per role

| As | Try | Expected |
|---|---|---|
| Requester only (non-admin) | create a ticket; add a link on it; cancel it | all allowed |
| Requester only (non-admin) | open Admin, approve the ticket | no Admin menu; not an approver of the step |
| Approver of the step (e.g. Manager) | approve / return / reject; add or fix a link | allowed while the ticket is at that step |
| Approver of a later step | approve the ticket at an earlier step | not allowed |
| Anyone in the company | **Report broken** on a link | allowed; the requester and the person who added it get a bell |
| Admin | invite a user; company email + test email; audit log | allowed |
| A Google account with no profile (private window) | sign in | *"Your account isn't set up yet. Ask your administrator for an invite."* |

Admin powers hide permission gaps (an admin can cancel / reopen any ticket, manage links on any ticket, see every report row): test the non-admin rows **after** "Test as non-admin".

## §5 Clean up (when real testers arrive) - **Clean up all test data...**

Removes every `TEST` assignment. The placeholder admin is removed only when another admin is in force, so the bootstrap never opens by accident. Before that, make at least one real second admin (**4. Users & access → Make a user admin**, or invite them with the admin role). Script Property `TEST_MY_UID` can stay or be deleted (Project Settings → Script Properties).

## §6 Limits

- One person at a time: you can't see the requester's and the approver's screens side by side. For that, use a second free Gmail account and **Admin → Users → Invite** it - the real onboarding flow.
- Records you create while holding a test role name **you** (requester, approver, history). Fine for testing; keep test tickets clearly titled ("TEST - …").
- The Testing items need edit access to the Sheet (like every JARVIS Admin item) - they are not in the app.

## §7 Fallback without the menu (manual Sheet edits)

- Admin: **4. Users & access → Make a user admin** with your uid, and again with `placeholder_admin`.
- Profile row: tab `user_profiles` → add *your uid*, *name*, *email*, `active` (status), `TRUE` (is_active).
- Roles: app → **Admin → Users** → your row → **Roles** → assign (type Temporary, notes `TEST`) / Remove.
