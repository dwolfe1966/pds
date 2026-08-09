---
name: project_monitoring_loop
description: Digital-footprint monitoring loop closed server-side — recheck cron + subject_user_key bridge + revived NotificationBell
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

The DF "monitoring loop" was UI-only (the removal tracker computed re-check due dates client-side; a `reappeared` status was handled in the UI but nothing server-side ever wrote it). Closed it honestly on 2026-08-09.

**What was built (seo Neon + consumer):**
- `seo/app/api/cron/optout-recheck/route.js` — daily Vercel cron (`0 9 * * *` in vercel.json), modeled on breach-monitor (CRON_SECRET auth, no-ops if DB unset). Emits `optout_recheck` identity_events for removals whose `relist_days` window has fully lapsed.
- **HONESTY RULE:** the cron emits "time to re-verify" ONLY. It NEVER writes `reappeared` — asserting a listing is back needs real detection (extension/worker follow-on). Keep those two truth-claims distinct.
- Dedup is **per re-list window**: `dedupKey = recheck:{sourceKey}:w{windowN}` where windowN = floor(elapsed / relist_days). So a member is reminded once PER window (not once ever, not every run). `last_changed` is deliberately not bumped, so windowN keeps advancing.

**The bridge gotcha (why this was non-trivial):** exposure_node is keyed by `subject_key = userId` (BC id); identity_events are keyed by `user_key = sha256(email)`. No join existed. Fix = new nullable `exposure_node.subject_user_key` column storing sha256(email), populated on the write path when email is available (`/api/optout` from identity.email; `/api/exposure` POST now accepts `email`; consumer `setExposureControl` now sends email). `listRemovalsDueForRecheck()` only returns nodes that carry it. `addIdentityEventByUserKey()` added to write events by hash without plaintext email (keeps identityEventsDb's no-plaintext discipline). Older nodes without the hash just don't get reminders — coverage grows.

**Reach (the piece that makes the loop actually close for an absent user):** `NotificationBell` was a dead placeholder (`notifications=[]`, not even mounted). Rewrote it to fetch `getIdentityEvents(user.email)`, show an unread badge (vs `idlNotifSeenAt` localStorage), and mounted it in `MemberNav` desktop auth section. Absent-user reach also already existed via My Activity (`/activity`), which renders identity_events (maps any identity event → 🛡️ Identity kind).

Email delivery of these reminders stays gated on OPTOUT_EMAIL_ENABLED (paused) — the loop closes in-app, email lights up later. Committed b6635cb + pushed. See [[project_exposure_graph]], [[project_wsfy_self_build]].

**Reappearance detection (extension, added same day):** the honest half the cron can't do — real first-party detection that a listing is BACK. `extension/content.js` now does ELEMENT-LEVEL matching (member's name co-occurring with a 2nd identifier — city/state/age/phone — inside one listing card, textContent 6–800 chars), NOT page-wide `innerText` (which the advisor flagged as an always-true false alarm since the broker echoes the searched name). Scoped by consent: detection only runs for brokers in `idlManagedSourceKeys` (the member's opted-out sources, written to localStorage by DigitalFootprint, synced to extension storage by identity-bridge). Reports via background SW → `POST /api/exposure-detection` (app-key + host_permission CORS-exempt like history).

**Honesty rule (same as cron):** detection SUSPECTS, never asserts. The endpoint only acts when there's an ACTIVE removal node for that source, and it logs a member-confirmable `reappearance_suspected` identity_event (dedup per episode via node.last_changed date) — it does NOT auto-flip control_status to `reappeared`. Auto-flip to `reappeared` still waits on a confirmation UI (the DF removal tracker already renders the `reappeared` state; wiring one-click confirm from the suspected event is the next step). host→source_key via SLD (spokeo.com→spokeo); backend validates against source_registry so a bad guess no-ops. New: `getNodeBySource()`, `/api/exposure-detection`, bell icon 👀. NOT yet committed at time of this note.
