---
name: ByteCrtrs integration boundary — what's wireable vs forced-mock
description: BC consumer ApiWrapper now exposes auth, idLookup, billing (incl. orders/offers), user (update/password), statistics, message/contact, managedContact, tracking, and optOut. Almost everything in the consumer app is wireable; only features with no BC counterpart (e.g., WSFY) remain mock.
type: project
originSessionId: 56f0e1b9-fadc-446e-a685-2ca079fb513a
---
Updated 2026-05-06 from full consumer API doc the user shared. The earlier boundary memory was incomplete — BC exposes substantially more than auth/idLookup/optOut/billing alone.

**Wireable against real BC (consumer):**
- Auth: `auth.login` (also rehydrates session when called with no args), `auth.logout`
- Search: `idLookup.searchTeaser` (name/phone/email; pagination via `getMore`/`hasMore`)
- Reports: `idLookup.createReport`, `getReport`, `getReports` (list w/ pagination), `downloadPdfReport`
- Billing: `billing.sale`, `tokenSale`, `signup`, `getOrders`, `getActivatedProductTypes`, `cancelOrUncancelOrder`, `offer.findByShmName`
- User profile: `user.update({ firstName?, lastName?, phone? })`, `user.changePassword`, `user.resetPassword`
- Statistics: `countUserTeaserSearches`, `countUserReportCreations`, `countUserPdfDownloads`
- Contact: `message.contact.create` (billing/general), `message.contact.reply`, `message.contact.histories`, `user.createContact`, `user.getContacts`
- Managed contact (likely alerts opt-in): `managedContact.create`
- Tracking: `tracking.create`
- OptOut: `ApiWrapper.goPage('optOut', { newPage })`

**No BC counterpart — must stay mock or be hidden behind a "coming soon" surface:**
- WSFY ("Who's Searching For You") — no endpoint exposed; ship as "coming soon" banner per 2026-05-06 direction
- Any feature not on the list above

**Why:** Treating BC as authoritative wherever it exposes an endpoint is the launch posture. Consumer-facing UI must NOT leak endpoint/internal info (production-grade).

**How to apply:** Before stubbing or mocking a consumer feature, check this list. If BC has it, wire it. If not, hide the feature behind "coming soon" rather than half-building. Subscription state is **authoritative from `billing.getOrders()`** — see `feedback_subscription_state_authority.md`.

Admin-side uses the separate `csrWrapper` IIFE — see `bc_admin_api_reference.md`.
