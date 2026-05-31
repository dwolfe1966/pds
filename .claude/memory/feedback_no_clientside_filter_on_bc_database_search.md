---
name: no-clientside-filter-on-bc-database-search
description: "Do NOT apply client-side `.filter()` on the response of BC `/database/search` — let `query.*` do the server-side scoping. The response trims fields via displayFields, so a client filter that checks a non-displayed field wipes every doc."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: beff305e-e28e-465c-90af-417c852b951d
---

When calling BC's `/database/search` (via `csrFindUserTracking`, `adminFindContacts`, etc.) and you need to scope results to one entity (a user, an order, a contact), put the constraint in the `query` object — BC will filter server-side. Do NOT then add a redundant `docs.filter(d => d.fieldName === id)` on the response.

**Why:** BC's `/database/search` response only returns the fields in `displayFields` (visible at the bottom of the response payload). Most identity-style fields — `updaterId`, `payerId`, `targetUserId`, sometimes `userId` itself — are NOT in `displayFields` for many collections. The client filter then compares `d.updaterId === id` against `undefined === id`, which is always false, and silently wipes every row. The tab/list goes empty and there is no error — looks like "no data", not "broken filter."

This exact bug has regressed multiple times in the admin app (most recently `UserDetailPage` `fetchLogins`/`fetchActivity`, fixed 2026-05-31 in commit `c22686e`; originally introduced 2026-04-20 in `7692c73` and lived for six weeks before anyone noticed). The pattern keeps coming back because the client filter LOOKS defensive — "what if the server doesn't filter?" — but is actively harmful when the field it checks isn't in the response.

**How to apply:**
- When wiring a new admin/CSR list against BC `/database/search`: put the scoping constraint in `query`, render the response docs directly, do NOT add a `.filter()` step on the client.
- When *modifying* an admin/CSR list and you see an existing `docs.filter(d => d.xxxId === id)`: ask first whether the server filter is doing it — if `csrFindUserTracking` (or sibling) already passes `xxxId` in `query`, the client filter is the bug. Verify by inspecting the live response's `displayFields`.
- If you genuinely think the server-side filter might miss (e.g., regex-style filters, optional fields): verify by checking the BC `/database/search` response for a few docs and confirming the constraint field is *in* `displayFields`. If not, the client filter cannot work — push the constraint to `query` instead.
- Don't comment "may not be supported, so also filter client-side." That comment was the rationalization for both regressions. Either the server filter works (verify and trust it) or it doesn't (file a BC ask).

Related: [[bc_admin_api_reference]], [[bytecrtrs_api_reference]], [[project_bug_triage_status_2026_05_29]].
