---
name: Production launch timeline
description: Site must be live in production within 5-10 days of 2026-05-06; full backlog arriving 2026-05-07
type: project
originSessionId: 56f0e1b9-fadc-446e-a685-2ca079fb513a
---
Production launch target: 2026-05-11 to 2026-05-16 (5-10 days from 2026-05-06).

**Why:** User stated launch deadline on 2026-05-06; full backlog arriving the following day.

**How to apply:** Favor minimum-viable fixes and visible cleanup over refactors. Anything not on the launch path should be deferred or stubbed (e.g., "coming soon" banners) rather than half-built. Production posture = no internal/dev/endpoint info leaking into consumer UI.

Issues surfaced 2026-05-06 ahead of the backlog:
1. ~~Consumer payment → paid-status desync~~ **Resolved 2026-05-09** — `billing.getOrders()` is now the single source of truth; confirmation page → dashboard paid-state flow works. (See `feedback_subscription_state_authority.md`.)
2. Consumer cleanup: remove unwired features; wire Account fields to BC; add "coming soon" banner to WSFY (Who's Searching For You); strip endpoint/internal info from consumer UI. **Mostly done** as of 2026-05-09 (commits `c80bf7c`, `952d646`, `34f18a0`, `ae1239a`).
3. Admin/CSR focus: user profile must show orders, searches, logins, reports; remove unused menu items. Searches and Reports promoted to top-level tabs (`c693b86`); confirm logins tab.
