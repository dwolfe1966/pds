# BC consumer-feature asks — "Who's Searching For You" + Alerts

**Prepared 2026-06-19.** Two member-facing feature clusters are built in the UI but run on **mock data**
("coming soon" banners) because the data only BC can produce doesn't exist yet. Both are **fully
BC-blocked** — there is no consumer-side workaround (they require server-side search/monitoring data BC
owns). Unlike the CSR asks (which we demonstrate as *broken* via a live script), these are **new
capabilities** — "please build X," not "X is broken" — so this is a spec, not a demo.

App: **consumer** (`src/pages/member/`, `src/pages/sales/`). All asks are on `apiWrapper.api.*`.

---

## Cluster 1 — "Who's Searching For You" (WISFY)

**Use case:** a logged-in member sees who has searched for / viewed *them*.
**Screens:** `WhoIsSearchingPage` (`/who-is-searching`) — two tabs: **Searchers** and **Viewers**;
teaser on `DashboardHome`.
**Today:** 100% mock — `watchingHelpers.js` generates synthetic events (seeded PRNG); page shows a
"coming soon / sample preview" banner. Functions: `WhoIsSearchingPage.js` + `watchingHelpers.js`
(`generateEvents`, masking helpers already built).

**What BC has:** `apiWrapper.api.tracking.create(data)` (`/api/tracking/create`) — writes search/view
events. Search events land in the `trackings` collection, but **keyed by the searcher** (`updaterId`) +
the search params; there is no way to query "events whose *target* was this member."

**The ask (one capability):** an **inbound-activity finder** — given a member's identity
(name / phone / email / userId), return the search and profile-view events that *targeted them*.
- e.g. `apiWrapper.api.activity.inbound({ identity, type?: 'search'|'view', lastId })`
- Return should be **aggregated / anonymized** (city, state, time, search type) — not the raw searcher's
  PII — for privacy/legal safety.

| | |
|---|---|
| **Function chain (today, mock)** | `WhoIsSearchingPage` → `watchingHelpers.generateEvents` (synthetic) |
| **Becomes** | `WhoIsSearchingPage` → `apiWrapper.api.activity.inbound({ identity })` |
| **Blocks** | the entire WISFY page (both tabs) going live |

---

## Cluster 2 — Alerts (saved-search / identity monitoring)

**Use case:** a member sets up a watch on a name/phone/email/identity and is notified when something
changes (new record, new inbound search, etc.).
**Screens:** `AlertsPage` (`/alerts`), notifications feed (`NotificationBell`), `DashboardHome` alerts tile.
**Today:** mock / "coming soon" — `AlertsPage` just runs a one-time search (no persistence);
`api.getAlerts` → mock `/alerts`; `/notifications` → mock. No BC alert/scheduling endpoint exists.

**What BC has:** `apiWrapper.api.managedContact.create/find/unsubscribe` — manages opt-in **delivery
addresses** (email/phone). That's the address layer only.

**The asks (four capabilities):**
1. **Watch subscription CRUD** — create / list / update / delete a watch (monitored identity + criteria
   + frequency). *None today.*
2. **Monitoring / change-detection** — server-side detection of new records / changes / new inbound
   searches for a watched identity, emitting alert events. *None today.*
3. **Notification feed** — list / mark-read / delete in-app notifications. *Mock today.*
4. **Delivery pipeline** — send an alert to the member's opt-in channel (email/SMS), using
   `managedContact` as the address store. *Address store exists; the trigger→send pipeline does not.*

| | |
|---|---|
| **Function chain (today, mock)** | `AlertsPage` → search redirect; `api.getAlerts` → mock `/alerts`; `/notifications` → mock |
| **Becomes** | `apiWrapper.api.alert.{create,list,update,delete}` + `apiWrapper.api.notification.{list,markRead}` + BC monitoring + delivery via `managedContact` |
| **Blocks** | persistent alerts, the notifications feed, and any "we found something" email/SMS |

---

## Summary

| Cluster | BC capabilities needed | BC has | Net new |
|---|---|---|---|
| **WISFY** | inbound-activity finder (searches+views by target identity, anonymized) | `tracking.create` (by searcher only) | **1** |
| **Alerts** | watch CRUD · monitoring · notification feed · delivery | `managedContact.*` (addresses) | **4** |

Both clusters are **launch-deferrable** (they ship today as honest "coming soon" previews), so these are
roadmap asks for BC rather than launch blockers. Owned/tracked by the `bc-asks-register` agent alongside
the CSR asks.
