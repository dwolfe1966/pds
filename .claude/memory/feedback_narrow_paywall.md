---
name: Narrow paywall guard — /people/:id only
description: Paid guard applies only to report view, not search pages
type: feedback
---

Guard `/people/:id` only for the paid-route check. Do NOT guard `/search` or `/alerts`.

**Why:** Guards the highest-value action (report view) without blocking search, which has discovery/acquisition value. Can broaden after measuring conversion impact.

**How to apply:** When implementing PaidRoute or any paywall logic, only wrap the report detail route. Dashboard, search, and alerts remain accessible to free users (dashboard already shows upgrade banner).
