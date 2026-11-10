<!--
===============================================================================
JARVISbyERP — TICKETING & WORKFLOW ORCHESTRATION SYSTEM
===============================================================================
Document: DESIGN_SnoozePauseSLA_20261110.md | Author: Kenneth R. Advento | Version: 1.0.0
Created: 10 November 2026 UTC+8 (Philippine Standard Time) | Modified: 10 November 2026 UTC+8 (Philippine Standard Time)
Purpose: Two approver features kept apart on purpose - Snooze (hide a ticket from Your turn, the SLA keeps running) and Pause SLA (stop the clock while a step waits on someone outside the company) | Status: Design - decided points from the user, Claude's proposals marked; NOT built
REVISION HISTORY:
- v1.0.0 | 10 November 2026 UTC+8 (Philippine Standard Time) | Kenneth R. Advento | Created (session 5f83b40e). User: "Snooze function, but only in enterprise"; "the SLA keeps running while a ticket is snoozed - correct. snooze time should not exceed deadline date/time"; "pause SLA can be an option for tickets that has dependencies from external. pause SLA option per step, but not available if ticket is in immediate head or department/head approver level"; "for doc again, no build yet. your take as well"; "no snooze if ticket already exceeded regular (if ticket type has pause SLA) SLA"
===============================================================================
-->

# DESIGN — Snooze and Pause SLA

## Context
- Approvers asked for a way to put a ticket aside. Two different needs hide in that request:
  1. **"Not now"**: the approver will act later and wants a shorter Your turn list. Nothing outside the company is holding it up. This is **Snooze**. The clock must keep running, otherwise snoozing would hide lateness.
  2. **"Can't yet"**: the step waits on someone outside the company (a supplier quote, a government office, a bank). The delay is not the approver's. This is **Pause SLA**. The clock stops, and that is visible to everyone.
- Keeping them as two features stops Snooze from being used to dodge the SLA.
- Where it's built: the cloud server (`PLAN_Migration_Unified_20261108.md` Phase 4), with the v10.3 approver features (head approval, delegation, bulk approve). Apps Script is frozen (fixes only).

## Decisions (user, 10 Nov 2026)
| # | Decision |
|---|---|
| D1 | Snooze is **Enterprise only** (`snooze`, `PLAN_PlanTiers_Subscriptions_20261031.md` §2). |
| D2 | **The SLA keeps running while a ticket is snoozed.** |
| D3 | **A snooze cannot end after the step's deadline** (the step due date / time). |
| D4 | **Pause SLA** exists for steps that depend on someone outside the company. |
| D5 | Pause SLA is **an option per workflow step** (Admin turns it on per step). |
| D6 | Pause SLA is **not available on head-level approvals**: the immediate head step (`__head__`, `PLAN_FeatureGaps_Volume_20261031.md` §4.5) and department-head approver steps. |
| D7 | **No snooze once the step has exceeded its SLA.** Where the step allows Pause SLA, "exceeded" is measured on **counted** time (the regular SLA, paused time excluded), so a step that was paused is overdue only when its counted time runs out. |

## §1 Snooze
**What the approver sees.** On a Your turn row and on their line of the routing slip: "Snooze". Choices: *later today* (in 2 hours), *tomorrow 08:00*, *next working day 08:00*, or a date and time. Choices that would end after the deadline are not offered. The custom picker stops at the deadline (D3). On an overdue step the Snooze action is not shown at all; the row says why on hover: "Overdue - can't be snoozed" (D7).

**Rules.**
- S1. Only the person whose turn it is can snooze, and only for themselves. On an "any" step with several approvers, the ticket leaves only the snoozer's list and stays on the others'.
- S2. The snooze end is clamped to the step deadline (D3). No deadline (a step without an SLA): allowed up to **5 working days** *(Claude's proposal)*.
- S2a. Overdue steps can't be snoozed (D7). "Overdue" uses counted time: on a step that allows Pause SLA, the paused working time is left out, so the regular SLA is what counts. The server checks it too (not only the button): `SNOOZE_OVERDUE` refusal.
- S3. The SLA keeps running (D2). Escalations fire as usual.
- S4. The ticket comes back early when any of these happens: an escalation fires on it, it falls due, someone comments on it, the requester edits it, or it is returned to this step.
- S5. On return: a bell notification, "Back from snooze", and the row shows "snoozed until 14:00, back".
- S6. A ticket that moves on (another approver acts on an "any" step, admin reassigns, it is cancelled) drops the snooze silently.
- S7. Not shown to the requester. Shown to admins in the history: `SNOOZE` / `UNSNOOZE` in `ticket_action_logs` with the chosen end.
- S8 *(Claude's proposal)*. A filter on Your turn: "Snoozed (n)", so nothing is lost. Unsnooze is one click.

**Data.** `ticket_snoozes` (`id`, `ticket_id`, `step_id`, `user_id`, `snoozed_at`, `snooze_until`, `ended_at`, `end_reason` = `time` / `escalation` / `due` / `activity` / `moved_on` / `user`). The list query excludes rows with an open snooze for the caller. Index on (`user_id`, `snooze_until`) where `ended_at` is null. The wake-up job runs every minute on the server (or Cloud Scheduler). It is idempotent (A19).

## §2 Pause SLA
**What the approver sees.** On their line of the slip, only on steps where Admin allowed it: "Pause SLA - waiting on someone outside". They must give:
- a **reason** from the company's list (e.g. *Waiting for supplier*, *Waiting for government office*, *Waiting for bank*, *Other*: free text);
- **who** they are waiting on (free text, e.g. "TechHub quotation");
- an **expected resume** date (required, *Claude's proposal*). It becomes a reminder, not an automatic resume.

**Rules.**
- P1. Admin turns it on per step (D5): workflow step setting **"Allow SLA pause (waiting on someone outside)"**, off by default, with **maximum pause per ticket** (default 10 working days) and **maximum pauses per ticket** (default 2) *(Claude's proposal)*.
- P2. Never on head-level approvals (D6): the immediate head step can't have the setting. A step whose approvers are department-head roles can't have it either (see Open point O1). The Admin screen greys it out with the reason.
- P3. While paused: no SLA time is counted, escalations don't fire, the ticket shows **"Paused - waiting for supplier (TechHub quotation), since 10 Nov 14:00"** on the slip, in lists and in reports. The ticket moves from Your turn to a **"Paused"** list.
- P4. **Visible to the requester** (unlike snooze). The requester sees why their request is waiting.
- P5. Resume: by any approver of the step, or automatically when the maximum pause is reached (then the clock restarts and a bell notification goes to the step's approvers). At the expected resume date, a reminder: "Still waiting on TechHub? Resume or extend". Extending counts as a new pause (P1 maximum).
- P6. The deadline moves by the paused **working** time, computed with the company calendar, hours and holidays (the same SLA engine as step SLAs, `docs/reference/SLA_IMPLEMENTATION.md`). Never by adding raw hours.
- P7. Reports show three numbers per step: **elapsed**, **paused**, **counted**. SLA analytics use *counted*. A "most paused steps" view lets Admin see a step that is always paused, which usually means it should be a task step or the external party should be a step.
- P8. Logged: `SLA_PAUSE` / `SLA_RESUME` in `ticket_action_logs` with the reason, who, and the paused working minutes.
- P9. Return, reject and cancel end a pause first (logged), then act.

**Data.** `ticket_sla_pauses` (`id`, `ticket_id`, `step_id`, `paused_by`, `reason_code`, `waiting_on`, `paused_at`, `expected_resume_at`, `resumed_at`, `resumed_by`, `resume_reason` = `user` / `max_reached` / `moved_on`, `paused_working_minutes`). `workflow_steps` gets `allow_sla_pause` (false), `max_pause_working_days` (10), `max_pauses` (2). `sla_pause_reasons` per company (seeded with the four above). `tickets.step_due_date` is recomputed on resume in the same transaction.

## §3 Snooze and pause together
- A paused ticket can't be snoozed: it is already off Your turn (on Paused). Snoozing would mean nothing.
- Pausing a snoozed ticket ends the snooze first (logged).
- After a resume, a snooze is clamped to the **new** deadline (D3).

## §4 Plans *(Claude's proposal for Pause SLA; Snooze is decided)*
| Feature | Basic / Basic+ | Advanced | Enterprise |
|---|---|---|---|
| Snooze (`snooze`) | – | – | ✓ (D1) |
| Pause SLA (`sla_pause`) | – | ✓ | ✓ |

Why Advanced: step SLAs and escalation are Advanced and up already. Pause only means something where an SLA runs, so it follows the SLA features.

## §5 Claude's take
1. **Keep them apart** (as above). Snooze is personal and quiet; Pause is public and changes the numbers. Merging them ("snooze + pause") would give everyone a way to stop the clock, and SLA reports would stop meaning anything.
2. **Pause needs a reason and a name**, and the requester sees it. That is the brake on misuse, together with the per-step switch, the maximum days and the maximum count.
3. **Reminder, not auto-resume, at the expected date.** External parties are rarely on time. An automatic resume would put the step in breach for someone else's delay. The hard ceiling is the maximum pause (P1), and that one does resume automatically.
4. **Watch for steps that are always paused** (P7). They point to a workflow that should have a task step for the outside party ("Supplier quotation received") rather than a pause.
5. **Head-level exclusion is right.** Head approvals are internal decisions with no outside dependency. If one does wait on something outside, the head can return the ticket to the requester.

## §6 Open points
| # | Question | Proposed |
|---|---|---|
| O1 | How is a "department head" step recognised? The system has the immediate head step (`__head__`) but no department-head concept yet. | A role flag `is_head_level` on roles (Admin → Roles). A step whose approver roles include a head-level role can't allow a pause. Set when department-head routing is designed. |
| O2 | Who maintains the pause reasons? | Company admin, per company. Seeded with four. |
| O3 | Does a pause stop the **ticket-level** due date too (if one is added later), or only the step's? | Only the step's. A ticket-level target would show elapsed and paused separately. |
| O4 | Snooze on a step without an SLA: is 5 working days right? | Yes, as a default. A company setting later if asked. |

## §7 Tests (when built)
- Snooze: clamped to the deadline; refused when overdue (`SNOOZE_OVERDUE`), and allowed on a step that was paused but whose counted time is still inside the SLA; early return on escalation / due / comment; an "any" step keeps it on the other approvers' lists; not on Basic / Advanced (gate refuses `snooze`); hidden from the requester.
- Pause: refused on `__head__` and on head-level steps; refused when the step doesn't allow it; deadline moves by working minutes across a weekend and a holiday (TZ=UTC and Asia/Manila); escalation doesn't fire while paused; max days → auto-resume; max count → refused; return / reject / cancel end the pause first; the requester sees the pause.
