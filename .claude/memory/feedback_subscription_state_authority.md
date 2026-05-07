---
name: BC is the single authority for member subscription state
description: Member "is subscriber / is paid" must be derived from BC `billing.getOrders()` only — never from a local React-side flag, JWT claim, or mock-server field
type: feedback
originSessionId: 56f0e1b9-fadc-446e-a685-2ca079fb513a
---
Member subscription / paid status must be sourced from BC `billing.getOrders()` only. If a member has a non-canceled order returned by `getOrders`, they are a subscriber. There is no parallel local source of truth.

**Why:** User explicitly directed on 2026-05-06 after observing post-purchase desync — confirmation page sometimes lacked a report-detail link and the dashboard didn't reflect paid status. Two stores of truth (React state vs BC) caused the divergence. Single-source-of-truth via BC eliminates the desync class entirely.

**How to apply:**
- Do not introduce or rely on local `isPaid` / `subscriber` / `tier` booleans in `AuthContext`, `localStorage`, or session JSON for gating.
- Member-side gates (paywall, dashboard "your plan" UI, report-detail access) must read from a `getOrders()`-derived selector.
- After a successful `billing.sale`, refresh `getOrders()` BEFORE navigating to the confirmation page (or have the confirmation page itself await `getOrders()`); otherwise the confirmation can render without the report link.
- Cache `getOrders()` carefully — invalidate on payment, on cancel/uncancel, and on login. Do not let stale order data masquerade as ground truth.
- Mock server's user fields about subscription status are not authoritative and should not be read by the member experience.

Tightly related: `project_bc_integration_boundary.md` (BC surface area), `feedback_narrow_paywall.md` (paywall scope is /people/:id only).
