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
1. Consumer payment → paid-status desync (confirmation page sometimes lacks report link; dashboard doesn't reflect paid state). Suspect: billing hits real BC but subscription/user state stays mock — see `project_bc_integration_boundary.md`.
2. Consumer cleanup: remove unwired features; wire Account fields to BC; add "coming soon" banner to WSFY (Who's Searching For You); strip endpoint/internal info from consumer UI.
3. Admin/CSR focus: user profile must show orders, searches, logins, reports; remove unused menu items.
