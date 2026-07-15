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

> **Superseded 2026-07-14 — the *data* ask above is withdrawn.** WSFY is now built entirely on our own
> idlookup.me infrastructure (Vercel + Neon); we generate/serve the inbound-activity data ourselves, so
> BC no longer needs to build the finder. The **only remaining BC dependency** is a verifiable member-auth
> credential so our external domain can authenticate the calling member and read paid status — see
> **[WSFY-AUTH](#wsfy-auth--verifiable-member-auth-token-for-cross-domain-idlookupme-services)** below.

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

## WSFY-AUTH — verifiable member-auth token for cross-domain (idlookup.me) services

**Registered 2026-07-14. Status: blocked-on-BC, NOT yet sent.** Evidence = code fact (below), not a live
demo — like the WISFY/Alerts asks, this is a capability request, so the demo-gate does not apply.

**Use case:** WSFY runs on our own idlookup.me backend (Vercel + Neon), independent of BC for the
feature/data. But some WSFY responses reveal **real searcher identities** — a "proof" searcher name in the
tease, and full searcher detail for paid members. To serve those securely, the idlookup.me backend must
(a) know **which BC member** is calling, so a member can only see who's searching for *themselves*, and
(b) know their **paid status**, so real names / paid detail are gated to the actual paid owner.

**The blocker (verified in code):** BC uses **cookie-based server-side sessions and does not issue JWTs to
clients.** In `src/services/apiRouter.js:22-37`, the comment states *"BC uses cookie-based sessions and
does not issue JWTs to clients"*; the consumer's `accessToken` is built by `createBcSessionToken` as
`btoa(JSON.stringify({ bcSession, user, iat, exp }))` and is explicitly *"NOT cryptographically verified —
it exists only for client-side route-gating."* It is forgeable by anyone. The real BC session is a cookie
scoped to BC's domain, which the idlookup.me backend (a **different domain**) cannot see or validate. So
idlookup.me has **no way** to authenticate a BC user or confirm paid status without BC providing something
verifiable server-side.

**The ask (one capability unblocks both identity-binding and the paid-tier gate):** on successful login,
BC issues a **verifiable credential** that the idlookup.me backend can validate **server-side without
calling BC per request** — a signed JWT via either:
- **(i)** a **shared HMAC secret** we set as a Vercel env, or
- **(ii)** an **RS256 key with a JWKS URL** we can fetch/cache.

Carrying at minimum: **`userId`** (stable), the member's **`name`**, and **`paid` / subscription status**
(or enough to derive it). **Short TTL + refresh is fine.**

**Please also confirm (interim-path question):** is BC's session cookie **`httpOnly`**? If **not**, a
forwardable session id could let idlookup.me do a server-side validation call as an interim; if **yes**
(likely), the verifiable-token ask above is the only route.

| | |
|---|---|
| **Blocked capability** | WSFY tease "proof" searcher name + full searcher detail for paid members (identity-bound, paid-gated) |
| **BC dependency** | verifiable login credential (signed JWT: shared HMAC **or** RS256+JWKS) carrying `userId` + `name` + `paid` |
| **Evidence** | `src/services/apiRouter.js:22-37` — cookie sessions, no client JWT; `accessToken` is a forgeable `btoa(JSON.stringify(...))` blob |
| **Open question** | is the BC session cookie `httpOnly`? (determines whether an interim validation call is viable) |

---

## Summary

| Cluster | BC capabilities needed | BC has | Net new |
|---|---|---|---|
| ~~**WISFY** (data)~~ | ~~inbound-activity finder~~ — **superseded 2026-07-14, self-hosted on idlookup.me** | — | ~~1~~ → **0** |
| **WSFY-AUTH** | verifiable member-auth token (signed JWT: HMAC or RS256+JWKS) w/ `userId`+`name`+`paid` | cookie session only, no client JWT | **1** |
| **Alerts** | watch CRUD · monitoring · notification feed · delivery | `managedContact.*` (addresses) | **4** |

The Alerts cluster is **launch-deferrable** (ships today as an honest "coming soon" preview). **WSFY-AUTH**
is the live blocker for the WSFY reveal-identity tier once the idlookup.me backend is serving real searcher
names. Owned/tracked by the `bc-asks-register` agent alongside the CSR asks.
