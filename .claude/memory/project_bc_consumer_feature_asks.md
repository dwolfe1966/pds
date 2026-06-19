---
name: bc-consumer-feature-asks
description: "BC asks for the two member-facing feature clusters that are mock/'coming soon': Who's-Searching-For-You (1 capability) and Alerts (4 capabilities). Roadmap asks, not launch blockers. Doc: docs/BC_CONSUMER_FEATURE_ASKS.md."
metadata:
  node_type: memory
  type: project
  originSessionId: current
---

Two consumer feature clusters are built in the UI but run on MOCK data ("coming soon") because they
need server-side data only BC produces. Fully BC-blocked, no client workaround. These are NEW-capability
requests (feature spec), NOT bug-claims — so the demo-gate (used for CSR asks) doesn't apply; document
the current mock state instead. Doc: `docs/BC_CONSUMER_FEATURE_ASKS.md`. Owned by [[bc-asks-register]].

**WISFY ("Who's Searching For You")** — `WhoIsSearchingPage` + `watchingHelpers.js` (synthetic PRNG).
Tabs: Searchers, Viewers. BC has `tracking.create` (events keyed by the SEARCHER). **Ask = 1 capability:**
an inbound-activity finder — searches+views keyed by the TARGET member's identity, aggregated/anonymized
(no raw searcher PII). Reverse lookup doesn't exist today.

**Alerts** — `AlertsPage` (runs a one-time search, no persistence), `getAlerts`→mock `/alerts`,
`/notifications`→mock. BC has `managedContact.{create,find,unsubscribe}` (delivery ADDRESSES only).
**Ask = 4 capabilities:** (1) watch subscription CRUD, (2) server-side monitoring/change-detection,
(3) notification feed (list/markRead/delete), (4) delivery pipeline (trigger→send via managedContact).

Both are launch-DEFERRABLE (ship as honest "coming soon" previews). Decision earlier: rely on BC
tracking; the standalone tracking-api (port 3002, SessionsPage) is retired for launch — see
[[bc-consumer-feature-asks]] sibling note in the architecture decisions. WISFY's data source IS BC
tracking, which reinforces that direction.
