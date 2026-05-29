---
name: Innovate around BC, don't wait for them
description: Owner directive from 2026-05-29 — too many cycles spent waiting for BC API changes. Default to client-side workarounds within the launch sprint. BC asks are a parallel channel, not a blocker.
type: feedback
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
**Owner stated 2026-05-29** (after spending a long arc on the F9 / messaging enumeration story):

> "I am really flustered it is taking so long and I feel we are falling into a mode where we are wanting BC to make changes, instead of innovating and working around what they have built. anyway, we are running out of time."

## How to apply

- **First reflex on any user-facing gap:** what can we do client-side, with the BC primitives we already have, that ships today? Build that.
- **BC asks are parallel, not sequential.** Drafting a BC ask doc (e.g. `docs/BC_*.md`) is fine and useful for tracking, but don't pause work on the consumer/admin app waiting for BC to respond. Pick the workaround that gets us to launch.
- **Time-box BC-blocked items.** If a fix genuinely requires BC and there's no client-side path, **document the gap, file the ask, move on.** Don't keep producing diagnostic patches hoping BC will respond fast.
- **Reconsider the "BC is source of truth" principle in context.** That principle (`feedback_bc_is_source_of_truth.md`) is still correct for *display state* — we still call BC every load to render. But the inverse interpretation — "wait for BC to give us new endpoints before solving problems" — is **not** what the principle says. Use BC's existing surface aggressively.
- **Default posture on closed questions BC owns:** ask once with full evidence (the rewritten `BC_USERCONTACT_LIST_404.md` style), then move on with the best workaround until they reply. The 2026-05-28 cycle showed BC can respond same-day to a well-evidenced ask — but don't bank on it for any specific item.

## Why: avoiding the failure mode

The F9/messaging cycle consumed multiple sessions of:
- Diagnose → file BC ask → wait → revise → wait → empirically verify → wait → cycle.

That's the failure mode. Right move would have been: ship the paste-link / local-ref workaround, accept the cross-device gap, document the BC ask, **stop touching the file** until BC replied. We kept circling back to "but if BC fixed X" instead of shipping launch-quality UX with what BC actually exposes today.

## What this is NOT

- It is not permission to invent fake state or pretend BC has features it doesn't (e.g., don't render "Resolved" status to consumers if BC doesn't return the tag).
- It is not permission to build a BFF / deploy infrastructure (`tracking-api/`, new services) before launch — owner's separate constraint still holds.
- It is not permission to merge half-finished fixes or ship without verification.

The boundary: **use every primitive BC has shipped to its fullest, and ship UX patches around the gaps.** Don't wait, don't escalate, don't relitigate.
